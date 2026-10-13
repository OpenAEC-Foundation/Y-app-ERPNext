# Opret en hængekøje

Mål: opret en opgave, der ikke kender sin egen varighed, men som løber fra startdatoen for én opgave til slutdatoen for en anden, fx etablering af byggeplads, tilsyn eller leje af en skurvogn.

## Hvornår du har brug for det

Site cabin står der så længe bygningen står på, fra det første jordarbejde til aflevering. Hvis du giver den opgave en fast varighed på 13 arbejdsdage, følger den ikke med, når murerarbejdet bliver forsinket, og tidsplanen er ikke længere rigtig. En **hængekøje** (også kaldet *indsatsniveau*) følger den opgave, du hænger den op på: dens startdato kommer fra en afhængighed for start, dens slutdato fra en afhængighed for slutning, og dens varighed er forskellen mellem de to.

## Trin

1. Opret opgaven, fx *Site cabin*, eller vælg en eksisterende opgave. En milepæl og en hovedopgave (fase) kan ikke være en hængekøje. I panelet *Egenskaber* og i *Rediger opgave* mangler afkrydsningsfeltet for en sådan opgave, og i tabellens kolonne kan det ikke ændres.
2. Sæt flueben i *Hængekøje (afledt varighed)* i panelet *Egenskaber*, i *Rediger opgave* (højreklik på opgaven, *Rediger...*) eller i kolonnen *Hængekøje (afledt varighed)* under *Tidsplan* i tabellen. Feltet *Varighed* kan så ikke redigeres længere.
3. Tilføj en afhængighed fra den opgave, hængekøjen starter med, til hængekøjen, af typen **SS** (hængekøjen starter sammen med den opgave) eller **FS** (hængekøjen starter efter den opgave). Det gør du ved at vælge hængekøjen, klikke på *Tilføj afhængighed* under *Afhængigheder*, lade retningen stå på *Foregående opgave*, vælge opgaven og vælge typen. Trinene står i [Tilføj afhængigheder](docs://howto-relaties-leggen).
4. Tilføj en afhængighed fra den opgave, hængekøjen slutter med, til hængekøjen, af typen **FF** (hængekøjen slutter sammen med den opgave) eller **SF**.
5. Kig i panelet *Egenskaber* under *Hængekøje (afledt varighed)*: der ser du *Startbestemmende afhængighed* med opgaven og typen, og *Slutbestemmende afhængighed* med opgaven og typen. En bestemmende opgave er den opgave, hængekøjen tager sin start eller slutning fra.
6. Tryk på **Beregn** (F5), fx via *Start › Tidsplan › Beregn*. Hængekøjen løber nu fra startdatoen for den opgave, der bestemmer starten, til slutdatoen for den opgave, der bestemmer slutningen. *Varighed* viser den afledte varighed.

I Gantt er en hængekøje en tynd blågrøn bjælke med en krog i begge ender.

Eksempel: *Site cabin* får SS fra *Groundwork* (mandag den 7. juni 2027) og FF fra *Roofing* (færdig onsdag den 23. juni). Efter **Beregn** løber hængekøjen fra mandag den 7. til onsdag den 23. juni: 13 arbejdsdage. Hvis murerarbejdet bliver forsinket med 2 arbejdsdage, bliver slutningen af *Roofing* fredag den 25. juni, og hængekøjen vokser med til 15 arbejdsdage.

## Hvad appen gør med en hængekøje

- Hængekøjen er aldrig kritisk, og den har ingen slæk. Den begrænser heller ikke de opgaver, den tager sin startdato og slutdato fra: de får ingen seneste dato på grund af hængekøjen.
- En forsinkelse tæller med. Med SS og forsinkelse `1d` starter hængekøjen én arbejdsdag efter den startbestemmende afhængighed. Med FF og forsinkelse `2d` slutter den to arbejdsdage efter den slutbestemmende afhængighed.

## Faldgruber, og hvad appen gør

**Ingen slutbestemmende afhængighed.** Hvis hængekøjen ikke har en FF- eller SF-afhængighed, kan appen ikke udlede dens slutning. Panelet *Egenskaber* siger *Ingen slutbestemmende afhængighed (FF/SF) — spændet falder tilbage til nul længde.* og panelet *Advarsler* siger *Hængekøje uden slutbestemmende afhængighed (ingen FF/SF-foregående opgave). Varigheden sættes til nul*. Hængekøjen starter og slutter så på samme dag. Tilføj en FF- eller SF-afhængighed.

**En hængekøje, der slutter efter den sidste opgave.** Hvis hængekøjen fortsætter til efter den sidste opgave, fx med FF og en forsinkelse på 2 arbejdsdage, flytter projektets slutdato med. De opgaver, du faktisk udfører, får så slæk, og ingen af dem er kritisk længere.

**Opgaver, der venter på en hængekøje.** Hvis du tilføjer en afhængighed fra hængekøjen til en anden opgave, starter den opgave først efter hængekøjens slutning. Hele kæden før hængekøjen, inklusive de opgaver, hængekøjen tager sin start og slutning fra, får så slæk og er ikke længere kritisk, fordi hængekøjen ikke sender noget pres tilbage. Lad derfor ikke opgaver vente på en hængekøje. Hæng i stedet sådanne opgaver på slutningen af hængekøjens bestemmende opgave.

**Indtastning af en varighed.** Feltet *Varighed* på en hængekøje er afledt og kan ikke redigeres. En varighed, du indtastede før du satte fluebenet, tæller ikke længere.

## Se også

- [Tilføj afhængigheder](docs://howto-relaties-leggen): trinene til at tilføje en afhængighed af typen SS eller FF.
- [Afhængigheder og forsinkelse](docs://uitleg-relaties): hvad SS og FF betyder, og hvordan forsinkelsen tæller.
- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvad kritisk betyder, og hvordan slæk fungerer.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): indeholder hængekøjen *Structural works tower A (LOE)*.
