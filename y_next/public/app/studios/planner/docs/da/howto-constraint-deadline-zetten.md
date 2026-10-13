# Sæt en begrænsning eller deadline

Mål: registrer en datoaftale på en opgave, så tidsplanen tager den i betragtning, eller viser at du ikke overholder den.

## Hvornår har du brug for det

Murstenene leveres først den 21. juni, så murerarbejdet må ikke starte tidligere: en **begrænsning** *start ikke tidligere end*. Taget skal være tækket før byggehelligdagen, og du vil have en advarsel, hvis det ikke lykkes: en **deadline**. Støbningen ligger fast på en dag, fordi betonfabrikken har lovet det: *skal starte den*. Hvilken type der passer hvornår, og hvad appen gør med den, forklares i [Begrænsninger og deadlines](docs://uitleg-constraints).

## Trin

Du sætter en begrænsning og en deadline i panelet *Egenskaber*.

1. Vælg opgaven. Ser du ikke panelet *Egenskaber*, så slå det til med *Visning › Paneler › Egenskaber*.
2. I feltet *Begrænsning* vælger du typen, for eksempel *Start ikke tidligere end (SNET)*.
3. Med alle typer undtagen *Så tidligt som muligt (ASAP)* og *Så sent som muligt (ALAP)* vises feltet *Dato for begrænsning*. Skriv datoen i de tre felter for dag, måned og år, for eksempel 21, 06 og 2027, og tryk på Enter. Appen springer selv til næste felt, så snart et felt er fyldt. Efter at du har valgt typen, står der allerede en dato: datoen for den forrige begrænsning, ellers opgavens oprindeligt planlagte start. Den kan afvige fra den start, panelet viser. Skriv derfor altid selv den dato, du mener.
4. Vil du låse opgaven på datoen, også før dens foregående opgaver, så vælg *Skal starte den (MSO)* eller *Skal slutte den (MFO)* og sæt flueben i *Obligatorisk (pin-logik)*. Det er en hård pin. Brug den kun for en dato, der virkelig er fast.
5. Vil du have en ekstra grænse, for eksempel en opgave, der ikke må starte før 14. juni og skal være færdig senest 17. juni, så vælg en type under *Sekundær begrænsning* og udfyld *Sekundær dato*. Feltet vises ved alle begrænsninger med en dato, undtagen ved en hård pin. Ved MSO og MFO er en sekundær begrænsning ikke tilladt: appen markerer den så med rødt.
6. For en deadline udfylder du feltet *Deadline* på samme måde som datoen for begrænsningen. En deadline er uafhængig af begrænsningen: du kan sætte begge på samme opgave.
7. Tryk på **Beregn** (F5), for eksempel via *Start › Tidsplan › Beregn*. Indtil da viser statuslinjen *Forældet — genberegn (F5)*.

Felterne findes også i vinduet *Rediger opgave*, som du åbner ved at højreklikke på opgaven og vælge *Rediger...*; du bekræfter med *Gem*.

I tabellen arbejder du med kolonner. Klik på **+** i tabelhovedet, og vælg under *Begrænsninger* kolonnerne *Begrænsningstype*, *Dato for begrænsning* og *Deadline* (der findes også *Hård begrænsning*, *Sekundær begrænsningstype* og *Dato for sekundær begrænsning*). Dobbeltklik på en celle for at redigere den: du vælger typen fra en liste, og du skriver en dato med bindestreger, for eksempel 21-06-2027. *Hård begrænsning* kan kun ændres for MSO og MFO.

Har opgaven en foregående opgave, er der en genvej til *Start ikke tidligere end*: skriv bare en ny startdato i feltet *Start* (i panelet *Egenskaber*, i vinduet *Rediger opgave* eller i tabellen), eller flyt bjælken i Gantt-diagrammet. Appen laver så selv en begrænsning *Start ikke tidligere end (SNET)* og siger det til dig.

## Kontroller resultatet

- I Gantt-diagrammet står en lille diamant over bjælken, på startsiden ved en startbegrænsning og på slutsiden ved en slutbegrænsning: blå for SNET og FNET, violet for SNLT, FNLT, MSO og MFO, rød, hvis begrænsningen er overtrådt. En hård pin vises med et pin-symbol. En deadline vises med en pil nedad på deadline-datoen: grøn, så længe opgaven er færdig i tide, og rød, hvis den er forsinket.
- En overtrådt begrænsning eller overskredet deadline vises i panelet *Advarsler* (*Tidsplan › Tidsplan › Advarsler*) og i statuslinjen. Værdien for *Samlet slæk* for opgaven og de foregående opgaver er så negativ.
- Ved en øvre grænse (*Start ikke senere end*, *Afslut ikke senere end*) eller en deadline betyder det, at tidsplanen overholder datoen, når der ikke er nogen advarsel.

## Fjern en begrænsning eller deadline

I feltet *Begrænsning* vælger du igen *Så tidligt som muligt (ASAP)*. Det fjerner også den sekundære begrænsning. Du fjerner en deadline ved at tømme de tre felter og trykke på Enter. Tryk derefter på **Beregn**.

## Faldgruber, og hvad appen gør

**En begrænsning på en fase.** En begrænsning eller deadline på en fase (hovedopgave) har ingen effekt. Sæt den på selve opgaven.

**En opgave, der allerede er startet.** Har opgaven en faktisk startdato eller fremdrift, beholder den sin faktiske startdato. En *Start ikke tidligere end* med en senere dato flytter den ikke.

**En startdato skrevet ved siden af en anden begrænsning.** Har opgaven en foregående opgave og allerede en anden begrænsning, for eksempel *Så sent som muligt (ALAP)*, så bruger appen ikke den skrevne startdato. En meddelelse nævner begrænsningen. Ændr den, hvis du vil flytte starten.

**En dato i weekenden.** En dato på en lørdag, søndag eller fridag tæller som arbejdsdag: en nedre grænse (*Start ikke tidligere end*, *Afslut ikke tidligere end*) som den næste arbejdsdag, en øvre grænse (*Start ikke senere end*, *Afslut ikke senere end*) som den forrige arbejdsdag.

**En sekundær begrænsning, der ikke er tilladt.** Appen markerer en ugyldig kombination med rødt og angiver årsagen, for eksempel *Primær og sekundær må ikke begrænse samme side.* En sekundær begrænsning er ikke tilladt sammen med ASAP, ALAP, MSO, MFO og en hård pin.

**En hård pin.** Første gang du slår den til, advarer appen om, at en hård pin overskriver afhængighederne. Opgaven ligger så på datoen, også før dens foregående opgaver. Disse foregående opgaver får negativ slæk.

**Der sker intet efter indstillingen.** Begrænsninger virker først efter **Beregn**. Har en øvre grænse (*Start ikke senere end*, *Afslut ikke senere end*) ingen effekt på bjælkerne, er det normalt: en øvre grænse flytter intet; den gør slæk negativ, hvis datoen ikke overholdes.

## Se også

- [Begrænsninger og deadlines](docs://uitleg-constraints): hvad hver type gør, og forklaringen af hård pin, negativ slæk og deadline.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad negativ slæk gør ved den kritiske vej.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): de afhængigheder, som en begrænsning ligger ved siden af.
- [Meddelelser og advarsler](docs://ref-meldingen): advarslerne for en overtrådt begrænsning eller en overskredet deadline.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): en tilladelsesbegrænsning *Start ikke tidligere end* på *Demolish existing extension* (14. maj 2027) og en deadline, der overholdes med god margin.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): en bevidst stram deadline på *Contractual project handover* (15. juli 2027): efter beregning er slutdatoen 17. august, og mange opgaver har negativ slæk.
