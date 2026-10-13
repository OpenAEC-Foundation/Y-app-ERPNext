# Meldinger og advarsler

Appen viser deg hva som skjer på tre steder: statuslinjen nederst, panelet *Advarsler* i høyre kolonne og meldingene som vises kort nederst på skjermen. Denne artikkelen forklarer for hvert sted hva du ser, når det vises og hva du kan gjøre. Hvorfor en tidsplan er kritisk, og hvorfor en ressurs har overallokering, står i [Kritisk linje og slakk](docs://uitleg-kritiek-pad). Løsing av overallokering står i [Løse overallokering](docs://howto-overbezetting-oplossen). Å lage avhengigheter står i [Lage avhengigheter](docs://howto-relaties-leggen).

## Forskjellen mellom de tre

- **Statuslinjen** — en fast linje med tellere. De kommer fra siste beregning og blir stående til du beregner på nytt.
- **Panelet *Advarsler*** — listen bak disse tellerne, med alt den siste beregningen fant. Et klikk tar deg til aktiviteten, avhengigheten eller ressursen. Den er hentet fra siste beregning; ingenting lagres.
- **Meldinger** — korte beskjeder om noe du nettopp gjorde (lagring mislyktes, avhengighet avvist, import lest). De forsvinner igjen og er ikke med i panelet.

## Statuslinjen

Statuslinjen nederst viser, fra venstre mot høyre:

- **Aktiviteter:** — antall bladaktiviteter (hovedaktiviteter telles ikke med).
- **Milepæler:** — antall milepæler.
- **Kritisk linje: N aktiviteter, N arbeidsdager** — antall kritiske aktiviteter og prosjektets varighet. Vises bare etter en beregning.
- **Slutt:** — prosjektslutten fra beregningen. Vises bare etter en beregning; et tomt prosjekt har ingen.
- **N tidsfrist(er) oversett**, **N brutt begrensning(er)**, **N avhengighet(er) med fremdrift utenfor rekkefølge** og **N ressurs(er) med overallokering** — hver en knapp med et advarselsymbol. De vises bare når telleren er over 0 og det finnes en beregning. Et klikk åpner panelet *Advarsler* (verktøytips: *Åpne advarselspanelet (detaljer og navigasjon)*). Hvis du er på fanen *IFC* eller *Rapport*, hopper appen samtidig til *Hjem*, fordi høyre kolonne ikke finnes der. Telleren for *ressurs(er) med overallokering* oppdateres også etter endringer i ressurser og tilordninger. De andre tellerne endrer seg først etter *Beregn*. De fire tellerne er et utvalg: det panelet viser i tillegg (kappet ledetid, ignorert avhengighet, hengekøye uten sluttstyrende avhengighet, kappet sluttdato, tidsplanfeil) står ikke på statuslinjen.
- **Utdatert — omberegn (F5)** — med et advarselsymbol (verktøytips: *Tidsplanen er utdatert — trykk F5 for å omberegne*). Den vises så snart du endrer noe som påvirker tidsplanen og ikke har omberegnet. Hvis innstillingen *Beregne automatisk* er på, holder den seg borte. Unntaket er når beregningen ga en feil. Da blir den stående.
- **Valg: N aktivitet(er)** — antall valgte aktiviteter. Vises bare når du har et valg.
- **Skala:** og **Zoom: Npx/dag** — tidsskalaen for tidslinjen og zoomnivået. Skalaen følger av zoomen.
- **Ikke lagret** — så lenge dokumentet har endringer som ikke er i filen.
- **AI** — en farget prikk med ordet AI, bare når AI-modus er på. Verktøytipset viser *AI-bro:* med *Av*, *Aktiv på port N*, *Port N i bruk* eller *Feil*. Et klikk åpner fanen *AI*.
- **Feilsøkingsterminal** — en terminalknapp, bare når feilsøkingsterminalen er slått på. Den viser eller skjuler terminalen (*Vis feilsøkingsterminal* / *Skjul feilsøkingsterminal*).

## Panelet *Advarsler*

- **Åpning** — *Tidsplan › Tidsplan › Advarsler*, *Visning › Paneler › Advarsler*, eller en teller på statuslinjen. Panelet ligger i høyre kolonne, under *Egenskaper* og ressursdokken, og det åpner en sammenklappet kolonne. Som standard er det lukket, og det huskes ikke mellom økter. Når det står under andre paneler, drar du høyden i kanten. Den høyden huskes. Krysset øverst til høyre lukker det (*Lukk advarsler*).
- **Overskriftslinje** — *N feil, N advarsel(er)*. Hvis ingenting er beregnet ennå, står det *Ikke beregnet ennå — trykk på Beregn (F5) for å kjøre kontrollene*.
- **Beregn** — en knapp i overskriftslinjen. Den vises så lenge tidsplanen er utdatert eller ikke er beregnet ennå. Den gjør det samme som *Beregn* i båndet.
- **Advarselsymbol i overskriftslinjen** — når tidsplanen er utdatert, med verktøytipset *Tidsplanen er utdatert — denne listen kommer fra siste beregning. Omberegn (F5)*. Listen skjules ikke. Den merkes bare som utdatert.
- **Tom liste** — *Ingen advarsler. Tidsplanen klarer alle kontrollene*.
- **En linje** — øverst står stedet (aktivitet, avhengighet, ressurs eller prosjekt), og under det beskrivelsen. En feil har et eget åttekantet symbol, en advarsel et trekantet symbol. En aktivitet vises som `WBS-navn`. En avhengighet vises som `forgjenger → etterfølger (FS+2d)`, med type og forsinkelse. Et klikk tar deg til stedet (verktøytips: *Gå til: …*), se under. Linjen som hører til den aktive aktiviteten din (for en avhengighet: etterfølgeren) eller til ressursen du valgte i histogrammet, er uthevet.
- **Rekkefølge** — feil kommer først. Deretter per type, i rekkefølgen i listen under. Innenfor hver type kommer de i dokumentrekkefølge; for en avhengighet gjelder etterfølgeren, og for en ressurs gjelder ressurslisten. En aktivitet, avhengighet eller ressurs som ble slettet etter siste beregning, forsvinner fra listen.

### Typer advarsler

- **Tidsplanfeil** — *Tidsplanen kunne ikke beregnes: …* med årsaken etter den, se under. Et klikk: for en syklus velger appen alle aktiviteter i syklusen og hopper til den første. For andre feil er det ingenting å hoppe til, og linjen er ikke en knapp.
- **Tidsfrist oversett** — *Tidsfrist {date} oversett — tidligste slutt {date}*. Aktiviteten har en tidsfrist, og beregningen klarer den ikke. Et klikk hopper til aktiviteten. Slik løser du det: juster logikken eller varigheten, eller flytt tidsfristen.
- **Brutt begrensning** — *Begrensning {type and date} overstyres av logikken (negativ slakk)*. Begrensningen kan ikke oppfylles uten å bryte logikken. Slakken er negativ. Et klikk hopper til aktiviteten. Se [Begrensninger](docs://uitleg-constraints).
- **Utenfor rekkefølge** — *Utenfor rekkefølge: fremdriften til etterfølgeren strider mot avhengigheten*. Fremdriften til etterfølgeren passer ikke til avhengighetstypen. For eksempel: etterfølgeren er allerede i gang, mens forgjengeren ikke er ferdig ennå under en slutt-til-start-avhengighet. Et klikk velger begge aktivitetene, med etterfølgeren som aktiv. Kontroller de faktiske datoene eller avhengigheten.
- **Ledetid kappet** — *Ledetid kappet av prosjektstarten — avhengigheten er ikke fullt utnyttet*. Ledetiden (negativ forsinkelse) i avhengigheten rekker tilbake til før prosjektstarten. Et klikk velger begge aktivitetene.
- **Avhengighet ignorert** — *Avhengighet ignorert: forgjenger eller etterfølger mangler, eller er ikke en bladaktivitet*. Beregningen bruker ikke avhengigheten. Et klikk velger aktivitetene som fortsatt finnes. Se [Avhengigheter](docs://uitleg-relaties).
- **Hengekøye uten sluttstyrende avhengighet** — *Hengekøye uten sluttstyrende avhengighet (ingen FF/SF-forgjenger): varigheten settes til null*. Et klikk hopper til aktiviteten. Se [Hengekøyeaktiviteter](docs://howto-hammock).
- **Sluttdato kappet** — *Sluttdato kappet: kalenderen gir ingen brukbart tidsvindu for aktiviteten*. Beregningen nådde grensen for hvor mange dager den søker, for eksempel på grunn av en svært lang, sammenhengende periode med fridager i kalenderen. Et klikk hopper til aktiviteten. Se [Kalendere og arbeidsdager](docs://uitleg-kalenders).
- **Overallokering** — *Overallokering på N dag(er) (første – siste)*, med *ressursen jobber ikke disse dagene etter kalenderen sin* lagt til hvis alle dagene er fridager, eller *av disse N dag(er) jobber ikke ressursen etter kalenderen sin* ved en blanding. Et klikk velger aktivitetene med en tilordning på den ressursen, slår på histogrammet og velger den ressursen der. Fra *Tabell*, *IFC* eller *Rapport* hopper appen til *Ressurser*. Se [Ressurspanelet](docs://ref-resourcepaneel).

### Årsaker til tidsplanfeil

- *Sirkulær avhengighet mellom aktiviteter: {path}* — avhengighetene danner en syklus. Aktivitetene står i stien. Snu eller fjern én avhengighet.
- *Kalenderen har ingen arbeidsdager angitt* — gi kalenderen minst én arbeidsdag. Se [Kalendervinduer](docs://ref-kalenders).
- *Ugyldig varighet i dager for aktiviteten '{task}'* og *Ugyldig varighet i timer for aktiviteten '{task}'* — varigheten til aktiviteten er ikke et gyldig tall.
- *Timebasert aktivitet '{task}' har ingen gyldige arbeidstimer i kalenderen sin* — en timebasert aktivitet i en kalender uten arbeidstimer.
- *Ugyldig startdato for aktiviteten '{task}'* — startdatoen til aktiviteten er ikke gyldig.

## Meldinger

Meldinger vises nederst på skjermen, også i tabellen, i Backstage og i presentasjonsmodus. En melding er en *feil* eller *info*. En feil blir stående til du klikker den bort. En info forsvinner etter 5 sekunder. Tidtakerne starter på nytt så snart stabelen endrer seg. Et klikk på en melding lukker den (verktøytips *Lukk melding*). Det vises høyst tre meldinger om gangen. Kommer det en fjerde, går den eldste info først. Finnes det ingen info, går den eldste meldingen. En feil blir derfor aldri skjøvet ut av en info. Stabelen flytter seg vekk fra knappene i en åpen dialog og fra faste handlingslinjer.

- **Teller ×N** — en melding med en fast nøkkel slår en gjentakelse sammen til én linje med en teller. For eksempel en lagringsfeil som stadig kommer tilbake, eller en avvist avhengighet som du gjentar. Ikke alle meldinger gjør dette.
- **Les mer** — noen meldinger har en lenke *Les mer* eller et eget emne, for eksempel *Arbeidsregler forklart*, til veiledningen i Backstage › Hjelp.
- **Handlingsknapp** — meldingen om beregningsprofilen har en knapp *Åpne beregningsprofil* til Prosjektinfo.

Listen under er et utvalg, gruppert etter emne. Der det ikke sier noe annet, er det en info.

### Lagring, åpning og gjenoppretting

- **Lagring mislyktes** (feil) — *Kunne ikke lagre* med årsaken under. Gjelder når du lagrer, lagrer som og når du eksporterer en rapport.
- **Lagret som nedlasting** (info) — *Lagret som nedlasting: '{name}' ligger nå i mappen for nedlastinger. …* Med *Lagre som* og eksporter, når miljøet ikke lar appen skrive direkte til stedet du valgte. To nedlastinger etter hverandre slås sammen.
- **Lagret som nedlasting (forklaring)** (info) — *Lagret som nedlasting: '{name}' ligger i mappen for nedlastinger. Denne nettleseren lar ikke appen skrive til et eget sted, …* Med *Lagre* i en nettleser som bare lagrer via en nedlasting. Én gang per økt, med en lenke til forklaringen om filer.
- **Nettleseren skriver ikke tilbake** (info) — *Denne nettleseren lar ikke appen skrive tilbake til '{name}'. …* Med *Lagre* for et prosjekt som har en fil, når nettleseren må be om et sted på nytt. Én gang per økt, med en lenke til forklaringen om filer.
- **Automatisk lagring mislyktes** (feil) — *Automatisk lagring mislyktes* med årsaken. Gjelder automatisk lagring til filen og gjenoppretting ved brudd.
- **Biblioteket kunne ikke lagres** (feil) — *Biblioteket kunne ikke lagres*, ved lagring av ressursbiblioteket.
- **Åpning av fil mislyktes** (feil) — *Kunne ikke åpne fil* med årsaken. For eksempel en nylig brukt fil eller en importert fil.
- **Gammel eller beskyttet .mpp** (feil) — *Denne .mpp-filen bruker et eldre format (Project 2007 eller tidligere)…* eller *Denne .mpp-filen er passordbeskyttet…*. Begge med rådet om å eksportere den som XML i MS Project og åpne denne filen.
- **Ugyldig XER-fil** (feil) — en av tekstene *XER…*, for eksempel *Dette er ikke en gyldig eller støttet XER-fil.* eller *XER-filen inneholder en tabell to ganger.*, med årsaken lagt til.
- **IFC kunne ikke leses** (feil) — *IFC kunne ikke leses* med årsaken, i IFC-visningen.
- **Gjenoppretting** (feil) — *Den gjenopprettede filen kunne ikke leses*, *Gjenoppretting mislyktes* og *N gjenopprettingsfiler kunne ikke lastes og er hoppet over.* Ved gjenoppretting etter en uventet avslutning.
- **Gren lagret som mal** (info) — *Gren lagret som mal '{name}'*.
- **Melding fra en utvidelse** (info, eller feil hvis utvidelsen melder en feil) — *Utvidelse {name}: {message}*. En utvidelse kan vise høyst tre nye per 10 sekunder, så den ikke fyller stabelen. Hvis et steg i veiledningen til en utvidelse mislykkes, står det *Et steg fra utvidelsen {name} gav en feil. Veiledningen fortsetter.*, og hvis en prosjektfil fra en utvidelse ikke kan åpnes, *Prosjektfilen {file} fra utvidelsen {name} kunne ikke åpnes.* Begge er feilmeldinger.
- **En endring kom imellom** (info) — *En endring fra KI-assistenten eller en utvidelse kom imellom. …* Når du avbryter aktivitetsdialogen mens KI-assistenten eller en utvidelse har endret noe i mellomtiden: redigeringene av aktiviteten fra før den endringen blir ikke angret. De blir i stedet vanlige steg under *Angre*.

### Beregning

- **Tidsplanen kunne ikke beregnes** (feil) — *Tidsplanen kunne ikke beregnes* med årsaken under (se *Årsaker til en tidsplanfeil*). Gjelder ved *Beregn*, når du bytter dokument og når du åpner en fil.
- **Statusdato satt til i dag** (info) — *Det fantes ingen statusdato ennå. Den er nå satt til i dag ({date}), fordi fremdrift måles fram til statusdatoen. Du kan endre den under Tidsplan → Statusdato.* Når du registrerer fremdrift i et prosjekt uten statusdato.
- **Varighet kortere enn utført arbeid** (info) — *‘{name}’ er allerede {N} % ferdig: en varighet kortere enn arbeidet som er utført, er ikke mulig. Varigheten er ikke endret.*

### Avhengigheter og hierarki

- **Avhengighet opprettet** (info) — *Avhengighet opprettet: {predecessor} → {successor}*.
- **Avhengighet avvist** (info) — *Denne avhengigheten finnes allerede*, *En avhengighet mellom en aktivitet og dens egen overordnede hovedaktivitet er ikke tillatt.* eller *Denne avhengigheten ville skape en syklus i tidsplanen ({cycle}) og er ikke opprettet.* Syklusen viser aktivitetene, så du vet hvilken avhengighet du må fjerne eller snu først.
- **Flytting avvist** (info) — *Denne flyttingen ville skape en syklus i tidsplanen ({cycle}): avhengighetene til en hovedaktivitet gjelder også for delaktivitetene. Ingenting er flyttet.*
- **Avhengigheter faller ut etter flytting** (info) — *Etter flyttingen kobler N avhengigheter en aktivitet til sin egen hovedaktivitet; de telles ikke lenger med i beregningen.*
- **Avhengigheter hoppet over ved innsetting** (info) — *N avhengigheter ble ikke opprettet: ugyldig kobling…*, når du limer inn eller setter inn en gren.
- **Avhengigheter telles ikke etter import** (info) — *N avhengighet(er) kunne ikke tas med i beregningen. Kontroller kolonnene Forgjengere og Etterfølgere.*
- **Dobbelte ID-er etter import** (info) — *Objekter med en dobbel ID i denne filen: N. De fikk hver sin egen ID…*

### Redigere aktiviteter

- **Start registrert som begrensning** (info) — *'{name}' har en forgjenger: den nye starten er satt som begrensningen Start ikke tidligere enn (SNET) {date}. Etter omberegning (F5) starter aktiviteten ikke før den datoen.* Når du endrer starten på en aktivitet med en forgjenger. Hadde aktiviteten allerede en slik begrensning, sier meldingen at den er flyttet. For flere aktiviteter samtidig viser meldingen et antall.
- **Start ikke brukt** (info) — *Den nye starten på '{name}' ble ikke brukt: aktiviteten har en forgjenger, og både forgjengeren og begrensningen {type} {date} bestemmer starten. Endre den begrensningen for å flytte starten.*
- **Milepæl avvist** (info) — *'{task}' har ressurstilordninger og kan ikke bli en milepæl. Fjern tilordningene først.* eller *'{task}' er en hovedaktivitet med delaktiviteter og kan ikke bli en milepæl.* Ved konvertering i aktivitetsdialogen, i egenskapspanelet, i hurtigmenyen og i tabellen.
- **Tilordninger flyttet til en delaktivitet** (info) — *Tilordningen av {resources} er flyttet fra '{phase}' til den nye delaktiviteten '{child}': en hovedaktivitet har ikke egne tilordninger.* Når en aktivitet med tilordninger får delaktiviteter.
- **Milepælmarkering fjernet** (info) — *Milepælen '{phase}' har nå delaktiviteter og er blitt en hovedaktivitet; milepælmarkeringen er fjernet.*
- **Hovedaktivitet avvist** (info) — *'{phase}' kan ikke bli en hovedaktivitet: …* med årsaken, og *Ingenting er endret.*
- **Celler hoppet over ved liming** (info) — *N celler hoppet over: de er skrivebeskyttede (f.eks. automatisk nummererte WBS-koder eller beregnede kolonner).*
- **Referanser tømt ved liming** (info) — *N referanser fantes ikke i dette dokumentet og er tømt (aktivitetskalendere, egne aktivitetstyper, aktivitetskoder eller egendefinerte felt fra kildedokumentet).*
- **Arbeidsregelen justerte varigheter** (info) — *Etter kalenderendringen har arbeidsregelen justert varigheten til N aktiviteter (arbeidet består, timer per dag er endret).* Med en lenke *Arbeidsregler forklart*.

### Primavera (XER)

- **XER-fil åpnet** (info) — *XER-fil åpnet: N prosjektdokumenter.* Én melding per fil, også når filen åpner flere prosjekter, med en lenke *Les mer* og detaljlinjer under den. Alltid *N prosjekter funnet.* Bare når tallet er større enn 0: *N tomme prosjekter hoppet over.*, *N grunnlinjeprosjekter utelatt.*, *N grunnlinjer materialisert.*, *N løse grunnlinjereferanser ignorert.*, *Det ble brukt en beskyttende grunnlinje-reserve.* og *N koblinger mellom prosjekter bevart.* Bare for en annen tegnkoding enn UTF-8: *Tegnkoding valgt: {encoding}.* Videre, når tallet er større enn 0: *N parserbevindinger.*, *N kalenderbevindinger.*, *N tallformatproblemer.*, *N enum-reserver.* og *N P6-planleggingsinnstillinger brukte trygge reserveløsninger.*
- **Datoer slik Primavera lagret dem** (detaljlinje i samme melding) — *N aktiviteter viser datoene slik Primavera lagret dem (ikke omberegnet).*, eller, hvis modusen ikke ble slått på, *N aktiviteter avviker fra datoene i filen — du kan vise dem.*
- **XER-kildearkivet kan ikke brukes** (info) — *XER-kildearkivet i denne filen er ubrukelig og er utelatt; prosjektet selv er åpnet fullt ut.* med årsaken (for eksempel *Årsak: kontrollsummen passer ikke til kildebytene — arkivet er skadet.*) og konsekvensen (*Tidsplanen, beregningsprofilen og alle prosjektdata fra IFC er fullstendige. …*). Når du åpner en IFC-fil der et tidligere lagret XER-kildearkiv ikke kan brukes.
- **Eksport fører til tap av XER-informasjon** (info) — *Eksport til {format} fører til tap av XER-kildeinformasjon.* Etter en vellykket eksport til et annet format enn IFC av et prosjekt med data som bare finnes i en XER-fil. Med en lenke *Les mer*.

### Import, eksport og beregningsprofil

- **Datoer som i filen** (info) — *N aktiviteter viser datoene slik de står i filen (ikke omberegnet).* eller *N aktiviteter avviker fra datoene i filen — du kan vise dem.* Når du åpner en fil med lagrede datoer.
- **Arbeid og arbeidsregler synlige** (info) — *Denne filen inneholder lagret arbeid eller egne arbeidsregler; arbeidsregelen og gjenstående arbeid vises for dette prosjektet.*
- **MS Project-tidsplan lest** (info) — *Denne MS Project-filen inneholder N aktiviteter med en delt, utjevnet eller ressursdrevet tidsplan. De leses inn og vises slik.*
- **Avbrudd ikke eksportert** (info) — *N aktiviteter med avbrudd er eksportert uten avbrudd: MS Project og P6 kjenner bare avbrudd som en arbeidsfordeling.* Ved eksport til MS Project eller Primavera.
- **Prosjektstart flyttet** (info) — *Prosjektstart flyttet: N aktivitetsankere uten forgjenger eller begrensning er forskjøvet til den nye startdatoen.*
- **Datovindu styrer ikke lenger** (info) — *Datovinduet i MS Project styrer ikke lenger N aktiviteter etter denne redigeringen; …* Én gang per dokument.
- **Utjevningsforsinkelse avrundet** (info) — *Utjevning runder MS Projects minuttnøyaktige utjevningsforsinkelser for N aktiviteter av til hele arbeidsdager.* Én gang per dokument.
- **Beregningsprofil brukt** (info) — *Dette prosjektet beregner som {profile}. Endre det via Fil → Prosjektinfo → Beregningsprofil og beregningsalternativer.* Med knappen *Åpne beregningsprofil*. Etter at du har brukt en profil, kommer *Etter bruk er N aktiviteter forskjøvet.* ved behov.
