# La libreria di risorse

La tua squadra di muratori non lavora per un solo progetto. Oggi è sulle case del nord, domani sui garage del sud. Una libreria di risorse è il posto dove registri una squadra così una sola volta, in modo che ogni progetto usi la stessa squadra. L'app può poi vedere anche quando due progetti chiedono le stesse persone lo stesso giorno, cosa che nessun singolo progetto vede. In questo articolo leggi come libreria e progetto si collegano e come l'app conta l'occupazione su più progetti.

## Il concetto

Ci sono due livelli.

La **libreria di risorse** è l'elenco delle risorse e dei calendari che appartengono alla tua organizzazione: un bricklayer, una gru, un intonacatore, con il loro tipo, la tariffa e quanti ne hai. L'elenco stesso, che l'app chiama anche **pool**, non si trova nei file del progetto ma nell'app: nell'app desktop in un file su questo computer, nel browser nello spazio di archiviazione di quel browser. Se cancelli i dati del sito nel browser, la libreria di risorse va persa; quindi esportala come backup. C'è sempre almeno una libreria di risorse. La prima si chiama *Mijn resourcebibliotheek* (un nome in olandese) e puoi rinominarla.

Il **progetto** decide quanto di una risorsa usa e quando. Un progetto è collegato a una libreria di risorse oppure sta da solo. Un progetto autonomo funziona bene, ma senza elenco condiviso.

Un progetto non punta alla libreria di risorse, ma conserva una **copia**. Quando assegni *Bricklayer* dalla libreria a un progetto, l'app crea una copia nel progetto con una **marcatura di origine**: la nota che questa copia viene dalla libreria X ed è lì l'elemento Y. Nella tabella delle risorse riconosci una copia così da una piccola icona di libreria. La copia è una risorsa normale: alle attività si può assegnare, ed è salvata nel file del progetto stesso.

I calendari della libreria di risorse sono un'altra cosa rispetto all'elenco dei calendari del tuo progetto, che gestisci nella finestra dei calendari. Un calendario della libreria di risorse entra nel tuo progetto insieme a una risorsa che lo usa.

## Come funziona l'app con questo

### Cosa decide la libreria e cosa decide il progetto

La libreria di risorse decide **che cos'è una risorsa**: il nome, il tipo, la tariffa per ora, l'unità e la descrizione. In una copia di progetto questi campi appaiono come testo normale. Li cambi nella libreria di risorse, così sono giusti in ogni progetto. Se comunque vuoi che una copia segua una strada propria, la scolleghi dalla libreria di risorse.

Il progetto decide **quanto e quando**: *Unità max*, la capacità che cambia nel tempo (*Capacità scaglionata nel tempo*) e quale calendario ha la risorsa. Questi campi restano modificabili nel progetto e non contano come deviazione dalla libreria. Dopotutto, la stessa squadra può usare un calendario diverso per un lavoro urgente rispetto a un progetto normale. Il contenuto di un calendario che è arrivato insieme a una risorsa segue la libreria di risorse.

### Quando una copia segue

La libreria di risorse non aggiorna le copie in continuo, ma in momenti fissi:

- Quando modifichi qualcosa nella libreria di risorse, le copie non modificate in tutti i progetti aperti seguono subito.
- Quando apri un progetto o passi a un'altra scheda, l'app confronta le copie con la libreria di risorse. Se una copia non modificata non è aggiornata, l'app la aggiorna in silenzio e lo segnala brevemente: *1 elemento aggiornato dalla libreria* oppure *N elementi aggiornati dalla libreria*.

L'app ricorda i valori del momento in cui la copia è stata creata o aggiornata. Se una copia ora differisce da quei valori, l'app non decide chi ha ragione. La copia riceve allora il contrassegno *differisce — decidi*. Quando apri un file con una copia così, la finestra *Collega libreria di risorse* si apre da sola. Lì scegli per ogni elemento se valgono i valori della libreria di risorse, oppure se i valori del tuo file vanno nella libreria di risorse. Quando passi da una scheda all'altra, non compare mai una finestra.

Una deviazione nasce, per esempio, quando colleghi una risorsa propria del progetto a un elemento della libreria di risorse con lo stesso nome ma valori diversi, con *Nella libreria*. L'app la collega davvero e segna subito la copia come diversa dalla libreria di risorse.

### Quando una risorsa scompare dalla libreria di risorse

Se cancelli una risorsa dalla libreria di risorse, la copia resta nei tuoi progetti e continua a funzionare. Riceve il contrassegno *non più nella libreria*. Poi puoi modificarla del tutto o toglierla dal progetto.

### Occupazione su più progetti

L'istogramma e le risorse sovrassegnate di un progetto guardano solo a quel progetto. La libreria di risorse sa di più: quante unità di una risorsa ci sono in tutto. La vista *Occupazione* somma, per giorno, il carico di tutti i progetti aperti collegati alla stessa libreria di risorse e che usano una copia di quella risorsa. Se la somma di un giorno è maggiore della capacità della libreria di risorse, quel giorno conta come sovrassegnato.

Tre regole decidono cosa conta:

- La capacità viene dalla libreria di risorse (*Unità max* dell'elemento della libreria, oppure la sua *Capacità scaglionata nel tempo* in quel giorno), non dalle *Unità max* della copia nel progetto. Due progetti che restano ciascuno entro la propria quota possono quindi comunque chiedere insieme troppo.
- Una somma esattamente uguale alla capacità non è un conflitto. Si deve chiedere di più della capacità.
- Contano solo copie con una marcatura di origine, e solo nei progetti aperti in questa app in quel momento. Una risorsa propria di un singolo progetto non è nella libreria di risorse e quindi non conta. La panoramica non vede i documenti che non sono aperti in questa app; questo è scritto anche in fondo alla panoramica stessa.

## Esempio svolto: la squadra di muratori in due progetti

La libreria di risorse contiene la risorsa *Bricklayer* con *Unità max* 3: tre bricklayers a libro paga. Due progetti la usano, entrambi con una copia che ha *Unità max* 2.

- *Houses North* ha l'attività *Bricklaying facades* di 5 giorni lavorativi da lunedì 7 giugno 2027, con 2 unità al giorno. L'attività va dal 7 all'11 giugno compreso.
- *Garages South* ha l'attività *Bricklaying garages* di 4 giorni lavorativi da mercoledì 9 giugno 2027, con 2 unità al giorno. Il fine settimana non conta, quindi l'attività copre il 9, 10, 11 e 14 giugno.

In ogni progetto il bricklayer chiede 2 delle sue 2 unità. Nessuno dei due progetti segnala una risorsa sovrassegnata: sotto *Risorse › Sovrallocazione* dicono entrambi *Nessuna*. Eppure insieme superano i 3 bricklayers. Per giorno l'app conta:

- Lunedì 7 e martedì 8 giugno: 2 (solo Houses North)
- Mercoledì 9, giovedì 10 e venerdì 11 giugno: 2 + 2 = 4
- Lunedì 14 giugno: 2 (solo Garages South)

Il picco è 4 contro una capacità di 3. La panoramica mostra il bricklayer con *2 documenti*, il periodo *2027-06-07 – 2027-06-14*, *4.0 / 3.0* per picco e capacità, e *3 giorni con doppia prenotazione*: 9, 10 e 11 giugno.

Cosa succede se cambi qualcosa:

- Se *Bricklaying facades* prende 6 giorni lavorativi, arriva fino a lunedì 14 giugno. Anche quel giorno arriva a 2 + 2 = 4, quindi la panoramica segnala *4 giorni con doppia prenotazione*: 9, 10, 11 e 14 giugno. Il picco resta 4.
- Se la libreria di risorse ha *Unità max* 4, mostra *4.0 / 4.0* e non c'è conflitto, perché la somma non è maggiore della capacità.
- Se *Garages South* lavora con 1 unità al giorno invece di 2, il picco è 3 e la panoramica mostra *3.0 / 3.0*: nessun conflitto.
- Se *Garages South* inizia solo lunedì 14 giugno, i progetti non si sovrappongono. Il periodo diventa *2027-06-07 – 2027-06-17* e il picco è *2.0 / 3.0*.

I passi per guardarlo nei tuoi progetti sono in [Uso della panoramica di occupazione](docs://howto-bezettingsoverzicht-gebruiken).

## Conseguenze e idee sbagliate

**«La libreria di risorse è condivisa con i miei colleghi.»** No. La libreria di risorse vive nell'app (nell'app desktop in un file su questo computer, nel browser nello spazio di archiviazione di quel browser) e non è sincronizzata. Se due pianificatori lavorano con la stessa libreria di risorse, le loro librerie di risorse possono divergere. Puoi condividere esportando e importando, vedi [Gestire e condividere librerie di risorse](docs://howto-bibliotheken-beheren). Se la tua organizzazione condivide squadre tra società operative, scegli deliberatamente una sola libreria di risorse condivisa. La panoramica vede anche solo i progetti aperti in questa app.

**«Se cambio la libreria di risorse, cambia tutto nei miei progetti.»** Cambia solo l'identità della risorsa: nome, tipo, tariffa, unità e descrizione. *Unità max*, la capacità nel tempo e la scelta del calendario di un progetto restano come sono.

**«Posso annullare una modifica alla libreria di risorse.»** No. La libreria di risorse appartiene all'app e non a un progetto, quindi le modifiche alla libreria stanno fuori da *Annulla* (Ctrl+Z). La vista *Libreria* lo avverte da sé: *Questo modifica la libreria e vale per tutti i progetti — fuori dall'annulla.* Cancellare dalla libreria di risorse chiede anche una conferma e non si può annullare.

**«La panoramica di occupazione risolve la doppia prenotazione.»** No. La panoramica è solo una finestra di sola lettura. Mostra su quali giorni due progetti insieme chiedono troppo. Il livellamento (*Risorse › Livellamento › Livella…*, vedi [Livellamento delle risorse](docs://uitleg-nivelleren)) guarda alle risorse di un solo progetto e non tiene conto degli altri progetti. Sposta tu stesso un'attività in uno dei progetti, oppure cambia la capacità nella libreria di risorse se qualcuno si unisce davvero.

**«La mia risorsa propria conta nell'occupazione.»** Solo se è nella libreria di risorse. Una risorsa che hai creato solo nel progetto, ad esempio una gru noleggiata per un solo lavoro, non ha marcatura di origine e quindi non è nella panoramica. Con *Nella libreria* la aggiungi.

## Vedi anche

- [Uso della libreria di risorse](docs://howto-resourcebibliotheek-gebruiken): collegare, assegnare risorse e risolvere le deviazioni.
- [Gestire e condividere librerie di risorse](docs://howto-bibliotheken-beheren): creare, esportare e importare librerie di risorse.
- [Uso della panoramica di occupazione](docs://howto-bezettingsoverzicht-gebruiken): trovare le doppie prenotazioni tra progetti.
- [Gestire le risorse](docs://howto-resources-beheren): le risorse di un singolo progetto.
