CREATE TABLE `consommations_cantine` (
  `id` VARCHAR(191) NOT NULL,
  `abonnement_cantine_id` VARCHAR(191) NOT NULL,
  `type_repas` VARCHAR(191) NOT NULL DEFAULT 'repas',
  `note` TEXT NULL,
  `consommation_le` DATETIME(3) NOT NULL,
  `statut_acces` VARCHAR(191) NOT NULL,
  `motif_acces` VARCHAR(191) NULL,
  `finance_status_snapshot` VARCHAR(191) NULL,
  `transmission_finance` BOOLEAN NOT NULL DEFAULT TRUE,
  `finance_processed_at` DATETIME(3) NULL,
  `details_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_conscant_abonnement`(`abonnement_cantine_id`),
  INDEX `idx_conscant_le`(`consommation_le`),
  INDEX `idx_conscant_finance_processed`(`finance_processed_at`),
  CONSTRAINT `consommations_cantine_abonnement_cantine_id_fkey`
    FOREIGN KEY (`abonnement_cantine_id`) REFERENCES `abonnements_cantine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
