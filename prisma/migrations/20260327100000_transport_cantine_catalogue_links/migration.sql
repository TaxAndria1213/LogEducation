ALTER TABLE `lignes_transport`
ADD COLUMN `catalogue_frais_id` VARCHAR(191) NULL;

ALTER TABLE `formules_cantine`
ADD COLUMN `catalogue_frais_id` VARCHAR(191) NULL;

CREATE INDEX `idx_lignetransport_frais` ON `lignes_transport`(`catalogue_frais_id`);
CREATE INDEX `idx_formulecantine_frais` ON `formules_cantine`(`catalogue_frais_id`);

ALTER TABLE `lignes_transport`
ADD CONSTRAINT `fk_lignetransport_frais`
FOREIGN KEY (`catalogue_frais_id`) REFERENCES `catalogue_frais`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `formules_cantine`
ADD CONSTRAINT `fk_formulecantine_frais`
FOREIGN KEY (`catalogue_frais_id`) REFERENCES `catalogue_frais`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
