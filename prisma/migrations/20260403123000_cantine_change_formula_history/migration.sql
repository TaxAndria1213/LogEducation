CREATE TABLE `historiques_formule_cantine` (
  `id` VARCHAR(191) NOT NULL,
  `abonnement_cantine_id` VARCHAR(191) NOT NULL,
  `ancienne_formule_cantine_id` VARCHAR(191) NOT NULL,
  `nouvelle_formule_cantine_id` VARCHAR(191) NOT NULL,
  `date_effet` DATETIME(3) NOT NULL,
  `impact_tarifaire` BOOLEAN NOT NULL DEFAULT false,
  `ancien_statut` VARCHAR(191) NULL,
  `nouveau_statut` VARCHAR(191) NULL,
  `details_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_histformcant_abonnement`(`abonnement_cantine_id`),
  INDEX `idx_histformcant_ancienne`(`ancienne_formule_cantine_id`),
  INDEX `idx_histformcant_nouvelle`(`nouvelle_formule_cantine_id`),
  CONSTRAINT `historiques_formule_cantine_abonnement_fkey`
    FOREIGN KEY (`abonnement_cantine_id`) REFERENCES `abonnements_cantine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `historiques_formule_cantine_ancienne_fkey`
    FOREIGN KEY (`ancienne_formule_cantine_id`) REFERENCES `formules_cantine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `historiques_formule_cantine_nouvelle_fkey`
    FOREIGN KEY (`nouvelle_formule_cantine_id`) REFERENCES `formules_cantine`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
