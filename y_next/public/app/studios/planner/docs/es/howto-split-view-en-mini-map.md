# Usar la vista dividida y el minimapa

Objetivo: ver dos partes de la línea de tiempo una al lado de la otra, y avanzar rápido por una planificación larga.

## Cuándo lo necesita

Está revisando el inicio de la cimentación y, al mismo tiempo, la entrega nueve meses después. Sin ayuda, acerca y aleja el zoom una y otra vez y pierde el hilo de dónde estaba. Con la **vista dividida** ve la misma planificación dos veces, una al lado de otra, cada una con su propia ventana de tiempo. Con el **minimapa** ve todo el período del proyecto en una franja estrecha, y con un clic salta a la parte que busca.

## Pasos

### Activar la vista dividida

1. Elija la pestaña *Vista*. En el grupo *Presentación* están *Presentación*, *Vista dividida* y *Minimapa*.
2. Haga clic en *Vista dividida*. El Gantt se divide en dos. Las dos ventanas empiezan con el zoom y la posición de su vista actual.

Las dos ventanas comparten la tabla de tareas, las filas y el desplazamiento vertical. Cada ventana tiene su propio eje de tiempo: el zoom y la posición horizontal.

### Dar a cada ventana su propio intervalo de tiempo

- Haga zoom y desplácese en la ventana donde esté el ratón. Con el ajuste predeterminado de *Desplazamiento y zoom* (*Zoom + arrastrar*), la rueda del ratón hace zoom en esa ventana, centrado en el ratón. Si su ajuste sigue otro modo, la rueda hace en las dos ventanas lo que indique ese modo.
- Con el ajuste predeterminado, se desplaza por las filas con Mayús + la rueda del ratón. Esto se aplica a las dos ventanas a la vez.
- Los botones *Zoom +* y *Zoom -* y la lista de escala de tiempo (por ejemplo *Trimestre*) solo funcionan en la ventana izquierda. Por eso, para hacer zoom en la ventana derecha, use la rueda del ratón.
- Arrastre el separador entre las dos ventanas hacia la izquierda o hacia la derecha para hacerlas más anchas o más estrechas. Al principio, las dos ocupan la mitad.

### Desactivar la vista dividida

Haga clic otra vez en *Vista dividida*. Queda una ventana, con la vista de la ventana izquierda. Al activar de nuevo la vista dividida, empieza con la vista de ese momento.

### Activar el minimapa

1. En el grupo *Presentación*, haga clic en *Minimapa*.
2. Debajo de la línea de tiempo aparece una franja de todo el período del proyecto. Las tareas de su vista actual se ven como guiones finos (así, después de un filtro, solo se ven las tareas que muestra ese filtro). Un marco rodea la parte que ve ahora.
3. Haga clic en cualquier punto de la franja para colocar el marco allí. La ventana se centra en ese punto. O bien, agarre el marco y arrástrelo.

El minimapa solo mueve la ventana de tiempo. Las filas no cambian.

Si la vista dividida está activada, cada ventana tiene su propia franja, debajo de su propia parte de la línea de tiempo. Cada franja controla solo la ventana que está encima.

## Puntos de atención y qué hace la aplicación

**El minimapa no hace nada si ya se ve todo el proyecto.** Si aleja el zoom tanto que cabe toda la planificación, no hay nada a lo que ir y al hacer clic no pasa nada. Primero acerque el zoom.

**El minimapa solo está en el Gantt.** En las pestañas *Tabla*, *IFC* e *Informe* y en el panel de recursos completo (*Recursos*, no *Dock de recursos*) no hay línea de tiempo, así que tampoco hay minimapa ni vista dividida. Vuelven en cuanto regresa a una vista con el Gantt.

**La vista dividida pertenece al proyecto, el minimapa no.** La vista dividida se aplica al proyecto abierto: si cambia a otro proyecto y vuelve, sigue ahí. El minimapa es una sola elección para todos los proyectos y sigue activado o desactivado después de reiniciar. Las dos son opciones de pantalla: no se guardan en el archivo del proyecto, no marcan el proyecto como «modificado» y no están en *Deshacer*.

**Vista dividida y presentación.** Las dos siguen visibles cuando activa el modo de presentación (véase [Presentar en una pantalla grande](docs://howto-presentatie)). Como la cinta desaparece en ese momento, ya no puede activarlas ni desactivarlas en ese modo. Por eso, configúrelas bien antes de empezar.

## Véase también

- [Presentar en una pantalla grande](docs://howto-presentatie): el Gantt a pantalla completa, sin la cinta.
- [Crear y usar un diseño](docs://howto-layouts-gebruiken): la escala de tiempo también se puede guardar como parte de un diseño.
