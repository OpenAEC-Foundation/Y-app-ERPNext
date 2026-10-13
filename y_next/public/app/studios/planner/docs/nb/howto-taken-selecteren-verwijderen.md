# Velge, slette og angre aktiviteter

Mål: velg aktiviteter, fjern dem og angre en feil.

## Når du trenger dette

Nesten alle handlinger i tidsplanen virker på aktivitetene du har valgt: slette, kopiere, rykke inn og slå milepæl på eller av. Du fjerner aktiviteter når jobben faller bort, eller når tidsplanen revideres. Og fordi appen ikke ber om bekreftelse ved sletting, er *Angre* sikkerhetsnettet ditt.

## Trinn

### Velge aktiviteter

- **Én aktivitet.** Klikk på raden i aktivitetstabellen eller stolpen i Gantt.
- **Flere aktiviteter.** Ctrl+klikk (⌘+klikk på en Mac) legger til en aktivitet i markeringen eller fjerner den. I aktivitetstabellen markerer Shift+klikk alle aktivitetene fra den aktive aktiviteten til den du klikket på.
- **Alle synlige aktiviteter.** Ctrl+A, med fokus i aktivitetstabellen eller i Gantt. Aktiviteter som et filter skjuler, faller utenfor, og det samme gjør delaktiviteter i en skjult fase.
- **En boks i Gantt.** Hold Ctrl nede og dra over den tomme bakgrunnen. Alle aktiviteter i radene som boksen berører, blir markert, selv om stolpen deres ligger ved siden av. Bare høyden på boksen teller, ikke tidsaksen. Hvis du slipper Ctrl først etter museknappen, legges de til i den eksisterende markeringen; ellers erstatter de den. Uten Ctrl ruller samme dragebevegelse tidslinjen i standardinnstillingen.
- **Ingenting.** Trykk Esc, eller klikk på den tomme bakgrunnen i Gantt.

Velger du en hovedaktivitet, blir ikke delaktivitetene valgt med. Sletting og kopiering tar dem likevel med.

### Slette aktiviteter

Velg aktivitetene og velg en av disse måtene:

- *Hjem › Rediger › Slett*. Den samme knappen finnes på fanen *Tabell*.
- Delete eller Backspace, hvis fokus ikke er i aktivitetstabellen. Klikk derfor først på en stolpe i Gantt.
- *Slett* i høyreklikkmenyen. Er aktiviteten du klikket på en del av markeringen, gjelder det hele markeringen. Ellers gjelder det bare den ene aktiviteten.
- Den lille søppelbøtta øverst i panelet *Egenskaper* (verktøytips *Slett aktivitet*). Den sletter aktiviteten panelet viser.

Appen ber ikke om bekreftelse. Sletter du flere aktiviteter samtidig, er det ett trinn for *Angre*.

Dette forsvinner med dem: alle delaktiviteter i en slettet hovedaktivitet, alle avhengigheter til og fra de slettede aktivitetene, og tilordningene deres til ressurser. Sletter du den siste delaktiviteten i en hovedaktivitet, blir hovedaktiviteten igjen som en vanlig aktivitet. Er *WBS auto* på, nummererer appen treet på nytt. Tidsplanen er da utdatert: trykk **Beregne** (F5), med mindre *Beregne automatisk* er på.

### Skjule og utvide

En hovedaktivitet har en trekant foran navnet i aktivitetstabellen. Klikk på trekanten for å skjule eller vise delaktivitetene. Med *Visning › Oversikt › Skjul* og *Utvid* gjør du det for de valgte hovedaktivitetene, eller for alle hvis ingenting er valgt. Høyreklikkmenyen til en hovedaktivitet har også *Skjul* og *Utvid*. I en gruppert visning virker knappene på gruppene.

Appen holder styr på skjuling og utvidelse per åpent dokument. Det hører ikke til *Angre*, og det står ikke i prosjektfilen.

### Angre og gjøre om

- *Hjem › Rediger › Angre* og *Gjør om* (også på fanen *Tabell*), pilene i tittellinjen, eller Ctrl+Z for å angre og Ctrl+Y eller Ctrl+Shift+Z for å gjøre om.
- Gjør du noe nytt etter *Angre*, er *Gjør om* borte.

*Angre* gjelder endringer i prosjektdataene dine (aktiviteter, avhengigheter, ressurser, kalendere og lignende), og bruk av et oppsett. Endringer i kolonnene i aktivitetstabellen er også trinn: legge til, fjerne, flytte, endre størrelse, tilpasse automatisk, feste og tilbakestille kolonneoppsettet til standard. Disse kolonnetrinnene hører til aktivitetstabellen selv og gjelder hele appen, ikke ett dokument. Appen beholder de siste hundre trinnene per dokument, færre for et veldig stort prosjekt.

## Fallgruver og hva appen gjør

**Delete i aktivitetstabellen sletter ikke en aktivitet.** Hvis fokus er i aktivitetstabellen, tømmer Delete (eller Backspace) innholdet i de valgte cellene. For en påkrevd eller beregnet celle, for eksempel navnet eller varigheten, avviser appen endringen og viser en melding under aktivitetstabellen. For navnet, for eksempel *Denne verdien er påkrevd og kan ikke være tom.* Da tømmes ingenting, heller ikke i andre valgte celler. Klikk på en stolpe i Gantt, eller bruk *Slett* (på fanen *Tabell*, der det ikke finnes noen Gantt: *Tabell › Rediger › Slett* eller høyreklikkmenyen).

**En hel fase forsvinner på en gang.** Sletter du en hovedaktivitet, forsvinner delaktivitetene, avhengighetene og tilordningene med den. *Angre* (Ctrl+Z) henter alt tilbake, også avhengighetene og tilordningene.

**Dette kommer ikke tilbake.** Markeringen, skjuling og utvidelse, og knappen *Tøm* i stripen *Ikke tilgjengelig under filtrering/gruppering/sortering* hører ikke til *Angre*. Hvis du trykker Ctrl+Z etter *Tøm*, angrer du derfor forrige trinn, ikke tømmingen.

**Fjerne en aktivitet som andre avhenger av.** Avhengighetene til og fra den aktiviteten forsvinner også. Aktiviteter som bare var koblet til den, løsner og starter igjen på sin egen planlagte startdato etter **Beregne**. Legg til nye avhengigheter om nødvendig, se [Legge til avhengigheter](docs://howto-relaties-leggen).

## Se også

- [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen): det motsatte, og kopiering av aktiviteter.
- [Justere strukturen](docs://howto-structuur-aanpassen): plasser en aktivitet under en annen fase i stedet for å fjerne den.
- [Dra, panorere og zoome i Gantt](docs://howto-gantt-bedienen): markeringsboksen og rullemodusene.
- [Høyreklikkmenyer](docs://ref-contextmenus): hva *Slett* og de andre punktene gjør med en markering.
