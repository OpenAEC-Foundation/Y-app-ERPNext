# Impostare un vincolo o una scadenza

Obiettivo: registrare un accordo sulla data per un'attività, così che la pianificazione ne tenga conto oppure mostri che non lo stai rispettando.

## Quando ti serve

I mattoni vengono consegnati solo il 21 giugno, quindi la muratura non può iniziare prima: un **vincolo** *iniziare non prima del (SNET)*. Il tetto deve essere chiuso prima delle festività estive delle imprese edili, e vuoi ricevere un avviso se non ci si riesce: una **scadenza**. Il getto è fissato a un giorno preciso perché la centrale del calcestruzzo lo ha promesso: *deve iniziare il*. Quale tipo va bene in quale caso, e cosa fa l'app con esso, è spiegato in [Vincoli e scadenze](docs://uitleg-constraints).

## Passaggi

Imposti un vincolo e una scadenza nel pannello *Proprietà*.

1. Seleziona l'attività. Se non vedi il pannello *Proprietà*, attivalo con *Vista › Pannelli › Proprietà*.
2. Su *Vincolo* scegli il tipo, per esempio *Iniziare non prima del (SNET)*.
3. Con ogni tipo tranne *Il più presto possibile (ASAP)* e *Il più tardi possibile (ALAP)* appare il campo *Data del vincolo*. Scrivi la data nelle tre caselle per giorno, mese e anno, per esempio 21, 06 e 2027, e premi Invio. L'app passa da sola alla casella successiva appena una casella è piena. Dopo che hai scelto il tipo, c'è già una data: quella del vincolo precedente, oppure altrimenti l'inizio pianificato originale dell'attività. Può essere diversa dall'inizio che mostra il pannello, quindi inserisci sempre tu la data che intendi.
4. Se vuoi fissare l'attività su quella data, anche prima dei suoi predecessori, scegli *Deve iniziare il (MSO)* o *Deve finire il (MFO)* e spunta *Obbligatorio (logica di blocco)*. Questo è un blocco rigido; usalo solo per una data che è davvero fissa.
5. Se vuoi anche un secondo limite, per esempio un'attività che non può iniziare prima del 14 giugno e deve essere finita entro il 17 giugno, scegli un tipo in *Vincolo secondario* e compila la *Data secondaria*. Questo campo appare con ogni vincolo che ha una data, tranne con un blocco rigido. Con MSO e MFO un vincolo secondario non è ammesso: l'app lo segna allora in rosso.
6. Per una scadenza compila il campo *Scadenza*, nello stesso modo della data del vincolo. Una scadenza è separata dal vincolo: puoi impostarli entrambi sulla stessa attività.
7. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*. Fino ad allora la barra di stato mostra *Non aggiornato — ricalcola (F5)*.

I campi si trovano anche nella finestra *Modifica attività*, che apri con clic destro sull'attività e scegliendo *Modifica...*; conferma con *Salva*.

Nella tabella lavori con le colonne. Fai clic sul **+** nell'intestazione della tabella e, sotto *Vincoli*, scegli le colonne *Tipo vincolo*, *Data vincolo* e *Scadenza* (ci sono anche *Vincolo rigido*, *Tipo vincolo secondario* e *Data vincolo secondario*). Fai doppio clic su una cella per modificarla: scegli il tipo da un elenco e scrivi una data con trattini, per esempio 21-06-2027. Il *Vincolo rigido* si può modificare solo per MSO e MFO.

Se l'attività ha un predecessore, c'è una scorciatoia per *Iniziare non prima del (SNET)*: scrivi semplicemente una nuova data di inizio nel campo *Inizio* (nel pannello *Proprietà*, in *Modifica attività* o nella tabella), oppure sposta la barra nel Gantt. L'app la trasforma allora da sola in un vincolo *Iniziare non prima del (SNET)* e te lo comunica.

## Controllare il risultato

- Nel Gantt c'è un piccolo rombo sopra la barra, sul lato dell'inizio per un vincolo di inizio e sul lato della fine per un vincolo di fine: blu per SNET e FNET, viola per SNLT, FNLT, MSO e MFO, rosso se il vincolo è violato. Un blocco rigido ha una puntina. Una scadenza è una freccia verso il basso sulla data di scadenza: verde finché l'attività è finita in tempo, rossa se la data è superata.
- Un vincolo violato o una scadenza non rispettata compare nel pannello *Avvisi* (*Pianificazione › Pianificazione › Avvisi*) e nella barra di stato. Il *Margine totale* dell'attività e di quelle prima di essa è poi negativo.
- Con un limite superiore (*iniziare non oltre il (SNLT)*, *finire non oltre il*) o una scadenza, l'assenza di un avviso significa che la pianificazione rispetta la data.

## Rimuovere un vincolo o una scadenza

Su *Vincolo* scegli di nuovo *Il più presto possibile (ASAP)*. Così si rimuove anche il vincolo secondario. Rimuovi una scadenza svuotando le tre caselle e premendo Invio. Poi premi **Calcola**.

## Errori comuni e cosa fa l'app

**Un vincolo su una fase.** Un vincolo o una scadenza su una fase (attività di riepilogo) non ha effetto. Impostalo sull'attività stessa.

**Un'attività che è già iniziata.** Se l'attività ha un inizio effettivo o un avanzamento, mantiene il suo inizio effettivo. Un vincolo *iniziare non prima del (SNET)* con una data successiva non la sposta.

**Scrivere una data di inizio insieme a un altro vincolo.** Se l'attività ha un predecessore e ha già un altro vincolo, per esempio *Il più tardi possibile (ALAP)*, l'app non applica la data di inizio scritta. Un messaggio indica il vincolo; cambialo se vuoi spostare l'inizio.

**Una data nel fine settimana.** Una data di sabato, domenica o di festività conta come giorno lavorativo: un limite inferiore (*iniziare non prima del (SNET)*, *finire non prima del*) come il giorno lavorativo successivo, un limite superiore (*iniziare non oltre il (SNLT)*, *finire non oltre il*) come quello precedente.

**Un vincolo secondario non ammesso.** L'app segna una combinazione non valida in rosso, con il motivo, per esempio *Il vincolo primario e quello secondario non possono limitare lo stesso lato.* Un vincolo secondario non è ammesso con ASAP, ALAP, MSO, MFO e un blocco rigido.

**Un blocco rigido.** La prima volta che lo attivi, l'app avvisa che un blocco rigido ha la precedenza sulle relazioni. L'attività si trova allora sulla data, anche prima dei suoi predecessori; quei predecessori ottengono un margine negativo.

**Dopo averlo impostato non cambia nulla.** I vincoli funzionano solo dopo **Calcola**. Se un limite superiore (*iniziare non oltre il (SNLT)*, *finire non oltre il*) non ha effetto sulle barre, è normale: un limite superiore non sposta nulla, ma rende il margine negativo se la data non è rispettata.

## Vedi anche

- [Vincoli e scadenze](docs://uitleg-constraints): cosa fa ogni tipo, e la spiegazione di blocco rigido, margine negativo e scadenza.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): cosa fa il margine negativo sul percorso critico.
- [Relazioni e ritardo](docs://uitleg-relaties): le relazioni che si combinano con un vincolo.
- [Notifiche e avvisi](docs://ref-meldingen): gli avvisi per un vincolo violato o per una scadenza non rispettata.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): un vincolo legato al permesso *iniziare non prima del (SNET)* su *Demolish existing extension* (14 maggio 2027) e una scadenza che viene rispettata con margine.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una scadenza volutamente stretta su *Contractual project handover* (15 luglio 2027): dopo aver calcolato, la fine è il 17 agosto e molte attività hanno un margine negativo.
