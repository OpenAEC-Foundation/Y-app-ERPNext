# Resurssikirjasto

Muurariryhmäsi ei työskentele vain yhdessä projektissa. Tänään se on pohjoisen talojen parissa, huomenna eteläisten autotallien parissa. Resurssikirjasto on paikka, johon tällainen ryhmä kirjataan kerran, jotta jokainen projekti käyttää samaa ryhmää. Sovellus voi silloin myös nähdä, kun kaksi projektia pyytää samoja ihmisiä samana päivänä. Sitä ei näe yksikään yksittäinen projekti. Tässä artikkelissa kerrotaan, miten kirjasto ja projekti liittyvät toisiinsa ja miten sovellus laskee käyttöasteen projektien yli.

## Käsite

Siinä on kaksi tasoa.

Resurssikirjasto on luettelo organisaatiosi resursseista ja kalentereista: muurari, nosturi, rappari, kunkin tyyppi, normaalihinta ja lukumäärä. Itse luettelo, jota sovellus kutsuu myös kirjastoksi, ei ole projektitiedostoissa. Se on sovelluksessa: työpöytäsovelluksessa tiedostossa tällä tietokoneella, selaimessa kyseisen selaimen tallennustilassa. Jos sivuston tiedot selaimessa tyhjennetään, kirjasto häviää. Kirjasto kannattaa siksi viedä varmuuskopioksi. Kirjastoa on aina vähintään yksi. Ensimmäinen kirjasto on nimeltään *Mijn resourcebibliotheek* (hollanninkielinen nimi). Sen nimen voi vaihtaa.

Projekti päättää, kuinka paljon resurssia se käyttää ja milloin. Projekti on liitetty yhteen kirjastoon tai se on itsenäinen. Itsenäinen projekti toimii hyvin, vain ilman yhteistä luetteloa.

Projekti ei osoita kirjastoon. Siinä on kopio. Kun *Bricklayer* määritetään kirjastosta projektiin, sovellus tekee projektiin kopion, jolla on alkuperämerkintä. Merkintä kertoo, että kopio on peräisin kirjastosta X ja on siellä kohde Y. Resurssitaulukossa tällaisen kopion tunnistaa pienestä kirjastokuvakkeesta. Kopio on tavallinen resurssi: tehtäviä voi määrittää sille, ja se on tallennettu itse projektitiedostoon.

Kalenterit resurssikirjastossa ovat eri asia kuin projektisi kalenteriluettelo, jota hallitaan kalenteri-ikkunassa. Kirjaston kalenteri tulee projektiin resurssin mukana, joka sitä käyttää.

## Miten sovellus toimii sen kanssa

### Mitä kirjasto ja mitä projekti päättää

Kirjasto päättää, mikä resurssi on: nimen, tyypin, tuntikohtaisen normaalihinnan, yksikön ja kuvauksen. Projektikopiossa nämä kentät näkyvät tavallisena tekstinä. Ne muutetaan kirjastossa, jotta ne ovat oikein jokaisessa projektissa. Jos kopion halutaan lopulta kulkevan omaa tietään, se irrotetaan kirjastosta.

Projekti päättää, kuinka paljon ja milloin: *Enimmäismäärä*, kapasiteetti, joka muuttuu ajan mukaan (*Vaiheistettu kapasiteetti*), ja mikä kalenteri resurssilla on. Nämä kentät pysyvät muokattavina projektissa, eikä niitä pidetä poikkeamana kirjastosta. Sama ryhmä voi nimittäin käyttää kiireellisessä työssä eri kalenteria kuin tavallisessa projektissa. Resurssin mukana tulleen kalenterin sisältö seuraa kuitenkin kirjastoa.

### Milloin kopio seuraa mukana

Kirjasto ei päivitä kopioita jatkuvasti. Se tekee sen kiinteinä hetkinä:

- Kun kirjastosta muokataan jotakin, avoimien projektien muokkaamattomat kopiot seuraavat heti.
- Kun projekti avataan tai vaihdetaan toiseen välilehteen, sovellus vertaa kopioita kirjastoon. Jos muokkaamaton kopio on jäljessä, sovellus päivittää sen hiljaa ja kertoo siitä lyhyesti: *1 kohdetta päivitetty kirjastosta* tai *N kohdetta päivitetty kirjastosta*.

Sovellus muistaa arvot siltä hetkeltä, kun kopio tehtiin tai päivitettiin. Jos kopio poikkeaa nyt niistä, sovellus ei päätä, kumpi on oikein. Kopioon tulee silloin merkintä *eroaa — päätä*. Kun tällainen kopio sisältävä tiedosto avataan, *Linkitä kirjasto* -ikkuna avautuu itsestään. Siinä valitaan kohde kohteelta, pitäisikö kirjaston arvot ottaa käyttöön vai siirretäänkö tiedoston arvot kirjastoon. Välilehden vaihtuessa ikkuna ei koskaan avaudu.

Poikkeama syntyy esimerkiksi silloin, kun projektissa oleva oma resurssi linkitetään kirjastokohteeseen, jolla on sama nimi mutta eri arvot, komennolla *Siirrä kirjastoon*. Linkitys tehdään, ja sovellus merkitsee kopion heti poikkeavaksi.

### Kun resurssi poistuu kirjastosta

Kun resurssi poistetaan kirjastosta, kopio jää projekteihin ja toimii edelleen. Sille tulee merkintä *ei enää kirjastossa*. Sen jälkeen sen voi muokata täysin tai poistaa projektista.

### Käyttöaste useissa projekteissa

Histogrammi ja ylikuormitus projektissa katsovat vain tätä yhtä projektia. Kirjasto tietää enemmän: kuinka monta resurssia on yhteensä. *Käyttöaste*-näkymä laskee yhteen päivittäin kaikkien avoimien projektien kuorman, jotka on linkitetty samaan kirjastoon ja käyttävät tämän resurssin kopiota. Jos päivän summa on suurempi kuin kirjaston kapasiteetti, se päivä lasketaan ylikuormitetuksi.

Kolme sääntöä ratkaisee, mitä lasketaan:

- Kapasiteetti tulee kirjastosta: kirjastokohteen kentästä *Enimmäismäärä* tai sen *Vaiheistettu kapasiteetti* kyseisenä päivänä. Ei projektikopion kentästä *Enimmäismäärä*. Kaksi projektia, jotka kumpikin pysyvät omassa varauksessaan, voivat siis silti pyytää yhdessä liikaa.
- Täsmälleen yhtä suuri summa kuin kapasiteetti ei ole ristiriita. Ristiriidan syntymiseen tarvitaan enemmän kuin kapasiteetti.
- Lasketaan vain kopiot, joilla on alkuperämerkintä, ja vain projekteissa, jotka ovat tämän sovelluksen avoinna sillä hetkellä. Yhden projektin oma resurssi ei ole kirjastossa, joten se ei lasketa. Yleiskuva ei näe dokumentteja, joita ei ole avattu tässä sovelluksessa. Tämä mainitaan myös yleiskuvan alareunassa.

## Esimerkki: muurariryhmä kahdessa projektissa

Kirjastossa on resurssi *Bricklayer*. Sen kenttä *Enimmäismäärä* on 3: kolme muuraria palkkalistalla. Kaksi projektia käyttää sitä. Molemmilla on kopio, jonka kenttä *Enimmäismäärä* on 2.

- *Houses North* -projektissa on tehtävä *Bricklaying facades*. Sen kesto on 5 työpäivää, alkaen maanantaina 7. kesäkuuta 2027, ja se vaatii 2 kuormitusastetta päivässä. Tehtävä kestää 7.–11. kesäkuuta mukaan lukien.
- *Garages South* -projektissa on tehtävä *Bricklaying garages*. Sen kesto on 4 työpäivää, alkaen keskiviikkona 9. kesäkuuta 2027, ja se vaatii 2 kuormitusastetta päivässä. Viikonloppua ei lasketa, joten tehtävä kattaa 9., 10., 11. ja 14. kesäkuuta.

Kummassakin projektissa muuraria pyydetään 2 kuormitusastetta, eli kopion kaikki 2 kuormitusastetta. Kumpikaan projekti ei näytä ylikuormitusta: valikossa *Resurssit › Ylikuormitus* molemmissa lukee *Ei mitään*. Yhdessä ne ylittävät kuitenkin 3 muuraria. Päivittäin sovellus laskee:

- Maanantaina 7. ja tiistaina 8. kesäkuuta: 2 (vain *Houses North*)
- Keskiviikkona 9., torstaina 10. ja perjantaina 11. kesäkuuta: 2 + 2 = 4
- Maanantaina 14. kesäkuuta: 2 (vain *Garages South*)

Huippu on 4, kun kapasiteetti on 3. Yleiskuva näyttää muurarin kohdalla *2 dokumenttia*, aikajakson *2027-06-07 – 2027-06-14*, *4.0 / 3.0* huipulle ja kapasiteetille sekä *3 päivää ylikuormitettu*: 9., 10. ja 11. kesäkuuta.

Mitä jos jotain muutetaan:

- Jos *Bricklaying facades* kestää 6 työpäivää, se päättyy maanantaina 14. kesäkuuta. Silloin sekin päivä saavuttaa 2 + 2 = 4, joten yleiskuva näyttää *4 päivää ylikuormitettu*: 9., 10., 11. ja 14. kesäkuuta. Huippu pysyy 4:ssä.
- Jos kirjastossa *Enimmäismäärä* on 4, yleiskuva näyttää *4.0 / 4.0*. Ristiriitaa ei ole, koska summa ei ole suurempi kuin kapasiteetti.
- Jos *Garages South* työskentelee 1 kuormitusasteella päivässä 2:n sijaan, huippu on 3 ja yleiskuva näyttää *3.0 / 3.0*: ei ristiriitaa.
- Jos *Garages South* alkaa vasta maanantaina 14. kesäkuuta, projektit eivät mene päällekkäin. Aikajakso on *2027-06-07 – 2027-06-17* ja huippu on *2.0 / 3.0*.

Ohjeet tämän katsomiseen omissa projekteissa löytyvät kohdasta [Käyttöasteen yleiskuvan käyttäminen](docs://howto-bezettingsoverzicht-gebruiken).

## Seuraukset ja väärinkäsitykset

**"Kirjasto on jaettu kollegoiden kanssa."** Ei ole. Kirjasto on sovelluksessa (työpöytäsovelluksessa tiedostona tällä tietokoneella, selaimessa kyseisen selaimen tallennustilassa) eikä sitä synkronoida. Jos kaksi suunnittelijaa työskentelee samalla resurssikirjastolla, niiden kirjastot voivat erkaantua. Jakaa voi viemällä ja tuomalla, katso [Kirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren). Jos organisaatio jakaa ryhmiä toimintayhtiöiden välillä, valitaan tarkoituksella yksi yhteinen kirjasto. Yleiskuva näkee myös vain ne projektit, jotka ovat avoinna tässä sovelluksessa.

**"Jos muutan kirjastoa, kaikki projektini muuttuvat."** Vain resurssin tunnistetiedot muuttuvat: nimi, tyyppi, normaalihinta, yksikön nimi ja kuvaus. *Enimmäismäärä*, ajan mukainen kapasiteetti ja projektin kalenterivalinta pysyvät ennallaan.

**"Kirjaston muutoksen voi kumota."** Ei voi. Kirjasto kuuluu sovellukselle eikä projektille, joten sen muutokset jäävät toiminnon *Kumoa* (Ctrl+Z) ulkopuolelle. *Kirjasto*-näkymä varoittaa tästä itse: *Tämä muokkaa kirjastoa ja koskee kaikkia projekteja. Tätä ei voi kumota*. Poistaminen kirjastosta pyytää myös vahvistuksen, eikä sitä voi kumota.

**"Käyttöasteen yleiskuva ratkaisee päällekkäisen varauksen."** Ei. Yleiskuva on vain lukunäkymä. Se näyttää, mille päiville kaksi projektia yhdessä pyytää liikaa. Tasaaminen (*Resurssit › Tasaaminen › Tasaa…*, katso [Resurssien tasaaminen](docs://uitleg-nivelleren)) katsoo yhden projektin resursseja eikä ota huomioon muita projekteja. Tehtävä siirretään itse toisessa projektissa, tai kapasiteetti muutetaan kirjastossa, jos joku todella liittyy mukaan.

**"Oma resurssini lasketaan käyttöasteeseen."** Vain jos se on kirjastossa. Resurssi, joka on tehty vain projektissa, esimerkiksi yhteen työhön vuokrattu nosturi, ei ole alkuperämerkintää, joten se ei ole yleiskuvassa. Komennolla *Siirrä kirjastoon* se lisätään.

## Katso myös

- [Resurssikirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken): linkittäminen, resurssien määrittäminen ja poikkeamien ratkaiseminen.
- [Kirjastojen hallinta ja jakaminen](docs://howto-bibliotheken-beheren): kirjastojen luominen, vieminen ja tuominen.
- [Käyttöasteen yleiskuvan käyttäminen](docs://howto-bezettingsoverzicht-gebruiken): päällekkäisten varausten löytäminen projektien yli.
- [Resurssien hallinta](docs://howto-resources-beheren): yhden projektin resurssit.
