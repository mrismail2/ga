-- ============================================================
-- Kobciye Phase 5 — Stage 3: assignments & homework
--
-- A teacher creates an assignment ONLY for a class+subject pair they are
-- actually assigned to. Students of that class's active enrollment submit;
-- a student may not submit twice unless the assignment explicitly allows
-- resubmission. Teachers grade; the grade lives on the submission.
--
-- Attachment tables store METADATA only (storage path + filename + mime),
-- never the bytes — the file itself lives in Supabase Storage.
--
-- Additive only.
-- ============================================================

begin;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references class_streams (id) on delete set null,
  subject_id uuid not null references subjects (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  teacher_assignment_id uuid references teacher_assignments (id) on delete set null,
  title text not null,
  instructions text,
  assigned_on date not null default current_date,
  due_on date,
  max_score numeric check (max_score is null or max_score > 0),
  allow_resubmission boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed', 'archived')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_due_after_assigned check (due_on is null or due_on >= assigned_on)
);
create index if not exists assignments_school on assignments (school_id);
create index if not exists assignments_class on assignments (class_id, status);
create index if not exists assignments_teacher on assignments (teacher_id);
create trigger assignments_updated_at before update on assignments
  for each row execute function set_updated_at();

create table if not exists assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  assignment_id uuid not null references assignments (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists assignment_attachments_assignment on assignment_attachments (assignment_id);

create table if not exists assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  enrollment_id uuid references student_enrollments (id) on delete set null,
  attempt integer not null default 1 check (attempt >= 1),
  content text,
  status text not null default 'submitted'
    check (status in ('submitted', 'returned', 'graded')),
  submitted_at timestamptz not null default now(),
  score numeric check (score is null or score >= 0),
  feedback text,
  graded_by uuid references profiles (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one ACTIVE submission per student per assignment unless resubmission is on
-- (resubmission bumps `attempt`, so the pair stays unique)
create unique index if not exists assignment_submissions_one_per_attempt
  on assignment_submissions (assignment_id, student_id, attempt);
create index if not exists assignment_submissions_assignment on assignment_submissions (assignment_id);
create index if not exists assignment_submissions_student on assignment_submissions (student_id);
create trigger assignment_submissions_updated_at before update on assignment_submissions
  for each row execute function set_updated_at();

create table if not exists submission_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  submission_id uuid not null references assignment_submissions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists submission_attachments_submission on submission_attachments (submission_id);

-- ============================================================
-- Integrity guards
-- ============================================================
create or replace function phase5_guard_assignments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if not exists (select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if not exists (select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id) then
    raise exception 'stream does not belong to the selected class';
  end if;
  -- a REAL, active teacher assignment must back this class+subject pair
  select a.id into new.teacher_assignment_id
  from teacher_assignments a
  where a.school_id = new.school_id and a.teacher_id = new.teacher_id
    and a.subject_id = new.subject_id and a.class_id = new.class_id and a.is_active
  limit 1;
  if new.teacher_assignment_id is null then
    raise exception 'this teacher is not assigned to the selected class and subject';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_assignments() from public, anon, authenticated;
create trigger assignments_guard before insert or update on assignments
  for each row execute function phase5_guard_assignments();

create or replace function phase5_guard_assignment_submissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_assignment assignments;
begin
  select * into v_assignment from assignments where id = new.assignment_id;
  if v_assignment.id is null then raise exception 'assignment was not found'; end if;
  if v_assignment.school_id is distinct from new.school_id then
    raise exception 'submission belongs to another school than its assignment';
  end if;
  -- the student must have a valid enrollment in the assignment's class
  if not exists (
    select 1 from student_enrollments e
    where e.student_id = new.student_id and e.school_id = new.school_id
      and e.class_id = v_assignment.class_id and e.status = 'active'
      and (v_assignment.stream_id is null or e.stream_id is null or e.stream_id = v_assignment.stream_id)
  ) then
    raise exception 'this student is not actively enrolled in the assignment class';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_assignment_submissions() from public, anon, authenticated;
create trigger assignment_submissions_guard before insert or update on assignment_submissions
  for each row execute function phase5_guard_assignment_submissions();

-- ============================================================
-- Audit
-- ============================================================
create or replace function phase5_audit_assignments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (new.school_id, auth.uid(), 'assignment.create', 'assignments', new.id::text,
            jsonb_build_object('status', new.status, 'class_id', new.class_id));
  elsif new.status is distinct from old.status then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (new.school_id, auth.uid(), 'assignment.' || new.status, 'assignments', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
revoke all on function phase5_audit_assignments() from public, anon, authenticated;
create trigger assignments_audit after insert or update on assignments
  for each row execute function phase5_audit_assignments();

-- publishing an assignment notifies each active student's linked parents
create or replace function phase5_notify_assignment_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_class_name text; v_subject_name text; r record;
begin
  if tg_op = 'UPDATE' and new.status = 'published' and old.status is distinct from 'published' then
    select name into v_class_name from classes where id = new.class_id;
    select name into v_subject_name from subjects where id = new.subject_id;
    for r in
      select distinct sp.parent_profile_id
      from student_enrollments e
      join student_parents sp on sp.student_id = e.student_id
      where e.school_id = new.school_id and e.class_id = new.class_id and e.status = 'active'
        and (new.stream_id is null or e.stream_id = new.stream_id)
        and sp.parent_profile_id is not null and coalesce(sp.can_receive_messages, true)
    loop
      perform set_config('kobciye.notify_system', 'on', true);
      insert into notifications (school_id, recipient_id, event_type, title, body, entity, entity_id, dedupe_key)
      values (new.school_id, r.parent_profile_id, 'assignment.published',
              'Shaqo-guri cusub',
              'Shaqo-guri cusub "' || new.title || '" ayaa loo diray ' ||
              coalesce(v_subject_name, '') || ' (' || coalesce(v_class_name, '') || ').' ||
              coalesce(' Waa in la gudbiyaa: ' || to_char(new.due_on, 'YYYY-MM-DD') || '.', ''),
              'assignments', new.id, 'assignment.published:' || new.id::text)
      on conflict (recipient_id, dedupe_key) do nothing;
      perform set_config('kobciye.notify_system', 'off', true);
    end loop;
  end if;
  return new;
end $$;
revoke all on function phase5_notify_assignment_published() from public, anon, authenticated;
create trigger assignments_notify_published after update on assignments
  for each row execute function phase5_notify_assignment_published();

-- ============================================================
-- RLS
-- ============================================================
alter table assignments enable row level security;
alter table assignment_attachments enable row level security;
alter table assignment_submissions enable row level security;
alter table submission_attachments enable row level security;

-- admins: full within their school
create policy "admins manage assignments" on assignments
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage assignment attachments" on assignment_attachments
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage submissions" on assignment_submissions
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage submission attachments" on submission_attachments
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));

-- teacher: their own assignments (by assigned class)
create policy "teacher manages own assignments" on assignments
  for all using (is_teacher_of_class(class_id)) with check (is_teacher_of_class(class_id));
create policy "teacher manages own assignment attachments" on assignment_attachments
  for all using (exists (select 1 from assignments a where a.id = assignment_attachments.assignment_id and is_teacher_of_class(a.class_id)))
  with check (exists (select 1 from assignments a where a.id = assignment_attachments.assignment_id and is_teacher_of_class(a.class_id)));
create policy "teacher reads+grades submissions" on assignment_submissions
  for all using (exists (select 1 from assignments a where a.id = assignment_submissions.assignment_id and is_teacher_of_class(a.class_id)))
  with check (exists (select 1 from assignments a where a.id = assignment_submissions.assignment_id and is_teacher_of_class(a.class_id)));
create policy "teacher reads submission attachments" on submission_attachments
  for select using (exists (
    select 1 from assignment_submissions su join assignments a on a.id = su.assignment_id
    where su.id = submission_attachments.submission_id and is_teacher_of_class(a.class_id)));

-- student: published assignments for their active enrollment; their own submissions
create policy "student reads published assignments" on assignments
  for select using (
    status in ('published', 'closed') and student_active_in_class(class_id, stream_id)
  );
create policy "student reads published assignment attachments" on assignment_attachments
  for select using (exists (
    select 1 from assignments a where a.id = assignment_attachments.assignment_id
      and a.status in ('published', 'closed')
      and student_active_in_class(a.class_id, a.stream_id)));
create policy "student manages own submissions" on assignment_submissions
  for all using (is_self_student(student_id)) with check (is_self_student(student_id));
create policy "student manages own submission attachments" on submission_attachments
  for all using (exists (select 1 from assignment_submissions su
                         where su.id = submission_attachments.submission_id and is_self_student(su.student_id)))
  with check (exists (select 1 from assignment_submissions su
                      where su.id = submission_attachments.submission_id and is_self_student(su.student_id)));

-- parent: linked children's published assignments + their submissions (read-only)
create policy "parent reads child published assignments" on assignments
  for select using (
    status in ('published', 'closed') and parent_of_active_in_class(class_id, stream_id)
  );
create policy "parent reads child submissions" on assignment_submissions
  for select using (is_parent_of(student_id));

commit;
