# Integration progressive - Bulletin dynamique adapte a l'existant

## 1. Objectif

Adapter le module `notes + bulletins` deja present dans LogESco pour permettre a tout type d'etablissement de configurer son bulletin sans repartir de zero.

L'objectif n'est pas de remplacer l'existant, mais de le faire evoluer autour des briques deja en place :

- `PedagogicalItem`
- `GradingScale`
- `GradingScaleLevel`
- `Evaluation`
- `AssessmentResult`
- `ReportCardTemplate`
- `ReportCardTemplatePedagogicalItem`
- `Bulletin`
- `BulletinLigne`

## 2. Analyse de compatibilite avec le code actuel

### Prisma

Le schema actuel contient deja le coeur du systeme cible :

- `PedagogicalItem` pour la structure hierarchique par annee/niveau
- `GradingScale` et `GradingScaleLevel` pour la notation multi-format
- `AssessmentResult` et `AssessmentResultHistory` pour les resultats mixtes
- `ReportCardTemplate` pour la configuration du bulletin
- `ReportCardTemplatePedagogicalItem` pour la selection fine d'elements pedagogiques
- `Bulletin` et `BulletinLigne` pour le bulletin genere

Constat important :

- le systeme n'a plus besoin d'un nouveau modele generique `ReportResult`, car `AssessmentResult` couvre deja ce besoin
- le systeme n'a plus besoin d'un nouveau modele generique `ReportCard`, car `Bulletin` joue deja ce role
- le systeme n'a plus besoin d'un nouveau modele generique `ReportCardItem`, car `PedagogicalItem` couvre deja la structure pedagogique

Les manques reels se situent surtout sur :

- les sections dynamiques du bulletin
- le calcul persistant des moyennes hierarchiques
- la persistance riche des lignes detaillees
- la legende des codes au moment du gel du bulletin

### Backend Express

Les routes actuelles existent deja pour :

- `/pedagogical-item`
- `/grading-scale`
- `/assessment-result`
- `/evaluation`
- `/report-card-template`
- `/bulletin`

Cela permet une integration progressive sans casser les routes existantes. La bonne strategie est d'ajouter des routes specialisees en continuant a reutiliser ces modules.

### Frontend React

Le frontend pedagogie a deja :

- `Structure pedagogique`
- `Evaluations`
- `Notes`
- `Bulletins`
- `Modeles de bulletin`
- `Regles de notes`

Les points d'entree a reutiliser sont donc deja presents. Il faut enrichir les pages existantes avant de creer de nouveaux espaces paralleles.

## 3. Decision d'architecture

### Modeles a conserver comme noyau

- `PedagogicalItem` = structure du bulletin
- `GradingScale` = mode de notation
- `AssessmentResult` = resultat saisi
- `ReportCardTemplate` = configuration du bulletin
- `Bulletin` = bulletin genere

### Nouveaux modeles a ajouter

#### 3.1 `PedagogicalItemAverage`

But :

- stocker les moyennes calculees par eleve et par classe
- persister la remontee hierarchique domaine -> sous-domaine -> matiere

Champs recommandes :

- `id`
- `etablissement_id`
- `annee_scolaire_id`
- `periode_id`
- `classe_id`
- `eleve_id`
- `pedagogical_item_id`
- `student_average`
- `class_average`
- `display_value`
- `calculation_mode`
- `rounding_precision`
- `status`
- `calculated_at`
- `created_at`
- `updated_at`

#### 3.2 `ReportCardTemplateSection`

But :

- permettre les sections configurables du bulletin

Champs recommandes :

- `id`
- `template_id`
- `parent_section_id`
- `title`
- `section_type`
- `grading_mode`
- `display_order`
- `show_header`
- `is_active`
- `created_at`
- `updated_at`

Valeurs utiles de `section_type` :

- `ACADEMIC_NUMERIC`
- `ACADEMIC_CODE`
- `BEHAVIOR`
- `GENERAL_APPRECIATION`
- `DECISION`
- `CODE_LEGEND`

#### 3.3 `ReportCardTemplateField`

But :

- piloter les colonnes et blocs visibles par section

Champs recommandes :

- `id`
- `template_id`
- `section_id`
- `field_key`
- `label`
- `display_order`
- `is_visible`
- `width`
- `alignment`

#### 3.4 `BulletinLigneDetail`

But :

- figer les details d'evaluations au niveau relationnel

Champs recommandes :

- `id`
- `bulletin_ligne_id`
- `assessment_id`
- `assessment_result_id`
- `label`
- `display_value`
- `numeric_value`
- `scale_level_id`
- `display_order`
- `created_at`
- `updated_at`

#### 3.5 `BulletinCodeLegend`

But :

- figer la legende `A = Tres bien`, `B = Bien`, `C = Assez bien` sur le bulletin publie

Champs recommandes :

- `id`
- `bulletin_id`
- `grading_scale_id`
- `code`
- `label`
- `numeric_value`
- `display_order`

## 4. Extensions minimales sur les modeles existants

### 4.1 `ReportCardTemplate`

Ajouter :

- `calculation_mode`
- `include_code_grades_in_general_average`
- `show_student_average`
- `show_class_average`
- `show_general_student_average`
- `show_general_class_average`
- `show_code_legend`
- `rounding_precision`
- `show_section_headers`

### 4.2 `PedagogicalItem`

Ajouter si besoin minimum :

- `grading_scale_id` nullable
- `report_section_type` nullable
- `include_in_general_average`
- `grading_mode_override`

But :

- permettre a un item de porter sa logique de notation ou de section quand l'etablissement le souhaite

### 4.3 `ReportCardTemplatePedagogicalItem`

Ajouter :

- `section_id` nullable
- `grading_scale_id_override` nullable
- `include_in_general_average_override`

But :

- faire varier l'affichage par template sans dupliquer les `PedagogicalItem`

### 4.4 `Bulletin`

Ajouter :

- `general_class_average`
- `display_legend_json`
- `validated_at`
- `validated_by`

### 4.5 `BulletinLigne`

Faire evoluer progressivement de la ligne matiere plate vers une ligne hierarchique :

- `parent_ligne_id`
- `pedagogical_item_id`
- `item_type`
- `grading_mode`
- `display_value`
- `numeric_value`
- `student_average`
- `class_average`
- `scale_level_id`
- `observation`
- `display_order`
- `is_visible`

Migration progressive recommandee :

- garder `matiere_id`, `moyenne`, `rang`, `commentaire_enseignant` au debut
- ajouter les nouveaux champs
- migrer ensuite les usages du snapshot vers ces nouveaux champs

## 5. Contraintes d'unicite recommandees

- `PedagogicalItem` : deja bon sur `annee_scolaire_id + niveau_scolaire_id + parent_id + nom`
- `GradingScale` : deja bon sur `annee_scolaire_id + nom`
- `GradingScaleLevel` : deja bon sur `grading_scale_id + code`
- `AssessmentResult` : deja bon sur `assessment_id + student_id`
- `PedagogicalItemAverage` : `@@unique([periode_id, classe_id, eleve_id, pedagogical_item_id])`
- `ReportCardTemplateSection` : `@@unique([template_id, parent_section_id, title])`
- `ReportCardTemplateField` : `@@unique([template_id, section_id, field_key])`
- `Bulletin` : l'existant `@@unique([eleve_id, periode_id])` peut etre conserve
- `BulletinLigne` : `@@unique([bulletin_id, pedagogical_item_id])`
- `BulletinCodeLegend` : `@@unique([bulletin_id, code])`

## 6. Strategie d'integration progressive

### Phase 1 - Finaliser le noyau metier sans casser l'existant

- ajouter `PedagogicalItemAverage`
- ajouter `ReportCardTemplateSection`
- ajouter `ReportCardTemplateField`
- ajouter `BulletinLigneDetail`
- ajouter `BulletinCodeLegend`
- enrichir `ReportCardTemplate`
- enrichir `BulletinLigne`

### Phase 2 - Introduire les calculs dynamiques

- calcul des moyennes eleve par item
- calcul des moyennes classe par item
- moyenne generale eleve
- moyenne generale classe
- support `SIMPLE` et `HIERARCHICAL`

### Phase 3 - Relier le template et l'arbre pedagogique

- attacher les `PedagogicalItem` aux sections du template
- supporter les sections :
  - `Domaine d'enseignement : note`
  - `Domaine d'enseignement : code`
  - `Comportement`
  - `Appreciation generale`
  - `Decision du conseil`

### Phase 4 - Generer le bulletin fige

- produire les lignes hierarchiques
- figer la legende des codes
- figer les details d'evaluation
- bloquer les modifications apres publication

## 7. Migrations Prisma recommandees

### Migration A

- `PedagogicalItemAverage`
- extensions `ReportCardTemplate`

### Migration B

- `ReportCardTemplateSection`
- `ReportCardTemplateField`
- extensions `ReportCardTemplatePedagogicalItem`

### Migration C

- `BulletinLigneDetail`
- `BulletinCodeLegend`
- extensions `Bulletin`
- extensions `BulletinLigne`

Cette sequence permet de deployer sans casser les ecrans existants.

## 8. Services backend a creer ou refactorer

### A creer

- `currentAcademicYearService`
- `reportCalculationService`
- `reportCardGenerationService`
- `reportCardValidationService`

### A faire evoluer

- `report_card_template.app.ts`
- `pedagogical_item.app.ts`
- `grading_scale.app.ts`
- `assessment_result.app.ts`
- `bulletin.app.ts`
- `bulletin_display.service.ts`

### Role de chaque service

#### `currentAcademicYearService`

- recuperer l'annee scolaire courante
- centraliser l'erreur :
  - `"Aucune annee scolaire courante n'est definie."`

#### `reportCalculationService`

- calculer la moyenne d'un item
- calculer la moyenne d'une matiere
- calculer la moyenne de classe
- calculer la moyenne generale
- persister dans `PedagogicalItemAverage`

#### `reportCardGenerationService`

- charger le template actif
- charger l'arbre pedagogique
- charger les resultats
- charger les moyennes
- produire les lignes du bulletin
- produire la legende des codes

#### `reportCardValidationService`

- figer le bulletin a la validation
- interdire les modifications apres publication

## 9. Routes a creer ou a adapter

### A conserver

- `/pedagogical-item`
- `/grading-scale`
- `/assessment-result`
- `/report-card-template`
- `/bulletin`

### A ajouter

- `GET /report-card-template/:id/sections`
- `POST /report-card-template/:id/sections`
- `PUT /report-card-template-section/:id`
- `DELETE /report-card-template-section/:id`
- `POST /report-card-template/:id/items/tree`
- `POST /classes/:classId/terms/:termId/calculate-report-averages`
- `GET /classes/:classId/terms/:termId/report-averages`
- `GET /classes/:classId/terms/:termId/report-results`
- `POST /bulletin/:id/validate`
- `POST /bulletin/:id/publish`

La facade peut rester en francais dans le code si on veut preserver l'existant, mais les usages doivent rester coherents.

## 10. Algorithmes a implementer

### Recuperer l'annee courante

1. lire les parametres de l'etablissement
2. trouver l'annee `is_active/current`
3. si absente, lever :
   - `"Aucune annee scolaire courante n'est definie."`

### Convertir un code en valeur numerique

1. lire le `GradingScaleLevel`
2. si `include_code_grades_in_general_average = false`, retourner `null`
3. sinon retourner `numeric_value`

### Calcul d'un item

1. recuperer les resultats enfants calculables
2. selon `calculation_mode`
3. si `SIMPLE`, moyenne directe
4. si `HIERARCHICAL`, calculer d'abord les enfants
5. appliquer `rounding_precision`

### Calcul de moyenne de classe

1. recuperer les `student_average` de tous les eleves de la classe
2. ignorer les `null`
3. moyenner

### Moyenne generale

1. prendre les items `include_in_general_average = true`
2. ignorer les items non calculables
3. inclure les codes seulement si `include_code_grades_in_general_average = true`
4. calculer la moyenne eleve
5. calculer ensuite la moyenne generale de classe

### Generation des lignes hierarchiques

1. charger les sections du template
2. charger les items visibles du template
3. construire l'arbre par `parent_id`
4. produire une ligne par item visible
5. y ajouter :
   - `display_value`
   - `numeric_value`
   - `student_average`
   - `class_average`
   - `observation`
6. attacher les details d'evaluations si le template l'autorise

### Gel du bulletin

1. copier les lignes calculees dans `BulletinLigne`
2. copier les details dans `BulletinLigneDetail`
3. copier la legende des codes dans `BulletinCodeLegend`
4. enregistrer les moyennes globales
5. passer le bulletin a `VALIDE`
6. a publication, interdire toute regeneration destructive

## 11. Adaptation frontend React

### Ecrans a adapter en priorite

- `frontend/src/pages/pedagogie/modeles_bulletins`
- `frontend/src/pages/pedagogie/structure_pedagogique`
- `frontend/src/pages/pedagogie/notes`
- `frontend/src/pages/pedagogie/bulletins`

### Ecrans a ajouter ensuite

- page `Echelles de notation`
- page `Apercu des moyennes`
- page `Generation des bulletins`

### Composants a ajouter

- `ReportTemplateSectionBuilder`
- `ReportItemTreeBuilder`
- `NumericResultInput`
- `CodeResultSelect`
- `StudentAverageBadge`
- `ClassAverageBadge`
- `CodeLegendBox`
- `BulletinHierarchicalView`
- `ValidationModal`
- `PublishModal`

### Reutilisation recommandees

- enrichir `ReportCardTemplateForm.tsx` au lieu de creer un builder parallele
- enrichir `PedagogicalStructureIndex.tsx` au lieu de refaire un tree builder autonome
- enrichir `NoteForm.tsx` et `NoteTable.tsx` au lieu de recreer une saisie separee
- enrichir `BulletinTable.tsx` pour les nouveaux blocs figes

## 12. Workflow cible adapte a LogESco

1. L'administration configure un modele de bulletin.
2. Elle cree les sections du modele.
3. Elle rattache les items pedagogiques aux sections.
4. Elle choisit les echelles de notation.
5. Les enseignants saisissent les `AssessmentResult`.
6. Le systeme calcule les `PedagogicalItemAverage`.
7. Le systeme genere les `Bulletin`.
8. L'administration controle.
9. Le bulletin est valide.
10. Les lignes, details et legendes sont figes.
11. Le bulletin est publie.
12. Les parents/eleves ne voient que les bulletins publies.

## 13. Permissions recommandees

### Administration

- gere templates, sections, codes, calculs, generation, validation, publication

### Enseignant

- saisit les resultats uniquement sur ses cours
- ne modifie pas le template global
- ne publie pas

### Professeur principal

- consulte les bulletins de sa classe
- ajoute appreciation generale
- propose decision

### Parent / Eleve

- lecture seule sur bulletin publie

## 14. Messages a centraliser

### Erreurs

- `Aucune annee scolaire courante n'est definie.`
- `Aucun modele de bulletin actif n'est defini.`
- `Cet element existe deja dans cette section.`
- `Le resultat numerique ne peut pas depasser la note maximale.`
- `Le code selectionne est invalide.`
- `Cet eleve n'appartient pas a cette classe.`
- `Impossible de calculer la moyenne : aucun resultat calculable.`
- `Ce bulletin est deja publie et ne peut plus etre modifie.`
- `Vous n'avez pas l'autorisation d'effectuer cette action.`

### Succes

- `Modele de bulletin cree avec succes.`
- `Structure du bulletin enregistree avec succes.`
- `Echelle de notation creee avec succes.`
- `Resultats enregistres avec succes.`
- `Moyennes calculees avec succes.`
- `Bulletins generes avec succes.`
- `Bulletin valide avec succes.`
- `Bulletin publie avec succes.`

## 15. Exemple cible sur ton bulletin

### Section 1 - Domaine d'enseignement : note

- `Francais`
- `Mathematiques`
- `Questionner le monde`

### Section 2 - Domaine d'enseignement : code

- `Education physique`
- `Enseignement Artistique`
- `Enseignement Moral et Civique`
- `Malagasy`
- `Anglais`

### Regles

- les items numeriques utilisent une echelle `/10`
- les items a code utilisent une echelle `A/B/C`
- les codes participent ou non a la moyenne generale selon `include_code_grades_in_general_average`
- la legende est figee au moment de la validation

### Rendu attendu

- `Francais`
- `Langage oral : 8/10`
- `Lecture et comprehension de l'ecrit : 6,5/10`
- `Etude de la langue`
- `Ecriture : 8,5/10`
- `Vocabulaire / Lexique : 9/10`
- `Orthographe : 8/10`
- `Grammaire et conjugaison : 9/10`
- `Moyenne eleve : 8/10`
- `Moyenne classe : 7/10`

- `Education physique : B`
- `Enseignement Artistique : A`

- `Moyenne generale eleve : 8,3/10`
- `Moyenne generale classe : 7,2/10`

- `Legende`
- `A = Tres bien`
- `B = Bien`
- `C = Assez bien`

## 16. Plan d'implementation recommande

### Etape 1

- ajouter `PedagogicalItemAverage`
- ajouter les champs manquants sur `ReportCardTemplate`

### Etape 2

- ajouter `ReportCardTemplateSection`
- ajouter `ReportCardTemplateField`
- relier le template a des sections dynamiques

### Etape 3

- ajouter `BulletinLigneDetail`
- ajouter `BulletinCodeLegend`
- enrichir `BulletinLigne`

### Etape 4

- extraire un `reportCalculationService`
- calculer et persister les moyennes

### Etape 5

- enrichir `ReportCardTemplateForm.tsx`
- enrichir `BulletinTable.tsx`
- ajouter l'ecran de preview des moyennes

### Etape 6

- finaliser validation / publication / consultation parent-eleve

## 17. Verdict de compatibilite

Cette cible est compatible avec le code actuel de LogESco.

La bonne approche n'est pas d'introduire une deuxieme architecture de bulletin, mais :

- d'utiliser `PedagogicalItem` comme arbre source
- d'utiliser `GradingScale` comme moteur de code/niveau/numerique
- d'utiliser `AssessmentResult` comme resultat source
- d'utiliser `ReportCardTemplate` comme config centrale
- de faire evoluer `Bulletin` vers un bulletin relationnel plus riche

La prochaine etape la plus rentable est :

1. `PedagogicalItemAverage`
2. `ReportCardTemplateSection`
3. `BulletinLigneDetail + BulletinCodeLegend`
