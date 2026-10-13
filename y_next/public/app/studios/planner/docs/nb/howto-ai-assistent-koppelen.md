# Koble til en KI-assistent (MCP)

Mål: la en KI-assistent følge med og jobbe i tidsplanen din, med innsyn i hva den gjør og med grenser som du setter selv.

## Når du trenger dette

Du vil at en KI-assistent skal lese, analysere eller endre tidsplanen din. For eksempel for å lage et første WBS, rette aktiviteter eller forklare den kritiske linjen. Det går via **Model Context Protocol** (MCP): en standard som lar en KI-assistent bruke verktøy i et program. Open Planner Studio kjører derfor en liten server på din egen datamaskin, **broen**. Den tilbyr et sett med verktøy. Alle har et navn som begynner med `planner_`: lesing og endring av aktiviteter, avhengigheter, ressurser, kalendere, grunnlinjer, dokumenter og filer. Hvilke verktøy det finnes, og hva de nekter, står i [KI-verktøy](docs://ref-ai-tools). Hvorfor koblingen virker slik, står i [Slik fungerer KI-koblingen](docs://uitleg-ai-koppeling).

Broen fungerer bare i skrivebordsappen. Hvis du slår på KI-modus i nettleseren, ser du fanen *AI*. Men knappen *Start bro* er grå, med teksten *Broen fungerer bare i skrivebordsappen.* Resten av denne artikkelen handler om skrivebordsappen. I nettleseren er *Ta backup nå* og *Åpne backup-mappen* også grå.

## Trinn

### 1. Slå på KI-modus

1. Velg *Innstillinger › Prosjekt › Innstillinger*. Du kan også velge *Fil › Innstillinger*, eller tannhjulet øverst.
2. Velg fanen *Avansert* og sett bryteren *Slå på KI-modus* på. Fanen *AI* vises i båndet.
3. Vil du at broen skal være aktiv så snart appen starter, sett også *Start broen automatisk* på. Det skjer bare når KI-modus er på, og det fungerer bare i skrivebordsappen. Den er av som standard, fordi det å åpne en port er et bevisst valg.

Slår du KI-modus av, stopper broen, og fanen *AI* forsvinner.

### 2. Start broen

1. Gå til fanen *AI* og klikk *Start bro* under *Server*.
2. Se på statusen ved siden av knappen. Den viser *Av*, *Aktiv på port 3877*, *Port 3877 i bruk* eller *Feil*. Lykkes starten, står det *Aktiv på port 3877*, og knappen heter *Stopp bro*. Ved *Port 3877 i bruk* eller *Feil* forblir knappen *Start bro*. Se fallgruvene.

Broen lytter bare på din egen datamaskin, på én port. Som standard er det 3877. I gruppen *Tilkobling* kan du velge en annen port under *Port*, men bare når broen er stoppet.

### 3. Koble til assistenten

1. Klikk *Koble til* under *Tilkobling*. Vinduet *Tilkoblingsdetaljer* åpnes.
2. Velg det klienten din trenger. Se under.
3. Tokenet er skjult. Med øyeikonet viser du det. Kopieringsknappene kopierer alltid den reelle verdien, også når skjermen skjuler tokenet.
4. Be assistenten hente listen med verktøy. Den kontrollen står også i koblingsprompten. Assistenten skal se verktøyene med prefikset `planner_`. Det forventede antallet står i koblingsprompten.

Vinduet tilbyr tre måter å koble til på:

- *Konfigurasjonsutdrag*: et stykke konfigurasjon som du limer inn i MCP-innstillingene til klienten din.
- *Koblingsprompt*: en tekst som du limer inn i KI-assistenten din. Deretter kobler assistenten seg til av seg selv.
- *Endepunkt* og *Autentisering*: de separate detaljene. Endepunktet er `http://localhost:3877/mcp` med transport *streamable HTTP*. Hver forespørsel trenger en header `Authorization: Bearer`, etterfulgt av tokenet ditt.

I gruppen *Tilkobling* finnes også feltet *Token*. Det er en lang, tilfeldig kode som appen lager for deg og lagrer på denne datamaskinen. I vinduet står det *Dette tokenet gir tilgang til den åpne tidsplanen. Ikke del det med andre.* Med ikonet *Opprett nytt token* lager du et nytt token. Appen spør først *Et nytt token avbryter alle eksisterende koblinger. Vil du fortsette?* Kjører broen, starter den på nytt med det nye tokenet, og det gamle tokenet virker ikke lenger.

### 4. Se hva KI-assistenten gjør

1. Klikk *Aktivitetspanel* under *Aktivitet*. I sidekolonnen åpnes panelet *KI-aktivitet*.
2. Hvert kall til broen står på én linje. Det nyeste står øverst: tidspunkt, hva som skjedde, hvor lang tid det tok, og om det lyktes eller ikke. Klikk på en linje for å utvide *Argumenter* og *Svar*.
3. Med *Tøm* tømmer du listen. Panelet beholder de siste 500 kallene. Så lenge ingenting har skjedd, står det *Ingen KI-aktivitet ennå. Kall til broen vises her.*

Når KI-modus er på, er det en prikk med *AI* nederst til høyre i statuslinjen. Fargen viser statusen til broen. Klikker du på prikken, går du til fanen *AI*.

### 5. Sett grenser

Under *Sikkerhet* finner du knappene som du begrenser KI-assistenten med:

- *Avbrudd*: KI-assistenten får midlertidig ikke endre noe. Lesing er fortsatt tillatt. Broen forblir aktiv. Knappen blir *Fortsett*.
- *Skrivebeskyttet*: alle verktøy som endrer noe, avvises mens dette er på.
- *Auto-backup: på*: før den første endringen som KI-assistenten gjør i et dokument, skriver appen en IFC-backup. Den er på som standard. Med knappen slår du den av, og da står det *Auto-backup: av*. Dette skjer én gang per dokument, hver gang du starter broen.
- *Ta backup nå*: lager en backup av det aktive dokumentet med en gang. Etterpå står det *Backup opprettet:* med filnavnet.
- *Åpne backup-mappen*: åpner mappen med backupene.

Backupene ligger i mappen `ai-backups` i datamappen til appen. Appen beholder de nyeste backupene og rydder i de eldre. Nøyaktig hvordan, står i [KI-verktøy](docs://ref-ai-tools).

### 6. La assistenten planlegge godt

En KI-assistent som kjenner verktøyene, kan likevel lage en tidsplan som ingen planlegger har nytte av: aktiviteter uten avhengigheter, en fast dato på hver aktivitet, eller en nedbrytning som er altfor detaljert. Derfor får KI-assistenten planleggingsreglene på tre måter. For de to første behøver du ikke gjøre noe.

1. **Kjernereglene følger med av seg selv.** Når du kobler til, sender broen en kort tekst med kjernereglene. Mange klienter legger den teksten i systemprompten. Om klienten din gjør det, avhenger av klienten. Der står blant annet: start ved milepælene, bygg aktiviteter på omtrent én dag til to uker, styr tidsplanen med avhengigheter i stedet for faste datoer, og si til slutt hva du har antatt.
2. **Koblingsprompten viser til hele veiledningen.** Koblingsprompten fra vinduet *Tilkoblingsdetaljer* ber KI-assistenten lese planleggingsveiledningen først, med verktøyet `planner_get_planning_guide`. Det gir en engelsk veiledning for KI-assistenter, med de samme prinsippene som [Planlegg godt](docs://gids-goed-plannen). For hvert prinsipp står verktøyene som KI-assistenten bruker. Du kan lese den selv på `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Bruker du ikke koblingsprompten, spør du assistenten selv: *Les planleggingsveiledningen med planner_get_planning_guide først, før du endrer noe.*
3. **Valgfritt: skills.** En skill er en liten fil med instruksjoner som en assistent leser med i hver sesjon, slik at den også vet hvordan arbeidet skal gjøres i en senere samtale. Det er to, begge på engelsk: *goed-plannen* for å sette opp eller omstrukturere en tidsplan, og *progress-update* for den ukentlige fremdriftsoppdateringen. Dette fungerer bare med en KI-assistent som støtter skills. Selve skillene nevner Claude Code og lignende assistenter. Hver skill er en fil `SKILL.md` i en egen mappe med navnet til skillen: `.claude/skills/goed-plannen/SKILL.md` og `.claude/skills/progress-update/SKILL.md` i prosjektmappen som assistenten jobber i. Eller de samme mappene under `~/.claude/skills/`, om du vil ha dem i alle prosjekter.

Du kan få filene på to måter. Be KI-assistenten kalle verktøyet `planner_get_planning_guide` med `part` satt til `skill`. Svaret inneholder da begge tekstene, og for hver skill stedene der den hører hjemme. Eller last dem ned fra `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` og `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Er *goed-plannen* fortsatt der fra en eldre versjon av appen, erstatt den. Den gamle teksten er på nederlandsk og viser til hjelpeartikkelen i stedet for veiledningen for KI-assistenter.

Om KI-assistenten virkelig har lest veiledningen, ser du i *Aktivitetspanel*. Da står det et kall til `planner_get_planning_guide`. Det endelige svaret skal inneholde en liste med antagelser: estimerte varigheter, den valgte nedbrytningen, avhengigheter som assistenten selv har laget, og hver begrensning den har satt. Mangler listen, be om den. Etter en fremdriftsoppdatering med *progress-update* skal svaret nevne statusdatoen, den nye sluttdatoen og avviket fra grunnlinjen.

## Fallgruver og hva appen gjør da

**KI-assistenten endrer noe du vil angre.** Hver endring fra KI-assistenten er ett steg som du angrer med *Angre* (Ctrl+Z). En serie endringer som KI-assistenten sender som én helhet, er ett steg. Etterpå viser appen prosjektet som ulagret. Etter en endring omberegnes tidsplanen, så du trenger ikke å trykke F5 selv.

**Appen avviser et kall fra KI-assistenten.** Med *Avbrudd* og *Skrivebeskyttet* avviser appen alle endringer. Lesing er fortsatt mulig, også omberegningen av en utdatert tidsplan. Er du midt i en redigering selv, for eksempel når du drar i en stolpe eller skriver i et felt, får KI-assistenten datoene fra før redigeringen din. Den får da en melding om at datoene er utdaterte. Har du en dialog åpen, for eksempel innstillingene, en aktivitetsdialog eller velkomstvinduet, eller er presentasjonsmodus på, avviser appen alle kall, også lesing, til du lukker dialogen. KI-assistenten får da en feilmelding med det interne navnet på det som er åpent, for eksempel `showTaskDialog`. Bare `planner_get_planning_guide` fungerer fortsatt, fordi den ikke leser tidsplanen din.

**Du bytter fane mens KI-assistenten jobber.** KI-assistenten jobber i dokumentet der den første endringen havnet. Bytter du fane mens den jobber, avviser appen neste endring til KI-assistenten bekrefter at den vil jobbe i den andre fanen. Slik havner ingenting i feil prosjekt.

**KI-assistenten skriver eller åpner en fil.** KI-assistenten kan skrive en tidsplan som IFC-fil og åpne en tidsplanfil som en ny fane. Det kan den bare gjøre i brukermappen din. Den overskriver bare en eksisterende fil hvis den uttrykkelig ber om det.

**Statusen er *Port 3877 i bruk*.** Et annet program bruker porten. Appens melding vises under statusen. Portfeltet er da låst (*Kan bare endres når serveren er stoppet.*), selv om broen ikke kjører, og det finnes ingen stoppknapp. Det er en kjent mangel. Til det er fikset: sett bryteren *Slå på KI-modus* av og på igjen. Statusen er da tilbake på *Av*, og du kan velge en annen port. Kopier deretter tilkoblingsdetaljene på nytt, fordi endepunktet inneholder porten.

**Klienten kan ikke koble til etter et nytt token.** Et nytt token avbryter alle eksisterende koblinger. Gi klienten det nye tokenet, eller lim inn konfigurasjonsutdraget på nytt.

**Du stoppet broen selv, og den starter ikke av seg selv.** *Start broen automatisk* virker én gang hver gang appen starter. Stopper du broen selv, slår appen den ikke stille på igjen.

**Fanen *AI* er borte.** KI-modus er av. Slå den på i trinn 1.

**En nettside i nettleseren din kan ikke snakke med broen.** Broen avviser alle forespørsler fra en nettleser, og alle forespørsler uten riktig token.

## Se også

- [Gi tilbakemelding](docs://howto-feedback-geven): hvis koblingen virker annerledes enn det som står her, meld det.
- [Slik fungerer KI-koblingen](docs://uitleg-ai-koppeling): hva koblingen er, hvorfor assistenten jobber i det åpne prosjektet ditt, og hva den ikke får gjøre.
- [KI-verktøy](docs://ref-ai-tools): alle `planner_*`-verktøy per gruppe, feilkodene og hvor lenge backuper beholdes.
- [Planlegg godt](docs://gids-goed-plannen): planleggingsprinsippene. KI-assistenten får dem i en engelsk versjon, med verktøyene lagt til.
- [Innstillinger](docs://ref-instellingen): innstillingene for KI.
