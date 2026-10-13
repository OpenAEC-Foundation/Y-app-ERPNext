# Utiliser la vue partagée et la mini-carte

Objectif : voir deux parties de la chronologie côte à côte, et parcourir rapidement un long planning.

## Quand vous en avez besoin

Vous discutez du début des fondations et, en même temps, de la remise neuf mois plus tard. Sans aide, vous zoomez et dézoomez sans cesse et vous perdez le fil de l'endroit où vous étiez. Avec la **vue partagée**, vous voyez le même planning deux fois, côte à côte, chaque fois avec sa propre fenêtre de temps. Avec la **mini-carte**, vous voyez toute la durée du projet dans une bande étroite, et vous passez d'un clic à la partie que vous cherchez.

## Étapes

### Activer la vue partagée

1. Choisissez l'onglet *Affichage*. Dans le groupe *Présentation* se trouvent *Présentation*, *Vue partagée* et *Mini-carte*.
2. Cliquez sur *Vue partagée*. Le Gantt se divise en deux. Les deux fenêtres reprennent le zoom et la position de votre vue actuelle.

Les deux fenêtres partagent le tableau des tâches, les lignes et le défilement vertical. Chaque fenêtre a sa propre échelle de temps : le zoom et la position horizontale.

### Donner à chaque fenêtre sa propre plage de temps

- Zoomez et faites défiler la fenêtre sous votre souris. Avec le réglage par défaut de *Défilement & zoom* (*Zoom + glisser*), la molette de la souris zoome dans cette fenêtre, centré sur votre souris. Si votre réglage suit un autre mode, la molette agit dans les deux fenêtres selon ce mode.
- Avec le réglage par défaut, vous faites défiler les lignes avec Maj et la molette de la souris. Cela s'applique aux deux fenêtres à la fois.
- Les boutons *Zoom +* et *Zoom -* et la liste de l'échelle de temps (par exemple *Trimestre*) n'agissent que sur la fenêtre de gauche. Pour zoomer dans la fenêtre de droite, utilisez donc la molette de la souris.
- Faites glisser la séparation entre les deux fenêtres vers la gauche ou la droite pour les élargir ou les réduire. Au départ, chacune occupe la moitié.

### Désactiver la vue partagée

Cliquez de nouveau sur *Vue partagée*. Il ne reste qu'une fenêtre, avec la vue de la fenêtre de gauche. Une nouvelle vue partagée démarre de nouveau avec la vue du moment.

### Activer la mini-carte

1. Dans le groupe *Présentation*, cliquez sur *Mini-carte*.
2. Sous la chronologie apparaît une bande qui couvre toute la durée du projet. Les tâches de votre vue actuelle s'y affichent sous forme de fins traits (donc, après un filtre, seules les tâches affichées par ce filtre), et un cadre entoure la partie que vous voyez maintenant.
3. Cliquez n'importe où sur la bande pour placer le cadre à cet endroit. La fenêtre se centre sur ce point. Vous pouvez aussi saisir le cadre et le faire glisser.

La mini-carte déplace seulement la fenêtre de temps. Les lignes restent telles quelles.

Si la vue partagée est active, chaque fenêtre reçoit sa propre bande, sous sa propre partie de la chronologie. Chaque bande ne commande que la fenêtre située au-dessus d'elle.

## Pièges et comportement de l'application

**La mini-carte ne fait rien si tout le projet est déjà visible.** Si vous dézoomez au point que tout le planning tient à l'écran, il n'y a rien où aller et un clic n'a aucun effet. Zoomez d'abord.

**La mini-carte n'existe que sur le Gantt.** Sur les onglets *Tableau*, *IFC* et *Rapport*, et dans le panneau des ressources complet (*Ressources*, et non *Dock ressources*), il n'y a pas de chronologie, donc ni mini-carte ni vue partagée. Elles reviennent dès que vous revenez à une vue avec le Gantt.

**La vue partagée appartient au projet, la mini-carte non.** La vue partagée s'applique au projet ouvert : si vous passez à un autre projet puis revenez, elle est toujours là. La mini-carte est un seul choix pour tous les projets et reste active ou inactive après un redémarrage. Ce sont deux choix d'écran : ils n'entrent pas dans le fichier du projet, ne rendent pas le projet « modifié » et ne figurent pas dans *Annuler*.

**Vue partagée et présentation.** Les deux restent visibles quand vous activez le mode présentation (voir [Présenter sur un grand écran](docs://howto-presentatie)). Comme le ruban disparaît alors, vous ne pouvez plus les activer ni les désactiver dans ce mode. Réglez-les donc correctement avant de commencer.

## Voir aussi

- [Présenter sur un grand écran](docs://howto-presentatie) : le Gantt en plein écran, sans le ruban.
- [Créer et utiliser une disposition](docs://howto-layouts-gebruiken) : l'échelle de temps peut aussi être enregistrée dans une disposition.
