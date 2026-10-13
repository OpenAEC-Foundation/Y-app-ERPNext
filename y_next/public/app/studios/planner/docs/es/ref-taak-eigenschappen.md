# Diálogo de tarea y panel de propiedades

Puede editar una tarea en dos lugares: en la ventana *Editar tarea* y en el panel *Propiedades*. Casi todos los campos son iguales en los dos. Este artículo explica, para cada campo, qué hace, cuál es el valor predeterminado y qué nota usted al respecto. Cómo crear y configurar una tarea está en [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen). Por qué el cálculo da ese resultado está en [Ruta crítica y holgura](docs://uitleg-kritiek-pad).

## Los dos lugares

- **Editar tarea** — la ventana de la primera tarea seleccionada. Ábrala con F2, con doble clic en una barra del diagrama de Gantt, o con clic derecho en una tarea del diagrama de Gantt o de la tabla y elija *Editar...*. Sus cambios se quedan en un borrador hasta que pulse *Guardar* (Intro). *Cancelar* (Esc) los descarta. *Guardar* está desactivado mientras el nombre esté vacío. Guardar cuenta como un solo paso de *Deshacer*, incluido lo que haga en las secciones *Regla de trabajo*, *Relaciones*, *Asignaciones* y *Códigos y campos*. Esas secciones ya actúan sobre el proyecto mientras edita, y *Cancelar* lo revierte.
- **Propiedades** — el panel de la columna derecha, para la tarea activa. Cada cambio surte efecto de inmediato. Los cambios seguidos en el mismo campo cuentan como un solo paso de *Deshacer*. Sin tarea, muestra *Seleccione una tarea para ver sus propiedades.* Actívelo o desactívelo con *Vista › Paneles › Propiedades*. Valor predeterminado: activado. El panel está junto al diagrama de Gantt y en la pestaña *Tabla*. No está en *IFC* ni en *Informe*, ni debajo del panel de recursos completo.

Solo en la ventana: *Tarea padre* y los botones *Guardar* y *Cancelar*. Solo en el panel: la papelera *Eliminar tarea*, el botón *Calcular* en la parte inferior, la sección *Interrupciones*, los tres marcadores bajo *Regla de trabajo* (período no laborable largo, MS Project, fechas registradas) y añadir relaciones e ir a una tarea vinculada en *Relaciones*. Todos los demás campos están en los dos lugares. La ventana muestra *Relaciones*, *Asignaciones* y *Códigos y campos* solo para una tarea existente.

Si ha cambiado algo que afecta a las fechas, pulse *Calcular*. El cálculo no se hace solo, a menos que *Calcular automáticamente* esté activado.

## General

- **Nombre** (en la ventana *Nombre \**) — el nombre de la tarea en el diagrama de Gantt, la tabla y los informes. Obligatorio: un nombre vacío no se guarda. Valor predeterminado para una tarea nueva: *Nueva tarea*.
- **Código WBS** — el código de estructura de la tarea, por ejemplo `RB-301`. Obligatorio. Con *Planificación › Estructura › WBS auto* el campo está desactivado (información sobre herramientas: *Los códigos WBS se numeran automáticamente (Planificación → Estructura)*), porque en ese caso la aplicación gestiona los códigos.
- **Descripción** — texto libre. No influye en el cálculo. Puede mostrarlo como la columna *Descripción* en la tabla.
- **Tipo** — el tipo de tarea. La lista tiene los grupos *Tipos integrados* (*Construcción*, *Instalación*, *Demolición*, *Logística*, *Inspección*, *Reubicación*, *Renovación*, *Mantenimiento*), *Mis tipos de tarea* y *De este proyecto*. *Otro* solo aparece si la tarea ya tiene ese tipo. Al final están *+ Nuevo tipo de tarea…* y *Gestionar tipos de tarea…*. Valor predeterminado: el tipo de la tarea padre; si no, *Construcción* (modo Construcción activado, el valor predeterminado) u *Otro*. Efecto: no influye en el cálculo. Puede agrupar y filtrar por tipo, y colorear las barras según el tipo. La aplicación guarda un tipo personalizado en su dispositivo. Cuando lo elige, se añade una copia al proyecto (*De este proyecto*). Si escribe en *+ Nuevo tipo de tarea…* un nombre que ya está en *Mis tipos de tarea*, aunque con otras mayúsculas, la aplicación no crea un segundo tipo sino que elige el existente. En *Gestionar tipos de tarea…* solo edita o elimina sus propios tipos. Un nombre vacío o un nombre que ya existe no se guarda. Si elimina un tipo que usa el proyecto abierto, la aplicación pregunta antes, y la copia del proyecto se conserva. Un tipo de *De este proyecto*, por ejemplo de un archivo de otra persona, solo pasa a su propia lista cuando pulsa *Añadir a mis tipos de tarea* en *Gestionar tipos de tarea…*.
- **Calendario** — el calendario en el que la tarea cuenta su duración, su fin y su holgura. Valor predeterminado: *Calendario del proyecto: {name}*. Efecto: una tarea con calendario propio trabaja en días distintos al calendario del proyecto. Tras un cambio, *Calcular* recalcula las fechas. Consulte [Calendarios y días laborables](docs://uitleg-kalenders).
- **Tarea padre** (solo en la ventana) — mueve la tarea bajo otra tarea. Valor predeterminado: el padre actual. *- Ninguna (raíz) -* la pone en el nivel superior. Una elección que crearía un ciclo en las relaciones se rechaza al pulsar *Guardar*, con un mensaje, y la ventana sigue abierta.

## Notas

- **Notas** — una lista de verificación en la tarea. *Añadir nota* añade una línea. La marca (*Hecho*) la tacha. El icono de papelera (*Quitar*) la elimina. Sin líneas, muestra *Aún no hay notas.* No influye en el cálculo. La columna *Notas* de la tabla las muestra con ✓ o ○ delante.

## Hito

- **Hito** — convierte la tarea en un hito. Valor predeterminado: desactivado. Efecto: la duración pasa a ser 0. La aplicación lo rechaza para una tarea de resumen (una tarea con subtareas) y para una tarea con asignaciones de recursos, con un mensaje. Quite antes las asignaciones. Si lo desmarca de nuevo, desaparecen *Tipo de hito* y *Obligatorio (contractual)*.
- **Tipo de hito** (solo para un hito) — *Automático*, *Hito de comienzo* o *Hito de fin*. Valor predeterminado: *Automático*. Efecto: un hito de comienzo se sitúa al inicio de un día, y un hito de fin al final. Con *Automático*, el hito cuenta como hito de comienzo cuando es predecesor, al inicio del día.
- **Obligatorio (contractual)** (solo para un hito) — marca un hito contractual, como una inspección o una entrega. Valor predeterminado: desactivado. Efecto: una marca para el diagrama de Gantt y los informes. No protege ninguna fecha. Para eso use una restricción o una fecha límite.

## Tiempo

- **Inicio** (en la ventana *Fecha de inicio*) — muestra el inicio calculado, la misma fecha que la barra de Gantt y la columna *Inicio*, no el ancla de planificación sin procesar. Obligatorio: si el campo está vacío, se usa un valor de reserva. Efecto al escribir: la nueva fecha pasa a ser el ancla planificada (columna *Inicio programado*). Si la tarea tiene un predecesor y todavía no ha empezado, la aplicación registra el nuevo inicio como restricción *No comenzar antes del (SNET)* en esa fecha, o mueve una SNET existente, con un mensaje. Tras *Calcular*, la tarea por tanto no empieza antes. Si hay una restricción distinta de *Lo antes posible (ASAP)* o de SNET, la aplicación no aplica el inicio y le indica qué restricción determina el inicio.
- **Duración** — cuánto tiempo trabaja la tarea. Escriba `5d` para días, o `12h` o `1h 30m` para horas. Un número sin unidad cuenta en la unidad de la tarea. Los días son siempre enteros. Las horas pueden tener decimales. Una entrada no válida muestra *Introduce un número entero de días u horas, por ejemplo 2d o 12h.* y el campo vuelve atrás. Valor predeterminado para una tarea nueva: 5 días (un hito, 0). El campo está desactivado para una tarea de resumen, una hamaca y un hito con duración 0. Su duración depende de otras tareas o es cero. Una tarea en horas está desactivada mientras *Activar planificación por horas* esté desactivado. Hay un botón con ese nombre. Efecto: tras *Calcular*, la duración determina el fin en el calendario de la tarea. Si la tarea tiene recursos y una regla de trabajo, la regla decide si se mueve el trabajo o las unidades. Si la tarea ya está parcialmente hecha, la aplicación rechaza una duración más corta que el trabajo realizado. Consulte [Días y horas](docs://uitleg-dagen-en-uren).
- **Unidad de duración** — una elección entre *Días* y *Horas*, con un botón de información al lado. Solo es visible cuando *Activar planificación por horas* y *Permitir planificación mixta de días/horas* están activados. Este último está activado de forma predeterminada cuando la planificación por horas lo está. Efecto: al elegir otra unidad, la aplicación convierte la duración de inmediato si el resultado es exacto. *Deshacer* lo revierte en un solo paso. Si no encaja exactamente, la unidad se mantiene y la aplicación lo indica. Un calendario sin horarios laborales válidos rechaza el cambio.
- **Regla de trabajo** — qué parte de duración × unidades = trabajo se mantiene fija cuando cambia una de las tres. Opciones: *Valor predeterminado del proyecto (Duración y unidades fijas)*, *Duración y unidades fijas*, *Duración y trabajo fijos*, *Trabajo fijo* y *Unidades fijas*. Valor predeterminado: el valor predeterminado del proyecto. Debajo está lo que la regla protege (*Protegido: …*) y, para una tarea de MS Project, *De MS Project: condicionado por el esfuerzo* o *De MS Project: no condicionado por el esfuerzo*. Solo es visible cuando *Mostrar reglas de trabajo y trabajo* está activado (*Configuración*, pestaña *Planificación*, sección *Cálculo*), o cuando el propio archivo contiene reglas de trabajo o trabajo guardado. Y solo para una tarea normal: no para una tarea de resumen, un hito, una hamaca ni una tarea en tiempo transcurrido. Consulte [Reglas de trabajo: duración, unidades y trabajo](docs://uitleg-werkregels).

## Hamaca

- **Hamaca (duración derivada)** — deja que la duración se derive de otras dos tareas, en lugar de tener una propia. Valor predeterminado: desactivado. Solo para una tarea normal, por tanto no para un hito ni una tarea de resumen. Activado: *Driver de inicio* muestra los predecesores con una relación fin-comienzo o comienzo-comienzo. *Driver de fin* muestra los que tienen una relación fin-fin o comienzo-fin. Cada uno muestra el tipo de relación detrás. Si no tiene driver de fin, muestra *Sin driver de fin (FF/SF) — el intervalo vuelve a longitud cero.* y la duración es cero. Consulte [Crear una hamaca](docs://howto-hammock).

## Restricción y fecha límite

En una tarea de resumen, una restricción o una fecha límite no tiene efecto. El cálculo solo calcula las tareas hoja y deriva las fechas de una tarea de resumen a partir de sus subtareas.

- **Restricción** — un límite de fecha para la tarea. Opciones: *Lo antes posible (ASAP)*, *Lo más tarde posible (ALAP)*, *No comenzar antes del (SNET)*, *No comenzar después del (SNLT)*, *No finalizar antes del (FNET)*, *No finalizar después del (FNLT)*, *Debe comenzar el (MSO)* y *Debe finalizar el (MFO)*. Valor predeterminado: *ASAP*, que equivale a ninguna restricción. Si elige ASAP, desaparecen todas las restricciones de la tarea. Si elige ALAP, desaparece la secundaria. Efecto tras *Calcular*: un límite mueve la tarea o hace negativa la holgura. Consulte [Restricciones y fechas límite](docs://uitleg-constraints).
- **Fecha de restricción** — la fecha que corresponde a la restricción. Visible para cada restricción excepto *ALAP*. Obligatoria. Una restricción nueva recibe el inicio planificado como fecha.
- **Obligatorio (lógica de fijación)** — solo para *MSO* y *MFO*. Valor predeterminado: desactivado. Activado: la fecha es firme, anula las relaciones y fija la barra incluso antes de sus predecesores. Una infracción se convierte en holgura negativa aguas arriba. La primera vez que lo activa, aparece una explicación una vez.
- **Restricción secundaria** y **Fecha secundaria** — un segundo límite, solo uno de *SNET*, *FNET*, *SNLT* o *FNLT* (o *(ninguno)*). Visible en cuanto hay una restricción principal que no es ASAP, ALAP ni una fijación firme. Siempre es flexible. Una combinación prohibida recibe un borde rojo y un motivo: una restricción secundaria no puede ser firme, ni con MSO/MFO ni con una fijación firme, ni con ASAP/ALAP. Debe ser un límite, y la principal y la secundaria no pueden limitar el mismo lado. Un par válido es, por ejemplo, SNET con FNLT.
- **Fecha límite** — una fecha objetivo para el fin. Vacía = sin fecha límite. Efecto: la tarea no se mueve por ella. Si el fin temprano es posterior, la holgura pasa a ser negativa y la aplicación informa *Fecha límite … no cumplida — fin temprano …*.

## Avance

- **Avance (%)** — una barra deslizante de 0 a 100. Valor predeterminado: 0. Efecto: por encima de 0, la aplicación rellena un *Inicio real* que falte, y al llegar a 100 se rellena el *Fin real*. El estado se define así: *No iniciada* sin inicio real, *En curso* con inicio real y *Completada* con fin real. La duración restante (*Restante*) es la duración × (1 − avance), redondeada a días enteros en una tarea en días y a minutos enteros en una tarea en horas. El trabajo realizado se mide hasta la fecha de estado. Si todavía no hay fecha de estado, la aplicación la fija en hoy y lo indica. En una tarea de resumen el campo está desactivado: su avance depende de sus subtareas tras *Calcular* (*Derivado de las subtareas: cambie el progreso allí. La tarea de resumen se actualiza tras calcular (F5).*).
- **Inicio real** — la fecha en que la tarea realmente empezó. Una fecha posterior al fin real o a la fecha de estado se rechaza. Si la tarea está planificada para empezar solo después de la fecha de estado y ahora recibe avance, la ventana pregunta *Indicar el inicio real*. Para un hito hay un solo campo, *Fecha real*, en lugar de *Inicio real* y *Fin real*.
- **Fin real** — la fecha en que la tarea realmente terminó. Al rellenarlo, el avance pasa a 100 y el estado a *Completada*. Al borrarlo, el avance vuelve a 0 y el estado a *En curso*. Se aplican los mismos rechazos que en *Inicio real*.
- **Restante** — solo lectura (no para un hito): cuánta duración queda, en la unidad de la tarea.

La ventana aplica estas reglas al borrador. Solo cuentan después de *Guardar*. Consulte [Avance, fecha de estado y línea base](docs://uitleg-voortgang).

## Resultado CPM

- **Resultado CPM** — vista de solo lectura del último cálculo: *Inicio temprano*, *Fin temprano*, *Inicio tardío*, *Fin tardío*, *Holgura total*, *Holgura libre*, *Holgura interferente* y *Ruta crítica* (*Sí* o *No*). La holgura se expresa en días laborables, con dos decimales. ¿Está desactualizado o todavía no calculado? Pulse *Calcular*.

## Relaciones

- **Relaciones** — las relaciones de esta tarea, una línea por relación: la tarea vinculada (en el panel el código WBS, o el nombre si falta; en la ventana el nombre), un icono de rayo si la relación es determinante (*Relación determinante (relación determinante)*, tras un cálculo), el tipo de relación (*FS*, *SS*, *FF* o *SF*), el desfase y una papelera. En el panel el código WBS es un botón: al pasar el ratón sobre él muestra la tarea, y al hacer clic salta a ella. Una pequeña marca delante del código muestra el papel: una marca redonda dorada para un predecesor y un cuadrado morado para un sucesor, los mismos colores que en [Seguir una ruta](docs://howto-pad-traceren). El papel también aparece en el nombre del botón, para un lector de pantalla. En la ventana es texto simple, y solo ve la sección si la tarea tiene relaciones.
- **Desfase** — escriba un número con unidad: `2d` días laborables, `3ed` días naturales, `2u` o `2h` horas laborables, `3eu` o `3eh` horas naturales, `50%` un porcentaje de la duración del predecesor, `-25e%` un porcentaje en tiempo natural. Un signo menos lo convierte en un adelanto. Sin unidad cuenta como días laborables. Una entrada no válida pone el campo en rojo y vuelve al valor anterior. Consulte [Relaciones y desfase](docs://uitleg-relaties).
- **Añadir relación** (solo en el panel) — abre una fila de borrador. En *Dirección* elija *Predecesora* o *Sucesora*. Busque la tarea con *Buscar tarea…* por WBS o por nombre, elija el tipo y el desfase, y confirme con *Crear relación* (o *Cancelar*). Un duplicado, o una relación con el propio padre de la tarea, se rechaza con un mensaje, y la fila sigue abierta.

## Interrupciones

Solo en el panel, y no para un hito, una tarea de resumen, una hamaca, una tarea en tiempo transcurrido, una tarea programada manualmente ni una tarea demasiado corta para una interrupción.

- **Interrupciones** — pausas en el trabajo de la tarea. Una línea por interrupción: *tras* (cuánto trabajo hay antes de la interrupción), *pausa* (la duración) y la unidad (*días laborables*; para una tarea en horas, *horas*), con el inicio y el fin del tramo siguiente, debajo. Una interrupción creada por la *nivelación* lleva la insignia *nivelación*. Una interrupción de duración 0 la elimina. El icono de papelera de cada línea (*Quitar la interrupción*) también la elimina. Efecto: la barra se dibuja interrumpida y, tras *Calcular*, el fin se desplaza según la duración de la interrupción.
- **Añadir interrupción** — añade una interrupción de una unidad en el centro de la parte más larga. Desactivado cuando no hay espacio para una interrupción.
- **Quitar todas las interrupciones** — aparece cuando las interrupciones proceden de un archivo de origen en una forma que no se puede editar aquí (*Estas interrupciones proceden del archivo de origen en una forma que no se puede editar aquí.*). Entonces solo ve las fechas.

Véase [Dividir una tarea](docs://howto-taak-splitsen).

## Asignaciones

- **Asignaciones** — los recursos de esta tarea. Por recurso: el nombre con una papelera (*Quitar*), *Uds./día*, *Trabajo (rest.)*, *Curva*, un botón *Distribución de horas…* y *Mover a…*. Al final hay una lista *Asignar recurso*; asigna el recurso con 1 unidad por día. Sin recursos dice *Crea primero recursos (pestaña Recursos).*; cuando todos están asignados, dice *Todos los recursos ya están asignados.* Para un hito o una tarea de resumen dice que no es posible asignar.
- **Uds./día** — cuánto del recurso usa la tarea por día, un número mayor que 0. Efecto: la carga en el histograma y la sobreasignación y, con una regla de trabajo, el trabajo.
- **Trabajo (rest.)** — trabajo restante en horas para este recurso. Solo es visible cuando las reglas de trabajo están visibles y la tarea tiene una; para material hay un guion. El candado muestra qué esquina protege la regla de trabajo (*Protegido por la regla de trabajo …*). El triángulo de advertencia (*Difiere de unidades × duración*) significa que el trabajo guardado no es igual a unidades × duración restante; el histograma sigue entonces el trabajo guardado.
- **Curva** — cómo se reparte el trabajo a lo largo de la duración: *Uniforme*, *Cargado al inicio*, *Cargado al final*, *Forma de campana*, *Pico temprano*, *Pico tardío*, *Doble pico* o *Tortuga*. Predeterminado: *Uniforme*. Si la asignación tiene su propia distribución de horas, dice *Contorno* y la lista está desactivada; una curva importada se llama *Curva importada*.
- **Distribución de horas…** — abre la distribución de horas por día laborable de esta asignación. Véase [Ajustar la distribución de horas](docs://howto-urenverdeling-aanpassen).
- **Mover a…** — mueve la asignación a otra tarea sin subtareas que todavía no tiene el recurso. Solo es visible cuando existe esa tarea.

## Códigos y campos

- **Códigos y campos** — solo es visible cuando el proyecto tiene códigos de actividad o campos personalizados. Cada código de actividad es una lista con *(ninguno)* y los valores como `código — descripción`; por tipo elige como máximo un valor. Cada campo personalizado tiene una entrada que corresponde a su tipo: *Texto*, *Número*, *Número entero*, *Coste*, *Fecha* o *Sí/no*. Efecto: no influye en el cálculo; puede agrupar y filtrar por ellos y mostrarlos como columnas. Véase [Códigos y campos personalizados](docs://howto-codes-en-velden).

## Marcadores bajo la regla de trabajo

Solo en el panel, y solo cuando corresponden.

- **Período no laborable largo** — *Esta tarea abarca un período no laborable de … días (… a …).*, o con el nombre del festivo o de la pausa de obra añadido. Aparece cuando la tarea abarca un período continuo no laborable de 8 días o más que contiene al menos un festivo. Es una advertencia, no un rechazo; compruebe si la planificación es así como se pretende.
- **Marcador de MS Project** — una insignia *Sigue la distribución de horas de MS Project*, *La ventana de fechas de MS Project ya no se aplica tras editar — …* o *Distribución de horas propia*, con *Leer más*. Indica si la distribución de horas de un archivo de MS Project todavía determina las fechas.
- **Fechas registradas** — una insignia para un archivo importado con fechas registradas: *Muestra las fechas tal como se guardaron en el archivo para esta tarea* (para un archivo de Primavera, *Muestra las fechas propias registradas por Primavera para esta tarea*), *Difiere de las fechas registradas* o *El registro está parcialmente incompleto — véanse las columnas de fin tardío/holgura*, con *Leer más*. Véase [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen).

## Cabecera y pie del panel

- **Eliminar tarea** — el icono de papelera junto al encabezado *Tarea*; elimina esta tarea junto con sus subtareas, como un solo paso bajo *Deshacer*. Después la planificación queda desactualizada hasta que pulse *Calcular*.
- **Calcular** — el botón al final; es el mismo cálculo que *Inicio › Programación › Calcular*.

## Lo que no encontrará aquí

- **Prioridad de nivelación** — no está en la ventana ni en el panel. Se establece haciendo clic derecho y eligiendo *Prioridad* (*Baja* = 100, *Normal* = 500, *Alta* = 900), o escribiendo un número de 0 a 1000 en la columna *Prioridad de nivelación*. Predeterminado: 500. Efecto: la nivelación mantiene primero en su sitio las tareas con mayor prioridad; 1000 fija la tarea, así que la nivelación nunca la mueve. Véase [Nivelación](docs://uitleg-nivelleren).
- **Otros datos de la tarea** — el resto de lo que lleva una tarea, como las columnas *Programada manualmente*, *Color* y las columnas técnicas, solo está en la tabla; véase [Columnas de la tabla](docs://ref-tabelkolommen).
