# Åpne en Primavera P6-fil (.xer)

Mål: åpne en tidsplan fra Primavera P6 direkte i appen, uten først å eksportere den til XML.

## Når du trenger dette

En kunde eller hovedentreprenør jobber i Primavera og leverer tidsplanen sin som en `.xer`-fil. Du vil se den, beregne den eller legge til i den. Appen leser bare `.xer`-filer. Den skriver ikke `.xer` og endrer aldri filen din. Fra filen henter den WBS-strukturen og aktivitetene med varighet, datoer, begrensninger og fremdrift, avhengighetene med forsinkelse, kalenderne og ressursene med tilordningene. I tillegg henter den aktivitetskoder, egendefinerte felt (UDF-er), notater og P6-innstillingene for tidsplanlegging. En aktivitet av typen *Level of Effort* blir en hengekøye.

## Steg

1. Velg *Hjem › Fil › Åpne* eller trykk Ctrl+O. Velg `.xer`-filen.
2. Appen åpner én fane for hvert prosjekt som har aktiviteter. Prosjektet med flest aktiviteter er den aktive fanen. En fane heter *Prosjektnavn (Prosjekt-ID)* hvis P6-prosjekt-ID-en er forskjellig fra navnet.
3. Les meldingen nederst. For en fil med tre prosjekter kan den se slik ut: *XER-fil åpnet: 3 prosjektdokumenter.* Under den står linjer som forklarer hva appen gjorde. Se overskriften nedenfor.
4. Kontroller om det vises en linje under båndet: *Du ser tidsplanen slik Primavera lagret den. Ved omberegning avviker 1 aktivitet.* Primavera lagrer sine egne beregnede datoer i filen. Hvis appens beregning avviker fra dem, viser appen Primaveras datoer så lenge du ikke endrer noe. Hva det betyr, og hvordan du bytter til appens egen beregning, står i [Datoer slik de ble lagret](docs://uitleg-datums-zoals-opgeslagen). Meldingen *Denne filen inneholder timeplanlegging.* kan også vises, med knappen *Slå på timeplanlegging*. Se [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten).
5. Lagre prosjektet med Ctrl+S. Fordi en `.xer`-fil aldri blir overskrevet, spør appen hvor den nye IFC-filen skal lagres. Appen foreslår *Prosjektnavn (Prosjekt-ID)* som filnavn.

### Linjene under meldingen

Den første linjen i meldingen viser hvor mange faner som er åpnet. Under den står bare linjene som gjelder. Disse bør du legge merke til:

- *Dette prosjektet beregner som Primavera P6. Endre det via Fil → Prosjektinfo → Beregningsprofil og beregningsalternativer.* Appen beregner dette prosjektet med Primaveras beregningsregler. Med *Åpne beregningsprofil* går du til innstillingen.
- *1 grunnlinjeprosjekt utelatt.* og *1 grunnlinje materialisert.* Hvis et prosjekt i P6 peker ut et annet prosjekt som grunnlinje, åpnes det andre prosjektet ikke som en egen fane. Det blir den aktive grunnlinjen for prosjektet som viser til det.
- *Det ble brukt en beskyttende grunnlinje-reserve.* Hvis det å utpeke grunnlinjer betyr at ingen prosjekter åpnes, hvis et prosjekt viser til seg selv, eller hvis prosjekter viser til hverandre i en løkke, åpner appen bare alle prosjektene og lager ingen grunnlinjer.
- *1 kobling mellom prosjekter bevart.* Det er en avhengighet mellom to prosjekter. Appen beholder den som kildedata, men gjør den ikke til en avhengighet i tidsplanen din.
- *1 aktivitet viser datoene slik Primavera lagret dem (ikke omberegnet).* Antallet aktiviteter du ser i visningen *Datoer slik de ble lagret*.

De andre linjene er diagnostikk av selve lesingen. Der står antall prosjekter som er funnet, et tomt prosjekt som ble hoppet over, en ignorert, løs grunnlinjereferanse, en tekstkoding som ikke er ren UTF-8, og tellere for funn i tabellene, kalenderne og tallene. Der står også tellere for ukjente feltverdier og for P6-innstillinger som appen erstattet med et trygt valg. De krever ingenting av deg. *Les mer* åpner hjelpen om åpning av Primavera-filer.

## Fallgruver og hva appen gjør da

**Ikke alt blir en fane eller en avhengighet.** Et prosjekt uten aktiviteter åpnes ikke. Et grunnlinjeprosjekt åpnes ikke som en egen fane. En avhengighet mellom to prosjekter blir ikke en avhengighet i tidsplanen din. Appen melder dette i linjene under meldingen.

**Hver fane er et eget prosjekt.** Hvis du lagrer en fane, beholder IFC-filen hele den opprinnelige `.xer`-filen. Hvis du åpner IFC-filen igjen senere, kjenner appen fortsatt til datoene fra Primavera. Hvis dette kildearkivet er skadet, eller hvis et annet IFC-program har skrevet filen om, melder appen: *XER-kildearkivet i denne filen er ubrukelig og er utelatt; prosjektet selv er åpnet fullt ut.* Tidsplanen, beregningsprofilen og alle prosjektdata er komplette. Det som mangler, er datoene slik Primavera lagret dem, og kildeopphavet for AI og utvidelser. Åpne den opprinnelige `.xer`-filen igjen for å få arkivet tilbake.

**Eksport til CSV, MS Project XML eller P6 XML fører til tap av data.** Appen varsler: *Eksport til CSV fører til tap av XER-kildeinformasjon.* IFC mister ingenting.

**En fil som appen ikke kan lese.** Du får en feilmelding med årsaken. Noen eksempler:

- *Dette er ikke en gyldig eller støttet XER-fil.*
- *En XER-tabell mangler obligatoriske kolonner.*
- *P6-prosjektet i denne XER-filen inneholder ingen aktiviteter.*

Da åpnes ingenting. Kontroller filen i P6, eller be avsenderen om en ny eksport.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor en `.xer` bare leses, og hva en eksport mister.
- [Datoer slik de ble lagret](docs://uitleg-datums-zoals-opgeslagen): visningen av Primaveras egne datoer.
- [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen): det samme for MS Project.
- [Slik slår du på timeplanlegging](docs://howto-urenplanning-aanzetten): hvis filen inneholder data i timer.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format, hva som blir med og hva som ikke blir det.
- [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen): hvorfor en P6-fil åpnes med sin egen beregningsprofil.
