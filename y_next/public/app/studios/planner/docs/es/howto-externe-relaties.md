# Relaciones externas con otro proyecto

Objetivo: vincular una tarea de este proyecto con una tarea de otro archivo de proyecto, para que su planificación tenga en cuenta las tareas que se planifican en otro lugar.

## Cuándo lo necesita

Su ampliación solo puede empezar cuando el solar esté preparado para la construcción, y esa tarea está en el proyecto del contratista. O bien, el instalador solo puede empezar cuando su estructura esté terminada, y él planifica en su propio archivo. Una relación normal solo funciona entre tareas del mismo proyecto. Una **relación externa** vincula una tarea con una tarea de otro archivo.

Una relación externa no se calcula en directo con el otro proyecto. La aplicación guarda una **fecha de anclaje** fija: la fecha de la tarea externa en el momento en que la vincula. El cálculo usa esa fecha como límite. Si el otro proyecto cambia, en el suyo no se mueve nada hasta que actualice el anclaje.

## Pasos

1. Seleccione exactamente una tarea de este proyecto: la tarea que depende de la tarea externa, o la tarea de la que depende la tarea externa.
2. Elija *Inicio › Tareas › Vincular ▾ › Añadir relación externa…*. El mismo menú está en *Planificación › Relaciones* y en *Tabla › Tareas*. La opción solo está disponible si hay exactamente una tarea seleccionada.
3. En la ventana *Enlace externo (entre proyectos)* elija una de las dos vías. Con *Archivo de origen* elija el archivo del proyecto en *Elegir un archivo reciente* y después la *Tarea de origen*. La aplicación lee el archivo en solo lectura, no lo abre como documento y obtiene la fecha de anclaje por sí sola. Esta vía solo funciona en la aplicación de escritorio y solo para un archivo de la lista de archivos recientes; si no, el botón *Archivo de origen* está desactivado. Con *Manual (alternativa)* rellene el *Id de proyecto* y el *Id de tarea* de la tarea externa, opcionalmente el *Nombre de la tarea (opcional)*, y la *Fecha de anclaje*. En la versión del navegador esta es la única vía.
4. En *Dirección* elija si la tarea externa es su predecesora o su sucesora: *Predecesora (externa → yo)* o *Sucesora (yo → externa)*.
5. Elija el *Tipo de relación* (FS, SS, FF o SF) y, si hace falta, rellene *Retraso (días laborables)*, por ejemplo `0d` o `2d`.
6. Haga clic en *Añadir enlace* y pulse **Calcular** (F5).

La fecha que introduce como anclaje en una relación manual depende de la dirección y del tipo:

- Con un **predecesor** externo cuenta la primera letra del tipo: F significa la fecha de fin de la tarea externa, S la fecha de inicio. Con FS y FF introduzca, por tanto, la fecha de fin; con SS y SF, la de inicio.
- Con un **sucesor** externo cuenta la segunda letra: S es la fecha de inicio de la tarea externa, F la fecha de fin. Con FS y SS introduzca, por tanto, la de inicio; con FF y SF, la de fin.

Si planifica en horas (planificación por horas activada y una tarea en un calendario con horarios laborales), el campo *Fecha de anclaje* también pide una hora.

Ejemplo: el proyecto de obra termina el viernes 18 de junio de 2027. Vincule *Groundwork* con un predecesor externo de tipo FS, fecha de anclaje 18 de junio de 2027. Después de **Calcular**, groundwork empieza el lunes 21 de junio, el primer día laborable después del anclaje. Un sucesor externo funciona al revés: limita hasta cuándo puede terminar su tarea.

## Qué ve y cómo lo gestiona

- Las relaciones externas aparecen como texto en las columnas *Predecesoras* y *Sucesoras* de la tabla de tareas (añádalos con el **+** del encabezado de la tabla, en *Relaciones*), con el nombre del proyecto, el nombre de la tarea y el tipo. Un pequeño triángulo con *Falta el origen* indica que no se ha leído el origen. Mantenga el ratón sobre la relación para ver el proyecto (la línea *Id de proyecto* muestra el nombre del proyecto en cuanto se conoce), el Id de tarea, la fecha de anclaje y el estado del origen.
- En el Gantt hay una barra gris fantasma en la tarea. Con un predecesor, termina en el anclaje; con un sucesor, empieza en él. Un borde discontinuo con la etiqueta roja *obsoleto* indica que no se ha leído el origen. Con una relación manual, eso siempre ocurre.
- Haga clic con el botón derecho en una relación de la columna para *Editar relación externa…* y *Eliminar relación*. Si la relación tiene un archivo de origen, también aparece *Actualizar origen*.
- Elija *Vincular ▾ › Actualizar todas las relaciones externas* para leer otra vez los archivos de origen y actualizar los anclajes. Eso solo funciona en la aplicación de escritorio. Si solo tiene relaciones manuales, la aplicación muestra *No hay fuentes externas actualizables (falta la ruta del archivo).* Pulse **Calcular** después de actualizar.
- Si cambia el tipo o la dirección y el anclaje necesita otro lado de la tarea externa (inicio en lugar de fin, o al revés), la aplicación pide un nuevo anclaje en una relación manual: *Elija un nuevo anclaje: el tipo de relación ahora usa el otro lado de la tarea de origen.* Con una relación que tiene archivo de origen, la aplicación vuelve a leer el anclaje por sí sola.

## Errores frecuentes y qué hace la aplicación

**El otro proyecto no se mueve con él.** Si la tarea externa cambia de fecha, su planificación sigue calculando con el anclaje antiguo hasta que lo actualice o cambie el anclaje. Con la vía manual cambia usted mismo la fecha de anclaje: haga clic con el botón derecho en la relación y elija *Editar relación externa…*.

**Un predecesor externo es un límite inferior.** Si su tarea empieza más tarde de lo que exige el anclaje por sus propios predecesores, gana esa relación. El anclaje solo empuja.

**Un sucesor externo es un límite superior.** Si el anclaje es demasiado ajustado, lo ve como holgura negativa en su tarea y en las tareas anteriores. No aparece ningún aviso aparte, así que vigile la columna *Holgura total*.

**Solo un desfase fijo.** En una relación externa no puede indicar un desfase en días naturales ni en porcentajes; la aplicación muestra *Las relaciones externas solo admiten un desfase fijo en días o tiempo de trabajo.* Los días laborables cuentan según el calendario de su propia tarea. Un desfase en horas solo cuenta para una tarea planificada en horas; en una tarea en días, el cálculo lo ignora. Utilice entonces días laborables.

**El Id de proyecto de otro archivo.** El Id de proyecto no está en un campo ni en una columna, sino que se guarda como `InternalProjectId` en el IFC de ese proyecto: abra el proyecto, vaya a la pestaña *IFC* y elija *Generar IFC*. El cálculo solo usa la fecha de anclaje; el id no es solo una etiqueta. Al actualizar, la aplicación reconoce primero un archivo de origen por su Id de proyecto (y después por su ruta de archivo). Si introduce con una relación manual el mismo id que el de un archivo de origen, la relación se actualiza a la vez cuando se actualiza ese archivo. El *Id. de tarea* de una tarea de otro proyecto está en la tabla de ese proyecto, en la columna *Id. de tarea* bajo *Técnico*.

## Véase también

- [Relaciones y desfase](docs://uitleg-relaties): cómo calcula la aplicación una relación y un desfase.
- [Añadir relaciones](docs://howto-relaties-leggen): relaciones entre tareas del mismo proyecto.
- [Restricciones y fechas límite](docs://uitleg-constraints): límites de fecha en una tarea, sin otro proyecto.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene una relación externa en *Car park paving* (un predecesor externo).
