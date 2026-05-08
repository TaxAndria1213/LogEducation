CREATE TABLE `pedagogical_items` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `niveau_scolaire_id` VARCHAR(191) NOT NULL,
  `parent_id` VARCHAR(191) NULL,
  `matiere_id` VARCHAR(191) NULL,
  `item_type` ENUM('SUBJECT', 'GROUP', 'DOMAIN', 'SUBDOMAIN', 'COMPETENCY', 'OBJECTIVE') NOT NULL,
  `code` VARCHAR(191) NULL,
  `nom` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `coefficient` DOUBLE NULL,
  `weight` DOUBLE NULL,
  `is_evaluable` BOOLEAN NOT NULL DEFAULT false,
  `is_visible_on_report` BOOLEAN NOT NULL DEFAULT true,
  `is_required` BOOLEAN NOT NULL DEFAULT false,
  `calculation_mode` ENUM('NONE', 'SIMPLE_AVERAGE', 'WEIGHTED_AVERAGE', 'SUM', 'MANUAL') NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `pedagogical_items_annee_scolaire_id_n_s_id_p_id_nom_key` (`annee_scolaire_id`, `niveau_scolaire_id`, `parent_id`, `nom`),
  INDEX `pedagogical_items_etablissement_id_idx` (`etablissement_id`),
  INDEX `pedagogical_items_annee_scolaire_id_n_s_id_item_type_idx` (`annee_scolaire_id`, `niveau_scolaire_id`, `item_type`),
  INDEX `pedagogical_items_parent_id_display_order_idx` (`parent_id`, `display_order`),
  INDEX `pedagogical_items_matiere_id_idx` (`matiere_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pedagogical_items`
  ADD CONSTRAINT `pedagogical_items_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_items_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_items_niveau_scolaire_id_fkey`
    FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_items_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `pedagogical_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_items_matiere_id_fkey`
    FOREIGN KEY (`matiere_id`) REFERENCES `matieres`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `grading_scales` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `nom` VARCHAR(191) NOT NULL,
  `grading_type` ENUM('POINTS', 'LETTER', 'LEVEL', 'DESCRIPTIVE', 'PERCENTAGE', 'VALIDATION') NOT NULL,
  `base_score` DOUBLE NULL,
  `use_for_calculation` BOOLEAN NOT NULL DEFAULT true,
  `allow_decimal` BOOLEAN NOT NULL DEFAULT true,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `grading_scales_annee_scolaire_id_nom_key` (`annee_scolaire_id`, `nom`),
  INDEX `grading_scales_etablissement_id_idx` (`etablissement_id`),
  INDEX `grading_scales_annee_scolaire_id_is_default_idx` (`annee_scolaire_id`, `is_default`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `grading_scales`
  ADD CONSTRAINT `grading_scales_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `grading_scales_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `grading_scale_levels` (
  `id` VARCHAR(191) NOT NULL,
  `grading_scale_id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `numeric_value` DOUBLE NULL,
  `min_value` DOUBLE NULL,
  `max_value` DOUBLE NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `color` VARCHAR(191) NULL,
  `is_success_level` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `grading_scale_levels_grading_scale_id_code_key` (`grading_scale_id`, `code`),
  INDEX `grading_scale_levels_grading_scale_id_display_order_idx` (`grading_scale_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `grading_scale_levels`
  ADD CONSTRAINT `grading_scale_levels_grading_scale_id_fkey`
    FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `evaluations`
  ADD COLUMN `pedagogical_item_id` VARCHAR(191) NULL AFTER `periode_id`,
  ADD COLUMN `grading_scale_id` VARCHAR(191) NULL AFTER `pedagogical_item_id`,
  ADD COLUMN `description` VARCHAR(191) NULL AFTER `titre`,
  ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED', 'RESULTS_ENTERED', 'VALIDATED', 'LOCKED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT' AFTER `is_final_exam`;

ALTER TABLE `evaluations`
  ADD INDEX `evaluations_pedagogical_item_id_idx` (`pedagogical_item_id`),
  ADD INDEX `evaluations_grading_scale_id_idx` (`grading_scale_id`);

ALTER TABLE `evaluations`
  ADD CONSTRAINT `evaluations_pedagogical_item_id_fkey`
    FOREIGN KEY (`pedagogical_item_id`) REFERENCES `pedagogical_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `evaluations_grading_scale_id_fkey`
    FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
