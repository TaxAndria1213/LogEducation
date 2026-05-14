# Backlog Notes & Bulletins - Version Competences

## Objectif

Faire evoluer le socle actuel `Cours -> Evaluation -> Note -> Bulletin configurable`
vers un moteur `Structure pedagogique -> Echelles de notation -> Evaluations ciblees -> Resultats mixtes -> Calculs hierarchiques -> Bulletin dynamique`.

Ce backlog part de l'etat reel du code dans :

- `prisma/schema.prisma`
- `src/app/modules/evaluation/application/evaluation.app.ts`
- `src/app/modules/note/application/note.app.ts`
- `src/app/modules/bulletin/application/bulletin.app.ts`
- `src/app/modules/bulletin/application/bulletin_display.service.ts`
- `src/app/modules/report_card_template/application/report_card_template.app.ts`
- `src/app/modules/type_evaluation_ref/application/type_evaluation_ref.app.ts`
- `src/app/modules/regle_note/application/regle_note.app.ts`
- `src/app/api/routes.ts`
- `frontend/src/routes/modules/pedagogie.routes.tsx`

## Lecture rapide

- Le socle ne se limite plus a `Cours -> Evaluation -> Note numerique -> Bulletin matiere`.
- Une partie importante de la cible est maintenant implemente :
  - structure pedagogique hierarchique
  - echelles de notation multi-format
  - resultats multi-notation distincts de `Note`
  - ciblage des evaluations sur `PedagogicalItem`
  - configuration avancee d'affichage du bulletin
- Le plus gros manque aujourd'hui est surtout :
  - le moteur persistant de calculs hierarchiques `PedagogicalItemAverage`
  - la persistance relationnelle riche du bulletin hierarchique
  - les sections/champs dynamiques complets du modele de bulletin
  - les permissions fines et workflows metier les plus avances

## Matrice cible -> etat reel -> statut -> prochain ticket

| Domaine cible | Etat reel actuel | Statut | Ecart principal | Ticket / prochaine suite |
| --- | --- | --- | --- | --- |
| Structure pedagogique hierarchique | `PedagogicalItem` existe avec arbre, types, parent/enfant, ordre, poids, coefficient, visibilite, caractere evaluable | `Fait` | Manque surtout le calcul hierarchique persistant branche sur cet arbre | `NBC-001` cloturable |
| Structure pedagogique par annee et niveau | Scoping `annee_scolaire_id + niveau_scolaire_id` deja present | `Fait` | Pas encore de duplication / copie avancee entre niveaux | `NBC-002` optimisation |
| Ordonnancement et regroupement | `display_order`, `is_visible_on_report`, `is_evaluable`, `is_required`, `calculation_mode` existent | `Fait` | UX de reordonnancement encore basique | `NBC-003` cloturable |
| Systeme de notation multi-echelle | `GradingScale` et `GradingScaleLevel` existent avec CRUD backend | `Fait` | UI dediee encore a enrichir | `NBC-004` cloturable |
| Notation mixte numerique / lettre / niveau / descriptif | `AssessmentResult` gere points, lettre, niveau, validation, descriptif | `Fait` | Quelques raffinements UX restent possibles | `NBC-005` cloturable |
| Separation `valeur saisie / valeur affichee / valeur calculee` | `raw_score`, `display_value`, `normalized_score`, `text_value`, `scale_level_id` existent | `Fait` | Aucun ecart majeur de schema | `NBC-006` cloturable |
| Evaluation ciblee sur un element pedagogique | `Evaluation` porte `pedagogical_item_id`, `grading_scale_id`, `status` | `Fait` | Reste a exploiter plus profondement dans les calculs hierarchiques | `NBC-007` cloturable |
| Resultats avec statuts metier riches | `AssessmentResultStatus` couvre `GRADED`, absences, `EXEMPTED`, `NOT_SUBMITTED`, `NOT_EVALUATED` | `Fait` | Permissions speciales apres validation a affiner | `NBC-008` cloturable |
| Historique des resultats | `AssessmentResultHistory` existe et est alimente sur les modifications | `Fait` | UI historique peut encore etre enrichie | `NBC-009` cloturable |
| Calculs hierarchiques | Pas de `PedagogicalItemAverage` ni moteur complet de remontee persistante | `Absent` | C'est le plus gros manque fonctionnel | `NBC-010` priorite 1 |
| Ponderation par poids internes | Les `weight` existent sur les items, mais pas de moteur complet de ponderation persistante | `Partiel` | Remontee domaine / sous-domaine encore absente | `NBC-011` apres `NBC-010` |
| Coefficients matiere dans une hierarchie | Coefficients matiere et poids existent, mais pas la chaine complete combinee | `Partiel` | Fusion `weight` interne + `coefficient` matiere a construire | `NBC-012` apres `NBC-010` |
| Bulletin dynamique par arborescence | Le snapshot bulletin sait deja afficher hierarchies, details et selections pedagogiques | `Partiel` | Persistance relationnelle riche encore incomplete | `NBC-013` priorite 2 |
| Details d'evaluation figes dans le bulletin | Le rendu detaille existe surtout dans le snapshot JSON | `Absent` | Pas de vrai `ReportCardLineDetail` comme modele relationnel central | `NBC-014` priorite 3 |
| Modeles de bulletin tres flexibles | `ReportCardTemplate` gere deja beaucoup de switches, `grading_display_mode` et affichage pedagogique | `Partiel` | Manque le vrai builder structurel complet sections/champs | `NBC-015` en cours implicite |
| Sections du bulletin | Pas de `ReportCardTemplateSection` dans le schema | `Absent` | Impossible de composer un bulletin en blocs configurables riches | `NBC-016` priorite 4 |
| Champs dynamiques du bulletin | Pas de `ReportCardTemplateField` dans le schema | `Absent` | Colonnes et blocs encore principalement pilotes par le snapshot/service | `NBC-017` priorite 5 |
| Modes d'affichage de notation | Plusieurs modes sont deja geres par le moteur bulletin et la preview | `Partiel` | Tous les modes du prompt ne sont pas encore formalises de bout en bout | `NBC-018` consolidation |
| Bulletin base competences | Le moteur sait afficher domaines/sous-domaines/competences selon le modele | `Partiel` | Le calcul competence-first persistant manque encore | `NBC-019` depend de `NBC-010` |
| Ecrans de structure pedagogique | Ecran dedie disponible avec creation/edition et arbre | `Partiel` | Drag and drop / reordonnancement avance manquent | `NBC-020` UX |
| Ecrans d'echelles de notation | Backend et services existent, mais l'UI dediee reste inegale | `Partiel` | Liste/formulaire/edition de niveaux a industrialiser | `NBC-021` UX |
| Saisie adaptee au type de notation | Web et mobile savent deja saisir les differents types via `AssessmentResult` | `Partiel` | Composants UX plus specialises restent a factoriser | `NBC-022` UX |
| Builder de modele de bulletin | Formulaire riche, arbre pedagogique, switches, preview temps reel existent | `Partiel` | Pas encore de builder complet de sections/champs | `NBC-023` apres `NBC-016/017` |
| Workflow bulletin complet | Validation/publication existent en partie, snapshots figes aussi | `Partiel` | Workflow cible complet `ReportCard` encore incomplet | `NBC-024` priorite 6 |
| API cible du prompt | Routes `pedagogical-item`, `grading-scale`, `assessment-result`, `evaluation`, `report-card-template`, `bulletin` existent deja | `Partiel` | Manquent surtout `pedagogical-averages` et facade `report-cards/*` plus complete | `NBC-025` priorite 7 |
| Permissions fines | Bon debut cote admin et enseignant | `Partiel` | Role matrix fine et permissions speciales encore incompletes | `NBC-026` priorite 8 |

## Synthese fait / partiel / absent

### Fait

- `NBC-001` a `NBC-009`

### Partiel

- `NBC-011`
- `NBC-012`
- `NBC-013`
- `NBC-015`
- `NBC-018`
- `NBC-019`
- `NBC-020`
- `NBC-021`
- `NBC-022`
- `NBC-023`
- `NBC-024`
- `NBC-025`
- `NBC-026`

### Absent

- `NBC-010`
- `NBC-014`
- `NBC-016`
- `NBC-017`

## Detail des tickets prioritaire

### NBC-001 - Creer PedagogicalItem et son arbre hierarchique

- But: introduire l'unite metier centrale du prompt.
- Cible schema:
  - `id`
  - `annee_scolaire_id`
  - `niveau_scolaire_id`
  - `parent_id`
  - `item_type`
  - `code`
  - `nom`
  - `description`
  - `display_order`
  - `coefficient`
  - `weight`
  - `is_evaluable`
  - `is_visible_on_report`
  - `is_required`
  - `calculation_mode`
  - `is_active`
- Critere d'acceptation:
  - on peut representer `Francais -> Etude de la langue -> Orthographe`
  - l'ordre d'affichage est stable
  - la profondeur parent/enfant est validee cote backend

### NBC-004 - Creer GradingScale et GradingScaleLevel

- But: sortir du tout-numerique.
- Cible schema:
  - `GradingScale`
  - `GradingScaleLevel`
- Cas couverts:
  - points
  - lettre
  - niveau de maitrise
  - descriptif
  - pourcentage
  - validation
- Critere d'acceptation:
  - une echelle `A/B/C/D/E` peut convertir vers des valeurs /20
  - une echelle descriptive peut etre non calculable

### NBC-005 - Remplacer le coeur de saisie par AssessmentResult multi-format

- But: faire evoluer `Note` vers une vraie entite resultat.
- Cible schema:
  - `assessment_id`
  - `student_id`
  - `raw_score`
  - `max_score`
  - `normalized_score`
  - `scale_level_id`
  - `text_value`
  - `display_value`
  - `status`
  - `observation`
  - `is_validated`
  - `validated_at`
  - `validated_by`
- Critere d'acceptation:
  - `8/10`, `A`, `Maitrise satisfaisante` et un commentaire libre sont tous saisissables
  - le systeme conserve toujours la valeur affichable

### NBC-006 - Introduire le triplet saisie / affichage / calcul

- But: rendre explicite la triple logique du prompt.
- Regle:
  - `raw_score` = valeur enseignant
  - `display_value` = valeur visible
  - `normalized_score` = valeur interne pour calcul
- Critere d'acceptation:
  - `8/10` devient `display_value = "8/10"` et `normalized_score = 16`
  - `A` devient `display_value = "A"` et `normalized_score = 18`
  - descriptif conserve `normalized_score = null`

### NBC-007 - Etendre Assessment pour cibler un item pedagogique et une echelle

- But: faire d'une evaluation un acte sur un element pedagogique.
- Cible schema:
  - `pedagogical_item_id`
  - `grading_scale_id`
  - `status`
  - `include_in_average`
  - `show_in_report_card`
  - `is_final_assessment`
- Critere d'acceptation:
  - une evaluation peut viser `Orthographe` plutot que seulement `Mathematiques`

### NBC-010 - Creer PedagogicalItemAverage et moteur de remontee hierarchique

- But: calculer a tous les niveaux de l'arbre.
- Cible schema:
  - `academic_year_id`
  - `term_id`
  - `student_id`
  - `class_id`
  - `pedagogical_item_id`
  - `average_score`
  - `scale_level_id`
  - `display_value`
  - `coefficient`
  - `weight`
  - `calculation_method`
  - `status`
  - `calculated_at`
- Critere d'acceptation:
  - `Orthographe`, `Vocabulaire`, `Conjugaison` alimentent `Etude de la langue`
  - `Etude de la langue` alimente `Francais`

### NBC-013 - Transformer Bulletin en ReportCard hierarchique

- But: sortir de la ligne matiere plate.
- Cible schema:
  - `ReportCard`
  - `ReportCardLine`
  - `parent_line_id`
  - `pedagogical_item_id`
  - `item_type`
  - `label`
  - `display_value`
  - `numeric_value`
  - `scale_level_id`
  - `coefficient`
  - `weight`
  - `appreciation`
  - `teacher_id`
  - `display_order`
  - `is_visible`
- Critere d'acceptation:
  - un bulletin peut afficher :
    - `Francais`
    - `Etude de la langue`
    - `Orthographe : 8/10`
    - `Vocabulaire : Maitrise satisfaisante`

### NBC-015 - Etendre ReportCardTemplate vers un builder dynamique

- But: passer du template par switches a un vrai modele structurel.
- Cible schema:
  - `template_type`
  - `grading_display_mode`
  - `show_subjects`
  - `show_groups`
  - `show_domains`
  - `show_subdomains`
  - `show_competencies`
  - `show_objectives`
  - `show_scores`
  - `show_letters`
  - `show_mastery_levels`
  - `show_comments`
  - `show_teacher_name`
  - `show_coefficients`
  - `show_weights`
  - `show_ranks`
  - `ranking_mode`
- Critere d'acceptation:
  - un etablissement peut demander un bulletin `competency-based` sans changer le code

### NBC-016 - Ajouter ReportCardTemplateSection

- But: construire des blocs de bulletin configurables.
- Cible:
  - `ACADEMIC_RESULTS`
  - `COMPETENCIES`
  - `BEHAVIOR`
  - `ATTENDANCE`
  - `GENERAL_APPRECIATION`
  - `DECISION`
  - `SIGNATURE`
- Critere d'acceptation:
  - le bulletin peut etre narratif ou analytique selon le modele

### NBC-017 - Ajouter ReportCardTemplateField

- But: rendre le bulletin vraiment parametrique.
- Exemples:
  - `SUBJECT_NAME`
  - `DOMAIN_NAME`
  - `SUBDOMAIN_NAME`
  - `COMPETENCY_NAME`
  - `DISPLAY_VALUE`
  - `AVERAGE`
  - `COEFFICIENT`
  - `APPRECIATION`
  - `GENERAL_AVERAGE`
  - `SIGNATURE`
- Critere d'acceptation:
  - les colonnes ne sont plus codees en dur

## MVP recommande

Le MVP initial defini dans ce document est maintenant largement atteint sur le schema, la saisie multi-notation et l'affichage configurable.

Le vrai MVP restant pour rendre le systeme complet sur le plan metier est maintenant :

1. `NBC-010 - PedagogicalItemAverage`
2. `NBC-011 - ponderation interne`
3. `NBC-012 - fusion poids internes + coefficients`
4. `NBC-013 - persistance plus riche du bulletin hierarchique`
5. `NBC-014 - ReportCardLineDetail`

Une fois ces 5 points poses, le systeme couvrira enfin :

- le calcul persistant `competence -> sous-domaine -> domaine -> matiere`
- la ponderation complete
- le bulletin hierarchique fige de facon plus robuste
- une vraie base pour les regenerations et recalculs

## Version avancee recommandee

La version avancee cible ensuite :

1. `NBC-015 - Template dynamique complet`
2. `NBC-016 - Sections`
3. `NBC-017 - Fields`
4. `NBC-023 - UI builder bulletin`
5. `NBC-024 - Workflow bulletin complet`
6. `NBC-025 - API cible complete`
7. `NBC-026 - Permissions fines`
8. `NBC-020 - UX structure pedagogique`
9. `NBC-021 - UX echelles de notation`
10. `NBC-022 - UX saisie multi-notation`

## Plan d'implementation recommande

### Phase 1 - Fondations de donnees

- ajouter `PedagogicalItem`
- ajouter `GradingScale` et `GradingScaleLevel`
- ajouter `AssessmentResult`
- ajouter `AssessmentResultHistory`
- ajouter `PedagogicalItemAverage`

### Phase 2 - Evolution du moteur evaluation/resultat

- etendre `Evaluation`
- ajouter conversion `points / lettre / niveau / descriptif`
- brancher validation et historique
- garder un pont temporaire avec `Note` si migration progressive

### Phase 3 - Calculs hierarchiques

- calcul par item evalue
- remontee parent/enfant
- calcul matiere
- moyenne generale si active

### Phase 4 - Bulletin dynamique

- introduire `ReportCard`, `ReportCardLine`, `ReportCardLineDetail`
- etendre `ReportCardTemplate`
- gerer `grading_display_mode`
- figer les valeurs affichees

### Phase 5 - UX et administration

- builder d'arbre pedagogique
- CRUD d'echelles de notation
- saisie enseignant multi-format
- builder de modele de bulletin
- preview vivant

### Phase 6 - Workflow et diffusion

- validation
- publication
- PDF
- consultation parent / eleve

## Exemple metier de reference

### Structure

- `Francais`
- `Langage oral`
- `Lecture et comprehension`
- `Etude de la langue`
- `Ecriture`
- `Vocabulaire / Lexique`
- `Orthographe`
- `Grammaire`
- `Conjugaison`

### Resultats

- `Langage oral` : `A` -> `18/20`
- `Orthographe` : `8/10` -> `16/20`
- `Conjugaison` : `12/20` -> `12/20`
- `Vocabulaire / Lexique` : `Maitrise satisfaisante` -> `14/20`

### Affichage attendu

- `Francais`
- `Langage oral : A`
- `Etude de la langue`
- `Vocabulaire / Lexique : Maitrise satisfaisante`
- `Orthographe : 8/10`
- `Conjugaison : 12/20`
- `Resultat global Francais : 15/20`
- `Appreciation : Bon travail. Les resultats sont satisfaisants, mais la conjugaison doit etre renforcee.`

## Etape la plus utile maintenant

Si on veut passer de l'analyse a l'implementation, la meilleure suite est :

1. implementer `NBC-010 - PedagogicalItemAverage`
2. enchainer avec `NBC-011` et `NBC-012`
3. puis renforcer la persistance bulletin avec `NBC-013` et `NBC-014`

