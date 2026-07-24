-- ============================================================
-- Kobciye — Phase 4: Core Management (University Mode)
--
-- ADDITIVE ONLY. Universities are rows in `schools` with
-- institution_type = 'university' (Phase 3), so every table below keys on
-- school_id exactly like School Mode and reuses the same RLS helpers.
--
--   NEW faculties            Kulliyadaha
--   NEW departments          inside a faculty
--   NEW programmes           inside a department (degree levels)
--   REUSE academic_years     (already per-institution; NOT duplicated as a
--                             separate university_academic_years table)
--   NEW semesters            inside an academic year
--   NEW courses              inside a programme/department
--   NEW lecturers            teaching staff (university side)
--   NEW university_students  student records (university side)
--
-- Security: RLS on everything. Reads = staff of the same institution;
-- writes = admins of the same institution AND the institution must BE a
-- university (super_admin excepted) — a school admin can never write into
-- university tables, and vice versa (School-Mode Phase 4 tables carry the
-- mirrored "not university" check). No GPA/transcripts/registration yet.
-- ============================================================

-- ============================================================
-- 1. faculties
-- ============================================================
create table faculties (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);
create index faculties_school on faculties (school_id);
create unique index faculties_school_code_unique
  on faculties (school_id, lower(code)) where code is not null;
create trigger faculties_updated_at before update on faculties
  for each row execute function set_updated_at();

-- ============================================================
-- 2. departments
-- ============================================================
create table departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  faculty_id uuid references faculties (id) on delete set null,
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);
create index departments_school on departments (school_id);
create unique index departments_school_code_unique
  on departments (school_id, lower(code)) where code is not null;
create trigger departments_updated_at before update on departments
  for each row execute function set_updated_at();

create or replace function phase4_guard_departments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.faculty_id is not null and not exists (
    select 1 from faculties f where f.id = new.faculty_id and f.school_id = new.school_id) then
    raise exception 'faculty belongs to another university';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_departments() from public, anon, authenticated;
create trigger departments_guard before insert or update on departments
  for each row execute function phase4_guard_departments();

-- ============================================================
-- 3. programmes
-- ============================================================
create table programmes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  department_id uuid references departments (id) on delete set null,
  name text not null,
  code text,
  degree_level text not null default 'bachelor'
    check (degree_level in ('certificate', 'diploma', 'bachelor', 'master', 'phd')),
  duration_years numeric(3,1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);
create index programmes_school on programmes (school_id);
create unique index programmes_school_code_unique
  on programmes (school_id, lower(code)) where code is not null;
create trigger programmes_updated_at before update on programmes
  for each row execute function set_updated_at();

create or replace function phase4_guard_programmes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.department_id is not null and not exists (
    select 1 from departments d where d.id = new.department_id and d.school_id = new.school_id) then
    raise exception 'department belongs to another university';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_programmes() from public, anon, authenticated;
create trigger programmes_guard before insert or update on programmes
  for each row execute function phase4_guard_programmes();

-- ============================================================
-- 4. semesters (hang off the REUSED academic_years table)
-- ============================================================
create table semesters (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid not null references academic_years (id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year_id, name),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create index semesters_school on semesters (school_id);
create trigger semesters_updated_at before update on semesters
  for each row execute function set_updated_at();

create or replace function phase4_guard_semesters()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic_year belongs to another institution';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_semesters() from public, anon, authenticated;
create trigger semesters_guard before insert or update on semesters
  for each row execute function phase4_guard_semesters();

-- ============================================================
-- 5. courses
-- ============================================================
create table courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  programme_id uuid references programmes (id) on delete set null,
  department_id uuid references departments (id) on delete set null,
  name text not null,
  code text,
  credit_hours numeric(4,1),
  level_year integer check (level_year is null or level_year between 1 and 10),
  semester_number integer check (semester_number is null or semester_number between 1 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_school on courses (school_id);
create unique index courses_school_code_unique
  on courses (school_id, lower(code)) where code is not null;
create trigger courses_updated_at before update on courses
  for each row execute function set_updated_at();

create or replace function phase4_guard_courses()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.programme_id is not null and not exists (
    select 1 from programmes p where p.id = new.programme_id and p.school_id = new.school_id) then
    raise exception 'programme belongs to another university';
  end if;
  if new.department_id is not null and not exists (
    select 1 from departments d where d.id = new.department_id and d.school_id = new.school_id) then
    raise exception 'department belongs to another university';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_courses() from public, anon, authenticated;
create trigger courses_guard before insert or update on courses
  for each row execute function phase4_guard_courses();

-- ============================================================
-- 6. lecturers
-- ============================================================
create table lecturers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  department_id uuid references departments (id) on delete set null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column lecturers.profile_id is
  'Account foundation only: set once the lecturer gets a real invited login. No login is created from this table alone.';
create index lecturers_school on lecturers (school_id);
create trigger lecturers_updated_at before update on lecturers
  for each row execute function set_updated_at();

create or replace function phase4_guard_lecturers()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.department_id is not null and not exists (
    select 1 from departments d where d.id = new.department_id and d.school_id = new.school_id) then
    raise exception 'department belongs to another university';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_lecturers() from public, anon, authenticated;
create trigger lecturers_guard before insert or update on lecturers
  for each row execute function phase4_guard_lecturers();

-- ============================================================
-- 7. university_students
-- ============================================================
create table university_students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  student_code text,
  admission_number text,
  full_name text not null,
  gender text,
  date_of_birth date,
  programme_id uuid references programmes (id) on delete set null,
  cohort text,
  level_year integer check (level_year is null or level_year between 1 and 10),
  status text not null default 'active'
    check (status in ('active', 'graduated', 'withdrawn', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index university_students_school on university_students (school_id, status);
create unique index university_students_code_unique
  on university_students (school_id, lower(student_code)) where student_code is not null;
create unique index university_students_admission_unique
  on university_students (school_id, admission_number) where admission_number is not null;
create trigger university_students_updated_at before update on university_students
  for each row execute function set_updated_at();

create or replace function phase4_guard_university_students()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.programme_id is not null and not exists (
    select 1 from programmes p where p.id = new.programme_id and p.school_id = new.school_id) then
    raise exception 'programme belongs to another university';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_university_students() from public, anon, authenticated;
create trigger university_students_guard before insert or update on university_students
  for each row execute function phase4_guard_university_students();

-- ============================================================
-- RLS — university tables
-- Writes additionally require the owning institution to BE a university
-- (super_admin excepted), so a school admin can never create/edit/delete
-- university rows even for their own school_id. Reads are staff-scoped and
-- university-scoped the same way. No student/lecturer self-service
-- policies yet — conservative by design.
-- ============================================================
alter table faculties           enable row level security;
alter table departments         enable row level security;
alter table programmes          enable row level security;
alter table semesters           enable row level security;
alter table courses             enable row level security;
alter table lecturers           enable row level security;
alter table university_students enable row level security;

create policy "uni staff read faculties" on faculties for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage faculties" on faculties for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read departments" on departments for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage departments" on departments for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read programmes" on programmes for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage programmes" on programmes for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read semesters" on semesters for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage semesters" on semesters for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read courses" on courses for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage courses" on courses for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read lecturers" on lecturers for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage lecturers" on lecturers for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

create policy "uni staff read university_students" on university_students for select
  using (is_staff_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));
create policy "uni admins manage university_students" on university_students for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or is_university_institution(school_id)));

-- lock anon out entirely (defense in depth, mirrors 0007/0008)
revoke all on faculties, departments, programmes, semesters, courses, lecturers, university_students from anon;
