# Perfiles de cálculo y convenciones

La misma planificación puede producir fechas distintas, según las reglas de cálculo que aplique. Este artículo explica por qué Primavera P6 y Microsoft Project calculan de forma distinta en algunos puntos, cómo la aplicación guarda esa diferencia en un **perfil de cálculo** y en qué se diferencia un perfil de las opciones de cálculo que usted define por proyecto. Un ejemplo práctico con una red pequeña muestra qué efecto tiene esto en las fechas.

## El concepto

Las tareas, las relaciones y un calendario determinan la mayor parte de una planificación, pero no todo. ¿Qué pasa con el trabajo que no se ha iniciado cuando se define una fecha de estado? ¿Dónde empieza el trabajo restante de una tarea que ya está en curso? ¿Cuál es la holgura libre de una tarea cuando no se cumple una fecha límite? La red no dice nada al respecto. Un paquete de planificación tiene que elegir una regla para ello. La aplicación conoce varios puntos en los que la regla de Primavera P6 y la de Microsoft Project difieren.

La aplicación llama **convención** a esa elección. Un **perfil de cálculo** es el conjunto de convenciones que pertenece a un paquete. La aplicación tiene tres:

- *Open Planner Studio*: el perfil con el que calcula un proyecto nuevo. Ninguna convención está activada.
- *Primavera P6*: las convenciones que la aplicación conoce de P6.
- *Microsoft Project*: las convenciones que la aplicación conoce de Microsoft Project.

Así, el perfil indica cómo calcula un paquete. Lo que usted quiere para su proyecto no forma parte de él. Eso son las **opciones de cálculo**: elecciones como a partir de qué holgura una tarea se vuelve crítica, o en qué calendario cuenta un desfase. Usted define esas opciones por proyecto.

## Cómo calcula la aplicación

### Convenciones y opciones de cálculo

Una convención es un interruptor: activado o desactivado. El perfil decide qué interruptores están activados. Una opción de cálculo es una elección que usted hace. Puede ver la diferencia en la propia aplicación, en el bloque *Perfil de cálculo y opciones*:

- **Las convenciones** están en *Convenciones de este perfil*, agrupadas por tema, por ejemplo *Avance y trabajo completado*, *Relaciones y desfase* y *Holgura y fechas tardías*. Cada línea es una casilla de verificación con el valor del perfil detrás (*base: activada* o *base: desactivada*). Si su elección es distinta, la línea destaca y aparece *volver a la base*. La flecha delante de una línea abre la explicación de esa convención. Léala primero si quiere cambiar una convención.
- **Las opciones de cálculo** están en *Opciones de cálculo de este proyecto*: entre otras *Definición de crítico*, *Cálculo de holgura*, *Tareas de extremo abierto críticas*, *Marcar casi crítico* y *Calendario de retraso*. Indican lo que usted quiere para este proyecto, no cómo calcula un paquete. Lo que hacen se explica en [Ruta crítica y holgura](docs://uitleg-kritiek-pad) y [Relaciones y desfase](docs://uitleg-relaties).

Un ejemplo de cada una. «Una tarea es crítica si su holgura total es 0 o menos» es una opción de cálculo: usted puede fijar el umbral en 4, y entonces todo lo que tenga 4 días laborables de holgura o menos es crítico. «El trabajo que no se ha iniciado se mueve a la fecha de estado» es una convención: Open Planner Studio y Primavera P6 lo hacen, Microsoft Project no.

El perfil y las opciones de cálculo pertenecen al archivo del proyecto, no a la aplicación. Si guarda el proyecto, viajan con él. Dos proyectos en la misma aplicación pueden, por tanto, calcular con un perfil distinto. Un proyecto sin perfil calcula como Open Planner Studio.

Si hay opciones de cálculo que solo conoce Primavera, el bloque muestra además, al final, *Ajustes del archivo de origen*: en un proyecto de un archivo .xer, pero también si elige *Primavera P6* en *Nuevo proyecto* o aplica las opciones predeterminadas de Primavera P6. Aquí no puede cambiarlas.

### Dónde elige el perfil

En un proyecto nuevo, el perfil está en la ventana *Nuevo proyecto*, que abre con *Inicio › Archivo › Nuevo*. Allí, *Perfil de cálculo* es una lista desplegable. Si elige un perfil allí, la aplicación sustituye las opciones de cálculo que ya había rellenado por los valores predeterminados de ese perfil; solo se conservan los ajustes de un archivo de origen. Con *Primavera P6*, *Cálculo de holgura* pasa a ser *Holgura de fin*. Con *Microsoft Project* y *Open Planner Studio*, todas las opciones de cálculo tienen su valor predeterminado, así que *Cálculo de holgura* es *Automático (predeterminado)*. Con una fecha de estado, así también calcula MS Project: una tarea iniciada recibe la holgura de fin, y cada otra tarea recibe la menor de la holgura de inicio y la de fin.

En un proyecto existente, elige el perfil en *Configuración › Proyecto › Info del proyecto*, en el bloque *Perfil de cálculo y opciones*, en la lista desplegable *Perfil de cálculo*. También puede llegar al mismo lugar por *Archivo › Info del proyecto*. Si cambia el perfil aquí, solo cambian las convenciones. Sus opciones de cálculo se quedan como están. Si además quiere las opciones de cálculo predeterminadas del nuevo perfil, elija *Aplicar las opciones predeterminadas de este perfil*.

Hasta que pulse *Aplicar*, el cambio existe solo en el formulario. Con *Aplicar*, la aplicación recalcula la planificación de inmediato, incluso si *Calcular automáticamente* está desactivado. Si se movieron tareas, indica cuántas, por ejemplo *Tras aplicar, se movieron 4 tareas.* Todo el cambio es un solo paso para *Deshacer*.

Si activa o desactiva una convención de un perfil, la aplicación lo convierte en un perfil personalizado. Se llama *Copia de Open Planner Studio*, o *Copia de* seguido del nombre del perfil con el que empezó. Puede darle otro nombre y guardarlo con *Guardar como plantilla* para otros proyectos de esta aplicación. El proyecto siempre lleva su propia copia: si cambia la plantilla más adelante, el proyecto no cambia con ella.

### Cuándo elige la aplicación un perfil

Al abrir un archivo, la aplicación sugiere un perfil según el formato:

- Un archivo .mpp (Microsoft Project) se abre con el perfil *Microsoft Project*.
- Un archivo .xer (Primavera P6) se abre con el perfil *Primavera P6*.
- Un archivo en formato *MS Project XML*, *Primavera P6 XML* o *CSV (separado por punto y coma)* se abre con *Open Planner Studio*, sin mensaje de perfil.
- Su propio proyecto (.ifc) se abre con el perfil guardado en él.

Con un archivo .mpp o .xer, la aplicación indica el perfil: *Este proyecto calcula como Microsoft Project. Cámbialo en Archivo → Info del proyecto → Perfil de cálculo y opciones.* El botón *Abrir perfil de cálculo* del mensaje lleva directamente a Info del proyecto. Con un archivo .xer, esta línea es la primera línea de detalle del mensaje de apertura del archivo. Más información sobre el mensaje está en [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen) y [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen).

Con un archivo .mpp, la aplicación solo fija el perfil. Las opciones de cálculo quedan vacías, igual que en un proyecto nuevo con el perfil *Microsoft Project*: *Cálculo de holgura* es *Automático (predeterminado)*. Un archivo .mpp abierto y un proyecto nuevo con *Microsoft Project* calculan, por tanto, la holgura de la misma forma.

## Ejemplo práctico: una red, tres perfiles

El ejemplo es una red pequeña. El calendario tiene una semana laborable de lunes a viernes y ningún día no laborable en estas semanas. El modo de progreso es Retained Logic (el predeterminado). El inicio del proyecto es el lunes 7 de junio de 2027. Todas las tareas se expresan en días laborables.

- *Pour foundation*: 5 días laborables, planificada desde el lunes 7 de junio.
- *Lay walls*: 5 días laborables, después de *Pour foundation* (fin-comienzo).
- *Order window frames*: 3 días laborables, sin predecesor, planificada desde el lunes 7 de junio.
- *Fit roof*: 2 días laborables, después de *Lay walls* y después de *Order window frames*. El fin de esta tarea es la entrega.

Los números se calcularon con el motor de cálculo de la aplicación. Los consulta en el panel *Propiedades*, en *Resultado CPM*.

**Sin fecha de estado y sin avance, los tres perfiles calculan esta red igual.** *Pour foundation* va del lunes 7 al viernes 11 de junio, *Lay walls* del lunes 14 al viernes 18 de junio y *Fit roof* el lunes 21 y el martes 22 de junio. La entrega es el martes 22 de junio. *Order window frames* (del lunes 7 al miércoles 9 de junio) tiene 7 días laborables de holgura total.

Ahora registra el estado. La fecha de estado es el miércoles 9 de junio. La tarea *Pour foundation* empezó el lunes 7 de junio y tiene un avance del 60 %. Por tanto, el trabajo restante son 2 días laborables (5 × 40 %). *Order window frames* no ha empezado. Cómo funcionan [el avance y la fecha de estado](docs://uitleg-voortgang) se explica en ese artículo. Aquí la pregunta es qué hace el perfil con ello.

### Open Planner Studio

El trabajo restante de *Pour foundation* empieza en la fecha de estado: miércoles 9 y jueves 10 de junio. El inicio temprano sigue siendo el inicio real, el lunes 7 de junio. El fin temprano es el jueves 10 de junio. *Lay walls* va del viernes 11 al jueves 17 de junio y *Fit roof* el viernes 18 y el lunes 21 de junio.

*Order window frames* estaba planificada para el lunes 7 de junio, pero no ha empezado. El trabajo que no ha empezado no puede quedar en el pasado. Por eso la aplicación lo mueve a la fecha de estado: del miércoles 9 al viernes 11 de junio, con 4 días laborables de holgura total. La entrega es el lunes 21 de junio.

### Primavera P6

Todo es igual que en Open Planner Studio, salvo un punto: el inicio temprano de *Pour foundation* es el miércoles 9 de junio. Es el inicio del trabajo restante, no el inicio real. Lo hace la convención *Tarea en curso: inicio temprano = inicio del trabajo restante*, en el grupo *Avance y trabajo completado*. El fin y la holgura no cambian por ello. La entrega es el lunes 21 de junio.

### Microsoft Project

Aquí las fechas son distintas. Dos convenciones del grupo *Avance como en Microsoft Project* lo causan.

*No mover las tareas no iniciadas a la fecha de estado*: *Order window frames* se queda del lunes 7 al miércoles 9 de junio, aunque eso queda en parte antes de la fecha de estado. La holgura total es de 7 días laborables.

*El trabajo restante se reanuda tras la duración transcurrida*: el trabajo restante empieza como muy pronto en la fecha de estado, y como muy pronto en el inicio real el inicio real más la duración transcurrida. Con el 60 % de 5 días laborables, 3 días laborables ya están hechos. El lunes 7 de junio más 3 días laborables es el jueves 10 de junio. Eso es posterior a la fecha de estado, así que el trabajo restante va el jueves 10 y el viernes 11 de junio. *Lay walls* va del lunes 14 al viernes 18 de junio y *Fit roof* el lunes 21 y el martes 22 de junio. La entrega es el martes 22 de junio: un día laborable más tarde que en los otros dos perfiles.

### ¿Qué pasa si?

**La tarea *Pour foundation* está al 20 % en lugar del 60 %.** El trabajo restante son entonces 4 días laborables. Con los tres perfiles, la tarea *Pour foundation* termina el lunes 14 de junio y la entrega es el miércoles 23 de junio. La convención de Microsoft Project para el trabajo restante no marca diferencia aquí: el lunes 7 de junio más 1 día laborable transcurrido es el martes 8 de junio, y eso es antes de la fecha de estado. Una convención así es un límite inferior que solo puede hacer el trabajo restante más tarde. *Order window frames* y el inicio temprano con Primavera P6 siguen siendo distintos, como antes. Con Microsoft Project, *Order window frames* tiene entonces 8 días laborables de holgura total.

**Solo define una fecha de estado y no introduce avance.** Con Open Planner Studio y Primavera P6, toda la red se mueve al miércoles 9 de junio. La tarea *Pour foundation* va entonces del miércoles 9 al martes 15 de junio y la entrega pasa a ser el jueves 24 de junio: dos días laborables más tarde que sin fecha de estado. Con Microsoft Project, todo se queda donde estaba y la entrega es el martes 22 de junio.

**Usted crea un perfil propio.** Si con Open Planner Studio solo activa *No mover las tareas no iniciadas a la fecha de estado*, se convierte en un perfil personalizado, *Copia de Open Planner Studio*. Con el avance del 60 %, la tarea *Pour foundation* conserva entonces las fechas de Open Planner Studio (fin el jueves 10 de junio, entrega el lunes 21 de junio). *Order window frames* sí se queda del lunes 7 al miércoles 9 de junio, con 6 días laborables de holgura total. Por tanto, un perfil es un conjunto de interruptores separados, y puede cambiarlos uno por uno.

**Una opción de cálculo en lugar de una convención.** Si con Open Planner Studio fija *Definición de crítico* (*Holgura total ≤ umbral*) con un *Umbral (días laborables)* de 4, *Order window frames* pasa a ser crítica, porque su holgura total es exactamente 4. Ninguna fecha cambia. Una opción de cálculo es su elección para el proyecto y es independiente del perfil.

**Una fecha límite que no se cumple.** Asigne a *Fit roof* una fecha límite el viernes 18 de junio. Con Open Planner Studio, la holgura total de *Fit roof* es entonces −1 día laborable y la holgura libre también es −1. Con Primavera P6, la holgura total sigue en −1, pero la holgura libre pasa a ser 0. Eso es lo que hace la convención *Holgura libre nunca negativa*, en el grupo *Holgura y fechas tardías*. Con Microsoft Project ambas son −2, porque allí la entrega cae un día más tarde. Cómo funciona una fecha límite se explica en [Restricciones y fechas límite](docs://uitleg-constraints).

## Consecuencias y malentendidos

**«El perfil es una configuración de la aplicación.»** No. El perfil y las opciones de cálculo pertenecen al proyecto y viajan en el archivo. Solo las plantillas que guarda pertenecen a la aplicación, y un proyecto siempre guarda su propia copia.

**«Si exporto, mi perfil sale con él.»** Solo con su propio formato de proyecto (.ifc). Si exporta a *MS Project XML*, *Primavera P6 XML* o *CSV (separado por punto y coma)*, el perfil no está en el archivo. De las opciones de cálculo, la exportación a MS Project XML escribe como máximo el umbral crítico. La aplicación solo avisa de esto en un proyecto que viene de un archivo .xer. Para un proyecto que usted mismo creó, no recibe ningún mensaje. El archivo se abre entonces como Open Planner Studio, sin mensaje de perfil. Tome el ejemplo con el perfil Microsoft Project y 60 % de avance. Si lo exporta a *MS Project XML* y lo vuelve a abrir, la aplicación muestra primero las fechas del archivo, con la entrega el martes 22 de junio. Si deja que la aplicación recalcule por sí misma, la fecha pasa a ser el lunes 21 de junio. Lo demás que pierde una exportación está en [Archivos y formatos](docs://uitleg-bestanden).

**«El perfil Primavera P6 da el mismo resultado que P6.»** La aplicación no puede garantizarlo. El perfil activa las convenciones que la aplicación conoce de P6, y no son todas las configuraciones de P6. Además de Retained Logic y Progress Override, P6 tiene un tercer modo de progreso, Actual Dates. La aplicación no lo conoce: un archivo .xer así se calcula como Retained Logic, y el mensaje de apertura lo indica, por ejemplo como *1 ajuste de planificación P6 usó una alternativa segura.* Algunas convenciones del perfil Primavera P6 solo funcionan en tareas que vienen de un archivo .xer, como *LOE no iniciada toma la ventana objetivo* y *Mantener exactas las fechas reales*. Para algunas de ellas, la explicación lo dice: «solo tareas con procedencia P6». En las tareas que usted crea, esas convenciones no hacen nada.

**«El modo de progreso forma parte del perfil.»** No. Retained Logic o Progress Override es una elección aparte para cada proyecto. Se configura aparte del perfil. Puede verlo en [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen). Una convención de Primavera P6, *Progress Override ignora también hacia atrás un sucesor iniciado*, solo actúa con Progress Override.

**«Solo cambio de perfil para ver qué pasa.»** Puede hacerlo, porque *Aplicar* se deshace en un solo paso con *Deshacer*: perfil y fechas vuelven juntos. Pero las fechas sí pueden moverse de verdad. En el ejemplo, al cambiar de Open Planner Studio a Microsoft Project se mueven las 4 tareas. El mensaje las cuenta por usted. Revise la planificación después, antes de seguir. Si la aplicación sigue mostrando las fechas del archivo tras abrir un .xer o .mpp, al cambiar de perfil esa vista se cierra y la aplicación calcula por sí misma. Cómo funciona eso está en [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen).

**El ejemplo muestra cuatro convenciones, y la lista de la aplicación es más larga.** Cada línea del bloque tiene su propia explicación. Léala primero. Mire también el grupo *Solo para perfiles propios*: esas convenciones están desactivadas en todos los perfiles integrados, incluido Primavera P6. Si activa una, se convierte en un perfil propio.

## Véase también

- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué hacen la fecha de estado y el trabajo restante, con las diferencias por perfil.
- [Elegir el modo de progreso](docs://howto-voortgangsmodus-kiezen): elegir Retained Logic o Progress Override.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): las opciones de cálculo para lo crítico y la holgura.
- [Relaciones y desfase](docs://uitleg-relaties): la opción de cálculo *Calendario de retraso*.
- [Archivos y formatos](docs://uitleg-bestanden): qué lleva una exportación y qué no.
- [Exportar](docs://howto-exporteren): exportar un proyecto.
- [Actualizar el avance](docs://howto-voortgang-bijwerken): introducir el porcentaje, el inicio real y la fecha de estado.
- [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen): por qué las fechas importadas pueden diferir de lo que la aplicación calcula por sí misma.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): todas las convenciones y opciones de cálculo en una sola lista.
