# Laskentaprofiilit ja laskentasäännöt

Sama aikataulu voi antaa eri päivämäärät sen mukaan, mitkä laskentasäännöt ovat käytössä. Tämä artikkeli selittää, miksi Primavera P6 ja Microsoft Project laskevat eri tavalla joissakin kohdissa. Se kertoo myös, miten sovellus tallentaa tämän eron **laskentaprofiiliin**, ja miten profiili eroaa laskentavaihtoehdoista, jotka määritetään itse projektikohtaisesti. Pieni verkko esimerkkinä näyttää, mitä tämä tekee päivämäärille.

## Käsite

Tehtävät, riippuvuudet ja kalenteri määrittävät suurimman osan aikataulusta, mutta eivät kaikkea. Mitä tapahtuu työlle, jota ei ole vielä aloitettu, kun raportointipäivä asetetaan? Mistä alkaa jo käynnissä olevan tehtävän jäljellä oleva työ? Mikä on tehtävän vapaa pelivara, kun tavoitepäivä ylittyy? Verkko ei kerro siitä mitään. Aikataulusovelluksen on valittava sääntö. Sovellus tuntee useita kohtia, joissa Primavera P6 -sääntö ja Microsoft Project -sääntö eroavat.

Sovellus kutsuu tällaista valintaa **laskentasäännöksi**. **Laskentaprofiili** on yhden ohjelmiston laskentasääntöjen joukko. Sovelluksessa on kolme profiilia:

- *Open Planner Studio*: profiili, jolla uusi projekti lasketaan. Mitään laskentasääntöä ei ole päällä.
- *Primavera P6*: laskentasäännöt, jotka sovellus tuntee P6:sta.
- *Microsoft Project*: laskentasäännöt, jotka sovellus tuntee Microsoft Project -ohjelmasta.

Profiili kertoo siis, miten ohjelmisto laskee. Se ei kerro, mitä projektilta halutaan. Sitä varten ovat **laskentavaihtoehdot**: valinnat, kuten kuinka vähän pelivaraa tekee tehtävästä kriittisen, tai missä kalenterissa viive lasketaan. Nämä asetetaan projektikohtaisesti.

## Miten sovellus laskee

### Laskentasäännöt ja laskentavaihtoehdot

Laskentasääntö on kytkin: päällä tai pois. Profiili päättää, mitkä kytkimet ovat päällä. Laskentavaihtoehto on valinta, joka tehdään itse. Eron näkee sovelluksessa, lohkossa *Laskentaprofiili ja laskentavaihtoehdot*:

- **Laskentasäännöt** ovat kohdassa *Tämän profiilin laskentasäännöt*, ryhmiteltyinä aiheen mukaan, esimerkiksi *Edistyminen ja suoritettu työ*, *Riippuvuudet ja viive* ja *Pelivara ja myöhäiset päivämäärät*. Jokainen rivi on valintaruutu, ja sen perässä on profiilin arvo: *perusarvo: päällä* tai *perusarvo: pois*. Jos valinta poikkeaa siitä, rivi erottuu ja *Palauta perusarvoon* tulee näkyviin. Nuoli rivin edessä avaa laskentasäännön selityksen. Se kannattaa lukea ensin, jos laskentasääntöä aiotaan muuttaa.
- **Laskentavaihtoehdot** ovat kohdassa *Tämän projektin laskentavaihtoehdot*: muun muassa *Kriittisyyden määritelmä*, *Pelivaran laskenta*, *Avoimet tehtävät ovat kriittisiä*, *Merkitse lähes kriittiset* ja *Viiveen kalenteri*. Ne kertovat, mitä projektilta halutaan, eivät sitä, miten ohjelmisto laskee. Niiden toiminta on selitetty artikkeleissa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad) ja [Riippuvuudet ja viive](docs://uitleg-relaties).

Esimerkki kummastakin. "Tehtävä on kriittinen, jos sen kokonaispelivara on 0 tai vähemmän" on laskentavaihtoehto: kynnysarvoksi voi asettaa 4, jolloin kaikki, joilla on 4 työpäivää pelivaraa tai vähemmän, ovat kriittisiä. "Työ, jota ei ole aloitettu, siirtyy raportointipäivään" on laskentasääntö: Open Planner Studio ja Primavera P6 tekevät niin, Microsoft Project ei.

Profiili ja laskentavaihtoehdot kuuluvat projektitiedostoon, eivät sovellukseen. Kun projekti tallennetaan, ne siirtyvät sen mukana. Kaksi projektia samassa sovelluksessa voi siis laskea eri profiileilla. Projekti ilman profiilia lasketaan kuin Open Planner Studio.

Jos on laskentavaihtoehtoja, jotka vain Primavera P6 tuntee, lohkon alaosassa näkyy myös *Lähdetiedoston asetukset*. Näin on projektissa, joka on avattu .xer-tiedostosta, mutta myös silloin, kun *Primavera P6* valitaan kohdassa *Uusi projekti* tai Primavera P6:n oletusvaihtoehdot otetaan käyttöön. Näitä asetuksia ei voi muuttaa tässä.

### Missä profiili valitaan

Uudelle projektille profiili on ikkunassa *Uusi projekti*, joka avataan kohdasta *Aloitus › Tiedosto › Uusi*. Siellä *Laskentaprofiili* on pudotusvalikko. Kun profiili valitaan siinä, sovellus korvaa jo täytetyt laskentavaihtoehdot profiilin oletusarvoilla. Vain lähdetiedoston asetukset jäävät. Profiilin *Primavera P6* kohdalla *Pelivaran laskenta* on silloin *Loppupelivara*. Profiileilla *Microsoft Project* ja *Open Planner Studio* kaikki laskentavaihtoehdot ovat oletusarvollaan, joten *Pelivaran laskenta* on *Automaattinen (oletus)*. Raportointipäivän kanssa Microsoft Project laskee myös itse samalla tavalla: aloitettu tehtävä saa loppupelivaran, ja muut tehtävät saavat alku- ja loppupelivaran pienemmän.

Olemassa olevalle projektille profiili valitaan kohdassa *Asetukset › Projekti › Projektitiedot*, lohkossa *Laskentaprofiili ja laskentavaihtoehdot*, pudotusvalikossa *Laskentaprofiili*. Saman paikan voi avata myös kohdasta *Tiedosto › Projektitiedot*. Profiilin vaihto tässä muuttaa vain laskentasääntöjä. Laskentavaihtoehdot pysyvät ennallaan. Jos myös uuden profiilin oletusvaihtoehdot halutaan, valitse *Käytä tämän profiilin oletusasetuksia*.

Ennen kuin painetaan *Käytä*, muutos on vain lomakkeessa. Kun *Käytä* on painettu, aikataulu lasketaan uudelleen heti, vaikka *Laske automaattisesti* ei ole päällä. Jos tehtäviä siirtyi, sovellus kertoo määrän, esimerkiksi *Soveltamisen jälkeen 4 tehtävää siirtyi.* Koko vaihto on yksi vaihe. *Kumoa* palauttaa sen kerralla.

Jos yksi laskentasääntö kytketään profiilissa päälle tai pois, sovellus tekee siitä oman profiilin. Se saa nimen *Kopio: Open Planner Studio*, tai *Kopio:* sen profiilin nimi, josta lähdettiin. Nimen voi vaihtaa. Painikkeella *Tallenna malliksi* profiilin voi säilyttää, jotta sitä voi käyttää muissa projekteissa tässä sovelluksessa. Projektissa on aina oma kopio. Jos mallia muutetaan myöhemmin, projekti ei muutu sen mukana.

### Milloin sovellus valitsee profiilin itse

Kun tiedosto avataan, sovellus ehdottaa profiilia tiedostomuodon mukaan:

- Tiedosto .mpp (Microsoft Project) avautuu profiililla *Microsoft Project*.
- Tiedosto .xer (Primavera P6) avautuu profiililla *Primavera P6*.
- Tiedostomuodot *MS Project XML*, *Primavera P6 XML* ja *CSV (puolipisteillä erotettu)* avautuvat profiililla *Open Planner Studio*, ilman profiiliviestiä.
- Oma projekti (.ifc) avautuu sen sisällä tallennetulla profiililla.

Tiedostolle .mpp tai .xer sovellus kertoo profiilin: *Tämä projekti lasketaan tavalla Microsoft Project. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Painike *Avaa laskentaprofiili* viestissä vie suoraan Projektitiedot-ikkunaan. Tiedostolle .xer tämä rivi on avausviestin ensimmäinen tietorivi. Lisää viestistä kerrotaan artikkeleissa [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen) ja [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen).

Tiedostolle .mpp sovellus vain asettaa profiilin. Laskentavaihtoehdot jäävät tyhjiksi, kuten uudessa projektissa profiililla *Microsoft Project*: *Pelivaran laskenta* on *Automaattinen (oletus)*. Avattu .mpp-tiedosto ja uusi projekti profiililla *Microsoft Project* laskevat siis pelivaran samalla tavalla.

## Esimerkki: yksi verkko, kolme profiilia

Esimerkki on pieni verkko. Kalenterissa on työviikko maanantaista perjantaihin, eikä näinä viikkoina ole vapaapäiviä. Edistymistapa on Retained Logic (oletus). Projektin aloituspäivä on maanantaina 7. kesäkuuta 2027. Kaikki tehtävät ovat työpäivissä.

- *Pour foundation*: 5 työpäivää, suunniteltu alkamaan maanantaina 7. kesäkuuta.
- *Lay walls*: 5 työpäivää, edeltäjänä *Pour foundation* (lopusta alkuun).
- *Order window frames*: 3 työpäivää, ilman edeltäjää, suunniteltu alkamaan maanantaina 7. kesäkuuta.
- *Fit roof*: 2 työpäivää, edeltäjinä *Lay walls* ja *Order window frames*. Tämän tehtävän loppu on luovutus.

Luvut on laskenut sovelluksen laskentamoottori. Ne näkyvät paneelissa *Ominaisuudet*, kohdassa *CPM-tulos*.

**Ilman raportointipäivää ja edistymistä kaikki kolme profiilia laskevat tämän verkon samalla tavalla.** *Pour foundation* kulkee maanantaista 7. kesäkuuta perjantaihin 11. kesäkuuta, *Lay walls* maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta ja *Fit roof* maanantaina 21. ja tiistaina 22. kesäkuuta. Luovutus on tiistaina 22. kesäkuuta. *Order window frames* (maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta) on 7 työpäivää kokonaispelivaraa.

Nyt kirjataan tila. Raportointipäivä on keskiviikko 9. kesäkuuta. *Pour foundation* alkoi maanantaina 7. kesäkuuta, ja sen valmiusaste on 60 %. Jäljellä oleva työ on siis 2 työpäivää (5 × 40 %). *Order window frames* ei ole alkanut. Miten [edistyminen ja raportointipäivä](docs://uitleg-voortgang) toimivat, on kerrottu siinä artikkelissa. Tässä kysytään, mitä profiili tekee tilan kanssa.

### Open Planner Studio

Tehtävän *Pour foundation* jäljellä oleva työ alkaa raportointipäivästä: keskiviikkona 9. ja torstaina 10. kesäkuuta. Varhaisin alkamispäivä on sama kuin toteutunut alkamispäivä, maanantai 7. kesäkuuta. Varhaisin valmistumispäivä on torstai 10. kesäkuuta. *Lay walls* kulkee perjantaista 11. kesäkuuta torstaihin 17. kesäkuuta ja *Fit roof* perjantaina 18. ja maanantaina 21. kesäkuuta.

*Order window frames* oli suunniteltu alkamaan maanantaina 7. kesäkuuta, mutta sitä ei ole aloitettu. Työ, jota ei ole aloitettu, ei voi jäädä menneisyyteen. Sovellus siirtää sen siksi raportointipäivään: keskiviikosta 9. kesäkuuta perjantaihin 11. kesäkuuta. Sillä on 4 työpäivää kokonaispelivaraa. Luovutus on maanantaina 21. kesäkuuta.

### Primavera P6

Kaikki on sama kuin Open Planner Studio -ohjelmassa, paitsi yksi kohta: varhaisin alkamispäivä tehtävälle *Pour foundation* on keskiviikko 9. kesäkuuta. Se on jäljellä olevan työn alku, ei toteutunut alkamispäivä. Tämän aiheuttaa laskentasääntö *Käynnissä oleva tehtävä: varhainen alkamispäivä = jäljellä olevan työn alku* ryhmässä *Edistyminen ja suoritettu työ*. Loppu ja pelivara eivät muutu sen takia. Luovutus on maanantaina 21. kesäkuuta.

### Microsoft Project

Tässä päivämäärät eroavat. Kaksi laskentasääntöä ryhmässä *Edistyminen Microsoft Project -tavalla* aiheuttaa sen.

*Aloittamattomia tehtäviä ei siirretä raportointipäivään*: *Order window frames* pysyy maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta, vaikka osa ajasta on ennen raportointipäivää. Kokonaispelivara on 7 työpäivää.

*Jäljellä oleva työ jatkuu kuluneen ajan jälkeen*: jäljellä oleva työ alkaa aikaisintaan raportointipäivästä, ja aikaisintaan toteutuneesta alkamispäivästä lisättynä jo kuluneella ajalla. 60 %:sta 5 työpäivästä on tehty 3 työpäivää. Maanantai 7. kesäkuuta lisättynä 3 työpäivällä on torstai 10. kesäkuuta. Se on raportointipäivän jälkeen, joten jäljellä oleva työ kulkee torstaina 10. ja perjantaina 11. kesäkuuta. *Lay walls* kulkee maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta ja *Fit roof* maanantaina 21. ja tiistaina 22. kesäkuuta. Luovutus on tiistaina 22. kesäkuuta: yksi työpäivä myöhemmin kuin kahdessa muussa profiilissa.

### Entä jos

**Pour foundation on 20 %:n valmiusasteella eikä 60 %:n.** Jäljellä oleva työ on silloin 4 työpäivää. Kaikissa kolmessa profiilissa *Pour foundation* valmistuu maanantaina 14. kesäkuuta ja luovutus on keskiviikkona 23. kesäkuuta. Microsoft Project -profiilin sääntö jäljellä olevasta työstä ei tee tässä eroa: maanantai 7. kesäkuuta lisättynä 1 kuluneella työpäivällä on tiistai 8. kesäkuuta, ja se on ennen raportointipäivää. Tällainen sääntö on alaraja. Se voi vain siirtää jäljellä olevaa työtä myöhemmäksi. *Order window frames* ja varhaisin alkamispäivä Primavera P6:ssa eroavat silti, kuten edellä. Microsoft Project -ohjelmassa *Order window frames* saa silloin 8 työpäivää kokonaispelivaraa.

**Vain raportointipäivä asetetaan, eikä edistymistä kirjata.** Open Planner Studio -ohjelmassa ja Primavera P6:ssa koko verkko siirtyy keskiviikkoon 9. kesäkuuta. *Pour foundation* kulkee silloin keskiviikosta 9. kesäkuuta tiistaihin 15. kesäkuuta, ja luovutus on torstaina 24. kesäkuuta: kaksi työpäivää myöhemmin kuin ilman raportointipäivää. Microsoft Project -ohjelmassa kaikki pysyy paikallaan, ja luovutus on tiistaina 22. kesäkuuta.

**Profiili kootaan itse.** Jos Open Planner Studio -ohjelmassa kytketään päälle vain *Aloittamattomia tehtäviä ei siirretä raportointipäivään*, siitä tulee oma profiili *Kopio: Open Planner Studio*. Kun edistyminen on 60 %, *Pour foundation* säilyttää Open Planner Studio -ohjelman päivämäärät (loppu torstaina 10. kesäkuuta ja luovutus maanantaina 21. kesäkuuta). *Order window frames* pysyy kuitenkin maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta, ja sillä on 6 työpäivää kokonaispelivaraa. Profiili on siis kokoelma erillisiä kytkimiä, joita voi muuttaa yksi kerrallaan.

**Laskentavaihtoehto laskentasäännön sijaan.** Jos Open Planner Studio -ohjelmassa asetetaan kohdassa *Kriittisyyden määritelmä* arvo *Kokonaispelivara ≤ kynnysarvo* ja *Kynnysarvo (työpäivinä)* arvoksi 4, *Order window frames* on kriittinen, koska sen kokonaispelivara on täsmälleen 4. Päivämäärät eivät muutu. Laskentavaihtoehto on projektikohtainen valinta, ja se on riippumaton profiilista.

**Tavoitepäivä ylittyy.** Anna tehtävälle *Fit roof* tavoitepäivä perjantaina 18. kesäkuuta. Open Planner Studio -ohjelmassa tehtävän *Fit roof* kokonaispelivara on silloin −1 työpäivää, ja vapaa pelivara on myös −1. Primavera P6:ssa kokonaispelivara pysyy −1:ssä, mutta vapaa pelivara on 0. Sen tekee laskentasääntö *Vapaa pelivara ei koskaan negatiivinen*, ryhmässä *Pelivara ja myöhäiset päivämäärät*. Microsoft Project -ohjelmassa molemmat ovat −2, koska luovutus on siellä päivää myöhemmin. Miten tavoitepäivä toimii, kerrotaan artikkelissa [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints).

## Seuraukset ja väärinkäsitykset

**"Profiili on sovelluksen asetus."** Ei. Profiili ja laskentavaihtoehdot kuuluvat projektiin ja kulkevat tiedoston mukana. Sovellukseen kuuluvat vain säilytetyt mallit. Projektilla on aina oma kopio niistä.

**"Jos projekti viedään, profiili menee mukana."** Vain omalla projektimuodolla (.ifc) profiili menee mukana. Jos projekti viedään muotoon *MS Project XML*, *Primavera P6 XML* tai *CSV (puolipisteillä erotettu)*, profiilia ei ole tiedostossa. Laskentavaihtoehdoista MS Project XML -vienti kirjoittaa enintään kriittisen kynnysarvon. Sovellus varoittaa tästä vain projektista, joka tuotiin .xer-tiedostosta. Itse luodusta projektista ei näytetä viestiä. Tiedosto avautuu sitten Open Planner Studio -projektina, ilman profiiliviestiä. Esimerkkinä on profiili Microsoft Project ja 60 %:n edistyminen. Jos se viedään muotoon *MS Project XML* ja avataan uudelleen, sovellus näyttää ensin tiedoston päivämäärät, ja luovutus on tiistaina 22. kesäkuuta. Jos sovellus laskee uudelleen itse, luovutus siirtyy maanantaille 21. kesäkuuta. Mitä muuta vienti menettää, on kuvattu kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

**"Primavera P6 -profiili antaa saman tuloksen kuin P6."** Sovellus ei voi taata sitä. Profiili ottaa käyttöön P6:sta tunnetut laskentasäännöt. Ne eivät kuitenkaan ole kaikki P6:n asetukset. Retained Logicin ja Progress Overriden lisäksi P6:ssa on kolmas edistymistapa, Actual Dates. Sovellus ei tunne sitä. Tällainen .xer-tiedosto lasketaan Retained Logicina, ja avaamisen viesti kertoo siitä, esimerkiksi *1 P6-aikataulutusasetus käytti turvallista varavaihtoehtoa.* Osa Primavera P6 -profiilin laskentasäännöistä toimii myös vain tehtävissä, jotka tulevat .xer-tiedostosta, esimerkiksi *Aloittamaton LOE käyttää tavoiteikkunaa* ja *Todellisten päivämäärien täsmällinen säilytys*. Joidenkin kohdalla selitys kertoo tämän, esimerkiksi: "vain tehtävät, joilla on P6-alkuperä". Itse luoduissa tehtävissä nämä laskentasäännöt eivät tee mitään.

**"Edistymistapa kuuluu profiiliin."** Ei. Retained Logic tai Progress Override on projektikohtainen valinta, joka tehdään erikseen profiilista. Katso [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen). Yksi Primavera P6 -laskentasääntö, *Progress Override ohittaa aloitetun seuraajan myös takaperoin*, vaikuttaa vain, kun valintana on Progress Override.

**"Vaihdan profiilia vain nähdäkseni, mitä tapahtuu."** Se onnistuu, sillä *Käytä* kumotaan yhdellä askeleella: *Kumoa* palauttaa profiilin ja päivämäärät yhdessä. Päivämäärät voivat kuitenkin todella siirtyä. Esimerkissä profiilin vaihto Open Planner Studio -profiilista Microsoft Project -profiiliin siirtää kaikki 4 tehtävää. Viesti kertoo tehtävien määrän. Aikataulu kannattaa tarkistaa vaihdon jälkeen, ennen jatkamista. Jos sovellus näyttää vielä tiedoston päivämäärät .xer- tai .mpp-tiedoston avaamisen jälkeen, profiilin vaihto poistaa tämän näkymän ja sovellus laskee itse. Miten tämä toimii, on kuvattu kohdassa [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).

**Esimerkissä on neljä laskentasääntöä, ja sovelluksen luettelo on pidempi.** Lohkon jokaisella rivillä on oma selitys. Se kannattaa lukea ensin. Myös ryhmä *Vain omat profiilit* kannattaa katsoa: nämä laskentasäännöt ovat pois päältä kaikissa sisäänrakennetuissa profiileissa, myös Primavera P6:ssa. Jos yksi niistä otetaan käyttöön, siitä tulee oma profiili.

## Katso myös

- [Edistyminen, raportointipäivä ja perustaso](docs://uitleg-voortgang): mitä raportointipäivä ja jäljellä oleva työ tekevät, ja profiilikohtaiset erot.
- [Edistymistavan valitseminen](docs://howto-voortgangsmodus-kiezen): valinta Retained Logic tai Progress Override.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): laskentavaihtoehdot kriittiselle polulle ja pelivaralle.
- [Riippuvuudet ja viive](docs://uitleg-relaties): laskentavaihtoehto *Viiveen kalenteri*.
- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä vienti kuljettaa mukanaan ja mitä ei.
- [Vieminen](docs://howto-exporteren): projektin vieminen.
- [Edistymisen päivittäminen](docs://howto-voortgang-bijwerken): prosentin, toteutuneen alkamispäivän ja raportointipäivän syöttäminen.
- [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen): miksi tuodut päivämäärät voivat erota siitä, mitä sovellus itse laskee.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): kaikki laskentasäännöt ja laskentavaihtoehdot yhdessä luettelossa.
