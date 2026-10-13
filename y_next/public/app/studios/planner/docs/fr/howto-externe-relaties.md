# Relations externes vers un autre projet

Objectif : lier une tâche de ce projet à une tâche d'un autre fichier de projet, afin que votre planning tienne compte du travail planifié ailleurs.

## Quand vous en avez besoin

Votre agrandissement ne peut commencer qu'une fois le terrain préparé pour la construction, et ces travaux se trouvent dans le projet de l'entrepreneur. Ou le poseur ne peut commencer qu'une fois votre structure terminée, et il planifie dans son propre fichier. Une relation ordinaire ne fonctionne qu'entre des tâches du même projet. Une **relation externe** lie une tâche à une tâche d'un autre fichier.

Une relation externe ne se calcule pas en direct avec l'autre projet. L'application enregistre une **date d'ancrage** fixe : la date de la tâche externe au moment où vous la liez. Le calcul utilise cette date comme limite. Si l'autre projet change, rien ne bouge dans le vôtre tant que vous n'actualisez pas l'ancrage.

## Étapes

1. Sélectionnez exactement une tâche de ce projet : la tâche qui dépend de la tâche externe, ou dont dépend la tâche externe.
2. Choisissez *Accueil › Tâches › Lier ▾ › Ajouter une relation externe…*. Le même menu se trouve dans *Planification › Relations* et dans *Tableau › Tâches*. L'élément n'est disponible que si une seule tâche est sélectionnée.
3. Dans la fenêtre *Relation externe (inter-projets)*, choisissez l'une des deux voies. Avec *Fichier source*, vous choisissez le fichier de projet sous *Choisir un fichier récent*, puis la *Tâche source* ; l'application lit le fichier en lecture seule, ne l'ouvre pas comme document, et reprend elle-même la date d'ancrage. Cette voie ne fonctionne que dans l'application de bureau, et seulement pour un fichier de la liste des fichiers récents ; sinon, le bouton *Fichier source* est désactivé. Avec *Manuel (solution de secours)*, vous remplissez l'*Identifiant de projet* et l'*Identifiant de tâche* de la tâche externe, éventuellement un *Nom de la tâche (facultatif)*, et la *Date d'ancrage*. Dans la version navigateur, c'est la seule voie.
4. Sous *Direction*, choisissez si la tâche externe est votre prédécesseur ou votre successeur : *Prédécesseur (externe → moi)* ou *Successeur (moi → externe)*.
5. Choisissez le *Type de relation* (FS, SS, FF ou SF) et remplissez le *Décalage (jours ouvrés)* si nécessaire, par exemple `0d` ou `2d`.
6. Cliquez sur *Ajouter la relation* et appuyez sur **Calculer** (F5).

La date que vous saisissez comme ancrage pour une relation manuelle dépend de la direction et du type :

- Avec un **prédécesseur** externe, la première lettre du type compte : F signifie la date de fin de la tâche externe, S la date de début. Avec FS et FF, vous saisissez donc la fin ; avec SS et SF, le début.
- Avec un **successeur** externe, la deuxième lettre compte : S est la date de début de la tâche externe, F la date de fin. Avec FS et SS, vous saisissez donc le début ; avec FF et SF, la fin.

Si vous planifiez en heures (planification horaire activée et tâche sur un calendrier avec horaires de travail), le champ *Date d'ancrage* demande aussi une heure.

Exemple : le projet du chantier se termine le vendredi 18 juin 2027. Vous liez *Groundwork* à un prédécesseur externe de type FS, avec la date d'ancrage 18 juin 2027. Après **Calculer**, la tâche groundwork commence le lundi 21 juin, le premier jour ouvré après l'ancrage. Un successeur externe fonctionne à l'inverse : il limite la date de fin la plus tardive que votre tâche peut atteindre.

## Ce que vous voyez et comment vous le gérez

- Les relations externes apparaissent sous forme de texte dans les colonnes *Prédécesseurs* et *Successeurs* du tableau des tâches (ajoutez-les avec le **+** dans l'en-tête du tableau, sous *Relations*), avec le nom du projet et de la tâche, et le type. Un petit triangle accompagné de *Source manquante* indique que la source n'a pas été lue ; placez la souris sur la relation pour voir le projet (la ligne *Identifiant de projet* affiche le nom du projet dès qu'il est connu), l'identifiant de tâche, la date d'ancrage et l'état de la source.
- Dans le Gantt, une barre fantôme grise se trouve sur la tâche. Avec un prédécesseur, elle se termine à l'ancrage ; avec un successeur, elle commence à l'ancrage. Un contour en pointillés accompagné de l'étiquette rouge *obsolète* signifie que la source n'a pas été lue. Avec une relation manuelle, c'est toujours le cas.
- Faites un clic droit sur une relation dans la colonne : vous y trouvez *Modifier la relation externe…* et *Supprimer la relation*. Si la relation a un fichier source, *Actualiser la source* est aussi disponible.
- Choisissez *Lier ▾ › Actualiser toutes les relations externes* pour relire les fichiers source et mettre à jour les ancrages. Cela ne fonctionne que dans l'application de bureau. Si vous n'avez que des relations manuelles, l'application affiche *Aucune source externe actualisable (chemin de fichier manquant).* Appuyez sur **Calculer** après une actualisation.
- Si vous modifiez le type ou la direction, de sorte que l'ancrage doive utiliser l'autre côté de la tâche externe (début au lieu de fin, ou l'inverse), l'application demande, pour une relation manuelle, un nouvel ancrage : *Choisissez un nouvel ancrage : le type de relation utilise désormais l’autre côté de la tâche source.* Avec une relation qui a un fichier source, l'application relit elle-même l'ancrage.

## Pièges et ce que fait l'application

**L'autre projet ne se met pas à jour seul.** Si la tâche externe change de date, votre planning continue de calculer avec l'ancienne date d'ancrage, jusqu'à ce que vous l'actualisiez ou que vous changiez l'ancrage. Avec la voie manuelle, vous modifiez vous-même la date d'ancrage : faites un clic droit sur la relation et choisissez *Modifier la relation externe…*.

**Un prédécesseur externe est une limite inférieure.** Si votre tâche commence plus tard que ne l'exige l'ancrage, à cause de ses propres prédécesseurs, ce sont ces prédécesseurs qui décident. L'ancrage ne fait que pousser la tâche vers l'avant.

**Un successeur externe est une limite supérieure.** Si l'ancrage est trop serré, vous le voyez sous forme de marge négative sur votre tâche et sur les tâches qui la précèdent. Aucun avertissement distinct n'apparaît ; surveillez donc la colonne *Marge totale*.

**Seulement un décalage fixe.** Pour une relation externe, vous ne pouvez pas indiquer un décalage en jours calendaires ou en pourcentages ; l'application affiche *Les relations externes n'acceptent qu'un décalage fixe en jours ou en temps de travail.* Les jours ouvrés se comptent dans le calendrier de votre propre tâche. Un décalage en heures ne compte que pour une tâche planifiée en heures ; pour une tâche en jours, le calcul l'ignore. Utilisez alors des jours ouvrés.

**L'identifiant de projet d'un autre fichier.** L'identifiant de projet n'est pas dans un champ ni dans une colonne ; il est enregistré comme `InternalProjectId` dans l'IFC de ce projet. Ouvrez le projet, allez dans l'onglet *IFC* et choisissez *Générer IFC*. Le calcul n'utilise que la date d'ancrage ; l'identifiant n'est pas une simple étiquette. Lors d'une actualisation, l'application reconnaît d'abord un fichier source par son identifiant de projet, puis par son chemin de fichier. Si vous saisissez pour une relation manuelle le même identifiant que celui d'un fichier source, la relation est mise à jour en même temps que ce fichier lors de son actualisation. Vous trouvez l'*ID de tâche* d'une tâche de l'autre projet dans le tableau des tâches de cet autre projet, dans la colonne *ID de tâche* sous *Technique*.

## Voir aussi

- [Relations et décalage](docs://uitleg-relaties) : comment l'application calcule une relation et un décalage.
- [Ajouter des relations](docs://howto-relaties-leggen) : relations entre tâches du même projet.
- [Contraintes et échéances](docs://uitleg-constraints) : limites de date sur une tâche, sans autre projet.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : contient une relation externe sur *Car park paving* (un prédécesseur externe).
