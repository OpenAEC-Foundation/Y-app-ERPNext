# Slå automatisk gem til

Mål: Lad appen opdatere din projektfil, mens du arbejder, så du ikke hele tiden skal trykke på Ctrl+S.

## Hvornår har du brug for dette

Du arbejder i lang tid på én tidsplan, eller du glemmer hele tiden at gemme, og du vil have, at filen på disken eller i en delt mappe er opdateret. Automatisk gem erstatter ikke genoprettelse efter nedbrud. Genoprettelse efter nedbrud er altid til og fungerer uafhængigt af denne funktion. Forskellen kan du læse i [Filer og formater](docs://uitleg-bestanden).

## Trin

1. Hvis projektet ikke har en fil endnu, skal du først gemme det én gang med *Start › Fil › Gem som*. Så længe der ikke er en fil, er kontakten grå, og værktøjstippet siger: *Gem projektet først for at bruge automatisk gem.*
2. Øverst til venstre i den øverste linje klikker du på kontakten *Automatisk gem*. Når den er til, siger værktøjstippet: *Automatisk gem er til: ændringer skrives til denne fil.*
3. Fortsæt med at arbejde. Så snart projektet har ændringer, skriver appen dem til din fil uden at vise et vindue, og højst én gang hvert tiende sekund. Markeringen *Ikke gemt* forsvinder så af sig selv.
4. Vil du stoppe, klikker du en gang til på kontakten. Værktøjstippet siger så: *Automatisk gem er fra. Genoprettelse efter nedbrud forbliver altid aktiv.*

I Chrome og Edge kan appen i første omgang kun læse en fil, du har åbnet. Kontakten gør ikke noget der, før du har gemt én gang med *Gem* (Ctrl+S), og browseren har givet tilladelse til at skrive. Derefter kan du slå den til. I Firefox forbliver kontakten grå. Appen kan dér ikke skrive til din fil.

## Faldgruber, og hvad appen gør så

**Kontakten hører til ét projekt.** Hver fane har sin egen status. Når du har åbnet et projekt, er kontakten altid fra, og appen husker den ikke til næste gang.

**Automatisk gem skriver kun til den fil, projektet allerede har.** Vælger du *Gem som*, skriver det til den nye fil fra da af. Appen skriver kun, hvis der er ændringer.

**Skrivningen kan mislykkes.** Hvis filen for eksempel er forsvundet eller låst, vises meddelelsen *Automatisk gem mislykkedes* med årsagen. Hvis browseren ikke (eller ikke længere) har tilladelse til at skrive, springer appen runden over uden en besked. Den spørger ikke om tilladelse.

**Filen får også ændringer, du helst ikke vil beholde.** Automatisk gem skriver projektets tilstand, som den er på det øjeblik. Fortryder du noget med Ctrl+Z, får filen også den fortrudte tilstand inden for ti sekunder. Vil du beholde en ældre version, skal du først lave en kopi med *Gem som*.

**Et nedbrud koster stadig de sidste sekunder.** Appen skriver højst én gang hvert tiende sekund. Det, du har lavet imellem, står derfor ikke i din fil endnu. Genoprettelse efter nedbrud har den samme begrænsning.

**Efter en genoprettelse i browseren er kontakten igen grå.** Et projekt, du får tilbage i browseren efter et nedbrud, er ikke længere knyttet til sin fil. Gem det én gang, så virker kontakten igen. Se [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash).

**Et projekt fra et andet format har ingen fil.** En CSV-, XML-, `.mpp`- eller `.xer`-fil får først en IFC-fil, når du gemmer. Derefter kan du slå automatisk gem til.

## Se også

- [Filer og formater](docs://uitleg-bestanden): forskellen mellem at gemme, automatisk gem og genoprettelse efter nedbrud.
- [Åbn og gem en fil](docs://howto-bestand-openen-en-opslaan): gem, gem som og markeringen *Ikke gemt*.
- [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash): hvad appen tilbyder, hvis den ikke lukkede rent.
