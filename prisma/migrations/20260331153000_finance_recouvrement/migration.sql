CREATE TABLE `regles_recouvrement_finance` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `nom` VARCHAR(191) NOT NULL DEFAULT 'Regle de recouvrement par defaut',
  `jours_grace` INTEGER NOT NULL DEFAULT 0,
  `relance_jours_json` JSON NULL,
  `penalite_active` BOOLEAN NOT NULL DEFAULT false,
  `penalite_mode` VARCHAR(191) NULL,
  `penalite_valeur` DECIMAL(12, 2) NULL,
  `statut_validation` VARCHAR(191) NOT NULL DEFAULT 'EN_ATTENTE',
  `approuve_par_utilisateur_id` VARCHAR(191) NULL,
  `approuve_le` DATETIME(3) NULL,
  `motif_rejet` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `uq_regle_recouvrement_etab`(`etablissement_id`),
  INDEX `idx_regle_recouvrement_statut`(`statut_validation`),
  INDEX `idx_regle_recouvrement_approbateur`(`approuve_par_utilisateur_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `promesses_paiement` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `facture_id` VARCHAR(191) NULL,
  `plan_paiement_id` VARCHAR(191) NULL,
  `echeance_paiement_id` VARCHAR(191) NULL,
  `montant_promis` DECIMAL(12, 2) NOT NULL,
  `date_promesse` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `date_limite` DATETIME(3) NOT NULL,
  `statut` ENUM('EN_ATTENTE', 'TENUE', 'ROMPUE', 'ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `canal` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `tenue_le` DATETIME(3) NULL,
  `rompue_le` DATETIME(3) NULL,
  `annulee_le` DATETIME(3) NULL,
  `cree_par_utilisateur_id` VARCHAR(191) NULL,
  `valide_par_utilisateur_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_promesse_etab_statut`(`etablissement_id`, `statut`),
  INDEX `idx_promesse_eleve_annee`(`eleve_id`, `annee_scolaire_id`),
  INDEX `idx_promesse_facture`(`facture_id`),
  INDEX `idx_promesse_plan`(`plan_paiement_id`),
  INDEX `idx_promesse_echeance`(`echeance_paiement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `restrictions_administratives` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `facture_id` VARCHAR(191) NULL,
  `plan_paiement_id` VARCHAR(191) NULL,
  `type` ENUM('BULLETIN', 'EXAMEN', 'REINSCRIPTION') NOT NULL,
  `statut` ENUM('ACTIVE', 'LEVEE', 'ANNULEE') NOT NULL DEFAULT 'ACTIVE',
  `source` VARCHAR(191) NULL DEFAULT 'MANUEL',
  `motif` VARCHAR(191) NULL,
  `date_activation` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `date_levee` DATETIME(3) NULL,
  `cree_par_utilisateur_id` VARCHAR(191) NULL,
  `levee_par_utilisateur_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_restriction_etab_statut`(`etablissement_id`, `statut`),
  INDEX `idx_restriction_eleve_annee`(`eleve_id`, `annee_scolaire_id`),
  INDEX `idx_restriction_facture`(`facture_id`),
  INDEX `idx_restriction_plan`(`plan_paiement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dossiers_recouvrement` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `annee_scolaire_id` VARCHAR(191) NOT NULL,
  `facture_id` VARCHAR(191) NULL,
  `plan_paiement_id` VARCHAR(191) NULL,
  `statut` ENUM('OUVERT', 'RENFORCE', 'CONTENTIEUX', 'IRRECOUVRABLE', 'ABANDON_EN_ATTENTE', 'ABANDONNE', 'CLOTURE') NOT NULL DEFAULT 'OUVERT',
  `motif` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `montant_reference` DECIMAL(12, 2) NULL,
  `date_statut` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `cree_par_utilisateur_id` VARCHAR(191) NULL,
  `valide_par_utilisateur_id` VARCHAR(191) NULL,
  `valide_le` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_dossier_recouvrement_etab_statut`(`etablissement_id`, `statut`),
  INDEX `idx_dossier_recouvrement_eleve_annee`(`eleve_id`, `annee_scolaire_id`),
  INDEX `idx_dossier_recouvrement_facture`(`facture_id`),
  INDEX `idx_dossier_recouvrement_plan`(`plan_paiement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `regles_recouvrement_finance`
  ADD CONSTRAINT `regles_recouvrement_finance_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `regles_recouvrement_finance_approuve_par_utilisateur_id_fkey`
    FOREIGN KEY (`approuve_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `promesses_paiement`
  ADD CONSTRAINT `promesses_paiement_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_eleve_id_fkey`
    FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_facture_id_fkey`
    FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_plan_paiement_id_fkey`
    FOREIGN KEY (`plan_paiement_id`) REFERENCES `plans_paiement_eleves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_echeance_paiement_id_fkey`
    FOREIGN KEY (`echeance_paiement_id`) REFERENCES `echeances_paiement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_cree_par_utilisateur_id_fkey`
    FOREIGN KEY (`cree_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `promesses_paiement_valide_par_utilisateur_id_fkey`
    FOREIGN KEY (`valide_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `restrictions_administratives`
  ADD CONSTRAINT `restrictions_administratives_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_eleve_id_fkey`
    FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_facture_id_fkey`
    FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_plan_paiement_id_fkey`
    FOREIGN KEY (`plan_paiement_id`) REFERENCES `plans_paiement_eleves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_cree_par_utilisateur_id_fkey`
    FOREIGN KEY (`cree_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `restrictions_administratives_levee_par_utilisateur_id_fkey`
    FOREIGN KEY (`levee_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dossiers_recouvrement`
  ADD CONSTRAINT `dossiers_recouvrement_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_eleve_id_fkey`
    FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_annee_scolaire_id_fkey`
    FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_facture_id_fkey`
    FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_plan_paiement_id_fkey`
    FOREIGN KEY (`plan_paiement_id`) REFERENCES `plans_paiement_eleves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_cree_par_utilisateur_id_fkey`
    FOREIGN KEY (`cree_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `dossiers_recouvrement_valide_par_utilisateur_id_fkey`
    FOREIGN KEY (`valide_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
