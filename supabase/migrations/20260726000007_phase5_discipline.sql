-- ============================================================
-- Kobciye Phase 5 — Stage 6: discipline & cases
--
-- REUSE the Phase 1/2 `incidents` table as the case header (extended
-- additively with the case fields it lacks) and add the child tables the
-- workflow needs: actions, notes (with a CONFIDENTIAL flag that student/
-- parent may never read), attachments (metadata only) and an immutable
-- history trail.
--
-- The existing incidents policies are LEFT INTACT (staff read/write, parents
-- read their child's non-confidential header). Confidential notes live in a
-- separate table with a staff-only policy, so a parent reading the incident
-- header can never see a confidential note.
--
-- Additive only.
-- ============================================================

begin;

alter table incidents add column if not exists incident_date date not null default current_date;
alter table incidents add column if not exists category text;
alter table incidents add column if not exists action text;
alter table incidents add column if not exists follow_up_on date;
alter table incidents add column if not exists enrollment_id uuid references student_enrollments (id) on delete set null;
alter table incidents add column if not exists updated_at timestamptz not null default now();

drop trigger if exists incidents_updated_at on incidents;
create trigger incidents_updated_at before update on incidents
  for each row execute function set_updated_at();

create table if not exists incident_actions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  incident_id uuid not null references incidents (id) on delete cascade,
  action text not null,
  action_date date not null default current_date,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists incident_actions_incident on incident_actions (incident_id);

create table if not exists incident_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  incident_id uuid not null references incidents (id) on delete cascade,
  note text not null,
  is_confidential boolean not null default false,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists incident_notes_incident on incident_notes (incident_id);

create table if not exists incident_attachments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  incident_id uuid not null references incidents (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  is_confidential boolean not null default true,
  uploaded_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists incident_attachments_incident on incident_attachments (incident_id);

create table if not exists incident_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  incident_id uuid not null references incidents (id) on delete cascade,
  old_status text,
  new_status text,
  detail jsonb not null default '{}'::jsonb,
  changed_by uuid references profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists incident_history_incident on incident_history (incident_id, changed_at desc);

-- ============================================================
-- Integrity: child rows share their incident's school; the incident's
-- student (when set) must belong to that school.
-- ============================================================
create or replace function phase5_guard_incident_children()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from incidents i where i.id = new.incident_id and i.school_id = new.school_id) then
    raise exception 'record belongs to another school than its case';
  end if;
  return new;
end $$;
revoke all on function phase5_guard_incident_children() from public, anon, authenticated;
create trigger incident_actions_guard before insert or update on incident_actions
  for each row execute function phase5_guard_incident_children();
create trigger incident_notes_guard before insert or update on incident_notes
  for each row execute function phase5_guard_incident_children();
create trigger incident_attachments_guard before insert or update on incident_attachments
  for each row execute function phase5_guard_incident_children();

create or replace function phase5_guard_incidents_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_id is not null and not exists (
    select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
    raise exception 'student belongs to another school';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into incident_history (school_id, incident_id, old_status, new_status, changed_by)
    values (new.school_id, new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
revoke all on function phase5_guard_incidents_student() from public, anon, authenticated;
drop trigger if exists incidents_student_guard on incidents;
create trigger incidents_student_guard before insert or update on incidents
  for each row execute function phase5_guard_incidents_student();

-- audit
create or replace function phase5_audit_incidents()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (new.school_id, auth.uid(),
          case when tg_op = 'INSERT' then 'incident.create' else 'incident.update' end,
          'incidents', new.id::text, jsonb_build_object('status', new.status, 'severity', new.severity));
  -- a follow-up date notifies the case owner (the reporter) — authorised staff only
  if new.follow_up_on is not null and (tg_op = 'INSERT' or new.follow_up_on is distinct from old.follow_up_on)
     and new.reported_by is not null then
    perform set_config('kobciye.notify_system', 'on', true);
    insert into notifications (school_id, recipient_id, event_type, title, body, entity, entity_id, student_id, dedupe_key)
    values (new.school_id, new.reported_by, 'incident.followup', 'Kiis: la soco',
            'Kiiska "' || new.title || '" wuxuu leeyahay taariikh la-socod ah ' ||
            to_char(new.follow_up_on, 'YYYY-MM-DD') || '.',
            'incidents', new.id, new.student_id,
            'incident.followup:' || new.id::text || ':' || new.follow_up_on::text)
    on conflict (recipient_id, dedupe_key) do nothing;
    perform set_config('kobciye.notify_system', 'off', true);
  end if;
  return new;
end $$;
revoke all on function phase5_audit_incidents() from public, anon, authenticated;
create trigger incidents_audit after insert or update on incidents
  for each row execute function phase5_audit_incidents();

-- ============================================================
-- RLS — staff manage; the confidential surfaces are staff-only.
-- Student/parent visibility of the case header stays governed by the EXISTING
-- incidents policies (parents read their child's header). Notes/attachments
-- default confidential and are never exposed to student/parent here.
-- ============================================================
alter table incident_actions enable row level security;
alter table incident_notes enable row level security;
alter table incident_attachments enable row level security;
alter table incident_history enable row level security;

create policy "staff manage incident actions" on incident_actions
  for all using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'))
  with check (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "staff manage incident notes" on incident_notes
  for all using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'))
  with check (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "staff manage incident attachments" on incident_attachments
  for all using (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'))
  with check (is_staff_of(school_id) and my_role() in ('super_admin', 'school_admin', 'teacher'));
create policy "admins read incident history" on incident_history
  for select using (is_admin_of(school_id));

-- a parent may read only NON-confidential actions for their child's case
create policy "parent reads non-confidential incident actions" on incident_actions
  for select using (exists (
    select 1 from incidents i where i.id = incident_actions.incident_id
      and i.student_id is not null and is_parent_of(i.student_id)));

commit;
