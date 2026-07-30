-- ============================================================
-- Kobciye Phase 5 final RLS + identity hardening
--
-- Corrects broad legacy staff policies now that Phase 5 has assignment-aware
-- RPCs and role-specific screens. It also normalizes identifier login and
-- strengthens exam/attendance relationship integrity.
--
-- Additive/corrective only. No user row is deleted.
-- ============================================================
begin;

-- -------------------------------------------------------------------------
-- Shared exact-assignment helpers
-- -------------------------------------------------------------------------
create or replace function phase5_teacher_assigned_pair(
  p_school uuid,
  p_class uuid,
  p_subject uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from teachers t
    join teacher_assignments a on a.teacher_id = t.id
    where t.profile_id = auth.uid()
      and t.school_id = p_school
      and a.school_id = p_school
      and a.class_id = p_class
      and a.subject_id = p_subject
      and a.is_active
  )
$$;
revoke all on function phase5_teacher_assigned_pair(uuid, uuid, uuid) from public, anon;
grant execute on function phase5_teacher_assigned_pair(uuid, uuid, uuid) to authenticated;

create or replace function phase5_teacher_owns_assignment(p_assignment uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from assignments a
    join teachers t on t.id = a.teacher_id
    where a.id = p_assignment
      and t.profile_id = auth.uid()
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  )
$$;
revoke all on function phase5_teacher_owns_assignment(uuid) from public, anon;
grant execute on function phase5_teacher_owns_assignment(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- Assignments: exact teacher ownership and RPC-only student writes
-- -------------------------------------------------------------------------
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
    if not (is_admin_of(new.school_id)
            or phase5_teacher_assigned_pair(new.school_id, v_assignment.class_id, v_assignment.subject_id)) then
      raise exception 'only the assigned teacher or school admin may grade';
    end if;
    if new.score is not null and (
      new.score < 0
      or (v_assignment.max_score is not null and new.score > v_assignment.max_score)
    ) then raise exception 'score exceeds the assignment maximum'; end if;
    if new.status = 'graded' then
      new.graded_by := auth.uid();
      new.graded_at := coalesce(new.graded_at, now());
    elsif new.status = 'returned' then
      new.score := null;
      new.graded_by := auth.uid();
      new.graded_at := now();
    end if;
    return new;
  end if;

  if v_assignment.status <> 'published' then
    raise exception 'only a published assignment accepts submissions';
  end if;
  select e.id into v_enrollment
  from student_enrollments e
  where e.student_id = new.student_id
    and e.school_id = new.school_id
    and e.class_id = v_assignment.class_id
    and e.status = 'active'
    and (v_assignment.stream_id is null or e.stream_id = v_assignment.stream_id)
  order by e.enrolled_on desc limit 1;
  if v_enrollment is null then
    raise exception 'this student is not actively enrolled in the assignment class';
  end if;
  new.enrollment_id := v_enrollment;

  if v_role = 'student' then
    if not is_self_student(new.student_id) then
      raise exception 'students may submit only their own work';
    end if;
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
  elsif not (is_admin_of(new.school_id)
             or phase5_teacher_assigned_pair(new.school_id, v_assignment.class_id, v_assignment.subject_id)) then
    raise exception 'not authorized to create this submission';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_assignment_submissions() from public, anon, authenticated;

-- Remove the class-wide teacher policy, which also accidentally granted DELETE.
drop policy if exists "teacher manages own assignments" on assignments;
drop policy if exists "teacher reads assigned assignments" on assignments;
drop policy if exists "teacher creates own assignments" on assignments;
drop policy if exists "teacher updates own assignments" on assignments;
create policy "teacher reads assigned assignments" on assignments
  for select using (phase5_teacher_assigned_pair(school_id, class_id, subject_id));
create policy "teacher creates own assignments" on assignments
  for insert with check (
    phase5_teacher_assigned_pair(school_id, class_id, subject_id)
    and exists (
      select 1 from teachers t
      where t.id = assignments.teacher_id
        and t.school_id = assignments.school_id
        and t.profile_id = auth.uid()
    )
  );
create policy "teacher updates own assignments" on assignments
  for update using (
    phase5_teacher_assigned_pair(school_id, class_id, subject_id)
    and exists (select 1 from teachers t where t.id = assignments.teacher_id and t.profile_id = auth.uid())
  ) with check (
    phase5_teacher_assigned_pair(school_id, class_id, subject_id)
    and exists (select 1 from teachers t where t.id = assignments.teacher_id and t.profile_id = auth.uid())
  );
-- Teachers archive/close through UPDATE; only admins retain DELETE through the
-- existing admin policy.

drop policy if exists "teacher manages own assignment attachments" on assignment_attachments;
drop policy if exists "teacher reads assigned assignment attachments" on assignment_attachments;
drop policy if exists "teacher creates own assignment attachments" on assignment_attachments;
drop policy if exists "teacher updates own assignment attachments" on assignment_attachments;
drop policy if exists "teacher deletes own assignment attachments" on assignment_attachments;
create policy "teacher reads assigned assignment attachments" on assignment_attachments
  for select using (exists (
    select 1 from assignments a
    where a.id = assignment_attachments.assignment_id
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  ));
create policy "teacher creates own assignment attachments" on assignment_attachments
  for insert with check (phase5_teacher_owns_assignment(assignment_id));
create policy "teacher updates own assignment attachments" on assignment_attachments
  for update using (phase5_teacher_owns_assignment(assignment_id))
  with check (phase5_teacher_owns_assignment(assignment_id));
create policy "teacher deletes own assignment attachments" on assignment_attachments
  for delete using (phase5_teacher_owns_assignment(assignment_id));

-- Teacher submission access must be exact class+subject, not merely any subject
-- in the same class.
drop policy if exists "teacher reads submissions" on assignment_submissions;
drop policy if exists "teacher grades submissions" on assignment_submissions;
create policy "teacher reads submissions" on assignment_submissions
  for select using (exists (
    select 1 from assignments a
    where a.id = assignment_submissions.assignment_id
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  ));
create policy "teacher grades submissions" on assignment_submissions
  for update using (exists (
    select 1 from assignments a
    where a.id = assignment_submissions.assignment_id
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  )) with check (exists (
    select 1 from assignments a
    where a.id = assignment_submissions.assignment_id
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  ));

drop policy if exists "teacher reads submission attachments" on submission_attachments;
create policy "teacher reads submission attachments" on submission_attachments
  for select using (exists (
    select 1
    from assignment_submissions su
    join assignments a on a.id = su.assignment_id
    where su.id = submission_attachments.submission_id
      and phase5_teacher_assigned_pair(a.school_id, a.class_id, a.subject_id)
  ));

-- Student writes happen only through submit_assignment_work(), which derives
-- identity and clears all grading fields server-side.
drop policy if exists "student creates own submissions" on assignment_submissions;
drop policy if exists "student manages own submission attachments" on submission_attachments;
drop policy if exists "student reads own submission attachments" on submission_attachments;
create policy "student reads own submission attachments" on submission_attachments
  for select using (exists (
    select 1 from assignment_submissions su
    where su.id = submission_attachments.submission_id
      and is_self_student(su.student_id)
  ));

-- -------------------------------------------------------------------------
-- Exams and results: School Admin creates; Teacher reads/enters assigned pairs
-- only. The RPCs remain the only Teacher write paths.
-- -------------------------------------------------------------------------
create or replace function phase5_guard_exam_schedules()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_exam exams;
begin
  select * into v_exam from exams where id = new.exam_id and school_id = new.school_id;
  if v_exam.id is null then raise exception 'exam belongs to another school'; end if;
  if new.class_id is distinct from v_exam.class_id
     or new.subject_id is distinct from v_exam.subject_id then
    raise exception 'exam schedule class and subject must match the exam';
  end if;
  if new.term_id is not null and v_exam.term_id is not null and new.term_id is distinct from v_exam.term_id then
    raise exception 'exam schedule term must match the exam term';
  end if;
  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if not exists (select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another school'; end if;
  if new.term_id is not null and not exists (
    select 1 from terms t
    where t.id = new.term_id and t.school_id = new.school_id
      and (new.academic_year_id is null or t.academic_year_id = new.academic_year_id)
  ) then raise exception 'term does not belong to the selected academic year'; end if;
  if new.teacher_id is not null then
    if not exists (select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
      raise exception 'teacher belongs to another school';
    end if;
    if not exists (
      select 1 from teacher_assignments a
      where a.school_id = new.school_id and a.teacher_id = new.teacher_id
        and a.class_id = new.class_id and a.subject_id = new.subject_id and a.is_active
    ) then raise exception 'teacher is not assigned to the exam class and subject'; end if;
  end if;

  if new.start_time is not null and new.end_time is not null and new.status = 'published' then
    if exists (
      select 1 from exam_schedules es
      where es.id <> new.id and es.school_id = new.school_id and es.status = 'published'
        and es.class_id = new.class_id and es.exam_date = new.exam_date
        and (es.stream_id is null or new.stream_id is null or es.stream_id = new.stream_id)
        and es.start_time is not null and es.end_time is not null
        and es.start_time < new.end_time and new.start_time < es.end_time
    ) then raise exception 'this class already has an exam scheduled that overlaps this time'; end if;
    if new.teacher_id is not null and exists (
      select 1 from exam_schedules es
      where es.id <> new.id and es.school_id = new.school_id and es.status = 'published'
        and es.teacher_id = new.teacher_id and es.exam_date = new.exam_date
        and es.start_time is not null and es.end_time is not null
        and es.start_time < new.end_time and new.start_time < es.end_time
    ) then raise exception 'this teacher already has an exam scheduled that overlaps this time'; end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_exam_schedules() from public, anon, authenticated;

-- Tighten legacy exams policies.
drop policy if exists "staff read exams" on exams;
drop policy if exists "staff write exams" on exams;
drop policy if exists "students read published exams" on exams;
drop policy if exists "admins manage exams" on exams;
drop policy if exists "teacher reads assigned exams" on exams;
drop policy if exists "student reads own published exams" on exams;
drop policy if exists "parent reads child published exams" on exams;
create policy "admins manage exams" on exams
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "teacher reads assigned exams" on exams
  for select using (phase5_teacher_assigned_pair(school_id, class_id, subject_id));
create policy "student reads own published exams" on exams
  for select using (status = 'published' and student_active_in_class(class_id, null::uuid));
create policy "parent reads child published exams" on exams
  for select using (status = 'published' and parent_of_active_in_class(class_id, null::uuid));

-- Exact-pair Teacher visibility for schedules/history.
drop policy if exists "teacher reads assigned exam schedules" on exam_schedules;
create policy "teacher reads assigned exam schedules" on exam_schedules
  for select using (phase5_teacher_assigned_pair(school_id, class_id, subject_id));

drop policy if exists "teacher reads result history" on result_history;
create policy "teacher reads result history" on result_history
  for select using (exists (
    select 1
    from results r
    join exams e on e.id = r.exam_id
    where r.id = result_history.result_id
      and phase5_teacher_assigned_pair(r.school_id, e.class_id, e.subject_id)
  ));

-- Replace broad school-staff result policies. Teachers use enter_result /
-- enter_scheduled_result and submit_results, all of which validate assignments.
drop policy if exists "staff read results" on results;
drop policy if exists "staff write results" on results;
drop policy if exists "admins manage results" on results;
drop policy if exists "teacher reads assigned results" on results;
create policy "admins manage results" on results
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "teacher reads assigned results" on results
  for select using (exists (
    select 1 from exams e
    where e.id = results.exam_id
      and phase5_teacher_assigned_pair(results.school_id, e.class_id, e.subject_id)
  ));

-- Enforce ordered workflow even for direct admin writes.
create or replace function phase5_guard_results_workflow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max numeric;
  v_exam exams;
begin
  select * into v_exam from exams where id = new.exam_id and school_id = new.school_id;
  if v_exam.id is null then raise exception 'result exam belongs to another school'; end if;

  v_max := coalesce(new.max_score, new.full_marks);
  if new.score is not null and new.score < 0 then raise exception 'a result score cannot be negative'; end if;
  if new.score is not null and v_max is not null and new.score > v_max then
    raise exception 'a result score cannot exceed the maximum (%).', v_max;
  end if;
  if new.attendance_status in ('absent', 'excused') then new.score := 0; end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'a new result must start as draft'; end if;
  elsif new.status is distinct from old.status then
    if old.status = 'draft' and new.status not in ('draft', 'submitted') then
      raise exception 'draft results must be submitted before approval';
    elsif old.status = 'submitted' and new.status not in ('submitted', 'approved', 'draft') then
      raise exception 'submitted results must be approved before publication';
    elsif old.status = 'approved' and new.status not in ('approved', 'published', 'draft') then
      raise exception 'approved results may only be published or returned to draft';
    elsif old.status = 'published' and new.status not in ('published', 'draft') then
      raise exception 'published results may only be returned to draft for correction';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved', 'published') and not is_admin_of(new.school_id) then
    raise exception 'only a school admin may approve or publish results';
  end if;

  -- Editing a reviewed/published score always reopens the result as draft.
  if tg_op = 'UPDATE' and new.score is distinct from old.score
     and old.status in ('approved', 'published') then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
    new.published_at := null;
  end if;

  new.published := (new.status = 'published');
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  if new.status <> 'published' then new.published_at := null; end if;

  if tg_op = 'UPDATE' and (new.status is distinct from old.status or new.score is distinct from old.score) then
    insert into result_history (
      school_id, result_id, student_id, old_status, new_status, old_score, new_score, changed_by
    ) values (
      new.school_id, new.id, new.student_id, old.status, new.status, old.score, new.score, auth.uid()
    );
  end if;
  return new;
end $$;
revoke all on function phase5_guard_results_workflow() from public, anon, authenticated;

create or replace function submit_results(p_school uuid, p_exam uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_exam exams; v_n integer;
begin
  select * into v_exam from exams where id = p_exam and school_id = p_school;
  if v_exam.id is null then raise exception 'exam belongs to another school'; end if;
  if not (is_admin_of(p_school) or phase5_teacher_assigned_pair(p_school, v_exam.class_id, v_exam.subject_id)) then
    raise exception 'not authorized to submit these results';
  end if;
  with upd as (
    update results set status = 'submitted', submitted_at = now()
    where exam_id = p_exam and school_id = p_school and status = 'draft'
    returning 1
  ) select count(*) into v_n from upd;
  return coalesce(v_n, 0);
end $$;
revoke all on function submit_results(uuid, uuid) from public, anon;
grant execute on function submit_results(uuid, uuid) to authenticated;

create or replace function approve_results(p_school uuid, p_exam uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may approve results'; end if;
  if not exists (select 1 from exams where id = p_exam and school_id = p_school) then
    raise exception 'exam belongs to another school';
  end if;
  with upd as (
    update results
      set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where exam_id = p_exam and school_id = p_school and status = 'submitted'
    returning 1
  ) select count(*) into v_n from upd;
  return coalesce(v_n, 0);
end $$;
revoke all on function approve_results(uuid, uuid) from public, anon;
grant execute on function approve_results(uuid, uuid) to authenticated;

-- -------------------------------------------------------------------------
-- Attendance: exact enrollment binding, immutable session/record identity, and
-- no direct Teacher mutation of Phase 5 rows (the atomic RPC is the writer).
-- -------------------------------------------------------------------------
create or replace function phase5_guard_attendance_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (
    new.school_id is distinct from old.school_id
    or new.class_id is distinct from old.class_id
    or new.stream_id is distinct from old.stream_id
    or new.session_date is distinct from old.session_date
    or new.period_id is distinct from old.period_id
  ) then raise exception 'attendance session identity fields are immutable'; end if;

  if not exists (select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;
  if new.subject_id is not null and not exists (
    select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id
  ) then raise exception 'subject belongs to another school'; end if;
  if new.period_id is not null and not exists (
    select 1 from timetable_periods p where p.id = new.period_id and p.school_id = new.school_id
  ) then raise exception 'period belongs to another school'; end if;
  if new.timetable_entry_id is not null and not exists (
    select 1 from timetable_entries e
    where e.id = new.timetable_entry_id and e.school_id = new.school_id
      and e.class_id = new.class_id
      and (new.stream_id is null or e.stream_id = new.stream_id)
      and (new.subject_id is null or e.subject_id = new.subject_id)
      and (new.period_id is null or e.period_id = new.period_id)
  ) then raise exception 'timetable entry does not match the selected attendance session'; end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another school'; end if;
  if new.term_id is not null and not exists (
    select 1 from terms t where t.id = new.term_id and t.school_id = new.school_id
      and (new.academic_year_id is null or t.academic_year_id = new.academic_year_id)
  ) then raise exception 'term does not belong to the selected academic year'; end if;
  if not is_admin_of(new.school_id) and not is_teacher_of_class(new.class_id) then
    raise exception 'this teacher is not assigned to the selected class';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_sessions() from public, anon, authenticated;

create or replace function phase5_guard_attendance_records()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_session attendance_sessions;
  v_enrollment uuid;
begin
  select * into v_session from attendance_sessions where id = new.session_id;
  if v_session.id is null then raise exception 'attendance session was not found'; end if;
  if tg_op = 'UPDATE' and (
    new.school_id is distinct from old.school_id
    or new.session_id is distinct from old.session_id
    or new.student_id is distinct from old.student_id
  ) then raise exception 'attendance record identity fields are immutable'; end if;
  if v_session.school_id is distinct from new.school_id then
    raise exception 'attendance record belongs to another school than its session';
  end if;
  if not exists (select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;

  select e.id into v_enrollment
  from student_enrollments e
  where e.student_id = new.student_id
    and e.school_id = new.school_id
    and e.class_id = v_session.class_id
    and (v_session.stream_id is null or e.stream_id = v_session.stream_id)
    and e.enrolled_on <= v_session.session_date
    and (e.ended_on is null or e.ended_on >= v_session.session_date)
  order by e.enrolled_on desc limit 1;
  if v_enrollment is null then
    raise exception 'this student was not enrolled in the selected class and stream on that date';
  end if;
  new.enrollment_id := v_enrollment;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.corrected_by := auth.uid();
    new.corrected_at := now();
    insert into attendance_record_history (
      school_id, record_id, student_id, old_status, new_status, reason, changed_by
    ) values (
      new.school_id, new.id, new.student_id, old.status, new.status, new.reason, auth.uid()
    );
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_records() from public, anon, authenticated;

-- Phase 5 Teacher reads assigned data; writes only through the validated RPC.
drop policy if exists "teacher manages assigned class sessions" on attendance_sessions;
drop policy if exists "teacher manages assigned class records" on attendance_records;
drop policy if exists "teacher reads assigned class history" on attendance_record_history;
drop policy if exists "teacher reads assigned class sessions" on attendance_sessions;
drop policy if exists "teacher reads assigned class records" on attendance_records;
create policy "teacher reads assigned class sessions" on attendance_sessions
  for select using (is_teacher_of_class(class_id));
create policy "teacher reads assigned class records" on attendance_records
  for select using (is_teacher_of_class(attendance_session_class(session_id)));
create policy "teacher reads assigned class history" on attendance_record_history
  for select using (exists (
    select 1 from attendance_records r
    where r.id = attendance_record_history.record_id
      and is_teacher_of_class(attendance_session_class(r.session_id))
  ));

-- Tighten the legacy one-row-per-day attendance table too, preserving writes
-- for assigned Teachers while removing school-wide Teacher access.
drop policy if exists "staff read attendance" on attendance;
drop policy if exists "staff write attendance" on attendance;
drop policy if exists "admins manage legacy attendance" on attendance;
drop policy if exists "teacher reads assigned legacy attendance" on attendance;
drop policy if exists "teacher writes assigned legacy attendance" on attendance;
drop policy if exists "teacher updates assigned legacy attendance" on attendance;
create policy "admins manage legacy attendance" on attendance
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "teacher reads assigned legacy attendance" on attendance
  for select using (is_teacher_of_class(class_id));
create policy "teacher writes assigned legacy attendance" on attendance
  for insert with check (is_teacher_of_class(class_id));
create policy "teacher updates assigned legacy attendance" on attendance
  for update using (is_teacher_of_class(class_id)) with check (is_teacher_of_class(class_id));

-- -------------------------------------------------------------------------
-- Finance: Teachers must never receive school-wide payment/billing access.
-- -------------------------------------------------------------------------
drop policy if exists "finance staff read payments" on payments;
drop policy if exists "finance staff write payments" on payments;
drop policy if exists "finance team manages payments" on payments;
create policy "finance team manages payments" on payments
  for all using (
    is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant')
  ) with check (
    is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant')
  );

drop policy if exists "finance staff read billing" on billing_records;
drop policy if exists "finance staff write billing" on billing_records;
drop policy if exists "finance team manages billing" on billing_records;
create policy "finance team manages billing" on billing_records
  for all using (
    is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant')
  ) with check (
    is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant')
  );

-- -------------------------------------------------------------------------
-- Identifier login: case-insensitive identifiers and hashed-IP rate limiting.
-- -------------------------------------------------------------------------
do $$
begin
  if exists (
    select school_id, upper(trim(student_id))
    from students
    where student_id is not null
    group by school_id, upper(trim(student_id))
    having count(*) > 1
  ) then
    raise exception 'duplicate case-insensitive Student IDs exist within a school; run the final preflight';
  end if;
end $$;
create unique index if not exists students_student_id_ci_unique
  on students (school_id, upper(trim(student_id))) where student_id is not null;

create or replace function resolve_login_email(p_school_code text, p_student_id text, p_kind text)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_school uuid;
  v_student uuid;
  v_profile uuid;
  v_email text;
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if nullif(trim(coalesce(p_school_code, '')), '') is null
     or nullif(trim(coalesce(p_student_id, '')), '') is null then return null; end if;
  select id into v_school from schools where upper(trim(login_code)) = upper(trim(p_school_code));
  if v_school is null then return null; end if;

  select id into v_student
  from students
  where school_id = v_school
    and upper(trim(student_id)) = upper(trim(p_student_id))
    and status = 'active';
  if v_student is null then return null; end if;

  if v_kind = 'student' then
    select profile_id into v_profile from students where id = v_student;
  elsif v_kind = 'parent' then
    select p.profile_id into v_profile
    from student_parents sp
    join parents p on p.id = sp.parent_id and p.school_id = v_school
    where sp.student_id = v_student
      and sp.is_primary = true
      and p.status = 'active'
      and p.profile_id is not null
    order by sp.id asc limit 1;
  else return null;
  end if;

  if v_profile is null then return null; end if;
  select email into v_email from auth.users where id = v_profile;
  return v_email;
end $$;
revoke all on function resolve_login_email(text, text, text) from public, anon, authenticated;
grant execute on function resolve_login_email(text, text, text) to service_role;

create or replace function is_login_locked(p_school_code text, p_identifier text, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 5
  from login_attempts
  where kind = lower(trim(p_kind))
    and upper(trim(school_code)) = upper(trim(p_school_code))
    and upper(trim(identifier)) = upper(trim(p_identifier))
    and succeeded = false
    and created_at > now() - interval '15 minutes'
$$;
revoke all on function is_login_locked(text, text, text) from public, anon, authenticated;
grant execute on function is_login_locked(text, text, text) to service_role;

create or replace function is_login_ip_locked(p_ip_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) >= 20
  from login_attempts
  where ip = p_ip_hash and succeeded = false
    and created_at > now() - interval '15 minutes'
$$;
revoke all on function is_login_ip_locked(text) from public, anon, authenticated;
grant execute on function is_login_ip_locked(text) to service_role;

create or replace function record_login_attempt(
  p_school_code text,
  p_identifier text,
  p_kind text,
  p_success boolean,
  p_ip text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  insert into login_attempts (school_code, identifier, kind, ip, succeeded)
  values (
    upper(trim(p_school_code)), upper(trim(p_identifier)), lower(trim(p_kind)),
    p_ip, coalesce(p_success, false)
  );
  select id into v_school from schools where upper(trim(login_code)) = upper(trim(p_school_code));
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (
    v_school, null,
    case when p_success then 'auth.identifier_login.success' else 'auth.identifier_login.failure' end,
    'login_attempts', null,
    jsonb_build_object('kind', lower(trim(p_kind)), 'school_code', upper(trim(p_school_code)))
  );
end $$;
revoke all on function record_login_attempt(text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function record_login_attempt(text, text, text, boolean, text) to service_role;

commit;
