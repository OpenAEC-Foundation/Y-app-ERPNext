# Begrænsninger og deadlines

Murstenene leveres først den 21. juni. Tilladelsen er endnu ikke kommet. Taget skal være tæt, inden byggeferien. Afhængigheder viser, at en opgave venter på en anden opgave. Aftaler om en dato følger dog ikke af rækkefølgen i arbejdet. Det er netop det, begrænsninger og deadlines er til for. I denne artikel læser du, hvad hver type gør, hvornår en opgave flytter sig, og hvornår kun slækken ændrer sig. Du læser også, hvad en hård pin er, og hvordan appen melder en konflikt.

Reglerne og eksemplerne gælder for et nyt projekt med beregningsprofilen *Open Planner Studio* og en arbejdsuge fra mandag til fredag.

## Begrebet

En **begrænsning** er en datogrænse for én opgave, uafhængig af dens afhængigheder. En sådan grænse kan virke på to måder:

- Den **skubber**: opgaven må ikke starte eller slutte tidligere end datoen. Hvis opgaven på grund af sine afhængigheder ellers ville starte tidligere, flytter den sig til datoen.
- Den **kontrollerer**: opgaven skal starte eller slutte senest på datoen. Appen flytter intet. Hvis tidsplanen ikke når datoen, bliver **slækken** for opgaven og for kæden før den negativ. Slæk er den plads, en opgave har, før projektets slutdato flytter sig. Negativ slæk betyder, at du på papiret allerede er bagud (se [Kritisk vej og slæk](docs://uitleg-kritiek-pad)).

En **deadline** er en enklere form for kontrol: en måldato for slutningen af en opgave, uden at noget flytter opgaven.

Alle begrænsninger er **bløde**: beregningen fortsætter, også hvis en dato ikke nås. Der er één undtagelse, den **hårde pin**, som overstyrer afhængighederne. Mere om den nedenfor.

## Hvordan appen beregner

### De otte typer

Du vælger typen i feltet *Begrænsning* i panelet *Egenskaber*. Sådan beregner hver type:

- *Så tidligt som muligt (ASAP)*: ingen grænse. Det er standard: opgaven starter, så snart afhængighederne tillader det.
- *Så sent som muligt (ALAP)*: opgaven flytter sig så sent, som den kan, uden at en efterfølgende opgave skal starte senere. Den bruger derfor sin tilladte slæk. Har den stadig samlet slæk, fordi dens efterfølgende opgaver selv har plads, er den ikke-kritisk. Er den samlede slæk også brugt op, tæller opgaven som kritisk.
- *Start ikke tidligere end (SNET)*: en nedre grænse for starten. Ville opgaven starte tidligere, flytter den sig til datoen. Ligger datoen tidligere end det, afhængighederne tillader, gør begrænsningen intet.
- *Afslut ikke tidligere end (FNET)*: det samme, men for opgavens slutdato.
- *Start ikke senere end (SNLT)* og *Afslut ikke senere end (FNLT)*: en øvre grænse for starten eller slutdatoen. De flytter intet. Bliver grænsen ikke overholdt, melder appen en overtrådt begrænsning, og slækken bliver negativ.
- *Skal starte den (MSO)* og *Skal slutte den (MFO)*: en nedre og en øvre grænse på én gang. Opgaven flytter sig til datoen, hvis den er senere end afhængighederne kræver. Ligger datoen tidligere end det, afhængighederne tillader, bliver opgaven, hvor afhængighederne placerer den, og slækken bliver negativ.

Falder en dato på en lørdag, en søndag eller en fridag, læser appen den som en arbejdsdag: en nedre grænse (SNET, FNET) som den næste arbejdsdag, en øvre grænse (SNLT, FNLT) som den foregående.

### Hvad negativ slæk betyder

En øvre grænse virker baglæns. Sætter begrænsningen en opgaves seneste dato før dens tidligste dato, bliver den samlede slæk negativ. Det gælder også for opgaverne før den: Skal murerarbejdet senest starte fredag den 11. juni, og kan det ikke starte før mandag den 14. juni, er opgaverne før murerarbejdet også en arbejdsdag forsinket. Alle opgaver med negativ slæk er kritiske. Hvordan det virker, forklares i [Kritisk vej og slæk](docs://uitleg-kritiek-pad).

Bjælkerne flytter sig ikke på grund af en øvre grænse. Du ser konflikten i den negative *Samlet slæk*, i en rød rombe over bjælken, i meddelelsen i statuslinjen (for eksempel *1 begrænsning(er) overtrådt*) og i panelet *Advarsler*.

### Den hårde pin

Ved MSO og MFO vises afkrydsningsfeltet *Obligatorisk (pin-logik)*. Med afkrydsningen fastlåser du opgaven på datoen, også hvis dens foregående opgaver ikke er færdige til den tid. Afhængighederne overstyres:

- Opgaven ligger på datoen (ved MSO starter den der, ved MFO slutter den der) og overlapper med sine foregående opgaver.
- De foregående opgaver får negativ slæk, og appen melder en overtrådt begrænsning, så snart afhængighederne ville lade opgaven starte senere end pinnen. Den fastlåste opgave selv beholder 0 i slæk.
- De efterfølgende opgaver beregnes ud fra den fastlåste opgave. De kan derfor starte tidligere end uden pin, selv om logikken før den ikke er færdig. I eksemplet nedenfor rykker projektets slutdato tre arbejdsdage frem på grund af det.

Første gang du slår den hårde pin til, viser appen en kort forklaring: en hård pin overstyrer afhængighederne, bjælken er fastlåst på datoen, også før de foregående opgaver.

### Den sekundære begrænsning

En opgave har én primær begrænsning. Vil du også have en anden grænse, for eksempel en opgave, der ikke må starte før 14. juni og skal være færdig senest 17. juni, tilføjer du en **sekundær begrænsning**. Det skal være en reel grænse (SNET, FNET, SNLT eller FNLT). Den skal begrænse i den modsatte retning af den primære: en nedre grænse (SNET eller FNET) med en øvre grænse (SNLT eller FNLT). SNET med SNLT er derfor tilladt, SNET med FNET er ikke. Appen markerer andre kombinationer med rødt og med årsagen, for eksempel *Primær og sekundær må ikke begrænse samme side*. Ved ASAP, ALAP, MSO, MFO og en hård pin er en sekundær begrænsning ikke tilladt.

### Deadlinen

En deadline er en særskilt dato på en opgave, ved siden af begrænsningen. Den er en øvre grænse for slutdatoen: den flytter intet, men gør slækken negativ, hvis opgaven ikke er færdig i tide. Appen melder så i panelet *Advarsler* *Deadline … overskredet. Tidligste slutdato …*, og statuslinjen tæller de overskredne deadlines. I Gantt-diagrammet er der en pil nedad på deadline-datoen: grøn, så længe opgaven er færdig i tide, og rød, så snart den er forsinket. En deadline på en lørdag tæller til og med fredagen før.

For slækken gør en deadline det samme som FNLT. Forskellen ligger i, hvordan du bruger den. En deadline er en måldato, du vil kontrollere. Den står adskilt fra begrænsningen, så en opgave kan have både en begrænsning og en deadline. FNLT er en begrænsning: en overtrædelse vises som en overtrådt begrænsning i stedet for som en overskredet deadline.

### Hvad en begrænsning ikke gør

- På en **fase** (hovedopgave) tæller en begrænsning eller deadline ikke: appen beregner med opgaverne i fasen. Sæt den på opgaven selv.
- En opgave, der allerede har en faktisk startdato eller fremdrift, beholder den startdato. En SNET med en senere dato flytter den ikke.
- **Skriver du en startdato** på en opgave med en foregående opgave, virker det ikke som en fast start: den foregående opgave bestemmer fortsat. Derfor gør appen den til en SNET på den dato, du skrev. Det sker i panelet *Egenskaber*, i *Rediger opgave*, i tabellen og når du flytter bjælken i Gantt-diagrammet. Appen siger det også til dig. Har opgaven allerede en anden begrænsning (for eksempel ALAP eller MSO), anvender appen ikke den nye start og siger det også til dig. Ændr den begrænsning.

Alle ændringer vises først efter **Beregn** (F5).

## Et gennemregnet eksempel

Eksemplet er et lille netværk for en tilbygning. Det starter mandag den 7. juni 2027:

- *Groundwork* (3 arbejdsdage): mandag den 7. til onsdag den 9. juni.
- *Pour foundation* (2): torsdag den 10. og fredag den 11. juni.
- *Brickwork* (5): mandag den 14. til fredag den 18. juni.
- *Roofing* (3): mandag den 21. til onsdag den 23. juni.
- *Scaffolding* (2): følger efter *Pour foundation* og kommer før *Roofing*. Den kører mandag den 14. og tirsdag den 15. juni og har 3 arbejdsdage i slæk.

Den kritiske vej er *Groundwork*, *Pour foundation*, *Brickwork* og *Roofing*. Projektet er færdigt onsdag den 23. juni. Hvad ændrer sig med én begrænsning på *Brickwork*?

- **SNET mandag den 21. juni** (murstenene kommer først da): *Brickwork* kører fra mandag den 21. til fredag den 25. juni, og *Roofing* fra mandag den 28. til onsdag den 30. juni. Projektet er færdigt onsdag den 30. juni. *Groundwork* og *Pour foundation* har nu 5 arbejdsdage i slæk og er ikke længere kritiske. *Scaffolding* har 8.
- **SNET onsdag den 9. juni**: ingen effekt. Afhængighederne lader *Brickwork* alligevel kun starte mandag den 14. juni.
- **SNLT onsdag den 16. juni**: ingen effekt. *Brickwork* starter mandag den 14. juni og overholder grænsen med god margin.
- **SNLT fredag den 11. juni**: for stramt. *Brickwork* starter stadig mandag den 14. juni, én arbejdsdag for sent. *Groundwork*, *Pour foundation* og *Brickwork* får −1 arbejdsdag i slæk, og appen melder *Begrænsning Start ikke senere end (SNLT) 11-06-2027 overstyres af logikken (negativ slæk)*. Intet flytter sig.
- **MSO onsdag den 16. juni** (uden hård pin): *Brickwork* flytter sig til onsdag den 16. juni og er færdig tirsdag den 22. juni. *Roofing* kører fra onsdag den 23. til fredag den 25. juni, og projektet er færdigt fredag den 25. juni.
- **MSO fredag den 11. juni** (uden hård pin): datoen ligger tidligere end det, afhængighederne tillader. *Brickwork* starter alligevel mandag den 14. juni, og slækken bliver −1, ligesom ved SNLT.
- **MSO onsdag den 9. juni med hård pin**: *Brickwork* starter onsdag den 9. juni og er færdig tirsdag den 15. juni, mens *Pour foundation* stadig kører til fredag den 11. juni. *Roofing* kører fra onsdag den 16. til fredag den 18. juni. Projektet er færdigt tre arbejdsdage tidligere end uden pin. *Groundwork* og *Pour foundation* får −3 arbejdsdage i slæk.

Og med en begrænsning eller deadline på en anden opgave:

- **ALAP på** *Scaffolding*: opgaven flytter sig til torsdag den 17. og fredag den 18. juni, det seneste tidspunkt før *Roofing*. *Roofing* er dens eneste efterfølgende opgave og havde plads til præcis sine 3 arbejdsdage i slæk. De er nu brugt op, og *Scaffolding* er kritisk.
- **SNET lørdag den 19. juni på** *Scaffolding*: grænsen tæller som mandag den 21. juni. *Scaffolding* kører mandag den 21. og tirsdag den 22. juni, og *Roofing* flytter med til onsdag den 23. til fredag den 25. juni.
- **Deadline fredag den 18. juni på** *Roofing*: intet flytter sig, og *Roofing* bliver på mandag den 21. til onsdag den 23. juni. *Groundwork*, *Pour foundation*, *Brickwork* og *Roofing* får −3 arbejdsdage i slæk, og appen melder *Deadline 18-06-2027 overskredet. Tidligste slutdato 23-06-2027*. *Scaffolding* beholder 0 arbejdsdage i slæk og bliver også kritisk.
- **SNET mandag den 21. juni på** *Brickwork*, **deadline fredag den 25. juni på** *Roofing*: begrænsningen skubber *Brickwork* en uge tilbage, og deadlinen melder, at *Roofing* er forsinket onsdag den 30. juni. *Brickwork* og *Roofing* får −3 arbejdsdage i slæk. *Groundwork* og *Pour foundation* beholder 2 arbejdsdage.

I selvstudium 3 angiver du selv en begrænsning og en deadline i selvstudieprojektet og ser, hvordan tidsplanen flytter sig.

## Konsekvenser og misforståelser

**„En begrænsning flytter opgaven.“** Kun SNET, FNET, MSO og MFO kan sætte en opgave senere end dens afhængigheder, og ALAP kan skubbe den senere, inden for dens tilladte slæk. SNLT og FNLT flytter aldrig noget: de advarer kun. At nå datoen betyder så at forkorte kæden før den.

**„Negativ slæk er en fejl i appen.“** Det er signalet om, at tidsplanen er i konflikt med din datoaftale. Du løser det ved at forkorte kæden, lempe aftalen eller bevidst acceptere konflikten.

**„En hård pin løser konflikten.“** En hård pin skjuler konflikten. Opgaven ligger på datoen, men dens foregående opgaver er ikke klar til den, og de efterfølgende opgaver beregnes, som om de var det. Brug den kun for en dato, der virkelig er fast, for eksempel en juridisk overdragelsesdato. Brug den ikke som en måde at få en opgave på en bestemt dato.

**„Jeg skriver bare en startdato.“** En opgave med en foregående opgave bliver så en SNET. Ligger den dato tidligere end det, den foregående opgave tillader, gør den intet.

**„Deadline eller FNLT?“** Vælg en deadline for en måldato, du vil kontrollere. Vælg en begrænsning for en dato, der virkelig er en grænsebetingelse for tidsplanen.

**„En begrænsning på fasen.“** Den tæller ikke. Sæt den på opgaven selv.

## Se også

- [Sådan angiver du en begrænsning eller deadline](docs://howto-constraint-deadline-zetten): trinene til at angive en begrænsning eller deadline.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): de afhængigheder, som begrænsninger ligger ved siden af.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan negativ slæk opstår, og hvad den gør ved den kritiske vej.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): en hård pin (*Skal starte den (MSO)*) på *Municipal road closure (permitted closure period)* og en sekundær begrænsning (*Start ikke senere end (SNLT)*) på *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): en deadline, der ikke nås, med negativ slæk.
