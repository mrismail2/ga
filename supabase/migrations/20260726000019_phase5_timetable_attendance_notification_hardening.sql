-- ============================================================================
-- Kobciye Phase 5 — timetable, attendance and notification final hardening
--
-- Additive correction after the delivered Phase 5 migrations. It strengthens
-- exact teacher/year/term/stream relationships, fixes Somali status wording,
-- applies the configured delay to every attendance alert, and makes read_at a
-- one-way recipient action. No user row is deleted.
-- ============================================================================
begin;

-- Exact assignment helper including the optional year/term/stream scope.
create or replace function phase5_teacher_assigned_slot(
  p_school uuid,
  p_class uuid,
  p_subject uuid,
  p_academic_year uuid default null,
  p_term uuid default null,
  p_stream uuid default null
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
      and (p_academic_year is null or a.academic_year_id = p_academic_year)
      and (a.term_id is null or a.term_id = p_term)
      and (a.stream_id is null or a.stream_id = p_stream)
  )
$$;
revoke all on function phase5_teacher_assigned_slot(uuid,uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function phase5_teacher_assigned_slot(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Timetable entries must be coherent all the way through year, term, period,
-- class/stream and the exact active teacher assignment.
create or replace function phase5_guard_timetable_entries()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from academic_years y
    where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another school'; end if;

  if new.term_id is not null and not exists (
    select 1 from terms t
    where t.id = new.term_id and t.school_id = new.school_id
      and (t.academic_year_id is null or t.academic_year_id = new.academic_year_id)
  ) then raise exception 'term does not belong to the selected academic year'; end if;

  if not exists (
    select 1 from classes c
    where c.id = new.class_id and c.school_id = new.school_id
      and (c.academic_year_id is null or c.academic_year_id = new.academic_year_id)
  ) then raise exception 'class belongs to another school or academic year'; end if;

  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id
      and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;

  if not exists (
    select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id
  ) then raise exception 'subject belongs to another school'; end if;

  if not exists (
    select 1 from teachers t where t.id = new.teacher_id and t.school_id = new.school_id
  ) then raise exception 'teacher belongs to another school'; end if;

  if new.period_id is not null then
    if not exists (
      select 1 from timetable_periods p
      where p.id = new.period_id and p.school_id = new.school_id
        and p.is_active and not p.is_break
        and (p.academic_year_id is null or p.academic_year_id = new.academic_year_id)
    ) then raise exception 'period is inactive, a break, or belongs to another year/school'; end if;
    select p.start_time, p.end_time into new.start_time, new.end_time
    from timetable_periods p where p.id = new.period_id;
  end if;

  if exists (
    select 1 from school_days d
    where d.school_id = new.school_id and d.day_of_week = new.day_of_week
      and not d.is_teaching_day
  ) then raise exception 'the selected day is configured as a non-teaching day'; end if;

  if new.teacher_assignment_id is not null then
    if not exists (
      select 1 from teacher_assignments a
      where a.id = new.teacher_assignment_id
        and a.school_id = new.school_id
        and a.teacher_id = new.teacher_id
        and a.subject_id = new.subject_id
        and a.class_id = new.class_id
        and a.academic_year_id = new.academic_year_id
        and a.is_active
        and (a.term_id is null or a.term_id = new.term_id)
        and (a.stream_id is null or a.stream_id = new.stream_id)
    ) then raise exception 'teacher assignment does not match this timetable slot'; end if;
  else
    select a.id into new.teacher_assignment_id
    from teacher_assignments a
    where a.school_id = new.school_id
      and a.teacher_id = new.teacher_id
      and a.subject_id = new.subject_id
      and a.class_id = new.class_id
      and a.academic_year_id = new.academic_year_id
      and a.is_active
      and (a.term_id is null or a.term_id = new.term_id)
      and (a.stream_id is null or a.stream_id = new.stream_id)
    order by (a.stream_id is not null) desc, (a.term_id is not null) desc, a.id
    limit 1;
    if new.teacher_assignment_id is null then
      raise exception 'this teacher is not assigned to the selected slot';
    end if;
  end if;

  if new.end_time <= new.start_time then
    raise exception 'the end time must be after the start time';
  end if;

  if new.status = 'active' then
    if exists (
      select 1 from timetable_entries e
      where e.id <> new.id and e.status = 'active'
        and e.teacher_id = new.teacher_id
        and e.academic_year_id = new.academic_year_id
        and e.day_of_week = new.day_of_week
        and coalesce(e.term_id,'00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(new.term_id,'00000000-0000-0000-0000-000000000000'::uuid)
        and e.start_time < new.end_time and new.start_time < e.end_time
    ) then raise exception 'this teacher already has an overlapping timetable entry'; end if;

    if exists (
      select 1 from timetable_entries e
      where e.id <> new.id and e.status = 'active'
        and e.class_id = new.class_id
        and e.academic_year_id = new.academic_year_id
        and e.day_of_week = new.day_of_week
        and coalesce(e.term_id,'00000000-0000-0000-0000-000000000000'::uuid)
          = coalesce(new.term_id,'00000000-0000-0000-0000-000000000000'::uuid)
        and e.start_time < new.end_time and new.start_time < e.end_time
        and (e.stream_id is null or new.stream_id is null or e.stream_id = new.stream_id)
    ) then raise exception 'this class or stream already has an overlapping timetable entry'; end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_timetable_entries() from public, anon, authenticated;

-- Attendance session identity must correspond to its timetable slot. Teachers
-- need the exact class-subject/year/term/stream assignment, not merely any
-- assignment somewhere in the same class.
create or replace function phase5_guard_attendance_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entry timetable_entries;
begin
  if not exists (
    select 1 from classes c where c.id = new.class_id and c.school_id = new.school_id
  ) then raise exception 'class belongs to another school'; end if;

  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id
  ) then raise exception 'stream does not belong to the selected class'; end if;

  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y
    where y.id = new.academic_year_id and y.school_id = new.school_id
  ) then raise exception 'academic year belongs to another school'; end if;

  if new.term_id is not null and not exists (
    select 1 from terms t
    where t.id = new.term_id and t.school_id = new.school_id
      and (new.academic_year_id is null or t.academic_year_id is null or t.academic_year_id = new.academic_year_id)
  ) then raise exception 'term does not belong to the selected academic year'; end if;

  if new.subject_id is not null and not exists (
    select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id
  ) then raise exception 'subject belongs to another school'; end if;

  if new.period_id is not null and not exists (
    select 1 from timetable_periods p
    where p.id = new.period_id and p.school_id = new.school_id and p.is_active and not p.is_break
      and (new.academic_year_id is null or p.academic_year_id is null or p.academic_year_id = new.academic_year_id)
  ) then raise exception 'period is invalid for this attendance session'; end if;

  if new.timetable_entry_id is not null then
    select * into v_entry from timetable_entries e
    where e.id = new.timetable_entry_id and e.school_id = new.school_id and e.status = 'active';
    if v_entry.id is null then raise exception 'active timetable entry was not found'; end if;
    if v_entry.class_id is distinct from new.class_id
       or v_entry.stream_id is distinct from new.stream_id
       or (new.subject_id is not null and v_entry.subject_id is distinct from new.subject_id)
       or (new.period_id is not null and v_entry.period_id is distinct from new.period_id)
       or (new.academic_year_id is not null and v_entry.academic_year_id is distinct from new.academic_year_id)
       or (new.term_id is not null and v_entry.term_id is distinct from new.term_id)
       or v_entry.day_of_week <> extract(dow from new.session_date)::integer then
      raise exception 'attendance session does not match the selected timetable entry';
    end if;
    new.subject_id := v_entry.subject_id;
    new.period_id := coalesce(new.period_id, v_entry.period_id);
    new.academic_year_id := coalesce(new.academic_year_id, v_entry.academic_year_id);
    new.term_id := coalesce(new.term_id, v_entry.term_id);
  end if;

  if not is_admin_of(new.school_id) then
    if new.timetable_entry_id is not null then
      if not exists (
        select 1 from timetable_entries e
        join teachers t on t.id = e.teacher_id
        where e.id = new.timetable_entry_id and t.profile_id = auth.uid()
      ) then raise exception 'this timetable session is not assigned to the signed-in teacher'; end if;
    elsif new.subject_id is not null then
      if not phase5_teacher_assigned_slot(
        new.school_id,new.class_id,new.subject_id,new.academic_year_id,new.term_id,new.stream_id
      ) then raise exception 'teacher is not assigned to this class-subject slot'; end if;
    elsif not is_teacher_of_class(new.class_id) then
      raise exception 'teacher is not assigned to the selected class';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_sessions() from public, anon, authenticated;

-- Always bind each record to the enrollment that was actually valid for the
-- session date and exact stream. Identity fields are immutable on correction.
create or replace function phase5_guard_attendance_records()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_session attendance_sessions;
  v_enrollment uuid;
begin
  select * into v_session from attendance_sessions where id = new.session_id;
  if v_session.id is null then raise exception 'attendance session was not found'; end if;
  if v_session.school_id is distinct from new.school_id then
    raise exception 'attendance record belongs to another school than its session';
  end if;
  if tg_op = 'UPDATE' and (
    new.school_id is distinct from old.school_id
    or new.session_id is distinct from old.session_id
    or new.student_id is distinct from old.student_id
  ) then raise exception 'attendance record identity fields are immutable'; end if;

  select e.id into v_enrollment
  from student_enrollments e
  join students s on s.id = e.student_id and s.school_id = e.school_id
  where e.student_id = new.student_id
    and e.school_id = new.school_id
    and e.class_id = v_session.class_id
    and s.status = 'active'
    and (v_session.stream_id is null or e.stream_id = v_session.stream_id)
    and e.enrolled_on <= v_session.session_date
    and (e.ended_on is null or e.ended_on >= v_session.session_date)
  order by e.enrolled_on desc
  limit 1;
  if v_enrollment is null then
    raise exception 'student was not enrolled in the selected class/stream on that date';
  end if;
  new.enrollment_id := v_enrollment;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.corrected_by := auth.uid();
    new.corrected_at := now();
    insert into attendance_record_history(
      school_id,record_id,student_id,old_status,new_status,reason,changed_by
    ) values (
      new.school_id,new.id,new.student_id,old.status,new.status,new.reason,auth.uid()
    );
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_records() from public, anon, authenticated;

-- Correct the Somali text and event type for absent/late/excused alerts.
create or replace function phase5_notify_absence(p_session uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_session attendance_sessions;
  v_settings attendance_settings;
  v_school_name text;
  v_class_name text;
  v_stream_name text;
  v_subject_name text;
  v_period_name text;
  v_where text;
  v_count integer := 0;
  r record;
  v_title text;
  v_body text;
  v_event text;
begin
  select * into v_session from attendance_sessions where id = p_session;
  if v_session.id is null then return 0; end if;
  select * into v_settings from attendance_settings where school_id = v_session.school_id;
  if v_settings.school_id is null then
    v_settings.absence_notifications_enabled := true;
    v_settings.notify_on_late := false;
    v_settings.notify_on_excused := false;
  end if;
  if not v_settings.absence_notifications_enabled then return 0; end if;

  select name into v_school_name from schools where id = v_session.school_id;
  select name into v_class_name from classes where id = v_session.class_id;
  select name into v_stream_name from class_streams where id = v_session.stream_id;
  select name into v_subject_name from subjects where id = v_session.subject_id;
  select name into v_period_name from timetable_periods where id = v_session.period_id;
  v_where := coalesce(v_subject_name,v_period_name,v_class_name || coalesce(' ' || v_stream_name,''));

  for r in
    select distinct ar.id record_id, ar.student_id, ar.status, st.full_name,
           pa.profile_id parent_profile_id
    from attendance_records ar
    join students st on st.id = ar.student_id
    join student_parents sp on sp.student_id = ar.student_id
    join parents pa on pa.id = sp.parent_id and pa.school_id = ar.school_id
    where ar.session_id = p_session
      and pa.profile_id is not null and pa.status = 'active'
      and coalesce(sp.can_receive_messages,true)
      and (ar.status = 'absent'
        or (ar.status = 'late' and v_settings.notify_on_late)
        or (ar.status = 'excused' and v_settings.notify_on_excused))
  loop
    if r.status = 'absent' then
      v_event := 'attendance.absence';
      v_title := 'Maqnaanshaha ardayga';
      v_body := 'Ardaygaaga ' || r.full_name || ' maanta ' || to_char(v_session.session_date,'YYYY-MM-DD')
        || ' wuxuu ka maqnaa ' || coalesce(v_where,'fasalka') || '.';
    elsif r.status = 'late' then
      v_event := 'attendance.late';
      v_title := 'Soo daahitaanka ardayga';
      v_body := 'Ardaygaaga ' || r.full_name || ' maanta ' || to_char(v_session.session_date,'YYYY-MM-DD')
        || ' wuxuu ka soo daahay ' || coalesce(v_where,'fasalka') || '.';
    else
      v_event := 'attendance.excused';
      v_title := 'Maqnaansho la cudurdaartay';
      v_body := 'Maqnaanshaha ardaygaaga ' || r.full_name || ' ee ' || to_char(v_session.session_date,'YYYY-MM-DD')
        || ' (' || coalesce(v_where,'fasalka') || ') waa la cudurdaartay.';
    end if;
    v_body := v_body || ' Dugsiga: ' || coalesce(v_school_name,'') || '. Fasalka: '
      || coalesce(v_class_name,'') || coalesce(' ' || v_stream_name,'') || '. Fadlan la xiriir maamulka dugsiga haddii loo baahdo.';

    perform set_config('kobciye.notify_system','on',true);
    insert into notifications(
      school_id,recipient_id,event_type,title,body,entity,entity_id,student_id,dedupe_key
    ) values (
      v_session.school_id,r.parent_profile_id,v_event,v_title,v_body,
      'attendance_records',r.record_id,r.student_id,
      v_event || ':' || r.record_id::text || ':' || r.status
    ) on conflict(recipient_id,dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
    perform set_config('kobciye.notify_system','off',true);
  end loop;
  return v_count;
end $$;
revoke all on function phase5_notify_absence(uuid) from public, anon, authenticated;

-- Delay every configured attendance alert, not only the absent event.
create or replace function phase5_set_attendance_notification_availability()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delay integer := 0;
begin
  if new.event_type in ('attendance.absence','attendance.late','attendance.excused') then
    select coalesce(s.notification_delay_minutes,0) into v_delay
    from attendance_settings s where s.school_id = new.school_id;
    new.available_at := now() + make_interval(mins => coalesce(v_delay,0));
  elsif new.available_at is null then
    new.available_at := now();
  end if;
  return new;
end $$;
revoke all on function phase5_set_attendance_notification_availability() from public, anon, authenticated;

-- A recipient may transition unread -> read exactly once. They cannot clear or
-- rewrite read_at, nor mutate message content/availability/supersession.
create or replace function phase5_guard_notification_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = new.recipient_id
     and current_setting('kobciye.notify_system',true) is distinct from 'on' then
    if new.school_id is distinct from old.school_id
       or new.recipient_id is distinct from old.recipient_id
       or new.event_type is distinct from old.event_type
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.entity is distinct from old.entity
       or new.entity_id is distinct from old.entity_id
       or new.student_id is distinct from old.student_id
       or new.dedupe_key is distinct from old.dedupe_key
       or new.superseded_by is distinct from old.superseded_by
       or new.superseded_at is distinct from old.superseded_at
       or new.available_at is distinct from old.available_at
       or new.created_at is distinct from old.created_at then
      raise exception 'recipient may only mark a notification read';
    end if;
    if old.read_at is not null and new.read_at is distinct from old.read_at then
      raise exception 'a read notification cannot be made unread or re-timestamped';
    end if;
    if old.read_at is null and new.read_at is null then
      raise exception 'notification update did not mark it read';
    end if;
    if new.read_at > now() + interval '1 minute' then
      raise exception 'notification read time is invalid';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_notification_self_update() from public, anon, authenticated;

commit;
