UPDATE `catalogue_frais`
SET
  `mode_facturation` = 'ANNUEL',
  `est_recurrent` = 0,
  `periodicite` = NULL,
  `prorata_eligible` = 0,
  `plans_paiement_autorises_json` = COALESCE(
    `plans_paiement_autorises_json`,
    JSON_ARRAY(
      JSON_OBJECT('code', '1X', 'label', 'Comptant', 'nombre_tranches', 1, 'offsets_mois', JSON_ARRAY(0)),
      JSON_OBJECT('code', '3X', 'label', '3 tranches', 'nombre_tranches', 3, 'offsets_mois', JSON_ARRAY(0, 4, 8)),
      JSON_OBJECT('code', '10X', 'label', '10 tranches', 'nombre_tranches', 10, 'offsets_mois', JSON_ARRAY(0, 1, 2, 3, 4, 5, 6, 7, 8, 9))
    )
  ),
  `plan_paiement_defaut_code` = CASE
    WHEN `plan_paiement_defaut_code` IS NULL OR TRIM(`plan_paiement_defaut_code`) = '' THEN '10X'
    ELSE UPPER(TRIM(`plan_paiement_defaut_code`))
  END,
  `nombre_tranches` = CASE
    WHEN UPPER(COALESCE(NULLIF(TRIM(`plan_paiement_defaut_code`), ''), '10X')) = '1X' THEN 1
    WHEN UPPER(COALESCE(NULLIF(TRIM(`plan_paiement_defaut_code`), ''), '10X')) = '3X' THEN 3
    ELSE 10
  END
WHERE `usage_scope` = 'SCOLARITE';
