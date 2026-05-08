ALTER TABLE `modeles_bulletins`
  ADD COLUMN `pedagogical_display_mode` ENUM('SUBJECTS_ONLY', 'SUBJECTS_AND_DOMAINS', 'FULL_HIERARCHY', 'COMPETENCIES_ONLY', 'CUSTOM') NOT NULL DEFAULT 'SUBJECTS_ONLY',
  ADD COLUMN `show_subjects` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_groups` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_domains` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_subdomains` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_competencies` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_objectives` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_only_evaluated_items` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_non_evaluated_items` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `non_evaluated_label` VARCHAR(191) NOT NULL DEFAULT 'Non evalue',
  ADD COLUMN `group_items_by_parent` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_hierarchical_indent` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `max_hierarchy_depth` INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN `show_subject_summary` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `show_domain_summary` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_subdomain_summary` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `show_competency_results` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `modeles_bulletins_items_pedagogiques` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `pedagogical_item_id` VARCHAR(191) NOT NULL,
  `is_visible` BOOLEAN NOT NULL DEFAULT true,
  `custom_label` VARCHAR(191) NULL,
  `display_order` INTEGER NOT NULL DEFAULT 0,
  `show_result` BOOLEAN NOT NULL DEFAULT true,
  `show_appreciation` BOOLEAN NOT NULL DEFAULT false,
  `show_children` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `modeles_bulletins_items_p_t_id_p_i_id_key`(`template_id`, `pedagogical_item_id`),
  INDEX `m_b_i_pedagogiques_template_id_is_visible_display_order_idx`(`template_id`, `is_visible`, `display_order`),
  INDEX `m_b_i_pedagogiques_pedagogical_item_id_idx`(`pedagogical_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `modeles_bulletins_items_pedagogiques`
  ADD CONSTRAINT `modeles_bulletins_items_pedagogiques_template_id_fkey`
    FOREIGN KEY (`template_id`) REFERENCES `modeles_bulletins`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `modeles_bulletins_items_pedagogiques_pedagogical_item_id_fkey`
    FOREIGN KEY (`pedagogical_item_id`) REFERENCES `pedagogical_items`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
