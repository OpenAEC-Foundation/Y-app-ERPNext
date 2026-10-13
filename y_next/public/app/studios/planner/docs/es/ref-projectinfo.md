# Nuevo proyecto e Info del proyecto

Los campos de la ventana *Nuevo proyecto* y de *Info del proyecto*: qué hace cada campo, cuál es el predeterminado y dónde surte efecto. Son dos caras del mismo formulario. *Nuevo proyecto* crea un proyecto nuevo y tiene algunos campos adicionales. *Info del proyecto* cambia el proyecto que tiene abierto.

## Apertura

**Nuevo proyecto** — *Archivo › Nuevo*, Ctrl+N, o el signo más a la derecha de las pestañas de documento (*Iniciar un proyecto*, después *Nuevo proyecto*). La ventana se abre con el cursor en *Nombre del proyecto*.

**Info del proyecto** — *Configuración › Proyecto › Info del proyecto* abre el formulario como una ventana titulada *Información del proyecto*. *Archivo › Info del proyecto* muestra el mismo formulario en la pantalla *Archivo*. El bloque *Perfil de cálculo y opciones* está abajo en ambos lugares; lo que contiene está en [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).

## Crear, Aplicar y cancelar

**Crear** (en *Nuevo proyecto*) crea el proyecto y lo abre en una pestaña propia. **Aplicar** (en *Info del proyecto*) escribe sus cambios en el proyecto.

- **Solo al aplicar.** Usted escribe en un borrador. El proyecto cambia solo cuando hace clic en *Aplicar*. *Aplicar* escribe solo lo que realmente cambió, en un solo paso de *Deshacer*. Si hace clic en *Aplicar* sin cambiar nada, no pasa nada y no se añade ningún paso.
- **Cancelar, la cruz y Esc** cierran la ventana sin guardar nada. Un clic junto a la ventana no la cierra: lo que había escrito se mantiene.
- **Intro** hace lo mismo que *Crear* o *Aplicar*, salvo en el campo *Descripción* y en una lista desplegable abierta.
- **En la pantalla Archivo**, *Info del proyecto* muestra *Cambios no aplicados: haga clic en Aplicar para conservarlos.* abajo mientras su borrador sea distinto. Si después sale de la pantalla, la aplicación pregunta si quiere aplicar, descartar o cancelar. Véase [La cinta, pestaña por pestaña](docs://ref-lint).
- **Un perfil de cálculo personalizado sin nombre** impide *Aplicar* y *Crear*. Póngale un nombre o descarte el cambio.

## Campos en las dos ventanas

**Nombre del proyecto** — el nombre del proyecto en la barra de título, en la pestaña y en el nombre del archivo al guardar. Predeterminado: vacío. Un campo vacío está permitido: el proyecto se llama entonces *Nueva planificación*, que se muestra como texto gris en el campo. Dónde: toda la pantalla.

**Descripción** — texto libre. Predeterminado: vacío. Efecto: se guarda con el proyecto, en el archivo IFC y en la exportación a Primavera P6 XML, y no influye en la planificación.

**Autor** — texto libre. Predeterminado: vacío. Efecto: pasa al archivo IFC y aparece como *Autor:* en el encabezado de un informe, donde no puede volver a escribirlo.

**Biblioteca de recursos** — a qué biblioteca de recursos está vinculado el proyecto. Elija entre *ninguna (proyecto independiente)*, sus bibliotecas existentes y *+ Nueva biblioteca de recursos…*. Predeterminado: en *Nuevo proyecto* la biblioteca predeterminada, en *Info del proyecto* el vínculo actual. Efecto: véase [Usar la biblioteca de recursos](docs://howto-resourcebibliotheek-gebruiken). Con *+ Nueva biblioteca de recursos…* escribe un nombre en un campo de abajo; la biblioteca solo se crea con *Crear* o *Aplicar*, así que al cancelar no queda nada. Un vínculo en *Info del proyecto* solo cambia si usted mismo modifica este campo.

**Cliente/organización** — texto libre. Predeterminado: vacío. Efecto: pasa al archivo IFC y aparece como *Empresa:* en el encabezado de un informe.

**Fecha de inicio** — el inicio del proyecto. Predeterminado: en *Nuevo proyecto*, hoy. Lo que hace el campo está abajo, en *Qué hace la fecha de inicio*.

**Fecha de fin** — el fin planificado del proyecto. Predeterminado: vacío. Efecto: es un dato informativo, no un requisito: la aplicación no planifica hacia esta fecha. Aparece en el encabezado de un informe y en las exportaciones, y determina hasta qué año se generan los festivos. Solo en un archivo de Primavera con el ajuste *Calcular la holgura hasta la fecha de fin del proyecto* (véase [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies)) el cálculo de holgura llega hasta esta fecha.

**Unidad predeterminada para tareas nuevas** — solo visible cuando *Activar planificación por horas* está activado. Elija entre *Días* y *Horas*. Predeterminado: *Días*. Efecto y condiciones: véase [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).

**Perfil de cálculo y opciones** — en *Info del proyecto* todo el bloque; en *Nuevo proyecto* solo la lista desplegable *Perfil de cálculo* con *Primavera P6*, *Microsoft Project* y *Open Planner Studio*. Predeterminado: *Open Planner Studio*. Al elegir un perfil también se fijan las opciones predeterminadas de ese perfil. Véase [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies).

## Solo en la ventana Nuevo proyecto

**Plantilla de fases** — qué fases tiene el proyecto al empezar. Elija entre *Vacío*, *Construcción residencial* y *Edificación / renovación*. Predeterminado: *Vacío*. Efecto: *Vacío* deja un proyecto sin tareas. Las otras dos crean ocho tareas de fase listas, cada una con una duración de 5 en la unidad predeterminada del proyecto (5 días laborables, o 5 horas si elige *Horas* en *Unidad predeterminada para tareas nuevas*) y sin relaciones; usted las renombra, mueve y amplía. Para *Construcción residencial* son: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking y Oplevering. Para *Edificación / renovación*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen y Oplevering. Los nombres son datos de su proyecto y se quedan en neerlandés, también con otro idioma de la interfaz. Si *Activar el modo construcción* está desactivado, solo existe *Vacío*. Véase [Configuración](docs://ref-instellingen).

**Turno** — solo visible cuando *Activar planificación por horas* está activado. Elija entre *Turno de día*, *2 turnos*, *3 turnos* y *24/7*. Predeterminado: *Turno de día*. Efecto: *Turno de día* deja el calendario estándar tal cual, un calendario de días normal de lunes a viernes. Los otros tres colocan bandas de horario laboral en el calendario del proyecto, como los botones con el mismo nombre en la ventana *Calendarios*. Qué horas son esas está en [Definir los horarios laborales](docs://howto-werktijden-instellen). Con *Turno de día* no se puede elegir *Horas* en *Unidad predeterminada para tareas nuevas*, porque un calendario de días no tiene bandas de horario laboral.

**Conjunto de festivos** — qué días no laborables recibe el calendario del proyecto. En *País* elige *Países Bajos* (predeterminado), *Alemania*, *Bélgica*, *Francia*, *Reino Unido*, *Austria*, *Suiza*, *Sin festivos* o *Personalizado…*. Si el país tiene regiones, se añade una lista desplegable *Región*. Para los Países Bajos elige también, si *Activar el modo construcción* está activado, la opción *Vacaciones de construcción*: *Ninguna* (predeterminado), *Norte*, *Centro* o *Sur*. Debajo hay una línea como *36 festivos, 2025–2029*, que puede desplegar para ver la lista. Los años van desde el año anterior al inicio del proyecto hasta el año posterior a la fecha de fin, o hasta tres años después del año de inicio si no hay fecha de fin. *Personalizado…* crea un calendario sin festivos y abre la ventana *Calendarios* justo después de crear el proyecto, para que los rellene usted mismo. El calendario del proyecto se llama *Bouwkalender NL*, o *Standaardkalender* si *Activar el modo construcción* está desactivado; en ese caso también puede elegir *Sin festivos*. Cómo funciona el generador está en [Generar festivos y vacaciones de construcción](docs://howto-feestdagen-genereren).

## Qué hace la fecha de inicio

La fecha de inicio es el ancla del proyecto. Tres reglas:

- **Las tareas nuevas empiezan en la fecha de inicio.** Una tarea que añade recibe el inicio del proyecto como inicio planificado.
- **Una tarea con predecesor nunca empieza antes de la fecha de inicio.** Si el fin del predecesor es anterior, la tarea espera hasta la fecha de inicio. Una tarea *sin* predecesor conserva su propia fecha, aunque esa sea anterior a la fecha de inicio. Eso hace falta para mostrar una planificación de MS Project o Primavera como la muestra el programa de origen. Una restricción *Debe comenzar el (MSO)* o *Debe finalizar el (MFO)* rompe ambas reglas: esa tarea queda en su fecha, aunque caiga antes de la fecha de inicio.
- **Una fecha de inicio posterior mueve las tareas sueltas.** Si cambia la fecha de inicio a una fecha posterior en *Info del proyecto* y hace clic en *Aplicar*, las tareas sin predecesor y sin una restricción que fije un límite inferior (*No comenzar antes del (SNET)*, *Debe comenzar el (MSO)*, *No finalizar antes del* o *Debe finalizar el (MFO)*) que caigan antes de la nueva fecha se mueven a esa fecha, en el mismo paso de *Deshacer*. La aplicación indica cuántas tareas se han movido. Eso solo ocurre cuando usted cambia la fecha de inicio, nunca al abrir un archivo. Fijar una fecha de inicio posterior no mueve el resto de la planificación: eso lo hace *Mover proyecto*, véase [Mover un proyecto](docs://howto-project-verplaatsen).

## Véase también

- [Opciones de cálculo y convenciones](docs://ref-rekenopties-en-conventies): el bloque *Perfil de cálculo y opciones*.
- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): por qué un perfil cambia el resultado.
- [Mover un proyecto](docs://howto-project-verplaatsen): toda la planificación a otro inicio.
- [Añadir tareas e hitos](docs://howto-taken-en-mijlpalen-toevoegen): cómo empezar con las primeras tareas.
- [Generar festivos y vacaciones de construcción](docs://howto-feestdagen-genereren): el conjunto de festivos con detalle.
