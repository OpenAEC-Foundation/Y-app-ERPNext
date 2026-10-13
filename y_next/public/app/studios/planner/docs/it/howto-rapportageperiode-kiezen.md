# Scegliere il periodo del report

Obiettivo: decidi quale tratto di tempo copre un report, per esempio le prossime quattro settimane o il mese di giugno.

## Quando ti serve questo

La riunione settimanale vuole sapere cosa succede nelle prossime quattro settimane. Il report mensile copre giugno. Senza periodo ottieni l'intera pianificazione su carta. Cinque report lavorano quindi con il *Periodo del report:*: *Previsione (look-ahead)*, *Rapporto di avanzamento*, *Carico risorse*, *Assegnazioni risorse* e *Diagramma delle risorse*. Gli altri report non hanno un periodo.

Il periodo non dipende da un mese del calendario, ma da un **giorno di riferimento**: la data di stato del tuo progetto (il giorno in cui misuri l'avanzamento, vedi [Avanzamento, data di stato e baseline](docs://uitleg-voortgang)), oppure oggi se il progetto non ha una data di stato. *Prossime 4 settimane* conta a partire da quel giorno. Se sposti la data di stato, si sposta anche la finestra.

## Passaggi

### 1. Imposta la data di stato

Se lavori con una scelta relativa, come *Prossime 4 settimane* o *Ultimo mese*, imposta prima la data di stato. Scegli *Pianificazione › Baseline e progresso* e compila il campo *Data di stato*. Con la croce accanto al campo (*Cancella data di stato*) rimuovi di nuovo la data. Se lavori con un periodo fisso (passaggio 4), non ti serve questo.

### 2. Scegli un report con un periodo

Apri la scheda *Rapporto* e scegli uno dei cinque report in *Tipo di report*. La lista *Periodo del report:* si trova sotto *Opzioni del rapporto*. Per il Diagramma delle risorse si trova sotto *Impostazioni*, sotto le quattro caselle di quel report.

Ogni report ricorda il proprio periodo. Questi sono i valori iniziali:

- *Previsione (look-ahead)*: *Prossimo mese*.
- *Rapporto di avanzamento*: *Ultimo mese*.
- *Carico risorse*, *Assegnazioni risorse* e *Diagramma delle risorse*: *Intero progetto*.

### 3. Scegli un periodo dalla lista

La lista contiene *Prossima settimana*, *Prossime 2 settimane*, *Prossime 4 settimane*, *Prossime 6 settimane*, *Prossime 8 settimane*, *Prossime 12 settimane*, *Prossimo mese*, le stesse sette voci al passato, come *Ultime 2 settimane* e *Ultimo mese*, *Intero progetto* e *Personalizzato*. Sotto la lista ci sono *Da* e *A* con le date che produce la scelta. Qui puoi solo leggerle.

Entrambi i giorni contano. Se la data di stato è giovedì 20 maggio, *Prossima settimana* va dal 20 al 26 maggio compreso e *Prossime 4 settimane* dal 20 maggio al 16 giugno compreso (28 giorni). *Prossimo mese* va fino a un giorno prima della stessa data nel mese successivo, qui fino al 19 giugno compreso. *Ultime 2 settimane* va dal 7 al 20 maggio compreso.

*Intero progetto* va dal primo inizio all'ultima fine.

### 4. Oppure scegli Personalizzato

Con *Personalizzato* diventano *Da* e *A* due campi data. Partono dalle date della scelta che avevi appena fatto. Compila entrambi, per esempio 1 e 14 giugno. Se i dati inseriti non sono corretti, il report resta sull'ultimo periodo valido e lo segnala in rosso:

- *La data di fine è precedente alla data di inizio.* se *A* è prima di *Da*.
- *Inserisci entrambe le date.* se uno dei due campi è vuoto.

### 5. Leggi il periodo nel report

Nei report Previsione (look-ahead), Carico risorse e Assegnazioni risorse il periodo si trova sotto il titolo, per esempio *Periodo: 20-05-2027 – 19-06-2027*. Se scegli *Intero progetto*, dopo le date si aggiunge *Intero progetto*. Il Rapporto di avanzamento mostra il periodo nel riepilogo, alla voce *Periodo*. Il Diagramma delle risorse fa coincidere il suo asse del tempo esattamente con il periodo.

### Cosa fa il periodo in ogni report

Il periodo non funziona allo stesso modo in ogni report.

- **Previsione (look-ahead)** prende le attività non finite che toccano il periodo, anche se coprono tutto il periodo. Ci rientrano anche le attività in ritardo che risalgono a prima del giorno di riferimento, purché la fine del periodo non sia prima del giorno di riferimento. Un periodo personalizzato interamente nel passato è uno sguardo al passato: mostra solo ciò che era in corso allora e non è ancora finito, senza l'arretrato di oggi.
- **Rapporto di avanzamento** usa il periodo per *Completate nel periodo passato*. La sezione *Iniziano nel prossimo periodo* guarda avanti dalla data di stato, fino alla data in *Anteprima fino al* nel riepilogo. Se scegli un periodo passato, il report guarda avanti quanto guarda indietro: con *Ultime 2 settimane* e data di stato 20 maggio dice *Anteprima fino al* 3 giugno. Un periodo personalizzato o *Intero progetto* interamente nel passato non viene rispecchiato.
- **Carico risorse** mostra per intero ogni settimana o mese che tocca il periodo. Se il periodo va da mercoledì a mercoledì, vedi quindi settimane intere, così una riga mostra sempre lo stesso numero dell'istogramma.
- **Assegnazioni risorse** mostra le assegnazioni delle attività che toccano il periodo. Con *Intero progetto* non c'è filtro sulla data.
- **Diagramma delle risorse** mostra solo le attività che toccano il periodo. Nel riepilogo, *Fuori dal periodo:* conta quante attività sono state escluse.

## Trappole e cosa fa l'app

**Non c'è una data di stato.** In quel caso l'app usa oggi. Per i quattro report a tabella con periodo (*Previsione (look-ahead)*, *Rapporto di avanzamento*, *Carico risorse* e *Assegnazioni risorse*) con un periodo relativo lo dice in cima, con la tua data di oggi: *Nessuna data di stato impostata — il rapporto usa oggi (29-09-2026).* Il Diagramma delle risorse non lo segnala. Controlla quindi *Da* e *A*: sono allora intorno a oggi, non intorno alla tua pianificazione.

**Il periodo è fuori dalla tua pianificazione.** In quel caso il report è vuoto. Il Diagramma delle risorse lo dice con *Nessuna attività nel periodo del report — scegli un altro periodo o Intero progetto.* (nella lista quella scelta si chiama *Intero progetto*). Negli altri report vedi zero attività o nessuna riga.

**Le date hanno il tuo formato.** *Da* e *A* seguono il formato di data delle tue impostazioni, tranne nei campi data di *Personalizzato*: quelli mostrano il formato del tuo browser.

**Il periodo si sposta.** Una scelta relativa, come *Prossimo mese*, viene calcolata ogni volta di nuovo. Se cambia la data di stato, oppure senza data di stato è passato un giorno, il periodo si sposta subito. Per un periodo fisso scegli *Personalizzato*.

**La scelta vale per tutti i tuoi progetti.** Anche un periodo personalizzato vale per tutti i tuoi progetti su questo dispositivo, non solo per il progetto aperto.

## Vedi anche

- [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken): tutto il percorso dal tipo di report al PDF.
- [Avanzamento, data di stato e baseline](docs://uitleg-voortgang): cos'è la data di stato e perché l'app calcola con essa.
- [Risolvere risorse sovrassegnate](docs://howto-overbezetting-oplossen): cosa fare con le settimane sovrassegnate di Carico risorse.
- [Tipi di report](docs://ref-rapporttypes): tutti i tipi di report e le loro opzioni.
