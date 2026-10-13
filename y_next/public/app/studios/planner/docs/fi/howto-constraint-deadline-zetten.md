# Rajoitteen tai tavoitepäivän asettaminen

Tavoite: kirjaa tehtävälle päivämääräsopimus, jotta aikataulu ottaa sen huomioon tai näyttää, ettei sitä saavuteta.

## Milloin tätä tarvitaan

Tiilet toimitetaan vasta 21. kesäkuuta, joten muuraustyötä ei saa aloittaa aikaisemmin: **rajoite** *Alkaa aikaisintaan*. Katto on suljettava ennen rakennusalan lomaa, ja haluat varoituksen, jos tämä ei onnistu: **tavoitepäivä**. Valu on kiinteä päivä, koska betonitehdas on luvannut sen: *Täytyy alkaa*. Se, mikä tyyppi sopii milloin ja mitä sovellus sillä tekee, selitetään kohdassa [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints).

## Vaiheet

Rajoite ja tavoitepäivä asetetaan paneelissa *Ominaisuudet*.

1. Valitse tehtävä. Jos paneelia *Ominaisuudet* ei näy, ota se käyttöön kohdasta *Näkymä › Paneelit › Ominaisuudet*.
2. Kohdassa *Rajoite* valitse tyyppi, esimerkiksi *Alkaa aikaisintaan (SNET)*.
3. Kaikilla tyypeillä paitsi *Mahdollisimman aikaisin (ASAP)* ja *Mahdollisimman myöhään (ALAP)* näkyy kenttä *Rajoitteen päivämäärä*. Kirjoita päivämäärä kolmeen ruutuun: päivä, kuukausi ja vuosi, esimerkiksi 21, 06 ja 2027, ja paina Enter. Sovellus siirtyy itse seuraavaan ruutuun heti, kun ruutu on täynnä. Kun tyyppi on valittu, päivämäärä on jo kentässä: edellisen rajoitteen päivämäärä tai muuten tehtävän alkuperäinen suunniteltu alkamispäivä. Se voi poiketa paneelissa näkyvästä alkamispäivästä, joten kirjoita aina itse päivämäärä, jonka haluat.
4. Jos haluat kiinnittää tehtävän päivämäärään jo ennen sen edeltäjiä, valitse *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* ja ruksi *Pakollinen (kiinnityslogiikka)*. Tämä on kova kiinnitys. Käytä sitä vain päivämäärälle, joka on todella kiinteä.
5. Jos haluat myös toisen rajan, esimerkiksi tehtävän, joka saa alkaa aikaisintaan 14. kesäkuuta ja joka on päätettävä viimeistään 17. kesäkuuta, valitse tyyppi kohdasta *Toissijainen rajoite* ja täytä kenttä *Toissijainen päivämäärä*. Kenttä näkyy kaikilla rajoitteilla, joissa on päivämäärä, paitsi kovalla kiinnityksellä. Tyypeillä MSO ja MFO toissijainen rajoite ei ole sallittu: sovellus merkitsee sen punaisella.
6. Tavoitepäivälle täytä kenttä *Tavoitepäivä* samalla tavalla kuin rajoitteen päivämäärälle. Tavoitepäivä on erillinen rajoitteesta: molemmat voi asettaa samalle tehtävälle.
7. Paina **Laske** (F5), esimerkiksi kohdasta *Aloitus › Aikataulu › Laske*. Siihen asti tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*.

Kentät ovat myös ikkunassa *Muokkaa tehtävää*. Avaa se napsauttamalla tehtävää hiiren oikealla painikkeella ja valitsemalla *Muokkaa...*. Vahvista painikkeella *Tallenna*.

Taulukossa käytetään sarakkeita. Napsauta taulukon otsikkorivillä **+**-painiketta ja valitse kohdasta *Rajoitteet* sarakkeet *Rajoitetyyppi*, *Rajoitteen päivämäärä* ja *Tavoitepäivä* (lisäksi on *Kova rajoite*, *Toissijainen rajoitetyyppi* ja *Toissijaisen rajoitteen päivämäärä*). Muokkaa solua kaksoisnapsauttamalla sitä: tyyppi valitaan luettelosta, ja päivämäärä kirjoitetaan viivoilla, esimerkiksi 21-06-2027. *Kova rajoite* voi muuttua vain tyypeillä MSO ja MFO.

Jos tehtävällä on edeltäjä, *Alkaa aikaisintaan* -rajoitteen voi asettaa nopeammin: kirjoita uusi alkamispäivä kenttään *Alku* (paneelissa *Ominaisuudet*, ikkunassa *Muokkaa tehtävää* tai taulukossa) tai siirrä palkkia Gantt-kaaviossa. Sovellus muuttaa sen itse rajoitteeksi *Alkaa aikaisintaan (SNET)* ja ilmoittaa siitä.

## Tuloksen tarkistaminen

- Gantt-kaaviossa palkin yläpuolella on pieni timantti: alkurajoitteen kohdalla alkupuolella ja loppurajoitteen kohdalla loppupuolella. Se on sininen tyypeillä SNET ja FNET, violetti tyypeillä SNLT, FNLT, MSO ja MFO, ja punainen, jos rajoite on rikottu. Kovalla kiinnityksellä on nasta. Tavoitepäivä näkyy alaspäin osoittavana nuolena tavoitepäivän kohdalla: vihreä, kun tehtävä päättyy ajoissa, punainen, jos se on myöhässä.
- Rikottu rajoite tai myöhästynyt tavoitepäivä näkyy paneelissa *Varoitukset* (*Aikataulu › Aikataulu › Varoitukset*) ja tilarivillä. Tehtävän ja sitä edeltävien tehtävien *Kokonaispelivara* on silloin negatiivinen.
- Kun rajana on yläraja (*Alkaa viimeistään*, *Päättyy viimeistään*) tai tavoitepäivä, varoituksen puuttuminen tarkoittaa, että aikataulu täyttää päivämäärän.

## Rajoitteen tai tavoitepäivän poistaminen

Valitse kohdasta *Rajoite* uudelleen *Mahdollisimman aikaisin (ASAP)*. Tämä poistaa myös toissijaisen rajoitteen. Tavoitepäivän poistat tyhjentämällä kolme ruutua ja painamalla Enter. Paina sen jälkeen **Laske**.

## Mahdolliset ongelmat ja mitä sovellus tekee

**Rajoite vaiheessa.** Rajoite tai tavoitepäivä vaiheella (yhteenvetotehtävä) ei vaikuta. Aseta se suoraan tehtävälle.

**Tehtävä, joka on jo alkanut.** Jos tehtävällä on todellinen alkamispäivä tai edistymistä, se säilyttää todellisen alkamispäivänsä. *Alkaa aikaisintaan* -rajoite, jonka päivämäärä on myöhempi, ei siirrä sitä.

**Alkamispäivän kirjoittaminen muun rajoitteen rinnalla.** Jos tehtävällä on edeltäjä ja jo toinen rajoite, esimerkiksi *Mahdollisimman myöhään (ALAP)*, sovellus ei käytä kirjoitettua alkamispäivää. Viesti kertoo rajoitteen nimen. Muuta sitä, jos haluat siirtää alkua.

**Päivämäärä viikonlopussa.** Päivämäärä lauantaina, sunnuntaina tai vapaapäivänä lasketaan työpäiväksi: alarajana (*Alkaa aikaisintaan*, *Päättyy aikaisintaan*) seuraavaksi työpäiväksi, ylärajana (*Alkaa viimeistään*, *Päättyy viimeistään*) edelliseksi.

**Sallimaton toissijainen rajoite.** Sovellus merkitsee kielletyn yhdistelmän punaisella ja kertoo syyn, esimerkiksi *Ensisijainen ja toissijainen rajoite eivät saa rajata samaa puolta.* Toissijaista rajoitetta ei sallita tyypeillä ASAP, ALAP, MSO, MFO ja kovalla kiinnityksellä.

**Kova kiinnitys.** Kun kova kiinnitys otetaan ensimmäisen kerran käyttöön, sovellus varoittaa, että se ohittaa riippuvuudet. Tehtävä on silloin päivämäärällään, jopa ennen sen edeltäjiä. Edeltäjille tulee negatiivinen pelivara.

**Asettamisen jälkeen mikään ei muutu.** Rajoitteet vaikuttavat vasta, kun **Laske** on valittu. Jos ylärajalla (*Alkaa viimeistään*, *Päättyy viimeistään*) ei ole vaikutusta palkkeihin, se on normaalia: yläraja ei siirrä mitään. Se tekee pelivarasta negatiivisen, jos päivämäärää ei saavuteta.

## Katso myös

- [Rajoitteet ja tavoitepäivät](docs://uitleg-constraints): mitä kukin tyyppi tekee sekä selitys kovasta kiinnityksestä, negatiivisesta pelivarasta ja tavoitepäivästä.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mitä negatiivinen pelivara tekee kriittiselle polulle.
- [Riippuvuudet ja viive](docs://uitleg-relaties): riippuvuudet, joiden rinnalla rajoite on.
- [Ilmoitukset ja varoitukset](docs://ref-meldingen): varoitukset rikotusta rajoitteesta tai myöhästyneestä tavoitepäivästä.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): rakennusluvan rajoite *Alkaa aikaisintaan* kohteelle *Demolish existing extension* (14. toukokuuta 2027) ja tavoitepäivä, joka saavutetaan selvästi ajoissa.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): tarkoituksella tiukka tavoitepäivä kohteelle *Contractual project handover* (15. heinäkuuta 2027). Laskennan jälkeen projektin loppu on 17. elokuuta ja monilla tehtävillä on negatiivinen pelivara.
