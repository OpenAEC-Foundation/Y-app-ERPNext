# Formats d'import et d'export

Par format de fichier : si vous pouvez l'ouvrir, l'enregistrer et l'exporter, ce qui est repris ou non, et avec quel profil de calcul il s'ouvre. Le pourquoi de tout cela, avec un exemple chiffré, se trouve dans [Fichiers et formats](docs://uitleg-bestanden).

## En bref

**Ouverture** : IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` et `.xer` s'ouvrent. Un fichier avec une autre extension est traité par l'application comme un IFC.

**Enregistrement** écrit toujours un fichier IFC. Seul un fichier IFC ouvert devient la cible d'enregistrement ; un projet provenant d'un autre format n'a pas de fichier après l'ouverture, et *Enregistrer* demande alors où le fichier IFC doit être placé.

**Exportation** est possible vers IFC 4x3, MS Project XML, Primavera P6 XML, CSV et deux feuilles d'avancement (Excel et CSV). Une exportation ne modifie pas votre projet.

**Lecture seule** : les fichiers `.mpp` et `.xer`. L'application peut les ouvrir, mais pas les écrire.

**PDF** provient uniquement d'un rapport (voir [Types de rapport](docs://ref-rapporttypes)). L'application ne lit pas le PDF.

**Où.** Ouvrir : *Accueil › Fichier › Ouvrir*, *Fichier › Ouvrir* ou Ctrl+O. Exporter : *Accueil › Fichier › Exporter* ou *Fichier › Exporter*. Vous importez une feuille d'avancement remplie via *Fichier › Importer*, ou avec le bouton *Mettre à jour l'avancement depuis une feuille* dans le groupe de ruban *Avancement*, sur les onglets *Planification*, *Tableau* et *Rapport*.

**Profil de calcul à l'ouverture.** Chaque format s'ouvre avec un profil de calcul ; ce que c'est est expliqué dans [Options de calcul et conventions](docs://ref-rekenopties-en-conventies). `.xer` s'ouvre avec *Primavera P6*, `.mpp` avec *Microsoft Project*, et CSV, MS Project XML et P6 XML avec *Open Planner Studio*. IFC garde le profil enregistré dans le fichier. Pour `.xer` et `.mpp`, l'application indique que le projet calcule de cette façon. Seul IFC contient le profil de calcul et les options de calcul ; parmi les options de calcul, MS Project XML écrit au maximum le seuil critique. Une exportation réouverte d'un autre format calcule comme *Open Planner Studio*.

## IFC

**Ouverture** — oui, `.ifc`. L'application lit IFC 4.3. Profil de calcul : celui du fichier.

**Enregistrement** — oui, et c'est le seul format qui s'enregistre. *Enregistrer* écrit tout votre projet dans un fichier IFC. Le fichier devient la cible d'enregistrement.

**Exportation** — oui, comme *IFC 4x3* (décrit comme *Standard buildingSMART. Lien 4D avec les modèles BIM.*). Nom par défaut : le nom du projet avec l'extension `.ifc`. Si votre projet est lié à une bibliothèque de ressources, la case *Enregistrer aussi le fichier de bibliothèque* se trouve sous les cartes dans *Fichier › Exporter*. Si la case est cochée, l'application demande un emplacement pour *nom-du-projet-bibliotheek.ifc*, après le projet. La case ne figure pas dans la liste de l'onglet *Accueil*.

**Ce qui est repris** — tout ce qui appartient au projet : tâches avec structure, durée, dates et avancement ; relations avec décalage ; contraintes et échéances ; calendriers ; ressources et affectations, y compris la répartition horaire ; références ; codes d'activité et champs personnalisés ; notes ; relations externes vers d'autres projets ; interruptions ; règles de travail et types de tâche ; les paramètres du projet, comme la date d'état, le mode d'avancement, le profil de calcul et les options de calcul ; la connexion avec une bibliothèque de ressources. Pour un projet issu d'un `.xer`, le fichier source d'origine est aussi repris. Un type de tâche personnalisé est enregistré comme type IFC `USERDEFINED`, avec son nom dans le champ ObjectType, de sorte que les autres programmes IFC lisent la tâche normalement. L'application conserve aussi l'identifiant fixe du type ; un changement de nom ne rompt donc pas l'association. Si quelqu'un ouvre le fichier sur un autre ordinateur, le type apparaît là sous *De ce projet*, et non dans ses propres *Mes types de tâche*.

**Ce qui n'est pas repris** — la mise en page de l'écran (zoom, position de défilement, tâche sélectionnée, phases repliées, filtre et regroupement choisis) et les paramètres de l'application ([Paramètres](docs://ref-instellingen)). L'onglet *IFC* affiche le texte IFC de votre projet.

## MS Project XML (MSPDI)

**Ouverture** — oui. L'application reconnaît un fichier `.xml` comme MS Project XML grâce à l'élément racine `Project` dans l'espace de noms MS Project (ou sans espace de noms). Profil de calcul : *Open Planner Studio*.

**Enregistrement** — non. Un tel projet n'a pas de cible d'enregistrement.

**Exportation** — oui, comme *MS Project XML* (*À ouvrir dans Microsoft Project. Structure WBS complète.*). Nom par défaut : le nom du projet avec `.xml`.

**Ce qui est repris** — tâches avec structure (niveau et WBS), durée, dates et avancement ; relations avec décalage, aussi en heures ou en pourcentages ; contraintes, y compris l'échéance ; calendriers, y compris les calendriers de tâche et de ressource ; ressources et affectations, y compris la courbe ou la répartition horaire ; la date d'état ; le seuil critique, sous forme de nombre entier de jours ouvrés égal à 0 ou plus, avec *Marge totale ≤ seuil* ; la description d'une tâche (comme note) ; la règle de travail d'une tâche (comme type de tâche MS Project) ; un type de tâche personnalisé, dans un champ libre (`ExtendedAttribute`) que l'application relit et que MS Project peut ignorer. Parmi vos références, seule la référence active est reprise, comme référence 0. Une tâche en heures garde son unité, et un jalon garde son type (début, fin ou automatique).

**Ce qui n'est pas repris** — les notes (la liste de contrôle d'une tâche), les relations externes vers d'autres projets, les codes d'activité et les champs personnalisés, une deuxième contrainte, le marquage *Planifiée manuellement*, le retard de nivellement, le point de reprise et d'arrêt d'une tâche hors séquence, les conventions *Le travail restant reprend après la durée écoulée* et *Ne pas déplacer les tâches non commencées à la date d’état* d'un profil MS Project, et les autres options de calcul. Les tâches interrompues sans répartition horaire sont reprises sans leurs interruptions.

**Ce qui change pendant le transfert** — une contrainte *Doit commencer le (MSO)* ou *Doit finir le (MFO)* sans le choix *Obligatoire (logique de verrouillage)* devient *Début au plus tôt le (SNET)* ou *Fin au plus tôt le (FNET)*. Un hamac devient une tâche ordinaire avec des dates calculées.

## Fichier MS Project (`.mpp`)

**Ouverture** — oui, de MS Project 2010 à 2021. Profil de calcul : *Microsoft Project*. L'application lit seulement le fichier : elle ne modifie jamais votre `.mpp`. Un fichier de MS Project 2007 ou plus ancien, et un fichier protégé par mot de passe, l'application le refuse avec un message qui renvoie à l'exportation XML de MS Project.

**Enregistrement** — non, et il n'y a pas de cible d'enregistrement : *Enregistrer* écrit un nouveau fichier IFC.

**Exportation** — non.

**Ce qui est repris** — tâches avec structure, durée et contraintes ; relations avec décalage ; calendriers ; ressources et affectations ; avancement ; un code WBS que vous avez renseigné vous-même dans MS Project. Les dates et la marge que MS Project a calculées elles-mêmes sont aussi lues, pour la vue *Dates telles qu'enregistrées*.

**Ce qui n'est pas repris** — références, coûts et tarifs, notes et champs personnalisés de MS Project. Voir [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen).

**Origine et licence** — le lecteur `.mpp` a été écrit pour Open Planner Studio et est dérivé du code source et de la connaissance structurelle de MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), une bibliothèque Java sous LGPL-2.1. La structure et les constantes des champs ont été portées en TypeScript. Open Planner Studio lui-même est un logiciel libre sous LGPL-3.0. Le lecteur `.xer` n'est pas un dérivé : MPXJ n'y a été consulté que comme source de compréhension.

## Primavera P6 XML

**Ouverture** — oui. L'application reconnaît un fichier `.xml` comme P6 XML grâce à l'élément racine `APIBusinessObjects`. Profil de calcul : *Open Planner Studio*.

**Enregistrement** — non.

**Exportation** — oui, comme *Primavera P6 XML* (*Pour Oracle Primavera P6.*). Nom par défaut : le nom du projet avec `.xml`, donc le même nom qu'une exportation MS Project XML : donnez-leur vous-même des noms différents.

**Ce qui est repris** — structure WBS et tâches avec durée, dates et avancement ; relations avec décalage ; contraintes (aussi une deuxième, comme contrainte souple) ; calendriers ; ressources et affectations ; la date d'état (comme `DataDate`) ; un type de tâche personnalisé, dans un champ à part, `OPS Custom Task Type`, que l'application relit et que P6 peut ignorer.

**Ce qui n'est pas repris** — références et échéances ; codes d'activité, champs personnalisés, notes et relations externes ; les options de calcul. P6 ne connaît pas de décalage en pourcentages : l'application le convertit en un nombre fixe de jours. Un décalage en jours calendaires devient un décalage en horaires de travail : 3 jours calendaires deviennent 3 jours ouvrés. Un hamac devient une tâche ordinaire, une tâche planifiée manuellement devient une tâche ordinaire avec des dates calculées, et un retard de nivellement inférieur à un jour est supprimé.

## Fichier Primavera (`.xer`)

**Ouverture** — oui. Profil de calcul : *Primavera P6*. L'application lit seulement le fichier : elle n'écrit pas de `.xer` et ne modifie jamais votre fichier. Elle ouvre un onglet par projet contenant des tâches. Un fichier sans tâches ou avec des tables endommagées, l'application le refuse avec un message.

**Enregistrement** — non, et il n'y a pas de cible d'enregistrement : *Enregistrer* écrit un nouveau fichier IFC, avec le `.xer` d'origine à l'intérieur.

**Exportation** — non. Si vous exportez un projet issu d'un `.xer` vers CSV, MS Project XML ou P6 XML, l'application signale que les informations de la source XER sont perdues, même si vous avez enregistré le projet en IFC entre-temps. Vers IFC, rien n'est perdu.

**Ce qui est repris** — la structure WBS et les tâches avec durée, dates, contraintes et avancement ; relations avec décalage ; calendriers ; ressources avec affectations ; codes d'activité ; champs personnalisés (UDF) ; notes ; les paramètres de planification de P6. Une tâche de type *Level of Effort* devient un hamac. Un projet de référence devient la référence active du projet qui y renvoie. Une relation entre deux projets est conservée par l'application comme donnée source.

**Ce qui n'est pas repris** — un projet sans tâches, et une relation entre deux projets comme vraie relation dans votre planning. Voir [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Ouverture** — oui. L'application lit `;` et `,` comme séparateur. Elle reconnaît les en-têtes de colonnes en anglais et en néerlandais (par exemple `Name` ou `Naam`, `Duration` ou `Duur`, `Predecessors` ou `Voorgangers`). Les dates peuvent être *aaaa-mm-jj*, *jj-mm-aaaa* ou *jj/mm/aaaa*. Vous écrivez un prédécesseur comme code WBS, type de relation et décalage, par exemple `1.2FS+2d`. Profil de calcul : *Open Planner Studio*. Le projet s'appelle *CSV Import*. Un `Task Type` qui ne correspond à aucun des codes fixes (comme `CONSTRUCTION` ou `INSTALLATION`, que l'application écrit elle-même) devient un type de tâche personnalisé sous *De ce projet*, et non dans *Mes types de tâche* ; avec `OPS Custom Task Type ID`, l'identifiant d'un type personnalisé est conservé.

**Enregistrement** — non.

**Exportation** — oui, comme *CSV (;)* (*Export tableau universel. Toutes les tâches avec dates et durées.*), sur la carte *CSV (séparé par des points-virgules)*. Le fichier utilise un point-virgule comme séparateur, est en UTF-8 avec BOM et a des en-têtes de colonnes en anglais.

**Ce qui est repris** — par tâche, ces colonnes : `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` et `Description`. L'avancement est exprimé en pourcentages entiers.

**Ce qui n'est pas repris** — ressources, affectations, calendriers, contraintes, échéances, références et la date d'état. Si les dates sont dans la vue *Dates telles qu'enregistrées*, l'exportation laisse vides `Critical` et `Total Float` pour les tâches dont le fichier source ne l'a pas enregistré.

## Feuille d'avancement (Excel et CSV)

**Ouverture** — oui, via *Fichier › Importer* (*Mettre à jour l'avancement depuis une feuille*) ou via le bouton de même nom dans le groupe de ruban *Avancement*, sur *Planification*, *Tableau* et *Rapport*. L'application lit les fichiers `.xlsx` et `.csv`, jusqu'à 16 Mo et 50 000 lignes. Cela n'ouvre pas de projet : cela met à jour l'avancement de votre projet ouvert. Voir [Importer l'avancement depuis une feuille](docs://howto-voortgang-importeren).

**Enregistrement** — non.

**Exportation** — oui, comme *Feuille d’avancement (Excel)* (*Avancement (Excel)* dans la liste) et *Feuille d’avancement (CSV)* (*Avancement (CSV)*). Nom par défaut : *nom-du-projet-voortgang*. Le bouton *Exporter la feuille d’avancement* dans le même groupe de ruban crée la feuille Excel en un clic. La feuille Excel a des largeurs de colonnes fixes, des champs verrouillés et une vérification des dates ; la feuille CSV contient le même contenu en texte brut.

**Ce qui est repris** — les colonnes `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` et `Actual Finish`. À la lecture, l'application utilise `Completion (%)`, `Actual Start` et `Actual Finish` ; `Start` et `Finish` servent seulement à reconnaître la notation des dates et ne modifient pas votre planning. L'application relie les lignes aux tâches par `OPS Task ID`, ou sinon par un code WBS unique.

**Ce qui n'est pas repris** — tout ce qui se trouve hors de ces colonnes : durée, relations, ressources et le reste de votre planning. Une tâche récapitulative ne reçoit pas d'avancement de la feuille.

## PDF

**Ouverture** — non.

**Enregistrement** — non.

**Exportation** — oui, depuis un rapport : sous l'onglet *Rapport*, le bouton *Exporter en PDF*. L'application n'envoie pas elle-même un rapport à une imprimante ; le chemin vers le papier passe par le PDF. Le contenu dépend du type de rapport : voir [Types de rapport](docs://ref-rapporttypes) et [Créer et imprimer un rapport](docs://howto-rapport-maken-en-afdrukken).

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : pourquoi IFC est le format natif et ce qu'une exportation perd, avec un exemple.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : les étapes.
- [Exporter](docs://howto-exporteren) : choisir un format et les messages après une exportation.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : pourquoi un fichier ouvert peut afficher d'autres dates.
- [Options de calcul et conventions](docs://ref-rekenopties-en-conventies) : les profils de calcul.
