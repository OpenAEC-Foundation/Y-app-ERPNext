# Contraintes et échéances

Les briques ne sont livrées que le 21 juin. Le permis n'est pas encore arrivé. Le toit doit être fermé avant les congés du bâtiment. Les relations indiquent qu'une tâche attend une autre tâche, mais un accord sur une date ne découle pas de l'ordre des travaux. C'est à cela que servent les contraintes et les échéances. Dans cet article, vous découvrez ce que fait chaque type, quand une tâche bouge et quand seule la marge change, ce qu'est un verrouillage strict et comment l'application signale un conflit.

Les règles et les exemples s'appliquent à un nouveau projet, avec le profil de calcul *Open Planner Studio* et une semaine ouvrée du lundi au vendredi.

## Le concept

Une **contrainte** est une limite de date sur une seule tâche, indépendante de ses relations. Une telle limite peut agir de deux manières :

- Elle **pousse** : la tâche ne peut pas commencer ou finir plus tôt que la date. Si la tâche commencerait plus tôt à cause de ses relations, elle se déplace à la date.
- Elle **surveille** : la tâche doit commencer ou finir au plus tard à la date. L'application ne déplace rien. Si le planning ne respecte pas la date, la **marge** de la tâche, et celle de la chaîne qui la précède, devient négative. La marge est la place dont dispose une tâche avant que la date de fin du projet ne bouge ; négative signifie que, sur le papier, vous êtes déjà en retard (voir [Chemin critique et marge](docs://uitleg-kritiek-pad)).

Une **échéance** est une forme plus simple de surveillance : une date cible pour la fin d'une tâche, sans que la tâche soit déplacée par quoi que ce soit.

Toutes les contraintes sont **souples** : le calcul continue même si une date n'est pas respectée. Il y a une exception, le **verrouillage strict**, qui passe outre les relations. Plus de détails suivent plus bas.

## Comment l'application calcule

### Les huit types

Vous choisissez le type dans le champ *Contrainte* du panneau *Propriétés*. Voici comment chaque type calcule :

- *Dès que possible (ASAP)* : aucune limite. C'est la valeur par défaut : la tâche commence dès que ses relations le permettent.
- *Le plus tard possible (ALAP)* : la tâche se déplace le plus tard possible, sans qu'un successeur doive commencer plus tard. Elle consomme donc sa marge libre. Si elle a encore une marge totale après cela, parce que ses successeurs ont eux-mêmes de la place, elle reste non critique ; si celle-ci est aussi épuisée, elle devient critique.
- *Début au plus tôt le (SNET)* : une limite inférieure pour le début. Si la tâche commencerait plus tôt, elle se déplace à la date ; si la date est antérieure à ce que les relations permettent, la contrainte ne fait rien.
- *Fin au plus tôt le (FNET)* : la même chose, mais pour la fin de la tâche.
- *Début au plus tard le (SNLT)* et *Fin au plus tard le (FNLT)* : une limite supérieure pour le début ou la fin. Elles ne déplacent rien. Si la limite n'est pas respectée, l'application signale une contrainte violée et la marge devient négative.
- *Doit commencer le (MSO)* et *Doit finir le (MFO)* : une limite inférieure et une limite supérieure à la fois. La tâche se déplace à la date si celle-ci est plus tardive que ce que ses relations exigent. Si la date est plus tôt que ce que les relations permettent, la tâche reste là où les relations la placent, et la marge devient négative.

Si une date tombe un samedi, un dimanche ou un jour non ouvré, l'application la lit comme un jour ouvré : une limite inférieure (SNET, FNET) devient le jour ouvré suivant, une limite supérieure (SNLT, FNLT) le jour ouvré précédent.

### Ce que signifie une marge négative

Une limite supérieure travaille à rebours. Si la contrainte place la date au plus tard d'une tâche avant sa date au plus tôt, la marge totale devient négative. C'est aussi le cas pour les tâches qui la précèdent : si la maçonnerie doit commencer au plus tard le vendredi 11 juin et ne peut pas commencer avant le lundi 14 juin, les tâches qui précèdent le brickwork ont aussi un jour ouvré de retard. Toutes les tâches à marge négative sont critiques ; leur fonctionnement est expliqué dans [Chemin critique et marge](docs://uitleg-kritiek-pad).

Les barres ne bougent pas à cause d'une limite supérieure. Vous voyez le conflit dans la *Marge totale* négative, dans un losange rouge au-dessus de la barre, dans l'avis affiché dans la barre d'état (par exemple *1 contrainte(s) non respectée(s)*) et dans le panneau *Avertissements*.

### Le verrouillage strict

Avec MSO et MFO, la case *Obligatoire (logique de verrouillage)* apparaît. Si vous la cochez, vous fixez la tâche à la date, même si ses prédécesseurs ne sont pas terminés à ce moment-là. Les relations sont alors passées outre :

- La tâche se trouve à la date (avec MSO elle commence ce jour-là, avec MFO elle finit ce jour-là) et chevauche ses prédécesseurs.
- Les prédécesseurs ont une marge négative, et l'application signale une contrainte violée dès que les relations feraient commencer la tâche plus tard que le verrouillage. La tâche verrouillée elle-même garde une marge de 0.
- Les successeurs se calculent à partir de la tâche verrouillée. Ils peuvent donc commencer plus tôt que sans verrouillage, alors que la logique qui la précède n'est pas terminée. Dans l'exemple ci-dessous, la fin du projet avance de trois jours ouvrés à cause de cela.

La première fois que vous activez le verrouillage, l'application affiche une courte explication : un verrouillage strict passe outre les relations, la barre est fixée à la date, même avant ses prédécesseurs.

### La contrainte secondaire

Une tâche a une contrainte primaire. Si vous voulez aussi une deuxième limite, par exemple une tâche qui ne peut pas commencer avant le 14 juin et qui doit être finie au plus tard le 17 juin, vous ajoutez une **contrainte secondaire**. Elle doit être une vraie limite (SNET, FNET, SNLT ou FNLT) et limiter dans l'autre sens que la contrainte primaire : une limite inférieure (SNET ou FNET) avec une limite supérieure (SNLT ou FNLT). SNET avec SNLT est donc autorisé, SNET avec FNET ne l'est pas. L'application marque les autres combinaisons en rouge avec la raison, par exemple *Les contraintes primaire et secondaire ne peuvent pas borner le même côté.* Avec ASAP, ALAP, MSO, MFO et un verrouillage strict, une contrainte secondaire n'est pas autorisée.

### L'échéance

Une échéance est une date distincte sur une tâche, à côté de la contrainte. C'est une limite supérieure pour la fin : elle ne déplace rien, mais rend la marge négative si la tâche n'est pas finie à temps. L'application signale alors dans le panneau *Avertissements* *Échéance … dépassée — fin au plus tôt …*, et la barre d'état compte les échéances dépassées. Dans le Gantt, une flèche vers le bas marque la date d'échéance : verte tant que la tâche est finie à temps, rouge dès qu'elle est en retard. Une échéance qui tombe un samedi vaut jusqu'au vendredi précédent inclus.

Pour la marge, une échéance agit comme FNLT. La différence est dans l'usage. Une échéance est une date cible que vous voulez surveiller ; elle est distincte de la contrainte, si bien qu'une tâche peut avoir à la fois une contrainte et une échéance. FNLT est une contrainte : un dépassement apparaît comme une contrainte violée au lieu d'une échéance dépassée.

### Ce que ne fait pas une contrainte

- Sur une **phase** (tâche récapitulative), une contrainte ou une échéance ne compte pas : l'application calcule avec les tâches de la phase. Mettez-la sur la tâche elle-même.
- Une tâche qui a déjà un début réel ou un avancement garde ce début. Une SNET avec une date plus tardive ne la déplace pas.
- **Saisir une date de début** sur une tâche qui a un prédécesseur ne fonctionne pas comme un début fixe : le prédécesseur continue de décider. C'est pourquoi l'application la transforme en SNET à la date que vous avez saisie, dans le panneau *Propriétés*, dans *Modifier la tâche*, dans le tableau et quand vous déplacez la barre dans le Gantt. L'application vous le signale. Si la tâche a déjà une autre contrainte (par exemple ALAP ou MSO), l'application n'applique pas la nouvelle date et vous le signale aussi ; changez alors cette contrainte.

Toutes les modifications ne s'affichent qu'après **Calculer** (F5).

## Exemple détaillé

L'exemple est un petit réseau pour un agrandissement de maison. Il commence le lundi 7 juin 2027 :

- *Groundwork* (3 jours ouvrés) : du lundi 7 au mercredi 9 juin.
- *Pour foundation* (2) : le jeudi 10 et le vendredi 11 juin.
- *Brickwork* (5) : du lundi 14 au vendredi 18 juin.
- *Roofing* (3) : du lundi 21 au mercredi 23 juin.
- *Scaffolding* (2) : suit *Pour foundation* et précède *Roofing*. Il a lieu le lundi 14 et le mardi 15 juin et a 3 jours ouvrés de marge.

Le chemin critique est *Groundwork*, *Pour foundation*, *Brickwork* et *Roofing*. Le projet est terminé le mercredi 23 juin. Que change une seule contrainte sur *Brickwork* ?

- **SNET lundi 21 juin** (les briques n'arrivent qu'à ce moment-là) : *Brickwork* va du lundi 21 au vendredi 25 juin, *Roofing* du lundi 28 au mercredi 30 juin. Le projet est terminé le mercredi 30 juin. *Groundwork* et *Pour foundation* ont maintenant 5 jours ouvrés de marge et ne sont plus critiques, *Scaffolding* en a 8.
- **SNET mercredi 9 juin** : sans effet. Les relations ne permettent de toute façon à *Brickwork* de commencer que le lundi 14 juin.
- **SNLT mercredi 16 juin** : sans effet. *Brickwork* commence le lundi 14 juin et respecte largement la limite.
- **SNLT vendredi 11 juin** : trop serré. *Brickwork* commence quand même le lundi 14 juin, un jour ouvré trop tard. *Groundwork*, *Pour foundation* et *Brickwork* ont −1 jour ouvré de marge, et l'application signale *La contrainte Début au plus tard le (SNLT) 11-06-2027 est outrepassée par la logique (marge négative)*. Rien ne bouge.
- **MSO mercredi 16 juin** (sans verrouillage strict) : *Brickwork* se déplace au mercredi 16 juin et est terminé le mardi 22 juin. *Roofing* va du mercredi 23 au vendredi 25 juin : le projet est terminé le vendredi 25 juin.
- **MSO vendredi 11 juin** (sans verrouillage strict) : la date est antérieure à ce que les relations permettent. *Brickwork* commence quand même le lundi 14 juin et la marge devient −1, comme avec SNLT.
- **MSO mercredi 9 juin avec verrouillage strict** : *Brickwork* commence le mercredi 9 juin et est terminé le mardi 15 juin, alors que *Pour foundation* continue jusqu'au vendredi 11 juin. *Roofing* va du mercredi 16 au vendredi 18 juin : le projet est terminé trois jours ouvrés plus tôt que sans verrouillage. *Groundwork* et *Pour foundation* ont −3 jours ouvrés de marge.

Et avec une contrainte ou une échéance sur une autre tâche :

- **ALAP sur** *Scaffolding* : la tâche se déplace aux dates du jeudi 17 et du vendredi 18 juin, le dernier moment avant *Roofing*. *Roofing* est son seul successeur et avait de la place pour exactement ses 3 jours ouvrés de marge ; ceux-ci sont maintenant consommés et *Scaffolding* est critique.
- **SNET samedi 19 juin sur** *Scaffolding* : la limite compte comme lundi 21 juin. *Scaffolding* a lieu le lundi 21 et le mardi 22 juin, et *Roofing* suit et va du mercredi 23 au vendredi 25 juin.
- **Échéance vendredi 18 juin sur** *Roofing* : rien ne bouge, *Roofing* reste du lundi 21 au mercredi 23 juin. *Groundwork*, *Pour foundation*, *Brickwork* et *Roofing* ont −3 jours ouvrés de marge, et l'application signale *Échéance 18-06-2027 dépassée — fin au plus tôt 23-06-2027*. *Scaffolding* garde 0 jour ouvré de marge et devient critique aussi.
- **SNET lundi 21 juin sur** *Brickwork*, **échéance vendredi 25 juin sur** *Roofing* : la contrainte repousse *Brickwork* d'une semaine, et l'échéance signale que *Roofing* est en retard le mercredi 30 juin. *Brickwork* et *Roofing* ont −3 jours ouvrés de marge ; *Groundwork* et *Pour foundation* gardent 2 jours ouvrés.

Dans le tutoriel 3, vous définissez vous-même une contrainte et une échéance dans le projet du tutoriel, et vous voyez comment le planning bouge.

## Conséquences et idées reçues

**« Une contrainte déplace la tâche. »** Seuls SNET, FNET, MSO et MFO peuvent placer une tâche plus tard que ses relations, et ALAP peut la décaler dans sa marge libre. SNLT et FNLT ne déplacent jamais rien : elles signalent seulement. Pour respecter la date, il faut alors raccourcir la chaîne qui la précède.

**« La marge négative est une erreur de l'application. »** C'est le signal que le planning est en conflit avec votre accord sur une date. Vous le résolvez en raccourcissant la chaîne, en assouplissant l'accord ou en acceptant le conflit à dessein.

**« Un verrouillage strict résout le conflit. »** Un verrouillage strict cache le conflit : la tâche se trouve à la date, mais ses prédécesseurs ne sont pas prêts, et les successeurs se calculent comme si ces prédécesseurs étaient prêts. Ne l'utilisez que pour une date vraiment fixe, par exemple une date légale de remise, et non pour placer une tâche à une date.

**« Je saisis simplement une date de début. »** Pour une tâche qui a un prédécesseur, cela devient une SNET. Si cette date est antérieure à ce que le prédécesseur permet, elle ne fait rien.

**« Échéance ou FNLT ? »** Choisissez une échéance pour une date cible que vous voulez surveiller, et une contrainte pour une date qui est vraiment une condition limite du planning.

**« Une contrainte sur la phase. »** Cela ne compte pas. Mettez-la sur la tâche elle-même.

## Voir aussi

- [Définir une contrainte ou une échéance](docs://howto-constraint-deadline-zetten) : les étapes pour définir une contrainte ou une échéance.
- [Relations et décalage](docs://uitleg-relaties) : les relations à côté desquelles les contraintes se placent.
- [Chemin critique et marge](docs://uitleg-kritiek-pad) : comment une marge négative apparaît et ce qu'elle fait au chemin critique.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc) : un verrouillage strict (*Doit commencer le (MSO)*) sur *Municipal road closure (permitted closure period)* et une contrainte secondaire (*Début au plus tard le (SNLT)*) sur *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc) : une échéance non respectée, avec une marge négative.
