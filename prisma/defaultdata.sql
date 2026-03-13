
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

INSERT INTO `annees_scolaires` (`id`, `etablissement_id`, `nom`, `date_debut`, `date_fin`, `est_active`, `created_at`, `updated_at`) VALUES
('fec54b15-565c-463c-8b4e-1c9c8b3d8519', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', '2026-2027', '2026-10-06 00:00:00.000', '2027-08-07 00:00:00.000', 1, '2026-02-28 09:30:33.247', '2026-02-28 09:30:33.247');

INSERT INTO `periodes` (`id`, `annee_scolaire_id`, `nom`, `date_debut`, `date_fin`, `ordre`, `created_at`, `updated_at`) VALUES
('431b8416-66d4-4973-8ee2-18f161c5ba6c', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '2ème trimestre', '2027-01-05 00:00:00.000', '2027-03-27 00:00:00.000', 2, '2026-03-02 07:10:15.707', '2026-03-02 07:10:15.707'),
('91051ce5-abb9-449c-a2b6-870c989b5b70', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '1ère trimestre', '2026-10-06 00:00:00.000', '2026-12-19 00:00:00.000', 1, '2026-02-28 12:06:03.592', '2026-02-28 12:06:03.592'),
('c0745996-4f33-4875-a50b-ded89d886b23', 'fec54b15-565c-463c-8b4e-1c9c8b3d8519', '3ème trimestre', '2027-04-12 00:00:00.000', '2027-07-30 00:00:00.000', 3, '2026-03-02 07:11:21.881', '2026-03-02 07:11:21.881');

INSERT INTO `sites` (`id`, `etablissement_id`, `nom`, `adresse`, `telephone`, `created_at`, `updated_at`) VALUES
('04d9adc2-086e-484d-a33b-c6bf91cd00b3', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B1', '21BIS Androndra', '0344587412', '2026-02-27 14:06:17.841', '2026-02-27 14:06:17.841'),
('267e46d8-d484-435a-889b-b2cd6b5f5f67', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B3', '150IV Alasora', '0384512510', '2026-02-27 14:54:58.479', '2026-02-27 14:54:58.479'),
('2fb15578-5ac1-43e8-88ae-16ed697ffc72', '69f80586-5995-488b-956e-699b61f7120e', 'B1', 'AKM II 065 Alakamisy Fenoarivo', '0346422107', '2026-02-19 09:27:24.276', '2026-02-19 09:27:24.276'),
('58bc8774-cc5e-481b-a5cc-66e2592edf1b', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'B2', '145F Analamahitsy', '0344875216', '2026-02-27 14:53:57.396', '2026-02-27 14:53:57.396'),
('9d74ed2c-f093-4b1d-94c7-3b5abdab8c47', 'bba6aad5-1107-44ed-b047-c97e82ece666', 'test', 'AKM II 065 Alakamisy Fenoarivo', '0346422107', '2026-02-19 06:21:34.219', '2026-02-19 06:21:34.219');

INSERT INTO `salles` (`id`, `site_id`, `nom`, `capacite`, `type`, `created_at`, `updated_at`) VALUES
('364eeb17-44b2-473d-b6db-993cc35bc004', '04d9adc2-086e-484d-a33b-c6bf91cd00b3', 'A001', 50, 'Salle', '2026-02-28 08:05:43.524', '2026-02-28 08:05:43.524'),
('8b0050f8-ad1b-4bb9-aeb7-3fc147c35b5f', '04d9adc2-086e-484d-a33b-c6bf91cd00b3', 'A002', 45, 'Salle', '2026-02-28 08:22:12.664', '2026-02-28 08:22:12.664');

INSERT INTO `utilisateurs` (`id`, `etablissement_id`, `email`, `telephone`, `mot_de_passe_hash`, `statut`, `dernier_login`, `created_at`, `updated_at`, `scope_json`) VALUES
('24072a98-cca4-473e-b2ea-668d5ee3acde', NULL, 'loharano@gmail.com', '0381019254', '$2b$10$t/x/2A8Dglvuj3obl4VakeuqtTzg1KYZcg6c4NBJ8O2uLwaA6Spr2', 'INACTIF', NULL, '2026-02-27 11:15:46.363', '2026-02-27 11:15:46.363', '\"{\\\"option\\\":\\\"En attente de validation\\\",\\\"data\\\":{\\\"etablissement\\\":{\\\"nom\\\":\\\"Loharano\\\"},\\\"utilisateur\\\":{\\\"email\\\":\\\"loharano@gmail.com\\\",\\\"telephone\\\":\\\"0381019254\\\",\\\"mot_de_passe_hash\\\":\\\"123456\\\"},\\\"profil\\\":{\\\"prenom\\\":\\\"Feno\\\",\\\"nom\\\":\\\"Ravelomanana\\\",\\\"date_naissance\\\":null,\\\"genre\\\":\\\"Homme\\\",\\\"adresse\\\":\\\"45 Bis Andraisoro\\\"}}}\"'),
('91473318-9ec1-4da8-9d24-9f4e9b3ebf82', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'koloina.raobelison@gmail.com', '0344414893', '$2b$10$JpirQjpLDlILPZo4w7.pleVJqso83yXcQsgXpSFNPtg48C00Ufjay', 'ACTIF', NULL, '2026-02-24 12:11:00.733', '2026-02-24 12:11:40.900', 'null'),
('98f52c76-a855-475b-8044-bc64970cbba8', NULL, 'kaleba.andriamandimbiniaina+admin1@gmail.com', '0346422107', '$2b$10$28Lq5966p.uja8N9Ei52m.YT.KNfHm/qpVwtMyPOOwi1KaKAZ4KZy', 'ACTIF', NULL, '2026-02-10 06:56:13.658', '2026-02-10 06:56:13.658', NULL),
('c3002634-2529-40bc-9efb-69774be85e15', '8c42c459-09f0-4fb0-a27d-86da4f1637bd', 'esperence@gmail.com', '0347885214', '$2b$10$vcGaKvLfA6l.h8IRkwohB.a5jvFquJqCjYeUS1XT.RANRQrQsV0/q', 'ACTIF', NULL, '2026-02-24 10:30:34.473', '2026-02-24 12:30:06.458', '\"{\\\"option\\\":\\\"En attente de validation\\\",\\\"data\\\":{\\\"etablissement\\\":{\\\"nom\\\":\\\"esperence\\\"},\\\"utilisateur\\\":{\\\"email\\\":\\\"esperence@gmail.com\\\",\\\"telephone\\\":\\\"0347885214\\\",\\\"mot_de_passe_hash\\\":\\\"123456\\\"},\\\"profil\\\":{\\\"prenom\\\":\\\"Falisoa\\\",\\\"nom\\\":\\\"RAMANANA\\\",\\\"date_naissance\\\":null,\\\"genre\\\":\\\"Femme\\\",\\\"adresse\\\":\\\"M45 Mandroseza\\\"}}}\"'),
('c5498117-bbd2-4e74-ba17-d637148996eb', '55ef447c-258b-467a-ac74-29e5f28b5301', 'test@gmail.com', '0344444444', '$2b$10$PuK4MiG0NXB4IcLhmJfmHO50lTjv7WT7jcirJDTGpKtQ0eCmTGvTq', 'ACTIF', NULL, '2026-02-27 16:59:20.057', '2026-02-27 16:59:59.196', 'null');

INSERT INTO `roles` (`id`, `etablissement_id`, `nom`, `created_at`, `updated_at`, `scope_json`) VALUES
('36e91a8a-aa53-4eff-901a-fc865403f7cb', '55ef447c-258b-467a-ac74-29e5f28b5301', 'DIRECTION', '2026-02-27 16:59:59.641', '2026-02-27 16:59:59.641', NULL),
('69f61e12-eba4-46cc-ad56-cc10a60a8080', '8c42c459-09f0-4fb0-a27d-86da4f1637bd', 'DIRECTION', '2026-02-24 12:30:06.543', '2026-02-24 12:30:06.543', NULL),
('8f9c81ea-e71d-4c8f-b12f-9035ad772e1f', NULL, 'ADMIN', '2026-02-10 07:37:46.586', '2026-02-10 07:37:46.586', NULL),
('c35a8d91-3f0a-4296-907a-9fa235051983', '32861a2d-eec5-4f7b-b7b4-b8f4b94e080f', 'DIRECTION', '2026-02-24 12:11:40.976', '2026-02-24 12:11:40.976', NULL);

INSERT INTO `profils` (`id`, `utilisateur_id`, `prenom`, `nom`, `date_naissance`, `genre`, `photo_url`, `adresse`, `contact_urgence_json`, `created_at`, `updated_at`) VALUES
('', '91473318-9ec1-4da8-9d24-9f4e9b3ebf82', 'Koloina', 'RAOBELISON', NULL, 'Femme', '', 'AKM II 065 Alakamisy Fenoarivo', '{}', '2026-02-24 12:11:40.941', '2026-02-24 12:11:40.941');

INSERT INTO `utilisateurs_roles` (`utilisateur_id`, `role_id`, `scope_json`) VALUES
('91473318-9ec1-4da8-9d24-9f4e9b3ebf82', 'c35a8d91-3f0a-4296-907a-9fa235051983', NULL),
('98f52c76-a855-475b-8044-bc64970cbba8', '8f9c81ea-e71d-4c8f-b12f-9035ad772e1f', NULL),
('c3002634-2529-40bc-9efb-69774be85e15', '69f61e12-eba4-46cc-ad56-cc10a60a8080', NULL),
('c5498117-bbd2-4e74-ba17-d637148996eb', '36e91a8a-aa53-4eff-901a-fc865403f7cb', NULL);

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('3c221ca8-0926-493b-bfd1-dd40430db1be', '3236d0b52409566d434293758da046acf97cacc84ab672e2317b27c6b3b9a94c', '2026-02-11 09:01:27.952', '20260211085720_default_data', NULL, NULL, '2026-02-11 09:01:27.917', 1),
('5ae8c98e-2af1-4b39-830c-231018ba179a', '0f5c5e95d2c13d222575e4c957610d10817e8f31edf7a23559794f38bddf89d6', '2026-02-10 06:36:38.912', '20260210063620_init', NULL, NULL, '2026-02-10 06:36:20.309', 1),
('62e088a8-8500-4fed-a149-09b40bdfc4f8', '6449c947597aee90dd87f533a454db16c4e5b701fb1e97885de687545773e540', '2026-02-11 09:01:27.910', '20260211085719_utilisateur_add_scope_json', NULL, NULL, '2026-02-11 09:01:27.877', 1),
('c8681f47-a4b2-47c0-99d0-4512161ea8f6', '76c2168e394e6e942470a4fb4c62a2c833cc7d133193a8b5233a7b602d85d5b2', '2026-02-11 09:01:27.872', '20260210142225_init', NULL, NULL, '2026-02-11 09:01:06.917', 1);
