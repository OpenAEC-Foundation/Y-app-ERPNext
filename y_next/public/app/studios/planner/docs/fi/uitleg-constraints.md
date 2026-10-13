# Rajoitteet ja tavoitepäivät

Tiilet toimitetaan vasta 21. kesäkuuta. Lupa ei ole vielä tullut. Katto on saatava umpeen ennen rakennusalan kesälomaa. Riippuvuudet kertovat, että tehtävä odottaa toista tehtävää, mutta päivämäärää koskevat sopimukset eivät seuraa työn järjestyksestä. Rajoitteet ja tavoitepäivät on tarkoitettu juuri siihen. Tässä artikkelissa kerrotaan, mitä kukin tyyppi tekee, milloin tehtävä siirtyy ja milloin vain pelivara muuttuu, mikä on kova kiinnitys ja miten sovellus näyttää ristiriidan.

Säännöt ja esimerkit koskevat uutta projektia. Projektissa on laskentaprofiili *Open Planner Studio* ja työviikko maanantaista perjantaihin.

## Käsite

**Rajoite** on yhden tehtävän päivämääräraja, joka ei riipu sen riippuvuuksista. Tällainen raja voi toimia kahdella tavalla:

- Se **työntää**: tehtävä ei saa alkaa tai päättyä ennen päivämäärää. Jos riippuvuudet panisivat tehtävän alkamaan aiemmin, tehtävä siirtyy päivämäärään.
- Se **valvoo**: tehtävän on alettava tai päätyttävä viimeistään päivämääränä. Sovellus ei siirrä mitään. Jos aikataulu ei täytä päivämäärää, tehtävän **pelivara** ja sitä edeltävän ketjun pelivara muuttuvat negatiivisiksi. Pelivara on se aika, jonka tehtävä voi viivästyä ennen kuin projektin loppu siirtyy. Negatiivinen pelivara tarkoittaa, että paperilla on jo myöhästytty (katso [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad)).

**Tavoitepäivä** on yksinkertaisempi valvonnan muoto: tehtävän loppupäivälle asetettu tavoitepäivä. Mikään ei siirrä tehtävää.

Kaikki rajoitteet ovat **pehmeitä**: laskenta jatkuu, vaikka päivämäärää ei saavuteta. Yksi poikkeus on **kova kiinnitys**, joka ohittaa riippuvuudet. Siitä lisää alla.

## Miten sovellus laskee

### Kahdeksan tyyppiä

Tyyppi valitaan *Ominaisuudet*-paneelin kentästä *Rajoite*. Näin kukin tyyppi lasketaan:

- *Mahdollisimman aikaisin (ASAP)*: ei rajaa. Tämä on oletus: tehtävä alkaa heti, kun riippuvuudet sallivat.
- *Mahdollisimman myöhään (ALAP)*: tehtävä siirtyy niin myöhään kuin pystyy, ilman että seuraaja joutuu alkamaan myöhemmin. Se käyttää siis vapaan pelivaransa. Jos siinä on vielä kokonaispelivaraa, koska sen seuraajilla on itsellään tilaa, tehtävä pysyy ei-kriittisenä. Jos sekin on käytetty, tehtävä on kriittinen.
- *Alkaa aikaisintaan (SNET)*: alaraja alkamiselle. Jos tehtävä alkaisi aiemmin, se siirtyy päivämäärään. Jos päivämäärä on aikaisempi kuin riippuvuudet sallivat, rajoite ei tee mitään.
- *Päättyy aikaisintaan (FNET)*: sama, mutta tehtävän loppupäivälle.
- *Alkaa viimeistään (SNLT)* ja *Päättyy viimeistään (FNLT)*: yläraja alkamispäivälle tai loppupäivälle. Ne eivät siirrä mitään. Jos rajaa ei saavuteta, sovellus näyttää rikotun rajoitteen ja pelivara muuttuu negatiiviseksi.
- *Täytyy alkaa (MSO)* ja *Täytyy päättyä (MFO)*: alaraja ja yläraja samaan aikaan. Tehtävä siirtyy päivämäärään, jos se on myöhempi kuin riippuvuudet vaativat. Jos päivämäärä on aikaisempi kuin riippuvuudet sallivat, tehtävä pysyy siinä, minne riippuvuudet sen asettavat, ja pelivara muuttuu negatiiviseksi.

Jos päivämäärä osuu lauantaille, sunnuntaille tai vapaapäivälle, sovellus lukee sen työpäiväksi: alaraja (SNET, FNET) siirtyy seuraavaan työpäivään, yläraja (SNLT, FNLT) edelliseen.

### Mitä negatiivinen pelivara tarkoittaa

Yläraja toimii takaperin. Jos rajoite asettaa tehtävän myöhäisen päivämäärän ennen sen varhaista päivää, kokonaispelivara muuttuu negatiiviseksi. Sama koskee sitä edeltäviä tehtäviä. Jos tiilityön on alettava viimeistään perjantaina 11. kesäkuuta eikä se voi alkaa ennen maanantaita 14. kesäkuuta, myös tiilityötä edeltävät tehtävät ovat yhden työpäivän myöhässä. Kaikki tehtävät, joilla on negatiivinen pelivara, ovat kriittisiä. Miten tämä toimii, on kuvattu artikkelissa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad).

Palkit eivät siirry ylärajan takia. Ristiriita näkyy kentässä *Kokonaispelivara*, jossa arvo on negatiivinen. Sen näkee myös punaisena timanttina palkin yläpuolella, tilarivin viestistä (esimerkiksi *Rikotut rajoitteet: 1*) ja *Varoitukset*-paneelista.

### Kova kiinnitys

Kun MSO- tai MFO-rajoitteen kanssa valitaan valintaruutu *Pakollinen (kiinnityslogiikka)*, tehtävä kiinnitetään päivämäärään, vaikka sen edeltäjät eivät ole siihen mennessä päättyneet. Riippuvuudet ohitetaan:

- Tehtävä on päivämäärässä (MSO:lla se alkaa siinä, MFO:lla se päättyy siihen) ja menee päällekkäin edeltäjiensä kanssa.
- Edeltäjien pelivara muuttuu negatiiviseksi. Sovellus näyttää rikotun rajoitteen heti, kun riippuvuudet sallisivat tehtävän alkavan kiinnitystä myöhemmin. Kiinnitetty tehtävä säilyttää itse 0 pelivaraa.
- Seuraajat lasketaan kiinnitetystä tehtävästä. Ne voivat siis alkaa aiemmin kuin ilman kiinnitystä, vaikka sitä edeltävä logiikka ei ole päättynyt. Alla olevassa esimerkissä projektin loppu siirtyy tämän takia kolme työpäivää aiemmaksi.

Kun kiinnityksen valitsee ensimmäisen kerran, sovellus näyttää lyhyen selityksen: kova kiinnitys ohittaa riippuvuudet, palkki on kiinni päivämäärässä, vaikka edeltäjät eivät ole vielä päättyneet.

### Toissijainen rajoite

Tehtävällä on yksi ensisijainen rajoite. Jos halutaan myös toinen raja, esimerkiksi tehtävän, joka ei saa alkaa ennen 14. kesäkuuta ja joka päättyy 17. kesäkuuta mennessä, lisätään **toissijainen rajoite**. Sen on oltava todellinen raja (SNET, FNET, SNLT tai FNLT). Sen on rajattava vastakkaiseen suuntaan kuin ensisijainen: alaraja (SNET tai FNET) yhdessä ylärajan (SNLT tai FNLT) kanssa. SNET yhdessä SNLT:n kanssa on siis sallittu, SNET yhdessä FNET:n kanssa ei ole. Sovellus merkitsee muut yhdistelmät punaisella ja kertoo syyn, esimerkiksi *Ensisijainen ja toissijainen rajoite eivät saa rajata samaa puolta.* Kun ensisijainen rajoite on ASAP, ALAP, MSO tai MFO, tai kun käytössä on kova kiinnitys, toissijaista rajoitetta ei sallita.

### Tavoitepäivä

Tavoitepäivä on erillinen päivämäärä tehtävässä rajoitteen rinnalla. Se on yläraja loppupäivälle: se ei siirrä mitään, mutta tekee pelivarasta negatiivisen, jos tehtävä ei pääty ajoissa. Sovellus näyttää sitten *Varoitukset*-paneelissa viestin *Tavoitepäivä … ylitetty — varhaisin valmistumispäivä …*, ja tilarivi laskee ylitetyt tavoitepäivät. Gantt-kaaviossa tavoitepäivän kohdalla on alaspäin osoittava nuoli: vihreä niin kauan kuin tehtävä päättyy ajoissa, punainen heti kun se on myöhässä. Lauantaille osuva tavoitepäivä tarkoittaa edeltävää perjantaita.

Pelivaran kannalta tavoitepäivä toimii samoin kuin FNLT. Ero on siinä, miten tavoitepäivää käytetään. Tavoitepäivä on päivämäärä, jota halutaan valvoa. Se on rajoitteesta erillään, joten tehtävällä voi olla sekä rajoite että tavoitepäivä. FNLT on rajoite: rikkomus näkyy rikottuna rajoitteena eikä ylitettynä tavoitepäivänä.

### Mitä rajoite ei tee

- **Vaiheessa** (yhteenvetotehtävä) rajoite tai tavoitepäivä ei vaikuta: sovellus laskee vaiheen tehtävillä. Se asetetaan itse tehtävään.
- Tehtävä, jolla on jo toteutunut alkamispäivä tai edistyminen, säilyttää alkamispäivänsä. SNET, jonka päivämäärä on myöhempi, ei siirrä sitä.
- **Alkamispäivän kirjoittaminen** tehtävään, jolla on edeltäjä, ei toimi kiinteänä alkuna: edeltäjä päättää edelleen. Siksi sovellus muuttaa sen SNET-rajoitteeksi kirjoitettuun päivään. Tämä tehdään *Ominaisuudet*-paneelissa, *Muokkaa tehtävää* -ikkunassa, taulukossa ja silloin, kun palkkia siirretään Gantt-kaaviossa. Sovellus kertoo tästä. Jos tehtävässä on jo toinen rajoite (esimerkiksi ALAP tai MSO), sovellus ei käytä uutta alkua ja kertoo siitäkin. Muuta silloin sitä rajoitetta.

Muutokset näkyvät vasta, kun **Laske** (F5) on suoritettu.

## Esimerkki käytännössä

Esimerkki on pieni verkosto talon lisärakennukselle. Se alkaa maanantaina 7. kesäkuuta 2027:

- *Groundwork* (3 työpäivää): maanantaista 7. kesäkuuta keskiviikkoon 9. kesäkuuta.
- *Pour foundation* (2): torstai 10. ja perjantai 11. kesäkuuta.
- *Brickwork* (5): maanantaista 14. kesäkuuta perjantaihin 18. kesäkuuta.
- *Roofing* (3): maanantaista 21. kesäkuuta keskiviikkoon 23. kesäkuuta.
- *Scaffolding* (2): seuraa tehtävää *Pour foundation* ja on ennen tehtävää *Roofing*. Se kulkee maanantaina 14. ja tiistaina 15. kesäkuuta, ja sillä on 3 työpäivän pelivara.

Kriittinen polku on *Groundwork*, *Pour foundation*, *Brickwork* ja *Roofing*. Projekti päättyy keskiviikkona 23. kesäkuuta. Mitä muuttuu, kun tehtävään *Brickwork* asetetaan yksi rajoite?

- **SNET maanantaina 21. kesäkuuta** (tiilet saapuvat vasta silloin): *Brickwork* kulkee maanantaista 21. kesäkuuta perjantaihin 25. kesäkuuta, *Roofing* maanantaista 28. kesäkuuta keskiviikkoon 30. kesäkuuta. Projekti päättyy keskiviikkona 30. kesäkuuta. *Groundwork* ja *Pour foundation* ovat nyt 5 työpäivän pelivaralla eivätkä ole enää kriittisiä. *Scaffolding*:lla on 8 työpäivän pelivara.
- **SNET keskiviikkona 9. kesäkuuta**: ei vaikutusta. Riippuvuudet sallivat *Brickwork*:n alkaa joka tapauksessa vasta maanantaina 14. kesäkuuta.
- **SNLT keskiviikkona 16. kesäkuuta**: ei vaikutusta. *Brickwork* alkaa maanantaina 14. kesäkuuta ja täyttää rajan selvästi.
- **SNLT perjantaina 11. kesäkuuta**: liian tiukka. *Brickwork* alkaa silti maanantaina 14. kesäkuuta, yhden työpäivän myöhässä. *Groundwork*, *Pour foundation* ja *Brickwork* saavat −1 työpäivän pelivaran, ja sovellus näyttää: *Logiikka ylittää rajoitteen Alkaa viimeistään (SNLT) 11-06-2027 (negatiivinen pelivara)*. Mikään ei siirry.
- **MSO keskiviikkona 16. kesäkuuta** (ilman kovaa kiinnitystä): *Brickwork* siirtyy keskiviikkoon 16. kesäkuuta ja päättyy tiistaina 22. kesäkuuta. *Roofing* kulkee keskiviikosta 23. kesäkuuta perjantaihin 25. kesäkuuta, ja projekti päättyy perjantaina 25. kesäkuuta.
- **MSO perjantaina 11. kesäkuuta** (ilman kovaa kiinnitystä): päivämäärä on aikaisempi kuin riippuvuudet sallivat. *Brickwork* alkaa silti maanantaina 14. kesäkuuta, ja pelivara muuttuu −1:ksi, aivan kuten SNLT:n kanssa.
- **MSO keskiviikkona 9. kesäkuuta kovalla kiinnityksellä**: *Brickwork* alkaa keskiviikkona 9. kesäkuuta ja päättyy tiistaina 15. kesäkuuta, kun *Pour foundation* kulkee yhä perjantaihin 11. kesäkuuta asti. *Roofing* kulkee keskiviikosta 16. kesäkuuta perjantaihin 18. kesäkuuta: projekti päättyy kolme työpäivää aiemmin kuin ilman kiinnitystä. *Groundwork* ja *Pour foundation* saavat −3 työpäivän pelivaran.

Entä rajoite tai tavoitepäivä toisessa tehtävässä:

- **ALAP tehtävälle** *Scaffolding*: tehtävä siirtyy torstaihin 17. ja perjantaihin 18. kesäkuuta, viimeiseen hetkeen ennen tehtävää *Roofing*. *Roofing* on sen ainoa seuraaja, ja sillä oli tilaa täsmälleen sen 3 työpäivän pelivaralle. Ne on nyt käytetty, ja *Scaffolding* on kriittinen.
- **SNET lauantaina 19. kesäkuuta** tehtävälle *Scaffolding*: raja tulkitaan maanantaiksi 21. kesäkuuta. *Scaffolding* kulkee maanantaina 21. ja tiistaina 22. kesäkuuta, ja *Roofing* siirtyy mukana keskiviikosta 23. kesäkuuta perjantaihin 25. kesäkuuta.
- **Tavoitepäivä perjantaina 18. kesäkuuta** tehtävälle *Roofing*: mikään ei siirry, ja *Roofing* pysyy maanantaista 21. kesäkuuta keskiviikkoon 23. kesäkuuta. *Groundwork*, *Pour foundation*, *Brickwork* ja *Roofing* saavat −3 työpäivän pelivaran, ja sovellus näyttää: *Tavoitepäivä 18-06-2027 ylitetty — varhaisin valmistumispäivä 23-06-2027*. *Scaffolding* jää 0 työpäivän pelivaraan ja tulee myös kriittiseksi.
- **SNET maanantaina 21. kesäkuuta** tehtävälle *Brickwork* ja **tavoitepäivä perjantaina 25. kesäkuuta** tehtävälle *Roofing*: rajoite siirtää *Brickwork*:n viikon verran myöhemmäksi, ja tavoitepäivä kertoo, että *Roofing* on myöhässä keskiviikkona 30. kesäkuuta. *Brickwork* ja *Roofing* saavat −3 työpäivän pelivaran. *Groundwork* ja *Pour foundation* säilyttävät 2 työpäivän pelivaran.

Opetusohjelmassa 3 asetetaan itse rajoite ja tavoitepäivä opetusprojektiin, ja nähdään, miten aikataulu siirtyy.

## Seuraukset ja väärinkäsitykset

**"Rajoite siirtää tehtävän."** Vain SNET, FNET, MSO ja MFO voivat siirtää tehtävän myöhemmäksi kuin sen riippuvuudet vaativat. ALAP voi siirtää sitä myöhemmäksi vapaan pelivaransa rajoissa. SNLT ja FNLT eivät siirrä mitään: ne vain varoittavat. Päivämäärän saavuttaminen tarkoittaa silloin sitä, että edeltävää ketjua lyhennetään.

**"Negatiivinen pelivara on sovelluksen virhe."** Se on merkki siitä, että aikataulu on ristiriidassa päivämäärää koskevan sopimuksen kanssa. Sen voi ratkaista lyhentämällä ketjua, löysäämällä sopimusta tai hyväksymällä ristiriidan tarkoituksella.

**"Kova kiinnitys ratkaisee ristiriidan."** Kova kiinnitys piilottaa ristiriidan. Tehtävä on päivämäärässä, mutta sen edeltäjät eivät ole siihen mennessä päättyneet, ja seuraajat lasketaan ikään kuin olisivat. Sitä käytetään vain päivämäärälle, joka on todella kiinteä, kuten laillinen luovutuspäivä, eikä keinona saada tehtävää tiettyyn päivään.

**"Kirjoitan vain alkamispäivän."** Tehtävästä, jolla on edeltäjä, tulee SNET. Jos päivämäärä on ennen kuin edeltäjä sallii, sillä ei ole vaikutusta.

**"Tavoitepäivä vai FNLT?"** Tavoitepäivä valitaan päivämäärälle, jota halutaan valvoa. Rajoite valitaan päivämäärälle, joka on todella aikataulun rajaehto.

**"Rajoite vaiheella."** Se ei vaikuta. Se asetetaan itse tehtävään.

## Katso myös

- [Rajoitteen tai tavoitepäivän asettaminen](docs://howto-constraint-deadline-zetten): vaiheet rajoitteen tai tavoitepäivän asettamiseen.
- [Riippuvuudet ja viive](docs://uitleg-relaties): riippuvuudet, joiden rinnalla rajoitteet ovat.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten negatiivinen pelivara syntyy ja mitä se tekee kriittiselle polulle.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): kova kiinnitys (*Täytyy alkaa*) tehtävässä *Municipal road closure (permitted closure period)* ja toissijainen rajoite (*Alkaa viimeistään*) tehtävässä *Lift supply & installation — Tower A*.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): tavoitepäivä, jota ei saavuteta, ja negatiivinen pelivara.
