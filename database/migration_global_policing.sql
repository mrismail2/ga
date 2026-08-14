-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Migration: global policing workflows + security hardening
-- Run ONCE against the previous single-station/profile database.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Keep the deployment permanently scoped to one station.
INSERT INTO stations (id,name,code,commander_name,address,phone,status)
VALUES (1,'Saldhigga Booliska Gobolka Gabiley','GB-HQ-001','Taliyaha Ciidanka','Gobolka Gabiley','999','active')
ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), address=VALUES(address), phone=VALUES(phone), status='active';
UPDATE users SET station_id=1;
UPDATE officers SET station_id=1;
UPDATE cases SET station_id=1;
UPDATE field_reports SET station_id=1;
DELETE FROM stations WHERE id<>1;

-- Authentication and session controls.
ALTER TABLE users
  ADD COLUMN security_clearance ENUM('Public','Official','Restricted','Secret') DEFAULT 'Official' AFTER two_factor_enabled,
  ADD COLUMN force_password_change TINYINT(1) DEFAULT 1 AFTER security_clearance,
  ADD COLUMN failed_login_count TINYINT UNSIGNED DEFAULT 0 AFTER force_password_change,
  ADD COLUMN locked_until DATETIME DEFAULT NULL AFTER failed_login_count,
  ADD COLUMN password_changed_at DATETIME DEFAULT NULL AFTER locked_until;
ALTER TABLE sessions
  ADD COLUMN last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP AFTER expires_at,
  ADD COLUMN revoked_at DATETIME DEFAULT NULL AFTER last_activity_at;

-- Computer-aided dispatch fields on the existing incident register.
ALTER TABLE incidents
  ADD COLUMN call_number VARCHAR(30) DEFAULT NULL AFTER incident_number,
  ADD COLUMN source ENUM('Emergency Call','Walk-in','Patrol','Online','Other') DEFAULT 'Emergency Call' AFTER call_number,
  ADD COLUMN caller_name VARCHAR(100) DEFAULT NULL AFTER source,
  ADD COLUMN caller_phone VARCHAR(30) DEFAULT NULL AFTER caller_name,
  ADD COLUMN dispatcher_id INT UNSIGNED DEFAULT NULL AFTER assigned_unit,
  MODIFY COLUMN status ENUM('reported','queued','dispatched','responding','at_scene','resolved','closed','cancelled') DEFAULT 'reported',
  ADD COLUMN dispatched_at DATETIME DEFAULT NULL AFTER reported_at,
  ADD COLUMN arrived_at DATETIME DEFAULT NULL AFTER dispatched_at,
  ADD INDEX idx_incident_priority_status (priority,status),
  ADD INDEX idx_incident_reported_at (reported_at),
  ADD CONSTRAINT fk_incident_dispatcher FOREIGN KEY (dispatcher_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS `emergency_calls` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `call_number` VARCHAR(30) NOT NULL UNIQUE,
  `received_by` INT UNSIGNED DEFAULT NULL,
  `caller_name` VARCHAR(100) DEFAULT NULL,
  `caller_phone` VARCHAR(30) DEFAULT NULL,
  `call_type` VARCHAR(100) NOT NULL,
  `priority` ENUM('P1','P2','P3','P4') DEFAULT 'P3',
  `location` VARCHAR(200) NOT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `summary` TEXT DEFAULT NULL,
  `status` ENUM('New','Validated','Dispatched','Responding','At Scene','Resolved','Cancelled') DEFAULT 'New',
  `incident_id` INT UNSIGNED DEFAULT NULL,
  `unit_code` VARCHAR(20) DEFAULT NULL,
  `received_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `dispatched_at` DATETIME DEFAULT NULL,
  `closed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON DELETE SET NULL,
  INDEX `idx_call_status_priority` (`status`,`priority`),
  INDEX `idx_call_received_at` (`received_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `case_persons` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `case_id` INT UNSIGNED NOT NULL,
  `citizen_id` INT UNSIGNED DEFAULT NULL,
  `person_name` VARCHAR(100) NOT NULL,
  `role` ENUM('Victim','Witness','Suspect','Accused','Complainant','Informant','Other') NOT NULL,
  `statement_status` ENUM('Not Taken','Scheduled','Taken','Verified') DEFAULT 'Not Taken',
  `is_vulnerable` TINYINT(1) DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_case_person_role` (`case_id`,`citizen_id`,`role`),
  INDEX `idx_case_person_case` (`case_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `warrants` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `warrant_number` VARCHAR(40) NOT NULL UNIQUE,
  `case_id` INT UNSIGNED DEFAULT NULL,
  `person_name` VARCHAR(100) NOT NULL,
  `warrant_type` ENUM('Arrest','Search','Summons','Other') DEFAULT 'Arrest',
  `issuing_authority` VARCHAR(150) NOT NULL,
  `issued_date` DATE NOT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `status` ENUM('Active','Executed','Expired','Cancelled') DEFAULT 'Active',
  `risk_level` ENUM('Low','Medium','High','Critical') DEFAULT 'Medium',
  `notes` TEXT DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `executed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_warrant_status` (`status`),
  INDEX `idx_warrant_person` (`person_name`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `arrests` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `arrest_number` VARCHAR(40) NOT NULL UNIQUE,
  `case_id` INT UNSIGNED DEFAULT NULL,
  `warrant_id` BIGINT UNSIGNED DEFAULT NULL,
  `citizen_id` INT UNSIGNED DEFAULT NULL,
  `person_name` VARCHAR(100) NOT NULL,
  `arrested_by` INT UNSIGNED DEFAULT NULL,
  `arrested_at` DATETIME NOT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `legal_basis` VARCHAR(200) NOT NULL,
  `rights_explained` TINYINT(1) DEFAULT 0,
  `use_of_force` TINYINT(1) DEFAULT 0,
  `medical_attention` TINYINT(1) DEFAULT 0,
  `status` ENUM('Booked','Released','Transferred','Court') DEFAULT 'Booked',
  `notes` TEXT DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`warrant_id`) REFERENCES `warrants`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`citizen_id`) REFERENCES `citizens`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`arrested_by`) REFERENCES `officers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_arrest_person` (`person_name`),
  INDEX `idx_arrest_date` (`arrested_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `custody_bookings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `booking_number` VARCHAR(40) NOT NULL UNIQUE,
  `prisoner_id` INT UNSIGNED NOT NULL,
  `arrest_id` BIGINT UNSIGNED DEFAULT NULL,
  `booked_by` INT UNSIGNED DEFAULT NULL,
  `booked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `legal_authority` VARCHAR(200) NOT NULL,
  `rights_given_at` DATETIME DEFAULT NULL,
  `property_inventory` TEXT DEFAULT NULL,
  `medical_screening` TEXT DEFAULT NULL,
  `risk_level` ENUM('Standard','Vulnerable','Self-harm Risk','Medical Risk','High Risk') DEFAULT 'Standard',
  `cell` VARCHAR(20) DEFAULT NULL,
  `review_due_at` DATETIME DEFAULT NULL,
  `status` ENUM('In Custody','Court','Released','Transferred') DEFAULT 'In Custody',
  `released_at` DATETIME DEFAULT NULL,
  `release_authority` VARCHAR(150) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`prisoner_id`) REFERENCES `prisoners`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`arrest_id`) REFERENCES `arrests`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`booked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_booking_status` (`status`),
  INDEX `idx_booking_review_due` (`review_due_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `custody_checks` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `booking_id` BIGINT UNSIGNED NOT NULL,
  `checked_by` INT UNSIGNED DEFAULT NULL,
  `check_type` ENUM('Welfare','Meal','Medication','Legal Visit','Family Contact','Court Transfer','Other') DEFAULT 'Welfare',
  `observation` TEXT NOT NULL,
  `action_taken` TEXT DEFAULT NULL,
  `checked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`booking_id`) REFERENCES `custody_bookings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_custody_check_booking` (`booking_id`,`checked_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `evidence_movements` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `evidence_id` INT UNSIGNED NOT NULL,
  `movement_type` ENUM('Collected','Received','Transferred','Examined','Sealed','Unsealed','Court','Returned','Disposed') NOT NULL,
  `from_location` VARCHAR(120) DEFAULT NULL,
  `to_location` VARCHAR(120) DEFAULT NULL,
  `released_by` INT UNSIGNED DEFAULT NULL,
  `received_by` INT UNSIGNED DEFAULT NULL,
  `purpose` VARCHAR(200) DEFAULT NULL,
  `condition_note` TEXT DEFAULT NULL,
  `seal_number` VARCHAR(50) DEFAULT NULL,
  `occurred_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`evidence_id`) REFERENCES `evidence`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`released_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_evidence_movement` (`evidence_id`,`occurred_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `duty_roster` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `officer_id` INT UNSIGNED NOT NULL,
  `duty_date` DATE NOT NULL,
  `shift` ENUM('A','B','C','Special') NOT NULL,
  `assignment` VARCHAR(120) NOT NULL,
  `zone` VARCHAR(80) DEFAULT NULL,
  `unit_code` VARCHAR(20) DEFAULT NULL,
  `supervisor_id` INT UNSIGNED DEFAULT NULL,
  `start_time` TIME DEFAULT NULL,
  `end_time` TIME DEFAULT NULL,
  `status` ENUM('Scheduled','Checked In','Completed','Absent','Excused') DEFAULT 'Scheduled',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`supervisor_id`) REFERENCES `officers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_officer_duty_shift` (`officer_id`,`duty_date`,`shift`),
  INDEX `idx_roster_date` (`duty_date`,`status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `workflow_tasks` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `task_number` VARCHAR(40) NOT NULL UNIQUE,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_id` BIGINT UNSIGNED DEFAULT NULL,
  `assigned_to` INT UNSIGNED DEFAULT NULL,
  `assigned_role` VARCHAR(50) DEFAULT NULL,
  `priority` ENUM('Low','Medium','High','Critical') DEFAULT 'Medium',
  `due_at` DATETIME DEFAULT NULL,
  `status` ENUM('Open','In Progress','Completed','Cancelled','Overdue') DEFAULT 'Open',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_task_assignee_status` (`assigned_to`,`status`),
  INDEX `idx_task_due` (`due_at`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `document_number` VARCHAR(40) NOT NULL UNIQUE,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `file_name` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `file_size` BIGINT UNSIGNED NOT NULL,
  `sha256` CHAR(64) NOT NULL,
  `classification` ENUM('Official','Restricted','Secret') DEFAULT 'Official',
  `uploaded_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_document_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `success` TINYINT(1) DEFAULT 0,
  `attempted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_attempt_window` (`email`,`ip_address`,`attempted_at`)
) ENGINE=InnoDB;

-- Expand audit evidence for investigations and access reviews.
ALTER TABLE audit_log
  ADD COLUMN user_agent VARCHAR(255) DEFAULT NULL AFTER ip_address,
  ADD COLUMN request_id VARCHAR(64) DEFAULT NULL AFTER user_agent,
  ADD COLUMN outcome ENUM('success','failure','denied') DEFAULT 'success' AFTER request_id;

UPDATE users SET security_clearance = CASE
  WHEN role_id IN (1,2) THEN 'Secret'
  WHEN role_id IN (3,5) THEN 'Restricted'
  ELSE 'Official' END,
  force_password_change = 0;

SET FOREIGN_KEY_CHECKS = 1;
