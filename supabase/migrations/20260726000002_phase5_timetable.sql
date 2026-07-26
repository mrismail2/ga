-- ============================================================
-- Kobciye Phase 5 — Stage 2a: timetable
--
-- school_days      — which weekdays this school actually teaches
-- timetable_periods— the named period grid (P1 08:00-08:45, …)
-- timetable_entries— one class+subject+teacher slot on one weekday
--
-- Every entry must be backed by a REAL teacher_assignments row, so a teacher
-- can never be timetabled for a class/subject pair they are not assigned to.
-- Teacher / class / stream overlaps are rejected by exclusion-style unique
-- guards plus an explicit range check.
--
-- Additive only. No existing table is altered destructively.
-- ============================================================

begin;

-- ============================================================
-- school_days — 0 = Sunday … 6 = Saturday (Postgres dow convention)
-- ============================================================
create table if not exists school_days (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_teaching_day boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, day_of_week)
);
create index if not exists school_days_school on school_days (school_id);
create trigger school_days_updated_at before update on school_days
  for each row execute function set_updated_at();

-- ============================================================
-- timetable_periods — the school's period grid
-- ============================================================
create table if not exists timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  name text not null,
  sort_order integer not null default 1,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_periods_range check (end_time > start_time),
  unique (school_id, academic_year_id, name)
);
create index if not exists timetable_periods_school on timetable_periods (school_id);
create trigger timetable_periods_updated_at before update on timetable_periods
  for each row execute function set_updated_at();

-- ============================================================
-- timetable_entries
-- ============================================================
create table if not exists timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid not null references academic_years (id) on delete cascade,
  term_id uuid references terms (id) on delete set null,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references class_streams (id) on delete set null,
  subject_id uuid not null references subjects (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  teacher_assignment_id uuid references teacher_assignments (id) on delete set null,
  period_id uuid references timetable_periods (id) on delete set null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text,
  status record_status not null default 'active',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_entries_range check (end_time > start_time)
);
create index if not exists timetable_entries_school on timetable_entries (school_id);
create index if not exists timetable_entries_class on timetable_entries (class_id, day_of_week);
create index if not exists timetable_entries_teacher on timetable_entries (teacher_id, day_of_week);
create index if not exists timetable_entries_year on timetable_entries (academic_year_id);
create trigger timetable_entries_updated_at before update on timetable_entries
  for each row execute function set_updated_at();

-- ============================================================
-- Relationship + overlap integrity.
--
-- Overlap is checked in the trigger rather than with a btree unique index
-- because two slots clash whenever their [start,end) ranges INTERSECT, which
-- a plain unique constraint cannot express. Only ACTIVE rows collide, so an
-- archived entry never blocks a new one.
-- ============================================================
create or replace function phase5_guard_timetable_entries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- every referenced row must belong to the SAME school
  if not exists (select 1 from academic_years y
                 where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic year belongs to another school';
  end if;
  if new.term_id is not null and not exists (
    select 1 from terms t where t.id = new.term_id and t.school_id = new.school_id) then
    raise exception 'term belongs to another school';
  end if;
  if not exists (select 1 from classes c
                 where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if not exists (select 1 from subjects s
                 where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if not exists (select 1 from teachers t
                 where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if new.period_id is not null and not exists (
    select 1 from timetable_periods p where p.id = new.period_id and p.school_id = new.school_id) then
    raise exception 'period belongs to another school';
  end if;
  -- a stream must belong to the SELECTED class (not merely the same school)
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id) then
    raise exception 'stream does not belong to the selected class';
  end if;
  -- the class's own academic year, when set, must match the entry's
  if exists (select 1 from classes c
             where c.id = new.class_id and c.academic_year_id is not null
               and c.academic_year_id is distinct from new.academic_year_id) then
    raise exception 'class belongs to a different academic year than the selected one';
  end if;

  -- a REAL teacher assignment must back this slot
  if new.teacher_assignment_id is not null then
    if not exists (
      select 1 from teacher_assignments a
      where a.id = new.teacher_assignment_id and a.school_id = new.school_id
        and a.teacher_id = new.teacher_id and a.subject_id = new.subject_id
        and a.class_id = new.class_id and a.is_active) then
      raise exception 'the selected teacher assignment does not match this teacher, subject and class';
    end if;
  else
    -- derive it; refuse the slot when the teacher is not actually assigned
    select a.id into new.teacher_assignment_id
    from teacher_assignments a
    where a.school_id = new.school_id and a.teacher_id = new.teacher_id
      and a.subject_id = new.subject_id and a.class_id = new.class_id and a.is_active
    limit 1;
    if new.teacher_assignment_id is null then
      raise exception 'this teacher is not assigned to the selected class and subject';
    end if;
  end if;

  -- keep the denormalized times in step with the chosen period
  if new.period_id is not null then
    select p.start_time, p.end_time into new.start_time, new.end_time
    from timetable_periods p where p.id = new.period_id;
  end if;
  if new.end_time <= new.start_time then
    raise exception 'the end time must be after the start time';
  end if;

  if new.status = 'active' then
    -- TEACHER cannot be in two places at once
    if exists (
      select 1 from timetable_entries e
      where e.id <> new.id and e.status = 'active'
        and e.teacher_id = new.teacher_id
        and e.academic_year_id = new.academic_year_id
        and e.day_of_week = new.day_of_week
        and coalesce(e.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(new.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and e.start_time < new.end_time and new.start_time < e.end_time
    ) then
      raise exception 'this teacher already has a timetable entry that overlaps this time';
    end if;

    -- CLASS cannot have two lessons at once. When either side is
    -- class-wide (stream_id null) it clashes with every stream of that class;
    -- two different streams of the same class may run in parallel.
    if exists (
      select 1 from timetable_entries e
      where e.id <> new.id and e.status = 'active'
        and e.class_id = new.class_id
        and e.academic_year_id = new.academic_year_id
        and e.day_of_week = new.day_of_week
        and coalesce(e.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(new.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and e.start_time < new.end_time and new.start_time < e.end_time
        and (e.stream_id is null or new.stream_id is null or e.stream_id = new.stream_id)
    ) then
      raise exception 'this class already has a timetable entry that overlaps this time';
    end if;
  end if;

  return new;
end $$;
revoke all on function phase5_guard_timetable_entries() from public, anon, authenticated;

create trigger timetable_entries_guard
  before insert or update on timetable_entries
  for each row execute function phase5_guard_timetable_entries();

-- ============================================================
-- Class-level visibility helpers (SECURITY DEFINER, like is_teacher_of_class /
-- is_self_student). A student/parent RLS policy cannot itself query
-- student_enrollments (that table has no student/parent read policy, by
-- design), so these definer helpers answer "is the caller a student / a
-- parent of a student actively enrolled in this class (and stream)?" without
-- recursing into RLS. Reused by attendance, assignments and exam schedules.
-- ============================================================
create or replace function student_active_in_class(p_class uuid, p_stream uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_enrollments e join students s on s.id = e.student_id
    where s.profile_id = auth.uid() and e.status = 'active' and e.class_id = p_class
      and (p_stream is null or e.stream_id = p_stream));
$$;
revoke all on function student_active_in_class(uuid, uuid) from public;
grant execute on function student_active_in_class(uuid, uuid) to anon, authenticated;

create or replace function parent_of_active_in_class(p_class uuid, p_stream uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_enrollments e
    where e.status = 'active' and e.class_id = p_class
      and (p_stream is null or e.stream_id = p_stream)
      and is_parent_of(e.student_id));
$$;
revoke all on function parent_of_active_in_class(uuid, uuid) from public;
grant execute on function parent_of_active_in_class(uuid, uuid) to anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table school_days enable row level security;
alter table timetable_periods enable row level security;
alter table timetable_entries enable row level security;

-- School Admin (and a super_admin acting on that school) manages the grid
create policy "admins manage school days" on school_days
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage timetable periods" on timetable_periods
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage timetable entries" on timetable_entries
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));

-- the grid itself is readable by any member of the school (it carries no
-- personal data) so a teacher/student/parent screen can render period names
create policy "school members read school days" on school_days
  for select using (school_id = my_school());
create policy "school members read timetable periods" on timetable_periods
  for select using (school_id = my_school());

-- a TEACHER sees only their OWN slots
create policy "teacher reads own timetable" on timetable_entries
  for select using (
    exists (select 1 from teachers t
            where t.id = timetable_entries.teacher_id and t.profile_id = auth.uid())
  );

-- a STUDENT sees only slots for the class (and stream) of their ACTIVE enrollment
create policy "student reads own class timetable" on timetable_entries
  for select using (student_active_in_class(class_id, stream_id));

-- a PARENT sees only the timetables of their LINKED children
create policy "parent reads linked child timetable" on timetable_entries
  for select using (parent_of_active_in_class(class_id, stream_id));

commit;
