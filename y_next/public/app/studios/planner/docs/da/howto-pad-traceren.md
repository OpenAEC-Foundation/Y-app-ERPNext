# Spor sti

Mål: gør kæden af opgaver før eller efter en opgave synlig. Så kan du se, hvad der bestemmer en opgaves dato, og hvad der flytter med, hvis den er forsinket.

## Hvornår du har brug for det

Tagdækningen begynder først om tre uger, og du vil vide, hvilken opgave der bestemmer det. Eller murerarbejdet er en uge forsinket. Du vil se, hvilke efterfølgende opgaver der flytter med. I en tidsplan med snesevis af afhængigheder kan du ikke se det ud fra linjerne. Med **spor sti** farver appen alle **foregående opgaver** (opgaver, der kommer før den valgte opgave, direkte eller via andre opgaver) og **efterfølgende opgaver** (opgaver, der kommer efter den). Appen nedtoner resten.

## Trin

1. Vælg opgaven, hvis sti du vil se, i opgavetabellen eller på dens bjælke i Gantt-diagrammet. Hvis du vælger flere opgaver, sporer appen sti fra den opgave, du valgte først.
2. Vælg *Tidsplan › Spor sti › Foregående opgaver* for alt, der kommer før opgaven. Vælg *Tidsplan › Spor sti › Efterfølgende opgaver* for alt, der kommer efter den. Begge knapper kan være aktiveret samtidig. De samme to knapper findes på fanen *Tabel*, i gruppen *Spor sti*.
3. Hvis du vil have begge retninger på én gang, højreklik på opgaven i Gantt-diagrammet eller i opgavetabellen. Vælg *Spor sti*.
4. Kig på resultatet i Gantt-diagrammet og i opgavetabellen. Sådan læser du det, forklares nedenfor.
5. Du stopper ved at klikke på den aktive knap igen. Du kan også højreklikke på en opgave og vælge *Stop sporing af sti*, eller trykke på Esc. Esc fjerner også markeringen.

Hvis du vælger en anden opgave under sporingen, følger stien det nye valg.

## Sådan læser du resultatet

- Foregående opgaver er guldfarvede, efterfølgende opgaver er lilla. I Gantt-diagrammet skifter bjælkerne farve. I opgavetabellen vises en stribe til venstre for rækken: massiv for foregående opgaver, stiplet for efterfølgende opgaver. Den valgte opgave har en kontur.
- En mørkere farve markerer kæden af **bestemmende afhængigheder**: de afhængigheder, der faktisk bestemmer datoerne. I opgavetabellen vises det med en tykkere stribe og fed tekst. Hvad det betyder, forklares i [Afhængigheder og forsinkelse](docs://uitleg-relaties).
- Alle opgaver uden for stien er nedtonet. Afhængighedslinjer, der ikke hører til stien, er svagere og prikket.

## Faldgruber, og hvad appen gør

**Ingen opgave valgt.** Uden valgt opgave er der ingen sti at spore. Knappen er aktiveret, men der sker ingen ændring på skærmen. Vælg først en opgave.

**Ingen fremhævning af kæden af bestemmende afhængigheder.** Fremhævningen kommer fra den sidste beregning. Hvis tidsplanen ikke er beregnet endnu, eller beregningen giver en fejl, farver appen alle foregående og efterfølgende opgaver lige kraftigt. Tryk på **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*, og kig på stien igen. Efter en ændring bliver fremhævningen ved den forrige beregning, så længe statuslinjen viser *Forældet — genberegn (F5)*.

**En afhængighed på en fase.** Sporing følger de afhængigheder, som du har lagt. En afhængighed fra eller til en fase (hovedopgave) forbinder selve fasen. For beregningen gælder den for alle opgaver i fasen. Men stien fortsætter ikke til opgaverne inde i fasen. Hvis du sporer en opgave inde i en fase, der er knyttet til en anden opgave med en afhængighed på selve fasen, ser du derfor ikke den afhængighed. Vælg i så fald selve fasen.

**Kun den valgte retning.** Hvis kun *Foregående opgaver* er aktiveret, ser du ikke, hvad der kommer efter opgaven, og omvendt.

## Se også

- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvorfor en bestemmende afhængighed sætter datoen, og hvordan appen beregner en opgaves startdato.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvilken kæde der bestemmer projektets slutdato.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): tilføj en afhængighed, hvis du mangler en forbindelse i stien.
