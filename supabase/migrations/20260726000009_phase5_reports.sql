-- ============================================================
-- Kobciye Phase 5 — Stage 7b: reports
--
-- Reports are READ-ONLY aggregations over real Phase 1–5 data. They are
-- SECURITY DEFINER functions that each re-check the caller is a School Admin
-- of the school they ask about (super_admin passes is_admin_of for any
-- school, but only via the school it was handed — the client only ever passes
-- the resolved activeSchoolId). They return real counts/sums; a caller with
-- no rows gets a real zero, and an unauthorized caller gets an exception —
-- never a silent zero.
--
-- No tables, no fake values. Additive only.
-- ============================================================

begin;

-- enrollment summary: active students per class, plus school total
create or replace function report_enrollment_summary(p_school uuid, p_academic_year uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb; v_total integer;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb), coalesce(sum(t.active_count), 0)
    into v_rows, v_total
  from (
    select c.id as class_id, c.name as class_name,
           count(e.id) filter (where e.status = 'active') as active_count
    from classes c
    left join student_enrollments e on e.class_id = c.id and e.school_id = p_school
      and (p_academic_year is null or e.academic_year_id = p_academic_year)
    where c.school_id = p_school
    group by c.id, c.name
    order by c.name
  ) t;
  return jsonb_build_object('classes', v_rows, 'total_active', v_total);
end $$;
revoke all on function report_enrollment_summary(uuid, uuid) from public, anon;
grant execute on function report_enrollment_summary(uuid, uuid) to authenticated;

-- fee balance summary: totals across issued invoices
create or replace function report_fee_balance_summary(p_school uuid, p_academic_year uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row record;
begin
  if not (is_admin_of(p_school) or (is_staff_of(p_school) and my_role() = 'accountant')) then
    raise exception 'not authorized to read this report';
  end if;
  select coalesce(sum(amount_due), 0) as due,
         coalesce(sum(amount_paid), 0) as paid,
         coalesce(sum(balance), 0) as balance,
         count(*) as invoices,
         count(*) filter (where status = 'paid') as paid_invoices,
         count(*) filter (where balance > 0 and status <> 'cancelled') as outstanding_invoices
    into v_row
  from student_invoices
  where school_id = p_school and status <> 'draft'
    and (p_academic_year is null or academic_year_id = p_academic_year);
  return jsonb_build_object(
    'total_due', v_row.due, 'total_paid', v_row.paid, 'total_balance', v_row.balance,
    'invoice_count', v_row.invoices, 'paid_invoices', v_row.paid_invoices,
    'outstanding_invoices', v_row.outstanding_invoices);
end $$;
revoke all on function report_fee_balance_summary(uuid, uuid) from public, anon;
grant execute on function report_fee_balance_summary(uuid, uuid) to authenticated;

-- teacher assignment report: assignment counts per teacher
create or replace function report_teacher_assignments(p_school uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select tt.id as teacher_id, tt.full_name,
           count(a.id) filter (where a.is_active) as assignment_count
    from teachers tt
    left join teacher_assignments a on a.teacher_id = tt.id and a.school_id = p_school
    where tt.school_id = p_school
    group by tt.id, tt.full_name
    order by tt.full_name
  ) t;
  return jsonb_build_object('teachers', v_rows);
end $$;
revoke all on function report_teacher_assignments(uuid) from public, anon;
grant execute on function report_teacher_assignments(uuid) to authenticated;

-- exam/result summary: published result counts + average % per exam
create or replace function report_results_summary(p_school uuid, p_term uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rows jsonb;
begin
  if not is_admin_of(p_school) then raise exception 'not authorized to read this report'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select e.id as exam_id, e.title, c.name as class_name, s.name as subject_name,
           count(r.id) filter (where r.status = 'published') as published_count,
           round(avg(r.percentage) filter (where r.status = 'published'), 1) as avg_percentage
    from exams e
    join classes c on c.id = e.class_id
    join subjects s on s.id = e.subject_id
    left join results r on r.exam_id = e.id
    where e.school_id = p_school and (p_term is null or e.term_id = p_term)
    group by e.id, e.title, c.name, s.name
    order by e.created_at desc
  ) t;
  return jsonb_build_object('exams', v_rows);
end $$;
revoke all on function report_results_summary(uuid, uuid) from public, anon;
grant execute on function report_results_summary(uuid, uuid) to authenticated;

commit;
