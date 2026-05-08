# Backlog Notes & Bulletins

## Objectif

Transformer le socle actuel `Evaluations -> Notes -> Bulletin simple` en moteur metier `Evaluations -> Notes -> Moyennes -> Appreciations -> Bulletins -> Validation -> Publication`.

Ce backlog part du code reel present dans :

- `prisma/schema.prisma:827`
- `src/app/modules/evaluation/application/evaluation.app.ts:46`
- `src/app/modules/note/application/note.app.ts:38`
- `src/app/modules/bulletin/application/bulletin.app.ts:54`
- `src/app/modules/enseignant/application/enseignant.app.ts:56`
- `src/app/modules/regle_note/application/regle_note.app.ts:1`
- `src/app/api/routes.ts:230`
- `frontend/src/pages/pedagogie/notes/store/NoteCreateStore.tsx:67`
- `frontend/src/services/bulletin.service.ts:48`
- `mobile/src/services/teacherMobile.service.ts:22`

## Matrice cible -> actuel -> ecart -> ticket

| Domaine cible | Code actuel | Ecart principal | Ticket technique |
| --- | --- | --- | --- |
| Assessment type metier | `TypeEvaluationRef` ne porte que `nom` et `poids_defaut` dans `prisma/schema.prisma:827` | Pas de `default_max_score`, `include_in_average`, `is_active`, `annee_scolaire_id`, ordre ni archivage | `NB-001 - Normaliser AssessmentType et ajouter regles d'activation par annee` |
| Assessment workflow | `Evaluation` porte `type`, `note_max`, `poids`, `est_publiee`, `cree_par_enseignant_id` dans `prisma/schema.prisma:842`; validations utiles dans `evaluation.app.ts:71` et `evaluation.app.ts:224` | Pas de statuts metier `DRAFT/PUBLISHED/VALIDATED/LOCKED/ARCHIVED`, pas de verrou metier ni publication reelle | `NB-002 - Ajouter workflow d'evaluation et verrous de modification` |
| Grade metier | `Note` ne porte que `score`, `commentaire`, `note_le`, `note_par` dans `prisma/schema.prisma:870`; controles `note <= note_max` et appartenance classe dans `note.app.ts:215` | Pas de `status`, `absence_state`, `is_validated`, `validated_at`, `validated_by`, `locked_at` | `NB-003 - Enrichir Note avec statuts, cas d'absence et validation` |
| Historique sensible | Aucun modele d'historique; les updates de note ecrasent l'etat courant dans `note.app.ts:386` | Pas d'audit metier par champ ni de motif de modification | `NB-004 - Creer GradeHistory et journaliser create/update/validate/unlock` |
| Regles de calcul | `RegleNote` est un conteneur JSON CRUD dans `prisma/schema.prisma:889` et `regle_note.app.ts:1` | Pas de moteur versionne et interrogeable pour coefficients, seuils, mentions, exclusions | `NB-005 - Remplacer RegleNote JSON par modele de GradeRule normalise` |
| Subject averages persistees | Les moyennes matiere sont calculees a la volee dans `bulletin.app.ts:248` | Aucune persistence de moyenne matiere, points, coefficient, rang, statut de calcul | `NB-006 - Ajouter SubjectAverage et service transactionnel de calcul` |
| Bulletin coeur metier | `Bulletin` ne stocke que `eleve_id`, `periode_id`, `classe_id`, `publie_le`, `statut` dans `prisma/schema.prisma:904` | Manquent moyenne generale, total points, total coefficients, rang general, mention, decision, validation, publication | `NB-007 - Etendre Bulletin en ReportCard metier complet` |
| Bulletin lines | `BulletinLigne` ne stocke que `matiere`, `moyenne`, `rang`, `commentaire_enseignant` dans `prisma/schema.prisma:925` | Manquent `cours_id`, `enseignant_id`, `coefficient`, `points`, statut appreciation, source de calcul | `NB-008 - Etendre BulletinLigne en ReportCardLine metier` |
| Appreciations structurees | Les remarques enseignant sont fusionnees dans `commentaire_enseignant` et exploitees comme tel dans `bulletin.app.ts:326` et `enseignant.app.ts:409` | Appreciation matiere et appreciation generale non distinctes, non validees, non publiees | `NB-009 - Creer ReportCardAppreciation et workflow de validation` |
| Calcul moyenne generale | `bulletin.app.ts:248` normalise sur 20 et pondere seulement par `poids` d'evaluation; `frontend/src/services/bulletin.service.ts:48` calcule une moyenne arithmetique simple des lignes | Pas de prise en compte du coefficient matiere ni de centralisation du calcul | `NB-010 - Centraliser le calcul de moyenne generale ponderee cote backend` |
| Rangs avec egalites | `bulletin.app.ts:292` calcule le rang par index dans la liste triee | Les ex aequo recoivent des rangs differents | `NB-011 - Implementer algorithme de rang dense ou competition rank configurable` |
| Scope annee scolaire | Le mobile enseignant charge l'annee active via `enseignant.app.ts:138`; le store note web charge large via `NoteCreateStore.tsx:67` | Le backend ne force pas partout l'annee active ou la coherence periode/annee pour tous les flux | `NB-012 - Rendre l'annee scolaire active obligatoire dans les flux de notes et bulletins` |
| Inscriptions eligibles | Le mobile filtre `INSCRIT` et `VALIDEE` dans `enseignant.app.ts:56`; `bulletin.app.ts:333` recharge les eleves de classe sans filtre de statut | Les bulletins peuvent inclure des eleves non eligibles ou sortis | `NB-013 - Normaliser les criteres d'eligibilite eleve pour notes et bulletins` |
| Permissions enseignant web | Les CRUD `evaluation` et `note` sont scopes etablissement dans `evaluation.app.ts:46` et `note.app.ts:38` | Pas de restriction "enseignant proprietaire" sur le web generique | `NB-014 - Ajouter ownership enseignant sur evaluation/note hors administration` |
| Bulk grade entry | Le mobile expose `grade-sheet` dans `enseignant.app.ts:83` et `teacherMobile.service.ts:80`; le web reste mono-note | Pas d'endpoint generique bulk-save partageable entre web et mobile | `NB-015 - Exposer /grades/bulk-save transactionnel et mutualiser les clients` |
| Grade validation | Aucun endpoint `validate`, `unlock`, `publish` sur les notes | Pas de workflow de visa enseignant / administration | `NB-016 - Ajouter endpoints de validation et verrouillage des notes` |
| Bulletin validation/publication | Le bulletin passe surtout par `regenerateBulletinLines(..., true)` dans `bulletin.app.ts:383` et positionne `statut`/`publie_le` | Pas de separation entre generer, valider, publier, depublier | `NB-017 - Ajouter workflow bulletin generate/validate/publish/unpublish` |
| API cible unifiee | Les routes exposees sont surtout `/evaluation`, `/note`, `/bulletin`, `/regle-note`, `/enseignant` dans `src/app/api/routes.ts:230` | Les contrats metier manquent presque tous | `NB-018 - Creer facade API notes-bulletins orientee workflow` |
| Dashboard metier | Overviews existants mais basiques; `notes-overview` mobile existe deja dans `enseignant.app.ts:77` | Pas de dashboard "notes manquantes / bulletins prets / appreciations manquantes / validations en attente" | `NB-019 - Construire dashboard Notes & Bulletins pour admin et enseignant` |
| Publication parent/eleve | Aucun canal de publication robuste ni PDF lot | Pas de diffusion controlee ni historique de consultation | `NB-020 - Ajouter publication, PDF classe/ZIP et acces parent-eleve` |

## Tickets detailles

### Epic A - Modele de donnees

#### NB-001 - Normaliser AssessmentType et ajouter regles d'activation par annee
- But: enrichir `TypeEvaluationRef`.
- Cible schema:
  - `default_max_score`
  - `default_weight`
  - `include_in_average`
  - `is_active`
  - `annee_scolaire_id`
  - `sort_order`
  - `archived_at`
- Impacts:
  - `prisma/schema.prisma`
  - `evaluation.app.ts`
  - formulaires web/mobile
- Critere d'acceptation:
  - un type peut etre desactive sans casser l'historique
  - un type peut proposer ses valeurs par defaut a la creation d'evaluation

#### NB-003 - Enrichir Note avec statuts, cas d'absence et validation
- But: transformer la note en entite metier.
- Cible schema:
  - enum `GradeStatus`
  - enum `GradeEntryState` ou `GradeAttendanceState`
  - `status`
  - `absence_state`
  - `is_validated`
  - `validated_at`
  - `validated_by`
  - `locked_at`
  - `locked_by`
- Impacts:
  - `prisma/schema.prisma`
  - `note.app.ts`
  - `enseignant.app.ts`
  - ecrans de saisie web/mobile
- Critere d'acceptation:
  - une note peut etre `DRAFT`, `SUBMITTED`, `VALIDATED`, `LOCKED`
  - un score n'est pas obligatoire pour `ABSENT`, `DISPENSE`, `NON_RENDU`, `NON_EVALUE`

#### NB-004 - Creer GradeHistory et journaliser create/update/validate/unlock
- But: conserver les mutations sensibles.
- Cible schema:
  - `GradeHistory`
  - `note_id`
  - `action`
  - `old_value_json`
  - `new_value_json`
  - `changed_by`
  - `reason`
- Impacts:
  - `note.app.ts`
  - futur service `notes-bulletins`
- Critere d'acceptation:
  - chaque modification sensible d'une note cree une ligne d'historique

#### NB-006 - Ajouter SubjectAverage et service transactionnel de calcul
- But: sortir le calcul bulletin d'un calcul ad hoc.
- Cible schema:
  - `SubjectAverage`
  - `eleve_id`, `periode_id`, `matiere_id`, `cours_id`
  - `average_on_20`
  - `evaluation_weight_total`
  - `subject_coefficient`
  - `points`
  - `rank`
  - `status`
- Impacts:
  - `bulletin.app.ts`
  - futur service central de calcul
- Critere d'acceptation:
  - les moyennes matiere sont recalculables et persistantes

#### NB-007 - Etendre Bulletin en ReportCard metier complet
- But: rendre le bulletin autoporteur.
- Cible schema:
  - `general_average`
  - `total_points`
  - `total_coefficients`
  - `general_rank`
  - `mention`
  - `decision`
  - `validated_at`
  - `validated_by`
  - `published_at`
  - `published_by`
  - `appreciation_generale`
- Critere d'acceptation:
  - le frontend ne recalcule plus la moyenne generale a la volee

#### NB-008 - Etendre BulletinLigne en ReportCardLine metier
- But: stocker la ligne calculee et sa provenance.
- Cible schema:
  - `cours_id`
  - `enseignant_id`
  - `coefficient`
  - `points`
  - `average_on_20`
  - `rank`
  - `teacher_comment_status`
- Critere d'acceptation:
  - une ligne de bulletin est suffisante pour PDF, consultation et audit

#### NB-009 - Creer ReportCardAppreciation et workflow de validation
- But: separer l'appreciation du commentaire libre.
- Cible schema:
  - `ReportCardAppreciation`
  - `bulletin_id`
  - `bulletin_ligne_id` nullable pour appreciation generale
  - `scope` MATIERE ou GENERAL
  - `teacher_id`
  - `content`
  - `status`
  - `validated_at`, `validated_by`
- Critere d'acceptation:
  - l'ecran "appreciations manquantes" ne depend plus de `bulletinLigne.commentaire_enseignant`

### Epic B - Moteur de calcul

#### NB-010 - Centraliser le calcul de moyenne generale ponderee cote backend
- Probleme actuel:
  - `bulletin.app.ts:248` pondere seulement par `poids` d'evaluation
  - `frontend/src/services/bulletin.service.ts:48` fait une moyenne simple des lignes
- Travail:
  - calculer moyenne matiere sur 20
  - appliquer coefficient matiere
  - calculer `points = moyenne * coefficient`
  - calculer moyenne generale = `sum(points) / sum(coefficients)`
- Critere d'acceptation:
  - web et mobile lisent la meme moyenne generale depuis l'API

#### NB-011 - Implementer algorithme de rang dense ou competition rank configurable
- Probleme actuel:
  - `bulletin.app.ts:292` derive le rang via `findIndex`
- Travail:
  - introduire une strategie de rang centralisee
  - prendre en charge les ex aequo
  - rendre la strategie configurable si besoin
- Critere d'acceptation:
  - `14, 14, 13` donne `1, 1, 3` ou `1, 1, 2` selon la regle choisie

#### NB-013 - Normaliser les criteres d'eligibilite eleve pour notes et bulletins
- Probleme actuel:
  - `enseignant.app.ts:56` filtre les statuts actifs
  - `bulletin.app.ts:333` ne filtre pas les inscriptions eligibles
- Travail:
  - centraliser une fonction `isActiveAcademicEnrollment`
  - l'utiliser dans notes, bulletins et mobile
- Critere d'acceptation:
  - un eleve sorti ou annule est exclu des calculs

### Epic C - Workflow metier

#### NB-002 - Ajouter workflow d'evaluation et verrous de modification
- Travail:
  - ajouter `status` sur `Evaluation`
  - interdire modification d'une evaluation `LOCKED` ou deja validee
  - controler la publication logique separement du simple bool `est_publiee`

#### NB-016 - Ajouter endpoints de validation et verrouillage des notes
- Contrats cibles:
  - `POST /api/grades/bulk-save`
  - `POST /api/grades/validate`
  - `POST /api/grades/unlock`
  - `GET /api/grades/:id/history`
- Critere d'acceptation:
  - impossible d'editer une note verrouillee sans permission explicite

#### NB-017 - Ajouter workflow bulletin generate/validate/publish/unpublish
- Probleme actuel:
  - `bulletin.app.ts:383` regenere et peut publier dans le meme flux
- Contrats cibles:
  - `POST /api/report-cards/:id/generate`
  - `POST /api/report-cards/:id/validate`
  - `POST /api/report-cards/:id/publish`
  - `POST /api/report-cards/:id/unpublish`
- Critere d'acceptation:
  - generation, validation et publication deviennent des actions distinctes

### Epic D - Permissions et scope

#### NB-012 - Rendre l'annee scolaire active obligatoire dans les flux de notes et bulletins
- Probleme actuel:
  - mobile: bonne base via `enseignant.app.ts:138`
  - web note: options chargees trop large dans `frontend/src/pages/pedagogie/notes/store/NoteCreateStore.tsx:67`
- Travail:
  - forcer annee active ou annee de la periode cote backend
  - propager ce scope cote frontend
- Critere d'acceptation:
  - aucune note ne peut etre creee hors annee/periode autorisee

#### NB-014 - Ajouter ownership enseignant sur evaluation/note hors administration
- Probleme actuel:
  - `evaluation.app.ts` et `note.app.ts` sont surtout scopes etablissement
- Travail:
  - distinguer droits admin, direction, enseignant createur, enseignant du cours
  - reutiliser la logique de `enseignant.app.ts` pour resoudre les cours du professeur
- Critere d'acceptation:
  - un enseignant web ne modifie que ses cours, sauf delegation explicite

### Epic E - API et UX

#### NB-015 - Exposer /grades/bulk-save transactionnel et mutualiser les clients
- Probleme actuel:
  - le mobile a un flux robuste `grade-sheet`
  - le web reste mono-note
- Travail:
  - extraire la logique bulk depuis `enseignant.app.ts`
  - creer un endpoint partage
  - brancher web et mobile dessus
- Critere d'acceptation:
  - un enseignant saisit toute une feuille de notes en un seul envoi

#### NB-018 - Creer facade API notes-bulletins orientee workflow
- Routes actuelles:
  - `src/app/api/routes.ts:230`
  - `src/app/api/routes.ts:236`
  - `src/app/api/routes.ts:237`
  - `src/app/api/routes.ts:238`
  - `src/app/api/routes.ts:239`
- Contrats a ajouter:
  - `/api/assessment-types`
  - `/api/grades/bulk-save`
  - `/api/grades/validate`
  - `/api/grades/:id/history`
  - `/api/subject-averages/calculate`
  - `/api/report-cards/:id/generate`
  - `/api/report-cards/:id/validate`
  - `/api/report-cards/:id/publish`
  - `/api/report-cards/dashboard`

#### NB-019 - Construire dashboard Notes & Bulletins pour admin et enseignant
- Travail:
  - KPI classes completes
  - notes manquantes
  - appreciations manquantes
  - bulletins prets a valider
  - bulletins publies

#### NB-020 - Ajouter publication, PDF classe/ZIP et acces parent-eleve
- Travail:
  - PDF unitaire
  - PDF par classe
  - export lot ZIP
  - etat de publication
  - journal de consultation si necessaire

## Tranche specifique - Affichage detaille dans le bulletin

### Matrice cible vs etat actuel

| Point cible | Etat actuel | Statut |
| --- | --- | --- |
| Distinguer calcul des notes et affichage bulletin | Le calcul et l'affichage sont maintenant separes; le bulletin persiste un `display_snapshot_json` et un `report_card_template_id` | `Bon socle` |
| Types de bulletin `STANDARD`, `DETAILED`, `ASSESSMENT_TYPE_SUMMARY`, `FINAL_EXAM_ONLY`, `CUSTOM` | Le schema, les CRUD et l'initialisation les prennent en charge | `Couvert` |
| Drapeaux d'affichage sur l'evaluation `include_in_average`, `show_in_report_card`, `is_final_exam` | Les colonnes existent sur `Evaluation` et `TypeEvaluationRef`; web/mobile les exposent | `Couvert` |
| Modele de bulletin par defaut modifiable par l'etablissement | Present via `ReportCardTemplate` et `set-default` | `Couvert` |
| Historiser le modele utilise par bulletin publie | Le bulletin stocke deja le snapshot et la reference du modele | `Couvert` |
| Validation backend `show_only_final_exam => au moins une evaluation finale` | Le moteur ajoute des warnings, mais ne bloque pas encore proprement selon workflow | `Partiel` |
| Validation backend `show_assessment_details => au moins une evaluation visible` | Le moteur sait masquer, mais ne refuse pas encore explicitement un modele incoherent | `Partiel` |
| Afficher uniquement les evaluations validees/publiees selon la politique etablissement | Le code se base aujourd'hui surtout sur `est_publiee`, sans vrai statut metier `VALIDATED/PUBLISHED` | `Partiel fort` |
| Endpoint de preview du modele avant generation | Absent | `Absent` |
| Application d'un modele a un niveau | Le schema a `niveau_scolaire_id`, mais pas encore de route metier d'application | `Partiel` |
| Application d'un modele a une classe | Pas de `classe_id` sur `ReportCardTemplate`, donc pas de scope classe natif | `Absent` |
| Ecran de preview vivant du bulletin | Le CRUD des modeles existe, mais pas de preview temps reel type `LiveReportCardPreview` | `Absent` |
| Endpoint dedie `PUT /assessments/:id/display-settings` | Les drapeaux passent par le CRUD evaluation general | `Absent` |
| PDF backend/base API `GET /report-cards/:id/pdf` | Le frontend sait generer un PDF depuis les donnees chargees, mais pas de contrat backend dedie | `Partiel` |
| Canal parent/eleve: voir les details seulement si autorises | Pas de canal de diffusion final ni de permission metier parent/eleve sur cette granularite | `Absent` |
| Regles d'absences et retards visibles dans le bulletin | Le template porte les switches, mais les donnees ne sont pas encore branchees dans le snapshot bulletin | `Partiel fort` |

### Tickets dedies

#### NB-021 - Ajouter preview metier des modeles de bulletin
- But: previsualiser le rendu avant generation ou publication.
- Backend:
  - `POST /api/report-card-template/:id/preview`
  - payload minimal: `eleve_id`, `periode_id` ou `classe_id + eleve_id`
- Frontend:
  - `ReportCardTemplatePreviewPage`
  - composant `LiveReportCardPreview`
- Critere d'acceptation:
  - un admin voit immediatement ce qui sera affiche ou masque selon le modele choisi

#### NB-022 - Ajouter un endpoint dedie pour les reglages d'affichage d'une evaluation
- But: ne pas faire porter les reglages d'affichage par le CRUD complet de l'evaluation.
- Backend:
  - `PUT /api/assessments/:id/display-settings`
- Champs:
  - `include_in_average`
  - `show_in_report_card`
  - `is_final_exam`
- Critere d'acceptation:
  - un enseignant autorise peut ajuster l'affichage bulletin d'une evaluation sans rouvrir tout le formulaire

#### NB-023 - Introduire un vrai workflow de statut pour les evaluations
- Probleme actuel:
  - l'affichage detaille depend surtout de `est_publiee`
- But:
  - distinguer `DRAFT`, `VALIDATED`, `PUBLISHED`, `LOCKED`
- Impacts:
  - `Evaluation`
  - `evaluation.app.ts`
  - moteur bulletin
- Critere d'acceptation:
  - une evaluation non validee ne peut pas etre affichee dans un bulletin si la politique l'interdit

#### NB-024 - Rendre les validations de template bloquantes et explicites
- But: transformer les warnings du moteur en vraies validations metier avant publication.
- Cas a couvrir:
  - `show_only_final_exam = true` sans evaluation finale visible
  - `show_assessment_details = true` sans evaluation visible
  - matiere sans coefficient si points ou moyenne generale ponderee requis
- Critere d'acceptation:
  - le systeme retourne un message metier clair au lieu de generer un bulletin incoherent

#### NB-025 - Ajouter le scope `classe` pour les modeles de bulletin
- Probleme actuel:
  - `ReportCardTemplate` a `niveau_scolaire_id`, mais pas `classe_id`
- But:
  - permettre `apply-to-class`
  - priorite de resolution: `classe > niveau > annee`
- Impacts:
  - `prisma/schema.prisma`
  - `report_card_template.app.ts`
  - moteur de resolution du template lors de la generation bulletin
- Critere d'acceptation:
  - une classe peut avoir un modele specifique sans impacter tout le niveau

#### NB-026 - Ajouter les routes d'application de modele
- Backend:
  - `POST /api/report-card-template/:id/apply-to-level`
  - `POST /api/report-card-template/:id/apply-to-class`
- But:
  - eviter les manipulations manuelles sur chaque enregistrement
- Critere d'acceptation:
  - l'administration peut propager un modele en une action ciblee

#### NB-027 - Construire l'UI avancee des modeles de bulletin
- Ecrans:
  - `ReportCardTemplateListPage`
  - `ReportCardTemplateFormPage`
  - `ReportCardTemplatePreviewPage`
  - `ReportCardPDFViewer`
- Composants:
  - `TemplateTypeSelector`
  - `DisplayOptionSwitch`
  - `ReportCardColumnSelector`
  - `DefaultTemplateBadge`
  - `ReportCardPreviewTable`
- Critere d'acceptation:
  - l'utilisateur peut configurer un modele sans passer par interpretation technique des champs

#### NB-028 - Brancher absences et retards dans le snapshot bulletin
- Probleme actuel:
  - `show_absences` et `show_late_count` existent dans le template, mais pas encore dans les donnees de rendu
- But:
  - injecter les compteurs ou resumes adequats dans `display_snapshot_json`
- Dependances:
  - module presence
  - regles de periode
- Critere d'acceptation:
  - si le template l'autorise, le bulletin affiche les absences/retards consolides de la periode

#### NB-029 - Ajouter un vrai contrat PDF bulletin cote backend
- Backend:
  - `GET /api/report-cards/:id/pdf`
  - `GET /api/classes/:classId/terms/:termId/report-cards/pdf`
- But:
  - standardiser l'export et le rendre independent du rendu local frontend
- Critere d'acceptation:
  - le meme rendu PDF peut etre telecharge, imprime ou archive en lot

#### NB-030 - Exposer les bulletins publies aux parents/eleves avec filtrage du detail
- But:
  - rendre visible le bulletin publie uniquement
  - respecter le niveau de detail autorise par le template
- Travail:
  - routes de consultation
  - permissions parent/eleve
  - eventuel journal de consultation
- Critere d'acceptation:
  - un parent ne voit jamais des details masques par le modele de bulletin

### Priorites recommandees pour cette tranche

1. `NB-023 - Workflow de statut des evaluations`
2. `NB-024 - Validations bloquantes des templates`
3. `NB-021 - Preview metier des modeles`
4. `NB-022 - Endpoint display-settings sur assessment`
5. `NB-025 - Scope classe`
6. `NB-026 - Apply-to-level / apply-to-class`
7. `NB-028 - Absences / retards dans le snapshot`
8. `NB-029 - PDF backend`
9. `NB-030 - Diffusion parent / eleve`

### Lecture rapide

- Si tu veux livrer vite: commence par `NB-023`, `NB-024`, `NB-021`, `NB-022`.
- Si tu veux livrer proprement la configuration etablissements: ajoute ensuite `NB-025` et `NB-026`.
- Si tu veux finir le produit jusqu'au bout: termine avec `NB-028`, `NB-029`, `NB-030`.

## Ordre de livraison recommande

1. `NB-001`, `NB-003`, `NB-004`, `NB-006`, `NB-007`, `NB-008`, `NB-009`
2. `NB-010`, `NB-011`, `NB-013`
3. `NB-002`, `NB-016`, `NB-017`
4. `NB-012`, `NB-014`
5. `NB-015`, `NB-018`, `NB-019`, `NB-020`

## Decoupage en sprints

### Sprint 1 - Fondations metier
- schema Prisma cible
- migrations
- enums de statut
- `GradeHistory`
- `SubjectAverage`
- enrichissement `Bulletin` et `BulletinLigne`

### Sprint 2 - Calcul centralise
- service backend `notes-bulletins`
- recalcul matiere
- recalcul general
- rangs avec egalites
- tests unitaires des regles de calcul

### Sprint 3 - Workflow
- validation et verrouillage des notes
- generation et validation des bulletins
- appreciations structurees
- permissions enseignant/admin

### Sprint 4 - Consommation produit
- bulk entry web
- dashboard
- publication
- PDF lot
- canal parent/eleve

## Premiere tranche la plus rentable

Si on veut maximiser la valeur rapidement sans lancer toute la cible d'un coup, la meilleure tranche est:

1. `NB-003 - Enrichir Note avec statuts, cas d'absence et validation`
2. `NB-004 - Creer GradeHistory`
3. `NB-006 - Ajouter SubjectAverage`
4. `NB-010 - Centraliser le calcul de moyenne generale`
5. `NB-011 - Corriger les rangs`
6. `NB-015 - Exposer /grades/bulk-save`

Cette tranche corrige les faiblesses metier les plus visibles sans imposer encore la publication parent-eleve ni le moteur complet de templates.
