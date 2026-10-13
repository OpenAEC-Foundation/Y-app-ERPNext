# Seleccionar, eliminar y deshacer tareas

Objetivo: elegir tareas, quitarlas y revertir un error.

## Cuándo lo necesita

Casi todas las acciones de la planificación actúan sobre las tareas que ha seleccionado: eliminar, copiar, aplicar sangría, activar o desactivar el hito. Quite tareas cuando el trabajo deja de ser necesario o cuando se revisa la planificación. Y como la aplicación no pide confirmación al eliminar, *Deshacer* es su red de seguridad.

## Pasos

### Seleccionar tareas

- **Una tarea.** Haga clic en la fila de la tabla de tareas o en la barra del diagrama de Gantt.
- **Varias tareas.** Ctrl+clic (⌘+clic en un Mac) añade una tarea a la selección o la quita. En la tabla de tareas, Mayús+clic selecciona todas las tareas desde la tarea activa hasta la que hizo clic.
- **Todas las tareas visibles.** Ctrl+A, con el foco en la tabla de tareas o en el diagrama de Gantt. Las tareas que oculta un filtro quedan fuera, y también las subtareas de una fase contraída.
- **Un recuadro en el diagrama de Gantt.** Mantenga pulsado Ctrl y arrastre sobre el fondo vacío: se seleccionan todas las tareas de las filas que toca el recuadro, aunque su barra quede al lado. Solo cuenta la altura del recuadro, no el eje de tiempo. Si suelta Ctrl solo después del botón del ratón, las tareas se añaden a la selección existente; si no, la sustituyen. Sin Ctrl, ese arrastre desplaza la línea de tiempo con el ajuste predeterminado.
- **Ninguna.** Pulse Esc o haga clic en el fondo vacío del diagrama de Gantt.

Si selecciona una tarea de resumen, sus subtareas no se seleccionan con ella. Al eliminar y copiar sí se incluyen.

### Eliminar tareas

Seleccione las tareas y elija una de estas opciones:

- *Inicio › Editar › Eliminar*. El mismo botón está en la pestaña *Tabla*.
- Supr o Retroceso, si el foco no está en la tabla de tareas. Por eso, haga clic antes en una barra del diagrama de Gantt.
- *Eliminar* en el menú contextual. Si la tarea en la que hizo clic forma parte de la selección, la acción afecta a toda la selección; si no, solo afecta a esa tarea.
- La pequeña papelera en la parte superior del panel *Propiedades* (texto de ayuda *Eliminar tarea*). Elimina la tarea que muestra el panel.

La aplicación no pide confirmación. Si elimina varias tareas a la vez, es un solo paso para *Deshacer*.

Con ellas desaparecen: todas las subtareas de una tarea de resumen eliminada, todas las relaciones desde y hacia las tareas eliminadas, y sus asignaciones de recursos. Si elimina la última subtarea de una tarea de resumen, esta permanece como tarea normal. Si *WBS auto* está activado, la aplicación vuelve a numerar el árbol. Después, la planificación no está actualizada: pulse **Calcular** (F5), salvo que *Calcular automáticamente* esté activado.

### Contraer y expandir

Una tarea de resumen tiene un triángulo delante de su nombre en la tabla de tareas. Haga clic en él para ocultar o mostrar sus subtareas. Con *Vista › Esquema › Contraer* y *Expandir*, lo hace para las tareas de resumen seleccionadas, o para todas si no hay ninguna seleccionada. El menú contextual de una tarea de resumen también tiene *Contraer* y *Expandir*. En una vista agrupada, los botones actúan sobre los grupos.

La aplicación guarda si las tareas están contraídas o expandidas por cada documento abierto. Esto no forma parte de *Deshacer* y no está en el archivo del proyecto.

### Deshacer y rehacer

- *Inicio › Editar › Deshacer* y *Rehacer* (también en la pestaña *Tabla*), las flechas de la barra de título, o Ctrl+Z para deshacer y Ctrl+Y o Ctrl+Mayús+Z para rehacer.
- Si hace algo nuevo después de *Deshacer*, *Rehacer* ya no está disponible.

*Deshacer* abarca los cambios en los datos del proyecto (tareas, relaciones, recursos, calendarios y similares) y la aplicación de un diseño. Los cambios en las columnas de la tabla de tareas también son pasos: añadir, quitar, mover, cambiar el tamaño, ajustar automáticamente, fijar y restablecer el diseño de las columnas al predeterminado. Esos pasos de columna pertenecen a la propia tabla de tareas y se aplican a toda la aplicación, no a un solo documento. La aplicación guarda los últimos cien pasos por documento, menos en un proyecto muy grande.

## Errores frecuentes y lo que hace la aplicación

**Supr en la tabla de tareas no elimina una tarea.** Si el foco está en la tabla de tareas, Supr (o Retroceso) borra el contenido de las celdas seleccionadas. En una celda obligatoria o calculada, como el nombre o la duración, la aplicación lo rechaza y muestra un mensaje debajo de la tabla de tareas. Para el nombre, por ejemplo, aparece *Este valor es obligatorio y no puede quedar vacío.* Entonces no se borra nada, ni siquiera en otras celdas seleccionadas. Haga clic en una barra del diagrama de Gantt o use *Eliminar* (en la pestaña *Tabla*, donde no hay diagrama de Gantt: *Tabla › Editar › Eliminar* o el menú contextual).

**Una fase entera se elimina de una vez.** Si elimina una tarea de resumen, se eliminan también sus subtareas, sus relaciones y sus asignaciones. *Deshacer* (Ctrl+Z) lo restaura todo, también las relaciones y las asignaciones.

**Lo que no se recupera.** La selección, contraer y expandir, y el botón *Borrar* de la franja *No disponible mientras se filtra/agrupa/ordena* no forman parte de *Deshacer*. Si pulsa Ctrl+Z después de *Borrar*, deshace su paso anterior, no el borrado.

**Quitar una tarea de la que dependen otras.** También desaparecen las relaciones desde y hacia esa tarea. Las tareas que solo estaban unidas a ella quedan sueltas y, tras **Calcular**, vuelven a empezar en su propia fecha de inicio planificada. Si hace falta, añada nuevas relaciones; véase [Añadir relaciones](docs://howto-relaties-leggen).

## Véase también

- [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen): lo contrario, y copiar tareas.
- [Ajustar la estructura](docs://howto-structuur-aanpassen): colocar una tarea bajo otra fase en lugar de quitarla.
- [Arrastrar, desplazar y ampliar o reducir en el diagrama de Gantt](docs://howto-gantt-bedienen): el recuadro de selección y los modos de desplazamiento.
- [Menús contextuales](docs://ref-contextmenus): qué hacen *Eliminar* y los demás elementos con una selección.
