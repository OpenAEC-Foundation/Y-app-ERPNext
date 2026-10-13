# Crear una hamaca

Objetivo: crear una tarea que no conoce su propia duración, pero que va desde el inicio de una tarea hasta el fin de otra, como la instalación de obra, la supervisión o el alquiler de una caseta de obra.

## Cuándo lo necesita

La caseta de obra está ahí mientras siga la obra, desde los primeros trabajos de movimiento de tierras hasta la entrega. Si da a esa tarea una duración fija de 13 días laborables, no se alarga cuando la mampostería se retrasa, y la planificación deja de ser correcta. Una **hamaca** (también llamada *nivel de esfuerzo*) sigue la tarea a la que la engancha: su inicio viene de una relación de inicio, su fin de una relación de fin, y su duración es la diferencia entre los dos.

## Pasos

1. Cree la tarea, por ejemplo *Site cabin*, o seleccione una tarea existente. Un hito y una tarea de resumen (fase) no pueden ser una hamaca; en el panel *Propiedades* y en *Editar tarea* falta la casilla para esa tarea, y en la columna de tabla no se puede cambiar.
2. Marque *Hamaca (duración derivada)* en el panel *Propiedades*, en *Editar tarea* (haga clic con el botón derecho en la tarea, *Editar...*) o en la columna de tabla *Hamaca (duración derivada)* bajo *Planificación*. El campo *Duración* ya no se puede editar.
3. Añada una relación desde la tarea con la que empieza la hamaca hasta la hamaca, de tipo **SS** (la hamaca empieza junto con esa tarea) o **FS** (la hamaca empieza después de esa tarea). Para ello, seleccione la hamaca, haga clic en *Añadir relación* en *Relaciones*, deje la dirección en *Predecesora*, elija la tarea y elija el tipo. Los pasos están en [Añadir relaciones](docs://howto-relaties-leggen).
4. Añada una relación desde la tarea con la que termina la hamaca hasta la hamaca, de tipo **FF** (la hamaca termina junto con esa tarea) o **SF**.
5. Mire en el panel *Propiedades*, bajo *Hamaca (duración derivada)*: ahí ve *Driver de inicio* con la tarea y el tipo, y *Driver de fin* con la tarea y el tipo. Un driver es una tarea de la que la hamaca toma su inicio o su fin.
6. Pulse **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*. La hamaca ahora va desde el inicio del driver de inicio hasta el fin del driver de fin, y *Duración* muestra la duración derivada.

En el Gantt, una hamaca es una barra fina de color verde azulado con un gancho en cada extremo.

Ejemplo: *Site cabin* recibe SS desde *Groundwork* (lunes 7 de junio de 2027) y FF desde *Roofing* (terminada el miércoles 23 de junio). Después de **Calcular**, la hamaca va desde el lunes 7 hasta el miércoles 23 de junio: 13 días laborables. Si la mampostería se retrasa 2 días laborables, el fin de *Roofing* pasa al viernes 25 de junio y la hamaca se alarga con ella hasta 15 días laborables.

## Qué hace la aplicación con una hamaca

- La hamaca nunca es crítica y no tiene holgura. Tampoco restringe las tareas de las que toma su inicio y su fin: no reciben fechas tardías por culpa de la hamaca.
- El desfase cuenta. Con SS y desfase `1d`, la hamaca empieza un día laborable después del driver de inicio; con FF y desfase `2d`, termina dos días laborables después del driver de fin.

## Errores frecuentes y qué hace la aplicación

**Sin driver de fin.** Si la hamaca no tiene una relación FF ni SF, la aplicación no puede derivar su fin. El panel *Propiedades* dice *Sin driver de fin (FF/SF) — el intervalo vuelve a longitud cero.* y el panel *Advertencias* dice *Hamaca sin driver de fin (sin predecesor FF/SF): su duración vuelve a cero*. Entonces la hamaca empieza y termina el mismo día. Añada una relación FF o SF.

**Una hamaca que termina después de la última tarea.** Si la hamaca continúa hasta después de la última tarea, por ejemplo con FF y un desfase de 2 días laborables, la fecha de fin del proyecto se desplaza con ella. Las tareas que realmente se ejecutan reciben entonces holgura; ya ninguna es crítica.

**Tareas que esperan a una hamaca.** Si añade una relación desde la hamaca hacia otra tarea, esa tarea solo empieza después del fin de la hamaca. Toda la cadena anterior a la hamaca, incluidas las tareas de las que la hamaca toma su inicio y su fin, recibe entonces holgura y deja de ser crítica, porque la hamaca no transmite presión hacia atrás. Por eso, no deje que las tareas esperen a una hamaca; cuélguelas mejor del driver de fin de la hamaca.

**Introducir una duración.** El campo *Duración* de una hamaca se deriva y no se puede editar. Una duración que había introducido antes de marcar la casilla ya no cuenta.

## Ver también

- [Añadir relaciones](docs://howto-relaties-leggen): los pasos para añadir una relación de tipo SS o FF.
- [Relaciones y desfase](docs://uitleg-relaties): qué significan SS y FF y cómo cuenta el desfase.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): qué significa crítico y cómo funciona la holgura.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene la hamaca *Structural works tower A (LOE)*.
