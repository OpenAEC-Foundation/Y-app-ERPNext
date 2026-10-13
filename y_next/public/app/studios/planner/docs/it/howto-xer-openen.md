# Aprire un file Primavera P6 (.xer)

Obiettivo: aprire una pianificazione da Primavera P6 direttamente nell'app, senza prima esportarla in XML.

## Quando ti serve questo

Un cliente o un appaltatore principale lavora in Primavera e consegna la sua pianificazione come file `.xer`. Tu vuoi visualizzarla, calcolarla o aggiungere dati. L'app legge solo file `.xer`: non scrive `.xer` e non modifica mai il tuo file. Dal file prende la struttura WBS e le attività con durata, date, vincoli e avanzamento, le relazioni con ritardo, i calendari e le risorse con le loro assegnazioni, oltre a codici attività, campi personalizzati (UDF), note e le impostazioni di pianificazione di P6. Un'attività di tipo *Livello di sforzo* diventa un hammock.

## Passaggi

1. Scegli *Home › File › Apri* oppure premi Ctrl+O. Scegli il file `.xer`.
2. L'app apre una scheda per ogni progetto che ha attività. Il progetto con più attività è la scheda attiva. Una scheda si chiama *Nome progetto (ID progetto)* se l'ID del progetto P6 è diverso dal nome.
3. Leggi il messaggio in basso. Per un file con tre progetti può apparire così: *File XER aperto: 3 documenti di progetto.* Sotto ci sono righe che spiegano che cosa ha fatto l'app. Vedi il titolo qui sotto.
4. Controlla se sotto la barra multifunzione c'è un avviso con il messaggio: *Stai visualizzando la pianificazione come registrata da Primavera; un ricalcolo sposterebbe 1 attività.* Primavera registra nel file le proprie date calcolate. Se il calcolo dell'app differisce da queste, l'app mostra le date di Primavera finché non modifichi nulla. Che cosa significa e come passi al calcolo proprio dell'app è spiegato in [Date come registrate](docs://uitleg-datums-zoals-opgeslagen). Può comparire anche il messaggio *Questo file contiene una pianificazione oraria.* con il pulsante *Attiva pianificazione oraria*. Vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).
5. Salva il progetto con Ctrl+S. Un `.xer` non viene mai sovrascritto, quindi l'app chiede dove salvare il nuovo file IFC. Propone *Nome progetto (ID progetto)* come nome del file.

### Le righe sotto il messaggio

La prima riga del messaggio indica il numero di schede aperte. Sotto ci sono solo le righe che si applicano. Meritano la tua attenzione:

- *Questo progetto calcola come Primavera P6. Modificalo da File → Info progetto → Profilo di calcolo e opzioni.* L'app calcola questo progetto con le regole di calcolo di Primavera. Con *Apri profilo di calcolo* vai all'impostazione.
- *1 progetto di baseline escluso.* e *1 baseline materializzata.* Se un progetto in P6 designa un altro progetto come sua baseline, quest'ultimo non si apre come scheda propria. Diventa la baseline attiva del progetto che vi fa riferimento.
- *È stato usato un ripiego protettivo per la baseline.* Se la designazione delle baseline significherebbe che nessun progetto si apre, se un progetto fa riferimento a sé stesso o se i progetti fanno riferimento l'uno all'altro in un ciclo, l'app apre semplicemente tutti i progetti e non crea nessuna baseline.
- *1 relazione esterna conservata.* Una relazione tra due progetti. L'app la conserva come dato di origine, ma non la trasforma in una relazione nella tua pianificazione.
- *1 attività mostra le date come registrate da Primavera (non ricalcolate).* Il numero di attività che vedi nella vista *Date come registrate*.

Le altre righe sono diagnostiche della lettura stessa: il numero di progetti trovati, un progetto vuoto saltato, un riferimento a baseline non valido ignorato, una codifica del testo diversa dal semplice UTF-8 e contatori per i risultati nelle tabelle, nei calendari e nei numeri, per valori di campi sconosciuti e per impostazioni di pianificazione P6 che l'app ha sostituito con una scelta sicura. Non richiedono nulla da te. *Ulteriori informazioni* apre la Guida su come aprire i file Primavera.

## Possibili problemi e che cosa fa l'app

**Non tutto diventa una scheda o una relazione.** Un progetto senza attività non si apre, un progetto di baseline non si apre come scheda propria e una relazione tra due progetti non diventa una relazione nella tua pianificazione. L'app lo segnala nelle righe sotto il messaggio.

**Ogni scheda è un progetto a sé.** Se ne salvi una, il file IFC conserva anche l'intero `.xer` originale. Se in seguito riapri quel file IFC, l'app conosce ancora le date di Primavera. Se quell'archivio sorgente è danneggiato, oppure se un altro programma IFC ha riscritto il file, l'app segnala: *L'archivio sorgente XER di questo file è inutilizzabile ed è stato omesso; il progetto stesso è stato aperto per intero.* La pianificazione, il profilo di calcolo e tutti i dati del progetto sono completi. Manca: le date come le ha salvate Primavera e la provenienza di origine per l'AI e le estensioni. Riapri il `.xer` originale per recuperare l'archivio.

**Un'esportazione in CSV, MS Project XML o P6 XML perde dati.** L'app avvisa: *L’esportazione in CSV perde informazioni di origine XER.* IFC non perde nulla.

**Un file che l'app non può leggere.** Ottieni un messaggio di errore, con il motivo. Alcuni esempi:

- *Questo file XER non è valido o supportato.*
- *In una tabella XER mancano colonne obbligatorie.*
- *Il progetto P6 in questo file XER non contiene attività.*

In quel caso non si apre nulla. Controlla il file in P6 oppure chiedi al mittente una nuova esportazione.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): perché un `.xer` viene solo letto e che cosa perde un'esportazione.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): la vista delle date proprie di Primavera.
- [Aprire un file MS Project (.mpp)](docs://howto-mpp-openen): lo stesso per MS Project.
- [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten): se il file contiene dati in ore.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): per formato, che cosa viene trasferito e che cosa no.
- [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen): perché un file P6 si apre con un proprio profilo di calcolo.
