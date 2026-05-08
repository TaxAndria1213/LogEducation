ALTER TABLE `types_evaluations`
  ADD COLUMN `code` ENUM('DEVOIR', 'EXAMEN', 'ORAL', 'AUTRE') NOT NULL DEFAULT 'AUTRE' AFTER `etablissement_id`,
  ADD COLUMN `default_max_score` DOUBLE NULL AFTER `poids_defaut`,
  ADD COLUMN `include_in_average` BOOLEAN NOT NULL DEFAULT true AFTER `default_max_score`,
  ADD COLUMN `show_in_report_card` BOOLEAN NOT NULL DEFAULT false AFTER `include_in_average`,
  ADD COLUMN `is_final_exam` BOOLEAN NOT NULL DEFAULT false AFTER `show_in_report_card`,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true AFTER `is_final_exam`;

UPDATE `types_evaluations`
SET `code` = CASE
  WHEN UPPER(`nom`) LIKE 'DEVOIR%' THEN 'DEVOIR'
  WHEN UPPER(`nom`) LIKE 'COMPOSITION%' OR UPPER(`nom`) LIKE 'EXAMEN%' THEN 'EXAMEN'
  WHEN UPPER(`nom`) LIKE 'ORAL%' THEN 'ORAL'
  ELSE 'AUTRE'
END;

ALTER TABLE `types_evaluations`
  ADD UNIQUE INDEX `types_evaluations_etablissement_id_code_key` (`etablissement_id`, `code`);

ALTER TABLE `evaluations`
  ADD COLUMN `include_in_average` BOOLEAN NOT NULL DEFAULT true AFTER `est_publiee`,
  ADD COLUMN `show_in_report_card` BOOLEAN NOT NULL DEFAULT false AFTER `include_in_average`,
  ADD COLUMN `is_final_exam` BOOLEAN NOT NULL DEFAULT false AFTER `show_in_report_card`;

CREATE TABLE `modeles_bulletins` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `niveau_scolaire_id` VARCHAR(191) NULL,
  `nom` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `template_type` ENUM('STANDARD', 'DETAILED', 'ASSESSMENT_TYPE_SUMMARY', 'FINAL_EXAM_ONLY', 'CUSTOM') NOT NULL DEFAULT 'STANDARD',
  `show_assessment_details` BOOLEAN NOT NULL DEFAULT false,
  `show_assessment_type_summary` BOOLEAN NOT NULL DEFAULT false,
  `show_only_final_exam` BOOLEAN NOT NULL DEFAULT false,
  `show_subject_average` BOOLEAN NOT NULL DEFAULT true,
  `show_subject_coefficient` BOOLEAN NOT NULL DEFAULT true,
  `show_subject_points` BOOLEAN NOT NULL DEFAULT false,
  `show_subject_rank` BOOLEAN NOT NULL DEFAULT true,
  `show_teacher_appreciation` BOOLEAN NOT NULL DEFAULT true,
  `show_general_average` BOOLEAN NOT NULL DEFAULT true,
  `show_total_coefficients` BOOLEAN NOT NULL DEFAULT true,
  `show_total_points` BOOLEAN NOT NULL DEFAULT false,
  `show_general_rank` BOOLEAN NOT NULL DEFAULT true,
  `show_mention` BOOLEAN NOT NULL DEFAULT true,
  `show_decision` BOOLEAN NOT NULL DEFAULT true,
  `show_general_appreciation` BOOLEAN NOT NULL DEFAULT true,
  `show_absences` BOOLEAN NOT NULL DEFAULT false,
  `show_late_count` BOOLEAN NOT NULL DEFAULT false,
  `show_logo` BOOLEAN NOT NULL DEFAULT true,
  `show_signature` BOOLEAN NOT NULL DEFAULT true,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `modeles_bulletins_annee_scolaire_id_nom_key` (`annee_scolaire_id`, `nom`),
  INDEX `modeles_bulletins_etablissement_id_idx` (`etablissement_id`),
  INDEX `modeles_bulletins_annee_scolaire_id_is_default_idx` (`annee_scolaire_id`, `is_default`),
  INDEX `modeles_bulletins_niveau_scolaire_id_idx` (`niveau_scolaire_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `modeles_bulletins`
  ADD CONSTRAINT `modeles_bulletins_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `modeles_bulletins_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `modeles_bulletins_niveau_scolaire_id_fkey`
    FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `bulletins`
  ADD COLUMN `report_card_template_id` VARCHAR(191) NULL AFTER `classe_id`,
  ADD COLUMN `general_average` DECIMAL(5,2) NULL AFTER `statut`,
  ADD COLUMN `total_coefficients` DECIMAL(8,2) NULL AFTER `general_average`,
  ADD COLUMN `total_points` DECIMAL(8,2) NULL AFTER `total_coefficients`,
  ADD COLUMN `general_rank` INTEGER NULL AFTER `total_points`,
  ADD COLUMN `mention` VARCHAR(191) NULL AFTER `general_rank`,
  ADD COLUMN `decision` VARCHAR(191) NULL AFTER `mention`,
  ADD COLUMN `general_appreciation` VARCHAR(191) NULL AFTER `decision`,
  ADD COLUMN `display_snapshot_json` JSON NULL AFTER `general_appreciation`;

ALTER TABLE `bulletins`
  ADD INDEX `bulletins_report_card_template_id_idx` (`report_card_template_id`);

ALTER TABLE `bulletins`
  ADD CONSTRAINT `bulletins_report_card_template_id_fkey`
    FOREIGN KEY (`report_card_template_id`) REFERENCES `modeles_bulletins`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
