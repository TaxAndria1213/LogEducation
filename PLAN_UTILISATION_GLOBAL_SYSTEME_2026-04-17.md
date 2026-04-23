# Plan D'Utilisation Global Du Systeme LogEducation

Date de redaction : 2026-04-17  
Programme : LogEducation  
Version du document : v1  
Base d'analyse : navigation front, routes applicatives, modules exposes, parcours metier visibles et fonctionnalites effectivement implementees dans le depot a la date du document.

## 1. Objet Du Document

Ce document decrit comment utiliser LogEducation de maniere complete, depuis l'entree sur la plateforme jusqu'a l'exploitation quotidienne des modules metier.

Il a pour but de servir :

- de guide d'orientation pour les nouveaux utilisateurs
- de plan de prise en main pour un etablissement
- de reference de travail pour les profils administratifs et metier
- de support pour organiser un deploiement progressif du systeme

## 2. Vision D'Ensemble Du Systeme

LogEducation est organise autour d'un etablissement actif. Une fois connecte, l'utilisateur travaille toujours dans le contexte d'un etablissement precis, avec un perimetre determine par :

- son compte utilisateur
- son ou ses roles
- les permissions associees
- eventuellement un scope specifique

Le systeme suit en pratique cette logique :

1. un proprietaire demande l'ouverture de son etablissement
2. un administrateur plateforme valide cette demande
3. l'etablissement est initialise
4. les comptes internes sont crees
5. les operations metier quotidiennes sont executees module par module

## 3. Profils Utilisateurs Et Point D'Entree

## 3.1 Administrateur Plateforme

Role principal :

- valider les nouveaux etablissements
- superviser les etablissements actifs
- piloter les actions de niveau plateforme

Point d'entree :

- page de connexion
- ouverture du popup administrateur dans le header

## 3.2 Proprietaire / Direction D'Etablissement

Role principal :

- porter la creation et la mise en service de l'etablissement
- piloter l'initialisation
- superviser les modules structurants

Point d'entree :

- connexion apres approbation du compte
- module `Etablissement`
- module `Comptes & securite`

## 3.3 Responsable Scolarite

Role principal :

- gerer les eleves, classes, niveaux, inscriptions, parents et identifiants

Point d'entree :

- module `Scolarite`

## 3.4 Responsable Personnel / RH

Role principal :

- gerer les personnels, enseignants et departements

Point d'entree :

- module `Personnel`

## 3.5 Responsable Pedagogique

Role principal :

- gerer matieres, programmes, cours, evaluations, notes et bulletins

Point d'entree :

- module `Pedagogie`

## 3.6 Enseignant

Role principal :

- consulter ses affectations
- intervenir sur emploi du temps, evaluations, notes et presences selon ses droits

Point d'entree :

- creation de compte par lien interne
- navigation limitee par les permissions

## 3.7 Responsable Finance

Role principal :

- gerer catalogue de frais, remises, factures, paiements, plans de paiement et recouvrement

Point d'entree :

- module `Finance`

## 3.8 Agent De Vie Scolaire / Discipline / Presence

Role principal :

- gerer incidents, sanctions, recompenses, sessions d'appel, presences et justificatifs

Point d'entree :

- modules `Presences` et `Discipline`

## 4. Parcours Global Recommande

L'utilisation complete du systeme doit suivre cet ordre.

### Etape 1 - Demande D'Ouverture D'Etablissement

Le futur proprietaire se rend sur :

- `/register`

Il soumet :

- les informations de l'etablissement
- les informations de son compte
- les informations de son profil

Resultat attendu :

- un compte est cree en attente
- l'etablissement n'est pas encore actif
- la demande est visible cote administrateur

### Etape 2 - Validation Par L'Administrateur Plateforme

L'administrateur se connecte puis :

1. ouvre le popup administrateur
2. consulte les demandes proprietaires
3. approuve la demande cible

Resultat attendu :

- l'etablissement est cree
- le proprietaire est active
- le role `DIRECTION` est attribue
- le compte peut se connecter

### Etape 3 - Premiere Connexion Du Proprietaire

Le proprietaire :

1. se connecte
2. verifie le contexte d'etablissement actif
3. consulte le profil global de l'etablissement
4. ouvre le module `Initialisation`

### Etape 4 - Initialisation De L'Etablissement

Le proprietaire ou la direction ouvre :

- `Etablissement > Initialisation`

Le parcours recommande est :

1. renseigner la base de l'etablissement
2. creer l'annee scolaire initiale
3. choisir les groupes de niveaux
4. affiner les niveaux retenus
5. definir une ou plusieurs classes par niveau
6. definir la base academique par niveau
7. previsualiser
8. executer l'initialisation

Resultat attendu :

- site principal si prevu
- annee scolaire initiale
- niveaux
- classes
- base academique de depart

### Etape 5 - Creation Des Comptes Internes

Une fois l'etablissement initialisé :

1. creer ou verifier les roles
2. copier les liens de creation internes
3. transmettre ces liens aux futurs utilisateurs
4. laisser chaque utilisateur creer son compte

Le flux par lien est utilise notamment pour :

- enseignant
- personnel
- comptes internes de scolarite
- profils administratifs internes

### Etape 6 - Mise En Exploitation Metier

Une fois les comptes et referentiels en place, l'etablissement peut utiliser les modules dans cet ordre recommande :

1. `Comptes & securite`
2. `Scolarite`
3. `Personnel`
4. `Pedagogie`
5. `Emploi du temps & calendrier`
6. `Presences`
7. `Discipline`
8. `Finance`
9. `Bibliotheque`
10. `Transport & cantine`

## 5. Navigation Generale Et Comportements Communs

## 5.1 Sidebar Principal

Le sidebar permet :

- la recherche d'un module
- le depliage d'un groupe
- le recentrage automatique du groupe ouvert
- la visualisation du groupe actif

Bon usage :

- utiliser la recherche pour aller vite sur un sous-module
- ouvrir un seul groupe a la fois quand on veut rester concentre

## 5.2 Header De Page

Le header de chaque page sert a :

- identifier le module et le sous-module courant
- afficher les badges ou actions importantes
- gagner de la place apres scroll grace a sa condensation

## 5.3 Listes DataTable

La plupart des modules utilisent un tableau standard avec :

- recherche
- pagination
- actions de ligne
- bouton `Voir`
- bouton `Modifier`
- bouton `Supprimer` si la ressource l'autorise

Bon usage :

- filtrer avant de paginer
- utiliser `Voir` pour le detail complet
- utiliser `Modifier` pour changer une fiche sans quitter le module

## 5.4 Vue Detail

La vue detail generique permet :

- de lire les champs simples de l'entite
- d'afficher les relations chargees ou non
- d'ouvrir une relation dans une vue imbriquee
- d'explorer recursivement une entite sans perdre le contexte

Bon usage :

- utiliser le sidebar de relations pour naviguer dans les liens
- ouvrir seulement les sections utiles
- profiter des accordions replies par defaut pour garder la lecture claire

## 5.5 Popups Et Panneaux

Le systeme utilise des popups centres a l'ecran pour :

- creation
- edition
- confirmation
- consultation secondaire

Bon usage :

- terminer l'action en cours avant d'ouvrir un autre popup
- fermer proprement si l'on veut eviter des modifications partielles

## 6. Plan D'Utilisation Par Module

## 6.1 Tableau De Bord

Sous-modules principaux :

- Vue d'ensemble
- Apercu du calendrier

Usage recommande :

1. verifier les indicateurs de base
2. surveiller les donnees de calendrier
3. utiliser ce module comme point d'entree quotidien

## 6.2 Etablissement

Sous-modules principaux :

- Profil de l'etablissement
- Initialisation
- Sites
- Salles
- Annee scolaire
- Periodes
- Referentiels

### Profil De L'Etablissement

Usage :

- consulter la vue globale de l'etablissement
- verifier les informations principales
- lire les relations utiles sans faire de gestion lourde

### Initialisation

Usage :

- initialiser un nouvel etablissement
- demarrer une nouvelle annee scolaire
- previsualiser les creations avant commit

### Sites

Usage :

- creer les campus ou sites operationnels
- renseigner les informations de rattachement

### Salles

Usage :

- enregistrer les salles et espaces utilisables
- rattacher les salles a un site

### Annee Scolaire

Usage :

- creer une annee
- activer une annee
- preparer une nouvelle annee

### Periodes

Usage :

- creer les trimestres, semestres ou sequences
- structurer le calendrier scolaire

### Referentiels

Usage :

- maintenir les donnees transverses exposees dans ce sous-module
- verifier les relations en vue detail

## 6.3 Comptes & Securite

Sous-modules principaux :

- Utilisateurs
- Profils
- Roles
- Permissions
- Affectations

Ordre recommande :

1. verifier les utilisateurs
2. verifier les profils
3. creer les roles metier
4. verifier les permissions
5. affecter les roles aux utilisateurs

### Utilisateurs

Usage :

- creer un utilisateur simple
- consulter son detail
- controler son statut

### Profils

Usage :

- completer les donnees personnelles
- rattacher un profil au bon utilisateur

### Roles

Usage :

- creer un role depuis un modele ou a partir de zero
- cocher les fonctionnalites utiles
- utiliser la recherche et les accordions
- copier un lien de creation interne quand il est expose

### Permissions

Usage :

- consulter ou enrichir les permissions disponibles

### Affectations

Usage :

- affecter des permissions a un role
- affecter un ou plusieurs roles a un utilisateur
- ajuster un scope JSON si necessaire

Bonnes pratiques :

- commencer simple
- ne pas surcharger un role avec tout
- reserver les scopes avances aux cas necessaires

## 6.4 Scolarite

Sous-modules principaux :

- Eleves
- Identifiants des eleves
- Parents / tuteurs
- Niveaux
- Classes
- Inscriptions

Ordre recommande :

1. verifier les niveaux
2. verifier les classes
3. creer ou importer les eleves
4. enregistrer les parents / tuteurs
5. generer les identifiants
6. enregistrer les inscriptions

### Eleves

Usage :

- creer une fiche eleve
- suivre les informations scolaires et relationnelles

### Identifiants Des Eleves

Usage :

- attribuer un identifiant ou matricule
- rechercher un eleve a partir de cet identifiant

### Parents / Tuteurs

Usage :

- rattacher un responsable a un ou plusieurs eleves

### Niveaux

Usage :

- maintenir le referentiel des niveaux scolaires

### Classes

Usage :

- organiser les classes par niveau et annee

### Inscriptions

Usage :

- rattacher l'eleve a une classe et une annee
- choisir les montants et remises visibles
- declencher la logique de scolarisation annuelle

## 6.5 Personnel

Sous-modules principaux :

- Personnels
- Enseignants
- Departements

Ordre recommande :

1. creer les personnels
2. transformer en enseignants quand necessaire
3. rattacher aux departements

### Personnels

Usage :

- creer les fiches de personnel
- rattacher un compte utilisateur si disponible

### Enseignants

Usage :

- creer le profil enseignant a partir d'un personnel
- consulter les informations specifiques d'enseignement

### Departements

Usage :

- structurer l'organisation academique
- rattacher enseignants et matieres

## 6.6 Pedagogie

Sous-modules principaux :

- Matieres
- Programmes
- Cours
- Evaluations
- Notes
- Bulletins
- Regles de notes

Ordre recommande :

1. verifier les matieres
2. verifier les programmes
3. creer les cours
4. planifier les evaluations
5. saisir les notes
6. produire les bulletins

### Matieres

Usage :

- gerer le catalogue des matieres
- affecter coefficients et departement

### Programmes

Usage :

- structurer l'offre pedagogique par niveau

### Cours

Usage :

- rattacher matiere, enseignant, classe et contexte

### Evaluations

Usage :

- definir les evaluations et leur bareme

### Notes

Usage :

- saisir ou consulter les notes
- verifier les liens eleve / evaluation / bulletin

### Bulletins

Usage :

- consulter la restitution pedagogique

### Regles De Notes

Usage :

- parametrer les regles de notation
- harmoniser les calculs attendus

## 6.7 Emploi Du Temps & Calendrier

Sous-modules principaux :

- Emploi du temps
- Evenements & calendrier

### Emploi Du Temps

Usage recommande :

1. choisir la classe a planifier
2. remplir la grille hebdomadaire
3. attribuer les cours
4. enregistrer
5. exporter en PDF si besoin

Bon usage :

- travailler classe par classe
- enregistrer apres chaque sequence coherente

### Evenements & Calendrier

Usage :

- enregistrer les evenements
- maintenir la lecture du calendrier general

## 6.8 Presences

Sous-modules principaux :

- Sessions d'appel
- Presences eleves
- Justificatifs
- Presences personnel

Ordre recommande :

1. ouvrir ou verifier les sessions d'appel
2. saisir les presences eleves
3. traiter les justificatifs
4. suivre les presences du personnel

## 6.9 Discipline

Sous-modules principaux :

- Incidents
- Sanctions
- Recompenses

Ordre recommande :

1. enregistrer l'incident
2. decider la sanction si necessaire
3. enregistrer les recompenses separement

## 6.10 Finance

Sous-modules principaux :

- Tableau de bord
- Catalogue de frais
- Remises
- Factures
- Paiements
- Plans de paiement
- Journal financier
- Recouvrement

Ordre recommande :

1. parametrer le catalogue de frais
2. parametrer les remises
3. generer les factures
4. enregistrer les paiements
5. suivre les plans de paiement
6. consulter le journal financier
7. gerer le recouvrement

### Catalogue De Frais

Usage :

- definir les frais par niveau, annee ou logique metier

### Remises

Usage :

- definir les reductions applicables

### Factures

Usage :

- produire les factures eleves
- consulter leur detail

### Paiements

Usage :

- enregistrer les encaissements
- verifier les statuts mis a jour

### Plans De Paiement

Usage :

- organiser les echeanciers eleves

### Journal Financier

Usage :

- suivre les mouvements et controles de coherence

### Recouvrement

Usage :

- suivre les dossiers en retard ou sensibles

## 6.11 Bibliotheque

Sous-modules principaux :

- Ressources
- Emprunts

Ordre recommande :

1. enregistrer les ressources
2. enregistrer les emprunts
3. suivre les retours

## 6.12 Transport & Cantine

Sous-modules principaux :

- Transport
- Cantine

Usage :

- gerer les parametres et abonnements lies aux services eleves
- verifier les rattachements avec les fiches eleves et les vues detail

## 6.13 Communication, Documents, Audit & Integrations

Ces zones existent dans la navigation, mais leur usage doit rester prudent tant que leur branchement metier n'est pas complet.

Usage recommande a ce stade :

- verifier la navigation
- ouvrir les espaces disponibles
- ne pas en faire des modules coeur d'exploitation sans validation fonctionnelle complementaire

## 7. Plan D'Utilisation Par Phase De Vie D'Un Etablissement

## 7.1 Phase De Lancement

Modules prioritaires :

- `Etablissement`
- `Comptes & securite`
- `Scolarite`
- `Personnel`

Objectif :

- mettre en place la structure
- ouvrir les comptes
- preparer les classes et les acteurs

## 7.2 Phase De Preparation Pedagogique

Modules prioritaires :

- `Pedagogie`
- `Emploi du temps & calendrier`

Objectif :

- organiser le contenu academique
- planifier les cours

## 7.3 Phase D'Exploitation Quotidienne

Modules prioritaires :

- `Presences`
- `Discipline`
- `Finance`

Objectif :

- suivre le quotidien des eleves et des personnels
- assurer la traçabilite des operations

## 7.4 Phase D'Extension Des Services

Modules prioritaires :

- `Bibliotheque`
- `Transport & cantine`

Objectif :

- etendre les services annexes
- integrer ces usages aux fiches eleves

## 7.5 Phase De Renouvellement Annuel

Modules prioritaires :

- `Etablissement > Annee scolaire`
- `Etablissement > Initialisation`

Objectif :

- ouvrir une nouvelle annee scolaire
- reprendre les elements reconductibles
- remettre la structure en exploitation

## 8. Bonnes Pratiques D'Utilisation

- Toujours verifier l'etablissement actif avant une action sensible.
- Utiliser les vues detail pour comprendre une relation avant de modifier des donnees.
- Parametrer d'abord les referentiels, ensuite les fiches, puis les operations.
- Eviter de multiplier les roles quasi identiques.
- Faire valider les comptes et structures avant de lancer des operations finance ou pedagogie.
- Travailler par lots cohérents plutot que de passer d'un module a l'autre sans ordre.

## 9. Ordre Recommande Pour Une Prise En Main Complete

1. Connexion et verification du contexte
2. Profil de l'etablissement
3. Initialisation
4. Comptes & securite
5. Scolarite
6. Personnel
7. Pedagogie
8. Emploi du temps
9. Presences
10. Discipline
11. Finance
12. Bibliotheque
13. Transport & cantine

## 10. Checklist D'Utilisation Minimale Avant Mise En Service

- etablissement valide
- proprietaire / direction actif
- annee scolaire creee
- niveaux et classes en place
- programmes et matieres minimales en place
- comptes internes principaux crees
- roles et permissions verifies
- eleves et personnels principaux enregistres
- premier circuit de facturation pret si la finance est utilisee
- premier circuit d'appel / emploi du temps pret si la pedagogie est activee

## 11. Conclusion

Le bon usage de LogEducation repose sur une progression simple :

- d'abord la structure
- ensuite les comptes
- ensuite les referentiels metier
- ensuite l'exploitation quotidienne

Si cet ordre est respecte, le systeme est utilise de maniere beaucoup plus fluide, plus lisible et plus stable pour l'etablissement.
