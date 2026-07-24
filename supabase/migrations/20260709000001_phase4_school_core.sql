-- ============================================================
-- Kobciye — Phase 4: Core School Management (School Mode)
--
-- ADDITIVE ONLY. No earlier migration is edited; no existing policy,
-- trigger, constraint, enum or grant is dropped or weakened. Existing
-- tables are REUSED (never duplicated) and only gain nullable columns:
--
--   REUSED  academic_years   (name/starts_on/ends_on/is_current/status ✓)
--   EXTEND  terms            + starts_on, ends_on, created_at, updated_at
--   NEW     school_sections  Primary / Middle / Secondary levels per school
--   EXTEND  classes          + school_section_id, academic_year_id, code,
--                              display_order, updated_at
--   NEW     class_streams    streams/sections inside a class (Form 1 A/B …)
--   EXTEND  subjects         + code, school_section_id, class_id, is_active,
--                              created_at, updated_at
--   EXTEND  teachers/staff   + email (account-invite foundation)
--   NEW     teacher_assignments  teacher+subject+class(+stream)+year(+term)
--   EXTEND  students         + admission_number, date_of_birth, stream_id,
--                              academic_year_id
--   EXTEND  parents          + email (guardian directory; RLS from 0005)
--   EXTEND  student_parents  + relationship, is_primary, can_receive_messages
--   NEW     admissions       applicant pipeline (draft → … → enrolled)
--
-- Security: RLS enabled on every new table. Reads = school staff of the
-- same school; writes = school admins of the same school (or super_admin).
-- No parent/student policies are added yet (Phase 4 keeps them
-- conservative by design). New cross-table references are guarded by
-- same-school trigger checks, mirroring guard_*_school() from 0006.
-- ============================================================

-- ---------- helper: institution-type checks ----------
-- Universities live in `schools` with institution_type = 'university'.
-- NULL institution_type (legacy/unclassified) is treated as school-side so
-- existing schools keep working.
create or replace function is_university_institution(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from schools where id = p_school and institution_type = 'university'
  );
$$;
revoke all on function is_university_institution(uuid) from public;
grant execute on function is_university_institution(uuid) to authenticated;

-- ============================================================
-- 1. school_sections — Primary / Middle / Secondary levels
-- ============================================================
create table school_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,
  level_type text not null check (level_type in ('primary', 'middle', 'secondary')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);
comment on table school_sections is
  'Phase 4: the sections/levels one school runs (Hoose/Dhexe/Sare). A school may add more level types later — school_stage from Phase 3 stays the INITIAL default only.';
create index school_sections_school on school_sections (school_id);
create trigger school_sections_updated_at before update on school_sections
  for each row execute function set_updated_at();

-- ============================================================
-- 2. terms gain real calendar dates (table reused from Phase 2)
-- ============================================================
alter table terms
  add column starts_on date,
  add column ends_on date,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
alter table terms
  add constraint terms_dates_valid
    check (starts_on is null or ends_on is null or starts_on <= ends_on);
create trigger terms_updated_at before update on terms
  for each row execute function set_updated_at();

-- ============================================================
-- 3. classes gain section/year/code (table reused from Phase 2)
-- ============================================================
alter table classes
  add column school_section_id uuid references school_sections (id) on delete set null,
  add column academic_year_id uuid references academic_years (id) on delete set null,
  add column code text,
  add column display_order integer not null default 0,
  add column updated_at timestamptz not null default now();
-- class code unique per school (case-insensitive), where provided
create unique index classes_school_code_unique
  on classes (school_id, lower(code)) where code is not null;
create trigger classes_updated_at before update on classes
  for each row execute function set_updated_at();

-- new FK columns must stay inside the same school
create or replace function phase4_guard_classes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_section_id is not null and not exists (
    select 1 from school_sections s where s.id = new.school_section_id and s.school_id = new.school_id) then
    raise exception 'school_section belongs to another school';
  end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic_year belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_classes() from public, anon, authenticated;
create trigger classes_phase4_guard before insert or update on classes
  for each row execute function phase4_guard_classes();

-- ============================================================
-- 4. class_streams — streams inside a class (NEW)
-- ============================================================
create table class_streams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  name text not null,
  code text,
  capacity integer not null default 0 check (capacity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, name)
);
comment on table class_streams is 'Phase 4: streams/sections inside a class (e.g. Form 1 A / Form 1 B).';
create index class_streams_school on class_streams (school_id);
create index class_streams_class on class_streams (class_id);
create unique index class_streams_school_code_unique
  on class_streams (school_id, lower(code)) where code is not null;
create trigger class_streams_updated_at before update on class_streams
  for each row execute function set_updated_at();

create or replace function phase4_guard_class_streams()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_class_streams() from public, anon, authenticated;
create trigger class_streams_guard before insert or update on class_streams
  for each row execute function phase4_guard_class_streams();

-- ============================================================
-- 5. subjects gain code/section/class scoping (table reused)
-- ============================================================
alter table subjects
  add column code text,
  add column school_section_id uuid references school_sections (id) on delete set null,
  add column class_id uuid references classes (id) on delete set null,
  add column is_active boolean not null default true,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
create unique index subjects_school_code_unique
  on subjects (school_id, lower(code)) where code is not null;
create trigger subjects_updated_at before update on subjects
  for each row execute function set_updated_at();

create or replace function phase4_guard_subjects()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.school_section_id is not null and not exists (
    select 1 from school_sections s where s.id = new.school_section_id and s.school_id = new.school_id) then
    raise exception 'school_section belongs to another school';
  end if;
  if new.class_id is not null and not exists (
    select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_subjects() from public, anon, authenticated;
create trigger subjects_phase4_guard before insert or update on subjects
  for each row execute function phase4_guard_subjects();

-- ============================================================
-- 6. teachers / staff / parents gain email (invite foundation)
-- ============================================================
alter table teachers add column email text;
alter table staff    add column email text;
alter table parents  add column email text;
comment on column teachers.email is
  'Phase 4 account-activation foundation: where a future teacher invite goes. No login is created from this column alone.';

-- ============================================================
-- 7. teacher_assignments — teacher+subject+class(+stream)+year(+term) (NEW)
--    (teacher_classes / teacher_subjects from Phase 2 stay as-is; this is
--    the year-aware assignment the timetable/exams of Phase 5+ will read.)
-- ============================================================
create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references class_streams (id) on delete set null,
  academic_year_id uuid not null references academic_years (id) on delete cascade,
  term_id uuid references terms (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table teacher_assignments is 'Phase 4: who teaches what, where, in which year/term.';
create index teacher_assignments_school on teacher_assignments (school_id);
create index teacher_assignments_teacher on teacher_assignments (teacher_id);
create unique index teacher_assignments_unique
  on teacher_assignments (school_id, teacher_id, subject_id, class_id, academic_year_id,
    (coalesce(stream_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    (coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create trigger teacher_assignments_updated_at before update on teacher_assignments
  for each row execute function set_updated_at();

create or replace function phase4_guard_teacher_assignments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if not exists (select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st where st.id = new.stream_id and st.school_id = new.school_id) then
    raise exception 'stream belongs to another school';
  end if;
  if not exists (select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic_year belongs to another school';
  end if;
  if new.term_id is not null and not exists (
    select 1 from terms tm where tm.id = new.term_id and tm.school_id = new.school_id) then
    raise exception 'term belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_teacher_assignments() from public, anon, authenticated;
create trigger teacher_assignments_guard before insert or update on teacher_assignments
  for each row execute function phase4_guard_teacher_assignments();

-- ============================================================
-- 8. students gain admissions/stream/year columns (table reused)
-- ============================================================
alter table students
  add column admission_number text,
  add column date_of_birth date,
  add column stream_id uuid references class_streams (id) on delete set null,
  add column academic_year_id uuid references academic_years (id) on delete set null;
-- admission number unique per school, where provided
create unique index students_admission_number_unique
  on students (school_id, admission_number) where admission_number is not null;

create or replace function phase4_guard_students()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stream_id is not null and not exists (
    select 1 from class_streams st where st.id = new.stream_id and st.school_id = new.school_id) then
    raise exception 'stream belongs to another school';
  end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic_year belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_students() from public, anon, authenticated;
create trigger students_phase4_guard before insert or update on students
  for each row execute function phase4_guard_students();

-- ============================================================
-- 9. student_parents (student↔guardian link) gains link metadata
--    Activation foundation ONLY: no public login by School ID + Student ID;
--    a real parent/student account still requires an invite/verification
--    flow (Phase 5+). Nothing here creates or activates auth accounts.
-- ============================================================
alter table student_parents
  add column relationship text,
  add column is_primary boolean not null default false,
  add column can_receive_messages boolean not null default true;

-- ============================================================
-- 10. admissions — applicant pipeline (NEW)
-- ============================================================
create table admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  student_id uuid references students (id) on delete set null,
  applicant_name text not null,
  guardian_name text,
  guardian_phone text,
  desired_class_id uuid references classes (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'accepted', 'rejected', 'enrolled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table admissions is 'Phase 4: admission applications; enrolling creates/links the students row.';
create index admissions_school on admissions (school_id, status);
create trigger admissions_updated_at before update on admissions
  for each row execute function set_updated_at();

create or replace function phase4_guard_admissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.desired_class_id is not null and not exists (
    select 1 from classes c where c.id = new.desired_class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if new.student_id is not null and not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_admissions() from public, anon, authenticated;
create trigger admissions_guard before insert or update on admissions
  for each row execute function phase4_guard_admissions();

-- ============================================================
-- RLS — new school-mode tables
-- Reads: staff of the same school. Writes: admins of the same school
-- (is_admin_of already includes super_admin). Institution isolation: these
-- are School-Mode tables, so management additionally requires the owning
-- row NOT to be a university (super_admin excepted). No parent/student
-- policies yet — conservative by design.
-- ============================================================
alter table school_sections     enable row level security;
alter table class_streams       enable row level security;
alter table teacher_assignments enable row level security;
alter table admissions          enable row level security;

create policy "staff read sections" on school_sections for select
  using (is_staff_of(school_id));
create policy "admins manage sections" on school_sections for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or not is_university_institution(school_id)));

create policy "staff read streams" on class_streams for select
  using (is_staff_of(school_id));
create policy "admins manage streams" on class_streams for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or not is_university_institution(school_id)));

create policy "staff read teacher_assignments" on teacher_assignments for select
  using (is_staff_of(school_id));
create policy "admins manage teacher_assignments" on teacher_assignments for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or not is_university_institution(school_id)));

-- admissions is INTENTIONALLY shared by both institution types: a school
-- enrolls applicants into classes, a university uses the same pipeline with
-- desired_class_id left null (its programme placement comes in Phase 5).
-- Same-school scoping still fully applies.
create policy "staff read admissions" on admissions for select
  using (is_staff_of(school_id));
create policy "admins manage admissions" on admissions for all
  using (is_admin_of(school_id));

-- lock anon out of the new tables entirely (defense in depth, mirrors 0007/0008)
revoke all on school_sections, class_streams, teacher_assignments, admissions from anon;
