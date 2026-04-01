ALTER TABLE `abonnements_transport`
ADD COLUMN `facture_id` VARCHAR(191) NULL;

ALTER TABLE `abonnements_cantine`
ADD COLUMN `facture_id` VARCHAR(191) NULL;

CREATE INDEX `idx_abt_facture` ON `abonnements_transport`(`facture_id`);
CREATE INDEX `idx_abc_facture` ON `abonnements_cantine`(`facture_id`);

ALTER TABLE `abonnements_transport`
ADD CONSTRAINT `fk_abt_facture`
FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `abonnements_cantine`
ADD CONSTRAINT `fk_abc_facture`
FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
