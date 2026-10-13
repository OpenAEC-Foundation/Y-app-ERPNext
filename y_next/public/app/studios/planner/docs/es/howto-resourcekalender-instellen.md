# Configurar un calendario de recurso

Objetivo: registrar en qué días está disponible un recurso, para que el histograma, la sobreasignación y la nivelación se calculen con él.

## Cuándo lo necesita

La cuadrilla de albañilería trabaja solo de lunes a jueves. La grúa está en otro proyecto en las dos primeras semanas de agosto. Un subcontratista tiene cuatro días laborables fijos. Sin calendario propio, la aplicación supone que el recurso trabaja en los días del calendario del proyecto.

Un calendario de recurso no cambia ninguna fecha de tarea. Solo determina cuándo está disponible el recurso. Si una tarea trabaja en un día en el que el recurso no trabaja, la capacidad ese día es 0 y el día cuenta como sobreasignado. Si quiere que la tarea trabaje en otros días, dele a la tarea un calendario propio ([Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen)). La diferencia se explica en [Calendarios y días laborables](docs://uitleg-kalenders).

## Pasos

### Crear un calendario de recurso nuevo

1. Elija *Recursos › Gestionar › Recursos*. Se abre el panel de recursos. Si el recurso todavía no existe, créelo con *Nuevo recurso en el proyecto*.
2. Busque la fila del recurso. En la columna *Calendario* el valor predeterminado es *Calendario del proyecto*: el recurso sigue entonces el calendario del proyecto.
3. En esa lista, elija *+ Calendario del recurso*. Se abre la ventana *Calendario del recurso*. Tiene los mismos campos que el formulario de calendario: *Nombre*, *Días laborables*, los horarios laborales y los *Festivos*. El nuevo calendario empieza como copia del calendario estándar y se llama *Calendario del recurso*.
4. Dele al calendario un nombre que encaje con el recurso, por ejemplo *Crew Mon–Thu*, y ajuste los días laborables: haga clic en el viernes para desactivarlo en *Días laborables*. Los festivos o las paradas se ponen en la lista *Festivos* con *Añadir festivo*.
5. Pulse *Aplicar*. El calendario queda ahora en la biblioteca de recursos del proyecto y vinculado al recurso, en un solo paso que puede deshacer con *Deshacer*. Con *Cancelar* no se crea nada.

### Elegir o ajustar un calendario existente

En la columna *Calendario*, elija un calendario de la lista. *Calendario del proyecto* quita de nuevo el calendario propio. Si quiere ajustar el calendario elegido, haga clic en el lápiz junto a la lista (*Editar…*). Se abre la ventana *Calendario del recurso* con el calendario actual.

### Revisar el resultado

1. Si la barra de estado dice *Desactualizado — recalcula (F5)*, pulse **Calcular** (F5).
2. Elija *Recursos › Histograma › Histograma* y haga clic en el recurso de la lista a la izquierda del histograma. Los días en que el recurso no trabaja, pero está planificado, aparecen en rojo. Si pasa el ratón sobre uno, la barra informa, por ejemplo, *No trabaja este día según el calendario «Crew Mon–Thu»*.
3. En *Recursos › Sobreasignación* está el número de recursos sobreasignados, y la barra de estado informa, por ejemplo, *1 recurso(s) sobreasignado(s)*.

## Errores habituales y lo que hace la aplicación entonces

**Solo cuentan los días, no las horas.** Un calendario de recurso determina en qué días trabaja el recurso. Cuántas unidades están disponibles ese día depende de las *Unidades máx* del recurso, no de los horarios laborales del calendario.

**La nivelación no siempre resuelve esto.** Si no hay un periodo en el que cada día de la tarea caiga en un día laborable del recurso, desplazar no ayuda. Elija *Recursos › Nivelación › Nivelar…* y pulse *Calcular*. Entonces la tarea aparece en *Conflictos restantes*, con el motivo *El recurso no trabaja todos los días que necesita esta tarea — desplazarla no resuelve esto.* Después asigne la tarea a otro recurso, o dele un calendario propio.

**Un calendario compartido.** La lista muestra todos los calendarios del proyecto, también el calendario del proyecto y los calendarios de las tareas. Si modifica un calendario así con el lápiz, la planificación de las tareas que lo usan también cambia, y la barra de estado informa *Desactualizado — recalcula (F5)*. Mejor cree un calendario propio para el recurso.

**La sobreasignación no siempre se debe al calendario.** Un recurso que trabaja todos los días también puede estar sobreasignado: el texto emergente solo menciona el calendario si el día no es un día laborable del recurso.

## Véase también

- [Calendarios y días laborables](docs://uitleg-kalenders): por qué un calendario de recurso no desplaza fechas.
- [Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen): los campos del formulario de calendario.
- [Generar festivos y las vacaciones de construcción](docs://howto-feestdagen-genereren): cómo poner festivos y paradas en el calendario.
- [Ventanas de calendario](docs://ref-kalenders): todos los campos de las ventanas de calendario.
