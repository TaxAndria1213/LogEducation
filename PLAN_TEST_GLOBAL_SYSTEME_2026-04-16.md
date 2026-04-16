# Plan De Test Global Du Systeme LogEducation

Date de redaction : 2026-04-16
Programme : LogEducation
Version du document : v1
Base d'analyse : routes front, routes API, modules enregistres, ecrans et flux deja implementes dans le depot a la date du document.

## 1. Objectif

Ce plan de test a pour but de verifier l'ensemble des fonctionnalites deja implementees dans le systeme LogEducation, en couvrant :

- les parcours publics et d'authentification
- les parcours d'administration plateforme
- les parcours proprietaire et direction d'etablissement
- les modules metier deja exposes dans l'interface et branches a l'API
- les composants transverses critiques : permissions, detail recursif, tables de donnees, popups, chargements, exports, et coherence inter-modules

## 2. Perimetre reel retenu

Le perimetre de test retenu correspond aux fonctionnalites actuellement visibles dans les routes front et/ou exposees dans les routes API.

### 2.1 Modules inclus

- Authentification et acces
- Demande publique de creation d'etablissement proprietaire
- Creation de compte par lien interne d'etablissement
- Administration plateforme
- Etablissement
- Comptes et securite
- Scolarite
- Personnel
- Pedagogie
- Emploi du temps et calendrier
- Presences
- Discipline
- Finance
- Bibliotheque
- Transport et cantine
- Composants transverses d'affichage et de navigation

### 2.2 Zones explicitement hors perimetre de recette complete

Ces zones existent dans la navigation ou dans la vision produit, mais ne sont pas encore assez branchees pour une recette complete de fonctionnalites metier :

- Communication
- Documents
- Audit et integrations

Pour ces zones, le test doit se limiter a :

- verification de navigation
- verification de non-regeression visuelle
- verification qu'aucune erreur bloquante n'apparait a l'ouverture

## 3. Strategie de test

La campagne est organisee en 5 couches.

### 3.1 Campagne Smoke

Objectif : valider rapidement qu'un build est exploitable.

- connexion possible
- navigation principale sans crash
- ouverture de chaque module implemente
- chargement des listes principales
- ouverture d'une vue detail
- ouverture d'un popup de creation ou d'edition

### 3.2 Campagne Metier

Objectif : verifier les regles de gestion principales par domaine.

- creation
- modification
- consultation
- recherche
- detail
- actions metier specifiques
- coherence des statuts
- effets transverses sur les autres modules

### 3.3 Campagne Droit D'Acces

Objectif : verifier que chaque role voit ce qu'il doit voir, et ne peut pas agir hors de son perimetre.

- admin plateforme
- direction
- scolarite
- finance
- enseignant
- personnel
- utilisateur sans permission explicite

### 3.4 Campagne Regression UI/UX

Objectif : verifier les interactions communes.

- DataTable
- vue detail recursive
- popups
- sidebars
- recherche
- pagination
- formulaires generiques
- messages de succes et d'erreur

### 3.5 Campagne Technique Et Non Fonctionnelle

Objectif : verifier la robustesse minimale.

- erreurs API
- tenant et etablissement actif
- chargements lents
- grands volumes
- droits refuses
- 404 fonctionnels
- 400 validation
- id de relation manquants
- popups et panneaux dans des pages longues

## 4. Environnements et pre-requis

### 4.1 Environnements

- environnement local de developpement
- environnement de recette integre avec base partagee
- navigateur desktop principal : Chrome ou Edge
- verification complementaire sur Firefox
- verification responsive minimale pour ecrans laptop et tablette

### 4.2 Pre-requis techniques

- base Prisma migree
- API accessible
- front Vite accessible
- variables d'environnement renseignees
- JWT fonctionnel
- tenant middleware fonctionnel

### 4.3 Jeux de donnees minimums

- 1 admin plateforme
- 1 proprietaire direction actif
- 1 etablissement approuve
- 1 etablissement en attente d'approbation
- 1 role enseignant avec lien de creation
- 1 site principal
- 1 annee scolaire active
- 3 niveaux
- plusieurs classes
- 5 eleves
- 2 parents tuteurs
- 3 personnels
- 2 enseignants
- matieres, programmes, cours et evaluations de base
- 1 catalogue de frais et 1 facture
- 1 paiement complet et 1 partiel
- 1 abonnement transport
- 1 abonnement cantine
- 1 ressource bibliotheque et 1 emprunt

## 5. Roles a utiliser dans la recette

- Admin plateforme
- Proprietaire / Direction
- Responsable scolarite
- Responsable finance
- Responsable pedagogique
- Enseignant
- Agent de presence
- Utilisateur sans droit explicite

## 6. Matrice de priorite

- P0 : parcours bloquant l'utilisation du systeme
- P1 : fonctionnalites coeur metier par module
- P2 : confort, exhaustivite, ergonomie, anomalies non bloquantes

## 7. Campagne P0 - Parcours critiques de bout en bout

### P0-01 Demande publique de creation d'etablissement

- Ouvrir `/register`
- Renseigner etablissement, proprietaire, profil
- Soumettre la demande
- Verifier le message de succes
- Verifier la creation d'un compte `INACTIF`
- Verifier la presence des donnees dans la file admin des demandes proprietaires

Resultat attendu :

- aucune erreur front
- aucune erreur API
- demande visible cote admin
- etablissement non encore actif avant validation

### P0-02 Validation admin d'un nouveau proprietaire

- Se connecter en admin
- Ouvrir le popup administrateur
- Choisir ou verifier le contexte admin
- Ouvrir les demandes proprietaires en attente
- Approuver une demande

Resultat attendu :

- l'etablissement est cree
- le proprietaire est active
- le role `DIRECTION` est attribue
- la demande disparait de la liste d'attente

### P0-03 Connexion du proprietaire approuve

- Se connecter avec le compte proprietaire valide
- Verifier l'acces a l'application
- Verifier l'acces au profil etablissement
- Verifier l'acces au module initialisation

Resultat attendu :

- connexion reussie
- etablissement courant correct
- modules visibles conformement au role

### P0-04 Initialisation d'un nouvel etablissement

- Ouvrir le module `Etablissement > Initialisation`
- Lancer `Commencer`
- Renseigner les informations de base
- Creer l'annee initiale
- Choisir les niveaux
- Saisir plusieurs classes par niveau
- Saisir l'academique par niveau
- Generer le preview
- Executer le commit

Resultat attendu :

- site principal cree si prevu
- annee scolaire creee
- niveaux crees
- classes creees
- programmes, matieres et lignes de programme crees
- message de succes

### P0-05 Creation de compte interne par lien

- Generer ou recuperer un lien de creation pour un role interne
- Ouvrir `/compte/creation`
- Completer utilisateur et profil
- Soumettre

Resultat attendu :

- compte cree directement en `ACTIF`
- rattachement au bon etablissement
- role affecte
- creation automatique du personnel si le flux le prevoit
- creation automatique de l'enseignant si le role est `ENSEIGNANT`

### P0-06 Controle de permission minimal

- Tester un compte sans permissions suffisantes
- Tenter l'ouverture d'un module non autorise
- Tenter une action de creation non autorisee

Resultat attendu :

- composant masque ou inaccessible
- aucune elevation de droit implicite
- message d'erreur ou absence d'action coherente

### P0-07 Parcours finance de base

- Creer ou verifier un catalogue de frais
- Generer une facture
- Enregistrer un paiement
- Consulter journal financier
- Consulter recouvrement

Resultat attendu :

- statuts financiers coherents
- mouvement visible dans les ecrans attendus
- impact visible dans les vues detail et tableaux

## 8. Cas de test par domaine

## 8.1 Authentification et acces

### AUTH-01 Login

- connexion avec compte valide
- refus avec mot de passe invalide
- refus avec compte inactif
- maintien de session apres refresh
- redirection vers l'application apres login

### AUTH-02 Compte inactif

- ouverture de la page `compte-inactif`
- message fonctionnel comprehensible
- impossibilite d'utiliser l'application sans activation

### AUTH-03 Logout et protection

- deconnexion
- acces direct a une route protegee sans token
- expiration de token et comportement de refresh

## 8.2 Administration plateforme

### ADM-01 Popup administrateur

- ouverture depuis la barre
- fermeture
- affichage correct des blocs
- absence de scroll horizontal

### ADM-02 Choix d'etablissement actif

- chargement de la liste des etablissements
- changement d'etablissement actif
- persistance du contexte choisi
- mise a jour des ecrans dependants

### ADM-03 Creation directe admin d'un etablissement et proprietaire

- ouverture du popup de creation admin
- saisie du wizard
- creation complete
- selection automatique de l'etablissement cree si prevu

### ADM-04 File de validation proprietaires

- chargement de la liste
- rafraichissement
- approbation d'une demande
- disparition de la demande approuvee
- traitement correct des erreurs

## 8.3 Dashboard

### DASH-01 Tableau de bord principal

- ouverture du dashboard overview
- chargement des widgets sans erreur
- navigation depuis les cartes si applicable

### DASH-02 Apercu calendrier

- ouverture de l'apercu calendrier
- cohence visuelle
- absence d'erreur de rendu

## 8.4 Etablissement

### ETAB-01 Profil etablissement

- consultation globale du profil
- affichage des informations principales
- affichage des relations utiles
- verification que le module reste une vue globale et non un poste d'administration complet

### ETAB-02 Sites

- liste des sites
- creation
- edition
- detail
- verifications de recherche, tri, pagination et suppression logique si disponible

### ETAB-03 Salles

- liste des salles
- creation
- edition
- detail
- verification du rattachement au site

### ETAB-04 Annee scolaire

- creation simple d'annee
- changement de statut
- nouvelle annee scolaire
- reprise des periodes si le wizard le permet
- verification des bornes de date

### ETAB-05 Initialisation

- chargement du status et des templates
- ouverture des 2 parcours
- preview sans commit
- commit du parcours initial
- commit d'une nouvelle annee scolaire
- verification des sessions historiques
- verification des warnings metier

### ETAB-06 Periodes

- creation de periodes
- edition
- detail
- verifications des dates
- ordre chronologique

### ETAB-07 Referentiels

- chargement des referentiels
- creation / edition / detail
- comportement de la vue detail recursive

## 8.5 Comptes et securite

### SEC-01 Utilisateurs

- liste, recherche, pagination
- creation utilisateur simple
- edition
- detail
- statut actif / inactif
- cohence avec etablissement courant

### SEC-02 Profils

- creation et edition de profil
- rattachement a l'utilisateur
- detail

### SEC-03 Roles

- creation role
- edition role
- detail
- copie de lien de creation si expose
- verification du scope et des permissions rattachees

### SEC-04 Permissions

- liste des permissions
- creation / edition
- affectation a un role
- verification de la prise d'effet

### SEC-05 Affectations et scope

- affectation de roles a un utilisateur
- retrait d'affectation
- verification du scope JSON
- verification des permissions explicites, refusees et heritees

## 8.6 Scolarite

### SCO-01 Eleves

- creation d'eleve
- edition
- detail complet
- chargement des relations principales

### SCO-02 Identifiants eleves

- creation
- unicite
- recherche par identifiant
- comportement avec eleve inactif ou absent

### SCO-03 Parents / tuteurs

- creation
- edition
- rattachement a un ou plusieurs eleves
- detail

### SCO-04 Niveaux

- creation
- edition
- ordre d'affichage
- coherence avec classes et programmes

### SCO-05 Classes

- creation
- edition
- detail
- rattachement a niveau et annee scolaire

### SCO-06 Inscriptions

- creation d'inscription
- changement de statut
- relation eleve / classe / annee
- detail

## 8.7 Personnel

### PERS-01 Personnels

- creation
- edition
- detail
- rattachement utilisateur et etablissement

### PERS-02 Enseignants

- creation a partir d'un personnel
- detail
- verification de l'unicite d'enseignant par personnel
- verification des listes filtrantes

### PERS-03 Departements

- creation
- edition
- detail
- relations avec matieres et enseignants

## 8.8 Pedagogie

### PED-01 Matieres

- creation
- edition
- coefficient
- rattachement a departement
- detail

### PED-02 Programmes

- creation
- edition
- detail
- lignes de programme
- coherence avec niveaux et matieres

### PED-03 Cours

- creation
- edition
- detail
- rattachement enseignant / matiere / classe / periode

### PED-04 Evaluations

- creation
- edition
- detail
- type d'evaluation
- bornes de notes

### PED-05 Notes

- saisie
- edition
- detail
- verification des calculs attendus
- gestion des relations depuis eleve, evaluation, bulletin

### PED-06 Bulletins

- creation
- consultation
- detail
- coherence des lignes et moyennes si calculees

### PED-07 Regles de notes

- creation
- edition
- detail
- application attendue dans les ecrans pedagogiques

## 8.9 Emploi du temps et calendrier

### EDT-01 Emploi du temps

- ouverture du module
- selection de la classe a planifier
- remplissage de la grille
- attribution d'un cours
- enregistrement
- confirmation visuelle d'enregistrement
- verification du bouton enregistrer stable et visible
- verification du popup centre a l'ecran

### EDT-02 Export PDF

- presence du bouton exporter
- comportement lorsqu'aucune donnee n'est enregistrable
- generation si la fonctionnalite est active

### EDT-03 Evenements et calendrier

- creation / edition / detail d'un evenement
- integration visuelle avec le calendrier

## 8.10 Presences

### PRES-01 Sessions d'appel

- creation de session
- edition
- detail
- rattachement classe / cours / date

### PRES-02 Presences eleves

- saisie des statuts
- edition
- detail
- coherence avec justificatifs

### PRES-03 Justificatifs

- creation
- rattachement a l'absence
- detail
- verification du motif

### PRES-04 Presences personnel

- creation
- edition
- detail
- coherence des statuts

## 8.11 Discipline

### DISC-01 Incidents

- creation
- edition
- detail
- rattachement eleve et contexte

### DISC-02 Sanctions

- creation
- edition
- detail
- coherence avec incident

### DISC-03 Recompenses

- creation
- edition
- detail
- coherence avec eleve et annee

## 8.12 Finance

### FIN-01 Dashboard finance

- ouverture
- chargement des indicateurs
- absence de crash

### FIN-02 Catalogue de frais

- creation
- edition
- detail
- rattachement niveau / annee / montant

### FIN-03 Remises

- creation
- edition
- detail
- effet attendu sur facture ou plan de paiement si applicable

### FIN-04 Factures

- creation
- edition limitee si autorisee
- detail complet
- statuts
- liens vers eleve, lignes, paiements

### FIN-05 Paiements

- enregistrement
- popup de confirmation
- detail
- impact sur statuts financiers

### FIN-06 Plans de paiement

- creation
- detail
- echeancier
- coherence avec facture et paiements

### FIN-07 Journal financier

- consultation
- filtrage
- coherence des mouvements avec paiements et operations

### FIN-08 Recouvrement

- chargement des dossiers
- statuts de recouvrement
- actions disponibles

### FIN-09 Flux automatiques

- verification des modules `finance-relance`
- verification de la facturation recurrente
- verification des operations financieres

## 8.13 Bibliotheque

### BIB-01 Ressources

- creation
- edition
- detail
- disponibilite

### BIB-02 Emprunts

- creation d'emprunt
- retour
- detail
- controle des dates et du statut

## 8.14 Transport et cantine

### TC-01 Transport

- gestion des lignes, arrets et abonnements si exposes dans les ecrans
- creation / edition / detail
- verification des statuts d'acces

### TC-02 Cantine

- gestion des formules et abonnements si exposes dans les ecrans
- creation / edition / detail
- verification des statuts d'acces

### TC-03 Coherence finance <-> services

- verifier qu'un abonnement transport ou cantine visible se rattache bien a l'eleve
- verifier les relations de detail avec la finance quand elles sont chargees

## 8.15 Composants transverses

### UI-01 DataTable

- affichage liste
- recherche
- pagination
- action voir
- action modifier
- action supprimer si disponible
- aucun clignotement ou fermeture intempestive

### UI-02 Vue detail recursive

- ouverture depuis un tableau
- affichage des champs simples
- sidebar de relations exhaustive
- ouverture d'une relation chargee
- ouverture d'une relation non hydratee avec chargement cible
- scroll remis en haut lors de l'ouverture d'une nouvelle entite
- accordions replies par defaut
- absence de chargement infini

### UI-03 Popups et panneaux

- centrage ecran et non page
- absence de scroll horizontal
- texte non tronque
- header compact
- fermeture accessible

### UI-04 Sidebar principal

- recherche
- bouton d'effacement
- ouverture d'un module et remontée visuelle
- groupe actif visuellement identifiable

### UI-05 Permissions visuelles

- boutons caches si non autorises
- menus caches si non autorises
- refus serveur coherent meme si une URL est forcee

## 9. Tests API a mener sur chaque module CRUD

Pour chaque ressource exposee par l'API, executer au minimum :

- GET liste avec pagination
- GET detail par id
- POST creation valide
- POST creation invalide
- PUT ou PATCH edition valide
- DELETE ou suppression logique si disponible
- filtre `where`
- `includes` simples
- controle de tenant
- refus si utilisateur non autorise

Ressources prioritaires :

- user
- roles
- roles_user
- profile
- permission
- etablissement
- site
- salle
- annee-scolaire
- initialisation-etablissement
- periode
- referenciel
- inscription
- classe
- niveau-scolaire
- parent-tuteur
- identifiantEleve
- eleve
- personnel
- enseignant
- departement
- matiere
- programme
- cours
- evaluation
- note
- bulletin
- regle-note
- emploi-du-temps
- evenement-calendrier
- creneau-horaire
- ligne-transport
- arret-transport
- formule-cantine
- abonnement-transport
- abonnement-cantine
- session-appel
- presence-eleve
- motif-absence
- justificatif-absence
- presence-personnel
- incident-disciplinaire
- sanction-disciplinaire
- recompense
- catalogue-frais
- remise
- facture
- paiement
- plan-paiement-eleve
- finance-relance
- facturation-recurrente
- operation-financiere
- finance-recouvrement
- ressource-bibliotheque
- emprunt

## 10. Tests de non regression specifiques aux derniers chantiers

### NRG-01 Initialisation - classes

- un niveau selectionne doit toujours pouvoir recevoir une ou plusieurs classes
- les suggestions initiales doivent s'afficher
- suppression et ajout de lignes doivent rester stables
- preview et commit doivent compter correctement les classes

### NRG-02 Initialisation - academique

- chaque niveau selectionne doit pouvoir porter un programme et plusieurs matieres
- les heures et coefficients doivent etre acceptes
- preview et commit doivent compter correctement les matieres, programmes et lignes

### NRG-03 Vue detail

- aucune relation ne doit rester indefiniment en chargement
- les erreurs 404 recuperables ne doivent pas casser la vue
- la vue imbriquee doit garder le meme standard que la vue racine

### NRG-04 Popups

- les popups doivent se centrer sur l'ecran
- les popups longs ne doivent pas provoquer de scroll horizontal
- le contenu doit rester lisible sur petite largeur

## 11. Tests de performance et robustesse

- listes chargees avec 100, 500 et 1000 lignes
- detail d'une entite avec nombreuses relations
- formulaire long avec relations multiples
- emploi du temps avec grille dense
- finance avec nombreuses lignes de facture
- comportement si l'API repond lentement
- comportement si une relation incluse n'existe plus

## 12. Tests de securite fonctionnelle

- tentative d'acceder a un etablissement non actif pour l'utilisateur
- tentative d'editer une entite hors scope
- tentative d'approbation admin avec un compte non admin
- tentative de creation par lien avec role_id invalide
- tentative d'ouverture d'un detail sur id appartenant a un autre tenant

## 13. Livrables attendus en sortie de recette

- journal d'execution des tests
- liste des anomalies avec criticite
- captures pour anomalies UI
- liste des cas reussis / echoues / bloques
- decision Go / No Go

## 14. Critere de sortie minimal

La version peut etre consideree recevable si :

- tous les cas P0 sont valides
- aucun bug critique de permission n'est ouvert
- aucun module implemente ne plante a l'ouverture
- les parcours creation, detail, edition et navigation sont stables
- les flux publics et admin sont coherents
- les modules finances, scolarite, pedagogie et emploi du temps ne presentent pas de regression bloquante

## 15. Recommandation de campagne

Ordre conseille d'execution :

1. Smoke global
2. Parcours publics et admin
3. Etablissement et initialisation
4. Comptes et securite
5. Scolarite
6. Personnel
7. Pedagogie
8. Emploi du temps
9. Presences
10. Discipline
11. Finance
12. Transport et cantine
13. Bibliotheque
14. Regression transversale UI/detail/popup/permissions

## 16. Traceabilite rapide par module

- Public et auth : implemente
- Admin plateforme : implemente
- Etablissement : implemente
- Initialisation etablissement : implemente partiellement mais exploitable
- Comptes et securite : implemente
- Scolarite : implemente
- Personnel : implemente
- Pedagogie : implemente
- Emploi du temps : implemente
- Presences : implemente
- Discipline : implemente
- Finance : implemente
- Bibliotheque : implemente
- Transport et cantine : implemente
- Communication : non retenu en recette complete
- Documents : non retenu en recette complete
- Audit et integrations : non retenu en recette complete

