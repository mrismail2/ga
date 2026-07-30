-- ============================================================
-- Kobciye Phase 5 — Stage 1: account provisioning
--
-- Lets a School Admin turn an EXISTING teacher / student / parent record into
-- a login, without ever creating a second domain record. The link columns it
-- fills already exist in the Phase 1–4 schema and are reused as-is:
--     teachers.profile_id   students.profile_id   parents.profile_id
--
-- The Phase 3 school_admin invitation workflow (school_invitations + its RPCs)
-- is left completely untouched; this adds a SEPARATE table for the three
-- operational roles so neither flow can interfere with the other.
--
-- Supabase Auth administration itself stays server-side: the Edge Function
-- passes back the auth user id the Auth Admin API returned, exactly as
-- school_invitations already does. No service-role key ever reaches a client.
--
-- Additive only. No table is dropped, no data is rewritten, no reset.
-- ============================================================

begin;

-- ============================================================
-- Preflight — refuse to install over already-inconsistent link data.
-- Nothing is deleted or rewritten; the error names the category so an
-- administrator can inspect and correct the rows themselves.
-- ============================================================
do $$
begin
  -- a domain record may only be linked to a profile of the SAME school
  if exists (
    select 1 from teachers t join profiles p on p.id = t.profile_id
    where t.profile_id is not null and p.school_id is distinct from t.school_id
  ) then
    raise exception 'existing teachers.profile_id rows link to a profile of another school';
  end if;
  if exists (
    select 1 from students s join profiles p on p.id = s.profile_id
    where s.profile_id is not null and p.school_id is distinct from s.school_id
  ) then
    raise exception 'existing students.profile_id rows link to a profile of another school';
  end if;
  if exists (
    select 1 from parents pa join profiles p on p.id = pa.profile_id
    where pa.profile_id is not null and p.school_id is distinct from pa.school_id
  ) then
    raise exception 'existing parents.profile_id rows link to a profile of another school';
  end if;
  -- one profile may not already back two records of the same kind
  if exists (select profile_id from teachers where profile_id is not null
             group by profile_id having count(*) > 1) then
    raise exception 'existing teachers rows share a profile_id';
  end if;
  if exists (select profile_id from students where profile_id is not null
             group by profile_id having count(*) > 1) then
    raise exception 'existing students rows share a profile_id';
  end if;
  if exists (select profile_id from parents where profile_id is not null
             group by profile_id having count(*) > 1) then
    raise exception 'existing parents rows share a profile_id';
  end if;
end $$;

-- one profile backs at most ONE teacher / student / parent record
create unique index if not exists teachers_profile_id_unique
  on teachers (profile_id) where profile_id is not null;
create unique index if not exists students_profile_id_unique
  on students (profile_id) where profile_id is not null;
create unique index if not exists parents_profile_id_unique
  on parents (profile_id) where profile_id is not null;

-- ============================================================
-- account_invitations — invitations for the three OPERATIONAL roles.
-- Deliberately separate from school_invitations (school_admin only), which
-- keeps the approved Phase 3 flow untouched.
-- ============================================================
create table if not exists account_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  -- exactly ONE of these three is set; the check constraint below enforces it
  teacher_id uuid references teachers (id) on delete cascade,
  student_id uuid references students (id) on delete cascade,
  parent_id  uuid references parents (id)  on delete cascade,
  intended_role user_role not null check (intended_role in ('teacher', 'student', 'parent')),
  -- a student may legitimately have no email; those are provisioned by the
  -- server with a generated login instead, so email is nullable here.
  invitee_email text check (invitee_email is null or position('@' in invitee_email) > 1),
  invitee_name text not null default '',
  invitee_phone text,
  -- filled ONLY from a secure server-side Supabase Auth result, never from a
  -- client claiming "this is my user id" (same rule as school_invitations).
  invitee_auth_user_id uuid references auth.users (id) on delete set null,
  status invitation_status not null default 'pending',
  invited_by uuid references profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  resend_count integer not null default 0 check (resend_count >= 0),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_invitations_one_target check (
    (case when teacher_id is not null then 1 else 0 end
     + case when student_id is not null then 1 else 0 end
     + case when parent_id  is not null then 1 else 0 end) = 1
  ),
  constraint account_invitations_role_matches_target check (
    (intended_role = 'teacher' and teacher_id is not null)
    or (intended_role = 'student' and student_id is not null)
    or (intended_role = 'parent'  and parent_id  is not null)
  )
);

-- at most ONE live (pending) invitation per target record — a resend updates
-- the existing row rather than creating a second one.
create unique index if not exists account_invitations_one_pending_teacher
  on account_invitations (teacher_id) where status = 'pending' and teacher_id is not null;
create unique index if not exists account_invitations_one_pending_student
  on account_invitations (student_id) where status = 'pending' and student_id is not null;
create unique index if not exists account_invitations_one_pending_parent
  on account_invitations (parent_id)  where status = 'pending' and parent_id  is not null;

create index if not exists account_invitations_school on account_invitations (school_id);
create index if not exists account_invitations_status on account_invitations (school_id, status);
create index if not exists account_invitations_email on account_invitations (lower(invitee_email));

create trigger account_invitations_updated_at before update on account_invitations
  for each row execute function set_updated_at();

-- ============================================================
-- Relationship integrity — the target record must belong to p_school, and
-- the school must be a SCHOOL (not a university) for these three roles.
-- ============================================================
create or replace function phase5_guard_account_invitations()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.teacher_id is not null and not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if new.student_id is not null and not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;
  if new.parent_id is not null and not exists (
    select 1 from parents p where p.id = new.parent_id and p.school_id = new.school_id) then
    raise exception 'guardian belongs to another school';
  end if;
  -- the linked auth user, when present, must not already back a DIFFERENT
  -- record of the same kind in another school
  if new.invitee_auth_user_id is not null then
    if exists (
      select 1 from profiles p
      where p.id = new.invitee_auth_user_id
        and p.school_id is not null
        and p.school_id is distinct from new.school_id
    ) then
      raise exception 'target user already belongs to another school';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_account_invitations() from public, anon, authenticated;

create trigger account_invitations_guard
  before insert or update on account_invitations
  for each row execute function phase5_guard_account_invitations();

-- ============================================================
-- RLS — only a School Admin of the invitation's own school (or a super_admin
-- acting on that school) may read or manage it. No other role sees invitations.
-- ============================================================
alter table account_invitations enable row level security;

create policy "admins manage account invitations" on account_invitations
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));

-- the invited person may read THEIR OWN pending invitation (by verified email)
-- so the accept screen can show what they were invited to — never anyone else's.
create policy "invitee reads own account invitation" on account_invitations
  for select using (
    invitee_email is not null and lower(invitee_email) = lower(coalesce(my_email(), ''))
  );

-- ============================================================
-- Audit trigger — every create / resend / revoke / accept is recorded.
-- ============================================================
create or replace function phase5_audit_account_invitations()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'account_invitation.create';
  elsif new.status is distinct from old.status then
    v_action := case new.status
      when 'accepted'  then 'account_invitation.accept'
      when 'cancelled' then 'account_invitation.revoke'
      when 'expired'   then 'account_invitation.expire'
      else 'account_invitation.status_change' end;
  elsif new.resend_count is distinct from old.resend_count then
    v_action := 'account_invitation.resend';
  else
    return new;
  end if;
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (new.school_id, auth.uid(), v_action, 'account_invitations', new.id::text,
          jsonb_build_object('intended_role', new.intended_role, 'status', new.status,
                             'teacher_id', new.teacher_id, 'student_id', new.student_id,
                             'parent_id', new.parent_id));
  return new;
end $$;
revoke all on function phase5_audit_account_invitations() from public, anon, authenticated;

create trigger account_invitations_audit
  after insert or update on account_invitations
  for each row execute function phase5_audit_account_invitations();

-- ============================================================
-- create_account_invitation — the ONE way a School Admin records an
-- invitation. Validates role, school, target record and duplicate state.
-- The Edge Function calls this AFTER the Auth Admin API succeeded and passes
-- the resulting auth user id; the client itself never supplies one.
-- ============================================================
create or replace function create_account_invitation(
  p_school uuid,
  p_intended_role user_role,
  p_teacher_id uuid default null,
  p_student_id uuid default null,
  p_parent_id uuid default null,
  p_email text default null,
  p_name text default null,
  p_phone text default null,
  p_auth_user_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_existing uuid;
begin
  if not is_admin_of(p_school) then
    raise exception 'only a school admin may invite an account';
  end if;
  if is_university_institution(p_school) then
    raise exception 'account provisioning for teacher/student/parent is a School Mode operation';
  end if;
  if p_intended_role not in ('teacher', 'student', 'parent') then
    raise exception 'only teacher, student or parent accounts may be provisioned here';
  end if;

  -- the target record must already be linked-free; provisioning must never
  -- create a second domain record, and must never steal an existing login.
  if p_intended_role = 'teacher' then
    if p_teacher_id is null then raise exception 'teacher is required'; end if;
    if exists (select 1 from teachers where id = p_teacher_id and profile_id is not null) then
      raise exception 'this teacher already has a login';
    end if;
  elsif p_intended_role = 'student' then
    if p_student_id is null then raise exception 'student is required'; end if;
    if exists (select 1 from students where id = p_student_id and profile_id is not null) then
      raise exception 'this student already has a login';
    end if;
  else
    if p_parent_id is null then raise exception 'guardian is required'; end if;
    if exists (select 1 from parents where id = p_parent_id and profile_id is not null) then
      raise exception 'this guardian already has a login';
    end if;
  end if;

  -- an existing PENDING invitation for the same target is a resend, not a
  -- duplicate row (the partial unique indexes above also enforce this).
  select id into v_existing from account_invitations
  where status = 'pending'
    and ((p_teacher_id is not null and teacher_id = p_teacher_id)
      or (p_student_id is not null and student_id = p_student_id)
      or (p_parent_id  is not null and parent_id  = p_parent_id));
  if v_existing is not null then
    update account_invitations set
      invitee_email = coalesce(v_email, invitee_email),
      invitee_name = coalesce(nullif(trim(coalesce(p_name, '')), ''), invitee_name),
      invitee_phone = coalesce(nullif(trim(coalesce(p_phone, '')), ''), invitee_phone),
      invitee_auth_user_id = coalesce(p_auth_user_id, invitee_auth_user_id),
      resend_count = resend_count + 1,
      last_sent_at = now(),
      expires_at = now() + interval '14 days'
    where id = v_existing;
    return v_existing;
  end if;

  insert into account_invitations (
    school_id, teacher_id, student_id, parent_id, intended_role,
    invitee_email, invitee_name, invitee_phone, invitee_auth_user_id,
    invited_by, last_sent_at)
  values (
    p_school, p_teacher_id, p_student_id, p_parent_id, p_intended_role,
    v_email, coalesce(nullif(trim(coalesce(p_name, '')), ''), ''),
    nullif(trim(coalesce(p_phone, '')), ''), p_auth_user_id,
    auth.uid(), now())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function create_account_invitation(uuid, user_role, uuid, uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function create_account_invitation(uuid, user_role, uuid, uuid, uuid, text, text, text, uuid) to authenticated;

-- ============================================================
-- revoke_account_invitation — a School Admin cancels a pending invitation.
-- ============================================================
create or replace function revoke_account_invitation(p_invitation uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_status invitation_status;
begin
  select school_id, status into v_school, v_status
  from account_invitations where id = p_invitation;
  if v_school is null then raise exception 'invitation was not found'; end if;
  if not is_admin_of(v_school) then
    raise exception 'only a school admin may revoke an invitation';
  end if;
  if v_status <> 'pending' then
    raise exception 'only a pending invitation may be revoked';
  end if;
  update account_invitations
    set status = 'cancelled', cancelled_at = now()
    where id = p_invitation;
  return true;
end $$;
revoke all on function revoke_account_invitation(uuid) from public, anon;
grant execute on function revoke_account_invitation(uuid) to authenticated;

-- ============================================================
-- expire_stale_account_invitations — mirrors the Phase 3 helper.
-- ============================================================
create or replace function expire_stale_account_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  with expired as (
    update account_invitations set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning 1)
  select count(*) into v_count from expired;
  return coalesce(v_count, 0);
end $$;
revoke all on function expire_stale_account_invitations() from public, anon;
grant execute on function expire_stale_account_invitations() to authenticated, service_role;

-- ============================================================
-- accept_account_invitation — run by the INVITED user after they have set
-- their own password. Links their profile to the existing domain record and
-- sets their role. It can only ever act on an invitation addressed to the
-- caller's own verified email (or the auth user the server recorded), so it
-- cannot be used to escalate into someone else's account.
-- ============================================================
create or replace function accept_account_invitation(p_invitation uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv account_invitations;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(my_email(), ''));
begin
  if v_uid is null then raise exception 'not signed in'; end if;

  select * into v_inv from account_invitations
  where status = 'pending'
    and (p_invitation is null or id = p_invitation)
    and (invitee_auth_user_id = v_uid
         or (invitee_email is not null and lower(invitee_email) = v_email))
  order by created_at desc
  limit 1;

  if v_inv.id is null then raise exception 'no pending invitation for this account'; end if;
  if v_inv.expires_at < now() then
    update account_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'this invitation has expired';
  end if;

  -- the caller's profile takes the invited role + school. profiles' own
  -- privilege guard permits this because we are a security-definer function
  -- acting under the sanctioned bypass used by the Phase 3 accept flow.
  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles set role = v_inv.intended_role, school_id = v_inv.school_id
    where id = v_uid;
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  -- link the EXISTING domain record — never create a second one
  if v_inv.intended_role = 'teacher' then
    update teachers set profile_id = v_uid
      where id = v_inv.teacher_id and school_id = v_inv.school_id and profile_id is null;
    if not found then raise exception 'this teacher record is no longer available to link'; end if;
  elsif v_inv.intended_role = 'student' then
    update students set profile_id = v_uid
      where id = v_inv.student_id and school_id = v_inv.school_id and profile_id is null;
    if not found then raise exception 'this student record is no longer available to link'; end if;
  else
    update parents set profile_id = v_uid
      where id = v_inv.parent_id and school_id = v_inv.school_id and profile_id is null;
    if not found then raise exception 'this guardian record is no longer available to link'; end if;
    -- keep the Phase 4 guardian-link ownership column in step so the parent
    -- immediately sees exactly the children they are linked to
    update student_parents sp set parent_profile_id = v_uid
      where sp.parent_id = v_inv.parent_id and sp.parent_profile_id is null;
  end if;

  update account_invitations set status = 'accepted', accepted_at = now()
    where id = v_inv.id;

  return jsonb_build_object(
    'invitation_id', v_inv.id,
    'role', v_inv.intended_role,
    'school_id', v_inv.school_id);
end $$;
revoke all on function accept_account_invitation(uuid) from public, anon;
grant execute on function accept_account_invitation(uuid) to authenticated;

commit;
