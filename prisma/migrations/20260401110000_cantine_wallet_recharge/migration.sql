ALTER TABLE `abonnements_cantine`
ADD COLUMN `solde_prepaye` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN `solde_min_alerte` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN `dernier_rechargement_le` DATETIME(3) NULL;

ALTER TABLE `operations_financieres`
ADD COLUMN `abonnement_cantine_id` VARCHAR(191) NULL;

CREATE INDEX `idx_opfin_abonnement_cantine`
ON `operations_financieres`(`abonnement_cantine_id`);

ALTER TABLE `operations_financieres`
ADD CONSTRAINT `operations_financieres_abonnement_cantine_id_fkey`
FOREIGN KEY (`abonnement_cantine_id`) REFERENCES `abonnements_cantine`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
