-- CreateTable
CREATE TABLE `etablissements` (
    `id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `fuseau_horaire` VARCHAR(191) NULL,
    `parametres_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `etablissements_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sites` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NULL,
    `telephone` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sites_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `annees_scolaires` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin` DATETIME(3) NOT NULL,
    `est_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `annees_scolaires_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periodes` (
    `id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin` DATETIME(3) NOT NULL,
    `ordre` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `periodes_annee_scolaire_id_idx`(`annee_scolaire_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salles` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `capacite` INTEGER NULL,
    `type` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `salles_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `referenciel` (
    `id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `etablissement_referenciel` (
    `id` VARCHAR(191) NOT NULL,
    `referenciel_id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `valeur` VARCHAR(191) NOT NULL,
    `referencielId` VARCHAR(191) NULL,

    INDEX `etablissement_referenciel_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utilisateurs` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `telephone` VARCHAR(191) NULL,
    `mot_de_passe_hash` VARCHAR(191) NULL,
    `statut` ENUM('ACTIF', 'INACTIF', 'SUSPENDU') NOT NULL DEFAULT 'ACTIF',
    `dernier_login` DATETIME(3) NULL,
    `scope_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `utilisateurs_etablissement_id_idx`(`etablissement_id`),
    UNIQUE INDEX `utilisateurs_etablissement_id_email_key`(`etablissement_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profils` (
    `id` VARCHAR(191) NOT NULL,
    `utilisateur_id` VARCHAR(191) NOT NULL,
    `prenom` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `date_naissance` DATETIME(3) NULL,
    `genre` VARCHAR(191) NULL,
    `photo_url` VARCHAR(191) NULL,
    `adresse` VARCHAR(191) NULL,
    `contact_urgence_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `profils_utilisateur_id_key`(`utilisateur_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NULL,
    `nom` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `scope_json` JSON NULL,

    INDEX `roles_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `permissions_etablissement_id_idx`(`etablissement_id`),
    UNIQUE INDEX `permissions_etablissement_id_code_key`(`etablissement_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles_permissions` (
    `role_id` VARCHAR(191) NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utilisateurs_roles` (
    `utilisateur_id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,
    `scope_json` JSON NULL,

    PRIMARY KEY (`utilisateur_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eleves` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `code_eleve` VARCHAR(191) NULL,
    `utilisateur_id` VARCHAR(191) NULL,
    `statut` VARCHAR(191) NULL,
    `date_entree` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `eleves_etablissement_id_idx`(`etablissement_id`),
    UNIQUE INDEX `eleves_etablissement_id_code_eleve_key`(`etablissement_id`, `code_eleve`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parents_tuteurs` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `utilisateur_id` VARCHAR(191) NULL,
    `nom_complet` VARCHAR(191) NOT NULL,
    `telephone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `adresse` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `parents_tuteurs_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eleves_parents_tuteurs` (
    `eleve_id` VARCHAR(191) NOT NULL,
    `parent_tuteur_id` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NULL,
    `est_principal` BOOLEAN NOT NULL DEFAULT false,
    `autorise_recuperation` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`eleve_id`, `parent_tuteur_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `niveaux_scolaires` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `ordre` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `niveaux_scolaires_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `niveau_scolaire_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `nom` VARCHAR(191) NOT NULL,
    `enseignant_principal_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `classes_etablissement_id_idx`(`etablissement_id`),
    INDEX `classes_annee_scolaire_id_idx`(`annee_scolaire_id`),
    UNIQUE INDEX `classes_annee_scolaire_id_nom_site_id_key`(`annee_scolaire_id`, `nom`, `site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `classe_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `date_inscription` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `statut` ENUM('INSCRIT', 'TRANSFERE', 'SORTI') NOT NULL DEFAULT 'INSCRIT',
    `date_sortie` DATETIME(3) NULL,
    `raison_sortie` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inscriptions_eleve_id_idx`(`eleve_id`),
    INDEX `inscriptions_annee_scolaire_id_idx`(`annee_scolaire_id`),
    UNIQUE INDEX `inscriptions_eleve_id_annee_scolaire_id_key`(`eleve_id`, `annee_scolaire_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `identifiants_eleves` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `valeur` VARCHAR(191) NOT NULL,
    `delivre_le` DATETIME(3) NULL,
    `expire_le` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `identifiants_eleves_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personnel` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `code_personnel` VARCHAR(191) NULL,
    `utilisateur_id` VARCHAR(191) NULL,
    `date_embauche` DATETIME(3) NULL,
    `statut` VARCHAR(191) NULL,
    `poste` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `personnel_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enseignants` (
    `id` VARCHAR(191) NOT NULL,
    `personnel_id` VARCHAR(191) NOT NULL,
    `departement_principal_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `enseignants_personnel_id_key`(`personnel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departements` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `departements_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matieres` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `nom` VARCHAR(191) NOT NULL,
    `departement_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `matieres_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `programmes` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `niveau_scolaire_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `programmes_annee_scolaire_id_idx`(`annee_scolaire_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `programmes_matieres` (
    `id` VARCHAR(191) NOT NULL,
    `programme_id` VARCHAR(191) NOT NULL,
    `matiere_id` VARCHAR(191) NOT NULL,
    `heures_semaine` INTEGER NULL,
    `coefficient` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `programmes_matieres_programme_id_idx`(`programme_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cours` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `classe_id` VARCHAR(191) NOT NULL,
    `matiere_id` VARCHAR(191) NOT NULL,
    `enseignant_id` VARCHAR(191) NOT NULL,
    `coefficient_override` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cours_classe_id_matiere_id_annee_scolaire_id_key`(`classe_id`, `matiere_id`, `annee_scolaire_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `types_evaluations` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `poids_defaut` DOUBLE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `types_evaluations_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evaluations` (
    `id` VARCHAR(191) NOT NULL,
    `cours_id` VARCHAR(191) NOT NULL,
    `periode_id` VARCHAR(191) NOT NULL,
    `type_evaluation_id` VARCHAR(191) NULL,
    `type` ENUM('DEVOIR', 'EXAMEN', 'ORAL', 'AUTRE') NOT NULL DEFAULT 'AUTRE',
    `titre` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `note_max` DOUBLE NOT NULL DEFAULT 20,
    `poids` DOUBLE NULL,
    `est_publiee` BOOLEAN NOT NULL DEFAULT false,
    `cree_par_enseignant_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `evaluations_cours_id_idx`(`cours_id`),
    INDEX `evaluations_periode_id_idx`(`periode_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes` (
    `id` VARCHAR(191) NOT NULL,
    `evaluation_id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `score` DOUBLE NOT NULL,
    `commentaire` VARCHAR(191) NULL,
    `note_le` DATETIME(3) NULL,
    `note_par` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notes_evaluation_id_eleve_id_key`(`evaluation_id`, `eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regles_notes` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `regle_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `regles_notes_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulletins` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `periode_id` VARCHAR(191) NOT NULL,
    `classe_id` VARCHAR(191) NOT NULL,
    `publie_le` DATETIME(3) NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bulletins_eleve_id_idx`(`eleve_id`),
    INDEX `bulletins_periode_id_idx`(`periode_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bulletins_lignes` (
    `id` VARCHAR(191) NOT NULL,
    `bulletin_id` VARCHAR(191) NOT NULL,
    `matiere_id` VARCHAR(191) NOT NULL,
    `moyenne` DOUBLE NULL,
    `rang` INTEGER NULL,
    `commentaire_enseignant` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bulletins_lignes_bulletin_id_idx`(`bulletin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creneaux_horaires` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `heure_debut` VARCHAR(191) NOT NULL,
    `heure_fin` VARCHAR(191) NOT NULL,
    `ordre` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `creneaux_horaires_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emploi_du_temps` (
    `id` VARCHAR(191) NOT NULL,
    `classe_id` VARCHAR(191) NOT NULL,
    `cours_id` VARCHAR(191) NULL,
    `matiere_id` VARCHAR(191) NULL,
    `enseignant_id` VARCHAR(191) NULL,
    `salle_id` VARCHAR(191) NULL,
    `jour_semaine` INTEGER NOT NULL,
    `creneau_horaire_id` VARCHAR(191) NOT NULL,
    `effectif_du` DATETIME(3) NULL,
    `effectif_au` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `emploi_du_temps_classe_id_idx`(`classe_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evenements_calendrier` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `titre` VARCHAR(191) NOT NULL,
    `debut` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `evenements_calendrier_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions_appel` (
    `id` VARCHAR(191) NOT NULL,
    `classe_id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `creneau_horaire_id` VARCHAR(191) NOT NULL,
    `pris_par_enseignant_id` VARCHAR(191) NULL,
    `pris_le` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sessions_appel_classe_id_idx`(`classe_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presences_eleves` (
    `id` VARCHAR(191) NOT NULL,
    `session_appel_id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `statut` ENUM('PRESENT', 'ABSENT', 'RETARD', 'EXCUSE') NOT NULL,
    `minutes_retard` INTEGER NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `presences_eleves_session_appel_id_eleve_id_key`(`session_appel_id`, `eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `motifs_absence` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `est_excuse_par_defaut` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `motifs_absence_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `justificatifs_absence` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin` DATETIME(3) NOT NULL,
    `motif_absence_id` VARCHAR(191) NULL,
    `document_url` VARCHAR(191) NULL,
    `approuve_par` VARCHAR(191) NULL,
    `approuve_le` DATETIME(3) NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `justificatifs_absence_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `presences_personnel` (
    `id` VARCHAR(191) NOT NULL,
    `personnel_id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NULL,
    `statut` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `presences_personnel_personnel_id_key`(`personnel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incidents_disciplinaires` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `signale_par` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `gravite` INTEGER NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `incidents_disciplinaires_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sanctions_disciplinaires` (
    `id` VARCHAR(191) NOT NULL,
    `incident_id` VARCHAR(191) NOT NULL,
    `type_action` VARCHAR(191) NOT NULL,
    `debut` DATETIME(3) NULL,
    `fin` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `decide_par` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sanctions_disciplinaires_incident_id_idx`(`incident_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recompenses` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `points` INTEGER NULL DEFAULT 0,
    `raison` VARCHAR(191) NULL,
    `donne_par` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recompenses_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `canaux_communication` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `type` ENUM('EMAIL', 'SMS', 'APP') NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `config_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `canaux_communication_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `annonces` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `contenu` VARCHAR(191) NOT NULL,
    `publie_le` DATETIME(3) NULL,
    `cree_par` VARCHAR(191) NULL,
    `cible_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `annonces_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `expediteur_utilisateur_id` VARCHAR(191) NOT NULL,
    `objet` VARCHAR(191) NULL,
    `corps` VARCHAR(191) NOT NULL,
    `envoye_le` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `messages_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages_destinataires` (
    `message_id` VARCHAR(191) NOT NULL,
    `utilisateur_id` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NULL,
    `lu_le` DATETIME(3) NULL,

    PRIMARY KEY (`message_id`, `utilisateur_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `utilisateur_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload_json` JSON NULL,
    `lu_le` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notifications_utilisateur_id_idx`(`utilisateur_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalogue_frais` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `montant` DECIMAL(12, 2) NOT NULL,
    `devise` VARCHAR(191) NOT NULL DEFAULT 'MGA',
    `est_recurrent` BOOLEAN NOT NULL DEFAULT false,
    `periodicite` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `catalogue_frais_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans_paiement_eleves` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `plan_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plans_paiement_eleves_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factures` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `numero_facture` VARCHAR(191) NOT NULL,
    `date_emission` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `date_echeance` DATETIME(3) NULL,
    `statut` ENUM('BROUILLON', 'EMISE', 'PARTIELLE', 'PAYEE', 'ANNULEE', 'EN_RETARD') NOT NULL DEFAULT 'EMISE',
    `total_montant` DECIMAL(12, 2) NOT NULL,
    `devise` VARCHAR(191) NOT NULL DEFAULT 'MGA',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `factures_etablissement_id_idx`(`etablissement_id`),
    UNIQUE INDEX `factures_etablissement_id_numero_facture_key`(`etablissement_id`, `numero_facture`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `factures_lignes` (
    `id` VARCHAR(191) NOT NULL,
    `facture_id` VARCHAR(191) NOT NULL,
    `catalogue_frais_id` VARCHAR(191) NULL,
    `libelle` VARCHAR(191) NOT NULL,
    `quantite` INTEGER NOT NULL DEFAULT 1,
    `prix_unitaire` DECIMAL(12, 2) NOT NULL,
    `montant` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `factures_lignes_facture_id_idx`(`facture_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paiements` (
    `id` VARCHAR(191) NOT NULL,
    `facture_id` VARCHAR(191) NOT NULL,
    `paye_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `montant` DECIMAL(12, 2) NOT NULL,
    `methode` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `recu_par` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `paiements_facture_id_idx`(`facture_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `remises` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `valeur` DOUBLE NOT NULL,
    `regles_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `remises_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ressources_bibliotheque` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `auteur` VARCHAR(191) NULL,
    `editeur` VARCHAR(191) NULL,
    `annee` INTEGER NULL,
    `stock` INTEGER NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ressources_bibliotheque_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emprunts` (
    `id` VARCHAR(191) NOT NULL,
    `ressource_bibliotheque_id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NULL,
    `personnel_id` VARCHAR(191) NULL,
    `emprunte_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `du_le` DATETIME(3) NULL,
    `retourne_le` DATETIME(3) NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `emprunts_ressource_bibliotheque_id_idx`(`ressource_bibliotheque_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lignes_transport` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `infos_vehicule_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lignes_transport_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `arrets_transport` (
    `id` VARCHAR(191) NOT NULL,
    `ligne_transport_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `geo_json` JSON NULL,
    `ordre` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `arrets_transport_ligne_transport_id_idx`(`ligne_transport_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `abonnements_transport` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `ligne_transport_id` VARCHAR(191) NOT NULL,
    `arret_transport_id` VARCHAR(191) NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `abonnements_transport_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `formules_cantine` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `prix` DECIMAL(12, 2) NOT NULL,
    `periodicite` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `formules_cantine_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `abonnements_cantine` (
    `id` VARCHAR(191) NOT NULL,
    `eleve_id` VARCHAR(191) NOT NULL,
    `annee_scolaire_id` VARCHAR(191) NOT NULL,
    `formule_cantine_id` VARCHAR(191) NOT NULL,
    `statut` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `abonnements_cantine_eleve_id_idx`(`eleve_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fichiers` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `proprietaire_utilisateur_id` VARCHAR(191) NULL,
    `fournisseur_stockage` VARCHAR(191) NULL,
    `chemin` VARCHAR(191) NOT NULL,
    `type_mime` VARCHAR(191) NULL,
    `taille` INTEGER NULL,
    `checksum` VARCHAR(191) NULL,
    `televerse_le` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fichiers_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `liens_fichiers` (
    `id` VARCHAR(191) NOT NULL,
    `fichier_id` VARCHAR(191) NOT NULL,
    `type_entite` VARCHAR(191) NOT NULL,
    `id_entite` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `liens_fichiers_fichier_id_idx`(`fichier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journaux_audit` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `acteur_utilisateur_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `type_entite` VARCHAR(191) NULL,
    `id_entite` VARCHAR(191) NULL,
    `avant_json` JSON NULL,
    `apres_json` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `date_action` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `journaux_audit_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhooks` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `evenements_json` JSON NULL,
    `secret` VARCHAR(191) NULL,
    `est_actif` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `webhooks_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jetons_integrations` (
    `id` VARCHAR(191) NOT NULL,
    `etablissement_id` VARCHAR(191) NOT NULL,
    `fournisseur` VARCHAR(191) NOT NULL,
    `token_json` JSON NOT NULL,
    `expire_le` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `jetons_integrations_etablissement_id_idx`(`etablissement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annees_scolaires` ADD CONSTRAINT `annees_scolaires_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodes` ADD CONSTRAINT `periodes_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salles` ADD CONSTRAINT `salles_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `etablissement_referenciel` ADD CONSTRAINT `etablissement_referenciel_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `etablissement_referenciel` ADD CONSTRAINT `etablissement_referenciel_referencielId_fkey` FOREIGN KEY (`referencielId`) REFERENCES `referenciel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profils` ADD CONSTRAINT `profils_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles_permissions` ADD CONSTRAINT `roles_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles_permissions` ADD CONSTRAINT `roles_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs_roles` ADD CONSTRAINT `utilisateurs_roles_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs_roles` ADD CONSTRAINT `utilisateurs_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eleves` ADD CONSTRAINT `eleves_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eleves` ADD CONSTRAINT `eleves_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents_tuteurs` ADD CONSTRAINT `parents_tuteurs_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents_tuteurs` ADD CONSTRAINT `parents_tuteurs_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eleves_parents_tuteurs` ADD CONSTRAINT `eleves_parents_tuteurs_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eleves_parents_tuteurs` ADD CONSTRAINT `eleves_parents_tuteurs_parent_tuteur_id_fkey` FOREIGN KEY (`parent_tuteur_id`) REFERENCES `parents_tuteurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `niveaux_scolaires` ADD CONSTRAINT `niveaux_scolaires_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_niveau_scolaire_id_fkey` FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_enseignant_principal_id_fkey` FOREIGN KEY (`enseignant_principal_id`) REFERENCES `enseignants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inscriptions` ADD CONSTRAINT `inscriptions_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inscriptions` ADD CONSTRAINT `inscriptions_classe_id_fkey` FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inscriptions` ADD CONSTRAINT `inscriptions_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `identifiants_eleves` ADD CONSTRAINT `identifiants_eleves_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personnel` ADD CONSTRAINT `personnel_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `personnel` ADD CONSTRAINT `personnel_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enseignants` ADD CONSTRAINT `enseignants_personnel_id_fkey` FOREIGN KEY (`personnel_id`) REFERENCES `personnel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enseignants` ADD CONSTRAINT `enseignants_departement_principal_id_fkey` FOREIGN KEY (`departement_principal_id`) REFERENCES `departements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departements` ADD CONSTRAINT `departements_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matieres` ADD CONSTRAINT `matieres_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matieres` ADD CONSTRAINT `matieres_departement_id_fkey` FOREIGN KEY (`departement_id`) REFERENCES `departements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes` ADD CONSTRAINT `programmes_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes` ADD CONSTRAINT `programmes_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes` ADD CONSTRAINT `programmes_niveau_scolaire_id_fkey` FOREIGN KEY (`niveau_scolaire_id`) REFERENCES `niveaux_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes_matieres` ADD CONSTRAINT `programmes_matieres_programme_id_fkey` FOREIGN KEY (`programme_id`) REFERENCES `programmes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `programmes_matieres` ADD CONSTRAINT `programmes_matieres_matiere_id_fkey` FOREIGN KEY (`matiere_id`) REFERENCES `matieres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cours` ADD CONSTRAINT `cours_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cours` ADD CONSTRAINT `cours_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cours` ADD CONSTRAINT `cours_classe_id_fkey` FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cours` ADD CONSTRAINT `cours_matiere_id_fkey` FOREIGN KEY (`matiere_id`) REFERENCES `matieres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cours` ADD CONSTRAINT `cours_enseignant_id_fkey` FOREIGN KEY (`enseignant_id`) REFERENCES `enseignants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_cours_id_fkey` FOREIGN KEY (`cours_id`) REFERENCES `cours`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_periode_id_fkey` FOREIGN KEY (`periode_id`) REFERENCES `periodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_type_evaluation_id_fkey` FOREIGN KEY (`type_evaluation_id`) REFERENCES `types_evaluations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evaluations` ADD CONSTRAINT `evaluations_cree_par_enseignant_id_fkey` FOREIGN KEY (`cree_par_enseignant_id`) REFERENCES `enseignants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_evaluation_id_fkey` FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regles_notes` ADD CONSTRAINT `regles_notes_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_periode_id_fkey` FOREIGN KEY (`periode_id`) REFERENCES `periodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins` ADD CONSTRAINT `bulletins_classe_id_fkey` FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins_lignes` ADD CONSTRAINT `bulletins_lignes_bulletin_id_fkey` FOREIGN KEY (`bulletin_id`) REFERENCES `bulletins`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bulletins_lignes` ADD CONSTRAINT `bulletins_lignes_matiere_id_fkey` FOREIGN KEY (`matiere_id`) REFERENCES `matieres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_classe_id_fkey` FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_cours_id_fkey` FOREIGN KEY (`cours_id`) REFERENCES `cours`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_matiere_id_fkey` FOREIGN KEY (`matiere_id`) REFERENCES `matieres`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_enseignant_id_fkey` FOREIGN KEY (`enseignant_id`) REFERENCES `enseignants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_salle_id_fkey` FOREIGN KEY (`salle_id`) REFERENCES `salles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emploi_du_temps` ADD CONSTRAINT `emploi_du_temps_creneau_horaire_id_fkey` FOREIGN KEY (`creneau_horaire_id`) REFERENCES `creneaux_horaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evenements_calendrier` ADD CONSTRAINT `evenements_calendrier_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evenements_calendrier` ADD CONSTRAINT `evenements_calendrier_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions_appel` ADD CONSTRAINT `sessions_appel_classe_id_fkey` FOREIGN KEY (`classe_id`) REFERENCES `classes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions_appel` ADD CONSTRAINT `sessions_appel_creneau_horaire_id_fkey` FOREIGN KEY (`creneau_horaire_id`) REFERENCES `creneaux_horaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions_appel` ADD CONSTRAINT `sessions_appel_pris_par_enseignant_id_fkey` FOREIGN KEY (`pris_par_enseignant_id`) REFERENCES `enseignants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presences_eleves` ADD CONSTRAINT `presences_eleves_session_appel_id_fkey` FOREIGN KEY (`session_appel_id`) REFERENCES `sessions_appel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presences_eleves` ADD CONSTRAINT `presences_eleves_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificatifs_absence` ADD CONSTRAINT `justificatifs_absence_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificatifs_absence` ADD CONSTRAINT `justificatifs_absence_motif_absence_id_fkey` FOREIGN KEY (`motif_absence_id`) REFERENCES `motifs_absence`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `presences_personnel` ADD CONSTRAINT `presences_personnel_personnel_id_fkey` FOREIGN KEY (`personnel_id`) REFERENCES `personnel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidents_disciplinaires` ADD CONSTRAINT `incidents_disciplinaires_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sanctions_disciplinaires` ADD CONSTRAINT `sanctions_disciplinaires_incident_id_fkey` FOREIGN KEY (`incident_id`) REFERENCES `incidents_disciplinaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recompenses` ADD CONSTRAINT `recompenses_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `canaux_communication` ADD CONSTRAINT `canaux_communication_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `annonces` ADD CONSTRAINT `annonces_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_expediteur_utilisateur_id_fkey` FOREIGN KEY (`expediteur_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages_destinataires` ADD CONSTRAINT `messages_destinataires_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages_destinataires` ADD CONSTRAINT `messages_destinataires_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_utilisateur_id_fkey` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalogue_frais` ADD CONSTRAINT `catalogue_frais_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plans_paiement_eleves` ADD CONSTRAINT `plans_paiement_eleves_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plans_paiement_eleves` ADD CONSTRAINT `plans_paiement_eleves_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factures` ADD CONSTRAINT `factures_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factures` ADD CONSTRAINT `factures_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factures` ADD CONSTRAINT `factures_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factures_lignes` ADD CONSTRAINT `factures_lignes_facture_id_fkey` FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `factures_lignes` ADD CONSTRAINT `factures_lignes_catalogue_frais_id_fkey` FOREIGN KEY (`catalogue_frais_id`) REFERENCES `catalogue_frais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paiements` ADD CONSTRAINT `paiements_facture_id_fkey` FOREIGN KEY (`facture_id`) REFERENCES `factures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `remises` ADD CONSTRAINT `remises_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emprunts` ADD CONSTRAINT `emprunts_ressource_bibliotheque_id_fkey` FOREIGN KEY (`ressource_bibliotheque_id`) REFERENCES `ressources_bibliotheque`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emprunts` ADD CONSTRAINT `emprunts_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emprunts` ADD CONSTRAINT `emprunts_personnel_id_fkey` FOREIGN KEY (`personnel_id`) REFERENCES `personnel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `arrets_transport` ADD CONSTRAINT `arrets_transport_ligne_transport_id_fkey` FOREIGN KEY (`ligne_transport_id`) REFERENCES `lignes_transport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_transport` ADD CONSTRAINT `abonnements_transport_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_transport` ADD CONSTRAINT `abonnements_transport_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_transport` ADD CONSTRAINT `abonnements_transport_ligne_transport_id_fkey` FOREIGN KEY (`ligne_transport_id`) REFERENCES `lignes_transport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_transport` ADD CONSTRAINT `abonnements_transport_arret_transport_id_fkey` FOREIGN KEY (`arret_transport_id`) REFERENCES `arrets_transport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_cantine` ADD CONSTRAINT `abonnements_cantine_eleve_id_fkey` FOREIGN KEY (`eleve_id`) REFERENCES `eleves`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_cantine` ADD CONSTRAINT `abonnements_cantine_annee_scolaire_id_fkey` FOREIGN KEY (`annee_scolaire_id`) REFERENCES `annees_scolaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `abonnements_cantine` ADD CONSTRAINT `abonnements_cantine_formule_cantine_id_fkey` FOREIGN KEY (`formule_cantine_id`) REFERENCES `formules_cantine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers` ADD CONSTRAINT `fichiers_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers` ADD CONSTRAINT `fichiers_proprietaire_utilisateur_id_fkey` FOREIGN KEY (`proprietaire_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `liens_fichiers` ADD CONSTRAINT `liens_fichiers_fichier_id_fkey` FOREIGN KEY (`fichier_id`) REFERENCES `fichiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journaux_audit` ADD CONSTRAINT `journaux_audit_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journaux_audit` ADD CONSTRAINT `journaux_audit_acteur_utilisateur_id_fkey` FOREIGN KEY (`acteur_utilisateur_id`) REFERENCES `utilisateurs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jetons_integrations` ADD CONSTRAINT `jetons_integrations_etablissement_id_fkey` FOREIGN KEY (`etablissement_id`) REFERENCES `etablissements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
