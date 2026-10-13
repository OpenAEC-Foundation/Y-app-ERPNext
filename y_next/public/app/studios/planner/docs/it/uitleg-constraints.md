# Vincoli e scadenze

I mattoni arrivano solo il 21 giugno. Il permesso non è ancora arrivato. Il tetto deve essere chiuso prima delle ferie edili. Le relazioni registrano che un'attività aspetta un'altra attività, ma gli accordi su una data non seguono dall'ordine del lavoro. Per questo esistono vincoli e scadenze. In questo articolo leggi che cosa fa ogni tipo, quando un'attività si sposta e quando cambia solo il margine, che cos'è un blocco rigido e come l'app segnala un conflitto.

Le regole e gli esempi valgono per un nuovo progetto, con il profilo di calcolo *Open Planner Studio* e una settimana lavorativa dal lunedì al venerdì.

## Il concetto

Un **vincolo** è un limite di data su una singola attività, indipendente dalle sue relazioni. Un limite del genere può funzionare in due modi:

- **Spinge**: l'attività non può iniziare o finire prima della data. Se l'attività inizierebbe prima per via delle sue relazioni, si sposta alla data.
- **Sorveglia**: l'attività deve iniziare o finire al più tardi alla data. L'app non sposta nulla. Se la pianificazione non rispetta la data, il **margine** dell'attività, e della catena che la precede, diventa negativo. Il margine è lo spazio che un'attività ha prima che si sposti la fine del progetto; negativo significa che sulla carta sei già in ritardo (vedi [Percorso critico e margine](docs://uitleg-kritiek-pad)).

Una scadenza è una forma più semplice di sorveglianza: una data obiettivo per la fine di un'attività, senza che qualcosa sposti l'attività.

Tutti i vincoli sono **flessibili**: il calcolo prosegue anche se una data non è rispettata. Fa eccezione un solo caso, il **blocco rigido**, che annulla le relazioni. Più avanti lo approfondiamo. oppure: Maggiori dettagli più sotto.

## Come calcola l'app

### Gli otto tipi

Scegli il tipo in *Vincolo* nel pannello *Proprietà*. Ecco come calcola ogni tipo:

- *Il più presto possibile (ASAP)*: nessun limite. È il valore predefinito: l'attività inizia non appena le relazioni lo permettono.
- *Il più tardi possibile (ALAP)*: l'attività si sposta il più tardi possibile senza che un successore debba iniziare più tardi. Quindi usa il suo margine libero. Se dopo questo resta un margine totale, perché i suoi successori hanno spazio a loro volta, resta non critica; se anche quello è esaurito, conta come critica.
- *Iniziare non prima del (SNET)*: un limite inferiore per l'inizio. Se l'attività inizierebbe prima, si sposta alla data; se la data è prima di quanto permettono le relazioni, il vincolo non fa nulla.
- *Finire non prima del (FNET)*: lo stesso, ma per la fine dell'attività.
- *Iniziare non oltre il (SNLT)* e *Finire non oltre il (FNLT)*: un limite superiore per l'inizio o per la fine. Non spostano nulla. Se il limite non è rispettato, l'app segnala un vincolo violato e il margine diventa negativo.
- *Deve iniziare il (MSO)* e *Deve finire il (MFO)*: un limite inferiore e uno superiore insieme. L'attività si sposta alla data se questa è più tardi di quanto richiedono le relazioni. Se la data è prima di quanto permettono le relazioni, l'attività resta dove la mettono le relazioni, e il margine diventa negativo.

Se una data cade di sabato, di domenica o in un giorno non lavorativo, l'app la legge come giorno lavorativo: un limite inferiore (SNET, FNET) come il giorno lavorativo successivo, un limite superiore (SNLT, FNLT) come il giorno lavorativo precedente.

### Che cosa significa margine negativo

Un limite superiore lavora all'indietro. Se il vincolo mette la data più tarda di un'attività prima della sua data anticipata, il margine totale diventa negativo. Lo stesso vale per le attività che la precedono: se la muratura deve iniziare al più tardi venerdì 11 giugno e non può iniziare prima di lunedì 14 giugno, anche le attività prima della muratura hanno un margine negativo di un giorno lavorativo. Tutte le attività con margine negativo sono critiche; come funziona è spiegato in [Percorso critico e margine](docs://uitleg-kritiek-pad).

Le barre non si spostano per un limite superiore. Il conflitto si vede nel *Margine totale* negativo, in un rombo rosso sopra la barra, nell'avviso nella barra di stato (per esempio *Vincoli violati: 1*) e nel pannello *Avvisi*.

### Il blocco rigido

Con MSO e MFO compare la casella di spunta *Obbligatorio (logica di blocco)*. Con questa spunta fissi l'attività alla data, anche se i suoi predecessori non sono ancora finiti. Le relazioni sono annullate:

- L'attività si trova alla data (con MSO inizia lì, con MFO finisce lì) e si sovrappone ai suoi predecessori.
- I predecessori ottengono un margine negativo, e l'app segnala un vincolo violato non appena le relazioni permetterebbero all'attività di iniziare più tardi della data di blocco. L'attività bloccata stessa mantiene un margine pari a 0.
- I successori si calcolano a partire dall'attività bloccata. Possono quindi iniziare prima di quanto accadrebbe senza blocco rigido, anche se la logica prima di essa non è finita. Nell'esempio qui sotto la fine del progetto si anticipa di tre giorni lavorativi per questo.

La prima volta che attivi il blocco, l'app mostra una breve spiegazione: un blocco rigido annulla le relazioni, la barra è fissa alla data, anche prima dei suoi predecessori.

### Il vincolo secondario

Un'attività ha un solo vincolo primario. Se vuoi anche un secondo limite, per esempio un'attività che non può iniziare prima del 14 giugno e deve essere finita entro il 17 giugno, aggiungi un **vincolo secondario**. Deve essere un vero limite (SNET, FNET, SNLT o FNLT) e deve limitare nella direzione opposta a quella del primario: un limite inferiore (SNET o FNET) con un limite superiore (SNLT o FNLT). SNET con SNLT è quindi permesso, SNET con FNET non lo è. L'app segna le altre combinazioni in rosso con il motivo, per esempio *Il vincolo primario e quello secondario non possono limitare lo stesso lato*. Con ASAP, ALAP, MSO, MFO e un blocco rigido non è permesso un vincolo secondario.

### La scadenza

Una scadenza è una data separata su un'attività, accanto al vincolo. È un limite superiore per la fine: non sposta nulla, ma rende il margine negativo se l'attività non finisce in tempo. Nel pannello *Avvisi* l'app segnala poi *Scadenza … superata — fine anticipata …*, e la barra di stato conta le scadenze superate. Nel Gantt c'è una freccia verso il basso sulla data di scadenza: verde finché l'attività finisce in tempo, rossa appena l'attività supera la scadenza. Una scadenza di sabato conta fino al venerdì precedente incluso.

Per il margine una scadenza fa lo stesso di FNLT. La differenza sta nel modo in cui la usi. Una scadenza è una data obiettivo che vuoi sorvegliare; sta separata dal vincolo, quindi un'attività può avere sia un vincolo sia una scadenza. FNLT è un vincolo: una violazione compare come vincolo violato invece che come scadenza superata.

### Che cosa non fa un vincolo

- Su una **fase** (attività di riepilogo) un vincolo o una scadenza non conta: l'app calcola con le attività della fase. Mettilo sull'attività stessa.
- Un'attività che ha già un inizio effettivo o un avanzamento mantiene quell'inizio. Un SNET con una data più tarda non la sposta.
- **Digitare una data di inizio** su un'attività con un predecessore non funziona come inizio fisso: il predecessore continua a decidere. Per questo l'app la converte in un SNET sulla data che hai digitato, nel pannello *Proprietà*, in *Modifica attività*, nella tabella e quando sposti la barra nel Gantt. L'app te lo segnala. Se l'attività ha già un altro vincolo (per esempio ALAP o MSO), l'app non applica il nuovo inizio e te lo segnala anche; in quel caso cambia quel vincolo.

Tutte le modifiche si vedono solo dopo **Calcola** (F5).

## Esempio svolto

L'esempio è una piccola rete per un ampliamento di una casa. Inizia lunedì 7 giugno 2027:

- *Groundwork* (3 giorni lavorativi): da lunedì 7 a mercoledì 9 giugno.
- *Pour foundation* (2): giovedì 10 e venerdì 11 giugno.
- *Brickwork* (5): da lunedì 14 a venerdì 18 giugno.
- *Roofing* (3): da lunedì 21 a mercoledì 23 giugno.
- *Scaffolding* (2): segue *Pour foundation* e viene prima di *Roofing*. Si esegue lunedì 14 e martedì 15 giugno e ha 3 giorni lavorativi di margine.

Il percorso critico è *Groundwork*, *Pour foundation*, *Brickwork* e *Roofing*. Il progetto è completato mercoledì 23 giugno. Che cosa cambia con un vincolo su *Brickwork*?

- **SNET lunedì 21 giugno** (i mattoni arrivano solo allora): *Brickwork* va da lunedì 21 a venerdì 25 giugno, *Roofing* da lunedì 28 a mercoledì 30 giugno. Il progetto è completato mercoledì 30 giugno. *Groundwork* e *Pour foundation* hanno ora 5 giorni lavorativi di margine e non sono più critiche, *Scaffolding* ne ha 8.
- **SNET mercoledì 9 giugno**: nessun effetto. Le relazioni fanno iniziare *Brickwork* comunque solo lunedì 14 giugno.
- **SNLT mercoledì 16 giugno**: nessun effetto. *Brickwork* inizia lunedì 14 giugno e rispetta comodamente il limite.
- **SNLT venerdì 11 giugno**: troppo stretto. *Brickwork* inizia comunque lunedì 14 giugno, un giorno lavorativo dopo la data. *Groundwork*, *Pour foundation* e *Brickwork* ottengono −1 giorno lavorativo di margine e l'app segnala *Il vincolo Iniziare non oltre il (SNLT) 11-06-2027 è superato dalla logica (margine negativo)*. Non si sposta nulla.
- **MSO mercoledì 16 giugno** (senza blocco rigido): *Brickwork* si sposta a mercoledì 16 giugno e finisce martedì 22 giugno. *Roofing* va da mercoledì 23 a venerdì 25 giugno, il progetto è completato venerdì 25 giugno.
- **MSO venerdì 11 giugno** (senza blocco rigido): la data è prima di quanto permettono le relazioni. *Brickwork* inizia comunque lunedì 14 giugno e il margine diventa −1, come con SNLT.
- **MSO mercoledì 9 giugno con blocco rigido**: *Brickwork* inizia mercoledì 9 giugno e finisce martedì 15 giugno, mentre *Pour foundation* continua ancora fino a venerdì 11 giugno. *Roofing* va da mercoledì 16 a venerdì 18 giugno: il progetto è completato tre giorni lavorativi prima di quanto accadrebbe senza blocco rigido. *Groundwork* e *Pour foundation* ottengono −3 giorni lavorativi di margine.

E con un vincolo o una scadenza su un'altra attività:

- **ALAP su** *Scaffolding*: l'attività si sposta a giovedì 17 e venerdì 18 giugno, il momento più tardi prima di *Roofing*. *Roofing* è il suo unico successore e aveva spazio per esattamente i suoi 3 giorni lavorativi di margine; ora sono esauriti e *Scaffolding* è critica.
- **SNET sabato 19 giugno su** *Scaffolding*: il limite conta come lunedì 21 giugno. *Scaffolding* si esegue lunedì 21 e martedì 22 giugno e *Roofing* si sposta di conseguenza, da mercoledì 23 a venerdì 25 giugno.
- **Scadenza venerdì 18 giugno su** *Roofing*: non si sposta nulla, *Roofing* resta da lunedì 21 a mercoledì 23 giugno. *Groundwork*, *Pour foundation*, *Brickwork* e *Roofing* ottengono −3 giorni lavorativi di margine e l'app segnala *Scadenza 18-06-2027 superata — fine anticipata 23-06-2027*. *Scaffolding* mantiene 0 giorni lavorativi di margine e diventa anch'essa critica.
- **SNET lunedì 21 giugno su** *Brickwork*, **scadenza venerdì 25 giugno su** *Roofing*: il vincolo spinge la muratura indietro di una settimana, e la scadenza segnala che *Roofing* finisce mercoledì 30 giugno, dopo la scadenza. *Brickwork* e *Roofing* ottengono −3 giorni lavorativi di margine; *Groundwork* e *Pour foundation* mantengono 2 giorni lavorativi.

Nel tutorial 3 imposti tu stesso un vincolo e una scadenza nel progetto del tutorial e vedi come si sposta la pianificazione.

## Conseguenze e idee sbagliate

**«Un vincolo sposta l'attività.»** Solo SNET, FNET, MSO e MFO possono mettere un'attività più tardi di quanto richiedono le relazioni, e ALAP può spostarla in avanti entro il suo margine libero. SNLT e FNLT non spostano mai nulla: avvisano soltanto. Per rispettare la data occorre quindi accorciare la catena che la precede.

**«Il margine negativo è un errore dell'app.»** È il segnale che la pianificazione è in conflitto con il tuo accordo sulle date. Lo risolvi accorciando la catena, allentando l'accordo o accettando il conflitto di proposito.

**«Un blocco rigido risolve il conflitto.»** Un blocco rigido nasconde il conflitto: l'attività è alla data, ma i suoi predecessori non sono pronti, e i successori si calcolano come se lo fossero. Usalo solo per una data che è davvero fissa, per esempio una data legale di consegna, e non per far cadere un'attività su una data.

**«Digito solo una data di inizio.»** Con un'attività che ha un predecessore, questa diventa un SNET. Se quella data è prima di quanto permette il predecessore, non fa nulla.

**«Scadenza o FNLT?»** Scegli una scadenza per una data obiettivo che vuoi sorvegliare, e un vincolo per una data che è davvero un requisito vincolante per la pianificazione.

**«Un vincolo sulla fase.»** Non conta. Mettilo sull'attività stessa.

## Vedi anche

- [Impostare un vincolo o una scadenza](docs://howto-constraint-deadline-zetten): i passi per impostare un vincolo o una scadenza.
- [Relazioni e ritardo](docs://uitleg-relaties): le dipendenze che si trovano accanto ai vincoli.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): come nasce il margine negativo e che effetto ha sul percorso critico.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): un blocco rigido (*Deve iniziare il (MSO)*) su *Municipal road closure (permitted closure period)* e un vincolo secondario (*Iniziare non oltre il (SNLT)*) su *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): una scadenza non rispettata, con margine negativo.
