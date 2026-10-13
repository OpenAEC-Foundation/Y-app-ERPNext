# Notificaciones y advertencias

La aplicación le informa de lo que ocurre en tres lugares: la barra de estado en la parte inferior, el panel *Advertencias* en la columna derecha y las notificaciones que aparecen brevemente en la parte inferior de la pantalla. Este artículo indica, para cada lugar, qué ve, cuándo aparece y qué puede hacer al respecto. El motivo por el que una planificación es crítica o tiene sobreasignación está en [Ruta crítica y holgura](docs://uitleg-kritiek-pad). Cómo resolver la sobreasignación está en [Resolver la sobreasignación](docs://howto-overbezetting-oplossen). Cómo crear relaciones está en [Crear relaciones](docs://howto-relaties-leggen).

## La diferencia entre los tres

- **Barra de estado** — una línea fija con contadores. Proceden del último cálculo y se mantienen hasta que vuelva a calcular.
- **Panel de advertencias** — la lista detrás de esos contadores, con todo lo que encontró el último cálculo. Al hacer clic, la aplicación le lleva a la tarea, la relación o el recurso. Se deriva del último cálculo; no se guarda nada.
- **Notificaciones** — mensajes breves sobre algo que acaba de hacer (error al guardar, relación rechazada, importación leída). Desaparecen y no están en el panel.

## La barra de estado

La barra inferior muestra, de izquierda a derecha:

- **Tareas:** — el número de tareas hoja (las tareas de resumen no cuentan).
- **Hitos:** — el número de hitos.
- **Ruta crítica: N tareas, N días laborables** — el número de tareas críticas y la duración del proyecto. Solo es visible después de un cálculo.
- **Fin:** — la fecha de fin del proyecto según el cálculo. Solo es visible después de un cálculo; un proyecto vacío no tiene fin.
- **N fecha(s) límite incumplida(s)**, **N restricción(es) violada(s)**, **N relación(es) fuera de secuencia** y **N recurso(s) sobreasignado(s)** — cada uno es un botón con un signo de advertencia. Solo es visible cuando el contador es mayor que 0 y hay un cálculo. Al hacer clic se abre el panel *Advertencias* (información emergente: *Abrir el panel de advertencias (detalles y navegación)*). Si se encuentra en la pestaña *IFC* o *Informe*, la aplicación salta a *Inicio* al mismo tiempo, porque la columna derecha no existe allí. El contador *recurso(s) sobreasignado(s)* también se actualiza después de cambios en los recursos y las asignaciones. Los demás contadores solo cambian después de *Calcular*. Los cuatro contadores son una selección: lo que el panel muestra además (adelanto truncado, relación ignorada, hamaca sin driver de fin, fecha de fin limitada, error de planificación) no aparece en la barra de estado.
- **Desactualizada — recalcule (F5)** — con un signo de advertencia (información emergente: *Planificación desactualizada — recalcula (F5)*). Aparece en cuanto cambia algo que afecta a la planificación y todavía no ha recalculado. Si *Calcular automáticamente* está activado, no aparece, salvo que el cálculo dio un error. En ese caso sí aparece.
- **Selección: N tarea(s)** — el número de tareas seleccionadas. Solo es visible si hay una selección.
- **Escala:** y **Zoom: Npx/día** — la escala de tiempo de la línea de tiempo y el nivel de zoom. La escala depende del zoom.
- **Sin guardar** — mientras el documento tenga cambios que no están en el archivo.
- **IA** — un punto de color con la palabra IA, solo cuando el modo IA está activado. La información emergente dice *Puente IA:* con *Desactivado*, *Activo en el puerto N*, *Puerto N ocupado* o *Error*. Al hacer clic se abre la pestaña *IA*.
- **Terminal de depuración** — un botón de terminal, solo cuando la terminal de depuración está activada. Muestra u oculta la terminal (*Mostrar terminal de depuración* / *Ocultar terminal de depuración*).

## El panel de advertencias

- **Apertura** — *Planificación › Programación › Advertencias*, *Vista › Paneles › Advertencias*, o un contador de la barra de estado. El panel está en la columna derecha, debajo de *Propiedades* y del panel de recursos, y amplía una columna contraída. De forma predeterminada está cerrado y no se recuerda entre sesiones. Arrastre su altura por el borde cuando esté debajo de otros paneles; esa altura sí se recuerda. La cruz de la esquina superior derecha lo cierra (*Cerrar advertencias*).
- **Línea de encabezado** — *N error(es), N advertencia(s)*. Si todavía no se ha calculado nada, dice *Aún no calculado — pulse Calcular (F5) para ejecutar las comprobaciones*.
- **Calcular** — un botón en la línea de encabezado. Está visible mientras la planificación esté desactualizada o todavía no se haya calculado. Hace lo mismo que *Calcular* en la cinta.
- **Signo de advertencia en la línea de encabezado** — cuando la planificación está desactualizada, con la información emergente *Programación desactualizada — esta lista proviene del último cálculo. Recalcule (F5)*. La lista no se oculta; solo se marca como desactualizada.
- **Lista vacía** — *Sin advertencias. La programación supera todas las comprobaciones*.
- **Una línea** — arriba aparece el lugar (tarea, relación, recurso o proyecto) y debajo la descripción. Un error tiene su propio signo octogonal. Una advertencia tiene un signo triangular. Una tarea aparece como `WBS name`. Una relación aparece como `predecessor → successor (FS+2d)`, con tipo y desfase. Al hacer clic se va al lugar (información emergente *Ir a: …*); véase más abajo. La línea que corresponde a su tarea activa (en una relación, la de su sucesor) o al recurso elegido en el histograma queda resaltada.
- **Orden** — primero los errores. Después, por tipo, en el orden de la lista siguiente. Dentro de cada tipo, en el orden del documento (en una relación, el del sucesor; en un recurso, el de la lista de recursos). Una tarea, relación o recurso que se borró después del último cálculo desaparece de la lista.

### Tipos de advertencia

- **Error de planificación** — *No se pudo calcular la planificación: …*, con el motivo después; véase más abajo. Al hacer clic en un ciclo, la aplicación selecciona todas las tareas del ciclo y salta a la primera. En los demás errores no hay adónde saltar, y la línea no es un botón.
- **Fecha límite incumplida** — *Fecha límite {date} incumplida — fin más temprano {date}*. La tarea tiene una fecha límite y el cálculo no la cumple. Al hacer clic se salta a la tarea. Para corregirlo, ajuste la lógica o la duración, o mueva la fecha límite.
- **Restricción violada** — *La restricción {type and date} es sobrepasada por la lógica (holgura negativa)*. La restricción no se puede cumplir sin romper la lógica; la holgura es negativa. Al hacer clic se salta a la tarea. Véase [Restricciones](docs://uitleg-constraints).
- **Fuera de secuencia** — *Fuera de secuencia: el progreso del sucesor contradice la relación*. El avance del sucesor no encaja con el tipo de relación. Por ejemplo, un sucesor que ya está en curso mientras el predecesor todavía no ha terminado, con una relación fin-comienzo. Al hacer clic se seleccionan las dos tareas, con el sucesor activo. Compruebe las fechas reales o la relación.
- **Adelanto truncado** — *Adelanto truncado por el inicio del proyecto — la relación no se respeta por completo*. El adelanto (desfase negativo) de la relación llega antes del inicio del proyecto. Al hacer clic se seleccionan las dos tareas.
- **Relación ignorada** — *Relación ignorada: el predecesor o el sucesor falta o no es una tarea hoja*. El cálculo no usa la relación. Al hacer clic se seleccionan las tareas que todavía existen. Véase [Relaciones](docs://uitleg-relaties).
- **Hamaca sin driver de fin** — *Hamaca sin driver de fin (sin predecesor FF/SF): su duración vuelve a cero*. Al hacer clic se salta a la tarea. Véase [Tareas hamaca](docs://howto-hammock).
- **Fecha de fin limitada** — *Fecha de fin limitada: el calendario no deja ninguna ventana laborable para esta tarea*. El cálculo alcanzó el límite de días que busca, por ejemplo por un periodo muy largo de días libres seguidos en el calendario. Al hacer clic se salta a la tarea. Véase [Calendarios y días laborables](docs://uitleg-kalenders).
- **Sobreasignación** — *Sobreasignado durante N día(s) (primero – último)*, con *el recurso no trabaja estos días según su calendario* si todos los días son libres. Si es una combinación, se añade *de los cuales N día(s) el recurso no trabaja según su calendario*. Al hacer clic se seleccionan las tareas con una asignación a ese recurso, se activa el histograma y se elige ese recurso en él. Desde *Tabla*, *IFC* o *Informe*, la aplicación salta a *Recursos*. Véase [Panel de recursos](docs://ref-resourcepaneel).

### Motivos de un error de planificación

- *Relación circular entre tareas: {path}* — las relaciones forman un ciclo. Las tareas aparecen en la ruta. Invierta o elimine una relación.
- *El calendario no tiene días laborables configurados* — dé al calendario al menos un día laborable. Véase [Ventanas de calendario](docs://ref-kalenders).
- *Duración en días no válida para la tarea '{task}'* y *Duración en horas no válida para la tarea '{task}'* — la duración de la tarea no es un número válido.
- *La tarea horaria '{task}' no tiene un horario laboral válido en su calendario* — una tarea en horas en un calendario sin horario laboral.
- *Fecha de inicio no válida para la tarea '{task}'* — la fecha de inicio de la tarea no es válida.

## Notificaciones

Las notificaciones aparecen en la parte inferior de la pantalla, también en la tabla, en Backstage y en el modo de presentación. Una notificación es un *error* o una *info*. Un error permanece hasta que usted lo cierre con un clic. Una info desaparece tras 5 segundos. Estos temporizadores vuelven a empezar en cuanto cambia la pila. Al hacer clic en una notificación, esta se cierra (texto de ayuda *Cerrar notificación*). Se muestran tres como máximo a la vez. Si llega una cuarta, se va primero la info más antigua. Si no hay ninguna info, se va la notificación más antigua. Así, una info nunca desplaza a un error. La pila se aleja de los botones de un cuadro de diálogo abierto y de las barras de acción fijas.

- **Contador ×N** — una notificación con clave fija agrupa las repeticiones en una línea con un contador. Por ejemplo, un error al guardar que vuelve a aparecer, o una relación rechazada que usted repite. No todas las notificaciones hacen esto.
- **Leer más** — algunas notificaciones tienen un enlace *Leer más* o un tema propio (por ejemplo *Reglas de trabajo explicadas*) que lleva a la guía en Backstage › Ayuda.
- **Botón de acción** — la notificación sobre el perfil de cálculo tiene un botón *Abrir perfil de cálculo* que lleva a Info del proyecto.

La lista siguiente es una selección, agrupada por tema. Si no se indica lo contrario, es una info.

### Guardar, abrir y recuperar

- **Error al guardar** (error) — *No se pudo guardar*, con el motivo debajo. Aparece al guardar, al guardar como y al exportar un informe.
- **Guardado como descarga** (info) — *Guardado como descarga: «{name}» está ahora en su carpeta de descargas. …* Aparece con *Guardar como* y con las exportaciones, cuando el entorno no deja que la aplicación escriba directamente en la ubicación elegida. Dos descargas seguidas se agrupan.
- **Guardado como descarga (explicación)** (info) — *Guardado como descarga: «{name}» está en su carpeta de descargas. Este navegador no deja que la aplicación escriba en un lugar propio, …* Aparece con *Guardar* en un navegador que solo guarda mediante descargas. Una vez por sesión, con un enlace a la explicación de los archivos.
- **El navegador no permite volver a escribir** (info) — *Este navegador no permite que la aplicación vuelva a escribir en «{name}». …* Aparece con *Guardar* en un proyecto que tiene archivo, cuando el navegador tiene que volver a pedir un lugar. Una vez por sesión, con un enlace a la explicación de los archivos.
- **Error de guardado automático** (error) — *Error de guardado automático* con el motivo. Se aplica al guardado automático en el archivo y a la recuperación tras un cierre inesperado.
- **No se pudo guardar la biblioteca** (error) — *No se pudo guardar la biblioteca*, al guardar la biblioteca de recursos.
- **Error al abrir un archivo** (error) — *No se pudo abrir el archivo* con el motivo. Por ejemplo, un archivo reciente o un archivo importado.
- **.mpp antiguo o protegido** (error) — *Este archivo .mpp usa un formato anterior (Project 2007 o anterior)…* o *Este archivo .mpp está protegido con contraseña…*, ambos con el consejo de exportar como XML en MS Project y abrir ese archivo.
- **XER no válido** (error) — uno de los textos *XER…*, por ejemplo *Este archivo XER no es válido o compatible.* o *El archivo XER contiene una tabla duplicada.*, con el motivo añadido.
- **No se pudo leer el IFC** (error) — *No se pudo leer el IFC* con el motivo, en la vista IFC.
- **Recuperación** (error) — *No se pudo leer el archivo recuperado*, *No se pudo restaurar* y *N archivos de recuperación no se pudieron cargar y se omitieron.* Aparece al recuperar tras un cierre inesperado.
- **Rama guardada como plantilla** (info) — *Rama guardada como plantilla '{name}'*.
- **Mensaje de una extensión** (info, o error si la extensión informa de un error) — *Extensión {name}: {message}*. Una extensión puede mostrar como máximo tres nuevas notificaciones cada 10 segundos, para que no llenen la pila. Si falla un paso de la guía de una extensión, aparece *Un paso de la extensión {name} ha fallado. La guía continúa.*, y si no se puede abrir un archivo de proyecto de una extensión, *No se pudo abrir el archivo de proyecto {file} de la extensión {name}.* Ambos son errores.
- **Un cambio intermedio** (info) — *Un cambio del asistente de IA o de una extensión llegó entre medias. …* Aparece cuando cancela el cuadro de diálogo de tarea y la IA o una extensión cambió algo mientras tanto. Las ediciones de tarea anteriores a ese cambio no se revierten. Siguen como pasos normales en *Deshacer*.

### Cálculo

- **No se pudo calcular la planificación** (error) — *No se pudo calcular la planificación* con el motivo debajo (véase *Motivos de un error de planificación*). Aparece al pulsar *Calcular*, al cambiar de documento y al abrir un archivo.
- **Fecha de estado puesta en hoy** (info) — *Aún no había fecha de estado: ahora es hoy ({date}), porque el avance se mide hasta la fecha de estado. Puede cambiarla en Planificación → Fecha de estado.* Aparece al introducir avance en un proyecto sin fecha de estado.
- **Duración menor que el trabajo realizado** (info) — *«{name}» ya está hecha en un {N} %: una duración menor que el trabajo ya realizado no es posible. La duración no se ha cambiado.*

### Relaciones y jerarquía

- **Relación creada** (info) — *Relación creada: {predecessor} → {successor}*.
- **Relación rechazada** (info) — *Esa relación ya existe.*, *No se permite una relación entre una tarea y su propia tarea de resumen antecesora.* o *Esta relación crearía un ciclo en la planificación ({cycle}) y no se ha creado.* El ciclo indica las tareas, así que usted sabe qué relación debe quitar o invertir primero.
- **Traslado rechazado** (info) — *Este traslado crearía un ciclo en la planificación ({cycle}): las relaciones de una tarea de resumen también se aplican a sus subtareas. No se ha movido nada.*
- **Relaciones que dejan de contar tras un traslado** (info) — *Tras el traslado, N relaciones vinculan una tarea con su propia tarea de resumen antecesora; ya no se tienen en cuenta en el cálculo.*
- **Relaciones omitidas al insertar** (info) — *N relaciones no se crearon: relación no válida…*, al pegar o insertar una rama.
- **Relaciones no contadas tras importar** (info) — *N relación(es) no se pudieron incluir en el cálculo. Revise las columnas Predecesores y Sucesores.*
- **Identificadores duplicados tras importar** (info) — *Objetos con un identificador duplicado en este archivo: N. Se les asignó su propio identificador…*

### Editar tareas

- **Inicio registrado como restricción** (info) — *'{name}' tiene una predecesora: el nuevo comienzo es ahora la restricción No comenzar antes del (SNET) {date}. Tras recalcular (F5), la tarea no empieza antes de esa fecha.* Aparece al cambiar el inicio de una tarea con predecesora. Si la tarea ya tenía esa restricción, el aviso indica que se movió. Para varias tareas a la vez, da un recuento.
- **Inicio no aplicado** (info) — *El nuevo inicio de '{name}' no se aplicó: la tarea tiene una predecesora y la restricción {type} {date}, y esas determinan su inicio. Cambie esa restricción para mover el inicio.*
- **Hito rechazado** (info) — *«{task}» tiene asignaciones de recursos y no puede convertirse en hito. Elimine primero las asignaciones.* o *«{task}» es una tarea de resumen con subtareas y no puede convertirse en hito.* Aparece al convertir en el cuadro de diálogo de tarea, en el panel de propiedades, en el menú contextual y en la tabla.
- **Asignaciones pasadas a una subtarea** (info) — *La asignación de {resources} se ha movido de «{phase}» a la nueva subtarea «{child}»: una tarea de resumen no lleva asignaciones propias.* Aparece cuando una tarea con asignaciones recibe subtareas.
- **Se quitó la marca de hito** (info) — *El hito «{phase}» ahora tiene subtareas y se ha convertido en tarea de resumen; se ha quitado la marca de hito.*
- **Tarea de resumen rechazada** (info) — *«{phase}» no puede convertirse en tarea de resumen: …* con el motivo, y *No se ha cambiado nada.*
- **Celdas omitidas al pegar** (info) — *Se omitieron N celdas: son de solo lectura (por ejemplo, un código WBS numerado automáticamente o una columna calculada).*
- **Referencias borradas al pegar** (info) — *N referencias no existían en este documento y se han borrado (calendarios de tarea, tipos de tarea personalizados, códigos de actividad o campos personalizados del documento de origen).*
- **La regla de trabajo ajustó duraciones** (info) — *Tras el cambio de calendario, la regla de trabajo ajustó la duración de N tareas (el trabajo se mantiene, cambiaron las horas por día).* Con un enlace *Reglas de trabajo explicadas*.

### Primavera (XER)

- **Archivo XER abierto** (info) — *Archivo XER abierto: N documentos de proyecto.* Una notificación por archivo, aunque el archivo abra varios proyectos, con un enlace *Leer más* y líneas de detalle debajo. Siempre *N proyectos encontrados.* Solo si el número es mayor que 0: *N proyectos vacíos omitidos.*, *N proyectos de línea base excluidos.*, *N líneas base materializadas.*, *N referencias de línea base sin destino ignoradas.*, *Se usó una alternativa protectora para la línea base.* y *N relaciones externas conservadas.* Solo con una codificación distinta de UTF-8: *Codificación de texto elegida: {encoding}.* Además, cuando el número es mayor que 0: *N hallazgos del analizador.*, *N hallazgos del calendario.*, *N problemas de formato numérico.*, *N alternativas de enumeración* y *N ajustes de planificación P6 usaron alternativas seguras.*
- **Fechas tal como las registró Primavera** (línea de detalle en la misma notificación) — *N tareas muestran las fechas tal como las registró Primavera (sin recalcular).*, o, si el modo no se activó, *N tareas difieren de las fechas registradas en el archivo — puedes mostrarlas.*
- **Archivo de origen XER no utilizable** (info) — *El archivo de origen XER de este fichero no se puede usar y se ha omitido; el proyecto en sí se ha abierto por completo.* con el motivo (por ejemplo *Motivo: la suma de comprobación no coincide con los bytes de origen: el archivo está dañado.*) y la consecuencia (*La planificación, el perfil de cálculo y todos los datos del proyecto del IFC están completos. …*). Aparece al abrir un archivo IFC en el que no se puede usar un archivo de origen XER guardado antes.
- **La exportación pierde información XER** (info) — *Al exportar a {format} se pierde información de origen XER.* Tras una exportación correcta a un formato distinto de IFC de un proyecto con datos que solo existen en un archivo XER. Con un enlace *Leer más*.

### Importar, exportar y perfil de cálculo

- **Fechas tal como están en el archivo** (info) — *N tareas muestran las fechas tal como están registradas en el archivo (sin recalcular).* o *N tareas difieren de las fechas registradas en el archivo — puedes mostrarlas.* Aparece al abrir un archivo con fechas registradas.
- **Trabajo y reglas de trabajo visibles** (info) — *Este archivo contiene trabajo guardado o reglas de trabajo propias; la regla de trabajo y el trabajo restante se muestran para este proyecto.*
- **Planificación de MS Project leída** (info) — *Este archivo de MS Project contiene N tareas con una planificación dividida, nivelada o determinada por recursos. Se importan y se muestran tal cual.*
- **Pausas no exportadas** (info) — *N tareas con interrupciones se han exportado sin sus interrupciones: MS Project/P6 solo las conocen como distribución del trabajo.* Al exportar a MS Project o Primavera.
- **Inicio del proyecto movido** (info) — *Inicio del proyecto movido: se desplazaron N anclas de tarea sin predecesora ni restricción a la nueva fecha de inicio.*
- **La ventana de fechas ya no controla** (info) — *La ventana de fechas de MS Project ya no controla N tareas tras esta edición; …* Una vez por documento.
- **Retraso de nivelación redondeado** (info) — *La nivelación redondea el retraso de nivelación de MS Project, preciso al minuto, de N tareas a días laborables completos.* Una vez por documento.
- **Perfil de cálculo aplicado** (info) — *Este proyecto calcula como {profile}. Cámbialo en Archivo → Info del proyecto → Perfil de cálculo y opciones.* Con el botón *Abrir perfil de cálculo*. Tras aplicar un perfil, si hace falta, sigue *Tras aplicar, se movieron N tareas.*
