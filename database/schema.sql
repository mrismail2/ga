-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Police Management System — Database Schema
-- MySQL 5.7+ / MariaDB 10.3+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `gabiley_police` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gabiley_police`;

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE `roles` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `permissions` JSON DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  `officer_id` INT UNSIGNED DEFAULT NULL,
  `station_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `photo_url` VARCHAR(255) DEFAULT NULL,
  `two_factor_enabled` TINYINT(1) DEFAULT 0,
  `security_clearance` ENUM('Public','Official','Restricted','Secret') DEFAULT 'Official',
  `force_password_change` TINYINT(1) DEFAULT 1,
  `failed_login_count` TINYINT UNSIGNED DEFAULT 0,
  `locked_until` DATETIME DEFAULT NULL,
  `password_changed_at` DATETIME DEFAULT NULL,
  `last_login` DATETIME DEFAULT NULL,
  `status` ENUM('active','inactive','suspended','invited') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB;

CREATE TABLE `user_permissions` (
  `user_id` INT UNSIGNED PRIMARY KEY,
  `allowed_pages` JSON NOT NULL,
  `allowed_capabilities` JSON NOT NULL,
  `data_scope` ENUM('own','assigned','all') NOT NULL DEFAULT 'own',
  `granted_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `user_invitations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `token_hash` CHAR(64) NOT NULL UNIQUE,
  `status` ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
  `expires_at` DATETIME NOT NULL,
  `accepted_at` DATETIME DEFAULT NULL,
  `last_sent_at` DATETIME DEFAULT NULL,
  `send_status` ENUM('pending','sent','not_configured','failed') NOT NULL DEFAULT 'pending',
  `send_error` VARCHAR(500) DEFAULT NULL,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_invite_user_status` (`user_id`,`status`),
  INDEX `idx_invite_expiry` (`expires_at`)
) ENGINE=InnoDB;

CREATE TABLE `sessions` (
  `id` VARCHAR(128) PRIMARY KEY,
  `user_id` INT UNSIGNED NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `expires_at` DATETIME NOT NULL,
  `last_activity_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SINGLE STATION (GOBOLKA GABILEY)
-- ============================================================

CREATE TABLE `stations` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `commander_name` VARCHAR(100) DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `total_officers` INT UNSIGNED DEFAULT 0,
  `active_cases` INT UNSIGNED DEFAULT 0,
  `vehicles` INT UNSIGNED DEFAULT 0,
  `readiness_pct` TINYINT UNSIGNED DEFAULT 0,
  `status` ENUM('active','inactive','maintenance') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- OFFICERS
-- ============================================================

CREATE TABLE `officers` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `badge_id` VARCHAR(20) NOT NULL UNIQUE,
  `rank` ENUM('Officer','Sergeant','Lieutenant','Captain','Major','Colonel','General') DEFAULT 'Officer',
  `department` VARCHAR(50) DEFAULT NULL,
  `station_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `shift` ENUM('A','B','C') DEFAULT 'A',
  `status` ENUM('Active','Leave','Training','Suspended','Retired') DEFAULT 'Active',
  `date_joined` DATE DEFAULT NULL,
  `photo_url` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`station_id`) REFERENCES `stations`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- CASES
-- ============================================================

CREATE TABLE `cases` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `case_number` VARCHAR(30) NOT NULL UNIQUE,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `type` ENUM('Xatooyo','Rabshad','Traffic','Fraud','Hanjabaad','Kale') DEFAULT 'Kale',
  `priority` ENUM('high','medium','low') DEFAULT 'medium',
  `status` ENUM('new','investigating','court','closed') DEFAULT 'new',
  `location` VARCHAR(200) DEFAULT NULL,
  `investigator_id` INT UNSIGNED DEFAULT NULL,
  `station_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `opened_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`investigator_id`) REFERENCES `officers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`station_id`) REFERENCES `stations`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================
-- OPERATIONS
-- ============================================================

CREATE TABLE `operations` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `op_code` VARCHAR(30) DEFAULT NULL,
  `commander_name` VARCHAR(100) DEFAULT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `personnel_count` INT UNSIGNED DEFAULT 0,
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `risk_level` ENUM('Sare','Dhexe','Hoose') DEFAULT 'Dhexe',
  `status` ENUM('Firfircoon','Qorshaysan','La xiray') DEFAULT 'Qorshaysan',
  `objective` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- INCIDENTS (Command Center)
-- ============================================================

CREATE TABLE `incidents` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `incident_number` VARCHAR(30) NOT NULL UNIQUE,
  `call_number` VARCHAR(30) DEFAULT NULL,
  `source` ENUM('Emergency Call','Walk-in','Patrol','Online','Other') DEFAULT 'Emergency Call',
  `caller_name` VARCHAR(100) DEFAULT NULL,
  `caller_phone` VARCHAR(30) DEFAULT NULL,
  `type` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `priority` ENUM('P1','P2','P3') DEFAULT 'P3',
  `location` VARCHAR(200) DEFAULT NULL,
  `assigned_unit` VARCHAR(50) DEFAULT NULL,
  `dispatcher_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('reported','queued','dispatched','responding','at_scene','resolved','closed','cancelled') DEFAULT 'reported',
  `reported_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `dispatched_at` DATETIME DEFAULT NULL,
  `arrived_at` DATETIME DEFAULT NULL,
  `resolved_at` DATETIME DEFAULT NULL,
  `case_id` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`dispatcher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_incident_priority_status` (`priority`,`status`),
  INDEX `idx_incident_reported_at` (`reported_at`)
) ENGINE=InnoDB;

-- ============================================================
-- CITIZENS
-- ============================================================

CREATE TABLE `citizens` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `national_id` VARCHAR(30) NOT NULL UNIQUE,
  `gender` ENUM('Lab','Dumar') DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `district` VARCHAR(80) DEFAULT NULL,
  `record_type` VARCHAR(50) DEFAULT NULL,
  `case_link` VARCHAR(200) DEFAULT NULL,
  `status` ENUM('Clear','Review','Flagged') DEFAULT 'Clear',
  `photo_url` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- EVIDENCE
-- ============================================================

CREATE TABLE `evidence` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `evidence_number` VARCHAR(30) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `type` ENUM('Digital','Forensic','Document','Device','Physical') DEFAULT 'Physical',
  `case_id` INT UNSIGNED DEFAULT NULL,
  `location` VARCHAR(100) DEFAULT NULL,
  `chain_of_custody` TEXT DEFAULT NULL,
  `status` ENUM('Verified','Processing','Court','Sealed','Lab','Released') DEFAULT 'Processing',
  `collected_at` DATETIME DEFAULT NULL,
  `collected_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`collected_by`) REFERENCES `officers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- PRISONERS
-- ============================================================

CREATE TABLE `prisoners` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `prison_id` VARCHAR(30) NOT NULL UNIQUE,
  `cell` VARCHAR(20) DEFAULT NULL,
  `crime` VARCHAR(100) DEFAULT NULL,
  `entry_date` DATE DEFAULT NULL,
  `release_date` VARCHAR(50) DEFAULT NULL,
  `case_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('Detained','Court Hold','Release Soon','Released','Transferred') DEFAULT 'Detained',
  `photo_url` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- PATROL UNITS
-- ============================================================

CREATE TABLE `patrol_units` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `unit_code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `personnel` VARCHAR(200) DEFAULT NULL,
  `zone` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('On route','Responding','At scene','Standby','Off duty') DEFAULT 'Standby',
  `shift` ENUM('A','B','C') DEFAULT 'A',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- FLEET / VEHICLES
-- ============================================================

CREATE TABLE `fleet` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `vehicle_name` VARCHAR(100) NOT NULL,
  `plate_number` VARCHAR(20) NOT NULL UNIQUE,
  `type` ENUM('Patrol','Response','Command','Traffic','Medical','Special') DEFAULT 'Patrol',
  `driver` VARCHAR(100) DEFAULT NULL,
  `fuel_level` VARCHAR(10) DEFAULT NULL,
  `next_service` DATE DEFAULT NULL,
  `status` ENUM('Active','Service Soon','Maintenance','Decommissioned') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- COMPLAINTS
-- ============================================================

CREATE TABLE `complaints` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `complaint_number` VARCHAR(30) NOT NULL UNIQUE,
  `type` VARCHAR(100) NOT NULL,
  `complainant` VARCHAR(100) DEFAULT NULL,
  `is_anonymous` TINYINT(1) DEFAULT 0,
  `assigned_to` VARCHAR(100) DEFAULT NULL,
  `filed_date` DATE DEFAULT NULL,
  `priority` ENUM('Sare','Dhexe','Hoose') DEFAULT 'Dhexe',
  `status` ENUM('Cusub','Baaritaan','La xalliyey','Review','Rejected') DEFAULT 'Cusub',
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- INTELLIGENCE REPORTS
-- ============================================================

CREATE TABLE `intelligence` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `classification` ENUM('S','R','C','U') DEFAULT 'U',
  `source` VARCHAR(100) DEFAULT NULL,
  `content` TEXT DEFAULT NULL,
  `threat_level` ENUM('Critical','High','Medium','Low') DEFAULT 'Low',
  `author_id` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- CONTACT MESSAGES (Public form)
-- ============================================================

CREATE TABLE `contacts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `type` VARCHAR(50) DEFAULT NULL,
  `district` VARCHAR(80) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- FINANCE / EXPENSES
-- ============================================================

CREATE TABLE `expenses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `category` ENUM('Mushahar','Hawlgallo','Fleet','Kale') DEFAULT 'Kale',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `department` VARCHAR(80) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `expense_date` DATE DEFAULT NULL,
  `approved_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- REPORTS (Generated)
-- ============================================================

CREATE TABLE `reports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL,
  `type` ENUM('Daily','Monthly','Operations','HR','Finance') DEFAULT 'Daily',
  `period` VARCHAR(50) DEFAULT NULL,
  `generated_by` VARCHAR(100) DEFAULT NULL,
  `generated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `format` ENUM('PDF','Excel','Print') DEFAULT 'PDF',
  `file_path` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- FIELD REPORTS — warbixinnada ciidanku soo gudbiyo
-- Ciidanku wuu soo gudbiyaa, taliyuhuna wuu dib u eegaa/ansixiyaa.
-- ============================================================

CREATE TABLE `field_reports` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `report_number` VARCHAR(30) NOT NULL UNIQUE,
  `officer_id` INT UNSIGNED DEFAULT NULL,
  `submitted_by` INT UNSIGNED NOT NULL,
  `station_id` INT UNSIGNED NOT NULL DEFAULT 1,
  `type` ENUM('Dhacdo','Patrol','Baaritaan','Xarig','Caddeyn','Maalinle','Kale') DEFAULT 'Dhacdo',
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `location` VARCHAR(200) DEFAULT NULL,
  `occurred_at` DATETIME DEFAULT NULL,
  `priority` ENUM('Sare','Dhexe','Hoose') DEFAULT 'Dhexe',
  `case_id` INT UNSIGNED DEFAULT NULL,
  `incident_id` INT UNSIGNED DEFAULT NULL,
  `status` ENUM('Gudbiyey','Dib u eegis','La ansixiyey','La diiday') DEFAULT 'Gudbiyey',
  `reviewed_by` INT UNSIGNED DEFAULT NULL,
  `review_note` TEXT DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`officer_id`)   REFERENCES `officers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`)    ON DELETE CASCADE,
  FOREIGN KEY (`station_id`)   REFERENCES `stations`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`case_id`)      REFERENCES `cases`(`id`)    ON DELETE SET NULL,
  FOREIGN KEY (`incident_id`)  REFERENCES `incidents`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reviewed_by`)  REFERENCES `users`(`id`)    ON DELETE SET NULL,
  INDEX `idx_submitted_by` (`submitted_by`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB;

-- ============================================================
-- GLOBAL POLICING WORKFLOWS
-- CAD calls, people roles, arrests, warrants, custody, evidence chain,
-- duty roster, tasks/notifications and controlled documents.
-- ============================================================

CREATE TABLE `emergency_calls` (
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

CREATE TABLE `case_persons` (
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

CREATE TABLE `warrants` (
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

CREATE TABLE `arrests` (
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

CREATE TABLE `custody_bookings` (
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

CREATE TABLE `custody_checks` (
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

CREATE TABLE `evidence_movements` (
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

CREATE TABLE `duty_roster` (
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

CREATE TABLE `workflow_tasks` (
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

CREATE TABLE `documents` (
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

CREATE TABLE `login_attempts` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(150) NOT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `success` TINYINT(1) DEFAULT 0,
  `attempted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_login_attempt_window` (`email`,`ip_address`,`attempted_at`)
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE `audit_log` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` INT UNSIGNED DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `request_id` VARCHAR(64) DEFAULT NULL,
  `outcome` ENUM('success','failure','denied') DEFAULT 'success',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================

CREATE TABLE `settings` (
  `key` VARCHAR(80) PRIMARY KEY,
  `value` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
