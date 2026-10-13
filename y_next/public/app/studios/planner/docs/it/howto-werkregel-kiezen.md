# Scegliere una regola di lavoro

Obiettivo: stabilire per attività che cosa l'app regola quando cambi la durata, le unità o il lavoro: la durata, le unità o il lavoro stesso.

## Quando ti serve questo

Hai assegnato risorse a un'attività e vuoi che l'app calcoli nel modo che usi tu. Un esempio: la gru è noleggiata per un giorno e quel giorno è fisso. Un altro esempio: sai che ci sono 160 ore di muratura e vuoi vedere quanto tempo serve con tre persone invece di due. Queste due situazioni richiedono una regola di lavoro diversa.

La regola decide quale delle tre grandezze durata, unità e lavoro si sposta quando ne cambi un'altra. Il contesto e gli esempi svolti sono in [Regole di lavoro: durata, unità e lavoro](docs://uitleg-werkregels).

## Passaggi

### Mostrare la regola di lavoro

La regola di lavoro non è visibile per impostazione predefinita. Attiva questa opzione una volta:

1. Scegli *Impostazioni › Progetto › Impostazioni*, scheda *Pianificazione*.
2. Sotto il titolo *Calcolo* metti la spunta su *Mostra regole di lavoro e lavoro*.
3. Chiudi la finestra con *Chiudi*.

Questa è un'impostazione dell'app, non del file di progetto. Se un file contiene già regole di lavoro o lavoro memorizzato, per esempio un file di MS Project o di Primavera P6, l'app mostra la regola di lavoro di quel file anche senza questa impostazione. Lo stesso vale appena scegli tu una regola di lavoro in un file: la visualizzazione resta allora attiva per quel file, anche se disattivi di nuovo l'impostazione. Resta attiva finché il file è aperto e, dopo la riapertura, finché il file contiene una regola di lavoro o lavoro memorizzato.

### Scegliere una regola

1. Seleziona l'attività. Il pannello *Proprietà* è a destra; se non lo vedi, attivalo con *Vista › Pannelli › Proprietà*.
2. Alla voce *Regola di lavoro* scegli una delle cinque opzioni: *Predefinito del progetto (Durata e unità fisse)*, *Durata e unità fisse*, *Durata e lavoro fissi*, *Lavoro fisso* o *Unità fisse*. Con *Predefinito del progetto* l'attività segue il predefinito del progetto.
3. Sotto il menu a tendina l'app mostra che cosa protegge la regola, per esempio *Protetto: lavoro (la durata segue le unità)*.

*Predefinito del progetto* è la prima scelta ed è l'impostazione iniziale di un'attività. La regola tra parentesi è quella che il progetto ha ora come predefinito. L'app non ha un pulsante per cambiare quel predefinito del progetto: il predefinito arriva da un'importazione (per esempio da MS Project o Primavera P6) oppure dalla connessione MCP. Se vuoi un'altra regola per una sola attività, scegliela qui.

Puoi scegliere la regola anche nella tabella. Fai clic su **+** a destra dell'intestazione della tabella attività (*Aggiungi colonna*) e, sotto *Pianificazione*, scegli la colonna *Regola di lavoro*.

Un'attività senza assegnazione non ha nulla da collegare, quindi la regola lì non fa nulla. Assegna prima una risorsa (vedi [Assegnare risorse con una curva](docs://howto-resource-toewijzen)).

### Vedere e cambiare il lavoro

Per un'attività con assegnazioni compare una colonna *Lavoro (rim.)* nel blocco *Assegnazioni* del pannello *Proprietà*, accanto a *Unità/giorno*. È il lavoro rimanente di quella risorsa, in ore. Un piccolo lucchetto sopra una colonna indica che cosa tiene ferma la regola: *Unità/giorno* con *Durata e unità fisse* e con *Unità fisse*, *Lavoro (rim.)* con *Durata e lavoro fissi* e con *Lavoro fisso*.

Se vuoi cambiare il lavoro tu stesso, scrivi le ore nel campo e premi Invio. L'app non accetta un valore di 0 o meno: il campo torna al valore precedente.

### Vedere che cosa succede

Se scegli una regola, nessun numero cambia ancora. Con una regola che protegge il lavoro, l'app fissa solo il lavoro attuale, quindi *Lavoro (rim.)* ha un valore memorizzato. Solo alla modifica successiva la regola decide che cosa si sposta. Cambia per esempio *Unità/giorno* e vedi che cosa succede alla durata e al lavoro.

Se questo cambia la durata dell'attività, la barra di stato indica *Non aggiornato — ricalcola (F5)*. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*, per vedere le nuove date. Se *Calcola automaticamente* è attivo (stessa scheda *Pianificazione*, titolo *Calcolo*), l'app lo fa da sola.

## Quale regola va bene

- **Durata e unità fisse** va bene quando la durata è un accordo e le unità sono il dato che inserisci tu. Il lavoro ne deriva. Questa è l'impostazione predefinita. La gru noleggiata per un giorno appartiene qui: il giorno è fisso e tu decidi quante gru ci sono.
- **Durata e lavoro fissi** va bene quando l'attività deve finire entro un periodo fisso e sai quanto lavoro contiene. Se cambia la durata, l'app regola le unità.
- **Lavoro fisso** va bene quando sai quante ore di lavoro ci sono e vuoi vedere come cambia la durata con il numero di persone. Le 160 ore di muratura con tre persone invece di due appartengono qui. L'intonaco nel progetto di esercizio ha questa regola.
- **Unità fisse** va bene quando le unità sono fisse, per esempio una gru, e il lavoro determina la durata.

## Problemi comuni e che cosa fa l'app

**Il campo *Regola di lavoro* manca.** Allora l'impostazione *Mostra regole di lavoro e lavoro* è disattivata e il file non ha ancora regole di lavoro, oppure hai selezionato un cardine, una fase, una hammock o un'attività con tipo di durata *Tempo trascorso*. Lì non c'è una regola di lavoro. Seleziona un'attività normale.

**La durata cambia senza una tua modifica.** Con *Lavoro fisso* e *Unità fisse* la durata segue da unità e lavoro. Se cambi una di queste o il numero di risorse, l'app regola la durata, arrotondata per eccesso a giorni lavorativi interi. Per un'attività espressa in ore l'app arrotonda per eccesso a minuti interi.

**Il lavoro non corrisponde esattamente a unità × durata.** L'arrotondamento può causarlo. Accanto a *Lavoro (rim.)* compare allora un segnale di avviso, *Diverge da unità × durata*. L'istogramma segue il lavoro memorizzato.

**Il materiale non conta.** Per una risorsa materiale *Lavoro (rim.)* mostra un trattino. Il materiale non determina mai la durata.

**Un'attività con avanzamento.** La regola lavora sulla parte rimanente. Quindi *Lavoro (rim.)* mostra solo ciò che deve ancora accadere.

**Annullare.** Scegliere una regola, e ogni modifica che la regola calcola, è un unico passo per *Annulla* (Ctrl+Z). La regola allora scompare di nuovo, ma il campo *Regola di lavoro* resta visibile.

## Vedi anche

- [Regole di lavoro: durata, unità e lavoro](docs://uitleg-werkregels): come l'app collega durata, unità e lavoro, con esempi svolti.
- [Assegnare risorse con una curva](docs://howto-resource-toewijzen): mettere una risorsa su un'attività.
