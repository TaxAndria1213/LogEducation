ALTER TABLE `catalogue_frais`
ADD COLUMN `usage_scope` VARCHAR(32) NOT NULL DEFAULT 'GENERAL' AFTER `niveau_scolaire_id`;

UPDATE `catalogue_frais`
SET `usage_scope` = CASE
  WHEN LOWER(`nom`) LIKE '%transport%' THEN 'TRANSPORT'
  WHEN LOWER(`nom`) LIKE '%cantine%' THEN 'CANTINE'
  WHEN LOWER(`nom`) LIKE '%inscription%' THEN 'INSCRIPTION'
  WHEN LOWER(`nom`) LIKE '%scolarite%' THEN 'SCOLARITE'
  ELSE 'GENERAL'
END;
