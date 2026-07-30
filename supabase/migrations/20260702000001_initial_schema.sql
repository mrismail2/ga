-- ============================================================
-- Kobciye — Phase 2: initial database schema
-- Mirrors the frontend's canonical store (mobile/src/data/seedData.js):
-- schools, profiles, subjects, classes, students, teachers, terms,
-- exam windows, exams, results, attendance, payments, incidents, messages.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
-- 'pending' is the only role a public signup may ever receive (see
-- handle_new_user() below) — it has no school_id and no RLS policy grants
-- it access to anything until an admin assigns a real role.
create type user_role as enum ('super_admin', 'school_admin', 'teacher', 'accountant', 'parent', 'student', 'pending');
create type student_status as enum ('active', 'left', 'transferred', 'graduated', 'inactive', 'suspended_not_billed');
create type fee_status as enum ('full', 'half', 'free');
create type record_status as enum ('active', 'archived');
create type exam_status as enum ('draft', 'published');
create type window_status as enum ('open', 'closed');
create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type result_status as enum ('passed', 'failed');
create type school_plan as enum ('small', 'large');

-- ---------- schools ----------
create table schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  plan school_plan not null default 'small',
  status record_status not null default 'active',
  logo_url text,
  location text,
  -- per-school student id generation (HID-001, HID-002 …)
  student_id_prefix text not null default 'HID',
  next_student_sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profiles (one row per auth user) ----------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  school_id uuid references schools (id) on delete set null,
  role user_role not null default 'pending',
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- subjects (per school) ----------
create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,          -- Xisaab, Sayniska …
  name_en text,
  unique (school_id, name)
);

-- ---------- classes ----------
create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,          -- Form 5A …
  level text not null default '',
  capacity integer not null default 0,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table class_subjects (
  class_id uuid not null references classes (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  primary key (class_id, subject_id)
);

-- ---------- teachers ----------
create table teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  full_name text not null,
  phone text,
  status record_status not null default 'active',
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table teacher_classes (
  teacher_id uuid not null references teachers (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  primary key (teacher_id, class_id)
);

create table teacher_subjects (
  teacher_id uuid not null references teachers (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  primary key (teacher_id, subject_id)
);

-- ---------- students ----------
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  class_id uuid references classes (id) on delete set null,
  profile_id uuid references profiles (id) on delete set null, -- student login
  student_id text not null,    -- public id: HID-001, HID-002 …
  full_name text not null,
  gender text,
  status student_status not null default 'active',
  fee fee_status not null default 'full',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id)
);

-- parent ↔ student links (a parent can have several children)
create table student_parents (
  parent_profile_id uuid not null references profiles (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  primary key (parent_profile_id, student_id)
);

-- ---------- terms (admin-defined calendar) ----------
create table terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,          -- Term 1 …
  "order" integer not null default 1,
  status record_status not null default 'active',
  unique (school_id, name)
);

-- ---------- exam windows (admin → teacher permission) ----------
create table exam_windows (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  term_id uuid not null references terms (id) on delete cascade,
  full_marks integer not null default 100 check (full_marks in (25, 50, 100)),
  status window_status not null default 'open',
  created_at timestamptz not null default now()
);

-- ---------- exams ----------
create table exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete cascade,
  teacher_id uuid references teachers (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  window_id uuid references exam_windows (id) on delete set null,
  title text not null,
  full_marks integer not null default 100,
  pass_mark integer not null default 50,
  status exam_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- ---------- results ----------
create table results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  exam_id uuid not null references exams (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  term_id uuid references terms (id) on delete set null,
  score numeric not null,
  full_marks integer not null default 100,
  percentage numeric generated always as (round(score / nullif(full_marks, 0) * 100, 1)) stored,
  grade text,
  result_status result_status,
  attendance_status attendance_status not null default 'present',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

-- ---------- attendance ----------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  class_id uuid not null references classes (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  taken_by uuid references teachers (id) on delete set null,
  date date not null default current_date,
  status attendance_status not null default 'present',
  note text,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

-- ---------- finance ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null default 'USD',
  month text,                  -- billing month label, e.g. '2026-06'
  method text,                 -- cash / zaad / edahab …
  note text,
  received_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table billing_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  month text not null,
  amount_due numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'unpaid',   -- unpaid / partial / paid / waived
  created_at timestamptz not null default now(),
  unique (student_id, month)
);

-- ---------- incidents (kiisaska) ----------
create table incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  class_id uuid references classes (id) on delete set null,
  student_id uuid references students (id) on delete set null,
  reported_by uuid references profiles (id) on delete set null,
  title text not null,
  detail text,
  severity text not null default 'dhexe',  -- hoose / dhexe / sare / halis
  status text not null default 'open',     -- open / resolved
  created_at timestamptz not null default now()
);

-- ---------- messages & notices ----------
create table messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table notices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  title text not null,
  body text,
  audience user_role[],        -- null/empty = everyone in the school
  created_at timestamptz not null default now()
);

-- ---------- grading rules (per school) ----------
create table grading_rules (
  school_id uuid primary key references schools (id) on delete cascade,
  pass_mark integer not null default 50,
  bands jsonb not null default '[{"grade":"A","min":80},{"grade":"B","min":70},{"grade":"C","min":60},{"grade":"D","min":50},{"grade":"F","min":0}]'
);

-- ---------- indexes ----------
create index on profiles (school_id, role);
create index on students (school_id, class_id);
create index on students (school_id, status);
create index on attendance (school_id, date);
create index on attendance (class_id, date);
create index on results (student_id);
create index on results (exam_id);
create index on payments (school_id, month);
create index on payments (student_id);
create index on billing_records (school_id, month);
create index on exams (school_id, class_id);
create index on messages (recipient_id, read_at);
create index on incidents (school_id, status);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger schools_updated_at  before update on schools  for each row execute function set_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger students_updated_at before update on students for each row execute function set_updated_at();

-- ---------- per-school student id generator (HID-001, HID-002 …) ----------
-- Atomically consumes the school's sequence and stamps the public id.
-- The UPDATE takes a row lock on the school for the duration of the
-- transaction, so concurrent inserts for the same school are serialized —
-- no two students can ever be minted the same sequence number.
create or replace function next_student_id(p_school uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_prefix text;
  v_seq integer;
begin
  update schools
     set next_student_sequence = next_student_sequence + 1
   where id = p_school
   returning student_id_prefix, next_student_sequence - 1 into v_prefix, v_seq;
  if v_prefix is null then
    raise exception 'school % not found', p_school;
  end if;
  return v_prefix || '-' || lpad(v_seq::text, 3, '0');
end $$;

create or replace function students_fill_student_id()
returns trigger language plpgsql as $$
begin
  if new.student_id is null or new.student_id = '' then
    new.student_id := next_student_id(new.school_id);
  end if;
  return new;
end $$;

create trigger students_fill_id before insert on students
  for each row execute function students_fill_student_id();

-- ---------- auto-create a profile row on signup ----------
-- SECURITY: every public signup lands as 'pending' with no school_id, full
-- stop. raw_user_meta_data is supplied by the CLIENT at signup time — a
-- caller can put anything in it, including {"role":"super_admin"}. It must
-- never be trusted for role or school_id. Only 'full_name' (harmless
-- display text) is read from it. Turning a 'pending' account into a real
-- role happens exclusively through provision_school() (self-service: become
-- admin of a brand-new school) or assign_role() (an existing admin assigns
-- a role within their own school) — see migration 0006.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'pending',
    null
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
