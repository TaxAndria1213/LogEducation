ALTER TABLE `inscriptions`
  ADD COLUMN `acces_systeme_json` JSON NULL,
  ADD COLUMN `consentements_json` JSON NULL,
  ADD COLUMN `observations_json` JSON NULL;
