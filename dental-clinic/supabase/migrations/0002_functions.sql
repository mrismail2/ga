-- ============================================================================
-- Derived balances, business-logic RPCs and triggers
--
-- Everything that touches money or stock lives here rather than in the client,
-- so the rules hold no matter which screen (or user) calls them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity helpers (used by RLS in 0003)
-- ---------------------------------------------------------------------------
create or replace function app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active';
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false);
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- Role grants the baseline; user_permissions can add capabilities on top.
create or replace function has_perm(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_admin()
    or exists (
      select 1 from user_permissions
      where user_id = auth.uid() and permission = p_permission and granted
    )
    or case p_permission
         when 'clinical.read'    then app_role() in ('dentist', 'receptionist')
         when 'clinical.write'   then app_role() = 'dentist'
         when 'patients.read'    then app_role() in ('dentist', 'receptionist', 'pharmacist')
         when 'patients.write'   then app_role() in ('dentist', 'receptionist')
         when 'appointments.read'  then app_role() in ('dentist', 'receptionist')
         when 'appointments.write' then app_role() = 'receptionist'
         when 'finance.read'     then app_role() = 'receptionist'
         when 'finance.write'    then app_role() = 'receptionist'
         when 'pharmacy.read'    then app_role() in ('pharmacist', 'dentist')
         when 'pharmacy.write'   then app_role() = 'pharmacist'
         when 'reports.read'     then app_role() in ('receptionist', 'pharmacist')
         else false
       end;
$$;

create or replace function audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Balance views — the answer to "how much is still owed?"
-- Nothing is stored: paid and balance are always recomputed from payments.
-- ---------------------------------------------------------------------------
create or replace view v_treatment_balances as
select
  t.id                              as treatment_id,
  t.patient_id,
  t.plan_id,
  t.dentist_id,
  t.treatment_type_id,
  tt.name                           as treatment_name,
  tt.category                       as treatment_category,
  t.tooth_numbers,
  t.status,
  t.is_waived,
  t.planned_date,
  t.completed_at,
  t.created_at,
  t.estimated_cost,
  t.discount,
  t.final_cost,
  coalesce(p.paid, 0)               as amount_paid,
  greatest(t.final_cost - coalesce(p.paid, 0), 0) as balance,
  p.last_payment_at,
  p.payment_count,
  case
    when t.is_waived                                then 'waived'::payment_status
    when coalesce(p.paid, 0) <= 0                   then 'unpaid'::payment_status
    when coalesce(p.paid, 0) >= t.final_cost        then 'paid'::payment_status
    else 'partial'::payment_status
  end                               as payment_status
from treatments t
left join treatment_types tt on tt.id = t.treatment_type_id
left join lateral (
  select sum(amount) as paid, max(paid_at) as last_payment_at, count(*) as payment_count
  from payments
  where treatment_id = t.id and voided_at is null
) p on true
where t.archived_at is null and t.status <> 'cancelled';

create or replace view v_patient_balances as
select
  pt.id                                   as patient_id,
  pt.patient_code,
  pt.full_name,
  pt.phone,
  pt.status,
  coalesce(sum(b.final_cost), 0)          as total_billed,
  coalesce(sum(b.amount_paid), 0)         as total_paid,
  coalesce(sum(b.balance), 0)             as total_balance,
  max(b.last_payment_at)                  as last_payment_at,
  count(b.treatment_id) filter (where b.balance > 0) as unpaid_treatments
from patients pt
left join v_treatment_balances b on b.patient_id = pt.id and not b.is_waived
where pt.archived_at is null
group by pt.id, pt.patient_code, pt.full_name, pt.phone, pt.status;

-- Outstanding balances page: one row per unsettled treatment, with the next
-- appointment so reception can chase payment at the right moment.
create or replace view v_outstanding_balances as
select
  b.treatment_id,
  b.patient_id,
  pt.patient_code,
  pt.full_name,
  pt.phone,
  b.treatment_name,
  b.treatment_category,
  b.final_cost,
  b.amount_paid,
  b.balance,
  b.payment_status,
  b.last_payment_at,
  b.created_at,
  (oc.id is not null)                     as is_orthodontic,
  oc.id                                   as ortho_case_id,
  (select min(a.scheduled_at) from appointments a
    where a.patient_id = b.patient_id
      and a.scheduled_at >= now()
      and a.status not in ('cancelled', 'no_show'))  as next_appointment_at
from v_treatment_balances b
join patients pt on pt.id = b.patient_id
left join orthodontic_cases oc on oc.treatment_id = b.treatment_id
where b.balance > 0 and not b.is_waived;

-- Live stock per medicine, with expiry-aware status.
create or replace view v_medicine_stock as
select
  m.id                     as medicine_id,
  m.name,
  m.generic_name,
  m.dosage_form,
  m.strength,
  m.barcode,
  m.category_id,
  mc.name                  as category_name,
  m.purchase_price,
  m.selling_price,
  m.minimum_stock,
  m.is_active,
  coalesce(s.total_qty, 0)         as total_quantity,
  coalesce(s.usable_qty, 0)        as usable_quantity,
  coalesce(s.expired_qty, 0)       as expired_quantity,
  s.earliest_expiry,
  case
    when coalesce(s.usable_qty, 0) = 0                                then 'out_of_stock'
    when coalesce(s.usable_qty, 0) <= m.minimum_stock                 then 'low_stock'
    when s.earliest_expiry is not null
         and s.earliest_expiry <= current_date + (
           select expiry_warning_days from clinic_settings limit 1)   then 'expiring_soon'
    else 'in_stock'
  end                              as stock_status
from medicines m
left join medicine_categories mc on mc.id = m.category_id
left join lateral (
  select
    sum(quantity)                                                    as total_qty,
    sum(quantity) filter (where expiry_date is null or expiry_date > current_date) as usable_qty,
    sum(quantity) filter (where expiry_date is not null and expiry_date <= current_date) as expired_qty,
    min(expiry_date) filter (where quantity > 0 and (expiry_date is null or expiry_date > current_date)) as earliest_expiry
  from pharmacy_stock where medicine_id = m.id
) s on true;

-- ---------------------------------------------------------------------------
-- Tooth chart: keep history, never overwrite
-- ---------------------------------------------------------------------------
create or replace function tooth_records_close_previous() returns trigger
language plpgsql as $$
begin
  update tooth_records
     set is_current = false
   where patient_id = new.patient_id
     and tooth_number = new.tooth_number
     and is_current;
  return new;
end $$;

-- BEFORE INSERT: the partial unique index on (patient_id, tooth_number) where
-- is_current is checked as the row goes in, so the previous record has to be
-- closed first.
create trigger tooth_records_history
  before insert on tooth_records
  for each row when (new.is_current)
  execute function tooth_records_close_previous();

create or replace function record_tooth_condition(
  p_patient_id         uuid,
  p_tooth_number       smallint,
  p_condition          tooth_condition,
  p_proposed_treatment text default null,
  p_existing_treatment text default null,
  p_surface            text default null,
  p_notes              text default null,
  p_examination_id     uuid default null
) returns tooth_records
language plpgsql security definer set search_path = public as $$
declare rec tooth_records;
begin
  if not has_perm('clinical.write') then
    raise exception 'Not authorised to record clinical findings' using errcode = '42501';
  end if;

  insert into tooth_records (
    patient_id, tooth_number, condition, proposed_treatment, existing_treatment,
    surface, notes, examination_id, recorded_by)
  values (
    p_patient_id, p_tooth_number, p_condition, p_proposed_treatment, p_existing_treatment,
    p_surface, p_notes, p_examination_id, auth.uid())
  returning * into rec;

  perform audit('tooth.record', 'tooth_records', rec.id,
                jsonb_build_object('patient_id', p_patient_id,
                                   'tooth', p_tooth_number,
                                   'condition', p_condition));
  return rec;
end $$;

-- ---------------------------------------------------------------------------
-- Payments — the installment ("hafto") engine
-- ---------------------------------------------------------------------------
create or replace function record_payment(
  p_treatment_id  uuid,
  p_amount        numeric,
  p_method        payment_method default 'cash',
  p_paid_at       timestamptz default now(),
  p_reference     text default null,
  p_notes         text default null,
  p_ortho_case_id uuid default null,
  p_client_token  text default null,
  p_allow_overpay boolean default false
) returns payments
language plpgsql security definer set search_path = public as $$
declare
  v_treatment treatments;
  v_paid      numeric(12,2);
  v_balance   numeric(12,2);
  v_payment   payments;
begin
  if not has_perm('finance.write') then
    raise exception 'Not authorised to record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  -- Idempotency: a repeated submit with the same token returns the first payment
  -- instead of creating a duplicate.
  if p_client_token is not null then
    select * into v_payment from payments where client_token = p_client_token;
    if found then
      return v_payment;
    end if;
  end if;

  -- Lock the treatment so two cashiers cannot both overpay the same balance.
  select * into v_treatment from treatments where id = p_treatment_id for update;
  if not found then
    raise exception 'Treatment not found';
  end if;
  if v_treatment.archived_at is not null or v_treatment.status = 'cancelled' then
    raise exception 'Cannot take payment against a cancelled or archived treatment';
  end if;

  select coalesce(sum(amount), 0) into v_paid
    from payments where treatment_id = p_treatment_id and voided_at is null;

  v_balance := v_treatment.final_cost - v_paid;

  if not p_allow_overpay and p_amount > v_balance then
    raise exception 'Payment of % exceeds the remaining balance of %', p_amount, v_balance
      using errcode = '22003';
  end if;

  insert into payments (
    patient_id, treatment_id, ortho_case_id, amount, method, paid_at,
    reference, notes, client_token, received_by)
  values (
    v_treatment.patient_id, p_treatment_id, p_ortho_case_id, p_amount, p_method,
    coalesce(p_paid_at, now()), p_reference, p_notes, p_client_token, auth.uid())
  returning * into v_payment;

  perform audit('payment.record', 'payments', v_payment.id,
                jsonb_build_object('treatment_id', p_treatment_id,
                                   'amount', p_amount,
                                   'method', p_method,
                                   'balance_before', v_balance));
  return v_payment;
end $$;

-- Payments are never deleted. A mistake is voided, leaving both rows visible.
create or replace function void_payment(p_payment_id uuid, p_reason text)
returns payments
language plpgsql security definer set search_path = public as $$
declare v_payment payments;
begin
  if not is_admin() then
    raise exception 'Only an administrator can void a payment' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required when voiding a payment';
  end if;

  update payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
   where id = p_payment_id and voided_at is null
  returning * into v_payment;

  if not found then
    raise exception 'Payment not found or already voided';
  end if;

  perform audit('payment.void', 'payments', p_payment_id,
                jsonb_build_object('reason', p_reason, 'amount', v_payment.amount));
  return v_payment;
end $$;

-- ---------------------------------------------------------------------------
-- Orthodontics: create the billable treatment and the case together
-- ---------------------------------------------------------------------------
create or replace function create_orthodontic_case(
  p_patient_id       uuid,
  p_dentist_id       uuid,
  p_total_cost       numeric,
  p_braces_type      text default 'Metal fixed',
  p_upper_arch       boolean default true,
  p_lower_arch       boolean default true,
  p_estimated_months integer default 18,
  p_start_date       date default current_date,
  p_discount         numeric default 0,
  p_notes            text default null
) returns orthodontic_cases
language plpgsql security definer set search_path = public as $$
declare
  v_type_id uuid;
  v_treatment treatments;
  v_case orthodontic_cases;
begin
  if not has_perm('clinical.write') then
    raise exception 'Not authorised to create treatment records' using errcode = '42501';
  end if;

  select id into v_type_id from treatment_types where code = 'ORTHO' limit 1;

  insert into treatments (
    patient_id, treatment_type_id, dentist_id, description,
    estimated_cost, discount, status, planned_date, created_by)
  values (
    p_patient_id, v_type_id, p_dentist_id,
    coalesce(p_braces_type, 'Orthodontic treatment'),
    p_total_cost, coalesce(p_discount, 0), 'in_progress', p_start_date, auth.uid())
  returning * into v_treatment;

  insert into orthodontic_cases (
    patient_id, treatment_id, dentist_id, braces_type, upper_arch, lower_arch,
    start_date, estimated_months, status, notes, created_by)
  values (
    p_patient_id, v_treatment.id, p_dentist_id, p_braces_type, p_upper_arch, p_lower_arch,
    p_start_date, p_estimated_months, 'active', p_notes, auth.uid())
  returning * into v_case;

  perform audit('ortho.create', 'orthodontic_cases', v_case.id,
                jsonb_build_object('patient_id', p_patient_id, 'total_cost', p_total_cost));
  return v_case;
end $$;

-- ---------------------------------------------------------------------------
-- Appointments: check-in assigns the next queue number of the day
-- ---------------------------------------------------------------------------
create or replace function check_in_appointment(p_appointment_id uuid)
returns appointments
language plpgsql security definer set search_path = public as $$
declare
  v_next integer;
  v_appt appointments;
begin
  if not has_perm('appointments.write') then
    raise exception 'Not authorised to check patients in' using errcode = '42501';
  end if;

  select coalesce(max(queue_number), 0) + 1 into v_next
    from appointments
   where scheduled_at::date = current_date and queue_number is not null;

  update appointments
     set status = 'checked_in', queue_state = 'waiting',
         queue_number = coalesce(queue_number, v_next), checked_in_at = now()
   where id = p_appointment_id
     and status in ('scheduled', 'confirmed')
  returning * into v_appt;

  if not found then
    raise exception 'Appointment cannot be checked in from its current status';
  end if;

  perform audit('appointment.check_in', 'appointments', p_appointment_id,
                jsonb_build_object('queue_number', v_appt.queue_number));
  return v_appt;
end $$;

-- ---------------------------------------------------------------------------
-- Pharmacy: stock movement helper (single place that writes stock)
-- ---------------------------------------------------------------------------
create or replace function apply_stock_change(
  p_stock_id   uuid,
  p_change     integer,
  p_type       stock_movement_type,
  p_reason     text,
  p_ref_table  text default null,
  p_ref_id     uuid default null
) returns pharmacy_stock
language plpgsql security definer set search_path = public as $$
declare
  v_stock  pharmacy_stock;
  v_before integer;
begin
  select * into v_stock from pharmacy_stock where id = p_stock_id for update;
  if not found then
    raise exception 'Stock batch not found';
  end if;

  v_before := v_stock.quantity;
  if v_before + p_change < 0 then
    raise exception 'Insufficient stock: % available, % requested', v_before, abs(p_change)
      using errcode = '23514';
  end if;

  update pharmacy_stock set quantity = quantity + p_change
   where id = p_stock_id returning * into v_stock;

  insert into stock_movements (
    medicine_id, stock_id, movement_type, quantity_before, quantity_change,
    quantity_after, reason, reference_table, reference_id, performed_by)
  values (
    v_stock.medicine_id, p_stock_id, p_type, v_before, p_change,
    v_stock.quantity, p_reason, p_ref_table, p_ref_id, auth.uid());

  return v_stock;
end $$;

-- Deduct a quantity across batches, first-expiring-first, skipping expired stock.
create or replace function consume_stock(
  p_medicine_id uuid,
  p_quantity    integer,
  p_type        stock_movement_type,
  p_reason      text,
  p_ref_table   text,
  p_ref_id      uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_remaining integer := p_quantity;
  v_batch     record;
  v_take      integer;
  v_available integer;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select coalesce(sum(quantity), 0) into v_available
    from pharmacy_stock
   where medicine_id = p_medicine_id
     and quantity > 0
     and (expiry_date is null or expiry_date > current_date);

  if v_available < p_quantity then
    raise exception 'Only % usable unit(s) in stock, % requested', v_available, p_quantity
      using errcode = '23514';
  end if;

  for v_batch in
    select id, quantity from pharmacy_stock
     where medicine_id = p_medicine_id
       and quantity > 0
       and (expiry_date is null or expiry_date > current_date)   -- never dispense expired
     order by expiry_date nulls last, received_at
     for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_batch.quantity, v_remaining);
    perform apply_stock_change(v_batch.id, -v_take, p_type, p_reason, p_ref_table, p_ref_id);
    v_remaining := v_remaining - v_take;
  end loop;
end $$;

-- Dispense a prescription: p_items is [{"item_id": uuid, "quantity": int}, ...]
create or replace function dispense_prescription(p_prescription_id uuid, p_items jsonb)
returns prescriptions
language plpgsql security definer set search_path = public as $$
declare
  v_rx      prescriptions;
  v_item    record;
  v_row     prescription_items;
  v_qty     integer;
  v_pending integer;
begin
  if not has_perm('pharmacy.write') then
    raise exception 'Not authorised to dispense medicine' using errcode = '42501';
  end if;

  select * into v_rx from prescriptions where id = p_prescription_id for update;
  if not found then raise exception 'Prescription not found'; end if;
  if v_rx.status = 'cancelled' then raise exception 'Prescription was cancelled'; end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(item_id uuid, quantity integer)
  loop
    select * into v_row from prescription_items
      where id = v_item.item_id and prescription_id = p_prescription_id for update;
    if not found then raise exception 'Prescription item not found'; end if;

    v_qty := v_item.quantity;
    if v_qty <= 0 then continue; end if;
    if v_row.dispensed_quantity + v_qty > v_row.quantity then
      raise exception 'Cannot dispense more than prescribed for %', v_row.medicine_name;
    end if;
    if v_row.medicine_id is null then
      raise exception 'Prescription item % is not linked to a stocked medicine', v_row.medicine_name;
    end if;

    perform consume_stock(v_row.medicine_id, v_qty, 'dispense',
                          'Prescription ' || v_rx.prescription_number,
                          'prescriptions', p_prescription_id);

    update prescription_items
       set dispensed_quantity = dispensed_quantity + v_qty
     where id = v_row.id;
  end loop;

  select count(*) into v_pending
    from prescription_items
   where prescription_id = p_prescription_id and dispensed_quantity < quantity;

  update prescriptions
     set status = case
                    when v_pending = 0 then 'dispensed'::prescription_status
                    when exists (select 1 from prescription_items
                                  where prescription_id = p_prescription_id and dispensed_quantity > 0)
                      then 'partially_dispensed'::prescription_status
                    else 'pending'::prescription_status
                  end
   where id = p_prescription_id
  returning * into v_rx;

  perform audit('prescription.dispense', 'prescriptions', p_prescription_id, p_items);
  return v_rx;
end $$;

-- Walk-in or patient-linked sale. p_items is [{"medicine_id": uuid, "quantity": int, "unit_price": numeric}]
create or replace function create_pharmacy_sale(
  p_items          jsonb,
  p_patient_id     uuid default null,
  p_prescription_id uuid default null,
  p_method         payment_method default 'cash',
  p_notes          text default null,
  p_client_token   text default null
) returns pharmacy_sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale  pharmacy_sales;
  v_item  record;
  v_total numeric(12,2) := 0;
begin
  if not has_perm('pharmacy.write') then
    raise exception 'Not authorised to record pharmacy sales' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'A sale needs at least one medicine';
  end if;

  if p_client_token is not null then
    select * into v_sale from pharmacy_sales where client_token = p_client_token;
    if found then return v_sale; end if;
  end if;

  insert into pharmacy_sales (patient_id, prescription_id, payment_method, notes,
                              client_token, sold_by)
  values (p_patient_id, p_prescription_id, p_method, p_notes, p_client_token, auth.uid())
  returning * into v_sale;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(medicine_id uuid, quantity integer, unit_price numeric)
  loop
    perform consume_stock(v_item.medicine_id, v_item.quantity, 'sale',
                          'Sale ' || v_sale.sale_number, 'pharmacy_sales', v_sale.id);

    insert into pharmacy_sale_items (sale_id, medicine_id, quantity, unit_price)
    values (v_sale.id, v_item.medicine_id, v_item.quantity, v_item.unit_price);

    v_total := v_total + (v_item.quantity * v_item.unit_price);
  end loop;

  update pharmacy_sales set total_amount = v_total where id = v_sale.id returning * into v_sale;

  perform audit('pharmacy.sale', 'pharmacy_sales', v_sale.id,
                jsonb_build_object('total', v_total, 'items', p_items));
  return v_sale;
end $$;

-- Confirming a purchase is what actually increases stock.
create or replace function confirm_purchase(p_purchase_id uuid)
returns pharmacy_purchases
language plpgsql security definer set search_path = public as $$
declare
  v_purchase pharmacy_purchases;
  v_item     record;
  v_stock_id uuid;
  v_total    numeric(12,2) := 0;
begin
  if not has_perm('pharmacy.write') then
    raise exception 'Not authorised to confirm purchases' using errcode = '42501';
  end if;

  select * into v_purchase from pharmacy_purchases where id = p_purchase_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  if v_purchase.status <> 'draft' then
    raise exception 'Purchase is already % ', v_purchase.status;
  end if;

  for v_item in select * from pharmacy_purchase_items where purchase_id = p_purchase_id
  loop
    insert into pharmacy_stock (medicine_id, batch_number, expiry_date, quantity,
                                purchase_price, supplier_id)
    values (v_item.medicine_id, v_item.batch_number, v_item.expiry_date, 0,
            v_item.purchase_price, v_purchase.supplier_id)
    on conflict (medicine_id, batch_number, expiry_date) do update
      set purchase_price = excluded.purchase_price
    returning id into v_stock_id;

    perform apply_stock_change(v_stock_id, v_item.quantity, 'purchase',
                               'Purchase ' || v_purchase.purchase_number,
                               'pharmacy_purchases', p_purchase_id);

    v_total := v_total + v_item.line_total;
  end loop;

  update pharmacy_purchases
     set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid(),
         total_amount = v_total
   where id = p_purchase_id
  returning * into v_purchase;

  perform audit('pharmacy.purchase_confirm', 'pharmacy_purchases', p_purchase_id,
                jsonb_build_object('total', v_total));
  return v_purchase;
end $$;

create or replace function adjust_stock(
  p_stock_id uuid, p_change integer, p_type stock_movement_type, p_reason text)
returns pharmacy_stock
language plpgsql security definer set search_path = public as $$
begin
  if not has_perm('pharmacy.write') then
    raise exception 'Not authorised to adjust stock' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required for a stock adjustment';
  end if;
  return apply_stock_change(p_stock_id, p_change, p_type, p_reason, null, null);
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard: one round-trip for the whole home screen
-- ---------------------------------------------------------------------------
-- dashboard_summary() runs as SECURITY DEFINER so it can aggregate in one
-- round-trip, which means RLS does not filter it. The permission checks are
-- therefore made explicitly: a pharmacist never receives the finance figures,
-- and reception never receives pharmacy stock counts.
create or replace function dashboard_summary()
returns jsonb
language sql stable security definer set search_path = public as $$
  select
    jsonb_build_object(
      'patients_total',     (select count(*) from patients where archived_at is null),
      'patients_today',     (select count(*) from patients where registered_at::date = current_date),
      'appointments_today', (select count(*) from appointments where scheduled_at::date = current_date),
      'appointments_done',  (select count(*) from appointments
                              where scheduled_at::date = current_date and status = 'completed'),
      'waiting_now',        (select count(*) from appointments where queue_state in ('waiting','called')),
      'treatments_today',   (select count(*) from treatments where created_at::date = current_date)
    )
    ||
    case when has_perm('finance.read') then jsonb_build_object(
      'treatment_income',    (select coalesce(sum(amount),0) from payments
                               where paid_at::date = current_date and voided_at is null
                                 and treatment_id is not null),
      'pharmacy_income',     (select coalesce(sum(total_amount),0) from pharmacy_sales
                               where sold_at::date = current_date and voided_at is null),
      'expenses_today',      (select coalesce(sum(amount),0) from expenses
                               where expense_date = current_date),
      'outstanding_total',   (select coalesce(sum(balance),0) from v_outstanding_balances),
      'outstanding_patients',(select count(distinct patient_id) from v_outstanding_balances),
      'partial_patients',    (select count(*) from v_outstanding_balances where payment_status = 'partial'),
      'unpaid_patients',     (select count(*) from v_outstanding_balances where payment_status = 'unpaid')
    ) else jsonb_build_object(
      'treatment_income', 0, 'pharmacy_income', 0, 'expenses_today', 0,
      'outstanding_total', 0, 'outstanding_patients', 0,
      'partial_patients', 0, 'unpaid_patients', 0
    ) end
    ||
    case when has_perm('pharmacy.read') then jsonb_build_object(
      'low_stock',     (select count(*) from v_medicine_stock
                         where stock_status in ('low_stock','out_of_stock') and is_active),
      'expiring_soon', (select count(*) from v_medicine_stock
                         where stock_status = 'expiring_soon' and is_active)
    ) else jsonb_build_object('low_stock', 0, 'expiring_soon', 0) end
  where is_staff();
$$;

-- ---------------------------------------------------------------------------
-- Audit triggers on the tables that matter most
-- ---------------------------------------------------------------------------
create or replace function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_id  uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  -- Most audited tables key on a uuid, but clinic_settings is a single-row
  -- table keyed on a boolean, so the cast is allowed to fail.
  begin
    v_id := (v_row ->> 'id')::uuid;
  exception when others then
    v_id := null;
  end;

  insert into audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_table_name) || '.' || lower(tg_op), tg_table_name, v_id, v_row);

  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'patients','treatments','treatment_plans','prescriptions','expenses',
    'medicines','user_permissions','profiles','clinic_settings'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on %I
         for each row execute function audit_row_change()', tbl, tbl);
  end loop;
end $$;

-- New auth users get a profile automatically (role assigned by an admin after).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'receptionist'),
    'active')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
