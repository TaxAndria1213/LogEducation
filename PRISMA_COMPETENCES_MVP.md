# Prisma MVP Competences - Proposition cible pour LogESco

## But

Definir un schema Prisma concret pour faire evoluer LogESco vers :

- structure pedagogique hierarchique
- systeme de notation mixte
- resultats multi-format
- calculs hierarchiques
- bulletin dynamique

Cette proposition est volontairement compatible avec le repo actuel :

- on conserve `Evaluation`
- on conserve `Bulletin`
- on conserve `BulletinLigne`
- on ajoute les briques manquantes autour
- on laisse `Note` en place comme pont de migration, sans en faire la cible finale

## Choix d'architecture

### 1. Conserver les modeles metier deja branches

Pour limiter la casse applicative immediate :

- `Evaluation` reste le modele d'evaluation principal
- `Bulletin` reste le modele de bulletin genere
- `BulletinLigne` reste la ligne de bulletin
- `ReportCardTemplate` reste le modele d'affichage principal

### 2. Ajouter les briques competences sans tout renommer

On ajoute :

- `PedagogicalItem`
- `GradingScale`
- `GradingScaleLevel`
- `AssessmentResult`
- `AssessmentResultHistory`
- `PedagogicalItemAverage`
- `ReportCardTemplateSection`
- `ReportCardTemplateField`
- `BulletinLigneDetail`

### 3. Laisser `Note` comme table legacy

Pendant la migration :

- les flux actuels peuvent continuer a lire/ecrire `Note`
- les nouveaux flux ecrivent `AssessmentResult`
- une phase suivante permet de supprimer ou archiver `Note`

## Enums a ajouter

```prisma
enum PedagogicalItemType {
  SUBJECT
  GROUP
  DOMAIN
  SUBDOMAIN
  COMPETENCY
  OBJECTIVE
}

enum PedagogicalCalculationMode {
  NONE
  SIMPLE_AVERAGE
  WEIGHTED_AVERAGE
  SUM
  MANUAL
}

enum GradingType {
  POINTS
  LETTER
  LEVEL
  DESCRIPTIVE
  PERCENTAGE
  VALIDATION
}

enum AssessmentWorkflowStatus {
  DRAFT
  PUBLISHED
  RESULTS_ENTERED
  VALIDATED
  LOCKED
  ARCHIVED
}

enum AssessmentResultStatus {
  GRADED
  JUSTIFIED_ABSENCE
  UNJUSTIFIED_ABSENCE
  EXEMPTED
  NOT_SUBMITTED
  NOT_EVALUATED
}

enum PedagogicalAverageStatus {
  DRAFT
  CALCULATED
  INCOMPLETE
  VALIDATED
  LOCKED
}

enum GradingDisplayMode {
  NUMERIC_ONLY
  LETTER_ONLY
  LEVEL_ONLY
  MIXED
  DESCRIPTIVE_ONLY
  NUMERIC_AND_LEVEL
}

enum ReportCardRankingMode {
  NONE
  SUBJECT_RANK_ONLY
  GENERAL_RANK_ONLY
  SUBJECT_AND_GENERAL_RANK
  CLASS_AVERAGE_ONLY
}

enum ReportCardSectionType {
  ACADEMIC_RESULTS
  COMPETENCIES
  BEHAVIOR
  ATTENDANCE
  GENERAL_APPRECIATION
  DECISION
  SIGNATURE
}

enum ReportCardFieldKey {
  SUBJECT_NAME
  GROUP_NAME
  DOMAIN_NAME
  SUBDOMAIN_NAME
  COMPETENCY_NAME
  OBJECTIVE_NAME
  SCORE
  DISPLAY_VALUE
  LETTER
  MASTERY_LEVEL
  AVERAGE
  COEFFICIENT
  WEIGHT
  APPRECIATION
  TEACHER_NAME
  ABSENCES
  LATE_COUNT
  GENERAL_AVERAGE
  MENTION
  DECISION
  GENERAL_APPRECIATION
  SIGNATURE
}

enum ReportCardWorkflowStatus {
  DRAFT
  CALCULATING
  INCOMPLETE
  READY_FOR_VALIDATION
  VALIDATED
  PUBLISHED
  ARCHIVED
}
```

## Nouveaux modeles

### PedagogicalItem

```prisma
model PedagogicalItem {
  id                    String                      @id @default(uuid())
  etablissement_id      String
  annee_scolaire_id     String
  niveau_scolaire_id    String
  parent_id             String?
  matiere_id            String?
  item_type             PedagogicalItemType
  code                  String?
  nom                   String
  description           String?
  display_order         Int                         @default(0)
  coefficient           Float?
  weight                Float?
  is_evaluable          Boolean                     @default(false)
  is_visible_on_report  Boolean                     @default(true)
  is_required           Boolean                     @default(false)
  calculation_mode      PedagogicalCalculationMode  @default(WEIGHTED_AVERAGE)
  is_active             Boolean                     @default(true)
  created_at            DateTime                    @default(now())
  updated_at            DateTime                    @updatedAt

  etablissement         Etablissement               @relation(fields: [etablissement_id], references: [id])
  annee                 AnneeScolaire               @relation(fields: [annee_scolaire_id], references: [id])
  niveau                NiveauScolaire              @relation(fields: [niveau_scolaire_id], references: [id])
  matiere               Matiere?                    @relation(fields: [matiere_id], references: [id])
  parent                PedagogicalItem?            @relation("pedagogical_item_tree", fields: [parent_id], references: [id])
  enfants               PedagogicalItem[]           @relation("pedagogical_item_tree")
  evaluations           Evaluation[]
  averages              PedagogicalItemAverage[]
  lignesBulletin        BulletinLigne[]

  @@unique([annee_scolaire_id, niveau_scolaire_id, parent_id, nom])
  @@index([etablissement_id])
  @@index([annee_scolaire_id, niveau_scolaire_id, item_type])
  @@index([parent_id, display_order])
  @@map("pedagogical_items")
}
```

### GradingScale et GradingScaleLevel

```prisma
model GradingScale {
  id                   String              @id @default(uuid())
  etablissement_id     String
  annee_scolaire_id    String
  nom                  String
  grading_type         GradingType
  base_score           Float?
  use_for_calculation  Boolean             @default(true)
  allow_decimal        Boolean             @default(true)
  is_default           Boolean             @default(false)
  is_active            Boolean             @default(true)
  created_at           DateTime            @default(now())
  updated_at           DateTime            @updatedAt

  etablissement        Etablissement       @relation(fields: [etablissement_id], references: [id])
  annee                AnneeScolaire       @relation(fields: [annee_scolaire_id], references: [id])
  levels               GradingScaleLevel[]
  evaluations          Evaluation[]
  results              AssessmentResult[]

  @@unique([annee_scolaire_id, nom])
  @@index([etablissement_id])
  @@index([annee_scolaire_id, is_default])
  @@map("grading_scales")
}

model GradingScaleLevel {
  id                String            @id @default(uuid())
  grading_scale_id  String
  code              String
  label             String
  numeric_value     Float?
  min_value         Float?
  max_value         Float?
  display_order     Int               @default(0)
  color             String?
  is_success_level  Boolean           @default(false)
  is_active         Boolean           @default(true)
  created_at        DateTime          @default(now())
  updated_at        DateTime          @updatedAt

  gradingScale      GradingScale      @relation(fields: [grading_scale_id], references: [id], onDelete: Cascade)
  results           AssessmentResult[] @relation("assessment_result_scale_level")
  averages          PedagogicalItemAverage[]
  lignesBulletin    BulletinLigne[]
  detailsBulletin   BulletinLigneDetail[]

  @@unique([grading_scale_id, code])
  @@index([grading_scale_id, display_order])
  @@map("grading_scale_levels")
}
```

### AssessmentResult et historique

```prisma
model AssessmentResult {
  id                  String                   @id @default(uuid())
  assessment_id       String
  student_id          String
  grading_scale_id    String?
  raw_score           Float?
  max_score           Float?
  normalized_score    Float?
  scale_level_id      String?
  text_value          String?                  @db.Text
  display_value       String?                  @db.Text
  status              AssessmentResultStatus   @default(GRADED)
  observation         String?                  @db.Text
  is_validated        Boolean                  @default(false)
  validated_at        DateTime?
  validated_by        String?
  created_at          DateTime                 @default(now())
  updated_at          DateTime                 @updatedAt

  assessment          Evaluation               @relation(fields: [assessment_id], references: [id], onDelete: Cascade)
  student             Eleve                    @relation(fields: [student_id], references: [id])
  gradingScale        GradingScale?            @relation(fields: [grading_scale_id], references: [id])
  scaleLevel          GradingScaleLevel?       @relation("assessment_result_scale_level", fields: [scale_level_id], references: [id])
  history             AssessmentResultHistory[]
  detailsBulletin     BulletinLigneDetail[]

  @@unique([assessment_id, student_id])
  @@index([student_id])
  @@index([grading_scale_id])
  @@index([scale_level_id])
  @@map("assessment_results")
}

model AssessmentResultHistory {
  id                     String    @id @default(uuid())
  assessment_result_id   String
  old_raw_score          Float?
  new_raw_score          Float?
  old_max_score          Float?
  new_max_score          Float?
  old_normalized_score   Float?
  new_normalized_score   Float?
  old_scale_level_id     String?
  new_scale_level_id     String?
  old_text_value         String?   @db.Text
  new_text_value         String?   @db.Text
  old_display_value      String?   @db.Text
  new_display_value      String?   @db.Text
  reason                 String?   @db.Text
  changed_by             String?
  changed_at             DateTime  @default(now())

  assessmentResult       AssessmentResult @relation(fields: [assessment_result_id], references: [id], onDelete: Cascade)

  @@index([assessment_result_id, changed_at])
  @@map("assessment_result_histories")
}
```

### PedagogicalItemAverage

```prisma
model PedagogicalItemAverage {
  id                  String                   @id @default(uuid())
  etablissement_id    String
  academic_year_id    String
  term_id             String
  student_id          String
  class_id            String
  pedagogical_item_id String
  average_score       Float?
  scale_level_id      String?
  display_value       String?                  @db.Text
  coefficient         Float?
  weight              Float?
  calculation_method  PedagogicalCalculationMode
  status              PedagogicalAverageStatus @default(CALCULATED)
  calculated_at       DateTime                 @default(now())
  created_at          DateTime                 @default(now())
  updated_at          DateTime                 @updatedAt

  etablissement       Etablissement            @relation(fields: [etablissement_id], references: [id])
  academicYear        AnneeScolaire            @relation(fields: [academic_year_id], references: [id])
  term                Periode                  @relation(fields: [term_id], references: [id])
  student             Eleve                    @relation(fields: [student_id], references: [id])
  classe              Classe                   @relation(fields: [class_id], references: [id])
  pedagogicalItem     PedagogicalItem          @relation(fields: [pedagogical_item_id], references: [id])
  scaleLevel          GradingScaleLevel?       @relation(fields: [scale_level_id], references: [id])

  @@unique([academic_year_id, term_id, student_id, pedagogical_item_id])
  @@index([class_id, term_id])
  @@index([pedagogical_item_id])
  @@map("pedagogical_item_averages")
}
```

### Sections et champs du modele de bulletin

```prisma
model ReportCardTemplateSection {
  id                 String                 @id @default(uuid())
  template_id        String
  parent_section_id  String?
  title              String
  section_type       ReportCardSectionType
  display_order      Int                    @default(0)
  show_header        Boolean                @default(true)
  is_active          Boolean                @default(true)
  created_at         DateTime               @default(now())
  updated_at         DateTime               @updatedAt

  template           ReportCardTemplate     @relation(fields: [template_id], references: [id], onDelete: Cascade)
  parentSection      ReportCardTemplateSection? @relation("report_card_template_section_tree", fields: [parent_section_id], references: [id])
  childSections      ReportCardTemplateSection[] @relation("report_card_template_section_tree")
  fields             ReportCardTemplateField[]

  @@index([template_id, display_order])
  @@index([parent_section_id])
  @@map("report_card_template_sections")
}

model ReportCardTemplateField {
  id            String              @id @default(uuid())
  template_id   String
  section_id    String?
  field_key     ReportCardFieldKey
  label         String?
  display_order Int                 @default(0)
  is_visible    Boolean             @default(true)
  width         String?
  alignment     String?
  created_at    DateTime            @default(now())
  updated_at    DateTime            @updatedAt

  template      ReportCardTemplate  @relation(fields: [template_id], references: [id], onDelete: Cascade)
  section       ReportCardTemplateSection? @relation(fields: [section_id], references: [id], onDelete: SetNull)

  @@index([template_id, display_order])
  @@index([section_id, display_order])
  @@map("report_card_template_fields")
}
```

### Detail des lignes de bulletin

```prisma
model BulletinLigneDetail {
  id                  String              @id @default(uuid())
  bulletin_ligne_id   String
  assessment_id       String
  assessment_result_id String?
  label               String
  display_value       String?             @db.Text
  numeric_value       Float?
  scale_level_id      String?
  assessment_date     DateTime?
  display_order       Int                 @default(0)
  created_at          DateTime            @default(now())
  updated_at          DateTime            @updatedAt

  bulletinLigne       BulletinLigne       @relation(fields: [bulletin_ligne_id], references: [id], onDelete: Cascade)
  assessment          Evaluation          @relation(fields: [assessment_id], references: [id])
  assessmentResult    AssessmentResult?   @relation(fields: [assessment_result_id], references: [id])
  scaleLevel          GradingScaleLevel?  @relation(fields: [scale_level_id], references: [id])

  @@index([bulletin_ligne_id, display_order])
  @@index([assessment_id])
  @@index([assessment_result_id])
  @@map("bulletins_lignes_details")
}
```

## Modifications a apporter aux modeles existants

### Evaluation

Ajouter ces champs a `Evaluation` :

```prisma
pedagogical_item_id String?
grading_scale_id    String?
status              AssessmentWorkflowStatus @default(DRAFT)
description         String? @db.Text
classe_id_cache     String?
```

Ajouter les relations :

```prisma
pedagogicalItem PedagogicalItem? @relation(fields: [pedagogical_item_id], references: [id])
gradingScale    GradingScale?    @relation(fields: [grading_scale_id], references: [id])
results         AssessmentResult[]
```

Notes :

- `classe_id_cache` est optionnel si tu veux accelerer certains filtres.
- `cours_id` reste pertinent, car l'evaluation reste rattachee a un cours reel.

### ReportCardTemplate

Etendre `ReportCardTemplate` avec :

```prisma
classe_id               String?
grading_display_mode    GradingDisplayMode @default(MIXED)
show_subjects           Boolean @default(true)
show_groups             Boolean @default(false)
show_domains            Boolean @default(false)
show_subdomains         Boolean @default(false)
show_competencies       Boolean @default(false)
show_objectives         Boolean @default(false)
show_scores             Boolean @default(true)
show_letters            Boolean @default(true)
show_mastery_levels     Boolean @default(true)
show_comments           Boolean @default(true)
show_teacher_name       Boolean @default(false)
show_coefficients       Boolean @default(true)
show_weights            Boolean @default(false)
show_ranks              Boolean @default(true)
ranking_mode            ReportCardRankingMode @default(SUBJECT_AND_GENERAL_RANK)
```

Relations a ajouter :

```prisma
classe   Classe?                      @relation(fields: [classe_id], references: [id])
sections ReportCardTemplateSection[]
fields   ReportCardTemplateField[]
```

### Bulletin

Etendre `Bulletin` avec :

```prisma
annee_scolaire_id      String?
validated_at           DateTime?
validated_by           String?
general_level_id       String?
general_display_value  String?
published_at           DateTime?
published_by           String?
status_v2              ReportCardWorkflowStatus?
```

Relation utile :

```prisma
annee        AnneeScolaire?     @relation(fields: [annee_scolaire_id], references: [id])
generalLevel GradingScaleLevel? @relation(fields: [general_level_id], references: [id])
```

Note :

- tu peux garder `statut` pendant la transition
- puis basculer progressivement vers `status_v2`

### BulletinLigne

Etendre `BulletinLigne` avec :

```prisma
pedagogical_item_id String?
parent_ligne_id     String?
item_type           PedagogicalItemType?
label               String?
display_value       String? @db.Text
numeric_value       Float?
scale_level_id      String?
coefficient         Float?
weight              Float?
teacher_id          String?
display_order       Int @default(0)
is_visible          Boolean @default(true)
```

Relations a ajouter :

```prisma
pedagogicalItem PedagogicalItem?   @relation(fields: [pedagogical_item_id], references: [id])
parentLine      BulletinLigne?     @relation("bulletin_line_tree", fields: [parent_ligne_id], references: [id])
childLines      BulletinLigne[]    @relation("bulletin_line_tree")
scaleLevel      GradingScaleLevel? @relation(fields: [scale_level_id], references: [id])
enseignant      Enseignant?        @relation(fields: [teacher_id], references: [id])
details         BulletinLigneDetail[]
```

## Contraintes d'unicite recommandees

```prisma
@@unique([annee_scolaire_id, niveau_scolaire_id, parent_id, nom]) // PedagogicalItem
@@unique([annee_scolaire_id, nom]) // GradingScale
@@unique([grading_scale_id, code]) // GradingScaleLevel
@@unique([assessment_id, student_id]) // AssessmentResult
@@unique([academic_year_id, term_id, student_id, pedagogical_item_id]) // PedagogicalItemAverage
@@unique([annee_scolaire_id, nom]) // ReportCardTemplate
@@unique([eleve_id, periode_id]) // Bulletin
@@unique([bulletin_id, pedagogical_item_id]) // BulletinLigne quand pedagogical_item_id est renseigne
```

## Ordre de migration recommande

### Phase 1 - Sans casser l'existant

1. Ajouter `PedagogicalItem`
2. Ajouter `GradingScale`
3. Ajouter `GradingScaleLevel`
4. Ajouter les nouveaux enums
5. Etendre `Evaluation`

### Phase 2 - Introduire les resultats modernes

6. Ajouter `AssessmentResult`
7. Ajouter `AssessmentResultHistory`
8. Garder `Note` en production en parallele
9. Brancher les nouvelles ecritures sur `AssessmentResult`

### Phase 3 - Calculs

10. Ajouter `PedagogicalItemAverage`
11. Ajouter les services de conversion
12. Ajouter les services de calcul hierarchique

### Phase 4 - Bulletin dynamique

13. Etendre `ReportCardTemplate`
14. Ajouter `ReportCardTemplateSection`
15. Ajouter `ReportCardTemplateField`
16. Etendre `Bulletin`
17. Etendre `BulletinLigne`
18. Ajouter `BulletinLigneDetail`

## Pont de compatibilite recommande

Pendant 1 a 2 sprints :

- `Note.score` continue d'alimenter les anciens ecrans
- `AssessmentResult.normalized_score` devient la source metier cible
- les bulletins simples peuvent continuer a lire les lignes matiere
- les nouveaux bulletins dynamiques lisent `PedagogicalItemAverage` + `AssessmentResult`

## Decision recommande pour LogESco

Le meilleur compromis aujourd'hui est :

- ne pas supprimer `Note`, `Bulletin`, `BulletinLigne`
- ajouter les nouveaux modeles autour
- basculer progressivement les flux vers :
  - `Evaluation + pedagogical_item_id + grading_scale_id`
  - `AssessmentResult`
  - `PedagogicalItemAverage`
  - `BulletinLigne` hierarchique

Cela te donne un MVP competences solide sans casser tout le module deja livre.
