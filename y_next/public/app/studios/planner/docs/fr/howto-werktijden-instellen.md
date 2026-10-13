# Régler les horaires de travail

Objectif : indiquer, par jour de la semaine, à quelles heures un calendrier travaille, afin que les tâches en heures se déroulent aux bons moments.

## Quand en avez-vous besoin

L'après-midi du vendredi n'est pas travaillé. L'équipe de chantier travaille de 06:00 à 22:00 en deux équipes. Il y a une équipe de nuit. La pause dure moins d'une heure. Tant que vous planifiez seulement en jours, *Début (heure)*, *Fin (heure)* et la pause suffisent ([Créer et affecter un calendrier](docs://howto-kalender-maken-en-toewijzen)). Si vous planifiez des tâches en heures, l'application compte les minutes de travail dans les **plages horaires** du calendrier. Dans l'application, on les appelle *plages* : une plage est une période continue d'horaires de travail sur un jour de la semaine, et un écart entre deux plages est une pause. Ce que cela signifie pour votre planning est expliqué dans [Jours et heures](docs://uitleg-dagen-en-uren).

Pour cela, il vous faut *Activer la planification horaire* ([Activer la planification horaire](docs://howto-urenplanning-aanzetten)). Sans planification horaire, vous ne voyez pas le panneau *Horaires de travail*.

## Étapes

### Choisir un préréglage d'équipes

1. Choisissez *Planification › Calendrier › Calendrier* et sélectionnez le calendrier à gauche.
2. Dans le panneau *Horaires de travail*, cliquez sur un préréglage. Il remplace les jours ouvrés et les horaires de travail du calendrier.
3. Cliquez sur *Appliquer*.

Chaque préréglage fait ceci :

- *Équipe de jour* : du lundi au vendredi de 08:00 à 16:00, sans pause. Cela le remet en calendrier ordinaire, sans plages horaires.
- *2 équipes* : du lundi au vendredi de 06:00 à 14:00 et de 14:00 à 22:00, soit 16 heures au total.
- *3 équipes* : du lundi au vendredi, en trois équipes : de 06:00 à 14:00, de 14:00 à 22:00 et de 22:00 à 06:00 le jour suivant, soit 24 heures au total.
- *Équipe de nuit* : du lundi au vendredi de 22:00 à 06:00 le jour suivant, soit 8 heures.
- *24/7* : les sept jours de 00:00 à 24:00.

### Définir les horaires de travail par jour de la semaine

1. Dans le panneau *Horaires de travail*, cliquez sur *Définir par jour de la semaine…*. Sous les boutons, une ligne apparaît par jour de la semaine avec les horaires de travail de ce jour, et le calendrier a maintenant des plages horaires par jour. Si le calendrier en a déjà, cet aperçu est ouvert tout de suite ; le bouton s'appelle alors *Masquer les horaires de travail* et le referme.
2. Ajustez l'heure de début et de fin de chaque plage dans les deux champs d'heure.
3. Si vous voulez intégrer une pause, cliquez sur **+** (*Ajouter une plage*) pour ce jour, puis ajustez les horaires des plages pour qu'il y ait un écart entre elles. Une nouvelle plage commence à 08:00 et se termine à 16:00.
4. Pour une plage qui dépasse minuit, cochez *jour suivant*. La plage compte pour le jour où elle commence.
5. Cliquez sur la corbeille derrière une plage pour la supprimer. Un jour sans plages apparaît comme *Non travaillé*.
6. Pour un jour du lundi au vendredi, cliquez sur le symbole de copie (*Copier sur tous les jours ouvrés*) pour mettre les plages de ce jour du lundi au vendredi.
7. En bas se trouve *Heures/jour dérivées :* avec les heures nettes par jour que l'application en déduit. Cliquez sur *Appliquer*.

**Exemple : un vendredi après-midi libre.** Cliquez sur *Définir par jour de la semaine…*. Supprimez la deuxième plage (13:00 à 16:00) pour *Ven*. Le vendredi a maintenant 5 heures, les autres jours 8. Les heures dérivées par jour restent à 8.

### Enregistrer un préréglage personnel

1. Cliquez sur *Enregistrer comme préréglage…* et saisissez un nom dans le champ *Nom du préréglage*.
2. Cliquez sur *Enregistrer*. Le préréglage se trouve maintenant parmi les autres, et vous pouvez l'utiliser dans n'importe quel projet. Avec la croix à côté, vous le supprimez à nouveau.

Un préréglage personnel est enregistré sur cet appareil, pas dans le fichier de projet.

## Pièges et ce que l'application fait alors

**Un préréglage remplace tout.** Si vous choisissez un préréglage, les jours ouvrés et les horaires de travail que vous avez définis auparavant disparaissent. Les jours fériés restent.

**Les boutons de jour et les plages sont deux choses.** Les boutons sous *Jours ouvrés* ne modifient pas les plages. Un jour reçoit des horaires de travail en cliquant sur *Ajouter une plage* pour ce jour. Si vous activez un jour seulement avec le bouton, il compte pour les tâches en jours, mais pas pour les tâches en heures. Avec un calendrier qui a des horaires de travail, utilisez les lignes par jour de la semaine.

**Modifier les horaires de travail avec la planification horaire désactivée.** Si vous désactivez à nouveau la planification horaire, les champs *Début (heure)*, *Fin (heure)* et la pause réapparaissent. Sur un calendrier avec des plages horaires, ils ne modifient pas les plages. Modifiez donc toujours les horaires de travail pendant que la planification horaire est activée.

**Aucun horaire de travail utilisable.** Un calendrier sans plages ou sans jours ouvrés ne peut pas accueillir une tâche en heures. L'application affiche alors *Ce calendrier n'a pas d'horaires de travail valides. Vérifiez ses jours et horaires de travail.*

## Voir aussi

- [Jours et heures](docs://uitleg-dagen-en-uren) : comment l'application compte les horaires de travail et en déduit les heures nettes par jour.
- [Activer la planification horaire](docs://howto-urenplanning-aanzetten) : planifier une tâche en heures.
- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : quel calendrier s'applique à quelle tâche.
- [Fenêtres de calendrier](docs://ref-kalenders) : tous les champs des fenêtres de calendrier.
