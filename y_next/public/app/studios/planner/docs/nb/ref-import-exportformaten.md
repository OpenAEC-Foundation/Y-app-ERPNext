# Import- og eksportformater

Per filformat: om du kan åpne, lagre og eksportere det, hva som følger med og hva som ikke gjør det, og med hvilken beregningsprofil det åpnes. Begrunnelsen og et eksempel med tall står i [Filer og formater](docs://uitleg-bestanden).

## Kort oversikt

**Åpning** fungerer med IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` og `.xer`. En fil med en annen filendelse behandles av appen som IFC.

**Lagring** skriver alltid IFC. Bare en åpnet IFC-fil blir lagringsmål. Et prosjekt fra et annet format har ingen fil etter åpning, og *Lagre* spør da hvor IFC-filen skal lagres.

**Eksportering** går til IFC 4x3, MS Project XML, Primavera P6 XML, CSV og to fremdriftsark (Excel og CSV). En eksport endrer ikke prosjektet ditt.

**Skrivebeskyttet** er `.mpp` og `.xer`: appen kan åpne dem, ikke skrive dem.

**PDF** kommer bare fra en rapport (se [Rapporttyper](docs://ref-rapporttypes)). Appen leser ikke PDF.

**Hvor.** Åpne: *Hjem › Fil › Åpne*, *Fil › Åpne* eller Ctrl+O. Eksporter: *Hjem › Fil › Eksporter* eller *Fil › Eksporter*. Du leser et utfylt fremdriftsark inn via *Fil › Importer*, eller med knappen *Oppdater fremdrift fra et regneark* i gruppen *Fremdrift* på fanene *Tidsplan*, *Tabell* og *Rapport* på båndet.

**Beregningsprofil ved åpning.** Alle formater åpnes med en beregningsprofil. Hva den er, står i [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies). `.xer` åpnes med *Primavera P6*, `.mpp` med *Microsoft Project*, og CSV, MS Project XML og P6 XML med *Open Planner Studio*. IFC beholder beregningsprofilen som er lagret i filen. For `.xer` og `.mpp` melder appen at prosjektet beregnes på denne måten. Bare IFC bærer beregningsprofilen og beregningsalternativene. Av beregningsalternativene skriver MS Project XML høyst den kritiske terskelverdien. En gjenåpnet eksport av et annet format bruker beregningsprofilen *Open Planner Studio*.

## IFC

**Åpning** — ja, `.ifc`. Appen leser IFC 4.3. Beregningsprofil: den som står i filen.

**Lagring** — ja, og det er det eneste formatet som kan lagres. *Lagre* skriver hele prosjektet ditt som en IFC-fil. Filen blir lagringsmål.

**Eksport** — ja, som *IFC 4x3* (beskrevet som *BuildingSMART-standard. Kobler 4D-data til BIM-modeller.*). Standardnavn: prosjektnavnet med filendelsen `.ifc`. Er prosjektet koblet til et bibliotek, står avkrysningsboksen *Lagre bibliotekfilen ved siden av* under kortene i *Fil › Eksporter*. Når den er avkrysset, ber appen om et sted for *projectname-bibliotheek.ifc*, oppkalt etter prosjektet. Avkrysningsboksen står ikke i listen på fanen *Hjem*.

**Hva følger med** — alt som hører til prosjektet: aktiviteter med struktur, varighet, datoer og fremdrift; avhengigheter med forsinkelse; begrensninger og tidsfrister; kalendere; ressurser og tilordninger, inkludert fordelingen på timer; grunnlinjer; aktivitetskoder og egendefinerte felt; notater; koblinger mellom prosjekter; avbrudd; arbeidsregler og aktivitetstyper; prosjektinnstillingene, som statusdato, fremdriftsmodus, beregningsprofil og beregningsalternativer; koblingen til et bibliotek. For et prosjekt fra en `.xer` følger også den opprinnelige kildefilen med. En egen aktivitetstype lagres som IFC-typen `USERDEFINED`, med navnet i feltet ObjectType. Andre IFC-programmer leser aktiviteten dermed normalt. Appen beholder også den faste ID-en til typen, så et nytt navn bryter ikke koblingen. Hvis noen åpner filen på en annen datamaskin, vises typen der under *Fra dette prosjektet*, ikke i deres egne *Mine aktivitetstyper*.

**Hva følger ikke med** — hvordan du har satt opp skjermen (zoom, rulleposisjon, valgt aktivitet, sammenfoldede faser, valgt filter og gruppering) og appinnstillingene ([Innstillinger](docs://ref-instellingen)). Fanen *IFC* viser IFC-teksten for prosjektet ditt.

## MS Project XML (MSPDI)

**Åpning** — ja. Appen gjenkjenner en `.xml`-fil som MS Project XML på rotelementet `Project` i MS Project-navnerommet (eller uten navnerom). Beregningsprofil: *Open Planner Studio*.

**Lagring** — nei. Et slikt prosjekt får ikke noe lagringsmål.

**Eksport** — ja, som *MS Project XML* (*Åpnes i Microsoft Project. Fullstendig WBS-struktur.*). Standardnavn: prosjektnavnet med `.xml`.

**Hva følger med** — aktiviteter med struktur (nivå og WBS), varighet, datoer og fremdrift; avhengigheter med forsinkelse, også i timer eller prosent; begrensninger, inkludert tidsfristen; kalendere, inkludert aktivitets- og ressurskalendere; ressurser og tilordninger, inkludert kurven eller fordelingen på timer; statusdatoen; den kritiske terskelverdien, som et heltall på 0 eller mer arbeidsdager, med *Totalslakk ≤ terskelverdi*; beskrivelsen av en aktivitet (som notat); arbeidsregelen for en aktivitet (som MS Project-aktivitetstype); en egen aktivitetstype, i et fritt felt (`ExtendedAttribute`) som appen leser tilbake, og som MS Project kan ignorere. Av grunnlinjene følger bare den aktive med, som grunnlinje 0. En aktivitet i timer beholder enheten sin, og en milepæl beholder typen sin (start, slutt eller automatisk).

**Hva følger ikke med** — notater (sjekklisten på en aktivitet), koblinger mellom prosjekter, aktivitetskoder og egendefinerte felt, en andre begrensning, merket *Manuelt planlagt*, utjevningsforsinkelsen, gjenopptaks- og stoppunktet for en aktivitet med fremdrift utenfor rekkefølge, beregningsreglene *Gjenstående arbeid fortsetter etter forløpt tid* og *Ikke-startede aktiviteter flyttes ikke til statusdatoen* i en MS Project-beregningsprofil, og de andre beregningsalternativene. Avbrutte aktiviteter uten fordeling på timer følger med, men uten sine avbrudd.

**Hva endres underveis** — en begrensning *Må starte på (MSO)* eller *Må slutte på (MFO)* uten valget *Obligatorisk (fastlåsing)* blir *Start ikke tidligere enn (SNET)* eller *Slutt ikke tidligere enn (FNET)*. En hengekøye blir en vanlig aktivitet med beregnede datoer.

## MS Project-fil (`.mpp`)

**Åpning** — ja, fra MS Project 2010 til 2021. Beregningsprofil: *Microsoft Project*. Appen leser bare filen: den endrer aldri `.mpp`-filen din. En fil fra MS Project 2007 eller eldre, og en passordbeskyttet fil, avvises med en melding som viser til XML-eksporten fra MS Project.

**Lagring** — nei, og det finnes ingen lagringsmål: *Lagre* skriver en ny IFC-fil.

**Eksport** — nei.

**Hva følger med** — aktiviteter med struktur, varighet og begrensninger; avhengigheter med forsinkelse; kalendere; ressurser og tilordninger; fremdrift; en WBS-kode som du selv har fylt inn i MS Project. Datoene og slakket som MS Project selv har beregnet, leses også inn, for visningen *Registrerte datoer*.

**Hva følger ikke med** — grunnlinjer, kostnader og standardsatser, notater og egendefinerte felt i MS Project. Se [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen).

**Opprinnelse og lisens** — leseren for `.mpp` er skrevet for Open Planner Studio og er avledet av kildekoden og strukturkunnskapen til MPXJ (`github.com/joniles/mpxj`, Jon Iles et al.), et Java-bibliotek under LGPL-2.1. Struktur og feltkonstanter er overført til TypeScript. Open Planner Studio selv er åpen kildekode under LGPL-3.0. Leseren for `.xer` er ikke en avledet versjon: MPXJ ble bare brukt der som kilde til forståelse.

## Primavera P6 XML

**Åpning** — ja. Appen gjenkjenner en `.xml`-fil som P6 XML på rotelementet `APIBusinessObjects`. Beregningsprofil: *Open Planner Studio*.

**Lagring** — nei.

**Eksport** — ja, som *Primavera P6 XML* (*For Oracle Primavera P6.*). Standardnavn: prosjektnavnet med `.xml`, altså samme navn som en eksport til MS Project XML. Gi dem selv forskjellige navn.

**Hva følger med** — WBS-struktur og aktiviteter med varighet, datoer og fremdrift; avhengigheter med forsinkelse; begrensninger (også en andre, som en myk begrensning); kalendere; ressurser og tilordninger; statusdatoen (som `DataDate`); en egen aktivitetstype, i et separat felt, `OPS Custom Task Type`, som appen leser tilbake, og som P6 kan ignorere.

**Hva følger ikke med** — grunnlinjer og tidsfrister; aktivitetskoder, egendefinerte felt, notater og koblinger mellom prosjekter; beregningsalternativene. P6 har ingen forsinkelse i prosent: appen gjør den om til et fast antall dager. En forsinkelse i kalenderdager blir en forsinkelse i arbeidstid: 3 kalenderdager blir 3 arbeidsdager. En hengekøye blir en vanlig aktivitet. En manuelt planlagt aktivitet blir en vanlig aktivitet med beregnede datoer. En utjevningsforsinkelse på mindre enn en dag faller bort.

## Primavera-fil (`.xer`)

**Åpning** — ja. Beregningsprofil: *Primavera P6*. Appen leser bare filen: den skriver ikke `.xer` og endrer aldri filen din. Den åpner én fane per prosjekt med aktiviteter. En fil uten aktiviteter, eller med skadede tabeller, avvises med en melding.

**Lagring** — nei, og det finnes ingen lagringsmål: *Lagre* skriver en ny IFC-fil, med den opprinnelige `.xer` inni.

**Eksport** — nei. Eksporterer du et prosjekt fra en `.xer` til CSV, MS Project XML eller P6 XML, melder appen at XER-kildeinformasjon går tapt. Det gjelder også om du lagret prosjektet som IFC underveis. Til IFC går ingenting tapt.

**Hva følger med** — WBS-strukturen og aktiviteter med varighet, datoer, begrensninger og fremdrift; avhengigheter med forsinkelse; kalendere; ressurser med tilordninger; aktivitetskoder; egendefinerte felt (UDF-er); notater; innstillingene for tidsplanlegging i P6. En aktivitet av typen *Level of Effort* blir en hengekøye. Et grunnlinjeprosjekt blir den aktive grunnlinjen i prosjektet som refererer til det. En kobling mellom prosjekter lagrer appen som kildedata.

**Hva følger ikke med** — et prosjekt uten aktiviteter, og en kobling mellom prosjekter som en ekte avhengighet i tidsplanen din. Se [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen).

## CSV

**Åpning** — ja. Appen leser `;` og `,` som skilletegn. Den gjenkjenner kolonneoverskrifter på engelsk og nederlandsk (for eksempel `Name` eller `Naam`, `Duration` eller `Duur`, `Predecessors` eller `Voorgangers`). Datoer kan være *åååå-mm-dd*, *dd-mm-åååå* eller *dd/mm/åååå*. Du skriver en forgjenger som WBS-kode, avhengighetstype og forsinkelse, for eksempel `1.2FS+2d`. Beregningsprofil: *Open Planner Studio*. Prosjektet heter *CSV Import*. En `Task Type` som ingen av de faste kodene er (som `CONSTRUCTION` eller `INSTALLATION`, som appen skriver selv), blir en egen aktivitetstype under *Fra dette prosjektet*, ikke under *Mine aktivitetstyper*. Med `OPS Custom Task Type ID` beholdes ID-en til en egen type.

**Lagring** — nei.

**Eksport** — ja, som *CSV (;)* (*Universell tabelleksport. Alle aktiviteter med datoer og varighet.*), på kortet *CSV (semikolonseparert)*. Filen bruker semikolon som skilletegn, er i UTF-8 med BOM og har engelske kolonneoverskrifter.

**Hva følger med** — per aktivitet disse kolonnene: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` og `Description`. Fullføringsgraden står i hele prosent.

**Hva følger ikke med** — ressurser, tilordninger, kalendere, begrensninger, tidsfrister, grunnlinjer og statusdatoen. Er datoene i visningen *Registrerte datoer*, lar eksporten `Critical` og `Total Float` stå tomme for aktiviteter som kildefilen ikke registrerte.

## Fremdriftsark (Excel og CSV)

**Åpning** — ja, via *Fil › Importer* (*Oppdater fremdrift fra et regneark*) eller via knappen med samme navn i gruppen *Fremdrift* på *Tidsplan*, *Tabell* og *Rapport*. Appen leser `.xlsx` og `.csv`, opptil 16 MB og 50 000 rader. Dette åpner ikke et prosjekt: det oppdaterer fremdriften i prosjektet ditt som er åpent. Se [Importere fremdrift fra et regneark](docs://howto-voortgang-importeren).

**Lagring** — nei.

**Eksport** — ja, som *Fremdriftsark (Excel)* (*Fremdrift (Excel)* i listen) og *Fremdriftsark (CSV)* (*Fremdrift (CSV)*). Standardnavn: *projectname-voortgang*. Knappen *Eksporter fremdriftsark* i samme gruppe på båndet lager Excel-arket med ett klikk. Excel-arket har faste kolonnebredder, låste felt og datokontroll. CSV-arket har samme innhold som ren tekst.

**Hva følger med** — kolonnene `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` og `Actual Finish`. Ved innlesing bruker appen `Completion (%)`, `Actual Start` og `Actual Finish`. `Start` og `Finish` brukes bare til å gjenkjenne datonotasjonen, og de endrer ikke tidsplanen din. Appen kobler rader til aktiviteter via `OPS Task ID`, ellers via en unik WBS-kode.

**Hva følger ikke med** — alt utenfor disse kolonnene: varighet, avhengigheter, ressurser og resten av tidsplanen din. En hovedaktivitet får ingen fremdrift fra arket.

## PDF

**Åpning** — nei.

**Lagring** — nei.

**Eksport** — ja, fra en rapport: på fanen *Rapport* knappen *Eksporter PDF*. Appen sender ikke selv en rapport til en skriver. Veien til papir går via PDF-filen. Innholdet avhenger av rapporttypen: se [Rapporttyper](docs://ref-rapporttypes) og [Lage og skrive ut en rapport](docs://howto-rapport-maken-en-afdrukken).

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor IFC er ditt eget format, og hva en eksport mister, med et eksempel.
- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): stegene.
- [Eksportere](docs://howto-exporteren): velge et format, og meldingene etter en eksport.
- [Registrerte datoer](docs://uitleg-datums-zoals-opgeslagen): hvorfor en åpnet fil kan vise andre datoer.
- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): beregningsprofilene.
