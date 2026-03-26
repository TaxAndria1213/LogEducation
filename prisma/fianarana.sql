SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;


INSERT INTO `annees_scolaires` (`id`, `etablissement_id`, `nom`, `date_debut`, `date_fin`, `est_active`, `created_at`, `updated_at`) VALUES
('3c11bac0-5c38-431c-beee-6ab4c5456cc9', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '2025-2026', '2025-10-12 21:00:00.000', '2026-07-17 20:59:59.999', 1, '2026-03-24 14:26:25.061', '2026-03-24 14:26:25.061'),
('fec54b15-565c-463c-8b4e-1c9c8b3d8519', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '2026-2027', '2026-10-06 00:00:00.000', '2027-08-07 00:00:00.000', 0, '2026-02-28 09:30:33.247', '2026-03-24 14:25:10.899');

INSERT INTO `catalogue_frais` (`id`, `etablissement_id`, `nom`, `description`, `montant`, `devise`, `est_recurrent`, `periodicite`, `created_at`, `updated_at`, `niveau_scolaire_id`) VALUES
('46e85574-27a4-4d79-ab12-0ec5fbdc1a46', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'Droit d\'inscription', 'Droit d\'inscription pour les 6ème', 120000.00, 'MGA', 0, NULL, '2026-03-24 14:32:50.104', '2026-03-24 14:32:50.104', '32b9bbad-1efa-403c-9bf7-dc8160a1218b'),
('680ad484-d5a9-457f-8fd4-16b4b716d4cc', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'Frais de scolarité - 6ème', 'Frais de scolarité pour les 6ème', 1200000.00, 'MGA', 0, NULL, '2026-03-24 14:33:17.803', '2026-03-24 14:33:17.803', '32b9bbad-1efa-403c-9bf7-dc8160a1218b');

INSERT INTO `classes` (`id`, `etablissement_id`, `annee_scolaire_id`, `niveau_scolaire_id`, `site_id`, `nom`, `enseignant_principal_id`, `created_at`, `updated_at`) VALUES
('a52e64fe-8d26-4e13-97ad-190323027d9e', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '32b9bbad-1efa-403c-9bf7-dc8160a1218b', '04d9adc2-086e-484d-a33b-c6bf91cd00b3', '6ème A', NULL, '2026-03-24 14:30:24.617', '2026-03-24 14:30:24.617');

INSERT INTO `echeances_paiement` (`id`, `plan_paiement_id`, `facture_id`, `eleve_id`, `annee_scolaire_id`, `ordre`, `libelle`, `date_echeance`, `montant_prevu`, `montant_regle`, `montant_restant`, `statut`, `devise`, `notes`, `created_at`, `updated_at`) VALUES
('1188144f-c1b3-4a6c-a9b1-f897e03afe52', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 7, 'Tranche 7', '2026-09-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 7', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.951'),
('2a206325-c11f-43a3-989c-18e41c32365d', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 3, 'Tranche 3', '2026-05-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 3', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.934'),
('3c82cb94-0770-4e51-b044-317762a3409e', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 5, 'Tranche 5', '2026-07-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 5', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.946'),
('435083e0-327c-49fc-8b29-fefbcb06cec4', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 10, 'Tranche 10', '2026-12-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 10', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.967'),
('7aba88b5-d444-4117-86ea-0f56f70b8019', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 1, 'Tranche 1', '2026-03-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'PAYEE', 'MGA', 'Tranche 1', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.927'),
('7dbd07aa-7cdb-458f-9fb9-6d5932c304dc', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 8, 'Tranche 8', '2026-10-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 8', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.960'),
('a979c9f5-f625-4a51-9885-4037c81f817a', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 4, 'Tranche 4', '2026-06-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 4', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.943'),
('b860b28e-be49-4cf3-a5fa-ffd6a283146f', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 2, 'Tranche 2', '2026-04-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 2', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.931'),
('bd72fd6a-6c49-4c33-9c80-452c122fa781', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 6, 'Tranche 6', '2026-08-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 6', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.948'),
('e3806b6b-4f45-4e2c-ac57-284e2ff86d9c', 'f2d79542-c6b9-4f32-a876-57bc2c49baea', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 9, 'Tranche 9', '2026-11-24 00:00:00.000', 132000.00, 0.00, 132000.00, 'A_VENIR', 'MGA', 'Tranche 9', '2026-03-24 14:35:13.558', '2026-03-24 15:31:31.963');

INSERT INTO `eleves` (`id`, `etablissement_id`, `code_eleve`, `utilisateur_id`, `statut`, `date_entree`, `created_at`, `updated_at`) VALUES
('efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'E20250001', '5ff38650-1d1f-4b7b-bd83-e4a4833a604c', 'ACTIF', '2026-03-24 00:00:00.000', '2026-03-24 14:35:13.223', '2026-03-24 14:35:13.223');

INSERT INTO `eleves_parents_tuteurs` (`eleve_id`, `parent_tuteur_id`, `relation`, `est_principal`, `autorise_recuperation`) VALUES
('efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '824a7382-1390-4a9e-82e0-a9db7ed6d2d6', 'Pere', 1, 1);

INSERT INTO `etablissements` (`id`, `nom`, `code`, `fuseau_horaire`, `parametres_json`, `created_at`, `updated_at`) VALUES
('110302f3-8067-4f93-af6a-aaf19011f8d4', 'Arcade', 'ET2026014', 'Indian/Antananarivo', 'null', '2026-02-16 10:28:39.828', '2026-02-16 10:28:39.828'),
('13a052e8-6c68-4afc-89d1-09449d33c1fd', 'LMA', 'ET2026006', 'Indian/Antananarivo', 'null', '2026-02-12 12:14:33.247', '2026-02-12 12:14:33.247'),
('32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'Leader', 'ET2026023', 'Indian/Antananarivo', NULL, '2026-02-24 12:11:40.867', '2026-02-24 12:11:40.867'),
('55ef447c-258b-467a-ac74-29e5f28b5301', 'test', 'ET2026025', 'Indian/Antananarivo', NULL, '2026-02-27 16:59:59.146', '2026-02-27 16:59:59.146'),
('6895c1a6-2133-4114-86b9-3725705d4739', 'test', 'ET2026022', 'Indian/Antananarivo', NULL, '2026-02-24 08:21:23.295', '2026-02-24 08:21:23.295'),
('689a540a-05d6-4777-9bab-2302b2fd7c16', 'Tafita', 'ET2026013', 'Indian/Antananarivo', 'null', '2026-02-16 10:28:30.338', '2026-02-16 10:28:30.338'),
('69f80586-5995-488b-956e-699b61f7120e', 'Saint Joseph', 'ET2026016', 'Indian/Antananarivo', 'null', '2026-02-16 13:43:54.889', '2026-02-16 13:43:54.889'),
('80ffca5d-f0ba-444a-896e-9cf869b68169', 'arcenciel', 'ET2026015', 'Indian/Antananarivo', 'null', '2026-02-16 10:28:49.423', '2026-02-16 10:28:49.423'),
('8c42c459-09f0-4fb0-a27d-86da4f1637bd', 'esperence', 'ET2026024', 'Indian/Antananarivo', NULL, '2026-02-24 12:30:06.387', '2026-02-24 12:30:06.387'),
('92e325d4-1761-485c-82d5-775def91bad0', 'Manda', 'ET2026020', 'Indian/Antananarivo', 'null', '2026-02-16 15:07:15.681', '2026-02-16 15:07:15.681'),
('b615c296-ec86-4b9c-98b1-b56ad6cf28fe', 'Lycée Privée Moderne d\'Ambohibao (LPMA)', 'ET2026004', 'Indian/Antananarivo', 'null', '2026-02-12 11:48:19.328', '2026-02-12 11:48:19.328'),
('b79c8e8d-874c-4dbe-a852-699038034bd3', 'Prime vert', 'ET2026018', 'Indian/Antananarivo', 'null', '2026-02-16 13:58:38.382', '2026-02-16 13:58:38.382'),
('bba6aad5-1107-44ed-b047-c97e82ece666', 'Sully', 'ET2026002', 'Indian/Antananarivo', 'null', '2026-02-12 11:23:39.596', '2026-02-12 11:23:39.596'),
('d0aaa2d5-766b-469c-86e1-bf2842cd7202', 'Saint Michel', 'ET2026019', 'Indian/Antananarivo', 'null', '2026-02-16 14:08:26.730', '2026-02-16 14:08:26.730'),
('f6bddcd2-01df-4bf9-9278-56d68f5b67bc', 'Manolontsoa', 'ET2026012', 'Indian/Antananarivo', 'null', '2026-02-16 10:28:23.181', '2026-02-16 10:28:23.181');

INSERT INTO `factures` (`id`, `etablissement_id`, `eleve_id`, `annee_scolaire_id`, `numero_facture`, `date_emission`, `date_echeance`, `statut`, `total_montant`, `devise`, `created_at`, `updated_at`, `remise_id`, `facture_origine_id`, `nature`) VALUES
('fed0c518-b1ad-42ff-aca7-3cf706087fda', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', 'FAC-2026-0001', '2026-03-24 00:00:00.000', '2026-03-24 00:00:00.000', 'EN_RETARD', 1320000.00, 'MGA', '2026-03-24 14:35:13.426', '2026-03-24 15:31:31.992', NULL, NULL, 'FACTURE');

INSERT INTO `factures_lignes` (`id`, `facture_id`, `catalogue_frais_id`, `libelle`, `quantite`, `prix_unitaire`, `montant`, `created_at`, `updated_at`) VALUES
('2ce4acd8-efea-4d73-ad9f-f37ac6fedf9d', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', '46e85574-27a4-4d79-ab12-0ec5fbdc1a46', 'Droit d\'inscription', 1, 120000.00, 120000.00, '2026-03-24 14:35:13.449', '2026-03-24 14:35:13.449'),
('91088261-ab2b-4eb8-b250-a55a7fc9ef4a', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', '680ad484-d5a9-457f-8fd4-16b4b716d4cc', 'Frais de scolarité - 6ème', 1, 1200000.00, 1200000.00, '2026-03-24 14:35:13.449', '2026-03-24 14:35:13.449');

INSERT INTO `inscriptions` (`id`, `eleve_id`, `classe_id`, `annee_scolaire_id`, `date_inscription`, `statut`, `date_sortie`, `raison_sortie`, `created_at`, `updated_at`) VALUES
('aa28e355-5536-4d41-ab1c-be0fa36ce94b', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', 'a52e64fe-8d26-4e13-97ad-190323027d9e', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '2026-03-24 00:00:00.000', 'INSCRIT', NULL, NULL, '2026-03-24 14:35:13.418', '2026-03-24 14:35:13.418');

INSERT INTO `niveaux_scolaires` (`id`, `etablissement_id`, `nom`, `ordre`, `created_at`, `updated_at`) VALUES
('32b9bbad-1efa-403c-9bf7-dc8160a1218b', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '6ème', 1, '2026-03-24 14:29:51.500', '2026-03-24 14:29:51.500');

INSERT INTO `operations_financieres` (`id`, `etablissement_id`, `facture_id`, `paiement_id`, `cree_par_utilisateur_id`, `type`, `montant`, `motif`, `details_json`, `created_at`, `updated_at`) VALUES
('f20daa8a-bbfe-489f-bc19-919e292b626c', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', '5d5abe1d-9a32-49d0-8ea4-009bec61b164', '91473318-9ec1-4da8-9d24-9f4e9b3ebf82', 'REMBOURSEMENT_PAIEMENT', 132000.00, NULL, '{\"reference\":null,\"methode\":\"cash\",\"paye_le\":\"2026-03-24T00:00:00.000Z\"}', '2026-03-24 15:31:31.861', '2026-03-24 15:31:31.861');

INSERT INTO `paiements` (`id`, `facture_id`, `paye_le`, `montant`, `methode`, `reference`, `recu_par`, `created_at`, `updated_at`, `statut`) VALUES
('5d5abe1d-9a32-49d0-8ea4-009bec61b164', 'fed0c518-b1ad-42ff-aca7-3cf706087fda', '2026-03-24 00:00:00.000', 132000.00, 'cash', NULL, '91473318-9ec1-4da8-9d24-9f4e9b3ebf82', '2026-03-24 14:41:29.663', '2026-03-24 15:31:31.851', 'REMBOURSE');

INSERT INTO `paiements_echeances_affectations` (`id`, `paiement_id`, `echeance_paiement_id`, `montant`, `created_at`, `updated_at`) VALUES
('c8f00fc5-22d5-4e96-b10d-6228af8ac0d6', '5d5abe1d-9a32-49d0-8ea4-009bec61b164', '7aba88b5-d444-4117-86ea-0f56f70b8019', 132000.00, '2026-03-24 14:41:29.690', '2026-03-24 14:41:29.690');

INSERT INTO `parents_tuteurs` (`id`, `etablissement_id`, `utilisateur_id`, `nom_complet`, `telephone`, `email`, `adresse`, `created_at`, `updated_at`) VALUES
('824a7382-1390-4a9e-82e0-a9db7ed6d2d6', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '507c3657-0b26-46b7-9046-69eb38e55eb9', 'Kaleba ANDRIAMANDIMBINIAINA', '0346422107', 'kaleba.andriamandimbiniaina@gmail.com', 'AKM II 065 Alakamisy Fenoarivo', '2026-03-24 14:35:13.354', '2026-03-24 14:35:13.354');

INSERT INTO `periodes` (`id`, `annee_scolaire_id`, `nom`, `date_debut`, `date_fin`, `ordre`, `created_at`, `updated_at`) VALUES
('431b8416-66d4-4973-8ee2-18f161c5ba6c', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '2ème trimestre', '2027-01-05 00:00:00.000', '2027-03-27 00:00:00.000', 2, '2026-03-02 07:10:15.707', '2026-03-02 07:10:15.707'),
('444e9ab9-a03d-4868-a2a0-06bc2d6bc89e', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '3ème trimestre', '2026-04-12 21:00:00.000', '2026-07-17 20:59:59.999', NULL, '2026-03-24 14:29:06.693', '2026-03-24 14:29:06.693'),
('55000af8-4260-4708-820b-8f29bc9c918a', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '1ère trimestre', '2025-10-12 21:00:00.000', '2025-12-19 20:59:59.999', NULL, '2026-03-24 14:28:02.049', '2026-03-24 14:28:02.049'),
('91051ce5-abb9-449c-a2b6-870c989b5b70', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '1ère trimestre', '2026-10-06 00:00:00.000', '2026-12-19 00:00:00.000', 1, '2026-02-28 12:06:03.592', '2026-02-28 12:06:03.592'),
('967abe18-ebec-4e42-8c86-98b8f279e621', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '2ème trimestre', '2026-01-04 21:00:00.000', '2026-03-27 20:59:59.999', NULL, '2026-03-24 14:28:34.263', '2026-03-24 14:28:34.263'),
('c0745996-4f33-4875-a50b-ded89d886b23', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '3ème trimestre', '2027-04-12 00:00:00.000', '2027-07-30 00:00:00.000', 3, '2026-03-02 07:11:21.881', '2026-03-02 07:11:21.881');

INSERT INTO `plans_paiement_eleves` (`id`, `eleve_id`, `annee_scolaire_id`, `plan_json`, `created_at`, `updated_at`, `remise_id`) VALUES
('f2d79542-c6b9-4f32-a876-57bc2c49baea', 'efbef71a-a8df-4150-9cff-6f6e2ee91c9b', '3c11bac0-5c38-431c-beee-6ab4c5456cc9', '{\"mode_paiement\":\"ECHELONNE\",\"nombre_tranches\":10,\"devise\":\"MGA\",\"notes\":null,\"echeances\":[{\"ordre\":1,\"date\":\"2026-03-24\",\"montant\":132000,\"statut\":\"PAYEE\",\"note\":\"Tranche 1\",\"libelle\":\"Tranche 1\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"7aba88b5-d444-4117-86ea-0f56f70b8019\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":2,\"date\":\"2026-04-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 2\",\"libelle\":\"Tranche 2\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"b860b28e-be49-4cf3-a5fa-ffd6a283146f\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":3,\"date\":\"2026-05-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 3\",\"libelle\":\"Tranche 3\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"2a206325-c11f-43a3-989c-18e41c32365d\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":4,\"date\":\"2026-06-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 4\",\"libelle\":\"Tranche 4\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"a979c9f5-f625-4a51-9885-4037c81f817a\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":5,\"date\":\"2026-07-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 5\",\"libelle\":\"Tranche 5\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"3c82cb94-0770-4e51-b044-317762a3409e\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":6,\"date\":\"2026-08-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 6\",\"libelle\":\"Tranche 6\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"bd72fd6a-6c49-4c33-9c80-452c122fa781\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":7,\"date\":\"2026-09-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 7\",\"libelle\":\"Tranche 7\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"1188144f-c1b3-4a6c-a9b1-f897e03afe52\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":8,\"date\":\"2026-10-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 8\",\"libelle\":\"Tranche 8\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"7dbd07aa-7cdb-458f-9fb9-6d5932c304dc\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":9,\"date\":\"2026-11-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 9\",\"libelle\":\"Tranche 9\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"e3806b6b-4f45-4e2c-ac57-284e2ff86d9c\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"},{\"ordre\":10,\"date\":\"2026-12-24\",\"montant\":132000,\"statut\":\"A_VENIR\",\"note\":\"Tranche 10\",\"libelle\":\"Tranche 10\",\"paid_amount\":0,\"remaining_amount\":132000,\"devise\":\"MGA\",\"echeance_paiement_id\":\"435083e0-327c-49fc-8b29-fefbcb06cec4\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\"}],\"services\":{\"transport_active\":false,\"ligne_transport_id\":null,\"arret_transport_id\":null,\"cantine_active\":false,\"formule_cantine_id\":null},\"finance\":{\"catalogue_frais_inscription_id\":\"46e85574-27a4-4d79-ab12-0ec5fbdc1a46\",\"catalogue_frais_scolarite_id\":\"680ad484-d5a9-457f-8fd4-16b4b716d4cc\",\"catalogue_frais_transport_id\":null,\"catalogue_frais_cantine_id\":null,\"remise_id\":null,\"remise_nom\":null,\"frais_inscription\":120000,\"frais_scolarite\":1200000,\"frais_transport\":0,\"frais_cantine\":0,\"remise_type\":\"AUCUNE\",\"remise_valeur\":0,\"remise_montant\":0,\"total_brut\":1320000,\"total_net\":1320000,\"devise\":\"MGA\"},\"metadata\":{\"cree_depuis_inscription\":true,\"inscription_id\":\"aa28e355-5536-4d41-ab1c-be0fa36ce94b\",\"facture_id\":\"fed0c518-b1ad-42ff-aca7-3cf706087fda\",\"paiement_initial_id\":null},\"resume_financier\":{\"montant_planifie\":1320000,\"montant_regle\":0,\"montant_restant\":1320000,\"updated_at\":\"2026-03-24T15:31:31.979Z\"}}', '2026-03-24 14:35:13.455', '2026-03-24 15:31:31.981', NULL);

INSERT INTO `profils` (`id`, `utilisateur_id`, `prenom`, `nom`, `date_naissance`, `genre`, `photo_url`, `adresse`, `contact_urgence_json`, `created_at`, `updated_at`) VALUES
('', '91473318-9ec1-4da8-9d24-9f4e9b3ebf82', 'Koloina', 'RAOBELISON', NULL, 'Femme', '', 'AKM II 065 Alakamisy Fenoarivo', '{}', '2026-02-24 12:11:40.941', '2026-02-24 12:11:40.941'),
('2afcf531-8548-4457-b5ae-e1776297e768', '5ff38650-1d1f-4b7b-bd83-e4a4833a604c', 'Aina', 'Rakoto', '2018-06-17 00:00:00.000', 'Homme', NULL, NULL, 'null', '2026-03-24 14:35:13.209', '2026-03-24 14:35:13.209'),
('73bd0f5d-1d48-4d62-9914-d0811117a4f5', '507c3657-0b26-46b7-9046-69eb38e55eb9', 'Kaleba', 'ANDRIAMANDIMBINIAINA', NULL, NULL, NULL, 'AKM II 065 Alakamisy Fenoarivo', 'null', '2026-03-24 14:35:13.345', '2026-03-24 14:35:13.345');

INSERT INTO `referenciel` (`id`, `titre`, `code`) VALUES
('163e84c2-f200-4cc8-b3e5-4f6f1a109f58', 'Types d\'identifiant eleve', 'IDENTIFIANT_ELEVE_TYPE'),
('2de99ffa-8fe8-4426-99ed-1935633428bd', 'Statuts du personnel', 'PERSONNEL_STATUT'),
('30376c0f-1b65-4429-a476-5c3adcf89abb', 'Types de sanctions disciplinaires', 'DISCIPLINE_SANCTION_TYPE'),
('3a3334eb-40cd-4c31-8b5b-176a26381a59', 'Genres', 'PROFILE_GENRE'),
('3f101368-5a37-432d-a1a2-c2254682e93c', 'Devises financieres', 'FINANCE_DEVISE'),
('5c7f55be-db9a-4caf-97f4-5ddc26f4c909', 'Types d\'evenement calendrier', 'EVENEMENT_TYPE'),
('5e3bb0b4-35c3-4e73-952f-25fb3ab12692', 'Statuts de presence du personnel', 'PRESENCE_PERSONNEL_STATUT'),
('67248fbe-5777-45d7-9cac-5c7d22f53bb0', 'Types de salle', 'SALLE_TYPE'),
('67f562ab-0125-42f5-b003-5534ca81f47b', 'Types d\'evenement calendrier', 'EVENEMENT_TYPE'),
('6cd3d947-f3ce-41cf-aea9-13b4a11c0bbc', 'Devises financieres', 'FINANCE_DEVISE'),
('73986913-5aa8-458b-a09f-24b981eaa181', 'Motifs de recompense', 'DISCIPLINE_RECOMPENSE_RAISON'),
('78cce9ea-b518-499a-b890-7b5b605ac62e', 'Postes du personnel', 'PERSONNEL_POSTE'),
('7cd7cc94-8131-432b-99c5-8bc75d69ec84', 'Liens avec l\'eleve', 'SCOLARITE_RELATION'),
('81397164-40e5-4c97-a243-6833406e126f', 'Motifs de recompense', 'DISCIPLINE_RECOMPENSE_RAISON'),
('8a8cbfc2-0408-4ef4-886a-da979bf5a7c9', 'Postes du personnel', 'PERSONNEL_POSTE'),
('8bb23497-4d8d-49b5-88b3-8bd32c1254b8', 'Types d\'identifiant eleve', 'IDENTIFIANT_ELEVE_TYPE'),
('8f360e18-a227-4cc5-a667-b0c6113b7f87', 'Statuts des incidents disciplinaires', 'DISCIPLINE_INCIDENT_STATUT'),
('916a27fd-1ae8-4d06-8132-737cbb2c95cf', 'Types de salle', 'SALLE_TYPE'),
('9c7f27bd-044c-4af0-a38f-78b2a9ea7c5f', 'Statuts du personnel', 'PERSONNEL_STATUT'),
('9d1ef749-17b0-4631-b747-1d4db1c676bc', 'Genres', 'PROFILE_GENRE'),
('cca2030d-604a-4f60-9bd9-31a5589107a4', 'Types de sanctions disciplinaires', 'DISCIPLINE_SANCTION_TYPE'),
('ed3fb550-5e31-4c13-89a2-9bec4e95eec5', 'Statuts des incidents disciplinaires', 'DISCIPLINE_INCIDENT_STATUT'),
('f5bf1110-dee7-4fbb-94b4-189142666e9f', 'Statuts de presence du personnel', 'PRESENCE_PERSONNEL_STATUT'),
('fc6c8dcc-3cef-42d8-8b7d-4a51d07ed3af', 'Liens avec l\'eleve', 'SCOLARITE_RELATION');

INSERT INTO `roles` (`id`, `etablissement_id`, `nom`, `created_at`, `updated_at`, `scope_json`) VALUES
('36e91a8a-aa53-4eff-901a-fc865403f7cb', '55ef447c-258b-467a-ac74-29e5f28b5301', 'DIRECTION', '2026-02-27 16:59:59.641', '2026-02-27 16:59:59.641', NULL),
('69f61e12-eba4-46cc-ad56-cc10a60a8080', '8c42c459-09f0-4fb0-a27d-86da4f1637bd', 'DIRECTION', '2026-02-24 12:30:06.543', '2026-02-24 12:30:06.543', NULL),
('8f9c81ea-e71d-4c8f-b12f-9035ad772e1f', NULL, 'ADMIN', '2026-02-10 07:37:46.586', '2026-02-10 07:37:46.586', NULL),
('c35a8d91-3f0a-4296-907a-9fa235051983', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'DIRECTION', '2026-02-24 12:11:40.976', '2026-02-24 12:11:40.976', NULL);

INSERT INTO `salles` (`id`, `site_id`, `nom`, `capacite`, `type`, `created_at`, `updated_at`) VALUES
('364eeb17-44b2-473d-b6db-993cc35bc004', '04d9adc2-086e-484d-a33b-c6bf91cd00b3', 'A001', 50, 'Salle', '2026-02-28 08:05:43.524', '2026-02-28 08:05:43.524'),
('8b0050f8-ad1b-4bb9-aeb7-3fc147c35b5f', '04d9adc2-086e-484d-a33b-c6bf91cd00b3', 'A002', 45, 'Salle', '2026-02-28 08:22:12.664', '2026-02-28 08:22:12.664');

INSERT INTO `sites` (`id`, `etablissement_id`, `nom`, `adresse`, `telephone`, `created_at`, `updated_at`) VALUES
('04d9adc2-086e-484d-a33b-c6bf91cd00b3', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B1', '21BIS Androndra', '0344587412', '2026-02-27 14:06:17.841', '2026-02-27 14:06:17.841'),
('267e46d8-d484-435a-889b-b2cd6b5f5f67', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B3', '150IV Alasora', '0384512510', '2026-02-27 14:54:58.479', '2026-02-27 14:54:58.479'),
('2fb15578-5ac1-43e8-88ae-16ed697ffc72', '69f80586-5995-488b-956e-699b61f7120e', 'B1', 'AKM II 065 Alakamisy Fenoarivo', '0346422107', '2026-02-19 09:27:24.276', '2026-02-19 09:27:24.276'),
('58bc8774-cc5e-481b-a5cc-66e2592edf1b', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B2', '145F Analamahitsy', '0344875216', '2026-02-27 14:53:57.396', '2026-02-27 14:53:57.396'),
('9d74ed2c-f093-4b1d-94c7-3b5abdab8c47', 'bba6aad5-1107-44ed-b047-c97e82ece666', 'test', 'AKM II 065 Alakamisy Fenoarivo', '0346422107', '2026-02-19 06:21:34.219', '2026-02-19 06:21:34.219');

INSERT INTO `utilisateurs` (`id`, `etablissement_id`, `email`, `telephone`, `mot_de_passe_hash`, `statut`, `dernier_login`, `scope_json`, `created_at`, `updated_at`) VALUES
('24072a98-cca4-473e-b2ea-668d5ee3acde', NULL, 'loharano@gmail.com', '0381019254', '$2b$10$t/x/2A8Dglvuj3obl4VakeuqtTzg1KYZcg6c4NBJ8O2uLwaA6Spr2', 'INACTIF', NULL, '\"{\\\"option\\\":\\\"En attente de validation\\\",\\\"data\\\":{\\\"etablissement\\\":{\\\"nom\\\":\\\"Loharano\\\"},\\\"utilisateur\\\":{\\\"email\\\":\\\"loharano@gmail.com\\\",\\\"telephone\\\":\\\"0381019254\\\",\\\"mot_de_passe_hash\\\":\\\"123456\\\"},\\\"profil\\\":{\\\"prenom\\\":\\\"Feno\\\",\\\"nom\\\":\\\"Ravelomanana\\\",\\\"date_naissance\\\":null,\\\"genre\\\":\\\"Homme\\\",\\\"adresse\\\":\\\"45 Bis Andraisoro\\\"}}}\"', '2026-02-27 11:15:46.363', '2026-02-27 11:15:46.363'),
('507c3657-0b26-46b7-9046-69eb38e55eb9', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'kaleba.andriamandimbiniaina@gmail.com', '0346422107', '$2b$10$vcBxGjTgeJZwMP1KU8Qzou.c3TQlgtgmXz8MqopDp5P2Sb30ttWjO', 'ACTIF', NULL, '{\"account\":{\"email\":\"kaleba.andriamandimbiniaina@gmail.com\",\"password\":\"Z-!7Vy_W(\"},\"type\":\"tuteur\"}', '2026-03-24 14:35:13.332', '2026-03-24 14:35:13.332'),
('5ff38650-1d1f-4b7b-bd83-e4a4833a604c', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'E20250001', NULL, '$2b$10$3R1sNp7tB2XlXKlbOkoGeur08yXjp/NPqGfjebNAq4tsu.Adg6AAC', 'ACTIF', NULL, '{\"account\":{\"email\":\"E20250001\",\"password\":\"J}!Ebv2TV\"},\"type\":\"eleve\"}', '2026-03-24 14:35:12.900', '2026-03-24 14:35:12.900'),
('91473318-9ec1-4da8-9d24-9f4e9b3ebf82', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'koloina.raobelison@gmail.com', '0344414893', '$2b$10$JpirQjpLDlILPZo4w7.pleVJqso83yXcQsgXpSFNPtg48C00Ufjay', 'ACTIF', NULL, 'null', '2026-02-24 12:11:00.733', '2026-02-24 12:11:40.900'),
('98f52c76-a855-475b-8044-bc64970cbba8', NULL, 'kaleba.andriamandimbiniaina+admin1@gmail.com', '0346422107', '$2b$10$28Lq5966p.uja8N9Ei52m.YT.KNfHm/qpVwtMyPOOwi1KaKAZ4KZy', 'ACTIF', NULL, NULL, '2026-02-10 06:56:13.658', '2026-02-10 06:56:13.658'),
('c3002634-2529-40bc-9efb-69774be85e15', '8c42c459-09f0-4fb0-a27d-86da4f1637bd', 'esperence@gmail.com', '0347885214', '$2b$10$vcGaKvLfA6l.h8IRkwohB.a5jvFquJqCjYeUS1XT.RANRQrQsV0/q', 'ACTIF', NULL, '\"{\\\"option\\\":\\\"En attente de validation\\\",\\\"data\\\":{\\\"etablissement\\\":{\\\"nom\\\":\\\"esperence\\\"},\\\"utilisateur\\\":{\\\"email\\\":\\\"esperence@gmail.com\\\",\\\"telephone\\\":\\\"0347885214\\\",\\\"mot_de_passe_hash\\\":\\\"123456\\\"},\\\"profil\\\":{\\\"prenom\\\":\\\"Falisoa\\\",\\\"nom\\\":\\\"RAMANANA\\\",\\\"date_naissance\\\":null,\\\"genre\\\":\\\"Femme\\\",\\\"adresse\\\":\\\"M45 Mandroseza\\\"}}}\"', '2026-02-24 10:30:34.473', '2026-02-24 12:30:06.458'),
('c5498117-bbd2-4e74-ba17-d637148996eb', '55ef447c-258b-467a-ac74-29e5f28b5301', 'test@gmail.com', '0344444444', '$2b$10$PuK4MiG0NXB4IcLhmJfmHO50lTjv7WT7jcirJDTGpKtQ0eCmTGvTq', 'ACTIF', NULL, 'null', '2026-02-27 16:59:20.057', '2026-02-27 16:59:59.196');

INSERT INTO `utilisateurs_roles` (`utilisateur_id`, `role_id`, `scope_json`) VALUES
('91473318-9ec1-4da8-9d24-9f4e9b3ebf82', 'c35a8d91-3f0a-4296-907a-9fa235051983', NULL),
('98f52c76-a855-475b-8044-bc64970cbba8', '8f9c81ea-e71d-4c8f-b12f-9035ad772e1f', NULL),
('c3002634-2529-40bc-9efb-69774be85e15', '69f61e12-eba4-46cc-ad56-cc10a60a8080', NULL),
('c5498117-bbd2-4e74-ba17-d637148996eb', '36e91a8a-aa53-4eff-901a-fc865403f7cb', NULL);

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('20fa962c-5313-48dd-87d7-906e97554dd0', '00a2ab934fa07dd9134606587c55f6c3a77a677c3b747d6cec311b49aadb39c5', '2026-03-24 14:17:20.287', '20260303090302_default_data', NULL, NULL, '2026-03-24 14:17:20.066', 1),
('3c221ca8-0926-493b-bfd1-dd40430db1be', '3236d0b52409566d434293758da046acf97cacc84ab672e2317b27c6b3b9a94c', '2026-02-11 09:01:27.952', '20260211085720_default_data', NULL, NULL, '2026-02-11 09:01:27.917', 1),
('4f43419c-c8f0-40de-821c-079c8475ecfa', 'bb5f8521f02e6af43d1b6035fc1c4af6904831e8d3819ad704e16e75b90e404b', '2026-03-24 14:17:23.341', '20260324103000_finance_echeances_paiement', NULL, NULL, '2026-03-24 14:17:22.348', 1),
('527ab85c-6d4a-4c90-a33f-934afb0ecc96', '46c8134796ed5b3832fd2db28c88df04cdaf30656248187346cc0174b4a4a278', '2026-03-24 14:17:20.061', '20260303090301_init', NULL, NULL, '2026-03-24 14:16:58.122', 1),
('5495682b-456f-475f-919f-bd76d14e8bd2', '2cb7790e21a30a0856414f556e12d6d1c4434758b2dfa89640ed8e5cc3280e59', '2026-03-24 14:17:22.343', '20260323110000_edt_native_sessions', NULL, NULL, '2026-03-24 14:17:21.784', 1),
('5ae8c98e-2af1-4b39-830c-231018ba179a', '0f5c5e95d2c13d222575e4c957610d10817e8f31edf7a23559794f38bddf89d6', '2026-02-10 06:36:38.912', '20260210063620_init', NULL, NULL, '2026-02-10 06:36:20.309', 1),
('62e088a8-8500-4fed-a149-09b40bdfc4f8', '6449c947597aee90dd87f533a454db16c4e5b701fb1e97885de687545773e540', '2026-02-11 09:01:27.910', '20260211085719_utilisateur_add_scope_json', NULL, NULL, '2026-02-11 09:01:27.877', 1),
('7657e792-d0e7-4319-846f-bffdce09b42b', '2ac0e5b352b498316b391a3b71aa623e50e44914b5c4d4fceb74f75eeccd3595', '2026-03-24 14:17:23.686', '20260324123000_catalogue_frais_par_niveau', NULL, NULL, '2026-03-24 14:17:23.346', 1),
('8862571a-2294-450d-b1a8-50b1dad7075c', '5ca998e4c7d088b5fdb2f5b97c61352b6f9cc8d583f9ffa86aff53d5e9716e3c', '2026-03-24 14:17:24.226', '20260324170000_facturation_recurrente', NULL, NULL, '2026-03-24 14:17:24.138', 1),
('89a10611-283e-4700-815e-40f0e74ed687', 'e0663e6c37eda0ead81d8d0cba816818b60f6dea8f54cb9a8a25220b2c32a233', '2026-03-24 14:17:24.458', '20260324180000_operations_financieres', NULL, NULL, '2026-03-24 14:17:24.231', 1),
('bf4fc240-239e-4458-b63c-af3c5196cf1f', '7a388045fcef176795cd04f19956334dc502bfb773143192099e6bc2a7ad6493', '2026-03-24 14:17:21.743', '20260320093000_presences_constraints', NULL, NULL, '2026-03-24 14:17:20.293', 1),
('c8681f47-a4b2-47c0-99d0-4512161ea8f6', '76c2168e394e6e942470a4fb4c62a2c833cc7d133193a8b5233a7b602d85d5b2', '2026-02-11 09:01:27.872', '20260210142225_init', NULL, NULL, '2026-02-11 09:01:06.917', 1),
('c8d98eea-fe9a-44fe-9a7d-a58b4cc846ce', '208c764f7173c4e1f22f88fbc7d8dee576cb5e7ad12fe56842c371609369f65d', '2026-03-24 14:17:24.132', '20260324150000_finance_remise_relations', NULL, NULL, '2026-03-24 14:17:23.692', 1);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
