# Traçage du chemin

Objectif : rendre visible la chaîne de tâches qui précèdent ou suivent une tâche. Vous voyez ainsi ce qui fixe la date d'une tâche et ce qui se décale si elle a du retard.

## Quand vous en avez besoin

La toiture ne commence que dans trois semaines. Vous voulez savoir quelle tâche le détermine. Ou le maçon a une semaine de retard, et vous voulez voir quelles tâches suivantes se décalent. Dans un planning avec des dizaines de relations, vous ne voyez pas cela avec les seules lignes. Avec **traçage du chemin**, l'application colore tous les **prédécesseurs** (tâches qui précèdent la tâche choisie, directement ou par d'autres tâches) et tous les **successeurs** (tâches qui suivent cette tâche). Elle estompe le reste.

## Étapes

1. Sélectionnez la tâche dont vous voulez voir le chemin, dans le tableau des tâches ou sur sa barre dans le Gantt. Si vous sélectionnez plusieurs tâches, l'application trace à partir de la tâche que vous avez sélectionnée en premier.
2. Choisissez *Planification › Traçage du chemin › Prédécesseurs* pour tout ce qui précède la tâche, ou *Planification › Traçage du chemin › Successeurs* pour tout ce qui la suit. Les deux boutons peuvent être activés en même temps. Les mêmes deux boutons se trouvent dans l'onglet *Tableau*, dans le groupe *Traçage du chemin*.
3. Si vous voulez les deux sens d'un coup, faites un clic droit sur la tâche, dans le Gantt ou dans le tableau des tâches, et choisissez *Tracer le chemin*.
4. Regardez le résultat dans le Gantt et dans le tableau des tâches. La manière de le lire est expliquée ci-dessous.
5. Vous arrêtez en cliquant de nouveau sur le bouton actif, en faisant un clic droit sur une tâche et en choisissant *Arrêter le traçage du chemin*, ou avec Échap. Échap efface aussi la sélection.

Si vous sélectionnez une autre tâche pendant le traçage, le chemin suit la nouvelle sélection.

## Lire le résultat

- Les prédécesseurs sont en or, les successeurs en violet. Dans le Gantt, les barres changent de couleur. Dans le tableau des tâches, une bande apparaît à gauche de la ligne : pleine pour les prédécesseurs, en pointillés pour les successeurs. La tâche choisie a un contour.
- Une couleur plus foncée, et dans le tableau des tâches une bande plus épaisse avec un texte en gras, marque la chaîne des **relations déterminantes** : les relations qui fixent réellement les dates. Ce que cela signifie est expliqué dans [Relations et décalage](docs://uitleg-relaties).
- Toutes les tâches hors du chemin sont estompées. Les lignes de relation qui n'appartiennent pas au chemin sont plus pâles et en pointillés.

## Pièges et ce que fait l'application

**Aucune tâche sélectionnée.** Sans tâche sélectionnée, il n'y a rien à tracer : le bouton est actif, mais rien ne change à l'écran. Sélectionnez d'abord une tâche.

**Pas de mise en évidence de la chaîne des relations déterminantes.** La mise en évidence vient du dernier calcul. Si le planning n'a pas encore été calculé, ou si le calcul donne une erreur, l'application colore tous les prédécesseurs et successeurs avec la même intensité. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*, puis regardez de nouveau le chemin. Après une modification, la mise en évidence reste liée au calcul précédent tant que la barre d'état affiche *Obsolète — recalculer (F5)*.

**Une relation sur une phase.** Le traçage suit les relations telles que vous les avez créées. Une relation partant d'une phase (tâche récapitulative) ou y arrivant relie la phase elle-même. Pour le calcul, elle s'applique à chaque tâche de cette phase, mais le chemin ne continue pas vers les tâches à l'intérieur. Si vous tracez une tâche à l'intérieur d'une phase qui est reliée à une autre tâche par une relation sur la phase elle-même, vous ne voyez donc pas cette relation. Dans ce cas, sélectionnez la phase elle-même.

**Un seul sens affiché.** Si seul *Prédécesseurs* est actif, vous ne voyez pas ce qui suit la tâche, et inversement.

## Voir aussi

- [Relations et décalage](docs://uitleg-relaties) : ce qu'est une relation déterminante et comment l'application calcule la date de début d'une tâche.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : quelle chaîne fixe la date de fin du projet.
- [Ajouter des relations](docs://howto-relaties-leggen) : ajouter une relation si une liaison manque dans le chemin.
