-- ============================================================================
-- Business-rule tests (local Postgres, not part of the deployed migrations).
--
-- These exercise the rules the clinic depends on: installment balances,
-- duplicate-payment protection, stock and expiry enforcement, the tooth-chart
-- history and appointment double-booking.
--
--   psql -d clinic -v ON_ERROR_STOP=1 -f supabase/test/01_business_rules.sql
-- ============================================================================

\set QUIET on
set client_min_messages = notice;

create or replace function assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_condition then
    raise notice 'PASS  %', p_label;
  else
    raise exception 'FAIL  %', p_label;
  end if;
end $$;

-- --- fixtures ---------------------------------------------------------------
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_dentist uuid := gen_random_uuid();
begin
  -- Creating the auth user is enough: the on_auth_user_created trigger makes
  -- the matching profile automatically. Only the role has to be set here.
  insert into auth.users (id, email) values (v_admin, 'admin@clinic.test'), (v_dentist, 'dentist@clinic.test');
  perform assert((select count(*) from profiles where id in (v_admin, v_dentist)) = 2,
                 'a profile is created automatically for each new auth user');
  update profiles set full_name = 'Test Admin',   role = 'admin'   where id = v_admin;
  update profiles set full_name = 'Test Dentist', role = 'dentist' where id = v_dentist;
  perform set_config('request.jwt.claim.sub', v_admin::text, false);
end $$;

\set QUIET off

-- ============================================================================
-- 1. Installment payments: balance is always derived, never stored
-- ============================================================================
do $$
declare
  v_patient   uuid;
  v_treatment uuid;
  v_row       record;
begin
  insert into patients (full_name, gender, age_years, phone)
  values ('Ahmed Mohamed', 'male', 30, '+252611111111')
  returning id into v_patient;

  insert into treatments (patient_id, treatment_type_id, estimated_cost, discount, status)
  values (v_patient, (select id from treatment_types where code = 'ORTHO'), 500, 0, 'in_progress')
  returning id into v_treatment;

  -- $500 braces, nothing paid yet
  select * into v_row from v_treatment_balances where treatment_id = v_treatment;
  perform assert(v_row.final_cost = 500 and v_row.amount_paid = 0
                 and v_row.balance = 500 and v_row.payment_status = 'unpaid',
                 'new treatment starts unpaid with the full balance');

  -- three installments: 100 + 50 + 100
  perform record_payment(v_treatment, 100, 'cash');
  perform record_payment(v_treatment, 50, 'evc_plus');
  perform record_payment(v_treatment, 100, 'zaad');

  select * into v_row from v_treatment_balances where treatment_id = v_treatment;
  perform assert(v_row.amount_paid = 250 and v_row.balance = 250
                 and v_row.payment_status = 'partial',
                 'three installments give paid 250 / remaining 250, status partial');

  -- paying more than the balance is refused
  begin
    perform record_payment(v_treatment, 400, 'cash');
    perform assert(false, 'overpayment should have been rejected');
  exception when others then
    perform assert(sqlerrm like '%exceeds the remaining balance%',
                   'a payment above the remaining balance is rejected');
  end;

  -- settling the rest closes the account
  perform record_payment(v_treatment, 250, 'cash');
  select * into v_row from v_treatment_balances where treatment_id = v_treatment;
  perform assert(v_row.balance = 0 and v_row.payment_status = 'paid',
                 'paying the remainder marks the treatment fully paid');

  perform assert((select count(*) from v_outstanding_balances where patient_id = v_patient) = 0,
                 'a fully paid treatment leaves the outstanding list');
end $$;

-- ============================================================================
-- 2. Double-click protection and voiding
-- ============================================================================
do $$
declare
  v_patient   uuid;
  v_treatment uuid;
  v_first     uuid;
  v_second    uuid;
  v_row       record;
begin
  insert into patients (full_name, gender, age_years, phone)
  values ('Zahra Ali', 'female', 24, '+252622222222') returning id into v_patient;

  insert into treatments (patient_id, treatment_type_id, estimated_cost, status)
  values (v_patient, (select id from treatment_types where code = 'FILLING'), 100, 'completed')
  returning id into v_treatment;

  select id into v_first  from record_payment(v_treatment, 40, 'cash', now(), null, null, null, 'token-abc');
  select id into v_second from record_payment(v_treatment, 40, 'cash', now(), null, null, null, 'token-abc');

  perform assert(v_first = v_second, 'resubmitting the same payment token returns the first payment');
  perform assert((select count(*) from payments where treatment_id = v_treatment) = 1,
                 'the duplicate submit did not create a second payment row');

  select * into v_row from v_treatment_balances where treatment_id = v_treatment;
  perform assert(v_row.amount_paid = 40 and v_row.balance = 60, 'balance reflects a single payment');

  -- voiding restores the balance and keeps the row
  perform void_payment(v_first, 'entered twice by mistake');
  select * into v_row from v_treatment_balances where treatment_id = v_treatment;
  perform assert(v_row.amount_paid = 0 and v_row.balance = 100,
                 'voiding a payment restores the balance');
  perform assert((select voided_at is not null from payments where id = v_first),
                 'the voided payment row is kept, not deleted');
end $$;

-- ============================================================================
-- 3. Tooth chart keeps history
-- ============================================================================
do $$
declare
  v_patient uuid;
  v_current tooth_condition;
begin
  insert into patients (full_name, gender, age_years, phone)
  values ('Hodan Farah', 'female', 19, '+252633333333') returning id into v_patient;

  perform record_tooth_condition(v_patient, 16::smallint, 'caries');
  perform record_tooth_condition(v_patient, 16::smallint, 'filling');

  perform assert((select count(*) from tooth_records
                  where patient_id = v_patient and tooth_number = 16) = 2,
                 'both tooth records are kept — history is not overwritten');

  select condition into v_current from tooth_records
   where patient_id = v_patient and tooth_number = 16 and is_current;
  perform assert(v_current = 'filling', 'only the latest tooth record is current');

  perform assert((select count(*) from tooth_records
                  where patient_id = v_patient and tooth_number = 16 and is_current) = 1,
                 'exactly one current record per tooth');
end $$;

-- ============================================================================
-- 4. Pharmacy: stock, expiry and prescriptions
-- ============================================================================
do $$
declare
  v_med       uuid;
  v_supplier  uuid;
  v_purchase  uuid;
  v_patient   uuid;
  v_rx        uuid;
  v_item      uuid;
  v_stock     record;
begin
  insert into suppliers (name) values ('Test Wholesaler') returning id into v_supplier;
  insert into medicines (name, strength, dosage_form, purchase_price, selling_price, minimum_stock)
  values ('Amoxicillin', '500mg', 'capsule', 0.20, 0.50, 20) returning id into v_med;

  insert into pharmacy_purchases (supplier_id, purchase_date) values (v_supplier, current_date)
  returning id into v_purchase;

  -- one good batch and one already expired
  insert into pharmacy_purchase_items (purchase_id, medicine_id, batch_number, expiry_date, quantity, purchase_price)
  values (v_purchase, v_med, 'B-GOOD', current_date + 180, 100, 0.20),
         (v_purchase, v_med, 'B-OLD',  current_date - 10,  50,  0.20);

  perform assert((select coalesce(sum(quantity), 0) from pharmacy_stock where medicine_id = v_med) = 0,
                 'a draft purchase does not change stock');

  perform confirm_purchase(v_purchase);

  select * into v_stock from v_medicine_stock where medicine_id = v_med;
  perform assert(v_stock.total_quantity = 150 and v_stock.usable_quantity = 100
                 and v_stock.expired_quantity = 50,
                 'confirming the purchase adds stock and separates the expired batch');

  -- dispense against a prescription
  insert into patients (full_name, gender, age_years, phone)
  values ('Bashir Duale', 'male', 45, '+252644444444') returning id into v_patient;

  insert into prescriptions (patient_id) values (v_patient) returning id into v_rx;
  insert into prescription_items (prescription_id, medicine_id, medicine_name, quantity)
  values (v_rx, v_med, 'Amoxicillin', 20) returning id into v_item;

  perform dispense_prescription(v_rx, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantity', 12)));

  select * into v_stock from v_medicine_stock where medicine_id = v_med;
  perform assert(v_stock.usable_quantity = 88, 'dispensing deducts from the usable batch only');
  perform assert((select status from prescriptions where id = v_rx) = 'partially_dispensed',
                 'a part-filled prescription is marked partially dispensed');

  perform dispense_prescription(v_rx, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantity', 8)));
  perform assert((select status from prescriptions where id = v_rx) = 'dispensed',
                 'the prescription closes once every item is fully dispensed');

  -- cannot dispense more than prescribed
  begin
    perform dispense_prescription(v_rx, jsonb_build_array(jsonb_build_object('item_id', v_item, 'quantity', 1)));
    perform assert(false, 'over-dispensing should have been rejected');
  exception when others then
    perform assert(sqlerrm like '%more than prescribed%', 'dispensing more than prescribed is rejected');
  end;

  -- cannot sell more than is in stock (expired units do not count)
  begin
    perform create_pharmacy_sale(
      jsonb_build_array(jsonb_build_object('medicine_id', v_med, 'quantity', 200, 'unit_price', 0.5)));
    perform assert(false, 'overselling should have been rejected');
  exception when others then
    perform assert(sqlerrm like '%usable unit%', 'selling more than the usable stock is rejected');
  end;

  perform create_pharmacy_sale(
    jsonb_build_array(jsonb_build_object('medicine_id', v_med, 'quantity', 10, 'unit_price', 0.5)));
  select * into v_stock from v_medicine_stock where medicine_id = v_med;
  perform assert(v_stock.usable_quantity = 70, 'a sale deducts stock');
  perform assert(v_stock.expired_quantity = 50, 'expired stock is never dispensed or sold');
end $$;

-- ============================================================================
-- 5. Appointments: no double booking for the same dentist
-- ============================================================================
do $$
declare
  v_patient uuid;
  v_dentist uuid := (select id from profiles where role = 'dentist' limit 1);
  v_appt    uuid;
begin
  insert into patients (full_name, gender, age_years, phone)
  values ('Muna Yusuf', 'female', 33, '+252655555555') returning id into v_patient;

  insert into appointments (patient_id, dentist_id, scheduled_at, duration_minutes)
  values (v_patient, v_dentist, date_trunc('hour', now() + interval '1 day'), 60)
  returning id into v_appt;

  begin
    insert into appointments (patient_id, dentist_id, scheduled_at, duration_minutes)
    values (v_patient, v_dentist, date_trunc('hour', now() + interval '1 day') + interval '30 minutes', 30);
    perform assert(false, 'overlapping appointment should have been rejected');
  exception when exclusion_violation then
    perform assert(true, 'a dentist cannot be double-booked for overlapping times');
  end;

  -- a slot that does not overlap is fine
  insert into appointments (patient_id, dentist_id, scheduled_at, duration_minutes)
  values (v_patient, v_dentist, date_trunc('hour', now() + interval '1 day') + interval '90 minutes', 30);
  perform assert(true, 'a non-overlapping appointment is accepted');

  -- check-in assigns a queue number
  update appointments set scheduled_at = now() where id = v_appt;
  perform check_in_appointment(v_appt);
  perform assert((select queue_number from appointments where id = v_appt) is not null,
                 'checking in assigns a queue number');
end $$;

-- ============================================================================
-- 6. Data integrity guards
-- ============================================================================
do $$
declare
  v_patient uuid;
  v_treatment uuid;
begin
  insert into patients (full_name, gender, age_years, phone)
  values ('Guard Test', 'male', 40, '+252666666666') returning id into v_patient;

  insert into treatments (patient_id, estimated_cost, status)
  values (v_patient, 100, 'in_progress') returning id into v_treatment;

  begin
    perform record_payment(v_treatment, -50, 'cash');
    perform assert(false, 'negative payment should have been rejected');
  exception when others then
    perform assert(sqlerrm like '%greater than zero%', 'a negative payment amount is rejected');
  end;

  begin
    insert into treatments (patient_id, estimated_cost, discount) values (v_patient, 50, 100);
    perform assert(false, 'discount above cost should have been rejected');
  exception when check_violation then
    perform assert(true, 'a discount larger than the cost is rejected');
  end;

  begin
    insert into patients (full_name, gender, phone) values ('No Age', 'male', '+252677777777');
    perform assert(false, 'patient without age or date of birth should have been rejected');
  exception when check_violation then
    perform assert(true, 'a patient needs either a date of birth or an age');
  end;

  perform assert((select count(*) from audit_logs where entity = 'payments') > 0,
                 'payments are written to the audit log');
end $$;

\echo ''
\echo '================================================'
\echo ' All business-rule tests passed.'
\echo '================================================'
