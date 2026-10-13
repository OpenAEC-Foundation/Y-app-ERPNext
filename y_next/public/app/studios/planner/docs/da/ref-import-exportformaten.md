# Import- og eksportformater

For hvert filformat: om du kan åbne, gemme og eksportere det, hvad der følger med og ikke følger med, og med hvilken beregningsprofil det åbner. Begrundelsen bag alt dette, og et eksempel med tal, står i [Filer og formater](docs://uitleg-bestanden).

## Overblik

**Åbning** fungerer med IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` og `.xer`. En fil med en anden filendelse behandler appen som IFC.

**Gemning** skriver altid IFC. Kun en åbnet IFC-fil bliver mål for gemning. Et projekt fra et andet format har ingen fil efter åbning. Så spørger *Gem*, hvor IFC-filen skal gemmes.

**Eksport** fungerer til IFC 4x3, MS Project XML, Primavera P6 XML, CSV og to fremdriftsark (Excel og CSV). En eksport ændrer ikke dit projekt.

**Skrivebeskyttet** er `.mpp` og `.xer`. Appen kan åbne dem, men ikke skrive dem.

**PDF** kommer kun fra en rapport (se [Rapporttyper](docs://ref-rapporttypes)). Appen læser ikke PDF.

**Hvor.** Åbning: *Start › Fil › Åbn*, *Fil › Åbn* eller Ctrl+O. Eksport: *Start › Fil › Eksporter* eller *Fil › Eksporter*. Du læser et udfyldt fremdriftsark ind via *Fil › Importer*, eller med knappen *Opdater fremdrift fra et regneark* i båndgruppen *Fremdrift* på fanerne *Tidsplan*, *Tabel* og *Rapport*.

**Beregningsprofil ved åbning.** Hvert format åbner med en beregningsprofil. Hvad det er, står i [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies). `.xer` åbner med *Primavera P6*, `.mpp` med *Microsoft Project*, og CSV, MS Project XML og P6 XML med *Open Planner Studio*. IFC bevarer den profil, der er gemt i filen. For `.xer` og `.mpp` melder appen, at projektet beregnes på denne måde. Kun IFC bærer beregningsprofilen og beregningsindstillingerne. Af beregningsindstillingerne skriver MS Project XML højst grænseværdien for kritisk. En genåbnet eksport af et andet format beregnes som *Open Planner Studio*.

## IFC

**Åbn** — ja, `.ifc`. Appen læser IFC 4.3. Beregningsprofil: den i filen.

**Gem** — ja, og det er det eneste format, der kan gemmes. *Gem* skriver hele dit projekt som IFC-fil. Filen bliver mål for gemning.

**Eksport** — ja, som *IFC 4x3* (beskrevet som *BuildingSMART-standard. 4D-kobling til BIM-modeller.*). Standardnavn: projektnavnet med filendelsen `.ifc`. Hvis dit projekt er koblet til et ressourcebibliotek, står afkrydsningsfeltet *Gem biblioteksfilen ved siden af* under kortene i *Fil › Eksporter*. Når den er afkrydset, spørger appen efter et sted til *projektnavn-bibliotek.ifc*, efter projektet. Afkrydsningsfeltet står ikke på listen på fanen *Start*.

**Hvad følger med** — alt, der hører til projektet: opgaver med struktur, varighed, datoer og fremdrift; afhængigheder med forsinkelse; begrænsninger og deadlines; kalendere; ressourcer og tildelinger, inklusive fordelingen i timer; oprindelige planer; opgavekoder og brugerdefinerede felter; noter; eksterne afhængigheder til andre projekter; afbrydelser; arbejdsregler og opgavetyper; projektindstillingerne, som statusdato, fremdriftsmetode, beregningsprofil og beregningsindstillinger; forbindelsen med et ressourcebibliotek. For et projekt fra en `.xer` følger også den originale kildefil med. En egen opgavetype bliver gemt som IFC-typen `USERDEFINED` med sit navn i feltet ObjectType. Så læser andre IFC-programmer opgaven normalt. Appen gemmer også typens faste id, så omdøbning ikke bryder forbindelsen. Hvis en anden åbner filen på en anden computer, vises typen der under *Fra dette projekt* og ikke under vedkommendes egne *Mine opgavetyper*.

**Hvad følger ikke med** — hvordan du har sat skærmen op (zoom, rulleposition, valgt opgave, sammenfoldede faser, valgt filter og gruppering) og appindstillingerne ([Indstillinger](docs://ref-instellingen)). Fanen *IFC* viser IFC-teksten for dit projekt.

## MS Project XML (MSPDI)

**Åbn** — ja. Appen genkender en `.xml`-fil som MS Project XML på rodelementet `Project` i MS Project-navnerummet (eller uden navnerum). Beregningsprofil: *Open Planner Studio*.

**Gem** — nej. Et sådant projekt får ingen mål for gemning.

**Eksport** — ja, som *MS Project XML* (*Kan åbnes i Microsoft Project. Fuld WBS-struktur.*). Standardnavn: projektnavnet med `.xml`.

**Hvad følger med** — opgaver med struktur (niveau og WBS), varighed, datoer og fremdrift; afhængigheder med forsinkelse, også i timer eller procent; begrænsninger, inklusive deadline; kalendere, inklusive opgave- og ressourcekalendere; ressourcer og tildelinger, inklusive kurven eller fordelingen i timer; statusdatoen; grænseværdien for kritisk som et helt antal arbejdsdage på 0 eller mere, med *Samlet slæk ≤ grænseværdi*; beskrivelsen af en opgave (som note); arbejdsreglen for en opgave (som MS Project-opgavetype); en egen opgavetype i et frit felt (`ExtendedAttribute`), som appen læser tilbage, og som MS Project måske ignorerer. Af dine oprindelige planer følger kun den aktive med, som oprindelig plan 0. En opgave i timer beholder sin enhed, og en milepæl beholder sin type (start, slut eller automatisk).

**Hvad følger ikke med** — noter (tjeklisten på en opgave), eksterne afhængigheder til andre projekter, opgavekoder og brugerdefinerede felter, en anden begrænsning, markeringen *Manuelt planlagt*, udjævningsforskydningen, genoptagelses- og stoppunktet for en opgave med fremdrift uden for rækkefølge, konventionerne *Resterende arbejde genoptages efter forløbet varighed* og *Flyt ikke ikke-startede opgaver til statusdatoen* i en MS Project-profil, og de andre beregningsindstillinger. Opgaver med afbrydelser uden timefordeling følger med, men uden deres afbrydelser.

**Hvad ændrer sig undervejs** — en begrænsning *Skal starte den (MSO)* eller *Skal slutte den (MFO)* uden valget *Obligatorisk (pin-logik)* bliver til *Start ikke tidligere end (SNET)* eller *Afslut ikke tidligere end (FNET)*. En hængekøje bliver en almindelig opgave med beregnede datoer.

## MS Project-fil (`.mpp`)

**Åbn** — ja, fra MS Project 2010 til og med 2021. Beregningsprofil: *Microsoft Project*. Appen læser kun filen. Den ændrer aldrig din `.mpp`. En fil fra MS Project 2007 eller ældre og en adgangskodebeskyttet fil afviser den med en melding, der peger på XML-eksporten fra MS Project.

**Gem** — nej, og der er ingen mål for gemning: *Gem* skriver en ny IFC-fil.

**Eksport** — nej.

**Hvad følger med** — opgaver med struktur, varighed og begrænsninger; afhængigheder med forsinkelse; kalendere; ressourcer og tildelinger; fremdrift; en WBS-kode, som du selv har udfyldt i MS Project. De datoer og den slæk, som MS Project selv har beregnet, læses også med, til visningen *Datoer som registreret*.

**Hvad følger ikke med** — oprindelige planer, omkostninger og standardsatser, noter og brugerdefinerede felter i MS Project. Se [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Oprindelse og licens** — `.mpp`-læseren er skrevet til Open Planner Studio og er afledt af kildekoden og strukturviden i MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), et Java-bibliotek under LGPL-2.1. Struktur og feltkonstanter er overført til TypeScript. Open Planner Studio selv er open source under LGPL-3.0. `.xer`-læseren er ikke en afledt version. MPXJ er kun brugt der som kilde til forståelse.

## Primavera P6 XML

**Åbn** — ja. Appen genkender en `.xml`-fil som P6 XML på rodelementet `APIBusinessObjects`. Beregningsprofil: *Open Planner Studio*.

**Gem** — nej.

**Eksport** — ja, som *Primavera P6 XML* (*Til Oracle Primavera P6.*). Standardnavn: projektnavnet med `.xml`. Det er det samme navn som en MS Project XML-eksport, så giv dem selv forskellige navne.

**Hvad følger med** — WBS-struktur og opgaver med varighed, datoer og fremdrift; afhængigheder med forsinkelse; begrænsninger (også en anden, som blød begrænsning); kalendere; ressourcer og tildelinger; statusdatoen (som `DataDate`); en egen opgavetype i et eget felt, `OPS Custom Task Type`, som appen læser tilbage, og som P6 måske ignorerer.

**Hvad følger ikke med** — oprindelige planer og deadlines; opgavekoder, brugerdefinerede felter, noter og eksterne afhængigheder; beregningsindstillingerne. P6 har ingen forsinkelse i procent. Appen omregner den til et fast antal dage. En forsinkelse i kalenderdage bliver en forsinkelse i arbejdstid: 3 kalenderdage bliver til 3 arbejdsdage. En hængekøje bliver en almindelig opgave, en manuelt planlagt opgave bliver en almindelig opgave med beregnede datoer, og en udjævningsforskydning på under en dag udelades.

## Primavera-fil (`.xer`)

**Åbn** — ja. Beregningsprofil: *Primavera P6*. Appen læser kun filen. Den skriver ikke `.xer` og ændrer aldrig din fil. Den åbner én fane pr. projekt med opgaver. En fil uden opgaver eller med beskadigede tabeller afviser den med en melding.

**Gem** — nej, og der er ingen mål for gemning: *Gem* skriver en ny IFC-fil med den originale `.xer` indeni.

**Eksport** — nej. Hvis du eksporterer et projekt fra en `.xer` til CSV, MS Project XML eller P6 XML, melder appen, at XER-kildeoplysninger går tabt. Det gælder også, hvis du undervejs har gemt projektet som IFC. Til IFC går intet tabt.

**Hvad følger med** — WBS-strukturen og opgaver med varighed, datoer, begrænsninger og fremdrift; afhængigheder med forsinkelse; kalendere; ressourcer med tildelinger; opgavekoder; brugerdefinerede felter (UDF'er); noter; planlægningsindstillingerne i P6. En opgave af typen *Level of Effort* bliver en hængekøje. Et projekt, der er en oprindelig plan, bliver til den aktive oprindelige plan i det projekt, der henviser til det. En afhængighed mellem to projekter bevarer appen som kildedata.

**Hvad følger ikke med** — et projekt uden opgaver, og en afhængighed mellem to projekter som en rigtig afhængighed i din tidsplan. Se [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen).

## CSV

**Åbn** — ja. Appen læser `;` og `,` som skilletegn. Den genkender kolonneoverskrifter på engelsk og nederlandsk (for eksempel `Name` eller `Naam`, `Duration` eller `Duur`, `Predecessors` eller `Voorgangers`). Datoer kan være *åååå-mm-dd*, *dd-mm-åååå* eller *dd/mm/åååå*. Du skriver en foregående opgave som WBS-kode, afhængighedstype og forsinkelse, for eksempel `1.2FS+2d`. Beregningsprofil: *Open Planner Studio*. Projektet hedder *CSV Import*. En `Task Type`, som ikke er en af de faste koder (som `CONSTRUCTION` eller `INSTALLATION`, som appen selv skriver), bliver en egen opgavetype under *Fra dette projekt*, ikke under *Mine opgavetyper*. Med `OPS Custom Task Type ID` bevares id'et for en egen opgavetype.

**Gem** — nej.

**Eksport** — ja, som *CSV (;)* (*Universel tabeleksport. Alle opgaver med datoer og varighed.*), på kortet *CSV (semikolonsepareret)*. Filen bruger semikolon som skilletegn, er i UTF-8 med BOM og har engelske kolonneoverskrifter.

**Hvad følger med** — pr. opgave disse kolonner: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` og `Description`. Færdiggørelsesgraden står i hele procenter.

**Hvad følger ikke med** — ressourcer, tildelinger, kalendere, begrænsninger, deadlines, oprindelige planer og statusdatoen. Hvis datoerne står i visningen *Datoer som registreret*, lader eksporten `Critical` og `Total Float` være tomme for opgaver, hvis kildefil ikke registrerede det.

## Fremdriftsark (Excel og CSV)

**Åbn** — ja, via *Fil › Importer* (*Opdater fremdrift fra et regneark*) eller via knappen med det navn i båndgruppen *Fremdrift* på *Tidsplan*, *Tabel* og *Rapport*. Appen læser `.xlsx` og `.csv`, op til 16 MB og 50.000 rækker. Dette åbner ikke et projekt. Det opdaterer fremdriften i dit åbne projekt. Se [Importer fremdrift fra et regneark](docs://howto-voortgang-importeren).

**Gem** — nej.

**Eksport** — ja, som *Fremdriftsark (Excel)* (*Fremdrift (Excel)* i listen) og *Fremdriftsark (CSV)* (*Fremdrift (CSV)*). Standardnavn: *projektnavn-fremdrift*. Knappen *Eksportér fremdriftsark* i samme båndgruppe laver Excel-arket med ét klik. Excel-arket har faste kolonnebredder, låste felter og datokontrol. CSV-arket har samme indhold som ren tekst.

**Hvad følger med** — kolonnerne `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` og `Actual Finish`. Når appen læser arket ind, bruger den `Completion (%)`, `Actual Start` og `Actual Finish`. `Start` og `Finish` tjener kun til at genkende datoformatet. De ændrer ikke din tidsplan. Appen kobler rækker til opgaver via `OPS Task ID`, ellers via en unik WBS-kode.

**Hvad følger ikke med** — alt uden for disse kolonner: varighed, afhængigheder, ressourcer og resten af din tidsplan. En hovedopgave får ingen fremdrift fra arket.

## PDF

**Åbn** — nej.

**Gem** — nej.

**Eksport** — ja, fra en rapport: på fanen *Rapport* knappen *Eksporter PDF*. Appen sender ikke selv en rapport til en printer. Vejen til papir går via PDF-filen. Indholdet afhænger af rapporttypen. Se [Rapporttyper](docs://ref-rapporttypes) og [Lav og udskriv en rapport](docs://howto-rapport-maken-en-afdrukken).

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor IFC er appens eget format, og hvad en eksport går glip af, med et eksempel.
- [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan): trinnene.
- [Eksport](docs://howto-exporteren): valg af format og meldingerne efter en eksport.
- [Datoer som registreret](docs://uitleg-datums-zoals-opgeslagen): hvorfor en åbnet fil kan vise andre datoer.
- [Beregningsindstillinger og konventioner](docs://ref-rekenopties-en-conventies): beregningsprofilerne.
