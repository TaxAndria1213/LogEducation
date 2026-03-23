-- =========================================================
-- LogEducation - Reparation des colonnes updated_at invalides
-- A executer sur une base deja importee si Prisma remonte :
-- "The column `updated_at` contained an invalid datetime value"
-- =========================================================

START TRANSACTION;

UPDATE `etablissements`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `sites`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `salles`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `annees_scolaires`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `periodes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `roles`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `permissions`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `utilisateurs`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `profils`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `departements`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `personnel`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `enseignants`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `niveaux_scolaires`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `classes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `eleves`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `parents_tuteurs`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `inscriptions`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `identifiants_eleves`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `matieres`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `programmes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `programmes_matieres`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `cours`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `types_evaluations`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `evaluations`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `notes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `bulletins`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `bulletins_lignes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `regles_notes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `creneaux_horaires`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `emploi_du_temps`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `evenements_calendrier`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `sessions_appel`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `presences_eleves`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `motifs_absence`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `justificatifs_absence`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `presences_personnel`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `lignes_transport`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `arrets_transport`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `abonnements_transport`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `formules_cantine`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `abonnements_cantine`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `catalogue_frais`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `factures`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `factures_lignes`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `paiements`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

UPDATE `plans_paiement_eleves`
SET `updated_at` = COALESCE(NULLIF(`created_at`, '0000-00-00 00:00:00'), NOW())
WHERE `updated_at` IS NULL OR `updated_at` = '0000-00-00 00:00:00';

COMMIT;
