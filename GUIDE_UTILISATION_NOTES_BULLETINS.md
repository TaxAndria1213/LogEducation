# Guide d'utilisation des bulletins

Ce guide explique le parcours complet pour produire un bulletin : préparer le modèle, générer les lignes de notes, vérifier l'aperçu, valider le bulletin, puis exporter le PDF.

## 1. Prérequis

Avant de créer un bulletin, vérifie que les éléments suivants sont prêts :

- Une année scolaire active existe dans `Etablissement > Années scolaires`.
- Les périodes de l'année sont créées, par exemple `Trimestre 1`, `Trimestre 2`.
- Les élèves sont inscrits dans une classe active pour l'année courante.
- Les cours existent pour les classes concernées.
- Les évaluations et notes sont saisies.
- La structure pédagogique est configurée si le bulletin doit afficher des groupes, domaines, compétences ou objectifs.

Si la structure pédagogique n'est pas utilisée, le bulletin peut quand même être généré à partir des matières et des notes classiques.

## 2. Créer ou modifier un modèle de bulletin

Ouvre `Pédagogie > Modèles de bulletins`.

Un modèle de bulletin définit ce qui apparaît dans l'aperçu et dans le PDF : colonnes, hiérarchie pédagogique, moyennes, rangs, appréciations, logo, signature et légende.

### Cadre du modèle

- `Année courante` est remplie automatiquement avec l'année active.
- `Niveau cible` peut rester vide si le modèle doit s'appliquer à tous les niveaux.
- `Nom` doit être explicite, par exemple `Bulletin trimestriel - Collège`.
- `Type de modèle` sert de base de configuration.
- `Affichage pédagogique` pilote la structure visible dans le bulletin.

### Modes d'affichage pédagogique

- `Matières uniquement` : affiche seulement les matières principales.
- `Matières et domaines` : affiche les matières, groupes et domaines.
- `Hiérarchie complète` : affiche matières, groupes, domaines, sous-domaines, compétences et objectifs.
- `Compétences uniquement` : met l'accent sur les compétences et objectifs.
- `Personnalisé` : conserve les options réglées manuellement.

Pour afficher toute la structure dans le PDF, choisis `Hiérarchie complète`, puis vérifie que les options suivantes sont activées :

- `Afficher les matières principales`
- `Afficher les groupes de matières`
- `Afficher les domaines`
- `Afficher les sous-domaines`
- `Afficher les compétences`
- `Afficher les objectifs`
- `Afficher les éléments non évalués`, si tu veux voir aussi les éléments sans note
- `Afficher l'indentation hiérarchique`

### Arbre pédagogique du modèle

Dans `Arbre pédagogique du modèle`, coche les éléments qui doivent apparaître.

Pour chaque élément, tu peux définir :

- un libellé personnalisé
- l'affichage du résultat
- l'affichage des enfants

Si un parent est masqué ou si `Afficher enfants` est désactivé, ses sous-éléments peuvent ne plus apparaître dans l'aperçu et le PDF.

### Options de notes et synthèse

Les options principales sont :

- `Afficher les détails d'évaluations` pour afficher les notes détaillées.
- `Afficher par type d'évaluation` pour regrouper devoirs, examens, oraux, etc.
- `Afficher uniquement l'examen final` pour limiter le bulletin à la composition.
- `Afficher moyenne matière` pour montrer les moyennes par matière.
- `Afficher moyenne générale` pour montrer la moyenne globale.
- `Afficher moyenne générale de classe` pour comparer avec la classe.
- `Afficher les coefficients`, `points`, `rangs`, `mentions`, `décision` selon le rendu voulu.

Quand le modèle est prêt, clique sur `Enregistrer le modèle` ou `Mettre à jour`.

## 3. Tester le modèle avec l'aperçu

Dans le formulaire du modèle, choisis un `Bulletin de référence`.

Clique sur `Générer l'aperçu`.

L'aperçu utilise un vrai bulletin existant pour vérifier le rendu final sans publier le bulletin.

À contrôler avant d'enregistrer :

- Les matières apparaissent.
- La hiérarchie attendue apparaît.
- Les notes ou résultats sont visibles.
- Les moyennes sont cohérentes.
- Les colonnes inutiles sont masquées.
- Les sections, légendes, logo et signature apparaissent selon la configuration.

Si l'aperçu est vide, vérifie d'abord que le bulletin de référence a des notes ou qu'il a été régénéré après la configuration du modèle.

## 4. Définir un modèle par défaut

Dans la liste des modèles, clique sur `Définir par défaut`.

Le modèle par défaut est utilisé automatiquement lors de la génération des bulletins de l'année courante.

Conseil : garde un seul modèle par défaut actif par année scolaire pour éviter les rendus inattendus.

## 5. Générer un bulletin

Ouvre `Pédagogie > Bulletins`.

Crée un bulletin en choisissant :

- l'élève
- la période

Le système retrouve automatiquement la classe active de l'élève pour l'année courante.

Après création, clique sur `Générer`.

La génération reconstruit :

- les lignes de matières
- les lignes pédagogiques, si la structure existe
- les moyennes
- les rangs
- la moyenne générale
- le snapshot d'affichage utilisé par l'aperçu et le PDF

Si le modèle ou les notes ont changé, régénère le bulletin pour reconstruire son affichage.

## 6. Valider et publier

Après vérification, clique sur `Valider`.

La validation fige le bulletin pour confirmer qu'il peut être publié.

Clique ensuite sur `Publier` lorsque le bulletin est prêt à être communiqué.

Un bulletin validé ou publié ne doit plus être modifié automatiquement. Si une correction importante est nécessaire, il faut corriger les notes ou le modèle, puis régénérer un bulletin non figé.

## 7. Exporter le PDF

Dans la liste des bulletins, clique sur `PDF`.

Le PDF reprend le snapshot d'affichage du bulletin :

- entête et informations élève
- classe et période
- colonnes configurées dans le modèle
- matières ou hiérarchie pédagogique
- notes, résultats, moyennes et rangs
- moyenne générale
- légende des codes si activée
- avertissements éventuels
- zone de signature si activée

Si le PDF ne reflète pas les dernières modifications du modèle, clique d'abord sur `Générer` sur le bulletin concerné, puis relance l'export PDF.

## 8. Dépannage rapide

### Le modèle repasse en `Matières uniquement`

Ouvre le modèle, vérifie `Affichage pédagogique`, puis choisis `Hiérarchie complète` ou `Personnalisé`.

Contrôle aussi que les options de niveaux hiérarchiques sont cochées.

### L'année active est vide dans le formulaire

Vérifie qu'une année scolaire est active dans l'établissement.

En modification, le formulaire peut aussi reprendre l'année déjà rattachée au modèle. Si elle reste vide, recharge la page après avoir confirmé l'année active.

### Le bulletin ne contient aucune ligne

Vérifie :

- l'élève est bien inscrit dans une classe active
- la période appartient à l'année courante
- les cours existent pour la classe
- les évaluations existent sur la période
- les notes ou résultats d'évaluations sont saisis
- le bulletin a été régénéré après les modifications

### Les groupes ou sous-groupes n'apparaissent pas

Vérifie :

- `Affichage pédagogique` est sur `Hiérarchie complète`
- les options `groupes`, `domaines`, `sous-domaines`, `compétences` et `objectifs` sont activées selon le besoin
- les éléments sont cochés dans l'arbre pédagogique
- `Afficher enfants` est activé sur les parents
- la profondeur maximale couvre le niveau attendu

### La moyenne générale est absente

Vérifie :

- `Afficher moyenne générale` est activé dans le modèle
- les matières ont des coefficients si le modèle affiche les coefficients ou calcule des points
- les évaluations sont incluses dans la moyenne
- les notes sont valides et régénérées dans le bulletin

### Le PDF est vide ou incomplet

Régénère le bulletin, puis relance le PDF.

Si le problème persiste, vérifie l'aperçu du modèle avec le même bulletin de référence. L'aperçu doit être correct avant l'export PDF.

## 9. Bonnes pratiques

- Configure d'abord la structure pédagogique, puis les modèles de bulletin.
- Teste chaque modèle avec un bulletin de référence avant de l'utiliser en production.
- Régénère les bulletins après une modification de modèle, de notes ou de structure pédagogique.
- Valide uniquement lorsque le rendu est contrôlé.
- Utilise un nom clair pour chaque modèle, surtout si plusieurs niveaux utilisent des variantes différentes.
- Garde un modèle par défaut stable pour l'année courante.
