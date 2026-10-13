# Définir une contrainte ou une échéance

Objectif : enregistrer un accord de date sur une tâche, pour que le planning en tienne compte ou montre que vous ne le tenez pas.

## Quand en avez-vous besoin

Les briques ne sont livrées que le 21 juin. La maçonnerie ne peut donc pas commencer plus tôt : une **contrainte** *Début au plus tôt*. La toiture doit être fermée avant les jours fériés du bâtiment, et vous voulez être averti si ce n'est pas possible : une **échéance**. Le coulage est fixé à un jour précis, car la centrale à béton l'a promis : *Doit commencer le*. Le type à utiliser selon le cas, et ce que fait l'application, est expliqué dans [Contraintes et échéances](docs://uitleg-constraints).

## Étapes

Vous définissez une contrainte et une échéance dans le panneau *Propriétés*.

1. Sélectionnez la tâche. Si vous ne voyez pas le panneau *Propriétés*, activez-le avec *Affichage › Panneaux › Propriétés*.
2. Dans *Contrainte*, choisissez le type, par exemple *Début au plus tôt le (SNET)*.
3. Avec tous les types sauf *Dès que possible (ASAP)* et *Le plus tard possible (ALAP)*, le champ *Date de contrainte* apparaît. Saisissez la date dans les trois cases pour le jour, le mois et l'année, par exemple 21, 06 et 2027, puis appuyez sur Entrée. L'application passe toute seule à la case suivante dès qu'une case est pleine. Après le choix du type, une date est déjà présente : celle de la contrainte précédente ou, sinon, le début planifié d'origine de la tâche. Elle peut différer du début affiché dans le panneau. Saisissez donc toujours vous-même la date voulue.
4. Si vous voulez fixer la tâche à cette date, même avant ses prédécesseurs, choisissez *Doit commencer le (MSO)* ou *Doit finir le (MFO)* et cochez *Obligatoire (logique de verrouillage)*. C'est un verrouillage strict ; utilisez-le uniquement pour une date réellement fixe.
5. Si vous voulez aussi une deuxième limite, par exemple une tâche qui ne peut pas commencer avant le 14 juin et doit être finie au plus tard le 17 juin, choisissez un type dans *Contrainte secondaire* et remplissez la *Date secondaire*. Ce champ apparaît avec chaque contrainte qui a une date, sauf avec un verrouillage strict. Avec MSO et MFO, une contrainte secondaire n'est pas permise : l'application la marque alors en rouge.
6. Pour une échéance, remplissez le champ *Échéance*, de la même manière que la date de contrainte. Une échéance est indépendante de la contrainte : vous pouvez définir les deux sur la même tâche.
7. Appuyez sur **Calculer** (F5), par exemple via *Accueil › Planification › Calculer*. Jusque-là, la barre d'état affiche *Obsolète — recalculer (F5)*.

Les champs se trouvent aussi dans la fenêtre *Modifier la tâche*, que vous ouvrez en faisant un clic droit sur la tâche et en choisissant *Modifier...* ; vous confirmez avec *Enregistrer*.

Dans le tableau, vous travaillez avec des colonnes. Cliquez sur le **+** dans l'en-tête du tableau et, sous *Contraintes*, choisissez les colonnes *Type de contrainte*, *Date de contrainte* et *Échéance* (il y a aussi *Contrainte stricte*, *Type de contrainte secondaire* et *Date de contrainte secondaire*). Double-cliquez sur une cellule pour la modifier : vous choisissez le type dans une liste, et vous saisissez une date avec des tirets, par exemple 21-06-2027. *Contrainte stricte* ne peut être modifiée que pour MSO et MFO.

Si la tâche a un prédécesseur, il existe un raccourci pour *Début au plus tôt* : tapez simplement une nouvelle date de début dans le champ *Début* (dans le panneau *Propriétés*, dans *Modifier la tâche* ou dans le tableau), ou déplacez la barre dans le Gantt. L'application la transforme alors elle-même en contrainte *Début au plus tôt le (SNET)* et vous en informe.

## Vérifier le résultat

- Dans le Gantt, un petit losange se trouve au-dessus de la barre, côté début pour une contrainte de début et côté fin pour une contrainte de fin : bleu pour SNET et FNET, violet pour SNLT, FNLT, MSO et MFO, rouge si la contrainte est violée. Un verrouillage strict affiche une épingle. Une échéance est une flèche vers le bas à la date d'échéance : verte tant que la tâche est terminée à temps, rouge si elle est en retard.
- Une contrainte violée ou une échéance manquée apparaît dans le panneau *Avertissements* (*Planification › Planification › Avertissements*) et dans la barre d'état. La *Marge totale* de la tâche et des tâches qui la précèdent est alors négative.
- Avec une limite supérieure (*Début au plus tard*, *Fin au plus tard le*) ou une échéance, l'absence d'avertissement signifie que le planning respecte la date.

## Supprimer une contrainte ou une échéance

Dans *Contrainte*, choisissez de nouveau *Dès que possible (ASAP)*. Cela supprime aussi la contrainte secondaire. Vous supprimez une échéance en vidant les trois cases et en appuyant sur Entrée. Appuyez ensuite sur **Calculer**.

## Points d'attention et ce que fait l'application

**Une contrainte sur une phase.** Une contrainte ou une échéance sur une phase (tâche récapitulative) n'a aucun effet. Placez-la sur la tâche elle-même.

**Une tâche déjà commencée.** Si la tâche a un début réel ou un avancement, elle garde son début réel. Un *Début au plus tôt* avec une date ultérieure ne la déplace pas.

**Saisir une date de début alors qu'une autre contrainte existe.** Si la tâche a un prédécesseur et a déjà une autre contrainte, par exemple *Le plus tard possible (ALAP)*, l'application n'applique pas le début saisi. Un message nomme la contrainte ; modifiez-la si vous voulez déplacer le début.

**Une date pendant le week-end.** Une date tombant un samedi, un dimanche ou un jour non ouvré est traitée comme un jour ouvré : une limite inférieure (*Début au plus tôt*, *Fin au plus tôt le*) passe au jour ouvré suivant, une limite supérieure (*Début au plus tard*, *Fin au plus tard le*) au jour ouvré précédent.

**Une contrainte secondaire non permise.** L'application marque en rouge une combinaison non valable, avec la raison, par exemple *Les contraintes primaire et secondaire ne peuvent pas borner le même côté.* Une contrainte secondaire n'est pas permise avec ASAP, ALAP, MSO, MFO et un verrouillage strict.

**Un verrouillage strict.** La première fois que vous l'activez, l'application avertit qu'un verrouillage strict remplace les relations. La tâche se trouve alors à cette date, même avant ses prédécesseurs ; ces prédécesseurs obtiennent une marge négative.

**Rien ne change après avoir défini la contrainte.** Les contraintes ne fonctionnent qu'après **Calculer**. Si une limite supérieure (*Début au plus tard*, *Fin au plus tard le*) n'a aucun effet sur les barres, c'est normal : une limite supérieure ne déplace rien, elle rend la marge négative si la date n'est pas respectée.

## Voir aussi

- [Contraintes et échéances](docs://uitleg-constraints) : ce que fait chaque type, et l'explication du verrouillage strict, de la marge négative et de l'échéance.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : ce que fait la marge négative au chemin critique.
- [Relations et décalages](docs://uitleg-relaties) : les relations à côté desquelles se place une contrainte.
- [Notifications et avertissements](docs://ref-meldingen) : les avertissements pour une contrainte violée ou une échéance manquée.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc) : une contrainte de permis *Début au plus tôt* sur *Demolish existing extension* (14 mai 2027) et une échéance respectée avec une bonne avance.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : une échéance volontairement serrée sur *Contractual project handover* (15 juillet 2027) : après le calcul, la fin tombe le 17 août et beaucoup de tâches ont une marge négative.
