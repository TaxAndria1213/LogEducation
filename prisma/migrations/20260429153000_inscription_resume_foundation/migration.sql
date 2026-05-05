ALTER TABLE `parents_tuteurs`
  ADD COLUMN `telephone_secondaire` VARCHAR(191) NULL AFTER `telephone`,
  ADD COLUMN `profession` VARCHAR(191) NULL AFTER `adresse`;

ALTER TABLE `eleves_parents_tuteurs`
  ADD COLUMN `est_responsable_legal` BOOLEAN NOT NULL DEFAULT false AFTER `est_principal`,
  ADD COLUMN `est_responsable_financier` BOOLEAN NOT NULL DEFAULT false AFTER `est_responsable_legal`,
  ADD COLUMN `est_contact_urgence` BOOLEAN NOT NULL DEFAULT false AFTER `est_responsable_financier`;

UPDATE `eleves_parents_tuteurs`
SET
  `est_responsable_legal` = `est_principal`,
  `est_responsable_financier` = `est_principal`,
  `est_contact_urgence` = `est_principal`
WHERE `est_principal` = true;

ALTER TABLE `inscriptions`
  DROP FOREIGN KEY `inscriptions_classe_id_fkey`;

ALTER TABLE `inscriptions`
  ADD COLUMN `niveau_scolaire_id` VARCHAR(191) NULL AFTER `eleve_id`,
  MODIFY COLUMN `classe_id` VARCHAR(191) NULL,
  MODIFY COLUMN `statut` ENUM(
    'PREINSCRIT',
    'INSCRIT',
    'EN_ATTENTE_PAIEMENT',
    'VALIDEE',
    'DOSSIER_INCOMPLET',
    'ANNULEE',
    'TRANSFERE',
    'SUSPENDUE',
    'SORTI'
  ) NOT NULL DEFAULT 'INSCRIT',
  ADD COLUMN `type_inscription` ENUM(
    'NOUVELLE_INSCRIPTION',
    'REINSCRIPTION',
    'TRANSFERT_ENTRANT',
    'REDOUBLEMENT',
    'PASSAGE_CLASSE_SUPERIEURE'
  ) NOT NULL DEFAULT 'NOUVELLE_INSCRIPTION' AFTER `date_inscription`,
  ADD COLUMN `statut_administratif` ENUM(
    'EN_ATTENTE',
    'DOSSIER_INCOMPLET',
    'EN_ATTENTE_VERIFICATION',
    'VALIDE',
    'REJETE',
    'ANNULE'
  ) NOT NULL DEFAULT 'EN_ATTENTE' AFTER `statut`,
  ADD COLUMN `statut_financier` ENUM(
    'NON_FACTURE',
    'FACTURE',
    'NON_PAYE',
    'PARTIELLEMENT_PAYE',
    'PAYE',
    'EN_RETARD',
    'EXONERE',
    'ANNULE'
  ) NOT NULL DEFAULT 'NON_FACTURE' AFTER `statut_administratif`,
  ADD COLUMN `statut_dossier` ENUM(
    'COMPLET',
    'INCOMPLET',
    'EN_ATTENTE_VERIFICATION',
    'VALIDE',
    'REJETE'
  ) NOT NULL DEFAULT 'INCOMPLET' AFTER `statut_financier`,
  ADD COLUMN `validation_date` DATETIME(3) NULL AFTER `statut_dossier`,
  ADD COLUMN `completion_rate` DECIMAL(5,2) NULL AFTER `validation_date`;

UPDATE `inscriptions` `i`
LEFT JOIN `classes` `c` ON `c`.`id` = `i`.`classe_id`
SET `i`.`niveau_scolaire_id` = `c`.`niveau_scolaire_id`
WHERE `i`.`classe_id` IS NOT NULL
  AND `i`.`niveau_scolaire_id` IS NULL;

ALTER TABLE `inscriptions`
  ADD INDEX `inscriptions_niveau_scolaire_id_idx`(`niveau_scolaire_id`),
  ADD INDEX `inscriptions_classe_id_idx`(`classe_id`);

ALTER TABLE `inscriptions`
  ADD CONSTRAINT `inscriptions_niveau_scolaire_id_fkey`
    FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inscriptions_classe_id_fkey`
    FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `documents_types_inscription` (
  `id` VARCHAR(191) NOT NULL,
  `etablissement_id` VARCHAR(191) NULL,
  `code` VARCHAR(191) NOT NULL,
  `nom` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `type_inscriptions_json` JSON NULL,
  `est_obligatoire_par_defaut` BOOLEAN NOT NULL DEFAULT false,
  `est_actif` BOOLEAN NOT NULL DEFAULT true,
  `ordre` INTEGER NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `documents_types_inscription_etablissement_id_code_key`(`etablissement_id`, `code`),
  INDEX `documents_types_inscription_etablissement_id_idx`(`etablissement_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inscriptions_documents` (
  `id` VARCHAR(191) NOT NULL,
  `inscription_id` VARCHAR(191) NOT NULL,
  `document_type_id` VARCHAR(191) NOT NULL,
  `fichier_id` VARCHAR(191) NULL,
  `verifie_par_utilisateur_id` VARCHAR(191) NULL,
  `obligatoire` BOOLEAN NOT NULL DEFAULT false,
  `fourni` BOOLEAN NOT NULL DEFAULT false,
  `statut` ENUM(
    'NON_FOURNI',
    'FOURNI',
    'EN_ATTENTE_VERIFICATION',
    'VALIDE',
    'REJETE',
    'EXPIRE'
  ) NOT NULL DEFAULT 'NON_FOURNI',
  `date_depot` DATETIME(3) NULL,
  `date_verification` DATETIME(3) NULL,
  `commentaire_admin` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inscriptions_documents_inscription_id_document_type_id_key`(`inscription_id`, `document_type_id`),
  INDEX `inscriptions_documents_inscription_id_idx`(`inscription_id`),
  INDEX `inscriptions_documents_document_type_id_idx`(`document_type_id`),
  INDEX `inscriptions_documents_fichier_id_idx`(`fichier_id`),
  INDEX `inscriptions_documents_verifie_par_utilisateur_id_idx`(`verifie_par_utilisateur_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `documents_types_inscription`
  ADD CONSTRAINT `documents_types_inscription_etablissement_id_fkey`
    FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inscriptions_documents`
  ADD CONSTRAINT `inscriptions_documents_inscription_id_fkey`
    FOREIGN KEY (`inscription_id`) REFERENCES `inscriptions`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inscriptions_documents_document_type_id_fkey`
    FOREIGN KEY (`document_type_id`) REFERENCES `documents_types_inscription`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inscriptions_documents_fichier_id_fkey`
    FOREIGN KEY (`fichier_id`) REFERENCES `fichiers`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inscriptions_documents_verifie_par_utilisateur_id_fkey`
    FOREIGN KEY (`verifie_par_utilisateur_id`) REFERENCES `utilisateurs`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
