# Opret nyt projekt og Projektinfo

Felterne i vinduet *Opret nyt projekt* og i *Projektinfo*: hvad hvert felt gør, hvad standarden er, og hvor det virker. De er to sider af samme formular. *Opret nyt projekt* opretter et nyt projekt og har nogle ekstra felter. *Projektinfo* ændrer det projekt, du har åbent.

## Åbning

**Opret nyt projekt** — *Fil › Ny*, Ctrl+N, eller plusset til højre for dokumentfanerne (*Start et projekt*, derefter *Opret nyt projekt*). Vinduet åbnes med markøren i *Projektnavn*.

**Projektinfo** — *Indstillinger › Projekt › Projektinfo* åbner formularen som et vindue med titlen *Projektinformation*. *Fil › Projektinfo* viser den samme formular på skærmen *Fil*. Blokken *Beregningsprofil og beregningsindstillinger* står nederst på begge steder. Hvad der står i den, står i [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).

## Opret, Anvend og annuller

**Opret** (i *Opret nyt projekt*) laver projektet og åbner det i en fane for sig selv. **Anvend** (i *Projektinfo*) skriver dine ændringer til projektet.

- **Kun ved Anvend.** Du skriver i et udkast. Projektet ændrer sig først, når du klikker på *Anvend*. *Anvend* skriver kun det, du faktisk har ændret, i ét trin i *Fortryd*. Klikker du på *Anvend* uden at have ændret noget, sker der ingenting, og der tilføjes ikke et trin.
- **Annuller, krydset og Esc** lukker vinduet uden at gemme noget. Et klik ved siden af vinduet lukker det ikke: det du har skrevet, bliver stående.
- **Enter** gør det samme som *Opret* eller *Anvend*, undtagen i feltet *Beskrivelse* og i en åben rullemenu.
- **I skærmen Fil** viser *Projektinfo* *Ændringer er ikke anvendt — klik på Anvend for at gemme dem.* nederst, så længe dit udkast afviger. Forlader du skærmen, spørger appen, om du vil anvende, forkaste eller annullere. Se [Båndet, fane for fane](docs://ref-lint).
- **En brugerdefineret beregningsprofil uden navn** blokerer *Anvend* og *Opret*. Giv den et navn, eller forkast ændringen.

## Felter i begge vinduer

**Projektnavn** — navnet på projektet i titellinjen, på fanen og i filnavnet, når du gemmer. Standard: tom. Et tomt felt er tilladt: projektet hedder så *Ny tidsplan*, vist med grå tekst i feltet. Hvor: hele skærmen.

**Beskrivelse** — fri tekst. Standard: tom. Virkning: den gemmes med projektet, i IFC-filen og i eksporten til Primavera P6 XML, og den har ingen indflydelse på tidsplanen.

**Forfatter** — fri tekst. Standard: tom. Virkning: den kommer i IFC-filen og vises som *Forfatter:* i sidehovedet på en rapport, hvor du ikke kan rette den.

**Bibliotek** — det bibliotek, projektet er koblet til. Vælg mellem *intet bibliotek (frit projekt)*, dine eksisterende biblioteker og *+ Opret nyt ressourcebibliotek…*. Standard: i *Opret nyt projekt* standardbiblioteket, i *Projektinfo* den nuværende kobling. Virkning: se [Brug af biblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Opret nyt ressourcebibliotek…* skriver du et navn i et felt nedenunder. Biblioteket oprettes først ved *Opret* eller *Anvend*, så annullering efterlader intet. En kobling i *Projektinfo* ændres kun, hvis du selv rører dette felt.

**Kunde/organisation** — fri tekst. Standard: tom. Virkning: den kommer i IFC-filen og vises som *Virksomhed:* i sidehovedet på en rapport.

**Startdato** — projektets start. Standard: i *Opret nyt projekt* i dag. Hvad feltet gør, står hieronder under *Hvad startdatoen gør*.

**Slutdato** — den planlagte slutdato for projektet. Standard: tom. Virkning: en oplysning, ikke et krav: appen planlægger ikke frem mod denne dato. Den vises i sidehovedet på en rapport og i eksporter, og den bestemmer, til hvilket år helligdagene genereres. Kun for en Primavera-fil med indstillingen *Beregn slæk op til projektslutdatoen* (se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies)) udføres slækberegningen op til denne dato.

**Standardenhed for nye opgaver** — kun synlig når *Slå timeplanlægning til* er slået til. Vælg mellem *Dage* og *Timer*. Standard: *Dage*. Virkning og betingelser: se [Slå timeplanlægning til](docs://howto-urenplanning-aanzetten).

**Beregningsprofil og beregningsindstillinger** — i *Projektinfo* hele blokken, i *Opret nyt projekt* kun rullemenuen *Beregningsprofil* med *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. Standard: *Open Planner Studio*. Når du vælger en beregningsprofil, sættes også standardindstillingerne for beregningsprofilen. Se [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies).

## Kun i vinduet Opret nyt projekt

**Skabelon for faser** — hvilke faser projektet starter med. Vælg mellem *Tom*, *Boligbyggeri* og *Erhvervsbyggeri / renovering*. Standard: *Tom*. Virkning: *Tom* giver et projekt uden opgaver. De to andre lægger otte faseopgaver klar, hver med en varighed på 5 i projektets standardenhed (5 arbejdsdage, eller 5 timer, hvis du vælger *Timer* under *Standardenhed for nye opgaver*), og uden afhængigheder. Du omdøber, flytter og udvider dem selv. For *Boligbyggeri* er det: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking og Oplevering. For *Erhvervsbyggeri / renovering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen og Oplevering. Navnene er data i dit projekt og forbliver på nederlandsk, også når interfacet har et andet sprog. Er *Slå byggetilstand til* slået fra, findes kun *Tom*. Se [Indstillinger](docs://ref-instellingen).

**Arbejdsskift** — kun synlig når *Slå timeplanlægning til* er slået til. Vælg mellem *Dagarbejdsskift*, *2 arbejdsskift*, *3 arbejdsskift* og *24/7*. Standard: *Dagarbejdsskift*. Virkning: *Dagarbejdsskift* lader standardkalenderen være, som den er: en almindelig dagkalender fra mandag til fredag. De tre andre lægger tidsbånd ind i kalenderen for projektet, ligesom knapperne med samme navn i vinduet *Kalendere*. Hvilke tidspunkter det er, står i [Indstil arbejdstid](docs://howto-werktijden-instellen). Med *Dagarbejdsskift* kan *Timer* ikke vælges under *Standardenhed for nye opgaver*, fordi en dagkalender ingen tidsbånd har.

**Helligdagssæt** — hvilke fridage kalenderen for projektet får. Ved *Land* vælger du *Nederlandene* (standard), *Tyskland*, *Belgien*, *Frankrig*, *Storbritannien*, *Østrig*, *Schweiz*, *Ingen helligdage* eller *Brugerdefineret…*. Har landet regioner, kommer der et rullemenufelt *Region* til. For Nederlandene vælger du også, hvis *Slå byggetilstand til* er slået til, *Byggeferie*: *Ingen* (standard), *Nord*, *Midt* eller *Syd*. Under den står en linje som *36 helligdage, 2025–2029*, som du udvider for at se listen. Årene går fra året før startdatoen til året efter slutdatoen, eller til tre år efter startåret, hvis der ingen slutdato er. *Brugerdefineret…* giver en kalender uden helligdage og åbner vinduet *Kalendere* direkte efter oprettelsen, så du selv kan udfylde dem. Kalenderen for projektet hedder *Bouwkalender NL*, eller *Standaardkalender*, hvis *Slå byggetilstand til* er slået fra. Valget er så også *Ingen helligdage*. Hvordan generatoren virker, står i [Generering af helligdage og byggeferie](docs://howto-feestdagen-genereren).

## Hvad startdatoen gør

Startdatoen er projektets udgangspunkt. Tre regler:

- **Nye opgaver starter på startdatoen.** En opgave, du tilføjer, får projektstartdatoen som planlagt start.
- **En opgave med en foregående opgave starter aldrig før startdatoen.** Er slutdatoen for den foregående opgave tidligere, venter opgaven til startdatoen. En opgave *uden* foregående opgave beholder sin egen dato, også selv om den ligger før startdatoen. Det er nødvendigt for at vise en tidsplan fra MS Project eller Primavera, sådan som kildeprogrammet viser den. En begrænsning *Skal starte den (MSO)* eller *Skal slutte den (MFO)* bryder begge regler: sådan en opgave står på sin dato, også selv om den falder før startdatoen.
- **En senere startdato flytter løse opgaver med.** Sætter du startdatoen senere i *Projektinfo* og klikker du på *Anvend*, flyttes opgaver uden foregående opgave og uden begrænsning, der sætter en nedre grænse (*Start ikke tidligere end*, *Skal starte den*, *Afslut ikke tidligere end* eller *Skal slutte den*), og som ligger før den nye dato, til den dato. Det sker i samme trin i *Fortryd*. Appen siger, hvor mange opgaver der er flyttet. Det sker kun, når du selv ændrer startdatoen, aldrig når du åbner en fil. At sætte startdatoen senere flytter ikke resten af tidsplanen. Det gør *Flyt projekt*, se [Flytning af et projekt](docs://howto-project-verplaatsen).

## Se også

- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): blokken *Beregningsprofil og beregningsindstillinger*.
- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvorfor en beregningsprofil ændrer resultatet.
- [Flytning af et projekt](docs://howto-project-verplaatsen): hele tidsplanen til en anden start.
- [Tilføj opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen): start på de første opgaver.
- [Generering af helligdage og byggeferie](docs://howto-feestdagen-genereren): helligdagssættet i detaljer.
