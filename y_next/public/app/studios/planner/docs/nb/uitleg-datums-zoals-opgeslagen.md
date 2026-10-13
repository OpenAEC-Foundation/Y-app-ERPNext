# Datoer slik de er lagret

Du åpner en tidsplan fra Primavera eller MS Project, og datoene avviker fra det du så i den pakken. Har importen gått galt? Vanligvis ikke. I denne artikkelen leser du hvorfor appen omberegner selv, når den viser datoene fra filen, hva som da er tomt, og hvordan du går tilbake til appens egen beregning. Eksemplet til slutt følger to aktiviteter gjennom hele forløpet.

## Begrepet

En tidsplanfil inneholder to slags data. For det første logikken: aktiviteter, varigheter, avhengigheter, kalendere og begrensninger. For det andre datoene som pakken selv har beregnet ut fra dette. Ved åpning bruker Open Planner Studio logikken og beregner selv. Datoene i filen er altså ikke inndata.

Hvis appens egen beregning gir andre datoer enn filen, vet du ikke hvilken side som har rett. Filen kan mangle logikk som pakken brukte. Pakken kan også beregne annerledes enn appen på et punkt. Derfor kan appen vise datoene **som lagret**: datoene den andre pakken skrev i filen. Da kan du sammenligne med det du så i den pakken.

## Slik håndterer appen det

### Hvilken beregningsprofil appen bruker

Appen beregner med en **beregningsprofil**: et sett med beregningsregler som bestemmer, for eksempel, hvordan den behandler planlagt start for en aktivitet og begrensninger. Se [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen). Det finnes tre innebygde profiler: *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. En `.xer`-fil åpnes med *Primavera P6* og en `.mpp`-fil med *Microsoft Project*. CSV, MS Project XML og Primavera P6 XML åpnes med *Open Planner Studio*. Profilen for et prosjekt finnes under *Fil › Prosjektinfo*, ved *Beregningsprofil og beregningsalternativer*. En IFC-fil fra appen beholder sin profil.

### Når appen sammenligner

Ved åpning noterer appen hva filen sa, og sammenligner det med sitt eget resultat. Det gjør den for:

- en Primavera-fil (`.xer`) og Primavera P6 XML;
- MS Project XML og MS Project-filer (`.mpp`);
- en IFC-fil fra et annet program, for aktivitetene der de tidligste datoene står i filen;
- en IFC-fil fra appen selv som har husket sin opprinnelse. Nedenfor leser du når det er tilfelle.

Appen sammenligner aldri en CSV-fil: startdatoen i en CSV er inndata, ikke resultatet av en beregning. En IFC-fil fra appen selv uten husket opprinnelse sammenlignes heller ikke.

Avviker ingen aktivitet, merker du ingenting. Er minst én aktivitet forskjellig i en fil du importerer nå, slår appen visningen på med én gang.

Med en Primavera-fil beregner appen med beregningsprofilen *Primavera P6*. Den beholder den planlagte starten fra filen som tidligste start. En aktivitet som står senere i filen enn avhengighetene krever, men som også er planlagt der, blir derfor stående. Da er det ingen forskjell.

### Hva du ser

Under båndet står en meldingsrad: *Du ser datoene slik de står i filen. Ved omberegning avviker 4 aktiviteter.* Med en Primavera-kilde (en `.xer` eller Primavera P6 XML) står det *Du ser tidsplanen slik Primavera lagret den. Ved omberegning avviker 1 aktivitet.* Til høyre i meldingsraden er knappen *Omberegn*. Meldingsraden har ingen kryss.

Det står også en melding: *4 aktiviteter viser datoene slik de står i filen (ikke omberegnet).* Bare med en `.xer` står det *1 aktivitet viser datoene slik Primavera lagret dem (ikke omberegnet).* Hver aktivitet som har datoer lagret i filen, får et merke i panelet *Egenskaper*: *Viser Primaveras egne lagrede datoer for denne aktiviteten* ved en Primavera-kilde, eller *Viser datoene slik de står i filen for denne aktiviteten* ved en annen kilde. Gantt-diagrammet, aktivitetstabellen og statuslinjen viser datoene fra filen.

### Hva som er tomt i denne visningen

I denne visningen beregner appen ingenting. Den viser bare det filen lagret. Du ser derfor slakk og kritisk linje bare hvis filen inneholder dem. Registrerer filen ingen kritiske aktiviteter, viser statuslinjen 0 kritiske aktiviteter. Det sier ingenting om den kritiske linjen i selve pakken. Det som bare kommer ut av en beregning, finnes ikke i denne visningen: hvilke avhengigheter som styrer tidsplanen, brutte begrensninger, aktiviteter som går ut av rekkefølge og nesten kritiske aktiviteter.

Mangler filen noe for en aktivitet, ser du merket *Registreringen er delvis ufullstendig. Se kolonnene for seneste dato og slakk* i panelet *Egenskaper*. I en CSV-eksport står kolonnene *Kritisk* og *Totalslakk* tomme for en slik aktivitet, i stedet for en oppdiktet null.

### Å forlate visningen

Du forlater visningen på to måter:

- Klikk på *Omberegn* i meldingsraden, eller velg *Beregn* (F5). Appen beregner med sine egne regler.
- Endre noe som kan endre datoene, for eksempel varigheten til en aktivitet eller en ny aktivitet. Appen forlater visningen og beregner med én gang, også når *Beregne automatisk* er av. Å endre et navn gjør det ikke: visningen blir stående.

En kalenderendring fra ressursbiblioteket lar visningen og datoene fra filen bli stående, men oppdaterer tallet i meldingsraden.

Etter at du har forlatt visningen, finnes det ingen knapp for å gå tilbake. Ctrl+Z gir den tilbake rett etter omberegning eller rett etter en slik redigering. Ellers kan du åpne kildefilen på nytt. Med en `.xer` slår også det å åpne en IFC-fil som du lagret etter omberegning, men ikke redigerte, visningen på igjen.

### Gjenoppretting ved brudd

Gjenoppretter du et prosjekt etter et krasj som var i visningen, blir visningen stående. Prosjektet som var aktivt, viser samme meldingsrad som før. Et prosjekt på en annen fane viser meldingsraden uten tall: *Du ser datoene slik de står i filen. Det er ikke omberegnet.* Se [Gjenoppretting ved brudd](docs://howto-herstellen-na-een-crash).

### Lagring og gjenåpning

Lagrer du mens du bruker visningen, skriver appen de viste datoene til IFC-filen, sammen med kildeformatet. Åpner du den IFC-filen igjen senere, og har du ikke redigert den siden importen, er visningen på igjen, uten en ny melding.

Har du redigert og lagret i mellomtiden, avhenger det av kilden. Med en Primavera-fil beholder IFC-filen den opprinnelige `.xer`-filen. Appen sammenligner da på nytt og tilbyr visningen: *Omberegningen flyttet én av de 2 aktivitetene i forhold til datoene i filen.* Med meldingen følger knappen *Vis lagrede datoer* og et kryss. På hver avvikende aktivitet viser panelet *Egenskaper* merket *Avviker fra de lagrede datoene*. *Vis lagrede datoer* slår visningen på; Ctrl+Z angrer det. Krysset skjuler tilbudet.

Med MS Project XML, `.mpp`, Primavera P6 XML eller en IFC-fil fra et annet program beholder IFC-filen ikke kilden. Redigerer og lagrer du et slikt prosjekt, sammenligner appen ikke lenger ved ny åpning.

## Eksempel: tilbygget

Anta at du åpner en Primavera-fil *Uitbouw* (tilbygg) med to aktiviteter, på en kalender uten helligdager. I 2027 er 6. mai Kristi himmelfartsdag, og 17. mai er 2. pinsedag. Med helligdager i kalenderen blir datoene annerledes. *Fundering storten* (støpe fundament) varer 5 arbeidsdager, *Metselwerk* (murverk) varer 10 arbeidsdager, og Metselwerk følger Fundering med en avhengighet av typen slutt-til-start. Filen registrerer at Fundering går fra mandag 3. mai til fredag 7. mai 2027, og Metselwerk fra mandag 17. mai til fredag 28. mai 2027: en uke etter den tidligste starten avhengigheten tillater. Den planlagte starten for Metselwerk i filen er mandag 10. mai 2027.

Rett etter åpning ser du datoene fra filen. Statuslinjen sier *Slutt: 28-05-2027* og *Kritisk linje: 2 aktiviteter, 20 arbeidsdager*. Meldingsraden viser at 1 aktivitet avviker ved omberegning, og begge aktivitetene viser *Viser Primaveras egne lagrede datoer for denne aktiviteten*.

Ved *Omberegn* blir Fundering stående på 3. til 7. mai. Metselwerk starter nå mandag 10. mai, den første arbeidsdagen etter at Fundering slutter, og slutter fredag 21. mai. Tidsplanen slutter 21. mai 2027 og varer 15 arbeidsdager i stedet for 20. Den kritiske linjen består av de samme 2 aktivitetene.

Hva om det er annerledes?

- Hvis Metselwerk også er planlagt på mandag 17. mai i filen, beholder beregningsprofilen *Primavera P6* den starten. Beregningen ender 17. til 28. mai. Det er ingen forskjell, og visningen slås ikke på.
- Du legger til en aktivitet i visningen. Det gir den samme omberegningen. Metselwerk flytter til 10. til 21. mai.
- Du lagrer i visningen og åpner IFC-filen igjen uten å redigere: Metselwerk er tilbake på 17. til 28. mai.
- Du omberegner, lagrer uten å redigere mer og åpner IFC-filen igjen: visningen er på igjen, og Metselwerk står på 17. til 28. mai.
- Du redigerer, lagrer og åpner igjen: appen tilbyr visningen med *Omberegningen flyttet én av de 2 aktivitetene i forhold til datoene i filen.* Metselwerk viser *Avviker fra de lagrede datoene*.

## Konsekvenser og misforståelser

**En forskjell er ikke en importfeil.** Appen beregner med sine egne regler: med en `.xer` og beregningsprofilen *Primavera P6*, med en `.mpp` og *Microsoft Project*, og med CSV, MS Project XML og Primavera P6 XML med *Open Planner Studio*. Hvorfor datoene i kildepakken ble annerledes, kan skyldes filen eller pakken. Visningen viser deg *at* de avviker.

**Visningen er ikke et beregningsresultat.** Appen har ikke beregnet datoene. Ta dem ikke bare over som resultatet av tidsplanen din selv.

**Lagring i visningen beholder datoene fra kildepakken.** IFC-filen inneholder da det kildepakken sa, ikke det appen ville ha beregnet.

**Knappen *Vis lagrede datoer* vises ikke ved hver import.** Med en nyåpnet fil er visningen allerede på. Knappen vises bare ved en IFC-fil med en Primavera-kilde som er åpnet på nytt, og som du har redigert siden importen.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hva appen beholder i en fil, og hva en import eller eksport tar med.
- [Åpne en Primavera P6-fil (.xer)](docs://howto-xer-openen): stegene og meldingene for en `.xer`-fil.
- [Åpne en MS Project-fil (.mpp)](docs://howto-mpp-openen): stegene og meldingene for en `.mpp`-fil.
- [Gjenoppretting ved brudd](docs://howto-herstellen-na-een-crash): hva som skjer med dette prosjektet etter et krasj.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan appen beregner slakk og kritisk linje, når den beregner.
