# Elegir el período del informe

Objetivo: decidir qué tramo de tiempo cubre un informe, por ejemplo las próximas cuatro semanas o el mes de junio.

## Cuándo lo necesita

La reunión semanal quiere saber qué pasa en las próximas cuatro semanas. El informe mensual cubre junio. Sin período, en papel sale toda la planificación. Por eso cinco informes usan un *Periodo del informe:*: *Previsión (look-ahead)*, *Informe de avance*, *Carga de recursos*, *Asignaciones de recursos* y el *Diagrama de recursos*. Los demás informes no tienen período.

El período no depende de un mes del calendario, sino de un **día de referencia**: la fecha de estado de su proyecto (el día en que mide el avance, véase [Avance, fecha de estado y línea base](docs://uitleg-voortgang)), o hoy si el proyecto no tiene fecha de estado. *Próximas 4 semanas* cuenta desde ese día. Si cambia la fecha de estado, la ventana se mueve con ella.

## Pasos

### 1. Defina la fecha de estado

Si trabaja con una opción relativa, como *Próximas 4 semanas* o *Último mes*, defina primero la fecha de estado. Elija *Planificación › Líneas base y progreso* y rellene el campo *Fecha de estado*. Con la cruz que hay junto a él (*Borrar fecha de estado*) usted quita de nuevo la fecha. Si trabaja con un período fijo (paso 4), no necesita esto.

### 2. Elija un informe con período

Abra la pestaña *Informe* y elija uno de los cinco informes en *Tipo de informe*. La lista *Periodo del informe:* está debajo de *Opciones del informe*. En el Diagrama de recursos está debajo de *Configuración*, bajo las cuatro casillas de ese informe.

Cada informe recuerda su propio período. Estos son los valores iniciales:

- *Previsión (look-ahead)*: *Próximo mes*.
- *Informe de avance*: *Último mes*.
- *Carga de recursos*, *Asignaciones de recursos* y *Diagrama de recursos*: *Todo el proyecto*.

### 3. Elija un período de la lista

La lista tiene *Próxima semana*, *Próximas 2 semanas*, *Próximas 4 semanas*, *Próximas 6 semanas*, *Próximas 8 semanas*, *Próximas 12 semanas*, *Próximo mes*, las mismas siete con *Últimas* o *Último*, *Todo el proyecto* y *Personalizado*. Debajo de la lista están *Desde* y *Hasta* con las fechas que produce la elección. Aquí solo puede leerlas.

Ambos días cuentan. Si la fecha de estado es jueves 20 de mayo, *Próxima semana* va del 20 al 26 de mayo, incluidos ambos. *Próximas 4 semanas* va del 20 de mayo al 16 de junio, incluidos ambos (28 días). *Próximo mes* llega hasta un día antes de la misma fecha del mes siguiente, aquí hasta el 19 de junio incluido. *Últimas 2 semanas* va del 7 al 20 de mayo, incluidos ambos.

*Todo el proyecto* toma la planificación desde el primer inicio hasta el último fin.

### 4. O elija Personalizado

Con *Personalizado*, *Desde* y *Hasta* pasan a ser dos campos de fecha. Empiezan con las fechas de la elección que tenía antes. Rellene los dos, por ejemplo 1 y 14 de junio. Si la entrada no es correcta, el informe se queda en el último período válido y lo indica en rojo:

- *La fecha final es anterior a la inicial.* si *Hasta* es anterior a *Desde*.
- *Introduzca ambas fechas.* si una de las dos está vacía.

### 5. Lea el período en el informe

En la Previsión (look-ahead), la Carga de recursos y las Asignaciones de recursos, el período está debajo del título, por ejemplo *Periodo: 20-05-2027 – 19-06-2027*. Si elige *Todo el proyecto*, *Todo el proyecto* se añade detrás de las fechas. El Informe de avance muestra el período en el resumen, en *Periodo*. El Diagrama de recursos ajusta su eje de tiempo exactamente al período.

### Lo que hace el período en cada informe

El período no funciona igual en cada informe.

- **Previsión (look-ahead)** toma las tareas sin terminar que tocan el período, también si ocupan todo el período. Las tareas vencidas de antes del día de referencia se incluyen también, siempre que el final del período no sea anterior al día de referencia. Un período personalizado completamente en el pasado es una mirada atrás: muestra solo lo que estaba en curso entonces y aún no está terminado, sin el atraso acumulado de hoy.
- **Informe de avance** usa el período para *Completadas en el periodo anterior*. La sección *Empiezan en el próximo periodo* mira hacia delante desde la fecha de estado, hasta la fecha de *Previsión hasta* del resumen. Si elige un período con *Últimas* o *Último*, el informe mira hacia delante tanto como mira hacia atrás: con *Últimas 2 semanas* y fecha de estado 20 de mayo, dice *Previsión hasta* 3 de junio. Un período personalizado o *Todo el proyecto* que queda por completo en el pasado no se refleja.
- **Carga de recursos** muestra por completo cada semana o mes que toca el período. Si su período va de miércoles a miércoles, ve por tanto semanas completas, así que una fila siempre muestra el mismo número que el histograma.
- **Asignaciones de recursos** muestra las asignaciones de las tareas que tocan el período. Con *Todo el proyecto* no hay filtro por fecha.
- **Diagrama de recursos** muestra solo las tareas que tocan el período. En el resumen, *Fuera del período:* cuenta cuántas tareas se dejaron fuera.

## Escollos y lo que hace la aplicación

**No hay fecha de estado.** La aplicación usa entonces hoy. En los cuatro informes de tabla con período (*Previsión (look-ahead)*, *Informe de avance*, *Carga de recursos* y *Asignaciones de recursos*) lo indica arriba, con un período relativo: *Sin fecha de estado — el informe usa hoy (29-09-2026).* La fecha es la de hoy, en su formato. El Diagrama de recursos no lo indica. Mire por eso *Desde* y *Hasta*: entonces están alrededor de hoy, no alrededor de su planificación.

**El período queda fuera de su planificación.** Entonces el informe está vacío. El Diagrama de recursos lo dice con *No hay tareas en el período del informe — elija otro período o Proyecto completo.* (en la lista esa elección se llama *Todo el proyecto*). En los demás informes ve cero tareas o ninguna fila.

**Las fechas están en su propio formato.** *Desde* y *Hasta* siguen el formato de fecha de su configuración, salvo en los campos de fecha de *Personalizado*: esos muestran el formato de su navegador.

**El período se desplaza.** Una elección relativa, como *Próximo mes*, se calcula de nuevo cada vez: si cambia la fecha de estado, o si pasa un día sin fecha de estado, el período se desplaza al momento. Si quiere un período fijo, elija *Personalizado*.

**La elección vale para todos sus proyectos.** Un período personalizado vale también para todos sus proyectos en este equipo, no solo para el proyecto abierto.

## Véase también

- [Crear e imprimir un informe](docs://howto-rapport-maken-en-afdrukken): todo el recorrido desde el tipo de informe hasta el PDF.
- [Avance, fecha de estado y línea base](docs://uitleg-voortgang): qué es la fecha de estado y por qué la aplicación calcula con ella.
- [Resolver la sobreasignación](docs://howto-overbezetting-oplossen): qué hacer con las semanas sobreasignadas de la Carga de recursos.
- [Tipos de informe](docs://ref-rapporttypes): todos los tipos de informe y sus opciones.
