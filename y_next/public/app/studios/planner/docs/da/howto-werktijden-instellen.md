# Indstilling af arbejdstimer

Mål: angiv pr. ugedag på hvilke klokkeslæt en kalender arbejder, så opgaver i timer kører på de rigtige tidspunkter.

## Hvornår du har brug for dette

Fredag eftermiddag er fri. Holdet arbejder fra 06:00 til 22:00 i to arbejdsskift. Der er et nathold. Pausen er kortere end en time. Så længe du kun bruger dage i tidsplanen, er *Start (time)*, *Slut (time)* og pausen nok ([Oprettelse og tildeling af en kalender](docs://howto-kalender-maken-en-toewijzen)). Angiver du opgaver i timer, tæller appen arbejdsminutter inden for kalenderens tidsbånd. I appen kaldes tidsbåndene *bånd*. Et tidsbånd er en sammenhængende periode med arbejdstid på én ugedag. Et hul mellem to tidsbånd er en pause. Hvad det betyder for din tidsplan, står i [Dage og timer](docs://uitleg-dagen-en-uren).

Du skal bruge *Slå timeplanlægning til* for dette ([Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten)). Uden timeplanlægning ser du ikke blokken *Arbejdstimer*.

## Trin

### Valg af en forudindstilling for arbejdsskift

1. Vælg *Tidsplan › Kalender › Kalender* og vælg kalenderen til venstre.
2. Klik på en forudindstilling i blokken *Arbejdstimer*. Den erstatter arbejdsdagene og arbejdstimerne i kalenderen.
3. Klik på *Anvend*.

Hver forudindstilling gør dette:

- *Dagarbejdsskift*: mandag til fredag fra 08:00 til 16:00 uden pause. Dermed bliver kalenderen igen en almindelig kalender uden tidsbånd.
- *2 arbejdsskift*: mandag til fredag fra 06:00 til 14:00 og fra 14:00 til 22:00, i alt 16 timer.
- *3 arbejdsskift*: mandag til fredag tre arbejdsskift, fra 06:00 til 14:00, fra 14:00 til 22:00 og fra 22:00 til 06:00 næste dag, i alt 24 timer.
- *Natarbejdsskift*: mandag til fredag fra 22:00 til 06:00 næste dag, 8 timer.
- *24/7*: alle syv dage fra 00:00 til 24:00.

### Angivelse af arbejdstimer pr. ugedag

1. Klik på *Angiv pr. ugedag*… i blokken *Arbejdstimer*. Under knapperne vises en række pr. ugedag med arbejdstiden for den dag. Kalenderen har nu tidsbånd pr. ugedag. Har kalenderen dem allerede, er oversigten straks åben. Så hedder knappen *Skjul arbejdstimer*, og den klapper oversigten sammen.
2. Justér start- og sluttidspunktet for hvert tidsbånd i de to tidsfelter.
3. Vil du indbygge en pause, så klik på **+** (*Tilføj bånd*) for den dag. Justér derefter tidspunkterne for tidsbåndene, så der er et hul mellem dem. Et nyt tidsbånd starter kl. 08:00 og slutter kl. 16:00.
4. Et tidsbånd, der løber over midnat, markerer du ved at sætte kryds ved *næste dag*. Tidsbåndet tæller for den dag, det begynder på.
5. Klik på skraldespanden bag et tidsbånd for at fjerne det. En dag uden tidsbånd vises som *Ikke-arbejdsdag*.
6. Klik på kopisymbolet (*Kopiér til alle arbejdsdage*) for en dag fra mandag til fredag. Så lægges tidsbåndene for den dag på mandag til fredag.
7. Nederst står *Udledte timer/dag:* med de nettotimer pr. dag, som appen udleder af dette. Klik på *Anvend*.

**Eksempel: en fri fredag eftermiddag.** Klik på *Angiv pr. ugedag*…. Fjern det andet tidsbånd (13:00 til 16:00) for *Fr*. Fredag har nu 5 timer, de andre dage 8. Udledte timer pr. dag forbliver 8.

### Gem en egen forudindstilling

1. Klik på *Gem som forudindstilling*… og skriv et navn i feltet *Navn til din egen forudindstilling*.
2. Klik på *Gem*. Forudindstillingen står nu blandt de andre, og du kan bruge den i ethvert projekt. Med krydset ved siden af fjerner du den igen.

En egen forudindstilling gemmes på denne enhed, ikke i projektfilen.

## Faldgruber, og hvad appen gør så

**En forudindstilling erstatter alt.** Hvis du vælger en forudindstilling, forsvinder de arbejdsdage og arbejdstimer, du har angivet før. Helligdagene bliver som de er.

**Dagknapper og tidsbånd er to forskellige ting.** Knapperne under *Arbejdsdage* ændrer ikke tidsbåndene. En dag får arbejdstid, når du klikker på *Tilføj bånd* for den dag. Slår du en dag til med knappen alene, tæller den for opgaver i dage, men ikke for opgaver i timer. Har kalenderen arbejdstimer, så brug rækkerne pr. ugedag.

**Justering af arbejdstimer, når timeplanlægning er slået fra.** Slår du timeplanlægning fra igen, kommer felterne *Start (time)*, *Slut (time)* og pausen tilbage. På en kalender med tidsbånd ændrer de ikke tidsbåndene. Justér arbejdstimerne derfor altid, mens timeplanlægning er slået til.

**Ingen brugbare arbejdstimer.** En kalender uden tidsbånd eller uden arbejdsdage kan ikke bære en opgave i timer. Appen viser så *Denne kalender har ingen gyldige arbejdstimer. Kontrollér arbejdsdage og arbejdstimer*.

## Se også

- [Dage og timer](docs://uitleg-dagen-en-uren): hvordan appen tæller arbejdstimer og udleder nettotimerne pr. dag.
- [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten): angivelse af en opgave i timer.
- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvilken kalender der gælder for hvilken opgave.
- [Kalendervinduer](docs://ref-kalenders): alle felter i kalendervinduerne.
