-- ============================================================================
-- Kobciye Phase 5 — Forgot Password OTP rate-limit and phone hardening
--
-- WhatsApp remains a recovery channel ONLY. Normal Student/Parent login remains
-- public School ID + Student ID + password.
-- ============================================================================

begin;

-- Enforce a real E.164 shape for all new/changed login phone values without
-- rewriting or deleting historical Parent rows. The final preflight identifies
-- old malformed values for manual correction before validation.
alter table parents drop constraint if exists parents_login_phone_e164_format;
alter table parents add constraint parents_login_phone_e164_format
  check (login_phone_e164 is null or login_phone_e164 ~ '^\+[1-9][0-9]{7,14}$') not valid;

create or replace function normalize_kobciye_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = public as $$
declare
  v_digits text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  v_normalized text;
begin
  if v_digits = '' then return null; end if;
  if left(v_digits, 2) = '00' then v_digits := substr(v_digits, 3); end if;
  if left(v_digits, 3) = '252' then
    v_normalized := '+' || v_digits;
  elsif left(v_digits, 1) = '0' then
    v_normalized := '+252' || substr(v_digits, 2);
  elsif length(v_digits) between 8 and 9 then
    v_normalized := '+252' || v_digits;
  else
    v_normalized := '+' || v_digits;
  end if;
  if v_normalized !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  return v_normalized;
end $$;
revoke all on function normalize_kobciye_phone(text) from public;
grant execute on function normalize_kobciye_phone(text) to authenticated, service_role;

-- One atomic server-only insertion path. Advisory locks serialize requests for
-- the same identity/IP so concurrent requests cannot race past count checks.
create or replace function create_password_reset_otp_challenge(
  p_id uuid,
  p_kind text,
  p_school uuid,
  p_target_profile uuid,
  p_student uuid,
  p_parent uuid,
  p_phone_hash text,
  p_request_key_hash text,
  p_otp_hash text,
  p_expires_at timestamptz,
  p_request_ip_hash text
) returns boolean
language plpgsql
volatile
security definer
set search_path = public as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_now timestamptz := now();
begin
  if v_kind not in ('student', 'parent') then return false; end if;
  if p_id is null
     or p_request_key_hash !~ '^[0-9a-f]{64}$'
     or p_otp_hash !~ '^[0-9a-f]{64}$'
     or p_request_ip_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= v_now
     or p_expires_at > v_now + interval '10 minutes' then
    return false;
  end if;

  -- Fixed lock order prevents deadlocks between concurrent reset requests.
  perform pg_advisory_xact_lock(hashtextextended(p_request_key_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_request_ip_hash, 1));

  if (select count(*) from password_reset_otp_challenges
      where request_ip_hash = p_request_ip_hash
        and created_at >= v_now - interval '15 minutes') >= 12 then
    return false;
  end if;
  if (select count(*) from password_reset_otp_challenges
      where request_key_hash = p_request_key_hash
        and created_at >= v_now - interval '15 minutes') >= 3 then
    return false;
  end if;
  if (select count(*) from password_reset_otp_challenges
      where request_key_hash = p_request_key_hash
        and created_at >= v_now - interval '24 hours') >= 8 then
    return false;
  end if;

  -- A real target must be internally coherent. A decoy challenge deliberately
  -- has no target identifiers and remains indistinguishable to the caller.
  if p_target_profile is not null then
    if p_school is null or p_phone_hash is null then return false; end if;
    if not exists (
      select 1 from profiles pr
      where pr.id = p_target_profile and pr.school_id = p_school
        and pr.role::text = v_kind
    ) then return false; end if;
    if v_kind = 'student' and not exists (
      select 1 from students st
      where st.id = p_student and st.school_id = p_school
        and st.profile_id = p_target_profile and st.status = 'active'
    ) then return false; end if;
    if v_kind = 'student' and not exists (
      select 1 from parents pa
      join student_parents sp on sp.parent_id = pa.id
      where pa.id = p_parent and pa.school_id = p_school
        and pa.status = 'active' and pa.login_enabled = true
        and sp.student_id = p_student and coalesce(sp.can_receive_messages, true)
    ) then return false; end if;
    if v_kind = 'parent' and not exists (
      select 1 from parents pa
      where pa.id = p_parent and pa.school_id = p_school
        and pa.profile_id = p_target_profile
        and pa.status = 'active' and pa.login_enabled = true
    ) then return false; end if;

    update password_reset_otp_challenges
       set consumed_at = coalesce(consumed_at, v_now)
     where kind = v_kind
       and target_profile_id = p_target_profile
       and consumed_at is null;
  elsif p_school is not null or p_student is not null or p_parent is not null or p_phone_hash is not null then
    return false;
  end if;

  insert into password_reset_otp_challenges (
    id, kind, school_id, target_profile_id, student_id, parent_id,
    phone_hash, request_key_hash, otp_hash, expires_at, request_ip_hash
  ) values (
    p_id, v_kind, p_school, p_target_profile, p_student, p_parent,
    p_phone_hash, p_request_key_hash, p_otp_hash, p_expires_at, p_request_ip_hash
  );
  return true;
end $$;
revoke all on function create_password_reset_otp_challenge(
  uuid, text, uuid, uuid, uuid, uuid, text, text, text, timestamptz, text
) from public, anon, authenticated;
grant execute on function create_password_reset_otp_challenge(
  uuid, text, uuid, uuid, uuid, uuid, text, text, text, timestamptz, text
) to service_role;

commit;
