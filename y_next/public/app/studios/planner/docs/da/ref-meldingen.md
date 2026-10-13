# Beskeder og advarsler

Appen fortæller dig, hvad der sker, på tre steder: statuslinjen nederst, panelet *Advarsler* i højre kolonne og de beskeder, der kort vises nederst på skærmen. Denne artikel forklarer for hvert sted, hvad du ser, hvornår det vises, og hvad du kan gøre ved det. Hvorfor en tidsplan er kritisk eller overallokeret, står i [Kritisk vej og slæk](docs://uitleg-kritiek-pad). At løse overallokering står i [Løsning af overallokering](docs://howto-overbezetting-oplossen). At oprette afhængigheder står i [Oprettelse af afhængigheder](docs://howto-relaties-leggen).

## Forskellen mellem de tre

- **Statuslinje** — en fast linje med tællere. De kommer fra den sidste beregning og bliver, indtil du beregner igen.
- **Panelet *Advarsler*** — listen bag disse tællere, med alt, hvad den sidste beregning fandt. Et klik fører dig til opgaven, afhængigheden eller ressourcen. Listen er afledt af den sidste beregning; intet gemmes.
- **Beskeder** — korte beskeder om noget, du lige har gjort (gemning mislykkedes, afhængighed afvist, import læst). De forsvinder igen og er ikke med i panelet.

## Statuslinjen

Statuslinjen nederst viser fra venstre mod højre:

- **Opgaver:** — antallet af bladopgaver (hovedopgaver tæller ikke med).
- **Milepæle:** — antallet af milepæle.
- **Kritisk vej: N opgaver, N arbejdsdage** — antallet af kritiske opgaver og projektets varighed. Kun synlig efter en beregning.
- **Projektslutdato:** — projektslutdatoen fra beregningen. Kun synlig efter en beregning; et tomt projekt har ingen.
- **N deadline(r) overskredet**, **N overtrådt begrænsning(er)**, **N afhængighed(er) uden for rækkefølge** og **N ressource(r) overallokeret** — hver en knap med et advarselstegn. Hver knap er kun synlig, når tælleren er over 0, og der er en beregning. Et klik åbner panelet *Advarsler* (tooltip: *Åbn advarselspanelet (detaljer og navigation)*). Står du på fanen *IFC* eller *Rapport*, springer appen samtidig til *Start*, fordi den højre kolonne ikke findes der. Tælleren *ressource(r) overallokeret* opdateres også efter ændringer i ressourcer og tildelinger. De andre tællere ændrer sig kun efter *Beregn*. De fire tællere er et udvalg: det, panelet viser derudover (afkortet forskud, ignoreret afhængighed, hængekøje uden slutbestemmende afhængighed, begrænset slutdato, tidsplanfejl), står ikke i statuslinjen.
- **Forældet — tryk F5 for at genberegne** — med et advarselstegn (tooltip: *Tidsplan forældet — tryk F5 for at genberegne*). Den vises, så snart du ændrer noget, der påvirker tidsplanen, og du ikke har genberegnet. Hvis *Beregn automatisk* er til, vises den ikke, medmindre beregningen gav en fejl. Så vises den.
- **Valg: N opgave(r)** — antallet af valgte opgaver. Kun synlig, når du har valgt noget.
- **Skala:** og **Zoom: Npx/dag** — tidsskalaen for tidslinjen og zoomniveauet. Skalaen følger af zoomen.
- **Ikke gemt** — så længe dokumentet har ændringer, der ikke er i filen.
- **AI** — en farvet prik med ordet AI, kun når AI-tilstand er til. Tooltippen siger *AI-bro:* med *Fra*, *Aktiv på port N*, *Port N er optaget* eller *Fejl*. Et klik åbner fanen *AI*.
- **Debugterminal** — en terminalknap, kun når debugterminalen er slået til. Den viser eller skjuler terminalen (*Vis debugterminal* / *Skjul debugterminal*).

## Panelet *Advarsler*

- **Åbning** — *Tidsplan › Tidsplan › Advarsler*, *Visning › Paneler › Advarsler*, eller en tæller i statuslinjen. Panelet står i højre kolonne, under *Egenskaber* og ressourcedokken, og det udvider en sammenklappet kolonne. Som standard er det lukket, og det huskes ikke mellem sessioner. Du trækker i kanten for at ændre højden, når panelet står under andre paneler. Den højde huskes. Krydset øverst til højre lukker panelet (*Luk advarsler*).
- **Overskriftslinje** — *N fejl, N advarsel(er)*. Hvis der endnu ikke er beregnet noget, står der *Ikke beregnet endnu. Tryk på Beregn (F5) for at køre kontrollerne.*
- **Beregn** — en knap i overskriftslinjen. Den er synlig, så længe tidsplanen er forældet eller endnu ikke er beregnet. Den gør det samme som *Beregn* i båndet.
- **Advarselstegn i overskriftslinjen** — vises, når tidsplanen er forældet, med tooltip *Tidsplanen er forældet. Denne liste stammer fra den sidste beregning. Genberegn (F5).* Listen skjules ikke. Den markeres kun som forældet.
- **Tom liste** — *Ingen advarsler. Tidsplanen opfylder alle kontroller.*
- **En linje** — øverst står stedet (opgave, afhængighed, ressource eller projekt), og under det står beskrivelsen. En fejl har et eget ottekantet tegn, og en advarsel et trekantet tegn. En opgave vises som `WBS-navn`. En afhængighed vises som `foregående opgave → efterfølgende opgave (FS+2d)`, med type og forsinkelse. Et klik går til stedet (tooltip: *Gå til: …*), se nedenfor. Linjen, der hører til din aktive opgave (for en afhængighed: den efterfølgende opgave) eller til den ressource, der er valgt i histogrammet, er fremhævet.
- **Rækkefølge** — fejl kommer først. Derefter kommer de pr. type i rækkefølgen på listen nedenfor. Inden for en type gælder dokumentets rækkefølge. For en afhængighed gælder den efterfølgende opgaves position, og for en ressource gælder ressourcelistens rækkefølge. En opgave, afhængighed eller ressource, der er slettet efter den sidste beregning, forsvinder fra listen.

### Typer advarsler

- **Tidsplanfejl** — *Tidsplanen kunne ikke beregnes: …* med årsagen efter, se nedenfor. Et klik: ved en cyklus vælger appen alle opgaver i cyklussen og springer til den første. Ved andre fejl er der intet at springe til, og linjen er ikke en knap.
- **Deadline overskredet** — *Deadline {date} overskredet. Tidligste slutdato {date}*. Opgaven har en deadline, og beregningen overholder den ikke. Et klik springer til opgaven. For at løse det: ret logikken eller varigheden, eller flyt deadlinen.
- **Overtrådt begrænsning** — *Begrænsning {type and date} overstyres af logikken (negativ slæk)*. Begrænsningen kan ikke overholdes uden at bryde logikken, og slækken er negativ. Et klik springer til opgaven. Se [Begrænsninger](docs://uitleg-constraints).
- **Fremdrift uden for rækkefølge** — *Uden for rækkefølge: fremdriften i den efterfølgende opgave strider mod afhængigheden*. Fremdriften i den efterfølgende opgave passer ikke til afhængighedens type. Et eksempel er en efterfølgende opgave, der allerede er i gang, mens den foregående opgave endnu ikke er færdig, under en afhængighed af typen slut til start. Et klik vælger begge opgaver, med den efterfølgende opgave aktiv. Kontrollér de faktiske datoer eller afhængigheden.
- **Forskud afkortet** — *Forskud afkortet af projektstartdatoen. Afhængigheden er ikke fuldt udnyttet*. Forskuddet i afhængigheden går før projektstartdatoen. Et klik vælger begge opgaver.
- **Afhængighed ignoreret** — *Afhængighed ignoreret: foregående opgave eller efterfølgende opgave mangler, eller er ikke en bladopgave*. Beregningen bruger ikke afhængigheden. Et klik vælger de opgaver, der stadig findes. Se [Afhængigheder](docs://uitleg-relaties).
- **Hængekøje uden slutbestemmende afhængighed** — *Hængekøje uden slutbestemmende afhængighed (ingen FF/SF-foregående opgave). Varigheden sættes til nul*. Et klik springer til opgaven. Se [Hængekøjeopgaver](docs://howto-hammock).
- **Slutdato begrænset** — *Slutdato begrænset: kalenderen efterlader ingen brugbar periode for opgaven*. Beregningen nåede grænsen for det antal dage, den søger igennem. Det kan ske, for eksempel når kalenderen har en meget lang, sammenhængende periode med fridage. Et klik springer til opgaven. Se [Kalendere og arbejdsdage](docs://uitleg-kalenders).
- **Overallokering** — *Overallokeret på N dag(e) (første – sidste)*, med *ressourcen arbejder ikke disse dage ifølge sin kalender* tilføjet, hvis alle dagene er fridage. Ved en blanding står der i stedet *hvoraf N dag(e) ressourcen ikke arbejder ifølge sin kalender*. Et klik vælger opgaverne med en tildeling på den ressource, slår histogrammet til og vælger ressourcen i det. Fra *Tabel*, *IFC* eller *Rapport* springer appen til *Ressourcer*. Se [Ressourcepanel](docs://ref-resourcepaneel).

### Årsager til en tidsplanfejl

- *Cirkulær afhængighed mellem opgaver: {path}* — afhængighederne danner en cyklus. Opgaverne står i stien. Vend eller fjern én afhængighed.
- *Kalenderen har ingen arbejdsdage angivet* — giv kalenderen mindst én arbejdsdag. Se [Kalendervinduer](docs://ref-kalenders).
- *Ugyldig varighed i dage for opgave '{task}'* og *Ugyldig varighed i timer for opgave '{task}'* — opgavens varighed er ikke et gyldigt tal.
- *Timeopgave '{task}' har ingen gyldige arbejdstimer i sin kalender* — en opgave i timer i en kalender uden arbejdstimer.
- *Ugyldig startdato for opgave '{task}'* — opgavens startdato er ikke gyldig.

## Meddelelser

Meddelelser vises nederst på skærmen, også i tabellen, i Backstage og i præsentationstilstand. En meddelelse er en *fejl* eller *info*. En fejl forbliver, til du klikker den væk. En info forsvinder efter 5 sekunder. Timerne starter forfra, så snart stakken ændrer sig. Et klik på en meddelelse lukker den (hjælpetekst *Luk meddelelse*). Der vises højst tre ad gangen. Kommer der en fjerde, forsvinder den ældste info først. Er der ingen info, forsvinder den ældste meddelelse. Så skubbes en fejl aldrig væk af en info. Stakken flytter sig væk fra knapperne i en åben dialog og fra faste handlingslinjer.

- **Tæller ×N** — en meddelelse med en fast nøgle samler gentagelser i én linje med en tæller, fx en gemmefejl, der bliver ved med at komme igen, eller en afvist afhængighed, som du gentager. Ikke alle meddelelser gør det.
- **Læs mere** — nogle meddelelser har et link *Læs mere* eller et eget emne (fx *Arbejdsregler forklaret*) til vejledningen i Backstage › Hjælp.
- **Handlingsknap** — meddelelsen om beregningsprofilen har en knap *Åbn beregningsprofil*, der fører til projektinfo.

Listen nedenfor er et udvalg, grupperet efter emne. Hvor der ikke står andet, er det en info.

### Gemning, åbning og genoprettelse

- **Gemning mislykkedes** (fejl) — *Kunne ikke gemme* med årsagen under den. Ved gemning, gem som og eksport af en rapport.
- **Gemt som download** (info) — *Gemt som download: '{name}' ligger nu i din downloadmappe. …* Med *Gem som* og ved eksport, når miljøet ikke lader appen skrive direkte til den placering, du valgte. To downloads lige efter hinanden samles i én linje.
- **Gemt som download (forklaring)** (info) — *Gemt som download: '{name}' ligger i din downloadmappe. Denne browser lader ikke appen skrive til en egen placering, …* Med *Gem* i en browser, der kun gemmer via en download. Én gang pr. session, med et link til forklaringen af filer.
- **Browser skriver ikke tilbage** (info) — *Denne browser lader ikke appen skrive tilbage til '{name}'. …* Med *Gem* for et projekt med en fil, når browseren skal spørge om en placering igen. Én gang pr. session, med et link til forklaringen af filer.
- **Automatisk gem mislykkedes** (fejl) — *Automatisk gem mislykkedes* med årsagen. Gælder for automatisk gemning til filen og for genoprettelse efter nedbrud.
- **Biblioteket kunne ikke gemmes** (fejl) — *Biblioteket kunne ikke gemmes*, når du gemmer ressourcebiblioteket.
- **Åbning af fil mislykkedes** (fejl) — *Kunne ikke åbne filen* med årsagen. Fx ved en nylig fil eller en importeret fil.
- **Gammel eller beskyttet .mpp** (fejl) — *Denne .mpp-fil bruger et ældre format (Project 2007 eller tidligere)…* eller *Denne .mpp-fil er beskyttet med adgangskode…*, begge med rådet om at eksportere som XML i MS Project og åbne den fil.
- **Ugyldig XER-fil** (fejl) — en af de *XER…*-tekster, fx *Dette er ikke en gyldig eller understøttet XER-fil.* eller *XER-filen indeholder en tabel to gange.*, med årsagen tilføjet.
- **IFC kunne ikke læses** (fejl) — *IFC kunne ikke læses* med årsagen, i IFC-visningen.
- **Genoprettelse** (fejl) — *Den genoprettede fil kunne ikke læses*, *Gendannelse mislykkedes* og *N genoprettelsesfiler kunne ikke indlæses og blev sprunget over.* Ved genoprettelse efter en uventet lukning af appen.
- **Gren gemt som skabelon** (info) — *Gren gemt som skabelon '{name}'*.
- **Besked fra en udvidelse** (info, eller fejl, hvis udvidelsen melder en fejl) — *Udvidelse {name}: {message}*. En udvidelse kan vise højst tre nye pr. 10 sekunder, så den ikke fylder stakken. Fejler et trin i en udvidelses vejledning, står der *Et trin fra udvidelsen {name} gav en fejl. Vejledningen fortsætter.* Kan en projektfil fra en udvidelse ikke åbnes, står der *Projektfilen {file} fra udvidelsen {name} kunne ikke åbnes.* Begge er fejl.
- **En ændring kom ind imellem** (info) — *En ændring fra AI-assistenten eller en udvidelse kom ind imellem. …* Når du annullerer opgavedialogen, mens AI-assistenten eller en udvidelse har ændret noget i mellemtiden, bliver opgaveredigeringerne fra før den ændring ikke rullet tilbage. De bliver stående som almindelige trin under *Fortryd*.

### Beregning

- **Tidsplanen kunne ikke beregnes** (fejl) — *Tidsplanen kunne ikke beregnes* med årsagen under den (se *Årsager til tidsplanfejl*). Ved *Beregn*, når du skifter dokument, og når du åbner en fil.
- **Statusdato sat til i dag** (info) — *Der var endnu ingen statusdato. Den er nu sat til i dag ({date}), fordi fremdrift måles op til statusdatoen. Du kan ændre den under Tidsplan → Statusdato.* Når du angiver fremdrift i et projekt uden statusdato.
- **Varighed kortere end det udførte arbejde** (info) — *‘{name}’ er allerede {N}% gennemført. En varighed, der er kortere end det gennemførte arbejde, er ikke mulig. Varigheden er ikke ændret.*

### Afhængigheder og hierarki

- **Afhængighed oprettet** (info) — *Afhængighed oprettet: {predecessor} → {successor}*.
- **Afhængighed afvist** (info) — *Denne afhængighed findes allerede*, *En afhængighed mellem en opgave og dens egen (over)ordnede hovedopgave er ikke tilladt.* eller *Denne afhængighed ville skabe en cyklus i tidsplanen ({cycle}), og den er ikke oprettet.* Cyklussen nævner opgaverne, så du ved, hvilken afhængighed du skal fjerne eller vende først.
- **Flytning afvist** (info) — *Denne flytning ville skabe en cyklus i tidsplanen ({cycle}): afhængighederne for en hovedopgave gælder også for dens underopgaver. Der er ikke ændret noget.*
- **Afhængigheder falder ud efter en flytning** (info) — *Efter flytningen forbinder N afhængigheder en opgave med sin egen hovedopgave; de tæller ikke længere med i beregningen.*
- **Afhængigheder sprunget over ved indsættelse** (info) — *N afhængigheder blev ikke oprettet: ugyldig forbindelse…*, når du indsætter eller tilføjer en gren.
- **Afhængigheder ikke medregnet efter import** (info) — *N afhængighed(er) kunne ikke medregnes. Tjek kolonnerne Foregående opgaver og Efterfølgende opgaver.*
- **Dublerede id'er efter import** (info) — *Objekter med et dubleret id i denne fil: N. De fik hvert sit eget id…*

### Redigering af opgaver

- **Start gemt som begrænsning** (info) — *'{name}' har en foregående opgave: den nye start er nu begrænsningen Start ikke tidligere end (SNET) {date}. Efter genberegning (F5) starter opgaven ikke før den dato.* Når du ændrer starten på en opgave med en foregående opgave. Havde opgaven allerede en sådan begrænsning, siger meddelelsen, at den er flyttet. Ved flere opgaver på én gang vises et antal.
- **Start ikke anvendt** (info) — *Den nye start for '{name}' blev ikke anvendt: opgaven har en foregående opgave, og begrænsningen {type} {date} bestemmer dens start. Ændr begrænsningen, hvis starten skal ændres.*
- **Milepæl afvist** (info) — *'{task}' har ressource-tildelinger og kan ikke blive en milepæl. Slet tildelingerne først.* eller *'{task}' er en hovedopgave med underopgaver og kan ikke blive en milepæl.* Ved omdannelse i opgavedialogen, i egenskabspanelet, i genvejsmenuen og i tabellen.
- **Tildelinger flyttet til en underopgave** (info) — *Tildelingen af {resources} er overført fra '{phase}' til den nye underopgave '{child}'. En hovedopgave har selv ingen tildelinger.* Når en opgave med tildelinger får underopgaver.
- **Milepælsmarkering fjernet** (info) — *Milepælen '{phase}' har nu underopgaver og er blevet en hovedopgave. Milepælsmarkeringen er fjernet.*
- **Hovedopgave afvist** (info) — *'{phase}' kan ikke blive en hovedopgave: …* med årsagen, og *Der er ikke ændret noget.*
- **Celler sprunget over ved indsættelse** (info) — *N celler sprunget over: de er skrivebeskyttede (fx en automatisk nummereret WBS-kode eller en beregnet kolonne).*
- **Referencer ryddet ved indsættelse** (info) — *N referencer fandtes ikke i dette dokument og er ryddet (opgavekalendere, egne opgavetyper, activity codes eller brugerdefinerede felter fra kildedokumentet).*
- **Arbejdsregel tilpassede varigheder** (info) — *Efter ændringen af kalenderen har arbejdsreglen tilpasset varigheden af N opgaver (arbejdet bliver, timer pr. dag ændrede sig).* Med et link *Arbejdsregler forklaret*.

### Primavera (XER)

- **XER-fil åbnet** (info) — *XER-fil åbnet: N projektdokumenter.* Én meddelelse pr. fil, også når filen åbner flere projekter, med et link *Læs mere* og detaljelinjer under den. Altid *N projekter fundet.* Kun når antallet er over 0: *N tomme projekter sprunget over.*, *N projekter med oprindelig plan udeladt.*, *N oprindelige planer materialiseret.*, *N løse henvisninger til oprindelig plan ignoreret.*, *Der blev brugt en beskyttende reserve for den oprindelige plan.* og *N eksterne afhængigheder bevaret.* Kun for en anden tegnkodning end UTF-8: *Tegnkodning valgt: {encoding}.* Desuden, når antallet er over 0: *N parserfund.*, *N kalenderfund.*, *N problemer med talformat.*, *N værdier med reserveværdi.* og *N P6-planindstillinger brugte en sikker reserve.*
- **Datoer som Primavera gemte dem** (detaljelinje i samme meddelelse) — *N opgaver viser datoerne, som Primavera gemte dem (ikke genberegnet).*, eller, hvis tilstanden ikke blev slået til, *N opgaver afviger fra datoerne i filen — du kan vise dem.*
- **XER-kildearkiv ubrugeligt** (info) — *XER-kildearkivet i denne fil er ubrugeligt og er udeladt. Selve projektet er fuldt åbnet.* med årsagen (fx *Årsag: kontrolsummen passer ikke til kildebytes. Arkivet er beskadiget.*) og konsekvensen (*Tidsplanen, beregningsprofilen og alle projektdata fra IFC er komplette. …*). Når du åbner en IFC-fil, hvor et tidligere gemt XER-kildearkiv ikke kan bruges.
- **Eksport mister XER-oplysninger** (info) — *Ved eksport til {format} går XER-kildeoplysninger tabt.* Efter en vellykket eksport til et andet format end IFC af et projekt med data, der kun findes i en XER-fil. Med et link *Læs mere*.

### Import, eksport og beregningsprofil

- **Datoer som i filen** (info) — *N opgaver viser datoerne, som de står i filen (ikke genberegnet).* eller *N opgaver afviger fra datoerne i filen — du kan vise dem.* Når du åbner en fil med gemte datoer.
- **Arbejde og arbejdsregler synlige** (info) — *Denne fil indeholder gemt arbejde eller egne arbejdsregler; arbejdsreglen og det resterende arbejde vises for dette projekt.*
- **MS Project-tidsplan læst** (info) — *Denne MS Project-fil indeholder N opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan. De indlæses og vises sådan.*
- **Afbrydelser ikke eksporteret** (info) — *N opgaver med afbrydelser er eksporteret uden afbrydelser: MS Project og P6 kender afbrydelser kun som fordeling af arbejde.* Ved eksport til MS Project eller Primavera.
- **Projektstartdato forskudt** (info) — *Projektstartdato forskudt: N opgaveankre uden foregående opgave eller begrænsning er forskudt med til den nye startdato.*
- **Datovindue styrer ikke længere** (info) — *MS Projects datovindue styrer ikke længere N opgaver efter denne redigering; …* Én gang pr. dokument.
- **Udjævningsforskydning afrundet** (info) — *Udjævning runder MS Projects minutpræcise udjævningsforskydning for N opgaver af til hele arbejdsdage.* Én gang pr. dokument.
- **Beregningsprofil anvendt** (info) — *Dette projekt beregnes som {profile}. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger.* Med knappen *Åbn beregningsprofil*. Efter anvendelse af en profil følger *Efter anvendelsen er N opgaver forskudt.*, hvis det er nødvendigt.
