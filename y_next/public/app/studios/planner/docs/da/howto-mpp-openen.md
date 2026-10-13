# Sådan åbner du en MS Project-fil (.mpp)

Mål: åbn en tidsplan fra Microsoft Project direkte i appen, uden at eksportere den først.

## Hvornår du har brug for dette

En entreprenør, konsulent eller opdragsgiver sender dig deres tidsplan som en `.mpp`-fil. Du vil se den, beregne den eller videreudvikle den. Appen læser `.mpp`-filer fra MS Project 2010 op til og med 2021. Den læser kun: den skriver ikke `.mpp` og ændrer aldrig din fil. Fra filen henter den selve tidsplanen: opgaver med struktur, varighed og begrænsninger, afhængigheder med forsinkelse, kalendere, ressourcer, tildelinger og fremdrift. Den læser også datoerne og slækken, som MS Project selv har beregnet. Den bruger dem kun til visningen *Datoer som de står i filen*, aldrig som input.

## Trin

1. Vælg *Start › Fil › Åbn* eller tryk på Ctrl+O. Vælg `.mpp`-filen.
2. Projektet åbnes i en ny fane, eller i den aktuelle fane, hvis den stadig er tom og uændret. Projektet har ingen fil: *Gem* skriver senere en ny IFC-fil.
3. Læs meddelelsen nederst: *Dette projekt beregnes som Microsoft Project. Ændr det via Fil → Projektinfo → Beregningsprofil og beregningsindstillinger*. Appen beregner dette projekt med beregningsreglerne i MS Project: beregningsprofilen *Microsoft Project*. Med *Åbn beregningsprofil* går du til indstillingen. *Læs mere* åbner hjælpen om beregningsprofiler.
4. Kontrollér, om der står en meddelelseslinje under båndet: *Du ser datoerne, som de står i filen; ved at genberegne forskydes 4 opgaver*. Så afviger appens resultat for disse opgaver fra de datoer, som MS Project har gemt. Under meddelelsen fra trin 3 står der også en linje: *4 opgaver viser datoerne, som de står i filen (ikke genberegnet)*. Hvad det betyder, og hvordan du skifter til appens egen beregning, står i [Datoer som de står i filen](docs://uitleg-datums-zoals-opgeslagen).
5. Hvis der står *Denne fil indeholder timeplanlægning* med knappen *Slå timeplanlægning til*, indeholder filen data i timer. Se [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten).

Hvis filen indeholder opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan, tilføjes en anden meddelelse, for eksempel *Denne MS Project-fil indeholder 3 opgaver med afbrydelser, udjævning eller ressourcestyret tidsplan. De indlæses og vises sådan*. Gælder det kun én opgave, står meddelelsen i ental.

## Faldgruber, og hvad appen gør så

**Ikke alt følger med.** Appen overtager ikke oprindelige planer, omkostninger og standardsatser, noter og brugerdefinerede felter fra MS Project. En WBS-kode, som du selv har udfyldt i MS Project, overtages. Ellers nummererer appen opgaverne efter strukturen.

**En fil fra MS Project 2007 eller ældre.** Appen afviser den og melder: *Denne .mpp-fil har et gammelt format (Project 2007 eller ældre). Eksportér den i MS Project som XML (Fil → Gem som → XML), og åbn den fil*. Under meddelelsen tilføjer appen en teknisk årsag på engelsk.

**En fil med adgangskode.** Appen melder: *Denne .mpp-fil er beskyttet med en adgangskode. Eksportér den i MS Project som XML (Fil → Gem som → XML), og åbn den fil*. Også her følger en teknisk årsag på engelsk.

**En fil, der ikke er en `.mpp`.** Du får *Kunne ikke åbne filen* med en teknisk årsag.

**XML-vejen beregner anderledes.** Hvis du åbner XML-eksporten fra MS Project i stedet for `.mpp`, beregner appen med beregningsprofilen *Open Planner Studio*. Du ser ikke meddelelsen om *Microsoft Project*. Datoerne kan dan blive anderledes end med `.mpp`-filen.

**En redigering stopper MS Projects styring.** Hvis du redigerer en opgave, hvis tidsplanen blev styret af datovinduet i MS Project, melder appen det én gang pr. projekt: *Datovinduet fra MS Project styrer ikke længere 2 opgaver efter denne redigering; selve fordelingen af arbejde gælder stadig og er gemt i filen*. Gælder det kun én opgave, står meddelelsen i ental.

**Gemning overskriver aldrig din `.mpp`.** Projektet har ingen fil. *Gem* spørger, hvor den nye IFC-fil skal gemmes.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvorfor en `.mpp` kun læses, og hvad gemning skriver.
- [Datoer som de står i filen](docs://uitleg-datums-zoals-opgeslagen): visningen af MS Projects egne datoer.
- [Sådan slår du timeplanlægning til](docs://howto-urenplanning-aanzetten): hvis filen indeholder data i timer.
- [Sådan åbner du en Primavera P6-fil (.xer)](docs://howto-xer-openen): det samme for Primavera.
- [Import- og eksportformater](docs://ref-import-exportformaten): per format, hvad der overtages, og hvad der ikke overtages.
- [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen): hvorfor en MS Project-fil åbnes med sin egen beregningsprofil.
