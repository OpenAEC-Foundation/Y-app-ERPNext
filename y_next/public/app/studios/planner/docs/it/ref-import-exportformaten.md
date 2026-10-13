# Formati di importazione ed esportazione

Per formato di file: se puoi aprirlo, salvarlo ed esportarlo, cosa viene incluso e cosa no, e con quale profilo di calcolo si apre. Il perché di tutto questo, con un esempio con numeri, si trova in [File e formati](docs://uitleg-bestanden).

## In breve

**Apertura** funziona con IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` e `.xer`. Un file con un'altra estensione viene trattato dall'app come IFC.

**Salvataggio** scrive sempre IFC. Solo un file IFC aperto diventa la destinazione del salvataggio. Un progetto di un altro formato non ha un file dopo l'apertura. *Salva* chiede allora dove salvare il file IFC.

**Esportazione** funziona verso IFC 4x3, MS Project XML, Primavera P6 XML, CSV e due fogli di avanzamento (Excel e CSV). Un'esportazione non cambia il tuo progetto.

**Sola lettura** sono `.mpp` e `.xer`: l'app può aprirli, ma non scriverli.

**PDF** viene solo da un report (vedi [Tipi di report](docs://ref-rapporttypes)). L'app non legge il PDF.

**Dove.** Apertura: *Home › File › Apri*, *File › Apri* oppure Ctrl+O. Esportazione: *Home › File › Esporta* o *File › Esporta*. Un foglio di avanzamento compilato lo leggi con *File › Importa*. Oppure usi il pulsante *Aggiorna l'avanzamento da un foglio* nel gruppo *Avanzamento* della barra multifunzione sulle schede *Pianificazione*, *Tabella* e *Rapporto*.

**Profilo di calcolo all'apertura.** Ogni formato si apre con un profilo di calcolo. Cosa sia, lo spiega [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies). `.xer` si apre con *Primavera P6*, `.mpp` con *Microsoft Project*, e CSV, MS Project XML e P6 XML con *Open Planner Studio*. IFC mantiene il profilo salvato nel file. Per `.xer` e `.mpp` l'app segnala che il progetto calcola in questo modo. Solo IFC contiene il profilo di calcolo e le opzioni di calcolo. Delle opzioni di calcolo, MS Project XML scrive al massimo la soglia critica. Un'esportazione riaperta di un altro formato calcola come *Open Planner Studio*.

## IFC

**Apertura** — sì, `.ifc`. L'app legge IFC 4.3. Profilo di calcolo: quello nel file.

**Salvataggio** — sì, ed è l'unico formato che si salva. *Salva* scrive l'intero progetto come file IFC. Il file diventa la destinazione del salvataggio.

**Esportazione** — sì, come *IFC 4x3* (descritto come *Standard BuildingSMART. Collegamento 4D con modelli BIM.*). Nome predefinito: il nome del progetto con l'estensione `.ifc`. Se il tuo progetto è collegato a una libreria di risorse, la casella *Salva anche il file di libreria* si trova sotto le card in *File › Esporta*. Se è spuntata, l'app chiede dove salvare *projectname-bibliotheek.ifc*, dopo il progetto. La casella non è nell'elenco della scheda *Home*.

**Cosa viene incluso** — tutto ciò che appartiene al progetto: attività con struttura, durata, date e avanzamento; relazioni con ritardo; vincoli e scadenze; calendari; risorse e assegnazioni, inclusa la distribuzione in ore; baseline; codici attività e campi personalizzati; note; relazioni esterne verso altri progetti; interruzioni; regole di lavoro e tipi di attività; le impostazioni del progetto, come la data di stato, la modalità di progresso, il profilo di calcolo e le opzioni di calcolo; il collegamento con una libreria di risorse. Per un progetto da un `.xer` viene incluso anche il file sorgente originale. Un tipo di attività personalizzato viene salvato come tipo IFC `USERDEFINED`, con il suo nome nel campo ObjectType. Così altri programmi IFC leggono l'attività normalmente. L'app conserva anche l'id fisso del tipo. Quindi rinominarlo non interrompe il collegamento. Se qualcuno apre il file su un altro computer, il tipo appare lì sotto *Da questo progetto*, non in *I miei tipi di attività*.

**Cosa non viene incluso** — come hai impostato la schermata (zoom, posizione di scorrimento, attività selezionata, fasi compresse, filtro e raggruppamento scelti) e le impostazioni dell'app ([Impostazioni](docs://ref-instellingen)). La scheda *IFC* mostra il testo IFC del tuo progetto.

## MS Project XML (MSPDI)

**Apertura** — sì. L'app riconosce un file `.xml` come MS Project XML dall'elemento radice `Project`, nello spazio dei nomi di MS Project (oppure senza spazio dei nomi). Profilo di calcolo: *Open Planner Studio*.

**Salvataggio** — no. Un progetto così non ottiene una destinazione di salvataggio.

**Esportazione** — sì, come *MS Project XML* (*Apribile in Microsoft Project. Struttura WBS completa.*). Nome predefinito: il nome del progetto con `.xml`.

**Cosa viene incluso** — attività con struttura (livello e WBS), durata, date e avanzamento; relazioni con ritardo, anche in ore o percentuali; vincoli, inclusa la scadenza; calendari, inclusi i calendari di attività e di risorsa; risorse e assegnazioni, inclusa la curva o la distribuzione in ore; la data di stato; la soglia critica, come numero intero di giorni lavorativi di 0 o più, con *Margine totale ≤ soglia*; la descrizione di un'attività (come nota); la regola di lavoro di un'attività (come tipo di attività di MS Project); un tipo di attività personalizzato, in un campo libero (`ExtendedAttribute`) che l'app legge di nuovo e che MS Project può ignorare. Delle tue baseline viene incluso solo quella attiva, come baseline 0. Un'attività in ore mantiene la sua unità. Un cardine mantiene il suo tipo: inizio, fine o automatico.

**Cosa non viene incluso** — note (la checklist di un'attività), relazioni esterne verso altri progetti, codici attività e campi personalizzati, un secondo vincolo, il contrassegno *Pianificata manualmente*, il ritardo di livellamento, il punto di ripresa e di arresto di un'attività con avanzamento fuori sequenza, le convenzioni *Il lavoro rimanente riprende dopo la durata trascorsa* e *Non spostare le attività non iniziate alla data di stato* di un profilo di MS Project, e le altre opzioni di calcolo. Attività interrotte senza distribuzione in ore vengono incluse senza le interruzioni.

**Cosa cambia durante il trasferimento** — un vincolo *Deve iniziare il (MSO)* o *Deve finire il (MFO)* senza la scelta *Obbligatorio (logica di blocco)* diventa *Iniziare non prima del (SNET)* o *Finire non prima del (FNET)*. Un hammock diventa un'attività normale con date calcolate.

## File MS Project (`.mpp`)

**Apertura** — sì, da MS Project 2010 fino a 2021. Profilo di calcolo: *Microsoft Project*. L'app legge solo il file: non cambia mai il tuo `.mpp`. Un file di MS Project 2007 o precedente, e un file protetto da password, vengono rifiutati con un messaggio che rimanda all'esportazione XML di MS Project.

**Salvataggio** — no, e non c'è una destinazione di salvataggio: *Salva* scrive un nuovo file IFC.

**Esportazione** — no.

**Cosa viene incluso** — attività con struttura, durata e vincoli; relazioni con ritardo; calendari; risorse e assegnazioni; avanzamento; un codice WBS che hai compilato tu stesso in MS Project. Anche le date e il margine che MS Project ha calcolato da solo vengono letti, per la vista *Date come registrate*.

**Cosa non viene incluso** — baseline, costi e tariffe, note e i campi personalizzati di MS Project. Vedi [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen).

**Origine e licenza** — il lettore `.mpp` è stato scritto per Open Planner Studio ed è derivato dal codice sorgente e dalla conoscenza strutturale di MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), una libreria Java con licenza LGPL-2.1. Struttura e costanti dei campi sono state portate in TypeScript. Open Planner Studio stesso è open source con licenza LGPL-3.0. Il lettore `.xer` non è un derivato: MPXJ è stato consultato solo come fonte di comprensione.

## Primavera P6 XML

**Apertura** — sì. L'app riconosce un file `.xml` come P6 XML dall'elemento radice `APIBusinessObjects`. Profilo di calcolo: *Open Planner Studio*.

**Salvataggio** — no.

**Esportazione** — sì, come *Primavera P6 XML* (*Per Oracle Primavera P6.*). Nome predefinito: il nome del progetto con `.xml`. È lo stesso nome di un'esportazione MS Project XML, quindi dai tu nomi diversi.

**Cosa viene incluso** — struttura WBS e attività con durata, date e avanzamento; relazioni con ritardo; vincoli (anche un secondo, come vincolo soft); calendari; risorse e assegnazioni; la data di stato (come `DataDate`); un tipo di attività personalizzato, in un campo proprio, `OPS Custom Task Type`, che l'app legge di nuovo e che P6 può ignorare.

**Cosa non viene incluso** — baseline e scadenze; codici attività, campi personalizzati, note e relazioni esterne; le opzioni di calcolo. P6 non ha ritardi in percentuale: l'app li converte in un numero fisso di giorni. Un ritardo in giorni di calendario diventa un ritardo in orari di lavoro: 3 giorni di calendario diventano 3 giorni lavorativi. Un hammock diventa un'attività normale. Un'attività pianificata manualmente diventa un'attività normale con date calcolate. Un ritardo di livellamento di meno di un giorno viene eliminato.

## File Primavera (`.xer`)

**Apertura** — sì. Profilo di calcolo: *Primavera P6*. L'app legge solo il file: non scrive `.xer` e non cambia mai il tuo file. Apre una scheda per progetto con attività. Un file senza attività o con tabelle danneggiate viene rifiutato con un messaggio.

**Salvataggio** — no, e non c'è una destinazione di salvataggio: *Salva* scrive un nuovo file IFC, con dentro il file `.xer` originale.

**Esportazione** — no. Se esporti un progetto da un `.xer` in CSV, MS Project XML o P6 XML, l'app segnala che le informazioni sorgente XER vanno perse, anche se nel frattempo hai salvato il progetto come IFC. In IFC non si perde nulla.

**Cosa viene incluso** — la struttura WBS e le attività con durata, date, vincoli e avanzamento; relazioni con ritardo; calendari; risorse con assegnazioni; codici attività; campi personalizzati (UDF); note; le impostazioni di pianificazione di P6. Un'attività di tipo *Level of Effort* diventa un hammock. Un progetto di baseline diventa la baseline attiva del progetto che vi fa riferimento. Una relazione tra due progetti viene conservata dall'app come dato sorgente.

**Cosa non viene incluso** — un progetto senza attività, e una relazione tra due progetti come vera relazione nella tua pianificazione. Vedi [Aprire un file Primavera P6 (.xer)](docs://howto-xer-openen).

## CSV

**Apertura** — sì. L'app legge `;` e `,` come separatore. Riconosce le intestazioni di colonna in inglese e in olandese (per esempio `Name` o `Naam`, `Duration` o `Duur`, `Predecessors` o `Voorgangers`). Le date possono essere *aaaa-mm-gg*, *gg-mm-aaaa* o *gg/mm/aaaa*. Un predecessore lo scrivi come codice WBS, tipo di relazione e ritardo, per esempio `1.2FS+2d`. Profilo di calcolo: *Open Planner Studio*. Il progetto si chiama *CSV Import*. Un `Task Type` che non è uno dei codici fissi (come `CONSTRUCTION` o `INSTALLATION`, che l'app scrive da sola) diventa un tipo di attività personalizzato sotto *Da questo progetto*, non in *I miei tipi di attività*. Con `OPS Custom Task Type ID` viene conservato l'id di un tipo personalizzato.

**Salvataggio** — no.

**Esportazione** — sì, come *CSV (;)* (*Esportazione tabella universale. Tutte le attività con date e durate.*), sulla card *CSV (separato da punto e virgola)*. Il file usa il punto e virgola come separatore, è in UTF-8 con BOM e ha intestazioni di colonna in inglese.

**Cosa viene incluso** — per attività queste colonne: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` e `Description`. Il completamento è in percentuali intere.

**Cosa non viene incluso** — risorse, assegnazioni, calendari, vincoli, scadenze, baseline e la data di stato. Se le date sono nella vista *Date come registrate*, l'esportazione lascia vuote le colonne `Critical` e `Total Float` per le attività il cui file sorgente non lo registrava.

## Foglio di avanzamento (Excel e CSV)

**Apertura** — sì, tramite *File › Importa* (*Aggiorna l'avanzamento da un foglio*). Oppure tramite il pulsante con quel nome nel gruppo *Avanzamento* della barra multifunzione su *Pianificazione*, *Tabella* e *Rapporto*. L'app legge `.xlsx` e `.csv`, fino a 16 MB e 50.000 righe. Così non apri un progetto: aggiorni l'avanzamento del progetto aperto. Vedi [Importare l'avanzamento da un foglio](docs://howto-voortgang-importeren).

**Salvataggio** — no.

**Esportazione** — sì, come *Foglio di avanzamento (Excel)* (*Avanzamento (Excel)* nell'elenco) e *Foglio di avanzamento (CSV)* (*Avanzamento (CSV)*). Nome predefinito: *projectname-voortgang*. Il pulsante *Esporta foglio di avanzamento* nello stesso gruppo crea il foglio Excel con un clic. Il foglio Excel ha larghezze di colonna fisse, campi bloccati e controllo delle date. Il foglio CSV ha lo stesso contenuto come testo semplice.

**Cosa viene incluso** — le colonne `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` e `Actual Finish`. Quando lo leggi, l'app usa `Completion (%)`, `Actual Start` e `Actual Finish`. `Start` e `Finish` servono solo a riconoscere la notazione della data e non cambiano la tua pianificazione. L'app collega le righe alle attività tramite `OPS Task ID`, oppure tramite un codice WBS unico.

**Cosa non viene incluso** — tutto ciò che sta fuori da queste colonne: durata, relazioni, risorse e il resto della tua pianificazione. Un'attività di riepilogo non riceve avanzamento dal foglio.

## PDF

**Apertura** — no.

**Salvataggio** — no.

**Esportazione** — sì, da un report: nella scheda *Rapporto* il pulsante *Esporta PDF*. L'app non invia un report direttamente a una stampante. Per stampare su carta si usa il PDF. Il contenuto dipende dal tipo di report: vedi [Tipi di report](docs://ref-rapporttypes) e [Creare e stampare un report](docs://howto-rapport-maken-en-afdrukken).

## Vedi anche

- [File e formati](docs://uitleg-bestanden): perché IFC è il formato proprio dell'app e cosa perde un'esportazione, con un esempio.
- [Aprire e salvare un file](docs://howto-bestand-openen-en-opslaan): i passi.
- [Esportare](docs://howto-exporteren): scegliere un formato e i messaggi dopo un'esportazione.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): perché un file aperto può mostrare altre date.
- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): i profili di calcolo.
