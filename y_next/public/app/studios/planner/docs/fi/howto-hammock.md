# Riippumaton luominen

Tavoite: luo tehtävä, joka ei tunne omaa kestoaan, mutta kulkee yhden tehtävän alusta toisen tehtävän loppuun, esimerkiksi työmaan pystytys, valvonta tai työmaakonttorin vuokraus.

## Milloin tätä tarvitaan

Site cabin on paikallaan niin kauan kuin rakennus etenee, ensimmäisistä maanrakennustöistä luovutukseen asti. Jos tehtävälle annetaan kiinteä kesto 13 työpäivää, se ei seuraa mukana, kun muurustyöt viivästyvät, ja aikataulu ei ole enää ajan tasalla. **Riippumatto** (kutsutaan myös nimellä *level of effort*) seuraa työtä, johon se on kiinnitetty: sen alku tulee yhden riippuvuuden kautta, sen loppu toisen riippuvuuden kautta, ja sen kesto on näiden kahden erotus.

## Vaiheet

1. Luo tehtävä, esimerkiksi *Site cabin*, tai valitse olemassa oleva tehtävä. Välitavoite ja yhteenvetotehtävä (vaihe) eivät voi olla riippumatto. Tällaisesta tehtävästä puuttuu *Ominaisuudet*-paneelissa ja *Muokkaa tehtävää* -ikkunassa valintaruutu, eikä taulukon sarakkeessa sitä voi muuttaa.
2. Valitse *Riippumatto (johdettu kesto)* -valintaruutu *Ominaisuudet*-paneelissa, *Muokkaa tehtävää* -ikkunassa (napsauta tehtävää hiiren oikealla painikkeella ja valitse *Muokkaa...*) tai taulukon sarakkeessa *Riippumatto (johdettu kesto)* kohdassa *Aikataulu*. Tämän jälkeen *Kesto*-kenttää ei voi enää muokata.
3. Lisää riippuvuus riippumattoon tehtävästä, josta riippumatto alkaa. Tyyppi on **SS** (riippumatto alkaa yhdessä sen tehtävän kanssa) tai **FS** (riippumatto alkaa sen tehtävän jälkeen). Valitse riippumatto, napsauta *Riippuvuudet*-kohdassa *Lisää riippuvuus*, jätä suunnaksi *Edeltäjä*, valitse tehtävä ja valitse tyyppi. Vaiheet ovat ohjeessa [Riippuvuuksien lisääminen](docs://howto-relaties-leggen).
4. Lisää riippuvuus riippumattoon tehtävästä, jonka kanssa riippumatto päättyy. Tyyppi on **FF** (riippumatto päättyy yhdessä sen tehtävän kanssa) tai **SF**.
5. Tarkista *Ominaisuudet*-paneelin kohta *Riippumatto (johdettu kesto)*. Siinä näkyvät *Alkua ohjaava riippuvuus* tehtävän ja tyypin kanssa sekä *Loppua ohjaava riippuvuus* tehtävän ja tyypin kanssa. Ohjaava tehtävä on tehtävä, josta riippumatto saa alkunsa tai loppunsa.
6. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*. Riippumatto kulkee nyt alkua ohjaavan tehtävän alusta loppua ohjaavan tehtävän loppuun, ja *Kesto* näyttää johdetun keston.

Gantt-kaaviossa riippumatto on ohut turkoosi palkki, jonka molemmissa päissä on koukku.

Esimerkki: *Site cabin* saa SS-riippuvuuden tehtävästä *Groundwork* (maanantai 7. kesäkuuta 2027) ja FF-riippuvuuden tehtävästä *Roofing* (päättyy keskiviikkona 23. kesäkuuta). Kun **Laske** on suoritettu, riippumatto kulkee maanantaista 7. kesäkuuta keskiviikkoon 23. kesäkuuta: 13 työpäivää. Jos muurustyöt viivästyvät 2 työpäivää, tehtävän *Roofing* loppu siirtyy perjantaihin 25. kesäkuuta ja riippumatto venyy 15 työpäivään.

## Miten sovellus käsittelee riippumattoa

- Riippumatto ei ole koskaan kriittinen eikä sillä ole pelivaraa. Se ei myöskään rajoita tehtäviä, joista se saa alkunsa ja loppunsa: riippumatto ei aiheuta niille myöhäisiä päivämääriä.
- Viive vaikuttaa. Kun SS-riippuvuuden viive on `1d`, riippumatto alkaa yhden työpäivän päästä alkua ohjaavasta tehtävästä. Kun FF-riippuvuuden viive on `2d`, riippumatto päättyy kahden työpäivän päästä loppua ohjaavasta tehtävästä.

## Sudenkuopat ja mitä sovellus tekee

**Ei loppua ohjaavaa riippuvuutta.** Jos riippumatolla ei ole FF- eikä SF-riippuvuutta, sovellus ei voi johtaa sen loppua. *Ominaisuudet*-paneelissa lukee *Ei loppua ohjaavaa riippuvuutta (FF/SF) — väli palautuu nollan pituiseksi*. *Varoitukset*-paneelissa lukee *Riippumatto ilman loppua ohjaavaa riippuvuutta (ei FF- tai SF-edeltäjää): kesto palautuu nollaan*. Riippumatto alkaa ja päättyy silloin samana päivänä. Lisää FF- tai SF-riippuvuus.

**Riippumatto, joka päättyy viimeisen tehtävän jälkeen.** Jos riippumatto jatkuu viimeisen tehtävän jälkeen, esimerkiksi FF-riippuvuudella ja viiveellä 2 työpäivää, projektin loppupäivä siirtyy mukana. Tehtävät, joita oikeasti tehdään, saavat silloin pelivaraa, eikä mikään niistä ole enää kriittinen.

**Tehtävät, jotka odottavat riippumattoa.** Jos riippuvuus lisätään riippumatosta toiseen tehtävään, se tehtävä alkaa vasta riippumaton lopun jälkeen. Koko riippumattoa edeltävä ketju, mukaan lukien tehtävät, joista riippumatto saa alkunsa ja loppunsa, saa silloin pelivaraa eikä ole enää kriittinen, koska riippumatto ei anna painetta takaisin. Tehtäviä ei siis pidä antaa odottaa riippumattoa. Kiinnitä sen sijaan tällaiset tehtävät riippumaton loppua ohjaavaan riippuvuuteen.

**Keston syöttäminen.** Riippumaton *Kesto*-kenttä johdetaan, eikä sitä voi muokata. Ennen valintaruudun valitsemista syötettyä kestoa ei enää oteta huomioon.

## Katso myös

- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): vaiheet riippuvuuden lisäämiseen tyyppiä SS tai FF.
- [Riippuvuudet ja viive](docs://uitleg-relaties): mitä SS ja FF tarkoittavat ja miten viive vaikuttaa.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä kriittinen tarkoittaa ja miten pelivara toimii.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): sisältää riippumatto-tehtävän *Structural works tower A (LOE)*.
