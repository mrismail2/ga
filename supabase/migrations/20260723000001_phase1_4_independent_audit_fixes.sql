-- ============================================================
-- Kobciye Phase 1–4 — independent-audit correction migration
--
-- Purely additive on top of 20260717000001_additional_phase1_4_requirements.sql.
-- Nothing here drops a table, drops a column, or deletes a user-created
-- row. It:
--
--   1. Narrows Teacher read access on `classes` / `students` from
--      "any staff member of the school" to "assigned classes / students
--      enrolled in an assigned class" — via two new SECURITY DEFINER
--      helper functions and replacement SELECT policies. School Admin /
--      Super Admin access is unchanged (still full-school via the
--      existing admin policies).
--   2. Adds class_exists_in_my_school() so the client can distinguish
--      "class does not exist" from "class exists but I'm not assigned to
--      it" without leaking any class data across that boundary.
--   3. Completes the lesson_plans schema (objectives / materials /
--      lesson_content / homework_note / teacher_id) and widens (never
--      narrows) the status check to also allow 'ready', preserving the
--      existing draft/pending/approved/rejected review workflow that the
--      shipped Casharrada UI already depends on.
--   4. Completes the conversations/messages schema (type, updated_at,
--      message_type, attachment_uri, deleted_at).
--   5. Adds student_enrollments.ended_on and rewrites admit_student_atomic
--      so a class/stream/year change CLOSES the current active enrollment
--      (status='transferred', ended_on=today) and INSERTS a new active
--      row, instead of overwriting the existing row in place — enrollment
--      history is preserved. A resubmission with unchanged values is a
--      no-op (no history spam).
--   6. Adds the FK/lookup indexes the new policies and count queries need.
-- ============================================================

-- ============================================================
-- 1. student_enrollments — preserve transfer history
-- ============================================================
alter table student_enrollments add column ended_on date;
create index student_enrollments_class_active
  on student_enrollments (class_id) where status = 'active';

-- ============================================================
-- 2. Teacher-scoped access to classes / students
-- ============================================================
create or replace function is_teacher_of_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teacher_assignments ta
    join teachers t on t.id = ta.teacher_id
    where ta.class_id = p_class and ta.is_active and t.profile_id = auth.uid())
$$;
revoke all on function is_teacher_of_class(uuid) from public;
grant execute on function is_teacher_of_class(uuid) to authenticated;

create or replace function is_teacher_of_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_enrollments se
    join teacher_assignments ta on ta.class_id = se.class_id and ta.is_active
    join teachers t on t.id = ta.teacher_id
    where se.student_id = p_student and se.status = 'active' and t.profile_id = auth.uid())
$$;
revoke all on function is_teacher_of_student(uuid) from public;
grant execute on function is_teacher_of_student(uuid) to authenticated;

-- lets the client tell "class not found" apart from "class exists in my
-- school but I'm not authorized to open it" without exposing any class
-- data across that boundary (never checks other schools).
create or replace function class_exists_in_my_school(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes c where c.id = p_class and c.school_id = my_school())
$$;
revoke all on function class_exists_in_my_school(uuid) from public;
grant execute on function class_exists_in_my_school(uuid) to authenticated;

create index teacher_assignments_class on teacher_assignments (class_id);

-- classes: replace the blanket "any school member" read with admin (full
-- school, via the existing "admins manage classes" for-all policy) OR
-- teacher-of-this-class. Nobody else (accountant/parent/student) had a
-- wired live-mode reason to read this table; none is granted one here.
drop policy if exists "school members read classes" on classes;
create policy "teacher reads assigned classes" on classes for select
  using (is_teacher_of_class(id));

-- students: replace the blanket "any staff" read (which let a teacher or
-- accountant read every student in the school) with admin (unchanged,
-- via "staff manage students" for-all) OR teacher-of-an-assigned-class-
-- the-student-is-actively-enrolled-in. Parent/student policies are
-- untouched (they were already correctly scoped to is_parent_of / self).
drop policy if exists "staff read students" on students;
create policy "teacher reads assigned-class students" on students for select
  using (is_teacher_of_student(id));

-- ============================================================
-- 3. lesson_plans — complete schema, widen (never narrow) status
-- ============================================================
alter table lesson_plans
  add column objectives text,
  add column materials text,
  add column lesson_content text,
  add column homework_note text,
  add column teacher_id uuid references teachers (id) on delete set null;
create index lesson_plans_teacher_id on lesson_plans (teacher_id);

alter table lesson_plans drop constraint lesson_plans_status_check;
alter table lesson_plans add constraint lesson_plans_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'ready'));
comment on constraint lesson_plans_status_check on lesson_plans is
  'Widened (never narrowed): draft/ready are the audit-required minimum; pending/approved/rejected stay because the shipped Casharrada review workflow already depends on them (preserve existing verified work).';

-- auto-derive teacher_id from teacher_profile_id (same school) so existing
-- inserts that only set teacher_profile_id keep working unchanged
create or replace function phase4_guard_lesson_plans()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.subject_id is not null and not exists (
    select 1 from subjects su where su.id = new.subject_id and su.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if new.class_id is not null and not exists (
    select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if new.teacher_id is not null and not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if new.teacher_id is null and new.teacher_profile_id is not null then
    select id into new.teacher_id from teachers
      where profile_id = new.teacher_profile_id and school_id = new.school_id;
  end if;
  -- only school admins (or super_admin) may approve / reject
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and not is_admin_of(new.school_id) then
    raise exception 'only a school admin may approve or reject a lesson plan';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_lesson_plans() from public, anon, authenticated;

-- ============================================================
-- 4. conversations / messages — complete schema
-- ============================================================
alter table conversations
  add column type text not null default 'direct' check (type in ('direct', 'group')),
  add column updated_at timestamptz not null default now();
create trigger conversations_updated_at before update on conversations
  for each row execute function set_updated_at();

alter table messages
  add column message_type text not null default 'text' check (message_type in ('text', 'image', 'voice')),
  add column attachment_uri text,
  add column deleted_at timestamptz;

-- ============================================================
-- 5. admit_student_atomic — enrollment-history-safe rewrite
--    (same signature as 20260717000001 — CREATE OR REPLACE only)
-- ============================================================
create or replace function admit_student_atomic(
  p_school uuid,
  p_applicant_name text,
  p_gender text default null,
  p_date_of_birth date default null,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_stream_id uuid default null,
  p_academic_year_id uuid default null,
  p_admission_id uuid default null,
  p_student_id uuid default null,
  p_parent_id uuid default null,
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_guardian_email text default null,
  p_relationship text default null,
  p_is_primary boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_enrollment uuid;
  v_old_class_id uuid;
  v_old_stream_id uuid;
  v_old_year_id uuid;
  v_admission uuid;
  v_parent uuid;
  v_link uuid;
  v_name text := nullif(trim(coalesce(p_applicant_name, '')), '');
  v_guardian_name text := nullif(trim(coalesce(p_guardian_name, '')), '');
  v_guardian_phone text := nullif(trim(coalesce(p_guardian_phone, '')), '');
begin
  -- caller must be an admin of THIS school; guardian linking is School Mode
  if not is_admin_of(p_school) then
    raise exception 'only a school admin may enrol a student';
  end if;
  if is_university_institution(p_school) then
    raise exception 'admit_student_atomic is a School Mode operation';
  end if;
  if v_name is null then
    raise exception 'applicant name is required';
  end if;

  -- explicit same-school checks (guards re-verify on insert)
  if p_class_id is not null and not exists (
    select 1 from classes c where c.id = p_class_id and c.school_id = p_school) then
    raise exception 'class belongs to another school';
  end if;
  if p_stream_id is not null and not exists (
    select 1 from class_streams st where st.id = p_stream_id and st.school_id = p_school) then
    raise exception 'stream belongs to another school';
  end if;
  if p_academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = p_academic_year_id and y.school_id = p_school) then
    raise exception 'academic_year belongs to another school';
  end if;

  -- 1. student — reuse an existing one (re-enrol/edit) or create fresh.
  --    class_id here is a denormalized "current class" cache kept in sync
  --    with the active enrollment below — the enrollment table remains the
  --    canonical, historical source of truth.
  if p_student_id is not null then
    select id into v_student from students
      where id = p_student_id and school_id = p_school;
    if v_student is null then
      raise exception 'student belongs to another school';
    end if;
    update students set
      full_name = v_name,
      gender = coalesce(p_gender, gender),
      date_of_birth = coalesce(p_date_of_birth, date_of_birth),
      class_id = coalesce(p_class_id, class_id),
      stream_id = coalesce(p_stream_id, stream_id),
      academic_year_id = coalesce(p_academic_year_id, academic_year_id)
      where id = v_student;
  else
    insert into students (school_id, class_id, stream_id, academic_year_id,
                          full_name, gender, date_of_birth, admission_number, student_id)
      values (p_school, p_class_id, p_stream_id, p_academic_year_id,
              v_name, p_gender, p_date_of_birth, nullif(trim(coalesce(p_admission_number, '')), ''), '')
      returning id into v_student;
  end if;

  -- 2. enrollment — NEVER overwrite history. A first enrollment inserts a
  --    fresh active row. A genuine class/stream/year change closes the
  --    current active row (status='transferred', ended_on=today, every
  --    other field on it left untouched) and inserts a new active row.
  --    Resubmitting the same values is a no-op — no history spam.
  select id, class_id, stream_id, academic_year_id
    into v_enrollment, v_old_class_id, v_old_stream_id, v_old_year_id
    from student_enrollments
    where student_id = v_student and status = 'active';

  if v_enrollment is null then
    insert into student_enrollments (school_id, student_id, class_id, stream_id, academic_year_id)
      values (p_school, v_student, p_class_id, p_stream_id, p_academic_year_id)
      returning id into v_enrollment;
  elsif (p_class_id is not null and p_class_id is distinct from v_old_class_id)
     or (p_stream_id is not null and p_stream_id is distinct from v_old_stream_id)
     or (p_academic_year_id is not null and p_academic_year_id is distinct from v_old_year_id) then
    update student_enrollments set status = 'transferred', ended_on = current_date
      where id = v_enrollment;
    insert into student_enrollments (school_id, student_id, class_id, stream_id, academic_year_id)
      values (p_school, v_student,
              coalesce(p_class_id, v_old_class_id),
              coalesce(p_stream_id, v_old_stream_id),
              coalesce(p_academic_year_id, v_old_year_id))
      returning id into v_enrollment;
  end if;

  -- 3. admission — upgrade the existing application or record a new one
  if p_admission_id is not null then
    update admissions set
      student_id = v_student, applicant_name = v_name,
      guardian_name = coalesce(v_guardian_name, guardian_name),
      guardian_phone = coalesce(v_guardian_phone, guardian_phone),
      desired_class_id = coalesce(p_class_id, desired_class_id),
      status = 'enrolled'
      where id = p_admission_id and school_id = p_school
      returning id into v_admission;
    if v_admission is null then
      raise exception 'admission belongs to another school';
    end if;
  else
    insert into admissions (school_id, student_id, applicant_name,
                            guardian_name, guardian_phone, desired_class_id, status)
      values (p_school, v_student, v_name, v_guardian_name, v_guardian_phone, p_class_id, 'enrolled')
      returning id into v_admission;
  end if;

  -- 4. guardian — select an existing same-school parent OR create a new one
  if p_parent_id is not null then
    select id into v_parent from parents
      where id = p_parent_id and school_id = p_school;
    if v_parent is null then
      raise exception 'guardian belongs to another school';
    end if;
  elsif v_guardian_name is not null and v_guardian_phone is not null then
    -- reuse the same-school guardian with this exact name+phone, else create
    select id into v_parent from parents
      where school_id = p_school and full_name = v_guardian_name and phone = v_guardian_phone
      limit 1;
    if v_parent is null then
      insert into parents (school_id, full_name, phone, email)
        values (p_school, v_guardian_name, v_guardian_phone,
                nullif(trim(coalesce(p_guardian_email, '')), ''))
        returning id into v_parent;
    end if;
  end if;

  -- 5. guardian link — duplicate-protected, same-school only
  if v_parent is not null then
    if exists (
      select 1 from student_parents sp
      where sp.parent_id = v_parent and sp.student_id = v_student) then
      raise exception using errcode = '23505',
        message = 'guardian is already linked to this student';
    end if;
    insert into student_parents (parent_id, student_id, relationship, is_primary)
      values (v_parent, v_student,
              nullif(trim(coalesce(p_relationship, '')), ''),
              coalesce(p_is_primary, false)
                and not exists (select 1 from student_parents x
                                where x.student_id = v_student and x.is_primary))
      returning id into v_link;
  end if;

  return jsonb_build_object(
    'student_id', v_student,
    'enrollment_id', v_enrollment,
    'admission_id', v_admission,
    'parent_id', v_parent,
    'link_id', v_link);
end $$;
-- signature unchanged from 20260717000001 — grants already in place, no
-- re-grant needed, but restated here for a self-contained migration file.
revoke all on function admit_student_atomic(uuid, text, text, date, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function admit_student_atomic(uuid, text, text, date, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, boolean) to authenticated;
