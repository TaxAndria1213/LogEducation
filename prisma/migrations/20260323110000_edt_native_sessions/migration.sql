ALTER TABLE `emploi_du_temps`
  ADD COLUMN `heure_debut` VARCHAR(191) NULL AFTER `jour_semaine`,
  ADD COLUMN `heure_fin` VARCHAR(191) NULL AFTER `heure_debut`;

UPDATE `emploi_du_temps` edt
INNER JOIN `creneaux_horaires` ch ON ch.`id` = edt.`creneau_horaire_id`
SET
  edt.`heure_debut` = ch.`heure_debut`,
  edt.`heure_fin` = ch.`heure_fin`
WHERE edt.`heure_debut` IS NULL OR edt.`heure_fin` IS NULL;

ALTER TABLE `emploi_du_temps`
  MODIFY `heure_debut` VARCHAR(191) NOT NULL,
  MODIFY `heure_fin` VARCHAR(191) NOT NULL,
  MODIFY `creneau_horaire_id` VARCHAR(191) NULL;

ALTER TABLE `sessions_appel`
  ADD COLUMN `emploi_du_temps_id` VARCHAR(191) NULL AFTER `classe_id`;

UPDATE `sessions_appel`
SET `date` = DATE(`date`)
WHERE `date` <> DATE(`date`);

UPDATE `sessions_appel` sa
INNER JOIN `emploi_du_temps` edt
  ON edt.`classe_id` = sa.`classe_id`
  AND (
    (edt.`creneau_horaire_id` IS NOT NULL AND edt.`creneau_horaire_id` = sa.`creneau_horaire_id`)
    OR (
      edt.`heure_debut` = (
        SELECT ch.`heure_debut`
        FROM `creneaux_horaires` ch
        WHERE ch.`id` = sa.`creneau_horaire_id`
        LIMIT 1
      )
      AND edt.`heure_fin` = (
        SELECT ch.`heure_fin`
        FROM `creneaux_horaires` ch
        WHERE ch.`id` = sa.`creneau_horaire_id`
        LIMIT 1
      )
    )
  )
  AND (edt.`effectif_du` IS NULL OR sa.`date` >= edt.`effectif_du`)
  AND (edt.`effectif_au` IS NULL OR sa.`date` <= edt.`effectif_au`)
  AND edt.`jour_semaine` = CASE DAYOFWEEK(sa.`date`)
    WHEN 1 THEN 7
    ELSE DAYOFWEEK(sa.`date`) - 1
  END
SET sa.`emploi_du_temps_id` = edt.`id`
WHERE sa.`emploi_du_temps_id` IS NULL;

ALTER TABLE `sessions_appel`
  ADD INDEX `sessions_appel_emploi_du_temps_id_idx`(`emploi_du_temps_id`),
  ADD UNIQUE INDEX `sessions_appel_emploi_du_temps_id_date_key`(`emploi_du_temps_id`, `date`);

ALTER TABLE `sessions_appel`
  ADD CONSTRAINT `sessions_appel_emploi_du_temps_id_fkey`
  FOREIGN KEY (`emploi_du_temps_id`) REFERENCES `emploi_du_temps`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
