# Collegare un assistente IA (MCP)

Obiettivo: far sì che un assistente IA legga con te la pianificazione e lavori su di essa, con visibilità su ciò che fa e con limiti che imposti tu.

## Quando ti serve

Vuoi che un assistente IA legga, analizzi o modifichi la tua pianificazione. Per esempio per fargli abbozzare una prima WBS, correggere attività o spiegare il percorso critico. Questo funziona tramite il **Model Context Protocol** (MCP): uno standard che permette a un assistente IA di usare gli strumenti di un programma. Per questo Open Planner Studio avvia un piccolo server sul tuo computer, il **bridge**. Offre una serie di strumenti, tutti con un nome che inizia con `planner_`: leggere e modificare attività, relazioni, risorse, calendari, baseline, documenti e file. Quali sono e che cosa rifiutano è descritto in [Strumenti IA](docs://ref-ai-tools); perché il collegamento funziona così è spiegato in [Come funziona il collegamento IA](docs://uitleg-ai-koppeling).

Il bridge funziona solo nell'app desktop. Se attivi la modalità IA nel browser, vedi la scheda *IA*, ma il pulsante *Avvia bridge* è grigio, con il testo *Il bridge funziona solo nell'app desktop.* Il resto di questo articolo riguarda l'app desktop. Nel browser sono grigi anche *Esegui backup ora* e *Apri cartella di backup*.

## Passi

### 1. Attiva la modalità IA

1. Scegli *Impostazioni › Progetto › Impostazioni*. Puoi anche scegliere *File › Impostazioni*, oppure l'ingranaggio in alto.
2. Scegli la scheda *Avanzate* e attiva *Abilita modalità IA*. Nella barra multifunzione compare la scheda *IA*.
3. Vuoi che il bridge sia attivo appena si avvia l'app? Allora attiva anche *Avvia il bridge automaticamente*. Questa opzione ha effetto solo se la modalità IA è attiva, e funziona solo nell'app desktop. È disattivata per impostazione predefinita, perché aprire una porta è una scelta consapevole.

Se disattivi la modalità IA, il bridge si arresta e la scheda *IA* scompare.

### 2. Avvia il bridge

1. Vai alla scheda *IA* e clicca *Avvia bridge* sotto *Server*.
2. Controlla lo stato accanto al pulsante. Dice *Disattivo*, *Attivo sulla porta 3877*, *Porta 3877 occupata* oppure *Errore*. Se l'avvio riesce, dice *Attivo sulla porta 3877* e il pulsante si chiama *Arresta bridge*. Con *Porta 3877 occupata* o *Errore* il pulsante resta *Avvia bridge*; vedi la sezione sui problemi possibili.

Il bridge ascolta solo sul tuo computer, su una porta. Per impostazione predefinita è la 3877. Nel gruppo *Connessione* puoi scegliere un'altra porta sotto *Porta*, ma solo mentre il bridge è arrestato.

### 3. Collega l'assistente

1. Clicca *Connetti* sotto *Connessione*. Si apre la finestra *Dettagli di connessione*.
2. Scegli ciò che serve al tuo client, vedi sotto.
3. Il token è nascosto. Con l'icona dell'occhio lo mostri. I pulsanti di copia copiano sempre il valore reale, anche se lo schermo nasconde il token.
4. Fai richiedere all'assistente l'elenco degli strumenti. Anche quel controllo è nel prompt di connessione: l'assistente deve vedere gli strumenti con il prefisso `planner_`; il numero previsto è nel prompt di connessione.

La finestra offre tre modi per collegarsi:

- *Frammento di configurazione*: un pezzo di configurazione che incolli nelle impostazioni MCP del tuo client.
- *Prompt di connessione*: un testo che incolli nel tuo assistente IA, dopo di che si collega da solo.
- *Endpoint* e *Autenticazione*: i dettagli separati. L'endpoint è `http://localhost:3877/mcp` con trasporto *streamable HTTP*. Ogni richiesta richiede un'intestazione `Authorization: Bearer` seguita dal tuo token.

Nel gruppo *Connessione* c'è anche il campo *Token*. È un codice lungo e casuale che l'app crea per te e salva su questo computer. Nella finestra c'è scritto *Questo token dà accesso al piano aperto. Non condividerlo con altri.* Con l'icona *Nuovo token* crei un nuovo token. L'app chiede prima *Generare un nuovo token interrompe tutte le connessioni esistenti. Continuare?* Se il bridge è in esecuzione, si riavvia con il nuovo token e quello vecchio non funziona più.

### 4. Controlla che cosa fa l'IA

1. Clicca *Pannello attività* sotto *Attività*. Nella colonna laterale si apre il pannello *Attività IA*.
2. Ogni chiamata del bridge è su una riga, la più recente in alto: ora, che cosa è successo, quanto tempo ha richiesto e se è riuscita o no. Clicca una riga per espandere *Argomenti* e *Risposta*.
3. Con *Cancella* svuoti l'elenco. Il pannello conserva le ultime 500 chiamate. Finché non è successo nulla, dice *Nessuna attività IA finora. Le chiamate del bridge appariranno qui.*

Con la modalità IA attiva, in basso a destra nella barra di stato c'è un punto con *IA*. Il suo colore mostra lo stato del bridge, e un clic su di esso ti porta alla scheda *IA*.

### 5. Imposta limiti

Sotto *Sicurezza* ci sono i pulsanti con cui limiti l'IA:

- *Metti in pausa*: l'IA non può cambiare nulla per un po'; la lettura resta permessa. Il bridge resta attivo. Il pulsante diventa *Riprendi*.
- *Sola lettura*: tutti gli strumenti che cambiano qualcosa vengono rifiutati finché questa opzione è attiva.
- *Backup automatico: attivo*: prima della prima modifica dell'IA in un documento, l'app scrive un backup IFC. Questa opzione è attiva per impostazione predefinita. Con il pulsante la disattivi, e allora dice *Backup automatico: disattivo*. Questo avviene una volta per documento ogni volta che avvii il bridge.
- *Esegui backup ora*: crea subito un backup del documento attivo. Dopo dice *Backup creato:* con il nome del file.
- *Apri cartella di backup*: apre la cartella con i backup.

I backup si trovano nella cartella `ai-backups` nella cartella dei dati dell'app. L'app conserva i backup recenti e sfoltisce quelli più vecchi; il modo esatto è descritto in [Strumenti IA](docs://ref-ai-tools).

### 6. Fai pianificare bene all'assistente

Anche un assistente che conosce gli strumenti può comunque costruire una pianificazione che nessun pianificatore userebbe: attività senza relazioni, una data fissa su ogni attività, oppure una scomposizione troppo fine. Per questo l'assistente riceve le regole di pianificazione in tre modi. Per i primi due non devi fare nulla.

1. **Le regole principali arrivano da sole.** Quando ti colleghi, il bridge invia un breve testo con le regole principali. Molti client inseriscono quel testo nel prompt di sistema; se il tuo lo faccia dipende dal client. Tra l'altro dice: parti dalle attività cardine, costruisci attività di circa un giorno fino a due settimane, guida la pianificazione con le relazioni invece che con date fisse, e alla fine dice quali ipotesi ha fatto.
2. **Il prompt di connessione rimanda alla guida completa.** Il prompt di connessione nella finestra *Dettagli di connessione* chiede all'assistente di leggere per prima la guida alla pianificazione, con lo strumento `planner_get_planning_guide`. Questo restituisce una guida in inglese per gli assistenti: gli stessi principi di [Pianificare bene](docs://gids-goed-plannen), e per ogni principio gli strumenti che l'assistente usa per applicarlo. Puoi leggerla tu stesso su `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Se non usi il prompt, chiedi tu stesso all'assistente: *Leggi con planner_get_planning_guide la guida alla pianificazione, prima di cambiare qualcosa.*
3. **Facoltativo: le skill.** Una skill è un piccolo file di istruzioni che un assistente legge a ogni sessione, così che in una conversazione successiva conosce anche il modo giusto di lavorare. Ce ne sono due, entrambe in inglese: *goed-plannen* per impostare o ristrutturare una pianificazione, e *progress-update* per l'aggiornamento settimanale dell'avanzamento. Questo funziona solo con un assistente che supporta le skill; le skill stesse menzionano Claude Code e assistenti simili. Ogni skill è un file `SKILL.md` nella propria cartella, con il nome della skill: `.claude/skills/goed-plannen/SKILL.md` e `.claude/skills/progress-update/SKILL.md` nella cartella del progetto in cui lavora l'assistente, oppure le stesse cartelle sotto `~/.claude/skills/` per averle in ogni progetto.

Le skill le ottieni in due modi. Chiedi all'assistente di chiamare lo strumento `planner_get_planning_guide` con `part` impostato su `skill`: la risposta contiene entrambi i testi e, per ogni skill, i punti in cui va. Oppure scaricale da `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` e `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Se *goed-plannen* è ancora presente da una versione precedente dell'app, sostituiscilo: quel vecchio testo è in olandese e rimanda all'articolo di aiuto invece che alla guida per gli assistenti.

Se l'assistente ha davvero letto la guida, lo vedi nel *Pannello attività*: compare allora una chiamata di `planner_get_planning_guide`. La risposta finale dovrebbe contenere un elenco di ipotesi: durate stimate, la scomposizione scelta, le relazioni che ha creato da sé e ogni vincolo che ha impostato. Se quell'elenco manca, chiedilo. Dopo un aggiornamento dell'avanzamento secondo *progress-update*, la risposta dovrebbe indicare la data di stato, la nuova data di fine e lo scostamento rispetto alla baseline.

## Problemi possibili e cosa fa l'app allora

**L'IA cambia qualcosa che vuoi annullare.** Ogni modifica dell'IA è un passo che annulli con *Annulla* (Ctrl+Z). Una serie di modifiche che l'IA passa come un unico blocco è un solo passo. Dopo, il progetto viene mostrato come non salvato. Dopo una modifica il ricalcolo della pianificazione parte di nuovo da solo, quindi non devi premere F5 tu stesso.

**L'app rifiuta una chiamata dell'IA.** Con *Metti in pausa* e *Sola lettura* l'app rifiuta tutte le modifiche; la lettura resta possibile, incluso il ricalcolo di una pianificazione non aggiornata. Se stai facendo tu una modifica, per esempio trascinando una barra o scrivendo in un campo, l'IA riceve le date di prima della tua modifica, con un avviso che sono non aggiornate. Se hai una finestra di dialogo aperta, per esempio le impostazioni, la finestra di un'attività o la finestra di benvenuto, oppure se la modalità presentazione è attiva, l'app rifiuta tutte le chiamate, anche la lettura, finché non chiudi la finestra. L'IA riceve allora un messaggio di errore con il nome interno di ciò che è aperto, per esempio `showTaskDialog`. Solo `planner_get_planning_guide` continua a funzionare, perché non legge la tua pianificazione.

**Cambi scheda mentre l'IA lavora.** L'IA lavora sul documento in cui è andata la sua prima modifica. Se nel frattempo cambi scheda, l'app rifiuta la sua modifica successiva finché non conferma che vuole lavorare sull'altra scheda. Così nulla finisce nel progetto sbagliato.

**L'IA scrive o apre un file.** L'IA può scrivere una pianificazione come file IFC e aprire un file di pianificazione in una nuova scheda. Può farlo solo nella tua cartella utente. Sovrascrive un file esistente solo se lo chiede esplicitamente.

**Lo stato è *Porta 3877 occupata*.** Un altro programma usa la porta. Il messaggio dell'app è mostrato sotto lo stato. Il campo porta resta allora bloccato (*Modificabile solo mentre il server è arrestato.*), anche se il bridge non è in esecuzione, e non c'è un pulsante di arresto. Questa è una limitazione nota. Finché non è corretta: disattiva e riattiva *Abilita modalità IA*. Lo stato torna poi a *Disattivo* e puoi scegliere un'altra porta. Copia poi di nuovo i dettagli di connessione, perché l'endpoint contiene la porta.

**Il client non si collega dopo un nuovo token.** Un nuovo token interrompe tutte le connessioni esistenti. Dai al client il nuovo token, oppure incolla di nuovo il frammento di configurazione.

**Hai arrestato tu il bridge e non si avvia da solo.** *Avvia il bridge automaticamente* funziona una volta ogni volta che l'app si avvia. Se arresti tu il bridge, l'app non lo riattiva in silenzio.

**La scheda *IA* è scomparsa.** La modalità IA è disattivata. Attivala nel passo 1.

**Una pagina web nel tuo browser non può comunicare con il bridge.** Il bridge rifiuta ogni richiesta che arriva da un browser, e ogni richiesta senza il token giusto.

## Vedi anche

- [Dare feedback](docs://howto-feedback-geven): se il collegamento funziona in modo diverso da come è descritto qui, segnalalo.
- [Come funziona il collegamento IA](docs://uitleg-ai-koppeling): che cos'è il collegamento, perché l'assistente lavora nel tuo progetto aperto e che cosa non può fare.
- [Strumenti IA](docs://ref-ai-tools): tutti gli strumenti `planner_*` per gruppo, i codici di errore e per quanto tempo si conservano i backup.
- [Pianificare bene](docs://gids-goed-plannen): i principi di pianificazione; l'assistente li riceve in una versione inglese con gli strumenti aggiunti.
- [Impostazioni](docs://ref-instellingen): le impostazioni IA.
