# Velg en arbeidsregel

Mål: stel per aktivitet inn hva appen justerer når du endrer varigheten, tildelingsenhetene eller arbeidet: varigheten, tildelingsenhetene eller arbeidet selv.

## Når du trenger dette

Du har satt ressurser på en aktivitet, og du vil at appen skal beregne slik du gjør. Ett eksempel: kranen leies for én dag, og den dagen er fast. Et annet eksempel: du vet at det er 160 timer murarbeid i den, og du vil se hvor lang tid det tar med tre personer i stedet for to. Disse to situasjonene krever ulike arbeidsregler.

Regelen bestemmer hvilken av de tre størrelsene varighet, tildelingsenheter og arbeid som følger med når du endrer en annen. Bakgrunn og utregnede eksempler står i [Arbeidsregler: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels).

## Trinn

### Vis arbeidsregelen

Arbeidsregelen vises ikke som standard. Slå den på én gang:

1. Velg *Innstillinger › Prosjekt › Innstillinger*, fanen *Tidsplan*.
2. Under overskriften *Beregning*, kryss av for *Vis arbeidsregler og arbeid*.
3. Lukk vinduet med *Lukk*.

Dette er en innstilling i appen, ikke i prosjektfilen. Inneholder en fil allerede arbeidsregler eller lagret arbeid, for eksempel en fil fra MS Project eller Primavera P6, viser appen arbeidsregelen for den filen, også uten denne innstillingen. Det samme gjelder når du selv velger en arbeidsregel i en fil. Visningen blir da stående på for den filen, også hvis du slår av innstillingen igjen. Den blir stående på så lenge filen er åpen. Etter ny åpning blir den stående på så lenge filen inneholder en arbeidsregel eller lagret arbeid.

### Velg en regel

1. Velg aktiviteten. Panelet *Egenskaper* er til høyre. Ser du det ikke, slå det på med *Visning › Paneler › Egenskaper*.
2. Velg under *Arbeidsregel* ett av de fem alternativene: *Prosjektstandard (Fast varighet og faste tildelingsenheter)*, *Fast varighet og faste tildelingsenheter*, *Fast varighet og fast arbeid*, *Fast arbeid* eller *Faste enheter*. Med *Prosjektstandard* følger aktiviteten prosjektets standard.
3. Under rullegardinlisten viser appen hva regelen beskytter, for eksempel *Beskyttet: arbeid (varighet følger tildelingsenheter)*.

*Prosjektstandard* er det første valget, og det en aktivitet har som standard. Regelen i parentesen er den prosjektet har som standard akkurat nå. Appen har ingen knapp for å endre prosjektstandarden. Den kommer fra en import (for eksempel fra MS Project eller Primavera P6) eller fra MCP-forbindelsen. Vil du ha en annen regel for én aktivitet, velg den her.

Du kan også velge regelen i tabellen. Klikk på **+** til høyre i overskriften på aktivitetstabellen (*Legg til kolonne*). Velg deretter kolonnen *Arbeidsregel* under *Tidsplan*.

En aktivitet uten tilordning har ingenting å knytte sammen, så regelen gjør ingenting der. Tilordne en ressurs først (se [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen)).

### Se og endre arbeidet

For en aktivitet med tilordninger vises en kolonne *Arbeid (gjenst.)* i blokken *Tilordninger* i panelet *Egenskaper*, ved siden av *Enh./dag*. Det er det gjenstående arbeidet for den ressursen, i timer. Et lite hengelås over en kolonne viser hva arbeidsregelen holder fast: *Enh./dag* med *Fast varighet og faste tildelingsenheter* og med *Faste enheter*, og *Arbeid (gjenst.)* med *Fast varighet og fast arbeid* og med *Fast arbeid*.

Vil du endre arbeidet selv, skriv inn timene i feltet og trykk Enter. Appen godtar ikke en verdi på 0 eller lavere: feltet hopper tilbake til forrige verdi.

### Se hva som skjer

Velger du en regel, endres ingen tall ennå. Under en regel som beskytter arbeid, låser appen bare det gjeldende arbeidet, så *Arbeid (gjenst.)* får en lagret verdi. Først ved neste endring bestemmer regelen hva som følger med. Endre for eksempel *Enh./dag* og se hva som skjer med varigheten og arbeidet.

Endrer det varigheten til aktiviteten, viser statuslinjen *Utdatert — omberegn (F5)*. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*, for å se de nye datoene. Er *Beregne automatisk* på (samme fane *Tidsplan*, under overskriften *Beregning*), gjør appen dette selv.

## Hvilken regel passer

- **Fast varighet og faste tildelingsenheter** passer når varigheten er avtalt og tildelingsenhetene er inndata du gir. Arbeidet følger av de to. Dette er standard. Kranen som leies for én dag hører hit: dagen er fast, og du bestemmer hvor mange kraner som er på den.
- **Fast varighet og fast arbeid** passer når aktiviteten må være ferdig innenfor en fast tidsramme, og du vet hvor mye arbeid det er i den. Endres varigheten, justerer appen tildelingsenhetene.
- **Fast arbeid** passer når du vet hvor mange timer arbeid det er i den, og du vil se hvordan varigheten endrer seg med antall personer. De 160 timene murarbeid med tre personer i stedet for to hører hit. Pussarbeidet i øvingsprosjektet får denne regelen.
- **Faste enheter** passer når tildelingsenhetene er faste, for eksempel én kran, og arbeidet bestemmer varigheten.

## Fallgruver og hva appen gjør da

**Feltet *Arbeidsregel* mangler.** Da er innstillingen *Vis arbeidsregler og arbeid* av, og filen har ingen arbeidsregler ennå. Eller du har valgt en milepæl, en fase, en hengekøye eller en aktivitet med varighetstypen *Forløpt tid*. Der finnes ingen arbeidsregel. Velg en vanlig aktivitet.

**Varigheten endres uten at du endrer den.** Med *Fast arbeid* og *Faste enheter* følger varigheten av tildelingsenheter og arbeid. Endrer du en av dem eller antall ressurser, justerer appen varigheten og runder opp til hele arbeidsdager. For en aktivitet i timer runder appen opp til hele minutter.

**Arbeidet stemmer ikke helt med tildelingsenheter × varighet.** Avrunding kan være årsaken. Ved siden av *Arbeid (gjenst.)* vises da et varselskilt, *Avviker fra tildelingsenheter × varighet*. Histogrammet følger det lagrede arbeidet.

**Materiale teller ikke.** For en materialressurs viser *Arbeid (gjenst.)* en strek. Materiale styrer aldri varigheten.

**En aktivitet med fremdrift.** Arbeidsregelen virker på den gjenstående delen. Derfor viser *Arbeid (gjenst.)* bare det som fortsatt må gjøres.

**Angring.** Å velge en regel, og hver endring som regelen beregner, angres i ett trinn med *Angre* (Ctrl+Z). Regelen er da borte igjen, men feltet *Arbeidsregel* blir stående synlig.

## Se også

- [Arbeidsregler: varighet, tildelingsenheter og arbeid](docs://uitleg-werkregels): hvordan appen knytter varighet, tildelingsenheter og arbeid sammen, med utregnede eksempler.
- [Tilordne ressurser med en kurve](docs://howto-resource-toewijzen): å sette en ressurs på en aktivitet.
