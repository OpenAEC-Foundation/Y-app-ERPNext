# Ulkoiset riippuvuudet toiseen projektiin

Tavoite: tämän projektin tehtävä linkitään toisen projektitiedoston tehtävään, jotta aikataulu ottaa huomioon muualla suunniteltu työ.

## Milloin tarvitset tätä

Lisärakennuksen työ voi alkaa vasta, kun tontti on valmisteltu rakentamista varten, ja se työ kuuluu urakoitsijan projektiin. Tai asentaja voi aloittaa vasta, kun oma rakenne on saatu loppuun, ja hän suunnittelee työnsä omassa tiedostossaan. Tavallinen riippuvuus toimii vain saman projektin tehtävien välillä. Ulkoisella riippuvuudella tehtävä linkitään toisen tiedoston tehtävään.

Ulkoinen riippuvuus ei laske reaaliajassa toisen projektin kanssa. Sovellus tallentaa kiinteän **ankkuripäivämäärän**: ulkoisen tehtävän päivämäärän sillä hetkellä, kun se linkitään. Laskenta käyttää tätä päivämäärää rajana. Jos toinen projekti muuttuu, omassa aikataulussa ei siirry mikään, ennen kuin ankkuri päivitetään.

## Vaiheet

1. Valitse tässä projektissa täsmälleen yksi tehtävä: tehtävä, joka riippuu ulkoisesta tehtävästä, tai tehtävä, josta ulkoinen tehtävä riippuu.
2. Valitse *Aloitus › Tehtävät › Linkitä ▾ › Lisää ulkoinen riippuvuus…*. Sama valikko on kohdissa *Aikataulu › Riippuvuudet* ja *Taulukko › Tehtävät*. Kohta on käytettävissä vain, jos täsmälleen yksi tehtävä on valittu.
3. *Ulkoinen riippuvuus (projektien välillä)* -ikkunassa valitse yksi kahdesta tavasta. Tavassa *Lähdetiedosto* projektitiedosto valitaan kohdasta *Valitse viimeaikainen tiedosto* ja sen jälkeen tehtävä kohdasta *Lähdetehtävä*. Sovellus lukee tiedoston vain luku -tilassa, ei avaa sitä asiakirjana, ja ottaa ankkuripäivämäärän itse. Tämä tapa toimii vain työpöytäsovelluksessa ja vain tiedostolle, joka on luettelossa viimeaikaisista tiedostoista. Muuten painike *Lähdetiedosto* on pois käytöstä. Tavassa *Manuaalinen (vararatkaisu)* täytetään kentät *Projektitunnus* ja *Tehtävätunnus* ulkoiselle tehtävälle, halutessa *Tehtävän nimi (valinnainen)* ja *Ankkuripäivämäärä*. Selainversiossa tämä on ainoa tapa.
4. Valitse kohdassa *Suunta*, onko ulkoinen tehtävä edeltäjä vai seuraaja: *Edeltäjä (ulkoinen → tämä tehtävä)* tai *Seuraaja (tämä tehtävä → ulkoinen)*.
5. Valitse *Riippuvuustyyppi* (FS, SS, FF tai SF) ja täytä tarvittaessa kenttä *Viive (työpäivinä)*, esimerkiksi `0d` tai `2d`.
6. Valitse *Lisää riippuvuus* ja paina **Laske** (F5).

Mikä päivämäärä syötetään ankkuriksi manuaalisessa riippuvuudessa, riippuu suunnasta ja tyypistä:

- Kun ulkoinen tehtävä on **edeltäjä**, tyypin ensimmäinen kirjain ratkaisee: F tarkoittaa ulkoisen tehtävän loppupäivää, S alkupäivää. Tyypeillä FS ja FF syötetään siis loppupäivä, tyypeillä SS ja SF alkupäivä.
- Kun ulkoinen tehtävä on **seuraaja**, tyypin toinen kirjain ratkaisee: S tarkoittaa ulkoisen tehtävän alkupäivää, F loppupäivää. Tyypeillä FS ja SS syötetään siis alkupäivä, tyypeillä FF ja SF loppupäivä.

Jos suunnitellaan tunneittain (tuntisuunnittelu päällä ja tehtävä kalenterissa, jossa on työaikoja), kenttä *Ankkuripäivämäärä* kysyy myös kellonajan.

Esimerkki: työmaaprojekti päättyy perjantaina 18. kesäkuuta 2027. Tehtävä *Groundwork* linkitään ulkoiseksi edeltäjäksi tyypillä FS, ankkuripäivämäärä 18. kesäkuuta 2027. Kun **Laske** on tehty, *Groundwork* alkaa maanantaina 21. kesäkuuta, ankkuria seuraavana ensimmäisenä työpäivänä. Ulkoinen seuraaja toimii toisin päin: se rajoittaa, kuinka myöhään oma tehtävä saa päättyä.

## Mitä näet ja miten hallitset sitä

- Ulkoiset riippuvuudet näkyvät tekstinä tehtävätaulukon sarakkeissa *Edeltäjät* ja *Seuraajat*. Ne lisätään **+**-painikkeella tehtävätaulukon otsikossa kohdasta *Riippuvuudet*. Teksti kertoo projektin nimen, tehtävän ja tyypin. Pieni kolmio tekstillä *Lähde puuttuu* kertoo, ettei lähdettä ole luettu. Kun hiiri viedään riippuvuuden päälle, näkyvät projekti (rivillä *Projektitunnus* näkyy projektin nimi, kun se tunnetaan), tehtävätunnus, ankkuripäivämäärä ja lähteen tila.
- Gantt-kaaviossa tehtävän kohdalla on harmaa haamupalkki. Kun ulkoinen tehtävä on edeltäjä, haamupalkki päättyy ankkuriin. Seuraajan kohdalla se alkaa ankkurista. Katkoviivareunus ja punainen teksti *vanhentunut* tarkoittavat, ettei lähdettä ole luettu. Manuaalisessa riippuvuudessa näin on aina.
- Napsauta riippuvuutta sarakkeessa hiiren oikealla painikkeella. Valikossa ovat *Muokkaa ulkoista riippuvuutta…* ja *Poista riippuvuus*. Jos riippuvuudella on lähdetiedosto, valikossa on myös *Päivitä lähde*.
- Valitse *Linkitä ▾ › Päivitä kaikki ulkoiset riippuvuudet*, jolloin lähdetiedostot luetaan uudelleen ja ankkurit päivitetään. Tämä toimii vain työpöytäsovelluksessa. Jos riippuvuudet ovat vain manuaalisia, sovellus näyttää viestin *Ei päivitettäviä ulkoisia lähteitä (tiedostopolku puuttuu).* Paina **Laske** päivityksen jälkeen.
- Jos tyyppiä tai suuntaa muutetaan niin, että ankkuri tarvitsee ulkoisen tehtävän toisen puolen (alku loppupäivän sijaan tai päinvastoin), sovellus pyytää manuaaliselle riippuvuudelle uuden ankkurin viestillä *Valitse uusi ankkuri. Riippuvuustyyppi käyttää nyt lähdetehtävän toista puolta.* Riippuvuudella, jolla on lähdetiedosto, sovellus lukee ankkurin uudelleen itse.

## Sudenkuopat ja mitä sovellus tekee

**Toinen projekti ei siirry mukana.** Jos ulkoisen tehtävän päivämäärä muuttuu, aikataulu laskee edelleen vanhalla ankkurilla, kunnes ankkuri päivitetään tai sitä muutetaan. Manuaalisella tavalla ankkuripäivämäärä muutetaan itse napsauttamalla riippuvuutta hiiren oikealla painikkeella ja valitsemalla *Muokkaa ulkoista riippuvuutta…*.

**Ulkoinen edeltäjä on alaraja.** Jos tehtävä alkaa myöhemmin kuin ankkuri vaatii, koska sillä on omia edeltäjiä, voittaa tehtävän oma riippuvuus. Ankkuri vain työntää.

**Ulkoinen seuraaja on yläraja.** Jos ankkuri on liian tiukka, se näkyy oman tehtävän ja sitä edeltävien tehtävien kohdalla negatiivisena pelivarana. Siihen ei liity erillistä varoitusta, joten kannattaa seurata saraketta *Kokonaispelivara*.

**Vain kiinteä viive.** Ulkoiselle riippuvuudelle ei voi antaa viivettä kalenteripäivinä tai prosentteina. Sovellus näyttää viestin *Ulkoiset riippuvuudet tukevat vain kiinteää viivettä työpäivinä tai työaikana.* Työpäivät lasketaan oman tehtävän kalenterin mukaan. Viive tunteina vaikuttaa vain tehtävään, joka on suunniteltu tunneittain. Päivissä suunniteltavassa tehtävässä laskenta jättää sen huomiotta. Käytä siis työpäiviä.

**Toisen tiedoston projektitunnus.** Projektitunnusta ei ole kentässä eikä sarakkeessa. Se tallennetaan sen projektin IFC-tiedostoon nimellä `InternalProjectId`. Avaa projekti, siirry välilehdelle *IFC* ja valitse *Luo IFC*. Laskenta käyttää vain ankkuripäivämäärää, eikä tunnus ole pelkkä nimi. Päivityksessä sovellus tunnistaa lähdetiedoston ensin projektitunnuksen perusteella ja sitten tiedostopolun perusteella. Jos manuaaliseen riippuvuuteen syötetään sama tunnus kuin lähdetiedostolla, riippuvuus päivittyy samalla, kun tuo tiedosto päivitetään. Toisen projektin tehtävän *Tehtävän tunnus* löytyy sen projektin tehtävätaulukosta: sarakkeesta *Tehtävän tunnus* kohdassa *Tekninen*.

## Katso myös

- [Riippuvuudet ja viive](docs://uitleg-relaties): miten sovellus laskee riippuvuuden ja viiveen.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): riippuvuudet saman projektin tehtävien välillä.
- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): päivämäärärajat tehtävälle ilman toista projektia.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sisältää ulkoisen riippuvuuden tehtävässä *Car park paving* (ulkoinen edeltäjä).
