-- CreateTable
CREATE TABLE `enrollment_drafts` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NULL,
    `draft_type` ENUM('NEW_ENROLLMENT', 'RE_ENROLLMENT', 'TRANSFER', 'PRE_ENROLLMENT') NOT NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED', 'EXPIRED', 'DELETED') NOT NULL DEFAULT 'DRAFT',
    `current_step` INTEGER NOT NULL DEFAULT 1,
    `student_data` JSON NULL,
    `schooling_data` JSON NULL,
    `guardians_data` JSON NULL,
    `finance_data` JSON NULL,
    `documents_data` JSON NULL,
    `medical_data` JSON NULL,
    `previous_school_data` JSON NULL,
    `access_data` JSON NULL,
    `consents_data` JSON NULL,
    `observations_data` JSON NULL,
    `services_data` JSON NULL,
    `payment_schedule_data` JSON NULL,
    `completion_rate` DECIMAL(5, 2) NULL,
    `missing_fields` JSON NULL,
    `created_by_utilisateur_id` VARCHAR(191) NULL,
    `updated_by_utilisateur_id` VARCHAR(191) NULL,
    `submitted_inscription_id` VARCHAR(191) NULL,
    `active_unique_key` VARCHAR(191) NULL,
    `expires_at` DATETIME(3) NULL,
    `submitted_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enrollment_drafts_submitted_inscription_id_key`(`submitted_inscription_id`),
    UNIQUE INDEX `enrollment_drafts_active_unique_key_key`(`active_unique_key`),
    INDEX `enrollment_drafts_etablissement_id_status_idx`(`etablissement_id`, `status`),
    INDEX `enrollment_drafts_annee_scolaire_id_idx`(`annee_scolaire_id`),
    INDEX `enrollment_drafts_eleve_id_idx`(`eleve_id`),
    INDEX `enrollment_drafts_created_by_utilisateur_id_idx`(`created_by_utilisateur_id`),
    INDEX `enrollment_drafts_updated_by_utilisateur_id_idx`(`updated_by_utilisateur_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_draft_files` (
    `id` VARCHAR(191) NOT NULL,
    `draft_id` VARCHAR(191) NOT NULL,
    `document_type_id` VARCHAR(191) NULL,
    `fichier_id` VARCHAR(191) NULL,
    `filename` VARCHAR(191) NOT NULL,
    `original_name` VARCHAR(191) NULL,
    `mime_type` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `path` VARCHAR(191) NULL,
    `status` ENUM('TEMPORARY', 'ATTACHED_TO_ENROLLMENT', 'DELETED', 'ORPHANED') NOT NULL DEFAULT 'TEMPORARY',
    `uploaded_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `enrollment_draft_files_draft_id_idx`(`draft_id`),
    INDEX `enrollment_draft_files_document_type_id_idx`(`document_type_id`),
    INDEX `enrollment_draft_files_fichier_id_idx`(`fichier_id`),
    INDEX `enrollment_draft_files_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_created_by_utilisateur_id_fkey` FOREIGN KEY (`created_by_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_updated_by_utilisateur_id_fkey` FOREIGN KEY (`updated_by_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_drafts` ADD CONSTRAINT `enrollment_drafts_submitted_inscription_id_fkey` FOREIGN KEY (`submitted_inscription_id`) REFERENCES `inscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_draft_files` ADD CONSTRAINT `enrollment_draft_files_draft_id_fkey` FOREIGN KEY (`draft_id`) REFERENCES `enrollment_drafts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_draft_files` ADD CONSTRAINT `enrollment_draft_files_document_type_id_fkey` FOREIGN KEY (`document_type_id`) REFERENCES `documents_types_inscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_draft_files` ADD CONSTRAINT `enrollment_draft_files_fichier_id_fkey` FOREIGN KEY (`fichier_id`) REFERENCES `fichiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_draft_files` ADD CONSTRAINT `enrollment_draft_files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
