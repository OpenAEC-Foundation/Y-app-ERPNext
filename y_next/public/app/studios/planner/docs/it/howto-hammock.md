# Creare un hammock

Obiettivo: creare un'attività che non conosce la propria durata, ma va dall'inizio di un'attività alla fine di un'altra, per esempio l'allestimento del cantiere, la sorveglianza o il noleggio di una baracca di cantiere.

## Quando ti serve

La baracca di cantiere resta lì per tutto il tempo in cui l'edificio è in costruzione, dai primi lavori di fondazione alla consegna. Se dai a quell'attività una durata fissa di 13 giorni lavorativi, non si adegua quando la muratura slitta, e la pianificazione non è più corretta. Un **hammock** (chiamato anche *level of effort*) segue l'attività a cui lo agganci: il suo inizio viene da una relazione di inizio, la sua fine da una relazione di fine, e la sua durata è la differenza tra le due.

## Passaggi

1. Crea l'attività, per esempio *Site cabin*, oppure seleziona un'attività esistente. Un cardine e un'attività di riepilogo (fase) non possono essere un hammock; nel pannello *Proprietà* e in *Modifica attività* manca la casella di spunta per tale attività, e nella colonna della tabella non si può modificare.
2. Spunta *Hammock (durata derivata)* nel pannello *Proprietà*, in *Modifica attività* (clic destro sull'attività, *Modifica...*) oppure nella colonna *Hammock (durata derivata)* sotto *Pianificazione*. Il campo *Durata* non si può più modificare.
3. Aggiungi una relazione dall'attività da cui l'hammock inizia all'hammock, di tipo **SS** (l'hammock inizia insieme a quell'attività) o **FS** (l'hammock inizia dopo quell'attività). Per farlo, seleziona l'hammock, clicca su *Aggiungi relazione* in *Dipendenze*, lascia la direzione su *Predecessore*, scegli l'attività e scegli il tipo. I passaggi sono descritti in [Aggiungere relazioni](docs://howto-relaties-leggen).
4. Aggiungi una relazione dall'attività con cui l'hammock finisce all'hammock, di tipo **FF** (l'hammock finisce insieme a quell'attività) o **SF**.
5. Guarda nel pannello *Proprietà* sotto *Hammock (durata derivata)*: lì vedi *Driver di inizio* con l'attività e il tipo, e *Driver di fine* con l'attività e il tipo. Un driver è un'attività da cui l'hammock prende l'inizio o la fine.
6. Premi **Calcola** (F5), per esempio tramite *Home › Pianificazione › Calcola*. L'hammock ora va dall'inizio del driver di inizio alla fine del driver di fine, e *Durata* mostra la durata derivata.

Nel Gantt un hammock è una barra sottile verde acqua con un gancio a entrambe le estremità.

Esempio: *Site cabin* riceve SS da *Groundwork* (lunedì 7 giugno 2027) e FF da *Roofing* (completato mercoledì 23 giugno). Dopo **Calcola** l'hammock va da lunedì 7 a mercoledì 23 giugno: 13 giorni lavorativi. Se la muratura slitta di 2 giorni lavorativi, la fine di *Roofing* diventa venerdì 25 giugno e l'hammock si allunga fino a 15 giorni lavorativi.

## Cosa fa l'app con un hammock

- L'hammock non è mai critico e non ha margine. Non limita nemmeno le attività da cui prende inizio e fine: a causa dell'hammock non ricevono date più tarde.
- Il ritardo conta. Con SS e ritardo `1d` l'hammock inizia un giorno lavorativo dopo il driver di inizio; con FF e ritardo `2d` finisce due giorni lavorativi dopo il driver di fine.

## Errori comuni e cosa fa l'app

**Nessun driver di fine.** Se l'hammock non ha una relazione FF o SF, l'app non può derivarne la fine. Il pannello *Proprietà* dice *Nessun driver di fine (FF/SF) — l'intervallo torna a lunghezza zero.* e il pannello *Avvisi* dice *Hammock senza driver di fine (nessun predecessore FF/SF): la durata torna a zero*. Poi l'hammock inizia e finisce nello stesso giorno. Aggiungi una relazione FF o SF.

**Un hammock che prosegue dopo l'ultima attività.** Se l'hammock prosegue fino a dopo l'ultima attività, per esempio con FF e un ritardo di 2 giorni lavorativi, la data di fine del progetto si sposta con esso. Le attività che esegui davvero ricevono allora margine; nessuna di esse è più critica.

**Attività che aspettano un hammock.** Se aggiungi una relazione dall'hammock a un'altra attività, quell'attività inizia solo dopo la fine dell'hammock. Tutta la catena prima dell'hammock, incluse le attività da cui l'hammock prende inizio e fine, riceve allora margine e non è più critica, perché l'hammock non trasmette pressione all'indietro. Quindi non far dipendere le attività da un hammock; collega piuttosto queste attività al driver di fine dell'hammock.

**Inserire una durata.** Il campo *Durata* di un hammock è derivato e non si può modificare. Una durata che avevi inserito prima di spuntare la casella non conta più.

## Vedi anche

- [Aggiungere relazioni](docs://howto-relaties-leggen): i passaggi per aggiungere una relazione di tipo SS o FF.
- [Relazioni e ritardo](docs://uitleg-relaties): che cosa significano SS e FF e come conta il ritardo.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): che cosa significa critico e come funziona il margine.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene l'hammock *Structural works tower A (LOE)*.
