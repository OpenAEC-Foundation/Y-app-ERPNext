# Tracciare un percorso

Obiettivo: rendere visibile la catena di attività prima o dopo un'attività, così vedi cosa determina la data di un'attività e cosa si sposta se slitta.

## Quando ti serve

La copertura inizia solo tra tre settimane e vuoi sapere quale attività la determina. Oppure il muratore slitta di una settimana e vuoi vedere quali attività dopo di lui si spostano. In una pianificazione con decine di relazioni non lo puoi vedere dalle linee. Con **tracciamento percorso** l'app colora tutti i **predecessori** (attività che vengono prima dell'attività scelta, direttamente o tramite altre attività) e i **successori** (attività che vengono dopo di essa) e attenua le altre.

## Passaggi

1. Seleziona l'attività di cui vuoi vedere il percorso, nella tabella attività o sulla sua barra nel diagramma Gantt. Se selezioni più attività, l'app traccia il percorso a partire dall'attività selezionata per prima.
2. Scegli *Pianificazione › Tracciamento percorso › Predecessori* per tutto ciò che viene prima dell'attività, oppure *Pianificazione › Tracciamento percorso › Successori* per tutto ciò che viene dopo di essa. Entrambi i pulsanti possono essere attivi allo stesso tempo. Gli stessi due pulsanti si trovano nella scheda *Tabella*, nel gruppo *Tracciamento percorso*.
3. Se vuoi le due direzioni insieme, fai clic destro sull'attività, nel diagramma Gantt o nella tabella attività, e scegli *Traccia percorso*.
4. Guarda il risultato nel diagramma Gantt e nella tabella attività. Come leggerlo è spiegato qui sotto.
5. Ti fermi facendo clic di nuovo sul pulsante attivo, facendo clic destro su un'attività e scegliendo *Interrompi tracciamento*, oppure con Esc. Esc cancella anche la selezione.

Se selezioni un'altra attività durante il tracciamento, il percorso segue la nuova selezione.

## Come leggere il risultato

- I predecessori sono dorati, i successori viola. Nel diagramma Gantt le barre cambiano colore. Nella tabella attività compare una striscia a sinistra della riga: continua per i predecessori, tratteggiata per i successori. L'attività scelta ha un contorno.
- Un colore più scuro segnala la catena di relazioni determinanti: le relazioni che fissano davvero le date. Nella tabella attività è una striscia più spessa con testo in grassetto. Cosa significa è spiegato in [Relazioni e ritardo](docs://uitleg-relaties).
- Tutte le attività fuori dal percorso sono attenuate. Le linee di relazione che non appartengono al percorso sono più chiare e punteggiate.

## Errori comuni e cosa fa l'app

**Nessuna attività selezionata.** Senza un'attività selezionata non c'è nulla da tracciare: il pulsante è attivo, ma sullo schermo non cambia nulla. Seleziona prima un'attività.

**Nessuna evidenza sulla catena di relazioni determinanti.** L'evidenza deriva dall'ultimo calcolo. Se la pianificazione non è ancora calcolata, o il calcolo dà un errore, l'app colora tutti i predecessori e i successori con la stessa intensità. Premi *Calcola* (F5), per esempio tramite *Home › Pianificazione › Calcola*, e guarda di nuovo il percorso. Dopo una modifica l'evidenza resta quella del calcolo precedente, finché la barra di stato mostra *Non aggiornato — ricalcola (F5)*.

**Una relazione su una fase.** Il tracciamento segue le relazioni come le hai impostate. Una relazione da o verso una fase (attività di riepilogo) collega la fase stessa. Per il calcolo vale per ogni attività di quella fase, ma il percorso non prosegue nelle attività al suo interno. Se tracci un'attività dentro una fase che è legata a un'altra attività da una relazione sulla fase stessa, quindi non vedi quella relazione. In quel caso seleziona la fase stessa.

**Solo la direzione scelta.** Se è attivo solo *Predecessori*, non vedi cosa viene dopo l'attività, e viceversa.

## Vedi anche

- [Relazioni e ritardo](docs://uitleg-relaties): perché una relazione determinante fissa una data e come l'app calcola la data di inizio di un'attività.
- [Percorso critico e margine](docs://uitleg-kritiek-pad): quale catena fissa la data di fine del progetto.
- [Aggiungere relazioni](docs://howto-relaties-leggen): aggiungi una relazione se ti manca un collegamento nel percorso.
