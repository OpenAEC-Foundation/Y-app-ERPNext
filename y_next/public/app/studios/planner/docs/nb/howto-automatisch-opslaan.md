# Slå på automatisk lagring

Mål: at appen oppdaterer prosjektfilen din mens du arbeider, slik at du ikke må trykke på Ctrl+S hele tiden.

## Når du trenger dette

Du jobber en lang økt på én tidsplan, eller du glemmer ofte å lagre, og du vil at filen på disken eller i en delt mappe skal følge med. Automatisk lagring erstatter ikke gjenoppretting ved brudd: den er alltid på og virker uavhengig av dette. Hva forskjellen er, leser du i [Filer og formater](docs://uitleg-bestanden).

## Steg

1. Har prosjektet ingen fil ennå, lagre det først én gang med *Hjem › Fil › Lagre som*. Så lenge det ikke finnes en fil, er bryteren grå, og infoteksten sier: *Lagre prosjektet først for å bruke automatisk lagring.*
2. Klikk på bryteren *Automatisk lagring* øverst til venstre i linjen øverst. Når den er på, sier infoteksten: *Automatisk lagring er på: endringer skrives til denne filen.*
3. Fortsett å arbeide. Så snart prosjektet ditt har endringer, skriver appen det til filen din, uten vindu og høyst én gang per ti sekunder. Markeringen *Ikke lagret* forsvinner da av seg selv.
4. Vil du stoppe, klikk på bryteren én gang til. Infoteksten sier da: *Automatisk lagring er av. Gjenoppretting ved brudd er alltid aktiv.*

Chrome og Edge lar deg først bare lese en fil som du åpnet. Bryteren gjør ingenting der før du har lagret én gang med *Lagre* (Ctrl+S), og nettleseren har gitt tillatelse til å skrive. Etterpå kan du slå den på. I Firefox forblir bryteren grå: appen kan ikke skrive til filen din der.

## Fallgruver og hva appen gjør da

**Bryteren hører til ett prosjekt.** Hver fane har sin egen tilstand. Etter at et prosjekt er åpnet, er bryteren alltid av, og appen husker den ikke til neste gang.

**Automatisk lagring skriver bare til filen prosjektet allerede har.** Velger du *Lagre som*, skriver den til den nye filen fra da av. Appen skriver bare hvis det er endringer.

**Skrivingen kan mislykkes.** Hvis filen for eksempel er borte eller låst, vises meldingen *Automatisk lagring mislyktes* med årsaken. Hvis nettleseren ikke (eller ikke lenger) har tillatelse til å skrive, hopper appen over den runden stille: den ber ikke om tillatelse.

**Filen får også endringer du heller ikke vil beholde.** Automatisk lagring skriver tilstanden til prosjektet slik den er på det øyeblikket. Angrer du noe med Ctrl+Z, får filen den angrede tilstanden også innen ti sekunder. Vil du beholde en eldre versjon, lag først en kopi med *Lagre som*.

**Et brudd fører likevel til tap av de siste sekundene.** Appen skriver høyst én gang per ti sekunder, så det du gjorde mellom skrivingene, står ikke i filen din ennå. Gjenoppretting ved brudd har samme begrensning.

**Etter en gjenoppretting i nettleseren er bryteren igjen grå.** Et prosjekt som du får tilbake i nettleseren etter et brudd, er ikke lenger koblet til filen sin. Lagre det én gang, så fungerer bryteren igjen. Se [Gjenopprette etter et brudd](docs://howto-herstellen-na-een-crash).

**Et prosjekt fra et annet format har ingen fil.** En CSV-, XML-, `.mpp`- eller `.xer`-fil får først en IFC-fil når du lagrer. Etter det kan du slå på automatisk lagring.

## Se også

- [Filer og formater](docs://uitleg-bestanden): forskjellen mellom å lagre, automatisk lagring og gjenoppretting ved brudd.
- [Åpne og lagre en fil](docs://howto-bestand-openen-en-opslaan): lagre, lagre som og markeringen *Ikke lagret*.
- [Gjenopprette etter et brudd](docs://howto-herstellen-na-een-crash): hva appen tilbyr hvis den ikke ble avsluttet på riktig måte.
