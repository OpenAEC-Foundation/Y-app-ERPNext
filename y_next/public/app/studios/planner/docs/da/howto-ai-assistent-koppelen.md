# Forbind en AI-assistent (MCP)

Mål: lad en AI-assistent læse med og arbejde i din tidsplan, med indsigt i hvad den gør, og med grænser som du selv sætter.

## Hvornår du har brug for dette

Du vil have en AI-assistent til at læse, analysere eller ændre din tidsplan. For eksempel for at lade den lave et første udkast til en WBS, rette opgaver eller forklare den kritiske vej. Det virker via **Model Context Protocol** (MCP): en standard, der lader en AI-assistent bruge værktøjer i et program. Til det formål kører Open Planner Studio en lille server på din egen computer, **broen**. Broen tilbyder en række værktøjer, alle med et navn, der begynder med `planner_`: læse og ændre opgaver, afhængigheder, ressourcer, kalendere, oprindelige planer, dokumenter og filer. Hvilke værktøjer der findes, og hvad de afviser, står i [AI-værktøjer](docs://ref-ai-tools). Hvorfor forbindelsen virker på denne måde, står i [Sådan virker AI-forbindelsen](docs://uitleg-ai-koppeling).

Broen virker kun i desktopappen. Hvis du slår AI-tilstand til i browseren, ser du fanen *AI*, men knappen *Start bro* er grå, med teksten *Broen virker kun i desktopappen.* Resten af denne artikel handler om desktopappen. I browseren er *Lav backup nu* og *Åbn backupmappe* også grå.

## Trin

### 1. Slå AI-tilstand til

1. Vælg *Indstillinger › Projekt › Indstillinger*. Du kan også vælge *Fil › Indstillinger*, eller tandhjulet øverst.
2. Vælg fanen *Avanceret* og slå *Aktiver AI-tilstand* til. Fanen *AI* vises i båndet.
3. Vil du have broen aktiv, så snart appen starter, så slå også *Start bro automatisk* til. Det virker kun, når AI-tilstand er til, og kun i desktopappen. Den er fra som standard, fordi det er et bevidst valg at åbne en port.

Slår du AI-tilstand fra, stopper broen, og fanen *AI* forsvinder.

### 2. Start broen

1. Gå til fanen *AI* og klik på *Start bro* under *Server*.
2. Kig på status ved siden af knappen. Der står *Fra*, *Aktiv på port 3877*, *Port 3877 er optaget* eller *Fejl*. Lykkes starten, står der *Aktiv på port 3877*, og knappen hedder *Stop bro*. Ved *Port 3877 er optaget* eller *Fejl* bliver knappen *Start bro*; se faldgruberne.

Broen lytter kun på din egen computer, på én port. Som standard er det port 3877. I gruppen *Forbindelse* kan du vælge en anden under *Port*, men kun når broen er stoppet.

### 3. Forbind assistenten

1. Klik på *Forbind* under *Forbindelse*. Vinduet *Forbindelsesoplysninger* åbnes.
2. Vælg det, din klient har brug for. Se nedenfor.
3. Tokenet er skjult. Med øjeikonet viser du det. Kopiknapperne kopierer altid den rigtige værdi, også selvom skærmen skjuler tokenet.
4. Lad assistenten hente listen med værktøjer. Den kontrol står også i forbindelsespromptet: assistenten skal se værktøjerne med præfikset `planner_`. Det forventede antal står også i forbindelsespromptet.

Vinduet tilbyder tre måder at forbinde på:

- *Konfigurationsuddrag*: et stykke konfiguration, som du indsætter i MCP-indstillingerne i din klient.
- *Forbindelsesprompt*: en tekst, som du indsætter i din AI-assistent. Derefter forbinder den sig selv.
- *Endpoint* og *Godkendelse*: de enkelte oplysninger. Endpointet er `http://localhost:3877/mcp` med transport *streamable HTTP*. Hver forespørgsel kræver en header `Authorization: Bearer`, efterfulgt af dit token.

I gruppen *Forbindelse* er der også feltet *Token*. Det er en lang, tilfældig kode, som appen laver for dig og gemmer på denne computer. I vinduet står der: *Dette token giver adgang til den åbne tidsplan. Del det ikke med andre.* Med ikonet *Opret nyt token* laver du et nyt token. Appen spørger først: *Oprettelse af et nyt token gør alle eksisterende forbindelser ugyldige. Fortsæt?* Hvis broen kører, starter den om med det nye token, og det gamle token virker ikke længere.

### 4. Se hvad AI-assistenten gør

1. Klik på *Handlingspanel* under *Opgave*. I sidekolonnen åbnes panelet *AI-handlinger*.
2. Hvert kald til broen står på én linje, med det nyeste øverst: tidspunkt, hvad der skete, hvor lang tid det tog, og om det lykkedes. Klik på en linje for at vise *Argumenter* og *Svar*.
3. Med *Ryd* tømmer du listen. Panelet gemmer de sidste 500 kald. Så længe der ikke er sket noget, står der *Ingen AI-handlinger endnu. Kald til broen vises her.*

Når AI-tilstand er til, står der en prik med *AI* nederst til højre i statuslinjen. Farven viser status for broen. Et klik på prikken bringer dig til fanen *AI*.

### 5. Sæt grænser

Under *Sikkerhed* finder du knapperne, som du bruger til at begrænse AI-assistenten:

- *Pausér*: AI-assistenten må midlertidigt ikke ændre noget. Læsning er stadig tilladt. Broen forbliver aktiv. Knappen skifter til *Genoptag*.
- *Skrivebeskyttet*: alle værktøjer, der ændrer noget, afvises, så længe denne er til.
- *Automatisk backup: til*: før den første ændring fra AI-assistenten i et dokument skriver appen en IFC-backup. Det er som standard til. Med knappen slår du den fra, og så står der *Automatisk backup: fra*. Dette sker én gang pr. dokument, hver gang du starter broen.
- *Lav backup nu*: laver straks en backup af det aktive dokument. Bagefter står der *Backup oprettet:* med filnavnet.
- *Åbn backupmappe*: åbner mappen med backups.

Backups ligger i mappen `ai-backups` i appens datamappe. Appen beholder de nyeste backups og rydder de ældre delvist op. Præcis hvordan, står i [AI-værktøjer](docs://ref-ai-tools).

### 6. Sørg for, at assistenten laver en god tidsplan

En assistent, der kender værktøjerne, kan stadig lave en tidsplan, som ingen planlægger har brug for: opgaver uden afhængigheder, en fast dato på hver opgave, eller en opdeling, der er alt for fin. Derfor får assistenten reglerne for god planlægning på tre måder. For de to første skal du ikke gøre noget.

1. **Kernereglerne følger automatisk med.** Når du forbinder, sender broen en kort tekst med kernereglerne. Mange klienter sætter den tekst ind i deres systemprompt. Om din gør det, afhænger af klienten. Der står blandt andet: start ved milepæle, lav opgaver på cirka en dag til to uger, styr tidsplanen med afhængigheder i stedet for faste datoer, og skriv til sidst, hvilke antagelser du har gjort.
2. **Forbindelsespromptet henviser til den fulde guide.** Forbindelsespromptet fra vinduet *Forbindelsesoplysninger* beder assistenten om først at læse planlægningsguiden, med værktøjet `planner_get_planning_guide`. Det giver en engelsk guide til assistenter: de samme principper som [God planlægning](docs://gids-goed-plannen), med for hvert princip de værktøjer, assistenten bruger til det. Du kan den selv læse på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Bruger du ikke prompten, så spørg assistenten selv: *Læs planlægningsguiden med planner_get_planning_guide først, før du ændrer noget.*
3. **Valgfrit: de skills.** En skill er en lille fil med instruktioner, som en assistent læser med i hver session. Så kender den også den rigtige måde at arbejde på i en senere samtale. Der er to, begge på engelsk: *goed-plannen* til at opsætte eller omstrukturere en tidsplan, og *progress-update* til den ugentlige fremdriftsopdatering. Det virker kun med en assistent, der understøtter skills. Selve skills nævner Claude Code og lignende assistenter. Hver skill er en fil `SKILL.md` i sin egen mappe med skillens navn: `.claude/skills/goed-plannen/SKILL.md` og `.claude/skills/progress-update/SKILL.md` i projektmappen, som assistenten arbejder i, eller de samme mapper under `~/.claude/skills/`, hvis de skal gælde i alle projekter.

Du kan hente filerne på to måder. Bed assistenten om at kalde værktøjet `planner_get_planning_guide` med `part` sat til `skill`. Svaret indeholder begge tekster og, for hver skill, de steder, hvor den hører hjemme. Eller download dem fra `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` og `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Er *goed-plannen* stadig der fra en ældre version af appen, så erstat den: den gamle tekst er på nederlandsk og henviser til hjælpeartiklen i stedet for guiden til assistenter.

Om assistenten virkelig har læst guiden, kan du se i *Handlingspanel*: der står så et kald til `planner_get_planning_guide`. Assistentens slutsvar skal indeholde en liste med antagelser: estimerede varigheder, den valgte opdeling, afhængigheder, den selv har oprettet, og alle begrænsninger, den har sat. Mangler listen, så bed om den. Efter en fremdriftsopdatering med *progress-update* skal svaret nævne statusdatoen, den nye slutdato og afvigelsen i forhold til den oprindelige plan.

## Faldgruber og hvad appen gør da

**AI-assistenten ændrer noget, som du vil fortryde.** Hver ændring fra AI-assistenten er ét trin, som du fortryder med *Fortryd* (Ctrl+Z). En serie ændringer, som AI-assistenten sender som én helhed, er ét trin. Bagefter vises projektet som ikke gemt. Efter en ændring genberegnes tidsplanen, så du behøver ikke selv at trykke på F5.

**Appen afviser et kald fra AI-assistenten.** Med *Pausér* og *Skrivebeskyttet* afviser appen alle ændringer, mens læsning stadig er mulig, og en forældet tidsplan kan stadig genberegnes. Er du selv midt i en redigering, for eksempel når du trækker i en bjælke eller skriver i et felt, får AI-assistenten datoerne fra før din redigering, med en besked om at de er forældede. Har du en dialog åben, for eksempel indstillingerne, en opgavedialog eller velkomstvinduet, eller er præsentationstilstand til, afviser appen alle kald, også læsning, til du lukker dialogen. AI-assistenten får så en fejlbesked med det interne navn på det, der er åbent, for eksempel `showTaskDialog`. Kun `planner_get_planning_guide` virker stadig, fordi det ikke læser din tidsplan.

**Du skifter fane, mens AI-assistenten arbejder.** AI-assistenten arbejder i det dokument, hvor dens første ændring blev skrevet. Skifter du fane i mellemtiden, afviser appen dens næste ændring, til den bekræfter, at den vil arbejde i den anden fane. Så kommer intet i det forkerte projekt.

**AI-assistenten skriver eller åbner en fil.** AI-assistenten kan skrive en tidsplan som IFC-fil og åbne en tidsplanfil i en ny fane. Det kan den kun i din brugermappe. Den overskriver kun en eksisterende fil, hvis den udtrykkeligt beder om det.

**Status er *Port 3877 er optaget*.** Et andet program bruger porten. Appens besked vises under den. Portfeltet forbliver så låst (*Kan kun redigeres, mens serveren er stoppet.*), også når broen ikke kører, og der er ingen stopknap. Det er en kendt mangel. Indtil den er rettet: slå *Aktiver AI-tilstand* fra og til igen. Status er så tilbage på *Fra*, og du kan vælge en anden port. Kopiér derefter forbindelsesoplysningerne igen, for endpointet indeholder porten.

**Klienten kan ikke forbinde efter et nyt token.** Et nyt token gør alle eksisterende forbindelser ugyldige. Giv klienten det nye token, eller indsæt konfigurationsuddraget igen.

**Du stoppede broen selv, og den starter ikke af sig selv.** *Start bro automatisk* virker én gang, hver gang appen starter. Stopper du broen selv, tænder appen den ikke igen i det stille.

**Fanen *AI* er væk.** AI-tilstand er fra. Slå den til i trin 1.

**En webside i din browser kan ikke tale med broen.** Broen afviser alle forespørgsler, der kommer fra en browser, og alle forespørgsler uden det rigtige token.

## Se også

- [Giv feedback](docs://howto-feedback-geven): hvis forbindelsen virker anderledes end beskrevet her, så giv besked om det.
- [Sådan virker AI-forbindelsen](docs://uitleg-ai-koppeling): hvad forbindelsen er, hvorfor assistenten arbejder i dit åbne projekt, og hvad den ikke må.
- [AI-værktøjer](docs://ref-ai-tools): alle `planner_*`-værktøjer, grupperet, fejlkoderne og hvor længe backups gemmes.
- [God planlægning](docs://gids-goed-plannen): planlægningsprincipperne; assistenten får dem i en engelsk version med værktøjerne tilføjet.
- [Indstillinger](docs://ref-instellingen): AI-indstillingerne.
