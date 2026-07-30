-- ============================================================================
-- Kobciye Phase 5 — enforce the configured attendance-notification delay
--
-- Notifications for real events are still persisted immediately and remain
-- auditable/transactional, but an absence notification becomes visible to its
-- recipient only after attendance_settings.notification_delay_minutes. Other
-- notification event types remain immediately available.
-- ============================================================================

begin;

alter table notifications add column if not exists available_at timestamptz not null default now();
create index if not exists notifications_recipient_available
  on notifications (recipient_id, available_at, created_at desc);

create or replace function phase5_set_attendance_notification_availability()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare v_delay integer := 0;
begin
  if new.event_type = 'attendance.absence' then
    select coalesce(s.notification_delay_minutes,0) into v_delay
    from attendance_settings s where s.school_id=new.school_id;
    new.available_at := now() + make_interval(mins => coalesce(v_delay,0));
  elsif new.available_at is null then
    new.available_at := now();
  end if;
  return new;
end $$;
revoke all on function phase5_set_attendance_notification_availability() from public, anon, authenticated;
drop trigger if exists notifications_attendance_delay on notifications;
create trigger notifications_attendance_delay
  before insert on notifications
  for each row execute function phase5_set_attendance_notification_availability();

-- Recipient reads/updates only notifications that have reached their delivery
-- time. Personal-mail isolation remains unchanged.
drop policy if exists "recipient reads own notifications" on notifications;
drop policy if exists "recipient updates own notifications" on notifications;
create policy "recipient reads own notifications" on notifications
  for select using (recipient_id=auth.uid() and available_at <= now());
create policy "recipient updates own notifications" on notifications
  for update
  using (recipient_id=auth.uid() and available_at <= now())
  with check (recipient_id=auth.uid() and available_at <= now());

create or replace function phase5_guard_notification_self_update()
returns trigger
language plpgsql
security definer
set search_path = public as $$
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
       or new.superseded_by is distinct from old.superseded_by
       or new.superseded_at is distinct from old.superseded_at
       or new.available_at is distinct from old.available_at
       or new.created_at is distinct from old.created_at then
      raise exception 'a recipient may only mark a notification read';
    end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_notification_self_update() from public, anon, authenticated;

create or replace function mark_notification_read(p_notification uuid)
returns boolean
language plpgsql
security definer
set search_path = public as $$
begin
  update notifications
     set read_at=coalesce(read_at,now())
   where id=p_notification and recipient_id=auth.uid() and available_at <= now();
  return found;
end $$;
revoke all on function mark_notification_read(uuid) from public, anon;
grant execute on function mark_notification_read(uuid) to authenticated;

create or replace function mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public as $$
declare v_count integer;
begin
  update notifications set read_at=coalesce(read_at,now())
  where recipient_id=auth.uid() and read_at is null and available_at <= now();
  get diagnostics v_count=row_count;
  if v_count > 0 then
    insert into audit_logs (school_id,actor_id,action,entity,entity_id,detail)
    values (null,auth.uid(),'notification.read_all','notifications',null,jsonb_build_object('count',v_count));
  end if;
  return v_count;
end $$;
revoke all on function mark_all_notifications_read() from public, anon;
grant execute on function mark_all_notifications_read() to authenticated;

commit;
