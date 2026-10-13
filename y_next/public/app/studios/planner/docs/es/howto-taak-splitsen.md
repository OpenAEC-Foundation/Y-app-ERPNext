# Dividir una tarea

Objetivo: interrumpir una tarea, para que el trabajo se detenga y continúe más tarde, sin convertirla en dos tareas.

## Cuándo lo necesita

Colocar el armado tarda ocho días laborables, pero tras cuatro días la grúa debe ir a otra obra y el trabajo continúa dos días después. Crear dos tareas separadas obliga a mantener sus relaciones y asignaciones por duplicado. Con una **interrupción** sigue siendo una sola tarea, con una barra que tiene un hueco. La aplicación también llama a la interrupción *pausa*.

El trabajo sigue teniendo la misma longitud, pero la tarea ahora dura más en el calendario. Por ejemplo: una tarea de 8 días laborables que empieza el martes 29 de septiembre de 2026 termina el jueves 8 de octubre. Si pone una interrupción de 2 días laborables tras 4 días laborables, termina el lunes 12 de octubre. La duración sigue siendo de 8 días laborables; solo el fin se desplaza dos días laborables.

## Pasos

### Dividir en el diagrama de Gantt

1. Elija *Inicio › Tareas › Dividir tarea* (o *Planificación › Relaciones › Dividir tarea*). Encima de la planificación aparece el aviso *Haga clic en una barra en el día en que empieza la interrupción y arrastre a la derecha para su duración. Esc para detener.* El botón también está en la pestaña *Tabla* (*Tabla › Tareas › Dividir tarea*), pero allí está desactivado.
2. Mueva el ratón sobre la barra. Una línea discontinua y una etiqueta con la fecha muestran dónde empezaría la interrupción. Pulse sobre la barra, en el día en que empieza la interrupción.
3. Arrastre a la derecha. La etiqueta muestra la duración, por ejemplo *2 días laborables de pausa*: la distancia en días laborables hasta el día bajo el ratón. Suelte.

Si solo hace clic, sin arrastrar, la pausa pasa a ser de un día laborable. Si arrastra hacia la izquierda, la pausa se acorta de nuevo, hasta un mínimo de un día laborable. En una tarea horaria, la pausa se mide en horas.

El modo sigue activo, así que puede dividir más tareas. Detenga el modo con Esc o con el botón *Detener* del aviso. Si pulsa Esc mientras arrastra, la aplicación deshace la pausa y el modo se detiene. Cada gesto es un paso de *Deshacer*.

Tras dividir una tarea, la planificación deja de estar actualizada. Pulse **Calcular** (F5) para obtener las fechas finales.

### Arrastrar una interrupción existente en el diagrama de Gantt

Esto funciona sin el modo de división, directamente sobre una barra que tiene una interrupción.

- Arrastre el tramo **después** de la pausa a la derecha o a la izquierda. La pausa se alarga o se acorta, con la etiqueta *3 días laborables de pausa*. Si lo arrastra hasta que la pausa valga 0, la etiqueta muestra *Unir* y los dos tramos vuelven a ser uno.
- Arrastre el borde derecho del tramo **antes** de la pausa. Ese tramo se alarga o se acorta, con la etiqueta *Tramo: 5 días laborables*. La duración de la tarea cambia con él.
- Si arrastra el primer tramo, mueve toda la tarea, como con cualquier barra.

### Dividir y ajustar en el panel de propiedades

Seleccione la tarea. En el panel *Propiedades*, el bloque *Interrupciones* está debajo de *Relaciones* y encima de *Asignaciones*. Desplácese hasta él si es necesario.

- *Añadir interrupción* pone una pausa de un día laborable a mitad del tramo más largo.
- Cada pausa tiene dos casillas: *tras* (cuántos días laborables de trabajo van antes de la pausa) y *pausa* (la duración de la pausa). Junto a ellas aparecen las fechas del tramo posterior a la pausa. En una tarea horaria, muestran horas.
- Si pone *pausa* en 0, la interrupción desaparece. El pequeño botón de papelera (*Quitar la interrupción*) hace lo mismo.

Tenga cuidado con *tras*: esa casilla alarga o acorta el tramo de trabajo anterior a la pausa, y con él la duración de toda la tarea. Con *pausa* solo cambia el fin.

### Quitar una interrupción

Haga clic con el botón derecho en la interrupción del diagrama de Gantt, o en el tramo posterior, y elija *Quitar la interrupción*. *Quitar todas las interrupciones* está en el menú contextual de cada barra que tiene una interrupción. O use el bloque *Interrupciones* del panel *Propiedades*, como se ha descrito antes.

### Con un asistente de IA

Un asistente de IA conectado crea interrupciones con la herramienta `planner_set_task_splits`, con la misma forma que el panel: tras cuántos días laborables (o horas laborables) de trabajo, y cuántos días laborables (o horas laborables) de pausa. Siempre envía la lista completa; una lista vacía quita todas las interrupciones. Las lee de nuevo con `planner_get_task`. Se aplican las mismas reglas que se describen abajo: una tarea que usted no puede dividir, tampoco la puede dividir el asistente. A diferencia de una división que usted hace, la aplicación recalcula la planificación después por sí sola. Cómo conectar un asistente está en [Conectar un asistente de IA (MCP)](docs://howto-ai-assistent-koppelen).

## Puntos de atención y lo que hace la aplicación

**No todas las tareas se pueden dividir.** No puede dividir un hito, una tarea de resumen, una tarea con *Hamaca (duración derivada)* activada (véase [Crear una hamaca](docs://howto-hammock)), una tarea con tipo de duración *Tiempo transcurrido*, una tarea *Programada manualmente* ni una tarea de menos de dos días laborables. En el modo de división, el ratón muestra un cursor de no permitido y no pasa nada. En una tarea así, el bloque *Interrupciones* tampoco aparece en *Propiedades*.

**En la pestaña Tabla el botón no funciona.** *Dividir tarea* está desactivado allí, con la indicación *Solo disponible cuando el diagrama de Gantt está visible*. El gesto necesita una barra. El modo de división y el modo de vinculación se desactivan entre sí.

**Un clic sin efecto.** Una interrupción no puede empezar el primer día de la tarea ni dentro de una pausa existente. Cada tramo de trabajo también debe durar al menos un día laborable. Si hace clic en un lugar así, no pasa nada y no aparece ningún mensaje.

**Una tarea con avance.** Si la tarea tiene avance, una interrupción solo puede empezar después del trabajo ya realizado. Con un 50% de 8 días laborables, es como muy pronto el quinto día laborable. Un clic en la parte realizada no hace nada, y una tarea con una finalización del 100% ya no se puede dividir. En el panel, *Añadir interrupción* queda entonces desactivado: eso también ocurre si la mitad del tramo más largo cae en trabajo realizado, por ejemplo con un 75% de 8 días laborables.

**La nivelación también crea interrupciones.** Aparecen en el bloque *Interrupciones* con la etiqueta *nivelación*. *Recursos › Nivelación › Borrar nivelación* las vuelve a quitar. Si usted edita las interrupciones de una tarea así, todas sus pausas de nivelación pasan a ser suyas y *Borrar nivelación* ya no las quita.

**Las interrupciones no pasan a MS Project ni a Primavera.** Si exporta a *MS Project XML* o *Primavera P6 XML*, ese programa solo conoce una interrupción como distribución del trabajo de una asignación. Sin esa distribución, la tarea llega sin interrupción, y la aplicación informa de cuántas tareas son: *1 tarea con interrupciones se ha exportado sin sus interrupciones: MS Project/P6 solo las conocen como distribución del trabajo.* En el archivo IFC de la aplicación se conservan.

**Un archivo con interrupciones que la aplicación no puede editar.** Las interrupciones de un archivo de origen que no encajan en la forma de la aplicación muestran el mensaje *Estas interrupciones proceden del archivo de origen en una forma que no se puede editar aquí* en el panel, con solo *Quitar todas las interrupciones*.

## Véase también

- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): cómo cuenta la planificación en días laborables y por qué se mueve el fin.
- [Añadir relaciones](docs://howto-relaties-leggen): otro modo del diagrama de Gantt, que se usa al arrastrar una barra.
- [Diálogo de tarea y panel de propiedades](docs://ref-taak-eigenschappen): la sección Interrupciones del panel de propiedades.
