-- Kobciye Phase 1–4 — SAFE READ-ONLY PREFLIGHT
-- Date: 2026-07-25
--
-- Run this first in Supabase SQL Editor.
-- It changes NOTHING. Every detail query should return 0 rows before running:
--   20260725000001_phase1_4_runtime_integrity.sql
--
-- If rows appear, do not delete or reset the database. Export the rows and
-- correct them deliberately, then run this preflight again.

-- ============================================================
-- 1. Summary
-- ============================================================
with invalid_active_enrollments as (
  select e.id
  from student_enrollments e
  left join students s
    on s.id = e.student_id and s.school_id = e.school_id
  left join classes c
    on c.id = e.class_id and c.school_id = e.school_id
  left join academic_years y
    on y.id = e.academic_year_id and y.school_id = e.school_id
  left join class_streams st
    on st.id = e.stream_id
   and st.school_id = e.school_id
   and st.class_id = e.class_id
  where e.status = 'active'
    and (
      e.class_id is null
      or e.academic_year_id is null
      or s.id is null
      or c.id is null
      or y.id is null
      or (
        c.academic_year_id is not null
        and c.academic_year_id is distinct from e.academic_year_id
      )
      or (e.stream_id is not null and st.id is null)
    )
),
invalid_teacher_assignments as (
  select a.id
  from teacher_assignments a
  left join teachers t
    on t.id = a.teacher_id and t.school_id = a.school_id
  left join subjects s
    on s.id = a.subject_id and s.school_id = a.school_id
  left join classes c
    on c.id = a.class_id and c.school_id = a.school_id
  left join academic_years y
    on y.id = a.academic_year_id and y.school_id = a.school_id
  left join class_streams st
    on st.id = a.stream_id
   and st.school_id = a.school_id
   and st.class_id = a.class_id
  left join terms tm
    on tm.id = a.term_id and tm.school_id = a.school_id
  where
    t.id is null
    or s.id is null
    or c.id is null
    or y.id is null
    or (
      s.class_id is not null
      and s.class_id is distinct from a.class_id
    )
    or (
      c.academic_year_id is not null
      and c.academic_year_id is distinct from a.academic_year_id
    )
    or (a.stream_id is not null and st.id is null)
    or (
      a.term_id is not null
      and (
        tm.id is null
        or (
          tm.academic_year_id is not null
          and tm.academic_year_id is distinct from a.academic_year_id
        )
      )
    )
),
invalid_enrolled_admissions as (
  select id
  from admissions
  where status = 'enrolled' and student_id is null
)
select 'invalid_active_enrollments' as check_name, count(*)::bigint as bad_rows
from invalid_active_enrollments
union all
select 'invalid_teacher_assignments', count(*)::bigint
from invalid_teacher_assignments
union all
select 'enrolled_admissions_missing_student', count(*)::bigint
from invalid_enrolled_admissions
order by check_name;

-- ============================================================
-- 2. Invalid active-enrollment details — expect 0 rows
-- ============================================================
select
  e.id,
  e.school_id,
  e.student_id,
  e.class_id,
  e.stream_id,
  e.academic_year_id,
  e.status,
  array_remove(array[
    case when e.class_id is null then 'missing class_id' end,
    case when e.academic_year_id is null then 'missing academic_year_id' end,
    case when s.id is null then 'student missing/cross-school' end,
    case when e.class_id is not null and c.id is null then 'class missing/cross-school' end,
    case when e.academic_year_id is not null and y.id is null then 'academic year missing/cross-school' end,
    case when c.id is not null
           and c.academic_year_id is not null
           and c.academic_year_id is distinct from e.academic_year_id
         then 'class/year mismatch' end,
    case when e.stream_id is not null and st.id is null then 'stream/class mismatch' end
  ], null) as problems
from student_enrollments e
left join students s
  on s.id = e.student_id and s.school_id = e.school_id
left join classes c
  on c.id = e.class_id and c.school_id = e.school_id
left join academic_years y
  on y.id = e.academic_year_id and y.school_id = e.school_id
left join class_streams st
  on st.id = e.stream_id
 and st.school_id = e.school_id
 and st.class_id = e.class_id
where e.status = 'active'
  and (
    e.class_id is null
    or e.academic_year_id is null
    or s.id is null
    or c.id is null
    or y.id is null
    or (
      c.academic_year_id is not null
      and c.academic_year_id is distinct from e.academic_year_id
    )
    or (e.stream_id is not null and st.id is null)
  )
order by e.school_id, e.student_id;

-- ============================================================
-- 3. Invalid teacher-assignment details — expect 0 rows
-- ============================================================
select
  a.id,
  a.school_id,
  a.teacher_id,
  a.subject_id,
  a.class_id,
  a.stream_id,
  a.academic_year_id,
  a.term_id,
  array_remove(array[
    case when t.id is null then 'teacher missing/cross-school' end,
    case when s.id is null then 'subject missing/cross-school' end,
    case when c.id is null then 'class missing/cross-school' end,
    case when y.id is null then 'academic year missing/cross-school' end,
    case when s.id is not null
           and s.class_id is not null
           and s.class_id is distinct from a.class_id
         then 'subject/class mismatch' end,
    case when c.id is not null
           and c.academic_year_id is not null
           and c.academic_year_id is distinct from a.academic_year_id
         then 'class/year mismatch' end,
    case when a.stream_id is not null and st.id is null then 'stream/class mismatch' end,
    case when a.term_id is not null and tm.id is null then 'term missing/cross-school' end,
    case when a.term_id is not null
           and tm.id is not null
           and tm.academic_year_id is not null
           and tm.academic_year_id is distinct from a.academic_year_id
         then 'term/year mismatch' end
  ], null) as problems
from teacher_assignments a
left join teachers t
  on t.id = a.teacher_id and t.school_id = a.school_id
left join subjects s
  on s.id = a.subject_id and s.school_id = a.school_id
left join classes c
  on c.id = a.class_id and c.school_id = a.school_id
left join academic_years y
  on y.id = a.academic_year_id and y.school_id = a.school_id
left join class_streams st
  on st.id = a.stream_id
 and st.school_id = a.school_id
 and st.class_id = a.class_id
left join terms tm
  on tm.id = a.term_id and tm.school_id = a.school_id
where
  t.id is null
  or s.id is null
  or c.id is null
  or y.id is null
  or (
    s.class_id is not null
    and s.class_id is distinct from a.class_id
  )
  or (
    c.academic_year_id is not null
    and c.academic_year_id is distinct from a.academic_year_id
  )
  or (a.stream_id is not null and st.id is null)
  or (
    a.term_id is not null
    and (
      tm.id is null
      or (
        tm.academic_year_id is not null
        and tm.academic_year_id is distinct from a.academic_year_id
      )
    )
  )
order by a.school_id, a.teacher_id;

-- ============================================================
-- 4. Enrolled admissions missing student — expect 0 rows
-- ============================================================
select id, school_id, applicant_name, status, student_id, created_at
from admissions
where status = 'enrolled' and student_id is null
order by school_id, created_at;
