# Ajustar la estructura

Objetivo: organizar las tareas en fases y subtareas, cambiar su orden y mantener correctos los números WBS.

## Cuándo lo necesita

Su planificación es un árbol: fases (tareas de resumen) con subtareas debajo, como *Foundation* con *Groundwork*, *Reinforcement* y *Pouring*. Usted ajusta ese árbol cuando quiere poner tareas bajo una fase, sacar una tarea de una fase o cuando el orden no es correcto. El **código WBS** (1, 1.1, 1.2, 2, …) es el número de una tarea en ese árbol.

## Pasos

### Aplicar sangría a una tarea

1. Seleccione la tarea. Puede seleccionar varias tareas.
2. Elija *Planificación › Estructura › Aplicar sangría*. También puede usar Alt+→ (o Alt+Shift+→), o *Sangrar* en el menú contextual.

La tarea pasa a ser la última subtarea de la tarea anterior del mismo nivel. Como resultado, esa tarea pasa a ser una tarea de resumen. Si selecciona un bloque continuo, se aplica sangría al bloque entero. Si la tarea no tiene una tarea anterior del mismo nivel, no ocurre nada y no aparece ningún mensaje.

### Anular sangría de una tarea

Elija *Planificación › Estructura › Anular sangría*, pulse Alt+← (o Alt+Shift+←) o elija *Reducir sangría* en el menú contextual.

La tarea pasa a estar al mismo nivel, justo después de la fase a la que pertenecía. Sus propias subtareas van con ella. Las tareas que venían después de ella en esa fase siguen en esa fase. Una tarea del nivel superior no puede anular más la sangría.

### Mover una tarea

Tiene tres formas.

- **Con el teclado.** Alt+↑ y Alt+↓ intercambian la tarea con su vecina del mismo nivel. Una tarea de resumen lleva consigo sus subtareas. En el inicio o el final del nivel no ocurre nada. Con varias tareas seleccionadas, solo se mueve la primera tarea en la que hizo clic.
- **Arrastrar en la tabla de tareas.** Pulse sobre una fila y arrástrela en vertical. El cuarto superior de una fila significa *antes*, y el cuarto inferior, *tras*. El centro de una tarea de resumen pone la tarea debajo de ella como su última subtarea. El centro de una tarea normal cuenta como el borde más cercano. Si arrastra una fila que forma parte de una selección múltiple, se mueve toda la selección.
- **Arrastrar en el Gantt.** Arrastre la barra en vertical hasta otra fila. Funciona igual que arrastrar en la tabla de tareas y no cambia ninguna fecha. Si arrastra en horizontal, desplaza las fechas.

Cada movimiento se puede deshacer por separado con *Deshacer* (Ctrl+Z).

### Mantener actualizados los números WBS

Mire el botón *WBS auto* en *Planificación › Estructura*.

- **Activado (el valor predeterminado en un proyecto nuevo).** La aplicación renumera todo el árbol cada vez que se añade, se borra o se mueve una tarea. El código WBS entonces no se puede editar: no puede escribirlo en la tabla de tareas ni en el panel *Propiedades*. *Renumerar WBS* está desactivado.
- **Desactivado.** Los códigos se quedan como están, también después de mover tareas y aplicar sangría. Usted los escribe, en la columna *WBS* o en el campo *Código WBS* del panel *Propiedades*, o los renumera una vez con *Renumerar WBS*. Eso también sobrescribe los códigos que usted escribió.

Si activa *WBS auto*, la aplicación numera el árbol de inmediato. Tanto *WBS auto* como *Renumerar WBS* se pueden revertir con *Deshacer*.

## Puntos delicados y qué hace la aplicación

**El filtrado, la agrupación o la ordenación están activos.** El orden que ve entonces no es el orden de la planificación, así que la aplicación bloquea la estructura. *Aplicar sangría* y *Anular sangría* están desactivados, con el texto emergente *No disponible mientras se filtra/agrupa/ordena*. Alt+→ y arrastrar muestran el mismo texto en una franja, con el botón *Limpiar*. Eso quita el filtro, la agrupación y la ordenación de una vez, y Ctrl+Z no los devuelve. Entonces *Sangrar* y *Reducir sangría* no aparecen en el menú contextual.

Alt+↑ y Alt+↓ sí funcionan en una vista así, sin mensaje. Con solo un filtro ve el nuevo orden de inmediato. Con una ordenación, el orden de la planificación sí cambia, pero solo lo ve después de *Limpiar*.

**WBS auto está desactivado.** Una tarea nueva recibe el código que corresponde a su lugar en el árbol, aunque otra tarea ya tenga ese código. Así pueden aparecer números duplicados. Después de aplicar sangría, además, los códigos ya no coinciden con el árbol. *Renumerar WBS* corrige las dos cosas.

**Un hito recibe subtareas.** Un hito es un momento y no tiene subtareas. La aplicación quita la marca de hito y se lo indica.

**Una tarea con asignaciones de recursos recibe subtareas.** Una tarea de resumen no lleva asignaciones por sí misma. La aplicación las mueve a la primera subtarea nueva que puede llevarlas, y se lo indica. Si no existe tal subtarea, o si ya tiene el mismo recurso, no ocurre nada y el mensaje indica por qué.

**Una relación crearía un ciclo.** Las relaciones de una tarea de resumen también se aplican a sus subtareas. Si un movimiento crearía un ciclo por ello, la aplicación lo rechaza, con el mensaje *Este movimiento crearía un ciclo en la planificación (…)*. No cambia nada.

**Una relación entre una tarea y su propia fase.** Si pone una tarea bajo una fase con la que ya tiene una relación, esa relación se mantiene, pero ya no cuenta en el cálculo. La aplicación se lo indica. Puede leer más sobre las relaciones de las tareas de resumen en [Relaciones y desfase](docs://uitleg-relaties).

**La planificación ya no está actualizada.** Un movimiento a otra fase puede cambiar fechas. Pulse **Calcular** (F5). Solo cambiar el orden dentro de la misma fase no hace que deje de estar actualizada.

## Véase también

- [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen): coloque las tareas nuevas en el lugar correcto.
- [Guardar e insertar plantillas WBS](docs://howto-wbs-sjablonen): reutilice una fase completa.
- [Añadir relaciones](docs://howto-relaties-leggen): vincule tareas entre sí.
- [Seleccionar, borrar y deshacer tareas](docs://howto-taken-selecteren-verwijderen): revierta un movimiento.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): cuatro fases con sus subtareas, tal como se construyen aplicando sangría.
