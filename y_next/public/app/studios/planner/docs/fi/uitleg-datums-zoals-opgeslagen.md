# Tallennetut päivämäärät

Aikataulu avataan Primaverasta tai MS Project -ohjelmasta, ja päivämäärät eroavat siitä, mitä siinä ohjelmassa näkyi. Onko tuonti mennyt pieleen? Yleensä ei. Tässä artikkelissa luetaan, miksi sovellus laskee itse uudelleen, milloin se näyttää tiedoston päivämäärät, mitä silloin jää tyhjäksi ja miten palataan sovelluksen omaan laskentaan. Lopussa oleva esimerkki seuraa kahta tehtävää koko kierron ajan.

## Periaate

Aikataulutiedosto sisältää kahta eri tyyppistä tietoa. Ensin logiikka: tehtävät, kestot, riippuvuudet, kalenterit ja rajoitteet. Toiseksi päivämäärät, jotka pakettti itse laski niiden perusteella. Kun tiedosto avataan, Open Planner Studio käyttää logiikkaa ja laskee itse. Tiedoston päivämäärät eivät siis ole syötettä.

Jos sovelluksen oma laskenta päätyy muille päivämäärille kuin tiedosto kertoo, ei voida tietää, kumpi puoli on oikein. Tiedostosta voi puuttua logiikkaa, jota pakettti käytti. Pakettikin voi laskea jossakin kohdassa eri tavalla kuin sovellus. Siksi sovellus voi näyttää päivämäärät **sellaisina kuin ne tallennettiin**: päivämäärät, jotka toinen ohjelma kirjoitti tiedostoon. Näin vertailu tehdään sen kanssa, mitä siinä ohjelmassa näkyi.

## Miten sovellus toimii tässä tilanteessa

### Mitä laskentaprofiilia sovellus käyttää

Sovellus laskee **laskentaprofiilin** avulla. Laskentaprofiili on joukko laskentasääntöjä (laskentasäännöt), jotka ratkaisevat esimerkiksi, miten tehtävän suunniteltua alkua ja rajoitteita käsitellään. Lisätietoja: [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen). Sovelluksessa on kolme sisäänrakennettua profiilia: *Primavera P6*, *Microsoft Project* ja *Open Planner Studio*. `.xer`-tiedosto avataan profiililla *Primavera P6* ja `.mpp`-tiedosto profiililla *Microsoft Project*. CSV, MS Project XML ja Primavera P6 XML avautuvat profiililla *Open Planner Studio*. Projektin laskentaprofiili on valikossa *Tiedosto › Projektitiedot* kohdassa *Laskentaprofiili ja laskentavaihtoehdot*. Sovelluksen oma IFC-tiedosto säilyttää profiilinsa.

### Milloin sovellus vertaa

Avattaessa sovellus kirjaa, mitä tiedosto ilmoitti, ja vertaa sitä omaan tulokseensa. Vertailu tehdään seuraaville:

- Primavera-tiedosto (`.xer`) ja Primavera P6 XML;
- MS Project XML ja MS Project -tiedostot (`.mpp`);
- IFC-tiedosto muusta ohjelmasta, niiden tehtävien osalta, joiden varhaisimmat alkamispäivät ovat tiedostossa;
- sovelluksen oma IFC-tiedosto, joka on muistanut alkuperänsä. Alla luetaan, milloin näin on.

Sovellus ei vertaa koskaan CSV-tiedostoa, koska CSV:n aloituspäivä on syötettä eikä laskennan tulos. Sovelluksen oma IFC-tiedosto, jolla ei ole muistettua alkuperää, ei myöskään tule vertailtavaksi.

Jos yksikään tehtävä ei poikkea, mitään ei huomata. Jos vähintään yksi tehtävä poikkeaa tiedostosta, jota tuodaan juuri nyt, sovellus kytkee näkymän heti päälle.

Primavera-tiedoston kohdalla sovellus laskee laskentaprofiililla *Primavera P6*. Se pitää tiedoston suunnitellun alkamispäivän varhaisimpana alkamispäivänä. Tehtävä, joka on tiedostossa myöhemmin kuin riippuvuudet vaativat mutta on siellä myös suunniteltu, pysyy siksi paikallaan. Silloin ei ole eroa.

### Mitä näkyy

Valintanauhan alla on ilmoitusrivi: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Kun lasketaan uudelleen, 4 tehtävää siirtyisi.* Primavera-lähteen kanssa (`.xer` tai Primavera P6 XML) teksti on *Aikataulu näytetään sellaisena kuin Primavera sen tallensi. Kun lasketaan uudelleen, 1 tehtävä siirtyisi.* Ilmoitusrivin oikealla puolella on painike *Laske uudelleen*. Ilmoitusrivillä ei ole rastia.

Lisäksi näkyy viesti: *4 tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* Vain `.xer`-tiedostolla viesti kuuluu: *1 tehtävä näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* Jokainen tehtävä, jolle tiedosto tallensi päivämäärät, näyttää merkin paneelissa *Ominaisuudet*: *Näyttää Primaveran omat tallennetut päivämäärät tälle tehtävälle*, kun lähde on Primavera, tai *Näyttää tiedostoon tallennetut päivämäärät tälle tehtävälle*, kun lähde on muu. Gantt-kaaviossa, tehtävätaulukossa ja tilarivillä näkyvät tiedoston päivämäärät.

### Mikä jää tyhjäksi tässä näkymässä

Tässä näkymässä sovellus ei laske mitään. Se näyttää vain sen, minkä tiedosto tallensi. Pelivara ja kriittinen polku näkyvät siis vain, jos tiedosto sisältää ne. Jos tiedosto ei tallenna kriittisiä tehtäviä, tilarivillä lukee 0 kriittistä tehtävää. Se ei kerro mitään pakettiin itseensä tallennetusta kriittisestä polusta. Se, mikä syntyy vain laskennasta, ei ole olemassa tässä näkymässä: mitkä riippuvuudet ohjaavat aikataulua, rikotut rajoitteet, tehtävät, jotka ovat väärässä järjestyksessä, ja lähes kriittiset tehtävät.

Jos tiedosto ei tallenna tehtävästä kaikkea, paneelissa *Ominaisuudet* näkyy merkki *Tallennus on osittain puutteellinen — katso myöhäis- ja pelivarasarakkeet*. CSV-viennissä sarakkeet *Kriittinen* ja *Kokonaispelivara* jäävät tällaiselle tehtävälle tyhjiksi keksityn nollan sijaan.

### Näkymästä poistuminen

Näkymästä poistutaan kahdella tavalla:

- Valitse ilmoitusrivillä *Laske uudelleen*, tai valitse *Laske* (F5). Sovellus laskee omilla säännöillään.
- Tehdään muutos, joka voi muuttaa päivämääriä, esimerkiksi tehtävän kestoon tai uuteen tehtävään. Sovellus poistuu näkymästä ja laskee heti uudelleen, vaikka *Laske automaattisesti* on pois päältä. Nimen muuttaminen ei tee sitä: näkymä jää päälle.

Resurssikirjastosta tuleva kalenterin muutos pitää näkymän päällä ja tiedoston päivämäärät ennallaan, mutta päivittää ilmoitusrivin luvun.

Poistumisen jälkeen ei ole painiketta, jolla palataan näkymään. Ctrl+Z palauttaa sen kuitenkin heti uudelleenlaskennan tai muokkauksen jälkeen. Muuten lähdetiedoston voi avata uudelleen. Myös `.xer`-tiedoston kohdalla IFC-tiedoston avaaminen kytkee näkymän taas päälle, jos tiedosto on tallennettu uudelleenlaskennan jälkeen eikä sitä ole muokattu.

### Palautus kaatumisen jälkeen

Jos projekti palautetaan kaatumisen jälkeen, kun se oli näkymässä, näkymä jää päälle. Aktiivinen projekti näyttää saman ilmoitusrivin kuin ennen. Projekti toisessa välilehdessä näyttää ilmoitusrivin ilman lukua: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Tehtäviä ei ole laskettu uudelleen.* Lisätietoja: [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash).

### Tallentaminen ja uudelleen avaaminen

Jos tallennetaan näkymässä ollessa, sovellus kirjoittaa näkyvät päivämäärät IFC-tiedostoon yhdessä lähdemuodon kanssa. Jos tämä IFC-tiedosto avataan myöhemmin uudelleen eikä sitä ole muokattu tuonnin jälkeen, näkymä on taas päällä, ilman uutta viestiä.

Jos muokattiin ja tallennettiin välissä, riippuu lähteestä. Primavera-tiedoston kohdalla IFC-tiedosto säilyttää alkuperäisen `.xer`-tiedoston mukana. Sovellus vertaa silloin uudelleen ja tarjoaa näkymää: *Kun tehtävät laskettiin uudelleen, 1/2 tehtävän päivämäärä poikkesi tiedoston päivämääristä.* Sen yhteydessä näkyvät painike *Näytä tallennetut päivämäärät* ja rasti. Jokaisessa poikkeavassa tehtävässä paneeli *Ominaisuudet* näyttää merkin *Poikkeaa tallennetuista päivämääristä*. *Näytä tallennetut päivämäärät* kytkee näkymän päälle; Ctrl+Z kumoaa sen. Rasti piilottaa tarjouksen.

Jos lähde on MS Project XML, `.mpp`, Primavera P6 XML tai IFC-tiedosto muusta ohjelmasta, IFC-tiedosto ei säilytä lähdettä. Jos tällainen projekti muokataan ja tallennetaan, sovellus ei enää vertaa sitä avattaessa uudelleen.

## Esimerkki: lisärakennus

Oletetaan, että avataan Primavera-tiedosto *Uitbouw* (lisärakennus), jossa on kaksi tehtävää ja kalenteri ilman vapaapäiviä. Vuonna 2027 6. toukokuuta on helatorstai ja 17. toukokuuta helluntaimaanantai. Kun kalenterissa on vapaapäiviä, päivämäärät tulevat eri tavalla. *Fundering storten* (perustuksen valu) kestää 5 työpäivää, *Metselwerk* (muuraus) 10 työpäivää, ja Metselwerk seuraa tehtävää Fundering lopusta alkuun -riippuvuudella. Tiedostoon on tallennettu, että Fundering kulkee maanantaista 3. toukokuuta perjantaihin 7. toukokuuta 2027, ja Metselwerk maanantaista 17. toukokuuta perjantaihin 28. toukokuuta 2027. Tämä on viikko sen varhaisimman alkamispäivän jälkeen, jonka riippuvuus sallii. Metselwerkin suunniteltu alkamispäivä tiedostossa on maanantai 10. toukokuuta 2027.

Heti avaamisen jälkeen näkyvät tiedoston päivämäärät. Tilarivillä lukee *Loppu: 28-05-2027* ja *Kriittinen polku: 2 tehtävää, 20 työpäivää*. Ilmoitusrivi kertoo, että uudelleenlaskennassa 1 tehtävä poikkeaisi, ja molemmat tehtävät näyttävät merkin *Näyttää Primaveran omat tallennetut päivämäärät tälle tehtävälle*.

Kun valitaan *Laske uudelleen*, Fundering pysyy 3.–7. toukokuuta. Metselwerk alkaa nyt maanantaina 10. toukokuuta, seuraavana työpäivänä Funderingin päätyttyä, ja päättyy perjantaina 21. toukokuuta. Aikataulu päättyy 21. toukokuuta 2027 ja kestää 15 työpäivää 20 sijasta. Kriittinen polku koostuu samoista 2 tehtävästä.

Entä jos tilanne on toinen?

- Jos Metselwerk on tiedostossa suunniteltu myös maanantaille 17. toukokuuta, laskentaprofiili *Primavera P6* säilyttää sen alun. Laskenta antaa tulokseksi 17.–28. toukokuuta, eroa ei ole, eikä näkymä kytkeydy päälle.
- Lisätään tehtävä näkymässä: tapahtuu sama uudelleenlaskenta. Metselwerk siirtyy 10.–21. toukokuuta.
- Tallennetaan näkymässä ja avataan IFC-tiedosto uudelleen ilman muokkausta: Metselwerk on taas 17.–28. toukokuuta.
- Lasketaan uudelleen, tallennetaan ilman lisämuokkausta ja avataan IFC-tiedosto uudelleen: näkymä on taas päällä ja Metselwerk on 17.–28. toukokuuta.
- Muokataan, tallennetaan ja avataan uudelleen: sovellus tarjoaa näkymää viestillä *Kun tehtävät laskettiin uudelleen, 1/2 tehtävän päivämäärä poikkesi tiedoston päivämääristä.* Metselwerk näyttää merkin *Poikkeaa tallennetuista päivämääristä*.

## Seuraukset ja väärinkäsitykset

**Ero ei ole tuontivirhe.** Sovellus laskee omilla säännöillään: `.xer`-tiedostolla laskentaprofiilin *Primavera P6* mukaan, `.mpp`-tiedostolla *Microsoft Project* -profiilin mukaan ja CSV-, MS Project XML- sekä Primavera P6 XML -tiedostoilla *Open Planner Studio* -profiilin mukaan. Miksi lähdepaketin päivämäärät tulivat eri tavalla, voi johtua tiedostosta tai paketista. Näkymä näyttää, *että* ne eroavat.

**Näkymä ei ole laskennan tulos.** Sovellus ei laskenut päivämääriä. Niitä ei oteta sellaisenaan oman aikataulun tuloksena.

**Tallentaminen näkymässä säilyttää lähdepaketin päivämäärät.** IFC-tiedostoon tallentuu silloin se, mitä lähdepaketti ilmoitti, ei se, mitä sovellus laskisi.

**Painike *Näytä tallennetut päivämäärät* ei tule näkyviin jokaisessa tuonnissa.** Juuri avatussa tiedostossa näkymä on jo päällä. Painike näkyy vain uudelleen avatussa IFC-tiedostossa, jonka lähde on Primavera ja jota on muokattu tuonnin jälkeen.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä sovellus säilyttää tiedostossa ja mitä tuonti tai vienti kuljettaa.
- [Primavera P6 -tiedoston avaaminen (.xer)](docs://howto-xer-openen): vaiheet ja viestit `.xer`-tiedostolle.
- [MS Project -tiedoston avaaminen (.mpp)](docs://howto-mpp-openen): vaiheet ja viestit `.mpp`-tiedostolle.
- [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash): mitä tälle projektille tapahtuu kaatumisen jälkeen.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten sovellus laskee pelivaran ja kriittisyyden silloin, kun se laskee.
