# Nuovo progetto e Info progetto

I campi della finestra *Nuovo progetto* e di *Info progetto*: che cosa fa ogni campo, qual è il valore predefinito e dove ha effetto. Sono due lati dello stesso modulo. *Nuovo progetto* crea un nuovo progetto e ha qualche campo in più. *Info progetto* modifica il progetto che hai aperto.

## Apertura

**Nuovo progetto** — *File › Nuovo*, Ctrl+N, oppure il segno più a destra delle schede dei documenti (*Avvia un progetto*, poi *Nuovo progetto*). La finestra si apre con il cursore in *Nome del progetto*.

**Info progetto** — *Impostazioni › Progetto › Info progetto* apre il modulo come finestra intitolata *Informazioni sul progetto*. *File › Info progetto* mostra lo stesso modulo nella schermata *File*. Il blocco *Profilo di calcolo e opzioni* si trova in fondo in entrambi i casi; che cosa contiene è descritto in [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).

## Crea, Applica e chiudi senza salvare

**Crea** (in *Nuovo progetto*) crea il progetto e lo apre in una scheda propria. **Applica** (in *Info progetto*) scrive le tue modifiche nel progetto.

- **Solo con Applica.** Tu scrivi in una bozza. Il progetto cambia solo quando fai clic su *Applica*. *Applica* scrive solo ciò che hai cambiato davvero, in un unico passo in *Annulla*. Se fai clic su *Applica* senza cambiare nulla, non succede niente e non si aggiunge nessun passo.
- **Chiudi senza salvare, la X ed Esc** chiudono la finestra senza salvare nulla. Un clic accanto alla finestra non la chiude: quello che avevi scritto resta.
- **Invio** fa lo stesso di *Crea* o *Applica*, tranne nel campo *Descrizione* e in un menu a discesa aperto.
- **Nella schermata File**, *Info progetto* mostra in fondo *Modifiche non applicate: fai clic su Applica per conservarle.* finché la bozza è diversa dal progetto. Se poi lasci la schermata, l'app chiede se vuoi applicare, scartare o chiudere senza salvare. Vedi [La barra multifunzione, scheda per scheda](docs://ref-lint).
- **Un profilo di calcolo personalizzato senza nome** blocca *Applica* e *Crea*. Dagli un nome, oppure scarta la modifica.

## Campi in entrambe le finestre

**Nome del progetto** — il nome del progetto nella barra del titolo, sulla scheda e nel nome del file quando salvi. Predefinito: vuoto. Un campo vuoto è ammesso: il progetto si chiama allora *Nuova pianificazione*, mostrato come testo grigio nel campo. Dove: in tutta la schermata.

**Descrizione** — testo libero. Predefinito: vuoto. Effetto: viene salvata con il progetto, nel file IFC e nell'esportazione verso Primavera P6 XML, e non influisce sulla pianificazione.

**Autore** — testo libero. Predefinito: vuoto. Effetto: finisce nel file IFC e compare come *Autore:* nell'intestazione di un report, dove non puoi riscriverlo.

**Libreria di risorse** — a quale libreria di risorse è collegato il progetto. Scegli tra *nessuna (progetto autonomo)*, le tue librerie esistenti e *+ Nuova libreria di risorse*…. Predefinito: in *Nuovo progetto* la libreria predefinita, in *Info progetto* il collegamento attuale. Effetto: vedi [Usare la libreria di risorse](docs://howto-resourcebibliotheek-gebruiken). Con *+ Nuova libreria di risorse*… scrivi un nome in un campo sotto; la libreria si crea solo con *Crea* o *Applica*, quindi chiudendo senza salvare non resta nulla. Un collegamento in *Info progetto* cambia solo se tocchi tu stesso questo campo.

**Cliente/organizzazione** — testo libero. Predefinito: vuoto. Effetto: finisce nel file IFC e compare come *Azienda:* nell'intestazione di un report.

**Data di inizio** — l'inizio del progetto. Predefinito: in *Nuovo progetto* oggi. Che cosa fa il campo è spiegato più sotto, in *Che cosa fa la data di inizio*.

**Data di fine** — la fine prevista del progetto. Predefinito: vuoto. Effetto: è un'informazione, non un requisito: l'app non pianifica verso questa data. Compare nell'intestazione di un report e nelle esportazioni, e determina fino a quale anno vengono generate le festività. Solo per un file Primavera con l'impostazione *Calcola il margine fino alla data di fine progetto* (vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies)) il calcolo del margine arriva fino a questa data.

**Unità predefinita per le nuove attività** — visibile solo quando *Attiva pianificazione oraria* è attiva. Scegli tra *Giorni* e *Ore*. Predefinito: *Giorni*. Effetto e condizioni: vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).

**Profilo di calcolo e opzioni** — in *Info progetto* l'intero blocco; in *Nuovo progetto* solo il menu a discesa *Profilo di calcolo* con *Primavera P6*, *Microsoft Project* e *Open Planner Studio*. Predefinito: *Open Planner Studio*. Quando scegli un profilo, si impostano anche le opzioni predefinite di quel profilo. Vedi [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies).

## Solo nella finestra Nuovo progetto

**Modello di fasi** — quali fasi ha il progetto all'inizio. Scegli tra *Vuoto*, *Edilizia residenziale* e *Edilizia non residenziale / ristrutturazione*. Predefinito: *Vuoto*. Effetto: *Vuoto* crea un progetto senza attività. Gli altri due inseriscono già otto attività di fase, ciascuna con una durata di 5 nell'unità predefinita del progetto (5 giorni lavorativi, oppure 5 ore se scegli *Ore* sotto *Unità predefinita per le nuove attività*) e senza relazioni; le rinomini, sposti ed estendi tu stesso. Per *Edilizia residenziale* sono: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking e Oplevering. Per *Edilizia non residenziale / ristrutturazione*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen e Oplevering. I nomi sono dati del tuo progetto e restano in olandese, anche con un'altra lingua dell'interfaccia. Se *Attiva la modalità cantiere* è disattivata, esiste solo *Vuoto*. Vedi [Impostazioni](docs://ref-instellingen).

**Turno** — visibile solo quando *Attiva pianificazione oraria* è attiva. Scegli tra *Turno diurno*, *2 turni*, *3 turni* e *24/7*. Predefinito: *Turno diurno*. Effetto: *Turno diurno* lascia il calendario standard com'è, un normale calendario giornaliero dal lunedì al venerdì. Gli altri tre inseriscono fasce orarie nel calendario del progetto, come i pulsanti con lo stesso nome nella finestra *Calendari*. Quali siano questi orari, lo trovi in [Impostare gli orari di lavoro](docs://howto-werktijden-instellen). Con *Turno diurno* non puoi scegliere *Ore* sotto *Unità predefinita per le nuove attività*, perché un calendario giornaliero non ha fasce orarie.

**Set di festività** — quali giorni liberi ha il calendario del progetto. Per *Paese* scegli *Paesi Bassi* (predefinito), *Germania*, *Belgio*, *Francia*, *Regno Unito*, *Austria*, *Svizzera*, *Nessuna festività* oppure *Personalizzato*…. Se il paese ha regioni, si aggiunge un menu a discesa *Regione*. Per i Paesi Bassi scegli anche, se *Attiva la modalità cantiere* è attiva, le *Ferie edili*: *Nessuna* (predefinito), *Nord*, *Centro* o *Sud*. Sotto c'è una riga come *36 festività, 2025–2029*, che apri per vedere l'elenco. Gli anni vanno dall'anno prima della data di inizio all'anno dopo la data di fine, oppure fino a tre anni dopo l'anno di inizio se non c'è una data di fine. *Personalizzato*… crea un calendario senza festività e apre subito dopo la creazione la finestra *Calendari*, così puoi compilarle tu stesso. Il calendario del progetto si chiama *Bouwkalender NL*, oppure *Standaardkalender* se *Attiva la modalità cantiere* è disattivata; la scelta è allora anche *Nessuna festività*. Come funziona il generatore è descritto in [Generare festività e ferie edili](docs://howto-feestdagen-genereren).

## Che cosa fa la data di inizio

La data di inizio è il punto di riferimento del progetto. Tre regole:

- **Le nuove attività iniziano alla data di inizio.** Un'attività che aggiungi riceve come inizio pianificato l'inizio del progetto.
- **Un'attività con un predecessore non inizia mai prima della data di inizio.** Se la fine del predecessore è prima, l'attività aspetta fino alla data di inizio. Un'attività *senza* predecessore mantiene la propria data, anche se questa è prima della data di inizio. Questo serve per mostrare una pianificazione da MS Project o Primavera nello stesso modo in cui la mostra il programma di origine. Un vincolo *Deve iniziare il (MSO)* o *Deve finire il (MFO)* infrange entrambe le regole: un'attività del genere resta sulla sua data, anche se questa cade prima della data di inizio.
- **Una data di inizio più tardi sposta le attività libere.** Se imposti la data di inizio più tardi in *Info progetto* e fai clic su *Applica*, le attività senza predecessore e senza un vincolo che fissa un limite inferiore (*Iniziare non prima del (SNET)*, *Deve iniziare il*, *Finire non prima del* o *Deve finire il*) che cadrebbero prima della nuova data si spostano a quella data, in un unico passo in *Annulla*. L'app dice quante attività sono state spostate. Questo succede solo quando cambi tu la data di inizio, mai quando apri un file. Impostare una data di inizio più tardi non sposta il resto della pianificazione: lo fa *Sposta progetto*, vedi [Spostare un progetto](docs://howto-project-verplaatsen).

## Vedi anche

- [Opzioni di calcolo e convenzioni](docs://ref-rekenopties-en-conventies): il blocco *Profilo di calcolo e opzioni*.
- [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen): perché un profilo cambia il risultato.
- [Spostare un progetto](docs://howto-project-verplaatsen): tutta la pianificazione su un'altra data di inizio.
- [Aggiungere attività e cardini](docs://howto-taken-en-mijlpalen-toevoegen): iniziare con le prime attività.
- [Generare festività e ferie edili](docs://howto-feestdagen-genereren): il set di festività in dettaglio.
