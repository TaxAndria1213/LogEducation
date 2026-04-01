ALTER TABLE `catalogue_frais`
  ADD COLUMN `prorata_eligible` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `eligibilite_json` JSON NULL,
  ADD COLUMN `statut_validation` VARCHAR(191) NOT NULL DEFAULT 'EN_ATTENTE',
  ADD COLUMN `approuve_par_utilisateur_id` VARCHAR(191) NULL,
  ADD COLUMN `approuve_le` DATETIME(3) NULL,
  ADD COLUMN `motif_rejet` VARCHAR(191) NULL;

UPDATE `catalogue_frais`
SET `statut_validation` = 'APPROUVEE'
WHERE `statut_validation` = 'EN_ATTENTE';

CREATE INDEX `idx_catfrais_statut_validation` ON `catalogue_frais`(`statut_validation`);
CREATE INDEX `idx_catfrais_approbateur` ON `catalogue_frais`(`approuve_par_utilisateur_id`);

ALTER TABLE `catalogue_frais`
  ADD CONSTRAINT `catalogue_frais_approuve_par_utilisateur_id_fkey`
  FOREIGN KEY (`approuve_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
