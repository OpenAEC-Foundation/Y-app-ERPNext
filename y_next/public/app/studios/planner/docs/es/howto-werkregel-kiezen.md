# Elegir una regla de trabajo

Objetivo: definir, por tarea, qué ajusta la aplicación cuando cambia la duración, las unidades o el trabajo: la propia duración, las unidades o el propio trabajo.

## Cuándo lo necesita

Ha asignado recursos a una tarea y quiere que la aplicación calcule del modo en que usted lo hace. Un ejemplo: la grúa se alquila por un día y ese día es fijo. Otro ejemplo: sabe que hay 160 horas de albañilería en la tarea y quiere ver cuánto tarda con tres personas en lugar de dos. Esas dos situaciones necesitan una regla de trabajo distinta.

La regla decide cuál de las tres magnitudes (duración, unidades y trabajo) se ajusta cuando usted cambia otra. El contexto y los ejemplos resueltos están en [Reglas de trabajo: duración, unidades y trabajo](docs://uitleg-werkregels).

## Pasos

### Mostrar la regla de trabajo

La regla de trabajo no se muestra de forma predeterminada. Actívela una vez:

1. Elija *Configuración › Proyecto › Configuración*, pestaña *Planificación*.
2. Bajo el encabezado *Cálculo*, marque *Mostrar reglas de trabajo y trabajo*.
3. Cierre la ventana con *Cerrar*.

Esto es un ajuste de la aplicación, no del archivo del proyecto. Si un archivo ya contiene reglas de trabajo o trabajo guardado, por ejemplo un archivo de MS Project o de Primavera P6, la aplicación muestra la regla de trabajo de ese archivo aunque este ajuste esté desactivado. Lo mismo ocurre en cuanto usted elige una regla de trabajo en un archivo: entonces la visualización sigue activa para ese archivo, aunque después desactive el ajuste. Sigue activa mientras el archivo esté abierto y, tras volver a abrirlo, mientras el archivo contenga una regla de trabajo o trabajo guardado.

### Elegir una regla

1. Seleccione la tarea. El panel *Propiedades* está a la derecha; si no lo ve, actívelo con *Vista › Paneles › Propiedades*.
2. En *Regla de trabajo*, elija una de las cinco opciones: *Valor predeterminado del proyecto (Duración y unidades fijas)*, *Duración y unidades fijas*, *Duración y trabajo fijos*, *Trabajo fijo* o *Unidades fijas*. Con *Predeterminado del proyecto* la tarea sigue el valor predeterminado del proyecto.
3. Debajo del desplegable, la aplicación muestra qué protege la regla, por ejemplo *Protegido: trabajo (la duración sigue a las unidades)*.

*Predeterminado del proyecto* es la primera opción y es la que tiene una tarea de forma predeterminada. La regla entre paréntesis es la que el proyecto tiene ahora como predeterminada. La aplicación no tiene ningún botón para cambiar ese predeterminado del proyecto: viene de una importación (por ejemplo, de MS Project o Primavera P6) o de la conexión MCP. Si quiere otra regla para una sola tarea, elíjala aquí.

También puede elegir la regla en la tabla. Haga clic en el **+** a la derecha del encabezado de la tabla de tareas (*Añadir columna*) y, en *Planificación*, elija la columna *Regla de trabajo*.

Una tarea sin asignación no tiene nada que relacionar, así que la regla no hace nada allí. Asigne primero un recurso (véase [Asignar recursos con una curva](docs://howto-resource-toewijzen)).

### Ver y cambiar el trabajo

En una tarea con asignaciones aparece una columna *Trabajo (rest.)* en el bloque *Asignaciones* del panel *Propiedades*, junto a *Uds./día*. Es el trabajo restante de ese recurso, en horas. Un candado pequeño sobre una columna muestra lo que mantiene la regla: *Uds./día* con *Duración y unidades fijas* y con *Unidades fijas*, *Trabajo (rest.)* con *Duración y trabajo fijos* y con *Trabajo fijo*.

Si quiere cambiar el trabajo usted mismo, escriba las horas en el campo y pulse Intro. La aplicación no acepta un valor de 0 o menos: el campo vuelve al valor anterior.

### Ver qué pasa

Si elige una regla, todavía no cambia ningún número. Con una regla que protege el trabajo, la aplicación solo fija el trabajo actual, así que *Trabajo (rest.)* tiene un valor guardado. Solo en el siguiente cambio decide la regla qué se ajusta. Cambie, por ejemplo, *Uds./día* y vea qué pasa con la duración y el trabajo.

Si eso cambia la duración de la tarea, la barra de estado muestra *Desactualizado — recalcula (F5)*. Pulse **Calcular** (F5), por ejemplo mediante *Inicio › Programación › Calcular*, para ver las nuevas fechas. Si *Calcular automáticamente* está activado (misma pestaña *Planificación*, encabezado *Cálculo*), la aplicación lo hace por sí misma.

## Qué regla encaja

- **Duración y unidades fijas** encaja cuando la duración es un acuerdo y las unidades las introduce usted. El trabajo resulta de esas dos. Es la opción predeterminada. La grúa alquilada por un día encaja aquí: el día es fijo y usted decide cuántas grúas trabajan ese día.
- **Duración y trabajo fijos** encaja cuando la tarea debe terminarse dentro de un plazo fijo y usted sabe cuánto trabajo tiene. Si cambia la duración, la aplicación ajusta las unidades.
- **Trabajo fijo** encaja cuando sabe cuántas horas de trabajo tiene y quiere ver cómo cambia la duración con el número de personas. Las 160 horas de albañilería con tres personas en lugar de dos encajan aquí. El enlucido del proyecto de práctica tiene esta regla.
- **Unidades fijas** encaja cuando las unidades son fijas, por ejemplo una grúa, y el trabajo decide la duración.

## Puntos de atención y qué hace la aplicación entonces

**Falta el campo *Regla de trabajo*.** Entonces el ajuste *Mostrar reglas de trabajo y trabajo* está desactivado y el archivo todavía no tiene reglas de trabajo, o ha seleccionado un hito, una fase, una hamaca o una tarea con el tipo de duración *Tiempo transcurrido*. Ahí no hay regla de trabajo. Seleccione una tarea normal.

**La duración cambia sin que usted la cambie.** Con *Trabajo fijo* y *Unidades fijas* la duración se deriva de las unidades y del trabajo. Si cambia una de ellas o el número de recursos, la aplicación ajusta la duración, redondeada hacia arriba a días laborables completos. En una tarea en horas, la aplicación redondea hacia arriba a minutos completos.

**El trabajo no coincide exactamente con unidades × duración.** El redondeo puede causarlo. Junto a *Trabajo (rest.)* aparece entonces un signo de advertencia, *Difiere de unidades × duración*. El histograma sigue el trabajo guardado.

**El material no cuenta.** Para un recurso de material, *Trabajo (rest.)* muestra un guion. El material nunca determina la duración.

**Una tarea con avance.** La regla actúa sobre la parte restante. Por eso *Trabajo (rest.)* muestra solo lo que todavía falta por hacer.

**Deshacer.** Elegir una regla y cada cambio que la regla calcula forman un solo paso para *Deshacer* (Ctrl+Z). Entonces la regla desaparece de nuevo, pero el campo *Regla de trabajo* sigue visible.

## Véase también

- [Reglas de trabajo: duración, unidades y trabajo](docs://uitleg-werkregels): cómo la aplicación relaciona la duración, las unidades y el trabajo, con ejemplos resueltos.
- [Asignar recursos con una curva](docs://howto-resource-toewijzen): asignar un recurso a una tarea.
