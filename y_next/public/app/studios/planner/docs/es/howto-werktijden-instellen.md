# Definir los horarios laborales

Objetivo: registrar por día de la semana a qué horas trabaja un calendario, para que las tareas por horas se ejecuten en los momentos correctos.

## Cuándo lo necesita

La tarde del viernes no es laborable. La cuadrilla trabaja de 06:00 a 22:00 en dos turnos. Hay una cuadrilla de noche. La pausa dura menos de una hora. Mientras planifique solo por días, *Inicio (hora)*, *Fin (hora)* y la pausa son suficientes ([Crear y asignar un calendario](docs://howto-kalender-maken-en-toewijzen)). Si planifica tareas por horas, la aplicación cuenta los minutos laborables dentro de las **bandas** del calendario. En la aplicación se llaman *bandas*: una banda es un tramo continuo de horario laboral en un día de la semana, y un hueco entre dos bandas es una pausa. Lo que esto significa para su planificación se explica en [Días y horas](docs://uitleg-dagen-en-uren).

Para esto necesita *Activar planificación por horas* ([Activar la planificación por horas](docs://howto-urenplanning-aanzetten)). Sin planificación por horas no ve el bloque *Horarios de trabajo*.

## Pasos

### Elegir un preajuste de turno

1. Elija *Planificación › Calendario › Calendario* y seleccione el calendario de la izquierda.
2. En el bloque *Horarios de trabajo*, pulse un preajuste. Sustituye los días laborables y los horarios laborales del calendario.
3. Pulse *Aplicar*.

Cada preajuste hace lo siguiente:

- *Turno de día*: de lunes a viernes de 08:00 a 16:00, sin pausa. Así vuelve a ser un calendario normal, sin bandas.
- *2 turnos*: de lunes a viernes de 06:00 a 14:00 y de 14:00 a 22:00, 16 horas en total.
- *3 turnos*: de lunes a viernes tres turnos: de 06:00 a 14:00, de 14:00 a 22:00 y de 22:00 a 06:00 del día siguiente, 24 horas en total.
- *Turno de noche*: de lunes a viernes de 22:00 a 06:00 del día siguiente, 8 horas.
- *24/7*: los siete días de 00:00 a 24:00.

### Definir los horarios laborales por día de la semana

1. En el bloque *Horarios de trabajo*, pulse *Definir por día de la semana…*. Debajo de los botones aparece una fila por cada día de la semana, con el horario laboral de ese día. Ahora el calendario tiene bandas por día de la semana. Si ya tenía bandas, esta vista se abre de inmediato; entonces el botón se llama *Ocultar horarios de trabajo* y la pliega.
2. Ajuste la hora de inicio y de fin de cada banda en los dos campos de hora.
3. Si quiere incluir una pausa, pulse **+** (*Añadir banda*) para ese día y ajuste las horas de las bandas para que haya un hueco entre ellas. Una banda nueva empieza a las 08:00 y termina a las 16:00.
4. Si una banda pasa de medianoche, marque *día siguiente*. La banda cuenta para el día en que empieza.
5. Pulse el icono de papelera de una banda para eliminarla. Un día sin bandas aparece como *No laborable*.
6. Para un día de lunes a viernes, pulse el símbolo de copia (*Copiar a todos los días laborables*) para poner las bandas de ese día de lunes a viernes.
7. Al final está *Horas/día derivadas:* con las horas netas por día que la aplicación deriva de esto. Pulse *Aplicar*.

**Ejemplo: una tarde del viernes no laborable.** Pulse *Definir por día de la semana…*. Elimine la segunda banda (de 13:00 a 16:00) para *Vie*. Ahora el viernes tiene 5 horas; los demás días, 8. Las horas por día derivadas siguen siendo 8.

### Guardar un preajuste propio

1. Pulse *Guardar como preajuste…* y escriba un nombre en el campo *Nombre del preajuste*.
2. Pulse *Guardar*. El preajuste aparece ahora entre los demás preajustes, y puede usarlo en cualquier proyecto. Con la cruz que tiene al lado lo elimina de nuevo.

Un preajuste propio se guarda en este dispositivo, no en el archivo del proyecto.

## Puntos de atención y lo que hace la aplicación en ese caso

**Un preajuste lo sustituye todo.** Si elige un preajuste, desaparecen los días laborables y los horarios laborales que definió antes. Los festivos se mantienen.

**Los botones de día y las bandas son dos cosas distintas.** Los botones debajo de *Días laborables* no cambian las bandas. Un día recibe horario laboral al pulsar *Añadir banda* para ese día. Si solo activa un día con el botón, cuenta para las tareas por días, pero no para las tareas por horas. Con un calendario que tiene horarios laborales, utilice las filas por día de la semana.

**Ajustar los horarios laborales con la planificación por horas desactivada.** Si vuelve a desactivar la planificación por horas, reaparecen los campos *Inicio (hora)*, *Fin (hora)* y la pausa. En un calendario con bandas, esos campos no cambian las bandas. Por eso, ajuste siempre los horarios laborales con la planificación por horas activada.

**Sin horarios laborales válidos.** Un calendario sin bandas o sin días laborables no admite tareas por horas. La aplicación entonces muestra *Este calendario no tiene horarios de trabajo válidos. Comprueba sus días y horarios laborables.*

## Véase también

- [Días y horas](docs://uitleg-dagen-en-uren): cómo la aplicación cuenta los horarios de trabajo y deriva las horas netas por día.
- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): planificar una tarea por horas.
- [Calendarios y días laborables](docs://uitleg-kalenders): qué calendario se aplica a cada tarea.
- [Ventanas de calendario](docs://ref-kalenders): todos los campos de las ventanas de calendario.
