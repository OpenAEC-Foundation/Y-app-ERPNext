# Koblinger mellom prosjekter

Mål: koble en aktivitet i dette prosjektet til en aktivitet i en annen prosjektfil, slik at tidsplanen tar hensyn til arbeid som er planlagt et annet sted.

## Når du trenger dette

Tilbygget ditt kan bare starte når tomten er klar for bygging, og det arbeidet ligger i entreprenørens prosjekt. Eller: installatøren kan bare starte når strukturen din er ferdig, og han planlegger i sin egen fil. En vanlig avhengighet virker bare mellom aktiviteter i samme prosjekt. En **kobling mellom prosjekter** kobler en aktivitet til en aktivitet i en annen fil.

En kobling mellom prosjekter regnes ikke ut live sammen med det andre prosjektet. Appen lagrer en fast **ankerdato**: datoen for den eksterne aktiviteten på det tidspunktet du kobler den. Beregningen bruker den datoen som grense. Endrer det andre prosjektet seg, flytter ingenting seg i prosjektet ditt før du oppdaterer ankeret.

## Trinn

1. Velg nøyaktig én aktivitet i dette prosjektet: aktiviteten som avhenger av den eksterne aktiviteten, eller som den eksterne aktiviteten avhenger av.
2. Velg *Hjem › Aktiviteter › Koble ▾ › Legg til kobling mellom prosjekter…*. Den samme menyen finnes også under *Tidsplan › Avhengigheter* og under *Tabell › Aktiviteter*. Menyelementet er bare tilgjengelig når nøyaktig én aktivitet er valgt.
3. I vinduet *Kobling mellom prosjekter* velger du én av to veier. Med *Kildefil* velger du prosjektfilen under *Velg en nylig fil*, og deretter *Kildeaktivitet*. Appen leser filen skrivebeskyttet, åpner den ikke som dokument og henter ankerdatoen selv. Denne veien virker bare i skrivebordsappen, og bare for en fil i listen over nylige filer. Ellers er knappen *Kildefil* deaktivert. Med *Manuelt (reserve)* fyller du inn *Prosjekt-ID* og *Aktivitets-ID* for den eksterne aktiviteten, eventuelt *Aktivitetsnavn (valgfritt)*, og *Ankerdato*. I nettleserversjonen er dette den eneste veien.
4. Velg under *Retning* om den eksterne aktiviteten er forgjengeren eller etterfølgeren din: *Forgjenger (ekstern → meg)* eller *Etterfølger (meg → ekstern)*.
5. Velg *Avhengighetstype* (FS, SS, FF eller SF) og fyll inn *Forsinkelse (arbeidsdager)* hvis nødvendig, for eksempel `0d` eller `2d`.
6. Klikk på *Legg til kobling* og trykk **Beregn** (F5).

Hvilken dato du skriver inn som ankerdato for en manuell kobling, avhenger av retningen og typen:

- Med en ekstern **forgjenger** teller den første bokstaven i typen. F betyr sluttdatoen for den eksterne aktiviteten, S betyr startdatoen. Med FS og FF skriver du derfor inn sluttdatoen, med SS og SF startdatoen.
- Med en ekstern **etterfølger** teller den andre bokstaven. S er startdatoen for den eksterne aktiviteten, F sluttdatoen. Med FS og SS skriver du derfor inn startdatoen, med FF og SF sluttdatoen.

Planlegger du i timer (timeplanlegging er slått på, og en aktivitet har en kalender med arbeidstid), ber feltet *Ankerdato* også om et klokkeslett.

Eksempel: Tomteprosjektet blir ferdig fredag 18. juni 2027. Du kobler *Groundwork* til en ekstern forgjenger av typen FS, med ankerdato 18. juni 2027. Etter **Beregn** starter Groundwork mandag 21. juni, den første arbeidsdagen etter ankerdatoen. En ekstern etterfølger virker omvendt: den begrenser hvor sent aktiviteten din kan bli ferdig.

## Hva du ser, og hvordan du håndterer det

- Koblinger mellom prosjekter vises som tekst i kolonnene *Forgjengere* og *Etterfølgere* i aktivitetstabellen. Legg dem til med **+** i tabellhodet, under *Avhengigheter*. Teksten viser navnet på prosjektet og aktiviteten, og typen. En liten trekant med teksten *Kilde mangler* viser at kilden ikke er lest. Hold musepekeren over koblingen for å se prosjektet (linjen *Prosjekt-ID* viser prosjektnavnet så snart det er kjent), aktivitets-ID-en, ankerdatoen og statusen for kilden.
- I Gantt-diagrammet står en grå skyggestolpe ved aktiviteten. Med en forgjenger slutter den på ankerdatoen. Med en etterfølger starter den på ankerdatoen. En stiplet kant med den røde teksten *utdatert* betyr at kilden ikke er lest. Med en manuell kobling er det alltid slik.
- Høyreklikk en kobling i kolonnen for å velge *Rediger kobling mellom prosjekter…* eller *Slett avhengighet*. Har koblingen en kildefil, står *Oppdater kilde* der også.
- Velg *Koble ▾ › Oppdater alle koblinger mellom prosjekter* for å lese kildefilene på nytt og oppdatere ankerne. Dette virker bare i skrivebordsappen. Har du bare manuelle koblinger, sier appen *Ingen oppdaterbare eksterne kilder (filbane mangler).* Trykk **Beregn** etter en oppdatering.
- Endrer du typen eller retningen, slik at ankeret må bruke den andre siden av den eksterne aktiviteten (start i stedet for slutt, eller omvendt), ber appen ved en manuell kobling om et nytt anker: *Velg et nytt anker. Avhengighetstypen bruker nå den andre siden av kildeaktiviteten*. Har koblingen en kildefil, leser appen ankeret på nytt selv.

## Fallgruver og hva appen gjør

**Det andre prosjektet flytter seg ikke med.** Endrer den eksterne aktiviteten dato, beregner tidsplanen din fortsatt med det gamle ankeret, til du oppdaterer det eller endrer ankerdatoen. Med den manuelle veien endrer du ankerdatoen selv: høyreklikk koblingen og velg *Rediger kobling mellom prosjekter…*.

**En ekstern forgjenger er en nedre grense.** Starter aktiviteten din senere enn ankeret krever, fordi den har egne forgjengere, da vinner den avhengigheten. Ankeret skyver bare.

**En ekstern etterfølger er en øvre grense.** Er ankeret for strammt, ser du det som negativ slakk på aktiviteten din og på aktivitetene før den. Det vises ingen egen advarsel. Hold derfor øye med kolonnen *Totalslakk*.

**Bare en fast forsinkelse.** For en kobling mellom prosjekter kan du ikke gi en forsinkelse i kalenderdager eller i prosent. Appen sier da *Koblinger mellom prosjekter støtter bare en fast forsinkelse i arbeidsdager eller arbeidstid.* Arbeidsdagene telles i kalenderen for din egen aktivitet. En forsinkelse i timer telles bare for en aktivitet som er planlagt i timer. For en aktivitet i dager ignorerer beregningen den. Bruk da arbeidsdager.

**Prosjekt-ID-en til en annen fil.** Prosjekt-ID-en står ikke i et felt eller en kolonne, men er lagret som `InternalProjectId` i IFC-filen til det prosjektet: åpne prosjektet, gå til fanen *IFC* og velg *Generer IFC*. Beregningen bruker bare ankerdatoen. ID-en er ikke bare en etikett. Ved oppdatering gjenkjenner appen først en kildefil på Prosjekt-ID-en, og deretter på filbanen. Skriver du ved en manuell kobling inn samme ID som for en kildefil, blir koblingen oppdatert samtidig når den filen oppdateres. Aktivitets-ID-en til en aktivitet i det andre prosjektet finner du i tabellen til det prosjektet, i kolonnen *Aktivitets-id* under *Teknisk*.

## Se også

- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hvordan appen beregner en avhengighet og en forsinkelse.
- [Legge til avhengigheter](docs://howto-relaties-leggen): avhengigheter mellom aktiviteter i samme prosjekt.
- [Begrensninger og tidsfrister](docs://uitleg-constraints): datogrenser for en aktivitet, uten et annet prosjekt.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): inneholder en kobling mellom prosjekter på *Car park paving* (en ekstern forgjenger).
