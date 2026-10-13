# Installere og administrere en utvidelse

Mål: installere en utvidelse, lese tillatelsesspørsmålet og senere deaktivere eller fjerne utvidelsen.

## Når du trenger dette

En utvidelse legger til noe i appen uten at du må vente på en ny versjon. En utvidelse kan for eksempel legge til et importformat som vises under *Fil › Importer*, sette en knapp i båndet eller levere en skrift for PDF-eksporten. Den offisielle katalogen deler dem inn i kategorier: *Import/eksport*, *Tidsplan*, *Rapportering*, *Verktøy*, *Skrifter* og *Annet*.

Tenk deg godt om før du installerer en. En utvidelse er programkode som kjører med samme rettigheter som selve appen, og appen kan ikke begrense det. Derfor spør appen om tillatelse ved hver installasjon. Det du ser i det spørsmålet, forklares nedenfor.

## Steg

### Installer en utvidelse fra katalogen

1. Velg *Fil › Utvidelser*.
2. Velg fanen *Bla gjennom*. Appen henter katalogen mens den viser *Laster katalog...*. Hva som finnes i katalogen, bestemmes av OpenAEC Foundation, som vedlikeholder den. Det kan endre seg.
3. Søk etter en utvidelse i feltet *Søk etter utvidelser...*. Det søkes i navn, beskrivelse, forfatter og etiketter.
4. Hvert kort viser navn, versjon, kategori, beskrivelse og forfatter. Klikk *Installer*.
5. Vinduet *Installer utvidelse?* åpnes. Les det og se neste steg.
6. Klikk *Installer* for å fortsette. Med *Ikke installer* skjer ingenting. Esc eller et klikk ved siden av vinduet betyr også at du sier nei, og appen viser da ingen feilmelding.

Etter installasjonen er utvidelsen med en gang aktivert. På kortet under *Bla gjennom* står det nå *Installert*. Det utvidelsen legger til, ser du i selve appen: en ny knapp i båndet, eller et importformat under *Fil › Importer*. Noen utvidelser viser også en melding. Du kjenner den igjen på forstavelsen *Utvidelse* etterfulgt av navnet på utvidelsen.

### Installer en utvidelse fra en fil

Hvis du har fått en utvidelse som fil, installerer du den slik.

1. Velg *Fil › Utvidelser*.
2. Øverst til høyre klikker du *ZIP* for en ZIP-fil, eller *JS* for en separat JavaScript-fil.
3. Velg filen. Vinduet *Installer utvidelse?* åpnes, som ovenfor.

En ZIP-fil må inneholde en `manifest.json` og hovedfilen til utvidelsen. Hvis du installerer en utvidelse som allerede er installert, erstatter den nye versjonen den gamle. Hvis appen ikke kan installere filen, for eksempel fordi en ZIP-fil er skadet, skjer ingenting: appen viser ingen feilmelding for ZIP og JS, og utvidelsen vises ikke i listen. Årsaken står likevel i feilsøkingsterminalen. Slå den på under *Innstillinger › Prosjekt › Innstillinger*, fanen *Avansert*, *Slå på feilsøkingsterminal*, og åpne den med knappen *Vis feilsøkingsterminal* i statuslinjen. Der står det for eksempel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (appen skriver denne tekniske teksten på nederlandsk).

### Les tillatelsesspørsmålet

Spørsmålet viser hva du må avgjøre.

- *Forfatter* og *Repositorium* viser hvem som har laget utvidelsen, og hvor kildekoden ligger.
- *Opprinnelse* viser hvor filen kommer fra: *Fra den nettbaserte utvidelseskatalogen*, *Fra en ZIP-fil på denne datamaskinen* eller *Fra en JavaScript-fil på denne datamaskinen*. Under det står det om filen er kontrollert. For katalogen står det *Nedlastingen er bekreftet med sjekksummen fra katalogen.* Hvis katalogen ikke har en sjekksum, står det med rød tekst *Katalogen gir ingen sjekksum; denne nedlastingen er ikke bekreftet.* For en fil du selv har valgt, står det *Du valgte denne filen selv; det finnes ingen ekstern kilde å bekrefte den mot.*
- *Hva du sier ja til* sier: *En utvidelse er programkode som kjører med samme rettigheter som Open Planner Studio selv. Ingenting begrenser den. Installer bare utvidelser der du stoler på utvikleren.* Under det står det hva dette betyr på plattformen din. I desktopappen står det *I desktopappen betyr det blant annet: lese og skrive filer hvor som helst i brukermappen din, pluss tilgang til prosjektene, innstillingene og utklippstavlen.* I nettleseren står det *I nettleseren betyr det: tilgang til lagrede prosjekter og innstillinger, til filene du ga tilgang til, og til nettverket.*
- *Det denne utvidelsen sier at den bruker* viser tillatelsene som utvikleren har oppgitt, som små etiketter. Det er en erklæring fra utvikleren, ikke en begrensning: *Dette er utviklerens erklæring, ikke en begrensning — koden kan uansett gjøre mer.* Hvis det ikke finnes noen etikett, står det *Ingenting oppgitt.* Det betyr ikke at utvidelsen ikke kan gjøre noe: selv uten etiketter kan en utvidelse lese og endre data i tidsplanen din og vise meldinger.

Etikettene betyr dette:

- *ribbon*: utvidelsen legger knapper i båndet.
- *events*: utvidelsen lytter til hendelser i appen.
- *backstage*: utvidelsen legger til importformater under *Fil › Importer*.
- *pdf-fonts*: utvidelsen leverer en skrift for PDF-eksporten.
- *importSource*: utvidelsen kan lese alle de opprinnelige byte i hver fil du importerer, for eksempel en rå Primavera-fil, inkludert felt som ikke havner i prosjektet ditt. Vinduet forklarer dette også selv.
- *help*: utvidelsen kan legge til hjelpeartikler, åpne medfølgende prosjekter som et nytt dokument og vise en veiledning som peker på deler av appen. Vinduet forklarer dette også selv.
- *filesystem* og *network*: dette er bare en indikasjon på hva utvikleren har tenkt seg. Appen har ingen funksjon for dem.

### Deaktiver, aktiver på nytt eller fjern en utvidelse

1. Velg *Fil › Utvidelser* og fanen *Installert*. Hver utvidelse har et kort med navn, versjon, kategori, beskrivelse og forfatter.
2. Med bryteren på kortet deaktiverer du utvidelsen (*Deaktiver*) eller aktiverer den igjen (*Aktiver*). Når utvidelsen er deaktivert, forsvinner knappene og importformatene som utvidelsen la til, men utvidelsen forblir installert. Den forblir også av etter at du har startet appen på nytt. En aktivert utvidelse starter av seg selv når appen starter.
3. Klikk *Fjern*. Knappen endres til *Bekreft*, med forklaringen *Klikk igjen for å fjerne for godt*. Klikk én gang til for å fjerne utvidelsen. Appen rydder også opp i innstillingene som utvidelsen har lagret.

## Problemer og hva appen gjør da

**Katalogen laster ikke.** Det står *Kunne ikke laste katalogen:* med den tekniske årsaken etter, og knappen *Prøv igjen*. Det kan skyldes at du ikke har internettforbindelse.

**Det står *Installasjonen mislyktes.* under et kort i katalogen.** Nedlastingen eller installasjonen mislyktes, for eksempel fordi sjekksummen ikke stemte. Da er ingenting installert. Dette er noe annet enn å si nei til spørsmålet. Ved et nei vises ingen feilmelding.

**Det står *Hoppet over katalogoppføringer: 1* over listen.** Katalogen inneholdt et element som appen ikke kan bruke. Du kan installere de andre utvidelsene som vanlig.

**En utvidelse starter ikke.** Kortet viser da en feilmelding, for eksempel at utvidelsen trenger en nyere versjon av Open Planner Studio, med den nåværende versjonen din vist, eller feilen som utvidelsen selv ga. Utvidelsen er da ikke aktiv. Oppdater appen, eller fjern utvidelsen.

**Et kort med *Karantene*.** Appen kunne ikke bruke den lagrede utvidelsen. Under navnet står det *Årsak:* med årsaken. Med *Fjern fra lagring* rydder du opp.

**Skrive en utvidelse selv.** Veiledningen for utviklere av utvidelser (manifest, API, tillatelser) ligger i repositoriet `OpenAEC-Foundation/open-planner-studio` på GitHub, i filen `docs/extensions.md`.

**En utvidelse hører ikke til et prosjekt.** Utvidelser lagres i appen: i desktopappen på denne datamaskinen, og i nettleseren i nettleserens lagring. De gjelder for alle prosjektene dine og er ikke en del av prosjektfilen din. Hvis du sletter nettstedsdataene i nettleseren, er utvidelsene borte.

## Se også

- [Oppdatere appen](docs://howto-app-bijwerken): en utvidelse kan be om en nyere versjon av appen.
- [Tillatelser for utvidelser](docs://ref-extensiepermissies): hva hver tillatelse i installasjonsspørsmålet betyr.
