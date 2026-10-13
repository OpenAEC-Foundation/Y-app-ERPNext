# Formatos de importación y exportación

Por formato de archivo: si puede abrir, guardar y exportar cada archivo, qué se conserva y qué no, y con qué perfil de cálculo se abre. Lo que hay detrás de todo esto, y un ejemplo con cifras, está en [Archivos y formatos](docs://uitleg-bestanden).

## De un vistazo

**Abrir** admite los formatos IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` y `.xer`. La aplicación trata cualquier archivo con otra extensión como IFC.

**Guardar** siempre escribe IFC. Solo un archivo IFC abierto se convierte en destino de guardado. Un proyecto de otro formato no tiene archivo tras abrirlo. Entonces *Guardar* pregunta dónde debe ir el archivo IFC.

**Exportar** admite IFC 4x3, MS Project XML, Primavera P6 XML, CSV y dos hojas de avance (Excel y CSV). Una exportación no cambia su proyecto.

**Solo lectura** son `.mpp` y `.xer`: la aplicación puede abrirlos, pero no escribirlos.

**PDF** solo se obtiene de un informe (vea [Tipos de informe](docs://ref-rapporttypes)). La aplicación no lee PDF.

**Dónde.** Para abrir: *Inicio › Archivo › Abrir*, *Archivo › Abrir* o Ctrl+O. Para exportar: *Inicio › Archivo › Exportar* o *Archivo › Exportar*. Un archivo de avance rellenado se lee con *Archivo › Importar*. También se puede usar el botón *Actualizar avance desde una hoja* en el grupo de cinta *Avance*, en las pestañas *Planificación*, *Tabla* e *Informe*.

**Perfil de cálculo al abrir.** Cada formato se abre con un perfil de cálculo. Lo que es, se explica en [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies). `.xer` se abre con *Primavera P6*, `.mpp` con *Microsoft Project*, y CSV, MS Project XML y P6 XML con *Open Planner Studio*. IFC conserva el perfil guardado en el archivo. Para `.xer` y `.mpp`, la aplicación indica que el proyecto calcula de esta manera. Solo IFC lleva el perfil de cálculo y las opciones de cálculo. De las opciones de cálculo, MS Project XML escribe como máximo el umbral crítico. Una exportación reabierta de otro formato se calcula como *Open Planner Studio*.

## IFC

**Abrir** — sí, `.ifc`. La aplicación lee IFC 4.3. Perfil de cálculo: el del archivo.

**Guardar** — sí. Es el único formato que se puede guardar. *Guardar* escribe todo su proyecto como archivo IFC. El archivo pasa a ser el destino de guardado.

**Exportar** — sí, como *IFC 4x3* (descrito como *Estándar BuildingSMART. Enlace 4D con modelos BIM.*). Nombre predeterminado: el nombre del proyecto con la extensión `.ifc`. Si su proyecto está vinculado a una biblioteca de recursos, la casilla *Guardar también el archivo de biblioteca* está debajo de las tarjetas en *Archivo › Exportar*. Con la casilla marcada, la aplicación pide después un lugar para *nombre-del-proyecto-biblioteca.ifc*. La casilla no aparece en la lista de la pestaña *Inicio*.

**Qué se conserva** — todo lo que pertenece al proyecto: tareas con estructura, duración, fechas y avance; relaciones con desfase; restricciones y fechas límite; calendarios; recursos y asignaciones, incluida la distribución de horas; líneas base; códigos de actividad y campos personalizados; notas; relaciones externas con otros proyectos; interrupciones; reglas de trabajo y tipos de tarea; los ajustes del proyecto, como la fecha de estado, el modo de progreso, el perfil de cálculo y las opciones de cálculo; el vínculo con una biblioteca de recursos. En un proyecto de un `.xer`, el archivo original de origen también se conserva. Un tipo de tarea personalizado se guarda como el tipo IFC `USERDEFINED`, con su nombre en el campo ObjectType. Así, otros programas IFC leen la tarea con normalidad. La aplicación también conserva el id fijo del tipo, de modo que cambiar el nombre no rompe el vínculo. Si alguien abre el archivo en otro equipo, el tipo aparece allí en *De este proyecto*, y no en sus propios *Mis tipos de tarea*.

**Qué no se conserva** — cómo ha configurado la pantalla (zoom, posición de desplazamiento, tarea seleccionada, fases contraídas, filtro y agrupación elegidos) y los ajustes de la aplicación ([Configuración](docs://ref-instellingen)). La pestaña *IFC* muestra el texto IFC de su proyecto.

## MS Project XML (MSPDI)

**Abrir** — sí. La aplicación reconoce un archivo `.xml` como MS Project XML por el elemento raíz `Project` del espacio de nombres de MS Project (o sin espacio de nombres). Perfil de cálculo: *Open Planner Studio*.

**Guardar** — no. Un proyecto así no tiene destino de guardado.

**Exportar** — sí, como *MS Project XML* (*Se abre en Microsoft Project. Estructura WBS completa.*). Nombre predeterminado: el nombre del proyecto con `.xml`.

**Qué se conserva** — tareas con estructura (nivel y WBS), duración, fechas y avance; relaciones con desfase, también en horas o porcentajes; restricciones, incluida la fecha límite; calendarios, incluidos los calendarios de tarea y de recurso; recursos y asignaciones, incluida la curva o la distribución de horas; la fecha de estado; el umbral crítico, como número entero de días laborables de 0 o más, con *Holgura total ≤ umbral*; la descripción de una tarea (como nota); la regla de trabajo de una tarea (como tipo de tarea de MS Project); un tipo de tarea personalizado, en un campo libre (`ExtendedAttribute`) que la aplicación vuelve a leer y que MS Project puede ignorar. De sus líneas base solo se conserva la activa, como línea base 0. Una tarea en horas conserva su unidad, y un hito conserva su tipo (inicio, fin o automático).

**Qué no se conserva** — notas (la lista de comprobación de una tarea), relaciones externas con otros proyectos, códigos de actividad y campos personalizados, una segunda restricción, la marca *Programada manualmente*, el retraso de nivelación, el punto de reanudación y el de parada de una tarea fuera de secuencia, las convenciones *El trabajo restante se reanuda tras la duración transcurrida* y *No mover las tareas no iniciadas a la fecha de estado* de un perfil de MS Project, y las demás opciones de cálculo. Las tareas interrumpidas sin distribución de horas se conservan sin sus interrupciones.

**Qué cambia en el proceso** — una restricción *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* sin la opción *Obligatorio (fijación forzada)* pasa a ser *No comenzar antes del (SNET)* o *No finalizar antes del (FNET)*. Una hamaca pasa a ser una tarea normal con fechas calculadas.

## Archivo de MS Project (`.mpp`)

**Abrir** — sí, desde MS Project 2010 hasta 2021. Perfil de cálculo: *Microsoft Project*. La aplicación solo lee el archivo: nunca cambia su `.mpp`. Un archivo de MS Project 2007 o anterior, y un archivo protegido con contraseña, lo rechaza con un mensaje que apunta a la exportación XML de MS Project.

**Guardar** — no. No hay destino de guardado: *Guardar* escribe un archivo IFC nuevo.

**Exportar** — no.

**Qué se conserva** — tareas con estructura, duración y restricciones; relaciones con desfase; calendarios; recursos y asignaciones; avance; un código WBS que usted mismo rellenó en MS Project. También se leen las fechas y la holgura que MS Project calculó por sí mismo, para la vista *Fechas tal como se guardaron*.

**Qué no se conserva** — líneas base, costes y tarifas, notas y los campos personalizados de MS Project. Vea [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen).

**Origen y licencia** — el lector de `.mpp` se escribió para Open Planner Studio y se deriva del código fuente y del conocimiento estructural de MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), una biblioteca Java bajo LGPL-2.1. La estructura y las constantes de campo se portaron a TypeScript. Open Planner Studio en sí es de código abierto bajo LGPL-3.0. El lector de `.xer` no es una derivación: MPXJ solo se consultó allí como fuente de comprensión.

## Primavera P6 XML

**Abrir** — sí. La aplicación reconoce un archivo `.xml` como P6 XML por el elemento raíz `APIBusinessObjects`. Perfil de cálculo: *Open Planner Studio*.

**Guardar** — no.

**Exportar** — sí, como *Primavera P6 XML* (*Para Oracle Primavera P6.*). Nombre predeterminado: el nombre del proyecto con `.xml`, igual que en una exportación de MS Project XML. Dé usted mismo nombres distintos a cada uno.

**Qué se conserva** — estructura WBS y tareas con duración, fechas y avance; relaciones con desfase; restricciones (también una segunda, como restricción flexible); calendarios; recursos y asignaciones; la fecha de estado (como `DataDate`); un tipo de tarea personalizado, en un campo propio, `OPS Custom Task Type`, que la aplicación vuelve a leer y que P6 puede ignorar.

**Qué no se conserva** — líneas base y fechas límite; códigos de actividad, campos personalizados, notas y relaciones externas; las opciones de cálculo. P6 no tiene desfase en porcentajes: la aplicación lo convierte en un número fijo de días. Un desfase en días naturales pasa a ser un desfase en tiempo laboral: 3 días naturales pasan a ser 3 días laborables. Una hamaca pasa a ser una tarea normal. Una tarea programada manualmente pasa a ser una tarea normal con fechas calculadas, y un retraso de nivelación de menos de un día se descarta.

## Archivo de Primavera (`.xer`)

**Abrir** — sí. Perfil de cálculo: *Primavera P6*. La aplicación solo lee el archivo: no escribe `.xer` y nunca cambia su archivo. Abre una pestaña por cada proyecto que tenga tareas. Un archivo sin actividades o con tablas dañadas lo rechaza con un mensaje.

**Guardar** — no. No hay destino de guardado: *Guardar* escribe un archivo IFC nuevo, con el `.xer` original dentro.

**Exportar** — no. Si exporta un proyecto de un `.xer` a CSV, MS Project XML o P6 XML, la aplicación indica que se pierde la información de origen de XER, aunque haya guardado el proyecto como IFC antes. A IFC no se pierde nada.

**Qué se conserva** — la estructura WBS y las actividades con duración, fechas, restricciones y avance; relaciones con desfase; calendarios; recursos con asignaciones; códigos de actividad; campos personalizados (UDF); notas; los ajustes de programación de P6. Una actividad del tipo *Nivel de esfuerzo* pasa a ser una hamaca. Un proyecto de línea base pasa a ser la línea base activa del proyecto que lo referencia. Una relación entre dos proyectos la guarda la aplicación como dato de origen.

**Qué no se conserva** — un proyecto sin actividades, y una relación entre dos proyectos como relación real en su planificación. Vea [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Abrir** — sí. La aplicación lee `;` y `,` como separador. Reconoce los encabezados de columna en inglés y en neerlandés (por ejemplo `Name` o `Naam`, `Duration` o `Duur`, `Predecessors` o `Voorgangers`). Las fechas pueden ser *aaaa-mm-dd*, *dd-mm-aaaa* o *dd/mm/aaaa*. Escriba un predecesor como código WBS, tipo de relación y desfase, por ejemplo `1.2FS+2d`. Perfil de cálculo: *Open Planner Studio*. El proyecto se llama *CSV Import*. Un `Task Type` que no es ninguno de los códigos fijos (como `CONSTRUCTION` o `INSTALLATION`, que la aplicación escribe ella misma) pasa a ser un tipo de tarea personalizado en *De este proyecto*, no en *Mis tipos de tarea*. Con `OPS Custom Task Type ID` se conserva el id de un tipo personalizado.

**Guardar** — no.

**Exportar** — sí, como *CSV (;)* (*Exportación de tabla universal. Todas las tareas con fechas y duraciones.*), en la tarjeta *CSV (separado por punto y coma)*. El archivo usa punto y coma como separador, está en UTF-8 con BOM y tiene encabezados de columna en inglés.

**Qué se conserva** — por tarea, estas columnas: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` y `Description`. La finalización va en porcentajes enteros.

**Qué no se conserva** — recursos, asignaciones, calendarios, restricciones, fechas límite, líneas base y la fecha de estado. Si las fechas están en la vista *Fechas tal como se guardaron*, la exportación deja vacías `Critical` y `Total Float` en las tareas cuyo archivo de origen no las registró.

## Hoja de avance (Excel y CSV)

**Abrir** — sí, mediante *Archivo › Importar* (*Actualizar avance desde una hoja*), o mediante el botón de ese nombre en el grupo de cinta *Avance* de *Planificación*, *Tabla* e *Informe*. La aplicación lee `.xlsx` y `.csv`, hasta 16 MB y 50.000 filas. Esto no abre un proyecto: actualiza el avance de su proyecto abierto. Vea [Importar avance desde una hoja de cálculo](docs://howto-voortgang-importeren).

**Guardar** — no.

**Exportar** — sí, como *Hoja de avance (Excel)* (*Avance (Excel)* en la lista) y *Hoja de avance (CSV)* (*Avance (CSV)*). Nombre predeterminado: *nombre-del-proyecto-avance*. El botón *Exportar hoja de avance* del mismo grupo de cinta crea la hoja de Excel en un solo clic. La hoja de Excel tiene anchos de columna fijos, campos bloqueados y control de fechas. La hoja CSV tiene el mismo contenido, como texto simple.

**Qué se conserva** — las columnas `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` y `Actual Finish`. Al leerla, la aplicación usa `Completion (%)`, `Actual Start` y `Actual Finish`. `Start` y `Finish` solo sirven para reconocer la notación de fechas y no cambian su planificación. La aplicación vincula las filas con las tareas por el `OPS Task ID`, o si no, por un código WBS único.

**Qué no se conserva** — todo lo que queda fuera de estas columnas: duración, relaciones, recursos y el resto de su planificación. Una tarea de resumen no recibe avance de la hoja.

## PDF

**Abrir** — no.

**Guardar** — no.

**Exportar** — sí, desde un informe: en la pestaña *Informe*, el botón *Exportar PDF*. La aplicación no envía por sí misma un informe a una impresora. Para imprimirlo, use el PDF. El contenido depende del tipo de informe: vea [Tipos de informe](docs://ref-rapporttypes) y [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken).

## Vea también

- [Archivos y formatos](docs://uitleg-bestanden): por qué IFC es el formato propio y qué pierde una exportación, con un ejemplo.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): los pasos.
- [Exportar](docs://howto-exporteren): elegir un formato y los mensajes tras una exportación.
- [Fechas tal como se guardaron](docs://uitleg-datums-zoals-opgeslagen): por qué un archivo abierto puede mostrar otras fechas.
- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): los perfiles de cálculo.
