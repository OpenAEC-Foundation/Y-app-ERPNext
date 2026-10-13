# Sette opp en ressurskalender

Mål: registrer hvilke dager en ressurs er tilgjengelig, slik at histogrammet, overallokeringen og utjevningen beregnes med den.

## Når du trenger dette

Murermannskapet arbeider bare fra mandag til torsdag. Kranen er på et annet prosjekt de to første ukene i august. En underentreprenør har fire faste arbeidsdager. Uten en egen kalender for ressursen antar appen at ressursen arbeider på dagene i prosjektkalenderen.

En ressurskalender endrer ingen aktivitetsdatoer i det hele tatt. Den bestemmer bare når ressursen er tilgjengelig. Hvis en aktivitet er planlagt på en dag ressursen ikke arbeider, er kapasiteten den dagen 0, og dagen regnes som overallokert. Hvis du vil at aktiviteten selv skal kjøre på andre dager, gi aktiviteten en egen kalender ([Opprette og tilordne en kalender](docs://howto-kalender-maken-en-toewijzen)). Forskjellen forklares i [Kalendere og arbeidsdager](docs://uitleg-kalenders).

## Steg

### Opprette en ny ressurskalender

1. Velg *Ressurser › Administrer › Ressurser*. Ressurspanelet åpnes. Finnes ressursen ikke ennå, opprett den med *Legg til ny ressurs i prosjektet*.
2. Finn raden til ressursen. I kolonnen *Kalender* er standard *Prosjektkalender*: ressursen følger da prosjektkalenderen.
3. I listen velger du *+ Ressurskalender*. Vinduet *Ressurskalender* åpnes. Det har de samme feltene som kalenderskjemaet: *Navn*, *Arbeidsdager*, arbeidstidene og *Helligdager*. Den nye kalenderen starter som en kopi av standardkalenderen og heter *Ressurskalender*.
4. Gi kalenderen et navn som passer til ressursen, for eksempel *Crew Mon–Thu*. Sett arbeidsdagene: klikk av fredag under *Arbeidsdager*. Du legger helligdager eller nedetid inn i listen *Helligdager* med *Legg til helligdag*.
5. Klikk på *Bruk*. Kalenderen står nå i prosjektets bibliotek og er koblet til ressursen, i ett trinn som du angrer med *Angre*. Med *Avbryt* blir ingenting opprettet.

### Velge eller justere en eksisterende kalender

I kolonnen *Kalender* velger du en kalender fra listen. *Prosjektkalender* fjerner igjen den egne kalenderen. Hvis du vil justere den valgte kalenderen, klikker du på blyanten ved siden av listen (*Rediger…*). Vinduet *Ressurskalender* åpnes med den gjeldende kalenderen.

### Se på resultatet

1. Hvis statuslinjen viser *Utdatert — omberegn (F5)*, trykk **Beregn** (F5).
2. Velg *Ressurser › Histogram › Histogram* og klikk på ressursen i listen til venstre for histogrammet. Dagene ressursen ikke arbeider, men er planlagt, er røde. Hvis du holder musepekeren over en av dem, melder søylen for eksempel *Arbeider ikke denne dagen i følge kalenderen “Crew Mon–Thu”*.
3. Under *Ressurser › Overallokering* står antallet ressurser med overallokering, og statuslinjen melder for eksempel *1 ressurs(er) med overallokering*.

## Fallgruver og hva appen gjør da

**Bare dagene teller, ikke timene.** En ressurskalender bestemmer hvilke dager ressursen arbeider. Hvor mange tildelingsenheter som er tilgjengelige den dagen, følger av ressursens *Maksimalt antall*, ikke av arbeidstidene i kalenderen.

**Utjevning løser ikke alltid dette.** Hvis det ikke finnes et tidsrom der hver dag i aktiviteten er en arbeidsdag for ressursen, hjelper det ikke å flytte. Velg *Ressurser › Utjevning › Utjevn…* og klikk på *Beregn*. Aktiviteten står da under *Gjenstående konflikter*, med årsaken *Ressursen arbeider ikke alle dagene denne aktiviteten trenger. Flytting løser ikke dette.* Tilordne deretter aktiviteten til en annen ressurs, eller gi den en egen kalender.

**En delt kalender.** Listen viser alle kalendere i prosjektet, så også prosjektkalenderen og kalenderne til aktivitetene. Hvis du justerer en slik kalender med blyanten, endres også tidsplanen for aktivitetene som bruker den, og statuslinjen melder *Utdatert — omberegn (F5)*. Lag heller en egen kalender for ressursen.

**Overallokering skyldes ikke alltid kalenderen.** En ressurs som arbeider hver dag, kan også være overallokert. Verktøytipset nevner bare kalenderen hvis dagen ikke er en arbeidsdag for ressursen.

## Se også

- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvorfor en ressurskalender ikke flytter datoer.
- [Opprette og tilordne en kalender](docs://howto-kalender-maken-en-toewijzen): feltene i kalenderskjemaet.
- [Generere helligdager og byggferie](docs://howto-feestdagen-genereren): legge inn helligdager og nedetid i kalenderen.
- [Kalendervinduer](docs://ref-kalenders): alle felt i kalendervinduene.
