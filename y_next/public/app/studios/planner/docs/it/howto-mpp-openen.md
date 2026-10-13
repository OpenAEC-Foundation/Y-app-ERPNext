# Aprire un file di MS Project (.mpp)

Obiettivo: aprire una pianificazione di Microsoft Project direttamente nell'app, senza esportarla prima.

## Quando ti serve

Un appaltatore, un consulente o un cliente ti invia la sua pianificazione come file `.mpp`. Vuoi visualizzarla, calcolarla o svilupparla ulteriormente. L'app legge file `.mpp` da MS Project 2010 fino al 2021 incluso. Legge soltanto: non scrive file `.mpp` e non modifica mai il tuo file. Dal file prende la pianificazione stessa: attività con struttura, durata e vincoli, relazioni con ritardo, calendari, risorse, assegnazioni e avanzamento. Legge anche le date e i margini che MS Project ha calcolato da sé, ma li usa solo per la vista *Date come registrate*, mai come input.

## Passi

1. Scegli *Home › File › Apri* oppure premi Ctrl+O. Scegli il file `.mpp`.
2. Il progetto si apre in una nuova scheda, oppure nella scheda attuale se era ancora vuota e non modificata. Il progetto non ha un file: *Salva* scrive più tardi un nuovo file IFC.
3. Leggi il messaggio in basso: *Questo progetto calcola come Microsoft Project. Modificalo da File → Info progetto → Profilo di calcolo e opzioni.* L'app calcola questo progetto con le regole di calcolo di MS Project: il profilo di calcolo *Microsoft Project*. Con *Apri profilo di calcolo* vai all'impostazione; *Ulteriori informazioni* apre la Guida sui profili di calcolo.
4. Controlla se sotto la barra multifunzione c'è un messaggio: *Stai visualizzando le date come registrate nel file; un ricalcolo sposterebbe 4 attività.* Su quelle attività il risultato dell'app è diverso dalle date salvate da MS Project. Sotto il messaggio del passo 3 c'è poi anche una riga: *4 attività mostrano le date come registrate nel file (non ricalcolate).* Che cosa significa e come passi al calcolo proprio dell'app è descritto in [Date come registrate](docs://uitleg-datums-zoals-opgeslagen).
5. Se compare *Questo file contiene una pianificazione oraria.* con il pulsante *Attiva pianificazione oraria*, il file contiene dati in ore. Vedi [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten).

Se il file contiene attività con suddivisioni, livellamento o una pianificazione guidata dalle risorse, si aggiunge un altro messaggio, per esempio *Questo file di MS Project contiene 3 attività con una pianificazione suddivisa, livellata o guidata dalle risorse. Vengono importate e mostrate così come sono.* Per una sola attività il messaggio è al singolare.

## Punti di attenzione e cosa fa l'app in quel caso

**Non tutto viene importato.** L'app non prende in carico baseline, costi, tariffe, note e campi personalizzati di MS Project. Un codice WBS che hai compilato tu stesso in MS Project viene preso in carico; altrimenti l'app numera le attività in base alla struttura.

**Un file di MS Project 2007 o precedente.** L'app lo rifiuta e segnala: *Questo file .mpp utilizza un formato precedente (Project 2007 o versioni precedenti). Esportalo da MS Project come XML (File → Salva con nome → XML) e apri quel file.* Sotto il messaggio l'app aggiunge un motivo tecnico in inglese.

**Un file con password.** L'app segnala: *Questo file .mpp è protetto da password. Esportalo da MS Project come XML (File → Salva con nome → XML) e apri quel file.* Anche qui il messaggio è accompagnato da un motivo tecnico in inglese.

**Un file che non risulta essere un `.mpp`.** Compare il messaggio *Apertura del file non riuscita*, con un motivo tecnico.

**Il percorso XML calcola in modo diverso.** Se apri l'esportazione XML di MS Project invece del file `.mpp`, l'app calcola con il profilo di calcolo *Open Planner Studio* e non vedi il messaggio su *Microsoft Project*. Le date possono quindi risultare diverse da quelle del file `.mpp`.

**Una modifica fa perdere il controllo a MS Project.** Se modifichi un'attività la cui pianificazione era guidata dalla finestra di date di MS Project, l'app segnala una volta per progetto: *La distribuzione oraria di MS Project non guida più 2 attività dopo questa modifica; la distribuzione originale resta conservata nel file.* Per una sola attività il messaggio è al singolare.

**Salvare non sovrascrive mai il tuo `.mpp`.** Il progetto non ha un file. *Salva* chiede dove deve finire il nuovo file IFC.

## Vedi anche

- [File e formati](docs://uitleg-bestanden): perché un `.mpp` viene solo letto e che cosa scrive il salvataggio.
- [Date come registrate](docs://uitleg-datums-zoals-opgeslagen): la vista delle date proprie di MS Project.
- [Attivare la pianificazione oraria](docs://howto-urenplanning-aanzetten): se il file contiene dati in ore.
- [Aprire un file di Primavera P6 (.xer)](docs://howto-xer-openen): lo stesso per Primavera.
- [Formati di importazione ed esportazione](docs://ref-import-exportformaten): per formato, che cosa viene preso in carico e che cosa no.
- [Profili di calcolo e convenzioni](docs://uitleg-rekenprofielen): perché un file di MS Project si apre con il suo profilo di calcolo.
