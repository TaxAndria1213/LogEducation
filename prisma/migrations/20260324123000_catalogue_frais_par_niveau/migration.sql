ALTER TABLE `catalogue_frais`
  ADD COLUMN `niveau_scolaire_id` VARCHAR(191) NULL;

ALTER TABLE `catalogue_frais`
  ADD INDEX `idx_catfrais_etab_niveau`(`etablissement_id`, `niveau_scolaire_id`),
  ADD UNIQUE INDEX `uq_catfrais_etab_niveau_nom`(`etablissement_id`, `niveau_scolaire_id`, `nom`);

ALTER TABLE `catalogue_frais`
  ADD CONSTRAINT `fk_catfrais_niveau`
  FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
