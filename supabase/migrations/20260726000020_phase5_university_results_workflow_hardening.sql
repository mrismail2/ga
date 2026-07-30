-- ============================================================================
-- Kobciye Phase 5 — University result workflow hardening
--
-- Completes lecturer roster visibility, safe result upsert/status transitions,
-- automatic grade/GPA values and role-specific read access. No row is deleted.
-- ============================================================================
begin;

-- Credit hours can legitimately contain halves (e.g. 3.5).
alter table course_results
  alter column credit_hours type numeric(4,1) using credit_hours::numeric;
alter table transcripts
  alter column total_credits type numeric(8,1) using total_credits::numeric;

create or replace function phase5_lecturer_teaches_course(p_school uuid, p_course uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from course_lecturers cl
    join lecturers l on l.id = cl.lecturer_id
    where cl.school_id = p_school and cl.course_id = p_course
      and cl.is_active and l.profile_id = auth.uid() and l.status = 'active'
  )
$$;
revoke all on function phase5_lecturer_teaches_course(uuid,uuid) from public, anon;
grant execute on function phase5_lecturer_teaches_course(uuid,uuid) to authenticated;

create or replace function university_grade_point_for_score(p_score numeric)
returns numeric language sql immutable set search_path = public as $$
  select case
    when p_score is null then null
    when p_score >= 80 then 4.0
    when p_score >= 70 then 3.0
    when p_score >= 60 then 2.0
    when p_score >= 50 then 1.0
    else 0.0
  end::numeric
$$;
revoke all on function university_grade_point_for_score(numeric) from public;
grant execute on function university_grade_point_for_score(numeric) to authenticated;

create or replace function phase5_guard_course_enrollments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_university_institution(new.school_id) then
    raise exception 'course enrollment is a University Mode operation';
  end if;
  if not exists (
    select 1 from university_students u
    where u.id = new.university_student_id and u.school_id = new.school_id
  ) then raise exception 'university student belongs to another institution'; end if;
  if not exists (
    select 1 from courses c where c.id = new.course_id and c.school_id = new.school_id and c.is_active
  ) then raise exception 'course belongs to another institution or is inactive'; end if;
  if new.semester_id is not null and not exists (
    select 1 from semesters s
    where s.id = new.semester_id and s.school_id = new.school_id
      and (new.academic_year_id is null or s.academic_year_id = new.academic_year_id)
  ) then raise exception 'semester does not belong to the selected academic year'; end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another institution'; end if;
  if tg_op = 'UPDATE' and (
    new.school_id is distinct from old.school_id
    or new.university_student_id is distinct from old.university_student_id
    or new.course_id is distinct from old.course_id
    or new.semester_id is distinct from old.semester_id
    or new.academic_year_id is distinct from old.academic_year_id
  ) then raise exception 'course enrollment identity fields are immutable'; end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;
revoke all on function phase5_guard_course_enrollments() from public, anon, authenticated;

create or replace function phase5_guard_course_results()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_enrollment course_enrollments;
  v_credit numeric(4,1);
  v_role text := my_role();
begin
  if not is_university_institution(new.school_id) then
    raise exception 'course result is a University Mode operation';
  end if;
  select * into v_enrollment from course_enrollments e
  where e.id = new.course_enrollment_id and e.school_id = new.school_id;
  if v_enrollment.id is null
     or v_enrollment.university_student_id is distinct from new.university_student_id
     or v_enrollment.course_id is distinct from new.course_id
     or v_enrollment.status = 'withdrawn' then
    raise exception 'course result does not match an eligible enrollment';
  end if;
  if new.semester_id is distinct from v_enrollment.semester_id then
    raise exception 'course result semester must match the enrollment';
  end if;
  if new.score is not null and (new.score < 0 or new.score > 100) then
    raise exception 'course result score must be between 0 and 100';
  end if;

  if tg_op = 'UPDATE' then
    if new.school_id is distinct from old.school_id
       or new.course_enrollment_id is distinct from old.course_enrollment_id
       or new.university_student_id is distinct from old.university_student_id
       or new.course_id is distinct from old.course_id
       or new.semester_id is distinct from old.semester_id then
      raise exception 'course result identity fields are immutable';
    end if;
    if old.status = 'published' and row(new.score,new.grade,new.grade_point,new.credit_hours,new.status)
       is distinct from row(old.score,old.grade,old.grade_point,old.credit_hours,old.status) then
      raise exception 'a published course result is immutable';
    end if;
  end if;

  if not is_admin_of(new.school_id) then
    if not phase5_lecturer_teaches_course(new.school_id,new.course_id) then
      raise exception 'lecturer is not assigned to this course';
    end if;
    if tg_op = 'UPDATE' and old.status not in ('draft','submitted') then
      raise exception 'lecturer cannot change an approved or published result';
    end if;
    if new.status not in ('draft','submitted') then
      raise exception 'lecturer may only save a draft or submit a result';
    end if;
  end if;

  if new.status in ('submitted','approved','published') and new.score is null then
    raise exception 'a scored result is required before workflow submission';
  end if;

  select c.credit_hours into v_credit from courses c
  where c.id = new.course_id and c.school_id = new.school_id;
  new.credit_hours := v_credit;
  new.grade := grade_for_percentage(new.school_id,new.score);
  new.grade_point := university_grade_point_for_score(new.score);
  if new.entered_by is null or not is_admin_of(new.school_id) then new.entered_by := auth.uid(); end if;
  if new.status = 'approved' then new.approved_by := auth.uid(); end if;
  if new.status = 'published' then
    new.approved_by := coalesce(new.approved_by,auth.uid());
    new.published_at := coalesce(new.published_at,now());
  elsif tg_op = 'UPDATE' and old.status <> 'published' then
    new.published_at := null;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_course_results() from public, anon, authenticated;

-- Replace the lecturer FOR ALL policy: no direct delete and no approval or
-- publication. The trigger and RPCs independently enforce the workflow.
drop policy if exists "lecturer manages own course results" on course_results;
drop policy if exists "lecturer reads own course results" on course_results;
drop policy if exists "lecturer creates own course results" on course_results;
drop policy if exists "lecturer updates own course results" on course_results;
create policy "lecturer reads own course results" on course_results
  for select using (phase5_lecturer_teaches_course(school_id,course_id));
create policy "lecturer creates own course results" on course_results
  for insert with check (
    phase5_lecturer_teaches_course(school_id,course_id) and status = 'draft'
  );
create policy "lecturer updates own course results" on course_results
  for update using (
    phase5_lecturer_teaches_course(school_id,course_id) and status in ('draft','submitted')
  ) with check (
    phase5_lecturer_teaches_course(school_id,course_id) and status in ('draft','submitted')
  );

-- A lecturer needs the roster only for courses they teach. A university
-- student may read the course rows behind their own enrollment/result.
drop policy if exists "lecturer reads own course enrollments" on course_enrollments;
create policy "lecturer reads own course enrollments" on course_enrollments
  for select using (phase5_lecturer_teaches_course(school_id,course_id));
drop policy if exists "uni student reads enrolled courses" on courses;
create policy "uni student reads enrolled courses" on courses
  for select using (exists (
    select 1 from course_enrollments ce
    where ce.course_id = courses.id and is_self_university_student(ce.university_student_id)
  ));
drop policy if exists "uni student reads own directory row" on university_students;
create policy "uni student reads own directory row" on university_students
  for select using (is_self_university_student(id));

-- Server-controlled result save. It derives all identity and grading columns;
-- the client never supplies entered_by, grade or grade_point.
create or replace function upsert_course_result(
  p_school uuid,
  p_enrollment uuid,
  p_score numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_enrollment course_enrollments;
  v_id uuid;
begin
  select * into v_enrollment from course_enrollments
  where id = p_enrollment and school_id = p_school for share;
  if v_enrollment.id is null or v_enrollment.status = 'withdrawn' then
    raise exception 'eligible course enrollment was not found';
  end if;
  if not (is_admin_of(p_school) or phase5_lecturer_teaches_course(p_school,v_enrollment.course_id)) then
    raise exception 'not authorized to enter this course result';
  end if;
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'score must be between 0 and 100';
  end if;

  insert into course_results(
    school_id,course_enrollment_id,university_student_id,course_id,semester_id,
    score,status,entered_by
  ) values (
    p_school,v_enrollment.id,v_enrollment.university_student_id,v_enrollment.course_id,
    v_enrollment.semester_id,p_score,'draft',auth.uid()
  )
  on conflict(course_enrollment_id) do update
    set score=excluded.score,
        status='draft',
        entered_by=auth.uid(),
        approved_by=null,
        published_at=null
    where course_results.status in ('draft','submitted')
  returning id into v_id;
  if v_id is null then raise exception 'approved or published result cannot be edited'; end if;
  return v_id;
end $$;
revoke all on function upsert_course_result(uuid,uuid,numeric) from public, anon;
grant execute on function upsert_course_result(uuid,uuid,numeric) to authenticated;

create or replace function transition_course_result(
  p_school uuid,
  p_result uuid,
  p_status text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_row course_results;
  v_next text := lower(trim(coalesce(p_status,'')));
begin
  select * into v_row from course_results
  where id = p_result and school_id = p_school for update;
  if v_row.id is null then raise exception 'course result belongs to another institution'; end if;

  if v_next = 'submitted' then
    if v_row.status <> 'draft' then raise exception 'only a draft result can be submitted'; end if;
    if not (is_admin_of(p_school) or phase5_lecturer_teaches_course(p_school,v_row.course_id)) then
      raise exception 'not authorized to submit this result';
    end if;
  elsif v_next = 'approved' then
    if not is_admin_of(p_school) or v_row.status <> 'submitted' then
      raise exception 'only a university admin may approve a submitted result';
    end if;
  elsif v_next = 'published' then
    if not is_admin_of(p_school) or v_row.status <> 'approved' then
      raise exception 'only a university admin may publish an approved result';
    end if;
  else
    raise exception 'invalid course result transition';
  end if;

  update course_results set status=v_next where id=v_row.id;
  return v_row.id;
end $$;
revoke all on function transition_course_result(uuid,uuid,text) from public, anon;
grant execute on function transition_course_result(uuid,uuid,text) to authenticated;

-- Empty transcripts are misleading; snapshot only real published results.
create or replace function issue_transcript(
  p_school uuid,
  p_student uuid,
  p_academic_year uuid default null,
  p_semester uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_snapshot jsonb;
  v_gpa numeric;
  v_credits numeric(8,1);
begin
  if not is_university_institution(p_school) then
    raise exception 'transcripts are a University Mode operation';
  end if;
  if not is_admin_of(p_school) then raise exception 'only a university admin may issue a transcript'; end if;
  if not exists (
    select 1 from university_students u where u.id=p_student and u.school_id=p_school
  ) then raise exception 'university student belongs to another institution'; end if;

  select jsonb_agg(jsonb_build_object(
           'course_id',cr.course_id,'course_code',c.code,'course_name',c.name,
           'grade',cr.grade,'score',cr.score,'grade_point',cr.grade_point,
           'credit_hours',cr.credit_hours,'semester_id',cr.semester_id
         ) order by c.code,c.name),
         round(sum(cr.grade_point * coalesce(cr.credit_hours,0))
           / nullif(sum(coalesce(cr.credit_hours,0)),0),2),
         sum(coalesce(cr.credit_hours,0))
    into v_snapshot,v_gpa,v_credits
  from course_results cr
  join courses c on c.id=cr.course_id and c.school_id=cr.school_id
  join course_enrollments ce on ce.id=cr.course_enrollment_id
  where cr.school_id=p_school and cr.university_student_id=p_student
    and cr.status='published'
    and (p_academic_year is null or ce.academic_year_id=p_academic_year)
    and (p_semester is null or cr.semester_id=p_semester);

  if v_snapshot is null or jsonb_array_length(v_snapshot)=0 then
    raise exception 'no published course results exist for this transcript scope';
  end if;

  insert into transcripts(
    school_id,university_student_id,academic_year_id,semester_id,
    gpa,total_credits,snapshot,issued_by
  ) values (
    p_school,p_student,p_academic_year,p_semester,
    v_gpa,coalesce(v_credits,0),v_snapshot,auth.uid()
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function issue_transcript(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function issue_transcript(uuid,uuid,uuid,uuid) to authenticated;

commit;
