# Créer un hamac

Objectif : créer une tâche qui ne connaît pas sa propre durée, mais qui va du début d'une tâche à la fin d'une autre, comme l'installation de chantier, la surveillance ou la location d'une baraque de chantier.

## Quand vous en avez besoin

La baraque de chantier reste en place aussi longtemps que le bâtiment avance, du premier terrassement jusqu'à la réception. Si vous donnez à cette tâche une durée fixe de 13 jours ouvrés, elle ne suit pas quand la maçonnerie prend du retard, et le planning n'est plus juste. Un **hamac** (aussi appelé *niveau d'effort*) suit les tâches auxquelles vous le rattachez : son début vient d'une relation de début, sa fin d'une relation de fin, et sa durée est la différence entre les deux.

## Étapes

1. Créez la tâche, par exemple *Site cabin*, ou sélectionnez une tâche existante. Un jalon et une tâche récapitulative (phase) ne peuvent pas être un hamac ; dans le panneau *Propriétés* et dans *Modifier la tâche*, la case à cocher manque pour une telle tâche, et dans la colonne de tableau, elle ne peut pas être modifiée.
2. Cochez *Hamac (durée dérivée)* dans le panneau *Propriétés*, dans *Modifier la tâche* (clic droit sur la tâche, *Éditer...*) ou dans la colonne *Hamac (durée dérivée)* sous *Planification*. Le champ *Durée* ne peut alors plus être modifié.
3. Ajoutez une relation depuis la tâche avec laquelle le hamac commence jusqu'au hamac, de type **SS** (le hamac commence en même temps que cette tâche) ou **FS** (le hamac commence après cette tâche). Pour cela, sélectionnez le hamac, cliquez sur *Ajouter une relation* dans *Dépendances*, laissez le sens sur *Prédécesseur*, choisissez la tâche et choisissez le type. Les étapes se trouvent dans [Ajouter des relations](docs://howto-relaties-leggen).
4. Ajoutez une relation depuis la tâche avec laquelle le hamac se termine jusqu'au hamac, de type **FF** (le hamac se termine en même temps que cette tâche) ou **SF**.
5. Regardez dans le panneau *Propriétés*, sous *Hamac (durée dérivée)* : vous y voyez *Driver de début* avec la tâche et le type, et *Driver de fin* avec la tâche et le type. Un driver est une tâche dont le hamac tire son début ou sa fin.
6. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*. Le hamac court maintenant du début du driver de début à la fin du driver de fin, et *Durée* affiche la durée dérivée.

Dans le Gantt, un hamac est une fine barre sarcelle avec un crochet à chaque extrémité.

Exemple : *Site cabin* reçoit SS depuis *Groundwork* (lundi 7 juin 2027) et FF depuis *Roofing* (fin le mercredi 23 juin). Après avoir appuyé sur **Calculer**, le hamac va du lundi 7 au mercredi 23 juin : 13 jours ouvrés. Si la maçonnerie prend 2 jours ouvrés de retard, la fin de *Roofing* devient le vendredi 25 juin et le hamac s'allonge jusqu'à 15 jours ouvrés.

## Ce que l'application fait avec un hamac

- Le hamac n'est jamais critique et n'a pas de marge. Il ne limite pas non plus les tâches dont il prend le début et la fin : elles ne reçoivent pas de date au plus tard à cause du hamac.
- Un décalage compte. Avec SS et un décalage `1d`, le hamac commence un jour ouvré après le driver de début ; avec FF et un décalage `2d`, il se termine deux jours ouvrés après le driver de fin.

## Pièges et ce que fait l'application

**Pas de driver de fin.** Si le hamac n'a pas de relation FF ou SF, l'application ne peut pas en déduire sa fin. Le panneau *Propriétés* indique *Aucun driver de fin (FF/SF) — l'intervalle revient à une longueur nulle.* et le panneau *Avertissements* indique *Hamac sans driver de fin (aucun prédécesseur FF/SF) : sa durée retombe à zéro*. Le hamac commence alors et se termine le même jour. Ajoutez une relation FF ou SF.

**Un hamac qui se termine après la dernière tâche.** Si le hamac se prolonge au-delà de la dernière tâche, par exemple avec FF et un décalage de 2 jours ouvrés, la date de fin du projet suit ce hamac. Les tâches que vous réalisez réellement reçoivent alors une marge ; aucune d'elles n'est plus critique.

**Tâches qui attendent un hamac.** Si vous ajoutez une relation depuis le hamac vers une autre tâche, cette tâche ne commence qu'après la fin du hamac. Toute la chaîne avant le hamac, y compris les tâches dont le hamac prend le début et la fin, reçoit alors une marge et n'est plus critique, car le hamac n'exerce aucune pression sur ces tâches. Ne laissez donc pas de tâches attendre un hamac ; accrochez plutôt ces tâches au driver de fin du hamac.

**Saisir une durée.** Le champ *Durée* d'un hamac est dérivé et ne peut pas être modifié. Une durée saisie avant que vous ne cochiez la case ne compte plus.

## Voir aussi

- [Ajouter des relations](docs://howto-relaties-leggen) : les étapes pour ajouter une relation de type SS ou FF.
- [Relations et décalage](docs://uitleg-relaties) : ce que signifient SS et FF et comment le décalage compte.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que signifie critique et comment fonctionne la marge.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : contient le hamac *Structural works tower A (LOE)*.
