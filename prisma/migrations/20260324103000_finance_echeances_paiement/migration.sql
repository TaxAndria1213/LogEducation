CREATE TABLE `echeances_paiement` (
  `id` VARCHAR(191) NOT NULL,
  `plan_paiement_id` VARCHAR(191) NULL,
  `facture_id` VARCHAR(191) NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `ordre` INTEGER NOT NULL,
  `libelle` VARCHAR(191) NULL,
  `date_echeance` DATETIME(3) NOT NULL,
  `montant_prevu` DECIMAL(12, 2) NOT NULL,
  `montant_regle` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `montant_restant` DECIMAL(12, 2) NOT NULL,
  `statut` ENUM('A_VENIR', 'PARTIELLE', 'PAYEE', 'ANNULEE', 'EN_RETARD') NOT NULL DEFAULT 'A_VENIR',
  `devise` VARCHAR(191) NOT NULL DEFAULT 'MGA',
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_ech_plan_ordre`(`plan_paiement_id`, `ordre`),
  UNIQUE INDEX `uq_ech_fact_ordre`(`facture_id`, `ordre`),
  INDEX `idx_ech_plan`(`plan_paiement_id`),
  INDEX `idx_ech_fact`(`facture_id`),
  INDEX `idx_ech_eleve_annee`(`eleve_id`, `annee_scolaire_id`),
  INDEX `idx_ech_date_statut`(`date_echeance`, `statut`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `paiements_echeances_affectations` (
  `id` VARCHAR(191) NOT NULL,
  `paiement_id` VARCHAR(191) NOT NULL,
  `echeance_paiement_id` VARCHAR(191) NOT NULL,
  `montant` DECIMAL(12, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_aff_paie_ech`(`paiement_id`, `echeance_paiement_id`),
  INDEX `idx_aff_ech`(`echeance_paiement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `echeances_paiement`
  ADD CONSTRAINT `echeances_paiement_plan_paiement_id_fkey`
  FOREIGN KEY (`plan_paiement_id`) REFERENCES `plans_paiement_eleves`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `echeances_paiement_facture_id_fkey`
  FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `echeances_paiement_eleve_id_fkey`
  FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `echeances_paiement_annee_scolaire_id_fkey`
  FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `paiements_echeances_affectations`
  ADD CONSTRAINT `paiements_echeances_affectations_paiement_id_fkey`
  FOREIGN KEY (`paiement_id`) REFERENCES `paiements`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `paiements_echeances_affectations_echeance_paiement_id_fkey`
  FOREIGN KEY (`echeance_paiement_id`) REFERENCES `echeances_paiement`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
