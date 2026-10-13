# Selezionare, eliminare e annullare attività

Obiettivo: scegliere attività, eliminarle e annullare un errore.

## Quando ti serve

Quasi ogni azione nella pianificazione agisce sulle attività che hai selezionato: eliminare, copiare, applicare un rientro, attivare o disattivare un cardine. Elimini attività quando il lavoro non serve più o quando la pianificazione viene rivista. E poiché l'app non chiede conferma quando elimini, *Annulla* è la tua rete di sicurezza.

## Passaggi

### Selezionare attività

- **Un'attività.** Clicca la riga nella tabella attività o la barra nel Gantt.
- **Più attività.** Ctrl+clic (⌘+clic su Mac) aggiunge un'attività alla selezione o la toglie. Nella tabella attività, Maiusc+clic seleziona tutte le attività dall'attività attiva fino a quella su cui hai cliccato.
- **Tutte le attività visibili.** Ctrl+A, con il fuoco nella tabella attività o nel Gantt. Le attività nascoste da un filtro restano fuori, e così le sottoattività di una fase compressa.
- **Un riquadro nel Gantt.** Tieni premuto Ctrl e trascina sullo sfondo vuoto: vengono selezionate tutte le attività nelle righe che il riquadro tocca, anche se la loro barra si trova accanto. Conta solo l'altezza del riquadro, non l'asse del tempo. Se rilasci Ctrl solo dopo il pulsante del mouse, vengono aggiunte alla selezione esistente; altrimenti la sostituiscono. Senza Ctrl, quel trascinamento scorre la linea del tempo nell'impostazione predefinita.
- **Nessuna selezione.** Esc, oppure un clic sullo sfondo vuoto del Gantt.

Se selezioni un'attività di riepilogo, le sue sottoattività non vengono selezionate con essa. Eliminare e copiare, invece, le includono.

### Eliminare attività

Seleziona le attività e scegli uno di questi percorsi:

- *Home › Modifica › Elimina*. Lo stesso pulsante si trova nella scheda *Tabella*.
- Delete o Backspace, se il fuoco non è nella tabella attività: quindi clicca prima una barra nel Gantt.
- *Elimina* nel menu del clic destro. Se l'attività su cui hai cliccato fa parte della selezione, il comando vale per tutta la selezione; altrimenti vale solo per quell'attività.
- Il piccolo cestino in alto nel pannello *Proprietà* (suggerimento *Elimina attività*). Elimina l'attività che il pannello mostra.

L'app non chiede conferma. Se elimini più attività insieme, è un solo passaggio per *Annulla*.

Con loro spariscono: tutte le sottoattività di un'attività di riepilogo eliminata, tutte le relazioni da e verso le attività eliminate, e le loro assegnazioni alle risorse. Se elimini l'ultima sottoattività di un'attività di riepilogo, quella resta come attività normale. Se *WBS auto* è attivo, l'app rinumera l'albero. Dopo, la pianificazione non è più aggiornata: premi **Calcola** (F5), a meno che *Calcola automaticamente* non sia attivo.

### Comprimere ed espandere

Un'attività di riepilogo ha un triangolo prima del nome nella tabella attività; cliccalo per nascondere o mostrare le sue sottoattività. Con *Vista › Struttura › Comprimi* e *Espandi* lo fai per le attività di riepilogo selezionate, o per tutte se non ne è selezionata nessuna. Il menu del clic destro di un'attività di riepilogo ha anche *Comprimi* e *Espandi*. In una vista raggruppata, i pulsanti agiscono sui gruppi.

L'app tiene traccia di compressione ed espansione per ogni documento aperto. Non fa parte di *Annulla* e non è nel file di progetto.

### Annullare e ripetere

- *Home › Modifica › Annulla* e *Ripeti* (anche nella scheda *Tabella*), le frecce nella barra del titolo, oppure Ctrl+Z per annullare e Ctrl+Y o Ctrl+Maiusc+Z per ripetere.
- Se fai qualcosa di nuovo dopo un *Annulla*, *Ripeti* non è più disponibile.

*Annulla* copre le modifiche ai dati del progetto (attività, relazioni, risorse, calendari e simili) e l'applicazione di un layout. Anche le modifiche alle colonne della tabella attività sono passaggi: aggiungere, rimuovere, spostare, ridimensionare, adattare automaticamente, fissare e ripristinare il layout delle colonne ai valori predefiniti. Questi passaggi di colonna appartengono alla tabella attività stessa e valgono per l'intera app, non per un solo documento. L'app conserva gli ultimi cento passaggi per documento, meno per un progetto molto grande.

## Trappole e cosa fa l'app

**Delete nella tabella attività non elimina un'attività.** Se il fuoco è nella tabella attività, Delete (o Backspace) svuota il contenuto delle celle selezionate. Per una cella obbligatoria o calcolata, come il nome o la durata, l'app rifiuta e mostra un messaggio sotto la tabella attività; per il nome, per esempio, *Questo valore è obbligatorio e non può restare vuoto.* Allora non viene svuotato nulla, nemmeno nelle altre celle selezionate. Clicca una barra nel Gantt oppure usa *Elimina* (nella scheda *Tabella*, dove non c'è il Gantt: *Tabella › Modifica › Elimina* oppure il menu del clic destro).

**Un'intera fase va via in una volta.** Se elimini un'attività di riepilogo, con essa vanno via le sue sottoattività, le loro relazioni e assegnazioni. *Annulla* (Ctrl+Z) riporta indietro tutto, anche le relazioni e le assegnazioni.

**Ciò che non torna indietro.** La selezione, la compressione e l'espansione, e il pulsante *Cancella* nella striscia *Non disponibile durante filtro/raggruppamento/ordinamento*, non fanno parte di *Annulla*. Se premi Ctrl+Z dopo *Cancella*, annulli quindi il passaggio precedente, non la cancellazione.

**Eliminare un'attività da cui altre dipendono.** Anche le relazioni da e verso quell'attività spariscono. Le attività che erano collegate solo a lei si staccano e, dopo **Calcola**, ripartono dalla propria data di inizio pianificata. Aggiungi nuove relazioni se servono, vedi [Aggiungere relazioni](docs://howto-relaties-leggen).

## Vedi anche

- [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen): il contrario, e copiare attività.
- [Modificare la struttura](docs://howto-structuur-aanpassen): collega un'attività sotto un'altra fase invece di eliminarla.
- [Trascinare, scorrere e ingrandire nel Gantt](docs://howto-gantt-bedienen): il riquadro di selezione e le modalità di scorrimento.
- [Menu del clic destro](docs://ref-contextmenus): cosa fanno *Elimina* e le altre voci su una selezione.
