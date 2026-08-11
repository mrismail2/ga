-- ============================================================================
-- Row Level Security
--
-- Nothing is readable or writable without an active staff profile. Menus are
-- hidden in the UI for convenience only — these policies are the real gate.
-- ============================================================================

alter table profiles                enable row level security;
alter table user_permissions        enable row level security;
alter table patients                enable row level security;
alter table patient_medical_history enable row level security;
alter table dental_examinations     enable row level security;
alter table tooth_records           enable row level security;
alter table treatment_types         enable row level security;
alter table treatment_plans         enable row level security;
alter table treatments              enable row level security;
alter table orthodontic_cases       enable row level security;
alter table orthodontic_visits      enable row level security;
alter table appointments            enable row level security;
alter table medicine_categories     enable row level security;
alter table medicines               enable row level security;
alter table pharmacy_stock          enable row level security;
alter table stock_movements         enable row level security;
alter table suppliers               enable row level security;
alter table pharmacy_purchases      enable row level security;
alter table pharmacy_purchase_items enable row level security;
alter table pharmacy_sales          enable row level security;
alter table pharmacy_sale_items     enable row level security;
alter table prescriptions           enable row level security;
alter table prescription_items      enable row level security;
alter table payments                enable row level security;
alter table expenses                enable row level security;
alter table documents               enable row level security;
alter table audit_logs              enable row level security;
alter table clinic_settings         enable row level security;

-- ---------------------------------------------------------------------------
-- Staff & permissions
-- ---------------------------------------------------------------------------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_staff());
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = app_role());
create policy profiles_admin_all on profiles
  for all using (is_admin()) with check (is_admin());

create policy perms_read  on user_permissions for select using (user_id = auth.uid() or is_admin());
create policy perms_admin on user_permissions for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Patients and clinical records
-- ---------------------------------------------------------------------------
create policy patients_read   on patients for select using (has_perm('patients.read'));
create policy patients_insert on patients for insert with check (has_perm('patients.write'));
create policy patients_update on patients for update using (has_perm('patients.write'))
                                                 with check (has_perm('patients.write'));
-- Patients are archived, never deleted; only an admin may do even that.
create policy patients_delete on patients for delete using (is_admin());

create policy pmh_read  on patient_medical_history for select using (has_perm('clinical.read'));
create policy pmh_write on patient_medical_history for insert with check (has_perm('clinical.write'));

create policy exams_read   on dental_examinations for select using (has_perm('clinical.read'));
create policy exams_insert on dental_examinations for insert with check (has_perm('clinical.write'));
create policy exams_update on dental_examinations for update
  using (has_perm('clinical.write') and (dentist_id = auth.uid() or is_admin()))
  with check (has_perm('clinical.write'));

create policy tooth_read   on tooth_records for select using (has_perm('clinical.read'));
create policy tooth_insert on tooth_records for insert with check (has_perm('clinical.write'));
-- No update/delete policy: the chart is append-only by design.

create policy tt_read  on treatment_types for select using (is_staff());
create policy tt_admin on treatment_types for all using (is_admin()) with check (is_admin());

create policy plans_read   on treatment_plans for select using (has_perm('clinical.read'));
create policy plans_write  on treatment_plans for insert with check (has_perm('clinical.write'));
create policy plans_update on treatment_plans for update using (has_perm('clinical.write'))
                                                       with check (has_perm('clinical.write'));

create policy treatments_read   on treatments for select
  using (has_perm('clinical.read') or has_perm('finance.read'));
create policy treatments_insert on treatments for insert with check (has_perm('clinical.write'));
create policy treatments_update on treatments for update using (has_perm('clinical.write'))
                                                    with check (has_perm('clinical.write'));

create policy ortho_read   on orthodontic_cases for select
  using (has_perm('clinical.read') or has_perm('finance.read'));
create policy ortho_write  on orthodontic_cases for insert with check (has_perm('clinical.write'));
create policy ortho_update on orthodontic_cases for update using (has_perm('clinical.write'))
                                                      with check (has_perm('clinical.write'));

create policy ortho_visits_read  on orthodontic_visits for select using (has_perm('clinical.read'));
create policy ortho_visits_write on orthodontic_visits for insert with check (has_perm('clinical.write'));

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
create policy appts_read   on appointments for select using (has_perm('appointments.read'));
create policy appts_insert on appointments for insert with check (has_perm('appointments.write'));
create policy appts_update on appointments for update
  using (has_perm('appointments.write') or (has_perm('clinical.write') and dentist_id = auth.uid()))
  with check (has_perm('appointments.write') or has_perm('clinical.write'));

-- ---------------------------------------------------------------------------
-- Money: read for finance roles, writes only through the RPCs
-- ---------------------------------------------------------------------------
create policy payments_read on payments for select using (has_perm('finance.read'));
-- No insert/update/delete policy: record_payment() and void_payment() are
-- SECURITY DEFINER and are the only supported way in.

create policy expenses_read   on expenses for select using (has_perm('finance.read'));
create policy expenses_insert on expenses for insert with check (has_perm('finance.write'));
create policy expenses_update on expenses for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Prescriptions — dentists write, pharmacy reads and dispenses
-- ---------------------------------------------------------------------------
create policy rx_read   on prescriptions for select
  using (has_perm('clinical.read') or has_perm('pharmacy.read'));
create policy rx_insert on prescriptions for insert with check (has_perm('clinical.write'));
create policy rx_update on prescriptions for update
  using (has_perm('clinical.write') and dentist_id = auth.uid())
  with check (has_perm('clinical.write'));

create policy rx_items_read   on prescription_items for select
  using (has_perm('clinical.read') or has_perm('pharmacy.read'));
create policy rx_items_insert on prescription_items for insert with check (has_perm('clinical.write'));

-- ---------------------------------------------------------------------------
-- Pharmacy
-- ---------------------------------------------------------------------------
create policy medcat_read  on medicine_categories for select using (is_staff());
create policy medcat_write on medicine_categories for all
  using (has_perm('pharmacy.write')) with check (has_perm('pharmacy.write'));

create policy meds_read  on medicines for select using (is_staff());
create policy meds_write on medicines for all
  using (has_perm('pharmacy.write')) with check (has_perm('pharmacy.write'));

create policy stock_read on pharmacy_stock for select using (has_perm('pharmacy.read') or is_admin());
-- Stock rows are only written by apply_stock_change() / confirm_purchase().

create policy movements_read on stock_movements for select using (has_perm('pharmacy.read') or is_admin());

create policy suppliers_read  on suppliers for select using (has_perm('pharmacy.read') or is_admin());
create policy suppliers_write on suppliers for all
  using (has_perm('pharmacy.write')) with check (has_perm('pharmacy.write'));

create policy purchases_read  on pharmacy_purchases for select using (has_perm('pharmacy.read') or is_admin());
create policy purchases_write on pharmacy_purchases for insert with check (has_perm('pharmacy.write'));
create policy purchases_update on pharmacy_purchases for update
  using (has_perm('pharmacy.write') and status = 'draft') with check (has_perm('pharmacy.write'));

create policy purchase_items_read  on pharmacy_purchase_items for select
  using (has_perm('pharmacy.read') or is_admin());
create policy purchase_items_write on pharmacy_purchase_items for all
  using (has_perm('pharmacy.write')) with check (has_perm('pharmacy.write'));

create policy sales_read on pharmacy_sales for select
  using (has_perm('pharmacy.read') or has_perm('finance.read'));
create policy sale_items_read on pharmacy_sale_items for select
  using (has_perm('pharmacy.read') or has_perm('finance.read'));
-- Sales are created by create_pharmacy_sale() only.

-- ---------------------------------------------------------------------------
-- Documents & audit
-- ---------------------------------------------------------------------------
create policy docs_read   on documents for select using (has_perm('clinical.read'));
create policy docs_insert on documents for insert with check (has_perm('clinical.write'));
create policy docs_delete on documents for delete using (is_admin());

create policy audit_read on audit_logs for select using (is_admin());

create policy settings_read  on clinic_settings for select using (is_staff());
create policy settings_write on clinic_settings for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Views inherit the RLS of their base tables (security_invoker), so a
-- pharmacist querying v_outstanding_balances still sees nothing.
-- ---------------------------------------------------------------------------
alter view v_treatment_balances   set (security_invoker = on);
alter view v_patient_balances     set (security_invoker = on);
alter view v_outstanding_balances set (security_invoker = on);
alter view v_medicine_stock       set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- Private storage bucket for patient documents
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('patient-documents', 'patient-documents', false)
on conflict (id) do nothing;

create policy "clinical staff read patient documents" on storage.objects
  for select using (bucket_id = 'patient-documents' and has_perm('clinical.read'));
create policy "clinical staff upload patient documents" on storage.objects
  for insert with check (bucket_id = 'patient-documents' and has_perm('clinical.write'));
create policy "admin removes patient documents" on storage.objects
  for delete using (bucket_id = 'patient-documents' and is_admin());
