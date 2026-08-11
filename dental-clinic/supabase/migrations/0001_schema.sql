-- ============================================================================
-- Dental Clinic Management System — core schema
-- Single clinic, single internal pharmacy.
--
-- Design rules applied throughout:
--   * UUID primary keys, created_at / updated_at on every mutable table
--   * Money is numeric(12,2); quantities are integers
--   * Financial balances are DERIVED from payment rows (see 0002_functions.sql),
--     never stored in a mutable column that can drift
--   * Clinical and financial history is append-only: rows are voided or
--     archived, never hard-deleted
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type user_role          as enum ('admin', 'dentist', 'receptionist', 'pharmacist');
create type staff_status       as enum ('active', 'inactive');
create type gender_type        as enum ('male', 'female');
create type patient_status     as enum ('active', 'inactive');

create type appointment_status as enum
  ('scheduled', 'confirmed', 'checked_in', 'waiting', 'in_treatment', 'completed', 'cancelled', 'no_show');
create type queue_status       as enum ('waiting', 'called', 'in_treatment', 'completed');

create type treatment_status   as enum ('planned', 'approved', 'in_progress', 'completed', 'cancelled');
create type treatment_priority as enum ('low', 'normal', 'high', 'urgent');

create type payment_status     as enum ('unpaid', 'partial', 'paid', 'waived');
create type payment_method     as enum ('cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other');

create type tooth_condition    as enum
  ('healthy', 'caries', 'filling', 'crown', 'missing', 'extraction_planned', 'extracted',
   'root_canal', 'implant', 'bridge', 'fractured', 'sensitive', 'other');

create type prescription_status as enum ('pending', 'partially_dispensed', 'dispensed', 'cancelled');
create type stock_movement_type as enum
  ('purchase', 'sale', 'dispense', 'adjustment', 'damaged', 'expired', 'returned');
create type purchase_status    as enum ('draft', 'confirmed', 'cancelled');

create type ortho_status       as enum ('active', 'completed', 'cancelled');
create type expense_category   as enum
  ('rent', 'electricity', 'water', 'salaries', 'dental_supplies', 'pharmacy_purchases',
   'equipment', 'maintenance', 'internet', 'cleaning', 'transport', 'other');
create type document_type      as enum ('xray', 'photo', 'scan', 'consent', 'lab_result', 'pdf', 'other');

-- ---------------------------------------------------------------------------
-- Staff / identity
-- Supabase auth.users holds credentials; profiles holds clinic identity + role.
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text        not null check (length(btrim(full_name)) > 1),
  role          user_role   not null default 'receptionist',
  phone         text,
  email         text,
  specialty     text,
  photo_url     text,
  status        staff_status not null default 'active',
  joined_date   date        not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table profiles is 'Clinic staff. One row per authenticated user.';

-- Fine-grained overrides on top of the role (e.g. a dentist allowed to take payments).
create table user_permissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  permission  text not null,
  granted     boolean not null default true,
  granted_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  unique (user_id, permission)
);

-- ---------------------------------------------------------------------------
-- Patients — replaces the physical registration book
-- ---------------------------------------------------------------------------
create sequence patient_code_seq start 1;

create table patients (
  id                       uuid primary key default gen_random_uuid(),
  patient_code             text unique not null
                             default 'DNT-' || lpad(nextval('patient_code_seq')::text, 6, '0'),
  full_name                text not null check (length(btrim(full_name)) > 1),
  gender                   gender_type not null,
  date_of_birth            date,
  age_years                integer check (age_years between 0 and 130),
  phone                    text not null check (length(btrim(phone)) >= 6),
  alt_phone                text,
  address                  text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  photo_url                text,
  allergies                text,
  medical_conditions       text,
  current_medications      text,
  notes                    text,
  status                   patient_status not null default 'active',
  registered_at            timestamptz not null default now(),
  created_by               uuid references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  -- at least one of DOB / age must be present so age is always answerable
  constraint patients_age_present check (date_of_birth is not null or age_years is not null)
);
create index patients_name_trgm_idx on patients using gin (to_tsvector('simple', full_name));
create index patients_phone_idx     on patients (phone);
create index patients_code_idx      on patients (patient_code);
create index patients_active_idx    on patients (status) where archived_at is null;

create table patient_medical_history (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  condition   text not null,
  notes       text,
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);
create index pmh_patient_idx on patient_medical_history (patient_id);

-- ---------------------------------------------------------------------------
-- Clinical: examinations and the tooth chart
-- ---------------------------------------------------------------------------
create table dental_examinations (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references patients(id) on delete cascade,
  dentist_id            uuid references profiles(id),
  exam_date             date not null default current_date,
  chief_complaint       text,
  medical_history       text,
  dental_history        text,
  findings              text,
  diagnosis             text,
  recommended_treatment text,
  notes                 text,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now()
);
create index exams_patient_idx on dental_examinations (patient_id, exam_date desc);

-- Append-only tooth chart. Each change inserts a new row; the previous row for
-- that tooth is flagged is_current = false by a trigger, so the full history of
-- every tooth is preserved.
create table tooth_records (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references patients(id) on delete cascade,
  tooth_number        smallint not null,
  condition           tooth_condition not null default 'healthy',
  proposed_treatment  text,
  existing_treatment  text,
  surface             text,
  notes               text,
  examination_id      uuid references dental_examinations(id) on delete set null,
  recorded_by         uuid references profiles(id),
  recorded_at         timestamptz not null default now(),
  is_current          boolean not null default true,
  -- FDI permanent dentition: quadrants 1-4, teeth 1-8
  constraint tooth_number_fdi check (
    (tooth_number between 11 and 18) or (tooth_number between 21 and 28) or
    (tooth_number between 31 and 38) or (tooth_number between 41 and 48)
  )
);
create index tooth_patient_idx  on tooth_records (patient_id, tooth_number, recorded_at desc);
create unique index tooth_current_idx on tooth_records (patient_id, tooth_number) where is_current;

-- ---------------------------------------------------------------------------
-- Treatments
-- ---------------------------------------------------------------------------
create table treatment_types (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  category      text not null default 'general',
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  is_active     boolean not null default true,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table treatment_plans (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  dentist_id uuid references profiles(id),
  title      text not null default 'Treatment plan',
  status     treatment_status not null default 'planned',
  notes      text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plans_patient_idx on treatment_plans (patient_id, created_at desc);

create table treatments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete cascade,
  plan_id           uuid references treatment_plans(id) on delete set null,
  treatment_type_id uuid references treatment_types(id),
  dentist_id        uuid references profiles(id),
  tooth_numbers     smallint[] not null default '{}',
  description       text,
  estimated_cost    numeric(12,2) not null default 0 check (estimated_cost >= 0),
  discount          numeric(12,2) not null default 0 check (discount >= 0),
  final_cost        numeric(12,2) generated always as (estimated_cost - discount) stored,
  priority          treatment_priority not null default 'normal',
  planned_date      date,
  started_at        timestamptz,
  completed_at      timestamptz,
  status            treatment_status not null default 'planned',
  is_waived         boolean not null default false,
  notes             text,
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  constraint discount_not_above_cost check (discount <= estimated_cost)
);
create index treatments_patient_idx on treatments (patient_id, created_at desc);
create index treatments_status_idx  on treatments (status) where archived_at is null;
create index treatments_dentist_idx on treatments (dentist_id);

-- ---------------------------------------------------------------------------
-- Orthodontics (braces) — long-running cases with repeat visits
-- ---------------------------------------------------------------------------
create table orthodontic_cases (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references patients(id) on delete cascade,
  -- the billable treatment row: cost lives in `treatments` only, never duplicated here
  treatment_id     uuid not null references treatments(id) on delete restrict,
  dentist_id       uuid references profiles(id),
  braces_type      text not null default 'Metal fixed',
  upper_arch       boolean not null default true,
  lower_arch       boolean not null default true,
  start_date       date not null default current_date,
  estimated_months integer check (estimated_months between 1 and 60),
  current_stage    text,
  status           ortho_status not null default 'active',
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ortho_arch_required check (upper_arch or lower_arch)
);
create index ortho_patient_idx on orthodontic_cases (patient_id);

create table orthodontic_visits (
  id               uuid primary key default gen_random_uuid(),
  case_id          uuid not null references orthodontic_cases(id) on delete cascade,
  visit_date       date not null default current_date,
  dentist_id       uuid references profiles(id),
  adjustment       text,
  archwire_change  text,
  elastics         text,
  observation      text,
  compliance       text,
  next_visit_date  date,
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);
create index ortho_visits_case_idx on orthodontic_visits (case_id, visit_date desc);

-- ---------------------------------------------------------------------------
-- Appointments and the waiting queue
-- ---------------------------------------------------------------------------
create table appointments (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete cascade,
  dentist_id        uuid references profiles(id),
  treatment_type_id uuid references treatment_types(id),
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 30 check (duration_minutes between 5 and 480),
  -- Maintained by appointments_set_ends_at(). It exists as a stored column
  -- because `timestamptz + interval` is only STABLE, and an exclusion
  -- constraint needs an IMMUTABLE expression.
  ends_at           timestamptz,
  status            appointment_status not null default 'scheduled',
  notes             text,
  queue_number      integer,
  queue_state       queue_status,
  checked_in_at     timestamptz,
  called_at         timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- a dentist cannot be in two places at once (cancelled/no-show slots are free)
  constraint appointments_no_double_booking exclude using gist (
    dentist_id with =,
    tstzrange(scheduled_at, ends_at) with &&
  ) where (status not in ('cancelled', 'no_show') and dentist_id is not null)
);

create or replace function appointments_set_ends_at() returns trigger
language plpgsql as $$
begin
  new.ends_at := new.scheduled_at + make_interval(mins => new.duration_minutes);
  return new;
end $$;

create trigger appointments_ends_at
  before insert or update of scheduled_at, duration_minutes on appointments
  for each row execute function appointments_set_ends_at();
create index appts_day_idx     on appointments (scheduled_at);
create index appts_patient_idx on appointments (patient_id, scheduled_at desc);
create index appts_queue_idx   on appointments (queue_state) where queue_state is not null;

-- ---------------------------------------------------------------------------
-- Pharmacy
-- ---------------------------------------------------------------------------
create table medicine_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz not null default now()
);

create table medicines (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  generic_name   text,
  category_id    uuid references medicine_categories(id) on delete set null,
  dosage_form    text not null default 'tablet',
  strength       text,
  barcode        text unique,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  selling_price  numeric(12,2) not null default 0 check (selling_price >= 0),
  minimum_stock  integer not null default 10 check (minimum_stock >= 0),
  is_active      boolean not null default true,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (name, strength, dosage_form)
);
create index medicines_name_idx on medicines (name);

-- Stock is tracked per batch so expiry can be enforced and FEFO applied.
create table pharmacy_stock (
  id             uuid primary key default gen_random_uuid(),
  medicine_id    uuid not null references medicines(id) on delete cascade,
  batch_number   text not null default 'NA',
  expiry_date    date,
  quantity       integer not null default 0 check (quantity >= 0),
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  supplier_id    uuid,
  received_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (medicine_id, batch_number, expiry_date)
);
create index stock_medicine_idx on pharmacy_stock (medicine_id);
create index stock_expiry_idx   on pharmacy_stock (expiry_date) where quantity > 0;

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  medicine_id     uuid not null references medicines(id) on delete cascade,
  stock_id        uuid references pharmacy_stock(id) on delete set null,
  movement_type   stock_movement_type not null,
  quantity_before integer not null,
  quantity_change integer not null,
  quantity_after  integer not null,
  reason          text,
  reference_table text,
  reference_id    uuid,
  performed_by    uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index movements_medicine_idx on stock_movements (medicine_id, created_at desc);

create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  phone      text,
  address    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table pharmacy_stock
  add constraint pharmacy_stock_supplier_fk foreign key (supplier_id) references suppliers(id) on delete set null;

create sequence purchase_ref_seq start 1;
create table pharmacy_purchases (
  id                uuid primary key default gen_random_uuid(),
  purchase_number   text unique not null
                      default 'PUR-' || lpad(nextval('purchase_ref_seq')::text, 6, '0'),
  supplier_id       uuid references suppliers(id) on delete set null,
  invoice_reference text,
  purchase_date     date not null default current_date,
  total_amount      numeric(12,2) not null default 0 check (total_amount >= 0),
  status            purchase_status not null default 'draft',
  notes             text,
  created_by        uuid references profiles(id),
  confirmed_at      timestamptz,
  confirmed_by      uuid references profiles(id),
  created_at        timestamptz not null default now()
);

create table pharmacy_purchase_items (
  id             uuid primary key default gen_random_uuid(),
  purchase_id    uuid not null references pharmacy_purchases(id) on delete cascade,
  medicine_id    uuid not null references medicines(id),
  batch_number   text not null default 'NA',
  expiry_date    date,
  quantity       integer not null check (quantity > 0),
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  line_total     numeric(12,2) generated always as (quantity * purchase_price) stored
);
create index purchase_items_idx on pharmacy_purchase_items (purchase_id);

create sequence sale_number_seq start 1;
create table pharmacy_sales (
  id              uuid primary key default gen_random_uuid(),
  sale_number     text unique not null
                    default 'SAL-' || lpad(nextval('sale_number_seq')::text, 6, '0'),
  patient_id      uuid references patients(id) on delete set null,
  prescription_id uuid,
  total_amount    numeric(12,2) not null default 0 check (total_amount >= 0),
  payment_method  payment_method not null default 'cash',
  notes           text,
  -- idempotency key from the client; a repeated submit returns the first sale
  client_token    text unique,
  sold_by         uuid references profiles(id),
  sold_at         timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       uuid references profiles(id)
);
create index sales_date_idx on pharmacy_sales (sold_at desc);

create table pharmacy_sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references pharmacy_sales(id) on delete cascade,
  medicine_id uuid not null references medicines(id),
  stock_id    uuid references pharmacy_stock(id) on delete set null,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(12,2) generated always as (quantity * unit_price) stored
);
create index sale_items_idx on pharmacy_sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- Prescriptions
-- ---------------------------------------------------------------------------
create sequence prescription_seq start 1;
create table prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  prescription_number text unique not null
                        default 'RX-' || lpad(nextval('prescription_seq')::text, 6, '0'),
  patient_id          uuid not null references patients(id) on delete cascade,
  dentist_id          uuid references profiles(id),
  prescribed_at       timestamptz not null default now(),
  status              prescription_status not null default 'pending',
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index rx_patient_idx on prescriptions (patient_id, prescribed_at desc);
create index rx_status_idx  on prescriptions (status) where status <> 'dispensed';

create table prescription_items (
  id                 uuid primary key default gen_random_uuid(),
  prescription_id    uuid not null references prescriptions(id) on delete cascade,
  medicine_id        uuid references medicines(id) on delete set null,
  medicine_name      text not null,          -- snapshot: prescriptions stay readable
  strength           text,
  dose               text,
  frequency          text,
  duration           text,
  quantity           integer not null check (quantity > 0),
  dispensed_quantity integer not null default 0 check (dispensed_quantity >= 0),
  instructions       text,
  constraint dispensed_not_over_prescribed check (dispensed_quantity <= quantity)
);
create index rx_items_idx on prescription_items (prescription_id);

alter table pharmacy_sales
  add constraint pharmacy_sales_rx_fk foreign key (prescription_id) references prescriptions(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Money in: payments. This table is the single source of truth for
-- "how much has this patient paid". Balances are computed from it.
-- ---------------------------------------------------------------------------
create sequence receipt_number_seq start 1;

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  receipt_number     text unique not null
                       default 'RCP-' || lpad(nextval('receipt_number_seq')::text, 6, '0'),
  patient_id         uuid references patients(id) on delete restrict,
  treatment_id       uuid references treatments(id) on delete restrict,
  ortho_case_id      uuid references orthodontic_cases(id) on delete restrict,
  pharmacy_sale_id   uuid references pharmacy_sales(id) on delete restrict,
  amount             numeric(12,2) not null check (amount > 0),
  method             payment_method not null default 'cash',
  paid_at            timestamptz not null default now(),
  reference          text,
  notes              text,
  -- idempotency key supplied by the client; blocks double-click duplicates
  client_token       text unique,
  received_by        uuid references profiles(id),
  created_at         timestamptz not null default now(),
  voided_at          timestamptz,
  voided_by          uuid references profiles(id),
  void_reason        text,
  -- Every payment settles exactly one billable thing. Orthodontic payments
  -- point at the case's treatment; ortho_case_id is only a convenience tag so
  -- a payment can be traced back to the visit it was collected at.
  constraint payment_target_present check (
    (treatment_id is not null) <> (pharmacy_sale_id is not null)
  ),
  constraint ortho_tag_needs_treatment check (
    ortho_case_id is null or treatment_id is not null
  )
);
create index payments_patient_idx   on payments (patient_id, paid_at desc);
create index payments_treatment_idx on payments (treatment_id) where voided_at is null;
create index payments_ortho_idx     on payments (ortho_case_id) where voided_at is null;
create index payments_date_idx      on payments (paid_at desc) where voided_at is null;

-- ---------------------------------------------------------------------------
-- Money out: clinic expenses
-- ---------------------------------------------------------------------------
create table expenses (
  id             uuid primary key default gen_random_uuid(),
  category       expense_category not null,
  description    text not null,
  amount         numeric(12,2) not null check (amount > 0),
  expense_date   date not null default current_date,
  payment_method payment_method not null default 'cash',
  receipt_url    text,
  notes          text,
  recorded_by    uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index expenses_date_idx on expenses (expense_date desc);

-- ---------------------------------------------------------------------------
-- Patient documents (Supabase Storage objects)
-- ---------------------------------------------------------------------------
create table documents (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients(id) on delete cascade,
  title        text not null,
  doc_type     document_type not null default 'other',
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  notes        text,
  uploaded_by  uuid references profiles(id),
  uploaded_at  timestamptz not null default now()
);
create index documents_patient_idx on documents (patient_id, uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on audit_logs (created_at desc);
create index audit_entity_idx  on audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Clinic settings — single row
-- ---------------------------------------------------------------------------
create table clinic_settings (
  id                    boolean primary key default true check (id),
  clinic_name           text not null default 'Dental Clinic',
  logo_url              text,
  phone                 text,
  address               text,
  email                 text,
  currency              text not null default 'USD',
  currency_symbol       text not null default '$',
  receipt_footer        text default 'Thank you for visiting our clinic.',
  low_stock_threshold   integer not null default 10 check (low_stock_threshold >= 0),
  expiry_warning_days   integer not null default 30 check (expiry_warning_days >= 0),
  updated_by            uuid references profiles(id),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles','patients','treatment_types','treatment_plans','treatments',
    'orthodontic_cases','appointments','medicines','pharmacy_stock','suppliers',
    'prescriptions','clinic_settings'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', tbl, tbl);
  end loop;
end $$;
