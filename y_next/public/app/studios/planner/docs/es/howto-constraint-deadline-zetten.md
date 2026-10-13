# Establecer una restricción o una fecha límite

Objetivo: registre un acuerdo de fecha en una tarea. Así la planificación lo tiene en cuenta, o muestra que no se cumple.

## Cuándo lo necesita

Los ladrillos solo se entregan el 21 de junio, así que la mampostería no puede comenzar antes. Use una **restricción** *no comenzar antes del (SNET)*. La cubierta debe estar cerrada antes de las vacaciones de la obra, y quiere recibir un aviso si no sale bien: una **fecha límite**. La colada está fijada en un día porque la planta de hormigón lo ha prometido: *debe comenzar el*. Qué tipo encaja en cada caso, y qué hace la aplicación con él, se explica en [Restricciones y fechas límite](docs://uitleg-constraints).

## Pasos

Usted establece una restricción y una fecha límite en el panel *Propiedades*.

1. Seleccione la tarea. Si no ve el panel *Propiedades*, actívelo con *Vista › Paneles › Propiedades*.
2. En *Restricción* elija el tipo, por ejemplo *No comenzar antes del (SNET)*.
3. Con todos los tipos excepto *Lo antes posible (ASAP)* y *Lo más tarde posible (ALAP)* aparece el campo *Fecha de restricción*. Escriba la fecha en las tres casillas de día, mes y año, por ejemplo 21, 06 y 2027, y pulse Intro. La aplicación pasa sola a la casilla siguiente en cuanto una casilla está llena. Después de elegir el tipo, ya aparece una fecha: la de la restricción anterior o, si no existe, el inicio planificado original de la tarea. Puede diferir del inicio que muestra el panel. Introduzca siempre usted mismo la fecha que desea.
4. Si quiere fijar la tarea en esa fecha, incluso antes de sus predecesores, elija *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* y marque *Obligatorio (fijación forzada)*. Eso es una fijación forzada. Úsela solo para una fecha que de verdad está fijada.
5. Si también quiere un segundo límite, por ejemplo una tarea que no puede comenzar antes del 14 de junio y debe finalizar a más tardar el 17 de junio, elija un tipo en *Restricción secundaria* y rellene la *Fecha secundaria*. Este campo aparece con cada restricción que tiene fecha, salvo con una fijación forzada. Con MSO y MFO no se permite una restricción secundaria: la aplicación la marca entonces en rojo.
6. Para una fecha límite, rellene el campo *Fecha límite* de la misma forma que la fecha de restricción. Una fecha límite es independiente de la restricción: puede establecer las dos en la misma tarea.
7. Pulse **Calcular** (F5), por ejemplo en *Inicio › Programación › Calcular*. Hasta entonces, la barra de estado muestra *Desactualizado — recalcula (F5)*.

También hay campos en la ventana *Editar tarea*. Ábrala haciendo clic derecho en la tarea y eligiendo *Editar...*. Confirme con *Guardar*.

En la tabla trabaja con columnas. Haga clic en **+** en el encabezado de la tabla y, bajo *Restricciones*, elija las columnas *Tipo de restricción*, *Fecha de restricción* y *Fecha límite*. También hay *Restricción estricta*, *Tipo de restricción secundaria* y *Fecha de restricción secundaria*. Haga doble clic en una celda para editarla: elija el tipo en una lista y escriba una fecha con guiones, por ejemplo 21-06-2027. *Restricción estricta* solo se puede cambiar con MSO y MFO.

Si la tarea tiene un predecesor, hay un atajo para *no comenzar antes del (SNET)*. Escriba una nueva fecha de inicio en el campo *Comienzo* (en el panel *Propiedades*, en *Editar tarea* o en la tabla), o mueva la barra en el Gantt. La aplicación convierte entonces la fecha en una restricción *No comenzar antes del (SNET)* y se lo indica.

## Comprobar el resultado

- En el Gantt hay un pequeño rombo encima de la barra. Está en el lado de inicio para una restricción de inicio, y en el lado de fin para una restricción de fin. Es azul para SNET y FNET, violeta para SNLT, FNLT, MSO y MFO, y rojo si se incumple la restricción. Una fijación forzada muestra un pin. Una fecha límite es una flecha hacia abajo en la fecha límite: verde mientras la tarea termina a tiempo, y roja si se retrasa.
- Una restricción violada o una fecha límite incumplida aparece en el panel *Advertencias* (*Planificación › Programación › Advertencias*) y en la barra de estado. La *Holgura total* de la tarea y de las tareas anteriores a ella es entonces negativa.
- Con un límite superior (*no comenzar después del (SNLT)*, *no finalizar después del*) o con una fecha límite, la ausencia de un aviso significa que la planificación cumple la fecha.

## Quitar una restricción o una fecha límite

En *Restricción* vuelva a elegir *Lo antes posible (ASAP)*. Así también se quita la restricción secundaria. Para quitar una fecha límite, vacíe las tres casillas y pulse Intro. Después pulse **Calcular**.

## Trampas habituales y lo que hace la aplicación

**Una restricción en una fase.** Una restricción o fecha límite en una fase (tarea de resumen) no tiene efecto. Póngala en la propia tarea.

**Una tarea que ya ha empezado.** Si la tarea tiene un inicio real o un avance, conserva su inicio real. Una restricción *no comenzar antes del (SNET)* con una fecha posterior no la mueve.

**Escribir una fecha de inicio junto a otra restricción.** Si la tarea tiene un predecesor y ya tiene otra restricción, por ejemplo *Lo más tarde posible (ALAP)*, la aplicación no aplica la fecha de inicio escrita. Un mensaje indica la restricción. Cámbiela si quiere mover el inicio.

**Una fecha en fin de semana.** Una fecha en sábado, domingo o en un día no laborable cuenta como día laborable. Un límite inferior (*no comenzar antes del (SNET)*, *no finalizar antes del*) pasa al siguiente día laborable. Un límite superior (*no comenzar después del (SNLT)*, *no finalizar después del*) pasa al día laborable anterior.

**Una restricción secundaria no permitida.** La aplicación marca una combinación no válida en rojo, con el motivo. Por ejemplo: *Las restricciones primaria y secundaria no pueden limitar el mismo lado.* No se permite una restricción secundaria con ASAP, ALAP, MSO, MFO ni con una fijación forzada.

**Una fijación forzada.** La primera vez que la activa, la aplicación avisa de que una fijación forzada anula las relaciones. La tarea queda entonces en la fecha, incluso antes de sus predecesores. Esos predecesores reciben holgura negativa.

**Nada cambia tras establecerla.** Las restricciones solo funcionan después de **Calcular**. Si un límite superior (*no comenzar después del (SNLT)*, *no finalizar después del*) no tiene efecto en las barras, es normal. Un límite superior no mueve nada. Si no se cumple la fecha, la holgura pasa a ser negativa.

## Véase también

- [Restricciones y fechas límite](docs://uitleg-constraints): qué hace cada tipo, y la explicación de fijación forzada, holgura negativa y fecha límite.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué hace la holgura negativa con la ruta crítica.
- [Relaciones y desfase](docs://uitleg-relaties): las relaciones junto a las que se sitúa una restricción.
- [Notificaciones y advertencias](docs://ref-meldingen): las advertencias para una restricción violada o una fecha límite incumplida.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): una restricción de permiso *no comenzar antes del (SNET)* en *Demolish existing extension* (14 de mayo de 2027), y una fecha límite que se cumple con margen de sobra.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una fecha límite deliberadamente ajustada en *Contractual project handover* (15 de julio de 2027). Después de calcular, el fin es el 17 de agosto y muchas tareas tienen holgura negativa.
