ALTER TABLE `paiements`
  ADD COLUMN `payeur_type` VARCHAR(191) NULL,
  ADD COLUMN `payeur_nom` VARCHAR(191) NULL,
  ADD COLUMN `payeur_reference` VARCHAR(191) NULL;
