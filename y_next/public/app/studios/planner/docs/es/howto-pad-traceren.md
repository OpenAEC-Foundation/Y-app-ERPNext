# Trazar una ruta

Objetivo: hacer visible la cadena de tareas anteriores o posteriores a una tarea, para que vea qué fija la fecha de una tarea y qué se desplaza si esta se retrasa.

## Cuándo lo necesita

La cubierta no empieza hasta dentro de tres semanas y quiere saber qué tarea lo determina. O bien, el albañil se retrasa una semana y quiere ver qué tareas posteriores se desplazan. En una planificación con decenas de relaciones no se ve eso en las líneas. Con **trazado de ruta**, la aplicación colorea todos los **predecesores** (tareas que van antes de la tarea elegida, directamente o a través de otras tareas) y todos los **sucesores** (tareas que van después de ella), y atenúa el resto.

## Pasos

1. Seleccione la tarea cuya ruta quiere ver, en la tabla de tareas o en su barra del Gantt. Si selecciona varias tareas, la aplicación traza la ruta desde la tarea que seleccionó primero.
2. Elija *Planificación › Trazado de ruta › Predecesoras* para todo lo que va antes de la tarea, o *Planificación › Trazado de ruta › Sucesoras* para todo lo que va después de ella. Los dos botones pueden estar activos a la vez. Los mismos dos botones están en la pestaña *Tabla*, en el grupo *Trazado de ruta*.
3. Si quiere las dos direcciones a la vez, haga clic con el botón derecho en la tarea, en el Gantt o en la tabla de tareas, y elija *Trazar ruta*.
4. Mire el resultado en el Gantt y en la tabla de tareas. Abajo se explica cómo leerlo.
5. Para detenerlo, pulse de nuevo el botón activo, haga clic con el botón derecho en una tarea y elija *Detener trazado de ruta*, o pulse Esc. Esc también borra la selección.

Si selecciona otra tarea mientras traza, la ruta sigue la nueva selección.

## Cómo leer el resultado

- Los predecesores son dorados y los sucesores, morados. En el Gantt cambian de color las barras; en la tabla de tareas aparece una franja a la izquierda de la fila: continua para los predecesores y discontinua para los sucesores. La tarea elegida tiene un contorno.
- Un color más oscuro, en la tabla de tareas una franja más gruesa con texto en negrita, marca la cadena de **relaciones determinantes**: las relaciones que de verdad fijan las fechas. Lo que significa se explica en [Relaciones y desfase](docs://uitleg-relaties).
- Todas las tareas fuera de la ruta se atenúan. Las líneas de relación que no pertenecen a la ruta son más tenues y punteadas.

## Problemas posibles y qué hace la aplicación

**Ninguna tarea seleccionada.** Sin tarea seleccionada no hay nada que trazar: el botón está activo, pero en pantalla no cambia nada. Seleccione primero una tarea.

**Sin énfasis en la cadena de relaciones determinantes.** El énfasis procede del último cálculo. Si la planificación todavía no se ha calculado, o el cálculo da un error, la aplicación tiñe todos los predecesores y sucesores con la misma intensidad. Pulse *Calcular* (F5), por ejemplo en *Inicio › Programación › Calcular*, y mire la ruta otra vez. Después de un cambio, el énfasis se mantiene con el cálculo anterior mientras la barra de estado muestre *Desactualizado — recalcula (F5)*.

**Una relación en una fase.** El trazado sigue las relaciones tal como las ha colocado. Una relación desde o hacia una fase (tarea de resumen) une la propia fase. Para el cálculo se aplica a cada tarea de esa fase, pero la ruta no sigue hacia las tareas que contiene. Si traza una tarea dentro de una fase, y la propia fase tiene una relación con otra tarea, no verá esa relación. En ese caso, seleccione la propia fase.

**Solo la dirección elegida.** Si solo está activa *Predecesoras*, no ve lo que va después de la tarea, y viceversa.

## Véase también

- [Relaciones y desfase](docs://uitleg-relaties): por qué una relación es determinante y cómo calcula la aplicación la fecha de inicio de una tarea.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué cadena decide el final del proyecto.
- [Añadir relaciones](docs://howto-relaties-leggen): cómo añadir una relación si le falta una conexión en la ruta.
