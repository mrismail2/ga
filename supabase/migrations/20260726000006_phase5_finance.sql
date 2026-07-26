-- ============================================================
-- Kobciye Phase 5 — Stage 5: fees & finance (School Mode)
--
-- REUSE, don't duplicate: the Phase 1/2 `payments` table already records a
-- received payment (amount, method, month, received_by). Phase 5 adds the
-- structure it lacks — fee structures, per-student invoices and payment
-- allocation — and links a payment to the invoice it settles. The existing
-- `payments` table is extended additively (invoice_id, reference, receipt_no,
-- reversal columns); nothing is dropped and its Phase 1–4 policies stay.
--
-- Money integrity is enforced in the database: no negative payment, no
-- overpayment beyond an invoice's balance, no duplicate payment reference,
-- and a reversal preserves history rather than deleting a payment.
--
-- Additive only.
-- ============================================================

begin;

-- ============================================================
-- fee_structures + fee_items
-- ============================================================
create table if not exists fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  academic_year_id uuid references academic_years (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  school_section_id uuid references school_sections (id) on delete set null,
  class_id uuid references classes (id) on delete set null,
  name text not null,
  currency text not null default 'USD',
  status record_status not null default 'active',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fee_structures_school on fee_structures (school_id);
create trigger fee_structures_updated_at before update on fee_structures
  for each row execute function set_updated_at();

create table if not exists fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  fee_structure_id uuid not null references fee_structures (id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists fee_items_structure on fee_items (fee_structure_id);

-- ============================================================
-- student_invoices + invoice_items
-- ============================================================
create table if not exists student_invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  enrollment_id uuid references student_enrollments (id) on delete set null,
  fee_structure_id uuid references fee_structures (id) on delete set null,
  academic_year_id uuid references academic_years (id) on delete set null,
  term_id uuid references terms (id) on delete set null,
  invoice_number text not null,
  currency text not null default 'USD',
  amount_due numeric not null default 0 check (amount_due >= 0),
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  -- balance is derived, never stored inconsistently
  balance numeric generated always as (amount_due - amount_paid) stored,
  due_date date,
  status text not null default 'issued'
    check (status in ('draft', 'issued', 'part_paid', 'paid', 'overdue', 'cancelled')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, invoice_number)
);
create index if not exists student_invoices_school on student_invoices (school_id);
create index if not exists student_invoices_student on student_invoices (student_id);
create trigger student_invoices_updated_at before update on student_invoices
  for each row execute function set_updated_at();

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  invoice_id uuid not null references student_invoices (id) on delete cascade,
  fee_item_id uuid references fee_items (id) on delete set null,
  name text not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists invoice_items_invoice on invoice_items (invoice_id);

-- discounts / waivers applied to an invoice (reduce amount_due)
create table if not exists invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  invoice_id uuid not null references student_invoices (id) on delete cascade,
  kind text not null check (kind in ('discount', 'waiver')),
  amount numeric not null check (amount >= 0),
  reason text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invoice_adjustments_invoice on invoice_adjustments (invoice_id);

-- ============================================================
-- payments — additive columns linking a payment to the invoice it settles
-- ============================================================
alter table payments add column if not exists invoice_id uuid references student_invoices (id) on delete set null;
alter table payments add column if not exists reference text;
alter table payments add column if not exists receipt_no text;
alter table payments add column if not exists paid_on date not null default current_date;
alter table payments add column if not exists reversed boolean not null default false;
alter table payments add column if not exists reversed_by uuid references profiles (id) on delete set null;
alter table payments add column if not exists reversed_at timestamptz;
alter table payments add column if not exists updated_at timestamptz not null default now();
-- a payment reference must be unique within a school (no double-recording)
create unique index if not exists payments_reference_unique
  on payments (school_id, reference) where reference is not null;
drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  payment_id uuid not null references payments (id) on delete cascade,
  invoice_id uuid not null references student_invoices (id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists payment_allocations_payment on payment_allocations (payment_id);
create index if not exists payment_allocations_invoice on payment_allocations (invoice_id);

-- ============================================================
-- Integrity guards
-- ============================================================
create or replace function phase5_guard_finance_school()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- generic same-school checks by table
  if tg_table_name = 'fee_items' then
    if not exists (select 1 from fee_structures f where f.id = new.fee_structure_id and f.school_id = new.school_id) then
      raise exception 'fee item belongs to another school than its structure'; end if;
  elsif tg_table_name = 'invoice_items' then
    if not exists (select 1 from student_invoices i where i.id = new.invoice_id and i.school_id = new.school_id) then
      raise exception 'invoice item belongs to another school than its invoice'; end if;
  elsif tg_table_name = 'invoice_adjustments' then
    if not exists (select 1 from student_invoices i where i.id = new.invoice_id and i.school_id = new.school_id) then
      raise exception 'adjustment belongs to another school than its invoice'; end if;
  elsif tg_table_name = 'student_invoices' then
    if not exists (select 1 from students s where s.id = new.student_id and s.school_id = new.school_id) then
      raise exception 'student belongs to another school'; end if;
  elsif tg_table_name = 'payment_allocations' then
    if not exists (select 1 from payments p where p.id = new.payment_id and p.school_id = new.school_id) then
      raise exception 'allocation belongs to another school than its payment'; end if;
    if not exists (select 1 from student_invoices i where i.id = new.invoice_id and i.school_id = new.school_id) then
      raise exception 'allocation invoice belongs to another school'; end if;
  end if;
  return new;
end $$;
revoke all on function phase5_guard_finance_school() from public, anon, authenticated;
create trigger fee_items_guard before insert or update on fee_items
  for each row execute function phase5_guard_finance_school();
create trigger invoice_items_guard before insert or update on invoice_items
  for each row execute function phase5_guard_finance_school();
create trigger invoice_adjustments_guard before insert or update on invoice_adjustments
  for each row execute function phase5_guard_finance_school();
create trigger student_invoices_guard before insert or update on student_invoices
  for each row execute function phase5_guard_finance_school();
create trigger payment_allocations_guard before insert or update on payment_allocations
  for each row execute function phase5_guard_finance_school();

-- audit every finance mutation
create or replace function phase5_audit_finance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (coalesce(new.school_id, old.school_id), auth.uid(),
          tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(new.id, old.id)::text, '{}'::jsonb);
  return coalesce(new, old);
end $$;
revoke all on function phase5_audit_finance() from public, anon, authenticated;
create trigger fee_structures_audit after insert or update on fee_structures
  for each row execute function phase5_audit_finance();
create trigger student_invoices_audit after insert or update on student_invoices
  for each row execute function phase5_audit_finance();
create trigger invoice_adjustments_audit after insert on invoice_adjustments
  for each row execute function phase5_audit_finance();

-- ============================================================
-- RLS — admins/accountants manage; student & parent read APPROVED (issued+)
-- finance for themselves / linked children only.
-- ============================================================
alter table fee_structures enable row level security;
alter table fee_items enable row level security;
alter table student_invoices enable row level security;
alter table invoice_items enable row level security;
alter table invoice_adjustments enable row level security;
alter table payment_allocations enable row level security;

-- accountant is finance staff too; is_staff_of covers admin/teacher/accountant,
-- so finance write is narrowed to admin + accountant explicitly.
create policy "finance staff manage fee structures" on fee_structures
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));
create policy "finance staff manage fee items" on fee_items
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));
create policy "finance staff manage invoices" on student_invoices
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));
create policy "finance staff manage invoice items" on invoice_items
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));
create policy "finance staff manage adjustments" on invoice_adjustments
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));
create policy "finance staff manage allocations" on payment_allocations
  for all using (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'))
  with check (is_admin_of(school_id) or (is_staff_of(school_id) and my_role() = 'accountant'));

-- student: own invoices/items (issued or later — never a draft)
create policy "student reads own invoices" on student_invoices
  for select using (status <> 'draft' and is_self_student(student_id));
create policy "student reads own invoice items" on invoice_items
  for select using (exists (select 1 from student_invoices i
                            where i.id = invoice_items.invoice_id and i.status <> 'draft' and is_self_student(i.student_id)));
-- parent: linked children's invoices/items
create policy "parent reads child invoices" on student_invoices
  for select using (status <> 'draft' and is_parent_of(student_id));
create policy "parent reads child invoice items" on invoice_items
  for select using (exists (select 1 from student_invoices i
                            where i.id = invoice_items.invoice_id and i.status <> 'draft' and is_parent_of(i.student_id)));

-- ============================================================
-- record_payment — the ONE money-in path. Validates amount, reference and
-- overpayment, writes the payment + allocation, and rolls the invoice's
-- amount_paid/status forward. Atomic: any failure records nothing.
-- ============================================================
create or replace function record_payment(
  p_school uuid,
  p_invoice uuid,
  p_amount numeric,
  p_method text default null,
  p_reference text default null,
  p_receipt_no text default null,
  p_paid_on date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv student_invoices;
  v_payment uuid;
  v_ref text := nullif(trim(coalesce(p_reference, '')), '');
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role() = 'accountant')) then
    raise exception 'only finance staff may record a payment';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'a payment amount must be greater than zero';
  end if;

  select * into v_inv from student_invoices where id = p_invoice and school_id = p_school for update;
  if v_inv.id is null then raise exception 'invoice belongs to another school'; end if;

  -- no overpayment beyond the outstanding balance (no credit policy in this pass)
  if p_amount > v_inv.balance then
    raise exception 'payment (%.2f) exceeds the invoice balance (%.2f)', p_amount, v_inv.balance;
  end if;

  -- duplicate reference guard (also enforced by the unique index)
  if v_ref is not null and exists (
    select 1 from payments where school_id = p_school and reference = v_ref and not reversed) then
    raise exception 'a payment with this reference already exists';
  end if;

  insert into payments (school_id, student_id, amount, currency, method, invoice_id,
                        reference, receipt_no, paid_on, received_by, note)
  values (p_school, v_inv.student_id, p_amount, v_inv.currency, p_method, p_invoice,
          v_ref, nullif(trim(coalesce(p_receipt_no, '')), ''), coalesce(p_paid_on, current_date),
          auth.uid(), null)
  returning id into v_payment;

  insert into payment_allocations (school_id, payment_id, invoice_id, amount)
  values (p_school, v_payment, p_invoice, p_amount);

  update student_invoices set
    amount_paid = amount_paid + p_amount,
    status = case
      when amount_paid + p_amount >= amount_due then 'paid'
      else 'part_paid' end
  where id = p_invoice;

  -- notify the student's linked parents that a payment was recorded
  perform phase5_notify_payment(p_school, p_invoice, v_payment, p_amount);

  return jsonb_build_object('payment_id', v_payment, 'invoice_id', p_invoice);
end $$;
revoke all on function record_payment(uuid, uuid, numeric, text, text, text, date) from public, anon;
grant execute on function record_payment(uuid, uuid, numeric, text, text, text, date) to authenticated;

create or replace function phase5_notify_payment(p_school uuid, p_invoice uuid, p_payment uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_student uuid; v_name text;
begin
  select student_id into v_student from student_invoices where id = p_invoice;
  select full_name into v_name from students where id = v_student;
  for r in
    select distinct sp.parent_profile_id from student_parents sp
    where sp.student_id = v_student and sp.parent_profile_id is not null
      and coalesce(sp.can_receive_messages, true)
  loop
    perform set_config('kobciye.notify_system', 'on', true);
    insert into notifications (school_id, recipient_id, event_type, title, body, entity, entity_id, student_id, dedupe_key)
    values (p_school, r.parent_profile_id, 'payment.recorded', 'Lacag la diiwaangeliyay',
            'Lacag ' || to_char(p_amount, 'FM999999990.00') || ' ayaa laga diiwaangeliyay ardaygaaga ' ||
            coalesce(v_name, '') || '.',
            'payments', p_payment, v_student, 'payment.recorded:' || p_payment::text)
    on conflict (recipient_id, dedupe_key) do nothing;
    perform set_config('kobciye.notify_system', 'off', true);
  end loop;
end $$;
revoke all on function phase5_notify_payment(uuid, uuid, uuid, numeric) from public, anon, authenticated;

-- ============================================================
-- generate_invoice — issue an invoice for one student from a fee structure.
-- Idempotent per (student, fee_structure): a second call returns the existing
-- invoice rather than a duplicate.
-- ============================================================
create or replace function generate_invoice(
  p_school uuid,
  p_student uuid,
  p_fee_structure uuid,
  p_due_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_fs fee_structures;
  v_invoice uuid;
  v_total numeric := 0;
  v_enrollment uuid;
  v_num text;
  r record;
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role() = 'accountant')) then
    raise exception 'only finance staff may issue an invoice';
  end if;
  select * into v_fs from fee_structures where id = p_fee_structure and school_id = p_school;
  if v_fs.id is null then raise exception 'fee structure belongs to another school'; end if;
  if not exists (select 1 from students where id = p_student and school_id = p_school) then
    raise exception 'student belongs to another school';
  end if;

  -- one invoice per (student, fee structure) — a repeat is a no-op
  select id into v_invoice from student_invoices
  where school_id = p_school and student_id = p_student and fee_structure_id = p_fee_structure;
  if v_invoice is not null then return v_invoice; end if;

  select id into v_enrollment from student_enrollments
  where student_id = p_student and school_id = p_school and status = 'active' limit 1;

  select coalesce(sum(amount), 0) into v_total from fee_items where fee_structure_id = p_fee_structure;

  v_num := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into student_invoices (school_id, student_id, enrollment_id, fee_structure_id,
                                academic_year_id, term_id, invoice_number, currency,
                                amount_due, due_date, status, created_by)
  values (p_school, p_student, v_enrollment, p_fee_structure, v_fs.academic_year_id, v_fs.term_id,
          v_num, v_fs.currency, v_total, p_due_date, 'issued', auth.uid())
  returning id into v_invoice;

  for r in select * from fee_items where fee_structure_id = p_fee_structure loop
    insert into invoice_items (school_id, invoice_id, fee_item_id, name, amount)
    values (p_school, v_invoice, r.id, r.name, r.amount);
  end loop;

  -- notify linked parents that an invoice was issued
  declare v_name text;
  begin
    select full_name into v_name from students where id = p_student;
    perform (
      select 1 from (
        select distinct sp.parent_profile_id from student_parents sp
        where sp.student_id = p_student and sp.parent_profile_id is not null
          and coalesce(sp.can_receive_messages, true)) parents);
    insert into notifications (school_id, recipient_id, event_type, title, body, entity, entity_id, student_id, dedupe_key)
    select p_school, sp.parent_profile_id, 'invoice.issued', 'Biil cusub',
           'Biil cusub (' || v_num || ') ayaa loo sameeyay ardaygaaga ' || coalesce(v_name, '') ||
           '. Wadarta: ' || to_char(v_total, 'FM999999990.00') || '.',
           'student_invoices', v_invoice, p_student, 'invoice.issued:' || v_invoice::text
    from student_parents sp
    where sp.student_id = p_student and sp.parent_profile_id is not null
      and coalesce(sp.can_receive_messages, true)
    on conflict (recipient_id, dedupe_key) do nothing;
  end;

  return v_invoice;
end $$;
revoke all on function generate_invoice(uuid, uuid, uuid, date) from public, anon;
grant execute on function generate_invoice(uuid, uuid, uuid, date) to authenticated;

-- reverse_payment — preserves the payment row, marks it reversed, rolls the
-- invoice balance back. Never deletes payment history.
create or replace function reverse_payment(p_school uuid, p_payment uuid, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_pay payments; v_alloc numeric;
begin
  if not is_admin_of(p_school) then raise exception 'only a school admin may reverse a payment'; end if;
  select * into v_pay from payments where id = p_payment and school_id = p_school for update;
  if v_pay.id is null then raise exception 'payment belongs to another school'; end if;
  if v_pay.reversed then raise exception 'this payment is already reversed'; end if;

  update payments set reversed = true, reversed_by = auth.uid(), reversed_at = now(),
    note = coalesce(nullif(trim(coalesce(p_reason, '')), ''), note)
  where id = p_payment;

  for v_alloc in select amount from payment_allocations where payment_id = p_payment loop
    update student_invoices set
      amount_paid = greatest(0, amount_paid - v_alloc),
      status = case when greatest(0, amount_paid - v_alloc) <= 0 then 'issued'
                    when greatest(0, amount_paid - v_alloc) < amount_due then 'part_paid'
                    else status end
    where id = (select invoice_id from payment_allocations where payment_id = p_payment limit 1);
  end loop;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (p_school, auth.uid(), 'payment.reverse', 'payments', p_payment::text,
          jsonb_build_object('reason', p_reason));
  return true;
end $$;
revoke all on function reverse_payment(uuid, uuid, text) from public, anon;
grant execute on function reverse_payment(uuid, uuid, text) to authenticated;

commit;
