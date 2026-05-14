-- Dynamic report foundation - phase 3

ALTER TABLE `pedagogical_items`
  ADD COLUMN `grading_scale_id` VARCHAR(191) NULL,
  ADD COLUMN `include_in_general_average` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `grading_mode_override` ENUM('NUMERIC', 'CODE', 'LEVEL', 'DESCRIPTIVE', 'MIXED', 'NONE') NULL;

CREATE INDEX `pedagogical_items_grading_scale_id_idx` ON `pedagogical_items`(`grading_scale_id`);

ALTER TABLE `pedagogical_items`
  ADD CONSTRAINT `pedagogical_items_grading_scale_id_fkey`
  FOREIGN KEY (`grading_scale_id`) REFERENCES `grading_scales`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `pedagogical_item_averages` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `periode_id` VARCHAR(191) NOT NULL,
  `classe_id` VARCHAR(191) NOT NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `pedagogical_item_id` VARCHAR(191) NOT NULL,
  `student_average` DOUBLE NULL,
  `class_average` DOUBLE NULL,
  `display_value` VARCHAR(191) NULL,
  `calculation_mode` ENUM('SIMPLE', 'HIERARCHICAL') NOT NULL DEFAULT 'HIERARCHICAL',
  `rounding_precision` INTEGER NOT NULL DEFAULT 2,
  `status` VARCHAR(191) NULL,
  `calculated_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `p_i_a_periode_id_classe_id_eleve_id_pedagogical_item_id_key`(`periode_id`, `classe_id`, `eleve_id`, `pedagogical_item_id`),
  INDEX `pedagogical_item_averages_etablissement_id_idx`(`etablissement_id`),
  INDEX `pedagogical_item_averages_annee_scolaire_id_periode_id_idx`(`annee_scolaire_id`, `periode_id`),
  INDEX `pedagogical_item_averages_classe_id_pedagogical_item_id_idx`(`classe_id`, `pedagogical_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pedagogical_item_averages`
  ADD CONSTRAINT `pedagogical_item_averages_etablissement_id_fkey`
  FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_item_averages_annee_scolaire_id_fkey`
  FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_item_averages_periode_id_fkey`
  FOREIGN KEY (`periode_id`) REFERENCES `periodes`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_item_averages_classe_id_fkey`
  FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_item_averages_eleve_id_fkey`
  FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `pedagogical_item_averages_pedagogical_item_id_fkey`
  FOREIGN KEY (`pedagogical_item_id`) REFERENCES `pedagogical_items`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `modeles_bulletins`
  ADD COLUMN `calculation_mode` ENUM('SIMPLE', 'HIERARCHICAL') NOT NULL DEFAULT 'HIERARCHICAL',
  ADD COLUMN `include_code_grades_in_general_average` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_student_average` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_class_average` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_general_student_average` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_general_class_average` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_code_legend` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_section_headers` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `rounding_precision` INTEGER NOT NULL DEFAULT 2;

CREATE TABLE `modeles_bulletins_sections` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `parent_section_id` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `section_type` ENUM('ACADEMIC_NUMERIC', 'ACADEMIC_CODE', 'BEHAVIOR', 'GENERAL_APPRECIATION', 'DECISION', 'CODE_LEGEND', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
  `grading_mode` ENUM('NUMERIC', 'CODE', 'LEVEL', 'DESCRIPTIVE', 'MIXED', 'NONE') NULL DEFAULT 'NONE',
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `show_header` BOOLEAN NOT NULL DEFAULT true,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `m_b_s_template_id_parent_section_id_title_key`(`template_id`, `parent_section_id`, `title`),
  INDEX `modeles_bulletins_sections_template_id_display_order_idx`(`template_id`, `display_order`),
  INDEX `modeles_bulletins_sections_parent_section_id_display_order_idx`(`parent_section_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `modeles_bulletins_sections`
  ADD CONSTRAINT `modeles_bulletins_sections_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `modeles_bulletins`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `modeles_bulletins_sections_parent_section_id_fkey`
  FOREIGN KEY (`parent_section_id`) REFERENCES `modeles_bulletins_sections`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `modeles_bulletins_fields` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `section_id` VARCHAR(191) NOT NULL,
  `field_key` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `is_visible` BOOLEAN NOT NULL DEFAULT true,
  `width` INTEGER NULL,
  `alignment` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `m_b_f_template_id_section_id_field_key_key`(`template_id`, `section_id`, `field_key`),
  INDEX `modeles_bulletins_fields_template_id_display_order_idx`(`template_id`, `display_order`),
  INDEX `modeles_bulletins_fields_section_id_display_order_idx`(`section_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `modeles_bulletins_fields`
  ADD CONSTRAINT `modeles_bulletins_fields_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `modeles_bulletins`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `modeles_bulletins_fields_section_id_fkey`
  FOREIGN KEY (`section_id`) REFERENCES `modeles_bulletins_sections`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `modeles_bulletins_items_pedagogiques`
  ADD COLUMN `section_id` VARCHAR(191) NULL,
  ADD COLUMN `grading_scale_id_override` VARCHAR(191) NULL,
  ADD COLUMN `include_in_general_average_override` BOOLEAN NULL;

CREATE INDEX `modeles_bulletins_items_pedagogiques_section_id_idx` ON `modeles_bulletins_items_pedagogiques`(`section_id`);

ALTER TABLE `modeles_bulletins_items_pedagogiques`
  ADD CONSTRAINT `modeles_bulletins_items_pedagogiques_section_id_fkey`
  FOREIGN KEY (`section_id`) REFERENCES `modeles_bulletins_sections`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `bulletins`
  ADD COLUMN `validated_at` DATETIME(3) NULL,
  ADD COLUMN `validated_by` VARCHAR(191) NULL,
  ADD COLUMN `general_class_average` DECIMAL(5, 2) NULL,
  ADD COLUMN `display_legend_json` JSON NULL;

ALTER TABLE `bulletins_lignes`
  ADD COLUMN `parent_ligne_id` VARCHAR(191) NULL,
  ADD COLUMN `pedagogical_item_id` VARCHAR(191) NULL,
  ADD COLUMN `item_type` ENUM('SUBJECT', 'GROUP', 'DOMAIN', 'SUBDOMAIN', 'COMPETENCY', 'OBJECTIVE') NULL,
  ADD COLUMN `grading_mode` ENUM('NUMERIC', 'CODE', 'LEVEL', 'DESCRIPTIVE', 'MIXED', 'NONE') NULL DEFAULT 'NONE',
  ADD COLUMN `display_value` VARCHAR(191) NULL,
  ADD COLUMN `numeric_value` DOUBLE NULL,
  ADD COLUMN `student_average` DOUBLE NULL,
  ADD COLUMN `class_average` DOUBLE NULL,
  ADD COLUMN `scale_level_id` VARCHAR(191) NULL,
  ADD COLUMN `observation` TEXT NULL,
  ADD COLUMN `display_order` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `is_visible` BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX `bulletins_lignes_parent_ligne_id_display_order_idx` ON `bulletins_lignes`(`parent_ligne_id`, `display_order`);
CREATE INDEX `bulletins_lignes_pedagogical_item_id_idx` ON `bulletins_lignes`(`pedagogical_item_id`);
CREATE UNIQUE INDEX `bulletins_lignes_bulletin_id_pedagogical_item_id_key` ON `bulletins_lignes`(`bulletin_id`, `pedagogical_item_id`);

ALTER TABLE `bulletins_lignes`
  ADD CONSTRAINT `bulletins_lignes_parent_ligne_id_fkey`
  FOREIGN KEY (`parent_ligne_id`) REFERENCES `bulletins_lignes`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `bulletins_lignes_pedagogical_item_id_fkey`
  FOREIGN KEY (`pedagogical_item_id`) REFERENCES `pedagogical_items`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `bulletins_lignes_details` (
  `id` VARCHAR(191) NOT NULL,
  `bulletin_ligne_id` VARCHAR(191) NOT NULL,
  `assessment_id` VARCHAR(191) NULL,
  `assessment_result_id` VARCHAR(191) NULL,
  `label` VARCHAR(191) NOT NULL,
  `display_value` VARCHAR(191) NULL,
  `numeric_value` DOUBLE NULL,
  `scale_level_id` VARCHAR(191) NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `b_l_details_bulletin_ligne_id_display_order_idx`(`bulletin_ligne_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bulletins_lignes_details`
  ADD CONSTRAINT `bulletins_lignes_details_bulletin_ligne_id_fkey`
  FOREIGN KEY (`bulletin_ligne_id`) REFERENCES `bulletins_lignes`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `bulletins_codes_legendes` (
  `id` VARCHAR(191) NOT NULL,
  `bulletin_id` VARCHAR(191) NOT NULL,
  `grading_scale_id` VARCHAR(191) NULL,
  `code` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `numeric_value` DOUBLE NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `bulletins_codes_legendes_bulletin_id_code_key`(`bulletin_id`, `code`),
  INDEX `bulletins_codes_legendes_bulletin_id_display_order_idx`(`bulletin_id`, `display_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `bulletins_codes_legendes`
  ADD CONSTRAINT `bulletins_codes_legendes_bulletin_id_fkey`
  FOREIGN KEY (`bulletin_id`) REFERENCES `bulletins`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
