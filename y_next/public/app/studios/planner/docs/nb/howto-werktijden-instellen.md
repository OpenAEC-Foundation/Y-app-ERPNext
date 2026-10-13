# Angi arbeidstider

Mål: legg inn per ukedag på hvilke klokkeslett en kalender arbeider, slik at aktiviteter i timer får riktige klokkeslett.

## Når du trenger dette

Fredag ettermiddag er fri. Mannskapet arbeider fra 06:00 til 22:00 i to skift. Det er et nattlag. Pausen er kortere enn én time. Så lenge du bare planlegger i dager, er *Start (time)*, *Slutt (time)* og pausen nok ([Opprette og tildele en kalender](docs://howto-kalender-maken-en-toewijzen)). Planlegger du aktiviteter i timer, teller appen arbeidsminutter innenfor **tidsbåndene** i kalenderen. I appen heter disse tidsbåndene *bånd*. Et tidsbånd er en sammenhengende periode med arbeidstid på én ukedag. Et mellomrom mellom to tidsbånd er en pause. Hva dette betyr for tidsplanen din, står i [Dager og timer](docs://uitleg-dagen-en-uren).

Du trenger *Slå på timeplanlegging* for dette ([Slå på timeplanlegging](docs://howto-urenplanning-aanzetten)). Uten timeplanlegging ser du ikke blokken *Arbeidstider*.

## Trinn

### Velge et skiftpreset

1. Velg *Tidsplan › Kalender › Kalender* og velg kalenderen til venstre.
2. Klikk på et preset i blokken *Arbeidstider*. Det erstatter arbeidsdagene og arbeidstidene i kalenderen.
3. Klikk på *Bruk*.

Hvert preset gjør dette:

- *Dagskift*: mandag til fredag fra 08:00 til 16:00 uten pause. Dette gjør den igjen til en vanlig kalender uten tidsbånd.
- *2 skift*: mandag til fredag fra 06:00 til 14:00 og fra 14:00 til 22:00, 16 timer til sammen.
- *3 skift*: mandag til fredag tre skift, fra 06:00 til 14:00, fra 14:00 til 22:00 og fra 22:00 til 06:00 neste dag, 24 timer til sammen.
- *Nattskift*: mandag til fredag fra 22:00 til 06:00 neste dag, 8 timer.
- *24/7*: alle syv dager fra 00:00 til 24:00.

### Angi arbeidstider per ukedag

1. Klikk på *Angi per ukedag…* i blokken *Arbeidstider*. Under knappene vises en rad per ukedag med arbeidstiden for den dagen, og kalenderen har nå tidsbånd per ukedag. Har kalenderen dem allerede, er denne oversikten åpen med én gang. Knappen heter da *Skjul arbeidstider* og skjuler oversikten igjen.
2. Juster starttiden og sluttiden for hvert tidsbånd i de to tidsfeltene.
3. Om du vil legge inn en pause, klikk på **+** (*Legg til bånd*) for den dagen. Juster tidene for tidsbåndene, slik at det blir et mellomrom mellom dem. Et nytt tidsbånd starter klokken 08:00 og slutter klokken 16:00.
4. Et tidsbånd som går over midnatt, huker du av med *neste dag*. Tidsbåndet teller for den dagen det begynner.
5. Klikk på søppelbøtta bak et tidsbånd for å fjerne det. En dag uten tidsbånd vises som *Ikke-arbeidsdag*.
6. Klikk på kopisymbolet (*Kopier til alle arbeidsdager*) for en dag fra mandag til fredag. Tidsbåndene for den dagen legges da på mandag til fredag.
7. Nederst står *Avledede timer/dag:* med netto timer per dag som appen utleder av dette. Klikk på *Bruk*.

**Eksempel: en fri fredag ettermiddag.** Klikk på *Angi per ukedag…*. Fjern det andre tidsbåndet (13:00 til 16:00) for *Fr*. Fredag har nå 5 timer, de andre dagene 8. Avledede timer/dag blir fortsatt 8.

### Lagre et eget preset

1. Klikk på *Lagre som preset…* og skriv et navn i feltet *Navn på ditt eget preset*.
2. Klikk på *Lagre*. Presetet står nå blant de andre presetene, og du kan bruke det i alle prosjekter. Med krysset ved siden av det fjerner du det igjen.

Et eget preset lagres på denne enheten, ikke i prosjektfilen.

## Fallgruver og hva appen gjør da

**Et preset erstatter alt.** Velger du et preset, forsvinner arbeidsdagene og arbeidstidene du satte før. Helligdager blir ikke endret.

**Dagknapper og tidsbånd er to forskjellige ting.** Knappene under *Arbeidsdager* endrer ikke tidsbåndene. En dag får arbeidstid ved å klikke på *Legg til bånd* for den dagen. Slår du en dag på bare med knappen, teller den for aktiviteter i dager, men ikke for aktiviteter i timer. Har kalenderen arbeidstider, bruk radene per ukedag.

**Justering av arbeidstider når timeplanlegging er av.** Slår du timeplanlegging av igjen, kommer feltene *Start (time)*, *Slutt (time)* og pausen tilbake. På en kalender med tidsbånd endrer de ikke tidsbåndene. Juster derfor alltid arbeidstidene mens timeplanlegging er på.

**Ingen brukbare arbeidstider.** En kalender uten tidsbånd eller uten arbeidsdager kan ikke bære en aktivitet i timer. Appen viser da *Denne kalenderen har ingen gyldige arbeidstider. Kontroller arbeidsdagene og arbeidstidene.*

## Se også

- [Dager og timer](docs://uitleg-dagen-en-uren): hvordan appen teller arbeidstimer og utleder netto timer per dag.
- [Slå på timeplanlegging](docs://howto-urenplanning-aanzetten): planlegge en aktivitet i timer.
- [Kalendere og arbeidsdager](docs://uitleg-kalenders): hvilken kalender som gjelder for hvilken aktivitet.
- [Kalendervinduer](docs://ref-kalenders): alle felt i kalendervinduene.
