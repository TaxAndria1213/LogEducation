# LogEducation Mobile

Application mobile React Native / Expo pour le systeme `LogEducation`.

## Objectif

Cette application mobile est construite pour :
- reutiliser l'API back existante
- respecter les comptes de role (`ADMIN`, `DIRECTION`, `SECRETARIAT`, `ENSEIGNANT`, `COMPTABLE`, `SURVEILLANT`, `PARENT`, `ELEVE`)
- offrir une navigation fluide, centree sur les usages terrain

## Structure

- `src/providers` : auth, React Query, bootstrap
- `src/navigation` : navigation role-aware
- `src/services` : client API et feeds mobiles
- `src/screens` : ecrans mobiles principaux
- `src/components` : UI reutilisable

## Lancement

1. Copier `.env.example` vers `.env`
2. Ajuster l'URL API
3. Installer les dependances
4. Lancer `npm run start`

Exemples d'URL :
- Android emulator : `http://10.0.2.2:3045`
- iOS simulator : `http://localhost:3045`
- appareil physique : IP locale de la machine backend

## Notes

- L'application est deja branchee sur le flow `login / refresh token / x-etablissement-id`.
- La navigation change selon le role actif.
- Si un utilisateur possede plusieurs roles, il peut changer de contexte dans l'app.
- Les ecrans mobiles priorisent la lecture rapide et les actions quotidiennes.
