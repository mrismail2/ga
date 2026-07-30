-- ============================================================
-- Kobciye — Phase 2 security hardening (post-review fixes)
--
-- Fixes three classes of bug found in review:
--  1. handle_new_user() trusted client-supplied metadata for role/school_id
--     (fixed directly in migration 0001 — signups now always land 'pending').
--  2. RLS lets a user UPDATE their own profiles row, but RLS only filters
--     ROWS, not COLUMNS — nothing stopped that user setting their own
--     role/school_id. Fixed here with a BEFORE UPDATE trigger.
--  3. No structural guarantee that a join/relationship row connects two
--     records from the SAME school (e.g. a class from school A assigned to
--     a teacher in school B). Fixed here with per-table guard triggers.
--
-- Also adds the only two sanctioned ways a role may ever change:
--   provision_school()  — a fresh 'pending' account creates its own school
--                          and becomes that school's first school_admin.
--   assign_role()        — an existing school_admin/super_admin assigns a
--                          role to someone inside their own school.
-- ============================================================

-- ============================================================
-- A. profiles: block self privilege-escalation
-- ============================================================

-- A session with no JWT (auth.uid() is null) can only happen when someone
-- runs SQL directly against the database — the Supabase SQL Editor or a
-- trusted server using the service-role key. PostgREST (the anon/
-- authenticated API roles the app actually uses) always attaches a JWT, so
-- auth.uid() is never null on that path. This is intentionally the ONLY way
-- to bootstrap the very first super_admin; document it, don't remove it.
create or replace function guard_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profiles.id cannot be changed';
  end if;

  if new.role is distinct from old.role or new.school_id is distinct from old.school_id then
    -- the one sanctioned system bypass: provision_school() flips a brand-new
    -- account's own row from pending -> school_admin of the school it just
    -- created. Nothing else may set this flag (see provision_school below).
    if current_setting('kobciye.bypass_profile_guard', true) = 'on' then
      return new;
    end if;

    if not (my_role() = 'super_admin' or is_admin_of(old.school_id) or is_admin_of(new.school_id)) then
      raise exception 'privilege escalation blocked: only a school_admin (within their own school) or a super_admin may change role or school_id';
    end if;

    if new.role = 'super_admin' and my_role() <> 'super_admin' then
      raise exception 'privilege escalation blocked: only a super_admin may grant the super_admin role';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function guard_profile_privileged_fields();

comment on function guard_profile_privileged_fields() is
  'Column-level guard RLS cannot express: blocks a user from writing their own role/school_id. Bypassed only by provision_school() via a transaction-local flag, or by a service-role/SQL-editor session with no JWT.';

-- ============================================================
-- B. secure, audited role/school assignment
-- ============================================================

-- A brand-new 'pending' account provisions its own school and becomes that
-- school's first school_admin. This is the only self-service path to
-- school_admin, and it only ever works ONCE per account (an account that
-- already belongs to a school is refused) and only ever creates a NEW
-- school (it can never attach to an existing one) — so it cannot be used to
-- take over another school.
create or replace function provision_school(p_name text, p_slug text, p_location text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_caller_school uuid;
begin
  if auth.uid() is null then
    raise exception 'provision_school must be called by an authenticated user';
  end if;

  select school_id into v_caller_school from profiles where id = auth.uid();
  if v_caller_school is not null then
    raise exception 'this account already belongs to a school';
  end if;

  insert into schools (name, slug, location)
  values (p_name, p_slug, p_location)
  returning id into v_school_id;

  insert into subscriptions (school_id, plan, status, trial_ends_at, current_period_end)
  values (v_school_id, 'small', 'trialing', now() + interval '30 days', now() + interval '30 days');

  perform set_config('kobciye.bypass_profile_guard', 'on', true);
  update profiles set role = 'school_admin', school_id = v_school_id where id = auth.uid();
  perform set_config('kobciye.bypass_profile_guard', 'off', true);

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_school_id, auth.uid(), 'school.provision', 'schools', v_school_id::text,
          jsonb_build_object('name', p_name, 'slug', p_slug));

  return v_school_id;
end $$;

revoke all on function provision_school(text, text, text) from public;
grant execute on function provision_school(text, text, text) to authenticated;

comment on function provision_school(text, text, text) is
  'Self-service school creation. A pending account with no school_id becomes school_admin of the NEW school it just created — never of an existing one.';

-- An existing school_admin (within their own school) or super_admin assigns
-- a role to a profile. Only a super_admin may grant super_admin. Every call
-- is written to audit_logs.
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

  update profiles
     set role = p_role,
         school_id = coalesce(p_school_id, school_id)
   where id = p_profile_id;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (v_target_school, auth.uid(), 'profile.assign_role', 'profiles', p_profile_id::text,
          jsonb_build_object('role', p_role, 'school_id', p_school_id));
end $$;

revoke all on function assign_role(uuid, user_role, uuid) from public;
grant execute on function assign_role(uuid, user_role, uuid) to authenticated;

comment on function assign_role(uuid, user_role, uuid) is
  'The only sanctioned way to change someone else''s role/school. Caller must already be school_admin of the target school or super_admin; only super_admin may grant super_admin. Audited.';

-- ============================================================
-- C. cross-school relationship integrity (defense in depth, independent of
--    RLS — these hold even for a school_admin or a buggy admin screen)
-- ============================================================

create or replace function guard_class_subjects_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class_school uuid; v_subject_school uuid;
begin
  select school_id into v_class_school from classes where id = new.class_id;
  select school_id into v_subject_school from subjects where id = new.subject_id;
  if v_class_school is null or v_subject_school is null or v_class_school <> v_subject_school then
    raise exception 'class and subject must belong to the same school';
  end if;
  return new;
end $$;
drop trigger if exists class_subjects_school_guard on class_subjects;
create trigger class_subjects_school_guard
  before insert or update on class_subjects
  for each row execute function guard_class_subjects_school();

create or replace function guard_teacher_classes_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_teacher_school uuid; v_class_school uuid;
begin
  select school_id into v_teacher_school from teachers where id = new.teacher_id;
  select school_id into v_class_school from classes where id = new.class_id;
  if v_teacher_school is null or v_class_school is null or v_teacher_school <> v_class_school then
    raise exception 'teacher and class must belong to the same school';
  end if;
  return new;
end $$;
drop trigger if exists teacher_classes_school_guard on teacher_classes;
create trigger teacher_classes_school_guard
  before insert or update on teacher_classes
  for each row execute function guard_teacher_classes_school();

create or replace function guard_teacher_subjects_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_teacher_school uuid; v_subject_school uuid;
begin
  select school_id into v_teacher_school from teachers where id = new.teacher_id;
  select school_id into v_subject_school from subjects where id = new.subject_id;
  if v_teacher_school is null or v_subject_school is null or v_teacher_school <> v_subject_school then
    raise exception 'teacher and subject must belong to the same school';
  end if;
  return new;
end $$;
drop trigger if exists teacher_subjects_school_guard on teacher_subjects;
create trigger teacher_subjects_school_guard
  before insert or update on teacher_subjects
  for each row execute function guard_teacher_subjects_school();

-- a student's class must be a class in the student's OWN school
create or replace function guard_student_class_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class_school uuid;
begin
  if new.class_id is not null then
    select school_id into v_class_school from classes where id = new.class_id;
    if v_class_school is null or v_class_school <> new.school_id then
      raise exception 'student class must belong to the student''s own school';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists students_class_school_guard on students;
create trigger students_class_school_guard
  before insert or update on students
  for each row execute function guard_student_class_school();

create or replace function guard_exam_windows_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_teacher_school uuid; v_subject_school uuid; v_term_school uuid;
begin
  select school_id into v_teacher_school from teachers where id = new.teacher_id;
  select school_id into v_subject_school from subjects where id = new.subject_id;
  select school_id into v_term_school from terms where id = new.term_id;
  if v_teacher_school is distinct from new.school_id
     or v_subject_school is distinct from new.school_id
     or v_term_school is distinct from new.school_id then
    raise exception 'exam window teacher/subject/term must all belong to the window''s school';
  end if;
  return new;
end $$;
drop trigger if exists exam_windows_school_guard on exam_windows;
create trigger exam_windows_school_guard
  before insert or update on exam_windows
  for each row execute function guard_exam_windows_school();

create or replace function guard_exams_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_class_school uuid; v_subject_school uuid; v_teacher_school uuid;
  v_term_school uuid; v_window_school uuid;
begin
  select school_id into v_class_school from classes where id = new.class_id;
  select school_id into v_subject_school from subjects where id = new.subject_id;
  if new.teacher_id is not null then select school_id into v_teacher_school from teachers where id = new.teacher_id; end if;
  if new.term_id is not null then select school_id into v_term_school from terms where id = new.term_id; end if;
  if new.window_id is not null then select school_id into v_window_school from exam_windows where id = new.window_id; end if;
  if v_class_school is distinct from new.school_id
     or v_subject_school is distinct from new.school_id
     or (new.teacher_id is not null and v_teacher_school is distinct from new.school_id)
     or (new.term_id is not null and v_term_school is distinct from new.school_id)
     or (new.window_id is not null and v_window_school is distinct from new.school_id) then
    raise exception 'exam class/subject/teacher/term/window must all belong to the exam''s school';
  end if;
  return new;
end $$;
drop trigger if exists exams_school_guard on exams;
create trigger exams_school_guard
  before insert or update on exams
  for each row execute function guard_exams_school();

create or replace function guard_results_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exam_school uuid; v_student_school uuid;
begin
  select school_id into v_exam_school from exams where id = new.exam_id;
  select school_id into v_student_school from students where id = new.student_id;
  if v_exam_school is distinct from new.school_id or v_student_school is distinct from new.school_id then
    raise exception 'result exam and student must both belong to the result''s school';
  end if;
  return new;
end $$;
drop trigger if exists results_school_guard on results;
create trigger results_school_guard
  before insert or update on results
  for each row execute function guard_results_school();

create or replace function guard_attendance_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class_school uuid; v_student_school uuid;
begin
  select school_id into v_class_school from classes where id = new.class_id;
  select school_id into v_student_school from students where id = new.student_id;
  if v_class_school is distinct from new.school_id or v_student_school is distinct from new.school_id then
    raise exception 'attendance class and student must both belong to the attendance row''s school';
  end if;
  return new;
end $$;
drop trigger if exists attendance_school_guard on attendance;
create trigger attendance_school_guard
  before insert or update on attendance
  for each row execute function guard_attendance_school();

-- parent links: the directory row (if any) and the linked profile (if it
-- already has a school) must agree with the student's school
create or replace function guard_student_parents_school()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_student_school uuid; v_parent_school uuid; v_parent_profile_school uuid;
begin
  select school_id into v_student_school from students where id = new.student_id;

  if new.parent_id is not null then
    select school_id into v_parent_school from parents where id = new.parent_id;
    if v_parent_school is distinct from v_student_school then
      raise exception 'parent and student must belong to the same school';
    end if;
  end if;

  select school_id into v_parent_profile_school from profiles where id = new.parent_profile_id;
  if v_parent_profile_school is not null and v_parent_profile_school is distinct from v_student_school then
    raise exception 'parent profile and student must belong to the same school';
  end if;

  return new;
end $$;
drop trigger if exists student_parents_school_guard on student_parents;
create trigger student_parents_school_guard
  before insert or update on student_parents
  for each row execute function guard_student_parents_school();
