-- Migration: single station + profile photos
USE `gabiley_police`;

ALTER TABLE `users` ADD COLUMN `photo_url` VARCHAR(255) DEFAULT NULL AFTER `station_id`;
ALTER TABLE `citizens` ADD COLUMN `photo_url` VARCHAR(255) DEFAULT NULL AFTER `status`;
ALTER TABLE `prisoners` ADD COLUMN `photo_url` VARCHAR(255) DEFAULT NULL AFTER `status`;

INSERT INTO `stations` (`id`,`name`,`code`,`commander_name`,`address`,`phone`,`total_officers`,`active_cases`,`vehicles`,`readiness_pct`,`status`)
VALUES (1,'Saldhigga Booliska Gobolka Gabiley','GB-HQ-001','Taliyaha Ciidanka','Gobolka Gabiley','999',0,0,0,0,'active')
ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), address=VALUES(address), phone=VALUES(phone), status='active';

UPDATE `users` SET `station_id` = 1;
UPDATE `officers` SET `station_id` = 1;
UPDATE `cases` SET `station_id` = 1;
UPDATE `field_reports` SET `station_id` = 1;
DELETE FROM `stations` WHERE `id` <> 1;
