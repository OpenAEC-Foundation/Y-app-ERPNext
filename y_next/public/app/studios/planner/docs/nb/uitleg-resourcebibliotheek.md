# Ressursbiblioteket

Murlaget ditt jobber ikke bare på ett prosjekt. I dag er det på husene i nord, i morgen på garasjene i sør. Et ressursbibliotek er stedet der du registrerer et slikt mannskap én gang, slik at alle prosjekter bruker det samme mannskapet. Appen kan da også se når to prosjekter ber om de samme personene samme dag, noe ingen enkelt prosjekt kan se. I denne artikkelen leser du hvordan bibliotek og prosjekt henger sammen, og hvordan appen teller belegg på tvers av prosjekter.

## Konseptet

Det finnes to lag.

**Ressursbiblioteket** er listen over ressurser og kalendere som hører til organisasjonen din: en murer, en kran, en gipsarbeider, med type, standardsats og hvor mange du har. Selve listen, som appen også kaller **poolen**, ligger ikke i prosjektfilene dine. Den ligger i appen: i skrivebordsappen i en fil på denne datamaskinen, og i nettleseren i lagringen til den nettleseren. Tømmer du nettstedets data i nettleseren, er biblioteket borte. Lag derfor en eksport som sikkerhetskopi. Det finnes alltid minst ett bibliotek. Det første heter *Mijn resourcebibliotheek* (et nederlandsk navn), og du kan gi det nytt navn.

**Prosjektet** bestemmer hvor mye av en ressurs det bruker, og når. Et prosjekt er koblet til ett bibliotek, eller står alene. Et frittstående prosjekt fungerer fint, men uten en felles liste.

Et prosjekt peker ikke til biblioteket, men beholder en **kopi**. Når du tildeler *Bricklayer* fra biblioteket til et prosjekt, lager appen en kopi i prosjektet med et **opprinnelsesstempel**: notatet om at denne kopien kommer fra bibliotek X og er element Y der. I ressurstabellen kjenner du en slik kopi på et lite bibliotekikon. Kopien er en vanlig ressurs: du kan tildele aktiviteter til den, og den lagres i selve prosjektfilen.

Kalenderne i ressursbiblioteket er noe annet enn prosjektets liste over kalendere, som du håndterer i kalenderdialogen. En kalender fra biblioteket kommer inn i prosjektet sammen med ressursen som bruker den.

## Slik fungerer appen med det

### Hva biblioteket bestemmer, og hva prosjektet bestemmer

Biblioteket bestemmer **hva en ressurs er**: navnet, typen, standardsatsen per time, enheten og beskrivelsen. I en prosjektkopi står disse feltene som vanlig tekst. Du endrer dem i biblioteket, så er de riktige i alle prosjekter. Vil en kopi gå sin egen vei likevel, kobler du den fra biblioteket.

Prosjektet bestemmer **hvor mye og når**: *Maksimalt antall*, kapasiteten som endrer seg over tid (*Tidsfasert kapasitet*), og hvilken kalender ressursen har. Disse feltene kan du fortsatt redigere i prosjektet, og de regnes ikke som avvik fra biblioteket. Tross alt kan det samme mannskapet følge en annen kalender ved en hastejobb enn ved et vanlig prosjekt. Innholdet i en kalender som fulgte med en ressurs, følger derimot biblioteket.

### Når en kopi følger med

Biblioteket oppdaterer ikke kopiene hele tiden, men på faste tidspunkter:

- Når du redigerer noe i biblioteket, oppdateres de uredigerte kopiene i alle åpne prosjekter med én gang.
- Når du åpner et prosjekt eller bytter til en annen fane, sammenligner appen kopiene med biblioteket. Er en uredigert kopi bak, oppdaterer appen den stille og melder det kort: *1 element oppdatert fra biblioteket* eller *N elementer oppdatert fra biblioteket*.

Appen husker verdiene fra det øyeblikket kopien ble laget eller oppdatert. Er en kopi nå ulik disse verdiene, avgjør appen ikke hvem som har rett. Kopien får da merket *avviker — avgjør*. Når du åpner en fil med en slik kopi, åpnes vinduet *Koble til ressursbiblioteket* av seg selv. Der velger du per element om bibliotekverdiene gjelder, eller om verdiene fra filen din skal inn i biblioteket. Når du bytter fane, vises det aldri et vindu.

Et avvik oppstår for eksempel når du kobler en egen ressurs i prosjektet til et bibliotekelement med samme navn, men andre verdier, med *Flytt til biblioteket*. Appen kobler dem likevel, og markerer kopien som avvikende med én gang.

### Når en ressurs forsvinner fra biblioteket

Sletter du en ressurs fra biblioteket, blir kopien i prosjektene dine stående og fungerer fortsatt. Den får merket *ikke lenger i biblioteket*. Deretter kan du redigere den helt eller fjerne den fra prosjektet.

### Belegg på tvers av prosjekter

Histogrammet og overallokeringen i et prosjekt ser bare på det ene prosjektet. Biblioteket vet mer: hvor mange av en ressurs det finnes totalt. Visningen *Belegg* legger per dag sammen belastningen fra alle åpne prosjekter som er koblet til samme bibliotek og bruker en kopi av den ressursen. Er summen på en dag større enn kapasiteten i biblioteket, gjelder den dagen som overallokering.

Tre regler bestemmer hva som teller:

- Kapasiteten kommer fra biblioteket (*Maksimalt antall* på bibliotekelementet, eller *Tidsfasert kapasitet* den dagen), ikke fra *Maksimalt antall* på prosjektkopien. To prosjekter som hver holder seg innenfor sin egen tildeling, kan derfor likevel be om for mye til sammen.
- En sum som er nøyaktig lik kapasiteten, er ikke en konflikt. Det må be om mer enn kapasiteten.
- Bare kopier med et opprinnelsesstempel teller, og bare i prosjekter som er åpne i denne appen på det øyeblikket. En egen ressurs i ett enkelt prosjekt står ikke i biblioteket og teller derfor ikke. Oversikten ser ikke dokumenter som ikke er åpnet i denne appen. Det står også nederst i selve oversikten.

## Utregnet eksempel: murlaget i to prosjekter

Biblioteket inneholder ressursen *Bricklayer* med *Maksimalt antall* 3: tre murere på lønnslisten. To prosjekter bruker den, begge med en kopi som har *Maksimalt antall* 2.

- *Houses North* har aktiviteten *Bricklaying facades* på 5 arbeidsdager fra mandag 7. juni 2027, med 2 tildelingsenheter per dag. Aktiviteten går fra 7. til 11. juni inklusive.
- *Garages South* har aktiviteten *Bricklaying garages* på 4 arbeidsdager fra onsdag 9. juni 2027, med 2 tildelingsenheter per dag. Helgen telles ikke med, så aktiviteten dekker 9., 10., 11. og 14. juni.

I hvert prosjekt blir en murer bedt om 2 av sine 2 tildelingsenheter. Ingen av prosjektene melder overallokering: under *Ressurser › Overallokering* står det *Ingen* i begge. Men til sammen går de over de 3 murerne. Per dag teller appen:

- Mandag 7. og tirsdag 8. juni: 2 (bare Houses North)
- Onsdag 9., torsdag 10. og fredag 11. juni: 2 + 2 = 4
- Mandag 14. juni: 2 (bare Garages South)

Toppen er 4, mot en kapasitet på 3. Oversikten viser murer med *2 dokumenter*, perioden *2027-06-07 – 2027-06-14*, *4.0 / 3.0* for topp og kapasitet, og *3 dager med overallokering*: 9., 10. og 11. juni.

Hva skjer hvis du endrer noe:

- Tar *Bricklaying facades* 6 arbeidsdager, varer den til mandag 14. juni. Den dagen når også 2 + 2 = 4, så oversikten melder *4 dager med overallokering*: 9., 10., 11. og 14. juni. Toppen er fortsatt 4.
- Har biblioteket *Maksimalt antall* 4, står det *4.0 / 4.0*. Da er det ingen konflikt, fordi summen ikke er større enn kapasiteten.
- Jobber *Garages South* med 1 tildelingsenhet per dag i stedet for 2, er toppen 3, og det står *3.0 / 3.0*: ingen konflikt.
- Starter *Garages South* først mandag 14. juni, overlapper ikke prosjektene. Perioden blir *2027-06-07 – 2027-06-17*, og toppen er *2.0 / 3.0*.

Stegene for å se på dette i dine egne prosjekter står i [Bruk oversikten over belegg](docs://howto-bezettingsoverzicht-gebruiken).

## Konsekvenser og misforståelser

**«Biblioteket deles med kollegaene mine.»** Nei. Biblioteket ligger i appen (i skrivebordsappen i en fil på denne datamaskinen, og i nettleseren i lagringen til den nettleseren) og synkroniseres ikke. Hvis to planleggere jobber med samme ressursbibliotek, kan bibliotekene deres bli ulike. Du kan dele ved å eksportere og importere, se [Administrere og dele ressursbiblioteker](docs://howto-bibliotheken-beheren). Deler organisasjonen din mannskaper mellom flere driftsselskaper, velg da bevisst ett felles bibliotek. Oversikten ser også bare prosjekter som er åpne i denne appen.

**«Endrer jeg biblioteket, endres alt i prosjektene mine.»** Bare identiteten til ressursen endres: navn, type, standardsats, enhet og beskrivelse. *Maksimalt antall*, kapasiteten over tid og kalendervalget i et prosjekt blir stående slik de er.

**«Jeg kan angre en endring i biblioteket.»** Nei. Biblioteket hører til appen og ikke til et prosjekt, så endringer i det ligger utenfor *Angre* (Ctrl+Z). Visningen *Bibliotek* advarer om dette selv: *Dette endrer biblioteket og gjelder alle prosjekter — kan ikke angres.* Å slette fra biblioteket ber også om bekreftelse, og det kan ikke angres.

**«Oversikten over belegg løser overallokeringen.»** Nei. Oversikten er bare et skrivebeskyttet vindu. Den viser på hvilke dager to prosjekter til sammen ber om for mye. Utjevning (*Ressurser › Utjevning › Utjevn…*, se [Utjevning av ressurser](docs://uitleg-nivelleren)) ser på ressursene i ett prosjekt og tar ikke de andre prosjektene med i betraktningen. Flytt selv en aktivitet i ett av prosjektene, eller endre kapasiteten i biblioteket hvis noen faktisk kommer til.

**«Min egen ressurs teller i belegget.»** Bare hvis den står i biblioteket. En ressurs du bare har laget i prosjektet, for eksempel en leid kran til ett enkelt oppdrag, har ikke et opprinnelsesstempel og står derfor ikke i oversikten. Med *Flytt til biblioteket* legger du den til.

## Se også

- [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken): koble til, tildele ressurser og løse avvik.
- [Administrere og dele ressursbiblioteker](docs://howto-bibliotheken-beheren): opprette, eksportere og importere biblioteker.
- [Bruk oversikten over belegg](docs://howto-bezettingsoverzicht-gebruiken): finne overallokeringer på tvers av prosjekter.
- [Administrere ressurser](docs://howto-resources-beheren): ressursene i ett enkelt prosjekt.
