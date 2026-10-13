# La bibliothèque de ressources

Votre équipe de maçons ne travaille pas pour un seul projet. Aujourd'hui elle est sur les maisons du nord, demain sur les garages du sud. Une bibliothèque de ressources est l'endroit où vous enregistrez une fois une telle équipe, afin que chaque projet utilise la même équipe. L'application peut alors aussi voir quand deux projets demandent les mêmes personnes le même jour, ce qu'aucun projet seul ne peut voir. Dans cet article, vous lisez comment la bibliothèque et le projet sont liés et comment l'application compte l'occupation sur plusieurs projets.

## Le concept

Il existe deux niveaux.

La **bibliothèque de ressources** est la liste des ressources et des calendriers qui appartiennent à votre organisation : un maçon, une grue, un plâtrier, avec leur type, leur tarif et leur nombre disponible. La liste elle-même, que l'application appelle aussi le **pool**, ne se trouve pas dans vos fichiers de projet mais dans l'application : dans l'application de bureau, dans un fichier sur cet ordinateur ; dans le navigateur, dans le stockage de ce navigateur. Si vous effacez les données du site dans le navigateur, la bibliothèque disparaît ; exportez-la donc comme sauvegarde. Il existe toujours au moins une bibliothèque. La première s'appelle *Mijn resourcebibliotheek* (un nom néerlandais), et vous pouvez la renommer.

Le **projet** décide de la quantité d'une ressource qu'il utilise et du moment. Un projet est lié à une bibliothèque ou reste autonome. Un projet autonome fonctionne très bien, simplement sans liste partagée.

Un projet ne pointe pas vers la bibliothèque, mais conserve une **copie**. Quand vous affectez *Bricklayer* de la bibliothèque à un projet, l'application crée une copie dans le projet avec une **marque d'origine** : la note indiquant que cette copie vient de la bibliothèque X et qu'elle correspond à l'élément Y. Dans le tableau des ressources, vous reconnaissez une telle copie à une petite icône de bibliothèque. La copie est une ressource ordinaire : des tâches peuvent lui être affectées, et elle est enregistrée dans le fichier de projet lui-même.

Les calendriers de la bibliothèque de ressources sont autre chose que la liste de calendriers de votre projet, que vous gérez dans la boîte de dialogue des calendriers. Un calendrier de la bibliothèque entre dans votre projet avec une ressource qui l'utilise.

## Comment l'application fonctionne avec elle

### Ce que la bibliothèque décide et ce que le projet décide

La bibliothèque décide **ce qu'est une ressource** : le nom, le type, le tarif horaire, l'unité et la description. Dans une copie de projet, ces champs apparaissent en texte simple. Vous les modifiez dans la bibliothèque, pour qu'ils soient corrects dans chaque projet. Si vous voulez qu'une copie suive finalement sa propre voie, vous la détachez de la bibliothèque.

Le projet décide **combien et quand** : *Unités max*, la capacité qui change dans le temps (*Capacité échelonnée dans le temps*) et le calendrier de la ressource. Ces champs restent modifiables dans le projet et ne comptent pas comme écart par rapport à la bibliothèque. Une même équipe peut en effet suivre un autre calendrier sur un chantier urgent que sur un projet normal. Le contenu d'un calendrier venu avec une ressource suit en revanche la bibliothèque.

### Quand une copie suit

La bibliothèque ne met pas les copies à jour en permanence, mais à des moments fixes :

- Quand vous modifiez quelque chose dans la bibliothèque, les copies non modifiées dans tous les projets ouverts suivent immédiatement.
- Quand vous ouvrez un projet ou passez à un autre onglet, l'application compare les copies à la bibliothèque. Si une copie non modifiée est en retard, l'application la met à jour sans rien demander et le signale brièvement : *1 élément mis à jour depuis la bibliothèque* ou *N éléments mis à jour depuis la bibliothèque*.

L'application garde en mémoire les valeurs du moment où la copie a été créée ou mise à jour. Si une copie diffère maintenant de ces valeurs, l'application ne décide pas qui a raison. La copie reçoit alors la marque *diffère — à décider*. Quand vous ouvrez un fichier contenant une telle copie, la fenêtre *Lier la bibliothèque de ressources* s'ouvre d'elle-même. Vous y choisissez, élément par élément, si les valeurs de la bibliothèque s'appliquent, ou si les valeurs de votre fichier passent dans la bibliothèque. Quand vous changez d'onglet, aucune fenêtre n'apparaît jamais.

Un écart apparaît, par exemple, quand vous liez une ressource propre au projet à un élément de la bibliothèque portant le même nom mais des valeurs différentes, avec *Vers la bibliothèque*. L'application les lie bien, et marque la copie comme divergente immédiatement.

### Quand une ressource disparaît de la bibliothèque

Si vous supprimez une ressource de la bibliothèque, la copie reste dans vos projets et continue de fonctionner. Elle reçoit la marque *n'est plus dans la bibliothèque*, et vous pouvez alors la modifier entièrement ou la retirer du projet.

### Occupation sur plusieurs projets

L'histogramme et la surallocation dans un projet ne regardent que ce seul projet. La bibliothèque en sait davantage : combien il existe de cette ressource au total. La vue *Occupation* additionne, par jour, la charge de tous les projets ouverts liés à la même bibliothèque et qui utilisent une copie de cette ressource. Si la somme d'un jour est supérieure à la capacité de la bibliothèque, ce jour est compté comme réservé en double.

Trois règles déterminent ce qui compte :

- La capacité vient de la bibliothèque (*Unités max* de l'élément de la bibliothèque, ou sa *Capacité échelonnée dans le temps* ce jour-là), et non des *Unités max* de la copie du projet. Deux projets qui restent chacun dans leur propre affectation peuvent donc quand même demander trop ensemble.
- Une somme exactement égale à la capacité n'est pas un conflit. Il faut demander davantage que la capacité.
- Seules les copies portant une marque d'origine comptent, et seulement dans les projets ouverts dans cette application à ce moment-là. Une ressource propre à un seul projet ne figure pas dans la bibliothèque et ne compte donc pas. L'aperçu ne voit pas les documents qui ne sont pas ouverts dans cette application ; cela est aussi indiqué au bas de l'aperçu lui-même.

## Exemple détaillé : l'équipe de maçons dans deux projets

La bibliothèque de ressources contient la ressource *Bricklayer* avec *Unités max* 3 : trois maçons sur la feuille de paie. Deux projets l'utilisent, chacun avec une copie qui a *Unités max* 2.

- *Houses North* a la tâche *Bricklaying facades* de 5 jours ouvrés à partir du lundi 7 juin 2027, avec 2 unités par jour. La tâche court du 7 au 11 juin inclus.
- *Garages South* a la tâche *Bricklaying garages* de 4 jours ouvrés à partir du mercredi 9 juin 2027, avec 2 unités par jour. Le week-end ne compte pas ; la tâche couvre donc les 9, 10, 11 et 14 juin.

Dans chaque projet, on demande au *Bricklayer* 2 de ses 2 unités. Aucun des deux projets ne signale de surallocation : sous *Ressources › Surallocation*, les deux affichent *Aucune*. Pourtant, ensemble, ils dépassent les 3 maçons. Par jour, l'application compte :

- Lundi 7 et mardi 8 juin : 2 (seulement Houses North)
- Mercredi 9, jeudi 10 et vendredi 11 juin : 2 + 2 = 4
- Lundi 14 juin : 2 (seulement Garages South)

Le pic est de 4 pour une capacité de 3. L'aperçu affiche le *Bricklayer* avec *2 documents*, la période *2027-06-07 – 2027-06-14*, *4.0 / 3.0* pour le pic et la capacité, et *3 jours réservés en double* : les 9, 10 et 11 juin.

Que se passe-t-il si vous modifiez quelque chose :

- Si *Bricklaying facades* prend 6 jours ouvrés, la tâche dure jusqu'au lundi 14 juin. Ce jour atteint aussi 2 + 2 = 4 ; l'aperçu affiche donc *4 jours réservés en double* : les 9, 10, 11 et 14 juin. Le pic reste à 4.
- Si la bibliothèque a *Unités max* 4, l'aperçu affiche *4.0 / 4.0* et il n'y a pas de conflit, car la somme n'est pas supérieure à la capacité.
- Si *Garages South* travaille avec 1 unité par jour au lieu de 2, le pic est de 3 et l'aperçu affiche *3.0 / 3.0* : pas de conflit.
- Si *Garages South* ne commence que le lundi 14 juin, les projets ne se chevauchent pas. La période devient *2027-06-07 – 2027-06-17* et le pic est de *2.0 / 3.0*.

Les étapes pour consulter cela dans vos propres projets se trouvent dans [Utiliser l'aperçu d'occupation](docs://howto-bezettingsoverzicht-gebruiken).

## Conséquences et idées reçues

**« La bibliothèque est partagée avec mes collègues. »** Non. La bibliothèque vit dans l'application (dans l'application de bureau, dans un fichier sur cet ordinateur ; dans le navigateur, dans le stockage de ce navigateur) et n'est pas synchronisée. Si deux planificateurs travaillent avec la même bibliothèque de ressources, leurs bibliothèques peuvent diverger. Vous pouvez partager en exportant et en important, voir [Gérer et partager les bibliothèques de ressources](docs://howto-bibliotheken-beheren). Si votre organisation partage des équipes entre plusieurs filiales, choisissez délibérément une bibliothèque commune. L'aperçu ne voit aussi que les projets ouverts dans cette application.

**« Si je modifie la bibliothèque, tout change dans mes projets. »** Seulement l'identité de la ressource : nom, type, tarif, unité et description. *Unités max*, la capacité dans le temps et le choix du calendrier d'un projet restent tels quels.

**« Je peux annuler une modification de la bibliothèque. »** Non. La bibliothèque appartient à l'application et non à un projet ; les modifications qu'on y apporte échappent donc à *Annuler* (Ctrl+Z). La vue *Bibliothèque* l'indique elle-même : *Ceci modifie la bibliothèque et s'applique à tous les projets — hors annulation*. La suppression dans la bibliothèque demande aussi une confirmation et ne peut pas être annulée.

**« L'aperçu d'occupation résout la double réservation. »** Non, l'aperçu est seulement une fenêtre en lecture seule. Il montre les jours où deux projets demandent ensemble trop. Le nivellement (*Ressources › Nivellement › Niveler…*, voir [Nivellement des ressources](docs://uitleg-nivelleren)) examine les ressources d'un seul projet et ne tient pas compte des autres projets. Déplacez vous-même une tâche dans l'un des projets, ou modifiez la capacité dans la bibliothèque si quelqu'un rejoint réellement l'équipe.

**« Ma propre ressource compte dans l'occupation. »** Seulement si elle figure dans la bibliothèque. Une ressource que vous avez seulement créée dans le projet, comme une grue louée pour un seul chantier, n'a pas de marque d'origine et n'apparaît donc pas dans l'aperçu. Avec *Vers la bibliothèque*, vous l'ajoutez.

## Voir aussi

- [Utiliser la bibliothèque de ressources](docs://howto-resourcebibliotheek-gebruiken) : lier, affecter des ressources et résoudre les écarts.
- [Gérer et partager les bibliothèques de ressources](docs://howto-bibliotheken-beheren) : créer, exporter et importer des bibliothèques.
- [Utiliser l'aperçu d'occupation](docs://howto-bezettingsoverzicht-gebruiken) : trouver les doubles réservations entre projets.
- [Gérer les ressources](docs://howto-resources-beheren) : les ressources d'un seul projet.
