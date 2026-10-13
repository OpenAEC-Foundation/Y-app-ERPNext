# Banesporing

Mål: gjør kjeden av aktiviteter før eller etter en aktivitet synlig, så du ser hva som setter en aktivitet på datoen sin, og hva som flytter seg hvis den blir forsinket.

## Når du trenger dette

Takarbeidet starter først om tre uker, og du vil vite hvilken aktivitet som bestemmer det. Eller murerarbeidet er en uke forsinket, og du vil se hvilke aktiviteter som kommer etter murerarbeidet og flytter seg. I en tidsplan med dusinvis av avhengigheter ser du ikke dette på linjene. Med **banesporing** farger appen alle **forgjengere** (aktiviteter som kommer før den valgte aktiviteten, direkte eller via andre aktiviteter) og **etterfølgere** (aktiviteter som kommer etter den), og nedtoner resten.

## Steg

1. Velg aktiviteten du vil se banen til, i aktivitetstabellen eller på stolpen i Gantt-diagrammet. Hvis du velger flere aktiviteter, sporer appen fra den aktiviteten du valgte først.
2. Velg *Tidsplan › Banesporing › Forgjengere* for alt som kommer før aktiviteten, eller *Tidsplan › Banesporing › Etterfølgere* for alt som kommer etter den. Begge knappene kan være på samtidig. De samme to knappene finnes på fanen *Tabell*, i gruppen *Banesporing*.
3. Vil du ha begge retningene samtidig, høyreklikk aktiviteten, i Gantt-diagrammet eller i aktivitetstabellen, og velg *Spor bane*.
4. Se på resultatet i Gantt-diagrammet og i aktivitetstabellen. Hvordan du leser det, forklares nedenfor.
5. Du stopper ved å klikke på den aktive knappen igjen, ved å høyreklikke en aktivitet og velge *Stopp sporing av styrende avhengigheter*, eller med Esc. Esc fjerner også markeringen.

Hvis du velger en annen aktivitet mens du sporer, følger banen den nye markeringen.

## Slik leser du resultatet

- Forgjengere er gull, etterfølgere lilla. I Gantt-diagrammet endrer stolpene farge. I aktivitetstabellen vises en strek til venstre for raden: heltrukket for forgjengere, stiplet for etterfølgere. Den valgte aktiviteten har en kontur.
- En mørkere farge, i aktivitetstabellen en tykkere strek med fet tekst, markerer kjeden av **styrende** avhengigheter: avhengighetene som faktisk bestemmer datoene. Hva det betyr, forklares i [Avhengigheter og forsinkelse](docs://uitleg-relaties).
- Alle aktiviteter utenfor banen nedtones. Avhengighetslinjer som ikke hører til banen, er svakere og prikkete.

## Fallgruver og hva appen gjør

**Ingen aktivitet er valgt.** Uten valgt aktivitet er det ingenting å spore: knappen er på, men ingenting endrer seg på skjermen. Velg først en aktivitet.

**Ingen utheving av den styrende kjeden.** Utheving kommer fra siste beregning. Hvis tidsplanen ikke er beregnet ennå, eller beregningen gir en feil, farger appen alle forgjengere og etterfølgere like sterkt. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*, og se på banen igjen. Etter en endring blir utheving stående med den forrige beregningen, så lenge statuslinjen viser *Utdatert — omberegn (F5)*.

**En avhengighet på en fase.** Banesporing følger avhengighetene slik du har lagt dem inn. En avhengighet fra eller til en fase (hovedaktivitet) knytter fasen selv. For beregningen gjelder den for alle aktiviteter i fasen, men banen fortsetter ikke til aktivitetene inni den. Hvis du sporer en aktivitet inni en fase som er knyttet til en annen aktivitet med en avhengighet på selve fasen, ser du derfor ikke den avhengigheten. Velg da fasen selv.

**Bare den valgte retningen.** Hvis bare *Forgjengere* er på, ser du ikke hva som kommer etter aktiviteten, og omvendt.

## Se også

- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hvorfor en avhengighet er styrende, og hvordan appen beregner startdatoen for en aktivitet.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hvilken kjede som bestemmer slutten på prosjektet.
- [Legge til avhengigheter](docs://howto-relaties-leggen): legge til en avhengighet hvis du savner en forbindelse i banen.
