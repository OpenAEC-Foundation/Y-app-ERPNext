# Opdeling af en opgave

Mål: afbryd en opgave, så arbejdet stopper og fortsætter senere, uden at opgaven bliver til to opgaver.

## Hvornår du har brug for det

Lægningen af armeringen tager otte arbejdsdage. Men efter fire dage skal kranen til et andet job, og arbejdet fortsætter to dage senere. To separate opgaver betyder, at du skal vedligeholde dine afhængigheder og tildelinger to gange. Med en **afbrydelse** forbliver det én opgave, med én bjælke der har et hul. Appen bruger også ordet *afbrydelse*.

Arbejdsmængden er stadig den samme, men opgaven varer nu længere i kalenderen. Et eksempel: en opgave på 8 arbejdsdage, der starter tirsdag den 29. september 2026, slutter torsdag den 8. oktober. Hvis du sætter en afbrydelse på 2 arbejdsdage efter 4 arbejdsdage, slutter den mandag den 12. oktober. Varigheden er stadig 8 arbejdsdage. Kun slutdatoen flytter sig to arbejdsdage.

## Trin

### Opdeling i Gantt-diagrammet

1. Vælg *Start › Opgaver › Opdel opgave* (eller *Tidsplan › Afhængigheder › Opdel opgave*). Over tidsplanen vises meddelelsen *Klik på en bjælke på den dag afbrydelsen starter, og træk til højre for længden. Esc stopper.* Knappen findes også på fanen *Tabel* (*Tabel › Opgaver › Opdel opgave*), men den er deaktiveret der.
2. Flyt musen over bjælken. En stiplet linje og en etiket med datoen viser, hvor afbrydelsen ville starte. Tryk med musen på bjælken, på den dag afbrydelsen starter.
3. Træk til højre. Etiketten viser længden, for eksempel *2 arbejdsdage afbrydelse*: afstanden i arbejdsdage til dagen under musen. Slip museknappen.

Hvis du bare klikker uden at trække, bliver afbrydelsen én arbejdsdag. Træk tilbage til venstre for at gøre afbrydelsen kortere igen, ned til mindst én arbejdsdag. For en opgave i timer virker det i timer.

Tilstanden forbliver aktiv, så du kan opdele flere opgaver. Du stopper med Esc eller med knappen *Stop* i meddelelsen. Hvis du trykker på Esc under et træk, annullerer appen afbrydelsen, og tilstanden stopper. Hvert træk er ét trin for *Fortryd*.

Efter en opdeling er tidsplanen ikke længere opdateret. Tryk på **Beregn** (F5) for de endelige datoer.

### Træk en eksisterende afbrydelse i Gantt-diagrammet

Det virker uden opdelingstilstand, direkte på en bjælke med en afbrydelse.

- Træk stykket **efter** afbrydelsen mod højre eller venstre. Afbrydelsen bliver længere eller kortere, med etiketten *3 arbejdsdage afbrydelse*. Hvis du trækker det tilbage, til afbrydelsen er 0, viser etiketten *Sammenlæg*, og de to stykker er igen ét.
- Træk den højre kant af stykket **før** afbrydelsen. Stykket bliver længere eller kortere, med etiketten *Stykke: 5 arbejdsdage*. Varigheden af opgaven ændrer sig med det.
- Hvis du trækker det første stykke, flytter du hele opgaven, ligesom med enhver bjælke.

### Opdeling og justering i egenskabspanelet

Vælg opgaven. I panelet *Egenskaber* ligger blokken *Afbrydelser* under *Afhængigheder* og over *Tildelinger*. Rul til den, hvis det er nødvendigt.

- *Tilføj afbrydelse* sætter en afbrydelse på én arbejdsdag midt i det længste stykke.
- Hver afbrydelse har to felter: *efter* (hvor mange arbejdsdage med arbejde der ligger før afbrydelsen) og *afbrydelse* (længden af afbrydelsen). Ved siden af dem står datoerne for stykket efter afbrydelsen. For en timeopgave viser felterne timer.
- Hvis du sætter *afbrydelse* til 0, forsvinder afbrydelsen. Den lille papirkurv (*Fjern afbrydelse*) gør det samme.

Vær forsigtig med *efter*: feltet forlænger eller forkorter stykket arbejde før afbrydelsen, og dermed varigheden af hele opgaven. Med *afbrydelse* ændres kun slutdatoen.

### Fjern en afbrydelse

Højreklik på afbrydelsen i Gantt-diagrammet, eller på stykket efter den, og vælg *Fjern afbrydelse*. *Fjern alle afbrydelser* står i højreklikmenuen for hver bjælke med en afbrydelse. Eller brug blokken *Afbrydelser* i panelet *Egenskaber*, som ovenfor.

### Med en AI-assistent

En forbundet AI-assistent sætter afbrydelser med værktøjet `planner_set_task_splits`, i samme form som panelet: efter hvor mange arbejdsdage (eller arbejdstimer) arbejde, og hvor mange arbejdsdage (eller arbejdstimer) afbrydelse. Den giver altid hele listen; en tom liste fjerner alle afbrydelser. Den læser dem tilbage med `planner_get_task`. De samme regler gælder som beskrevet nedenfor: en opgave du ikke kan opdele, kan assistenten heller ikke opdele. Anders end en opdeling du selv laver, genberegner appen tidsplanen bagefter af sig selv. Hvordan du forbinder en assistent, står i [Forbind en AI-assistent (MCP)](docs://howto-ai-assistent-koppelen).

## Faldgruber, og hvad appen gør

**Ikke alle opgaver kan opdeles.** Du kan ikke opdele en milepæl, en hovedopgave, en opgave med *Hængekøje (afledt varighed)* slået til (se [Oprettelse af en hængekøje](docs://howto-hammock)), en opgave med varighedstype *Forløbet varighed*, en opgave der er *Manuelt planlagt*, eller en opgave kortere end to arbejdsdage. I opdelingstilstand viser musen et ikon for ikke tilladt, og der sker intet. For en sådan opgave mangler blokken *Afbrydelser* også i *Egenskaber*.

**På fanen Tabel virker knappen ikke.** *Opdel opgave* er deaktiveret der, med værktøjstippet *Kun tilgængelig, når Gantt-diagrammet er synligt*. Handlingen kræver en bjælke. Opdelingstilstand og sammenkædningstilstand slår hinanden fra.

**Et klik uden effekt.** En afbrydelse kan ikke starte på opgavens første dag, og heller ikke inde i en eksisterende afbrydelse. Hvert stykke arbejde skal også blive mindst én arbejdsdag langt. Hvis du klikker på et sådant sted, sker der intet, og der kommer ingen meddelelse.

**En opgave med fremdrift.** Har opgaven fremdrift, kan en afbrydelse kun starte efter det arbejde, der allerede er udført. Ved 50 % af 8 arbejdsdage er det tidligst den femte arbejdsdag. Et klik i den udførte del gør ingenting, og en opgave med en færdiggørelsesgrad på 100 % kan ikke længere opdeles. I panelet er *Tilføj afbrydelse* så deaktiveret. Det gælder også, hvis midten af det længste stykke falder i udført arbejde, for eksempel ved 75 % af 8 arbejdsdage.

**Udjævning opretter også afbrydelser.** De vises i blokken *Afbrydelser* med etiketten *udjævning*. *Ressourcer › Udjævning › Ryd udjævning* fjerner dem igen. Hvis du selv redigerer afbrydelserne på en sådan opgave, bliver alle dens udjævningsafbrydelser dine, og *Ryd udjævning* fjerner dem ikke længere.

**Afbrydelser følger ikke med til MS Project eller Primavera.** Hvis du eksporterer til *MS Project XML* eller *Primavera P6 XML*, kender det program kun en afbrydelse som en fordeling af arbejde i en tildeling. Uden en sådan fordeling kommer opgaven uden afbrydelse, og appen melder hvor mange opgaver det drejer sig om: *1 opgave med afbrydelse er eksporteret uden afbrydelse: MS Project og P6 kender afbrydelser kun som fordeling af arbejde.* I appens IFC-fil bliver de bevaret.

**En fil med afbrydelser, som appen ikke kan redigere.** Afbrydelser fra en kildefil, der ikke passer i appens format, viser meddelelsen *Disse afbrydelser kommer fra kildefilen i et format, der ikke kan redigeres her* i panelet, med kun *Fjern alle afbrydelser*.

## Se også

- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan tidsplanen tæller i arbejdsdage, og hvorfor slutdatoen flytter sig.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): en anden tilstand i Gantt-diagrammet, som du bruger med et træk i en bjælke.
- [Opgavedialog og egenskabspanel](docs://ref-taak-eigenschappen): afsnittet Afbrydelser i egenskabspanelet.
