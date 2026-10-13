# Eksterne afhængigheder til et andet projekt

Mål: sammenkæd en opgave i dette projekt med en opgave i en anden projektfil, så din tidsplan tager højde for arbejde, der er planlagt et andet sted.

## Hvornår har du brug for dette

Din tilbygning kan først starte, når byggepladsen er gjort klar til byggeri, og det arbejde ligger i entreprenørens projekt. Eller installatøren kan først starte, når din konstruktion er færdig, og han planlægger i sin egen fil. En almindelig afhængighed virker kun mellem opgaver i samme projekt. En **ekstern afhængighed** sammenkæder en opgave med en opgave i en anden fil.

En ekstern afhængighed beregner ikke løbende sammen med det andet projekt. Appen gemmer en fast **ankerdato**: datoen for den eksterne opgave på det tidspunkt, du sammenkæder den. Beregningen bruger den dato som en grænse. Ændrer det andet projekt sig, flytter intet i dit eget projekt, før du opdaterer ankeret.

## Trin

1. Vælg præcis én opgave i dette projekt: den opgave, der afhænger af den eksterne opgave, eller som den eksterne opgave afhænger af.
2. Vælg *Start › Opgaver › Sammenkæd ▾ › Tilføj ekstern afhængighed*…. Den samme menu findes under *Tidsplan › Afhængigheder* og under *Tabel › Opgaver*. Punktet er kun tilgængeligt, hvis præcis én opgave er valgt.
3. I vinduet *Ekstern afhængighed (på tværs af projekter)* vælger du en af de to veje. Med *Kildefil* vælger du projektfilen under *Vælg en nylig fil* og derefter *Kildeopgave*. Appen læser filen uden at ændre den, åbner den ikke som dokument og overtager selv ankerdatoen. Denne vej virker kun i desktopappen og kun for en fil på listen over nylige filer. Ellers er knappen *Kildefil* deaktiveret. Med *Manuelt (reserve)* udfylder du *Projekt-id* og *Opgave-id* for den eksterne opgave, eventuelt *Opgavenavn (valgfrit)*, og *Ankerdato*. I browserversionen er dette den eneste vej.
4. Vælg under *Retning*, om den eksterne opgave er din foregående eller efterfølgende opgave: *Foregående opgave (ekstern → denne)* eller *Efterfølgende opgave (denne → ekstern)*.
5. Vælg *Afhængighedstype* (FS, SS, FF eller SF). Udfyld om nødvendigt *Forsinkelse (arbejdsdage)*, for eksempel `0d` eller `2d`.
6. Klik på *Tilføj afhængighed* og tryk på **Beregn** (F5).

Hvilken dato du angiver som ankerdato for en manuel afhængighed, afhænger af retningen og typen:

- Med en ekstern **foregående opgave** tæller det første bogstav i typen: F betyder slutdatoen for den eksterne opgave, S startdatoen. Med FS og FF indtaster du derfor slutdatoen, med SS og SF startdatoen.
- Med en ekstern **efterfølgende opgave** tæller det andet bogstav: S er startdatoen for den eksterne opgave, F slutdatoen. Med FS og SS indtaster du derfor startdatoen, med FF og SF slutdatoen.

Hvis du planlægger i timer (timeplanlægning er slået til) og opgaven ligger på en kalender med arbejdstid, spørger feltet *Ankerdato* også om et klokkeslæt.

Eksempel: projektet for byggepladsen slutter fredag den 18. juni 2027. Du sammenkæder *Groundwork* med en ekstern foregående opgave af typen FS, ankerdato 18. juni 2027. Efter **Beregn** starter *Groundwork* mandag den 21. juni, den første arbejdsdag efter ankeret. En ekstern efterfølgende opgave virker omvendt: den begrænser, hvor sent din opgave må slutte.

## Hvad du ser, og hvordan du håndterer det

- Eksterne afhængigheder vises som tekst i kolonnerne *Foregående opgaver* og *Efterfølgende opgaver* i opgavetabellen (tilføj dem med **+** i tabelhovedet, under *Afhængigheder*), med navnet på projektet og opgaven og typen. En lille trekant med *Kilde mangler* viser, at kilden ikke er læst. Hold musen over afhængigheden for at se projektet (linjen *Projekt-id* viser projektnavnet, når det er kendt), opgave-id, ankerdatoen og kildestatus.
- I Gantt-diagrammet ligger en grå spøgelsesbjælke ved opgaven. Med en foregående opgave slutter den på ankerdatoen, med en efterfølgende opgave starter den på ankerdatoen. En stiplet kant med den røde etiket *forældet* betyder, at kilden ikke er læst. Ved en manuel afhængighed er det altid tilfældet.
- Højreklik på en afhængighed i kolonnen for at vælge *Rediger ekstern afhængighed*… eller *Slet afhængighed*. Hvis afhængigheden har en kildefil, står *Opdater kilde* der også.
- Vælg *Sammenkæd ▾ › Opdater alle eksterne afhængigheder* for at læse kildefilerne igen og opdatere ankerdatoerne. Det virker kun i desktopappen. Har du kun manuelle afhængigheder, siger appen *Ingen eksterne kilder kan opdateres (filsti mangler)*. Tryk på **Beregn** efter en opdatering.
- Ændrer du typen eller retningen, zodat ankeret skal bruge en anden side af den eksterne opgave (start i stedet for slutdato, eller omvendt), spørger appen om et nyt anker ved en manuel afhængighed: *Vælg et nyt anker: afhængighedstypen bruger nu den anden side af kildeopgaven*. Har afhængigheden en kildefil, læser appen ankeret igen selv.

## Faldgruber, og hvad appen gør

**Det andet projekt flytter ikke med.** Ændrer den eksterne opgave dato, bliver din tidsplan ved med at beregne med det gamle anker, indtil du opdaterer det eller ændrer ankerdatoen. Med den manuelle vej ændrer du selv ankerdatoen ved at højreklikke på afhængigheden og vælge *Rediger ekstern afhængighed*….

**En ekstern foregående opgave er en nedre grænse.** Starter din opgave senere end ankeret kræver, fordi den har sine egne foregående opgaver, så vinder den afhængighed. Ankeret skubber kun opgaven senere.

**En ekstern efterfølgende opgave er en øvre grænse.** Er ankeret for stramt, ser du det som negativ slæk på din opgave og på opgaverne før den. Der vises ingen særskilt advarsel, så hold øje med kolonnen *Samlet slæk*.

**Kun en fast forsinkelse.** For en ekstern afhængighed kan du ikke angive en forsinkelse i kalenderdage eller procenter. Appen siger: *Eksterne afhængigheder understøtter kun en fast forsinkelse i arbejdsdage eller arbejdstid*. Arbejdsdagene tæller i kalenderen for din egen opgave. En forsinkelse i timer tæller kun for en opgave, der er planlagt i timer. For en opgave i dage ignorerer beregningen den. Brug så arbejdsdage.

**Projekt-id for en anden fil.** Projekt-id'et står ikke i et felt eller en kolonne, men er gemt som `InternalProjectId` i IFC-filen for det projekt: åbn projektet, gå til fanen *IFC* og vælg *Generér IFC*. Beregningen bruger kun ankerdatoen. Id'et er ikke blot en etiket. Når appen opdaterer, genkender den først en kildefil på dens Projekt-id, og derefter på filstien. Indtaster du med en manuel afhængighed det samme id som en kildefils, bliver afhængigheden opdateret samtidig, når den fil opdateres. Du finder *Opgave-id* for en opgave i det andet projekt i det projekts opgavetabel, i kolonnen *Opgave-id* under *Teknisk*.

## Se også

- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvordan appen beregner en afhængighed og en forsinkelse.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): afhængigheder mellem opgaver i samme projekt.
- [Begrænsninger og deadlines](docs://uitleg-constraints): datogrænser for en opgave, uden et andet projekt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): bevat en ekstern afhængighed på *Car park paving* (en ekstern foregående opgave).
