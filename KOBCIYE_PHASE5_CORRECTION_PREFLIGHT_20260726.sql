-- ============================================================================
-- Kobciye — Phase 5 CORRECTION preflight (read-only)
--
-- Run this BEFORE applying the corrective migration
--   supabase/migrations/20260726000010_phase5_identifier_login.sql
-- against a copy/branch of the database. It is strictly READ-ONLY: it does not
-- create, alter, drop, insert, update or delete anything. It reports whether
-- the additive, data-preserving corrective migration can apply cleanly.
--
-- The migration itself is additive and transactional (add login_code +
-- backfill + unique partial index; add profiles.must_change_password; create
-- login_attempts; create resolver / rate-limit / audit functions). Nothing in
-- the delivered 0001–0009 migrations is rewritten.
--
-- Expected result: blocking_rows = 0 for every row below. Any row > 0 must be
-- resolved by hand FIRST (guidance at the bottom) — no row is auto-changed.
-- ============================================================================

with checks as (

  -- 1. login_code backfill collision. The migration backfills
  --    schools.login_code = 'SCH-' || upper(substr(replace(id::text,'-',''),1,6))
  --    then adds a UNIQUE partial index. If two existing schools would derive
  --    the SAME code, the unique index creation would fail. This detects that
  --    BEFORE the migration runs so it can never abort mid-apply.
  select 'login_code_backfill_collision' as check_name,
         count(*) as blocking_rows
  from (
    select upper(substr(replace(id::text, '-', ''), 1, 6)) as code
    from schools
    group by 1
    having count(*) > 1
  ) dup

  union all

  -- 2. Pre-existing login_code duplicates (if the column somehow already
  --    exists from a partial prior run). Zero unless a manual column was added.
  select 'existing_login_code_duplicate',
         coalesce((
           select count(*) from (
             select login_code from information_schema.columns
             where table_name = 'schools' and column_name = 'login_code'
           ) c
           where exists (
             select 1 from schools s
             where s.login_code is not null
             group by s.login_code having count(*) > 1
           )
         ), 0)

  union all

  -- 3. Students that can never resolve an identifier login: an active student
  --    with NO linked auth profile (profile_id is null) AND no primary parent.
  --    Informational — these accounts simply cannot log in until provisioned;
  --    the migration does not depend on them, so any value is acceptable.
  select 'students_without_login_path (informational)',
         count(*)
  from students st
  where st.status = 'active'
    and st.profile_id is null
    and not exists (
      select 1 from student_parents sp
      where sp.student_id = st.id and sp.is_primary = true
    )

  union all

  -- 4. Multiple primary parents on one student. §3.4 requires exactly ONE
  --    primary-login parent; the resolver deterministically picks the lowest
  --    id, but a data-entry duplicate is worth reviewing. Informational.
  select 'students_with_multiple_primary_parents (informational)',
         count(*)
  from (
    select student_id from student_parents
    where is_primary = true
    group by student_id having count(*) > 1
  ) m

  union all

  -- 5. profiles.must_change_password collision. Zero unless a manual column
  --    with a conflicting type already exists (the migration uses
  --    add column if not exists ... boolean not null default false).
  select 'must_change_password_type_conflict',
         coalesce((
           select count(*) from information_schema.columns
           where table_name = 'profiles' and column_name = 'must_change_password'
             and data_type <> 'boolean'
         ), 0)

  union all

  -- 6. login_attempts name collision with a non-table object. Zero unless a
  --    view/other relation already owns the name.
  select 'login_attempts_name_conflict',
         coalesce((
           select count(*) from information_schema.tables
           where table_name = 'login_attempts' and table_type <> 'BASE TABLE'
         ), 0)
)
select check_name, blocking_rows
from checks
order by check_name;

-- ----------------------------------------------------------------------------
-- Resolution guidance (manual, non-destructive):
--
-- login_code_backfill_collision > 0:
--   Two schools derive the same 6-char code from their UUIDs (extremely rare).
--   Set a distinct login_code by hand on ONE of them AFTER the migration adds
--   the column (e.g. select set_school_login_code(...)), or pre-seed a unique
--   schools.login_code before creating the index. No school row is deleted.
--
-- existing_login_code_duplicate > 0:
--   A previous partial run left duplicate codes. Blank the code on the
--   accidental copy (update schools set login_code = null where id = '…') and
--   re-run this preflight; the migration will re-backfill a unique value.
--
-- must_change_password_type_conflict > 0 / login_attempts_name_conflict > 0:
--   A manual object already owns the name with an incompatible shape. Rename or
--   drop that manual object in a reviewed migration first — do NOT let this
--   corrective migration collide with it.
--
-- The two "(informational)" rows never block the migration; they flag login
-- data to clean up so real users can actually sign in.
-- ----------------------------------------------------------------------------
