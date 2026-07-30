-- ============================================================
-- Kobciye Phase 5 — Stage 4: exam scheduling + result workflow (School Mode)
--
-- REUSE, don't duplicate:
--   • `exams`  (Phase 1/2) is the exam definition (class+subject+marks). It is
--      left unchanged; a NEW `exam_schedules` table adds the date/time/room
--      dimension it lacks, referencing exams.id.
--   • `results` (Phase 1/2) is extended IN PLACE with a draft→submitted→
--      approved→published workflow. Its existing columns, policies and guards
--      stay intact (nothing is weakened); the workflow columns and a history
--      table are added, and SECURITY DEFINER RPCs enforce the stricter
--      "teacher may only enter results for an assigned class+subject" rule and
--      the "only an admin may approve/publish" rule.
--   • `grading_rules` (Phase 1/2, per-school bands jsonb) is reused to derive
--      letter grades — no parallel grading table.
--
-- Additive only.
-- ============================================================

begin;

-- ============================================================
-- exam_schedules — WHEN/WHERE a given exam is sat
-- ============================================================
create table if not exists exam_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  exam_id uuid not null references exams (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references class_streams (id) on delete set null,
  subject_id uuid not null references subjects (id) on delete cascade,
  teacher_id uuid references teachers (id) on delete set null,
  exam_date date not null,
  start_time time,
  end_time time,
  room text,
  status exam_status not null default 'draft',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_schedules_range check (start_time is null or end_time is null or end_time > start_time)
);
create index if not exists exam_schedules_school on exam_schedules (school_id);
create index if not exists exam_schedules_exam on exam_schedules (exam_id);
create index if not exists exam_schedules_class on exam_schedules (class_id, exam_date);
-- no two sittings for the same class+stream+subject on the same date
create unique index if not exists exam_schedules_unique_slot
  on exam_schedules (school_id, class_id,
    coalesce(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
    subject_id, exam_date);
create trigger exam_schedules_updated_at before update on exam_schedules
  for each row execute function set_updated_at();

create or replace function phase5_guard_exam_schedules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from exams e where e.id = new.exam_id and e.school_id = new.school_id) then
    raise exception 'exam belongs to another school';
  end if;
  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if not exists (select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id) then
    raise exception 'stream does not belong to the selected class';
  end if;
  if new.term_id is not null and not exists (
    select 1 from terms t where t.id = new.term_id and t.school_id = new.school_id) then
    raise exception 'term belongs to another school';
  end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic year belongs to another school';
  end if;
  if new.teacher_id is not null and not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;
  -- a class cannot sit two different exams that overlap in time on one day
  if new.start_time is not null and new.end_time is not null and new.status = 'published' then
    if exists (
      select 1 from exam_schedules es
      where es.id <> new.id and es.status = 'published'
        and es.class_id = new.class_id and es.exam_date = new.exam_date
        and (es.stream_id is null or new.stream_id is null or es.stream_id = new.stream_id)
        and es.start_time is not null and es.end_time is not null
        and es.start_time < new.end_time and new.start_time < es.end_time
    ) then
      raise exception 'this class already has an exam scheduled that overlaps this time';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_exam_schedules() from public, anon, authenticated;
create trigger exam_schedules_guard before insert or update on exam_schedules
  for each row execute function phase5_guard_exam_schedules();

alter table exam_schedules enable row level security;
create policy "admins manage exam schedules" on exam_schedules
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "teacher reads assigned exam schedules" on exam_schedules
  for select using (
    is_teacher_of_class(class_id)
    or exists (select 1 from teachers t where t.id = exam_schedules.teacher_id and t.profile_id = auth.uid()));
-- student/parent: only PUBLISHED schedules for their enrollment / linked child
create policy "student reads published exam schedules" on exam_schedules
  for select using (status = 'published' and student_active_in_class(class_id, stream_id));
create policy "parent reads published exam schedules" on exam_schedules
  for select using (status = 'published' and parent_of_active_in_class(class_id, stream_id));

-- ============================================================
-- results — additive workflow columns (existing columns untouched)
-- ============================================================
alter table results add column if not exists status text not null default 'draft'
  check (status in ('draft', 'submitted', 'approved', 'published'));
alter table results add column if not exists max_score integer;
alter table results add column if not exists component text;
alter table results add column if not exists entered_by uuid references profiles (id) on delete set null;
alter table results add column if not exists submitted_at timestamptz;
alter table results add column if not exists approved_by uuid references profiles (id) on delete set null;
alter table results add column if not exists approved_at timestamptz;
alter table results add column if not exists published_at timestamptz;
alter table results add column if not exists updated_at timestamptz not null default now();

drop trigger if exists results_updated_at on results;
create trigger results_updated_at before update on results
  for each row execute function set_updated_at();

create table if not exists result_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  result_id uuid not null references results (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  old_status text,
  new_status text,
  old_score numeric,
  new_score numeric,
  changed_by uuid references profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists result_history_result on result_history (result_id, changed_at desc);
alter table result_history enable row level security;
create policy "admins read result history" on result_history
  for select using (is_admin_of(school_id));
create policy "teacher reads result history" on result_history
  for select using (is_teacher_of_student(student_id));

-- ============================================================
-- Additive strengthening guard on results — never weakens the existing
-- guard_results_school() (which still runs); adds Phase 5 rules on top:
--   • score never negative, never above the max
--   • only an admin may move a row to approved/published
--   • keep the legacy `published` boolean in step with `status`
--   • record every status/score change in result_history
-- ============================================================
create or replace function phase5_guard_results_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max numeric;
begin
  v_max := coalesce(new.max_score, new.full_marks);
  if new.score is not null and new.score < 0 then
    raise exception 'a result score cannot be negative';
  end if;
  if new.score is not null and v_max is not null and new.score > v_max then
    raise exception 'a result score cannot exceed the maximum (%).', v_max;
  end if;

  -- only an admin of this school may approve or publish
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'published') and not is_admin_of(new.school_id) then
    raise exception 'only a school admin may approve or publish results';
  end if;

  -- keep the legacy visibility flag exactly in step with the workflow status
  new.published := (new.status = 'published');
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.score is distinct from old.score) then
    insert into result_history (school_id, result_id, student_id, old_status, new_status, old_score, new_score, changed_by)
    values (new.school_id, new.id, new.student_id, old.status, new.status, old.score, new.score, auth.uid());
  end if;
  return new;
end $$;
revoke all on function phase5_guard_results_workflow() from public, anon, authenticated;
drop trigger if exists results_workflow_guard on results;
create trigger results_workflow_guard before insert or update on results
  for each row execute function phase5_guard_results_workflow();

-- ============================================================
-- enter_result — the Phase 5 gradebook write path. A teacher may enter a
-- result ONLY for a class+subject they are assigned to (stricter than the
-- legacy staff-wide policy, enforced here in SECURITY DEFINER code). An admin
-- may enter for any class in their school.
-- ============================================================
create or replace function enter_result(
  p_school uuid,
  p_exam uuid,
  p_student uuid,
  p_score numeric,
  p_max_score integer default null,
  p_component text default null,
  p_attendance_status attendance_status default 'present'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_exam exams;
  v_id uuid;
  v_max integer;
begin
  select * into v_exam from exams where id = p_exam and school_id = p_school;
  if v_exam.id is null then raise exception 'exam belongs to another school'; end if;

  if not (is_admin_of(p_school) or is_teacher_of_class(v_exam.class_id)) then
    raise exception 'only an assigned teacher or a school admin may enter this result';
  end if;
  -- an assigned teacher must own the exam's exact class+subject pair
  if not is_admin_of(p_school) and not exists (
    select 1 from teacher_assignments a join teachers t on t.id = a.teacher_id
    where a.school_id = p_school and t.profile_id = auth.uid() and a.is_active
      and a.class_id = v_exam.class_id and a.subject_id = v_exam.subject_id) then
    raise exception 'this teacher is not assigned to the exam class and subject';
  end if;

  -- only a student who was (currently or historically) in this class may be graded
  if not exists (
    select 1 from student_enrollments e
    where e.student_id = p_student and e.school_id = p_school and e.class_id = v_exam.class_id) then
    raise exception 'this student has no enrollment in the exam class';
  end if;

  v_max := coalesce(p_max_score, v_exam.full_marks);

  insert into results (school_id, exam_id, student_id, term_id, score, full_marks,
                       max_score, component, attendance_status, status, entered_by)
  values (p_school, p_exam, p_student, v_exam.term_id, p_score, v_exam.full_marks,
          v_max, p_component, p_attendance_status, 'draft', auth.uid())
  on conflict (exam_id, student_id) do update
    set score = excluded.score,
        max_score = excluded.max_score,
        component = excluded.component,
        attendance_status = excluded.attendance_status,
        -- a re-entry on an already-published row is not allowed silently:
        -- it drops back to draft so it must be re-approved/re-published
        status = case when results.status = 'published' then 'draft' else results.status end,
        entered_by = auth.uid()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function enter_result(uuid, uuid, uuid, numeric, integer, text, attendance_status) from public, anon;
grant execute on function enter_result(uuid, uuid, uuid, numeric, integer, text, attendance_status) to authenticated;

-- submit_results — teacher moves an exam's draft results to submitted
create or replace function submit_results(p_school uuid, p_exam uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_exam exams; v_n integer;
begin
  select * into v_exam from exams where id = p_exam and school_id = p_school;
  if v_exam.id is null then raise exception 'exam belongs to another school'; end if;
  if not (is_admin_of(p_school) or is_teacher_of_class(v_exam.class_id)) then
    raise exception 'not authorized to submit these results';
  end if;
  with upd as (
    update results set status = 'submitted', submitted_at = now()
    where exam_id = p_exam and school_id = p_school and status = 'draft' returning 1)
  select count(*) into v_n from upd;
  return coalesce(v_n, 0);
end $$;
revoke all on function submit_results(uuid, uuid) from public, anon;
grant execute on function submit_results(uuid, uuid) to authenticated;

-- approve_results / publish_results — school admin only
create or replace function approve_results(p_school uuid, p_exam uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may approve results'; end if;
  with upd as (
    update results set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where exam_id = p_exam and school_id = p_school and status in ('submitted', 'draft') returning 1)
  select count(*) into v_n from upd;
  return coalesce(v_n, 0);
end $$;
revoke all on function approve_results(uuid, uuid) from public, anon;
grant execute on function approve_results(uuid, uuid) to authenticated;

create or replace function publish_results(p_school uuid, p_exam uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer; r record; v_class text; v_subject text;
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may publish results'; end if;
  with upd as (
    update results set status = 'published', published_at = now()
    where exam_id = p_exam and school_id = p_school and status = 'approved' returning student_id)
  select count(*) into v_n from upd;

  -- notify each published student's linked parents
  select c.name, sub.name into v_class, v_subject
  from exams e join classes c on c.id = e.class_id join subjects sub on sub.id = e.subject_id
  where e.id = p_exam;
  for r in
    select distinct sp.parent_profile_id, res.student_id, st.full_name
    from results res
    join student_parents sp on sp.student_id = res.student_id
    join students st on st.id = res.student_id
    where res.exam_id = p_exam and res.status = 'published'
      and sp.parent_profile_id is not null and coalesce(sp.can_receive_messages, true)
  loop
    perform set_config('kobciye.notify_system', 'on', true);
    insert into notifications (school_id, recipient_id, event_type, title, body, entity, entity_id, student_id, dedupe_key)
    values (p_school, r.parent_profile_id, 'result.published', 'Natiijo la daabacay',
            'Natiijada imtixaanka ee ardaygaaga ' || r.full_name || ' (' ||
            coalesce(v_subject, '') || ', ' || coalesce(v_class, '') || ') ayaa la daabacay.',
            'exams', p_exam, r.student_id, 'result.published:' || p_exam::text || ':' || r.student_id::text)
    on conflict (recipient_id, dedupe_key) do nothing;
    perform set_config('kobciye.notify_system', 'off', true);
  end loop;
  return coalesce(v_n, 0);
end $$;
revoke all on function publish_results(uuid, uuid) from public, anon;
grant execute on function publish_results(uuid, uuid) to authenticated;

-- grade_for_percentage — derive a letter grade from the school's grading_rules
create or replace function grade_for_percentage(p_school uuid, p_percentage numeric)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_bands jsonb; v_band jsonb; v_grade text;
begin
  select bands into v_bands from grading_rules where school_id = p_school;
  if v_bands is null or p_percentage is null then return null; end if;
  for v_band in select * from jsonb_array_elements(v_bands) order by (value ->> 'min')::numeric desc loop
    if p_percentage >= (v_band ->> 'min')::numeric then
      return v_band ->> 'grade';
    end if;
  end loop;
  return null;
end $$;
revoke all on function grade_for_percentage(uuid, numeric) from public, anon;
grant execute on function grade_for_percentage(uuid, numeric) to authenticated;

commit;
