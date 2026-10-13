# Activar el guardado automático

Objetivo: que la aplicación actualice el archivo de su proyecto mientras usted trabaja, para que no tenga que pulsar Ctrl+S todo el tiempo.

## Cuándo lo necesita

Usted trabaja una sesión larga con una misma planificación, o se olvida de guardar con frecuencia, y quiere que el archivo en disco o en una carpeta compartida esté al día. El guardado automático no sustituye a la recuperación tras un fallo: esta siempre está activa y funciona por separado. En [Archivos y formatos](docs://uitleg-bestanden) se explica la diferencia.

## Pasos

1. Si el proyecto todavía no tiene archivo, guárdelo primero una vez con *Inicio › Archivo › Guardar como*. Mientras no haya archivo, el interruptor aparece en gris y el texto de ayuda dice: *Guarde primero este proyecto para usar el guardado automático.*
2. En la barra superior, a la izquierda, haga clic en el interruptor *Guardado automático*. Cuando está activado, el texto de ayuda dice: *El guardado automático está activo: los cambios se escriben en este archivo.*
3. Siga trabajando. En cuanto su proyecto tiene cambios, la aplicación lo escribe en su archivo, sin ventana y como máximo una vez cada diez segundos. El marcador *Sin guardar* desaparece solo.
4. Si quiere parar, haga clic una vez más en el interruptor. El texto de ayuda dice entonces: *El guardado automático está desactivado. La recuperación sigue activa.*

Chrome y Edge, al principio, solo le permiten leer un archivo que usted ha abierto. El interruptor no hace nada ahí hasta que haya guardado una vez con *Guardar* (Ctrl+S) y el navegador le haya dado permiso para escribir. Después puede activarlo. En Firefox el interruptor se queda en gris: la aplicación no puede escribir en su archivo allí.

## Errores habituales y qué hace la aplicación en ese caso

**El interruptor pertenece a un solo proyecto.** Cada pestaña tiene su propio estado. Al abrir un proyecto, el interruptor siempre está desactivado, y la aplicación no lo recuerda para la próxima vez.

**El guardado automático solo escribe en el archivo que el proyecto ya tiene.** Si elige *Guardar como*, escribe en el nuevo archivo a partir de ese momento. La aplicación solo escribe si hay cambios.

**La escritura puede fallar.** Si el archivo ha desaparecido o está bloqueado, por ejemplo, aparece el mensaje *Error de guardado automático* con el motivo. Si el navegador no tiene permiso para escribir (o ya no lo tiene), la aplicación omite esa ronda sin avisar y no pide permiso.

**El archivo también recibe cambios que tal vez no quiera conservar.** El guardado automático escribe el estado de su proyecto tal como está en ese momento. Si deshace algo con Ctrl+Z, el archivo recibe también ese estado deshecho en un plazo de diez segundos. Si quiere conservar una versión anterior, primero haga una copia con *Guardar como*.

**Un fallo sigue haciendo perder los últimos segundos.** La aplicación escribe como máximo una vez cada diez segundos, así que lo que hizo entre tanto todavía no está en su archivo. La recuperación tiene el mismo límite.

**Después de una recuperación en el navegador, el interruptor vuelve a estar en gris.** Un proyecto que usted recupera en el navegador tras un fallo ya no está vinculado a su archivo. Guárdelo una vez y el interruptor vuelve a funcionar. Consulte [Recuperar tras un fallo](docs://howto-herstellen-na-een-crash).

**Un proyecto de otro formato no tiene archivo.** Un archivo CSV, XML, `.mpp` o `.xer` solo recibe un archivo IFC cuando usted guarda. Después puede activar el guardado automático.

## Véase también

- [Archivos y formatos](docs://uitleg-bestanden): la diferencia entre guardar, el guardado automático y la recuperación tras un fallo.
- [Abrir y guardar un archivo](docs://howto-bestand-openen-en-opslaan): guardar, guardar como y el marcador *Sin guardar*.
- [Recuperar tras un fallo](docs://howto-herstellen-na-een-crash): lo que ofrece la aplicación si no se cerró correctamente.
