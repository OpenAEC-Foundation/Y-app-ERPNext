# Ouvrir un fichier MS Project (.mpp)

Objectif : ouvrir un planning de Microsoft Project directement dans l'application, sans l'exporter au préalable.

## Quand en avez-vous besoin

Un entrepreneur, un consultant ou un client vous envoie son planning sous forme de fichier `.mpp`. Vous voulez le consulter, le calculer ou le développer davantage. L'application lit les fichiers `.mpp` de MS Project 2010 jusqu'à 2021 inclus. Elle lit seulement : elle n'écrit jamais de `.mpp` et ne modifie jamais votre fichier. Du fichier, elle reprend le planning proprement dit : tâches avec structure, durée et contraintes, relations avec décalage, calendriers, ressources, affectations et avancement. Elle lit aussi les dates et les marges que MS Project a calculées lui-même, mais elle les utilise seulement pour la vue *Dates telles qu'enregistrées*, jamais comme donnée d'entrée.

## Étapes

1. Choisissez *Accueil › Fichier › Ouvrir* ou appuyez sur Ctrl+O. Choisissez le fichier `.mpp`.
2. Le projet s'ouvre dans un nouvel onglet, ou dans l'onglet actuel s'il était encore vide et non modifié. Le projet n'a pas de fichier : *Enregistrer* écrit plus tard un nouveau fichier IFC.
3. Lisez le message en bas : *Ce projet calcule comme Microsoft Project. Modifiable via Fichier → Info projet → Profil de calcul et options*. L'application calcule ce projet avec les règles de calcul de MS Project : le profil de calcul *Microsoft Project*. Avec *Ouvrir le profil de calcul*, vous accédez au réglage ; *En savoir plus* ouvre l'aide sur les profils de calcul.
4. Regardez s'il y a un bandeau sous le ruban : *Vous consultez les dates telles qu'enregistrées dans le fichier ; un recalcul déplacerait 4 tâches*. Sur ces tâches, le résultat de l'application diffère alors des dates enregistrées par MS Project. Sous le message de l'étape 3, une ligne apparaît alors aussi : *4 tâches affichent les dates telles qu'enregistrées dans le fichier (non recalculées)*. Ce que cela signifie et comment passer au calcul propre à l'application se trouve dans [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen).
5. Si l'application affiche *Ce fichier contient une planification horaire* avec le bouton *Activer la planification horaire*, le fichier contient des données en heures. Voir [Activer la planification horaire](docs://howto-urenplanning-aanzetten).

Si le fichier contient des tâches avec fractionnement, nivellement ou planning piloté par les ressources, un autre message s'ajoute, par exemple *Ce fichier MS Project contient 3 tâches à la planification fractionnée, lissée ou pilotée par les ressources. Elles sont importées et affichées telles quelles*. Pour une seule tâche, le message est au singulier.

## Pièges et ce que fait alors l'application

**Tout n'est pas repris.** L'application ne reprend pas les références, les coûts et tarifs, les notes ni les champs personnalisés de MS Project. Un code WBS que vous avez saisi vous-même dans MS Project est repris ; sinon, l'application numérote les tâches selon la structure.

**Un fichier de MS Project 2007 ou plus ancien.** L'application le refuse et affiche : *Ce fichier .mpp utilise un ancien format (Project 2007 ou antérieur). Exportez-le depuis MS Project au format XML (Fichier → Enregistrer sous → XML) et ouvrez ce fichier*. Sous le message, l'application ajoute une raison technique en anglais.

**Un fichier protégé par un mot de passe.** L'application affiche : *Ce fichier .mpp est protégé par un mot de passe. Exportez-le depuis MS Project au format XML (Fichier → Enregistrer sous → XML) et ouvrez ce fichier*. Là aussi, le message s'accompagne d'une raison technique en anglais.

**Un fichier qui n'est pas un `.mpp`.** Vous obtenez *Échec de l'ouverture du fichier*, avec une raison technique.

**La voie XML calcule autrement.** Si vous ouvrez l'export XML de MS Project au lieu du `.mpp`, l'application calcule avec le profil de calcul *Open Planner Studio*. Vous ne voyez alors pas le message au sujet de *Microsoft Project*. Les dates peuvent alors différer de celles obtenues avec le fichier `.mpp`.

**Une modification fait perdre le pilotage de MS Project.** Si vous modifiez une tâche dont le planning était piloté par la fenêtre de dates de MS Project, l'application affiche une fois par projet : *La répartition horaire de MS Project ne pilote plus 2 tâches après cette modification ; la répartition d'origine reste conservée dans le fichier*. Pour une seule tâche, le message est au singulier.

**L'enregistrement n'écrase jamais votre `.mpp`.** Le projet n'a pas de fichier. *Enregistrer* demande où enregistrer le nouveau fichier IFC.

## Voir aussi

- [Fichiers et formats](docs://uitleg-bestanden) : pourquoi un `.mpp` est seulement lu et ce que l'enregistrement écrit.
- [Dates telles qu'enregistrées](docs://uitleg-datums-zoals-opgeslagen) : la vue des dates propres à MS Project.
- [Activer la planification horaire](docs://howto-urenplanning-aanzetten) : si le fichier contient des données en heures.
- [Ouvrir un fichier Primavera P6 (.xer)](docs://howto-xer-openen) : la même chose pour Primavera.
- [Formats d'import et d'export](docs://ref-import-exportformaten) : par format, ce qui est repris et ce qui ne l'est pas.
- [Profils de calcul et conventions](docs://uitleg-rekenprofielen) : pourquoi un fichier MS Project s'ouvre avec son propre profil de calcul.
