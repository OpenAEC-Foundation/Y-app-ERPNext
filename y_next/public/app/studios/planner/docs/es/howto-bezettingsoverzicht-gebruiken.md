# Uso de la vista de ocupación

Objetivo: ver en qué días dos o más proyectos abiertos piden juntos más de lo que la biblioteca de recursos tiene de un mismo recurso.

## Cuándo lo necesita

Su cuadrilla de albañiles trabaja en las fachadas en un proyecto y en los garajes en otro. En cada proyecto la cuadrilla aparece bien planificada, porque el histograma y la sobreasignación de un proyecto solo miran ese proyecto. Solo al poner los proyectos uno al lado de otro se ve que, en los mismos días, entre todos piden más albañiles de los que tiene. La vista de ocupación hace esa comparación por usted.

La vista solo cuenta los recursos que proceden de la biblioteca de recursos, en los proyectos vinculados a la misma biblioteca. Cómo se calcula, lo puede leer en [La biblioteca de recursos](docs://uitleg-resourcebibliotheek).

## Pasos

### 1. Preparar los proyectos

1. Abra los proyectos que quiera comparar, cada uno en su propia pestaña; vea [Trabajar con varios proyectos a la vez](docs://howto-meerdere-projecten). La vista solo ve los proyectos abiertos en esta aplicación.
2. Vincule cada proyecto a la misma biblioteca y use el recurso de la biblioteca en cada proyecto. Sin vínculo con una biblioteca, el panel de recursos no muestra la vista. Vea [Uso de la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken).
3. Calcule los proyectos con *Calcular* (F5), o active *Calcular automáticamente*. Lo que hace la vista con los proyectos desactualizados se describe más abajo, en el apartado de problemas habituales.

### 2. Abrir la vista

1. Vaya a uno de los proyectos y elija *Recursos › Gestionar › Recursos*.
2. Arriba a la derecha, elija *Ocupación*. La vista pertenece a la biblioteca del proyecto en el que se encuentra. No puede cambiar nada en este panel: es una ventana de solo lectura.

### 3. Leer la tabla

Cada recurso de la biblioteca que está reservado en al menos un proyecto abierto recibe una fila. Los recursos sin reserva no aparecen. Las filas con más días con sobreasignación van arriba; después, en orden alfabético.

- *Documentos* indica en cuántos proyectos está reservado el recurso, por ejemplo *2 documentos*.
- *Período* va del primer al último día con carga, escrito como aaaa-mm-dd, por ejemplo *2027-06-07 – 2027-06-14*.
- *Pico / Capacidad* compara la carga diaria más alta de todos los proyectos juntos con la capacidad del recurso en la biblioteca, por ejemplo *4,0 / 3,0*. Si hay al menos un día con sobreasignación, se muestra en rojo.
- Una marca roja después de la fila, por ejemplo *3 días con sobreasignación*, cuenta los días en que la suma es mayor que la capacidad. Si sitúa el ratón encima, ve las fechas.

### 4. Ver por proyecto

1. Haga clic en la pequeña flecha delante del nombre de un recurso. La fila se abre.
2. Arriba están las fechas con sobreasignación: las cinco primeras y después *… y 3 más* si hay más. Debajo aparece, por proyecto, el nombre con el período y el pico de ese proyecto por separado, por ejemplo *Houses North 2027-06-07 – 2027-06-11 Pico: 2,0*.
3. Haga clic en la propia fila para ver un histograma abajo. Cada proyecto tiene su propio color y las barras están apiladas. La línea discontinua es la capacidad de la biblioteca. Si cambia con el tiempo, ve escalones. Los días con sobreasignación tienen una franja roja detrás de las barras. Haga clic otra vez en la fila para cerrar el histograma. Sin fila elegida, aparece *Selecciona un recurso para ver el histograma.*

### 5. Resolver el problema

La vista muestra el problema, pero no lo resuelve. Tiene dos opciones:

- Mueva una tarea en uno de los proyectos, o asígnele menos unidades por día. Después recalcule ese proyecto con F5.
- Si de verdad se incorpora alguien, aumente *Unidades máx* del recurso en la biblioteca. Lo hace en *Recursos › Gestionar › Recursos*, vista *Biblioteca*.

*Nivelar…* en la cinta no ayuda aquí: mira los recursos del único proyecto en el que se encuentra; vea [Nivelación de recursos](docs://uitleg-nivelleren).

## Problemas habituales y qué hace la aplicación entonces

**La vista está vacía.** Dice *No hay recursos de la biblioteca reservados en los documentos abiertos.* Entonces ningún proyecto abierto tiene un recurso de la biblioteca asignado a una tarea.

**No ve el botón *Ocupación*.** El proyecto en el que se encuentra no está vinculado a una biblioteca.

**Un proyecto no se cuenta.** No está abierto en esta aplicación, está vinculado a otra biblioteca de recursos, o el recurso que contiene es un recurso propio de ese proyecto. En la parte inferior de la vista siempre aparece *Esta vista solo ve los documentos abiertos en esta aplicación.* Una copia de un recurso que se ha quitado de la biblioteca después tampoco se cuenta.

**Una copia o variante cuenta por completo.** Cuenta cada proyecto abierto que está vinculado a la biblioteca de recursos, también si es una copia o una variante de otro proyecto abierto; por ejemplo, una variante que creó un asistente de IA con `planner_duplicate_document`. El original y la variante juntos pueden entonces mostrar una sobreasignación que en realidad existe una sola vez. La vista no filtra eso en silencio: cierre la variante un momento, o tenga en cuenta ese caso al leerla.

**Un proyecto está desactualizado.** Un proyecto está desactualizado si cambió algo en la planificación sin recalcular. La vista trata entonces ese proyecto así:

- Para un proyecto que no es la pestaña activa, la vista calcula por adelantado por sí misma, sin cambiar el proyecto. Encima de la tabla aparece entonces *Los documentos modificados se han calculado por adelantado para esta vista; pulsa F5 en el documento, o activa “Calcular automáticamente” para hacerlo de forma permanente.* Debajo del proyecto aparece *Calculado por adelantado para esta vista — el propio documento sigue mostrando fechas antiguas hasta que pulses F5 en él o actives “Calcular automáticamente”.* Si *Calcular automáticamente* está activado (*Configuración › Proyecto › Configuración*, pestaña *Planificación*), la aplicación sí recalcula esos proyectos en cuanto usted mira la vista, y el mensaje desaparece. Si también el proyecto activo está desactualizado, encima de la tabla aparece solo el mensaje del siguiente punto.
- La vista no calcula por sí misma el proyecto en el que se encuentra. Si ese proyecto está desactualizado, aparece *Un documento modificado aún no se ha recalculado; aquí se incluye con sus últimas cifras calculadas. Pulsa F5 en ese documento, o activa “Calcular automáticamente”.* y, después del proyecto, *Desactualizado: estas son las últimas cifras calculadas — pulsa F5 en este documento.* Tenga cuidado: *últimas cifras calculadas* no es del todo correcto. La vista toma las fechas de inicio antiguas, pero ya una duración o una asignación modificada. Por eso las cifras pueden diferir tanto de la planificación anterior como de la nueva, y de las barras del Gantt. Solo confíe en ellas después de pulsar F5.
- Si la vista no puede calcular un proyecto, por ejemplo por un bucle en sus relaciones, ese proyecto no se cuenta. Sigue apareciendo en la lista, con *No se cuenta: planificación sin calcular — activa este documento y pulsa F5.* y, encima de la tabla, *Al menos un documento no se ha calculado y no se incluye en la ocupación.*

**La vista no coincide con lo que espera.** La capacidad viene de la biblioteca de recursos (*Unidades máx* del elemento de la biblioteca, o su *Capacidad escalonada en el tiempo* ese día), no de *Unidades máx* de la copia en el proyecto. Una suma igual a la capacidad no es un conflicto.

## Véase también

- [La biblioteca de recursos](docs://uitleg-resourcebibliotheek): cómo se cuenta la ocupación, con un ejemplo práctico.
- [Uso de la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): vincular proyectos y asignar recursos.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): sobreasignación dentro de un proyecto.
