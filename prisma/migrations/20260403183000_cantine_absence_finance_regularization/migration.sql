ALTER TABLE `formules_cantine`
ADD COLUMN `regulariser_absence_annulation` TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN `mode_regularisation_absence` VARCHAR(32) NOT NULL DEFAULT 'AVOIR';

CREATE TABLE `absences_cantine` (
  `id` VARCHAR(191) NOT NULL,
  `abonnement_cantine_id` VARCHAR(191) NOT NULL,
  `type_evenement` VARCHAR(32) NOT NULL DEFAULT 'ABSENCE',
  `date_repas` DATETIME(3) NOT NULL,
  `etat_metier` VARCHAR(64) NOT NULL DEFAULT 'SIGNALEE',
  `note` TEXT NULL,
  `statut_acces_snapshot` VARCHAR(64) NULL,
  `finance_status_snapshot` VARCHAR(64) NULL,
  `ouvre_droit_regularisation` TINYINT(1) NOT NULL DEFAULT 0,
  `mode_regularisation_suggere` VARCHAR(32) NULL,
  `transmission_finance` TINYINT(1) NOT NULL DEFAULT 0,
  `finance_processed_at` DATETIME(3) NULL,
  `decision_finance` VARCHAR(32) NULL,
  `details_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_abscant_abonnement`(`abonnement_cantine_id`),
  INDEX `idx_abscant_date`(`date_repas`),
  INDEX `idx_abscant_finance_processed`(`finance_processed_at`),
  CONSTRAINT `absences_cantine_abonnement_cantine_id_fkey`
    FOREIGN KEY (`abonnement_cantine_id`) REFERENCES `abonnements_cantine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
