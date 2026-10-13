# Valg af en arbejdsregel

Mål: stil pr. opgave ind, hvad appen justerer, når du ændrer varigheden, tildelingsenhederne eller arbejdet: varigheden, tildelingsenhederne eller selve arbejdet.

## Hvornår du har brug for dette

Du har sat ressourcer på en opgave, og du vil have appen til at beregne, som du gør. Et eksempel: kranen er lejet for én dag, og den dag ligger fast. Et andet eksempel: du ved, at der er 160 timer murerarbejde, og du vil se, hvor lang tid det tager med tre personer i stedet for to. De to situationer kræver en forskellig arbejdsregel.

Reglen bestemmer, hvilken af de tre størrelser varighed, tildelingsenheder og arbejde der flytter sig med, når du ændrer en anden. Baggrunden og de gennemregnede eksempler står i [Arbejdsregler: varighed, enheder og arbejde](docs://uitleg-werkregels).

## Trin

### Vis arbejdsreglen

Arbejdsreglen vises ikke som standard. Slå den til én gang:

1. Vælg *Indstillinger › Projekt › Indstillinger*, fanen *Tidsplan*.
2. Under overskriften *Beregning* sætter du flueben ved *Vis arbejdsregler og arbejde*.
3. Luk vinduet med *Luk*.

Dette er en indstilling i appen, ikke i projektfilen. Indeholder filen allerede arbejdsregler eller gemt arbejde, fx en fil fra MS Project eller Primavera P6, så viser appen arbejdsreglen for den fil, også uden denne indstilling. Det samme gælder, så snart du selv vælger en arbejdsregel i en fil: visningen forbliver så tændt for den fil, også selv om du slår indstillingen fra igen. Visningen forbliver tændt, så længe filen er åben, og efter genåbning, så længe filen indeholder en arbejdsregel eller gemt arbejde.

### Vælg en regel

1. Vælg opgaven. Panelet *Egenskaber* står til højre. Ser du det ikke, slår du det til med *Visning › Paneler › Egenskaber*.
2. Under *Arbejdsregel* vælger du en af de fem muligheder: *Projektstandard (Fast varighed og faste enheder)*, *Fast varighed og faste enheder*, *Fast varighed og fast arbejde*, *Fast arbejde* eller *Faste enheder*. Med *Projektstandard* følger opgaven projektets standard.
3. Under rullelisten viser appen, hvad reglen beskytter, fx *Beskyttet: arbejde (varighed følger enheder)*.

*Projektstandard* er den første mulighed og det, en opgave har som standard. Reglen i parentesen er den, projektet har som standard nu. Appen har ingen knap til at ændre den projektstandard: den kommer fra en import (fx fra MS Project eller Primavera P6) eller fra MCP-forbindelsen. Vil du have en anden regel for én opgave, vælger du den her.

Du kan også vælge reglen i tabellen. Klik på **+** til højre i kolonneoverskriften i opgavetabellen (*Tilføj kolonne*) og vælg under *Tidsplan* kolonnen *Arbejdsregel*.

En opgave uden tildeling har intet at binde sammen, så reglen gør der ingenting. Tildel først en ressource (se [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen)).

### Se og ændr arbejdet

For en opgave med tildelinger vises en kolonne *Arbejde (rest.)* i blokken *Tildelinger* i panelet *Egenskaber*, ved siden af *Enh./dag*. Det er det resterende arbejde for den ressource, i timer. En lille hængelås over en kolonne viser, hvad reglen holder fast: *Enh./dag* ved *Fast varighed og faste enheder* og ved *Faste enheder*, *Arbejde (rest.)* ved *Fast varighed og fast arbejde* og ved *Fast arbejde*.

Vil du selv ændre arbejdet, skriver du timerne i feltet og trykker på Enter. Appen accepterer ikke en værdi på 0 eller mindre: feltet springer tilbage til den forrige værdi.

### Se hvad der sker

Når du vælger en regel, ændres endnu ingen tal. Under en regel, der beskytter arbejde, låser appen kun det aktuelle arbejde, så *Arbejde (rest.)* får en gemt værdi. Først ved den næste ændring bestemmer reglen, hvad der flytter sig med. Ændr fx *Enh./dag* og se, hvad der sker med varigheden og arbejdet.

Ændrer det opgavens varighed, viser statuslinjen *Forældet — genberegn (F5)*. Tryk på **Beregn** (F5), fx via *Start › Tidsplan › Beregn*, for at se de nye datoer. Er *Beregn automatisk* til (samme fane *Tidsplan*, overskriften *Beregning*), gør appen det selv.

## Hvilken regel passer

- **Fast varighed og faste enheder** passer, når varigheden er en aftale, og tildelingsenhederne er dit eget valg. Arbejdet følger af de to. Dette er standardreglen. Kranen, der er lejet for én dag, hører hertil: dagen ligger fast, og du bepaler, hvor mange kraner der er på den.
- **Fast varighed og fast arbejde** passer, når opgaven skal være færdig inden for en fast periode, og du kender mængden af arbejde i den. Ændrer varigheden sig, justerer appen tildelingsenhederne.
- **Fast arbejde** passer, når du kender antallet af timer arbejde i opgaven og vil se, hvordan varigheden ændrer sig med antallet af personer. De 160 timer murerarbejde med tre personer i stedet for to hører hertil. Pudsearbejdet i øvelsesprojektet får denne regel.
- **Faste enheder** passer, når tildelingsenhederne ligger fast, fx én kran, og arbejdet bestemmer varigheden.

## Faldgruber, og hvad appen gør så

**Feltet *Arbejdsregel* mangler.** Så er indstillingen *Vis arbejdsregler og arbejde* slået fra, og filen har endnu ingen arbejdsregler. Eller du har valgt en milepæl, en fase, en hængekøje eller en opgave med varighedstypen *Forløbet varighed*. Dér er der ingen arbejdsregel. Vælg en almindelig opgave.

**Varigheden ændres, selv om du ikke ændrer den.** Under *Fast arbejde* og *Faste enheder* følger varigheden af tildelingsenheder og arbejde. Ændrer du en af dem eller antallet af ressourcer, justerer appen varigheden og runder op til hele arbejdsdage. For en opgave i timer runder appen op til hele minutter.

**Arbejdet stemmer ikke præcist med tildelingsenheder × varighed.** Afrunding kan give det. Ved siden af *Arbejde (rest.)* vises så et advarselstegn med teksten *Afviger fra tildelingsenheder × varighed*. Histogrammet følger det gemte arbejde.

**Materiale tæller ikke med.** For en materialeressource viser *Arbejde (rest.)* en streg. Materiale bestemmer aldrig varigheden.

**En opgave med fremdrift.** Reglen virker på den resterende del. Så viser *Arbejde (rest.)* kun det, der stadig skal ske.

**Fortrydelse.** Valg af en regel og hver ændring, som reglen beregner, er ét trin for *Fortryd* (Ctrl+Z). Reglen er så væk igen, men feltet *Arbejdsregel* forbliver vist.

## Se også

- [Arbejdsregler: varighed, enheder og arbejde](docs://uitleg-werkregels): hvordan appen binder varighed, tildelingsenheder og arbejde sammen, med gennemregnede eksempler.
- [Tildeling af ressourcer med en kurve](docs://howto-resource-toewijzen): at sætte en ressource på en opgave.
