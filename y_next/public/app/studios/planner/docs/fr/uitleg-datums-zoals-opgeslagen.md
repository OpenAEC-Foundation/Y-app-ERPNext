# Dates telles qu'enregistrées

Vous ouvrez un planning depuis Primavera ou MS Project, et les dates diffèrent de ce que vous aviez vu dans ce logiciel. L'import a-t-il échoué ? En général, non. Dans cet article, vous lisez pourquoi l'application recalcule d'elle-même, quand elle affiche les dates du fichier, ce qui reste alors vide et comment vous revenez à son propre calcul. L'exemple à la fin suit deux tâches tout au long du processus.

## Le concept

Un fichier de planning contient deux types de données. D'abord la logique : tâches, durées, relations, calendriers et contraintes. Ensuite, les dates que le logiciel d'origine a calculées à partir de cette logique. À l'ouverture, Open Planner Studio utilise la logique et calcule de lui-même. Les dates du fichier ne sont donc pas des données saisies.

Si son propre calcul aboutit à d'autres dates que celles du fichier, vous ne savez pas quel côté a raison. Le fichier peut ne pas contenir une partie de la logique que le logiciel d'origine a utilisée. Le logiciel d'origine peut aussi calculer autrement que l'application sur un point. C'est pourquoi l'application peut afficher les dates **telles qu'enregistrées** : les dates que l'autre logiciel a mises dans le fichier. Vous comparez ainsi avec ce que vous aviez vu dans ce logiciel.

## Comment l'application gère ce cas

### Quel profil de calcul l'application utilise

L'application calcule avec un **profil de calcul** : un ensemble de règles de calcul (conventions) qui décide, par exemple, comment elle traite le début planifié d'une tâche et les contraintes. Voir [Profils de calcul et conventions](docs://uitleg-rekenprofielen). Il existe trois profils intégrés : *Primavera P6*, *Microsoft Project* et *Open Planner Studio*. Un `.xer` s'ouvre avec *Primavera P6* et un `.mpp` avec *Microsoft Project*. CSV, MS Project XML et Primavera P6 XML s'ouvrent avec *Open Planner Studio*. Le profil d'un projet se trouve sous *Fichier › Info projet*, à *Profil de calcul et options*. Un fichier IFC issu de l'application conserve son profil.

### Quand l'application compare

À l'ouverture, l'application note ce que disait le fichier et compare cela avec son propre résultat. Elle le fait pour :

- un fichier Primavera (`.xer`) et Primavera P6 XML ;
- MS Project XML et les fichiers MS Project (`.mpp`) ;
- un fichier IFC d'un autre logiciel, pour les tâches dont les débuts au plus tôt figurent dans le fichier ;
- un fichier IFC issu de l'application elle-même, qui a retenu son origine. Plus bas, vous lisez quand c'est le cas.

L'application ne compare jamais un fichier CSV : la date de début dans un CSV est une donnée saisie, et non le résultat d'un calcul. Un fichier IFC issu de l'application elle-même, sans origine retenue, n'est pas comparé non plus.

Si aucune tâche ne diffère, vous ne remarquez rien. Si au moins une tâche diffère dans un fichier que vous importez maintenant, l'application active la vue tout de suite.

Avec un fichier Primavera, l'application calcule avec le profil de calcul *Primavera P6*. Ce profil garde le début planifié du fichier comme début au plus tôt. Une tâche qui est plus tardive dans le fichier que ne l'exigent les relations, mais qui y est aussi planifiée, reste donc à sa place : il n'y a alors aucune différence.

### Ce que vous voyez

Sous le ruban se trouve un bandeau : *Vous consultez les dates telles qu'enregistrées dans le fichier ; un recalcul déplacerait 4 tâches.* Avec une source Primavera (un `.xer` ou Primavera P6 XML), il indique *Vous consultez le planning tel qu'enregistré par Primavera ; un recalcul déplacerait 1 tâche.* À droite du bandeau se trouve le bouton *Recalculer*. Le bandeau n'a pas de croix.

Il y a aussi un message : *4 tâches affichent les dates telles qu'enregistrées dans le fichier (non recalculées).* Seulement avec un `.xer`, il dit *1 tâche affiche les dates telles qu'enregistrées par Primavera (non recalculées).* Chaque tâche pour laquelle le fichier a enregistré des dates affiche un marqueur dans le volet *Propriétés* : *Affiche les dates propres enregistrées par Primavera pour cette tâche* avec une source Primavera, ou *Affiche les dates telles qu’enregistrées dans le fichier pour cette tâche* avec une autre source. Le Gantt, le tableau des tâches et la barre d'état affichent les dates du fichier.

### Ce qui reste vide dans cette vue

Dans cette vue, l'application ne calcule rien. Elle affiche seulement ce que le fichier a enregistré. Vous ne voyez donc la marge et le chemin critique que si le fichier les contient. Si le fichier n'enregistre aucune tâche critique, la barre d'état indique 0 tâches critiques. Cela ne dit rien du chemin critique dans le logiciel d'origine. Ce qui ne sort que d'un calcul n'existe pas dans cette vue : quelles relations pilotent le planning, les contraintes violées, les tâches hors séquence et les tâches quasi critiques.

Si le fichier n'enregistre pas toutes les données d'une tâche, vous voyez le marqueur *Enregistrement partiellement incomplet — voir les colonnes fin au plus tard/marge* dans le volet *Propriétés*. Dans un export CSV, les colonnes *Critique* et *Marge totale* restent vides pour une telle tâche, au lieu d'un zéro inventé.

### Quitter la vue

Vous quittez la vue de deux façons :

- Cliquez sur *Recalculer* dans le bandeau, ou choisissez *Calculer* (F5). L'application calcule avec ses propres règles.
- Modifiez un élément qui peut changer les dates, comme la durée d'une tâche ou une nouvelle tâche. L'application quitte la vue et recalcule tout de suite, même si *Calculer automatiquement* est désactivé. Changer un nom ne fait pas cela : la vue reste active.

Une modification de calendrier depuis la bibliothèque de ressources laisse la vue active et les dates du fichier en place, mais met à jour le nombre dans le bandeau.

Après la sortie, il n'y a pas de bouton pour revenir à la vue. Ctrl+Z la rétablit toutefois, juste après un recalcul ou juste après une telle modification. Sinon, vous pouvez rouvrir le fichier source. Avec un `.xer`, ouvrir un fichier IFC que vous avez enregistré après un recalcul, mais sans le modifier, réactive aussi la vue.

### Récupération après un plantage

Si vous récupérez un projet après un plantage qui se trouvait dans la vue, la vue reste active. Le projet actif affiche le même bandeau qu'avant. Un projet sur un autre onglet affiche le bandeau sans chiffre : *Vous voyez les dates telles qu'elles sont enregistrées dans le fichier. Aucun recalcul n'a été effectué.* Voir [Récupération après un plantage](docs://howto-herstellen-na-een-crash).

### Enregistrer et rouvrir

Si vous enregistrez pendant que vous utilisez la vue, l'application écrit les dates affichées dans le fichier IFC, avec le format source. Si vous rouvrez ensuite ce fichier IFC sans l'avoir modifié depuis l'import, la vue est de nouveau active, sans nouveau message.

Si vous avez modifié et enregistré entre-temps, cela dépend de la source. Avec un fichier Primavera, le fichier IFC conserve le `.xer` d'origine. L'application compare alors de nouveau et propose la vue : *Le recalcul a déplacé 1 tâches sur 2 par rapport aux dates du fichier.* S'y ajoutent le bouton *Afficher les dates enregistrées* et une croix. Sur chaque tâche qui diverge, le volet *Propriétés* affiche le marqueur *Diverge des dates enregistrées*. *Afficher les dates enregistrées* active la vue ; Ctrl+Z annule cela. La croix masque la proposition.

Avec MS Project XML, `.mpp`, Primavera P6 XML ou un fichier IFC d'un autre logiciel, le fichier IFC ne conserve pas la source. Si vous modifiez et enregistrez un tel projet, l'application ne compare plus à la réouverture.

## Exemple : l'agrandissement

Supposons que vous ouvriez un fichier Primavera *Uitbouw* (agrandissement) avec deux tâches, sur un calendrier sans jours fériés. En 2027, le 6 mai est le jour de l'Ascension et le 17 mai le lundi de Pentecôte : avec des jours fériés dans le calendrier, les dates seraient différentes. *Fundering storten* (couler les fondations) dure 5 jours ouvrés, *Metselwerk* (maçonnerie) 10 jours ouvrés, et Metselwerk suit Fundering avec une relation fin-début. Le fichier enregistre que Fundering va du lundi 3 mai au vendredi 7 mai 2027, et Metselwerk du lundi 17 mai au vendredi 28 mai 2027 : une semaine après le début au plus tôt que la relation autorise. Le début planifié de Metselwerk dans le fichier est le lundi 10 mai 2027.

Juste après l'ouverture, vous voyez les dates du fichier. La barre d'état indique *Fin : 28-05-2027* et *Chemin critique : 2 tâches, 20 jours ouvrés*. Le bandeau indique que 1 tâche diffère lors d'un recalcul, et les deux tâches affichent le marqueur *Affiche les dates propres enregistrées par Primavera pour cette tâche*.

Après un clic sur *Recalculer*, Fundering reste du 3 au 7 mai. Metselwerk commence maintenant le lundi 10 mai, le jour ouvré qui suit la fin de Fundering, et se termine le vendredi 21 mai. Le planning se termine le 21 mai 2027 et couvre 15 jours ouvrés au lieu de 20. Le chemin critique se compose des mêmes 2 tâches.

Et si c'est différent ?

- Si Metselwerk est aussi planifié le lundi 17 mai dans le fichier, le profil de calcul *Primavera P6* conserve ce début. Le calcul aboutit du 17 au 28 mai, il n'y a aucune différence et la vue ne s'active pas.
- Vous ajoutez une tâche dans la vue : même recalcul. Metselwerk passe du 10 au 21 mai.
- Vous enregistrez dans la vue et rouvrez le fichier IFC, sans le modifier : Metselwerk revient du 17 au 28 mai.
- Vous recalculez, enregistrez sans autre modification et rouvrez le fichier IFC : la vue est de nouveau active et Metselwerk est du 17 au 28 mai.
- Vous modifiez, enregistrez et rouvrez : l'application propose la vue avec *Le recalcul a déplacé 1 tâches sur 2 par rapport aux dates du fichier.* Metselwerk affiche *Diverge des dates enregistrées*.

## Conséquences et malentendus

**Une différence n'est pas une erreur d'import.** L'application calcule avec ses propres règles : avec un `.xer` et le profil de calcul *Primavera P6*, avec un `.mpp` et *Microsoft Project*, avec CSV, MS Project XML et Primavera P6 XML et *Open Planner Studio*. La raison pour laquelle les dates du logiciel source diffèrent peut tenir au fichier ou au logiciel. La vue vous montre *que* les dates diffèrent.

**La vue n'est pas un résultat de calcul.** L'application n'a pas calculé les dates. Ne les reprenez pas simplement comme résultat de votre propre planning.

**Enregistrer dans la vue conserve les dates du logiciel source.** Le fichier IFC contient alors ce que disait le logiciel source, et non ce que l'application calculerait.

**Le bouton *Afficher les dates enregistrées* n'apparaît pas à chaque import.** Avec un fichier qui vient d'être ouvert, la vue est déjà active. Le bouton n'apparaît que pour un fichier IFC rouvert avec une source Primavera que vous avez modifié depuis l'import.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : ce que l'application conserve dans un fichier et ce qu'un import ou un export transporte.
- [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen) : les étapes et les messages pour un fichier `.xer`.
- [Ouvrir un fichier MS Project (.mpp)](docs://howto-mpp-openen) : les étapes et les messages pour un fichier `.mpp`.
- [Récupération après un plantage](docs://howto-herstellen-na-een-crash) : ce qui arrive à ce projet après un plantage.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : comment l'application calcule la marge et la criticité lorsqu'elle effectue un calcul.
