-- ============================================================
-- Kobciye Phase 5 final security correction
-- Assignment ownership/submission/grading integrity and atomic OTP failures.
-- Additive; no data is deleted.
-- ============================================================
begin;

-- A non-admin teacher may create/update only an assignment owned by their own
-- teacher record and backed by their exact active class+subject assignment.
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
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another school'; end if;
  if new.term_id is not null and not exists (
    select 1 from terms tr where tr.id = new.term_id and tr.school_id = new.school_id
      and (new.academic_year_id is null or tr.academic_year_id = new.academic_year_id)
  ) then raise exception 'term does not belong to the selected academic year'; end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;

  select a.id into new.teacher_assignment_id
  from teacher_assignments a
  join teachers t on t.id = a.teacher_id
  where a.school_id = new.school_id and a.teacher_id = new.teacher_id
    and a.subject_id = new.subject_id and a.class_id = new.class_id and a.is_active
    and (is_admin_of(new.school_id) or t.profile_id = auth.uid())
  limit 1;
  if new.teacher_assignment_id is null then
    raise exception 'this teacher is not assigned to the selected class and subject';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_assignments() from public, anon, authenticated;

-- Submission structure is immutable after insert. Students can never write
-- grading fields; score is always bounded by the assignment's max score.
create or replace function phase5_guard_assignment_submissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_assignment assignments;
  v_enrollment uuid;
  v_role text := my_role();
  v_next_attempt integer;
begin
  select * into v_assignment from assignments where id = new.assignment_id for share;
  if v_assignment.id is null then raise exception 'assignment was not found'; end if;
  if v_assignment.school_id is distinct from new.school_id then
    raise exception 'submission belongs to another school than its assignment';
  end if;

  if tg_op = 'UPDATE' then
    if new.school_id is distinct from old.school_id
       or new.assignment_id is distinct from old.assignment_id
       or new.student_id is distinct from old.student_id
       or new.enrollment_id is distinct from old.enrollment_id
       or new.attempt is distinct from old.attempt
       or new.submitted_at is distinct from old.submitted_at then
      raise exception 'submission identity fields are immutable';
    end if;
    if v_role = 'student' then
      raise exception 'students cannot edit a submitted attempt';
    end if;
    if not (is_admin_of(new.school_id) or is_teacher_of_class(v_assignment.class_id)) then
      raise exception 'only the assigned teacher or school admin may grade';
    end if;
    if new.score is not null and (new.score < 0 or (v_assignment.max_score is not null and new.score > v_assignment.max_score)) then
      raise exception 'score exceeds the assignment maximum';
    end if;
    if new.status = 'graded' then
      new.graded_by := auth.uid();
      new.graded_at := coalesce(new.graded_at, now());
    end if;
    return new;
  end if;

  if v_assignment.status <> 'published' then
    raise exception 'only a published assignment accepts submissions';
  end if;
  select e.id into v_enrollment
  from student_enrollments e
  where e.student_id = new.student_id and e.school_id = new.school_id
    and e.class_id = v_assignment.class_id and e.status = 'active'
    and (v_assignment.stream_id is null or e.stream_id = v_assignment.stream_id)
  order by e.enrolled_on desc limit 1;
  if v_enrollment is null then
    raise exception 'this student is not actively enrolled in the assignment class';
  end if;
  new.enrollment_id := v_enrollment;

  if v_role = 'student' then
    if not is_self_student(new.student_id) then raise exception 'students may submit only their own work'; end if;
    select coalesce(max(s.attempt), 0) + 1 into v_next_attempt
      from assignment_submissions s
      where s.assignment_id = new.assignment_id and s.student_id = new.student_id;
    if v_next_attempt > 1 and not v_assignment.allow_resubmission then
      raise exception 'resubmission is not permitted for this assignment';
    end if;
    new.attempt := v_next_attempt;
    new.status := 'submitted';
    new.score := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
    new.submitted_at := now();
  elsif not (is_admin_of(new.school_id) or is_teacher_of_class(v_assignment.class_id)) then
    raise exception 'not authorized to create this submission';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_assignment_submissions() from public, anon, authenticated;

-- Replace the over-broad student ALL policy. Students can read their own rows
-- and insert their own attempts, but cannot change score/feedback/status.
drop policy if exists "student manages own submissions" on assignment_submissions;
drop policy if exists "student reads own submissions" on assignment_submissions;
drop policy if exists "student creates own submissions" on assignment_submissions;
create policy "student reads own submissions" on assignment_submissions
  for select using (is_self_student(student_id));
create policy "student creates own submissions" on assignment_submissions
  for insert with check (is_self_student(student_id));

-- Narrow teacher access to read/update; teachers do not create/delete a
-- student's submission record.
drop policy if exists "teacher reads+grades submissions" on assignment_submissions;
drop policy if exists "teacher reads submissions" on assignment_submissions;
drop policy if exists "teacher grades submissions" on assignment_submissions;
create policy "teacher reads submissions" on assignment_submissions
  for select using (exists (
    select 1 from assignments a where a.id = assignment_submissions.assignment_id
      and is_teacher_of_class(a.class_id)
  ));
create policy "teacher grades submissions" on assignment_submissions
  for update using (exists (
    select 1 from assignments a where a.id = assignment_submissions.assignment_id
      and is_teacher_of_class(a.class_id)
  )) with check (exists (
    select 1 from assignments a where a.id = assignment_submissions.assignment_id
      and is_teacher_of_class(a.class_id)
  ));

-- Student-safe submission RPC. It derives the student from auth.uid(), assigns
-- the correct enrollment and next attempt in the trigger, and inserts optional
-- attachment metadata in the same transaction.
create or replace function submit_assignment_work(
  p_school uuid,
  p_assignment uuid,
  p_content text default null,
  p_attachments jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_student uuid;
  v_submission uuid;
  v_item jsonb;
begin
  select id into v_student from students
  where school_id = p_school and profile_id = auth.uid() and status = 'active';
  if v_student is null then raise exception 'student account is not linked'; end if;
  if not exists (select 1 from assignments where id = p_assignment and school_id = p_school) then
    raise exception 'assignment belongs to another school';
  end if;
  if nullif(trim(coalesce(p_content, '')), '') is null
     and (p_attachments is null or jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) = 0) then
    raise exception 'submission content or an attachment is required';
  end if;

  insert into assignment_submissions (school_id, assignment_id, student_id, content)
  values (p_school, p_assignment, v_student, nullif(trim(coalesce(p_content, '')), ''))
  returning id into v_submission;

  if p_attachments is not null and jsonb_typeof(p_attachments) = 'array' then
    for v_item in select * from jsonb_array_elements(p_attachments) loop
      if nullif(trim(coalesce(v_item->>'storage_path','')), '') is null
         or nullif(trim(coalesce(v_item->>'file_name','')), '') is null then
        raise exception 'attachment storage_path and file_name are required';
      end if;
      insert into submission_attachments (
        school_id, submission_id, storage_path, file_name, mime_type, size_bytes, uploaded_by
      ) values (
        p_school, v_submission, trim(v_item->>'storage_path'), trim(v_item->>'file_name'),
        nullif(trim(coalesce(v_item->>'mime_type','')), ''),
        case when coalesce(v_item->>'size_bytes','') ~ '^[0-9]+$' then (v_item->>'size_bytes')::bigint else null end,
        auth.uid()
      );
    end loop;
  end if;
  return v_submission;
end $$;
revoke all on function submit_assignment_work(uuid, uuid, text, jsonb) from public, anon;
grant execute on function submit_assignment_work(uuid, uuid, text, jsonb) to authenticated;

create or replace function grade_assignment_submission(
  p_school uuid,
  p_submission uuid,
  p_score numeric,
  p_feedback text default null,
  p_return_for_revision boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_submission assignment_submissions;
  v_assignment assignments;
begin
  select * into v_submission from assignment_submissions
  where id = p_submission and school_id = p_school for update;
  if v_submission.id is null then raise exception 'submission belongs to another school'; end if;
  select * into v_assignment from assignments where id = v_submission.assignment_id;
  if not (is_admin_of(p_school) or is_teacher_of_class(v_assignment.class_id)) then
    raise exception 'not authorized to grade this submission';
  end if;
  if not is_admin_of(p_school) and not exists (
    select 1 from teachers t join teacher_assignments a on a.teacher_id=t.id
    where t.profile_id=auth.uid() and a.school_id=p_school and a.is_active
      and a.class_id=v_assignment.class_id and a.subject_id=v_assignment.subject_id
  ) then raise exception 'teacher is not assigned to this class and subject'; end if;
  if not coalesce(p_return_for_revision,false) and p_score is null then raise exception 'score is required'; end if;
  if p_score is not null and (p_score < 0 or (v_assignment.max_score is not null and p_score > v_assignment.max_score)) then
    raise exception 'score exceeds the assignment maximum';
  end if;

  update assignment_submissions set
    score = case when coalesce(p_return_for_revision,false) then null else p_score end,
    feedback = nullif(trim(coalesce(p_feedback,'')),''),
    status = case when coalesce(p_return_for_revision,false) then 'returned' else 'graded' end,
    graded_by = auth.uid(), graded_at = now()
  where id = p_submission;
  return p_submission;
end $$;
revoke all on function grade_assignment_submission(uuid, uuid, numeric, text, boolean) from public, anon;
grant execute on function grade_assignment_submission(uuid, uuid, numeric, text, boolean) to authenticated;

-- Increment a wrong OTP attempt atomically. The returned count is used only by
-- the Edge Function and is never exposed as account metadata.
create or replace function record_password_reset_otp_failure(p_challenge uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_count integer;
begin
  update password_reset_otp_challenges
     set failed_attempts = least(failed_attempts + 1, 5)
   where id = p_challenge and consumed_at is null and expires_at > now()
  returning failed_attempts into v_count;
  return coalesce(v_count, 5);
end $$;
revoke all on function record_password_reset_otp_failure(uuid) from public, anon, authenticated;
grant execute on function record_password_reset_otp_failure(uuid) to service_role;

create or replace function expire_stale_password_reset_otp_challenges()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_count integer;
begin
  update password_reset_otp_challenges set consumed_at = coalesce(consumed_at, now())
  where consumed_at is null and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function expire_stale_password_reset_otp_challenges() from public, anon, authenticated;
grant execute on function expire_stale_password_reset_otp_challenges() to service_role;



-- A schedule-specific roster and result write path validates enrollment on the
-- actual exam date/stream, instead of using today's active roster.
create or replace function exam_roster_for_schedule(p_school uuid, p_schedule uuid)
returns table(student_id uuid, full_name text, enrollment_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_schedule exam_schedules;
begin
  select * into v_schedule from exam_schedules where id=p_schedule and school_id=p_school;
  if v_schedule.id is null then raise exception 'exam schedule belongs to another school'; end if;
  if not (is_admin_of(p_school) or is_teacher_of_class(v_schedule.class_id)) then
    raise exception 'not authorized to load this exam roster';
  end if;
  return query
  select st.id, st.full_name, e.id
  from student_enrollments e join students st on st.id=e.student_id and st.school_id=p_school
  where e.school_id=p_school and e.class_id=v_schedule.class_id
    and (v_schedule.stream_id is null or e.stream_id=v_schedule.stream_id)
    and e.enrolled_on <= v_schedule.exam_date
    and (e.ended_on is null or e.ended_on >= v_schedule.exam_date)
  order by st.full_name;
end $$;
revoke all on function exam_roster_for_schedule(uuid, uuid) from public, anon;
grant execute on function exam_roster_for_schedule(uuid, uuid) to authenticated;

create or replace function enter_scheduled_result(
  p_school uuid,
  p_schedule uuid,
  p_student uuid,
  p_score numeric,
  p_max_score integer default null,
  p_component text default null,
  p_attendance_status attendance_status default 'present'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_schedule exam_schedules;
  v_exam exams;
  v_id uuid;
  v_max integer;
begin
  select * into v_schedule from exam_schedules where id=p_schedule and school_id=p_school;
  if v_schedule.id is null then raise exception 'exam schedule belongs to another school'; end if;
  select * into v_exam from exams where id=v_schedule.exam_id and school_id=p_school;
  if v_exam.id is null then raise exception 'exam belongs to another school'; end if;
  if not (is_admin_of(p_school) or is_teacher_of_class(v_schedule.class_id)) then
    raise exception 'only an assigned teacher or school admin may enter this result';
  end if;
  if not is_admin_of(p_school) and not exists (
    select 1 from teachers t join teacher_assignments a on a.teacher_id=t.id
    where t.profile_id=auth.uid() and a.school_id=p_school and a.is_active
      and a.class_id=v_schedule.class_id and a.subject_id=v_schedule.subject_id
  ) then raise exception 'teacher is not assigned to the exam class and subject'; end if;
  if not exists (
    select 1 from student_enrollments e where e.school_id=p_school and e.student_id=p_student
      and e.class_id=v_schedule.class_id
      and (v_schedule.stream_id is null or e.stream_id=v_schedule.stream_id)
      and e.enrolled_on <= v_schedule.exam_date
      and (e.ended_on is null or e.ended_on >= v_schedule.exam_date)
  ) then raise exception 'student was not enrolled for this exam sitting'; end if;

  v_max := coalesce(p_max_score, v_exam.full_marks);
  if p_attendance_status in ('absent','excused') then p_score := 0; end if;
  if p_score is null then raise exception 'score is required'; end if;
  if p_score < 0 or p_score > v_max then raise exception 'score is outside the permitted range'; end if;

  insert into results (school_id,exam_id,student_id,term_id,score,full_marks,max_score,component,attendance_status,status,entered_by)
  values (p_school,v_exam.id,p_student,v_exam.term_id,p_score,v_exam.full_marks,v_max,p_component,p_attendance_status,'draft',auth.uid())
  on conflict (exam_id,student_id) do update set
    score=excluded.score,max_score=excluded.max_score,component=excluded.component,
    attendance_status=excluded.attendance_status,status='draft',entered_by=auth.uid()
  returning id into v_id;
  return v_id;
end $$;
revoke all on function enter_scheduled_result(uuid, uuid, uuid, numeric, integer, text, attendance_status) from public, anon;
grant execute on function enter_scheduled_result(uuid, uuid, uuid, numeric, integer, text, attendance_status) to authenticated;

commit;
