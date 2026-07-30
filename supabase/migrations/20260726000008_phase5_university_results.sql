-- ============================================================
-- Kobciye Phase 5 — Stage 7a: university results & transcripts
--
-- University Mode is kept STRICTLY separate from School Mode: these tables
-- use faculties/departments/programmes/semesters/courses/lecturers/
-- university_students only — never classes/streams/school subjects. The guard
-- functions refuse to operate unless the school is a university institution.
--
-- course_enrollments — a university student registered on a course/semester
-- course_results     — a graded result for one enrollment (draft→published)
-- transcripts        — a published, immutable snapshot of a student's record
--
-- Additive only.
-- ============================================================

begin;

-- SECURITY DEFINER: "is the caller the university student behind this record?"
-- (university_students has no self-read policy, so a student policy cannot
-- sub-query it under RLS — this definer helper answers without recursing).
create or replace function is_self_university_student(p_uni_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from university_students u
                 where u.id = p_uni_student and u.profile_id = auth.uid())
$$;
revoke all on function is_self_university_student(uuid) from public;
grant execute on function is_self_university_student(uuid) to anon, authenticated;

-- a lecturer teaches a course (the baseline links lecturers to departments,
-- not courses, so this join is the missing piece the results workflow needs)
create table if not exists course_lecturers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  lecturer_id uuid not null references lecturers (id) on delete cascade,
  semester_id uuid references semesters (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (course_id, lecturer_id, semester_id)
);
create index if not exists course_lecturers_course on course_lecturers (course_id);
create index if not exists course_lecturers_lecturer on course_lecturers (lecturer_id);

create table if not exists course_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  university_student_id uuid not null references university_students (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  semester_id uuid references semesters (id) on delete set null,
  academic_year_id uuid references academic_years (id) on delete set null,
  status text not null default 'registered'
    check (status in ('registered', 'withdrawn', 'completed')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_student_id, course_id, semester_id)
);
create index if not exists course_enrollments_school on course_enrollments (school_id);
create index if not exists course_enrollments_student on course_enrollments (university_student_id);
create trigger course_enrollments_updated_at before update on course_enrollments
  for each row execute function set_updated_at();

create table if not exists course_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  course_enrollment_id uuid not null references course_enrollments (id) on delete cascade,
  university_student_id uuid not null references university_students (id) on delete cascade,
  course_id uuid not null references courses (id) on delete cascade,
  semester_id uuid references semesters (id) on delete set null,
  score numeric check (score is null or (score >= 0 and score <= 100)),
  grade text,
  grade_point numeric,
  credit_hours integer,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'published')),
  entered_by uuid references profiles (id) on delete set null,
  approved_by uuid references profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_enrollment_id)
);
create index if not exists course_results_school on course_results (school_id);
create index if not exists course_results_student on course_results (university_student_id);
create trigger course_results_updated_at before update on course_results
  for each row execute function set_updated_at();

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  university_student_id uuid not null references university_students (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  semester_id uuid references semesters (id) on delete set null,
  gpa numeric,
  total_credits integer,
  -- an immutable snapshot of the published course results at issue time
  snapshot jsonb not null default '{}'::jsonb,
  issued_by uuid references profiles (id) on delete set null,
  issued_at timestamptz not null default now()
);
create index if not exists transcripts_student on transcripts (university_student_id);

-- ============================================================
-- University-mode integrity — these operations are university-only.
-- ============================================================
create or replace function phase5_guard_course_enrollments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_university_institution(new.school_id) then
    raise exception 'course enrollment is a University Mode operation';
  end if;
  if not exists (select 1 from university_students u
                 where u.id = new.university_student_id and u.school_id = new.school_id) then
    raise exception 'university student belongs to another school';
  end if;
  if not exists (select 1 from courses c where c.id = new.course_id and c.school_id = new.school_id) then
    raise exception 'course belongs to another school';
  end if;
  if new.semester_id is not null and not exists (
    select 1 from semesters s where s.id = new.semester_id and s.school_id = new.school_id) then
    raise exception 'semester belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_course_enrollments() from public, anon, authenticated;
create trigger course_enrollments_guard before insert or update on course_enrollments
  for each row execute function phase5_guard_course_enrollments();

create or replace function phase5_guard_course_results()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_university_institution(new.school_id) then
    raise exception 'course result is a University Mode operation';
  end if;
  if not exists (select 1 from course_enrollments e
                 where e.id = new.course_enrollment_id and e.school_id = new.school_id
                   and e.university_student_id = new.university_student_id
                   and e.course_id = new.course_id) then
    raise exception 'course result does not match its enrollment';
  end if;
  if new.score is not null and (new.score < 0 or new.score > 100) then
    raise exception 'a course result score must be between 0 and 100';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'published') and not is_admin_of(new.school_id) then
    raise exception 'only a university admin may approve or publish a course result';
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
revoke all on function phase5_guard_course_results() from public, anon, authenticated;
create trigger course_results_guard before insert or update on course_results
  for each row execute function phase5_guard_course_results();

create or replace function phase5_guard_transcripts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_university_institution(new.school_id) then
    raise exception 'transcript is a University Mode operation';
  end if;
  if not exists (select 1 from university_students u
                 where u.id = new.university_student_id and u.school_id = new.school_id) then
    raise exception 'university student belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_transcripts() from public, anon, authenticated;
create trigger transcripts_guard before insert or update on transcripts
  for each row execute function phase5_guard_transcripts();

-- ============================================================
-- RLS
-- ============================================================
alter table course_lecturers enable row level security;
alter table course_enrollments enable row level security;
alter table course_results enable row level security;
alter table transcripts enable row level security;

create policy "admins manage course lecturers" on course_lecturers
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "lecturer reads own course links" on course_lecturers
  for select using (exists (
    select 1 from lecturers l where l.id = course_lecturers.lecturer_id and l.profile_id = auth.uid()));

create policy "admins manage course enrollments" on course_enrollments
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage course results" on course_results
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage transcripts" on transcripts
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));

-- a lecturer may enter/read results for courses they teach (course_lecturers)
create policy "lecturer manages own course results" on course_results
  for all using (exists (
    select 1 from course_lecturers cl join lecturers l on l.id = cl.lecturer_id
    where cl.course_id = course_results.course_id and cl.is_active and l.profile_id = auth.uid()))
  with check (exists (
    select 1 from course_lecturers cl join lecturers l on l.id = cl.lecturer_id
    where cl.course_id = course_results.course_id and cl.is_active and l.profile_id = auth.uid()));

-- a university student reads only their OWN published results + transcripts
create policy "uni student reads own published results" on course_results
  for select using (status = 'published' and is_self_university_student(university_student_id));
create policy "uni student reads own enrollments" on course_enrollments
  for select using (is_self_university_student(university_student_id));
create policy "uni student reads own transcripts" on transcripts
  for select using (is_self_university_student(university_student_id));

-- ============================================================
-- issue_transcript — snapshot a student's PUBLISHED course results.
-- ============================================================
create or replace function issue_transcript(
  p_school uuid, p_student uuid, p_academic_year uuid default null, p_semester uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_snapshot jsonb; v_gpa numeric; v_credits integer;
begin
  if not is_university_institution(p_school) then
    raise exception 'transcripts are a University Mode operation';
  end if;
  if not is_admin_of(p_school) then raise exception 'only a university admin may issue a transcript'; end if;
  if not exists (select 1 from university_students where id = p_student and school_id = p_school) then
    raise exception 'university student belongs to another school';
  end if;

  select jsonb_agg(jsonb_build_object(
           'course_id', cr.course_id, 'grade', cr.grade, 'score', cr.score,
           'grade_point', cr.grade_point, 'credit_hours', cr.credit_hours)),
         round(sum(cr.grade_point * coalesce(cr.credit_hours, 0)) / nullif(sum(coalesce(cr.credit_hours, 0)), 0), 2),
         sum(coalesce(cr.credit_hours, 0))
    into v_snapshot, v_gpa, v_credits
  from course_results cr
  where cr.school_id = p_school and cr.university_student_id = p_student and cr.status = 'published'
    and (p_semester is null or cr.semester_id = p_semester);

  insert into transcripts (school_id, university_student_id, academic_year_id, semester_id,
                           gpa, total_credits, snapshot, issued_by)
  values (p_school, p_student, p_academic_year, p_semester,
          v_gpa, coalesce(v_credits, 0), coalesce(v_snapshot, '[]'::jsonb), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function issue_transcript(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function issue_transcript(uuid, uuid, uuid, uuid) to authenticated;

commit;
