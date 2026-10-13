# Règles de travail : durée, unités et travail

Vous affectez un plâtrier au plâtrage et la tâche dure quatre jours. Si vous ajoutez un deuxième plâtrier, le plâtrage peut se faire en deux jours. La tâche peut aussi rester à quatre jours, avec deux fois plus de travail. Les deux sont logiques. Le choix entre les deux dépend de la **règle de travail** de la tâche. Dans cet article, vous lisez comment l'application relie la durée, les unités et le travail, et ce que chaque règle de travail maintient constant.

## Le concept

Trois grandeurs sont liées entre elles :

- **Durée** : combien de temps la tâche dure, en jours ouvrés ou en heures.
- **Unités** : la part d'une ressource qui travaille sur la tâche par jour ouvré. Dans l'application, cela s'appelle *Unités/jour*. Des unités de 1 correspondent à un plâtrier pour toute la journée, 2 à deux plâtriers et 0,5 à une demi-journée.
- **Travail** : le nombre total d'heures que la ressource passe sur la tâche.

La somme s'écrit : travail = durée × unités × heures par jour ouvré. Les heures par jour ouvré viennent du calendrier de la tâche. Un plâtrage de quatre jours ouvrés avec un seul plâtrier représente, avec un jour ouvré de 8 heures, 4 × 1 × 8 = 32 heures de travail.

Si vous modifiez une de ces trois grandeurs, au moins une des deux autres doit suivre, sinon la somme n'est plus juste. La règle de travail décide laquelle. Vous la réglez par tâche, dans le volet *Propriétés*. L'application n'affiche la règle de travail et le travail qu'une fois que vous les avez activés ; le fonctionnement est décrit dans [Choisir une règle de travail](docs://howto-werkregel-kiezen).

Une règle de travail ne fonctionne que sur les tâches ordinaires. Les jalons, les phases (tâches récapitulatives), les hamacs et les tâches dont le *Type de durée* est *Temps écoulé* n'en ont pas : le champ *Règle de travail* n'apparaît pas. Les matériaux, comme le béton ou le mortier de plâtre, ne comptent pas non plus. La quantité de matériau ne détermine jamais la durée, et l'application ne l'ajuste jamais à cause d'une règle de travail.

## Comment l'application calcule

### La règle agit sur ce que vous modifiez

L'application recalcule la durée, les unités et le travail seulement au moment où vous modifiez l'une de ces valeurs : la durée de la tâche, les unités d'une affectation, le travail, une ressource ajoutée ou retirée, ou les heures par jour d'un calendrier. **Calculer** (F5) ne modifie aucune de ces valeurs : F5 calcule uniquement les dates. Choisir une règle ne modifie pas non plus un seul nombre. La règle s'applique à votre prochaine modification.

Si une règle de travail modifie la durée de la tâche, le planning devient obsolète. La barre d'état affiche alors *Obsolète — recalculer (F5)*, sauf si *Calculer automatiquement* est activé.

### Quatre règles

Dans le volet *Propriétés*, sous la liste déroulante, l'application affiche ce que la règle choisie protège. Les quatre règles, avec le texte de l'application :

- **Durée et unités fixes** (*Protégé : durée et unités (le travail suit)*). C'est la valeur par défaut. L'application ne modifie jamais la durée elle-même, et le travail suit de la durée et des unités. Si vous saisissez vous-même le travail, l'application ajuste les unités, car la durée est fixe.
- **Durée et travail fixes** (*Protégé : durée et travail (les unités suivent)*). L'application ne modifie jamais la durée elle-même. Si vous modifiez la durée, le travail reste et les unités s'ajustent.
- **Travail fixe** (*Protégé : travail (la durée suit les unités)*). Le travail est fixe et la durée suit du travail et des unités.
- **Unités fixes** (*Protégé : unités (la durée suit le travail)*). Les unités sont fixes et la durée suit du travail.

Deux règles laissent donc la durée intacte. Avec les deux autres, la durée suit quand vous modifiez les unités, le travail ou le nombre de ressources. Avec une seule ressource, Travail fixe et Unités fixes donnent exactement le même résultat. Ils diffèrent quand vous modifiez la durée vous-même : avec Travail fixe, le travail reste et les unités s'ajustent ; avec Unités fixes, les unités restent et le travail suit. Ils diffèrent aussi quand il y a plus de ressources sur la tâche (voir ci-dessous).

Les exemples détaillés ci-dessous montrent ce que fait chaque règle.

### Arrondi

La durée qui découle de la somme est arrondie vers le haut par l'application. Pour une tâche en jours, elle est arrondie à des jours ouvrés entiers ; pour une tâche en heures, à des minutes entières. Le travail et les unités restent ce que vous avez saisi, ou ce que l'application a calculé à partir de la somme. La somme ne tient donc parfois plus exactement. L'exemple ci-dessous montre ce qui se passe alors.

### Plusieurs ressources

Si une tâche a plusieurs ressources, deux principes s'appliquent. Avec Durée et travail fixes, Travail fixe et Unités fixes, le travail total reste le même quand vous ajoutez ou retirez une ressource. L'application le répartit alors proportionnellement aux unités. Avec Durée et unités fixes, une nouvelle ressource apporte à la place son propre travail. Avec Travail fixe et Unités fixes, la ressource la plus lente détermine la durée : par ressource, c'est le travail divisé par les unités, et c'est le plus grand résultat qui compte.

Un exemple : deux ressources ont chacune 32 heures de travail et des unités de 1, soit une durée de 4 jours ouvrés au total. Vous réglez les unités de la première à 0,5. La durée devient alors 8 jours ouvrés. Avec Travail fixe, la seconde ressource garde ses 32 heures de travail et ses unités tombent à 0,5. Avec Unités fixes, la seconde garde ses unités de 1 et son travail passe à 64 heures.

### Avancement

Si la tâche a déjà un avancement, la règle agit sur la partie restante : la durée restante et le travail restant. Dans l'application, ce travail s'appelle *Travail (rest.)*. Ce qui est déjà fait reste tel quel.

### Tâches en heures

Une tâche planifiée en heures se calcule de la même façon, mais en minutes. Si seule la grue est affectée à une tâche de 5 heures, cela représente 5 heures de travail. Avec Travail fixe, la durée passe alors à 2,5 heures pour des unités de 2. Le plancher à entrevous du projet d'exercice a aussi l'équipe de charpentiers dessus. Il lui faut toujours 5 heures de travail, c'est le plus lent, donc la durée reste de 5 heures. Le rapport entre heures et jours est expliqué dans [Jours et heures](docs://uitleg-dagen-en-uren).

## Exemple détaillé : le plâtrage

L'exemple est le projet d'exercice des tutoriels *House extension*. Dans le tutoriel 5, vous calculez ces valeurs vous-même et vérifiez les chiffres. Ici, vous lisez ce que fait chaque règle.

Le plâtrage dure 4 jours ouvrés. Un plâtrier y est affecté, avec des unités de 1, et le jour ouvré dure 8 heures. Le travail est donc de 32 heures.

### Durée et unités fixes

- Vous fixez la durée à 6 jours ouvrés : le travail passe à 48 heures, les unités restent à 1.
- Vous réglez les unités à 2 : la durée reste de 4 jours ouvrés, le travail devient 64 heures.
- Vous saisissez 48 heures dans *Travail (rest.)* : la durée reste de 4 jours ouvrés, les unités deviennent 1,5.
- Vous affectez une deuxième ressource, par exemple *Plasterer 2*, avec des unités de 1 : la durée reste de 4 jours ouvrés et cette deuxième ressource apporte 32 heures de travail, soit 64 heures au total.

### Durée et travail fixes

- Vous fixez la durée à 6 jours ouvrés : le travail reste à 32 heures, les unités tombent à 0,67.
- Vous réglez les unités à 2 : la durée reste de 4 jours ouvrés. Comme la durée est fixe, le travail suit et passe à 64 heures.
- Vous saisissez 16 heures dans *Travail (rest.)* : la durée reste de 4 jours ouvrés, les unités deviennent 0,5.
- Vous affectez une deuxième ressource, par exemple *Plasterer 2*, avec des unités de 1 : les 32 heures sont réparties, 16 heures chacune, et les unités deviennent 0,5 pour les deux. La durée reste de 4 jours ouvrés.

### Travail fixe

- Vous fixez la durée à 6 jours ouvrés : le travail reste à 32 heures, les unités tombent à 0,67.
- Vous réglez les unités à 2 : le travail reste à 32 heures et la durée devient 2 jours ouvrés. C'est l'étape que vous faites dans le tutoriel 5.
- Vous saisissez 48 heures dans *Travail (rest.)* : les unités restent à 1 et la durée devient 6 jours ouvrés.
- Vous affectez une deuxième ressource, par exemple *Plasterer 2*, avec des unités de 1 : les 32 heures sont réparties, 16 heures chacune, et la durée devient 2 jours ouvrés. Retirez de nouveau cette deuxième ressource et la durée redevient 4 jours ouvrés.

### Unités fixes

- Vous fixez la durée à 6 jours ouvrés : les unités restent à 1, le travail passe à 48 heures.
- Vous réglez les unités à 2 : le travail reste à 32 heures et la durée devient 2 jours ouvrés.
- Vous saisissez 48 heures dans *Travail (rest.)* : les unités restent à 1 et la durée devient 6 jours ouvrés.
- Vous affectez une deuxième ressource, par exemple *Plasterer 2*, avec des unités de 1 : les 32 heures sont réparties, 16 heures chacune, et la durée devient 2 jours ouvrés.

### Quand la somme ne tombe pas juste

Avec Travail fixe, vous réglez les unités à 3. Le travail est de 32 heures, donc la durée devient 32 ÷ (3 × 8) = 1,33 jour ouvré. L'application arrondit cela à 2 jours ouvrés. Le travail (32 heures) et les unités (3) restent, mais 2 × 3 × 8 fait 48 heures. L'histogramme répartit donc les 32 heures sur les 2 jours ouvrés : 2 unités par jour, et non 3. À côté de *Travail (rest.)*, un signal d'avertissement apparaît, *Diffère de unités × durée*, pour le montrer.

Avec deux ressources aux unités différentes, cela fonctionne de la même façon. Si, avec Travail fixe, vous ajoutez une deuxième ressource, par exemple *Plasterer 2*, avec des unités de 2 au plâtrier avec des unités de 1, l'application répartit les 32 heures dans le rapport 1 : 2, soit 10,7 et 21,3 heures. Les deux ont alors besoin de 1,33 jour ouvré. La durée devient 2 jours ouvrés.

### Un autre calendrier

Avec Travail fixe, le jour ouvré du calendrier passe de 8 à 6 heures. Le travail reste à 32 heures, donc la durée devient 32 ÷ 6 = 5,33, arrondie à 6 jours ouvrés. Le calcul des jours ouvrés et des horaires de travail est expliqué dans [Calendriers et jours ouvrés](docs://uitleg-kalenders). L'application affiche : *Après le changement de calendrier, la règle de travail a ajusté la durée de 1 tâche (le travail reste, les heures par jour ont changé).*

### Une tâche avec avancement

Le parement intérieur du double mur dure 5 jours ouvrés et est avancé à 40 % : 2 jours ouvrés sont faits et 3 jours ouvrés (24 heures) restent. Avec Travail fixe, vous réglez les unités de 1 à 2. Le travail restant reste à 24 heures et la durée restante devient 1,5, arrondie à 2 jours ouvrés. La tâche dure maintenant 2 + 2 = 4 jours ouvrés et l'avancement est de 50 %. Le pourcentage suit, car la partie faite reste la même et le reste se raccourcit.

## Conséquences et idées reçues

**« Travail fixe signifie que la durée est fixe. »** Non, c'est tout le contraire. Avec *Durée et unités fixes* et *Durée et travail fixes*, la durée est fixe. Avec *Travail fixe* et *Unités fixes*, la durée suit des deux autres.

**« Si je choisis une règle, mon planning change. »** Non. Le choix ne modifie aucun nombre. Ce n'est qu'à votre prochaine modification que la règle décide ce qui suit. Avec une règle qui protège le travail, l'application fige le travail au moment où vous choisissez, afin qu'il y ait un nombre à protéger. Une telle tâche a alors un *Travail (rest.)* enregistré.

**« La durée a changé sans que je la touche. »** Cela peut arriver après une modification des unités, du travail, du nombre de ressources ou des heures par jour, avec Travail fixe ou Unités fixes. La barre d'état indique alors que le planning est obsolète. Appuyez sur **Calculer** (F5) pour voir les nouvelles dates.

**Sans affectation, une règle de travail ne fait rien.** Il n'y a alors ni unités ni travail à relier à la durée.

**Les fichiers de MS Project ou de Primavera P6 affichent toujours la règle de travail.** Pour une tâche issue de MS Project, le texte *Depuis MS Project : piloté par l'effort* ou *Depuis MS Project : non piloté par l'effort* apparaît parfois sous la règle. Ce réglage enregistré modifie deux cas. Avec *Durée et travail fixes* et piloté par l’effort, le travail suit quand vous modifiez la durée, au lieu des unités. Avec *Unités fixes* et non piloté par l’effort, le travail suit quand vous ajoutez ou retirez une ressource, et la durée reste la même. Les tâches que vous créez dans l'application n'ont pas ce réglage.

## Voir aussi

- [Choisir une règle de travail](docs://howto-werkregel-kiezen) : les étapes pour régler la règle de travail d'une tâche.
- [Affecter des ressources avec une courbe](docs://howto-resource-toewijzen) : affecter une ressource à une tâche, avec des unités et une répartition.
- [Jours et heures](docs://uitleg-dagen-en-uren) : comment l'application convertit les jours et les heures.
- [Calendriers et jours ouvrés](docs://uitleg-kalenders) : comment l'application compte les jours ouvrés et les horaires de travail.
