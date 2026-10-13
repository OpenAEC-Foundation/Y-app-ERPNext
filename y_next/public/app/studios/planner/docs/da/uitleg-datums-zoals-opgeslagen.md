# Gemte datoer

Du åbner en tidsplan fra Primavera eller MS Project, og datoerne er anderledes end i det program, du så dem i. Er importen gået galt? Normalt ikke. I denne artikel læser du, hvorfor appen selv genberegner, hvornår den viser datoerne fra filen, hvad der så er tomt, og hvordan du kommer tilbage til appens egen beregning. Eksemplet til sidst følger to opgaver gennem hele cyklussen.

## Begrebet

En tidsplanfil indeholder to slags data. Først logikken: opgaver, varigheder, afhængigheder, kalendere og begrænsninger. Dernæst de datoer, som programmet selv har beregnet ud fra logikken. Når du åbner filen, bruger Open Planner Studio logikken og beregner selv. Datoerne i filen er derfor ikke input.

Hvis appens egen beregning ender på andre datoer end filen angiver, ved du ikke, hvilken side der har ret. Filen kan mangle logik, som programmet brugte. Programmet kan også beregne anderledes end appen på et bestemt punkt. Derfor kan appen vise datoerne **som gemt**: de datoer, det andet program skrev i filen. Så sammenligner du med det, du så i det programm.

## Sådan håndterer appen det

### Hvilken beregningsprofil appen bruger

Appen beregner med en **beregningsprofil**: et sæt beregningsregler (konventioner), der bl.a. bestemmer, hvordan den behandler den planlagte start på en opgave og begrænsninger. Se [Beregningsprofiler og konventioner](docs://uitleg-rekenprofielen). Der er tre indbyggede profiler: *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. En `.xer` åbnes med *Primavera P6*, og en `.mpp` åbnes med *Microsoft Project*. CSV, MS Project XML og Primavera P6 XML åbnes med *Open Planner Studio*. Profilen for et projekt står under *Fil › Projektinfo*, ved *Beregningsprofil og beregningsindstillinger*. En IFC-fil fra appen beholder sin profil.

### Hvornår appen sammenligner

Når du åbner en fil, noterer appen, hvad filen sagde, og sammenligner det med sit eget resultat. Det gør den for:

- en Primavera-fil (`.xer`) og Primavera P6 XML;
- MS Project XML og MS Project-filer (`.mpp`);
- en IFC-fil fra et andet program, for de opgaver, hvis tidligste datoer står i filen;
- en IFC-fil fra appen selv, som har husket sin oprindelse. Nedenfor læser du, hvornår det er tilfældet.

Appen sammenligner aldrig en CSV-fil: startdatoen i en CSV er input, ikke resultatet af en beregning. En IFC-fil fra appen selv uden husket oprindelse sammenlignes heller ikke.

Hvis ingen opgave afviger, ser du ingenting. Hvis mindst én opgave afviger i en fil, du importerer nu, slår appen visningen til med det samme.

Ved en Primavera-fil beregner appen med beregningsprofilen *Primavera P6*. Den holder den planlagte start fra filen som tidligste startdato. En opgave, der står senere i filen, end afhængighederne kræver, men som også er planlagt der, bliver derfor, hvor den er: så er der ingen forskel.

### Hvad du ser

Under båndet er der en meddelelseslinje: *Du ser datoerne, som de står i filen; ved at genberegne forskydes 4 opgaver.* Ved en Primavera-kilde (en `.xer` eller Primavera P6 XML) står der *Du ser tidsplanen, som Primavera gemte den; ved at genberegne forskydes 1 opgave.* Til højre i meddelelseslinjen er knappen *Genberegn*. Meddelelseslinjen har intet kryds.

Der er også en besked: *4 opgaver viser datoerne, som de står i filen (ikke genberegnet).* Kun ved en `.xer` står der *1 opgave viser datoerne, som Primavera gemte dem (ikke genberegnet).* Hver opgave, som filen har gemte datoer for, får et mærke i panelet *Egenskaber*: *Viser Primaveras egne gemte datoer for denne opgave* ved en Primavera-kilde, eller *Viser datoerne som de står i filen for denne opgave* ved en anden kilde. Gantt, opgavetabellen og statuslinjen viser datoerne fra filen.

### Hvad der er tomt i denne visning

I denne visning beregner appen ingenting. Den viser kun, hvad filen har gemt. Du ser derfor kun slæk og kritisk vej, hvis filen indeholder dem. Hvis filen ikke har gemt nogen kritiske opgaver, viser statuslinjen 0 kritiske opgaver. Det siger intet om den kritiske vej i selve programmet. Det, der kun kommer ud af en beregning, findes ikke i denne visning: hvilke afhængigheder der styrer tidsplanen, overtrådte begrænsninger, opgaver der ligger ude af rækkefølge og næsten kritiske opgaver.

Gemmer filen ikke alt for en opgave, ser du mærket *Registreringen er delvis ufuldstændig — se kolonnerne for seneste datoer og slæk* i panelet *Egenskaber*. I en CSV-eksport forbliver kolonnerne *Kritisk* og *Samlet slæk* tomme for en sådan opgave i stedet for et opdigtet nul.

### Sådan forlader du visningen

Du forlader visningen på to måder:

- Klik på *Genberegn* i meddelelseslinjen, eller vælg *Beregn* (F5). Appen beregner med sine egne regler.
- Ændr noget, der kan ændre datoerne, fx varigheden af en opgave eller en ny opgave. Appen forlader visningen og genberegner med det samme, også selv om *Beregn automatisk* er slået fra. Ændrer du et navn, sker det ikke: visningen forbliver aktiv.

En kalenderændring fra ressourcebiblioteket lader visningen være aktiv og datoerne fra filen stå, men opdaterer tallet i meddelelseslinjen.

Når du har forladt visningen, er der ingen knap til at skifte tilbage. Ctrl+Z bringer den dog tilbage, lige efter at du har genberegnet, eller lige efter en sådan ændring. Ellers kan du åbne kildefilen igen. Ved en `.xer` slår det også visningen til igen, når du åbner en IFC-fil, som du gemte efter genberegningen, men ikke redigerede.

### Genoprettelse efter nedbrud

Genopretter du et projekt efter et nedbrud, der var i visningen, forbliver visningen aktiv. Det aktive projekt viser samme meddelelseslinje som før. Et projekt på en anden fane viser meddelelseslinjen uden tal: *Du ser datoerne, som de står i filen. Der er ikke genberegnet.* Se [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash).

### Gemme og åbne igen

Gemmer du, mens du bruger visningen, skriver appen de viste datoer til IFC-filen sammen med kildeformatet. Åbner du den IFC-fil igen senere, og har du ikke redigeret den siden importen, er visningen aktiv igen uden en ny besked.

Har du redigeret og gemt imens, afhænger det af kilden. Ved en Primavera-fil gemmer IFC-filen den oprindelige `.xer` med sig. Appen sammenligner så igen og tilbyder visningen: *Genberegningen forskød 1 af de 2 opgaver i forhold til datoerne i filen.* Med den følger knappen *Vis gemte datoer* og et kryds. På hver afvigende opgave viser panelet *Egenskaber* mærket *Afviger fra de gemte datoer*. *Vis gemte datoer* slår visningen til; Ctrl+Z fortryder det. Krydset skjuler tilbuddet.

Ved MS Project XML, `.mpp`, Primavera P6 XML eller en IFC-fil fra et andet program gemmer IFC-filen ikke kilden. Redigerer og gemmer du et sådant projekt, sammenligner appen ikke længere, når du åbner det igen.

## Eksempel: tilbygningen

Stel dat du åbner en Primavera-fil *Uitbouw* (tilbygning) med to opgaver, på en kalender uden helligdage. I 2027 er 6. maj Kristi Himmelfartsdag, og 17. maj er pinsemandag: med helligdage i kalenderen kommer datoerne anderledes ud. *Fundering storten* (støbe fundamentet) tager 5 arbejdsdage, *Metselwerk* (murværk) 10 arbejdsdage, og Metselwerk følger Fundering med en afhængighed af typen slut til start. Filen gemmer, at Fundering løber fra mandag den 3. maj til fredag den 7. maj 2027, og at Metselwerk løber fra mandag den 17. maj til fredag den 28. maj 2027: en uge efter den tidligste startdato, som afhængigheden tillader. Den planlagte start for Metselwerk i filen er mandag den 10. maj 2027.

Lige efter at du har åbnet filen, ser du datoerne fra filen. Statuslinjen siger *Slut: 28-05-2027* og *Kritisk vej: 2 opgaver, 20 arbejdsdage*. Meddelelseslinjen melder, at 1 opgave afviger ved genberegning, og begge opgaver viser *Viser Primaveras egne gemte datoer for denne opgave*.

Ved klik på *Genberegn* forbliver Fundering på 3. til 7. maj. Metselwerk starter nu mandag den 10. maj, den arbejdsdag efter Fundering slutter, og slutter fredag den 21. maj. Tidsplanen slutter 21. maj 2027 og spænder over 15 arbejdsdage i stedet for 20. Den kritiske vej består af de samme 2 opgaver.

Hvad hvis det er anderledes?

- Er Metselwerk også planlagt til mandag den 17. maj i filen, beholder beregningsprofilen *Primavera P6* den start. Beregningen giver 17. til 28. maj, der er ingen forskel, og visningen slår ikke til.
- Du tilføjer en opgave i visningen: det samme som en genberegning. Metselwerk flyttes til 10. til 21. maj.
- Du gemmer i visningen og åbner IFC-filen igen uden at redigere: Metselwerk er tilbage på 17. til 28. maj.
- Du genberegner, gemmer uden at redigere mere og åbner IFC-filen igen: visningen er aktiv igen, og Metselwerk ligger på 17. til 28. maj.
- Du redigerer, gemmer og åbner igen: appen tilbyder visningen med *Genberegningen forskød 1 af de 2 opgaver i forhold til datoerne i filen.* Metselwerk viser *Afviger fra de gemte datoer*.

## Konsekvenser og misforståelser

**En forskel er ikke en importfejl.** Appen beregner med sine egne regler: med en `.xer` med beregningsprofilen *Primavera P6*, med en `.mpp` med *Microsoft Project*, og med CSV, MS Project XML og Primavera P6 XML med *Open Planner Studio*. Hvorfor datoerne i kildepakken blev anderledes, kan ligge i filen eller i programmet. Visningen viser dig *at* de afviger.

**Visningen er ikke et beregningsresultat.** Appen har ikke beregnet datoerne. Overtag dem ikke bare som resultat af din egen tidsplan.

**Gemmer du i visningen, bevares datoerne fra kildepakken.** IFC-filen indeholder da det, kildepakken sagde, og ikke det, appen ville beregne.

**Knappen *Vis gemte datoer* vises ikke ved hver import.** Ved en nyligt åbnet fil er visningen allerede aktiv. Knappen vises kun ved en genåbnet IFC-fil med en Primavera-kilde, som du har redigeret siden importen.

## Se også

- [Filer og formater](docs://uitleg-bestanden): hvad appen gemmer i en fil, og hvad en import eller eksport bærer.
- [Åbn en Primavera P6-fil (.xer)](docs://howto-xer-openen): trinene og meddelelserne for en `.xer`-fil.
- [Åbn en MS Project-fil (.mpp)](docs://howto-mpp-openen): trinene og meddelelserne for en `.mpp`-fil.
- [Genoprettelse efter nedbrud](docs://howto-herstellen-na-een-crash): hvad der sker med dette projekt efter et nedbrud.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan appen beregner slæk og kritiskhed, når den faktisk beregner.
