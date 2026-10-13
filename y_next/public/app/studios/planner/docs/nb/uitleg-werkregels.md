# Arbeidsregler: varighet, tildelingsenheter og arbeid

Du setter én pusser på plastering, og aktiviteten tar fire arbeidsdager. Hvis du legger til en ekstra pusser, kan arbeidet gjøres på to dager. Det kan også bli fire dager, med dobbelt så mye arbeid i. Begge gir mening. Hvilken av de to appen velger, avhenger av aktivitetens **arbeidsregel**. I denne artikkelen leser du hvordan appen henger varighet, tildelingsenheter og arbeid sammen, og hva hver arbeidsregel holder konstant.

## Begrepet

Tre størrelser henger sammen:

- **Varighet**: hvor lang tid aktiviteten tar, i arbeidsdager eller i timer.
- **Tildelingsenheter**: hvor mye av en ressurs som arbeider på aktiviteten per arbeidsdag. I appen heter dette *Enh./dag*. Enheter på 1 betyr én pusser hele dagen, 2 betyr to av dem og 0,5 betyr en halv dag.
- **Arbeid**: det totale antallet timer ressursen bruker på aktiviteten.

Summen er: arbeid = varighet × tildelingsenheter × timer per arbeidsdag. Timer per arbeidsdag hentes fra aktivitetens kalender. Plastering i fire arbeidsdager med én pusser er, med en arbeidsdag på 8 timer, 4 × 1 × 8 = 32 timer arbeid.

Hvis du endrer én av de tre, må minst én av de andre flytte seg med. Ellers stemmer ikke summen lenger. Arbeidsregelen bestemmer hvilken. Du setter den per aktivitet, i panelet *Egenskaper*. Appen viser arbeidsregelen og arbeidet først når du slår dem på. Hvordan det fungerer, står i [Velge en arbeidsregel](docs://howto-werkregel-kiezen).

En arbeidsregel virker bare på vanlige aktiviteter. Milepæler, faser (hovedaktiviteter), hengekøyer og aktiviteter der *Varighetstype* er *Forløpt tid* har ingen. Da finnes feltet *Arbeidsregel* ikke. Materiale, for eksempel betong eller pussmørtel, teller heller ikke. Mengden materiale styrer aldri varigheten, og appen justerer den aldri på grunn av en arbeidsregel.

## Slik beregner appen

### Regelen virker på det du endrer

Appen omberegner varighet, tildelingsenheter og arbeid bare når du endrer én av dem: varigheten til aktiviteten, enhetene på en tilordning, arbeidet, en ressurs som legges til eller fjernes, eller timer per dag i en kalender. **Beregne** (F5) endrer ingen av dem: F5 beregner bare datoene. Å velge en regel endrer heller ikke ett eneste tall. Regelen gjelder ved din neste endring.

Hvis en arbeidsregel endrer varigheten til aktiviteten, blir tidsplanen utdatert. Statuslinjen viser da *Utdatert — omberegn (F5)*, med mindre *Beregne automatisk* er på.

### Fire regler

I panelet *Egenskaper*, under rullegardinlisten, viser appen hva den valgte regelen beskytter. De fire reglene, med appens egen tekst:

- **Fast varighet og faste tildelingsenheter** (*Beskyttet: varighet og tildelingsenheter (arbeidet følger)*). Dette er standard. Appen endrer aldri varigheten selv, og arbeidet følger av varighet og enheter. Hvis du skriver inn arbeidet selv, justerer appen enhetene, fordi varigheten er fast.
- **Fast varighet og fast arbeid** (*Beskyttet: varighet og arbeid (enhetene følger)*). Appen endrer aldri varigheten selv. Hvis du endrer varigheten, består arbeidet, og enhetene justeres.
- **Fast arbeid** (*Beskyttet: arbeid (varigheten følger enhetene)*). Arbeidet er fast, og varigheten følger av arbeid og enheter.
- **Faste enheter** (*Beskyttet: enheter (varigheten følger arbeidet)*). Enhetene er faste, og varigheten følger av arbeidet.

Så to regler lar varigheten være i fred. Med de to andre flytter varigheten seg når du endrer enhetene, arbeidet eller antall ressurser. Med én ressurs gjør fast arbeid og faste enheter akkurat det samme. De skiller seg når du endrer varigheten selv: med fast arbeid består arbeidet, og enhetene justeres. Med faste enheter består enhetene, og arbeidet vokser med. De skiller seg også når det er flere ressurser på aktiviteten (se under).

Eksemplene under viser hva hver regel gjør.

### Avrunding

Appen runder opp varigheten som følger av summen. For en aktivitet i dager er det hele arbeidsdager, for en aktivitet i timer er det hele minutter. Arbeid og enheter blir stående slik du skrev dem inn, eller slik appen fikk dem fra summen. Derfor stemmer summen av og til ikke helt. Eksemplet under viser hva som skjer da.

### Flere ressurser

Har en aktivitet flere ressurser, gjelder to avtaler. Med fast varighet og fast arbeid, og med fast arbeid og faste enheter, blir totalt arbeid det samme når du legger til eller fjerner en ressurs. Appen deler det da i forhold til enhetene. Med fast varighet og faste enheter gir en ny ressurs i stedet sitt eget arbeid. Med fast arbeid og faste enheter avgjør den tregeste ressursen varigheten: per ressurs er det arbeid delt på enheter, og det største resultatet gjelder.

Et eksempel: to ressurser har hver 32 timer arbeid og enheter på 1, til sammen 4 arbeidsdager. Du setter enhetene til den første til 0,5. Varigheten blir da 8 arbeidsdager. Med fast arbeid beholder den andre ressursen sine 32 timer arbeid, og enhetene går ned til 0,5. Med faste enheter beholder den andre sine enheter på 1, og arbeidet vokser til 64 timer.

### Fremdrift

Har aktiviteten allerede fremdrift, virker regelen på den resterende delen: den gjenstående varigheten og det gjenstående arbeidet. I appen heter dette arbeidet *Arbeid (gjenst.)*. Det som er gjort, blir stående.

### Timebaserte aktiviteter

En aktivitet du planlegger i timer, beregnes på samme måte, men i minutter. Hvis bare kranen er tilordnet en aktivitet på 5 timer, er det 5 timer arbeid. Med fast arbeid blir varigheten 2,5 timer når enhetene er 2. Hollow-core floor i øvingsprosjektet har også carpentry crew tilordnet. Den trenger fortsatt 5 timer arbeid, er den tregeste, og varigheten blir derfor 5 timer. Hvordan timer og dager henger sammen, forklares i [Dager og timer](docs://uitleg-dagen-en-uren).

## Regnet eksempel: plastering

Eksemplet er øvingsprosjektet *House extension* fra opplæringene. I opplæring 5 regner du dette ut selv og sjekker tallene. Her leser du hva hver regel gjør.

Plastering tar 4 arbeidsdager. Én pusser er tilordnet, med tildelingsenheter på 1, og arbeidsdagen er 8 timer. Arbeidet er dermed 32 timer.

### Fast varighet og faste tildelingsenheter

- Du gjør varigheten til 6 arbeidsdager: arbeidet vokser til 48 timer, enhetene forblir 1.
- Du setter enhetene til 2: varigheten forblir 4 arbeidsdager, arbeidet blir 64 timer.
- Du skriver 48 timer i *Arbeid (gjenst.)*: varigheten forblir 4 arbeidsdager, enhetene blir 1,5.
- Du tilordner en andre ressurs, for eksempel *Plasterer 2*, med enheter på 1: varigheten forblir 4 arbeidsdager, og den andre gir 32 timer arbeid, til sammen 64 timer.

### Fast varighet og fast arbeid

- Du gjør varigheten til 6 arbeidsdager: arbeidet forblir 32 timer, enhetene blir 0.67.
- Du setter enhetene til 2: varigheten forblir 4 arbeidsdager. Fordi varigheten er fast, vokser arbeidet med til 64 timer.
- Du skriver 16 timer i *Arbeid (gjenst.)*: varigheten forblir 4 arbeidsdager, enhetene blir 0,5.
- Du tilordner en andre ressurs, for eksempel *Plasterer 2*, med enheter på 1: de 32 timene deles, 16 timer hver, og enhetene blir 0,5 for begge. Varigheten forblir 4 arbeidsdager.

### Fast arbeid

- Du gjør varigheten til 6 arbeidsdager: arbeidet forblir 32 timer, enhetene blir 0.67.
- Du setter enhetene til 2: arbeidet forblir 32 timer, og varigheten blir 2 arbeidsdager. Dette er steget du tar i opplæring 5.
- Du skriver 48 timer i *Arbeid (gjenst.)*: enhetene forblir 1, og varigheten blir 6 arbeidsdager.
- Du tilordner en andre ressurs, for eksempel *Plasterer 2*, med enheter på 1: de 32 timene deles, 16 timer hver, og varigheten blir 2 arbeidsdager. Fjerner du den andre ressursen igjen, blir varigheten 4 arbeidsdager igjen.

### Faste enheter

- Du gjør varigheten til 6 arbeidsdager: enhetene forblir 1, arbeidet vokser til 48 timer.
- Du setter enhetene til 2: arbeidet forblir 32 timer, og varigheten blir 2 arbeidsdager.
- Du skriver 48 timer i *Arbeid (gjenst.)*: enhetene forblir 1, og varigheten blir 6 arbeidsdager.
- Du tilordner en andre ressurs, for eksempel *Plasterer 2*, med enheter på 1: de 32 timene deles, 16 timer hver, og varigheten blir 2 arbeidsdager.

### Når summen ikke stemmer

Med fast arbeid setter du enhetene til 3. Arbeidet er 32 timer, så varigheten blir 32 ÷ (3 × 8) = 1,33 arbeidsdager. Appen runder det opp til 2 arbeidsdager. Arbeidet (32 timer) og enhetene (3) blir stående, men 2 × 3 × 8 er 48 timer. Histogrammet fordeler derfor de 32 timene over de 2 arbeidsdagene: 2 enheter per dag, ikke 3. Ved siden av *Arbeid (gjenst.)* vises et varseltegn, *Avviker fra tildelingsenheter × varighet*, for å vise dette.

Med to ressurser med ulike enheter fungerer det på samme måte. Hvis du under fast arbeid legger til en andre ressurs, for eksempel *Plasterer 2*, med enheter på 2 til pusseren med enheter på 1, deler appen de 32 timene i forholdet 1 : 2, altså 10,7 og 21,3 timer. Begge trenger da 1,33 arbeidsdager. Varigheten blir 2 arbeidsdager.

### En annen kalender

Med fast arbeid endres arbeidsdagen i kalenderen fra 8 til 6 timer. Arbeidet forblir 32 timer, så varigheten blir 32 ÷ 6 = 5,33, avrundet opp til 6 arbeidsdager. Hvordan appen teller arbeidsdager og arbeidstimer, forklares i [Kalendere og arbeidsdager](docs://uitleg-kalenders). Appen melder: *Etter kalenderendringen har arbeidsregelen justert varigheten til 1 aktivitet (arbeidet består, timer per dag er endret).*

### En aktivitet med fremdrift

Inner cavity leaf tar 5 arbeidsdager og er 40% ferdig: 2 arbeidsdager er gjort, og 3 arbeidsdager (24 timer) gjenstår. Med fast arbeid setter du enhetene fra 1 til 2. Det gjenstående arbeidet forblir 24 timer, og den gjenstående varigheten blir 1,5, avrundet opp til 2 arbeidsdager. Aktiviteten tar nå 2 + 2 = 4 arbeidsdager, og fremdriften er 50%. Prosenten følger med, fordi den delen som er gjort, blir den samme, og resten blir kortere.

## Konsekvenser og misforståelser

**«Fast arbeid betyr at varigheten er fast.»** Nei, nesten tvert imot. Med *Fast varighet og faste tildelingsenheter* og *Fast varighet og fast arbeid* er varigheten fast. Med *Fast arbeid* og *Faste enheter* følger varigheten av de to andre.

**«Hvis jeg velger en regel, endrer tidsplanen seg.»** Nei. Å velge endrer ikke ett tall. Først ved din neste endring bestemmer regelen hva som følger med. Under en regel som beskytter arbeidet, låser appen arbeidet i det øyeblikket du velger, så det finnes et tall å beskytte. En slik aktivitet har da et lagret *Arbeid (gjenst.)*.

**«Varigheten endret seg uten at jeg rørte den.»** Det kan skje etter en endring av enhetene, arbeidet, antallet ressurser eller timer per dag, med fast arbeid eller faste enheter. Statuslinjen sier da at tidsplanen er utdatert. Trykk **Beregne** (F5) for å se de nye datoene.

**Uten en tilordning gjør en arbeidsregel ingenting.** Da finnes det ingen enheter og intet arbeid å knytte til varigheten.

**Filer fra MS Project eller Primavera P6 viser alltid arbeidsregelen.** For en aktivitet fra MS Project vises av og til teksten *Fra MS Project: innsatsdrevet* eller *Fra MS Project: ikke innsatsdrevet* under regelen. Den lagrede innstillingen endrer to situasjoner. Med *Fast varighet og fast arbeid* og innsatsdrevet følger arbeidet med når du endrer varigheten, i stedet for enhetene. Med *Faste enheter* og ikke innsatsdrevet følger arbeidet med når du legger til eller fjerner en ressurs, og varigheten blir stående. Aktiviteter du lager i appen, har ikke denne innstillingen.

## Se også

- [Velge en arbeidsregel](docs://howto-werkregel-kiezen): stegene for å sette arbeidsregelen til en aktivitet.
- [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen): sette en ressurs på en aktivitet, med tildelingsenheter og fordeling.
- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen omregner dager og timer.
- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvordan appen teller arbeidsdager og arbeidstimer.
