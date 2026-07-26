-- ============================================================
-- Kobciye Phase 5 — READ-ONLY preflight
--
-- Run this BEFORE applying the Phase 5 migrations. It only SELECTs; it never
-- writes, deletes, resets, or deploys. Each query returns the COUNT of rows in
-- a category that would block a Phase 5 guard. The expected result for every
-- query is ZERO. A non-zero count names rows to inspect and correct by hand —
-- no data is ever removed automatically.
--
-- HOW TO RUN: paste into the Supabase SQL editor (or psql) against the target
-- project and read the counts. Do NOT run `supabase db reset`.
--
-- Migration execution order (filename order — additive, transactional):
--   20260726000001_phase5_account_provisioning.sql
--   20260726000002_phase5_timetable.sql
--   20260726000003_phase5_attendance_notifications.sql
--   20260726000004_phase5_assignments.sql
--   20260726000005_phase5_exams_results.sql
--   20260726000006_phase5_finance.sql
--   20260726000007_phase5_discipline.sql
--   20260726000008_phase5_university_results.sql
--   20260726000009_phase5_reports.sql
-- ============================================================

-- 1. Account provisioning installs UNIQUE(profile_id) on teachers/students/
--    parents. A profile linked to two records of the same kind would block it.
select 'teachers_sharing_profile'  as check_name, count(*) as blocking_rows from (
  select profile_id from teachers where profile_id is not null group by profile_id having count(*) > 1) t
union all
select 'students_sharing_profile', count(*) from (
  select profile_id from students where profile_id is not null group by profile_id having count(*) > 1) t
union all
select 'parents_sharing_profile', count(*) from (
  select profile_id from parents where profile_id is not null group by profile_id having count(*) > 1) t

-- 2. A domain record linked to a profile of a DIFFERENT school (the
--    provisioning preflight refuses to install over this).
union all
select 'teacher_profile_cross_school', count(*) from teachers t
  join profiles p on p.id = t.profile_id
  where t.profile_id is not null and p.school_id is distinct from t.school_id
union all
select 'student_profile_cross_school', count(*) from students s
  join profiles p on p.id = s.profile_id
  where s.profile_id is not null and p.school_id is distinct from s.school_id
union all
select 'parent_profile_cross_school', count(*) from parents pa
  join profiles p on p.id = pa.profile_id
  where pa.profile_id is not null and p.school_id is distinct from pa.school_id

-- 3. Finance extends `payments` with a UNIQUE(school_id, reference) partial
--    index. Duplicate non-null references within a school would block it.
union all
select 'duplicate_payment_reference', count(*) from (
  select school_id, reference from payments
  where reference is not null group by school_id, reference having count(*) > 1) t

-- 4. Results workflow keeps the legacy `published` flag in step with a new
--    `status`. Rows already published are fine; this simply reports how many
--    exist so you know they will be back-labelled status='published' on write.
union all
select 'already_published_results', count(*) from results where published is true

order by check_name;

-- ------------------------------------------------------------
-- Expected result: blocking_rows = 0 for every row EXCEPT
-- 'already_published_results', which is informational (any value is fine).
--
-- If a *_sharing_profile or *_cross_school count is > 0:
--   Inspect the offending rows, e.g.
--     select id, school_id, profile_id, full_name from teachers
--     where profile_id in (select profile_id from teachers
--       where profile_id is not null group by profile_id having count(*) > 1);
--   Decide which record should keep the login and set the OTHER record's
--   profile_id back to NULL (it can be re-provisioned later). No row is
--   deleted; you are only clearing an incorrect link.
--
-- If 'duplicate_payment_reference' > 0:
--   Inspect the duplicates and blank the reference on the accidental copy
--   (update payments set reference = null where id = '…'); the payment row
--   itself is preserved.
-- ------------------------------------------------------------
