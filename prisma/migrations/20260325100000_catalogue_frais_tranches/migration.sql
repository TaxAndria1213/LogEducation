ALTER TABLE `catalogue_frais`
  ADD COLUMN `nombre_tranches` INTEGER NOT NULL DEFAULT 1 AFTER `devise`;
