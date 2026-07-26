-- ============================================================
-- Kobciye Phase 5 — Stage 2b: attendance + notifications
--
-- WHY NEW TABLES rather than reusing the Phase 1/2 `attendance` table:
-- that table is `unique (student_id, date)` — exactly ONE row per student per
-- DAY. Phase 5 requires per-PERIOD/subject sessions, correction history and a
-- record of who marked and who corrected. Those cannot be expressed under a
-- one-row-per-day unique constraint. The legacy table is therefore left
-- untouched (its RLS, guards and Phase 1–4 tests keep working) and the
-- session-based model below becomes the Phase 5 canonical source. Nothing
-- reads both as one collection, so there is no parallel-duplicate ambiguity.
--
-- notifications is a GENERAL Phase 5 table (used by attendance, assignments,
-- exams, results, finance and discipline) and is created here because
-- automatic parent absence notification is the first consumer.
--
-- Additive only. No reset, no data rewrite.
-- ============================================================

begin;

-- ============================================================
-- notifications — real, persisted, per-recipient records
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  -- the profile that should SEE this notification
  recipient_id uuid not null references profiles (id) on delete cascade,
  -- 'attendance.absence' | 'attendance.correction' | 'assignment.published' |
  -- 'exam.published' | 'result.published' | 'invoice.issued' |
  -- 'payment.recorded' | 'incident.followup' | 'account_invitation.sent' |
  -- 'account_invitation.accepted'
  event_type text not null,
  title text not null,
  body text not null,
  -- what this notification is ABOUT (used for de-duplication)
  entity text,
  entity_id uuid,
  student_id uuid references students (id) on delete cascade,
  -- de-duplication key: one notification per recipient per logical event
  dedupe_key text,
  -- an absence notification that a later correction supersedes
  superseded_by uuid references notifications (id) on delete set null,
  superseded_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- non-partial so ON CONFLICT (recipient_id, dedupe_key) can infer it. Rows
-- with a NULL dedupe_key are never deduplicated (NULLs compare distinct),
-- which is exactly the intent: only keyed events collapse to one per recipient.
create unique index if not exists notifications_dedupe
  on notifications (recipient_id, dedupe_key);
create index if not exists notifications_recipient
  on notifications (recipient_id, created_at desc);
create index if not exists notifications_unread
  on notifications (recipient_id) where read_at is null;
create index if not exists notifications_school on notifications (school_id);
create trigger notifications_updated_at before update on notifications
  for each row execute function set_updated_at();

-- the recipient must belong to the notification's school (no cross-school leak)
create or replace function phase5_guard_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profiles p
    where p.id = new.recipient_id
      and (p.school_id = new.school_id or p.role = 'super_admin')
  ) then
    raise exception 'notification recipient belongs to another school';
  end if;
  if new.student_id is not null and not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'notification student belongs to another school';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_notifications() from public, anon, authenticated;
create trigger notifications_guard before insert or update on notifications
  for each row execute function phase5_guard_notifications();

alter table notifications enable row level security;

-- a user sees ONLY their own notifications. There is deliberately no
-- "admin reads all notifications" policy: a notification is personal mail.
create policy "recipient reads own notifications" on notifications
  for select using (recipient_id = auth.uid());
-- the recipient may only ever mark their own as read (the WITH CHECK keeps the
-- row theirs; column-level immutability is enforced by the trigger below)
create policy "recipient updates own notifications" on notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- a recipient may change ONLY read_at — never the message, target or school
create or replace function phase5_guard_notification_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = new.recipient_id
     and current_setting('kobciye.notify_system', true) is distinct from 'on' then
    if new.school_id is distinct from old.school_id
       or new.recipient_id is distinct from old.recipient_id
       or new.event_type is distinct from old.event_type
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.entity is distinct from old.entity
       or new.entity_id is distinct from old.entity_id
       or new.student_id is distinct from old.student_id
       or new.dedupe_key is distinct from old.dedupe_key
       or new.superseded_by is distinct from old.superseded_by then
      raise exception 'a recipient may only mark a notification read';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_notification_self_update() from public, anon, authenticated;
create trigger notifications_self_update_guard before update on notifications
  for each row execute function phase5_guard_notification_self_update();

-- audit notification lifecycle
create or replace function phase5_audit_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (new.school_id, auth.uid(), 'notification.create', 'notifications', new.id::text,
            jsonb_build_object('event_type', new.event_type, 'recipient_id', new.recipient_id));
  elsif old.read_at is null and new.read_at is not null then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (new.school_id, auth.uid(), 'notification.read', 'notifications', new.id::text,
            jsonb_build_object('event_type', new.event_type));
  elsif old.superseded_by is null and new.superseded_by is not null then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (new.school_id, auth.uid(), 'notification.correct', 'notifications', new.id::text,
            jsonb_build_object('superseded_by', new.superseded_by));
  end if;
  return new;
end $$;
revoke all on function phase5_audit_notifications() from public, anon, authenticated;
create trigger notifications_audit after insert or update on notifications
  for each row execute function phase5_audit_notifications();

-- mark_notification_read — the only mutation a normal user performs
create or replace function mark_notification_read(p_notification uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update notifications set read_at = coalesce(read_at, now())
    where id = p_notification and recipient_id = auth.uid();
  return found;
end $$;
revoke all on function mark_notification_read(uuid) from public, anon;
grant execute on function mark_notification_read(uuid) to authenticated;

-- ============================================================
-- attendance_settings — per-school notification policy (§6.11)
-- ============================================================
create table if not exists attendance_settings (
  school_id uuid primary key references schools (id) on delete cascade,
  absence_notifications_enabled boolean not null default true,
  notify_on_late boolean not null default false,
  notify_on_excused boolean not null default false,
  notification_delay_minutes integer not null default 0
    check (notification_delay_minutes between 0 and 1440),
  updated_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger attendance_settings_updated_at before update on attendance_settings
  for each row execute function set_updated_at();
alter table attendance_settings enable row level security;
create policy "admins manage attendance settings" on attendance_settings
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "school staff read attendance settings" on attendance_settings
  for select using (is_staff_of(school_id));

-- ============================================================
-- attendance_sessions — ONE marking event for a class on a date/period
-- ============================================================
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  class_id uuid not null references classes (id) on delete cascade,
  stream_id uuid references class_streams (id) on delete set null,
  subject_id uuid references subjects (id) on delete set null,
  timetable_entry_id uuid references timetable_entries (id) on delete set null,
  period_id uuid references timetable_periods (id) on delete set null,
  session_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'submitted')),
  taken_by uuid references profiles (id) on delete set null,
  submitted_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- ONE session per school+class+stream+date+period. COALESCE keeps the
-- constraint effective when stream/period are null (a whole-class day session).
create unique index if not exists attendance_sessions_unique_slot
  on attendance_sessions (
    school_id, class_id,
    coalesce(stream_id, '00000000-0000-0000-0000-000000000000'::uuid),
    session_date,
    coalesce(period_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists attendance_sessions_school_date
  on attendance_sessions (school_id, session_date);
create index if not exists attendance_sessions_class_date
  on attendance_sessions (class_id, session_date);
create trigger attendance_sessions_updated_at before update on attendance_sessions
  for each row execute function set_updated_at();

-- ============================================================
-- attendance_records — one row per student per session
-- ============================================================
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  session_id uuid not null references attendance_sessions (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  enrollment_id uuid references student_enrollments (id) on delete set null,
  status attendance_status not null default 'present',
  reason text,
  marked_by uuid references profiles (id) on delete set null,
  corrected_by uuid references profiles (id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);
create index if not exists attendance_records_student
  on attendance_records (student_id, created_at desc);
create index if not exists attendance_records_session on attendance_records (session_id);
create index if not exists attendance_records_school_status
  on attendance_records (school_id, status);
create trigger attendance_records_updated_at before update on attendance_records
  for each row execute function set_updated_at();

-- ============================================================
-- attendance_record_history — every correction, never overwritten
-- ============================================================
create table if not exists attendance_record_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  record_id uuid not null references attendance_records (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  old_status attendance_status,
  new_status attendance_status not null,
  reason text,
  changed_by uuid references profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists attendance_record_history_record
  on attendance_record_history (record_id, changed_at desc);

-- ============================================================
-- Relationship integrity for sessions and records
-- ============================================================
create or replace function phase5_guard_attendance_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from classes c
                 where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'class belongs to another school';
  end if;
  if new.stream_id is not null and not exists (
    select 1 from class_streams st
    where st.id = new.stream_id and st.school_id = new.school_id and st.class_id = new.class_id) then
    raise exception 'stream does not belong to the selected class';
  end if;
  if new.subject_id is not null and not exists (
    select 1 from subjects s where s.id = new.subject_id and s.school_id = new.school_id) then
    raise exception 'subject belongs to another school';
  end if;
  if new.period_id is not null and not exists (
    select 1 from timetable_periods p where p.id = new.period_id and p.school_id = new.school_id) then
    raise exception 'period belongs to another school';
  end if;
  if new.timetable_entry_id is not null and not exists (
    select 1 from timetable_entries e
    where e.id = new.timetable_entry_id and e.school_id = new.school_id
      and e.class_id = new.class_id) then
    raise exception 'timetable entry does not belong to the selected class';
  end if;
  if new.academic_year_id is not null and not exists (
    select 1 from academic_years y
    where y.id = new.academic_year_id and y.school_id = new.school_id) then
    raise exception 'academic year belongs to another school';
  end if;
  -- a TEACHER may only open a session for a class they are assigned to;
  -- a school admin (or super_admin acting on the school) may open any.
  if not is_admin_of(new.school_id) then
    if not is_teacher_of_class(new.class_id) then
      raise exception 'this teacher is not assigned to the selected class';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_sessions() from public, anon, authenticated;
create trigger attendance_sessions_guard before insert or update on attendance_sessions
  for each row execute function phase5_guard_attendance_sessions();

create or replace function phase5_guard_attendance_records()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_session attendance_sessions;
begin
  select * into v_session from attendance_sessions where id = new.session_id;
  if v_session.id is null then raise exception 'attendance session was not found'; end if;
  if v_session.school_id is distinct from new.school_id then
    raise exception 'attendance record belongs to another school than its session';
  end if;
  if not exists (select 1 from students s
                 where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;
  -- the student must have had a VALID enrollment in this class as at the
  -- session date — historical enrollments are respected, never rewritten.
  if not exists (
    select 1 from student_enrollments e
    where e.student_id = new.student_id
      and e.school_id = new.school_id
      and e.class_id = v_session.class_id
      and (v_session.stream_id is null or e.stream_id is null or e.stream_id = v_session.stream_id)
      and e.enrolled_on <= v_session.session_date
      and (e.ended_on is null or e.ended_on >= v_session.session_date)
  ) then
    raise exception 'this student was not enrolled in the selected class on that date';
  end if;
  -- record the correction trail whenever a saved status actually changes
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.corrected_by := auth.uid();
    new.corrected_at := now();
    insert into attendance_record_history (
      school_id, record_id, student_id, old_status, new_status, reason, changed_by)
    values (new.school_id, new.id, new.student_id, old.status, new.status, new.reason, auth.uid());
  end if;
  return new;
end $$;
revoke all on function phase5_guard_attendance_records() from public, anon, authenticated;
create trigger attendance_records_guard before insert or update on attendance_records
  for each row execute function phase5_guard_attendance_records();

-- ============================================================
-- Cross-table visibility helpers (SECURITY DEFINER) — attendance_sessions and
-- attendance_records reference EACH OTHER, so evaluating one policy by
-- sub-querying the other under RLS would recurse infinitely. These definer
-- helpers answer the cross-table question while bypassing the other table's
-- RLS, breaking the cycle (the same technique the Phase 1–4 helpers use).
-- ============================================================
create or replace function attendance_session_class(p_session uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from attendance_sessions where id = p_session
$$;
revoke all on function attendance_session_class(uuid) from public;
grant execute on function attendance_session_class(uuid) to anon, authenticated;

create or replace function attendance_session_has_self(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from attendance_records r
                 where r.session_id = p_session and is_self_student(r.student_id))
$$;
revoke all on function attendance_session_has_self(uuid) from public;
grant execute on function attendance_session_has_self(uuid) to anon, authenticated;

create or replace function attendance_session_has_parent_child(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from attendance_records r
                 where r.session_id = p_session and is_parent_of(r.student_id))
$$;
revoke all on function attendance_session_has_parent_child(uuid) from public;
grant execute on function attendance_session_has_parent_child(uuid) to anon, authenticated;

-- ============================================================
-- RLS for attendance
-- ============================================================
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table attendance_record_history enable row level security;

create policy "admins manage attendance sessions" on attendance_sessions
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins manage attendance records" on attendance_records
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "admins read attendance history" on attendance_record_history
  for select using (is_admin_of(school_id));

-- TEACHER: only sessions/records of a class they are assigned to
create policy "teacher manages assigned class sessions" on attendance_sessions
  for all using (is_teacher_of_class(class_id)) with check (is_teacher_of_class(class_id));
create policy "teacher manages assigned class records" on attendance_records
  for all using (is_teacher_of_class(attendance_session_class(session_id)))
  with check (is_teacher_of_class(attendance_session_class(session_id)));
create policy "teacher reads assigned class history" on attendance_record_history
  for select using (is_teacher_of_student(student_id));

-- STUDENT: only their OWN attendance
create policy "student reads own attendance" on attendance_records
  for select using (is_self_student(student_id));
create policy "student reads own attendance sessions" on attendance_sessions
  for select using (attendance_session_has_self(id));
create policy "student reads own attendance history" on attendance_record_history
  for select using (is_self_student(student_id));

-- PARENT: only LINKED children's attendance
create policy "parent reads linked child attendance" on attendance_records
  for select using (is_parent_of(student_id));
create policy "parent reads linked child attendance sessions" on attendance_sessions
  for select using (attendance_session_has_parent_child(id));
create policy "parent reads linked child attendance history" on attendance_record_history
  for select using (is_parent_of(student_id));

-- ============================================================
-- phase5_notify_absence — create the parent notifications for ONE session.
-- Called only from inside save_attendance_session_atomic AFTER the attendance
-- rows are committed within the same transaction, so a failed save can never
-- leave a notification behind.
-- ============================================================
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
begin
  select * into v_session from attendance_sessions where id = p_session;
  if v_session.id is null then return 0; end if;

  select * into v_settings from attendance_settings where school_id = v_session.school_id;
  -- a school with no settings row uses the documented defaults
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

  -- "the class/subject" phrase used in the Somali message
  v_where := coalesce(v_subject_name, v_period_name,
                      v_class_name || coalesce(' ' || v_stream_name, ''));

  for r in
    select ar.id as record_id, ar.student_id, ar.status, s.full_name,
           sp.parent_profile_id
    from attendance_records ar
    join students s on s.id = ar.student_id
    join student_parents sp on sp.student_id = ar.student_id
    where ar.session_id = p_session
      and sp.parent_profile_id is not null
      and coalesce(sp.can_receive_messages, true)
      and (ar.status = 'absent'
        or (ar.status = 'late' and v_settings.notify_on_late)
        or (ar.status = 'excused' and v_settings.notify_on_excused))
  loop
    -- dedupe_key makes one notification per parent per record per status;
    -- the unique index turns a duplicate Save into a no-op rather than a
    -- second message.
    perform set_config('kobciye.notify_system', 'on', true);
    insert into notifications (
      school_id, recipient_id, event_type, title, body,
      entity, entity_id, student_id, dedupe_key)
    values (
      v_session.school_id, r.parent_profile_id, 'attendance.absence',
      case r.status
        when 'absent' then 'Maqnaanshaha ardayga'
        when 'late'   then 'Soo daahitaanka ardayga'
        else 'Xaadiris: erid' end,
      'Ardaygaaga ' || r.full_name || ' maanta ' || to_char(v_session.session_date, 'YYYY-MM-DD')
        || ' wuxuu ka maqnaa ' || coalesce(v_where, 'fasalka') || '. '
        || 'Dugsiga: ' || coalesce(v_school_name, '') || '. '
        || 'Fasalka: ' || coalesce(v_class_name, '') || coalesce(' ' || v_stream_name, '') || '. '
        || 'Xaaladda: ' || r.status || '. '
        || 'Fadlan la xiriir maamulka dugsiga haddii loo baahdo.',
      'attendance_records', r.record_id, r.student_id,
      'attendance.absence:' || r.record_id::text || ':' || r.status)
    on conflict (recipient_id, dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
    perform set_config('kobciye.notify_system', 'off', true);
  end loop;

  return v_count;
end $$;
revoke all on function phase5_notify_absence(uuid) from public, anon, authenticated;

-- ============================================================
-- save_attendance_session_atomic — the ONE writer for attendance.
-- Creates/reuses the session, writes every student's status, records
-- corrections, and only then generates parent notifications. Any failure
-- rolls the whole call back: no half-saved register, no orphan notification.
--
-- p_records: jsonb array of { student_id, status, reason }
-- ============================================================
create or replace function save_attendance_session_atomic(
  p_school uuid,
  p_class uuid,
  p_session_date date,
  p_records jsonb,
  p_stream uuid default null,
  p_subject uuid default null,
  p_period uuid default null,
  p_timetable_entry uuid default null,
  p_academic_year uuid default null,
  p_term uuid default null,
  p_note text default null,
  p_submit boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_session uuid;
  v_rec jsonb;
  v_student uuid;
  v_status attendance_status;
  v_enrollment uuid;
  v_written integer := 0;
  v_notified integer := 0;
  v_absent integer := 0;
begin
  if not (is_admin_of(p_school) or is_teacher_of_class(p_class)) then
    raise exception 'only an assigned teacher or a school admin may mark attendance';
  end if;
  if p_session_date is null then raise exception 'an attendance date is required'; end if;
  if p_session_date > current_date then
    raise exception 'attendance cannot be marked for a future date';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) = 0 then
    raise exception 'at least one student record is required';
  end if;

  -- reuse the existing session for this exact slot (a duplicate Save must
  -- correct the same register, never create a second one)
  select id into v_session from attendance_sessions
  where school_id = p_school and class_id = p_class
    and coalesce(stream_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_stream, '00000000-0000-0000-0000-000000000000'::uuid)
    and session_date = p_session_date
    and coalesce(period_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_period, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_session is null then
    insert into attendance_sessions (
      school_id, academic_year_id, term_id, class_id, stream_id, subject_id,
      timetable_entry_id, period_id, session_date, status, taken_by, submitted_at, note)
    values (
      p_school, p_academic_year, p_term, p_class, p_stream, p_subject,
      p_timetable_entry, p_period, p_session_date,
      case when p_submit then 'submitted' else 'open' end,
      auth.uid(), case when p_submit then now() else null end, p_note)
    returning id into v_session;
  else
    update attendance_sessions set
      subject_id = coalesce(p_subject, subject_id),
      timetable_entry_id = coalesce(p_timetable_entry, timetable_entry_id),
      academic_year_id = coalesce(p_academic_year, academic_year_id),
      term_id = coalesce(p_term, term_id),
      note = coalesce(p_note, note),
      status = case when p_submit then 'submitted' else status end,
      submitted_at = case when p_submit then now() else submitted_at end
    where id = v_session;
  end if;

  for v_rec in select * from jsonb_array_elements(p_records) loop
    v_student := (v_rec ->> 'student_id')::uuid;
    if v_student is null then raise exception 'every record needs a student_id'; end if;
    begin
      v_status := coalesce(nullif(v_rec ->> 'status', ''), 'present')::attendance_status;
    exception when others then
      raise exception 'invalid attendance status: %', v_rec ->> 'status';
    end;

    -- attach the enrollment that was valid on the session date
    select e.id into v_enrollment from student_enrollments e
    where e.student_id = v_student and e.school_id = p_school and e.class_id = p_class
      and e.enrolled_on <= p_session_date
      and (e.ended_on is null or e.ended_on >= p_session_date)
    order by case when e.status = 'active' then 0 else 1 end, e.enrolled_on desc
    limit 1;

    insert into attendance_records (
      school_id, session_id, student_id, enrollment_id, status, reason, marked_by)
    values (p_school, v_session, v_student, v_enrollment, v_status,
            nullif(trim(coalesce(v_rec ->> 'reason', '')), ''), auth.uid())
    on conflict (session_id, student_id) do update
      set status = excluded.status,
          reason = coalesce(excluded.reason, attendance_records.reason),
          enrollment_id = coalesce(excluded.enrollment_id, attendance_records.enrollment_id);

    v_written := v_written + 1;
    if v_status = 'absent' then v_absent := v_absent + 1; end if;
  end loop;

  -- notifications LAST: everything above has already succeeded inside this
  -- same transaction, and a raise anywhere above prevents us reaching here.
  if p_submit then
    v_notified := phase5_notify_absence(v_session);
    -- a status corrected AWAY from absent supersedes its earlier notification
    perform phase5_supersede_absence_notifications(v_session);
  end if;

  return jsonb_build_object(
    'session_id', v_session,
    'records_written', v_written,
    'absent_count', v_absent,
    'notifications_created', v_notified);
end $$;
revoke all on function save_attendance_session_atomic(uuid, uuid, date, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function save_attendance_session_atomic(uuid, uuid, date, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, text, boolean) to authenticated;

-- ============================================================
-- phase5_supersede_absence_notifications — when a record is corrected from
-- absent to present/late/excused, the original absence notification is marked
-- superseded and a correction notification is created. The attendance audit
-- history (attendance_record_history) is never touched.
-- ============================================================
create or replace function phase5_supersede_absence_notifications(p_session uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_session attendance_sessions;
  v_class_name text;
  v_count integer := 0;
  r record;
  v_new uuid;
begin
  select * into v_session from attendance_sessions where id = p_session;
  if v_session.id is null then return 0; end if;
  select name into v_class_name from classes where id = v_session.class_id;

  for r in
    select n.id as notification_id, n.recipient_id, n.student_id,
           ar.status as current_status, s.full_name
    from notifications n
    join attendance_records ar on ar.id = n.entity_id
    join students s on s.id = ar.student_id
    where n.entity = 'attendance_records'
      and n.event_type = 'attendance.absence'
      and n.superseded_by is null
      and ar.session_id = p_session
      and ar.status <> 'absent'
      and n.dedupe_key like 'attendance.absence:%:absent'
  loop
    perform set_config('kobciye.notify_system', 'on', true);
    insert into notifications (
      school_id, recipient_id, event_type, title, body,
      entity, entity_id, student_id, dedupe_key)
    values (
      v_session.school_id, r.recipient_id, 'attendance.correction',
      'Xaadiriska waa la saxay',
      'Xaadiriska ardaygaaga ' || r.full_name || ' ee ' ||
      to_char(v_session.session_date, 'YYYY-MM-DD') || ' (' || coalesce(v_class_name, '') || ') '
      || 'waa la saxay. Xaaladda cusub: ' || r.current_status || '.',
      'attendance_records', r.notification_id, r.student_id,
      'attendance.correction:' || r.notification_id::text || ':' || r.current_status)
    on conflict (recipient_id, dedupe_key) do nothing
    returning id into v_new;

    update notifications
      set superseded_by = coalesce(v_new, superseded_by), superseded_at = now()
      where id = r.notification_id;
    perform set_config('kobciye.notify_system', 'off', true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function phase5_supersede_absence_notifications(uuid) from public, anon, authenticated;

-- ============================================================
-- attendance_summary — real statistics, computed from real records only.
-- ============================================================
create or replace function attendance_summary(
  p_school uuid,
  p_class uuid default null,
  p_student uuid default null,
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row record;
begin
  -- the caller must be entitled to the scope they ask for
  if p_student is not null then
    if not (is_admin_of(p_school) or is_self_student(p_student)
            or is_parent_of(p_student) or is_teacher_of_student(p_student)) then
      raise exception 'not authorized to read this attendance summary';
    end if;
  elsif p_class is not null then
    if not (is_admin_of(p_school) or is_teacher_of_class(p_class)) then
      raise exception 'not authorized to read this attendance summary';
    end if;
  else
    if not is_admin_of(p_school) then
      raise exception 'not authorized to read this attendance summary';
    end if;
  end if;

  select
    count(*) as total,
    count(*) filter (where ar.status = 'present') as present,
    count(*) filter (where ar.status = 'absent')  as absent,
    count(*) filter (where ar.status = 'late')    as late,
    count(*) filter (where ar.status = 'excused') as excused
  into v_row
  from attendance_records ar
  join attendance_sessions s on s.id = ar.session_id
  where ar.school_id = p_school
    and (p_class is null or s.class_id = p_class)
    and (p_student is null or ar.student_id = p_student)
    and (p_from is null or s.session_date >= p_from)
    and (p_to is null or s.session_date <= p_to);

  return jsonb_build_object(
    'total', v_row.total,
    'present', v_row.present,
    'absent', v_row.absent,
    'late', v_row.late,
    'excused', v_row.excused,
    -- null (not 0) when there is nothing to average, so the UI can tell
    -- "no data yet" apart from a real 0%
    'present_rate', case when v_row.total > 0
      then round((v_row.present + v_row.late)::numeric / v_row.total * 100, 1)
      else null end);
end $$;
revoke all on function attendance_summary(uuid, uuid, uuid, date, date) from public, anon;
grant execute on function attendance_summary(uuid, uuid, uuid, date, date) to authenticated;

commit;
