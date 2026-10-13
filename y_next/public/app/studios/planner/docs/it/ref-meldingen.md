# Notifiche e avvisi

L'app ti mostra che cosa succede in tre punti: la barra di stato in basso, il pannello *Avvisi* nella colonna destra e le notifiche che compaiono brevemente in fondo allo schermo. Questo articolo spiega per ogni punto che cosa vedi, quando compare e che cosa puoi fare. Perché una pianificazione è critica o sovrassegnata è spiegato in [Percorso critico e margine](docs://uitleg-kritiek-pad). Come risolvi una risorsa sovrassegnata è spiegato in [Risolvere una risorsa sovrassegnata](docs://howto-overbezetting-oplossen). Come crei relazioni è spiegato in [Creare relazioni](docs://howto-relaties-leggen).

## La differenza tra i tre

- **Barra di stato** — una riga fissa con contatori. Vengono dall'ultimo calcolo e restano finché non calcoli di nuovo.
- **Pannello Avvisi** — l'elenco dietro quei contatori, con tutto ciò che ha trovato l'ultimo calcolo. Con un clic vai all'attività, alla relazione o alla risorsa. Il pannello viene ricavato dall'ultimo calcolo; non viene salvato nulla.
- **Notifiche** — messaggi brevi su qualcosa che hai appena fatto (salvataggio non riuscito, relazione rifiutata, importazione letta). Scompaiono di nuovo e non sono nel pannello.

## La barra di stato

La barra in basso mostra, da sinistra a destra:

- **Attività:** — il numero di attività foglia (le attività di riepilogo non si contano).
- **Cardini:** — il numero di cardini.
- **Percorso critico: N attività, N giorni lavorativi** — il numero di attività critiche e la durata del progetto. Compare solo dopo un calcolo.
- **Fine:** — la fine del progetto dal calcolo. Compare solo dopo un calcolo; un progetto vuoto non ne ha una.
- **N scadenza/e superata/e**, **N vincolo/i violato/i**, **N relazione/i fuori sequenza** e **N risorsa/e sovrassegnata/e** — ciascuno è un pulsante con un segnale di avviso. Compare solo quando il contatore è sopra 0 e c'è un calcolo. Un clic apre il pannello *Avvisi* (testo di aiuto: *Apri il pannello Avvisi (dettagli e navigazione)*). Se ti trovi nella scheda *IFC* o *Rapporto*, l'app passa contemporaneamente a *Home*, perché nella colonna destra di quelle schede non c'è nulla. Il contatore *risorsa/e sovrassegnata/e* si aggiorna anche dopo modifiche alle risorse e alle assegnazioni. Gli altri contatori cambiano solo dopo *Calcola*. I quattro contatori sono una selezione: ciò che il pannello mostra in più (anticipo troncato, relazione ignorata, hammock senza driver di fine, data di fine limitata, errore di pianificazione) non è nella barra di stato.
- **Non aggiornata — ricalcola (F5)** — con un segnale di avviso (testo di aiuto: *Pianificazione non aggiornata — ricalcola (F5)*). Compare appena cambi qualcosa che influisce sulla pianificazione e non hai ancora ricalcolato. Se *Calcola automaticamente* è attivo, non compare, tranne quando il calcolo ha dato un errore: in quel caso resta.
- **Selezione: N attività** — il numero di attività selezionate. Compare solo con una selezione.
- **Scala:** e **Zoom: Npx/giorno** — la scala temporale della timeline e il livello di zoom. La scala dipende dallo zoom.
- **Non salvato** — finché il documento contiene modifiche che non sono nel file.
- **IA** — un punto colorato con la parola IA, solo quando la modalità IA è attiva. Il testo di aiuto dice *Ponte IA:* con *Disattivo*, *Attivo sulla porta N*, *Porta N occupata* o *Errore*. Un clic apre la scheda *IA*.
- **Terminale di debug** — un pulsante terminale, solo quando il terminale di debug è attivato. Mostra o nasconde il terminale (*Mostra terminale di debug* / *Nascondi terminale di debug*).

## Il pannello Avvisi

- **Apertura** — *Pianificazione › Pianificazione › Avvisi*, *Vista › Pannelli › Avvisi*, oppure un contatore nella barra di stato. Il pannello si trova nella colonna destra, sotto *Proprietà* e il pannello risorse. Espande una colonna chiusa. Per impostazione predefinita è chiuso e non viene ricordato tra una sessione e l'altra. Trascina l'altezza dal bordo quando si trova sotto altri pannelli; quell'altezza viene ricordata. La croce in alto a destra chiude il pannello (*Chiudi avvisi*).
- **Riga di intestazione** — *N errore/i, N avviso/i*. Se non è ancora stato calcolato nulla, dice *Non ancora calcolato — premi Calcola (F5) per eseguire i controlli.*
- **Calcola** — un pulsante nella riga di intestazione. È visibile finché la pianificazione non è aggiornata o non è ancora calcolata. Fa la stessa cosa di *Calcola* nella barra multifunzione.
- **Segnale di avviso nella riga di intestazione** — quando la pianificazione non è aggiornata, con il testo di aiuto *Pianificazione obsoleta — questo elenco proviene dall'ultimo calcolo. Ricalcola (F5).* L'elenco non viene nascosto, viene solo segnato come obsoleto.
- **Elenco vuoto** — *Nessun avviso. La pianificazione supera tutti i controlli.*
- **Riga** — in alto il luogo (attività, relazione, risorsa o progetto) e sotto la descrizione. Un errore ha un proprio segnale ottagonale, un avviso un segnale triangolare. Un'attività compare come `nome WBS`. Una relazione compare come `predecessore → successore (FS+2d)`, con tipo e ritardo. Un clic va al luogo (testo di aiuto *Vai a: …*), vedi sotto. La riga che appartiene alla tua attività attiva (per una relazione: il suo successore) o alla risorsa scelta nell'istogramma è evidenziata.
- **Ordine** — prima gli errori; poi per tipo, nell'ordine della lista sotto; dentro ogni tipo nell'ordine del documento (per una relazione quello del successore, per una risorsa quello della lista risorse). Un'attività, relazione o risorsa cancellata dopo l'ultimo calcolo scompare dall'elenco.

### Tipi di avviso

- **Errore di pianificazione** — *La pianificazione non ha potuto essere calcolata: …*, con il motivo dopo i due punti; vedi sotto. Un clic: per un ciclo l'app seleziona tutte le attività del ciclo e va alla prima. Per altri errori non c'è niente a cui andare e la riga non è un pulsante.
- **Scadenza superata** — *Scadenza {date} superata — fine anticipata {date}*. L'attività ha una scadenza e il calcolo non la rispetta. Un clic va all'attività. Per risolvere: modifica la logica o la durata, oppure sposta la scadenza.
- **Vincolo violato** — *Il vincolo {type and date} è superato dalla logica (margine negativo)*. Il vincolo non si può rispettare senza rompere la logica; il margine è negativo. Un clic va all'attività. Vedi [Vincoli](docs://uitleg-constraints).
- **Fuori sequenza** — *Fuori sequenza: l'avanzamento del successore contraddice la relazione*. L'avanzamento del successore non si adatta al tipo di relazione. Per esempio: il successore è già in corso, mentre il predecessore non è ancora finito in una relazione fine-inizio. Un clic seleziona entrambe le attività, con il successore attivo. Controlla le date effettive o la relazione.
- **Anticipo troncato** — *Anticipo troncato dall'inizio del progetto — la relazione non è rispettata del tutto*. L'anticipo (ritardo negativo) della relazione va prima dell'inizio del progetto. Un clic seleziona entrambe le attività.
- **Relazione ignorata** — *Relazione ignorata: predecessore o successore mancante o non è un'attività foglia*. Il calcolo non usa la relazione. Un clic seleziona le attività che esistono ancora. Vedi [Relazioni](docs://uitleg-relaties).
- **Hammock senza driver di fine** — *Hammock senza driver di fine (nessun predecessore FF/SF): la durata torna a zero*. Un clic va all'attività. Vedi [Attività hammock](docs://howto-hammock).
- **Data di fine limitata** — *Data di fine limitata: il calendario non lascia alcuna finestra lavorativa per questa attività*. Il calcolo ha raggiunto il limite di giorni che cerca, per esempio per un lungo periodo ininterrotto di giorni di riposo nel calendario. Un clic va all'attività. Vedi [Calendari e giorni lavorativi](docs://uitleg-kalenders).
- **Risorsa sovrassegnata** — *Sovrassegnata per N giorno/i (primo – ultimo)*. Se tutti i giorni sono giorni di riposo, si aggiunge *la risorsa non lavora questi giorni secondo il suo calendario*. In caso di mix si aggiunge *di cui N giorno/i la risorsa non lavora secondo il suo calendario*. Un clic seleziona le attività con un'assegnazione su quella risorsa, attiva l'istogramma e sceglie quella risorsa. Dalle schede *Tabella*, *IFC* o *Rapporto* l'app passa a *Risorse*. Vedi [Pannello risorse](docs://ref-resourcepaneel).

### Motivi di un errore di pianificazione

- *Dipendenza circolare tra attività: {path}* — le relazioni formano un ciclo. Le attività sono nel percorso. Inverti o elimina una relazione.
- *Nel calendario non sono impostati giorni lavorativi* — assegna al calendario almeno un giorno lavorativo. Vedi [Finestre del calendario](docs://ref-kalenders).
- *Durata in giorni non valida per l'attività '{task}'* e *Durata in ore non valida per l'attività '{task}'* — la durata dell'attività non è un numero valido.
- *L'attività in ore '{task}' non ha orari di lavoro validi nel suo calendario* — un'attività in ore su un calendario senza orari di lavoro.
- *Data di inizio non valida per l'attività '{task}'* — la data di inizio dell'attività non è valida.

## Notifiche

Le notifiche compaiono in fondo allo schermo, anche nella tabella, in Backstage e in modalità presentazione. Una notifica è un *errore* o un *info*. Un errore resta finché non lo chiudi con un clic; un info scompare dopo 5 secondi, e questi timer ricominciano non appena cambia la pila. Un clic su una notifica la chiude (suggerimento *Chiudi notifica*). Al massimo tre sono mostrate insieme: se ne arriva una quarta, esce per primo il info più vecchio, e se non ci sono info, la notifica più vecchia. Così un errore non viene mai spinto fuori da un info. La pila si sposta lontano dai pulsanti di una finestra di dialogo aperta e dalle barre di azione fisse.

- **Contatore ×N** — una notifica con una chiave fissa raggruppa una ripetizione in una sola riga con un contatore, per esempio un errore di salvataggio che ritorna o una relazione rifiutata che ripeti. Non tutte le notifiche lo fanno.
- **Ulteriori informazioni** — alcune notifiche hanno un link *Ulteriori informazioni* o un argomento proprio (per esempio *Regole di lavoro spiegate*) che porta alla guida in Backstage › Guida.
- **Pulsante d'azione** — la notifica sul profilo di calcolo ha un pulsante *Apri profilo di calcolo* che porta a Info progetto.

L'elenco qui sotto è una selezione, raggruppata per argomento. Dove non è scritto altro, si tratta di un info.

### Salvataggio, apertura e ripristino

- **Salvataggio non riuscito** (errore) — *Salvataggio non riuscito* con il motivo sotto. Compare quando salvi, quando salvi con nome e quando esporti un report.
- **Salvato come download** (info) — *Salvato come download: «{name}» è ora nella cartella dei download. …* Con *Salva come* ed esportazioni, quando l'ambiente non permette all'app di scrivere direttamente nella posizione che scegli. Due download di seguito si raggruppano.
- **Salvato come download (spiegazione)** (info) — *Salvato come download: «{name}» è nella cartella dei download. Questo browser non permette all'app di scrivere in una posizione propria, …* Con *Salva* in un browser che salva solo tramite download. Una volta per sessione, con un link alla spiegazione dei file.
- **Il browser non riscrive il file** (info) — *Questo browser non permette all'app di riscrivere «{name}». …* Con *Salva* di un progetto che ha un file, quando il browser deve chiedere di nuovo una posizione. Una volta per sessione, con un link alla spiegazione dei file.
- **Salvataggio automatico non riuscito** (errore) — *Salvataggio automatico non riuscito* con il motivo. Vale per il salvataggio automatico nel file e per il recupero dopo un arresto imprevisto.
- **Impossibile salvare la libreria** (errore) — *Impossibile salvare la libreria*, quando salvi la libreria di risorse.
- **Apertura del file non riuscita** (errore) — *Apertura del file non riuscita* con il motivo. Per esempio un file recente o un file importato.
- **File .mpp vecchio o protetto** (errore) — *Questo file .mpp usa un formato più vecchio (Project 2007 o precedente)…* oppure *Questo file .mpp è protetto da password…*, entrambi con il consiglio di esportare come XML da MS Project e di aprire quel file.
- **File XER non valido** (errore) — uno dei testi che iniziano con *XER…*, per esempio *Questo file XER non è valido o supportato.* oppure *Il file XER contiene una tabella duplicata.*, con il motivo aggiunto.
- **IFC non leggibile** (errore) — *Impossibile leggere l'IFC* con il motivo, nella vista IFC.
- **Ripristino** (errore) — *Impossibile leggere il file ripristinato*, *Ripristino non riuscito* e *N file di ripristino non sono stati caricati e sono stati ignorati.* Quando ripristini dopo una chiusura imprevista.
- **Ramo salvato come modello** (info) — *Ramo salvato come modello '{name}'*.
- **Messaggio di un'estensione** (info, o errore se l'estensione segnala un errore) — *Estensione {name}: {message}*. Un'estensione può mostrare al massimo tre nuovi messaggi ogni 10 secondi, così non riempie la pila. Se un passaggio della guida di un'estensione non riesce, appare *Un passaggio dell’estensione {name} non è riuscito. La guida continua.*, e se un file di progetto di un'estensione non si può aprire, *Impossibile aprire il file di progetto {file} dell’estensione {name}.* Entrambi sono errori.
- **Una modifica è arrivata nel frattempo** (info) — *Una modifica dell'assistente IA o di un'estensione è arrivata nel frattempo. …* Quando annulli la finestra di dialogo delle attività mentre l'IA o un'estensione ha cambiato qualcosa nel frattempo: le modifiche alle attività fatte prima di quella modifica non vengono annullate e restano come normali passaggi sotto *Annulla*.

### Calcolo

- **Impossibile calcolare la programmazione** (errore) — *Impossibile calcolare la programmazione* con il motivo sotto (vedi *Motivi di un errore di pianificazione*). Su *Calcola*, quando cambi documento e quando apri un file.
- **Data di stato impostata a oggi** (info) — *Non c’era ancora una data di stato: ora è impostata a oggi ({date}), perché l’avanzamento si misura fino alla data di stato. Puoi modificarla in Pianificazione → Data di stato.* Quando inserisci l'avanzamento in un progetto senza data di stato.
- **Durata più breve del lavoro svolto** (info) — *«{name}» è già completata al {N}%: una durata inferiore al lavoro già svolto non è possibile. La durata non è stata modificata.*

### Relazioni e gerarchia

- **Relazione creata** (info) — *Relazione creata: {predecessor} → {successor}*.
- **Relazione rifiutata** (info) — *Questa relazione esiste già*, *Una relazione tra un'attività e la propria attività di riepilogo antenata non è consentita.* oppure *Questa relazione creerebbe un ciclo nella pianificazione ({cycle}) e non è stata creata.* Il ciclo indica le attività, così sai quale relazione rimuovere o invertire per prima.
- **Spostamento rifiutato** (info) — *Questo spostamento creerebbe un ciclo nella pianificazione ({cycle}): le relazioni di un'attività di riepilogo valgono anche per le sue sottoattività. Non è stato spostato nulla.*
- **Relazioni escluse dopo uno spostamento** (info) — *Dopo lo spostamento, N relazioni collegano un'attività alla propria attività di riepilogo antenata; non vengono più considerate nel calcolo.*
- **Relazioni saltate all'inserimento** (info) — *N relazioni non sono state create: collegamento non valido…*, quando incolli o inserisci un ramo.
- **Relazioni non considerate dopo l'importazione** (info) — *N relazione/i non hanno potuto essere incluse. Controlla le colonne Predecessori e Successori*.
- **ID duplicati dopo l'importazione** (info) — *Oggetti con un ID duplicato in questo file: N. A questi è stato assegnato un ID proprio…*

### Modifica delle attività

- **Inizio registrato come vincolo** (info) — *'{name}' ha un predecessore: il nuovo inizio è ora il vincolo Iniziare non prima del (SNET) {date}. Dopo il ricalcolo (F5) l'attività non inizia prima di quella data.* Quando cambi l'inizio di un'attività con un predecessore. Se l'attività aveva già un vincolo di questo tipo, la notifica dice che il vincolo si è spostato; per più attività insieme indica un conteggio.
- **Inizio non applicato** (info) — *Il nuovo inizio di «{name}» non è stato applicato: l'attività ha un predecessore e il vincolo {type} {date}, e sono questi a determinarne l'inizio. Cambia quel vincolo per spostare l'inizio.*
- **Cardine rifiutato** (info) — *«{task}» ha assegnazioni di risorse e non può diventare un cardine. Rimuovi prima le assegnazioni.* oppure *‘{task}’ è un'attività di riepilogo con sottoattività e non può diventare un cardine.* Quando lo converti nella finestra di dialogo dell'attività, nel pannello proprietà, nel menu contestuale e nella tabella.
- **Assegnazioni spostate in una sottoattività** (info) — *L'assegnazione di {resources} è stata spostata da «{phase}» alla nuova sottoattività «{child}»: un'attività di riepilogo non porta assegnazioni proprie.* Quando un'attività con assegnazioni riceve sottoattività.
- **Contrassegno di cardine rimosso** (info) — *Il cardine «{phase}» ora ha sottoattività ed è diventato un'attività di riepilogo; il contrassegno di cardine è stato rimosso.*
- **Attività di riepilogo rifiutata** (info) — *«{phase}» non può diventare un'attività di riepilogo: …* con il motivo, e *Non è stato cambiato nulla.*
- **Celle ignorate all'incollaggio** (info) — *N celle ignorate: sono di sola lettura (ad esempio un codice WBS numerato automaticamente o una colonna calcolata)*.
- **Riferimenti cancellati all'incollaggio** (info) — *N riferimenti non esistevano in questo documento e sono stati cancellati (calendari attività, tipi di attività personalizzati, codici attività o campi personalizzati del documento di origine)*.
- **Durate adeguate dalla regola di lavoro** (info) — *Dopo la modifica del calendario la regola di lavoro ha adeguato la durata di N attività (il lavoro resta, le ore al giorno sono cambiate).* Con un link *Regole di lavoro spiegate*.

### Primavera (XER)

- **File XER aperto** (info) — *File XER aperto: N documenti di progetto.* Una notifica per file, anche se il file apre più progetti, con un link *Ulteriori informazioni* e righe di dettaglio sotto. Sempre *N progetti trovati.* Solo se il numero è superiore a 0: *N progetti vuoti ignorati.*, *N progetti di baseline esclusi.*, *N baseline materializzate.*, *N riferimenti di baseline sospesi ignorati.*, *È stato usato un ripiego protettivo per la baseline.* e *N relazioni esterne conservate.* Solo per una codifica diversa da UTF-8: *Codifica del testo scelta: {encoding}.* Inoltre, quando il numero è superiore a 0: *N riscontri del parser.*, *N riscontri del calendario.*, *N problemi di formato numerico.*, *N ripieghi enum.* e *N impostazioni di pianificazione P6 con fallback sicuro.*
- **Date come registrate da Primavera** (riga di dettaglio nella stessa notifica) — *N attività mostrano le date come registrate da Primavera (non ricalcolate).*, oppure, se la modalità non si è attivata, *N attività differiscono dalle date registrate nel file — puoi mostrarle.*
- **Archivio sorgente XER non utilizzabile** (info) — *L'archivio sorgente XER di questo file è inutilizzabile ed è stato omesso; il progetto stesso è stato aperto per intero.* con il motivo (per esempio *Motivo: il checksum non corrisponde ai byte sorgente: l'archivio è danneggiato.*) e la conseguenza (*La pianificazione, il profilo di calcolo e tutti i dati di progetto dall'IFC sono completi. …*). Quando apri un file IFC in cui un archivio sorgente XER salvato in precedenza non può essere usato.
- **Esportazione che perde informazioni XER** (info) — *L’esportazione in {format} perde informazioni di origine XER.* Dopo un'esportazione riuscita in un formato diverso da IFC, di un progetto con dati che esistono solo in un file XER. Con un link *Ulteriori informazioni*.

### Importazione, esportazione e profilo di calcolo

- **Date come nel file** (info) — *N attività mostrano le date come registrate nel file (non ricalcolate).* oppure *N attività differiscono dalle date registrate nel file — puoi mostrarle.* Quando apri un file con date registrate.
- **Lavoro e regole di lavoro visibili** (info) — *Questo file contiene lavoro salvato o regole di lavoro proprie; la regola di lavoro e il lavoro rimanente sono mostrati per questo progetto.*
- **Pianificazione di MS Project letta** (info) — *Questo file di MS Project contiene N attività con una pianificazione suddivisa, livellata o guidata dalle risorse. Vengono importate e mostrate così come sono.*
- **Interruzioni non esportate** (info) — *N attività con interruzioni sono state esportate senza le loro interruzioni: MS Project/P6 le conoscono solo come distribuzione del lavoro.* Quando esporti verso MS Project o Primavera.
- **Inizio del progetto spostato** (info) — *Inizio del progetto spostato: N ancoraggi di attività senza predecessore né vincolo sono stati spostati alla nuova data di inizio.*
- **La finestra di date non guida più** (info) — *La finestra di date di MS Project non guida più N attività dopo questa modifica; …* Una volta per documento.
- **Ritardo di livellamento arrotondato** (info) — *Il livellamento arrotonda il ritardo di livellamento di MS Project, preciso al minuto, per N attività a giornate lavorative intere.* Una volta per documento.
- **Profilo di calcolo applicato** (info) — *Questo progetto calcola come {profile}. Modificalo da File → Info progetto → Profilo di calcolo e opzioni.* Con il pulsante *Apri profilo di calcolo*. Dopo aver applicato un profilo, segue *Dopo l’applicazione sono state spostate N attività.* se serve.
