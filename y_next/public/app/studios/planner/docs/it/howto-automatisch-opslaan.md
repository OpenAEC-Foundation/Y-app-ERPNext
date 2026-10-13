# Attivare il salvataggio automatico

Obiettivo: far sì che l'app aggiorni il file del progetto mentre lavori, così non devi premere sempre Ctrl+S.

## Quando ti serve questo

Lavori a lungo su una pianificazione, oppure dimentichi spesso di salvare, e vuoi che il file sul disco o in una cartella condivisa stia al passo. Il salvataggio automatico non sostituisce il recupero: quello è sempre attivo e funziona separatamente da questo. Che differenza c'è, lo leggi in [File e formati](docs://uitleg-bestanden).

## Passaggi

1. Se il progetto non ha ancora un file, salvalo prima una volta con *Home › File › Salva come*. Finché non c'è un file, l'interruttore è grigio e il suggerimento dice: *Salva prima questo progetto per usare il salvataggio automatico.*
2. In alto a sinistra, nella barra superiore, fai clic sull'interruttore *Salvataggio automatico*. Quando è attivo, il suggerimento dice: *Il salvataggio automatico è attivo: le modifiche vengono scritte in questo file.*
3. Continua a lavorare. Appena il progetto ha modifiche, l'app le scrive nel tuo file, senza una finestra e al massimo una volta ogni dieci secondi. Il marcatore *Non salvato* sparisce da solo.
4. Se vuoi fermarti, fai clic ancora una volta sull'interruttore. Il suggerimento dice poi: *Il salvataggio automatico è disattivato. Il recupero rimane attivo.*

Chrome ed Edge permettono in un primo momento solo di leggere un file che hai aperto. L'interruttore non fa nulla lì finché non hai salvato una volta con *Salva* (Ctrl+S) e il browser ha dato il permesso di scrivere. Dopo puoi attivarlo. In Firefox l'interruttore resta grigio: l'app non può scrivere nel tuo file lì.

## Errori tipici e cosa fa l'app allora

**L'interruttore appartiene a un progetto.** Ogni scheda ha il proprio stato. Dopo aver aperto un progetto l'interruttore è sempre spento, e l'app non se lo ricorda la volta successiva.

**Il salvataggio automatico scrive solo nel file che il progetto ha già.** Se scegli *Salva come*, da quel momento scrive nel nuovo file. L'app scrive solo se ci sono modifiche.

**La scrittura può non riuscire.** Se il file è sparito o bloccato, per esempio, compare il messaggio *Salvataggio automatico non riuscito*, con il motivo. Se il browser non ha (o non ha più) il permesso di scrivere, l'app salta quel giro in silenzio e non chiede il permesso.

**Il file riceve anche modifiche che non vuoi conservare.** Il salvataggio automatico scrive lo stato del progetto così com'è in quel momento. Se annulli qualcosa con Ctrl+Z, il file riceve entro dieci secondi anche quello stato annullato. Se vuoi conservare una versione più vecchia, prima crea una copia con *Salva come*.

**Un arresto anomalo fa ancora perdere gli ultimi secondi.** L'app scrive al massimo una volta ogni dieci secondi, quindi ciò che hai fatto nel frattempo non è ancora nel tuo file. Anche il recupero ha questo stesso limite.

**Dopo un recupero nel browser l'interruttore è di nuovo grigio.** Un progetto che recuperi nel browser dopo un arresto anomalo non è più collegato al suo file. Salvalo una volta, e l'interruttore funziona di nuovo. Vedi [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash).

**Un progetto in un altro formato non ha un file.** Un file CSV, XML, `.mpp` o `.xer` riceve un file IFC solo quando lo salvi. Dopo puoi attivare il salvataggio automatico.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): la differenza tra salvare, salvataggio automatico e recupero.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): salvare, *Salva come* e il marcatore *Non salvato*.
- [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash): cosa offre l'app se non si è chiusa correttamente.
