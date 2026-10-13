# Begrensninger og tidsfrister

Murstein leveres først 21. juni. Tillatelsen er ikke kommet inn ennå. Taket må være lukket før byggferien. Avhengigheter viser at én aktivitet venter på en annen. Avtaler om en dato følger likevel ikke av rekkefølgen i arbeidet. Begrensninger og tidsfrister er til for det. I denne artikkelen leser du hva hver type gjør. Du leser når en aktivitet flytter seg, og når bare slakken endrer seg. Du leser hva en hard fastlåsing er, og hvordan appen melder en konflikt.

Reglene og eksemplene gjelder for et nytt prosjekt, med beregningsprofilen *Open Planner Studio* og en arbeidsuke fra mandag til fredag.

## Begrepet

En **begrensning** er en datogrense for én enkelt aktivitet, uavhengig av avhengighetene. En slik grense kan virke på to måter:

- Den **skyver**: aktiviteten får ikke starte eller slutte tidligere enn datoen. Ville aktiviteten ellers starte tidligere på grunn av avhengighetene, flytter den seg til datoen.
- Den **vokter**: aktiviteten må starte eller slutte senest på datoen. Appen flytter ingenting. Hvis tidsplanen ikke treffer datoen, blir **slakken** til aktiviteten, og til kjeden før den, negativ. Slakk er rommet en aktivitet har før sluttdatoen for prosjektet flytter seg. Negativ slakk betyr at du på papiret allerede er forsinket (se [Kritisk linje og slakk](docs://uitleg-kritiek-pad)).

En **tidsfrist** er en enklere vokter: en måldato for slutten av en aktivitet, uten at aktiviteten flyttes av noe.

Alle begrensninger er **myke**: beregningen går videre selv om en dato ikke blir oppfylt. Det finnes ett unntak, den **harde fastlåsingen**, som overstyrer avhengighetene. Mer om det nedenfor.

## Hvordan appen beregner

### De åtte typene

Du velger typen under *Begrensning* i panelet *Egenskaper*. Slik beregnes hver type:

- *Så tidlig som mulig (ASAP)*: ingen grense. Dette er standard: aktiviteten starter så snart avhengighetene tillater det.
- *Så sent som mulig (ALAP)*: aktiviteten flyttes så sent den kan, uten at en etterfølger må starte senere. Den bruker derfor opp sin frie slakk. Har den fortsatt totalslakk etterpå, fordi etterfølgerne selv har rom, blir den ikke kritisk. Er også den brukt opp, telles den som kritisk.
- *Start ikke tidligere enn (SNET)*: en nedre grense for starten. Ville aktiviteten starte tidligere, flyttes den til datoen. Er datoen tidligere enn det avhengighetene tillater, gjør begrensningen ingenting.
- *Slutt ikke tidligere enn (FNET)*: det samme, men for slutten av aktiviteten.
- *Start ikke senere enn (SNLT)* og *Slutt ikke senere enn (FNLT)*: en øvre grense for starten eller slutten. De flytter ingenting. Blir ikke grensen overholdt, melder appen en brutt begrensning, og slakken blir negativ.
- *Må starte på (MSO)* og *Må slutte på (MFO)*: en nedre og en øvre grense samtidig. Aktiviteten flyttes til datoen hvis den er senere enn avhengighetene krever. Er datoen tidligere enn det avhengighetene tillater, blir aktiviteten stående der avhengighetene plasserer den, og slakken blir negativ.

Faller en dato på en lørdag, søndag eller fridag, leser appen den som en arbeidsdag: en nedre grense (SNET, FNET) som neste arbeidsdag, en øvre grense (SNLT, FNLT) som forrige.

### Hva negativ slakk betyr

En øvre grense virker baklengs. Er den seneste datoen fra begrensningen for en aktivitet tidligere enn den tidligste datoen, blir totalslakken negativ. Det gjelder også for aktivitetene før den. Må murarbeidet starte senest fredag 11. juni og kan det ikke starte før mandag 14. juni, er også aktivitetene før murarbeidet én arbeidsdag forsinket. Alle aktiviteter med negativ slakk er kritiske. Hvordan det virker, forklares i [Kritisk linje og slakk](docs://uitleg-kritiek-pad).

Stolpene flytter seg ikke på grunn av en øvre grense. Du ser konflikten i den negative *Totalslakk*, i en rød diamant over stolpen, i meldingen i statuslinjen (for eksempel *1 begrensning(er) brutt*) og i panelet *Advarsler*.

### Den harde fastlåsingen

Ved MSO og MFO vises avkrysningsboksen *Obligatorisk (fastlåsing)*. Med den avkrysningen låser du aktiviteten på datoen, også hvis forgjengerne ikke er ferdige da. Avhengighetene blir overstyrt:

- Aktiviteten ligger på datoen (med MSO starter den der, med MFO slutter den der) og overlapper med forgjengerne.
- Forgjengerne får negativ slakk. Appen melder en brutt begrensning så snart avhengighetene ville la aktiviteten starte senere enn fastlåsingen. Den fastlåste aktiviteten selv beholder 0 i slakk.
- Etterfølgerne beregnes ut fra den fastlåste aktiviteten. De kan derfor starte tidligere enn uten fastlåsingen, selv om logikken før den ikke er ferdig. I eksemplet under flytter slutten av prosjektet seg tre arbeidsdager fremover på grunn av det.

Første gang du slår på fastlåsingen, viser appen en kort forklaring: en hard fastlåsing overstyrer avhengighetene, stolpen er låst på datoen, også før forgjengerne.

### Den sekundære begrensningen

En aktivitet har én primær begrensning. Vil du også ha en ekstra grense, for eksempel for en aktivitet som ikke må starte før 14. juni og må være ferdig innen 17. juni, legger du til en **sekundær begrensning**. Den må være en reell grense (SNET, FNET, SNLT eller FNLT). Den må også begrense i motsatt retning av den primære: en nedre grense (SNET eller FNET) med en øvre grense (SNLT eller FNLT). SNET med SNLT er derfor tillatt, SNET med FNET er ikke det. Appen markerer andre kombinasjoner i rødt med årsaken, for eksempel *Primær og sekundær begrensning kan ikke begrense samme side.* Med ASAP, ALAP, MSO, MFO og en hard fastlåsing er en sekundær begrensning ikke tillatt.

### Tidsfristen

En tidsfrist er en egen dato på en aktivitet, ved siden av begrensningen. Den er en øvre grense for slutten: den flytter ingenting, men gjør slakken negativ hvis aktiviteten ikke er ferdig i tide. Appen melder da i panelet *Advarsler* *Tidsfrist … ikke overholdt — tidligste slutt …*, og statuslinjen teller tidsfristene som ikke er overholdt. I Gantt-diagrammet står det en pil nedover på tidsfristdatoen: grønn så lenge aktiviteten er ferdig i tide, rød så snart den er forsinket. En tidsfrist på en lørdag telles til og med fredagen før.

For slakken gjør en tidsfrist det samme som FNLT. Forskjellen ligger i hvordan du bruker den. En tidsfrist er en måldato du vil vokte. Den står for seg selv ved siden av begrensningen, så en aktivitet kan ha både en begrensning og en tidsfrist. FNLT er en begrensning: et brudd vises som en brutt begrensning i stedet for som en tidsfrist som ikke er overholdt.

### Hva en begrensning ikke gjør

- På en **fase** (hovedaktivitet) telles en begrensning eller tidsfrist ikke: appen beregner med aktivitetene i fasen. Sett den på aktiviteten selv.
- En aktivitet som allerede har en faktisk start eller fremdrift, beholder den starten. En SNET med en senere dato flytter den ikke.
- **Å skrive inn en startdato** på en aktivitet med en forgjenger fungerer ikke som en fast start: forgjengeren bestemmer fortsatt. Derfor gjør appen den om til en SNET på datoen du skrev inn: i panelet *Egenskaper*, i *Rediger aktivitet*, i tabellen og når du flytter stolpen i Gantt-diagrammet. Appen sier fra om det. Har aktiviteten allerede en annen begrensning (for eksempel ALAP eller MSO), bruker appen ikke den nye starten og sier også fra om det. Endre da den begrensningen.

Alle endringer vises først etter **Beregn** (F5).

## Utregnet eksempel

Eksemplet er et lite nettverk av aktiviteter for et tilbygg til et hus. Det starter mandag 7. juni 2027:

- *Groundwork* (3 arbeidsdager): mandag 7. til onsdag 9. juni.
- *Pour foundation* (2): torsdag 10. og fredag 11. juni.
- *Brickwork* (5): mandag 14. til fredag 18. juni.
- *Roofing* (3): mandag 21. til onsdag 23. juni.
- *Scaffolding* (2): følger *Pour foundation* og kommer før *Roofing*. Den går mandag 14. og tirsdag 15. juni og har 3 arbeidsdager i slakk.

Den kritiske linjen er *Groundwork*, *Pour foundation*, *Brickwork* og *Roofing*. Prosjektet er ferdig onsdag 23. juni. Hva endrer seg med én begrensning på *Brickwork*?

- **SNET mandag 21. juni** (murstein leveres først da): *Brickwork* går fra mandag 21. til fredag 25. juni, og *Roofing* fra mandag 28. til onsdag 30. juni. Prosjektet er ferdig onsdag 30. juni. *Groundwork* og *Pour foundation* har nå 5 arbeidsdager i slakk og er ikke lenger kritiske. *Scaffolding* har 8.
- **SNET onsdag 9. juni**: ingen effekt. Avhengighetene lar *Brickwork* uansett bare starte mandag 14. juni.
- **SNLT onsdag 16. juni**: ingen effekt. *Brickwork* starter mandag 14. juni og holder grensen med god margin.
- **SNLT fredag 11. juni**: for stramt. *Brickwork* starter likevel mandag 14. juni, én arbeidsdag for sent. *Groundwork*, *Pour foundation* og *Brickwork* får −1 arbeidsdag i slakk, og appen melder *Begrensning Start ikke senere enn (SNLT) 11-06-2027 overstyres av logikken (negativ slakk)*. Ingenting flytter seg.
- **MSO onsdag 16. juni** (uten hard fastlåsing): *Brickwork* flytter seg til onsdag 16. juni og er ferdig tirsdag 22. juni. *Roofing* går fra onsdag 23. til fredag 25. juni, og prosjektet er ferdig fredag 25. juni.
- **MSO fredag 11. juni** (uten hard fastlåsing): datoen er tidligere enn det avhengighetene tillater. *Brickwork* starter likevel mandag 14. juni, og slakken blir −1, akkurat som med SNLT.
- **MSO onsdag 9. juni med hard fastlåsing**: *Brickwork* starter onsdag 9. juni og er ferdig tirsdag 15. juni, mens *Pour foundation* fortsatt går til fredag 11. juni. *Roofing* går fra onsdag 16. til fredag 18. juni: prosjektet er ferdig tre arbeidsdager tidligere enn uten fastlåsingen. *Groundwork* og *Pour foundation* får −3 arbeidsdager i slakk.

Og med en begrensning eller tidsfrist på en annen aktivitet:

- **ALAP på** *Scaffolding*: aktiviteten flyttes til torsdag 17. og fredag 18. juni, det seneste moment før *Roofing*. *Roofing* er den eneste etterfølgeren, og den hadde plass til akkurat sine 3 arbeidsdager i slakk. Den slakken er nå brukt opp, og *Scaffolding* er kritisk.
- **SNET lørdag 19. juni på** *Scaffolding*: grensen telles som mandag 21. juni. *Scaffolding* går mandag 21. og tirsdag 22. juni, og *Roofing* flytter med til onsdag 23. til fredag 25. juni.
- **Tidsfrist fredag 18. juni på** *Roofing*: ingenting flytter seg, og *Roofing* blir stående mandag 21. til onsdag 23. juni. *Groundwork*, *Pour foundation*, *Brickwork* og *Roofing* får −3 arbeidsdager i slakk, og appen melder *Tidsfrist 18-06-2027 ikke overholdt — tidligste slutt 23-06-2027*. *Scaffolding* beholder 0 arbeidsdager i slakk og blir også kritisk.
- **SNET mandag 21. juni på** *Brickwork*, **tidsfrist fredag 25. juni på** *Roofing*: begrensningen skyver brickwork en uke tilbake, og tidsfristen melder at *Roofing* er forsinket og blir ferdig onsdag 30. juni. *Brickwork* og *Roofing* får −3 arbeidsdager i slakk. *Groundwork* og *Pour foundation* beholder 2 arbeidsdager.

I opplæring 3 setter du selv en begrensning og en tidsfrist i opplæringsprosjektet, og du ser hvordan tidsplanen flytter seg.

## Konsekvenser og misforståelser

**«En begrensning flytter aktiviteten.»** Bare SNET, FNET, MSO og MFO kan sette en aktivitet senere enn avhengighetene gjør. ALAP kan flytte den senere innenfor den frie slakken. SNLT og FNLT flytter aldri noe: de varsler bare. Å nå datoen betyr da at du må forkorte kjeden før den.

**«Negativ slakk er en feil i appen.»** Det er signalet om at tidsplanen strider mot datoavtalen din. Du løser det ved å forkorte kjeden, å lempe på avtalen, eller bevisst godta konflikten.

**«En hard fastlåsing løser konflikten.»** En hard fastlåsing skjuler konflikten: aktiviteten ligger på datoen, men forgjengerne er ikke klare for den, og etterfølgerne beregnes som om de var det. Bruk den bare for en dato som virkelig er fast, for eksempel en juridisk overleveringsdato, og ikke som en måte å få en aktivitet på en bestemt dato.

**«Jeg skriver bare inn en startdato.»** Med en aktivitet som har en forgjenger, blir det en SNET. Er den datoen tidligere enn det forgjengeren tillater, gjør den ingenting.

**«Tidsfrist eller FNLT?»** Velg en tidsfrist for en måldato du vil vokte, og en begrensning for en dato som virkelig er en grensebetingelse for tidsplanen.

**«En begrensning på fasen.»** Det telles ikke. Sett den på aktiviteten selv.

## Se også

- [Sette en begrensning eller tidsfrist](docs://howto-constraint-deadline-zetten): stegene for å sette en begrensning eller tidsfrist.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): avhengighetene som begrensninger står ved siden av.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan negativ slakk oppstår, og hva den gjør med den kritiske linjen.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): en hard fastlåsing (*Må starte på (MSO)*) på *Municipal road closure (permitted closure period)* og en sekundær begrensning (*Start ikke senere enn (SNLT)*) på *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): en tidsfrist som ikke er overholdt, med negativ slakk.
