# Restricciones y fechas límite

Los ladrillos solo se entregan el 21 de junio. El permiso todavía no ha llegado. El tejado tiene que estar cerrado antes de las vacaciones de construcción. Las relaciones indican que una tarea espera a otra tarea, pero los acuerdos sobre una fecha no se derivan del orden de la obra. Para eso sirven las restricciones y las fechas límite. En este artículo aprende qué hace cada tipo, cuándo se mueve una tarea y cuándo cambia solo la holgura, qué es una fijación forzada y cómo indica la aplicación un conflicto.

Las reglas y los ejemplos se aplican a un proyecto nuevo, con el perfil de cálculo *Open Planner Studio* y una semana laboral de lunes a viernes.

## El concepto

Una **restricción** es un límite de fecha en una sola tarea, independiente de sus relaciones. Ese límite puede actuar de dos maneras:

- El límite **empuja**: la tarea no puede comenzar ni terminar antes de la fecha. Si la tarea comenzaría antes por sus relaciones, se mueve a la fecha.
- El límite **vigila**: la tarea debe comenzar o terminar en la fecha como máximo. La aplicación no mueve nada. Si la planificación no cumple la fecha, la **holgura** de la tarea, y de la cadena anterior, se vuelve negativa. La holgura es el margen que tiene una tarea antes de que cambie la fecha de fin del proyecto. Negativa significa que, sobre el papel, ya va con retraso (véase [Ruta crítica y holgura](docs://uitleg-kritiek-pad)).

Una **fecha límite** es una forma más sencilla de vigilar: una fecha objetivo para el fin de una tarea, sin que nada mueva la tarea.

Todas las restricciones son **blandas**: el cálculo continúa aunque no se cumpla una fecha. Hay una excepción, la **fijación forzada**, que anula las relaciones. Más abajo se explica esto.

## Cómo calcula la aplicación

### Los ocho tipos

Usted elige el tipo en *Restricción*, en el panel *Propiedades*. Así calcula cada tipo:

- *Lo antes posible (ASAP)*: sin límite. Es el valor predeterminado: la tarea comienza en cuanto lo permiten sus relaciones.
- *Lo más tarde posible (ALAP)*: la tarea se mueve lo más tarde posible sin que un sucesor tenga que comenzar más tarde. Por eso usa su holgura libre. Si después le queda holgura total, porque sus sucesores tienen margen propio, sigue sin ser crítica. Si también esa holgura se agota, cuenta como crítica.
- *No comenzar antes del (SNET)*: un límite inferior para el comienzo. Si la tarea comenzaría antes, se mueve a la fecha. Si la fecha es anterior a lo que permiten las relaciones, la restricción no hace nada.
- *No finalizar antes del (FNET)*: lo mismo, pero para el fin de la tarea.
- *No comenzar después del (SNLT)* y *No finalizar después del (FNLT)*: un límite superior para el comienzo o para el fin. No mueven nada. Si no se cumple el límite, la aplicación indica una restricción violada y la holgura se vuelve negativa.
- *Debe comenzar el (MSO)* y *Debe finalizar el (MFO)*: un límite inferior y uno superior a la vez. La tarea se mueve a la fecha si esa fecha es posterior a lo que exigen sus relaciones. Si la fecha es anterior a lo que permiten las relaciones, la tarea se queda donde la ponen las relaciones y la holgura se vuelve negativa.

Si una fecha cae en sábado, domingo o día no laborable, la aplicación la lee como día laborable: un límite inferior (SNET, FNET) como el siguiente día laborable, y un límite superior (SNLT, FNLT) como el anterior.

### Qué significa la holgura negativa

Un límite superior calcula hacia atrás. Si la restricción pone la fecha tardía de una tarea antes de su fecha temprana, la holgura total se vuelve negativa. Lo mismo pasa con las tareas anteriores. Si la mampostería debe comenzar el viernes 11 de junio como máximo y no puede comenzar antes del lunes 14 de junio, las tareas anteriores a la mampostería también se retrasan un día laborable. y no puede comenzar antes del lunes 14 de junio, las tareas anteriores también se retrasan un día laborable. Todas las tareas con holgura negativa son críticas. En [Ruta crítica y holgura](docs://uitleg-kritiek-pad) se explica cómo funciona.

Las barras no se mueven por un límite superior. Usted ve el conflicto en la *Holgura total* negativa, en un rombo rojo encima de la barra, en el aviso de la barra de estado (por ejemplo *1 restricción(es) incumplida(s)*) y en el panel *Advertencias*.

### La fijación forzada

Con MSO y MFO aparece la casilla *Obligatorio (fijación forzada)*. Con esa casilla marcada, usted fija la tarea en la fecha, aunque sus predecesores no hayan terminado para entonces. Las relaciones quedan anuladas:

- La tarea está en la fecha (con MSO comienza ahí, con MFO termina ahí) y se solapa con sus predecesores.
- Los predecesores obtienen holgura negativa, y la aplicación indica una restricción violada en cuanto las relaciones permitirían que la tarea comenzara más tarde que la fijación. La propia tarea fijada conserva 0 de holgura.
- Los sucesores se calculan a partir de la tarea fijada. Por eso pueden comenzar antes que sin la fijación, aunque la lógica anterior todavía no haya terminado. En el ejemplo de abajo, el fin del proyecto se adelanta tres días laborables por ese motivo.

La primera vez que activa la fijación, la aplicación muestra una explicación breve: una fijación forzada anula las relaciones, la barra queda fijada en la fecha, incluso antes de sus predecesores.

### La restricción secundaria

Una tarea tiene una restricción primaria. Si también quiere un segundo límite, por ejemplo una tarea que no puede comenzar antes del 14 de junio y debe terminar a más tardar el 17 de junio, añada una **restricción secundaria**. Debe ser un límite real (SNET, FNET, SNLT o FNLT) y limitar en la otra dirección que la primaria: un límite inferior (SNET o FNET) con un límite superior (SNLT o FNLT). Por lo tanto, SNET con SNLT está permitido; SNET con FNET no lo está. La aplicación marca otras combinaciones en rojo con el motivo, por ejemplo *Las restricciones primaria y secundaria no pueden limitar el mismo lado.* Con ASAP, ALAP, MSO, MFO y una fijación forzada no se permite una restricción secundaria.

### La fecha límite

Una fecha límite es una fecha aparte en una tarea, junto a la restricción. Es un límite superior para el fin. No mueve nada, pero vuelve negativa la holgura si la tarea no termina a tiempo. Después la aplicación indica en el panel *Advertencias* *Fecha límite … incumplida — fin más temprano …*, y la barra de estado cuenta las fechas límite incumplidas. En el diagrama Gantt hay una flecha hacia abajo en la fecha límite: verde mientras la tarea termine a tiempo, roja en cuanto llegue tarde. Una fecha límite en sábado cuenta hasta el viernes anterior, incluido.

Para la holgura, una fecha límite hace lo mismo que FNLT. La diferencia está en el uso. Una fecha límite es una fecha objetivo que usted quiere vigilar. Está separada de la restricción, así que una tarea puede tener una restricción y una fecha límite. FNLT es una restricción: un incumplimiento aparece como restricción violada, en lugar de como fecha límite incumplida.

### Lo que una restricción no hace

- En una **fase** (tarea de resumen) una restricción o fecha límite no cuenta: la aplicación calcula con las tareas de la fase. Póngala en la propia tarea.
- Una tarea que ya tiene un inicio real o un avance conserva ese inicio. Un SNET con una fecha posterior no la mueve.
- **Escribir una fecha de inicio** en una tarea con predecesor no funciona como inicio fijo: el predecesor sigue decidiendo. Por eso la aplicación la convierte en un SNET en la fecha que usted escribió, en el panel *Propiedades*, en *Editar tarea*, en la tabla y cuando mueve la barra en el diagrama Gantt. La aplicación se lo indica. Si la tarea ya tiene otra restricción (por ejemplo ALAP o MSO), la aplicación no aplica la nueva fecha de inicio y también se lo indica. Cambie entonces esa restricción.

Todos los cambios solo se ven después de **Calcular** (F5).

## Ejemplo práctico

El ejemplo es una red pequeña para una ampliación de una casa. Empieza el lunes 7 de junio de 2027:

- *Groundwork* (3 días laborables): del lunes 7 al miércoles 9 de junio.
- *Pour foundation* (2): jueves 10 y viernes 11 de junio.
- *Brickwork* (5): del lunes 14 al viernes 18 de junio.
- *Roofing* (3): del lunes 21 al miércoles 23 de junio.
- *Scaffolding* (2): sigue a *Pour foundation* y va antes de *Roofing*. Se ejecuta el lunes 14 y el martes 15 de junio y tiene 3 días laborables de holgura.

La ruta crítica es *Groundwork*, *Pour foundation*, *Brickwork* y *Roofing*. El proyecto termina el miércoles 23 de junio. ¿Qué cambia con una restricción en *Brickwork*?

- **SNET lunes 21 de junio** (los ladrillos solo llegan entonces): *Brickwork* va del lunes 21 al viernes 25 de junio, y *Roofing* del lunes 28 al miércoles 30 de junio. El proyecto termina el miércoles 30 de junio. *Groundwork* y *Pour foundation* tienen ahora 5 días laborables de holgura y ya no son críticas; *Scaffolding* tiene 8.
- **SNET miércoles 9 de junio**: sin efecto. Las relaciones solo permiten que *Brickwork* comience el lunes 14 de junio de todos modos.
- **SNLT miércoles 16 de junio**: sin efecto. *Brickwork* comienza el lunes 14 de junio y cumple el límite de sobra.
- **SNLT viernes 11 de junio**: demasiado ajustado. *Brickwork* sigue comenzando el lunes 14 de junio, con un retraso de un día laborable. *Groundwork*, *Pour foundation* y *Brickwork* obtienen −1 día laborable de holgura, y la aplicación indica *La restricción No comenzar después del (SNLT) 11-06-2027 es sobrepasada por la lógica (holgura negativa)*. No se mueve nada.
- **MSO miércoles 16 de junio** (sin fijación forzada): *Brickwork* se mueve al miércoles 16 de junio y termina el martes 22 de junio. *Roofing* va del miércoles 23 al viernes 25 de junio; el proyecto termina el viernes 25 de junio.
- **MSO viernes 11 de junio** (sin fijación forzada): la fecha es anterior a lo que permiten las relaciones. *Brickwork* comienza de todos modos el lunes 14 de junio y la holgura pasa a −1, igual que con SNLT.
- **MSO miércoles 9 de junio con fijación forzada**: *Brickwork* comienza el miércoles 9 de junio y termina el martes 15 de junio, mientras *Pour foundation* sigue hasta el viernes 11 de junio. *Roofing* va del miércoles 16 al viernes 18 de junio: el proyecto termina tres días laborables antes que sin la fijación. *Groundwork* y *Pour foundation* obtienen −3 días laborables de holgura.

Y con una restricción o fecha límite en otra tarea:

- **ALAP en** *Scaffolding*: la tarea se mueve al jueves 17 y viernes 18 de junio, el último momento antes de *Roofing*. *Roofing* es su único sucesor y tenía margen justo para sus 3 días laborables de holgura. Ahora esa holgura se agota y *Scaffolding* es crítica.
- **SNET sábado 19 de junio en** *Scaffolding*: el límite cuenta como el lunes 21 de junio. *Scaffolding* se ejecuta el lunes 21 y el martes 22 de junio, y *Roofing* se desplaza también: del miércoles 23 al viernes 25 de junio.
- **Fecha límite viernes 18 de junio en** *Roofing*: no se mueve nada, y *Roofing* se queda del lunes 21 al miércoles 23 de junio. *Groundwork*, *Pour foundation*, *Brickwork* y *Roofing* obtienen −3 días laborables de holgura, y la aplicación indica *Fecha límite 18-06-2027 incumplida — fin más temprano 23-06-2027*. *Scaffolding* conserva 0 días laborables de holgura y también se vuelve crítica.
- **SNET lunes 21 de junio en** *Brickwork*, **fecha límite viernes 25 de junio en** *Roofing*: la restricción retrasa *Brickwork* una semana, y la fecha límite indica que *Roofing* termina tarde, el miércoles 30 de junio. *Brickwork* y *Roofing* obtienen −3 días laborables de holgura; *Groundwork* y *Pour foundation* conservan 2 días laborables.

En el tutorial 3 usted mismo pone una restricción y una fecha límite en el proyecto de tutorial, y ve cómo se mueve la planificación.

## Consecuencias y malentendidos

**«Una restricción mueve la tarea.»** Solo SNET, FNET, MSO y MFO pueden poner una tarea más tarde de lo que indican sus relaciones, y ALAP puede moverla hacia más tarde dentro de su holgura libre. SNLT y FNLT nunca mueven nada: solo avisan. Cumplir la fecha significa entonces acortar la cadena anterior.

**«La holgura negativa es un fallo de la aplicación.»** Es la señal de que la planificación entra en conflicto con su acuerdo de fechas. Se resuelve acortando la cadena, aflojando el acuerdo o aceptando el conflicto a propósito.

**«Una fijación forzada resuelve el conflicto.»** Una fijación forzada oculta el conflicto: la tarea está en la fecha, pero sus predecesores no están listos para ella, y los sucesores se calculan como si lo estuvieran. Úsela solo para una fecha que de verdad es fija, como una fecha legal de entrega, y no para poner una tarea en una fecha.

**«Solo escribo una fecha de inicio.»** Con una tarea que tiene un predecesor, eso se convierte en un SNET. Si esa fecha es anterior a lo que permite el predecesor, no hace nada.

**«¿Fecha límite o FNLT?»** Elija una fecha límite para una fecha objetivo que quiere vigilar, y una restricción para una fecha que de verdad es una condición límite para la planificación.

**«Una restricción en la fase.»** Eso no cuenta. Póngala en la propia tarea.

## Véase también

- [Cómo poner una restricción o fecha límite](docs://howto-constraint-deadline-zetten): los pasos para poner una restricción o una fecha límite.
- [Relaciones y desfase](docs://uitleg-relaties): las relaciones que acompañan a las restricciones.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): cómo surge la holgura negativa y qué hace con la ruta crítica.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): una fijación forzada (*Debe comenzar el (MSO)*) en *Municipal road closure (permitted closure period)* y una restricción secundaria (*No comenzar después del (SNLT)*) en *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una fecha límite que no se cumple, con holgura negativa.
