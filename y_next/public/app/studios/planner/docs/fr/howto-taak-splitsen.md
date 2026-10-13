# Fractionner une tâche

Objectif : interrompre une tâche, pour que le travail s'arrête puis reprenne plus tard, sans en faire deux tâches.

## Quand vous en avez besoin

La pose des armatures prend huit jours ouvrés. Mais après quatre jours, la grue doit partir sur un autre chantier, et le travail reprend deux jours plus tard. Deux tâches séparées obligent à gérer vos relations et vos affectations deux fois. Avec une **interruption**, la tâche reste une seule tâche, avec une barre qui présente un vide. L'application appelle aussi l'interruption une *pause*.

La durée de travail reste la même, mais la tâche dure plus longtemps dans le calendrier. Par exemple : une tâche de 8 jours ouvrés qui commence le mardi 29 septembre 2026 se termine le jeudi 8 octobre. Si vous ajoutez une interruption de 2 jours ouvrés après 4 jours ouvrés, la fin tombe le lundi 12 octobre. La durée reste de 8 jours ouvrés ; seule la fin se décale de deux jours ouvrés.

## Étapes

### Fractionner dans le diagramme de Gantt

1. Choisissez *Accueil › Tâches › Fractionner la tâche* (ou *Planification › Relations › Fractionner la tâche*). Au-dessus du planning, le message *Cliquez sur une barre au jour où l’interruption commence et faites glisser vers la droite pour en définir la longueur. Échap pour arrêter.* apparaît. Le bouton se trouve aussi dans l'onglet *Tableau* (*Tableau › Tâches › Fractionner la tâche*), mais il est désactivé là.
2. Placez la souris sur la barre. Une ligne en pointillés et une étiquette avec la date indiquent où l'interruption commencerait. Appuyez sur la barre, au jour où l'interruption commence.
3. Faites glisser vers la droite. L'étiquette affiche la longueur, par exemple *2 jours ouvrés de pause* : la distance en jours ouvrés jusqu'au jour sous votre souris. Relâchez.

Si vous cliquez sans faire glisser, la pause dure un jour ouvré. Faire glisser vers la gauche raccourcit à nouveau la pause, jusqu'à un minimum d'un jour ouvré. Pour une tâche en heures, le calcul se fait en heures.

Le mode reste actif, ce qui vous permet de fractionner d'autres tâches. Vous l'arrêtez avec Échap ou avec le bouton *Arrêter* dans le message. Si vous appuyez sur Échap pendant le glissement, l'application annule la pause et le mode s'arrête. Chaque geste compte pour une étape de *Annuler*.

Après un fractionnement, le planning n'est plus à jour. Cliquez sur **Calculer** (F5) pour obtenir les dates définitives.

### Faire glisser une interruption existante dans le diagramme de Gantt

Cela fonctionne sans le mode fractionnement, directement sur une barre qui contient une interruption.

- Faites glisser la plage **après** la pause vers la droite ou vers la gauche. La pause s'allonge ou se raccourcit, avec l'étiquette *3 jours ouvrés de pause*. Si vous la ramenez jusqu'à ce que la pause soit à 0, l'étiquette affiche *Fusionner* et les deux plages ne font plus qu'une.
- Faites glisser le bord droit de la plage **avant** la pause. Ce segment s'allonge ou se raccourcit, avec l'étiquette *Segment : 5 jours ouvrés*. La durée de la tâche change en même temps.
- Si vous faites glisser le premier segment, vous déplacez toute la tâche, comme pour toute barre.

### Fractionner et ajuster dans le panneau des propriétés

Sélectionnez la tâche. Dans le panneau *Propriétés*, le bloc *Interruptions* se trouve entre *Dépendances* et *Affectations*. Faites défiler jusqu'à lui si nécessaire.

- *Ajouter une interruption* ajoute une pause d'un jour ouvré au milieu de la plage la plus longue.
- Chaque pause a deux champs : *après* (le nombre de jours ouvrés de travail avant la pause) et *pause* (la durée de la pause). À côté, figurent les dates de la plage qui suit la pause. Pour une tâche en heures, ils affichent des heures.
- Si vous mettez *pause* à 0, l'interruption disparaît. La petite corbeille (*Supprimer l'interruption*) fait la même chose.

Soyez prudent avec *après* : ce champ allonge ou raccourcit la plage de travail avant la pause, et avec elle la durée de toute la tâche. Avec *pause*, seule la fin change.

### Supprimer une interruption

Faites un clic droit sur l'interruption dans le diagramme de Gantt, ou sur la plage qui la suit, et choisissez *Supprimer l'interruption*. *Supprimer toutes les interruptions* se trouve dans le menu du clic droit de chaque barre qui contient une interruption. Vous pouvez aussi utiliser le bloc *Interruptions* dans le panneau *Propriétés*, comme décrit ci-dessus.

### Avec un assistant IA

Un assistant IA connecté définit des interruptions avec l'outil `planner_set_task_splits`, sous la même forme que le panneau : après combien de jours ouvrés (ou d'heures ouvrées) de travail, et combien de jours ouvrés (ou d'heures ouvrées) de pause. Il donne toujours la liste complète ; une liste vide supprime toutes les interruptions. Il les relit avec `planner_get_task`. Les mêmes règles s'appliquent que ci-dessous : une tâche que vous ne pouvez pas fractionner, l'assistant ne peut pas la fractionner non plus. Contrairement à un fractionnement que vous faites vous-même, l'application recalcule ensuite le planning toute seule. Pour connecter un assistant, voir [Connexion d'un assistant IA (MCP)](docs://howto-ai-assistent-koppelen).

## Pièges et comportement de l'application

**Toutes les tâches ne peuvent pas être fractionnées.** Vous ne pouvez pas fractionner un jalon, une tâche récapitulative, une tâche dont *Hamac (durée dérivée)* est activé (voir [Créer un hamac](docs://howto-hammock)), une tâche de type de durée *Temps écoulé*, une tâche *Planifiée manuellement*, ni une tâche plus courte que deux jours ouvrés. En mode fractionnement, la souris affiche un curseur d'interdiction et rien ne se passe. Pour une telle tâche, le bloc *Interruptions* manque aussi dans *Propriétés*.

**Sur l'onglet *Tableau*, le bouton ne fonctionne pas.** *Fractionner la tâche* est désactivé là, avec l'info-bulle *Disponible uniquement lorsque le diagramme de Gantt est visible*. Le geste a besoin d'une barre. Le mode fractionnement et le mode lier s'arrêtent mutuellement.

**Un clic sans effet.** Une interruption ne peut pas commencer le premier jour de la tâche, ni à l'intérieur d'une pause existante. Chaque plage de travail doit aussi rester d'au moins un jour ouvré. Si vous cliquez à un tel endroit, rien ne se passe, sans message.

**Une tâche avec avancement.** Si la tâche a un avancement, une interruption ne peut commencer qu'après le travail déjà réalisé. À 50 % de 8 jours ouvrés, c'est au plus tôt le cinquième jour ouvré. Un clic dans la partie réalisée ne fait rien, et une tâche achevée à 100 % ne peut plus être fractionnée. Dans le panneau, *Ajouter une interruption* est alors désactivé : c'est aussi le cas si le milieu de la plage la plus longue tombe dans le travail réalisé, par exemple à 75 % de 8 jours ouvrés.

**Le nivellement crée aussi des interruptions.** Elles apparaissent dans le bloc *Interruptions* avec l'étiquette *nivellement*. *Ressources › Nivellement › Effacer le nivellement* les supprime à nouveau. Si vous modifiez vous-même les interruptions d'une telle tâche, toutes ses pauses de nivellement deviennent les vôtres, et *Effacer le nivellement* ne les supprime plus.

**Les interruptions ne sont pas transmises à MS Project ni à Primavera.** Si vous exportez vers *MS Project XML* ou *Primavera P6 XML*, ce programme ne connaît une interruption que comme répartition du travail d'une affectation. Sans une telle répartition, la tâche arrive sans interruption, et l'application indique combien de tâches sont concernées : *1 tâche avec interruptions a été exportée sans ses interruptions : MS Project/P6 ne les connaissent que comme répartition du travail.* Dans le fichier IFC de l'application, elles sont conservées.

**Un fichier avec des interruptions que l'application ne peut pas modifier.** Les interruptions d'un fichier source qui ne correspondent pas au format de l'application affichent le message *Ces interruptions proviennent du fichier source sous une forme qui ne peut pas être modifiée ici* dans le panneau, avec uniquement *Supprimer toutes les interruptions*.

## Voir aussi

- [Chemin critique et marge](docs://uitleg-kritiek-pad) : comment le planning compte en jours ouvrés et pourquoi la fin se décale.
- [Ajouter des relations](docs://howto-relaties-leggen) : un autre mode du diagramme de Gantt, que vous utilisez en faisant glisser une barre.
- [Boîte de dialogue de la tâche et panneau des propriétés](docs://ref-taak-eigenschappen) : la section Interruptions du panneau des propriétés.
