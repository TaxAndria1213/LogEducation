CREATE TABLE `eleves_profils_medicaux` (
  `id` VARCHAR(191) NOT NULL,
  `eleve_id` VARCHAR(191) NOT NULL,
  `groupe_sanguin` VARCHAR(191) NULL,
  `allergies` TEXT NULL,
  `maladies_particulieres` TEXT NULL,
  `traitement_medical` TEXT NULL,
  `medecin_traitant` VARCHAR(191) NULL,
  `telephone_medecin` VARCHAR(191) NULL,
  `autorisation_prise_en_charge_medicale` BOOLEAN NOT NULL DEFAULT false,
  `personne_a_contacter_urgence` VARCHAR(191) NULL,
  `telephone_urgence` VARCHAR(191) NULL,
  `notes_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `eleves_profils_medicaux_eleve_id_key`(`eleve_id`),
  INDEX `eleves_profils_medicaux_eleve_id_idx`(`eleve_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inscriptions_historiques_scolaires` (
  `id` VARCHAR(191) NOT NULL,
  `inscription_id` VARCHAR(191) NOT NULL,
  `ancien_etablissement` VARCHAR(191) NULL,
  `ancienne_classe` VARCHAR(191) NULL,
  `annee_precedente` VARCHAR(191) NULL,
  `derniere_moyenne` DECIMAL(5, 2) NULL,
  `decision_precedente` VARCHAR(191) NULL,
  `mention_precedente` VARCHAR(191) NULL,
  `motif_transfert` TEXT NULL,
  `observations` TEXT NULL,
  `reprise_auto` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `inscriptions_historiques_scolaires_inscription_id_key`(`inscription_id`),
  INDEX `inscriptions_historiques_scolaires_inscription_id_idx`(`inscription_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `eleves_profils_medicaux`
  ADD CONSTRAINT `eleves_profils_medicaux_eleve_id_fkey`
  FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `inscriptions_historiques_scolaires`
  ADD CONSTRAINT `inscriptions_historiques_scolaires_inscription_id_fkey`
  FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
