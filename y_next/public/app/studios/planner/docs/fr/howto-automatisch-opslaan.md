# Activer l’enregistrement automatique

But : que l’application mette à jour le fichier de votre projet pendant que vous travaillez. Ainsi, vous n’avez pas besoin d’appuyer sans cesse sur Ctrl+S.

## Quand vous en avez besoin

Vous travaillez longtemps sur un même planning, ou vous oubliez souvent d’enregistrer. Vous voulez que le fichier sur le disque ou dans un dossier partagé suive vos modifications. L’enregistrement automatique ne remplace pas la récupération : celle-ci est toujours active et fonctionne séparément. Vous lisez la différence dans [Fichiers et formats](docs://uitleg-bestanden).

## Étapes

1. Si le projet n’a pas encore de fichier, enregistrez-le d’abord une fois avec *Accueil › Fichier › Enregistrer sous*. Tant qu’il n’y a pas de fichier, le commutateur est gris et l’info-bulle indique : *Enregistrez d’abord ce projet pour utiliser l’enregistrement automatique.*
2. En haut à gauche, dans la barre supérieure, cliquez sur le commutateur *Enregistrement automatique*. Quand il est actif, l’info-bulle indique : *L’enregistrement automatique est actif : les modifications sont écrites dans ce fichier.*
3. Continuez à travailler. Dès que votre projet contient des modifications, l’application les écrit dans votre fichier, sans boîte de dialogue, au plus une fois toutes les dix secondes. Le repère *Non enregistré* disparaît alors tout seul.
4. Pour arrêter, cliquez encore une fois sur le commutateur. L’info-bulle indique alors : *L’enregistrement automatique est désactivé. La récupération reste active.*

Chrome et Edge vous permettent d’abord seulement de lire un fichier que vous avez ouvert. Le commutateur ne fait rien tant que vous n’avez pas enregistré une fois avec *Enregistrer* (Ctrl+S) et que le navigateur a donné l’autorisation d’écrire. Ensuite, vous pouvez l’activer. Dans Firefox, le commutateur reste gris : l’application ne peut pas écrire dans votre fichier.

## Pièges et ce que fait l’application dans ce cas

**Le commutateur appartient à un seul projet.** Chaque onglet a son propre état. Après l’ouverture d’un projet, il est toujours désactivé, et l’application ne le retient pas pour la prochaine fois.

**L’enregistrement automatique écrit seulement dans le fichier déjà lié au projet.** Si vous choisissez *Enregistrer sous*, il écrit à partir de ce moment dans le nouveau fichier. L’application écrit seulement s’il y a des modifications.

**L’écriture peut échouer.** Si le fichier a disparu ou est verrouillé, par exemple, le message *Échec de l'enregistrement automatique* apparaît avec la raison. Si le navigateur n’a pas (ou plus) l’autorisation d’écrire, l’application ignore cette écriture sans message. Elle ne demande pas l’autorisation.

**Le fichier reçoit aussi des modifications que vous ne voulez pas garder.** L’enregistrement automatique écrit l’état du projet tel qu’il est à ce moment. Si vous annulez quelque chose avec Ctrl+Z, le fichier reçoit aussi cet état annulé dans les dix secondes. Si vous voulez garder une version plus ancienne, faites d’abord une copie avec *Enregistrer sous*.

**Un plantage fait toujours perdre les dernières secondes.** L’application écrit au plus une fois toutes les dix secondes. Ce qui a été fait entre-temps n’est donc pas encore dans votre fichier. La récupération a la même limite.

**Après une récupération dans le navigateur, le commutateur est de nouveau gris.** Un projet récupéré dans le navigateur après un plantage n’est plus lié à son fichier. Enregistrez-le une fois, et le commutateur fonctionne de nouveau. Voir [Récupérer après un plantage](docs://howto-herstellen-na-een-crash).

**Un projet d’un autre format n’a pas de fichier.** Un fichier CSV, XML, `.mpp` ou `.xer` reçoit seulement un fichier IFC quand vous enregistrez. Ensuite, vous pouvez activer l’enregistrement automatique.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : la différence entre enregistrer, l’enregistrement automatique et la récupération.
- [Ouvrir et enregistrer un fichier](docs://howto-bestand-openen-en-opslaan) : enregistrer, enregistrer sous et le repère *Non enregistré*.
- [Récupérer après un plantage](docs://howto-herstellen-na-een-crash) : ce que l’application propose si elle ne s’est pas fermée correctement.
