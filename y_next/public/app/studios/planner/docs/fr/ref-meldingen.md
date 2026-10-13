# Notifications et avertissements

L'application vous informe de ce qui se passe à trois endroits : la barre d'état en bas, le panneau *Avertissements* dans la colonne de droite et les notifications qui apparaissent brièvement en bas de l'écran. Cet article indique, pour chaque endroit, ce que vous voyez, quand il apparaît et ce que vous pouvez faire. Pourquoi un planning est critique ou en surallocation est expliqué dans [Chemin critique et marge](docs://uitleg-kritiek-pad) ; la résolution de la surallocation est expliquée dans [Résoudre la surallocation](docs://howto-overbezetting-oplossen) ; la création de relations est expliquée dans [Créer des relations](docs://howto-relaties-leggen).

## La différence entre les trois

- **Barre d'état** — une ligne fixe avec des compteurs. Ils proviennent du dernier calcul et restent affichés jusqu'à ce que vous calculiez de nouveau.
- **Panneau Avertissements** — la liste derrière ces compteurs, avec tout ce que le dernier calcul a trouvé. Un clic vous mène à la tâche, à la relation ou à la ressource. Elle est dérivée du dernier calcul ; rien n'est enregistré.
- **Notifications** — de courts messages sur ce que vous venez de faire (échec de l'enregistrement, relation refusée, import lu). Elles disparaissent et ne figurent pas dans le panneau.

## La barre d'état

La barre en bas affiche, de gauche à droite :

- **Tâches :** — le nombre de tâches feuilles (les tâches récapitulatives ne sont pas comptées).
- **Jalons :** — le nombre de jalons.
- **Chemin critique : N tâches, N jours ouvrés** — le nombre de tâches critiques et la durée du projet. Visible seulement après un calcul.
- **Fin :** — la date de fin du projet selon le calcul. Visible seulement après un calcul ; un projet vide n'en a pas.
- **N échéance(s) dépassée(s)**, **N contrainte(s) violée(s)**, **N relation(s) hors séquence** et **N ressource(s) en surallocation** — chacun est un bouton avec un signe d'avertissement, visible seulement quand le compteur est supérieur à 0 et qu'un calcul existe. Un clic ouvre le panneau *Avertissements* (info-bulle : *Ouvrir le panneau Avertissements (détails et navigation)*). Si vous êtes sur l'onglet *IFC* ou *Rapport*, l'application passe en même temps à *Accueil*, car la colonne de droite n'existe pas dans cet onglet. Le compteur *ressource(s) en surallocation* se met aussi à jour après des changements sur les ressources et les affectations ; les autres compteurs ne changent qu'après *Calculer*. Les quatre compteurs sont une sélection : ce que le panneau affiche en plus (avance tronquée, relation ignorée, hamac sans driver de fin, date de fin plafonnée, erreur de planning) ne figure pas dans la barre d'état.
- **Obsolète — recalculer (F5)** — avec un signe d'avertissement (info-bulle : *Planification obsolète — recalculer (F5)*). Visible dès que vous modifiez un élément qui touche le planning et que vous n'avez pas recalculé. Si *Calculer automatiquement* est activé, cet élément reste masqué, sauf si le calcul a donné une erreur : dans ce cas, il reste affiché.
- **Sélection : N tâche(s)** — le nombre de tâches sélectionnées ; visible seulement quand une sélection existe.
- **Échelle :** et **Zoom : Npx/jour** — l'échelle de temps de la chronologie et le niveau de zoom. L'échelle découle du zoom.
- **Non enregistré** — tant que le document contient des modifications qui ne figurent pas dans le fichier.
- **IA** — un point coloré avec le mot IA, seulement quand le mode IA est activé. L'info-bulle indique *Pont IA :* avec *Désactivé*, *Actif sur le port N*, *Port N occupé* ou *Erreur*. Un clic ouvre l'onglet *IA*.
- **Terminal de débogage** — un bouton de terminal, seulement quand le terminal de débogage est activé ; il affiche ou masque le terminal (*Afficher le terminal de débogage* / *Masquer le terminal de débogage*).

## Le panneau Avertissements

- **Ouverture** — *Planification › Planification › Avertissements*, *Affichage › Panneaux › Avertissements*, ou un compteur dans la barre d'état. Le panneau se trouve dans la colonne de droite, sous *Propriétés* et le panneau des ressources, et il agrandit une colonne réduite. Par défaut, il est fermé et son état n'est pas mémorisé d'une session à l'autre. Vous faites glisser sa hauteur par le bord quand il se trouve sous d'autres panneaux ; cette hauteur est mémorisée. La croix en haut à droite le ferme (*Fermer les avertissements*).
- **Ligne d'en-tête** — *N erreur(s), N avertissement(s)*. Si rien n'a encore été calculé, elle indique *Pas encore calculé — appuyez sur Calculer (F5) pour exécuter les contrôles.*
- **Calculer** — un bouton dans la ligne d'en-tête, visible tant que le planning est obsolète ou pas encore calculé. Il fait la même chose que *Calculer* dans le ruban.
- **Signe d'avertissement dans la ligne d'en-tête** — quand le planning est obsolète, avec l'info-bulle *Planning obsolète — cette liste provient du dernier calcul. Recalculez (F5).* La liste n'est pas masquée ; elle est seulement marquée comme obsolète.
- **Liste vide** — *Aucun avertissement. Le planning passe tous les contrôles.*
- **Une ligne** — en haut, le lieu (tâche, relation, ressource ou projet) ; dessous, la description. Une erreur a son propre signe octogonal ; un avertissement a un signe triangulaire. Une tâche apparaît comme `nom WBS`. Une relation apparaît comme `prédécesseur → successeur (FS+2j)`, avec son type et son décalage. Un clic mène au lieu (info-bulle *Aller à : …*), voir ci-dessous. La ligne de votre tâche active (pour une relation : son successeur) ou de la ressource choisie dans l'histogramme est mise en évidence.
- **Ordre** — d'abord les erreurs ; ensuite, par type, dans l'ordre de la liste ci-dessous ; à l'intérieur d'un type, dans l'ordre du document (pour une relation, celui de son successeur ; pour une ressource, celui de la liste des ressources). Une tâche, une relation ou une ressource supprimée après le dernier calcul disparaît de la liste.

### Types d'avertissement

- **Erreur de planning** — *Le planning n'a pas pu être calculé : …*, suivi de la raison, voir ci-dessous. Un clic : pour un cycle, l'application sélectionne toutes les tâches du cycle et passe à la première ; pour les autres erreurs, il n'y a pas de destination et la ligne n'est pas un bouton.
- **Échéance dépassée** — *Échéance {date} dépassée — fin au plus tôt {date}*. La tâche a une échéance et le calcul ne la respecte pas. Un clic mène à la tâche. Pour corriger : ajustez la logique ou la durée, ou déplacez l'échéance.
- **Contrainte violée** — *La contrainte {type and date} est outrepassée par la logique (marge négative)*. La contrainte ne peut pas être respectée sans casser la logique ; la marge est négative. Un clic mène à la tâche. Voir [Contraintes](docs://uitleg-constraints).
- **Hors séquence** — *Hors séquence : l'avancement du successeur contredit la relation*. L'avancement du successeur ne correspond pas au type de relation ; par exemple, un successeur déjà en cours alors que son prédécesseur n'est pas encore terminé, dans une relation fin-début. Un clic sélectionne les deux tâches, le successeur étant actif. Vérifiez les dates réelles ou la relation.
- **Avance tronquée** — *Avance tronquée par le début du projet — la relation n'est pas pleinement respectée*. L'avance (décalage négatif) de la relation va au-delà du début du projet. Un clic sélectionne les deux tâches.
- **Relation ignorée** — *Relation ignorée : le prédécesseur ou le successeur est absent ou n'est pas une tâche feuille*. Le calcul n'utilise pas la relation. Un clic sélectionne les tâches qui existent encore. Voir [Relations](docs://uitleg-relaties).
- **Hamac sans driver de fin** — *Hamac sans driver de fin (aucun prédécesseur FF/SF) : sa durée retombe à zéro*. Un clic mène à la tâche. Voir [Tâches hamac](docs://howto-hammock).
- **Date de fin plafonnée** — *Date de fin plafonnée : le calendrier ne laisse aucune fenêtre ouvrable pour cette tâche*. Le calcul a atteint la limite du nombre de jours qu'il cherche, par exemple à cause d'une très longue période ininterrompue de jours non ouvrés dans le calendrier. Un clic mène à la tâche. Voir [Calendriers et jours ouvrés](docs://uitleg-kalenders).
- **Surallocation** — *Surallocation sur N jour(s) (first – last)*, avec *la ressource ne travaille pas ce ou ces jours selon son calendrier* ajouté si tous les jours sont non ouvrés, ou *dont N jour(s) que la ressource ne travaille pas selon son calendrier* en cas de mélange. Un clic sélectionne les tâches ayant une affectation sur cette ressource, active l'histogramme et y choisit cette ressource ; depuis *Tableau*, *IFC* ou *Rapport*, l'application passe à *Ressources*. Voir [Panneau des ressources](docs://ref-resourcepaneel).

### Causes d'une erreur de planning

- *Dépendance circulaire entre les tâches : {path}* — les relations forment un cycle. Les tâches se trouvent dans le chemin ; inversez ou supprimez une relation.
- *Aucun jour ouvré n'est défini dans le calendrier* — donnez au calendrier au moins un jour ouvré, voir [Fenêtres du calendrier](docs://ref-kalenders).
- *Durée en jours non valide pour la tâche '{task}'* et *Durée en heures non valide pour la tâche '{task}'* — la durée de la tâche n'est pas un nombre valide.
- *La tâche en heures '{task}' n'a pas d'horaires de travail valides dans son calendrier* — une tâche en heures dans un calendrier sans horaires de travail.
- *Date de début non valide pour la tâche '{task}'* — la date de début de la tâche n'est pas valide.

## Notifications

Les notifications apparaissent en bas de l'écran, aussi dans le tableau, dans Backstage et en mode présentation. Une notification est une *erreur* ou une *info*. Une erreur reste affichée jusqu'à ce que vous cliquiez dessus. Une info disparaît après 5 secondes, et ces minuteries recommencent dès que la pile change. Un clic sur une notification la ferme (info-bulle *Fermer la notification*). Trois notifications au maximum sont affichées à la fois. Si une quatrième arrive, l'info la plus ancienne part en premier. S'il n'y a pas d'info, la notification la plus ancienne part. Ainsi, une erreur n'est jamais remplacée par une info. La pile se déplace hors des boutons d'une boîte de dialogue ouverte et hors des barres d'action fixes.

- **Compteur ×N** — une notification avec une clé fixe regroupe une répétition en une seule ligne avec un compteur, par exemple une erreur d'enregistrement qui revient ou une relation refusée que vous répétez. Toutes les notifications ne font pas cela.
- **En savoir plus** — certaines notifications ont un renvoi *En savoir plus* ou une rubrique propre (par exemple *Règles de travail expliquées*) vers le guide dans Backstage › Aide.
- **Bouton d'action** — la notification sur le profil de calcul a un bouton *Ouvrir le profil de calcul* vers Info projet.

La liste ci-dessous est une sélection, regroupée par sujet. Sauf indication contraire, il s'agit d'une info.

### Enregistrement, ouverture et récupération

- **Échec de l'enregistrement** (erreur) — *Échec de l'enregistrement* avec la raison en dessous. Lors de l'enregistrement, de l'enregistrement sous et de l'export d'un rapport.
- **Enregistré comme téléchargement** (info) — *Enregistré comme téléchargement : « {name} » se trouve maintenant dans votre dossier de téléchargements. …* Avec *Enregistrer sous* et les exports, lorsque l'environnement ne permet pas à l'application d'écrire directement à l'emplacement choisi. Deux téléchargements l'un après l'autre se regroupent.
- **Enregistré comme téléchargement (explication)** (info) — *Enregistré comme téléchargement : « {name} » se trouve dans votre dossier de téléchargements. Ce navigateur ne laisse pas l'application écrire dans un emplacement qui lui est propre, …* Avec *Enregistrer* dans un navigateur qui n'enregistre que par téléchargement. Une fois par session, avec un renvoi vers l'explication des fichiers.
- **Le navigateur n'écrit pas en retour** (info) — *Ce navigateur ne laisse pas l'application réécrire dans « {name} ». …* Avec *Enregistrer* pour un projet qui a un fichier, lorsque le navigateur doit de nouveau demander un emplacement. Une fois par session, avec un renvoi vers l'explication des fichiers.
- **Échec de l'enregistrement automatique** (erreur) — *Échec de l'enregistrement automatique* avec la raison. S'applique à l'enregistrement automatique dans le fichier et à la récupération après un arrêt inattendu.
- **La bibliothèque n'a pas pu être enregistrée** (erreur) — *La bibliothèque n'a pas pu être enregistrée*, lors de l'enregistrement de la bibliothèque de ressources.
- **Échec de l'ouverture d'un fichier** (erreur) — *Échec de l'ouverture du fichier* avec la raison. Par exemple pour un fichier récent ou un fichier importé.
- **Fichier .mpp ancien ou protégé** (erreur) — *Ce fichier .mpp utilise un format plus ancien (Project 2007 ou antérieur)…* ou *Ce fichier .mpp est protégé par un mot de passe…*. Dans les deux cas, le conseil est d'exporter en XML depuis MS Project et d'ouvrir ce fichier.
- **Fichier XER non valide** (erreur) — un des textes *XER…*, par exemple *Ce fichier XER n’est pas valide ou pris en charge.* ou *Le fichier XER contient une table en double.*, avec la raison ajoutée.
- **IFC n'a pas pu être lu** (erreur) — *IFC n'a pas pu être lu* avec la raison, dans la vue IFC.
- **Récupération** (erreur) — *Le fichier récupéré n'a pas pu être lu*, *Échec de la restauration* et *N fichiers de récupération n'ont pas pu être chargés et ont été ignorés.* Lors d'une récupération après un arrêt inattendu.
- **Branche enregistrée comme modèle** (info) — *Branche enregistrée comme modèle '{name}'*.
- **Message d'une extension** (info, ou erreur si l'extension signale une erreur) — *Extension {name} : {message}*. Une extension peut afficher au maximum trois nouveaux messages par 10 secondes, pour ne pas remplir la pile. Si une étape du guide d'une extension échoue, le message dit *Une étape de l’extension {name} a échoué. Le guide continue.* Si un fichier de projet d'une extension ne peut pas être ouvert, le message dit *Le fichier de projet {file} de l’extension {name} n’a pas pu être ouvert.* Les deux sont des erreurs.
- **Modification entretemps** (info) — *Une modification de l'assistant IA ou d'une extension est intervenue entre-temps. …* Lorsque vous annulez la boîte de dialogue de tâche alors que l'assistant IA ou une extension a modifié quelque chose entre-temps : les modifications de tâche faites avant cette modification ne sont pas annulées. Elles restent des étapes ordinaires sous *Annuler*.

### Calcul

- **Le planning n'a pas pu être calculé** (erreur) — *Le planning n'a pas pu être calculé* avec la raison en dessous (voir *Causes d'une erreur de planning*). Lorsque vous cliquez sur *Calculer*, lorsque vous changez de document et lorsque vous ouvrez un fichier.
- **Date d'état fixée à aujourd'hui** (info) — *Il n’y avait pas encore de date d’état : elle est maintenant fixée à aujourd’hui ({date}), car l’avancement est mesuré jusqu’à la date d’état. Vous pouvez la modifier sous Planification → Date d’état.* Lors de la saisie d'un avancement dans un projet sans date d'état.
- **Durée plus courte que le travail déjà effectué** (info) — *« {name} » est déjà réalisée à {N} % : une durée plus courte que le travail déjà effectué est impossible. La durée n’a pas été modifiée*.

### Relations et hiérarchie

- **Relation créée** (info) — *Relation créée : {predecessor} → {successor}*.
- **Relation refusée** (info) — *Cette relation existe déjà*, *Une relation entre une tâche et sa propre tâche récapitulative parente (ou ancêtre) n'est pas autorisée.* ou *Cette relation créerait un cycle dans la planification ({cycle}) et n'a pas été créée.* Le cycle nomme les tâches, de sorte que vous savez quelle relation supprimer ou inverser en premier.
- **Déplacement refusé** (info) — *Ce déplacement créerait un cycle dans la planification ({cycle}) : les relations d'une tâche récapitulative s'appliquent aussi à ses sous-tâches. Rien n'a été déplacé.*
- **Relations écartées après un déplacement** (info) — *Après le déplacement, N relations relient une tâche à sa propre tâche récapitulative parente ; elles ne sont plus prises en compte dans le calcul.*
- **Relations ignorées à l'insertion** (info) — *N relations n'ont pas été créées : relation non valide…*, lors du collage ou de l'insertion d'une branche.
- **Relations non prises en compte après l'importation** (info) — *N relation(s) n'ont pas pu être prises en compte. Vérifiez les colonnes Prédécesseurs et Successeurs.*
- **Identifiants en double après l'importation** (info) — *Objets avec un identifiant en double dans ce fichier : N. Ils ont reçu leur propre identifiant…*

### Modification des tâches

- **Début enregistré comme contrainte** (info) — *'{name}' a un prédécesseur : le nouveau début devient la contrainte Début au plus tôt le (SNET) {date}. Après recalcul (F5), la tâche ne commence pas avant cette date.* Lorsque vous modifiez le début d'une tâche qui a un prédécesseur. Si la tâche avait déjà une telle contrainte, la notification indique qu'elle a été déplacée. Pour plusieurs tâches à la fois, elle donne un nombre.
- **Début non appliqué** (info) — *Le nouveau début de « {name} » n'a pas été appliqué : la tâche a un prédécesseur et la contrainte {type} {date}, qui déterminent son début. Modifiez cette contrainte pour déplacer le début.*
- **Jalon refusé** (info) — *« {task} » a des affectations de ressources et ne peut pas devenir un jalon. Supprimez d'abord les affectations*. ou *« {task} » est une tâche récapitulative avec des sous-tâches et ne peut pas devenir un jalon*. Lors de la conversion dans la boîte de dialogue de tâche, dans le panneau des propriétés, dans le menu contextuel et dans le tableau.
- **Affectations déplacées vers une sous-tâche** (info) — *L'affectation de {resources} a été déplacée de « {phase} » vers la nouvelle sous-tâche « {child} » : une tâche récapitulative ne porte pas elle-même d'affectations*. Lorsqu'une tâche avec des affectations reçoit des sous-tâches.
- **Indicateur de jalon retiré** (info) — *Le jalon « {phase} » a maintenant des sous-tâches et est devenu une tâche récapitulative ; l'indicateur de jalon a été retiré*.
- **Tâche récapitulative refusée** (info) — *« {phase} » ne peut pas devenir une tâche récapitulative : …* avec la raison, et *Rien n'a été modifié.*
- **Cellules ignorées au collage** (info) — *N cellules ignorées : elles sont en lecture seule (par exemple un code WBS numéroté automatiquement ou une colonne calculée).*
- **Références effacées au collage** (info) — *N références n'existaient pas dans ce document et ont été effacées (calendriers de tâche, types de tâche personnalisés, codes d'activité ou champs personnalisés du document source).*
- **Durées ajustées par la règle de travail** (info) — *Après le changement de calendrier, la règle de travail a ajusté la durée de N tâches (le travail reste, les heures par jour ont changé).* Avec le renvoi *Règles de travail expliquées*.

### Primavera (XER)

- **Fichier XER ouvert** (info) — *Fichier XER ouvert : N documents de projet.* Une notification par fichier, même si le fichier ouvre plusieurs projets, avec un renvoi *En savoir plus* et des lignes de détail en dessous. Toujours *N projets trouvés.* Seulement lorsque le nombre est supérieur à 0 : *N projets vides ignorés.*, *N projets de référence exclus.*, *N références matérialisées.*, *N références de référence orphelines ignorées.*, *Une solution de repli protectrice a été utilisée.* et *N relations externes conservées.* Seulement pour un encodage autre que UTF-8 : *Encodage de texte choisi : {encoding}.* En outre, lorsque le nombre est supérieur à 0 : *N constats de l’analyseur.*, *N constats de calendrier.*, *N problèmes de format numérique.*, *N replis d’énumération.* et *N paramètres de planification P6 ont utilisé des replis sûrs.*
- **Dates telles qu'enregistrées par Primavera** (ligne de détail dans la même notification) — *N tâches affichent les dates telles qu'enregistrées par Primavera (non recalculées).*, ou, si le mode ne s'est pas activé, *N tâches diffèrent des dates enregistrées dans le fichier — vous pouvez les afficher.*
- **Archive source XER inutilisable** (info) — *L'archive source XER de ce fichier est inutilisable et a été omise ; le projet lui-même s'est ouvert en entier.* avec la raison (par exemple *Raison : la somme de contrôle ne correspond pas aux octets source — l'archive est endommagée.*) et la conséquence (*Le planning, le profil de calcul et toutes les données du projet issues de l'IFC sont complets. …*). Lors de l'ouverture d'un fichier IFC dans lequel une archive source XER enregistrée précédemment ne peut pas être utilisée.
- **L'export perd des informations XER** (info) — *L’export vers {format} entraîne la perte d’informations source XER.* Après un export réussi vers un format autre que IFC, d'un projet contenant des données qui n'existent que dans un fichier XER. Avec le renvoi *En savoir plus*.

### Importation, export et profil de calcul

- **Dates telles que dans le fichier** (info) — *N tâches affichent les dates telles qu'enregistrées dans le fichier (non recalculées).* ou *N tâches diffèrent des dates enregistrées dans le fichier — vous pouvez les afficher.* Lors de l'ouverture d'un fichier avec des dates enregistrées.
- **Travail et règles de travail visibles** (info) — *Ce fichier contient du travail enregistré ou des règles de travail propres ; la règle de travail et le travail restant sont affichés pour ce projet.*
- **Planning MS Project lu** (info) — *Ce fichier MS Project contient N tâches à la planification fractionnée, lissée ou pilotée par les ressources. Elles sont importées et affichées telles quelles.*
- **Interruptions non exportées** (info) — *N tâches avec interruptions ont été exportées sans leurs interruptions : MS Project/P6 ne les connaissent que comme répartition du travail.* Lors de l'export vers MS Project ou Primavera.
- **Début de projet déplacé** (info) — *Début de projet déplacé : N ancres de tâche sans prédécesseur ni contrainte ont été déplacées vers la nouvelle date de début.*
- **La fenêtre de dates ne pilote plus** (info) — *La fenêtre de dates de MS Project ne pilote plus N tâches après cette modification ; …* Une fois par document.
- **Retard de nivellement arrondi** (info) — *Le nivellement arrondit le retard de nivellement de MS Project, précis à la minute, pour N tâches à des journées de travail entières.* Une fois par document.
- **Profil de calcul appliqué** (info) — *Ce projet calcule comme {profile}. Modifiable via Fichier → Info projet → Profil de calcul et options.* Avec le bouton *Ouvrir le profil de calcul*. Après l'application d'un profil, *Après application, N tâches ont été déplacées.* s'affiche si nécessaire.
