ALTER TABLE `factures`
  ADD COLUMN `facture_origine_id` VARCHAR(191) NULL,
  ADD COLUMN `nature` VARCHAR(191) NOT NULL DEFAULT 'FACTURE';

ALTER TABLE `paiements`
  ADD COLUMN `statut` VARCHAR(191) NOT NULL DEFAULT 'ENREGISTRE';

CREATE TABLE `operations_financieres` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NOT NULL,
  `facture_id` VARCHAR(191) NULL,
  `paiement_id` VARCHAR(191) NULL,
  `cree_par_utilisateur_id` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `montant` DECIMAL(12,2) NULL,
  `motif` TEXT NULL,
  `details_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_opfin_etab_type` (`etablissement_id`, `type`),
  KEY `idx_opfin_facture` (`facture_id`),
  KEY `idx_opfin_paiement` (`paiement_id`),
  CONSTRAINT `fk_opfin_etab` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_opfin_facture` FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_opfin_paiement` FOREIGN KEY (`paiement_id`) REFERENCES `paiements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_opfin_createur` FOREIGN KEY (`cree_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `factures`
  ADD KEY `idx_facture_origine` (`facture_origine_id`),
  ADD CONSTRAINT `fk_facture_origine` FOREIGN KEY (`facture_origine_id`) REFERENCES `factures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
