-- ============================================================================
-- Cancellations.
--
-- Appointments and prescriptions could reach 'cancelled' in the enum but there
-- was nowhere to say why, and nothing stopped finished work from being
-- cancelled after the fact. Both are fixed here.
-- ============================================================================

alter table appointments  add column if not exists cancel_reason text;
alter table prescriptions add column if not exists cancel_reason text;

-- ---------------------------------------------------------------------------
-- A cancellation must carry a reason, and finished work cannot be un-finished.
-- ---------------------------------------------------------------------------
create or replace function appointments_guard_cancel() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    if old.status = 'completed' then
      raise exception 'a completed appointment cannot be cancelled';
    end if;
    if coalesce(btrim(new.cancel_reason), '') = '' then
      raise exception 'a cancelled appointment needs a reason';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_guard_cancel on appointments;
create trigger appointments_guard_cancel
  before update on appointments
  for each row execute function appointments_guard_cancel();

create or replace function prescriptions_guard_cancel() returns trigger
language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    if old.status in ('dispensed', 'partially_dispensed') then
      raise exception 'medicine has already been dispensed against this prescription';
    end if;
    if coalesce(btrim(new.cancel_reason), '') = '' then
      raise exception 'a cancelled prescription needs a reason';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prescriptions_guard_cancel on prescriptions;
create trigger prescriptions_guard_cancel
  before update on prescriptions
  for each row execute function prescriptions_guard_cancel();

-- rx_update is scoped to the prescribing dentist, which leaves an admin unable
-- to close out a prescription written by someone who has left the clinic.
drop policy if exists rx_admin on prescriptions;
create policy rx_admin on prescriptions for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Archived patients are hidden, not deleted. Restoring one has to be possible.
-- ---------------------------------------------------------------------------
create index if not exists patients_archived_idx on patients (archived_at)
  where archived_at is not null;
