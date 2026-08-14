-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Migration: production UI / no-demo release
--
-- SAFE AND NON-DESTRUCTIVE. This script does not drop tables, does not delete
-- operational records and does not reset the database. It only clears stored
-- figures that the application now derives live, and blanks a placeholder
-- contact address.
--
-- Take a backup first:
--   mysqldump -u root -p gabiley_police > backup-$(date +%F).sql
--
-- Then run once:
--   mysql -u root -p gabiley_police < database/migration_production_ui.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- 1. Station strength counters.
--
-- These columns used to hold hand-written totals (248 officers, 24 cases,
-- 18 vehicles, 92% readiness) that were shown as if they were statistics.
-- api/stations.php now computes all four with live COUNT queries, so the
-- stored values are no longer read. They are zeroed to make that unambiguous;
-- the columns are kept so the migration stays reversible and no existing
-- integration breaks.
-- ---------------------------------------------------------------------------
UPDATE `stations`
   SET `total_officers` = 0,
       `active_cases`   = 0,
       `vehicles`       = 0,
       `readiness_pct`  = 0
 WHERE `id` = 1;

-- ---------------------------------------------------------------------------
-- 2. Placeholder contact address.
--
-- Only clears the value when it is still the unroutable .demo placeholder, so
-- a station that has already entered its real address keeps it.
-- ---------------------------------------------------------------------------
UPDATE `settings`
   SET `value` = ''
 WHERE `key` = 'email'
   AND `value` LIKE '%@gabiley-police.demo';

-- ---------------------------------------------------------------------------
-- 3. Budget placeholder.
--
-- The seeded 1,280,000 annual budget was an invented figure. It is cleared
-- only when it still holds exactly that seeded value.
-- ---------------------------------------------------------------------------
UPDATE `settings`
   SET `value` = '0'
 WHERE `key` = 'annual_budget'
   AND `value` = '1280000';
