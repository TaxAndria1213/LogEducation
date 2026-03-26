ALTER TABLE `plans_paiement_eleves`
  ADD COLUMN `remise_id` VARCHAR(191) NULL;

ALTER TABLE `factures`
  ADD COLUMN `remise_id` VARCHAR(191) NULL;

CREATE INDEX `idx_plan_remise`
  ON `plans_paiement_eleves`(`remise_id`);

CREATE INDEX `idx_facture_remise`
  ON `factures`(`remise_id`);

ALTER TABLE `plans_paiement_eleves`
  ADD CONSTRAINT `fk_plan_remise`
  FOREIGN KEY (`remise_id`) REFERENCES `remises`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `factures`
  ADD CONSTRAINT `fk_facture_remise`
  FOREIGN KEY (`remise_id`) REFERENCES `remises`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
