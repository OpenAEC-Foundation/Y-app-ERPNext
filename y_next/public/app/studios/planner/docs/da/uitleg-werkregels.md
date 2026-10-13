# Arbejdsregler: varighed, tildelingsenheder og arbejde

Du sætter én pudser på pudsearbejdet, og opgaven tager fire dage. Hvis du tilføjer en anden pudser, kan arbejdet blive gjort på to dage. Den kan også blive ved fire dage, med dobbelt så meget arbejde i. Begge dele giver mening. Hvilken af de to appen vælger, afhænger af opgavens **arbejdsregel**. I denne artikel læser du, hvordan appen binder varighed, tildelingsenheder og arbejde sammen, og hvad hver arbejdsregel holder konstant.

## Begrebet

Tre størrelser hænger sammen:

- **Varighed**: hvor lang tid opgaven varer, i arbejdsdage eller i timer.
- **Tildelingsenheder**: hvor meget af en ressource der arbejder på opgaven pr. arbejdsdag. I appen kaldes det *Tild.enh./dag*. Tildelingsenheder på 1 er én pudser hele dagen, 2 er to af dem, og 0,5 er en halv dag.
- **Arbejde**: det samlede antal timer, ressourcen bruger på opgaven.

Summen er: arbejde = varighed × tildelingsenheder × arbejdstimer pr. arbejdsdag. Arbejdstimerne pr. arbejdsdag kommer fra opgavens kalender. Pudsearbejde på fire arbejdsdage med én pudser er, med en arbejdsdag på 8 timer, 4 × 1 × 8 = 32 timers arbejde.

Hvis du ændrer en af de tre, skal mindst en af de to andre bevæge sig med, ellers går summen ikke op. Arbejdsreglen bestemmer hvilken. Du stiller den pr. opgave i panelet *Egenskaber*. Appen viser arbejdsreglen og arbejdet først, når du slår dem til. Hvordan det virker, står i [Vælg en arbejdsregel](docs://howto-werkregel-kiezen).

En arbejdsregel virker kun på almindelige opgaver. Milepæle, faser (hovedopgaver), hængekøjer og opgaver, hvor *Varighedstype* er *Forløbet varighed*, har ingen arbejdsregel; feltet *Arbejdsregel* findes der ikke. Materialer, for eksempel beton eller pudsmørtel, tæller heller ikke med. Mængden materiale styrer aldrig varigheden, og appen tilpasser den aldrig på grund af en arbejdsregel.

## Sådan regner appen

### Reglen virker på det du ændrer

Appen genberegner varighed, tildelingsenheder og arbejde kun på det tidspunkt, hvor du ændrer en af dem: opgavens varighed, tildelingsenhederne, arbejdet, en ressource der tilføjes eller fjernes, eller timerne pr. dag i en kalender. **Beregn** (F5) ændrer ingen af dem: F5 regner kun datoerne ud. At vælge en regel ændrer heller ikke et eneste tal. Reglen tæller ved din næste ændring.

Hvis en arbejdsregel ændrer opgavens varighed, bliver tidsplanen forældet. Statuslinjen siger så *Forældet — genberegn (F5)*, medmindre *Beregn automatisk* er slået til.

### Fire regler

I panelet *Egenskaber* viser appen under rullelisten, hvad den valgte regel beskytter. De fire regler, med appens egen tekst:

- **Fast varighed og faste enheder** (*Beskyttet: varighed og tildelingsenheder (arbejde følger)*). Dette er standard. Appen ændrer aldrig selve varigheden, og arbejdet følger af varighed og enheder. Hvis du selv skriver arbejdet, tilpasser appen enhederne, fordi varigheden er fast.
- **Fast varighed og fast arbejde** (*Beskyttet: varighed og arbejde (enheder følger)*). Appen ændrer aldrig selve varigheden. Hvis du ændrer varigheden, bliver arbejdet, og enhederne tilpasses.
- **Fast arbejde** (*Beskyttet: arbejde (varighed følger enheder)*). Arbejdet er fast, og varigheden følger af arbejde og enheder.
- **Faste enheder** (*Beskyttet: tildelingsenheder (varighed følger arbejde)*). Enhederne er faste, og varigheden følger af arbejdet.

Så to regler lader varigheden være. Med de to andre flytter varigheden sig, når du ændrer enhederne, arbejdet eller antallet af ressourcer. Med én ressource gør Fast arbejde og Faste enheder præcis det samme dér. De adskiller sig, når du selv ændrer varigheden: med Fast arbejde bliver arbejdet, og enhederne tilpasses; med Faste enheder bliver enhederne, og arbejdet vokser med. De adskiller sig også, når der er flere ressourcer på opgaven (se nedenfor).

De gennemregnede eksempler nedenfor viser, hvad hver regel gør.

### Afrunding

Varigheden, der følger af summen, runder appen op. For en opgave i dage rundes op til hele arbejdsdage, for en opgave i timer til hele minutter. Arbejde og tildelingsenheder bliver som du har indtastet, eller som appen har hentet fra summen. Derfor går summen nogle gange ikke helt op. Eksemplet nedenfor viser, hvad der sker da.

### Flere ressourcer

Hvis en opgave har flere ressourcer, gælder der to principper. Med Fast varighed og fast arbejde, Fast arbejde og Faste enheder bliver det samlede arbejde det samme, når du tilføjer eller fjerner en ressource. Appen fordeler det så i forhold til enhederne. Med Fast varighed og faste enheder bringer en ny ressource i stedet sit eget arbejde med. Med Fast arbejde og Faste enheder afgør den langsomste ressource varigheden: pr. ressource er det arbejde divideret med enhederne, og det største resultat tæller.

Et eksempel: to ressourcer har hver 32 timers arbejde og enheder på 1, i alt 4 arbejdsdage. Du sætter enhederne for den første til 0,5. Varigheden bliver så 8 arbejdsdage. Under Fast arbejde beholder den anden ressource sine 32 timers arbejde, og dens enheder falder til 0,5. Under Faste enheder beholder den anden sine enheder på 1, og arbejdet vokser til 64 timer.

### Fremdrift

Hvis opgaven allerede har fremdrift, virker reglen på den resterende del: den resterende varighed og det resterende arbejde. I appen kaldes arbejdet *Arbejde (rest.)*. Det, der allerede er udført, bliver, som det er.

### Timeopgaver

En timeopgave regnes på samme måde, men i minutter. Hvis kun kranen er tildelt en opgave på 5 timer, er det 5 timers arbejde. Under Fast arbejde bliver varigheden for 2 enheder så 2,5 timer. Hulkernedækket i øvelsesprojektet har også tømrerholdet tildelt. Det kræver stadig 5 timers arbejde, er det langsomste, og varigheden bliver derfor 5 timer. Hvordan timer og dage hænger sammen, forklares i [Dage og timer](docs://uitleg-dagen-en-uren).

## Gennemregnet eksempel: pudsearbejdet

Eksemplet er øvelsesprojektet *House extension* fra selvstudierne. I selvstudium 5 regner du det selv ud og kontrollerer tallene. Her læser du, hvad hver regel gør.

Pudsearbejdet tager 4 arbejdsdage. Én pudser er tildelt det med tildelingsenheder på 1, og arbejdsdagen er 8 timer. Arbejdet er altså 32 timer.

### Fast varighed og faste enheder

- Du sætter varigheden til 6 arbejdsdage: arbejdet vokser til 48 timer, og enhederne forbliver 1.
- Du sætter enhederne til 2: varigheden forbliver 4 arbejdsdage, og arbejdet bliver 64 timer.
- Du skriver 48 timer i *Arbejde (rest.)*: varigheden forbliver 4 arbejdsdage, og enhederne bliver 1,5.
- Du tildeler en anden ressource, for eksempel *Plasterer 2*, med tildelingsenheder på 1: varigheden forbliver 4 arbejdsdage, og den anden bringer 32 timers arbejde med, 64 timer i alt.

### Fast varighed og fast arbejde

- Du sætter varigheden til 6 arbejdsdage: arbejdet forbliver 32 timer, og enhederne falder til 0,67.
- Du sætter enhederne til 2: varigheden forbliver 4 arbejdsdage. Fordi varigheden er fast, vokser arbejdet med til 64 timer.
- Du skriver 16 timer i *Arbejde (rest.)*: varigheden forbliver 4 arbejdsdage, og enhederne bliver 0,5.
- Du tildeler en anden ressource, for eksempel *Plasterer 2*, med tildelingsenheder på 1: de 32 timer deles, 16 timer hver, og enhederne bliver 0,5 for begge. Varigheden forbliver 4 arbejdsdage.

### Fast arbejde

- Du sætter varigheden til 6 arbejdsdage: arbejdet forbliver 32 timer, og enhederne falder til 0,67.
- Du sætter enhederne til 2: arbejdet forbliver 32 timer, og varigheden bliver 2 arbejdsdage. Det er det trin, du tager i selvstudium 5.
- Du skriver 48 timer i *Arbejde (rest.)*: enhederne forbliver 1, og varigheden bliver 6 arbejdsdage.
- Du tildeler en anden ressource, for eksempel *Plasterer 2*, med tildelingsenheder på 1: de 32 timer deles, 16 timer hver, og varigheden bliver 2 arbejdsdage. Fjerner du den anden ressource igen, er varigheden igen 4 arbejdsdage.

### Faste enheder

- Du sætter varigheden til 6 arbejdsdage: enhederne forbliver 1, og arbejdet vokser til 48 timer.
- Du sætter enhederne til 2: arbejdet forbliver 32 timer, og varigheden bliver 2 arbejdsdage.
- Du skriver 48 timer i *Arbejde (rest.)*: enhederne forbliver 1, og varigheden bliver 6 arbejdsdage.
- Du tildeler en anden ressource, for eksempel *Plasterer 2*, med tildelingsenheder på 1: de 32 timer deles, 16 timer hver, og varigheden bliver 2 arbejdsdage.

### Når summen ikke går op

Under Fast arbejde sætter du enhederne til 3. Arbejdet er 32 timer, så varigheden bliver 32 ÷ (3 × 8) = 1,33 arbejdsdage. Appen runder op til 2 arbejdsdage. Arbejde (32 timer) og tildelingsenheder (3) bliver, men 2 × 3 × 8 er 48 timer. Histogrammet fordeler derfor de 32 timer over de 2 arbejdsdage: 2 tildelingsenheder pr. dag, ikke 3. Ved siden af *Arbejde (rest.)* vises et advarselstegn, *Afviger fra tildelingsenheder × varighed*, for at vise det.

Med to ressourcer med forskellige tildelingsenheder virker det på samme måde. Hvis du under Fast arbejde tilføjer en anden ressource, for eksempel *Plasterer 2*, med tildelingsenheder på 2 til pudseren med tildelingsenheder på 1, deler appen de 32 timer i forholdet 1 : 2, altså 10,7 og 21,3 timer. Begge har så brug for 1,33 arbejdsdage. Varigheden bliver 2 arbejdsdage.

### En anden kalender

Under Fast arbejde går kalenderens arbejdsdag fra 8 til 6 timer. Arbejdet forbliver 32 timer, så varigheden bliver 32 ÷ 6 = 5,33, rundet op til 6 arbejdsdage. Hvordan appen tæller arbejdsdage og arbejdstimer, forklares i [Kalendere og arbejdsdage](docs://uitleg-kalenders). Appen melder: *Efter ændringen af kalenderen har arbejdsreglen tilpasset varigheden af 1 opgave (arbejdet bliver, timer pr. dag ændrede sig).*

### En opgave med fremdrift

Det indre hulmursblad tager 5 arbejdsdage og er 40 % udført: 2 arbejdsdage er udført, og 3 arbejdsdage (24 timer) er tilbage. Under Fast arbejde sætter du tildelingsenhederne fra 1 til 2. Det resterende arbejde forbliver 24 timer, og den resterende varighed bliver 1,5, rundet op til 2 arbejdsdage. Opgaven tager nu 2 + 2 = 4 arbejdsdage, og fremdriften er 50 %. Procenten bevæger sig med, fordi den del, der er udført, forbliver den samme, og resten bliver kortere.

## Konsekvenser og misforståelser

**"Fast arbejde betyder, at varigheden er fast."** Nej, det er netop det modsatte. Med *Fast varighed og faste enheder* og *Fast varighed og fast arbejde* er varigheden fast. Med *Fast arbejde* og *Faste enheder* følger varigheden af de to andre.

**"Hvis jeg vælger en regel, ændrer min tidsplan sig."** Nej. Valget ændrer ikke et eneste tal. Først ved din næste ændring bestemmer reglen, hvad der flytter med. Under en regel, der beskytter arbejdet, låser appen arbejdet på det tidspunkt, du vælger, så der er et tal at beskytte. En sådan opgave har så et gemt *Arbejde (rest.)*.

**"Varigheden ændrede sig, uden at jeg rørte den."** Det kan ske efter en ændring af tildelingsenhederne, arbejdet, antallet af ressourcer eller timerne pr. dag, under Fast arbejde eller Faste enheder. Statuslinjen melder så, at tidsplanen er forældet. Tryk på **Beregn** (F5) for at se de nye datoer.

**Uden en tildeling gør en arbejdsregel ingenting.** Der er så ingen tildelingsenheder og intet arbejde at knytte til varigheden.

**Filer fra MS Project eller Primavera P6 viser altid arbejdsreglen.** For en opgave fra MS Project står teksten *Fra MS Project: indsatsbaseret* eller *Fra MS Project: ikke indsatsbaseret* af og til under reglen. Den gemte indstilling ændrer to tilfælde. Med *Fast varighed og fast arbejde* og indsatsbaseret går arbejdet med, når du ændrer varigheden, i stedet for enhederne. Med *Faste enheder* og ikke indsatsbaseret går arbejdet med, når du tilføjer eller fjerner en ressource, og varigheden forbliver. Opgaver, du opretter i appen, har ikke denne indstilling.

## Se også

- [Vælg en arbejdsregel](docs://howto-werkregel-kiezen): trinene for at stille arbejdsreglen for en opgave.
- [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen): at sætte en ressource på en opgave, med tildelingsenheder og fordeling.
- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen omregner dage og timer.
- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvordan appen tæller arbejdsdage og arbejdstimer.
