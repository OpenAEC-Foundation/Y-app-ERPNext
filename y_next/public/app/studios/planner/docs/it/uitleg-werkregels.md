# Regole di lavoro: durata, unità e lavoro

Metti un intonacatore sull'intonacatura e l'attività dura quattro giorni. Se aggiungi un secondo intonacatore, il lavoro si può fare in due giorni. Può anche restare quattro giorni, con il doppio del lavoro. Entrambi hanno senso. Quale dei due sceglie l'app dipende dalla **regola di lavoro** dell'attività. In questo articolo leggi come l'app collega durata, unità e lavoro, e che cosa tiene costante ogni regola di lavoro.

## Il concetto

Tre grandezze sono collegate:

- **Durata**: per quanto tempo l'attività dura, in giorni lavorativi o in ore.
- **Unità**: quanta risorsa lavora sull'attività per giorno lavorativo. Nell'app si chiama *Unità/giorno*. Unità 1 è un intonacatore per tutta la giornata, 2 sono due intonacatori e 0,5 è mezza giornata.
- **Lavoro**: il numero totale di ore che la risorsa spende sull'attività.

La somma è: lavoro = durata × unità × ore per giorno lavorativo. Le ore per giorno lavorativo vengono dal calendario dell'attività. Intonacatura di quattro giorni lavorativi con un intonacatore è, con un giorno lavorativo di 8 ore, 4 × 1 × 8 = 32 ore di lavoro.

Se cambi una delle tre, almeno una delle altre due deve spostarsi, altrimenti la somma non regge più. La regola di lavoro decide quale. La imposti per attività, nel pannello *Proprietà*. L'app mostra la regola di lavoro e il lavoro solo quando li attivi; come funziona è spiegato in [Scegliere una regola di lavoro](docs://howto-werkregel-kiezen).

Una regola di lavoro funziona solo su attività normali. I cardini, le fasi (attività di riepilogo), le hammock e le attività il cui *Tipo di durata* è *Tempo trascorso* non ne hanno una: il campo *Regola di lavoro* non c'è. Anche il materiale, come il calcestruzzo o la malta da intonaco, non conta. La quantità di materiale non guida mai la durata, e l'app non la modifica mai a causa di una regola di lavoro.

## Come calcola l'app

### La regola agisce su ciò che modifichi

L'app ricalcola durata, unità e lavoro solo nel momento in cui modifichi uno di questi: la durata dell'attività, le unità di un'assegnazione, il lavoro, una risorsa aggiunta o rimossa, oppure le ore al giorno in un calendario. **Calcola** (F5) non cambia nessuno di questi valori: F5 calcola solo le date. Anche scegliere una regola non cambia nemmeno un numero. La regola conta alla tua modifica successiva.

Se una regola di lavoro cambia la durata di un'attività, la pianificazione diventa non aggiornata. La barra di stato mostra allora *Non aggiornato — ricalcola (F5)*, a meno che *Calcola automaticamente* sia attivo.

### Quattro regole

Nel pannello *Proprietà*, sotto il menu a tendina, l'app mostra che cosa protegge la regola scelta. Le quattro regole, con il testo dell'app:

- **Durata e unità fisse** (*Protetto: durata e unità (il lavoro segue)*). Questa è la predefinita. L'app non cambia mai la durata da sola e il lavoro segue da durata e unità. Se digiti tu il lavoro, l'app adegua le unità, perché la durata è fissa.
- **Durata e lavoro fissi** (*Protetto: durata e lavoro (le unità seguono)*). L'app non cambia mai la durata da sola. Se cambi la durata, il lavoro resta e le unità si adeguano.
- **Lavoro fisso** (*Protetto: lavoro (la durata segue le unità)*). Il lavoro è fisso e la durata segue dal lavoro e dalle unità.
- **Unità fisse** (*Protetto: unità (la durata segue il lavoro)*). Le unità sono fisse e la durata segue dal lavoro.

Quindi due regole non toccano la durata. Con le altre due la durata si sposta quando cambi le unità, il lavoro o il numero di risorse. Con una sola risorsa, Lavoro fisso e Unità fisse fanno esattamente la stessa cosa. Differiscono quando cambi tu la durata: con Lavoro fisso il lavoro resta e le unità si adeguano, con Unità fisse restano le unità e il lavoro cresce insieme. Differiscono anche quando ci sono più risorse sull'attività (vedi sotto).

Gli esempi svolti qui sotto mostrano che cosa fa ogni regola.

### Arrotondamento

La durata che segue dalla somma viene arrotondata per eccesso dall'app. Per un'attività in giorni, fino a giorni lavorativi interi; per un'attività in ore, fino a minuti interi. Lavoro e unità restano quello che hai inserito o quello che l'app ha ricavato dalla somma. Per questo la somma a volte non torna esattamente. L'esempio sotto mostra che cosa succede allora.

### Più risorse

Se un'attività ha più risorse, valgono due principi. Con Durata e lavoro fissi, Lavoro fisso e Unità fisse, il lavoro totale resta uguale quando aggiungi o rimuovi una risorsa. L'app lo divide in proporzione alle unità. Con Durata e unità fisse, una nuova risorsa porta invece il proprio lavoro. Con Lavoro fisso e Unità fisse decide la risorsa più lenta: per ogni risorsa è il lavoro diviso per le unità, e conta il risultato più alto.

Un esempio: due risorse hanno ciascuna 32 ore di lavoro e unità 1, insieme 4 giorni lavorativi. Imposti le unità della prima a 0,5. La durata diventa allora 8 giorni lavorativi. Con Lavoro fisso la seconda risorsa mantiene le sue 32 ore di lavoro e le sue unità scendono a 0,5. Con Unità fisse la seconda mantiene le sue unità 1 e il suo lavoro cresce a 64 ore.

### Avanzamento

Se l'attività ha già avanzamento, la regola lavora sulla parte rimanente: la durata rimanente e il lavoro rimanente. Nell'app quel lavoro si chiama *Lavoro (rim.)*. Quello che è fatto resta.

### Attività in ore

Un'attività che pianifichi in ore si calcola allo stesso modo, ma in minuti. Se solo la gru è sull'attività di 5 ore, sono 5 ore di lavoro. Con Lavoro fisso, la durata per unità 2 diventa allora 2,5 ore. Anche il solaio alveolare nel progetto di esercizio ha sopra la squadra dei carpentieri. Serve ancora 5 ore di lavoro, è la più lenta, quindi la durata resta 5 ore. Come si collegano ore e giorni è spiegato in [Giorni e ore](docs://uitleg-dagen-en-uren).

## Esempio svolto: l'intonacatura

L'esempio è il progetto di esercizio *House extension* dei tutorial. Nel tutorial 5 lo ricavi da solo e controlli i numeri. Qui leggi che cosa fa ogni regola.

L'intonacatura dura 4 giorni lavorativi. Ci è assegnato un intonacatore, con unità 1, e il giorno lavorativo è di 8 ore. Quindi il lavoro è 32 ore.

### Durata e unità fisse

- Imposti la durata a 6 giorni lavorativi: il lavoro sale a 48 ore, le unità restano 1.
- Imposti le unità a 2: la durata resta 4 giorni lavorativi, il lavoro diventa 64 ore.
- Digiti 48 ore in *Lavoro (rim.)*: la durata resta 4 giorni lavorativi, le unità diventano 1,5.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: la durata resta 4 giorni lavorativi e quella seconda porta 32 ore di lavoro, 64 ore insieme.

### Durata e lavoro fissi

- Imposti la durata a 6 giorni lavorativi: il lavoro resta 32 ore, le unità scendono a 0,67.
- Imposti le unità a 2: la durata resta 4 giorni lavorativi. Poiché la durata è fissa, il lavoro cresce insieme a 64 ore.
- Digiti 16 ore in *Lavoro (rim.)*: la durata resta 4 giorni lavorativi, le unità diventano 0,5.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e le unità diventano 0,5 per entrambe. La durata resta 4 giorni lavorativi.

### Lavoro fisso

- Imposti la durata a 6 giorni lavorativi: il lavoro resta 32 ore, le unità scendono a 0,67.
- Imposti le unità a 2: il lavoro resta 32 ore e la durata diventa 2 giorni lavorativi. Questo è il passo che fai nel tutorial 5.
- Digiti 48 ore in *Lavoro (rim.)*: le unità restano 1 e la durata diventa 6 giorni lavorativi.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e la durata diventa 2 giorni lavorativi. Rimuovi di nuovo quella seconda risorsa e la durata torna 4 giorni lavorativi.

### Unità fisse

- Imposti la durata a 6 giorni lavorativi: le unità restano 1, il lavoro sale a 48 ore.
- Imposti le unità a 2: il lavoro resta 32 ore e la durata diventa 2 giorni lavorativi.
- Digiti 48 ore in *Lavoro (rim.)*: le unità restano 1 e la durata diventa 6 giorni lavorativi.
- Assegni una seconda risorsa, per esempio *Plasterer 2*, con unità 1: le 32 ore vengono divise, 16 ore ciascuna, e la durata diventa 2 giorni lavorativi.

### Quando la somma non torna

Con Lavoro fisso imposti le unità a 3. Il lavoro è 32 ore, quindi la durata diventa 32 ÷ (3 × 8) = 1,33 giorni lavorativi. L'app arrotonda per eccesso a 2 giorni lavorativi. Il lavoro (32 ore) e le unità (3) restano, ma 2 × 3 × 8 fa 48 ore. L'istogramma quindi distribuisce le 32 ore su 2 giorni lavorativi: 2 unità al giorno, non 3. Accanto a *Lavoro (rim.)* compare un segnale di avviso, *Diverge da unità × durata*, per mostrarlo.

Con due risorse con unità diverse funziona allo stesso modo. Se, con Lavoro fisso, aggiungi una seconda risorsa, per esempio *Plasterer 2*, con unità 2, all'intonacatore con unità 1, l'app divide le 32 ore nel rapporto 1 : 2, quindi 10,7 e 21,3 ore. Entrambe richiedono allora 1,33 giorni lavorativi. La durata diventa 2 giorni lavorativi.

### Un calendario diverso

Con Lavoro fisso il giorno lavorativo del calendario passa da 8 a 6 ore. Il lavoro resta 32 ore, quindi la durata diventa 32 ÷ 6 = 5,33, arrotondata per eccesso a 6 giorni lavorativi. Come l'app conta giorni lavorativi e orari di lavoro è spiegato in [Calendari e giorni lavorativi](docs://uitleg-kalenders). L'app riporta: *Dopo la modifica del calendario la regola di lavoro ha adeguato la durata di 1 attività (il lavoro resta, le ore al giorno sono cambiate).*

### Un'attività con avanzamento

Il paramento interno della cavità dura 5 giorni lavorativi ed è fatto al 40%: 2 giorni lavorativi sono fatti e ne restano 3 (24 ore). Con Lavoro fisso imposti le unità da 1 a 2. Il lavoro rimanente resta 24 ore e la durata rimanente diventa 1,5, arrotondata per eccesso a 2 giorni lavorativi. L'attività ora dura 2 + 2 = 4 giorni lavorativi e l'avanzamento è 50%. La percentuale si adegua, perché la parte fatta resta uguale e la parte rimanente si accorcia.

## Conseguenze e idee sbagliate

**«Lavoro fisso significa che la durata è fissa.»** No, è esattamente il contrario. Con *Durata e unità fisse* e *Durata e lavoro fissi* la durata è fissa. Con *Lavoro fisso* e *Unità fisse* la durata segue dalle altre due.

**«Se scelgo una regola, la mia pianificazione cambia.»** No. Scegliere non cambia nessun numero. Solo alla tua modifica successiva la regola decide che cosa si sposta. Con una regola che protegge il lavoro, l'app fissa il lavoro nel momento in cui scegli, così c'è un numero da proteggere. Un'attività così ha allora un *Lavoro (rim.)* salvato.

**«La durata è cambiata senza che io la tocchi.»** Può succedere dopo una modifica delle unità, del lavoro, del numero di risorse o delle ore al giorno, con Lavoro fisso o Unità fisse. La barra di stato mostra allora che la pianificazione non è aggiornata. Premi **Calcola** (F5) per vedere le nuove date.

**Senza assegnazione una regola di lavoro non fa nulla.** Non ci sono allora né unità né lavoro a cui collegare la durata.

**I file di MS Project o di Primavera P6 mostrano sempre la regola di lavoro.** Per un'attività di MS Project compare a volte, sotto la regola, il testo *Da MS Project: basata sull'impegno* o *Da MS Project: non basata sull'impegno*. Questa impostazione salvata cambia due casi. Con *Durata e lavoro fissi* e basata sull’impegno, il lavoro si sposta quando cambi la durata, invece delle unità. Con *Unità fisse* e non basata sull’impegno, il lavoro si sposta quando aggiungi o rimuovi una risorsa, e la durata resta. Le attività che crei nell'app non hanno questa impostazione.

## Vedi anche

- [Scegliere una regola di lavoro](docs://howto-werkregel-kiezen): i passi per impostare la regola di lavoro di un'attività.
- [Assegnare risorse con una curva](docs://howto-resource-toewijzen): mettere una risorsa su un'attività, con unità e distribuzione.
- [Giorni e ore](docs://uitleg-dagen-en-uren): come l'app converte giorni e ore.
- [Calendari e giorni lavorativi](docs://uitleg-kalenders): come l'app conta giorni lavorativi e orari di lavoro.
