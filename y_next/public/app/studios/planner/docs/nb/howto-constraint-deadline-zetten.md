# Sette en begrensning eller tidsfrist

Mål: registrer en datoavtale på en aktivitet, slik at tidsplanen tar den med i betraktning eller viser at du ikke holder den.

## Når du trenger dette

Murstein leveres først 21. juni, så murarbeidet kan ikke starte tidligere: en **begrensning** *Start ikke tidligere enn*. Taket må være lukket før byggehelligdagen, og du vil få beskjed hvis det ikke går: en **tidsfrist**. Støpingen er fastsatt til en bestemt dag fordi betongverket har lovet det: *Må starte på*. Hvilken type som passer når, og hva appen gjør med den, forklares i [Begrensninger og tidsfrister](docs://uitleg-constraints).

## Steg

Du setter en begrensning og en tidsfrist i panelet *Egenskaper*.

1. Velg aktiviteten. Ser du ikke panelet *Egenskaper*, slår du det på med *Visning › Paneler › Egenskaper*.
2. Under *Begrensning* velger du typen, for eksempel *Start ikke tidligere enn (SNET)*.
3. Med alle typer unntatt *Så tidlig som mulig (ASAP)* og *Så sent som mulig (ALAP)* vises feltet *Begrensningsdato*. Skriv datoen i de tre boksene for dag, måned og år, for eksempel 21, 06 og 2027, og trykk på Enter. Appen hopper selv til neste boks så snart en boks er full. Etter at du har valgt typen, står det allerede en dato der: datoen for den forrige begrensningen, ellers den opprinnelige planlagte starten for aktiviteten. Den kan avvike fra starten som panelet viser, så skriv alltid inn datoen du mener selv.
4. Vil du låse aktiviteten til datoen, også før forgjengerne, velger du *Må starte på (MSO)* eller *Må slutte på (MFO)* og setter hake i *Obligatorisk (fastlåsing)*. Dette er en hard fastlåsing; bruk den bare for en dato som virkelig er fast.
5. Vil du også ha en ekstra grense, for eksempel en aktivitet som ikke må starte før 14. juni og må slutte senest 17. juni, velger du en type under *Sekundær begrensning* og fyller ut *Sekundær dato*. Dette feltet vises ved alle begrensninger som har en dato, unntatt ved en hard fastlåsing. Med MSO og MFO er en sekundær begrensning ikke tillatt: appen merker den da med rødt.
6. For en tidsfrist fyller du ut feltet *Tidsfrist* på samme måte som for begrensningsdatoen. En tidsfrist er uavhengig av begrensningen: du kan sette begge på samme aktivitet.
7. Trykk på **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Til da viser statuslinjen *Utdatert — omberegn (F5)*.

Feltene finnes også i vinduet *Rediger aktivitet*. Du åpner det ved å høyreklikke på aktiviteten og velge *Rediger...*; du bekrefter med *Lagre*.

I tabellen jobber du med kolonner. Klikk på **+** i tabelloverskriften, og velg under *Begrensninger* kolonnene *Begrensningstype*, *Begrensningsdato* og *Tidsfrist* (det finnes også *Hard begrensning*, *Sekundær begrensningstype* og *Dato for sekundær begrensning*). Dobbeltklikk på en celle for å redigere den: du velger typen fra en liste, og du skriver inn en dato med bindestreker, for eksempel 21-06-2027. *Hard begrensning* kan bare endres for MSO og MFO.

Har aktiviteten en forgjenger, finnes det en snarvei for *Start ikke tidligere enn*: skriv bare en ny startdato i feltet *Start* (i panelet *Egenskaper*, i *Rediger aktivitet* eller i tabellen), eller flytt stolpen i Gantt-diagrammet. Appen gjør den da selv til en begrensning *Start ikke tidligere enn (SNET)* og gir deg beskjed om det.

## Kontroller resultatet

- I Gantt-diagrammet står det en liten rombe over stolpen, på startsiden for en startbegrensning og på sluttsiden for en sluttbegrensning: blå for SNET og FNET, lilla for SNLT, FNLT, MSO og MFO, rød hvis begrensningen er brutt. En hard fastlåsing har en låsnål. En tidsfrist er en pil nedover på tidsfristdatoen: grønn så lenge aktiviteten er ferdig i tide, rød hvis den er for sen.
- En brutt begrensning eller en oversittet tidsfrist vises i panelet *Advarsler* (*Tidsplan › Tidsplan › Advarsler*) og i statuslinjen. Totalslakken for aktiviteten og for aktivitetene før den er da negativ.
- Ved en øvre grense (*Start ikke senere enn*, *Slutt ikke senere enn*) eller en tidsfrist betyr fravær av advarsel at tidsplanen holder datoen.

## Fjerne en begrensning eller tidsfrist

Under *Begrensning* velger du *Så tidlig som mulig (ASAP)* igjen. Da fjernes også den sekundære begrensningen. Du fjerner en tidsfrist ved å tømme de tre boksene og trykke på Enter. Trykk deretter på **Beregn**.

## Fallgruver og hva appen gjør

**En begrensning på en fase.** En begrensning eller tidsfrist på en fase (hovedaktivitet) har ingen effekt. Legg den på selve aktiviteten.

**En aktivitet som allerede er startet.** Har aktiviteten en faktisk start eller fremdrift, beholder den den faktiske starten. En *Start ikke tidligere enn* med en senere dato flytter den ikke.

**Skrive inn en startdato ved siden av en annen begrensning.** Har aktiviteten en forgjenger og allerede en annen begrensning, for eksempel *Så sent som mulig (ALAP)*, bruker appen ikke startdatoen du skrev inn. En melding nevner begrensningen; endre den hvis du vil flytte starten.

**En dato i weekenden.** En dato på en lørdag, søndag eller fridag regnes som en arbeidsdag: en nedre grense (*Start ikke tidligere enn*, *Slutt ikke tidligere enn*) som neste arbeidsdag, en øvre grense (*Start ikke senere enn*, *Slutt ikke senere enn*) som den forrige.

**En sekundær begrensning som ikke er tillatt.** Appen merker en ugyldig kombinasjon i rødt med årsaken, for eksempel *Primær og sekundær begrensning kan ikke begrense samme side.* En sekundær begrensning er ikke tillatt med ASAP, ALAP, MSO, MFO og en hard fastlåsing.

**En hard fastlåsing.** Første gang du slår den på, advarer appen om at en hard fastlåsing overstyrer avhengighetene. Aktiviteten står da på datoen, også før forgjengerne; disse forgjengerne får negativ slakk.

**Ingen endring etter at du har satt den.** Begrensninger virker bare etter **Beregn**. Har en øvre grense (*Start ikke senere enn*, *Slutt ikke senere enn*) ingen effekt på stolpene, er det normalt: en øvre grense flytter ingenting, den gir negativ slakk hvis datoen ikke holdes.

## Se også

- [Begrensninger og tidsfrister](docs://uitleg-constraints): hva hver type gjør, og forklaringen av hard fastlåsing, negativ slakk og tidsfrist.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva negativ slakk gjør med den kritiske linjen.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): avhengighetene som en begrensning inngår sammen med.
- [Meldinger og advarsler](docs://ref-meldingen): advarslene for en brutt begrensning eller en oversittet tidsfrist.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en begrensning fra tillatelsen *Start ikke tidligere enn* på *Demolish existing extension* (14. mai 2027) og en tidsfrist som holdes med god margin.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): en bevisst stram tidsfrist på *Contractual project handover* (15. juli 2027): etter beregning er slutten 17. august, og mange aktiviteter har negativ slakk.
