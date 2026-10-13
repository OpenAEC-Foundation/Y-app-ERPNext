# Opsætning af en ressourcekalender

Doel: angive på hvilke dage en ressource er til rådighed, så histogrammet, overallokeringen og udjævningen regner med den.

## Hvornår du har brug for dette

Murerholdet arbejder kun mandag til torsdag. Kranen er på et andet projekt i de første to uger af august. En underleverandør har fire faste arbejdsdage. Uden en egen kalender antager appen, at ressourcen arbejder på dagene i projektkalenderen.

En ressourcekalender ændrer ingen opgavedatoer. Den bestemmer kun, hvornår ressourcen er til rådighed. Hvis en opgave er planlagt til en dag, hvor ressourcen ikke arbejder, er kapaciteten den dag 0, og dagen tælles som overallokeret. Vil du have, at opgaven selv kører på andre dage, så giv opgaven en egen kalender ([Oprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen)). Forskellen står i [Kalendere og arbejdsdage](docs://uitleg-kalenders).

## Trin

### Oprettelse af en ny ressourcekalender

1. Vælg *Ressourcer › Administrer › Ressourcer*. Ressourcepanelet åbnes. Findes ressourcen endnu ikke, så opret den med *Opret ressource i projektet*.
2. Find rækken med ressourcen. I kolonnen *Kalender* er standardværdien *Projektkalender*: ressourcen følger så projektkalenderen.
3. Vælg *+ Ressourcekalender* i listen. Vinduet *Ressourcekalender* åbnes. Det har de samme felter som kalenderformularen: *Navn*, *Arbejdsdage*, arbejdstiden og *Helligdage*. Den nye kalender starter som en kopi af standardkalenderen og får navnet *Ressourcekalender*.
4. Giv kalenderen et navn, der passer til ressourcen, for eksempel *Crew Mon–Thu*, og angiv arbejdsdagene: fjern markeringen ved fredag under *Arbejdsdage*. Du lægger helligdage eller nedetid i listen *Helligdage* med *Tilføj helligdag*.
5. Klik på *Anvend*. Kalenderen ligger nu i projektets bibliotek og er koblet til ressourcen. Det sker i ét trin, som du kan fortryde med *Fortryd*. Med *Annuller* oprettes der ikke noget.

### Valg eller tilpasning af en bestående kalender

Vælg en kalender på listen i kolonnen *Kalender*. *Projektkalender* fjerner igen den kalender, som ressourcen selv har. Vil du tilpasse den valgte kalender, så klik på blyanten ved siden af listen (*Rediger…*). Vinduet *Ressourcekalender* åbnes med den aktuelle kalender.

### Se resultatet

1. Hvis statuslinjen viser *Forældet — genberegn (F5)*, så tryk på **Beregn** (F5).
2. Vælg *Ressourcer › Histogram › Histogram*, og klik på ressourcen i listen til venstre for histogrammet. Dagene, hvor ressourcen ikke arbejder, men er planlagt, er røde. Holder du musen over en af dem, står der for eksempel *Arbejder ikke denne dag ifølge kalender "Crew Mon–Thu"*.
3. Under *Ressourcer › Overallokering* står antallet af ressourcer med overallokering, og statuslinjen viser for eksempel *1 ressource(r) overallokeret*.

## Faldgruber, og hvad appen gør da

**Kun dagene tæller, ikke timerne.** En ressourcekalender bepaler på hvilke dage ressourcen arbejder. Hvor mange enheder der er til rådighed den dag, følger af ressourcens *Maksimalt antal enheder*, ikke af arbejdstiden i kalenderen.

**Udjævning løser ikke altid problemet.** Hvis der ikke er et tidsrum, hvor alle dage i opgaven falder på en arbejdsdag for ressourcen, hjælper forskydning ikke. Vælg *Ressourcer › Udjævning › Udjævn…* og klik på *Beregn*. Opgaven står så under *Resterende konflikter* med årsagen *Ressourcen arbejder ikke på alle de dage, opgaven kræver — forskydning løser ikke dette.* Tildel så opgaven til en anden ressource, eller giv den en egen kalender.

**En delt kalender.** Listen viser alle projektets kalendere, altså også projektkalenderen og opgavernes kalendere. Hvis du ændrer en sådan kalender med blyanten, ændres også tidsplanen for de opgaver, der bruger den. Statuslinjen viser *Forældet — genberegn (F5)*. Lav hellere en egen kalender til ressourcen.

**Overallokering skyldes ikke altid kalenderen.** En ressource, der arbejder hver dag, kan også være overallokeret. Værktøjstippen nævner kun kalenderen, hvis dagen ikke er en arbejdsdag for ressourcen.

## Se også

- [Kalendere og arbejdsdage](docs://uitleg-kalenders): hvorfor en ressourcekalender ingen datoer forskyder.
- [Oprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen): felterne i kalenderformularen.
- [Generering af helligdage og byggeferie](docs://howto-feestdagen-genereren): at lægge helligdage og nedetid ind i kalenderen.
- [Kalendervinduer](docs://ref-kalenders): alle felter i kalendervinduerne.
