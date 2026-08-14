-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- OPTIONAL: remove the old demo/sample records
--
-- ####################################################################
-- #  THIS SCRIPT DELETES ROWS. READ IT BEFORE YOU RUN IT.            #
-- #                                                                  #
-- #  Run it ONLY on an installation that was set up with the old     #
-- #  database/seed.sql and that has NOT yet been used for real       #
-- #  police records. If the station has entered genuine data, DO NOT #
-- #  run this file — delete the demo rows individually from the      #
-- #  application instead.                                            #
-- #                                                                  #
-- #  Always take a full backup first:                                #
-- #    mysqldump -u root -p gabiley_police > backup-$(date +%F).sql  #
-- ####################################################################
--
-- Everything below is scoped to the exact identifiers the old seed file
-- inserted. Records created by the station are matched by none of these
-- conditions and are left untouched.

SET NAMES utf8mb4;

START TRANSACTION;

-- Child rows first so foreign keys stay satisfied.
DELETE FROM `custody_checks`
 WHERE `booking_id` IN (SELECT `id` FROM `custody_bookings`
                         WHERE `booking_number` IN ('BK-2026-0221','BK-2026-0219'));

DELETE FROM `custody_bookings` WHERE `booking_number` IN ('BK-2026-0221','BK-2026-0219');

DELETE FROM `evidence_movements`
 WHERE `evidence_id` IN (SELECT `id` FROM `evidence`
                          WHERE `evidence_number` LIKE 'EV-2026-0%'
                             OR `evidence_number` LIKE 'EV-2026-1%');

DELETE FROM `case_persons`
 WHERE `case_id` IN (SELECT `id` FROM `cases` WHERE `case_number` LIKE 'CR-2026-0%');

DELETE FROM `arrests`  WHERE `arrest_number`  IN ('AR-2026-0098','AR-2026-0094');
DELETE FROM `warrants` WHERE `warrant_number` IN ('WR-2026-0031','WR-2026-0028');

DELETE FROM `workflow_tasks` WHERE `task_number`   LIKE 'TSK-2026-01%';
DELETE FROM `field_reports`  WHERE `report_number` LIKE 'FR-2026-004%';
DELETE FROM `emergency_calls` WHERE `call_number`  LIKE 'CALL-2026-10%';
DELETE FROM `duty_roster`
 WHERE `officer_id` IN (SELECT `id` FROM `officers` WHERE `email` LIKE '%@gabiley-police.demo');

DELETE FROM `evidence`     WHERE `evidence_number`  LIKE 'EV-2026-%';
DELETE FROM `cases`        WHERE `case_number`      LIKE 'CR-2026-%';
DELETE FROM `incidents`    WHERE `incident_number`  LIKE 'INC-104%';
DELETE FROM `complaints`   WHERE `complaint_number` LIKE 'CMP-2026-1%';
DELETE FROM `prisoners`    WHERE `prison_id`        LIKE 'PR-2026-%';
DELETE FROM `citizens`     WHERE `national_id`      LIKE 'C-0%';
DELETE FROM `patrol_units` WHERE `unit_code`        IN ('P04','P08','T03','U12','SR2');
DELETE FROM `fleet`        WHERE `plate_number`     LIKE 'POL-0%';
DELETE FROM `operations`   WHERE `name`             LIKE 'Operation %';
DELETE FROM `intelligence` WHERE `title` IN (
  'Regional Threat Brief 08-04','Organized Crime Network Update',
  'Public Event Risk Assessment','Border Movement Summary');
DELETE FROM `expenses` WHERE `title` IN (
  'Mushahar Saraakiisha - Jul','Fuel Fleet - Jul','Operation Supplies','Office Supplies');
DELETE FROM `reports` WHERE `title` IN (
  'Daily Command Brief — 04 Aug','Crime Review — July 2026','Fleet Readiness Report');

-- Demo staff accounts. The per-user permission grants go with them.
DELETE FROM `user_permissions`
 WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `email` LIKE '%@gabiley-police.demo');

DELETE FROM `users`    WHERE `email` LIKE '%@gabiley-police.demo';
DELETE FROM `officers` WHERE `email` LIKE '%@gabiley-police.demo';

-- Reset the station counters; they are derived live by api/stations.php.
UPDATE `stations` SET `total_officers` = 0, `active_cases` = 0, `vehicles` = 0, `readiness_pct` = 0 WHERE `id` = 1;

COMMIT;

-- Safety check — every count below should be 0 if this was a demo-only install.
SELECT
  (SELECT COUNT(*) FROM `users`    WHERE `email` LIKE '%@gabiley-police.demo') AS demo_users,
  (SELECT COUNT(*) FROM `officers` WHERE `email` LIKE '%@gabiley-police.demo') AS demo_officers,
  (SELECT COUNT(*) FROM `cases`    WHERE `case_number` LIKE 'CR-2026-%')       AS demo_cases;
