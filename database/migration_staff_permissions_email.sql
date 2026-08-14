-- CIIDANKA BOOLISKA GOBOLKA GABILEY
-- Migration: per-user permissions + staff email invitations
-- Orod HAL MAR database hore.
USE `gabiley_police`;

ALTER TABLE `users`
  MODIFY `status` ENUM('active','inactive','suspended','invited') DEFAULT 'active';

CREATE TABLE IF NOT EXISTS `user_permissions` (
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

CREATE TABLE IF NOT EXISTS `user_invitations` (
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
