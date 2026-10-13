# Ressourcebiblioteket

Dit murerhold arbejder ikke kun for ét projekt. I dag er det ved husene i nord, i morgen ved garagerne i syd. Et ressourcebibliotek er det sted, hvor du registrerer et sådant hold én gang, så alle projekter bruger det samme hold. Appen kan så også se, hvornår to projekter kræver de samme personer på samme dag, noget et enkelt projekt ikke kan se. I denne artikel læser du, hvordan bibliotek og projekt hænger sammen, og hvordan appen tæller belægning på tværs af projekter.

## Begrebet

Der er to lag.

**Ressourcebiblioteket** er listen over ressourcer og kalendere, der hører til din organisation: en murer, en kran, en gipser, med deres type, standardsats og hvor mange du har. Selve listen, som appen også kalder **biblioteket**, ligger ikke i dine projektfiler. Den ligger i appen: i desktopappen i en fil på denne computer, i browseren i den browsers lagring. Er webstedets data i browseren ryddet, er biblioteket væk. Eksporter det derfor som sikkerhedskopi. Der er altid mindst ét bibliotek. Det første hedder *Mijn resourcebibliotheek* (et hollandsk navn), og du kan omdøbe det.

**Projektet** bestemmer, hvor meget af en ressource det bruger, og hvornår. Et projekt er koblet til ét bibliotek eller står alene. Et selvstændigt projekt fungerer fint, bare uden en fælles liste.

Et projekt peger ikke på biblioteket, men gemmer en **kopi**. Når du tildeler *Bricklayer* fra biblioteket til et projekt, laver appen en kopi i projektet med et **oprindelsesmærke**: noten om, at denne kopi stammer fra bibliotek X og er element Y der. I ressourcetabellen kender du en sådan kopi på et lille biblioteksikon. Kopien er en almindelig ressource: der kan tildeles opgaver til den, og den gemmes i selve projektfilen.

Kalenderne i ressourcebiblioteket er noget andet end din projektliste over kalendere, som du administrerer i kalenderdialogen. En bibliotekskalender kommer med i dit projekt sammen med den ressource, der bruger den.

## Sådan bruger appen det

### Hvad biblioteket bestemmer, og hvad projektet bestemmer

Biblioteket bestemmer **hvad en ressource er**: navnet, typen, standardsatsen pr. time, enheden og beskrivelsen. I en projektkopi står disse felter som almindelig tekst. Du ændrer dem i biblioteket, så de er rigtige i alle projekter. Vil en kopi alligevel gå sin egen vej, så afkobler du den fra biblioteket.

Projektet bestemmer **hvor meget og hvornår**: *Maksimalt antal enheder*, kapaciteten der ændrer sig over tid (*Tidsfaseret kapacitet*), og hvilken kalender ressourcen har. Disse felter forbliver redigerbare i projektet og tæller ikke som afvigelse fra biblioteket. Det samme hold kan jo køre på en anden kalender ved et hasteprojekt end ved et almindeligt projekt. Indholdet af en kalender, der kom med en ressource, følger biblioteket.

### Hvornår en kopi følger med

Biblioteket opdaterer ikke kopierne hele tiden. Det sker på faste tidspunkter:

- Når du redigerer noget i biblioteket, følger de uredigerede kopier i alle åbne projekter med straks.
- Når du åbner et projekt, eller skifter til en anden fane, sammenligner appen kopierne med biblioteket. Er en uredigeret kopi bagud, opdaterer appen den stille og melder det kort: *1 element opdateret fra biblioteket* eller *N elementer opdateret fra biblioteket*.

Appen husker de værdier fra det øjeblik, kopien blev lavet eller opdateret. Afviger en kopi nu fra dem, beslutter appen ikke, hvem der har ret. Kopien får så markeringen *afviger — beslut*. Når du åbner en fil med en sådan kopi, åbner vinduet *Sammenkæd ressourcebibliotek* af sig selv. Der vælger du pr. element, om bibliotekets værdier gælder, eller om værdierne fra din fil skal ind i biblioteket. Når du skifter fane, vises der aldrig et vindue.

En afvigelse opstår for eksempel, når du med *Flyt til biblioteket* kobler en egen ressource i projektet til et bibliotekselement med samme navn, men andre værdier. Appen kobler dem, og markerer kopien straks som afvigende.

### Når en ressource forsvinder fra biblioteket

Sletter du en ressource fra biblioteket, bliver kopien i dine projekter stående og fungerer videre. Den får markeringen *ikke længere i biblioteket*. Derefter kan du redigere den fuldt ud eller fjerne den fra projektet.

### Belægning på tværs af projekter

Histogrammet og overallokeringen i et projekt kigger kun på dét ene projekt. Biblioteket ved mere: hvor mange af en ressource der i alt findes. *Belægning*-visningen lægger pr. dag belastningen sammen fra alle åbne projekter, der er koblet til det samme bibliotek og bruger en kopi af den ressource. Er summen på en dag større end bibliotekets kapacitet, tæller den dag som overallokeret.

Tre regler bestemmer, hvad der tæller:

- Kapaciteten kommer fra biblioteket (*Maksimalt antal enheder* for bibliotekselementet, eller dets *Tidsfaseret kapacitet* på den dag), ikke fra *Maksimalt antal enheder* på projektkopien. To projekter, der hver holder sig inden for deres egen tildeling, kan altså stadig bede om for meget tilsammen.
- En sum, der er præcis lig med kapaciteten, er ikke en konflikt. Der skal bedes om mere end kapaciteten.
- Kun kopier med et oprindelsesmærke tæller, og kun i projekter, der er åbne i denne app på det øjeblik. En egen ressource i et enkelt projekt er ikke i biblioteket og tæller derfor ikke med. Oversigten ser ikke dokumenter, der ikke er åbnet i denne app; det står også nederst i selve oversigten.

## Eksempel: murerholdet i to projekter

Biblioteket indeholder ressourcen *Bricklayer* med *Maksimalt antal enheder* 3: tre murere på lønlisten. To projekter bruger den, begge med en kopi, der har *Maksimalt antal enheder* 2.

- *Houses North* har opgaven *Bricklaying facades* på 5 arbejdsdage fra mandag den 7. juni 2027, med 2 tildelingsenheder pr. dag. Opgaven løber fra 7. til 11. juni inklusive.
- *Garages South* har opgaven *Bricklaying garages* på 4 arbejdsdage fra onsdag den 9. juni 2027, med 2 tildelingsenheder pr. dag. Weekenden tæller ikke med, så opgaven dækker 9., 10., 11. og 14. juni.

I hvert projekt bliver murerressourcen bedt om 2 af dens 2 tildelingsenheder. Ingen af projekterne melder overallokering: under *Ressourcer › Overallokering* står der i begge *Ingen*. Tilsammen overskrider de dog de 3 murere. Pr. dag tæller appen:

- Mandag 7. og tirsdag 8. juni: 2 (kun Houses North)
- Onsdag 9., torsdag 10. og fredag 11. juni: 2 + 2 = 4
- Mandag 14. juni: 2 (kun Garages South)

Toppen er 4, og kapaciteten er 3. Oversigten viser murerressourcen med *2 dokumenter*, perioden *2027-06-07 – 2027-06-14*, *4,0 / 3,0* for top og kapacitet, og *3 dage overallokeret*: 9., 10. og 11. juni.

Hvad sker der, hvis du ændrer noget:

- Tager *Bricklaying facades* 6 arbejdsdage, løber den til mandag 14. juni. Den dag når også 2 + 2 = 4, så oversigten melder *4 dage overallokeret*: 9., 10., 11. og 14. juni. Toppen bliver stadig 4.
- Har biblioteket *Maksimalt antal enheder* 4, står der *4,0 / 4,0*, og der er ingen konflikt, fordi summen ikke er større end kapaciteten.
- Arbejder *Garages South* med 1 tildelingsenhed pr. dag i stedet for 2, er toppen 3, og der står *3,0 / 3,0*: ingen konflikt.
- Starter *Garages South* først mandag 14. juni, overlapper projekterne ikke. Perioden bliver *2027-06-07 – 2027-06-17*, og toppen er *2,0 / 3,0*.

Stegene til at se dette i dine egne projekter står i [Brug belægningsoversigten](docs://howto-bezettingsoverzicht-gebruiken).

## Konsekvenser og misforståelser

**"Biblioteket deles med mine kolleger."** Nej. Biblioteket ligger i appen (i desktopappen i en fil på denne computer, i browseren i den browsers lagring) og synkroniseres ikke. Hvis to planlæggere arbejder med det samme ressourcebibliotek, kan deres biblioteker afvige fra hinanden. Du kan dele ved at eksportere og importere, se [Administrer og del ressourcebiblioteker](docs://howto-bibliotheken-beheren). Deler din organisation hold på tværs af driftsselskaber, så vælg bevidst ét fælles bibliotek. Oversigten ser også kun de projekter, der er åbne i denne app.

**"Ændrer jeg biblioteket, ændrer alt i mine projekter sig."** Det er kun ressourcens identitet: navn, type, standardsats, enhed og beskrivelse. *Maksimalt antal enheder*, kapaciteten over tid og valget af kalender i et projekt bliver, som de er.

**"Jeg kan fortryde en ændring i biblioteket."** Nej. Biblioteket hører til appen og ikke til et projekt. Ændringer i det falder derfor uden for *Fortryd* (Ctrl+Z). Visningen *Bibliotek* advarer selv om dette: *Dette redigerer biblioteket og gælder for alle projekter — kan ikke fortrydes.* Sletning fra biblioteket beder også om bekræftelse, og den kan ikke fortrydes.

**"Belægningsoversigten løser overallokeringen."** Nej, oversigten er kun et vindue, du kan læse i. Den viser på hvilke dage to projekter tilsammen beder om for meget. Udjævning (*Ressourcer › Udjævning › Udjævn…*, se [Udjævning af ressourcer](docs://uitleg-nivelleren)) kigger på ressourcerne i ét projekt og tager ikke de andre projekter med i betragtning. Flyt selv en opgave i et af projekterne, eller ændr kapaciteten i biblioteket, hvis der virkelig kommer flere til.

**"Min egen ressource tæller i belægningen."** Kun hvis den er i biblioteket. En ressource, du kun har lavet i projektet, for eksempel en lejet kran til et enkelt job, har intet oprindelsesmærke og står derfor ikke i oversigten. Med *Flyt til biblioteket* tilføjer du den.

## Se også

- [Brug ressourcebiblioteket](docs://howto-resourcebibliotheek-gebruiken): sammenkobling, tildeling af ressourcer og løsning af afvigelser.
- [Administrer og del ressourcebiblioteker](docs://howto-bibliotheken-beheren): oprette, eksportere og importere biblioteker.
- [Brug belægningsoversigten](docs://howto-bezettingsoverzicht-gebruiken): find overallokeringer på tværs af projekter.
- [Administrer ressourcer](docs://howto-resources-beheren): ressourcerne i ét enkelt projekt.
