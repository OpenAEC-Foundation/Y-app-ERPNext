# Impostare un calendario risorsa

Obiettivo: registrare in quali giorni una risorsa è disponibile, in modo che l'istogramma, la sovrassegnazione e il livellamento ne tengano conto.

## Quando ti serve

La squadra di muratori lavora solo dal lunedì al giovedì. La gru è impegnata in un altro progetto nelle prime due settimane di agosto. Un subappaltatore ha quattro giorni lavorativi fissi. Senza un calendario proprio, l'app presume che la risorsa lavori nei giorni del calendario di progetto.

Un calendario risorsa non cambia nessuna data di attività. Stabilisce solo quando la risorsa è disponibile. Se un'attività lavora in un giorno in cui la risorsa non lavora, la capacità quel giorno è 0 e il giorno conta come sovrassegnato. Se vuoi che l'attività stessa lavori in altri giorni, dalle un calendario proprio ([Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen)). La differenza è spiegata in [Calendari e giorni lavorativi](docs://uitleg-kalenders).

## Passaggi

### Creare un nuovo calendario risorsa

1. Scegli *Risorse › Gestisci › Risorse*. Si apre il pannello risorse. Se la risorsa non esiste ancora, creala con *Nuova risorsa nel progetto*.
2. Trova la riga della risorsa. Nella colonna *Calendario* il valore predefinito è *Calendario di progetto*: la risorsa segue quindi il calendario di progetto.
3. Nell'elenco scegli *+ Calendario risorsa*. Si apre la finestra *Calendario risorsa*. Ha gli stessi campi del modulo calendario: *Nome*, *Giorni lavorativi*, gli orari di lavoro e le *Festività*. Il nuovo calendario parte come copia del calendario standard e si chiama *Calendario risorsa*.
4. Dai al calendario un nome adatto alla risorsa, per esempio *Crew Mon–Thu*, e imposta i giorni lavorativi: clicca su venerdì per disattivarlo sotto *Giorni lavorativi*. Inserisci festività o periodi di fermo nell'elenco *Festività* con *Aggiungi festività*.
5. Clicca *Applica*. Il calendario si trova ora nella libreria di risorse del progetto ed è collegato alla risorsa, in un unico passaggio che puoi annullare con *Annulla*. Con *Annulla* non viene creato nulla.

### Scegliere o modificare un calendario esistente

Nella colonna *Calendario* scegli un calendario dall'elenco. *Calendario di progetto* rimuove di nuovo il calendario proprio. Se vuoi modificare il calendario scelto, clicca sulla matita accanto all'elenco (*Modifica…*). Si apre la finestra *Calendario risorsa* con il calendario attuale.

### Controllare il risultato

1. Se la barra di stato mostra *Non aggiornato — ricalcola (F5)*, premi **Calcola** (F5).
2. Scegli *Risorse › Istogramma › Istogramma* e clicca sulla risorsa nell'elenco a sinistra dell'istogramma. I giorni in cui la risorsa non lavora ma è pianificata sono rossi. Se tieni il mouse sopra uno di questi giorni, la barra riporta, per esempio, *Non lavora in questo giorno secondo il calendario "Crew Mon–Thu"*.
3. Sotto *Risorse › Sovrallocazione* trovi il numero di risorse sovrassegnate, e la barra di stato riporta, per esempio, *1 risorsa/e sovrassegnata/e*.

## Errori comuni e cosa fa l'app in quel caso

**Contano solo i giorni, non le ore.** Un calendario risorsa stabilisce in quali giorni la risorsa lavora. Quante unità sono disponibili quel giorno dipende dalle *Unità max* della risorsa, non dagli orari di lavoro nel calendario.

**Il livellamento non risolve sempre il problema.** Se non esiste una finestra in cui ogni giorno dell'attività cade in un giorno lavorativo della risorsa, lo spostamento non aiuta. Scegli *Risorse › Livellamento › Livella…* e clicca *Calcola*. L'attività finisce poi sotto *Conflitti rimanenti*, con il motivo *La risorsa non lavora in tutti i giorni richiesti da questa attività — lo spostamento non risolve il problema.* Assegna poi l'attività a un'altra risorsa, oppure dalle un calendario proprio.

**Un calendario condiviso.** L'elenco mostra tutti i calendari del progetto, quindi anche il calendario di progetto e i calendari delle attività. Se modifichi un calendario così con la matita, cambia anche la pianificazione delle attività che lo usano, e la barra di stato mostra *Non aggiornato — ricalcola (F5)*. Meglio creare un calendario proprio per la risorsa.

**Non sempre è colpa del calendario se una risorsa è sovrassegnata.** Anche una risorsa che lavora ogni giorno può essere sovrassegnata: il suggerimento menziona il calendario solo se il giorno non è un giorno lavorativo della risorsa.

## Vedi anche

- [Calendari e giorni lavorativi](docs://uitleg-kalenders): perché un calendario risorsa non sposta nessuna data.
- [Creare e assegnare un calendario](docs://howto-kalender-maken-en-toewijzen): i campi del modulo calendario.
- [Generare festività e ferie edili](docs://howto-feestdagen-genereren): inserire festività e periodi di fermo nel calendario.
- [Finestre dei calendari](docs://ref-kalenders): tutti i campi delle finestre calendario.
