-- =========================================================
-- LogEducation - Jeu de donnees de demonstration
-- A importer apres un `prisma migrate reset` / base vide
-- Tous les mots de passe des comptes ci-dessous sont: 123456
-- Hash bcrypt utilise:
-- $2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe
--
-- Comptes demo:
-- admin@demo.logeducation.local
-- direction@demo.logeducation.local
-- secretariat@demo.logeducation.local
-- enseignant@demo.logeducation.local
-- comptable@demo.logeducation.local
-- surveillant@demo.logeducation.local
-- parent@demo.logeducation.local
-- eleve@demo.logeducation.local
-- =========================================================

START TRANSACTION;

INSERT INTO `etablissements` (`id`, `nom`, `code`, `fuseau_horaire`, `parametres_json`)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'College Demo LogEducation', 'DEMO01', 'Indian/Antananarivo', '{"devise":"MGA","langue":"fr","mobile_enabled":true}');

INSERT INTO `sites` (`id`, `etablissement_id`, `nom`, `adresse`, `telephone`)
VALUES
  ('11111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Campus Principal', 'Lot II A 15 Analakely', '+261340000001');

INSERT INTO `salles` (`id`, `site_id`, `nom`, `capacite`, `type`)
VALUES
  ('11111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111112', 'Salle A1', 40, 'CLASSE'),
  ('11111111-1111-4111-8111-111111111114', '11111111-1111-4111-8111-111111111112', 'Laboratoire Info', 24, 'LABO');

INSERT INTO `annees_scolaires` (`id`, `etablissement_id`, `nom`, `date_debut`, `date_fin`, `est_active`)
VALUES
  ('11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111111', '2025-2026', '2025-09-01 00:00:00.000', '2026-07-31 23:59:59.000', 1);

INSERT INTO `periodes` (`id`, `annee_scolaire_id`, `nom`, `date_debut`, `date_fin`, `ordre`)
VALUES
  ('11111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111115', 'Trimestre 1', '2025-09-01 00:00:00.000', '2025-11-30 23:59:59.000', 1),
  ('11111111-1111-4111-8111-111111111117', '11111111-1111-4111-8111-111111111115', 'Trimestre 2', '2025-12-01 00:00:00.000', '2026-03-15 23:59:59.000', 2),
  ('11111111-1111-4111-8111-111111111118', '11111111-1111-4111-8111-111111111115', 'Trimestre 3', '2026-03-16 00:00:00.000', '2026-07-31 23:59:59.000', 3);

INSERT INTO `roles` (`id`, `etablissement_id`, `nom`, `scope_json`)
VALUES
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111111', 'ADMIN', '{"permissions":["ADM.*","ET.*","CS.*","SC.*","PE.*","PD.*","EDT.*","PR.*"]}'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111111', 'DIRECTION', '{"permissions":["ET.*","SC.*","PE.*","PD.*","EDT.*","PR.*"]}'),
  ('11111111-1111-4111-8111-11111111111b', '11111111-1111-4111-8111-111111111111', 'SECRETARIAT', '{"permissions":["ET.*","SC.*","PR.*"]}'),
  ('11111111-1111-4111-8111-11111111111c', '11111111-1111-4111-8111-111111111111', 'ENSEIGNANT', '{"permissions":["PD.*","EDT.*","PR.*"]}'),
  ('11111111-1111-4111-8111-11111111111d', '11111111-1111-4111-8111-111111111111', 'COMPTABLE', '{"permissions":["SC.*","ET.*"]}'),
  ('11111111-1111-4111-8111-11111111111e', '11111111-1111-4111-8111-111111111111', 'SURVEILLANT', '{"permissions":["PR.*","EDT.*","SC.CLASSES.*","SC.ELEVES.*"]}'),
  ('11111111-1111-4111-8111-11111111111f', '11111111-1111-4111-8111-111111111111', 'PARENT', '{"permissions":[]}'),
  ('11111111-1111-4111-8111-111111111120', '11111111-1111-4111-8111-111111111111', 'ELEVE', '{"permissions":[]}');

INSERT INTO `permissions` (`id`, `etablissement_id`, `code`, `description`)
VALUES
  ('11111111-1111-4111-8111-111111111121', '11111111-1111-4111-8111-111111111111', 'ADM.*', 'Acces administration'),
  ('11111111-1111-4111-8111-111111111122', '11111111-1111-4111-8111-111111111111', 'ET.*', 'Acces etablissement'),
  ('11111111-1111-4111-8111-111111111123', '11111111-1111-4111-8111-111111111111', 'CS.*', 'Acces compte et securite'),
  ('11111111-1111-4111-8111-111111111124', '11111111-1111-4111-8111-111111111111', 'SC.*', 'Acces scolarite'),
  ('11111111-1111-4111-8111-111111111125', '11111111-1111-4111-8111-111111111111', 'PE.*', 'Acces personnel'),
  ('11111111-1111-4111-8111-111111111126', '11111111-1111-4111-8111-111111111111', 'PD.*', 'Acces pedagogie'),
  ('11111111-1111-4111-8111-111111111127', '11111111-1111-4111-8111-111111111111', 'EDT.*', 'Acces emploi du temps'),
  ('11111111-1111-4111-8111-111111111128', '11111111-1111-4111-8111-111111111111', 'PR.*', 'Acces presences');

INSERT INTO `roles_permissions` (`role_id`, `permission_id`)
VALUES
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111121'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111122'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111123'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111124'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111125'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111126'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111127'),
  ('11111111-1111-4111-8111-111111111119', '11111111-1111-4111-8111-111111111128'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111122'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111124'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111125'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111126'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111127'),
  ('11111111-1111-4111-8111-11111111111a', '11111111-1111-4111-8111-111111111128'),
  ('11111111-1111-4111-8111-11111111111b', '11111111-1111-4111-8111-111111111122'),
  ('11111111-1111-4111-8111-11111111111b', '11111111-1111-4111-8111-111111111124'),
  ('11111111-1111-4111-8111-11111111111b', '11111111-1111-4111-8111-111111111128'),
  ('11111111-1111-4111-8111-11111111111c', '11111111-1111-4111-8111-111111111126'),
  ('11111111-1111-4111-8111-11111111111c', '11111111-1111-4111-8111-111111111127'),
  ('11111111-1111-4111-8111-11111111111c', '11111111-1111-4111-8111-111111111128'),
  ('11111111-1111-4111-8111-11111111111d', '11111111-1111-4111-8111-111111111124'),
  ('11111111-1111-4111-8111-11111111111e', '11111111-1111-4111-8111-111111111127'),
  ('11111111-1111-4111-8111-11111111111e', '11111111-1111-4111-8111-111111111128');

INSERT INTO `utilisateurs` (`id`, `etablissement_id`, `email`, `telephone`, `mot_de_passe_hash`, `statut`, `scope_json`)
VALUES
  ('11111111-1111-4111-8111-111111111129', '11111111-1111-4111-8111-111111111111', 'admin@demo.logeducation.local', '+261340000010', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112a', '11111111-1111-4111-8111-111111111111', 'direction@demo.logeducation.local', '+261340000011', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112b', '11111111-1111-4111-8111-111111111111', 'secretariat@demo.logeducation.local', '+261340000012', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112c', '11111111-1111-4111-8111-111111111111', 'enseignant@demo.logeducation.local', '+261340000013', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112d', '11111111-1111-4111-8111-111111111111', 'comptable@demo.logeducation.local', '+261340000014', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112e', '11111111-1111-4111-8111-111111111111', 'surveillant@demo.logeducation.local', '+261340000015', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-11111111112f', '11111111-1111-4111-8111-111111111111', 'parent@demo.logeducation.local', '+261340000016', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL),
  ('11111111-1111-4111-8111-111111111130', '11111111-1111-4111-8111-111111111111', 'eleve@demo.logeducation.local', '+261340000017', '$2b$10$4clGg58JDKaYCI47BFf.mO9azqxqyS3imwME4ERXQPJxrhf5XJbBe', 'ACTIF', NULL);

INSERT INTO `profils` (`id`, `utilisateur_id`, `prenom`, `nom`, `date_naissance`, `genre`, `adresse`, `contact_urgence_json`)
VALUES
  ('11111111-1111-4111-8111-111111111131', '11111111-1111-4111-8111-111111111129', 'Aina', 'Admin', '1988-01-12 00:00:00.000', 'F', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111132', '11111111-1111-4111-8111-11111111112a', 'Tiana', 'Directeur', '1983-05-02 00:00:00.000', 'M', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111133', '11111111-1111-4111-8111-11111111112b', 'Lova', 'Secretariat', '1992-03-22 00:00:00.000', 'F', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111134', '11111111-1111-4111-8111-11111111112c', 'Saholy', 'Andrianina', '1990-08-19 00:00:00.000', 'F', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111135', '11111111-1111-4111-8111-11111111112d', 'Miora', 'Comptable', '1989-09-14 00:00:00.000', 'F', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111136', '11111111-1111-4111-8111-11111111112e', 'Toky', 'Surveillant', '1994-02-11 00:00:00.000', 'M', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111137', '11111111-1111-4111-8111-11111111112f', 'Hery', 'Ranaivo', '1985-07-08 00:00:00.000', 'M', 'Antananarivo', NULL),
  ('11111111-1111-4111-8111-111111111138', '11111111-1111-4111-8111-111111111130', 'Mamy', 'Ranaivo', '2011-04-17 00:00:00.000', 'M', 'Antananarivo', '{"telephone":"+261340000016","nom":"Hery Ranaivo"}');

INSERT INTO `utilisateurs_roles` (`utilisateur_id`, `role_id`, `scope_json`)
VALUES
  ('11111111-1111-4111-8111-111111111129', '11111111-1111-4111-8111-111111111119', NULL),
  ('11111111-1111-4111-8111-11111111112a', '11111111-1111-4111-8111-11111111111a', NULL),
  ('11111111-1111-4111-8111-11111111112b', '11111111-1111-4111-8111-11111111111b', NULL),
  ('11111111-1111-4111-8111-11111111112c', '11111111-1111-4111-8111-11111111111c', NULL),
  ('11111111-1111-4111-8111-11111111112d', '11111111-1111-4111-8111-11111111111d', NULL),
  ('11111111-1111-4111-8111-11111111112e', '11111111-1111-4111-8111-11111111111e', NULL),
  ('11111111-1111-4111-8111-11111111112f', '11111111-1111-4111-8111-11111111111f', NULL),
  ('11111111-1111-4111-8111-111111111130', '11111111-1111-4111-8111-111111111120', NULL);

INSERT INTO `departements` (`id`, `etablissement_id`, `nom`)
VALUES
  ('11111111-1111-4111-8111-111111111139', '11111111-1111-4111-8111-111111111111', 'Sciences');

INSERT INTO `personnel` (`id`, `etablissement_id`, `code_personnel`, `utilisateur_id`, `date_embauche`, `statut`, `poste`)
VALUES
  ('11111111-1111-4111-8111-11111111113a', '11111111-1111-4111-8111-111111111111', 'P-ADM-001', '11111111-1111-4111-8111-111111111129', '2020-01-15 00:00:00.000', 'ACTIF', 'Administrateur systeme'),
  ('11111111-1111-4111-8111-11111111113b', '11111111-1111-4111-8111-111111111111', 'P-DIR-001', '11111111-1111-4111-8111-11111111112a', '2018-09-01 00:00:00.000', 'ACTIF', 'Directeur'),
  ('11111111-1111-4111-8111-11111111113c', '11111111-1111-4111-8111-111111111111', 'P-SEC-001', '11111111-1111-4111-8111-11111111112b', '2021-01-10 00:00:00.000', 'ACTIF', 'Secretaire scolaire'),
  ('11111111-1111-4111-8111-11111111113d', '11111111-1111-4111-8111-111111111111', 'P-ENS-001', '11111111-1111-4111-8111-11111111112c', '2019-09-02 00:00:00.000', 'ACTIF', 'Professeur de mathematiques'),
  ('11111111-1111-4111-8111-11111111113e', '11111111-1111-4111-8111-111111111111', 'P-COM-001', '11111111-1111-4111-8111-11111111112d', '2022-02-01 00:00:00.000', 'ACTIF', 'Comptable'),
  ('11111111-1111-4111-8111-11111111113f', '11111111-1111-4111-8111-111111111111', 'P-SUV-001', '11111111-1111-4111-8111-11111111112e', '2023-01-12 00:00:00.000', 'ACTIF', 'Surveillant general');

INSERT INTO `enseignants` (`id`, `personnel_id`, `departement_principal_id`)
VALUES
  ('11111111-1111-4111-8111-111111111140', '11111111-1111-4111-8111-11111111113d', '11111111-1111-4111-8111-111111111139');

INSERT INTO `niveaux_scolaires` (`id`, `etablissement_id`, `nom`, `ordre`)
VALUES
  ('11111111-1111-4111-8111-111111111141', '11111111-1111-4111-8111-111111111111', '6eme', 1);

INSERT INTO `classes` (`id`, `etablissement_id`, `annee_scolaire_id`, `niveau_scolaire_id`, `site_id`, `nom`, `enseignant_principal_id`)
VALUES
  ('11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111141', '11111111-1111-4111-8111-111111111112', '6A', '11111111-1111-4111-8111-111111111140');

INSERT INTO `eleves` (`id`, `etablissement_id`, `code_eleve`, `utilisateur_id`, `statut`, `date_entree`)
VALUES
  ('11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111111', 'E-2025-001', '11111111-1111-4111-8111-111111111130', 'ACTIF', '2025-09-01 00:00:00.000'),
  ('11111111-1111-4111-8111-111111111144', '11111111-1111-4111-8111-111111111111', 'E-2025-002', NULL, 'ACTIF', '2025-09-01 00:00:00.000');

INSERT INTO `parents_tuteurs` (`id`, `etablissement_id`, `utilisateur_id`, `nom_complet`, `telephone`, `email`, `adresse`)
VALUES
  ('11111111-1111-4111-8111-111111111145', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-11111111112f', 'Hery Ranaivo', '+261340000016', 'parent@demo.logeducation.local', 'Antananarivo');

INSERT INTO `eleves_parents_tuteurs` (`eleve_id`, `parent_tuteur_id`, `relation`, `est_principal`, `autorise_recuperation`)
VALUES
  ('11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111145', 'pere', 1, 1),
  ('11111111-1111-4111-8111-111111111144', '11111111-1111-4111-8111-111111111145', 'pere', 1, 1);

INSERT INTO `inscriptions` (`id`, `eleve_id`, `classe_id`, `annee_scolaire_id`, `date_inscription`, `statut`)
VALUES
  ('11111111-1111-4111-8111-111111111146', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-111111111115', '2025-09-01 08:00:00.000', 'INSCRIT'),
  ('11111111-1111-4111-8111-111111111147', '11111111-1111-4111-8111-111111111144', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-111111111115', '2025-09-01 08:10:00.000', 'INSCRIT');

INSERT INTO `identifiants_eleves` (`id`, `eleve_id`, `type`, `valeur`, `delivre_le`, `expire_le`)
VALUES
  ('11111111-1111-4111-8111-111111111148', '11111111-1111-4111-8111-111111111143', 'CARTE_SCOLAIRE', 'CS-6A-001', '2025-09-01 00:00:00.000', '2026-07-31 23:59:59.000');

INSERT INTO `matieres` (`id`, `etablissement_id`, `code`, `nom`, `departement_id`)
VALUES
  ('11111111-1111-4111-8111-111111111149', '11111111-1111-4111-8111-111111111111', 'MAT', 'Mathematiques', '11111111-1111-4111-8111-111111111139'),
  ('11111111-1111-4111-8111-11111111114a', '11111111-1111-4111-8111-111111111111', 'SVT', 'Sciences de la vie et de la terre', '11111111-1111-4111-8111-111111111139');

INSERT INTO `programmes` (`id`, `etablissement_id`, `annee_scolaire_id`, `niveau_scolaire_id`, `nom`)
VALUES
  ('11111111-1111-4111-8111-11111111114b', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111141', 'Programme 6eme 2025-2026');

INSERT INTO `programmes_matieres` (`id`, `programme_id`, `matiere_id`, `heures_semaine`, `coefficient`)
VALUES
  ('11111111-1111-4111-8111-11111111114c', '11111111-1111-4111-8111-11111111114b', '11111111-1111-4111-8111-111111111149', 5, 3.0),
  ('11111111-1111-4111-8111-11111111114d', '11111111-1111-4111-8111-11111111114b', '11111111-1111-4111-8111-11111111114a', 3, 2.0);

INSERT INTO `cours` (`id`, `etablissement_id`, `annee_scolaire_id`, `classe_id`, `matiere_id`, `enseignant_id`, `coefficient_override`)
VALUES
  ('11111111-1111-4111-8111-11111111114e', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-111111111149', '11111111-1111-4111-8111-111111111140', 3.0),
  ('11111111-1111-4111-8111-11111111114f', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-11111111114a', '11111111-1111-4111-8111-111111111140', 2.0);

INSERT INTO `types_evaluations` (`id`, `etablissement_id`, `nom`, `poids_defaut`)
VALUES
  ('11111111-1111-4111-8111-111111111150', '11111111-1111-4111-8111-111111111111', 'Devoir surveille', 1.0);

INSERT INTO `evaluations` (`id`, `cours_id`, `periode_id`, `type_evaluation_id`, `type`, `titre`, `date`, `note_max`, `poids`, `est_publiee`, `cree_par_enseignant_id`)
VALUES
  ('11111111-1111-4111-8111-111111111151', '11111111-1111-4111-8111-11111111114e', '11111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111150', 'DEVOIR', 'Devoir 1 Mathematiques', '2025-10-10 09:00:00.000', 20.00, 1.00, 1, '11111111-1111-4111-8111-111111111140'),
  ('11111111-1111-4111-8111-111111111152', '11111111-1111-4111-8111-11111111114f', '11111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111150', 'EXAMEN', 'Controle SVT 1', '2025-10-18 11:00:00.000', 20.00, 1.50, 1, '11111111-1111-4111-8111-111111111140');

INSERT INTO `notes` (`id`, `evaluation_id`, `eleve_id`, `score`, `commentaire`, `note_le`, `note_par`)
VALUES
  ('11111111-1111-4111-8111-111111111153', '11111111-1111-4111-8111-111111111151', '11111111-1111-4111-8111-111111111143', 16.50, 'Bon travail', '2025-10-11 10:00:00.000', '11111111-1111-4111-8111-11111111112c'),
  ('11111111-1111-4111-8111-111111111154', '11111111-1111-4111-8111-111111111151', '11111111-1111-4111-8111-111111111144', 12.00, 'Peut mieux faire', '2025-10-11 10:05:00.000', '11111111-1111-4111-8111-11111111112c'),
  ('11111111-1111-4111-8111-111111111155', '11111111-1111-4111-8111-111111111152', '11111111-1111-4111-8111-111111111143', 14.00, 'Resultat satisfaisant', '2025-10-19 15:00:00.000', '11111111-1111-4111-8111-11111111112c'),
  ('11111111-1111-4111-8111-111111111156', '11111111-1111-4111-8111-111111111152', '11111111-1111-4111-8111-111111111144', 10.50, 'Bases a consolider', '2025-10-19 15:05:00.000', '11111111-1111-4111-8111-11111111112c');

INSERT INTO `bulletins` (`id`, `eleve_id`, `periode_id`, `classe_id`, `publie_le`, `statut`)
VALUES
  ('11111111-1111-4111-8111-111111111157', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111142', '2025-11-28 08:00:00.000', 'PUBLIE'),
  ('11111111-1111-4111-8111-111111111158', '11111111-1111-4111-8111-111111111144', '11111111-1111-4111-8111-111111111116', '11111111-1111-4111-8111-111111111142', '2025-11-28 08:10:00.000', 'PUBLIE');

INSERT INTO `bulletins_lignes` (`id`, `bulletin_id`, `matiere_id`, `moyenne`, `rang`, `commentaire_enseignant`)
VALUES
  ('11111111-1111-4111-8111-111111111159', '11111111-1111-4111-8111-111111111157', '11111111-1111-4111-8111-111111111149', 16.50, 1, 'Tres bon niveau'),
  ('11111111-1111-4111-8111-11111111115a', '11111111-1111-4111-8111-111111111157', '11111111-1111-4111-8111-11111111114a', 14.00, 1, 'Eleve applique'),
  ('11111111-1111-4111-8111-11111111115b', '11111111-1111-4111-8111-111111111158', '11111111-1111-4111-8111-111111111149', 12.00, 2, 'Efforts a poursuivre'),
  ('11111111-1111-4111-8111-11111111115c', '11111111-1111-4111-8111-111111111158', '11111111-1111-4111-8111-11111111114a', 10.50, 2, 'Participation reguliere');

INSERT INTO `regles_notes` (`id`, `etablissement_id`, `scope`, `regle_json`)
VALUES
  ('11111111-1111-4111-8111-11111111115d', '11111111-1111-4111-8111-111111111111', 'global', '{"notation_sur":20,"precision":2,"arrondi":"demi-superieur"}');

INSERT INTO `creneaux_horaires` (`id`, `etablissement_id`, `nom`, `heure_debut`, `heure_fin`, `ordre`)
VALUES
  ('11111111-1111-4111-8111-11111111115e', '11111111-1111-4111-8111-111111111111', 'Creneau 1', '08:00', '09:00', 1),
  ('11111111-1111-4111-8111-11111111115f', '11111111-1111-4111-8111-111111111111', 'Creneau 2', '09:00', '10:00', 2),
  ('11111111-1111-4111-8111-111111111160', '11111111-1111-4111-8111-111111111111', 'Creneau 3', '10:15', '11:15', 3);

INSERT INTO `emploi_du_temps` (`id`, `classe_id`, `cours_id`, `matiere_id`, `enseignant_id`, `salle_id`, `jour_semaine`, `creneau_horaire_id`, `effectif_du`, `effectif_au`)
VALUES
  ('11111111-1111-4111-8111-111111111161', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-11111111114e', '11111111-1111-4111-8111-111111111149', '11111111-1111-4111-8111-111111111140', '11111111-1111-4111-8111-111111111113', 1, '11111111-1111-4111-8111-11111111115e', '2025-09-01 00:00:00.000', '2026-07-31 23:59:59.000'),
  ('11111111-1111-4111-8111-111111111162', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-11111111114f', '11111111-1111-4111-8111-11111111114a', '11111111-1111-4111-8111-111111111140', '11111111-1111-4111-8111-111111111114', 2, '11111111-1111-4111-8111-11111111115f', '2025-09-01 00:00:00.000', '2026-07-31 23:59:59.000'),
  ('11111111-1111-4111-8111-111111111163', '11111111-1111-4111-8111-111111111142', '11111111-1111-4111-8111-11111111114e', '11111111-1111-4111-8111-111111111149', '11111111-1111-4111-8111-111111111140', '11111111-1111-4111-8111-111111111113', 3, '11111111-1111-4111-8111-111111111160', '2025-09-01 00:00:00.000', '2026-07-31 23:59:59.000');

INSERT INTO `evenements_calendrier` (`id`, `etablissement_id`, `site_id`, `titre`, `debut`, `fin`, `type`, `description`)
VALUES
  ('11111111-1111-4111-8111-111111111164', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111112', 'Journee portes ouvertes', '2025-10-25 08:00:00.000', '2025-10-25 15:00:00.000', 'EVENEMENT', 'Presentation des filieres et rencontre avec les familles');

INSERT INTO `sessions_appel` (`id`, `classe_id`, `date`, `creneau_horaire_id`, `pris_par_enseignant_id`, `pris_le`)
VALUES
  ('11111111-1111-4111-8111-111111111165', '11111111-1111-4111-8111-111111111142', '2025-10-21 08:00:00.000', '11111111-1111-4111-8111-11111111115e', '11111111-1111-4111-8111-111111111140', '2025-10-21 08:05:00.000');

INSERT INTO `presences_eleves` (`id`, `session_appel_id`, `eleve_id`, `statut`, `minutes_retard`, `note`)
VALUES
  ('11111111-1111-4111-8111-111111111166', '11111111-1111-4111-8111-111111111165', '11111111-1111-4111-8111-111111111143', 'PRESENT', NULL, NULL),
  ('11111111-1111-4111-8111-111111111167', '11111111-1111-4111-8111-111111111165', '11111111-1111-4111-8111-111111111144', 'RETARD', 12, 'Arrive apres la sonnerie');

INSERT INTO `motifs_absence` (`id`, `etablissement_id`, `nom`, `est_excuse_par_defaut`)
VALUES
  ('11111111-1111-4111-8111-111111111168', '11111111-1111-4111-8111-111111111111', 'Maladie', 1);

INSERT INTO `justificatifs_absence` (`id`, `eleve_id`, `date_debut`, `date_fin`, `motif_absence_id`, `document_url`, `approuve_par`, `approuve_le`, `statut`)
VALUES
  ('11111111-1111-4111-8111-111111111169', '11111111-1111-4111-8111-111111111143', '2025-10-05 00:00:00.000', '2025-10-06 23:59:59.000', '11111111-1111-4111-8111-111111111168', 'https://demo.local/documents/justif-maladie.pdf', '11111111-1111-4111-8111-11111111112b', '2025-10-07 09:00:00.000', 'APPROUVE');

INSERT INTO `presences_personnel` (`id`, `personnel_id`, `date`, `statut`, `note`)
VALUES
  ('11111111-1111-4111-8111-11111111116a', '11111111-1111-4111-8111-11111111113d', '2025-10-21 00:00:00.000', 'PRESENT', 'Cours assures'),
  ('11111111-1111-4111-8111-11111111116b', '11111111-1111-4111-8111-11111111113f', '2025-10-21 00:00:00.000', 'PRESENT', 'Ronde du matin effectuee');

INSERT INTO `lignes_transport` (`id`, `etablissement_id`, `nom`, `infos_vehicule_json`)
VALUES
  ('11111111-1111-4111-8111-11111111116c', '11111111-1111-4111-8111-111111111111', 'Ligne Nord', '{"vehicule":"Minibus 18 places","immatriculation":"1234 TAA"}');

INSERT INTO `arrets_transport` (`id`, `ligne_transport_id`, `nom`, `geo_json`, `ordre`)
VALUES
  ('11111111-1111-4111-8111-11111111116d', '11111111-1111-4111-8111-11111111116c', 'Anosy', '{"lat":-18.914,"lng":47.536}', 1),
  ('11111111-1111-4111-8111-11111111116e', '11111111-1111-4111-8111-11111111116c', 'Analakely', '{"lat":-18.909,"lng":47.529}', 2);

INSERT INTO `abonnements_transport` (`id`, `eleve_id`, `annee_scolaire_id`, `ligne_transport_id`, `arret_transport_id`, `statut`)
VALUES
  ('11111111-1111-4111-8111-11111111116f', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-11111111116c', '11111111-1111-4111-8111-11111111116e', 'ACTIF');

INSERT INTO `formules_cantine` (`id`, `etablissement_id`, `nom`, `prix`, `periodicite`)
VALUES
  ('11111111-1111-4111-8111-111111111170', '11111111-1111-4111-8111-111111111111', 'Cantine standard', 4500.00, 'daily');

INSERT INTO `abonnements_cantine` (`id`, `eleve_id`, `annee_scolaire_id`, `formule_cantine_id`, `statut`)
VALUES
  ('11111111-1111-4111-8111-111111111171', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111115', '11111111-1111-4111-8111-111111111170', 'ACTIF');

INSERT INTO `catalogue_frais` (`id`, `etablissement_id`, `nom`, `description`, `montant`, `devise`, `est_recurrent`, `periodicite`)
VALUES
  ('11111111-1111-4111-8111-111111111172', '11111111-1111-4111-8111-111111111111', 'Frais de scolarite', 'Frais principaux de l annee', 150000.00, 'MGA', 0, NULL),
  ('11111111-1111-4111-8111-111111111173', '11111111-1111-4111-8111-111111111111', 'Transport scolaire', 'Abonnement annuel transport', 80000.00, 'MGA', 0, NULL);

INSERT INTO `factures` (`id`, `etablissement_id`, `eleve_id`, `annee_scolaire_id`, `numero_facture`, `date_emission`, `date_echeance`, `statut`, `total_montant`, `devise`)
VALUES
  ('11111111-1111-4111-8111-111111111174', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111115', 'FAC-2025-0001', '2025-09-05 08:00:00.000', '2025-09-30 23:59:59.000', 'PARTIELLE', 230000.00, 'MGA');

INSERT INTO `factures_lignes` (`id`, `facture_id`, `catalogue_frais_id`, `libelle`, `quantite`, `prix_unitaire`, `montant`)
VALUES
  ('11111111-1111-4111-8111-111111111175', '11111111-1111-4111-8111-111111111174', '11111111-1111-4111-8111-111111111172', 'Frais de scolarite', 1, 150000.00, 150000.00),
  ('11111111-1111-4111-8111-111111111176', '11111111-1111-4111-8111-111111111174', '11111111-1111-4111-8111-111111111173', 'Transport scolaire', 1, 80000.00, 80000.00);

INSERT INTO `paiements` (`id`, `facture_id`, `paye_le`, `montant`, `methode`, `reference`, `recu_par`)
VALUES
  ('11111111-1111-4111-8111-111111111177', '11111111-1111-4111-8111-111111111174', '2025-09-10 10:00:00.000', 100000.00, 'cash', 'PAIEMENT-DEMO-001', '11111111-1111-4111-8111-11111111112d');

INSERT INTO `plans_paiement_eleves` (`id`, `eleve_id`, `annee_scolaire_id`, `plan_json`)
VALUES
  ('11111111-1111-4111-8111-111111111178', '11111111-1111-4111-8111-111111111143', '11111111-1111-4111-8111-111111111115', '{"echeances":[{"date":"2025-09-30","montant":100000},{"date":"2025-11-30","montant":130000}]}');

-- Normalisation des colonnes updated_at pour les imports SQL manuels hors Prisma
UPDATE `etablissements` SET `updated_at` = `created_at`;
UPDATE `sites` SET `updated_at` = `created_at`;
UPDATE `salles` SET `updated_at` = `created_at`;
UPDATE `annees_scolaires` SET `updated_at` = `created_at`;
UPDATE `periodes` SET `updated_at` = `created_at`;
UPDATE `roles` SET `updated_at` = `created_at`;
UPDATE `permissions` SET `updated_at` = `created_at`;
UPDATE `utilisateurs` SET `updated_at` = `created_at`;
UPDATE `profils` SET `updated_at` = `created_at`;
UPDATE `departements` SET `updated_at` = `created_at`;
UPDATE `personnel` SET `updated_at` = `created_at`;
UPDATE `enseignants` SET `updated_at` = `created_at`;
UPDATE `niveaux_scolaires` SET `updated_at` = `created_at`;
UPDATE `classes` SET `updated_at` = `created_at`;
UPDATE `eleves` SET `updated_at` = `created_at`;
UPDATE `parents_tuteurs` SET `updated_at` = `created_at`;
UPDATE `inscriptions` SET `updated_at` = `created_at`;
UPDATE `identifiants_eleves` SET `updated_at` = `created_at`;
UPDATE `matieres` SET `updated_at` = `created_at`;
UPDATE `programmes` SET `updated_at` = `created_at`;
UPDATE `programmes_matieres` SET `updated_at` = `created_at`;
UPDATE `cours` SET `updated_at` = `created_at`;
UPDATE `types_evaluations` SET `updated_at` = `created_at`;
UPDATE `evaluations` SET `updated_at` = `created_at`;
UPDATE `notes` SET `updated_at` = `created_at`;
UPDATE `bulletins` SET `updated_at` = `created_at`;
UPDATE `bulletins_lignes` SET `updated_at` = `created_at`;
UPDATE `regles_notes` SET `updated_at` = `created_at`;
UPDATE `creneaux_horaires` SET `updated_at` = `created_at`;
UPDATE `emploi_du_temps` SET `updated_at` = `created_at`;
UPDATE `evenements_calendrier` SET `updated_at` = `created_at`;
UPDATE `sessions_appel` SET `updated_at` = `created_at`;
UPDATE `presences_eleves` SET `updated_at` = `created_at`;
UPDATE `motifs_absence` SET `updated_at` = `created_at`;
UPDATE `justificatifs_absence` SET `updated_at` = `created_at`;
UPDATE `presences_personnel` SET `updated_at` = `created_at`;
UPDATE `lignes_transport` SET `updated_at` = `created_at`;
UPDATE `arrets_transport` SET `updated_at` = `created_at`;
UPDATE `abonnements_transport` SET `updated_at` = `created_at`;
UPDATE `formules_cantine` SET `updated_at` = `created_at`;
UPDATE `abonnements_cantine` SET `updated_at` = `created_at`;
UPDATE `catalogue_frais` SET `updated_at` = `created_at`;
UPDATE `factures` SET `updated_at` = `created_at`;
UPDATE `factures_lignes` SET `updated_at` = `created_at`;
UPDATE `paiements` SET `updated_at` = `created_at`;
UPDATE `plans_paiement_eleves` SET `updated_at` = `created_at`;

COMMIT;
