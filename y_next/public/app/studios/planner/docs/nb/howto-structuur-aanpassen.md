# Justere strukturen

Mål: ordne aktiviteter i faser og delaktiviteter, endre rekkefølgen og holde WBS-nummerene riktige.

## Når du trenger dette

Tidsplanen din er et tre: faser (hovedaktiviteter) med delaktiviteter under seg, for eksempel *Foundation* med *Groundwork*, *Reinforcement* og *Pouring*. Du justerer treet når du vil legge aktiviteter under en fase, ta en aktivitet ut av en fase, eller når rekkefølgen er feil. **WBS-koden** (1, 1.1, 1.2, 2, …) er aktivitetens nummer i treet.

## Trinn

### Rykke inn en aktivitet

1. Velg aktiviteten. Det går bra å velge flere aktiviteter.
2. Velg *Tidsplan › Struktur › Rykk inn*. Du kan også bruke Alt+→ (eller Alt+Shift+→), eller *Rykk inn* i hurtigmenyen.

Aktiviteten blir den siste delaktiviteten til forrige aktivitet på samme nivå. Den forrige aktiviteten blir dermed en hovedaktivitet. Velger du et sammenhengende utvalg, rykkes utvalget inn som helhet. Har aktiviteten ingen forrige aktivitet på samme nivå, skjer ingenting, og det kommer ingen melding.

### Redusere innrykk for en aktivitet

Velg *Tidsplan › Struktur › Reduser innrykk*, trykk Alt+← (eller Alt+Shift+←), eller velg *Reduser innrykk* i hurtigmenyen.

Aktiviteten blir en aktivitet på samme nivå som fasen, rett etter fasen. Egne delaktiviteter følger med. Aktivitetene som kom etter den i fasen, blir i fasen. En aktivitet på øverste nivå får ikke mindre innrykk.

### Flytte en aktivitet

Du har tre måter.

- **Med tastaturet.** Alt+↑ og Alt+↓ bytter aktiviteten med naboen på samme nivå. En hovedaktivitet tar delaktivitetene sine med seg. Øverst eller nederst på nivået skjer ingenting. Når flere aktiviteter er valgt, flytter bare den aktiviteten du klikket på først.
- **Dra i aktivitetstabellen.** Trykk på en rad og dra loddrett. Den øverste fjerdedelen av en rad betyr *før*, den nederste fjerdedelen *etter*. Midten av en hovedaktivitet legger aktiviteten under den som siste delaktivitet. Midten av en vanlig aktivitet teller som nærmeste kant. Drar du en rad som er en del av flere valgte rader, flyttes hele utvalget.
- **Dra i Gantt-diagrammet.** Dra stolpen loddrett til en annen rad. Det virker på samme måte som å dra i aktivitetstabellen, og ingen datoer endres. Drar du vannrett, flytter du datoene i stedet.

Hver flytting er ett steg for *Angre* (Ctrl+Z).

### Holde WBS-nummerene oppdatert

Se på knappen *WBS auto* i *Tidsplan › Struktur*.

- **På (standard i et nytt prosjekt).** Appen nummererer hele treet på nytt ved hver tillegging, sletting og flytting. WBS-koden er da skrivebeskyttet: du kan ikke skrive den i aktivitetstabellen eller i panelet *Egenskaper*. *Nummerer WBS på nytt* er deaktivert.
- **Av.** Kodene blir som de er, også etter flytting og innrykk. Du skriver dem selv, i kolonnen *WBS* eller i feltet *WBS-kode* i panelet *Egenskaper*. Eller du får dem nummerert én gang med *Nummerer WBS på nytt*. Det overskriver også koder du har skrevet selv.

Slår du på *WBS auto*, nummererer appen treet med en gang. Du kan angre både *WBS auto* og *Nummerer WBS på nytt* med *Angre*.

## Fallgruver og hva appen gjør

**Filtrering, gruppering eller sortering er på.** Rekkefølgen du ser, er da ikke rekkefølgen i tidsplanen, så appen låser strukturen. *Rykk inn* og *Reduser innrykk* er deaktivert, med verktøytipset *Ikke tilgjengelig under filtrering/gruppering/sortering*. Alt+→ og å dra viser samme tekst i en stripe, med knappen *Tøm*. Den fjerner filter, gruppering og sortering på en gang, og Ctrl+Z henter dem ikke tilbake. *Rykk inn* og *Reduser innrykk* mangler da i hurtigmenyen.

Alt+↑ og Alt+↓ virker i en slik visning, uten melding. Med bare et filter ser du den nye rekkefølgen med en gang. Med sortering endres rekkefølgen i tidsplanen, men du ser det først etter *Tøm*.

**WBS auto er av.** En ny aktivitet får koden som passer til plassen i treet, også om en annen aktivitet allerede har den koden. Dermed kan like nummer oppstå. Også etter innrykk stemmer ikke kodene lenger med treet. *Nummerer WBS på nytt* retter begge deler.

**En milepæl får delaktiviteter.** En milepæl er et tidspunkt og har ingen delaktiviteter. Appen fjerner markeringen for milepæl og gir deg beskjed.

**En aktivitet med tilordninger av ressurser får delaktiviteter.** En hovedaktivitet har ingen tilordninger selv. Appen flytter dem til den første nye delaktiviteten som kan ta imot dem, og gir deg beskjed. Finnes ingen slik delaktivitet, eller har den allerede samme ressurs, skjer ingenting, og meldingen sier hvorfor.

**En avhengighet ville skape en syklus.** Avhengighetene til en hovedaktivitet gjelder også for delaktivitetene. Hvis en flytting på grunn av det ville skape en syklus, avviser appen den med meldingen *Denne flyttingen ville skape en syklus i tidsplanen (…)*. Ingenting endres.

**En avhengighet mellom en aktivitet og sin egen fase.** Hvis du legger en aktivitet under en fase den allerede har en avhengighet med, består avhengigheten, men den telles ikke lenger i beregningen. Appen gir deg beskjed. Du kan lese mer om avhengigheter for hovedaktiviteter i [Avhengigheter og forsinkelse](docs://uitleg-relaties).

**Tidsplanen er utdatert.** En flytting til en annen fase kan endre datoer. Trykk **Beregn** (F5). Å bare bytte rekkefølgen innenfor samme fase endrer ikke datoene.

## Se også

- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): legg nye aktiviteter på riktig plass.
- [Lagre og sette inn WBS-maler](docs://howto-wbs-sjablonen): gjenbruk en hel fase.
- [Legge til avhengigheter](docs://howto-relaties-leggen): koble aktiviteter sammen.
- [Velge, slette og angre aktiviteter](docs://howto-taken-selecteren-verwijderen): angre en flytting.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): fire faser med sine delaktiviteter, slik du bygger dem ved å rykke inn.
