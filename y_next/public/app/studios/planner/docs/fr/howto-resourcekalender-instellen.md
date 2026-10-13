# Configurer un calendrier de ressource

Objectif : enregistrer les jours où une ressource est disponible, afin que l'histogramme, la surallocation et le nivellement tiennent compte de ce calendrier.

## Quand vous en avez besoin

L'équipe de maçons ne travaille que du lundi au jeudi. La grue est sur un autre projet pendant les deux premières semaines d'août. Un sous-traitant a quatre jours ouvrés fixes. Sans calendrier propre, l'application suppose que la ressource travaille les jours du calendrier du projet.

Un calendrier de ressource ne modifie aucune date de tâche. Il détermine seulement quand la ressource est disponible. Si une tâche travaille un jour où la ressource ne travaille pas, la capacité ce jour-là est de 0 et la ressource est en surallocation. Si vous voulez que la tâche elle-même travaille d'autres jours, donnez-lui un calendrier propre ([Créer et affecter un calendrier](docs://howto-kalender-maken-en-toewijzen)). La différence est expliquée dans [Calendriers et jours ouvrés](docs://uitleg-kalenders).

## Étapes

### Créer un nouveau calendrier de ressource

1. Choisissez *Ressources › Gérer › Ressources*. Le panneau des ressources s'ouvre. Si la ressource n'existe pas encore, créez-la avec *Nouvelle ressource dans le projet*.
2. Repérez la ligne de la ressource. Dans la colonne *Calendrier*, la valeur par défaut est *Calendrier du projet* : la ressource suit alors le calendrier du projet.
3. Dans cette liste, choisissez *+ Calendrier de la ressource*. La fenêtre *Calendrier de la ressource* s'ouvre. Elle contient les mêmes champs que le formulaire de calendrier : *Nom*, *Jours ouvrés*, les horaires de travail et les *Congés*. Le nouveau calendrier est une copie du calendrier standard. Il s'appelle *Calendrier de la ressource*.
4. Donnez au calendrier un nom qui convient à la ressource, par exemple *Crew Mon–Thu*, et définissez les jours ouvrés : décochez le vendredi sous *Jours ouvrés*. Vous placez les jours fériés ou les périodes d'arrêt dans la liste *Congés* avec *Ajouter un jour férié*.
5. Cliquez sur *Appliquer*. Le calendrier est maintenant dans la bibliothèque de ressources du projet et lié à la ressource, en une seule étape que vous annulez avec *Annuler*. Avec *Annuler*, rien n'est créé.

### Choisir ou ajuster un calendrier existant

Dans la colonne *Calendrier*, choisissez un calendrier dans la liste. *Calendrier du projet* supprime à nouveau le calendrier propre à la ressource. Si vous voulez ajuster le calendrier choisi, cliquez sur le crayon à côté de la liste (*Modifier…*). La fenêtre *Calendrier de la ressource* s'ouvre avec le calendrier actuel.

### Consulter le résultat

1. Si la barre d'état affiche *Obsolète — recalculer (F5)*, appuyez sur **Calculer** (F5).
2. Choisissez *Ressources › Histogramme › Histogramme* et cliquez sur la ressource dans la liste à gauche de l'histogramme. Les jours où la ressource ne travaille pas, mais est planifiée, sont en rouge. Si vous placez la souris sur l'un d'eux, la barre affiche par exemple *Ne travaille pas ce jour selon le calendrier « Crew Mon–Thu »*.
3. Sous *Ressources › Surallocation* se trouve le nombre de ressources en surallocation, et la barre d'état affiche par exemple *1 ressource(s) en surallocation*.

## Pièges et ce que fait l'application dans ce cas

**Seuls les jours comptent, pas les heures.** Un calendrier de ressource détermine les jours où la ressource travaille. Le nombre d'unités disponibles ce jour-là découle de *Unités max* de la ressource, et non des horaires de travail du calendrier.

**Le nivellement ne résout pas toujours ce problème.** S'il n'existe aucune période où chaque jour de la tâche tombe sur un jour ouvré de la ressource, décaler ne sert à rien. Choisissez *Ressources › Nivellement › Niveler…* et cliquez sur *Calculer*. La tâche apparaît alors sous *Conflits restants*, avec la raison *La ressource ne travaille pas tous les jours nécessaires à cette tâche — le décalage ne résout pas ce problème*. Affectez alors la tâche à une autre ressource, ou donnez-lui un calendrier propre.

**Un calendrier partagé.** La liste montre tous les calendriers du projet, donc aussi le calendrier du projet et les calendriers des tâches. Si vous ajustez un tel calendrier avec le crayon, le planning des tâches qui l'utilisent change aussi, et la barre d'état affiche *Obsolète — recalculer (F5)*. Créez plutôt un calendrier propre pour la ressource.

**La surallocation n'est pas toujours due au calendrier.** Une ressource qui travaille tous les jours peut aussi être en surallocation : l'info-bulle ne mentionne le calendrier que si le jour n'est pas un jour ouvré de la ressource.

## Voir aussi

- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : pourquoi un calendrier de ressource ne modifie aucune date.
- [Créer et affecter un calendrier](docs://howto-kalender-maken-en-toewijzen) : les champs du formulaire de calendrier.
- [Générer les jours fériés et les congés du bâtiment](docs://howto-feestdagen-genereren) : placer les jours fériés et les périodes d'arrêt dans le calendrier.
- [Fenêtres des calendriers](docs://ref-kalenders) : tous les champs des fenêtres de calendrier.
