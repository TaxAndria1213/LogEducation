ALTER TABLE `abonnements_cantine`
ADD COLUMN `date_effet` DATETIME(3) NULL;

UPDATE `abonnements_cantine`
SET `date_effet` = `created_at`
WHERE `date_effet` IS NULL;
