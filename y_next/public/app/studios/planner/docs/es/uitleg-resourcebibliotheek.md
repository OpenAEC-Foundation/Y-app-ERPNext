# La biblioteca de recursos

Su cuadrilla de albañiles no trabaja para un solo proyecto. Hoy está en las casas del norte, mañana en los garajes del sur. Una **biblioteca de recursos** es el lugar donde usted registra una vez esa cuadrilla, para que todos los proyectos usen la misma. La aplicación también puede ver cuándo dos proyectos piden las mismas personas el mismo día, algo que ningún proyecto por sí solo puede ver. En este artículo verá cómo se relacionan la biblioteca y el proyecto, y cómo la aplicación cuenta la ocupación entre proyectos.

## El concepto

Hay dos capas.

La **biblioteca de recursos** es la lista de recursos y calendarios que pertenecen a su organización: un albañil, una grúa, un yesero, con su tipo, su tarifa por hora y cuántos tiene. La lista misma, a la que la aplicación también llama **biblioteca de recursos**, no está en los archivos de su proyecto sino en la aplicación: en la aplicación de escritorio, en un archivo de este equipo; en el navegador, en el almacenamiento de ese navegador. Si borra los datos del sitio en el navegador, la biblioteca desaparece; por eso expórtela como copia de seguridad. Siempre hay al menos una biblioteca. La primera se llama *Mijn resourcebibliotheek* (un nombre en neerlandés) y usted puede cambiarle el nombre.

El **proyecto** decide cuánto de un recurso usa y cuándo. Un proyecto está vinculado a una biblioteca o funciona por sí solo. Un proyecto independiente funciona bien, solo que sin una lista compartida.

Un proyecto no apunta a la biblioteca, sino que guarda una **copia**. Cuando asigna *Bricklayer* de la biblioteca a un proyecto, la aplicación crea en el proyecto una copia con una **marca de origen**: la nota que indica que esta copia viene de la biblioteca X y es el elemento Y allí. En la tabla de recursos reconoce una copia así por un pequeño icono de biblioteca. La copia es un recurso normal: se le pueden asignar tareas, y se guarda en el propio archivo del proyecto.

Los calendarios de la biblioteca de recursos son otra cosa que la lista de calendarios de su proyecto, que usted gestiona en el cuadro de diálogo de calendarios. Un calendario de la biblioteca llega a su proyecto junto con un recurso que lo usa.

## Cómo funciona la aplicación con ella

### Qué decide la biblioteca de recursos y qué decide el proyecto

La biblioteca decide **qué es un recurso**: el nombre, el tipo, la tarifa por hora, la unidad y la descripción. En una copia del proyecto esos campos aparecen como texto normal. Usted los cambia en la biblioteca, para que sean correctos en todos los proyectos. Si, al fin y al cabo, quiere que una copia siga su propio camino, la desvincula de la biblioteca.

El proyecto decide **cuánto y cuándo**: *Unidades máx*, la capacidad que cambia con el tiempo (*Capacidad escalonada en el tiempo*) y qué calendario tiene el recurso. Esos campos siguen siendo editables en el proyecto y no cuentan como desviación de la biblioteca. Al fin y al cabo, la misma cuadrilla puede trabajar con otro calendario en una obra urgente que en un proyecto normal. El contenido de un calendario que llegó junto con un recurso sí sigue a la biblioteca.

### Cuándo se actualiza una copia

La biblioteca no actualiza las copias sin parar, sino en momentos fijos:

- Cuando edita algo en la biblioteca, las copias no editadas de todos los proyectos abiertos se actualizan de inmediato.
- Cuando abre un proyecto o cambia a otra pestaña, la aplicación compara las copias con la biblioteca. Si una copia no editada va por detrás, la aplicación la actualiza en silencio e informa brevemente: *1 elemento actualizado desde la biblioteca* o *N elementos actualizados desde la biblioteca*.

La aplicación recuerda los valores del momento en que se creó o actualizó la copia. Si una copia ahora difiere de esos valores, la aplicación no decide quién tiene razón. La copia recibe entonces la marca *difiere — decidir*. Cuando abre un archivo con una copia así, la ventana *Vincular biblioteca de recursos* se abre por sí sola. Allí elige por elemento si se aplican los valores de la biblioteca o si los valores de su archivo pasan a la biblioteca. Al cambiar de pestaña nunca aparece ninguna ventana.

Una desviación surge, por ejemplo, cuando usted vincula un recurso propio del proyecto con un elemento de la biblioteca que tiene el mismo nombre pero otros valores, mediante *A la biblioteca*. La aplicación sí los vincula y marca la copia como desviada de inmediato.

### Cuando un recurso desaparece de la biblioteca de recursos

Si borra un recurso de la biblioteca, la copia se queda en sus proyectos y sigue funcionando. Recibe la marca *ya no está en la biblioteca*, y entonces usted puede editarla por completo o quitarla del proyecto.

### Ocupación entre proyectos

El histograma y la sobreasignación de un proyecto solo miran ese proyecto. La biblioteca sabe más: cuántos de un recurso hay en total. La vista *Ocupación* suma, por día, la carga de todos los proyectos abiertos que están vinculados a la misma biblioteca y usan una copia de ese recurso. Si la suma de un día es mayor que la capacidad de la biblioteca, ese día cuenta como día con sobreasignación.

Tres reglas deciden qué cuenta:

- La capacidad viene de la biblioteca (*Unidades máx* del elemento de la biblioteca, o su *Capacidad escalonada en el tiempo* ese día), no de las *Unidades máx* de la copia del proyecto. Dos proyectos que cada uno se mantiene dentro de su propia asignación pueden, por tanto, seguir pidiendo juntos demasiado.
- Una suma exactamente igual a la capacidad no es un conflicto. Hay que pedir más que la capacidad.
- Solo cuentan las copias con marca de origen, y solo en los proyectos que están abiertos en esta aplicación en ese momento. Un recurso propio de un solo proyecto no está en la biblioteca y por eso no cuenta. La vista no ve documentos que no están abiertos en esta aplicación; eso también se indica al final de la propia vista.

## Ejemplo práctico: la cuadrilla de albañiles en dos proyectos

La biblioteca contiene el recurso *Bricklayer* con *Unidades máx* 3: tres albañiles en nómina. Dos proyectos lo usan, y ambos con una copia que tiene *Unidades máx* 2.

- *Houses North* tiene la tarea *Bricklaying facades* de 5 días laborables desde el lunes 7 de junio de 2027, con 2 unidades por día. La tarea va del 7 al 11 de junio, ambos incluidos.
- *Garages South* tiene la tarea *Bricklaying garages* de 4 días laborables desde el miércoles 9 de junio de 2027, con 2 unidades por día. El fin de semana no cuenta, así que la tarea cubre el 9, 10, 11 y 14 de junio.

Dentro de cada proyecto se pide al albañil 2 de sus 2 unidades. Ninguno de los dos proyectos informa sobreasignación: en *Recursos › Sobreasignación* ambos dicen *Ninguna*. Sin embargo, juntos superan a los 3 albañiles. Por día, la aplicación cuenta:

- Lunes 7 y martes 8 de junio: 2 (solo Houses North)
- Miércoles 9, jueves 10 y viernes 11 de junio: 2 + 2 = 4
- Lunes 14 de junio: 2 (solo Garages South)

El pico es 4, frente a una capacidad de 3. La vista muestra el albañil con *2 documentos*, el período *2027-06-07 – 2027-06-14*, *4,0 / 3,0* para el pico y la capacidad, y *3 días con sobreasignación*: 9, 10 y 11 de junio.

Qué pasa si cambia algo:

- Si *Bricklaying facades* tarda 6 días laborables, dura hasta el lunes 14 de junio. Ese día también llega a 2 + 2 = 4, así que la vista informa *4 días con sobreasignación*: 9, 10, 11 y 14 de junio. El pico sigue en 4.
- Si la biblioteca tiene *Unidades máx* 4, muestra *4,0 / 4,0* y no hay conflicto, porque la suma no es mayor que la capacidad.
- Si *Garages South* trabaja con 1 unidad por día en lugar de 2, el pico es 3 y muestra *3,0 / 3,0*: no hay conflicto.
- Si *Garages South* solo empieza el lunes 14 de junio, los proyectos no se solapan. El período pasa a ser *2027-06-07 – 2027-06-17* y el pico es *2,0 / 3,0*.

Los pasos para ver esto en sus propios proyectos están en [Cómo usar la vista de ocupación](docs://howto-bezettingsoverzicht-gebruiken).

## Consecuencias y malentendidos

**«La biblioteca se comparte con mis compañeros.»** No. La biblioteca se guarda en la aplicación (en la aplicación de escritorio, en un archivo de este equipo; en el navegador, en el almacenamiento de ese navegador) y no se sincroniza. Si dos planificadores trabajan con la misma biblioteca de recursos, sus bibliotecas pueden divergir. Puede compartirla exportando e importando; vea [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren). Si su organización comparte cuadrillas entre empresas operativas, elija deliberadamente una biblioteca compartida. Además, la vista de ocupación solo ve los proyectos que están abiertos en esta aplicación.

**«Si cambio la biblioteca, todo en mis proyectos cambia.»** Solo cambia la identidad del recurso: nombre, tipo, tarifa, unidad y descripción. *Unidades máx*, la capacidad a lo largo del tiempo y la elección de calendario de un proyecto se quedan como están.

**«Puedo deshacer un cambio en la biblioteca.»** No. La biblioteca pertenece a la aplicación y no a un proyecto, así que los cambios en ella quedan fuera de *Deshacer* (Ctrl+Z). La vista *Biblioteca* lo advierte por sí misma: *Esto edita la biblioteca y se aplica a todos los proyectos — fuera de deshacer.* Borrar de la biblioteca también pide confirmación y no se puede deshacer.

**«La vista de ocupación resuelve las sobreasignaciones.»** No. La vista de ocupación es solo una ventana de solo lectura. Muestra en qué días dos proyectos piden juntos demasiado. La nivelación (*Recursos › Nivelación › Nivelar…*, vea [Nivelación de recursos](docs://uitleg-nivelleren)) mira los recursos de un solo proyecto y no tiene en cuenta los otros proyectos. Mueva usted una tarea en uno de los proyectos, o cambie la capacidad en la biblioteca si de verdad se une alguien.

**«Mi propio recurso cuenta en la ocupación.»** Solo si está en la biblioteca. Un recurso que solo creó en el proyecto, como una grúa alquilada para una única obra, no tiene marca de origen y por eso no aparece en la vista. Con *A la biblioteca* lo añade.

## Vea también

- [Uso de la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken): vincular, asignar recursos y resolver desviaciones.
- [Gestionar y compartir bibliotecas de recursos](docs://howto-bibliotheken-beheren): crear, exportar e importar bibliotecas.
- [Cómo usar la vista de ocupación](docs://howto-bezettingsoverzicht-gebruiken): encontrar sobreasignaciones entre proyectos.
- [Gestión de recursos](docs://howto-resources-beheren): los recursos de un solo proyecto.
