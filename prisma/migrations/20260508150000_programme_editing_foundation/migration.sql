-- AlterTable
ALTER TABLE `programmes`
  ADD COLUMN `code` VARCHAR(191) NULL,
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `statut` ENUM('DRAFT', 'ACTIVE', 'IN_REVISION', 'LOCKED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `date_debut` DATETIME(3) NULL,
  ADD COLUMN `date_fin` DATETIME(3) NULL,
  ADD COLUMN `est_actif` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `ordre_affichage` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `default_grading_scale_id` VARCHAR(191) NULL,
  ADD COLUMN `verrouille_le` DATETIME(3) NULL,
  ADD COLUMN `archive_le` DATETIME(3) NULL,
  ADD COLUMN `created_by_utilisateur_id` VARCHAR(191) NULL,
  ADD COLUMN `updated_by_utilisateur_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `programmes_matieres`
  ADD COLUMN `heures_annuelles` INTEGER NULL,
  ADD COLUMN `seances_par_semaine` INTEGER NULL,
  ADD COLUMN `duree_seance_par_defaut` INTEGER NULL,
  ADD COLUMN `est_obligatoire` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `est_visible_bulletin` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `inclure_moyenne_generale` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `appreciation_obligatoire` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `libelle_bulletin` VARCHAR(191) NULL,
  ADD COLUMN `ordre_affichage_bulletin` INTEGER NULL,
  ADD COLUMN `grading_scale_id` VARCHAR(191) NULL,
  ADD COLUMN `mode_calcul` ENUM('NONE', 'SIMPLE_AVERAGE', 'WEIGHTED_AVERAGE', 'SUM', 'MANUAL') NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
  ADD COLUMN `statut` ENUM('ACTIVE', 'INACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE `programmes_change_logs` (
  `id` VARCHAR(191) NOT NULL,
  `programme_id` VARCHAR(191) NOT NULL,
  `entity_type` VARCHAR(191) NOT NULL,
  `entity_id` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `field_name` VARCHAR(191) NULL,
  `old_value_json` JSON NULL,
  `new_value_json` JSON NULL,
  `reason` VARCHAR(191) NULL,
  `impact_summary_json` JSON NULL,
  `changed_by_utilisateur_id` VARCHAR(191) NULL,
  `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `programmes_change_logs_programme_id_changed_at_idx`(`programme_id`, `changed_at`),
  INDEX `programmes_change_logs_changed_by_utilisateur_id_idx`(`changed_by_utilisateur_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `programmes_niveau_scolaire_id_idx` ON `programmes`(`niveau_scolaire_id`);

-- CreateIndex
CREATE INDEX `programmes_etablissement_id_statut_idx` ON `programmes`(`etablissement_id`, `statut`);

-- CreateIndex
CREATE UNIQUE INDEX `pro_etab_id_an_sco_id_niv_sco_id_nom_key`
ON `programmes`(`etablissement_id`, `annee_scolaire_id`, `niveau_scolaire_id`, `nom`);

-- CreateIndex
CREATE UNIQUE INDEX `programmes_etablissement_id_annee_scolaire_id_code_key`
ON `programmes`(`etablissement_id`, `annee_scolaire_id`, `code`);

-- CreateIndex
CREATE INDEX `programmes_matieres_matiere_id_idx` ON `programmes_matieres`(`matiere_id`);

-- CreateIndex
CREATE UNIQUE INDEX `programmes_matieres_programme_id_matiere_id_key`
ON `programmes_matieres`(`programme_id`, `matiere_id`);

-- AddForeignKey
ALTER TABLE `programmes`
  ADD CONSTRAINT `programmes_default_grading_scale_id_fkey`
  FOREIGN KEY (`default_grading_scale_id`) REFERENCES `grading_scales`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes`
  ADD CONSTRAINT `programmes_created_by_utilisateur_id_fkey`
  FOREIGN KEY (`created_by_utilisateur_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes`
  ADD CONSTRAINT `programmes_updated_by_utilisateur_id_fkey`
  FOREIGN KEY (`updated_by_utilisateur_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes_matieres`
  ADD CONSTRAINT `programmes_matieres_grading_scale_id_fkey`
  FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes_change_logs`
  ADD CONSTRAINT `programmes_change_logs_programme_id_fkey`
  FOREIGN KEY (`programme_id`) REFERENCES `programmes`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes_change_logs`
  ADD CONSTRAINT `programmes_change_logs_changed_by_utilisateur_id_fkey`
  FOREIGN KEY (`changed_by_utilisateur_id`) REFERENCES `utilisateurs`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
