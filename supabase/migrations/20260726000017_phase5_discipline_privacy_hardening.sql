-- ============================================================================
-- Kobciye Phase 5 — discipline privacy and assigned-teacher hardening
--
-- Teachers may work only on cases for students currently assigned to them.
-- Confidential notes/attachments remain School Admin/Super Admin only.
-- Parents may read only their linked child's case header and non-confidential
-- actions. Students receive no discipline-case surface unless a future school
-- policy explicitly enables one.
-- ============================================================================

begin;

alter table incidents drop constraint if exists incidents_phase5_status_valid;
alter table incidents add constraint incidents_phase5_status_valid
  check (status in ('open','resolved')) not valid;
alter table incidents drop constraint if exists incidents_phase5_severity_valid;
alter table incidents add constraint incidents_phase5_severity_valid
  check (severity in ('hoose','dhexe','sare','halis')) not valid;

create or replace function phase5_teacher_assigned_incident(p_incident uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1
    from incidents i
    where i.id = p_incident
      and i.student_id is not null
      and is_teacher_of_student(i.student_id)
  )
$$;
revoke all on function phase5_teacher_assigned_incident(uuid) from public, anon;
grant execute on function phase5_teacher_assigned_incident(uuid) to authenticated;

-- Case headers: replace the legacy school-wide staff policies.
drop policy if exists "staff read incidents" on incidents;
drop policy if exists "staff write incidents" on incidents;
drop policy if exists "admins manage incidents" on incidents;
drop policy if exists "assigned teachers read incidents" on incidents;
drop policy if exists "assigned teachers create incidents" on incidents;
drop policy if exists "assigned teachers update incidents" on incidents;
drop policy if exists "admins delete incidents" on incidents;

create policy "admins manage incidents" on incidents
  for all
  using (is_admin_of(school_id))
  with check (is_admin_of(school_id));
create policy "assigned teachers read incidents" on incidents
  for select
  using (student_id is not null and is_teacher_of_student(student_id));
create policy "assigned teachers create incidents" on incidents
  for insert
  with check (student_id is not null and is_teacher_of_student(student_id));
create policy "assigned teachers update incidents" on incidents
  for update
  using (student_id is not null and is_teacher_of_student(student_id))
  with check (student_id is not null and is_teacher_of_student(student_id));
-- No Teacher delete policy. Parent child-header policy from the baseline stays.

-- Actions.
drop policy if exists "staff manage incident actions" on incident_actions;
drop policy if exists "admins manage incident actions" on incident_actions;
drop policy if exists "assigned teachers manage incident actions" on incident_actions;
drop policy if exists "assigned teachers read incident actions" on incident_actions;
drop policy if exists "assigned teachers create incident actions" on incident_actions;
create policy "admins manage incident actions" on incident_actions
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "assigned teachers read incident actions" on incident_actions
  for select using (phase5_teacher_assigned_incident(incident_id));
create policy "assigned teachers create incident actions" on incident_actions
  for insert with check (
    created_by = auth.uid() and phase5_teacher_assigned_incident(incident_id)
  );
-- Existing Parent non-confidential action SELECT remains in place.

-- Notes: admins see all; assigned teachers only non-confidential notes.
drop policy if exists "staff manage incident notes" on incident_notes;
drop policy if exists "admins manage incident notes" on incident_notes;
drop policy if exists "assigned teachers read non-confidential incident notes" on incident_notes;
drop policy if exists "assigned teachers create non-confidential incident notes" on incident_notes;
drop policy if exists "assigned teachers update own non-confidential incident notes" on incident_notes;
create policy "admins manage incident notes" on incident_notes
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "assigned teachers read non-confidential incident notes" on incident_notes
  for select using (not is_confidential and phase5_teacher_assigned_incident(incident_id));
create policy "assigned teachers create non-confidential incident notes" on incident_notes
  for insert with check (
    not is_confidential
    and created_by = auth.uid()
    and phase5_teacher_assigned_incident(incident_id)
  );
create policy "assigned teachers update own non-confidential incident notes" on incident_notes
  for update
  using (
    not is_confidential and created_by = auth.uid()
    and phase5_teacher_assigned_incident(incident_id)
  )
  with check (
    not is_confidential and created_by = auth.uid()
    and phase5_teacher_assigned_incident(incident_id)
  );

-- Attachments: admins see all; assigned teachers only non-confidential metadata.
drop policy if exists "staff manage incident attachments" on incident_attachments;
drop policy if exists "admins manage incident attachments" on incident_attachments;
drop policy if exists "assigned teachers read non-confidential incident attachments" on incident_attachments;
drop policy if exists "assigned teachers create non-confidential incident attachments" on incident_attachments;
create policy "admins manage incident attachments" on incident_attachments
  for all using (is_admin_of(school_id)) with check (is_admin_of(school_id));
create policy "assigned teachers read non-confidential incident attachments" on incident_attachments
  for select using (not is_confidential and phase5_teacher_assigned_incident(incident_id));
create policy "assigned teachers create non-confidential incident attachments" on incident_attachments
  for insert with check (
    not is_confidential
    and uploaded_by = auth.uid()
    and phase5_teacher_assigned_incident(incident_id)
  );

-- Status history contains no confidential note body. Assigned teachers may
-- read history only for their assigned student's case; mutation stays trigger-only.
drop policy if exists "assigned teachers read incident history" on incident_history;
create policy "assigned teachers read incident history" on incident_history
  for select using (phase5_teacher_assigned_incident(incident_id));

-- Prevent a Teacher from changing a case to another student's identity/class,
-- and validate enrollment consistency whenever supplied.
create or replace function phase5_guard_incidents_student()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.student_id is not null and not exists (
    select 1 from students s
    where s.id = new.student_id and s.school_id = new.school_id
  ) then
    raise exception 'student belongs to another school';
  end if;
  if new.class_id is not null and not exists (
    select 1 from classes c
    where c.id = new.class_id and c.school_id = new.school_id
  ) then
    raise exception 'class belongs to another school';
  end if;
  if new.enrollment_id is not null and not exists (
    select 1 from student_enrollments e
    where e.id = new.enrollment_id
      and e.school_id = new.school_id
      and e.student_id = new.student_id
      and (new.class_id is null or e.class_id = new.class_id)
  ) then
    raise exception 'incident enrollment does not match the student, class and school';
  end if;
  if tg_op = 'UPDATE' and not is_admin_of(new.school_id) then
    if new.school_id is distinct from old.school_id
       or new.student_id is distinct from old.student_id
       or new.enrollment_id is distinct from old.enrollment_id
       or new.class_id is distinct from old.class_id
       or new.reported_by is distinct from old.reported_by then
      raise exception 'a Teacher cannot change the identity of an existing case';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into incident_history (school_id, incident_id, old_status, new_status, changed_by)
    values (new.school_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
revoke all on function phase5_guard_incidents_student() from public, anon, authenticated;


-- Audit every child-record mutation. No confidential note body or storage path
-- is copied into the audit detail.
create or replace function phase5_audit_incident_child()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_row_id uuid := coalesce(new.id, old.id);
  v_school uuid := coalesce(new.school_id, old.school_id);
  v_incident uuid := coalesce(new.incident_id, old.incident_id);
begin
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (
    v_school, auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name,
    v_row_id::text, jsonb_build_object('incident_id', v_incident)
  );
  return coalesce(new, old);
end $$;
revoke all on function phase5_audit_incident_child() from public, anon, authenticated;

drop trigger if exists incident_actions_audit on incident_actions;
create trigger incident_actions_audit after insert or update or delete on incident_actions
  for each row execute function phase5_audit_incident_child();
drop trigger if exists incident_notes_audit on incident_notes;
create trigger incident_notes_audit after insert or update or delete on incident_notes
  for each row execute function phase5_audit_incident_child();
drop trigger if exists incident_attachments_audit on incident_attachments;
create trigger incident_attachments_audit after insert or update or delete on incident_attachments
  for each row execute function phase5_audit_incident_child();

-- Server-controlled case creation derives the enrollment valid on the incident
-- date and records the authenticated reporter. It never trusts a client-supplied
-- reported_by or enrollment_id.
create or replace function create_student_incident(
  p_school uuid,
  p_student uuid,
  p_class uuid,
  p_incident_date date,
  p_category text,
  p_title text,
  p_detail text,
  p_severity text default 'dhexe',
  p_action text default null,
  p_follow_up_on date default null,
  p_status text default 'open'
) returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_id uuid;
  v_enrollment student_enrollments;
  v_date date := coalesce(p_incident_date,current_date);
  v_severity text := lower(trim(coalesce(p_severity,'dhexe')));
  v_status text := lower(trim(coalesce(p_status,'open')));
begin
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'incident title is required'; end if;
  if v_severity not in ('hoose','dhexe','sare','halis') then raise exception 'invalid incident severity'; end if;
  if v_status not in ('open','resolved') then raise exception 'invalid incident status'; end if;
  if not exists (select 1 from students st where st.id=p_student and st.school_id=p_school) then
    raise exception 'student belongs to another school';
  end if;
  if not (is_admin_of(p_school) or is_teacher_of_student(p_student)) then
    raise exception 'not authorized to create this case';
  end if;

  select e.* into v_enrollment
  from student_enrollments e
  where e.school_id=p_school and e.student_id=p_student
    and e.enrolled_on <= v_date
    and (e.ended_on is null or e.ended_on >= v_date)
    and (p_class is null or e.class_id=p_class)
  order by e.enrolled_on desc, e.created_at desc
  limit 1;
  if v_enrollment.id is null then
    raise exception 'student had no valid enrollment on the incident date';
  end if;

  insert into incidents (
    school_id,class_id,student_id,reported_by,title,detail,severity,status,
    incident_date,category,action,follow_up_on,enrollment_id
  ) values (
    p_school,v_enrollment.class_id,p_student,auth.uid(),trim(p_title),
    nullif(trim(coalesce(p_detail,'')),''),v_severity,v_status,v_date,
    nullif(trim(coalesce(p_category,'')),''),nullif(trim(coalesce(p_action,'')),''),
    p_follow_up_on,v_enrollment.id
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function create_student_incident(uuid,uuid,uuid,date,text,text,text,text,text,date,text) from public, anon;
grant execute on function create_student_incident(uuid,uuid,uuid,date,text,text,text,text,text,date,text) to authenticated;

-- Server-controlled child-record writes set actor columns from auth.uid(); the
-- client never supplies trusted ownership metadata.
create or replace function create_incident_action(
  p_school uuid,
  p_incident uuid,
  p_action text,
  p_action_date date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_action, '')), '') is null then
    raise exception 'action is required';
  end if;
  if not (is_admin_of(p_school) or phase5_teacher_assigned_incident(p_incident)) then
    raise exception 'not authorized to add an incident action';
  end if;
  if not exists (select 1 from incidents i where i.id=p_incident and i.school_id=p_school) then
    raise exception 'incident belongs to another school';
  end if;
  insert into incident_actions (school_id, incident_id, action, action_date, created_by)
  values (p_school, p_incident, trim(p_action), coalesce(p_action_date,current_date), auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function create_incident_action(uuid,uuid,text,date) from public, anon;
grant execute on function create_incident_action(uuid,uuid,text,date) to authenticated;

create or replace function create_incident_note(
  p_school uuid,
  p_incident uuid,
  p_note text,
  p_confidential boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public as $$
declare v_id uuid; v_confidential boolean := coalesce(p_confidential,false);
begin
  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'note is required';
  end if;
  if is_admin_of(p_school) then
    null;
  elsif phase5_teacher_assigned_incident(p_incident) then
    if v_confidential then raise exception 'only a school admin may add a confidential note'; end if;
  else
    raise exception 'not authorized to add an incident note';
  end if;
  if not exists (select 1 from incidents i where i.id=p_incident and i.school_id=p_school) then
    raise exception 'incident belongs to another school';
  end if;
  insert into incident_notes (school_id, incident_id, note, is_confidential, created_by)
  values (p_school, p_incident, trim(p_note), v_confidential, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function create_incident_note(uuid,uuid,text,boolean) from public, anon;
grant execute on function create_incident_note(uuid,uuid,text,boolean) to authenticated;

create or replace function create_incident_attachment(
  p_school uuid,
  p_incident uuid,
  p_file_name text,
  p_storage_path text,
  p_mime_type text default null,
  p_size_bytes bigint default null,
  p_confidential boolean default true
) returns uuid
language plpgsql
security definer
set search_path = public as $$ 
declare v_id uuid; v_confidential boolean := coalesce(p_confidential,true);
begin
  if nullif(trim(coalesce(p_file_name, '')), '') is null
     or nullif(trim(coalesce(p_storage_path, '')), '') is null then
    raise exception 'file name and storage path are required';
  end if;
  if p_size_bytes is not null and p_size_bytes < 0 then raise exception 'invalid file size'; end if;
  if is_admin_of(p_school) then
    null;
  elsif phase5_teacher_assigned_incident(p_incident) then
    if v_confidential then raise exception 'only a school admin may add a confidential attachment'; end if;
  else
    raise exception 'not authorized to add an incident attachment';
  end if;
  if not exists (select 1 from incidents i where i.id=p_incident and i.school_id=p_school) then
    raise exception 'incident belongs to another school';
  end if;
  insert into incident_attachments (
    school_id, incident_id, file_name, storage_path, mime_type,
    size_bytes, is_confidential, uploaded_by
  ) values (
    p_school, p_incident, trim(p_file_name), trim(p_storage_path),
    nullif(trim(coalesce(p_mime_type,'')),''), p_size_bytes,
    v_confidential, auth.uid()
  ) returning id into v_id;
  return v_id;
end $$;
revoke all on function create_incident_attachment(uuid,uuid,text,text,text,bigint,boolean) from public, anon;
grant execute on function create_incident_attachment(uuid,uuid,text,text,text,bigint,boolean) to authenticated;

commit;
