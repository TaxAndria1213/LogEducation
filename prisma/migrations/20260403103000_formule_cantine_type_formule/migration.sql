ALTER TABLE `formules_cantine`
ADD COLUMN `type_formule` VARCHAR(32) NOT NULL DEFAULT 'AUTRE' AFTER `nom`;

UPDATE `formules_cantine`
SET `type_formule` = CASE
  WHEN LOWER(`nom`) LIKE '%forfait%' THEN 'FORFAIT'
  WHEN LOWER(`nom`) LIKE '%unitaire%' OR LOWER(`nom`) LIKE '%repas%' THEN 'REPAS_UNITAIRE'
  WHEN LOWER(`nom`) LIKE '%abonnement%' THEN 'ABONNEMENT'
  ELSE 'AUTRE'
END
WHERE `type_formule` = 'AUTRE';
