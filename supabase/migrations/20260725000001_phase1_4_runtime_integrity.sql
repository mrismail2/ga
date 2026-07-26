-- Kobciye Phase 1–4 final runtime/data-integrity corrections.
-- This migration does not add Phase 5 features and does not reset data.

begin;

-- Preflight: do not install stricter guards over already-inconsistent rows.
-- Nothing is deleted or rewritten automatically; the error names the category
-- so an administrator can inspect the affected rows safely.
do $$
begin
  if exists (
    select 1
    from student_enrollments e
    left join students s on s.id = e.student_id and s.school_id = e.school_id
    left join classes c on c.id = e.class_id and c.school_id = e.school_id
    left join academic_years y on y.id = e.academic_year_id and y.school_id = e.school_id
    left join class_streams st on st.id = e.stream_id and st.school_id = e.school_id
      and st.class_id = e.class_id
    where e.status = 'active' and (
      e.class_id is null or e.academic_year_id is null or s.id is null or
      c.id is null or y.id is null or
      (c.academic_year_id is not null and c.academic_year_id is distinct from e.academic_year_id) or
      (e.stream_id is not null and st.id is null)
    )
  ) then
    raise exception 'existing active student_enrollments contain invalid class/year/school/stream relationships';
  end if;

  if exists (
    select 1
    from teacher_assignments a
    left join teachers t on t.id = a.teacher_id and t.school_id = a.school_id
    left join subjects s on s.id = a.subject_id and s.school_id = a.school_id
    left join classes c on c.id = a.class_id and c.school_id = a.school_id
    left join academic_years y on y.id = a.academic_year_id and y.school_id = a.school_id
    left join class_streams st on st.id = a.stream_id and st.school_id = a.school_id
      and st.class_id = a.class_id
    left join terms tm on tm.id = a.term_id and tm.school_id = a.school_id
    where t.id is null or s.id is null or c.id is null or y.id is null or
      (s.class_id is not null and s.class_id is distinct from a.class_id) or
      (c.academic_year_id is not null and c.academic_year_id is distinct from a.academic_year_id) or
      (a.stream_id is not null and st.id is null) or
      (a.term_id is not null and (tm.id is null or
        (tm.academic_year_id is not null and tm.academic_year_id is distinct from a.academic_year_id)))
  ) then
    raise exception 'existing teacher_assignments contain invalid school/class/year/stream/term relationships';
  end if;

  if exists (select 1 from admissions where status = 'enrolled' and student_id is null) then
    raise exception 'existing enrolled admissions are missing student_id';
  end if;
end
$$;

-- 1) Active enrollment relational integrity.
create or replace function phase4_guard_student_enrollments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_year uuid;
begin
  if new.status = 'active' and new.class_id is null then
    raise exception 'active enrollment requires a class';
  end if;
  if new.status = 'active' and new.academic_year_id is null then
    raise exception 'active enrollment requires an academic year';
  end if;

  if not exists (select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;

  if new.class_id is not null then
    select c.academic_year_id into v_class_year
      from classes c where c.id = new.class_id and c.school_id = new.school_id;
    if not found then raise exception 'class belongs to another school'; end if;
  end if;

  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic_year belongs to another school'; end if;

  if new.status = 'active' and v_class_year is not null and v_class_year is distinct from new.academic_year_id then
    raise exception 'class does not belong to the selected academic year';
  end if;

  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;

  return new;
end
$$;
revoke all on function phase4_guard_student_enrollments() from public, anon, authenticated;

-- 2) Teacher assignment pair integrity.
create or replace function phase4_guard_teacher_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_class uuid;
  v_class_year uuid;
  v_term_year uuid;
begin
  if not exists (select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id) then
    raise exception 'teacher belongs to another school';
  end if;

  select s.class_id into v_subject_class
    from subjects s where s.id = new.subject_id and s.school_id = new.school_id;
  if not found then raise exception 'subject belongs to another school'; end if;

  select c.academic_year_id into v_class_year
    from classes c where c.id = new.class_id and c.school_id = new.school_id;
  if not found then raise exception 'class belongs to another school'; end if;

  -- A school-wide subject (class_id NULL) may be assigned to any class; a
  -- class-scoped subject may only be paired with that exact class.
  if v_subject_class is not null and v_subject_class is distinct from new.class_id then
    raise exception 'subject does not belong to the selected class';
  end if;

  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;

  if not exists (
    select 1 from academic_years y where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic_year belongs to another school'; end if;

  if v_class_year is not null and v_class_year is distinct from new.academic_year_id then
    raise exception 'class does not belong to the selected academic year';
  end if;

  if new.term_id is not null then
    select tm.academic_year_id into v_term_year
      from terms tm where tm.id = new.term_id and tm.school_id = new.school_id;
    if not found then raise exception 'term belongs to another school'; end if;
    if v_term_year is not null and v_term_year is distinct from new.academic_year_id then
      raise exception 'term does not belong to the selected academic year';
    end if;
  end if;
  return new;
end
$$;
revoke all on function phase4_guard_teacher_assignments() from public, anon, authenticated;

-- 3) Admission state integrity. Once an admission is enrolled it stays
-- linked to that student; a generic edit cannot silently downgrade the row
-- while the active student/enrollment remain in place.
create or replace function phase4_guard_admissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.desired_class_id is not null and not exists (
    select 1 from classes c where c.id = new.desired_class_id and c.school_id = new.school_id
  ) then raise exception 'class belongs to another school'; end if;

  if new.student_id is not null and not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id
  ) then raise exception 'student belongs to another school'; end if;

  if new.status = 'enrolled' and new.student_id is null then
    raise exception 'enrolled admission requires a student';
  end if;

  if tg_op = 'UPDATE' and (old.status = 'enrolled' or old.student_id is not null)
     and new.status is distinct from 'enrolled' then
    raise exception 'an enrolled admission cannot be downgraded';
  end if;

  if tg_op = 'UPDATE' and old.student_id is not null and new.student_id is distinct from old.student_id then
    raise exception 'admission student identity is immutable once enrolled';
  end if;
  return new;
end
$$;
revoke all on function phase4_guard_admissions() from public, anon, authenticated;

-- 4) Student editor RPC: student + active enrollment, but NO admission row.
create or replace function save_student_with_enrollment_atomic(
  p_school uuid,
  p_student_id uuid default null,
  p_full_name text default null,
  p_gender text default null,
  p_date_of_birth date default null,
  p_admission_number text default null,
  p_class_id uuid default null,
  p_stream_id uuid default null,
  p_academic_year_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_enrollment uuid;
  v_old_class uuid;
  v_old_stream uuid;
  v_old_year uuid;
  v_name text := nullif(trim(coalesce(p_full_name, '')), '');
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may save a student'; end if;
  if is_university_institution(p_school) then raise exception 'save_student_with_enrollment_atomic is a School Mode operation'; end if;
  if v_name is null then raise exception 'student name is required'; end if;
  if p_class_id is null then raise exception 'active enrollment requires a class'; end if;
  if p_academic_year_id is null then raise exception 'active enrollment requires an academic year'; end if;

  if not exists (select 1 from classes c where c.id = p_class_id and c.school_id = p_school) then
    raise exception 'class belongs to another school';
  end if;
  if not exists (select 1 from academic_years y where y.id = p_academic_year_id and y.school_id = p_school) then
    raise exception 'academic_year belongs to another school';
  end if;
  if p_stream_id is not null and not exists (
    select 1 from class_streams st where st.id = p_stream_id and st.school_id = p_school and st.class_id = p_class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;
  if exists (
    select 1 from classes c where c.id = p_class_id and c.academic_year_id is not null
      and c.academic_year_id is distinct from p_academic_year_id
  ) then raise exception 'class does not belong to the selected academic year'; end if;

  if p_student_id is null then
    insert into students (
      school_id, class_id, stream_id, academic_year_id, full_name, gender,
      date_of_birth, admission_number, student_id, status
    ) values (
      p_school, p_class_id, p_stream_id, p_academic_year_id, v_name,
      nullif(trim(coalesce(p_gender, '')), ''), p_date_of_birth,
      nullif(trim(coalesce(p_admission_number, '')), ''), '', 'active'
    ) returning id into v_student;
  else
    select id into v_student from students where id = p_student_id and school_id = p_school for update;
    if v_student is null then raise exception 'student belongs to another school'; end if;
    update students set
      full_name = v_name,
      gender = nullif(trim(coalesce(p_gender, '')), ''),
      date_of_birth = p_date_of_birth,
      admission_number = nullif(trim(coalesce(p_admission_number, '')), ''),
      class_id = p_class_id,
      stream_id = p_stream_id,
      academic_year_id = p_academic_year_id,
      status = 'active'
    where id = v_student;
  end if;

  select id, class_id, stream_id, academic_year_id
    into v_enrollment, v_old_class, v_old_stream, v_old_year
    from student_enrollments
    where student_id = v_student and status = 'active'
    for update;

  if v_enrollment is null then
    insert into student_enrollments (school_id, student_id, class_id, stream_id, academic_year_id, status)
      values (p_school, v_student, p_class_id, p_stream_id, p_academic_year_id, 'active')
      returning id into v_enrollment;
  elsif v_old_class is distinct from p_class_id
     or v_old_stream is distinct from p_stream_id
     or v_old_year is distinct from p_academic_year_id then
    update student_enrollments set status = 'transferred', ended_on = current_date where id = v_enrollment;
    insert into student_enrollments (school_id, student_id, class_id, stream_id, academic_year_id, status)
      values (p_school, v_student, p_class_id, p_stream_id, p_academic_year_id, 'active')
      returning id into v_enrollment;
  end if;

  return jsonb_build_object('student_id', v_student, 'enrollment_id', v_enrollment);
end
$$;
revoke all on function save_student_with_enrollment_atomic(uuid, uuid, text, text, date, text, uuid, uuid, uuid) from public, anon;
grant execute on function save_student_with_enrollment_atomic(uuid, uuid, text, text, date, text, uuid, uuid, uuid) to authenticated;

-- 5) Admission RPC retry/edit hardening. Signature stays unchanged.
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
  v_student uuid; v_enrollment uuid; v_old_class uuid; v_old_stream uuid; v_old_year uuid;
  v_target_stream uuid; v_admission uuid; v_parent uuid; v_link uuid;
  v_name text := nullif(trim(coalesce(p_applicant_name, '')), '');
  v_guardian_name text := nullif(trim(coalesce(p_guardian_name, '')), '');
  v_guardian_phone text := nullif(trim(coalesce(p_guardian_phone, '')), '');
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may enrol a student'; end if;
  if is_university_institution(p_school) then raise exception 'admit_student_atomic is a School Mode operation'; end if;
  if v_name is null then raise exception 'applicant name is required'; end if;
  if p_parent_id is null and ((v_guardian_name is null) <> (v_guardian_phone is null)) then
    raise exception 'new guardian requires both name and phone';
  end if;
  if p_class_id is null then raise exception 'active enrollment requires a class'; end if;
  if p_academic_year_id is null then raise exception 'active enrollment requires an academic year'; end if;
  if not exists (select 1 from classes c where c.id=p_class_id and c.school_id=p_school) then raise exception 'class belongs to another school'; end if;
  if not exists (select 1 from academic_years y where y.id=p_academic_year_id and y.school_id=p_school) then raise exception 'academic_year belongs to another school'; end if;
  if p_stream_id is not null and not exists (select 1 from class_streams st where st.id=p_stream_id and st.school_id=p_school and st.class_id=p_class_id) then raise exception 'stream does not belong to the selected class'; end if;
  if exists (select 1 from classes c where c.id=p_class_id and c.academic_year_id is not null and c.academic_year_id is distinct from p_academic_year_id) then raise exception 'class does not belong to the selected academic year'; end if;

  if p_student_id is not null then
    select id into v_student from students where id=p_student_id and school_id=p_school for update;
    if v_student is null then raise exception 'student belongs to another school'; end if;
    update students set full_name=v_name,
      gender=coalesce(nullif(trim(coalesce(p_gender,'')),''),gender),
      date_of_birth=coalesce(p_date_of_birth,date_of_birth),
      admission_number=coalesce(nullif(trim(coalesce(p_admission_number,'')),''),admission_number),
      class_id=p_class_id, academic_year_id=p_academic_year_id,
      stream_id=p_stream_id, status='active'
    where id=v_student;
  else
    insert into students (school_id,class_id,stream_id,academic_year_id,full_name,gender,date_of_birth,admission_number,student_id,status)
    values (p_school,p_class_id,p_stream_id,p_academic_year_id,v_name,p_gender,p_date_of_birth,nullif(trim(coalesce(p_admission_number,'')),''),'','active')
    returning id into v_student;
  end if;

  select id,class_id,stream_id,academic_year_id into v_enrollment,v_old_class,v_old_stream,v_old_year
    from student_enrollments where student_id=v_student and status='active' for update;
  v_target_stream := p_stream_id;
  if v_enrollment is null then
    insert into student_enrollments (school_id,student_id,class_id,stream_id,academic_year_id,status)
      values (p_school,v_student,p_class_id,p_stream_id,p_academic_year_id,'active') returning id into v_enrollment;
  elsif v_old_class is distinct from p_class_id or v_old_stream is distinct from v_target_stream or v_old_year is distinct from p_academic_year_id then
    update student_enrollments set status='transferred',ended_on=current_date where id=v_enrollment;
    insert into student_enrollments (school_id,student_id,class_id,stream_id,academic_year_id,status)
      values (p_school,v_student,p_class_id,v_target_stream,p_academic_year_id,'active') returning id into v_enrollment;
  end if;

  if p_admission_id is not null then
    update admissions set student_id=v_student, applicant_name=v_name,
      guardian_name=coalesce(v_guardian_name,guardian_name), guardian_phone=coalesce(v_guardian_phone,guardian_phone),
      desired_class_id=p_class_id,status='enrolled'
      where id=p_admission_id and school_id=p_school returning id into v_admission;
    if v_admission is null then raise exception 'admission belongs to another school'; end if;
  else
    select id into v_admission from admissions
      where school_id=p_school and student_id=v_student and status='enrolled'
      order by created_at desc limit 1 for update;
    if v_admission is null then
      insert into admissions (school_id,student_id,applicant_name,guardian_name,guardian_phone,desired_class_id,status)
      values (p_school,v_student,v_name,v_guardian_name,v_guardian_phone,p_class_id,'enrolled') returning id into v_admission;
    else
      update admissions set applicant_name=v_name,
        guardian_name=coalesce(v_guardian_name,guardian_name), guardian_phone=coalesce(v_guardian_phone,guardian_phone),
        desired_class_id=p_class_id where id=v_admission;
    end if;
  end if;

  if p_parent_id is not null then
    select id into v_parent from parents where id=p_parent_id and school_id=p_school;
    if v_parent is null then raise exception 'guardian belongs to another school'; end if;
  elsif v_guardian_name is not null and v_guardian_phone is not null then
    select id into v_parent from parents where school_id=p_school and lower(full_name)=lower(v_guardian_name) and phone=v_guardian_phone limit 1;
    if v_parent is null then
      insert into parents (school_id,full_name,phone,email)
        values (p_school,v_guardian_name,v_guardian_phone,nullif(trim(coalesce(p_guardian_email,'')),''))
        returning id into v_parent;
    else
      -- A retry/reuse may add an email that was not present originally,
      -- without creating a duplicate guardian directory row.
      update parents set email = coalesce(nullif(trim(coalesce(p_guardian_email,'')),''), email)
        where id = v_parent;
    end if;
  end if;

  if v_parent is not null then
    select id into v_link from student_parents where parent_id=v_parent and student_id=v_student limit 1;
    if v_link is null then
      insert into student_parents (parent_id,student_id,relationship,is_primary)
      values (v_parent,v_student,nullif(trim(coalesce(p_relationship,'')),''),coalesce(p_is_primary,false) and not exists (select 1 from student_parents x where x.student_id=v_student and x.is_primary))
      returning id into v_link;
    else
      -- Idempotent retry: update metadata on the existing link rather than
      -- throwing or duplicating it. Promote it to primary only when that does
      -- not conflict with another primary guardian for the student.
      update student_parents set
        relationship = coalesce(nullif(trim(coalesce(p_relationship,'')),''), relationship),
        is_primary = case
          when coalesce(p_is_primary,false) and not exists (
            select 1 from student_parents x
            where x.student_id=v_student and x.id<>v_link and x.is_primary
          ) then true
          else is_primary
        end
      where id=v_link;
    end if;
  end if;

  return jsonb_build_object('student_id',v_student,'enrollment_id',v_enrollment,'admission_id',v_admission,'parent_id',v_parent,'link_id',v_link);
end
$$;
revoke all on function admit_student_atomic(uuid,text,text,date,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,boolean) from public,anon;
grant execute on function admit_student_atomic(uuid,text,text,date,text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text,boolean) to authenticated;

commit;
