# Opprett nytt prosjekt og prosjektinfo

Feltene i vinduet *Opprett nytt prosjekt* og i *Prosjektinfo*: hva hvert felt gjør, hva standardverdien er og hvor det virker. De er to sider av samme skjema. *Opprett nytt prosjekt* lager et nytt prosjekt og har noen ekstra felt. *Prosjektinfo* endrer prosjektet du har åpent.

## Åpne

**Opprett nytt prosjekt** — *Fil › Ny*, Ctrl+N, eller plusstegnet til høyre for dokumentfanene (*Start et prosjekt*, deretter *Opprett nytt prosjekt*). Vinduet åpnes med markøren i *Prosjektnavn*.

**Prosjektinfo** — *Innstillinger › Prosjekt › Prosjektinfo* åpner skjemaet som et vindu med tittelen *Prosjektinformasjon*. *Fil › Prosjektinfo* viser det samme skjemaet i filskjermen. Blokken *Beregningsprofil og beregningsalternativer* står nederst på begge steder. Hva den inneholder, står i [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies).

## Opprett, Bruk og avbryt

**Opprett** (i *Opprett nytt prosjekt*) lager prosjektet og åpner det i en egen fane. **Bruk** (i *Prosjektinfo*) skriver endringene dine til prosjektet.

- **Bare ved Bruk.** Du skriver i et utkast. Prosjektet endres bare når du klikker på *Bruk*. *Bruk* skriver bare det du faktisk har endret, i ett steg i *Angre*. Klikker du på *Bruk* uten å endre noe, skjer ingenting, og det legges ikke til noe steg.
- **Avbryt, krysset og Esc** lukker vinduet uten å lagre noe. Et klikk ved siden av vinduet lukker det ikke: det du hadde skrevet, forblir der.
- **Enter** gjør det samme som *Opprett* eller *Bruk*, unntatt i feltet *Beskrivelse* og i en åpen nedtrekksliste.
- **I filskjermen** viser *Prosjektinfo* *Endringer er ikke tatt i bruk — klikk på Bruk for å beholde dem.* nederst så lenge utkastet ditt avviker. Forlater du skjermen, spør appen om du vil bruke endringene, forkaste dem eller avbryte. Se [Båndet, fane for fane](docs://ref-lint).
- **En egendefinert beregningsprofil uten navn** hindrer *Bruk* og *Opprett*. Gi den et navn, eller forkast endringen.

## Felt i begge vinduene

**Prosjektnavn** — navnet på prosjektet i titellinjen, på fanen og i filnavnet når du lagrer. Standard: tom. Et tomt felt er tillatt: prosjektet heter da *Ny tidsplan*, vist med grå tekst i feltet. Hvor: hele skjermen.

**Beskrivelse** — fri tekst. Standard: tom. Virkning: lagres med prosjektet, i IFC-filen og i eksporten til Primavera P6 XML, og har ingen innvirkning på tidsplanen.

**Forfatter** — fri tekst. Standard: tom. Virkning: havner i IFC-filen og vises som *Forfatter:* i toppteksten på en rapport, der du ikke kan endre den.

**Ressursbibliotek** — hvilket bibliotek prosjektet er koblet til. Velg blant *ingen bibliotek (frittstående prosjekt)*, dine eksisterende bibliotek og *+ Legg til nytt ressursbibliotek…*. Standard: i *Opprett nytt prosjekt* biblioteket som er satt som standard, i *Prosjektinfo* den koblingen som nå gjelder. Virkning: se [Bruke ressursbiblioteket](docs://howto-resourcebibliotheek-gebruiken). Med *+ Legg til nytt ressursbibliotek…* skriver du et navn i feltet under. Biblioteket lages først ved *Opprett* eller *Bruk*. Avbryter du, blir ingenting igjen. En kobling i *Prosjektinfo* endres bare hvis du selv endrer dette feltet.

**Klient/organisasjon** — fri tekst. Standard: tom. Virkning: havner i IFC-filen og vises som *Selskap:* i toppteksten på en rapport.

**Startdato** — prosjektets start. Standard: i dag, i *Opprett nytt prosjekt*. Hva feltet gjør, står under *Hva startdatoen gjør*.

**Sluttdato** — den planlagte slutten på prosjektet. Standard: tom. Virkning: det er en opplysning, ikke et krav: appen planlegger ikke mot denne datoen. Den vises i toppteksten på en rapport og i eksporter, og bestemmer til hvilket år helligdagene genereres. Bare for en Primavera-fil med innstillingen *Beregne slakk til prosjektslutt* (se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies)) kjører slakkberegningen til denne datoen.

**Standardenhet for nye aktiviteter** — vises bare når *Slå på timeplanlegging* er på. Velg blant *Dager* og *Timer*. Standard: *Dager*. Virkning og vilkår: se [Slå på timeplanlegging](docs://howto-urenplanning-aanzetten).

**Beregningsprofil og beregningsalternativer** — i *Prosjektinfo* hele blokken, i *Opprett nytt prosjekt* bare nedtrekkslisten *Beregningsprofil* med *Primavera P6*, *Microsoft Project* og *Open Planner Studio*. Standard: *Open Planner Studio*. Når du velger en profil, stiller appen også standardalternativene for den profilen inn. Se [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies).

## Bare i vinduet Opprett nytt prosjekt

**Faseringsmal** — hvilke faser prosjektet starter med. Velg blant *Tom*, *Boligbygging* og *Yrkesbygg / rehabilitering*. Standard: *Tom*. Virkning: *Tom* gir et prosjekt uten aktiviteter. De to andre legger åtte faseaktiviteter klare, hver med en varighet på 5 i prosjektets standardenhet (5 arbeidsdager, eller 5 timer hvis du velger *Timer* under *Standardenhet for nye aktiviteter*), og uten avhengigheter. Du gir dem nytt navn, flytter og utvider dem selv. For *Boligbygging* er dette: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking og Oplevering. For *Yrkesbygg / rehabilitering*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen og Oplevering. Navnene er prosjektdata og forblir nederlandske, også i et annet grensesnittspråk. Hvis *Slå på byggmodus* er av, finnes bare *Tom*. Se [Innstillinger](docs://ref-instellingen).

**Skift** — vises bare når *Slå på timeplanlegging* er på. Velg blant *Dagskift*, *2 skift*, *3 skift* og *24/7*. Standard: *Dagskift*. Virkning: *Dagskift* lar standardkalenderen stå som den er, en vanlig dagkalender fra mandag til fredag. De andre tre legger tidsbånd inn i kalenderen for prosjektet, som knappene med samme navn i vinduet *Kalendere*. Hvilke klokkeslett det er, står i [Angi arbeidstider](docs://howto-werktijden-instellen). Med *Dagskift* kan du ikke velge *Timer* under *Standardenhet for nye aktiviteter*, fordi en dagkalender ikke har tidsbånd.

**Helligdagssett** — hvilke helligdager kalenderen for prosjektet får. Ved *Land* velger du *Nederland* (standard), *Tyskland*, *Belgia*, *Frankrike*, *Storbritannia*, *Østerrike*, *Sveits*, *Ingen helligdager* eller *Egendefinert…*. Har landet regioner, legges en nedtrekksliste *Region* til. For Nederland velger du også, når *Slå på byggmodus* er på, *Byggferie*: *Ingen* (standard), *Nord*, *Midt* eller *Sør*. Under dette står en linje som *36 helligdager, 2025–2029*. Klikk på den for å vise listen. Årene går fra året før startdatoen til året etter sluttdatoen, eller til tre år etter startåret hvis det ikke finnes noen sluttdato. *Egendefinert…* gir en kalender uten helligdager og åpner vinduet *Kalendere* rett etter at du har opprettet prosjektet, så du kan fylle dem inn selv. Kalenderen for prosjektet heter *Bouwkalender NL*, eller *Standaardkalender* hvis *Slå på byggmodus* er av. Valget er da også *Ingen helligdager*. Hvordan generatoren virker, står i [Generere helligdager og byggferie](docs://howto-feestdagen-genereren).

## Hva startdatoen gjør

Startdatoen er ankerpunktet for prosjektet. Tre regler:

- **Nye aktiviteter starter på startdatoen.** En aktivitet du legger til, får prosjektstart som planlagt start.
- **En aktivitet med forgjenger starter aldri før startdatoen.** Er slutten på forgjengeren tidligere, venter aktiviteten til startdatoen. En aktivitet *uten* forgjenger beholder sin egen dato, også hvis den ligger før startdatoen. Det trengs for å vise en tidsplan fra MS Project eller Primavera slik kildeprogrammet viser den. En begrensning *Må starte på (MSO)* eller *Må slutte på (MFO)* bryter begge reglene: en slik aktivitet står på sin dato, også hvis den faller før startdatoen.
- **En senere startdato flytter løse aktiviteter med seg.** Setter du startdatoen senere i *Prosjektinfo* og klikker på *Bruk*, flyttes aktiviteter uten forgjenger, og uten en begrensning som setter en nedre grense (*start ikke tidligere enn*, *Må starte på*, *slutt ikke tidligere enn* eller *Må slutte på*), til den nye datoen hvis de ligger før den. Det skjer i samme steg i *Angre*. Appen melder hvor mange aktiviteter som er flyttet. Det skjer bare når du selv endrer startdatoen, aldri når du åpner en fil. En senere startdato flytter ikke resten av tidsplanen. Det gjør *Flytt prosjekt*, se [Flytte et prosjekt](docs://howto-project-verplaatsen).

## Se også

- [Beregningsalternativer og beregningsregler](docs://ref-rekenopties-en-conventies): blokken *Beregningsprofil og beregningsalternativer*.
- [Beregningsprofiler og beregningsregler](docs://uitleg-rekenprofielen): hvorfor en profil endrer resultatet.
- [Flytte et prosjekt](docs://howto-project-verplaatsen): hele tidsplanen til en annen start.
- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): komme i gang med de første aktivitetene.
- [Generere helligdager og byggferie](docs://howto-feestdagen-genereren): helligdagssettet i detalj.
