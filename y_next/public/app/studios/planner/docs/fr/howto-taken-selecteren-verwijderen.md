# Sélectionner, supprimer et annuler des tâches

Objectif : choisir des tâches, les retirer et annuler une erreur.

## Quand en avez-vous besoin

Presque chaque action du planning agit sur les tâches sélectionnées : supprimer, copier, mettre en retrait, activer ou désactiver un jalon. Vous supprimez des tâches lorsque le travail n'est plus nécessaire ou que le planning est révisé. Comme l'application ne demande aucune confirmation avant de supprimer, *Annuler* est votre filet de sécurité.

## Étapes

### Sélectionner des tâches

- **Une tâche.** Cliquez sur la ligne dans le tableau des tâches ou sur la barre dans le Gantt.
- **Plusieurs tâches.** Ctrl+clic (⌘+clic sur Mac) ajoute une tâche à la sélection ou la retire. Dans le tableau des tâches, Maj+clic sélectionne toutes les tâches, de la tâche active à celle sur laquelle vous avez cliqué.
- **Toutes les tâches visibles.** Ctrl+A, lorsque le focus est dans le tableau des tâches ou dans le Gantt. Les tâches masquées par un filtre n'en font pas partie, pas plus que les sous-tâches d'une phase réduite.
- **Un cadre dans le Gantt.** Maintenez Ctrl enfoncé et faites glisser sur le fond vide : toutes les tâches des lignes que touche le cadre sont sélectionnées, même si leur barre se trouve à côté. Seule la hauteur du cadre compte, pas l'axe du temps. Si vous relâchez Ctrl seulement après le bouton de la souris, ces tâches s'ajoutent à la sélection existante ; sinon, elles la remplacent. Sans Ctrl, ce glissement fait défiler la frise chronologique avec le réglage par défaut.
- **Rien.** Échap, ou un clic sur le fond vide du Gantt.

Si vous sélectionnez une tâche récapitulative, ses sous-tâches ne sont pas sélectionnées avec elle. Supprimer et copier les incluent, en revanche.

### Supprimer des tâches

Sélectionnez les tâches, puis choisissez l'une de ces méthodes :

- *Accueil › Édition › Supprimer*. Le même bouton se trouve dans l'onglet *Tableau*.
- Suppr ou Retour arrière, si le focus n'est pas dans le tableau des tâches : cliquez donc d'abord sur une barre du Gantt.
- *Supprimer* dans le menu contextuel. Si la tâche sur laquelle vous avez cliqué fait partie de la sélection, la commande s'applique à toute la sélection ; sinon, elle ne s'applique qu'à cette tâche.
- La petite corbeille en haut du panneau *Propriétés* (info-bulle *Supprimer la tâche*). Elle supprime la tâche affichée dans le panneau.

L'application ne demande aucune confirmation. Si vous supprimez plusieurs tâches à la fois, cela forme une seule étape pour *Annuler*.

Avec elles disparaissent : toutes les sous-tâches d'une tâche récapitulative supprimée, toutes les relations depuis et vers les tâches supprimées, ainsi que leurs affectations de ressources. Si vous supprimez la dernière sous-tâche d'une tâche récapitulative, elle reste une tâche ordinaire. Si *WBS auto* est activé, l'application renumérote l'arborescence. Le planning n'est ensuite plus à jour : appuyez sur **Calculer** (F5), sauf si *Calculer automatiquement* est activé.

### Réduire et développer

Une tâche récapitulative porte un triangle devant son nom dans le tableau des tâches ; cliquez dessus pour masquer ou afficher ses sous-tâches. Avec *Affichage › Plan › Réduire* et *Développer*, vous agissez sur les tâches récapitulatives sélectionnées, ou sur toutes si rien n'est sélectionné. Le menu contextuel d'une tâche récapitulative contient aussi *Réduire* et *Développer*. Dans une vue groupée, les boutons agissent sur les groupes.

L'application garde l'état réduit ou développé par document ouvert. Ce n'est pas une étape d'*Annuler*, et ce n'est pas enregistré dans le fichier de projet.

### Annuler et rétablir

- *Accueil › Édition › Annuler* et *Rétablir* (aussi dans l'onglet *Tableau*), les flèches dans la barre de titre, ou Ctrl+Z pour annuler et Ctrl+Y ou Ctrl+Maj+Z pour rétablir.
- Si vous effectuez une nouvelle action après *Annuler*, *Rétablir* n'est plus disponible.

*Annuler* porte sur les modifications de vos données de projet (tâches, relations, ressources, calendriers et autres), ainsi que sur l'application d'une disposition. Les modifications des colonnes du tableau des tâches comptent aussi comme étapes : ajouter, retirer, déplacer, redimensionner, ajuster automatiquement, épingler et remettre la disposition des colonnes à la valeur par défaut. Ces étapes de colonnes appartiennent au tableau des tâches lui-même et s'appliquent à toute l'application, pas à un seul document. L'application conserve les cent dernières étapes par document, moins pour un projet très volumineux.

## Pièges et comportement de l'application

**Dans le tableau des tâches, Suppr ne supprime pas de tâche.** Si le focus est dans le tableau des tâches, Suppr (ou Retour arrière) efface le contenu des cellules sélectionnées. Pour une cellule obligatoire ou calculée, comme le nom ou la durée, l'application refuse et affiche un message sous le tableau des tâches, par exemple pour le nom : *Cette valeur est obligatoire et ne peut pas rester vide.* Rien n'est alors effacé, pas même dans les autres cellules sélectionnées. Cliquez sur une barre du Gantt ou utilisez *Supprimer* (dans l'onglet *Tableau*, où il n'y a pas de Gantt : *Tableau › Édition › Supprimer* ou le menu contextuel).

**Une phase entière disparaît d'un coup.** Si vous supprimez une tâche récapitulative, ses sous-tâches, leurs relations et leurs affectations disparaissent avec elle. *Annuler* (Ctrl+Z) restaure tout, y compris les relations et les affectations.

**Ce qui ne revient pas.** La sélection, la réduction et le développement, ainsi que le bouton *Effacer* dans le bandeau *Non disponible pendant le filtrage/regroupement/tri*, ne font pas partie d'*Annuler*. Si vous appuyez sur Ctrl+Z après *Effacer*, vous annulez donc votre étape précédente, pas l'effacement.

**Supprimer une tâche dont d'autres dépendent.** Les relations depuis et vers cette tâche disparaissent aussi. Les tâches qui n'étaient liées qu'à elle se détachent et reprennent leur propre date de début planifiée après **Calculer**. Ajoutez de nouvelles relations si nécessaire, voir [Ajouter des relations](docs://howto-relaties-leggen).

## Voir aussi

- [Ajouter des tâches et des jalons](docs://howto-taken-en-mijlpalen-toevoegen) : l'inverse, et copier des tâches.
- [Modifier la structure](docs://howto-structuur-aanpassen) : rattacher une tâche sous une autre phase au lieu de la supprimer.
- [Glisser, déplacer et zoomer dans le Gantt](docs://howto-gantt-bedienen) : le cadre de sélection et les modes de défilement.
- [Menus contextuels](docs://ref-contextmenus) : ce que font *Supprimer* et les autres éléments sur une sélection.
