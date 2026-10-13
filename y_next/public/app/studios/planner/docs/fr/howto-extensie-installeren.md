# Installer et gérer une extension

Objectif : installer une extension, lire la question d'autorisation, puis désactiver ou supprimer l'extension plus tard.

## Quand vous en avez besoin

Une extension ajoute quelque chose à l'application sans que vous deviez attendre une nouvelle version. Une extension peut, par exemple, ajouter un format d'importation qui apparaît dans *Fichier › Importer*, placer un bouton dans le ruban ou fournir une police pour l'export PDF. Le catalogue officiel les répartit en catégories : *Import/Export*, *Planification*, *Rapports*, *Utilitaires*, *Polices* et *Autre*.

Réfléchissez bien avant d'en installer une. Une extension est du code de programme qui s'exécute avec les mêmes droits que l'application elle-même, et l'application ne peut pas les restreindre. C'est pourquoi l'application demande une autorisation à chaque installation. Ce que vous voyez dans cette question est expliqué ci-dessous.

## Étapes

### Installer une extension depuis le catalogue

1. Choisissez *Fichier › Extensions*.
2. Choisissez l'onglet *Parcourir*. L'application charge le catalogue pendant qu'elle affiche *Chargement du catalogue...*. Ce qui figure dans le catalogue est décidé par l'OpenAEC Foundation, qui le maintient, et cela peut changer.
3. Recherchez une extension avec le champ *Rechercher des extensions...*. Il cherche dans le nom, la description, l'auteur et les étiquettes.
4. Chaque carte affiche le nom, la version, la catégorie, la description et l'auteur. Cliquez sur *Installer*.
5. La fenêtre *Installer l'extension ?* s'ouvre. Lisez-la, puis passez à l'étape suivante.
6. Cliquez sur *Installer* pour continuer. Avec *Ne pas installer*, rien ne se passe. Échap ou un clic à côté de la fenêtre compte aussi comme un refus, et l'application n'affiche alors aucun message d'erreur.

Après l'installation, l'extension est activée tout de suite. Sur la carte dans *Parcourir*, elle affiche maintenant *Installée*. Ce que l'extension ajoute, vous le voyez dans l'application même : un nouveau bouton dans le ruban, ou un format d'importation dans *Fichier › Importer*. Certaines extensions affichent aussi un message. Vous le reconnaissez au préfixe *Extension*, suivi du nom de l'extension.

### Installer une extension depuis un fichier

Si vous avez reçu une extension sous forme de fichier, installez-la comme ceci.

1. Choisissez *Fichier › Extensions*.
2. En haut à droite, cliquez sur *ZIP* pour un fichier ZIP, ou sur *JS* pour un fichier JavaScript séparé.
3. Choisissez le fichier. La fenêtre *Installer l'extension ?* s'ouvre, comme ci-dessus.

Un fichier ZIP doit contenir un `manifest.json` et le fichier principal de l'extension. Si vous installez une extension déjà installée, la nouvelle version remplace l'ancienne. Si l'application ne peut pas installer le fichier, par exemple parce qu'un fichier ZIP est endommagé, rien ne se passe : l'application n'affiche aucun message d'erreur pour ZIP et JS, et l'extension n'apparaît pas dans la liste. La raison se trouve pourtant dans le terminal de débogage. Activez-le avec *Paramètres › Projet › Paramètres*, onglet *Avancé*, *Activer le terminal de débogage*, et ouvrez-le avec le bouton *Afficher le terminal de débogage* dans la barre d'état. Il y affiche par exemple *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (l'application rédige ce texte technique en néerlandais).

### Lire la question d'autorisation

La question montre ce que vous devez décider.

- *Auteur* et *Dépôt* indiquent qui a créé l'extension et où se trouve le code source.
- *Origine* indique d'où vient le fichier : *Depuis le catalogue d'extensions en ligne*, *Depuis un fichier ZIP sur cet ordinateur* ou *Depuis un fichier JavaScript sur cet ordinateur*. En dessous, il indique si le fichier a été vérifié. Pour le catalogue, il affiche *Téléchargement vérifié avec la somme de contrôle du catalogue.* Si le catalogue n'a pas de somme de contrôle, il affiche en rouge *Le catalogue ne fournit aucune somme de contrôle — ce téléchargement n'a pas été vérifié.* Pour un fichier que vous avez choisi vous-même, il affiche *Vous avez choisi ce fichier vous-même ; il n'existe aucune source externe pour le vérifier.*
- *Ce que vous acceptez* indique : *Une extension est du code qui s'exécute avec les mêmes droits qu'Open Planner Studio lui-même. Rien ne le limite. N'installez que des extensions dont vous faites confiance à l'auteur.* En dessous, il indique ce que cela signifie sur votre plateforme. Dans l'application de bureau, il indique : *Dans l'application de bureau, cela comprend : lire et écrire des fichiers partout dans votre dossier utilisateur, ainsi que l'accès à vos projets, réglages et presse-papiers.* Dans le navigateur, il indique : *Dans le navigateur, cela signifie : l'accès à vos projets et réglages enregistrés, aux fichiers auxquels vous avez donné accès, et au réseau.*
- *Ce que cette extension déclare utiliser* affiche les autorisations que l'auteur a déclarées, sous forme de petites étiquettes. C'est une déclaration de l'auteur et non une restriction : *C'est la déclaration de l'auteur, pas une restriction — le code peut faire davantage.* S'il n'y a pas d'étiquette, il affiche *Rien de déclaré.* Cela ne veut pas dire que l'extension ne peut rien faire : même sans étiquettes, une extension peut lire et modifier les données de votre planning et afficher des messages.

Les étiquettes signifient ceci :

- *ruban* : l'extension place des boutons dans le ruban.
- *événements* : l'extension écoute certains événements de l'application.
- *backstage* : l'extension ajoute des formats d'importation dans *Fichier › Importer*.
- *polices PDF* : l'extension fournit une police pour l'export PDF.
- *importSource* : l'extension peut lire tous les octets originaux de chaque fichier que vous importez, par exemple un fichier Primavera brut, y compris les champs qui n'arrivent pas dans votre projet. La fenêtre l'explique aussi elle-même.
- *aide* : l'extension peut ajouter des articles d'aide, ouvrir des projets fournis comme nouveau document et afficher un guide qui pointe vers des parties de l'application. La fenêtre l'explique aussi elle-même.
- *système de fichiers* et *réseau* : ce sont seulement des indications de ce que l'auteur prévoit. L'application n'a aucune fonction pour cela.

### Désactiver, réactiver ou supprimer une extension

1. Choisissez *Fichier › Extensions*, puis l'onglet *Installées*. Chaque extension a une carte avec le nom, la version, la catégorie, la description et l'auteur.
2. Avec l'interrupteur sur la carte, vous désactivez l'extension (*Désactiver*) ou vous la réactivez (*Activer*). Lorsqu'elle est désactivée, les boutons et formats d'importation que l'extension a ajoutés disparaissent, mais l'extension reste installée. Elle reste aussi désactivée après un redémarrage de l'application. Une extension activée démarre seule au lancement de l'application.
3. Cliquez sur *Supprimer*. Le bouton devient *Confirmer*, avec l'explication *Cliquez à nouveau pour supprimer définitivement*. Cliquez encore une fois pour supprimer l'extension. L'application nettoie aussi les réglages que l'extension a enregistrés.

## Pièges et ce que fait alors l'application

**Le catalogue ne se charge pas.** Il affiche *Impossible de charger le catalogue :* avec la raison technique après, et le bouton *Réessayer*. Cela peut venir de l'absence de connexion internet.

**Il affiche *Échec de l'installation.* sous une carte du catalogue.** Le téléchargement ou l'installation a échoué, par exemple parce que la somme de contrôle ne correspond pas. Rien n'a alors été installé. C'est différent d'un refus de la question : dans ce cas, il n'y a pas de message d'erreur.

**Il affiche *Entrées du catalogue ignorées : 1* au-dessus de la liste.** Le catalogue contenait un élément que l'application ne peut pas utiliser. Vous pouvez installer les autres extensions comme d'habitude.

**Une extension ne démarre pas.** La carte affiche alors un message d'erreur, par exemple que l'extension demande une version plus récente d'Open Planner Studio, avec votre version actuelle affichée, ou l'erreur que l'extension elle-même a donnée. L'extension n'est alors pas active. Mettez l'application à jour, ou supprimez l'extension.

**Une carte avec *Quarantaine*.** L'application n'a pas pu utiliser l'extension enregistrée. Sous le nom, elle affiche *Raison :* avec la cause. Avec *Supprimer du stockage*, vous la nettoyez.

**Écrire soi-même une extension.** Le guide pour les auteurs d'extensions (manifeste, API, autorisations) se trouve dans le dépôt `OpenAEC-Foundation/open-planner-studio` sur GitHub, dans le fichier `docs/extensions.md`.

**Une extension n'appartient pas à un projet.** Les extensions sont stockées dans l'application : dans l'application de bureau sur cet ordinateur, et dans le navigateur, dans le stockage de ce navigateur. Elles s'appliquent à tous vos projets et ne font pas partie de votre fichier de projet. Si vous effacez les données du site dans le navigateur, les extensions disparaissent.

## Voir aussi

- [Mettre à jour l'application](docs://howto-app-bijwerken): une extension peut demander une version plus récente de l'application.
- [Autorisations des extensions](docs://ref-extensiepermissies): ce que signifie chaque autorisation dans la question d'installation.
