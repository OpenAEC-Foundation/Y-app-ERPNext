# Abrir y guardar un archivo

Objetivo: abrir un proyecto desde un archivo y conservar sus cambios.

## Cuándo lo necesita

Empieza el día con el proyecto de ayer, recibe un archivo de un compañero o de otro paquete, o quiere guardar un estado intermedio antes de cambiar algo grande. Lo que la aplicación guarda en un archivo, y por qué solo IFC guarda todo su proyecto, se explica en [Archivos y formatos](docs://uitleg-bestanden).

## Pasos

### Abrir un archivo

1. Elija *Inicio › Archivo › Abrir*, o *Archivo › Abrir*, o pulse Ctrl+O (⌘+O en un Mac). *Abrir* también está en la barra superior. El grupo *Archivo* también está en la pestaña *Tabla*.
2. Elija el archivo. Abre un archivo a la vez. En el escritorio y en navegadores con acceso a archivos, como Chrome y Edge, la ventana muestra una lista de tipos de archivo: *Todos los compatibles*, *Archivos IFC*, *Archivos CSV*, *Archivos XML*, *Archivos de MS Project* y *Archivos XER de Primavera*.
3. El proyecto se abre en una pestaña nueva. Si la pestaña actual seguía vacía y sin cambios, el proyecto se abre en ella.

Un archivo IFC da su nombre de archivo a la pestaña. Un proyecto de otro formato recibe su nombre de proyecto.

La aplicación abre `.ifc`, `.csv`, `.xml` (XML de MS Project o XML de Primavera P6), `.mpp` y `.xer`. Para los dos últimos hay pasos aparte en [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen) y [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen).

### Abrir un proyecto reciente

Elija *Inicio › Archivo › Recientes* y haga clic en un archivo de la lista, o elija *Archivo › Recientes*. La lista guarda los últimos diez archivos que abrió, guardó o exportó. La aplicación de escritorio muestra la ruta de cada archivo; un navegador solo muestra el nombre.

Si la aplicación ya no puede leer un archivo de la lista, por ejemplo porque lo movió, desaparece de la lista sin ningún mensaje. En los navegadores sin acceso a archivos, como Firefox, la lista *Recientes* queda vacía.

### Abrir un ejemplo

Elija *Archivo › Ejemplos* y haga clic en un proyecto de ejemplo. Se abre en una pestaña, sin archivo: por eso *Guardar* le pregunta dónde quiere guardarlo.

### Guardar

Elija *Inicio › Archivo › Guardar* o *Archivo › Guardar*, o pulse Ctrl+S. Lo que pasa después depende de su proyecto:

1. Si el proyecto ya tiene un archivo, porque abrió un archivo IFC o lo guardó antes, la aplicación escribe en ese archivo. No aparece ninguna ventana.
2. Si el proyecto aún no tiene archivo, la aplicación pregunta dónde debe ir. Sugiere el nombre del proyecto con `.ifc`. Después, ese archivo es el archivo del proyecto.
3. Si su navegador solo guarda mediante una descarga (como Firefox), el archivo llega a su carpeta de descargas, y cada guardado crea una descarga nueva. La primera vez en una sesión ve el mensaje *Guardado como descarga: «name.ifc» está en su carpeta de descargas. Este navegador no permite que la aplicación escriba en un lugar propio, así que cada guardado crea una descarga nueva. En Chrome, Edge o la aplicación de escritorio, Guardar simplemente actualiza el mismo archivo.*
4. Si su navegador no puede escribir de nuevo en el archivo del proyecto, la aplicación pregunta dónde poner el archivo cada vez que guarda. Eso parece *Guardar como*, pero es un límite del navegador. La primera vez en una sesión, el mensaje *Este navegador no permite que la aplicación escriba de nuevo en «name.ifc».* lo explica, con un enlace a [Archivos](docs://uitleg-bestanden).

Después de guardar, desaparece la marca *Sin guardar*: el punto de la pestaña, el asterisco delante del nombre del proyecto arriba y el texto *Sin guardar* en la parte inferior derecha de la barra de estado.

### Guardar con otro nombre

Elija *Inicio › Archivo › Guardar como* o *Archivo › Guardar como*, o pulse Ctrl+Shift+S. Elija un nombre y una ubicación (en Firefox la aplicación descarga un archivo nuevo en su lugar). Después, el proyecto trabaja con este archivo nuevo: el siguiente *Guardar* escribe ahí. El archivo anterior queda como estaba la última vez que guardó.

### Cerrar un proyecto

Haga clic en la cruz de la pestaña, o elija *Archivo › Cerrar proyecto*. Si el proyecto tiene cambios que no guardó, la aplicación pregunta: *Cambios sin guardar: «name» tiene cambios que aún no se han guardado.* Elija *Cancelar* (el proyecto sigue abierto), *No guardar* (el proyecto se cierra y sus cambios se pierden) o *Guardar* (guarde primero y después cierre). Si cierra toda la aplicación en el escritorio (con el botón de cerrar, Alt+F4 o el menú de su sistema operativo), la aplicación pregunta esto para cada proyecto con cambios; *Cancelar*, o un guardado que falla, detiene el cierre. Después de un cierre normal así, la aplicación borra las copias de recuperación de esa sesión, así que la ventana de recuperación solo aparece después de un fallo real. Si un proyecto tiene cambios y cierra la pestaña o la ventana del navegador, el navegador pide confirmación.

## Errores frecuentes y qué hace entonces la aplicación

**Un archivo IFC abierto es de inmediato el archivo de su proyecto.** *Guardar* sobrescribe ese archivo, incluso si viene de otro programa. Si quiere conservar el original, elija primero *Guardar como*.

**Los otros formatos nunca se sobrescriben.** Un `.csv`, `.xml`, `.mpp` o `.xer` no tiene archivo después de abrirlo. *Guardar* escribe un archivo IFC nuevo y deja el original sin cambios.

**En Firefox, cada guardado crea un archivo nuevo.** La aplicación no puede escribir en su archivo allí. Descarga un archivo nuevo cada vez, con el nombre del proyecto como nombre de archivo y no con el nombre del archivo que abrió.

**Chrome y Edge piden permiso.** En el primer *Guardar* de un archivo que abrió, el navegador pregunta si la aplicación puede escribir en él. Si lo rechaza, la aplicación abre una ventana en la que elige un archivo nuevo. En Chrome y Edge también aparece esa ventana si escribir en el archivo existente falla, por ejemplo porque el archivo desapareció o está bloqueado.

**Guardar puede fallar.** Si el propio guardado da un error, la aplicación muestra *No se pudo guardar*, con el motivo. Su proyecto sigue abierto y sigue marcado como *Sin guardar*.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): qué contiene un archivo IFC y cómo la aplicación trata los formatos.
- [Activar el autoguardado](docs://howto-automatisch-opslaan): dejar que la aplicación actualice su archivo por sí misma.
- [Exportar](docs://howto-exporteren): crear una copia en otro formato.
- [Recuperarse después de un fallo](docs://howto-herstellen-na-een-crash): qué hacer si la aplicación no se cerró correctamente.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se conserva y qué no.
