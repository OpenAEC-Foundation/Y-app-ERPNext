# Työaikojen asettaminen

Tavoite: kirjaa viikonpäivittäin, mihin kellonaikoihin kalenteri työskentelee, jotta tunneissa suunnitellut tehtävät kulkevat oikeaan aikaan.

## Milloin tätä tarvitaan

Perjantain iltapäivä on vapaa. Työryhmä työskentelee kello 06:00–22:00 kahdessa työvuorossa. Lisäksi on yöryhmä. Tauko on lyhyempi kuin tunti. Jos suunnitellaan vain päivinä, *Alku (tunti)*, *Loppu (tunti)* ja tauko riittävät ([Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen)). Jos tehtäviä suunnitellaan tunneissa, sovellus laskee työajan minuutit kalenterin **lohkojen** sisällä. Sovelluksessa näistä lohkoista käytetään nimeä *bands*. Lohko on yhtenäinen työaika yhtenä viikonpäivänä, ja väli kahden lohkon välillä on tauko. Mitä tämä merkitsee aikataulussa, selitetään kohdassa [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

Tätä varten tarvitaan *Ota tuntisuunnittelu käyttöön* ([Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten)). Ilman tuntisuunnittelua ei näy *Työajat*-lohkoa.

## Vaiheet

### Työvuoroesiasetuksen valitseminen

1. Valitse *Aikataulu › Kalenteri › Kalenteri* ja napsauta vasemmalla olevaa kalenteria.
2. Napsauta *Työajat*-lohkossa esiasetusta. Se korvaa kalenterin työpäivät ja työajat.
3. Napsauta *Käytä*.

Jokainen esiasetus tekee seuraavaa:

- *Päivätyövuoro*: maanantaista perjantaihin kello 08:00–16:00 ilman taukoa. Näin kalenteri palautuu tavalliseksi kalenteriksi ilman lohkoja.
- *2 työvuoroa*: maanantaista perjantaihin kello 06:00–14:00 ja 14:00–22:00, yhteensä 16 tuntia.
- *3 työvuoroa*: maanantaista perjantaihin kolme työvuoroa: 06:00–14:00, 14:00–22:00 ja 22:00–06:00 seuraavana päivänä, yhteensä 24 tuntia.
- *Yötyövuoro*: maanantaista perjantaihin kello 22:00–06:00 seuraavana päivänä, 8 tuntia.
- *24/7*: kaikki seitsemän päivää kello 00:00–24:00.

### Työaikojen asettaminen viikonpäivittäin

1. *Työajat*-lohkossa napsauta *Aseta viikonpäivittäin…*. Painikkeiden alle ilmestyy rivi jokaiselle viikonpäivälle, ja siinä näkyy kyseisen päivän työaika. Kalenterissa on nyt lohkot viikonpäivittäin. Jos kalenterissa on jo lohkot, tämä yleiskatsaus on heti auki. Painikkeen nimi on silloin *Piilota työajat*, ja sillä yleiskatsaus suljetaan.
2. Muuta kunkin lohkon alku- ja loppuaika kahdessa aikakentässä.
3. Jos tauko halutaan lisätä, napsauta sen päivän kohdalla **+** (*Lisää lohko*) ja muuta lohkojen ajat niin, että niiden väliin jää tauko. Uusi lohko alkaa kello 08:00 ja päättyy kello 16:00.
4. Lohko, joka kulkee keskiyön yli, merkitään valinnalla *seuraava päivä*. Lohko lasketaan sille päivälle, jona se alkaa.
5. Poista lohko napsauttamalla sen takana olevaa roskakoria. Päivä ilman lohkoja näkyy nimellä *Ei-työpäivä*.
6. Maanantaista perjantaihin olevalle päivälle napsauta kopiointimerkkiä (*Kopioi kaikkiin työpäiviin*), jolloin sen päivän lohkot kopioituvat maanantaista perjantaihin.
7. Alareunassa on *Johdetut tunnit/päivä:* sovelluksen tästä johtamat nettotunnit päivässä. Napsauta *Käytä*.

**Esimerkki: vapaa perjantai-iltapäivä.** Napsauta *Aseta viikonpäivittäin…*. Poista toinen lohko (13:00–16:00) kohdalta *Pe*. Perjantaissa on nyt 5 tuntia, muissa päivissä 8 tuntia. Johdetut tunnit päivää kohden pysyvät 8 tuntina.

### Oman esiasetuksen tallentaminen

1. Napsauta *Tallenna esiasetukseksi…* ja kirjoita nimi kenttään *Oman esiasetuksen nimi*.
2. Napsauta *Tallenna*. Esiasetus on nyt muiden esiasetusten joukossa, ja sitä voi käyttää missä tahansa projektissa. Poista se napsauttamalla sen vieressä olevaa ristiä.

Oma esiasetus tallennetaan tälle laitteelle, ei projektitiedostoon.

## Valkuilut ja mitä sovellus silloin tekee

**Esiasetus korvaa kaiken.** Kun esiasetus valitaan, aiemmin asetetut työpäivät ja työajat katoavat. Vapaapäivät jäävät.

**Päiväpainikkeet ja lohkot ovat kaksi eri asiaa.** Painikkeet kohdassa *Työpäivät* eivät muuta lohkoja. Päivä saa työaikaa, kun sen kohdalla napsautetaan *Lisää lohko*. Jos päivä otetaan käyttöön pelkällä painikkeella, se lasketaan tehtäville päivinä mutta ei tunteina. Kalenterissa, jossa on työaikoja, käytetään viikonpäivittäisiä rivejä.

**Työaikojen muuttaminen, kun tuntisuunnittelu on pois päältä.** Kun tuntisuunnittelu poistetaan käytöstä, kentät *Alku (tunti)*, *Loppu (tunti)* ja tauko palaavat näkyviin. Kalenterissa, jossa on lohkoja, ne eivät muuta lohkoja. Siksi työaikoja muutetaan aina, kun tuntisuunnittelu on päällä.

**Ei kelvollisia työaikoja.** Kalenteri ilman lohkoja tai ilman työpäiviä ei voi ottaa vastaan tehtävää, joka on suunniteltu tunneissa. Silloin sovellus näyttää viestin *Tällä kalenterilla ei ole kelvollisia työaikoja. Tarkista työpäivät ja työajat.*

## Katso myös

- [Päivät ja tunnit](docs://uitleg-dagen-en-uren): miten sovellus laskee työtunnit ja johtaa päivittäiset nettotunnit.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): tehtävän suunnittelu tunneissa.
- [Kalenterit ja työpäivät](docs://uitleg-kalenders): mikä kalenteri koskee mitäkin tehtävää.
- [Kalenteriikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunan kentät.
