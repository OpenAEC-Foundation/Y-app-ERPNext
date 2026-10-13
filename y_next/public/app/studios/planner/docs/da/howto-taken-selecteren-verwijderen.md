# Markere, slette og fortryde opgaver

Mål: vælg opgaver, fjern dem og fortryd en fejl.

## Når du har brug for dette

Næsten alle handlinger i tidsplanen gælder for de opgaver, du har markeret: at slette, kopiere, indrykke eller slå en milepæl til eller fra. Du fjerner opgaver, når arbejdet falder væk, eller når tidsplanen ændres. Og fordi appen ikke spørger om bekræftelse ved sletning, er *Fortryd* dit sikkerhedsnet.

## Trin

### Markere opgaver

- **Én opgave.** Klik på rækken i opgavetabellen eller på bjælken i Gantt-diagrammet.
- **Flere opgaver.** Ctrl+klik (⌘+klik på en Mac) føjer en opgave til markeringen eller fjerner den. I opgavetabellen markerer Shift+klik alle opgaver fra den aktive opgave til den, du klikkede på.
- **Alle synlige opgaver.** Ctrl+A, når fokus er i opgavetabellen eller i Gantt-diagrammet. Opgaver, som et filter skjuler, falder uden for markeringen, og det samme gælder underopgaver i en sammenfoldet fase.
- **Et markeringsfelt i Gantt-diagrammet.** Hold Ctrl nede, og træk over den tomme baggrund: alle opgaver i de rækker, som markeringsfeltet rører, markeres, også selv om deres bjælke ligger ved siden af feltet. Kun højden på markeringsfeltet tæller, ikke tidsaksen. Slipper du Ctrl først efter museknappen, lægges opgaverne til den eksisterende markering; ellers erstatter de den. Uden Ctrl ruller træk i tidslinjen som standard.
- **Ingen.** Esc, eller et klik på den tomme baggrund i Gantt-diagrammet.

Markerer du en hovedopgave, markeres dens underopgaver ikke automatisk. Ved sletning og kopiering tages de dog med.

### Slette opgaver

Markér opgaverne, og vælg en af disse veje:

- *Start › Redigér › Slet*. Den samme knap står på fanen *Tabel*.
- Delete eller Backspace, hvis fokus ikke er i opgavetabellen. Klik derfor først på en bjælke i Gantt-diagrammet.
- *Slet* i højreklikmenuen. Er den opgave, du klikkede på, en del af markeringen, gælder det hele markeringen. Ellers gælder det kun den ene opgave.
- Den lille papirkurv øverst i panelet *Egenskaber* (værktøjstip *Slet opgave*). Den sletter den opgave, som panelet viser.

Appen spørger ikke om bekræftelse. Sletter du flere opgaver på én gang, er det ét trin for *Fortryd*.

Dette forsvinder sammen med dem: alle underopgaver af en slettet hovedopgave, alle afhængigheder fra og til de slettede opgaver, og deres tildelinger. Sletter du den sidste underopgave i en hovedopgave, bliver den stående som en almindelig opgave. Er *WBS auto* slået til, nummererer appen træet om. Tidsplanen er derefter ikke længere opdateret: tryk på **Beregn** (F5), medmindre *Beregn automatisk* er slået til.

### Fold sammen og fold ud

En hovedopgave har en trekant foran navnet i opgavetabellen. Klik på trekanten for at skjule eller vise dens underopgaver. Med *Visning › Disposition › Fold sammen* og *Fold ud* gør du det for de markerede hovedopgaver, eller for alle, hvis ingen er markeret. Højreklikmenuen for en hovedopgave har også *Fold sammen* og *Fold ud*. I en gruppevisning gælder knapperne for grupperne.

Appen husker sammenfoldning og udfoldning for hvert åbent dokument. Det er ikke en del af *Fortryd*, og det står ikke i projektfilen.

### Fortryd og gentag

- *Start › Redigér › Fortryd* og *Gentag* (også på fanen *Tabel*), pilene i titellinjen, eller Ctrl+Z for at fortryde og Ctrl+Y eller Ctrl+Shift+Z for at gentage.
- Gør du noget nyt efter *Fortryd*, er *Gentag* væk.

*Fortryd* dækker ændringer i dine projektdata (opgaver, afhængigheder, ressourcer, kalendere og lignende) og anvendelse af et layout. Ændringer i kolonnerne i opgavetabellen er også trin: tilføjelse, fjernelse, flytning, ændring af størrelse, automatisk tilpasning, fastgørelse og nulstilling af kolonnelayoutet til standard. Disse kolonnetrin hører til opgavetabellen selv og gælder for hele appen, ikke for ét dokument. Appen gemmer de sidste hundrede trin pr. dokument, og færre ved et meget stort projekt.

## Faldgruber og hvad appen gør

**Delete i opgavetabellen sletter ikke en opgave.** Er fokus i opgavetabellen, tømmer Delete (eller Backspace) indholdet af de markerede celler. Ved en påkrævet eller beregnet celle, for eksempel navnet eller varigheden, afviser appen det og viser en besked under opgavetabellen. For navnet ser du for eksempel *Denne værdi er påkrævet og kan ikke være tom*. Så tømmes intet, heller ikke i de andre markerede celler. Klik på en bjælke i Gantt-diagrammet, eller brug *Slet* (på fanen *Tabel*, hvor der ikke er noget Gantt-diagram: *Tabel › Redigér › Slet* eller højreklikmenuen).

**En hel fase forsvinder på én gang.** Sletter du en hovedopgave, går dens underopgaver, afhængigheder og tildelinger med. *Fortryd* (Ctrl+Z) bringer alt tilbage, også afhængighederne og tildelingerne.

**Det, der ikke kommer tilbage.** Markeringen, sammenfoldning og udfoldning samt knappen *Ryd* i linjen *Ikke tilgængelig under filtrering/gruppering/sortering* hører ikke til *Fortryd*. Trykker du på Ctrl+Z efter *Ryd*, fortryder du derfor dit forrige trin, ikke selve rydningen.

**Fjerner du en opgave, som andre opgaver afhænger af.** Afhængighederne til og fra den opgave forsvinder også. Opgaver, som kun var knyttet til den, bliver frie og starter igen på deres egen planlagte start efter **Beregn**. Tilføj nye afhængigheder, hvis det er nødvendigt; se [Tilføje afhængigheder](docs://howto-relaties-leggen).

## Se også

- [Tilføje opgaver og milepæle](docs://howto-taken-en-mijlpalen-toevoegen): det omvendte, og kopiering af opgaver.
- [Justere strukturen](docs://howto-structuur-aanpassen): hæng en opgave under en anden fase i stedet for at fjerne den.
- [Trække, panorere og zoome i Gantt-diagrammet](docs://howto-gantt-bedienen): markeringsfeltet og rulletilstandene.
- [Højreklikmenuer](docs://ref-contextmenus): hvad *Slet* og de andre punkter gør med en markering.
