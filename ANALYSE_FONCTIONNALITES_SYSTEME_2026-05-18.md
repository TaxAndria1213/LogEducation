# Analyse Des Fonctionnalites Du Systeme LogEducation

Date de redaction : 2026-05-18  
Base d'analyse : lecture statique du depot `frontend`, `src` et `mobile`  
Perimetre : cartographie des fonctionnalites exposees, des fonctionnalites indisponibles et plan de presentation du systeme

## 1. Objet Du Document

Ce document sert a :

- decrire l'etat fonctionnel reel du projet a partir du code
- distinguer les fonctionnalites disponibles des fonctionnalites encore indisponibles
- preparer une trame de presentation de l'ensemble du systeme
- faciliter une demonstration, un comite projet ou un cadrage de priorisation

L'analyse est statique. Elle repose sur :

- les routes frontend
- les pages React web
- les services frontend
- les routes backend Express
- l'application mobile
- la documentation interne deja presente dans le depot

Elle ne constitue pas une recette fonctionnelle complete en execution.

## 2. Vue D'Ensemble

LogEducation est un ERP scolaire modulaire organise autour d'un etablissement actif.

Le noyau fonctionnel est deja large et couvre principalement :

- parametrage d'etablissement
- securite et habilitations
- scolarite
- personnel
- pedagogie
- emploi du temps
- presences
- discipline
- finance
- bibliotheque
- transport et cantine
- une application mobile multi-role

Dans l'etat actuel du code, la majorite des modules metier web sont exposes et relies a des APIs. Les indisponibilites portent surtout sur :

- la communication interne
- l'audit et les integrations
- certaines briques documentaires generiques
- quelques popups ou espaces de consultation secondaires
- une partie des experiences mobiles encore reservees ou placeholders

## 3. Resume Executif

### 3.1 Fonctionnalites Globalement Disponibles

Les domaines suivants sont structurellement disponibles bout en bout, au moins au niveau CRUD ou workflow principal :

- `Etablissement`
- `Comptes & securite`
- `Scolarite`
- `Personnel`
- `Pedagogie`
- `Emploi du temps & calendrier`
- `Presences`
- `Discipline`
- `Finance`
- `Bibliotheque`
- `Transport & cantine`
- `Documents > Types d'inscription`

### 3.2 Fonctionnalites Clairement Indisponibles Ou Incompletes

Les points suivants sont les indisponibilites les plus nettes dans le depot :

- `Communication > Annonces`
- `Communication > Messagerie`
- `Communication > Notifications`
- `Communication > Canaux`
- `Audit & integrations > Journal audit`
- `Audit & integrations > Webhooks`
- `Audit & integrations > Jetons integrations`
- `Documents > Fichiers`
- `Documents > Liens fichiers`
- popup web `Messages`
- popup web `Notifications`
- messagerie enseignant mobile
- API systeme dediee (`/system-api`) sans routes fonctionnelles

### 3.3 Fonctionnalites Partiellement Disponibles

Certaines fonctionnalites existent mais avec des limites de maturite ou d'experience :

- automatisation de notifications selon les modules metier, mais sans module transversal de communication
- espace audit prevu dans l'initialisation, mais non materialise en module exploitable
- application mobile multi-role presente, mais certaines vues sont surtout des feeds de lecture et non des workflows riches
- parcours documents present dans les inscriptions, mais sans GED generique exposee dans le module `Documents`

## 4. Methodologie D'Analyse

L'identification a ete faite en croisant :

- les sous-modules declares dans `frontend/src/routes/modules`
- les routes effectivement generees dans `frontend/src/routes/routes.tsx`
- les pages React reliees aux sous-modules
- les services frontend declares dans `frontend/src/services`
- les APIs branchees dans `src/app/api/routes.ts`
- les modules backend reels dans `src/app/modules`
- les ecrans et services mobiles dans `mobile/src`

### Regle De Qualification Utilisee

Une fonctionnalite est consideree :

- `Disponible` si elle possede un point d'entree visible et un branchement fonctionnel coherent
- `Partielle` si elle existe mais reste limitee, reservee, fragile ou non aboutie dans l'experience
- `Indisponible` si elle est annoncee dans la navigation ou dans le produit mais sans ecran, sans route ou sans implementation exploitable

## 5. Fonctionnalites Disponibles Par Domaine

## 5.1 Accueil Et Navigation

Disponibles :

- page d'accueil modulaire
- recherche de modules
- sidebar par module
- contextualisation selon le role
- page `NotFound`
- rechargement des donnees via le header

Commentaire :

La navigation web est globalement bien structuree et centralise la plupart des modules metier.

## 5.2 Etablissement

Disponibles :

- profil d'etablissement
- assistant d'initialisation
- sites
- salles
- annees scolaires
- periodes
- referentiels
- configuration de navigation
- raccourci de suivi de demarrage

Commentaire :

Le module est mature et constitue clairement l'un des socles du produit.

## 5.3 Comptes & Securite

Disponibles :

- utilisateurs
- profils
- roles
- permissions
- affectations et scopes
- creation de comptes
- creation par lien
- gestion des proprietaires et approbations admin

Commentaire :

Le produit gere deja une logique multi-role avancee avec perimetres et habilitations fines.

## 5.4 Scolarite

Disponibles :

- eleves
- dossier eleve
- identifiants eleves
- parents et tuteurs
- niveaux
- classes
- inscriptions
- brouillons d'inscription
- resume d'inscription
- edition d'inscription
- reinscription
- documents d'inscription au niveau du dossier
- pieces et liaisons documentaires dans le flux d'inscription

Commentaire :

Le domaine scolarite fait partie des zones les plus riches du systeme.

## 5.5 Personnel

Disponibles :

- personnels
- enseignants
- departements

Commentaire :

Le module couvre les besoins de base RH et sert de dependance a la pedagogie et a l'emploi du temps.

## 5.6 Pedagogie

Disponibles :

- initialisation pedagogique
- structure pedagogique
- matieres
- types d'evaluation
- programmes
- cours
- evaluations
- notes
- resultats d'evaluation
- regles de notes
- modeles de bulletins
- bulletins
- generation, validation et publication des bulletins
- apercus et snapshots de bulletin
- echelles de notation et structure pedagogique exploitees par plusieurs workflows

Commentaire :

Le module pedagogique est l'un des plus avances du projet, avec une architecture qui supporte deja la structure hierarchique, les resultats multi-format et les bulletins dynamiques.

## 5.7 Emploi Du Temps Et Calendrier

Disponibles :

- emplois du temps
- creneaux horaires
- gestion de planning par classe
- controle de conflits
- evenements calendrier
- vues liste et dashboards planning

Commentaire :

Le module est exploitable et assez profond, en particulier sur la gestion des plannings.

## 5.8 Presences

Disponibles :

- sessions d'appel
- presences eleves
- justificatifs d'absence
- motifs d'absence
- presences personnel

Commentaire :

Le domaine presence est bien couvert sur le web et sert aussi de base a certaines vues mobiles.

## 5.9 Discipline

Disponibles :

- incidents
- sanctions
- recompenses

Commentaire :

Le module est structure et expose les workflows principaux de suivi comportemental.

## 5.10 Finance

Disponibles :

- dashboard finance
- catalogue de frais
- remises
- factures
- paiements
- plans de paiement
- journal financier
- recouvrement
- relances financieres
- facturation recurrente
- suivi des echeances
- rapprochement et regularisations
- liens avec transport et cantine

Commentaire :

Le module finance est largement implemente, avec des workflows avances deja visibles dans l'interface.

## 5.11 Bibliotheque

Disponibles :

- ressources bibliotheque
- emprunts
- retour d'emprunts

Commentaire :

Le module est plus restreint mais bien branche.

## 5.12 Transport Et Cantine

Disponibles :

- lignes de transport
- arrets de transport
- abonnements transport
- formules cantine
- abonnements cantine
- controles d'anomalies
- billing finance relie
- regularisations et historiques de changements

Commentaire :

Le domaine est deja tres metier et fortement relie a la finance.

## 5.13 Documents

Disponibles :

- types de documents d'inscription
- liaison avec le flux d'inscription
- upload et telechargement de documents dans le contexte inscription

Commentaire :

Le domaine `Documents` existe reellement pour l'inscription, mais pas encore comme gestion documentaire transverse complete.

## 5.14 Mobile

Disponibles :

- login mobile
- session et role actif
- navigation par role
- dashboard mobile multi-role
- agenda mobile
- feeds presences
- feeds academiques
- feeds operations
- parcours enseignant pour classes, evaluations et saisie de notes
- profil enseignant mobile

Commentaire :

L'application mobile est reelle et fonctionnelle, mais certains parcours restent plus legers que sur le web.

## 6. Fonctionnalites Indisponibles Ou Non Exposees

## 6.1 Communication

Etat :

- indisponible

Constat :

- le module est visible dans la navigation
- ses sous-entrees ont un `path`
- aucune page React n'est attachee aux sous-modules
- aucune route n'est donc generee pour eux

Sous-fonctionnalites indisponibles :

- annonces
- messagerie
- notifications
- canaux

Impact :

- le produit ne dispose pas encore d'un centre de communication transverse exploitable via le menu principal
- les notifications metier existent localement dans certains modules, mais pas comme experience utilisateur unifiee

## 6.2 Audit & Integrations

Etat :

- indisponible

Constat :

- le module est visible dans la navigation
- aucun sous-module n'a de composant React branche
- l'etape `Audit et notifications` de l'initialisation indique explicitement qu'elle reserve la place pour la suite

Sous-fonctionnalites indisponibles :

- journal audit
- webhooks
- jetons integrations

Impact :

- pas de supervision transverse des traces
- pas d'ecran pour integrer des connecteurs ou des webhooks
- pas de gouvernance visible des integrations

## 6.3 Documents Generiques

Etat :

- partiellement indisponible

Disponible :

- types de documents d'inscription

Indisponible :

- fichiers
- liens fichiers

Impact :

- la logique documentaire est focalisee sur les inscriptions
- il n'existe pas encore de GED ou de hub documentaire transverse expose dans le module `Documents`

## 6.4 Popups Web Messages Et Notifications

Etat :

- indisponible

Constat :

- les boutons `message` et `notification` sont affiches dans le header
- le store de popup ne reference que le composant `profil`

Impact :

- l'utilisateur voit les icones
- aucune experience reellement utile n'est fournie derriere ces boutons

## 6.5 API Systeme Dediee

Etat :

- indisponible

Constat :

- un serveur `system-api` existe
- sa classe de routing retourne un router vide

Impact :

- aucune fonctionnalite systeme separee n'est exploitable aujourd'hui via ce canal

## 6.6 Messagerie Enseignant Mobile

Etat :

- indisponible

Constat :

- l'ecran mobile existe
- le texte de l'ecran indique explicitement que les conversations, annonces et badges non lus seront branches plus tard

Impact :

- le role enseignant a une place reservee dans la navigation
- mais pas encore de vrai module conversationnel mobile

## 6.7 Communication Automatique Depuis Les Inscriptions

Etat :

- partielle

Constat :

- le formulaire d'inscription indique que le canal est memorise
- l'envoi automatique associe n'est pas encore branche

Impact :

- l'information de canal peut etre stockee
- mais le workflow de diffusion associe n'est pas encore concret

## 7. Fonctionnalites Partielles Ou A Maturite Intermediaire

## 7.1 Mobile Multi-Role

Etat :

- partiel a bon niveau

Constat :

- l'application mobile supporte plusieurs roles
- une partie importante du flux riche est surtout enseignant
- pour d'autres roles, certaines vues sont surtout des feeds ou listes de lecture

Implication :

- le mobile est presentable
- mais il faut l'aborder comme un compagnon metier, pas comme une couverture complete du web

## 7.2 Communication Metier Diffuse

Etat :

- partiel

Constat :

- plusieurs modules backend creent deja des `messages` et `notifications`
- cela ne se traduit pas encore par un module `Communication` utilisateur complet

Implication :

- le socle technique de notification existe partiellement
- l'orchestration et la visualisation produit manquent encore

## 7.3 Audit Metier Diffus

Etat :

- partiel

Constat :

- certaines traces d'audit existent dans des modules metier
- aucun espace transverse d'audit n'est expose dans l'interface

Implication :

- il existe de la matiere technique
- mais pas encore de module produit de consultation et gouvernance

## 7.4 Analyse D'Impact Et Richesse Pedagogique Avancee

Etat :

- disponible mais a surveiller

Constat :

- l'analyse d'impact des programmes, les snapshots de bulletin et les structures pedagogiques avancees sont bien branches
- certaines interfaces prevoient des messages d'erreur quand les donnees riches ne sont pas encore disponibles

Implication :

- ce n'est pas une absence structurelle
- c'est plutot une zone avancee a presenter avec prudence en demonstration

## 8. Priorisation Des Indisponibilites

## 8.1 Priorite Haute

- `Communication`
- `Audit & integrations`
- popups web `messages` et `notifications`

Raison :

- ce sont des zones visibles par l'utilisateur dans la navigation ou le header
- leur presence sans fonctionnalite peut creer une impression d'inacheve

## 8.2 Priorite Moyenne

- `Documents > Fichiers`
- `Documents > Liens fichiers`
- messagerie mobile enseignant

Raison :

- la place produit existe
- les usages sont compréhensibles
- mais ils ne cassent pas le coeur ERP actuel

## 8.3 Priorite Technique / Plateforme

- `system-api`
- exposition transverse des journaux et traces
- industrialisation des notifications et canaux

Raison :

- ces sujets renforcent la robustesse et la valeur plateforme
- mais ne bloquent pas les flux coeur deja exploitables

## 9. Plan De Presentation Recommande Du Systeme

Ce plan est concu pour une presentation produit complete, logique et progressive.

## 9.1 Introduction

Objectif :

- presenter LogEducation comme une plateforme de gestion scolaire modulaire centree sur un etablissement actif

Messages cles :

- systeme multi-role
- architecture modulaire
- forte profondeur metier
- coexistence web et mobile

## 9.2 Parcours D'Acces Et Gouvernance

Modules a presenter :

- `Accueil`
- `Comptes & securite`
- `Admin`

Points a montrer :

- connexion
- selection du contexte d'etablissement
- comptes, profils, roles, permissions, scopes
- creation de proprietaire et approbations

Objectif de la sequence :

- installer la logique de gouvernance et de securite du produit

## 9.3 Socle Etablissement

Modules a presenter :

- `Etablissement > Profil`
- `Etablissement > Initialisation`
- `Sites`
- `Salles`
- `Annees scolaires`
- `Periodes`
- `Referentiels`
- `Configuration navigation`

Points a montrer :

- creation du socle
- annee active
- organisation structurelle
- parametres de base

Objectif de la sequence :

- montrer que le systeme peut etre mis en service proprement

## 9.4 Vie Administrative Scolaire

Modules a presenter :

- `Scolarite > Eleves`
- `Identifiants`
- `Parents/Tuteurs`
- `Niveaux`
- `Classes`
- `Inscriptions`
- `Brouillons d'inscription`

Points a montrer :

- dossier eleve
- lien avec les parents
- gestion de la structure scolaire
- parcours complet d'inscription
- documents lies au dossier

Objectif de la sequence :

- faire comprendre le coeur administratif du produit

## 9.5 Ressources Humaines Et Acteurs Pedagogiques

Modules a presenter :

- `Personnel > Personnels`
- `Enseignants`
- `Departements`

Points a montrer :

- base du personnel
- distinction enseignants / autres personnels
- structuration par departement

Objectif de la sequence :

- montrer comment les acteurs du systeme sont prepares pour l'exploitation metier

## 9.6 Pedagogie Et Production Academique

Modules a presenter :

- `Pedagogie > Initialisation`
- `Structure pedagogique`
- `Matieres`
- `Types d'evaluation`
- `Programmes`
- `Cours`
- `Evaluations`
- `Notes`
- `Regles de notes`
- `Modeles de bulletins`
- `Bulletins`

Points a montrer :

- preparation pedagogique
- programmes et cours
- saisie des evaluations
- resultats et notes
- structure pedagogique hierarchique
- templates de bulletins
- generation, validation et publication

Objectif de la sequence :

- illustrer la profondeur academique du produit

## 9.7 Emploi Du Temps Et Calendrier

Modules a presenter :

- `Emploi du temps`
- `Evenements & calendrier`

Points a montrer :

- creneaux
- planification par classe
- gestion de conflits
- calendrier d'evenements

Objectif de la sequence :

- montrer la planification operationnelle

## 9.8 Presences Et Discipline

Modules a presenter :

- `Presences > Sessions d'appel`
- `Presences eleves`
- `Justificatifs`
- `Presences personnel`
- `Discipline > Incidents`
- `Sanctions`
- `Recompenses`

Points a montrer :

- appel
- controle des absences
- justification
- suivi comportemental

Objectif de la sequence :

- couvrir la vie scolaire quotidienne

## 9.9 Finance

Modules a presenter :

- `Finance > Dashboard`
- `Catalogue de frais`
- `Remises`
- `Factures`
- `Paiements`
- `Plans de paiement`
- `Journal financier`
- `Recouvrement`

Points a montrer :

- suivi des echeances
- generation de factures
- encaissements
- regularisations
- relances
- facturation recurrente
- passerelles avec transport et cantine

Objectif de la sequence :

- montrer la capacite du systeme a gerer la chaine economique d'un etablissement

## 9.10 Services Aux Eleves

Modules a presenter :

- `Transport & cantine`
- `Bibliotheque`

Points a montrer :

- lignes et arrets de transport
- abonnements
- formules cantine
- consommations et controles
- ressources bibliotheque
- emprunts

Objectif de la sequence :

- illustrer les services peripheriques deja integres au coeur ERP

## 9.11 Documents

Modules a presenter :

- `Documents > Types d'inscription`
- parcours documentaire dans `Scolarite > Inscriptions`

Points a montrer :

- parametrage des types de pieces
- upload et suivi des documents d'inscription

Objectif de la sequence :

- presenter le perimetre reel sans survendre une GED globale non encore disponible

## 9.12 Mobile

Modules a presenter :

- login mobile
- changement de role
- dashboard mobile
- agenda
- presences
- academics
- operations
- parcours enseignant

Points a montrer :

- experience compagnon
- acces rapide terrain
- flux enseignant les plus aboutis

Objectif de la sequence :

- montrer l'extension mobile du systeme

## 9.13 Cloture De Presentation

Clore la presentation avec :

- ce qui est deja exploitable en production pilote
- ce qui est visible mais encore reserve
- ce qui constitue les prochaines extensions naturelles

## 10. Plan Court De Soutenance

Si une presentation doit durer entre 10 et 15 minutes, l'ordre recommande est :

1. vision du produit
2. securite et gouvernance
3. initialisation d'etablissement
4. scolarite
5. pedagogie
6. finance
7. transport, cantine, bibliotheque
8. mobile
9. limites actuelles et priorites

## 11. Plan Long De Demonstration

Si une demonstration doit durer entre 20 et 40 minutes, l'ordre recommande est :

1. connexion et navigation
2. creation et parametrage d'etablissement
3. habilitations et comptes
4. parcours d'inscription eleve
5. preparation du personnel enseignant
6. construction pedagogique
7. creation d'une evaluation et saisie de notes
8. generation d'un bulletin
9. emploi du temps
10. presences et discipline
11. circuit financier
12. transport et cantine
13. bibliotheque
14. mobile
15. indisponibilites connues et roadmap

## 12. Recommandations Produit

### Recommandation 1

Masquer ou neutraliser clairement les modules non branches :

- `Communication`
- `Audit & integrations`
- `Documents > Fichiers`
- `Documents > Liens fichiers`

But :

- eviter une promesse utilisateur prematuree

### Recommandation 2

Terminer rapidement au moins une premiere version de :

- centre de notifications
- centre de messages

But :

- aligner l'interface visible avec les capacites techniques deja presentes en partie

### Recommandation 3

Transformer l'audit diffus en module produit :

- consultation des journaux
- traces sensibles
- evenements systeme

But :

- renforcer la gouvernance et la credibilite plateforme

### Recommandation 4

Consolider la vision documentaire transverse.

But :

- sortir d'une logique uniquement centree sur l'inscription

### Recommandation 5

Positionner officiellement le mobile comme :

- soit une application compagnon
- soit un canal prioritaire par role

But :

- clarifier les attentes fonctionnelles selon les profils

## 13. Conclusion

LogEducation est deja un systeme ERP scolaire dense, modulaire et tres avance sur plusieurs domaines critiques :

- securite
- scolarite
- pedagogie
- finance
- services scolaires

L'etat actuel du projet montre un produit deja presentable et demo-compatible sur son coeur metier.

Les principales zones indisponibles ne remettent pas en cause ce coeur. Elles concernent surtout :

- la communication transverse
- l'audit et les integrations
- certaines experiences secondaires visibles mais non encore branchees

Le systeme peut donc etre presente comme :

- un ERP scolaire deja riche et operationnel sur ses parcours majeurs
- avec une roadmap claire sur les modules transverses encore incomplets
