# Relazioni esterne verso un altro progetto

Obiettivo: collega un'attività di questo progetto a un'attività in un altro file di progetto, così la tua pianificazione tiene conto del lavoro pianificato altrove.

## Quando ti serve questo

Il tuo ampliamento può iniziare solo quando il cantiere è pronto per la costruzione, e quel lavoro è nel progetto dell'appaltatore. Oppure l'installatore può iniziare solo quando la tua struttura è terminata, e lui pianifica nel proprio file. Una relazione normale funziona solo tra attività dello stesso progetto. Una **relazione esterna** collega un'attività a un'attività in un altro file.

Una relazione esterna non viene calcolata in tempo reale insieme all'altro progetto. L'app salva una **data di ancoraggio** fissa: la data dell'attività esterna nel momento in cui la colleghi. Il calcolo usa quella data come limite. Se l'altro progetto cambia, nel tuo non si sposta nulla finché non aggiorni l'ancoraggio.

## Passaggi

1. Seleziona esattamente un'attività in questo progetto: l'attività che dipende dall'attività esterna, oppure quella da cui dipende l'attività esterna.
2. Scegli *Home › Attività › Collegamento ▾ › Aggiungi relazione esterna…*. Lo stesso menu si trova in *Pianificazione › Relazioni* e in *Tabella › Attività*. La voce è disponibile solo se è selezionata esattamente un'attività.
3. Nella finestra *Relazione esterna (tra progetti)* scegli una delle due vie. Con *File di origine* scegli il file di progetto sotto *Scegli un file recente* e poi l'*Attività di origine*; l'app legge il file solo in lettura, non lo apre come documento, e ricava lei stessa la data di ancoraggio. Questa via funziona solo nell'app desktop e solo per un file nell'elenco dei file recenti; altrimenti il pulsante *File di origine* è disattivato. Con *Manuale (soluzione alternativa)* compila *Id progetto* e *Id attività* dell'attività esterna, facoltativamente *Nome attività (facoltativo)*, e la *Data di ancoraggio*. Nella versione browser questa è l'unica via.
4. Sotto *Direzione* scegli se l'attività esterna è il tuo predecessore o il tuo successore: *Predecessore (esterno → io)* oppure *Successore (io → esterno)*.
5. Scegli il *Tipo di relazione* (FS, SS, FF o SF) e, se serve, compila il *Ritardo (giorni lavorativi)*, per esempio `0d` o `2d`.
6. Fai clic su *Aggiungi collegamento* e premi **Calcola** (F5).

Quale data inserisci come data di ancoraggio per una relazione manuale dipende dalla direzione e dal tipo:

- Con un **predecessore** esterno conta la prima lettera del tipo: F indica la data di fine dell'attività esterna, S la data di inizio. Con FS e FF inserisci quindi la fine, con SS e SF l'inizio.
- Con un **successore** esterno conta la seconda lettera: S è la data di inizio dell'attività esterna, F la data di fine. Con FS e SS inserisci quindi l'inizio, con FF e SF la fine.

Se pianifichi in ore (pianificazione oraria attiva e un'attività su un calendario con orari di lavoro), anche il campo *Data di ancoraggio* chiede un'ora.

Esempio: il progetto del cantiere finisce venerdì 18 giugno 2027. Colleghi *Opere di fondazione* con un predecessore esterno di tipo FS, data di ancoraggio 18 giugno 2027. Dopo **Calcola** le opere di fondazione iniziano lunedì 21 giugno, il primo giorno lavorativo dopo l'ancoraggio. Un successore esterno funziona al contrario: limita fino a quando la tua attività può finire al massimo.

## Cosa vedi e come lo gestisci

- Le relazioni esterne compaiono come testo nelle colonne *Predecessori* e *Successori* della tabella attività (aggiungile con il **+** nell'intestazione della tabella, sotto *Relazioni*), con il nome del progetto e dell'attività, e il tipo. Un piccolo triangolo con *Origine mancante* indica che la fonte non è stata letta. Tieni il mouse sopra la relazione per vedere il progetto (la riga *Id progetto* mostra il nome del progetto appena è noto), l'Id attività, la data di ancoraggio e lo stato della fonte.
- Nel Gantt c'è una barra fantasma grigia sull'attività. Con un predecessore la barra finisce sulla data di ancoraggio, con un successore inizia da quella data. Un bordo tratteggiato con l'etichetta rossa *obsoleto* significa che la fonte non è stata letta. Con una relazione manuale questo è sempre il caso.
- Fai clic destro su una relazione nella colonna per *Modifica relazione esterna…* e *Elimina relazione*. Se la relazione ha un file di origine, c'è anche *Aggiorna origine*.
- Scegli *Collegamento ▾ › Aggiorna tutte le relazioni esterne* per rileggere i file di origine e aggiornare le date di ancoraggio. Questo funziona solo nell'app desktop. Se hai solo relazioni manuali, l'app mostra *Nessuna fonte esterna aggiornabile (percorso del file mancante).* Premi **Calcola** dopo un aggiornamento.
- Se cambi il tipo o la direzione, così che l'ancoraggio richiede l'altro lato dell'attività esterna (inizio invece di fine, o viceversa), l'app chiede un nuovo ancoraggio per una relazione manuale: *Scegli un nuovo ancoraggio: il tipo di relazione ora usa l’altro lato dell’attività di origine.* Con una relazione che ha un file di origine, l'app rilegge lei stessa l'ancoraggio.

## Insidie e cosa fa l'app

**L'altro progetto non si sposta insieme.** Se l'attività esterna cambia data, la tua pianificazione continua a calcolare con la vecchia data di ancoraggio, finché non aggiorni la relazione o non cambi l'ancoraggio. Con la via manuale cambi tu la data di ancoraggio: fai clic destro sulla relazione e scegli *Modifica relazione esterna…*.

**Un predecessore esterno è un limite inferiore.** Se la tua attività inizia più tardi di quanto richiede l'ancoraggio a causa dei suoi predecessori, prevale quella relazione. L'ancoraggio ha solo un effetto di spinta.

**Un successore esterno è un limite superiore.** Se l'ancoraggio è troppo stretto, lo vedi come margine negativo sulla tua attività e sulle attività che la precedono. Non compare un avviso separato, quindi tieni d'occhio la colonna *Margine totale*.

**Solo un ritardo fisso.** Per una relazione esterna non puoi inserire un ritardo in giorni di calendario o in percentuale; l'app mostra *Le relazioni esterne supportano solo un ritardo fisso in giorni o tempo lavorativo.* I giorni lavorativi contano nel calendario della tua attività. Un ritardo in ore conta solo per un'attività pianificata in ore; per un'attività in giorni il calcolo lo ignora. Usa quindi i giorni lavorativi.

**L'Id progetto di un altro file.** L'Id progetto non si trova in un campo o in una colonna, ma è salvato come `InternalProjectId` nell'IFC di quel progetto: apri il progetto, vai alla scheda *IFC* e scegli *Genera IFC*. Il calcolo usa solo la data di ancoraggio; l'id non è una semplice etichetta. Quando aggiorni, l'app riconosce un file di origine prima per il suo Id progetto, poi per il suo percorso. Se con una relazione manuale inserisci lo stesso id di un file di origine, la relazione viene aggiornata insieme a quel file. L'*ID attività* di un'attività nell'altro progetto trovi nella tabella di quel progetto, nella colonna *ID attività* sotto *Tecnico*.

## Vedi anche

- [Relazioni e ritardo](docs://uitleg-relaties): come l'app calcola una relazione e un ritardo.
- [Aggiungere relazioni](docs://howto-relaties-leggen): relazioni tra attività nello stesso progetto.
- [Vincoli e scadenze](docs://uitleg-constraints): limiti di data su un'attività, senza un altro progetto.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): contiene una relazione esterna su *Car park paving* (un predecessore esterno).
