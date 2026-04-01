ALTER TABLE `abonnements_transport`
ADD COLUMN `date_debut_service` DATETIME(3) NULL,
ADD COLUMN `date_fin_service` DATETIME(3) NULL,
ADD COLUMN `prorata_ratio` DECIMAL(8, 4) NULL;
