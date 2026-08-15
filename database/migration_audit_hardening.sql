-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Migration: security-audit hardening
--
-- SAFE AND NON-DESTRUCTIVE. Adds columns and indexes only. No table is
-- dropped, no record is deleted, no existing value is overwritten.
--
--   mysqldump -u root -p gabiley_police > backup-$(date +%F).sql
--   mysql -u root -p gabiley_police < database/migration_audit_hardening.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Public tip line abuse control.
--
-- api/contacts.php accepts unauthenticated submissions from the public site.
-- It had no rate limit, so a single client could insert unlimited rows. The
-- submitting address is now recorded as a salted hash — enough to throttle a
-- flood without keeping the raw IP of a member of the public who reports a
-- crime.
-- ---------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contacts' AND COLUMN_NAME = 'ip_hash');
SET @sql := IF(@col = 0,
  'ALTER TABLE `contacts` ADD COLUMN `ip_hash` CHAR(64) DEFAULT NULL AFTER `message`',
  'SELECT "contacts.ip_hash already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contacts' AND INDEX_NAME = 'idx_contacts_ip_created');
SET @sql := IF(@idx = 0,
  'ALTER TABLE `contacts` ADD INDEX `idx_contacts_ip_created` (`ip_hash`, `created_at`)',
  'SELECT "contacts rate-limit index already present" AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
