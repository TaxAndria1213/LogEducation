# Guide d'utilisation - Module Notes et Bulletins

## Vue d'ensemble

Le module `Notes et Bulletins` de LogESco permet de gerer :

- les evaluations
- les resultats des eleves
- la multi-notation
- les modeles de bulletin
- l'affichage pedagogique personnalise
- la generation du bulletin

Le principe central est le suivant :

- `Evaluation` definit ce qui est evalue
- `AssessmentResult` enregistre le resultat reel
- `ReportCardTemplate` pilote l'affichage
- `Bulletin` fige le rendu final au moment de la generation

Le systeme distingue donc clairement :

1. les donnees utilisees pour le calcul
2. les donnees affichees dans le bulletin

Exemple :

- une evaluation peut compter dans la moyenne
- sans apparaitre dans le bulletin
- ou apparaitre seulement dans un bulletin detaille

---

## Logique generale du module

Le flux metier actuel est :

`Annee scolaire courante`
-> `Structure pedagogique`
-> `Echelles de notation`
-> `Evaluations`
-> `Resultats`
-> `Modele de bulletin`
-> `Generation du bulletin`
-> `Validation / publication`

---

## Pre-requis

Avant d'utiliser le module, il faut avoir :

1. une annee scolaire courante active
2. des niveaux, classes, matieres, enseignants et cours correctement configures
3. au moins un modele de bulletin actif
4. idealement une structure pedagogique si l'etablissement veut un bulletin par domaines ou competences
5. au moins une echelle de notation active si on veut utiliser la multi-notation

Important :

- si les migrations Prisma ne sont pas appliquees en base, les nouvelles options ne seront pas pleinement disponibles

---

## Checklist de parametrage initial

A faire dans cet ordre :

1. Definir l'annee scolaire courante.
2. Verifier les niveaux, classes, matieres, enseignants et cours.
3. Creer la structure pedagogique si tu veux un bulletin par domaines ou competences.
4. Creer les echelles de notation utiles.
5. Creer ou ajuster les types d'evaluation.
6. Regler les regles de notes.
7. Creer le modele de bulletin par defaut.
8. Creer les evaluations.
9. Saisir les resultats.
10. Valider les resultats.
11. Generer un bulletin test.
12. Verifier l'apercu, puis publier quand tout est bon.

---

## Parcours ecran par ecran

### 1. Initialisation pedagogique

Utiliser cet ecran pour :

- verifier l'annee scolaire courante
- regler les bases metier
- definir les comportements par defaut

Conseil :

- utiliser cet ecran comme point d'entree
- puis affiner ensuite dans les modules dedies

### 2. Types d'evaluation

Dans cet ecran, definir par exemple :

- `Devoir`
- `Interrogation`
- `Composition`
- `Examen`

Pour chaque type, choisir :

- s'il compte dans la moyenne
- s'il peut apparaitre dans le bulletin
- s'il est considere comme examen final

Configuration conseillee :

- `Devoir` : moyenne oui, bulletin non
- `Interrogation` : moyenne oui, bulletin non
- `Composition` : moyenne oui, bulletin oui, examen final oui
- `Examen` : moyenne oui, bulletin oui, examen final oui

### 3. Regles de notes

Dans cet ecran, regler :

- l'arrondi
- la gestion des notes manquantes
- le mode de classement

Politiques possibles pour les notes manquantes :

- `IGNORE`
- `ZERO`
- `BLOCK`

Recommandation :

- `BLOCK` si tu veux eviter les bulletins incomplets
- `IGNORE` si tu veux une gestion plus souple

### 4. Structure pedagogique

Cet ecran sert a definir la hierarchie pedagogique.

Exemple :

- `Francais`
- `Etude de la langue`
- `Orthographe`
- `Conjugaison`

Utilisation recommandee :

1. creer d'abord les matieres principales
2. ajouter ensuite les domaines et sous-domaines utiles
3. descendre jusqu'aux competences seulement si l'etablissement en a besoin

### 5. Echelles de notation

Creer les echelles de notation selon les besoins :

- `POINTS`
- `PERCENTAGE`
- `LETTER`
- `LEVEL`
- `VALIDATION`
- `DESCRIPTIVE`

Exemples :

- `8/10`
- `12/20`
- `B`
- `Maitrise satisfaisante`
- `Valide`
- `Commentaire libre`

Le systeme conserve :

- la valeur saisie
- la valeur affichee
- la valeur normalisee si elle est calculable

### 6. Evaluations

Chaque evaluation doit etre liee a :

- une periode
- un cours
- eventuellement un element pedagogique
- eventuellement une echelle de notation

Champs importants :

- `titre`
- `date`
- `poids`
- `note_max`
- `pedagogical_item_id`
- `grading_scale_id`
- `include_in_average`
- `show_in_report_card`
- `is_final_exam`

Bon usage :

- `include_in_average = true` si l'evaluation compte dans la moyenne
- `show_in_report_card = true` si elle peut apparaitre dans un bulletin detaille
- `is_final_exam = true` si c'est une composition ou un examen final

### 7. Resultats / notes

La saisie se fait maintenant sur les `AssessmentResult`.

Chaque resultat peut contenir :

- score brut
- score max
- score normalise
- valeur affichee
- niveau choisi
- texte libre
- statut

Statuts metier actuellement geres :

- `GRADED`
- `JUSTIFIED_ABSENCE`
- `UNJUSTIFIED_ABSENCE`
- `EXEMPTED`
- `NOT_SUBMITTED`
- `NOT_EVALUATED`

Selon le type de notation :

- note chiffree : score + max
- lettre ou niveau : choix d'un niveau
- descriptif : texte libre

### 8. Validation des resultats

Deux niveaux existent :

- validation d'un resultat individuel
- validation groupee des resultats d'une evaluation

Effets attendus :

- un resultat valide ne doit plus etre modifie librement
- une evaluation validee passe au statut metier prevu
- le web et le mobile respectent ce verrouillage

Usage recommande :

1. saisir toute la feuille
2. verifier absents et non evalues
3. lancer la validation groupee

### 9. Modeles de bulletin

Le modele de bulletin pilote l'affichage, pas le calcul.

Tu peux choisir :

- le type de modele
- les colonnes visibles
- le niveau de detail pedagogique
- les elements exacts de l'arbre a afficher

Types principaux :

- `STANDARD`
- `DETAILED`
- `ASSESSMENT_TYPE_SUMMARY`
- `FINAL_EXAM_ONLY`
- `CUSTOM`

Reglages utiles :

- `show_assessment_details`
- `show_assessment_type_summary`
- `show_only_final_exam`
- `show_subject_average`
- `show_subject_coefficient`
- `show_subject_rank`
- `show_teacher_appreciation`
- `show_general_average`
- `show_general_rank`
- `show_mention`
- `show_decision`

### 10. Affichage pedagogique du bulletin

Le bloc pedagogique sert a choisir comment afficher les matieres et leurs sous-elements.

Modes disponibles :

- `SUBJECTS_ONLY`
- `SUBJECTS_AND_DOMAINS`
- `FULL_HIERARCHY`
- `COMPETENCIES_ONLY`
- `CUSTOM`

Signification :

- `SUBJECTS_ONLY` : seulement les matieres principales
- `SUBJECTS_AND_DOMAINS` : matieres + domaines
- `FULL_HIERARCHY` : matiere + domaine + sous-domaine + competence selon profondeur
- `COMPETENCIES_ONLY` : affichage centre sur les competences
- `CUSTOM` : combinaison libre

Options utiles :

- `show_only_evaluated_items`
- `show_non_evaluated_items`
- `non_evaluated_label`
- `group_items_by_parent`
- `show_hierarchical_indent`
- `max_hierarchy_depth`
- `show_subject_summary`
- `show_domain_summary`
- `show_subdomain_summary`
- `show_competency_results`

Exemples :

- si `show_only_evaluated_items = true`, les elements sans resultat sont masques
- si `show_non_evaluated_items = true`, ils s'affichent avec le libelle `Non evalue`
- si `max_hierarchy_depth = 2`, on s'arrete a `matiere + domaine`

### 11. Selection fine des elements a afficher

Dans l'ecran du modele, l'arbre pedagogique peut etre pilote element par element.

Pour chaque noeud, on peut :

- le rendre visible ou non
- definir un libelle personnalise
- choisir d'afficher son resultat
- choisir d'afficher ses enfants

Exemple :

- afficher `Francais`
- afficher `Etude de la langue`
- masquer `Ecriture`
- afficher `Orthographe`
- afficher `Conjugaison`

### 12. Apercu du modele

L'apercu du modele utilise un vrai bulletin existant comme base de simulation.

Utilisation :

1. ouvrir un modele
2. choisir un bulletin de reference
3. modifier les options
4. verifier que l'apercu se met a jour

L'apercu tient maintenant compte :

- des cases actuellement cochees
- du mode pedagogique courant
- de la selection actuelle de l'arbre
- pas seulement des valeurs deja enregistrees

---

## Parametrage recommande pour un premier deploiement

### Modele par defaut conseille

- `template_type = STANDARD`
- `pedagogical_display_mode = SUBJECTS_ONLY`
- `show_subject_average = true`
- `show_subject_coefficient = true`
- `show_subject_rank = true`
- `show_teacher_appreciation = true`
- `show_general_average = true`
- `show_general_rank = true`
- `show_mention = true`
- `show_decision = true`
- `show_assessment_details = false`

### Regles de notes conseillees

- arrondi simple
- `missing_grade_policy = BLOCK` si tu veux eviter les bulletins incomplets
- ou `missing_grade_policy = IGNORE` si tu veux plus de souplesse

### Types d'evaluation conseilles

- `Devoir` : calcul oui, affichage bulletin non
- `Interrogation` : calcul oui, affichage bulletin non
- `Composition` : calcul oui, affichage bulletin oui, final oui
- `Examen` : calcul oui, affichage bulletin oui, final oui

---

## Quand utiliser les modes pedagogiques

### `SUBJECTS_ONLY`

A utiliser :

- pour un bulletin classique
- pour demarrer sans risque

### `SUBJECTS_AND_DOMAINS`

A utiliser :

- si l'ecole veut voir les grands axes par matiere

### `FULL_HIERARCHY`

A utiliser :

- si tu veux matiere + domaine + sous-domaine + competence
- si l'etablissement accepte un bulletin plus riche

### `COMPETENCIES_ONLY`

A utiliser :

- pour une logique pedagogique orientee competences

### `CUSTOM`

A utiliser :

- quand tu maitrises deja la structure et le rendu voulu

---

## Controle qualite avant production

Verifier au minimum :

1. une annee courante existe
2. chaque cours important a un coefficient
3. chaque evaluation a une echelle de notation coherente
4. les enseignants saisissent bien sur leurs propres cours
5. un bulletin test existe pour chaque niveau important
6. l'apercu d'un modele standard est lisible
7. l'apercu d'un modele detaille n'est pas surchage
8. les resultats valides sont bien bloques
9. les bulletins publies gardent leur snapshot

---

## Pieges a eviter

- ne pas commencer directement par `FULL_HIERARCHY`
- ne pas rendre visibles toutes les evaluations dans le bulletin
- ne pas melanger trop tot plusieurs logiques de notation sans tests
- ne pas oublier d'appliquer les migrations Prisma en base
- ne pas publier un modele par defaut sans l'avoir teste avec de vrais bulletins

---

## Plan de deploiement simple

### Semaine 1

- annee courante
- cours
- types d'evaluation
- regles de notes
- modele `STANDARD`

### Semaine 2

- saisie reelle des resultats
- validation
- bulletins standards

### Semaine 3

- structure pedagogique
- modele `SUBJECTS_AND_DOMAINS`

### Semaine 4

- hierarchie complete ou competences si l'ecole en a besoin

---

## Exemple de configuration pedagogique

Si tu configures :

- `pedagogical_display_mode = FULL_HIERARCHY`
- `show_subjects = true`
- `show_domains = true`
- `show_subdomains = true`
- `show_competencies = false`
- `show_non_evaluated_items = true`
- `non_evaluated_label = "Non evalue"`

Alors le bulletin pourra afficher :

- `Francais`
- `Langage oral : A`
- `Lecture et comprehension : B`
- `Etude de la langue : 12,8`
- `Ecriture : Non evalue`
- `Orthographe : 8/10`
- `Conjugaison : 12/20`

pendant que le calcul interne continue a utiliser toutes les evaluations autorisees, meme si certaines ne sont pas affichees.

---

## Resume pratique

Pour un premier lancement reussi :

1. demarrer avec un bulletin `STANDARD`
2. activer la structure pedagogique seulement si elle apporte une vraie valeur
3. utiliser l'apercu sur de vrais bulletins
4. limiter les notes detaillees dans le bulletin
5. valider les resultats avant de generer les bulletins definitifs

