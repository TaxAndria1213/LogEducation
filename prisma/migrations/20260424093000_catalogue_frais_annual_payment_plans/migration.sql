ALTER TABLE `catalogue_frais`
  ADD COLUMN `mode_facturation` VARCHAR(191) NOT NULL DEFAULT 'PONCTUEL' AFTER `nombre_tranches`,
  ADD COLUMN `plans_paiement_autorises_json` JSON NULL AFTER `eligibilite_json`,
  ADD COLUMN `plan_paiement_defaut_code` VARCHAR(191) NULL AFTER `plans_paiement_autorises_json`;
