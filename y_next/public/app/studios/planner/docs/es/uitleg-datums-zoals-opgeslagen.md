# Fechas tal como están registradas

Abre una planificación de Primavera o de MS Project, y las fechas difieren de lo que vio en ese programa. ¿Ha fallado la importación? Normalmente no. En este artículo verá por qué la aplicación recalcula por sí sola, cuándo muestra las fechas del archivo, qué queda vacío entonces y cómo vuelve a su propio cálculo. El ejemplo del final sigue dos tareas durante todo el ciclo.

## El concepto

Un archivo de planificación contiene dos tipos de datos. Primero, la lógica: tareas, duraciones, relaciones, calendarios y restricciones. Segundo, las fechas que el propio programa calculó a partir de ella. Al abrir, Open Planner Studio usa la lógica y calcula por sí mismo. Por tanto, las fechas del archivo no son datos de entrada.

Si el cálculo propio de la aplicación acaba con otras fechas que las que indica el archivo, no sabe qué lado es correcto. Es posible que al archivo le falte lógica que el otro programa sí usó. El otro programa también puede calcular de forma distinta a la aplicación en algún punto. Por eso la aplicación puede mostrar las fechas **tal como están registradas**: las fechas que el otro programa guardó en el archivo. Así compara con lo que vio en ese programa.

## Cómo gestiona la aplicación este caso

### Qué perfil de cálculo usa la aplicación

La aplicación calcula con un **perfil de cálculo**: un conjunto de reglas de cálculo (convenciones) que decide, por ejemplo, cómo trata el inicio planificado de una tarea y las restricciones. Consulte [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen). Hay tres perfiles integrados: *Primavera P6*, *Microsoft Project* y *Open Planner Studio*. Un `.xer` se abre con *Primavera P6* y un `.mpp` con *Microsoft Project*. CSV, MS Project XML y Primavera P6 XML se abren con *Open Planner Studio*. El perfil de un proyecto está en *Archivo › Info del proyecto*, en *Perfil de cálculo y opciones*. Un archivo IFC de la aplicación conserva su perfil.

### Cuándo compara la aplicación

Al abrir, la aplicación registra lo que decía el archivo y lo compara con su propio resultado. Lo hace para:

- un archivo de Primavera (`.xer`) y XML de Primavera P6;
- XML de MS Project y archivos de MS Project (`.mpp`);
- un archivo IFC de otro programa, para las tareas cuyas fechas de inicio temprano están en el archivo;
- un archivo IFC de la propia aplicación que ha guardado su origen. Más abajo encontrará cuándo es el caso.

La aplicación nunca compara un archivo CSV: la fecha de inicio en un CSV es un dato de entrada, no el resultado de un cálculo. Un archivo IFC de la propia aplicación sin origen guardado tampoco se compara.

Si ninguna tarea difiere, no notará nada. Si al menos una tarea difiere en un archivo que está importando ahora, la aplicación activa la vista de inmediato.

Con un archivo de Primavera, la aplicación calcula con el perfil de cálculo *Primavera P6*. Así se mantiene el inicio planificado del archivo como inicio temprano. Una tarea que en el archivo está más tarde de lo que exigen las relaciones, pero que también está planificada allí, se queda donde está: entonces no hay diferencia.

### Lo que ve

Debajo de la cinta hay una barra: *Estás viendo las fechas tal como están registradas en el archivo; recalcular desplazaría 4 tareas.* Con una fuente de Primavera (un `.xer` o XML de Primavera P6) dice *Estás viendo la planificación tal como la registró Primavera; recalcular desplazaría 1 tarea.* A la derecha de la barra está el botón *Recalcular*. La barra no tiene cruz.

También hay un mensaje: *4 tareas muestran las fechas tal como están registradas en el archivo (sin recalcular).* Solo con un `.xer` dice *1 tarea muestra las fechas tal como las registró Primavera (sin recalcular).* Cada tarea para la que el archivo registró fechas muestra una marca en el panel *Propiedades*: *Muestra las fechas propias registradas por Primavera para esta tarea* con una fuente de Primavera, o *Muestra las fechas tal como se guardaron en el archivo para esta tarea* con otra fuente. El Gantt, la tabla de tareas y la barra de estado muestran las fechas del archivo.

### Lo que queda vacío en esta vista

En esta vista la aplicación no calcula nada. Solo muestra lo que registró el archivo. Por eso solo ve holgura y ruta crítica si el archivo las contiene. Si el archivo no registra tareas críticas, la barra de estado indica 0 tareas críticas. Eso no dice nada sobre la ruta crítica en el propio programa de origen. Lo que solo sale de un cálculo no existe en esta vista: qué relaciones dirigen la planificación, restricciones violadas, tareas fuera de secuencia y tareas casi críticas.

Si el archivo no registra todo para una tarea, verá la marca *El registro está parcialmente incompleto — véanse las columnas de fin tardío/holgura* en el panel *Propiedades*. En una exportación CSV, las columnas *Crítica* y *Holgura total* quedan vacías para esa tarea, en lugar de un cero inventado.

### Salir de la vista

Puede salir de la vista de dos maneras:

- Pulse *Recalcular* en la barra, o elija *Calcular* (F5). La aplicación calcula con sus propias reglas.
- Cambie algo que pueda alterar las fechas, como la duración de una tarea o una tarea nueva. La aplicación sale de la vista y recalcula de inmediato, aunque *Calcular automáticamente* esté desactivado. Cambiar un nombre no hace eso: la vista sigue activa.

Un cambio de calendario desde la biblioteca de recursos deja la vista activa y las fechas del archivo tal como están, pero actualiza el número de la barra.

Después de salir no hay ningún botón para volver a la vista. Ctrl+Z sí la devuelve, justo después de recalcular o justo después de una edición de ese tipo. Si no, puede abrir de nuevo el archivo de origen. Con un `.xer`, abrir un archivo IFC que guardó después de recalcular, pero que no editó, también vuelve a activar la vista.

### Recuperación tras un fallo

Si recupera un proyecto después de un fallo que estaba en la vista, la vista sigue activa. El proyecto que estaba activo muestra la misma barra que antes. Un proyecto en otra pestaña muestra la barra sin número: *Estás viendo las fechas tal como están registradas en el archivo. No se ha recalculado nada.* Consulte [Recuperación después de un fallo](docs://howto-herstellen-na-een-crash).

### Guardar y volver a abrir

Si guarda mientras usa la vista, la aplicación escribe las fechas mostradas en el archivo IFC, junto con el formato de origen. Si después vuelve a abrir ese archivo IFC y no lo ha editado desde la importación, la vista vuelve a estar activa, sin un mensaje nuevo.

Si edita y guarda entretanto, depende de la fuente. Con un archivo de Primavera, el archivo IFC conserva también el `.xer` original junto con él. La aplicación compara de nuevo y ofrece la vista: *El recálculo desplazó 1 de 2 tareas respecto a las fechas del archivo.* Con ella aparecen el botón *Mostrar fechas registradas* y una cruz. En cada tarea que difiere, el panel *Propiedades* muestra la marca *Difiere de las fechas registradas*. *Mostrar fechas registradas* activa la vista; Ctrl+Z deshace eso. La cruz oculta la oferta.

Con MS Project XML, `.mpp`, Primavera P6 XML o un archivo IFC de otro programa, el archivo IFC no conserva el origen. Si edita y guarda un proyecto así, la aplicación ya no compara al volver a abrirlo.

## Ejemplo práctico: la ampliación

Suponga que abre un archivo de Primavera *Uitbouw* (ampliación) con dos tareas, en un calendario sin festivos. En 2027, el 6 de mayo es Día de la Ascensión y el 17 de mayo es Lunes de Pentecostés: con festivos en el calendario, las fechas salen de otra manera. *Fundering storten* (verter la cimentación) dura 5 días laborables, *Metselwerk* (mampostería) 10 días laborables, y Metselwerk sigue a Fundering con una relación fin-comienzo. El archivo registra que Fundering va del lunes 3 de mayo al viernes 7 de mayo de 2027, y Metselwerk del lunes 17 de mayo al viernes 28 de mayo de 2027: una semana después del inicio temprano que permite la relación. El inicio planificado de Metselwerk en el archivo es el lunes 10 de mayo de 2027.

Justo después de abrir, ve las fechas del archivo. La barra de estado dice *Fin: 28-05-2027* y *Ruta crítica: 2 tareas, 20 días laborables*. La barra indica que 1 tarea difiere al recalcular, y las dos tareas muestran *Muestra las fechas propias registradas por Primavera para esta tarea*.

Al pulsar *Recalcular*, Fundering se queda del 3 al 7 de mayo. Metselwerk ahora empieza el lunes 10 de mayo, el día laborable siguiente al fin de Fundering, y termina el viernes 21 de mayo. La planificación termina el 21 de mayo de 2027 y abarca 15 días laborables en lugar de 20. La ruta crítica consta de las mismas 2 tareas.

¿Y si es distinto?

- Si Metselwerk también está planificada el lunes 17 de mayo en el archivo, el perfil de cálculo *Primavera P6* mantiene ese inicio. El cálculo termina del 17 al 28 de mayo, no hay diferencia y la vista no se activa.
- Añada una tarea en la vista: se produce el mismo recálculo. Metselwerk se desplaza al periodo del 10 al 21 de mayo.
- Guarda en la vista y vuelve a abrir el archivo IFC, sin editarlo: Metselwerk vuelve a estar del 17 al 28 de mayo.
- Recalcula, guarda sin editar más y vuelve a abrir el archivo IFC: la vista vuelve a estar activa y Metselwerk está del 17 al 28 de mayo.
- Edita, guarda y vuelve a abrir: la aplicación ofrece la vista con *El recálculo desplazó 1 de 2 tareas respecto a las fechas del archivo.* Metselwerk muestra *Difiere de las fechas registradas*.

## Consecuencias y malentendidos

**Una diferencia no es un error de importación.** La aplicación calcula con sus propias reglas: con un `.xer` con el perfil de cálculo *Primavera P6*, con un `.mpp` con *Microsoft Project*, y con CSV, MS Project XML y Primavera P6 XML con *Open Planner Studio*. Por qué las fechas del programa de origen salieron distintas puede deberse al archivo o al propio programa. La vista le muestra *que* difieren.

**La vista no es un resultado de cálculo.** La aplicación no calculó las fechas. No las tome sin más como resultado de su propia planificación.

**Guardar en la vista conserva las fechas del programa de origen.** El archivo IFC contiene entonces lo que decía el programa de origen, no lo que calcularía la aplicación.

**El botón *Mostrar fechas registradas* no aparece en cada importación.** Con un archivo recién abierto, la vista ya está activa. El botón solo aparece con un archivo IFC reabierto con origen Primavera que ha editado desde la importación.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): qué guarda la aplicación en un archivo y qué transporta una importación o exportación.
- [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen): los pasos y mensajes para un archivo `.xer`.
- [Abrir un archivo de MS Project (.mpp)](docs://howto-mpp-openen): los pasos y mensajes para un archivo `.mpp`.
- [Recuperación después de un fallo](docs://howto-herstellen-na-een-crash): qué le pasa a este proyecto después de un fallo.
- [Ruta crítica y holgura](docs://uitleg-kritiek-pad): cómo calcula la aplicación la holgura y la criticidad cuando sí calcula.
