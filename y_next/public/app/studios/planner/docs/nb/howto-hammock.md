# Opprette en hengekøye

Mål: opprett en aktivitet som selv ikke bestemmer sin varighet, men som går fra starten av én aktivitet til slutten av en annen, for eksempel etablering av byggeplassen, tilsyn eller leie av en brakke.

## Når du trenger dette

Site cabin står der så lenge bygget pågår, fra det første grunnarbeidet til overleveringen. Hvis du gir den aktiviteten en fast varighet på 13 arbeidsdager, følger den ikke med når murarbeidet blir forsinket, og tidsplanen stemmer ikke lenger. En **hengekøye** (også kalt *level of effort*) følger aktiviteten den henger på: starten hentes fra en avhengighet av typen SS eller FS, slutten fra en avhengighet av typen FF eller SF, og varigheten er forskjellen mellom de to.

## Stegene

1. Opprett aktiviteten, for eksempel *Site cabin*, eller velg en eksisterende aktivitet. En milepæl og en hovedaktivitet (fase) kan ikke være en hengekøye. I panelet *Egenskaper* og i *Rediger aktivitet* mangler avkrysningsboksen for en slik aktivitet, og i kolonnen kan den ikke endres.
2. Kryss av for *Hengekøye (avledet varighet)* i panelet *Egenskaper*, i *Rediger aktivitet* (høyreklikk på aktiviteten, *Rediger...*) eller i kolonnen *Hengekøye (avledet varighet)* under *Tidsplan*. Feltet *Varighet* kan da ikke lenger redigeres.
3. Legg til en avhengighet fra aktiviteten hengekøyen starter med, til hengekøyen, av typen **SS** (hengekøyen starter samtidig med den aktiviteten) eller **FS** (hengekøyen starter etter den aktiviteten). Gjør slik: Velg hengekøyen, klikk på *Legg til avhengighet* under *Avhengigheter*, la retningen stå på *Forgjenger*, velg aktiviteten og velg typen. Stegene står i [Legge til avhengigheter](docs://howto-relaties-leggen).
4. Legg til en avhengighet fra aktiviteten hengekøyen slutter med, til hengekøyen, av typen **FF** (hengekøyen slutter samtidig med den aktiviteten) eller **SF**.
5. Se i panelet *Egenskaper* under *Hengekøye (avledet varighet)*: der ser du *Startstyrende avhengighet* med aktiviteten og typen, og *Sluttstyrende avhengighet* med aktiviteten og typen. En startstyrende eller sluttstyrende avhengighet er avhengigheten som hengekøyen henter starten eller slutten fra.
6. Trykk **Beregn** (F5), for eksempel via *Hjem › Tidsplan › Beregn*. Hengekøyen går nå fra starten av den startstyrende avhengigheten til slutten av den sluttstyrende avhengigheten, og *Varighet* viser den avledede varigheten.

I Gantt-diagrammet vises en hengekøye som en tynn blågrønn stolpe med en krok i begge ender.

Eksempel: *Site cabin* får SS fra *Groundwork* (mandag 7. juni 2027) og FF fra *Roofing* (ferdig onsdag 23. juni). Etter **Beregn** går hengekøyen fra mandag 7. til onsdag 23. juni: 13 arbeidsdager. Hvis murarbeidet blir 2 arbeidsdager forsinket, blir slutten av *Roofing* fredag 25. juni, og hengekøyen vokser med til 15 arbeidsdager.

## Hva appen gjør med en hengekøye

- Hengekøyen er aldri kritisk, og den har ingen slakk. Den begrenser heller ikke aktivitetene den henter start og slutt fra: de får ingen seneste dato på grunn av hengekøyen.
- En forsinkelse teller med. Med SS og forsinkelse `1d` starter hengekøyen én arbeidsdag etter den startstyrende avhengigheten. Med FF og forsinkelse `2d` slutter den to arbeidsdager etter den sluttstyrende avhengigheten.

## Fallgruver og hva appen gjør

**Ingen sluttstyrende avhengighet.** Hvis hengekøyen ikke har en FF- eller SF-avhengighet, kan appen ikke fastsette slutten. I panelet *Egenskaper* står det: *Ingen sluttstyrende avhengighet (FF/SF). Spennet blir da null i lengde*. I panelet *Advarsler* står det: *Hengekøye uten sluttstyrende avhengighet (ingen FF/SF-forgjenger): varigheten settes til null*. Hengekøyen starter og slutter da på samme dag. Legg til en FF- eller SF-avhengighet.

**En hengekøye som slutter etter den siste aktiviteten.** Hvis hengekøyen løper til etter den siste aktiviteten, for eksempel med FF og en forsinkelse på 2 arbeidsdager, da flytter prosjektets slutt seg med. De aktivitetene du faktisk utfører, får da slakk; ingen av dem er lenger kritisk.

**Aktiviteter som venter på en hengekøye.** Hvis du legger til en avhengighet fra hengekøyen til en annen aktivitet, starter den aktiviteten først etter slutten av hengekøyen. Hele kjeden før hengekøyen, inkludert aktivitetene hengekøyen henter start og slutt fra, får da slakk og er ikke lenger kritisk, fordi hengekøyen ikke gir noe press tilbake. La derfor ikke aktiviteter vente på en hengekøye. Knytt heller slike aktiviteter til den sluttstyrende avhengigheten til hengekøyen.

**Å oppgi en varighet.** Feltet *Varighet* til en hengekøye er avledet og kan ikke redigeres. En varighet du oppga før du krysset av i avkrysningsboksen, telles ikke lenger.

## Se også

- [Legge til avhengigheter](docs://howto-relaties-leggen): stegene for å legge til en avhengighet av typen SS eller FF.
- [Avhengigheter og forsinkelse](docs://uitleg-relaties): hva SS og FF betyr, og hvordan forsinkelsen telles.
- [Kritisk linje og slakk](docs://uitleg-kritiek-pad): hva kritisk betyr, og hvordan slakk fungerer.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): inneholder hengekøyen *Structural works tower A (LOE)*.
