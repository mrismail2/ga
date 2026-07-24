-- ============================================================
-- Kobciye Phase 1–4 additional mandatory requirements
--
-- Re-implementation of the previously reported (but unrecoverable)
-- 20260717000001 migration. Adds the canonical foundations the
-- Phase 1–4 requirements need and nothing beyond them:
--
--   1. student_enrollments — the canonical enrollment record an
--      admission produces (student ↔ class/stream/year, per school).
--   2. lesson_plans — canonical Casharrada records (replaces the
--      runtime demo LESSONS arrays in Live Mode).
--   3. conversations / conversation_members + messages.conversation_id
--      — canonical Fariimaha records (replaces demo MESSAGES arrays).
--      Unread state lives on conversation_members.last_read_at.
--   4. admit_student_atomic() — ONE transaction that creates/updates
--      student + student_enrollment + admission + (optional) parent +
--      student_parents guardian link. Any failure rolls everything
--      back, so a partial student can never be left behind.
--
-- No Phase 5 features (no timetable, attendance workflows, homework,
-- notifications, SMS/WhatsApp). RLS mirrors the Phase 4 conventions:
-- staff read within their school, admins manage, anon fully revoked.
-- ============================================================

-- caller identity usable inside RLS policy expressions (mirrors the
-- my_role()/my_school() convention: SECURITY DEFINER so the policy works
-- for the querying role without any direct grant on the auth schema)
create or replace function my_uid()
returns uuid language sql stable security definer set search_path = public as $$
  select auth.uid();
$$;
revoke all on function my_uid() from public;
grant execute on function my_uid() to anon, authenticated;

-- ============================================================
-- 1. student_enrollments
-- ============================================================
create table student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  class_id uuid references classes (id) on delete set null,
  stream_id uuid references class_streams (id) on delete set null,
  academic_year_id uuid references academic_years (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'transferred', 'completed', 'left')),
  enrolled_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table student_enrollments is
  'Phase 1-4: canonical enrollment produced by an admission. One active enrollment per student.';
create index student_enrollments_school on student_enrollments (school_id);
create index student_enrollments_student on student_enrollments (student_id);
-- a student holds at most ONE active enrollment
create unique index student_enrollments_one_active
  on student_enrollments (student_id) where status = 'active';
create trigger student_enrollments_updated_at before update on student_enrollments
  for each row execute function set_updated_at();

-- every FK must stay inside the same school
create or replace function phase4_guard_student_enrollments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;
  if new.class_id is not null and not exists (
    select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
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
revoke all on function phase4_guard_student_enrollments() from public, anon, authenticated;
create trigger student_enrollments_guard before insert or update on student_enrollments
  for each row execute function phase4_guard_student_enrollments();

-- ============================================================
-- 2. lesson_plans (Casharrada — canonical, Live Mode)
-- ============================================================
create table lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  teacher_profile_id uuid references profiles (id) on delete set null,
  teacher_name text not null default '',
  title text not null,
  subject text,
  class_label text,
  subject_id uuid references subjects (id) on delete set null,
  class_id uuid references classes (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'approved', 'rejected')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table lesson_plans is
  'Phase 1-4: canonical lesson plans (Casharrada). Live Mode reads these, never the demo LESSONS seed.';
create index lesson_plans_school on lesson_plans (school_id, status);
create index lesson_plans_teacher on lesson_plans (teacher_profile_id);
create trigger lesson_plans_updated_at before update on lesson_plans
  for each row execute function set_updated_at();

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
  -- only school admins (or super_admin) may approve / reject
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and not is_admin_of(new.school_id) then
    raise exception 'only a school admin may approve or reject a lesson plan';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_lesson_plans() from public, anon, authenticated;
create trigger lesson_plans_guard before insert or update on lesson_plans
  for each row execute function phase4_guard_lesson_plans();

-- ============================================================
-- 3. conversations / conversation_members / messages.conversation_id
-- ============================================================
create table conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  title text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table conversations is
  'Phase 1-4: canonical conversation threads (Fariimaha). Only members may access one.';
create index conversations_school on conversations (school_id);

create table conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (conversation_id, profile_id)
);
comment on table conversation_members is
  'Phase 1-4: conversation membership. Unread state = messages newer than last_read_at.';
create index conversation_members_profile on conversation_members (profile_id);

-- a member must belong to the SAME school as the conversation
create or replace function phase4_guard_conversation_members()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  select school_id into v_school from conversations where id = new.conversation_id;
  if v_school is null then
    raise exception 'conversation not found';
  end if;
  if not exists (
    select 1 from profiles p where p.id = new.profile_id and p.school_id = v_school) then
    raise exception 'member belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_conversation_members() from public, anon, authenticated;
create trigger conversation_members_guard before insert or update on conversation_members
  for each row execute function phase4_guard_conversation_members();

-- membership check usable inside RLS policies
create or replace function is_conversation_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_members m
    where m.conversation_id = p_conversation and m.profile_id = auth.uid());
$$;
revoke all on function is_conversation_member(uuid) from public;
grant execute on function is_conversation_member(uuid) to authenticated;

-- messages gain an optional conversation home (legacy direct rows keep
-- sender/recipient; conversation rows may have no single recipient)
alter table messages
  add column conversation_id uuid references conversations (id) on delete cascade;
alter table messages alter column recipient_id drop not null;
alter table messages
  add constraint messages_has_destination
  check (conversation_id is not null or recipient_id is not null);
create index messages_conversation on messages (conversation_id, created_at);

-- a conversation message must carry the conversation's own school and a
-- sender who is actually a member (RLS policies OR together, so this
-- trigger closes the legacy-policy write path into foreign conversations)
create or replace function phase4_guard_conversation_messages()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  if new.conversation_id is null then return new; end if;
  select school_id into v_school from conversations where id = new.conversation_id;
  if v_school is null then
    raise exception 'conversation not found';
  end if;
  if new.school_id is distinct from v_school then
    raise exception 'message school must match the conversation school';
  end if;
  if not exists (
    select 1 from conversation_members m
    where m.conversation_id = new.conversation_id and m.profile_id = new.sender_id) then
    raise exception 'sender is not a member of this conversation';
  end if;
  return new;
end $$;
revoke all on function phase4_guard_conversation_messages() from public, anon, authenticated;
create trigger messages_conversation_guard before insert or update on messages
  for each row execute function phase4_guard_conversation_messages();

-- ============================================================
-- RLS — new tables
-- ============================================================
alter table student_enrollments  enable row level security;
alter table lesson_plans         enable row level security;
alter table conversations        enable row level security;
alter table conversation_members enable row level security;

create policy "staff read enrollments" on student_enrollments for select
  using (is_staff_of(school_id));
create policy "admins manage enrollments" on student_enrollments for all
  using (is_admin_of(school_id) and (my_role() = 'super_admin' or not is_university_institution(school_id)));

create policy "staff read lesson_plans" on lesson_plans for select
  using (is_staff_of(school_id));
create policy "teachers create own lesson_plans" on lesson_plans for insert
  with check (teacher_profile_id = my_uid() and is_staff_of(school_id));
create policy "teachers update own lesson_plans" on lesson_plans for update
  using (teacher_profile_id = my_uid() and is_staff_of(school_id));
create policy "admins manage lesson_plans" on lesson_plans for all
  using (is_admin_of(school_id));

-- conversations: STRICTLY members only (no cross-school, no non-member).
-- The creator is visible to themselves so INSERT ... RETURNING works in the
-- moment before they add themselves as the first member.
create policy "members read conversations" on conversations for select
  using (is_conversation_member(id) or created_by = my_uid());
create policy "school users create conversations" on conversations for insert
  with check (created_by = my_uid() and school_id = my_school());

create policy "members read membership" on conversation_members for select
  using (profile_id = my_uid() or is_conversation_member(conversation_id));
create policy "creator or admin adds members" on conversation_members for insert
  with check (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.created_by = my_uid() or is_admin_of(c.school_id))
        and c.school_id = my_school())
  );
create policy "member updates own read state" on conversation_members for update
  using (profile_id = my_uid());

-- conversation messages (legacy direct-message policies stay untouched)
create policy "members read conversation messages" on messages for select
  using (conversation_id is not null and is_conversation_member(conversation_id));
create policy "members send conversation messages" on messages for insert
  with check (
    conversation_id is not null and sender_id = my_uid()
    and is_conversation_member(conversation_id) and school_id = my_school());

revoke all on student_enrollments, lesson_plans, conversations, conversation_members from anon;

-- ============================================================
-- 4. admit_student_atomic — the whole admission in ONE transaction
--
-- Creates (or links) the student, the enrollment, the admission row and
-- the optional guardian + guardian link. Runs as SECURITY DEFINER with
-- explicit admin + same-school checks (the phase4 guard triggers still
-- fire on every insert as defense in depth). Any raised exception rolls
-- the ENTIRE operation back — no partial student is ever left behind.
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

  -- 1. student — reuse an existing one (re-enrol/edit) or create fresh
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

  -- 2. enrollment — one active enrollment per student (update in place)
  select id into v_enrollment from student_enrollments
    where student_id = v_student and status = 'active';
  if v_enrollment is null then
    insert into student_enrollments (school_id, student_id, class_id, stream_id, academic_year_id)
      values (p_school, v_student, p_class_id, p_stream_id, p_academic_year_id)
      returning id into v_enrollment;
  else
    update student_enrollments set
      class_id = p_class_id, stream_id = p_stream_id, academic_year_id = p_academic_year_id
      where id = v_enrollment;
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
revoke all on function admit_student_atomic(uuid, text, text, date, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function admit_student_atomic(uuid, text, text, date, text, uuid, uuid, uuid, uuid, uuid, uuid, text, text, text, text, boolean) to authenticated;
