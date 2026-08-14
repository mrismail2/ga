-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Bootstrap reference data.
--
-- This file contains ONLY the reference rows the application needs in order to
-- run: the role catalogue, the single station record and default settings.
--
-- It deliberately contains NO operational records — no officers, citizens,
-- cases, evidence, prisoners, vehicles, complaints or reports. Those are
-- entered by the station through the application. Every dashboard figure is a
-- live COUNT over these tables, so an empty database correctly reports 0 and
-- each module shows its empty state.
--
-- The first administrator account is NOT created here. install.php creates it
-- from the name, email and password the installing officer supplies, so no
-- shared or published credential ever exists.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Roles — the permission ceiling for each kind of account. The Commander then
-- grants each individual member of staff their own subset of pages/actions.
-- ---------------------------------------------------------------------------
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'Super Admin',      'Awood buuxda oo nidaamka ah.'),
(2, 'Commander',        'Maamul iyo ansixin heer talis.'),
(3, 'Investigator',     'Kiisas, caddeymo iyo baaritaan.'),
(4, 'Officer',          'Hawl maalmeed iyo dhacdooyin.'),
(5, 'Evidence Officer', 'Maamulka caddeymaha.')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- ---------------------------------------------------------------------------
-- The single station. Counters stay at 0: officer, case and vehicle totals are
-- always derived from live COUNT queries, never from stored numbers.
-- ---------------------------------------------------------------------------
INSERT INTO `stations`
  (`id`, `name`, `code`, `address`, `phone`, `total_officers`, `active_cases`, `vehicles`, `readiness_pct`)
VALUES
  (1, 'Saldhigga Booliska Gobolka Gabiley', 'GB-HQ-001', 'Gobolka Gabiley', '999', 0, 0, 0, 0)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ---------------------------------------------------------------------------
-- Default settings. The station edits these from Settings after installation.
-- ---------------------------------------------------------------------------
INSERT INTO `settings` (`key`, `value`) VALUES
('system_name',        'CIIDANKA BOOLISKA GOBOLKA GABILEY'),
('command_name',       'Taliska Ciidanka Booliska Gobolka Gabiley'),
('emergency_phone',    '999'),
('email',              ''),
('address',            ''),
('language',           'so'),
('session_timeout',    '30'),
('two_factor_required','0'),
('login_alerts',       '1'),
('audit_logging',      '1'),
('backup_schedule',    'daily'),
('backup_retention',   '90'),
('annual_budget',      '0')
ON DUPLICATE KEY UPDATE `value` = `settings`.`value`;
