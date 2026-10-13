# Abrir un archivo de MS Project (.mpp)

Objetivo: abrir una planificación de Microsoft Project directamente en la aplicación, sin exportarla antes.

## Cuándo lo necesita

Un contratista, un consultor o un cliente le envía su planificación como archivo `.mpp`. Quiere verla, calcularla o seguir desarrollándola. La aplicación lee archivos `.mpp` de MS Project 2010 hasta 2021 incluido. Solo lee: no escribe `.mpp` y nunca cambia su archivo. Del archivo toma la planificación en sí misma: tareas con estructura, duración y restricciones, relaciones con desfase, calendarios, recursos, asignaciones y avance. También lee las fechas y las holguras que MS Project calculó por sí mismo, pero solo las usa para la vista *Fechas tal como están registradas*, nunca como dato de entrada.

## Pasos

1. Elija *Inicio › Archivo › Abrir* o pulse Ctrl+O. Elija el archivo `.mpp`.
2. El proyecto se abre en una pestaña nueva o en la pestaña actual, si todavía estaba vacía y sin cambios. El proyecto no tiene archivo: *Guardar* escribe después un archivo IFC nuevo.
3. Lea el mensaje de la parte inferior: *Este proyecto calcula como Microsoft Project. Cámbialo en Archivo → Info del proyecto → Perfil de cálculo y opciones.* La aplicación calcula este proyecto con las reglas de cálculo de MS Project: el perfil de cálculo *Microsoft Project*. Con *Abrir perfil de cálculo* va al ajuste; *Leer más* abre la ayuda sobre perfiles de cálculo.
4. Compruebe si aparece una franja debajo de la cinta: *Estás viendo las fechas tal como están registradas en el archivo; recalcular desplazaría 4 tareas.* En ese caso, en esas tareas el resultado de la aplicación difiere de las fechas que guardó MS Project. Debajo del mensaje del paso 3 aparece también una línea: *4 tareas muestran las fechas tal como están registradas en el archivo (sin recalcular).* Qué significa eso y cómo se cambia al cálculo propio de la aplicación se explica en [Fechas tal como están registradas](docs://uitleg-datums-zoals-opgeslagen).
5. Si aparece *Este archivo contiene planificación por horas.* con el botón *Activar planificación por horas*, el archivo contiene datos en horas. Consulte [Activar la planificación por horas](docs://howto-urenplanning-aanzetten).

Si el archivo contiene tareas con divisiones, nivelación o una planificación determinada por recursos, se añade otro mensaje, por ejemplo *Este archivo de MS Project contiene 3 tareas con una planificación dividida, nivelada o determinada por recursos. Se importan y se muestran tal cual.* Para una tarea, el mensaje está en singular.

## Posibles problemas y qué hace entonces la aplicación

**No se importa todo.** La aplicación no toma las líneas base, los costes, las tarifas, las notas ni los campos personalizados de MS Project. Un código WBS que usted mismo rellenó en MS Project se toma; si no, la aplicación numera las tareas según la estructura.

**Un archivo de MS Project 2007 o anterior.** La aplicación lo rechaza e informa: *Este archivo .mpp usa un formato antiguo (Project 2007 o anterior). Expórtalo en MS Project como XML (Archivo → Guardar como → XML) y abre ese archivo.* Debajo del mensaje, la aplicación añade un motivo técnico en inglés.

**Un archivo con contraseña.** La aplicación informa: *Este archivo .mpp está protegido con contraseña. Expórtalo en MS Project como XML (Archivo → Guardar como → XML) y abre ese archivo.* También aquí el mensaje va acompañado de un motivo técnico en inglés.

**Un archivo que no es un `.mpp`.** Aparece *No se pudo abrir el archivo*, con un motivo técnico.

**La ruta por XML calcula de otra manera.** Si abre la exportación XML de MS Project en lugar del `.mpp`, la aplicación calcula con el perfil de cálculo *Open Planner Studio* y usted no ve el mensaje sobre *Microsoft Project*. Las fechas pueden ser entonces distintas de las del archivo `.mpp`.

**Una edición quita a MS Project el control.** Si edita una tarea cuya planificación controlaba la ventana de fechas de MS Project, la aplicación informa una vez por proyecto: *La distribución de horas de MS Project ya no controla 2 tareas después de esta edición; la distribución original se conserva en el archivo.* Para una tarea, el mensaje está en singular.

**Al guardar, nunca se sobrescribe su `.mpp`.** El proyecto no tiene archivo. *Guardar* pregunta dónde debe guardarse el nuevo archivo IFC.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): por qué un `.mpp` solo se lee y qué escribe al guardar.
- [Fechas tal como están registradas](docs://uitleg-datums-zoals-opgeslagen): la vista de las fechas propias de MS Project.
- [Activar la planificación por horas](docs://howto-urenplanning-aanzetten): si el archivo contiene datos en horas.
- [Abrir un archivo de Primavera P6 (.xer)](docs://howto-xer-openen): lo mismo para Primavera.
- [Formatos de importación y exportación](docs://ref-import-exportformaten): por formato, qué se conserva y qué no.
- [Perfiles de cálculo y convenciones](docs://uitleg-rekenprofielen): por qué un archivo de MS Project se abre con su propio perfil de cálculo.
