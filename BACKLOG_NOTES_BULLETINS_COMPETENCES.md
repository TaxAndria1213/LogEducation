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

- Le socle actuel couvre bien les evaluations, les notes numeriques et les bulletins par matiere.
- La cible du prompt demande un changement de noyau metier.
- Le plus gros manque aujourd'hui est l'absence de :
  - structure pedagogique hierarchique
  - echelles de notation multi-format
  - resultats mixtes distincts des notes numeriques simples
  - calculs hierarchiques competence -> domaine -> matiere
  - bulletin dynamique base sur l'arbre pedagogique

## Matrice cible -> actuel -> ecart -> ticket

| Domaine cible | Etat actuel | Ecart principal | Ticket |
| --- | --- | --- | --- |
| Structure pedagogique hierarchique | Pas de `PedagogicalItem`; le systeme repose surtout sur `Matiere`, `Cours`, `Programme` | Impossible de modeliser `SUBJECT/GROUP/DOMAIN/SUBDOMAIN/COMPETENCY/OBJECTIVE` dans un arbre unique | `NBC-001 - Creer PedagogicalItem et son arbre hierarchique` |
| Structure pedagogique par annee et niveau | `Programme` et `Matiere` aident au cadrage, mais sans arbre pedagogique configurable | Pas de variation propre par `annee_scolaire_id + niveau_scolaire_id + parent_id` | `NBC-002 - Ajouter scoping annee/niveau sur la structure pedagogique` |
| Ordonnancement et regroupement | Les affichages actuels sont surtout lineaires par matiere | Pas de `display_order`, `is_visible_on_report`, `is_evaluable`, `is_required` sur les elements pedagogiques | `NBC-003 - Ajouter les metadonnees d'affichage et d'evaluation des items` |
| Systeme de notation multi-echelle | `TypeEvaluationRef` aide sur `poids`, `note max`, visibilite bulletin | Pas de `GradingScale` ni `GradingScaleLevel` | `NBC-004 - Creer GradingScale et GradingScaleLevel` |
| Notation mixte numerique / lettre / niveau / descriptif | `Note.score` est purement numerique dans `schema.prisma` | Impossible de saisir et conserver proprement `A`, `MS`, `commentaire libre`, `validation` | `NBC-005 - Remplacer le coeur de saisie par AssessmentResult multi-format` |
| Separation `valeur saisie / valeur affichee / valeur calculee` | Aujourd'hui, `Note.score` sert a tout | Pas de `raw_score`, `display_value`, `normalized_score`, `text_value`, `scale_level_id` | `NBC-006 - Introduire le triplet saisie/affichage/calcul` |
| Evaluation ciblee sur un element pedagogique | `Evaluation` cible un `cours` et un `type` | Pas de `pedagogical_item_id` ni `grading_scale_id` sur l'evaluation | `NBC-007 - Etendre Assessment pour cibler un item pedagogique et une echelle` |
| Resultats avec statuts metier riches | `Note` n'a pas encore le modele complet attendu | Pas de support propre `GRADED/JUSTIFIED_ABSENCE/EXEMPTED/NOT_EVALUATED/...` sur le futur resultat | `NBC-008 - Ajouter les statuts complets sur AssessmentResult` |
| Historique des resultats | Pas de modele type `AssessmentResultHistory` | Pas de trace des modifications apres validation | `NBC-009 - Creer AssessmentResultHistory` |
| Calculs hierarchiques | Le moteur actuel calcule surtout des moyennes par matiere pour le bulletin | Pas de remontee `competence -> sous-domaine -> domaine -> matiere -> general` | `NBC-010 - Creer PedagogicalItemAverage et moteur de remontee hierarchique` |
| Ponderation par poids internes | Les poids actuels sont surtout au niveau des evaluations | Pas de `weight` exploitable sur domaine / sous-domaine | `NBC-011 - Gerer la ponderation des items pedagogiques` |
| Coefficients matiere dans une hierarchie | Le systeme sait maintenant mieux gerer les coefficients matiere pour les bulletins classiques | Pas de moteur qui combine `weight` interne et `coefficient` matiere dans la meme chaine | `NBC-012 - Fusionner calculs internes et coefficients matiere` |
| Bulletin dynamique par arborescence | `Bulletin` + `BulletinLigne` + snapshot d'affichage couvrent surtout la matiere | Pas de lignes hierarchiques parent/enfant ni d'affichage competence-based | `NBC-013 - Transformer Bulletin en ReportCard hierarchique` |
| Details d'evaluation figes dans le bulletin | Le snapshot JSON aide, mais sans entite detaillee persistante | Pas de `ReportCardLineDetail` par evaluation dans le modele relationnel | `NBC-014 - Ajouter ReportCardLineDetail` |
| Modeles de bulletin tres flexibles | `ReportCardTemplate` existe deja avec de bons switches de synthese | Pas de `grading_display_mode`, `show_domains`, `show_competencies`, `show_objectives`, ni sections/champs dynamiques | `NBC-015 - Etendre ReportCardTemplate vers un builder dynamique` |
| Sections du bulletin | Pas de `ReportCardTemplateSection` | Impossible de construire proprement `ACADEMIC_RESULTS`, `COMPETENCIES`, `ATTENDANCE`, etc. | `NBC-016 - Ajouter ReportCardTemplateSection` |
| Champs dynamiques du bulletin | Pas de `ReportCardTemplateField` | Impossible de choisir finement les colonnes / blocs a afficher | `NBC-017 - Ajouter ReportCardTemplateField` |
| Modes d'affichage de notation | Le rendu bulletin sait gerer detaille / resume par type d'evaluation | Pas de `NUMERIC_ONLY`, `LETTER_ONLY`, `LEVEL_ONLY`, `MIXED`, `DESCRIPTIVE_ONLY`, `NUMERIC_AND_LEVEL` | `NBC-018 - Ajouter grading_display_mode au moteur bulletin` |
| Bulletin base competences | Pas de rendu natif competence/domaine/sous-domaine | Impossible de produire le bulletin exemple du prompt sans contournement | `NBC-019 - Generer un bulletin competence-base` |
| Ecrans de structure pedagogique | Aucun builder d'arbre pedagogique aujourd'hui | Pas de `PedagogicalStructureBuilderPage`, `TreeBuilder`, `TreeNodeEditor` | `NBC-020 - Construire l'UI de structure pedagogique` |
| Ecrans d'echelles de notation | Aucun CRUD `GradingScale` aujourd'hui | Pas de `GradingScaleListPage`, `GradingScaleFormPage`, `ScaleLevelTable` | `NBC-021 - Construire l'UI de systemes de notation` |
| Saisie adaptee au type de notation | Les formulaires de notes sont encore centres sur le score numerique | Pas de `ResultInputRenderer`, `MixedGradeInput`, select lettre/niveau, descriptif | `NBC-022 - Construire l'UI de saisie multi-notation` |
| Builder de modele de bulletin | Le CRUD de modele existe, avec preview utile | Pas encore de vrai constructeur de sections/champs hierarchiques | `NBC-023 - Construire le builder avance des modeles de bulletin` |
| Workflow bulletin complet | Le bulletin est mieux separe entre generation et affichage, mais reste encore oriente socle | Pas encore de workflow complet `DRAFT/CALCULATING/INCOMPLETE/READY_FOR_VALIDATION/VALIDATED/PUBLISHED/ARCHIVED` sur une vraie entite `ReportCard` | `NBC-024 - Finaliser le workflow metier complet des bulletins` |
| API cible du prompt | Routes actuelles : `/evaluation`, `/note`, `/bulletin`, `/report-card-template`, `/type-evaluation-ref`, `/regle-note` | Il manque presque toutes les routes `pedagogical-items`, `grading-scales`, `assessment-results`, `pedagogical-averages`, `report-cards/*` | `NBC-025 - Creer la facade API competences et bulletins dynamiques` |
| Permissions fines | Bon debut sur mobile enseignant et administration web | Pas encore de gestion metier fine par type de notation, item pedagogique, validation de resultats et publication competence-based | `NBC-026 - Etendre le modele de permissions` |

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

Le MVP le plus rentable pour approcher cette cible sans tout casser d'un coup :

1. `NBC-001 - PedagogicalItem`
2. `NBC-004 - GradingScale`
3. `NBC-005 - AssessmentResult`
4. `NBC-006 - Triplet saisie/affichage/calcul`
5. `NBC-007 - Assessment cible sur item pedagogique`
6. `NBC-010 - PedagogicalItemAverage`
7. `NBC-013 - ReportCard hierarchique minimal`
8. `NBC-018 - grading_display_mode minimal`

Ce MVP permet deja :

- une structure `matiere -> domaine -> sous-domaine`
- une notation `points / lettre / niveau / descriptif`
- un calcul hierarchique de base
- un bulletin competence-base simple

## Version avancee recommandee

La version avancee cible ensuite :

1. `NBC-009 - Historique complet des resultats`
2. `NBC-011 - Ponderation fine des items pedagogiques`
3. `NBC-012 - Fusion poids internes + coefficients`
4. `NBC-014 - ReportCardLineDetail`
5. `NBC-015 - Template dynamique complet`
6. `NBC-016 - Sections`
7. `NBC-017 - Fields`
8. `NBC-020 - UI structure pedagogique`
9. `NBC-021 - UI echelles de notation`
10. `NBC-022 - UI saisie multi-notation`
11. `NBC-023 - UI builder bulletin`
12. `NBC-024 - Workflow bulletin complet`
13. `NBC-025 - API cible complete`
14. `NBC-026 - Permissions fines`

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

1. schema Prisma complet de `NBC-001` a `NBC-010`
2. strategie de migration progressive `Note -> AssessmentResult`
3. MVP backend avant les ecrans
