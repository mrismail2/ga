-- ============================================================
-- Kobciye Phase 5 corrective migration
-- WhatsApp OTP password recovery + complete account activation
--
-- IMPORTANT:
--   * additive only; no delivered migration is rewritten
--   * no plaintext OTP is stored
--   * public Student/Parent login remains identifier + password
--   * WhatsApp is used ONLY for Forgot Password recovery
-- ============================================================
begin;

-- Stable normalization helpers used by server-only recovery resolvers.
create or replace function normalize_kobciye_text(p_value text)
returns text language sql immutable set search_path = public as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', ' ', 'g'))
$$;

create or replace function normalize_kobciye_phone(p_value text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if v_digits = '' then return null; end if;
  if left(v_digits, 2) = '00' then v_digits := substr(v_digits, 3); end if;
  if left(v_digits, 3) = '252' then return '+' || v_digits; end if;
  if left(v_digits, 1) = '0' then return '+252' || substr(v_digits, 2); end if;
  -- Somali local numbers are commonly entered without +252.
  if length(v_digits) between 8 and 9 then return '+252' || v_digits; end if;
  return '+' || v_digits;
end $$;

revoke all on function normalize_kobciye_text(text) from public;
revoke all on function normalize_kobciye_phone(text) from public;
grant execute on function normalize_kobciye_text(text) to authenticated, service_role;
grant execute on function normalize_kobciye_phone(text) to authenticated, service_role;

-- Make the public School ID uniqueness explicitly case-insensitive.
update schools set login_code = upper(trim(login_code)) where login_code is not null;
do $$
begin
  if exists (
    select upper(login_code) from schools where login_code is not null
    group by upper(login_code) having count(*) > 1
  ) then
    raise exception 'duplicate case-insensitive School login codes exist; resolve before applying';
  end if;
end $$;
create unique index if not exists schools_login_code_ci_unique
  on schools (upper(login_code)) where login_code is not null;

-- Canonical Parent login/recovery phone. Existing parent rows are preserved.
alter table parents add column if not exists login_phone_e164 text;
alter table parents add column if not exists login_enabled boolean not null default true;
update parents
set login_phone_e164 = normalize_kobciye_phone(phone)
where login_phone_e164 is null and phone is not null;

-- Stop safely when two active login-enabled parent records in one school own
-- the same WhatsApp number. The read-only preflight identifies the rows.
do $$
begin
  if exists (
    select school_id, login_phone_e164
    from parents
    where login_enabled = true and status = 'active' and login_phone_e164 is not null
    group by school_id, login_phone_e164
    having count(*) > 1
  ) then
    raise exception 'duplicate active Parent login phone exists inside a school; run the correction preflight and resolve ownership before applying';
  end if;
end $$;

create unique index if not exists parents_login_phone_unique
  on parents (school_id, login_phone_e164)
  where login_enabled = true and status = 'active' and login_phone_e164 is not null;
create index if not exists parents_login_phone_lookup
  on parents (school_id, login_phone_e164) where login_phone_e164 is not null;

-- Service-only OTP challenges. No client policy intentionally exists.
create table if not exists password_reset_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student', 'parent')),
  school_id uuid references schools(id) on delete cascade,
  target_profile_id uuid references profiles(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  parent_id uuid references parents(id) on delete cascade,
  phone_hash text,
  request_key_hash text,
  otp_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  resend_count integer not null default 0 check (resend_count >= 0),
  provider_message_id text,
  request_ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'student' and parent_id is not null)
    or kind = 'parent'
    or target_profile_id is null -- decoy challenge used for anti-enumeration
  )
);
create index if not exists password_reset_otp_target_recent
  on password_reset_otp_challenges (kind, school_id, target_profile_id, created_at desc);
create index if not exists password_reset_otp_ip_recent
  on password_reset_otp_challenges (request_ip_hash, created_at desc);
create index if not exists password_reset_otp_request_recent
  on password_reset_otp_challenges (request_key_hash, created_at desc);
create trigger password_reset_otp_updated_at before update on password_reset_otp_challenges
  for each row execute function set_updated_at();
alter table password_reset_otp_challenges enable row level security;
-- No authenticated-client policy is created. Service-role Edge Functions are
-- the only callers; operational audit uses audit_logs without exposing OTP hashes.

-- Resolve a Student password-reset target using ALL required identity fields:
-- School ID + full name + active class + linked guardian mobile.
-- Exactly one match is required. Returns NULL for zero or ambiguous matches.
create or replace function resolve_student_password_reset_target(
  p_school_code text,
  p_full_name text,
  p_class_name text,
  p_parent_phone text
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_phone text := normalize_kobciye_phone(p_parent_phone);
begin
  if normalize_kobciye_text(p_school_code) = ''
     or normalize_kobciye_text(p_full_name) = ''
     or normalize_kobciye_text(p_class_name) = ''
     or v_phone is null then
    return null;
  end if;

  select jsonb_agg(x.obj) into v_rows
  from (
    select distinct jsonb_build_object(
      'school_id', sc.id,
      'student_id', st.id,
      'profile_id', st.profile_id,
      'parent_id', pa.id,
      'phone', pa.login_phone_e164
    ) as obj
    from schools sc
    join students st on st.school_id = sc.id and st.status = 'active' and st.profile_id is not null
    join student_enrollments se on se.student_id = st.id and se.school_id = sc.id and se.status = 'active'
    join classes cl on cl.id = se.class_id and cl.school_id = sc.id
    join student_parents sp on sp.student_id = st.id and sp.can_receive_messages = true
    join parents pa on pa.id = sp.parent_id and pa.school_id = sc.id
      and pa.status = 'active' and pa.login_enabled = true
    where upper(trim(sc.login_code)) = upper(trim(p_school_code))
      and normalize_kobciye_text(st.full_name) = normalize_kobciye_text(p_full_name)
      and normalize_kobciye_text(cl.name) = normalize_kobciye_text(p_class_name)
      and pa.login_phone_e164 = v_phone
  ) x;

  if v_rows is null or jsonb_array_length(v_rows) <> 1 then return null; end if;
  return v_rows -> 0;
end $$;
revoke all on function resolve_student_password_reset_target(text, text, text, text) from public, anon, authenticated;
grant execute on function resolve_student_password_reset_target(text, text, text, text) to service_role;

-- Resolve a Parent password-reset target using School ID + canonical mobile.
-- Exactly one active login-enabled Parent must own the number in that school.
create or replace function resolve_parent_password_reset_target(
  p_school_code text,
  p_parent_phone text
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_phone text := normalize_kobciye_phone(p_parent_phone);
begin
  if normalize_kobciye_text(p_school_code) = '' or v_phone is null then return null; end if;

  select jsonb_agg(x.obj) into v_rows
  from (
    select jsonb_build_object(
      'school_id', sc.id,
      'parent_id', pa.id,
      'profile_id', pa.profile_id,
      'phone', pa.login_phone_e164
    ) as obj
    from schools sc
    join parents pa on pa.school_id = sc.id
    where upper(trim(sc.login_code)) = upper(trim(p_school_code))
      and pa.status = 'active'
      and pa.login_enabled = true
      and pa.profile_id is not null
      and pa.login_phone_e164 = v_phone
  ) x;

  if v_rows is null or jsonb_array_length(v_rows) <> 1 then return null; end if;
  return v_rows -> 0;
end $$;
revoke all on function resolve_parent_password_reset_target(text, text) from public, anon, authenticated;
grant execute on function resolve_parent_password_reset_target(text, text) to service_role;


-- Atomically claim a verified challenge before changing the Auth password.
-- The Edge Function verifies the HMAC first, then this service-only RPC makes
-- replay/concurrent verification impossible. A claimed challenge is consumed
-- even if the external Auth update later fails; the user can request a new OTP.
create or replace function claim_password_reset_otp_challenge(p_challenge uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_row password_reset_otp_challenges;
begin
  update password_reset_otp_challenges
     set consumed_at = now()
   where id = p_challenge
     and consumed_at is null
     and expires_at > now()
     and failed_attempts < 5
  returning * into v_row;

  if v_row.id is null then return null; end if;
  return jsonb_build_object(
    'id', v_row.id,
    'kind', v_row.kind,
    'school_id', v_row.school_id,
    'target_profile_id', v_row.target_profile_id,
    'student_id', v_row.student_id,
    'parent_id', v_row.parent_id
  );
end $$;
revoke all on function claim_password_reset_otp_challenge(uuid) from public, anon, authenticated;
grant execute on function claim_password_reset_otp_challenge(uuid) to service_role;

-- Add the audit trail missing from the earlier public School ID setter.
create or replace function set_school_login_code(p_school uuid, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_old text;
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may set the login code'; end if;
  if v_code = '' or length(v_code) < 4 or v_code !~ '^[A-Z0-9-]+$' then
    raise exception 'the login code must contain at least 4 letters, numbers or hyphens';
  end if;
  if exists (select 1 from schools where upper(login_code) = v_code and id <> p_school) then
    raise exception 'this login code is already in use';
  end if;
  select login_code into v_old from schools where id = p_school for update;
  update schools set login_code = v_code where id = p_school;
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (p_school, auth.uid(), 'school.login_code.updated', 'schools', p_school,
          jsonb_build_object('old_code', v_old, 'new_code', v_code));
  return v_code;
end $$;
revoke all on function set_school_login_code(uuid, text) from public, anon;
grant execute on function set_school_login_code(uuid, text) to authenticated;

-- School Admin helper for maintaining the Parent WhatsApp login/recovery
-- number. The server normalizes, rejects duplicate ownership, and audits.
create or replace function set_parent_login_phone(
  p_school uuid,
  p_parent uuid,
  p_phone text,
  p_enabled boolean default true
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_phone text := normalize_kobciye_phone(p_phone);
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may change Parent login phone'; end if;
  if v_phone is null then raise exception 'a valid mobile number is required'; end if;
  if not exists (select 1 from parents where id = p_parent and school_id = p_school) then
    raise exception 'Parent belongs to another school';
  end if;
  if coalesce(p_enabled, true) and exists (
    select 1 from parents
    where school_id = p_school and id <> p_parent and status = 'active'
      and login_enabled = true and login_phone_e164 = v_phone
  ) then
    raise exception 'this mobile number already belongs to another Parent login';
  end if;

  update parents
    set phone = p_phone,
        login_phone_e164 = v_phone,
        login_enabled = coalesce(p_enabled, true)
    where id = p_parent and school_id = p_school;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (p_school, auth.uid(), 'parent.login_phone.updated', 'parents', p_parent,
          jsonb_build_object('enabled', coalesce(p_enabled, true)));
  return v_phone;
end $$;
revoke all on function set_parent_login_phone(uuid, uuid, text, boolean) from public, anon;
grant execute on function set_parent_login_phone(uuid, uuid, text, boolean) to authenticated;

-- Complete activation for a generated no-email Student login immediately
-- after the secure provisioning function created the Auth user + invitation.
-- Only service_role may call it.
create or replace function activate_generated_student_account(
  p_invitation uuid,
  p_auth_user uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv account_invitations;
  v_existing uuid;
begin
  select * into v_inv from account_invitations
  where id = p_invitation
    and intended_role = 'student'
    and invitee_auth_user_id = p_auth_user
    and status = 'pending'
  for update;

  if v_inv.id is null then raise exception 'generated student invitation is not available'; end if;
  if v_inv.expires_at < now() then
    update account_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'generated student invitation expired';
  end if;

  select profile_id into v_existing from students where id = v_inv.student_id for update;
  if v_existing is not null and v_existing <> p_auth_user then
    raise exception 'student already belongs to another Auth profile';
  end if;

  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles
    set role = 'student', school_id = v_inv.school_id, must_change_password = true
    where id = p_auth_user;
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  update students set profile_id = p_auth_user
  where id = v_inv.student_id and school_id = v_inv.school_id;

  update account_invitations
    set status = 'accepted', accepted_at = now()
    where id = v_inv.id;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_inv.school_id, null, 'account.generated_student.activated', 'students', v_inv.student_id,
          jsonb_build_object('invitation_id', v_inv.id));

  return jsonb_build_object('student_id', v_inv.student_id, 'school_id', v_inv.school_id, 'role', 'student');
end $$;
revoke all on function activate_generated_student_account(uuid, uuid) from public, anon, authenticated;
grant execute on function activate_generated_student_account(uuid, uuid) to service_role;

commit;
