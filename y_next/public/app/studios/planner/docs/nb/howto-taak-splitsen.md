# Dele en aktivitet

Mål: avbryte en aktivitet, slik at arbeidet stopper og fortsetter senere, uten at det blir to aktiviteter.

## Når du trenger dette

Å legge armeringen tar åtte arbeidsdager, men etter fire dager må kranen gå til et annet prosjekt, og arbeidet fortsetter to dager senere. To atskilte aktiviteter betyr at du må holde avhengigheter og tilordninger to ganger. Med et **avbrudd** blir det fortsatt én aktivitet, med én stolpe som har et mellomrom. I appen heter avbruddet også *avbrudd*.

Arbeidet blir like langt, men aktiviteten varer lengre i kalenderen. Et eksempel: en aktivitet på 8 arbeidsdager som starter tirsdag 29. september 2026, slutter torsdag 8. oktober. Legger du inn et avbrudd på 2 arbeidsdager etter 4 arbeidsdager, slutter den mandag 12. oktober. Varigheten er fortsatt 8 arbeidsdager, bare slutten flytter seg to arbeidsdager.

## Steg

### Dele i Gantt

1. Velg *Hjem › Aktiviteter › Del aktivitet* (eller *Tidsplan › Avhengigheter › Del aktivitet*). Over tidsplanen vises meldingen *Klikk på en stolpe på dagen avbruddet starter, og dra til høyre for lengden. Trykk Esc for å stoppe*. Knappen finnes også på fanen *Tabell* (*Tabell › Aktiviteter › Del aktivitet*), men den er deaktivert der.
2. Beveg musen over stolpen. En stiplet linje og en etikett med dato viser hvor avbruddet ville starte. Trykk på stolpen, på dagen avbruddet starter.
3. Dra til høyre. Etiketten viser lengden, for eksempel *2 arbeidsdager avbrudd*: avstanden i arbeidsdager til dagen under musen. Slipp.

Hvis du bare klikker, uten å dra, blir avbruddet én arbeidsdag. Drar du tilbake til venstre, blir avbruddet kortere igjen, ned til minst én arbeidsdag. For en aktivitet i timer fungerer det i timer.

Modusen forblir på, så du kan dele flere aktiviteter. Du stopper med Esc eller med knappen *Stopp* i meldingen. Trykker du Esc mens du drar, tilbakestiller appen avbruddet, og modusen stopper. Hver handling er ett steg for *Angre*.

Etter en deling er tidsplanen ikke lenger oppdatert. Trykk **Beregn** (F5) for de endelige datoene.

### Dra et eksisterende avbrudd i Gantt

Dette fungerer uten modusen for delt aktivitet, direkte på en stolpe som har et avbrudd.

- Dra delen **etter** avbruddet til høyre eller venstre. Avbruddet blir lengre eller kortere, med etiketten *3 arbeidsdager avbrudd*. Drar du den så langt tilbake at avbruddet er 0, viser etiketten *Slå sammen*, og de to delene er igjen én.
- Dra høyre kant av delen **før** avbruddet. Den delen blir lengre eller kortere, med etiketten *Del: 5 arbeidsdager*. Varigheten av aktiviteten endres med den.
- Drar du den første delen, flytter du hele aktiviteten, slik som med alle stolper.

### Dele og justere i egenskapspanelet

Velg aktiviteten. I panelet *Egenskaper* står blokken *Avbrudd* under *Avhengigheter* og over *Tilordninger*. Bla dit ved behov.

- *Legg til avbrudd* legger inn et avbrudd på én arbeidsdag midt i den lengste delen.
- Hvert avbrudd har to felt: *etter* (hvor mange arbeidsdager med arbeid som kommer før avbruddet) og *avbrudd* (lengden på avbruddet). Ved siden av dem står datoene for delen etter avbruddet. For en timebasert aktivitet viser de timer.
- Stiller du *avbrudd* til 0, forsvinner avbruddet. Den lille søppelbøtta (*Fjern avbrudd*) gjør det samme.

Vær forsiktig med *etter*: feltet gjør delen med arbeid før avbruddet lengre eller kortere, og dermed også varigheten av hele aktiviteten. Med *avbrudd* endrer bare slutten seg.

### Fjerne et avbrudd

Høyreklikk avbruddet i Gantt, eller delen etter det, og velg *Fjern avbrudd*. *Fjern alle avbrudd* står i høyreklikkmenyen til hver stolpe som har et avbrudd. Eller bruk blokken *Avbrudd* i panelet *Egenskaper*, som ovenfor.

### Med en KI-assistent

En tilkoblet KI-assistent setter avbrudd med verktøyet `planner_set_task_splits`, i samme form som i panelet: etter hvor mange arbeidsdager (eller arbeidstimer) med arbeid, og hvor mange arbeidsdager (eller arbeidstimer) med avbrudd. Den gir alltid hele listen; en tom liste fjerner alle avbrudd. Den leser dem igjen med `planner_get_task`. De samme reglene gjelder som hieronder: en aktivitet som du ikke kan dele, kan assistenten heller ikke dele. Anders enn ved en deling du gjør selv, omberegner appen tidsplanen automatisk etterpå. Hvordan du kobler til en assistent, står i [Koble til en KI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Fallgruver og hva appen gjør

**Ikke alle aktiviteter kan deles.** Du kan ikke dele en milepæl, en hovedaktivitet, en aktivitet der *Hengekøye (avledet varighet)* er på (se [Lage en hengekøye](docs://howto-hammock)), en aktivitet med varighetstype *Forløpt tid*, en aktivitet som er *Manuelt planlagt*, eller en aktivitet som er kortere enn to arbeidsdager. I modusen for delt aktivitet viser musen en peker for ikke tillatt handling, og ingenting skjer. For en slik aktivitet mangler blokken *Avbrudd* også i *Egenskaper*.

**På fanen *Tabell* fungerer knappen ikke.** *Del aktivitet* er deaktivert der, med verktøytipset *Bare tilgjengelig når Gantt-diagrammet vises*. Gesten krever en stolpe. Modusen for delt aktivitet og koblingsmodus slår hverandre av.

**Et klikk uten effekt.** Et avbrudd kan ikke starte på aktivitetens første dag, og heller ikke inne i et eksisterende avbrudd. Hver del med arbeid må også være minst én arbeidsdag lang. Klikker du på et slikt sted, skjer ingenting, og du får ingen melding.

**En aktivitet med fremdrift.** Har aktiviteten fremdrift, kan et avbrudd bare starte etter arbeidet som allerede er utført. Ved 50% av 8 arbeidsdager er det tidligst den femte arbeidsdagen. Et klikk i den utførte delen gjør ingenting. En aktivitet som er 100% fullført, kan ikke lenger deles. I panelet er *Legg til avbrudd* da deaktivert. Det gjelder også når midten av den lengste delen faller i utført arbeid, for eksempel ved 75% av 8 arbeidsdager.

**Utjevning lager også avbrudd.** De vises i blokken *Avbrudd* med etiketten *utjevning*. *Ressurser › Utjevning › Fjern utjevning* fjerner dem igjen. Redigerer du selv avbruddene til en slik aktivitet, blir alle utjevningsavbruddene dine, og *Fjern utjevning* fjerner dem ikke lenger.

**Avbrudd følger ikke med til MS Project eller Primavera.** Eksporterer du til *MS Project XML* eller *Primavera P6 XML*, kjenner det programmet et avbrudd bare som en arbeidsfordeling på en tilordning. Uten en slik fordeling kommer aktiviteten uten avbrudd, og appen melder hvor mange aktiviteter det gjelder: *1 aktivitet med avbrudd er eksportert uten avbrudd: MS Project og P6 kjenner bare avbrudd som en arbeidsfordeling.* I appens IFC-fil beholdes de.

**En fil med avbrudd som appen ikke kan redigere.** Avbrudd fra en kildefil som ikke passer i appens form, viser meldingen *Disse avbruddene kommer fra kildefilen i en form som ikke kan redigeres her* i panelet, med bare *Fjern alle avbrudd*.

## Se også

- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvordan tidsplanen teller i arbeidsdager, og hvorfor slutten flytter seg.
- [Legge til avhengigheter](docs://howto-relaties-leggen): en annen modus i Gantt, som du bruker når du drar en stolpe.
- [Aktivitetsdialog og egenskapspanel](docs://ref-taak-eigenschappen): blokken Avbrudd i egenskapspanelet.
