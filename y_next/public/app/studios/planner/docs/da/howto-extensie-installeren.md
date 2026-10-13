# Installér og administrér en udvidelse

Mål: installér en udvidelse, læs tilladelsesspørgsmålet, og deaktivér eller fjern udvidelsen senere.

## Hvornår har du dette brug for

En udvidelse tilføjer noget til appen, uden at du skal vente på en ny version. En udvidelse kan for eksempel tilføje et importformat, der vises under *Fil › Importer*, sætte en knap i båndet eller levere en skrifttype til PDF-eksporten. Det officielle katalog deler dem op i kategorierne *Import/eksport*, *Tidsplan*, *Rapport*, *Værktøj*, *Skrifttyper* og *Andet*.

Overvej nøje, før du installerer en. En udvidelse er programkode, der kører med de samme rettigheder som selve appen, og appen kan ikke begrænse det. Derfor spørger appen om tilladelse ved hver installation. Hvad du ser i spørgsmålet, forklares nedenfor.

## Trin

### Installér en udvidelse fra kataloget

1. Vælg *Fil › Udvidelser*.
2. Vælg fanen *Gennemse*. Appen henter kataloget, mens der står *Indlæser katalog...*. Det, der findes i kataloget, bestemmes af OpenAEC Foundation, som vedligeholder det. Det kan ændre sig.
3. Søg efter en udvidelse i feltet *Søg efter udvidelser...*. Feltet søger i navn, beskrivelse, forfatter og nøgleord.
4. Hvert kort viser navn, version, kategori, beskrivelse og forfatter. Klik på *Installér*.
5. Vinduet *Installér udvidelse?* åbner sig. Læs det igennem. Se næste trin.
6. Klik på *Installér* for at fortsætte. Med *Installér ikke* sker der ikke noget. Esc eller et klik ved siden af vinduet tæller også som nej, og appen viser så ingen fejlmeddelelse.

Efter installationen er udvidelsen med det samme aktiveret. På kortet under *Gennemse* står der nu *Installeret*. Det, udvidelsen tilføjer, ser du i selve appen: en ny knap i båndet eller et importformat under *Fil › Importer*. Nogle udvidelser viser også en besked. Du kan genkende den på præfikset *Udvidelse* efterfulgt af udvidelsens navn.

### Installér en udvidelse fra en fil

Hvis du har fået en udvidelse som fil, installér den sådan her.

1. Vælg *Fil › Udvidelser*.
2. Klik øverst til højre på *ZIP* for en ZIP-fil eller på *JS* for en separat JavaScript-fil.
3. Vælg filen. Vinduet *Installér udvidelse?* åbner sig, som ovenfor.

En ZIP-fil skal indeholde `manifest.json` og udvidelsens hovedfil. Hvis du installerer en udvidelse, der allerede er installeret, erstatter den nye version den gamle. Hvis appen ikke kan installere filen, for eksempel fordi en ZIP-fil er beskadiget, sker der ikke noget: appen viser ingen fejlmeddelelse for ZIP og JS, og udvidelsen vises ikke på listen. Årsagen står dog i debugterminalen. Slå den til med *Indstillinger › Projekt › Indstillinger*, fanen *Avanceret*, *Slå debugterminal til*, og åbn den med knappen *Vis debugterminal* i statuslinjen. Der står for eksempel *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (appen skriver denne tekniske tekst på nederlandsk).

### Læs tilladelsesspørgsmålet

Spørgsmålet viser, hvad du skal tage stilling til.

- *Forfatter* og *Repository* viser, hvem der har lavet udvidelsen, og hvor kildekoden er.
- *Oprindelse* viser, hvor filen kommer fra: *Fra det online udvidelseskatalog*, *Fra en ZIP-fil på denne computer* eller *Fra en JavaScript-fil på denne computer*. Nedenfor står der, om filen er kontrolleret. For kataloget står der *Download verificeret med checksummen fra kataloget.* Hvis kataloget ikke har en checksum, står der med rødt *Kataloget har ingen checksum. Denne download er ikke verificeret.* For en fil, du selv har valgt, står der *Du valgte denne fil selv. Der er ingen ekstern kilde at verificere den mod.*
- *Hvad du siger ja til* står der: *En udvidelse er programkode, som kører med de samme rettigheder som Open Planner Studio selv. Intet begrænser den. Installer kun udvidelser, hvis forfatter du stoler på.* Nedenfor står der, hvad det betyder på din platform. I desktop-appen står der *I desktop-appen betyder det blandt andet: læse og skrive filer i hele din brugermappe, samt adgang til dine projekter, indstillinger og udklipsholder.* I browseren står der *I browseren betyder det: adgang til dine gemte projekter og indstillinger, til de filer du gav adgang til, og til netværket.*
- *Hvad denne udvidelse siger at bruge* viser de tilladelser, som forfatteren har angivet, som små mærkater. Det er en angivelse fra forfatteren og ikke en begrænsning: *Dette er forfatterens angivelse, ikke en begrænsning. Koden kan alligevel gøre mere.* Er der ingen mærkat, står der *Intet angivet.* Det betyder ikke, at udvidelsen ikke kan gøre noget: selv uden mærkater kan en udvidelse læse og ændre data i din tidsplan og vise beskeder.

Mærkaterne betyder dette:

- *ribbon*: udvidelsen sætter knapper i båndet.
- *events*: udvidelsen lytter med på hændelser i appen.
- *backstage*: udvidelsen tilføjer importformater under *Fil › Importer*.
- *pdf-fonts*: udvidelsen leverer en skrifttype til PDF-eksporten.
- *importSource*: udvidelsen må læse de fulde, oprindelige bytes i hver fil, du importerer, for eksempel en rå Primavera-fil, inklusive felter, der ikke ender i dit projekt. Vinduet forklarer også selv dette.
- *help*: udvidelsen må tilføje hjælpeartikler, åbne medfølgende projekter som nyt dokument og vise en vejledning, der peger på dele af appen. Vinduet forklarer også selv dette.
- *filesystem* og *network*: det er kun angivelser af, hvad forfatteren har i sinde. Appen har ingen funktion til dem.

### Deaktivér, aktivér igen eller fjern en udvidelse

1. Vælg *Fil › Udvidelser* og fanen *Installeret*. Hver udvidelse har et kort med navn, version, kategori, beskrivelse og forfatter.
2. Med kontakten på kortet deaktiverer du udvidelsen (*Deaktiver*) eller aktiverer den igen (*Aktiver*). Når den er deaktiveret, forsvinder de knapper og importformater, som udvidelsen tilføjede, men udvidelsen forbliver installeret. Den forbliver også slået fra efter en genstart af appen. En aktiveret udvidelse starter af sig selv, når appen starter.
3. Klik på *Fjern*. Knappen skifter til *Bekræft*, med forklaringen *Klik igen for at fjerne permanent*. Klik én gang til for at fjerne udvidelsen. Appen rydder også op i de indstillinger, som udvidelsen gemte.

## Faldgruber, og hvad appen gør så

**Kataloget indlæses ikke.** Der står *Kunne ikke indlæse katalog:* med den tekniske årsag efter, og knappen *Prøv igen*. Det kan skyldes, at du ikke har en internetforbindelse.

**Der står *Installation mislykkedes.* under et kort i kataloget.** Download eller installation mislykkedes, for eksempel fordi checksummen ikke passede. Der er ikke installeret noget. Det er anderledes end at sige nej til spørgsmålet, for da vises der ingen fejlmeddelelse.

**Der står *Overspringede poster i kataloget: 1* over listen.** Kataloget indeholdt et punkt, som appen ikke kan bruge. Du kan installere de andre udvidelser som vanligt.

**En udvidelse starter ikke.** Kortet viser så en fejlmeddelelse, for eksempel at udvidelsen kræver en nyere version af Open Planner Studio, med din nuværende version vist, eller den fejl, som udvidelsen selv gav. Udvidelsen er da ikke aktiv. Opdatér appen, eller fjern udvidelsen.

**Et kort med *Karantæne*.** Appen kunne ikke bruge den gemte udvidelse. Under navnet står der *Årsag:* med årsagen. Med *Fjern fra lageret* rydder du op.

**At skrive en udvidelse selv.** Vejledningen for udvidelsesforfattere (manifest, API, tilladelser) findes i repositoryet `OpenAEC-Foundation/open-planner-studio` på GitHub, i filen `docs/extensions.md`.

**En udvidelse hører ikke til et projekt.** Udvidelser gemmes i appen: i desktop-appen på denne computer, i browseren i den pågældende browsers lager. De gælder for alle dine projekter og er ikke en del af din projektfil. Hvis du rydder webstedsdata i browseren, er udvidelserne væk.

## Se også

- [Opdatering af appen](docs://howto-app-bijwerken): en udvidelse kan kræve en nyere version af appen.
- [Udvidelsestilladelser](docs://ref-extensiepermissies): hvad hver tilladelse i installationsspørgsmålet betyder.
