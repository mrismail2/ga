-- ============================================================
-- Kobciye Phase 5 final workflow completion
-- Additive helpers for historical attendance rosters, bulk notification read,
-- finance adjustments, and the report families exposed by the corrected UI.
-- ============================================================
begin;

-- Historical roster valid on the selected attendance date. This replaces the
-- incorrect client-side "currently active only" roster for past dates.
create or replace function attendance_roster_for_date(
  p_school uuid,
  p_class uuid,
  p_date date,
  p_stream uuid default null
) returns table(student_id uuid, full_name text, enrollment_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_school is null or p_class is null or p_date is null then
    raise exception 'school, class and date are required';
  end if;
  if not (is_admin_of(p_school) or is_teacher_of_class(p_class)) then
    raise exception 'not authorized to load this attendance roster';
  end if;
  if not exists (select 1 from classes c where c.id = p_class and c.school_id = p_school) then
    raise exception 'class belongs to another school';
  end if;
  if p_stream is not null and not exists (
    select 1 from class_streams st where st.id = p_stream and st.school_id = p_school and st.class_id = p_class
  ) then raise exception 'stream does not belong to the selected class'; end if;

  return query
  select s.id, s.full_name, e.id
  from student_enrollments e
  join students s on s.id = e.student_id and s.school_id = p_school
  where e.school_id = p_school
    and e.class_id = p_class
    and (p_stream is null or e.stream_id = p_stream)
    and e.enrolled_on <= p_date
    and (e.ended_on is null or e.ended_on >= p_date)
  order by s.full_name;
end $$;
revoke all on function attendance_roster_for_date(uuid, uuid, date, uuid) from public, anon;
grant execute on function attendance_roster_for_date(uuid, uuid, date, uuid) to authenticated;

create or replace function mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update notifications set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
    values (null, auth.uid(), 'notification.read_all', 'notifications', null,
            jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;
revoke all on function mark_all_notifications_read() from public, anon;
grant execute on function mark_all_notifications_read() to authenticated;

-- Discounts/waivers must affect the invoice atomically; merely inserting the
-- adjustment row would otherwise leave amount_due and balance unchanged.
create or replace function apply_invoice_adjustment(
  p_school uuid,
  p_invoice uuid,
  p_kind text,
  p_amount numeric,
  p_reason text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv student_invoices; v_id uuid;
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role() = 'accountant')) then
    raise exception 'only finance staff may apply an adjustment';
  end if;
  if p_kind not in ('discount', 'waiver') then raise exception 'invalid adjustment kind'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'adjustment amount must be greater than zero'; end if;
  select * into v_inv from student_invoices where id = p_invoice and school_id = p_school for update;
  if v_inv.id is null then raise exception 'invoice belongs to another school'; end if;
  if v_inv.status in ('cancelled', 'paid') then raise exception 'this invoice cannot be adjusted'; end if;
  if p_amount > (v_inv.amount_due - v_inv.amount_paid) then
    raise exception 'adjustment exceeds the outstanding balance';
  end if;

  insert into invoice_adjustments (school_id, invoice_id, kind, amount, reason, created_by)
  values (p_school, p_invoice, p_kind, p_amount, nullif(trim(coalesce(p_reason,'')),''), auth.uid())
  returning id into v_id;

  update student_invoices set
    amount_due = amount_due - p_amount,
    status = case
      when amount_paid >= amount_due - p_amount then 'paid'
      when amount_paid > 0 then 'part_paid'
      else 'issued' end
  where id = p_invoice;

  insert into audit_logs (school_id, actor_id, action, entity, entity_id, detail)
  values (p_school, auth.uid(), 'invoice.adjustment.create', 'invoice_adjustments', v_id::text,
          jsonb_build_object('invoice_id', p_invoice, 'kind', p_kind, 'amount', p_amount, 'reason', p_reason));
  return v_id;
end $$;
revoke all on function apply_invoice_adjustment(uuid, uuid, text, numeric, text) from public, anon;
grant execute on function apply_invoice_adjustment(uuid, uuid, text, numeric, text) to authenticated;

-- Additional real report families. Unauthorized callers raise; no error is
-- converted into a fake zero.
create or replace function report_attendance_overview(
  p_school uuid, p_class uuid default null, p_from date default null, p_to date default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  return attendance_summary(p_school, p_class, null, p_from, p_to);
end $$;
revoke all on function report_attendance_overview(uuid, uuid, date, date) from public, anon;
grant execute on function report_attendance_overview(uuid, uuid, date, date) to authenticated;

create or replace function report_timetable_overview(p_school uuid, p_academic_year uuid default null, p_term uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_entries integer; v_teachers integer; v_classes integer; v_periods integer;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select count(*), count(distinct teacher_id), count(distinct class_id)
    into v_entries, v_teachers, v_classes
  from timetable_entries
  where school_id = p_school and status = 'active'
    and (p_academic_year is null or academic_year_id = p_academic_year)
    and (p_term is null or term_id = p_term);
  select count(*) into v_periods from timetable_periods
  where school_id = p_school and is_active
    and (p_academic_year is null or academic_year_id is null or academic_year_id = p_academic_year);
  return jsonb_build_object('entries',v_entries,'teachers',v_teachers,'classes',v_classes,'periods',v_periods);
end $$;
revoke all on function report_timetable_overview(uuid, uuid, uuid) from public, anon;
grant execute on function report_timetable_overview(uuid, uuid, uuid) to authenticated;

create or replace function report_assignment_overview(p_school uuid, p_class uuid default null, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_assign integer; v_sub integer; v_graded integer; v_late integer;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select count(*) into v_assign from assignments a
   where a.school_id=p_school and (p_class is null or a.class_id=p_class)
     and (p_from is null or a.assigned_on>=p_from) and (p_to is null or a.assigned_on<=p_to);
  select count(*), count(*) filter (where s.status='graded'), count(*) filter (where a.due_on is not null and s.submitted_at >= a.due_on::timestamptz + interval '1 day')
    into v_sub, v_graded, v_late
  from assignment_submissions s join assignments a on a.id=s.assignment_id
  where s.school_id=p_school and (p_class is null or a.class_id=p_class)
    and (p_from is null or a.assigned_on>=p_from) and (p_to is null or a.assigned_on<=p_to);
  return jsonb_build_object('assignments',v_assign,'submissions',v_sub,'graded',v_graded,'late_submissions',v_late);
end $$;
revoke all on function report_assignment_overview(uuid, uuid, date, date) from public, anon;
grant execute on function report_assignment_overview(uuid, uuid, date, date) to authenticated;

create or replace function report_payment_overview(p_school uuid, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_count integer; v_amount numeric; v_reversed integer;
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role()='accountant')) then
    raise exception 'not authorized to read this report';
  end if;
  select count(*) filter (where not reversed), coalesce(sum(amount) filter (where not reversed),0), count(*) filter (where reversed)
    into v_count,v_amount,v_reversed
  from payments where school_id=p_school
    and (p_from is null or paid_on>=p_from) and (p_to is null or paid_on<=p_to);
  return jsonb_build_object('payment_count',v_count,'amount_received',v_amount,'reversed_count',v_reversed);
end $$;
revoke all on function report_payment_overview(uuid, date, date) from public, anon;
grant execute on function report_payment_overview(uuid, date, date) to authenticated;

create or replace function report_discipline_overview(p_school uuid, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total integer; v_open integer; v_resolved integer; v_follow integer;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select count(*), count(*) filter (where status <> 'resolved'), count(*) filter (where status='resolved'),
         count(*) filter (where follow_up_on is not null and follow_up_on >= current_date)
    into v_total,v_open,v_resolved,v_follow
  from incidents where school_id=p_school
    and (p_from is null or incident_date>=p_from) and (p_to is null or incident_date<=p_to);
  return jsonb_build_object('total',v_total,'open',v_open,'resolved',v_resolved,'upcoming_followups',v_follow);
end $$;
revoke all on function report_discipline_overview(uuid, date, date) from public, anon;
grant execute on function report_discipline_overview(uuid, date, date) to authenticated;

commit;
