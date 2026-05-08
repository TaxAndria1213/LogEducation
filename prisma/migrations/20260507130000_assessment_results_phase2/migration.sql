CREATE TABLE `assessment_results` (
  `id` VARCHAR(191) NOT NULL,
  `assessment_id` VARCHAR(191) NOT NULL,
  `student_id` VARCHAR(191) NOT NULL,
  `raw_score` DOUBLE NULL,
  `max_score` DOUBLE NULL,
  `normalized_score` DOUBLE NULL,
  `scale_level_id` VARCHAR(191) NULL,
  `text_value` TEXT NULL,
  `display_value` TEXT NULL,
  `status` ENUM(
    'GRADED',
    'JUSTIFIED_ABSENCE',
    'UNJUSTIFIED_ABSENCE',
    'EXEMPTED',
    'NOT_SUBMITTED',
    'NOT_EVALUATED'
  ) NOT NULL DEFAULT 'GRADED',
  `observation` TEXT NULL,
  `is_validated` BOOLEAN NOT NULL DEFAULT false,
  `validated_at` DATETIME(3) NULL,
  `validated_by` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `assessment_results_assessment_id_student_id_key`(`assessment_id`, `student_id`),
  INDEX `assessment_results_student_id_idx`(`student_id`),
  INDEX `assessment_results_scale_level_id_idx`(`scale_level_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `assessment_result_history` (
  `id` VARCHAR(191) NOT NULL,
  `assessment_result_id` VARCHAR(191) NOT NULL,
  `old_raw_score` DOUBLE NULL,
  `new_raw_score` DOUBLE NULL,
  `old_max_score` DOUBLE NULL,
  `new_max_score` DOUBLE NULL,
  `old_normalized_score` DOUBLE NULL,
  `new_normalized_score` DOUBLE NULL,
  `old_scale_level_id` VARCHAR(191) NULL,
  `new_scale_level_id` VARCHAR(191) NULL,
  `old_text_value` TEXT NULL,
  `new_text_value` TEXT NULL,
  `old_display_value` TEXT NULL,
  `new_display_value` TEXT NULL,
  `old_status` ENUM(
    'GRADED',
    'JUSTIFIED_ABSENCE',
    'UNJUSTIFIED_ABSENCE',
    'EXEMPTED',
    'NOT_SUBMITTED',
    'NOT_EVALUATED'
  ) NULL,
  `new_status` ENUM(
    'GRADED',
    'JUSTIFIED_ABSENCE',
    'UNJUSTIFIED_ABSENCE',
    'EXEMPTED',
    'NOT_SUBMITTED',
    'NOT_EVALUATED'
  ) NULL,
  `reason` TEXT NULL,
  `changed_by` VARCHAR(191) NULL,
  `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `assessment_result_history_assessment_result_id_changed_at_idx`(`assessment_result_id`, `changed_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `assessment_results`
  ADD CONSTRAINT `assessment_results_assessment_id_fkey`
    FOREIGN KEY (`assessment_id`) REFERENCES `evaluations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `assessment_results_student_id_fkey`
    FOREIGN KEY (`student_id`) REFERENCES `eleves`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `assessment_results_scale_level_id_fkey`
    FOREIGN KEY (`scale_level_id`) REFERENCES `grading_scale_levels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `assessment_result_history`
  ADD CONSTRAINT `assessment_result_history_assessment_result_id_fkey`
    FOREIGN KEY (`assessment_result_id`) REFERENCES `assessment_results`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
