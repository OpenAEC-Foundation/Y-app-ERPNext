# Työsäännön valitseminen

Tavoite: aseta jokaiselle tehtävälle, mitä sovellus säätää, kun muutetaan kestoa, kuormitusastetta tai työtä: kestoa, kuormitusastetta tai työtä itseään.

## Milloin tätä tarvitaan

Resursseja on kohdistettu tehtävälle, ja sovelluksen pitää laskea haluttulla tavalla. Esimerkki: nosturi on vuokrattu yhdeksi päiväksi, ja se päivä on kiinteä. Toinen esimerkki: tiedetään, että siinä on 160 tuntia tiilityötä, ja halutaan nähdä, kuinka kauan se kestää kolmella henkilöllä kahden sijaan. Nämä kaksi tilannetta vaativat eri työsäännön.

Sääntö päättää, mikä kolmesta suureesta kesto, kuormitusaste ja työ siirtyy mukaan, kun muutetaan jotakin muuta. Taustatiedot ja laskuesimerkit ovat kohdassa [Työsäännöt: kesto, kuormitusaste ja työ](docs://uitleg-werkregels).

## Vaiheet

### Työsäännön näyttäminen

Työsääntö ei näy oletuksena. Kytke se kerran päälle:

1. Valitse *Asetukset › Projekti › Asetukset*, välilehti *Aikataulu*.
2. Otsikon *Laskenta* alla rastita *Näytä työsäännöt ja työ*.
3. Sulje ikkuna painikkeella *Sulje*.

Tämä on sovelluksen asetus, ei projektitiedoston asetus. Jos tiedostossa on jo työsääntöjä tai tallennettua työtä, esimerkiksi MS Project- tai Primavera P6 -tiedosto, sovellus näyttää työsäännön kyseiselle tiedostolle ilman tätä asetustakin. Sama pätee, kun työsääntö valitaan itse tiedostossa: näyttö pysyy silloin päällä kyseiselle tiedostolle, vaikka asetus kytkettäisiin myöhemmin pois. Näyttö pysyy päällä niin kauan kuin tiedosto on auki, ja tiedoston avaamisen jälkeen niin kauan kuin tiedostossa on työsääntö tai tallennettua työtä.

### Säännön valitseminen

1. Valitse tehtävä. Paneeli *Ominaisuudet* on oikealla. Jos sitä ei näy, kytke se päälle kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Valitse kohdasta *Työsääntö* yksi viidestä vaihtoehdosta: *Projektin oletus (Kiinteä kesto ja kuormitusaste)*, *Kiinteä kesto ja kuormitusaste*, *Kiinteä kesto ja työmäärä*, *Kiinteä työmäärä* tai *Kiinteä yksikkömäärä*. Vaihtoehdolla *Projektin oletus* tehtävä seuraa projektin oletusta.
3. Pudotusvalikon alla sovellus näyttää, mitä sääntö suojaa, esimerkiksi *Suojattu: työ (kesto seuraa kuormitusastetta)*.

*Projektin oletus* on ensimmäinen vaihtoehto ja tehtävän oletusarvo. Sulkeissa oleva sääntö on se, joka projektilla on nyt oletuksena. Sovelluksessa ei ole painiketta tämän projektin oletuksen vaihtamiseen: oletus tulee tuonnista (esimerkiksi MS Project- tai Primavera P6 -tiedostosta) tai MCP-yhteydestä. Jos yhdelle tehtävälle halutaan toinen sääntö, valitse se tästä.

Säännön voi valita myös taulukosta. Napsauta **+** tehtävätaulukon otsikkorivin oikealla puolella (*Lisää sarake*) ja valitse kohdasta *Aikataulu* sarake *Työsääntö*.

Tehtävässä ilman resurssikohdistusta ei ole mitään, mitä sitoa yhteen, joten sääntö ei tee siinä mitään. Kohdista ensin resurssi (katso [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen)).

### Työn näkeminen ja muuttaminen

Tehtävälle, jolla on resurssikohdistuksia, näkyy paneelin *Ominaisuudet* osiossa *Resurssikohdistukset* sarake *Työ (jäljellä)*, *Kuorm./päivä*-sarakkeen vieressä. Se on kyseisen resurssin jäljellä oleva työ tunteina. Pieni lukko sarakkeen yläpuolella näyttää, mitä sääntö pitää kiinteänä: *Kuorm./päivä*, kun sääntö on *Kiinteä kesto ja kuormitusaste* tai *Kiinteä yksikkömäärä*, ja *Työ (jäljellä)*, kun sääntö on *Kiinteä kesto ja työmäärä* tai *Kiinteä työmäärä*.

Jos työtä halutaan muuttaa käsin, tunnit kirjoitetaan kenttään ja painetaan Enter. Sovellus ei hyväksy arvoa, joka on 0 tai pienempi: kenttä palautuu edelliseen arvoon.

### Mitä tapahtuu

Kun sääntö valitaan, mikään luku ei vielä muutu. Kun sääntö suojaa työtä, sovellus kiinnittää vain nykyisen työn, joten *Työ (jäljellä)* saa tallennetun arvon. Vasta seuraavassa muutoksessa sääntö päättää, mikä siirtyy mukana. Muuta esimerkiksi *Kuorm./päivä* ja katso, mitä tapahtuu keston ja työn kanssa.

Jos tämä muuttaa tehtävän kestoa, tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*, ja näet uudet päivämäärät. Jos *Laske automaattisesti* on päällä (sama välilehti *Aikataulu*, otsikko *Laskenta*), sovellus tekee tämän itse.

## Mikä sääntö sopii

- **Kiinteä kesto ja kuormitusaste** sopii, kun kesto on sovittu ja kuormitusaste on syöte. Työ seuraa näistä kahdesta. Tämä on oletus. Yhdeksi päiväksi vuokrattu nosturi kuuluu tähän: päivä on kiinteä, ja nosturien määrän päättää käyttäjä.
- **Kiinteä kesto ja työmäärä** sopii, kun tehtävä on saatava valmiiksi kiinteässä ajassa ja tunnetaan, kuinka paljon työtä siinä on. Jos kesto muuttuu, sovellus säätää kuormitusastetta.
- **Kiinteä työmäärä** sopii, kun tunnetaan, kuinka monta tuntia työtä siinä on, ja halutaan nähdä, miten kesto muuttuu henkilömäärän mukaan. Tähän kuuluu 160 tunnin tiilityö kolmella henkilöllä kahden sijaan. Harjoitusprojektin rappaus saa tämän säännön.
- **Kiinteä yksikkömäärä** sopii, kun kuormitusaste on kiinteä, esimerkiksi yksi nosturi, ja työ päättää keston.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Kenttä *Työsääntö* puuttuu.** Silloin asetus *Näytä työsäännöt ja työ* on pois päältä ja tiedostossa ei vielä ole työsääntöjä, tai on valittu välitavoite, vaihe, riippumatto tai tehtävä, jonka kestotyyppi on *kulunut aika*. Siinä ei ole työsääntöä. Valitse tavallinen tehtävä.

**Kesto muuttuu, vaikka sitä ei muutettu.** Kohdissa *Kiinteä työmäärä* ja *Kiinteä yksikkömäärä* kesto seuraa kuormitusastetta ja työtä. Jos jotakin näistä tai resurssien määrää muutetaan, sovellus säätää keston ja pyöristää sen ylöspäin kokonaisiin työpäiviin. Tehtävälle, jonka kesto on tunteina, sovellus pyöristää ylöspäin kokonaisiin minuutteihin.

**Työ ei täsmää tarkasti kuormitusasteen × keston kanssa.** Pyöristys voi aiheuttaa sen. Sarakkeen *Työ (jäljellä)* viereen ilmestyy silloin varoitusmerkki *Poikkeaa kuormitusasteesta × kestosta*. Histogrammi seuraa tallennettua työtä.

**Materiaali ei lasketa mukaan.** Materiaaliresurssille *Työ (jäljellä)* näyttää viivan. Materiaali ei koskaan vaikuta kestoon.

**Tehtävä, jolla on edistymistä.** Sääntö koskee jäljellä olevaa työtä. Siksi *Työ (jäljellä)* näyttää vain sen, mikä vielä on tehtävä.

**Kumoaminen.** Säännön valinta ja jokainen muutos, jonka sääntö laskee, kumoutuvat yhdellä kerralla komennolla *Kumoa* (Ctrl+Z). Sääntö on silloin taas poissa, mutta kenttä *Työsääntö* pysyy näkyvissä.

## Katso myös

- [Työsäännöt: kesto, kuormitusaste ja työ](docs://uitleg-werkregels): miten sovellus sitoo keston, kuormitusasteen ja työn yhteen, laskuesimerkkeineen.
- [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen): resurssin asettaminen tehtävälle.
