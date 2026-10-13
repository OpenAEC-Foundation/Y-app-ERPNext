# Abrir un archivo de Primavera P6 (.xer)

Objetivo: abrir una planificación de Primavera P6 directamente en la aplicación, sin exportarla antes a XML.

## Cuándo lo necesita

Un cliente o el contratista principal trabaja en Primavera y entrega su planificación como archivo `.xer`. Usted quiere verla, calcularla o añadirle contenido. La aplicación solo lee archivos `.xer`: no escribe `.xer` y nunca cambia su archivo. Del archivo toma la estructura WBS y las tareas con duración, fechas, restricciones y avance, las relaciones con desfase, los calendarios y los recursos con sus asignaciones, además de los códigos de actividad, los campos personalizados (UDF), las notas y la configuración de cálculo de P6. Una tarea del tipo *Level of Effort* se convierte en una hamaca.

## Pasos

1. Elija *Inicio › Archivo › Abrir* o pulse Ctrl+O. Elija el archivo `.xer`.
2. La aplicación abre una pestaña por cada proyecto que tiene tareas. El proyecto con más tareas es la pestaña activa. Una pestaña se llama *Nombre del proyecto (ID del proyecto)* si el ID de proyecto de P6 es distinto del nombre.
3. Lea el mensaje de la parte inferior. En un archivo con tres proyectos puede tener este aspecto: *Archivo XER abierto: 3 documentos de proyecto.* Debajo hay líneas que explican lo que hizo la aplicación. Vea el encabezado de más abajo.
4. Compruebe si hay una barra debajo de la cinta: *Estás viendo la planificación tal como la registró Primavera; recalcular desplazaría 1 tarea.* Primavera guarda sus propias fechas calculadas en el archivo. Si el cálculo de la aplicación difiere de ellas, la aplicación muestra las fechas de Primavera mientras usted no cambie nada. Lo que significa, y cómo se pasa al cálculo propio de la aplicación, se explica en [Fechas tal como se registraron](docs://uitleg-datums-zoals-opgeslagen). También puede aparecer el mensaje *Este archivo contiene planificación por horas.* con el botón *Activar planificación por horas*. Vea [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).
5. Guarde su proyecto con Ctrl+S. Como un `.xer` nunca se sobrescribe, la aplicación le pregunta dónde debe ir el nuevo archivo IFC. Sugiere *Nombre del proyecto (ID del proyecto)* como nombre de archivo.

### Las líneas debajo del mensaje

La primera línea del mensaje indica el número de pestañas abiertas. Debajo solo están las líneas que aplican. Estas merecen su atención:

- *Este proyecto calcula como Primavera P6. Cámbialo en Archivo → Info del proyecto → Perfil de cálculo y opciones.* La aplicación calcula este proyecto con las reglas de cálculo de Primavera. Con *Abrir perfil de cálculo* va a la configuración.
- *1 proyecto de línea base excluido.* y *1 línea base materializada.* Si un proyecto de P6 designa otro proyecto como su línea base, ese otro proyecto no se abre como pestaña propia. Pasa a ser la línea base activa del proyecto que lo menciona.
- *Se usó una alternativa protectora para la línea base.* Si designar líneas base significara que no se abre ningún proyecto, si un proyecto se refiere a sí mismo o si los proyectos se refieren unos a otros en un bucle, la aplicación abre simplemente todos los proyectos y no crea líneas base.
- *1 relación externa conservada.* Una relación entre dos proyectos. La aplicación la conserva como datos de origen, pero no la convierte en una relación de su planificación.
- *1 tarea muestra las fechas tal como las registró Primavera (sin recalcular).* El número de tareas que ve en la vista *Fechas tal como se registraron*.

Las otras líneas son diagnósticos de la lectura misma: el número de proyectos encontrados, un proyecto vacío omitido, una referencia huérfana a una línea base ignorada, una codificación de texto distinta de UTF-8 normal, contadores de hallazgos en las tablas, los calendarios y los números, valores de campo desconocidos, y la configuración de cálculo de P6 que la aplicación sustituyó por una opción segura. No le piden nada. *Leer más* abre la Ayuda sobre la apertura de archivos de Primavera.

## Escollos y qué hace la aplicación en ese caso

**No todo se convierte en pestaña o relación.** Un proyecto sin tareas no se abre, un proyecto de línea base no se abre como pestaña propia y una relación entre dos proyectos no se convierte en una relación de su planificación. La aplicación lo indica en las líneas debajo del mensaje.

**Cada pestaña es un proyecto propio.** Si guarda una, el archivo IFC conserva el `.xer` original completo. Si abre después ese archivo IFC, la aplicación sigue conociendo las fechas de Primavera. Si ese archivo de origen está dañado, o si otro programa IFC reescribió el archivo, la aplicación informa: *El archivo de origen XER de este fichero no se puede usar y se ha omitido; el proyecto en sí se ha abierto por completo.* La planificación, el perfil de cálculo y todos los datos del proyecto están completos. Lo que falta son las fechas tal como las guardó Primavera y la procedencia de los datos de origen para la IA y las extensiones. Abra de nuevo el `.xer` original para recuperar el archivo.

**Una exportación a CSV, MS Project XML o P6 XML pierde datos.** La aplicación advierte: *Al exportar a CSV se pierde información de origen XER.* IFC no pierde nada.

**Un archivo que la aplicación no puede leer.** Recibe un mensaje de error, con el motivo. Algunos ejemplos:

- *Este archivo XER no es válido o compatible.*
- *Faltan columnas obligatorias en una tabla XER.*
- *El proyecto P6 de este archivo XER no contiene actividades.*

Entonces no se abre nada. Revise el archivo en P6 o pida al remitente una nueva exportación.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): por qué un `.xer` solo se lee y qué pierde una exportación.
- [Fechas tal como se registraron](docs://uitleg-datums-zoals-opgeslagen): la vista de las fechas propias de Primavera.
- [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen): lo mismo para MS Project.
- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): si el archivo contiene datos en horas.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se conserva y qué no.
- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): por qué un archivo P6 se abre con su propio perfil de cálculo.
