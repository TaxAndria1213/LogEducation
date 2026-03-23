ALTER TABLE `sessions_appel`
  ADD INDEX `sessions_appel_date_idx`(`date`);

ALTER TABLE `sessions_appel`
  ADD UNIQUE INDEX `sessions_appel_classe_id_date_creneau_horaire_id_key`(`classe_id`, `date`, `creneau_horaire_id`);

ALTER TABLE `motifs_absence`
  ADD UNIQUE INDEX `motifs_absence_etablissement_id_nom_key`(`etablissement_id`, `nom`);

ALTER TABLE `presences_personnel`
  DROP INDEX `presences_personnel_personnel_id_key`,
  MODIFY `date` DATETIME(3) NOT NULL,
  ADD UNIQUE INDEX `presences_personnel_personnel_id_date_key`(`personnel_id`, `date`),
  ADD INDEX `presences_personnel_date_idx`(`date`);
