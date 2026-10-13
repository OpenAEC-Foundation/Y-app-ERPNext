# Date come registrate

Apri una pianificazione da Primavera o MS Project e le date sono diverse da ciò che hai visto in quel programma. È andata male l'importazione? Di solito no. In questo articolo leggi perché l'app ricalcola da sola, quando mostra le date del file, che cosa resta vuoto allora e come torni al proprio calcolo. L'esempio alla fine segue due attività per tutto il processo.

## Il concetto

Un file di pianificazione contiene due tipi di dati. Il primo è la logica: attività, durate, relazioni, calendari e vincoli. Il secondo sono le date che il programma stesso ha calcolato da quella logica. All'apertura, Open Planner Studio usa la logica e calcola da sé. Quindi le date nel file non sono dati in ingresso.

Se il calcolo dell'app dà date diverse da quelle indicate nel file, non sai quale sia quella giusta. Nel file può mancare una logica che il programma ha usato. Il programma può anche calcolare in modo diverso dall'app su qualche punto. Per questo l'app può mostrare le date **come registrate**: le date che l'altro programma ha scritto nel file. Così confronti con ciò che hai visto in quel programma.

## Come l'app gestisce la cosa

### Quale profilo di calcolo usa l'app

L'app calcola con un **profilo di calcolo**: un insieme di regole di calcolo (convenzioni) che decide, per esempio, come tratta l'inizio pianificato di un'attività e i vincoli. Vedi [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen). Ci sono tre profili integrati: *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Un `.xer` si apre con *Primavera P6* e un `.mpp` con *Microsoft Project*. CSV, MS Project XML e Primavera P6 XML si aprono con *Open Planner Studio*. Il profilo di un progetto si trova in *File › Info progetto*, in *Profilo di calcolo e opzioni*. Un file IFC creato dall'app conserva il suo profilo.

### Quando l'app confronta

All'apertura, l'app registra che cosa diceva il file e lo confronta con il proprio risultato. Lo fa per:

- un file Primavera (`.xer`) e Primavera P6 XML;
- MS Project XML e file MS Project (`.mpp`);
- un file IFC di un altro programma, per le attività i cui inizi anticipati sono nel file;
- un file IFC dell'app stessa che ha memorizzato la sua origine. Più avanti leggi quando succede.

L'app non confronta mai un file CSV: la data di inizio in un CSV è un dato in ingresso, non il risultato di un calcolo. Anche un file IFC dell'app senza origine memorizzata non viene confrontato.

Se nessuna attività differisce, non noti nulla. Se almeno un'attività differisce in un file che stai importando ora, l'app attiva subito la vista.

Con un file Primavera l'app calcola con il profilo di calcolo *Primavera P6*. Così mantiene l'inizio pianificato del file come inizio anticipato. Un'attività che nel file è più tardi di quanto richiedano le relazioni, ma che è anche pianificata lì, quindi resta dov'è: in quel caso non c'è alcuna differenza.

### Che cosa vedi

Sotto la barra multifunzione c'è una striscia: *Stai visualizzando le date come registrate nel file; un ricalcolo sposterebbe 4 attività.* Con una fonte Primavera (un `.xer` o Primavera P6 XML) dice *Stai visualizzando la pianificazione come registrata da Primavera; un ricalcolo sposterebbe 1 attività.* A destra della striscia c'è il pulsante *Ricalcola*. La striscia non ha una croce.

C'è anche un messaggio: *4 attività mostrano le date come registrate nel file (non ricalcolate).* Solo con un `.xer` dice *1 attività mostra le date come registrate da Primavera (non ricalcolate).* Ogni attività per cui il file ha registrato delle date mostra un contrassegno nel pannello *Proprietà*: *Mostra le date registrate da Primavera per questa attività* con una fonte Primavera, oppure *Mostra le date così come registrate nel file per questa attività* con un'altra fonte. Il Gantt, la tabella attività e la barra di stato mostrano le date del file.

### Che cosa resta vuoto in questa vista

In questa vista l'app non calcola nulla. Mostra solo ciò che il file ha registrato. Quindi vedi il margine e il percorso critico solo se il file li contiene. Se il file non registra attività critiche, la barra di stato indica 0 attività critiche. Questo non dice nulla sul percorso critico nel programma stesso. Ciò che esce solo da un calcolo non esiste in questa vista: quali relazioni guidano la pianificazione, vincoli violati, attività fuori sequenza e attività quasi critiche.

Se il file non registra tutto per un'attività, vedi il contrassegno *Registrazione parzialmente incompleta — vedere le colonne di fine tardiva/margine* nel pannello *Proprietà*. In un export CSV restano vuote le colonne *Critica* e *Margine totale* per quell'attività, invece di uno zero inventato.

### Uscire dalla vista

Esci dalla vista in due modi:

- Fai clic su *Ricalcola* nella striscia, oppure scegli *Calcola* (F5). L'app calcola con le proprie regole.
- Modifica qualcosa che può cambiare le date, per esempio la durata di un'attività o una nuova attività. L'app esce dalla vista e ricalcola subito, anche se *Calcola automaticamente* è disattivato. Cambiare un nome non ha questo effetto: la vista resta attiva.

Una modifica del calendario dalla libreria di risorse lascia attiva la vista e invariate le date del file, ma aggiorna il numero nella striscia.

Dopo l'uscita non c'è un pulsante per tornare alla vista. Ctrl+Z la riporta, subito dopo il ricalcolo o subito dopo una modifica di questo tipo. Altrimenti puoi aprire di nuovo il file di origine. Con un `.xer`, anche aprire un file IFC che hai salvato dopo il ricalcolo, ma non hai modificato, attiva di nuovo la vista.

### Recupero dopo un arresto anomalo

Se recuperi un progetto dopo un arresto anomalo mentre era nella vista, la vista resta attiva. Il progetto attivo mostra la stessa striscia di prima. Un progetto su un'altra scheda mostra la striscia senza numero: *Stai visualizzando le date come registrate nel file. Non è stato eseguito alcun ricalcolo.* Vedi [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash).

### Salvare e riaprire

Se salvi mentre usi la vista, l'app scrive le date visualizzate nel file IFC, insieme al formato di origine. Se poi riapri quel file IFC e non l'hai modificato dall'importazione, la vista è di nuovo attiva, senza un nuovo messaggio.

Se nel frattempo hai modificato e salvato, dipende dalla fonte. Con un file Primavera il file IFC conserva anche l'`.xer` originale. L'app allora confronta di nuovo e propone la vista: *Il ricalcolo ha spostato 1 attività su 2 rispetto alle date del file.* Insieme compaiono il pulsante *Mostra le date registrate* e una croce. Su ogni attività che diverge, il pannello *Proprietà* mostra il contrassegno *Diverge dalle date registrate*. *Mostra le date registrate* attiva la vista; Ctrl+Z annulla questa azione. La croce nasconde la proposta.

Con MS Project XML, `.mpp`, Primavera P6 XML o un file IFC di un altro programma, il file IFC non conserva la fonte. Se modifichi e salvi un progetto così, l'app, alla riapertura, non confronta più le date.

## Esempio svolto: l'ampliamento

Immagina di aprire un file Primavera *Uitbouw* (ampliamento) con due attività, su un calendario senza festività. Nel 2027, il 6 maggio è l'Ascensione e il 17 maggio è il lunedì di Pentecoste: con le festività nel calendario, le date risulterebbero diverse. *Fundering storten* (gettare le fondazioni) dura 5 giorni lavorativi, *Metselwerk* (muratura) 10 giorni lavorativi, e Metselwerk segue Fundering con una relazione fine-inizio. Il file registra che Fundering va da lunedì 3 maggio a venerdì 7 maggio 2027 e Metselwerk da lunedì 17 maggio a venerdì 28 maggio 2027: una settimana dopo l'inizio anticipato che la relazione consente. L'inizio pianificato di Metselwerk nel file è lunedì 10 maggio 2027.

Subito dopo l'apertura vedi le date del file. La barra di stato dice *Fine: 28-05-2027* e *Percorso critico: 2 attività, 20 giorni lavorativi*. La striscia indica che un ricalcolo sposterebbe 1 attività, ed entrambe le attività mostrano *Mostra le date registrate da Primavera per questa attività*.

Con *Ricalcola*, Fundering resta dal 3 al 7 maggio. Metselwerk ora inizia lunedì 10 maggio, il giorno lavorativo dopo la fine di Fundering, e finisce venerdì 21 maggio. La pianificazione finisce il 21 maggio 2027 e dura 15 giorni lavorativi invece di 20. Il percorso critico è composto dalle stesse 2 attività.

E se va diversamente?

- Se anche Metselwerk è pianificata nel file per lunedì 17 maggio, il profilo di calcolo *Primavera P6* mantiene quell'inizio. Il calcolo dà date dal 17 al 28 maggio, non c'è alcuna differenza e la vista non si attiva.
- Aggiungi un'attività nella vista: l'app fa lo stesso ricalcolo. Metselwerk passa dal 10 al 21 maggio.
- Salvi nella vista e riapri il file IFC, senza modificarlo: Metselwerk è di nuovo dal 17 al 28 maggio.
- Ricalcoli, salvi senza modificare ancora e riapri il file IFC: la vista è di nuovo attiva e Metselwerk è dal 17 al 28 maggio.
- Modifichi, salvi e riapri: l'app propone la vista con *Il ricalcolo ha spostato 1 attività su 2 rispetto alle date del file.* Metselwerk mostra *Diverge dalle date registrate*.

## Conseguenze e malintesi

**Una differenza non è un errore di importazione.** L'app calcola con le proprie regole: con un `.xer` con il profilo di calcolo *Primavera P6*, con un `.mpp` con *Microsoft Project*, con CSV, MS Project XML e Primavera P6 XML con *Open Planner Studio*. Il motivo per cui le date nel programma di origine risultano diverse può dipendere dal file o dal programma. La vista ti mostra *che* le date differiscono.

**La vista non è un risultato di calcolo.** L'app non ha calcolato le date. Non copiarle semplicemente come risultato della tua pianificazione.

**Salvare nella vista conserva le date del programma di origine.** Il file IFC contiene allora ciò che diceva il programma di origine, non ciò che l'app calcolerebbe.

**Il pulsante *Mostra le date registrate* non compare con ogni importazione.** Con un file appena aperto la vista è già attiva. Il pulsante compare solo con un file IFC riaperto con una fonte Primavera, che hai modificato dopo l'importazione.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): cosa l'app conserva in un file e cosa portano un'importazione o un export.
- [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen): i passaggi e i messaggi per un file `.xer`.
- [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen): i passaggi e i messaggi per un file `.mpp`.
- [Recupero dopo un arresto anomalo](docs://howto-herstellen-na-een-crash): cosa succede a questo progetto dopo un arresto anomalo.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): come l'app calcola il margine e la criticità quando calcola.
