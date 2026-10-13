# Dividere un'attività

Obiettivo: interrompere un'attività, in modo che il lavoro si fermi e riprenda più tardi, senza trasformarla in due attività.

## Quando ti serve questo

Posare l'armatura richiede otto giorni lavorativi, ma dopo quattro giorni la gru deve andare su un altro cantiere e il lavoro riprende due giorni dopo. Con due attività separate devi gestire due volte le relazioni e le assegnazioni. Con un'**interruzione** resta una sola attività, con una sola barra che ha un vuoto. L'app chiama anche l'interruzione *pausa*.

Il lavoro resta uguale, ma l'attività ora dura più giorni sul calendario. Un esempio: un'attività di 8 giorni lavorativi che inizia martedì 29 settembre 2026 termina giovedì 8 ottobre. Se inserisci un'interruzione di 2 giorni lavorativi dopo 4 giorni lavorativi, l'attività termina lunedì 12 ottobre. La durata resta di 8 giorni lavorativi. Si sposta solo la fine, di due giorni lavorativi.

## Passaggi

### Dividere nel diagramma di Gantt

1. Scegli *Home › Attività › Dividi attività* (oppure *Pianificazione › Relazioni › Dividi attività*). Sopra la pianificazione compare l'avviso *Fai clic su una barra nel giorno in cui inizia l'interruzione e trascina verso destra per la durata. Esc per uscire.* Il pulsante si trova anche nella scheda *Tabella* (*Tabella › Attività › Dividi attività*), ma lì è disattivato.
2. Sposta il mouse sulla barra. Una linea tratteggiata e un'etichetta con la data indicano dove inizierebbe l'interruzione. Premi sulla barra, nel giorno in cui inizia l'interruzione.
3. Trascina verso destra. L'etichetta mostra la durata, ad esempio *2 giorni lavorativi di pausa*: la distanza in giorni lavorativi fino al giorno sotto il mouse. Rilascia.

Se fai solo clic, senza trascinare, l'interruzione diventa di un giorno lavorativo. Trascinando di nuovo verso sinistra l'interruzione si accorcia, fino a un minimo di un giorno lavorativo. Per un'attività in ore, anche l'interruzione si misura in ore.

La modalità divisione resta attiva, così puoi dividere altre attività. Esci con Esc oppure con il pulsante *Esci* nell'avviso. Se premi Esc mentre trascini, l'app annulla l'interruzione e la modalità si ferma. Ogni gesto è un passo per *Annulla*.

Dopo una divisione la pianificazione non è più aggiornata. Premi **Calcola** (F5) per le date finali.

### Trascinare un'interruzione esistente nel diagramma di Gantt

Questo funziona senza modalità divisione, direttamente su una barra che ha un'interruzione.

- Trascina il tratto **dopo** l'interruzione verso destra o verso sinistra. L'interruzione diventa più lunga o più corta, con l'etichetta *3 giorni lavorativi di pausa*. Se lo riporti indietro finché l'interruzione è 0, l'etichetta mostra *Unisci* e i due tratti tornano uno solo.
- Trascina il bordo destro del tratto **prima** dell'interruzione. Quel tratto diventa più lungo o più corto, con l'etichetta *Tratto: 5 giorni lavorativi*. Con lui cambia anche la durata dell'attività.
- Se trascini il primo tratto, sposti l'intera attività, come con ogni barra.

### Dividere e regolare nel pannello proprietà

Seleziona l'attività. Nel pannello *Proprietà* il blocco *Pause* si trova sotto *Dipendenze* e sopra *Assegnazioni*. Scorri fino a lì se serve.

- *Aggiungi interruzione* inserisce un'interruzione di un giorno lavorativo a metà del tratto più lungo.
- Ogni interruzione ha due campi: *dopo* (quanti giorni di lavoro vengono prima dell'interruzione) e *pausa* (la lunghezza dell'interruzione). Accanto ci sono le date del tratto dopo l'interruzione. Per un'attività in ore mostrano le ore.
- Se imposti *pausa* a 0, l'interruzione scompare. Il piccolo cestino (*Rimuovi l'interruzione*) fa lo stesso.

Fai attenzione con *dopo*: quel campo allunga o accorcia il tratto di lavoro prima dell'interruzione, e con lui la durata di tutta l'attività. Con *pausa* cambia solo la fine.

### Rimuovere un'interruzione

Fai clic destro sull'interruzione nel diagramma di Gantt, oppure sul tratto dopo di essa, e scegli *Rimuovi l'interruzione*. *Rimuovi tutte le pause* si trova nel menu del clic destro di ogni barra che ha un'interruzione. Oppure usa il blocco *Pause* nel pannello *Proprietà*, come sopra.

### Con un assistente IA

Un assistente IA collegato imposta le interruzioni con lo strumento `planner_set_task_splits`, nello stesso formato del pannello: dopo quanti giorni lavorativi (o orari di lavoro) di lavoro, e quanti giorni lavorativi (o orari di lavoro) di interruzione. Lo strumento riceve sempre l'elenco completo; un elenco vuoto rimuove tutte le interruzioni. Le legge di nuovo con `planner_get_task`. Valgono le stesse regole di seguito: un'attività che tu non puoi dividere, non può dividerla nemmeno l'assistente. A differenza di una divisione che fai tu, l'app ricalcola da sola la pianificazione dopo. Come collegare un assistente è spiegato in [Collegare un assistente IA (MCP)](docs://howto-ai-assistent-koppelen).

## Insidie e cosa fa l'app

**Non ogni attività si può dividere.** Non puoi dividere un'attività cardine, un'attività di riepilogo, un'attività con *Hammock (durata derivata)* attivo (vedi [Creare un hammock](docs://howto-hammock)), un'attività con tipo di durata *Tempo trascorso*, un'attività *Pianificata manualmente*, né un'attività più corta di due giorni lavorativi. In modalità divisione il mouse mostra un cursore di divieto e non succede nulla. Per un'attività così manca anche il blocco *Pause* nel pannello *Proprietà*.

**Nella scheda Tabella il pulsante non funziona.** *Dividi attività* è disattivato lì, con il suggerimento *Disponibile solo quando il diagramma di Gantt è visibile*. Il gesto richiede una barra. La modalità divisione e la modalità collegamento si disattivano a vicenda.

**Un clic senza effetto.** Un'interruzione non può iniziare il primo giorno dell'attività, né dentro una pausa esistente. Ogni tratto di lavoro deve anche restare lungo almeno un giorno lavorativo. Se fai clic su un punto così, non succede nulla, e non compare nessun messaggio.

**Un'attività con avanzamento.** Se l'attività ha avanzamento, un'interruzione può iniziare solo dopo il lavoro già fatto. Con il 50% di 8 giorni lavorativi l'interruzione può iniziare al più presto il quinto giorno lavorativo. Un clic nella parte completata non fa nulla, e un'attività completata al 100% non si può più dividere. Nel pannello il comando *Aggiungi interruzione* è allora disattivato: questo vale anche se il centro del tratto più lungo cade nel lavoro già fatto, ad esempio con il 75% di 8 giorni lavorativi.

**Anche il livellamento crea interruzioni.** Compaiono nel blocco *Pause* con l'etichetta *livellamento*. *Risorse › Livellamento › Cancella livellamento* le rimuove di nuovo. Se modifichi tu le interruzioni di un'attività così, tutte le sue interruzioni da livellamento diventano tue e *Cancella livellamento* non le rimuove più.

**Le interruzioni non passano a MS Project o Primavera.** Se esporti in *MS Project XML* o *Primavera P6 XML*, quel programma conosce un'interruzione solo come distribuzione del lavoro di un'assegnazione. Senza una distribuzione così, l'attività arriva senza interruzione, e l'app indica quante attività sono: *1 attività con interruzioni è stata esportata senza le sue interruzioni: MS Project/P6 le conoscono solo come distribuzione del lavoro.* Nel file IFC dell'app restano invece conservate.

**Un file con interruzioni che l'app non può modificare.** Le interruzioni di un file di origine che non rientrano nel formato dell'app mostrano nel pannello il messaggio *Queste pause provengono dal file di origine in una forma che qui non può essere modificata*, con solo *Rimuovi tutte le pause*.

## Vedi anche

- [Percorso critico e margine](docs://uitleg-kritiek-pad): come la pianificazione conta in giorni lavorativi e perché la fine si sposta.
- [Aggiungere relazioni](docs://howto-relaties-leggen): un'altra modalità nel diagramma di Gantt, che usi trascinando una barra.
- [Finestra attività e pannello proprietà](docs://ref-taak-eigenschappen): la sezione Pause nel pannello proprietà.
