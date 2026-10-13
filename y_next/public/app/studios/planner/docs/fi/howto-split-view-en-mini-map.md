# Jaetun näkymän ja pienoiskartan käyttäminen

Tavoite: aikajanan kaksi osaa näkyvät rinnakkain, ja pitkän aikataulun läpi liikutaan nopeasti.

## Milloin tarvitset tätä

Keskustellaan perustusten alusta ja samalla luovutuksesta yhdeksän kuukautta myöhemmin. Ilman apua zoomataan jatkuvasti sisään ja ulos, ja kohta, jossa oltiin, unohtuu. Kun **jaettu näkymä** on käytössä, sama aikataulu näkyy kahdesti rinnakkain. Kummallakin on oma aikaikkuna. Kun **pienoiskartta** on käytössä, koko projektin ajanjakso näkyy yhdessä kapeassa nauhassa. Haluttuun kohtaan hypätään napsauttamalla.

## Vaiheet

### Jaetun näkymän käyttöönotto

1. Valitse *Näkymä*-välilehti. Ryhmässä *Esitys* ovat *Esitys*, *Jaettu näkymä* ja *Pienoiskartta*.
2. Napsauta *Jaettu näkymä*. Gantt-kaavio jakautuu kahtia. Molemmat ikkunat alkavat nykyisen näkymän zoomauksella ja sijainnilla.

Kaksi ikkunaa jakavat tehtävätaulukon, rivit ja pystysuuntaisen vierityksen. Kummallakin ikkunalla on oma aikaskaala: zoomaus ja vaakasuuntainen sijainti.

### Kummallekin ikkunalle oma aikaväli

- Zoomaus ja vieritys tehdään siinä ikkunassa, jonka päällä hiiri on. Kun *Vieritys ja zoomaus* on oletusarvossa (*Zoomaus + vetäminen*), hiiren rulla zoomaa siinä ikkunassa, keskittyen hiiren kohtaan. Jos asetus noudattaa toista tilaa, rulla toimii molemmissa ikkunoissa sen tilan mukaan.
- Oletusarvossa rivejä selataan Shift-näppäimellä ja hiiren rullalla. Tämä koskee molempia ikkunoita yhtä aikaa.
- Painikkeet *Lähennä +* ja *Loitonna -* sekä aikaskaalan luettelo (esimerkiksi *Neljännes*) toimivat vain vasemmassa ikkunassa. Oikean ikkunan zoomaus tehdään siis hiiren rullalla.
- Erotinta kahden ikkunan välissä vedetään vasemmalle tai oikealle. Näin ikkunat tulevat leveämmiksi tai kapeammiksi. Aluksi kumpikin on puolet.

### Jaetun näkymän poistaminen käytöstä

Napsauta *Jaettu näkymä* uudelleen. Jäljelle jää yksi ikkuna, jossa on vasemman ikkunan näkymä. Uusi jaettu näkymä alkaa taas sen hetkisellä näkymällä.

### Pienoiskartan käyttöönotto

1. Napsauta ryhmässä *Esitys* kohtaa *Pienoiskartta*.
2. Aikajanan alle ilmestyy nauha koko projektin ajanjaksosta. Nykyisen näkymän tehtävät näkyvät ohuina viivoina, joten suodatinta käytettäessä näkyvät vain suodattimen tehtävät. Kehys ympäröi tällä hetkellä näkyvän osan.
3. Napsauta nauhan mitä tahansa kohtaa, jolloin kehys siirtyy sinne ja ikkuna keskittyy siihen. Tai tartu kehykseen ja vedä sitä.

Pienoiskartta siirtää vain aikaikkunaa. Rivit pysyvät ennallaan.

Kun jaettu näkymä on käytössä, kummallakin ikkunalla on oma nauha, oman aikajanan osan alla. Kukin nauha ohjaa vain sen yläpuolella olevaa ikkunaa.

## Ongelmatilanteet ja mitä sovellus tekee

**Pienoiskartta ei tee mitään, jos koko projekti on jo näkyvissä.** Jos loitonnetaan niin paljon, että koko aikataulu mahtuu näkyviin, ei ole mitään, mihin siirtyä, eikä napsauttamisella ole vaikutusta. Lähennä ensin.

**Pienoiskartta on vain Gantt-kaaviossa.** Välilehdillä *Taulukko*, *IFC* ja *Raportti* sekä koko resurssipaneelissa (*Resurssit*, ei *Resurssitelakka*) ei ole aikajanaa. Siksi niissä ei ole pienoiskarttaa eikä jaettua näkymää. Ne palaavat heti, kun palataan Gantt-kaavion näkymään.

**Jaettu näkymä kuuluu projektiin, pienoiskartta ei.** Jaettu näkymä koskee avattua projektia: kun vaihdetaan toiseen projektiin ja takaisin, se on yhä käytössä. Pienoiskartta on yksi valinta kaikille projekteille ja pysyy päällä tai pois päältä myös uudelleenkäynnistyksen jälkeen. Molemmat ovat näytön valintoja. Ne eivät mene projektitiedostoon, eivät merkitse projektia ”muokatuksi” eivätkä kuulu *Kumoa*-toiminnon piiriin.

**Jaettu näkymä ja esitystila.** Molemmat pysyvät käytössä, kun esitystila otetaan käyttöön (katso [Esittäminen suurella näytöllä](docs://howto-presentatie)). Koska valintanauha on silloin piilossa, niitä ei voi enää ottaa käyttöön eikä poistaa käytöstä tässä tilassa. Ennen aloittamista ne kannattaa asettaa kunnolla.

## Katso myös

- [Esittäminen suurella näytöllä](docs://howto-presentatie): Gantt-kaavio koko näytössä ilman valintanauhaa.
- [Asettelun luominen ja käyttäminen](docs://howto-layouts-gebruiken): aikaskaala voidaan tallentaa myös osana asettelua.
