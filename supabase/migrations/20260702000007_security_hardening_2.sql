-- ============================================================
-- Kobciye — Phase 2 security hardening, round 2 (independent review)
--
-- Fixes two remaining gaps found after migration 0006:
--
--  1. SECURITY DEFINER functions were left with their default PUBLIC
--     EXECUTE grant. Supabase projects additionally pre-grant EXECUTE on
--     every public-schema function to anon/authenticated by default
--     (ALTER DEFAULT PRIVILEGES set at project bootstrap) — so "we didn't
--     grant it" is not the same as "no one can call it". Worst offender:
--     next_student_id(uuid) is SECURITY DEFINER and mutates schools —
--     any authenticated (or anon) caller could invoke it directly to burn
--     through or desynchronize another school's ID sequence.
--
--  2. "admins manage school profiles" (profiles, FOR ALL) and
--     "admins manage memberships" (school_members, FOR ALL) let a
--     school_admin write those tables through the normal PostgREST table
--     API. Migration 0006's guard trigger already blocked role/school_id
--     changes for everyone EXCEPT an is_admin_of() caller — which meant a
--     school_admin could still set a colleague's role directly, bypassing
--     assign_role() and its audit_logs entry entirely. Closed by removing
--     the admin exception from the trigger (there is now exactly ONE way
--     in: the bypass flag, set only inside provision_school()/assign_role())
--     and by removing school_members' write policy outright — it is
--     system-managed only (kept in sync by sync_primary_membership()).
-- ============================================================

-- ============================================================
-- A. profiles: role/school_id can change ONLY via provision_school() /
--    assign_role() — not even a school_admin may do it through the table
-- ============================================================

create or replace function guard_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- No JWT session (SQL Editor / service-role / the auth service's own
  -- internal writes, e.g. handle_new_user()'s insert) is trusted — this is
  -- the sanctioned way to bootstrap the first super_admin. The anon/
  -- authenticated PostgREST roles the app actually uses always carry a
  -- JWT, so auth.uid() is never null on that path.
  if auth.uid() is null then
    return new;
  end if;

  -- the ONLY other sanctioned path: provision_school() / assign_role() set
  -- this transaction-local flag right before their own UPDATE and clear it
  -- right after. No other code sets it — not even for an is_admin_of()
  -- caller, which is exactly what was wrong before this migration.
  if current_setting('kobciye.bypass_profile_guard', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role <> 'pending' or new.school_id is not null then
      raise exception 'privilege escalation blocked: a new profile must start as pending with no school';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE'
  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed';
  end if;
  if new.role is distinct from old.role or new.school_id is distinct from old.school_id then
    raise exception 'privilege escalation blocked: role and school_id can only change through assign_role() or provision_school()';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileged_insert on profiles;
create trigger profiles_guard_privileged_insert
  before insert on profiles
  for each row execute function guard_profile_privileged_fields();
-- (profiles_guard_privileged from migration 0006 already covers UPDATE;
--  the function body above is shared by both triggers.)

comment on function guard_profile_privileged_fields() is
  'The only column-level gate on profiles.role/school_id. No exception for school_admin/is_admin_of anymore — the sole way in is the bypass flag set inside provision_school()/assign_role().';

-- assign_role() now goes through the same flag as provision_school(), so
-- it is no longer treated as an "admin update" the trigger special-cases —
-- it IS the trigger's only sanctioned caller, same as provision_school().
create or replace function assign_role(p_profile_id uuid, p_role user_role, p_school_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_school uuid;
  v_caller_role user_role;
begin
  if auth.uid() is null then
    raise exception 'assign_role must be called by an authenticated user';
  end if;

  select role into v_caller_role from profiles where id = auth.uid();
  v_target_school := coalesce(p_school_id, (select school_id from profiles where id = p_profile_id));

  if p_role = 'super_admin' and v_caller_role <> 'super_admin' then
    raise exception 'only a super_admin may grant the super_admin role';
  end if;

  if v_caller_role <> 'super_admin' and not is_admin_of(v_target_school) then
    raise exception 'only a school_admin (within their own school) or a super_admin may assign roles';
  end if;

  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles
     set role = p_role,
         school_id = coalesce(p_school_id, school_id)
   where id = p_profile_id;
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_target_school, auth.uid(), 'profile.assign_role', 'profiles', p_profile_id::text,
          jsonb_build_object('role', p_role, 'school_id', p_school_id));
end $$;

-- profiles: an admin may still read/update SAFE fields (full_name, phone,
-- avatar_url) for their own school's staff directly — the trigger above is
-- what makes that safe (role/school_id are inert through this path).
comment on policy "admins manage school profiles" on profiles is
  'Row-level scope only. Column-level safety (role/school_id are unwritable through here) comes from guard_profile_privileged_fields() — see migration 0007.';

-- ============================================================
-- B. school_members: system-managed only, no client write path at all
-- ============================================================

drop policy if exists "admins manage memberships" on school_members;

comment on table school_members is
  'System-managed only. Rows are written exclusively by sync_primary_membership() (fires off profiles.role/school_id, which itself only changes via assign_role()/provision_school()). No INSERT/UPDATE/DELETE policy exists for any client role, admin included — this is intentional, not an oversight.';

-- ============================================================
-- C. lock down every sensitive/write-capable SECURITY DEFINER function
-- ============================================================

-- next_student_id: mutates schools.next_student_sequence. Must be
-- reachable ONLY from the students-insert trigger, never called directly.
revoke all on function next_student_id(uuid) from public, anon, authenticated;

-- the trigger that calls it must become SECURITY DEFINER too, so the
-- nested call to next_student_id() runs as the function OWNER (who always
-- has implicit execute on functions they own) rather than as the
-- originating client role (which now has none). This is what makes "only
-- reachable through the insert trigger" actually true rather than aspirational.
create or replace function students_fill_student_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is null or new.student_id = '' then
    new.student_id := next_student_id(new.school_id);
  end if;
  return new;
end $$;

comment on function next_student_id(uuid) is
  'SECURITY DEFINER, mutates schools — EXECUTE revoked from public/anon/authenticated. Reachable only via students_fill_student_id() (also SECURITY DEFINER), which is reachable only via the students-insert trigger.';

-- trigger functions: Postgres already refuses to invoke a RETURNS TRIGGER
-- function via a direct SQL call ("trigger functions can only be called
-- as triggers"), and firing a trigger never requires the DML-issuing role
-- to hold EXECUTE on the trigger function — so these revokes are pure
-- defense-in-depth / audit hygiene, not a functional requirement.
revoke all on function handle_new_user() from public, anon, authenticated;
revoke all on function guard_profile_privileged_fields() from public, anon, authenticated;
revoke all on function sync_primary_membership() from public, anon, authenticated;
revoke all on function students_fill_student_id() from public, anon, authenticated;
revoke all on function guard_class_subjects_school() from public, anon, authenticated;
revoke all on function guard_teacher_classes_school() from public, anon, authenticated;
revoke all on function guard_teacher_subjects_school() from public, anon, authenticated;
revoke all on function guard_student_class_school() from public, anon, authenticated;
revoke all on function guard_exam_windows_school() from public, anon, authenticated;
revoke all on function guard_exams_school() from public, anon, authenticated;
revoke all on function guard_results_school() from public, anon, authenticated;
revoke all on function guard_attendance_school() from public, anon, authenticated;
revoke all on function guard_student_parents_school() from public, anon, authenticated;

-- read-only RLS helpers: these run INSIDE every policy expression, which
-- is evaluated as the querying client's role — anon/authenticated MUST
-- keep EXECUTE or every RLS-protected query breaks. They are read-only
-- (no writes, `stable`), so this is the safe minimum, not an oversight.
revoke all on function my_role() from public;
revoke all on function my_school() from public;
revoke all on function is_staff_of(uuid) from public;
revoke all on function is_admin_of(uuid) from public;
revoke all on function is_parent_of(uuid) from public;
revoke all on function is_self_student(uuid) from public;
grant execute on function my_role() to anon, authenticated;
grant execute on function my_school() to anon, authenticated;
grant execute on function is_staff_of(uuid) to anon, authenticated;
grant execute on function is_admin_of(uuid) to anon, authenticated;
grant execute on function is_parent_of(uuid) to anon, authenticated;
grant execute on function is_self_student(uuid) to anon, authenticated;

-- the two RPCs a real client is meant to call — authenticated only (both
-- already reject a null auth.uid(), so anon could never use them anyway;
-- this makes the grant match that reality instead of relying on it).
revoke all on function provision_school(text, text, text) from public, anon;
revoke all on function assign_role(uuid, user_role, uuid) from public, anon;
grant execute on function provision_school(text, text, text) to authenticated;
grant execute on function assign_role(uuid, user_role, uuid) to authenticated;
