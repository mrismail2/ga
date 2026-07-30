-- ============================================================================
-- Kobciye Phase 5 — final finance integrity completion
--
-- Additive correction after 20260726000014. This migration does not delete
-- user data. It replaces security-definer workflow functions/guards so that:
--   * invoices require one valid active enrollment and at least one positive
--     fee item;
--   * fee structures/invoices cannot mix schools, years, terms, sections or
--     classes;
--   * invoice notification fan-out cannot fail when a child has several
--     guardians;
--   * payment reversal restores every allocated invoice, not merely the first;
--   * a reversal requires an auditable reason.
-- ============================================================================

begin;

-- The runtime treats invoice generation as idempotent per student and fee
-- structure. Refuse to install the unique index over ambiguous historical data
-- rather than deleting or merging invoices automatically.
do $$
begin
  if exists (
    select school_id, student_id, fee_structure_id
    from student_invoices
    where fee_structure_id is not null
    group by school_id, student_id, fee_structure_id
    having count(*) > 1
  ) then
    raise exception 'duplicate invoices exist for a student and fee structure; run the final preflight';
  end if;
end $$;
create unique index if not exists student_invoices_student_structure_unique
  on student_invoices (school_id, student_id, fee_structure_id)
  where fee_structure_id is not null;

create or replace function phase5_guard_finance_school()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_invoice student_invoices;
  v_payment payments;
begin
  if tg_table_name = 'fee_structures' then
    if not exists (select 1 from schools s where s.id = new.school_id) then
      raise exception 'school does not exist';
    end if;
    if new.academic_year_id is not null and not exists (
      select 1 from academic_years y
      where y.id = new.academic_year_id and y.school_id = new.school_id
    ) then
      raise exception 'academic year belongs to another school';
    end if;
    if new.term_id is not null and not exists (
      select 1 from terms t
      where t.id = new.term_id and t.school_id = new.school_id
        and (new.academic_year_id is null
             or t.academic_year_id is null
             or t.academic_year_id = new.academic_year_id)
    ) then
      raise exception 'term belongs to another school or academic year';
    end if;
    if new.school_section_id is not null and not exists (
      select 1 from school_sections ss
      where ss.id = new.school_section_id and ss.school_id = new.school_id
    ) then
      raise exception 'school section belongs to another school';
    end if;
    if new.class_id is not null and not exists (
      select 1 from classes c
      where c.id = new.class_id and c.school_id = new.school_id
        and (new.school_section_id is null
             or c.school_section_id is null
             or c.school_section_id = new.school_section_id)
        and (new.academic_year_id is null
             or c.academic_year_id is null
             or c.academic_year_id = new.academic_year_id)
    ) then
      raise exception 'class belongs to another school, section or academic year';
    end if;

  elsif tg_table_name = 'fee_items' then
    if not exists (
      select 1 from fee_structures f
      where f.id = new.fee_structure_id and f.school_id = new.school_id
    ) then
      raise exception 'fee item belongs to another school than its structure';
    end if;

  elsif tg_table_name = 'student_invoices' then
    if not exists (
      select 1 from students s where s.id = new.student_id and s.school_id = new.school_id
    ) then
      raise exception 'student belongs to another school';
    end if;
    if new.enrollment_id is not null and not exists (
      select 1 from student_enrollments e
      where e.id = new.enrollment_id
        and e.school_id = new.school_id
        and e.student_id = new.student_id
    ) then
      raise exception 'invoice enrollment does not belong to the student and school';
    end if;
    if new.fee_structure_id is not null and not exists (
      select 1 from fee_structures f
      where f.id = new.fee_structure_id and f.school_id = new.school_id
        and (new.academic_year_id is null
             or f.academic_year_id is null
             or f.academic_year_id = new.academic_year_id)
        and (new.term_id is null
             or f.term_id is null
             or f.term_id = new.term_id)
    ) then
      raise exception 'invoice fee structure belongs to another school, year or term';
    end if;
    if new.academic_year_id is not null and not exists (
      select 1 from academic_years y
      where y.id = new.academic_year_id and y.school_id = new.school_id
    ) then
      raise exception 'invoice academic year belongs to another school';
    end if;
    if new.term_id is not null and not exists (
      select 1 from terms t
      where t.id = new.term_id and t.school_id = new.school_id
        and (new.academic_year_id is null
             or t.academic_year_id is null
             or t.academic_year_id = new.academic_year_id)
    ) then
      raise exception 'invoice term belongs to another school or academic year';
    end if;
    if new.amount_paid > new.amount_due then
      raise exception 'invoice amount paid cannot exceed amount due';
    end if;

  elsif tg_table_name = 'invoice_items' then
    select * into v_invoice
    from student_invoices i
    where i.id = new.invoice_id and i.school_id = new.school_id;
    if v_invoice.id is null then
      raise exception 'invoice item belongs to another school than its invoice';
    end if;
    if new.fee_item_id is not null and not exists (
      select 1 from fee_items fi
      where fi.id = new.fee_item_id
        and fi.school_id = new.school_id
        and (v_invoice.fee_structure_id is null
             or fi.fee_structure_id = v_invoice.fee_structure_id)
    ) then
      raise exception 'invoice item fee item belongs to another structure or school';
    end if;

  elsif tg_table_name = 'invoice_adjustments' then
    select * into v_invoice
    from student_invoices i
    where i.id = new.invoice_id and i.school_id = new.school_id;
    if v_invoice.id is null then
      raise exception 'adjustment belongs to another school than its invoice';
    end if;
    if new.amount > v_invoice.amount_due then
      raise exception 'adjustment cannot exceed the invoice amount due';
    end if;

  elsif tg_table_name = 'payment_allocations' then
    select * into v_payment
    from payments p
    where p.id = new.payment_id and p.school_id = new.school_id;
    if v_payment.id is null then
      raise exception 'allocation belongs to another school than its payment';
    end if;
    select * into v_invoice
    from student_invoices i
    where i.id = new.invoice_id and i.school_id = new.school_id;
    if v_invoice.id is null then
      raise exception 'allocation invoice belongs to another school';
    end if;
    if v_payment.student_id is distinct from v_invoice.student_id then
      raise exception 'payment and invoice belong to different students';
    end if;
    if v_payment.invoice_id is not null and v_payment.invoice_id is distinct from new.invoice_id then
      raise exception 'allocation does not match the payment invoice';
    end if;
  end if;

  return new;
end $$;
revoke all on function phase5_guard_finance_school() from public, anon, authenticated;

-- Recreate every guard so an installation upgraded from any earlier Phase 5
-- package points to the final function definition.
drop trigger if exists fee_structures_guard on fee_structures;
create trigger fee_structures_guard before insert or update on fee_structures
  for each row execute function phase5_guard_finance_school();
drop trigger if exists fee_items_guard on fee_items;
create trigger fee_items_guard before insert or update on fee_items
  for each row execute function phase5_guard_finance_school();
drop trigger if exists student_invoices_guard on student_invoices;
create trigger student_invoices_guard before insert or update on student_invoices
  for each row execute function phase5_guard_finance_school();
drop trigger if exists invoice_items_guard on invoice_items;
create trigger invoice_items_guard before insert or update on invoice_items
  for each row execute function phase5_guard_finance_school();
drop trigger if exists invoice_adjustments_guard on invoice_adjustments;
create trigger invoice_adjustments_guard before insert or update on invoice_adjustments
  for each row execute function phase5_guard_finance_school();
drop trigger if exists payment_allocations_guard on payment_allocations;
create trigger payment_allocations_guard before insert or update on payment_allocations
  for each row execute function phase5_guard_finance_school();

create or replace function generate_invoice(
  p_school uuid,
  p_student uuid,
  p_fee_structure uuid,
  p_due_date date default null
) returns uuid
language plpgsql
security definer
set search_path = public as $$
declare
  v_fs fee_structures;
  v_invoice uuid;
  v_total numeric := 0;
  v_item_count integer := 0;
  v_enrollment student_enrollments;
  v_num text;
  v_name text;
  r record;
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role() = 'accountant')) then
    raise exception 'only finance staff may issue an invoice';
  end if;

  select * into v_fs
  from fee_structures
  where id = p_fee_structure and school_id = p_school;
  if v_fs.id is null then
    raise exception 'fee structure belongs to another school';
  end if;
  if v_fs.status <> 'active' then
    raise exception 'fee structure is not active';
  end if;

  if not exists (
    select 1 from students s
    where s.id = p_student and s.school_id = p_school and s.status = 'active'
  ) then
    raise exception 'student is not active in this school';
  end if;

  -- Idempotent per student/structure. Lock the existing row when present so
  -- two simultaneous requests cannot race into duplicate invoices.
  select id into v_invoice
  from student_invoices
  where school_id = p_school
    and student_id = p_student
    and fee_structure_id = p_fee_structure
  for update;
  if v_invoice is not null then
    return v_invoice;
  end if;

  select e.* into v_enrollment
  from student_enrollments e
  where e.student_id = p_student
    and e.school_id = p_school
    and e.status = 'active'
  order by e.enrolled_on desc, e.created_at desc
  limit 1
  for update;
  if v_enrollment.id is null then
    raise exception 'student has no active enrollment';
  end if;
  if v_fs.class_id is not null and v_enrollment.class_id is distinct from v_fs.class_id then
    raise exception 'fee structure does not apply to the student active class';
  end if;
  if v_fs.academic_year_id is not null
     and v_enrollment.academic_year_id is distinct from v_fs.academic_year_id then
    raise exception 'fee structure does not apply to the student active academic year';
  end if;
  if v_fs.school_section_id is not null and not exists (
    select 1 from classes c
    where c.id = v_enrollment.class_id
      and c.school_id = p_school
      and c.school_section_id = v_fs.school_section_id
  ) then
    raise exception 'fee structure does not apply to the student school section';
  end if;

  select count(*), coalesce(sum(amount), 0)
    into v_item_count, v_total
  from fee_items
  where school_id = p_school and fee_structure_id = p_fee_structure;
  if v_item_count = 0 then
    raise exception 'fee structure has no fee items';
  end if;
  if v_total <= 0 then
    raise exception 'fee structure total must be greater than zero';
  end if;

  v_num := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
           upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into student_invoices (
    school_id, student_id, enrollment_id, fee_structure_id,
    academic_year_id, term_id, invoice_number, currency,
    amount_due, due_date, status, created_by
  ) values (
    p_school, p_student, v_enrollment.id, p_fee_structure,
    coalesce(v_fs.academic_year_id, v_enrollment.academic_year_id),
    v_fs.term_id, v_num, v_fs.currency,
    v_total, p_due_date, 'issued', auth.uid()
  ) returning id into v_invoice;

  for r in
    select id, name, amount
    from fee_items
    where school_id = p_school and fee_structure_id = p_fee_structure
    order by created_at, id
  loop
    insert into invoice_items (school_id, invoice_id, fee_item_id, name, amount)
    values (p_school, v_invoice, r.id, r.name, r.amount);
  end loop;

  select full_name into v_name from students where id = p_student;
  perform set_config('kobciye.notify_system', 'on', true);
  insert into notifications (
    school_id, recipient_id, event_type, title, body,
    entity, entity_id, student_id, dedupe_key
  )
  select distinct
    p_school,
    sp.parent_profile_id,
    'invoice.issued',
    'Biil cusub',
    'Biil cusub (' || v_num || ') ayaa loo sameeyay ardaygaaga ' ||
      coalesce(v_name, '') || '. Wadarta: ' ||
      to_char(v_total, 'FM999999990.00') || '.',
    'student_invoices',
    v_invoice,
    p_student,
    'invoice.issued:' || v_invoice::text
  from student_parents sp
  join profiles pp on pp.id = sp.parent_profile_id and pp.school_id = p_school
  where sp.student_id = p_student
    and sp.parent_profile_id is not null
    and coalesce(sp.can_receive_messages, true)
  on conflict (recipient_id, dedupe_key) do nothing;
  perform set_config('kobciye.notify_system', 'off', true);

  return v_invoice;
end $$;
revoke all on function generate_invoice(uuid, uuid, uuid, date) from public, anon;
grant execute on function generate_invoice(uuid, uuid, uuid, date) to authenticated;

create or replace function reverse_payment(
  p_school uuid,
  p_payment uuid,
  p_reason text default null
) returns boolean
language plpgsql
security definer
set search_path = public as $$
declare
  v_pay payments;
  v_alloc record;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_allocated numeric;
begin
  if not is_admin_of(p_school) then
    raise exception 'only a school admin may reverse a payment';
  end if;
  if v_reason is null then
    raise exception 'a reversal reason is required';
  end if;

  select * into v_pay
  from payments
  where id = p_payment and school_id = p_school
  for update;
  if v_pay.id is null then
    raise exception 'payment belongs to another school';
  end if;
  if v_pay.reversed then
    raise exception 'this payment is already reversed';
  end if;

  select coalesce(sum(pa.amount), 0) into v_allocated
  from payment_allocations pa
  where pa.payment_id = p_payment and pa.school_id = p_school;
  if v_allocated <= 0 then
    raise exception 'payment has no valid allocations';
  end if;
  if v_allocated is distinct from v_pay.amount then
    raise exception 'payment allocation total does not match the payment amount';
  end if;

  -- Lock and restore every allocated invoice independently. This also remains
  -- correct if multi-invoice allocations are supported later.
  for v_alloc in
    select pa.invoice_id, sum(pa.amount) as amount
    from payment_allocations pa
    where pa.payment_id = p_payment and pa.school_id = p_school
    group by pa.invoice_id
    order by pa.invoice_id
  loop
    perform 1
    from student_invoices i
    where i.id = v_alloc.invoice_id and i.school_id = p_school
    for update;
    if not found then
      raise exception 'payment allocation references a missing invoice';
    end if;

    update student_invoices
    set amount_paid = greatest(0, amount_paid - v_alloc.amount),
        status = case
          when greatest(0, amount_paid - v_alloc.amount) = 0 then 'issued'
          when greatest(0, amount_paid - v_alloc.amount) < amount_due then 'part_paid'
          else 'paid'
        end
    where id = v_alloc.invoice_id and school_id = p_school;
  end loop;

  update payments
  set reversed = true,
      reversed_by = auth.uid(),
      reversed_at = now(),
      note = case
        when nullif(trim(coalesce(note, '')), '') is null then v_reason
        else note || E'\nReversal: ' || v_reason
      end
  where id = p_payment and school_id = p_school;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (
    p_school, auth.uid(), 'payment.reverse', 'payments', p_payment::text,
    jsonb_build_object(
      'reason', v_reason,
      'amount', v_pay.amount,
      'allocation_total', v_allocated
    )
  );

  return true;
end $$;
revoke all on function reverse_payment(uuid, uuid, text) from public, anon;
grant execute on function reverse_payment(uuid, uuid, text) to authenticated;

commit;
