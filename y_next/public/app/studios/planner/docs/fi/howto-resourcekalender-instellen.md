# Resurssin kalenterin asettaminen

Tavoite: kirjataan, mihin päiviin resurssi on käytettävissä, jotta histogrammi, ylikuormitus ja tasaaminen lasketaan sen mukaan.

## Milloin tätä tarvitaan

Muurausryhmä työskentelee vain maanantaista torstaihin. Nosturi on toisessa projektissa elokuun kahden ensimmäisen viikon aikana. Aliurakoitsijalla on neljä kiinteää työpäivää. Ilman omaa kalenteria sovellus olettaa, että resurssi työskentelee projektikalenterin työpäivinä.

Resurssikalenteri ei muuta yhdenkään tehtävän päivämäärää lainkaan. Se määrittää vain, milloin resurssi on käytettävissä. Jos tehtävää tehdään päivänä, jona resurssi ei työskentele, kapasiteetti kyseisenä päivänä on 0 ja päivä on ylikuormitettu. Jos halutaan, että tehtävä itse tehdään muina päivinä, tehtävälle annetaan oma kalenteri ([Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen)). Eroa käsitellään artikkelissa [Kalenterit ja työpäivät](docs://uitleg-kalenders).

## Vaiheet

### Uuden resurssikalenterin luominen

1. Valitse *Resurssit › Hallinta › Resurssit*. Resurssipaneeli avautuu. Jos resurssia ei ole vielä olemassa, luo se painikkeella *Uusi resurssi projektiin*.
2. Etsi resurssin rivi. Sarakkeessa *Kalenteri* oletus on *Projektikalenteri*: resurssi seuraa silloin projektikalenteria.
3. Valitse tästä luettelosta *+ Resurssikalenteri*. *Resurssikalenteri*-ikkuna avautuu. Siinä on samat kentät kuin kalenterilomakkeessa: *Nimi*, *Työpäivät*, työajat ja *Vapaapäivät*. Uusi kalenteri alkaa vakiokalenterin kopiona, ja sen nimi on *Resurssikalenteri*.
4. Anna kalenterille resurssiin sopiva nimi, esimerkiksi *Crew Mon–Thu*, ja aseta työpäivät: poista perjantai valinnasta kohdassa *Työpäivät*. Vapaapäivät ja seisokit lisätään luettelossa *Vapaapäivät* painikkeella *Lisää vapaapäivä*.
5. Napsauta *Käytä*. Kalenteri on nyt projektin kirjastossa ja liitetty resurssiin yhdellä vaiheella, jonka voi kumota painikkeella *Kumoa*. Painikkeella *Peruuta* ei luoda mitään.

### Olemassa olevan kalenterin valitseminen tai muokkaaminen

*Kalenteri*-sarakkeessa valitse kalenteri luettelosta. *Projektikalenteri* poistaa taas resurssin oman kalenterin. Jos valittua kalenteria halutaan muuttaa, napsauta luettelon vieressä olevaa kynää (*Muokkaa…*). *Resurssikalenteri*-ikkuna avautuu nykyisen kalenterin kanssa.

### Tuloksen tarkastaminen

1. Jos tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*, paina **Laske** (F5).
2. Valitse *Resurssit › Histogrammi › Histogrammi* ja napsauta histogrammin vasemmalla puolella olevassa luettelossa resurssia. Päivät, joina resurssi ei työskentele mutta joina sille on tehtäviä, näkyvät punaisina. Jos hiiren osoitin on yhden pylvään päällä, siinä näkyy esimerkiksi: *Ei työskentele tänä päivänä kalenterin "Crew Mon–Thu" mukaan*.
3. Kohdassa *Resurssit › Ylikuormitus* näkyy ylikuormitettujen resurssien määrä, ja tilarivillä näkyy esimerkiksi *Resurssien ylikuormitukset: 1*.

## Sudenkuopat ja mitä sovellus silloin tekee

**Vain päivillä on merkitystä, ei tunneilla.** Resurssikalenteri määrittää, minä päivinä resurssi työskentelee. Kyseisenä päivänä käytettävissä oleva kuormitusaste määräytyy resurssin *Enimmäismäärä*-arvon mukaan, ei kalenterin työajoista.

**Tasaaminen ei aina ratkaise tätä.** Jos ei ole jaksoa, jolla jokainen tehtävän päivä osuu resurssin työpäiville, siirtäminen ei auta. Valitse *Resurssit › Tasaaminen › Tasaa…* ja napsauta *Laske*. Tehtävä on sitten kohdassa *Jäljellä olevat ristiriidat* syynä *Resurssi ei työskentele kaikkina päivinä, joita tämä tehtävä tarvitsee. Siirtäminen ei ratkaise tätä*. Määritä tehtävä sen jälkeen toiselle resurssille tai anna tehtävälle oma kalenteri.

**Yhteinen kalenteri.** Luettelossa näkyvät kaikki projektin kalenterit, siis myös projektikalenteri ja tehtävien omat kalenterit. Jos tällaista kalenteria muokataan kynällä, myös sitä käyttävien tehtävien aikataulu muuttuu, ja tilarivillä näkyy *Vanhentunut — laske uudelleen (F5)*. Resurssille kannattaa mieluummin luoda oma kalenteri.

**Ylikuormitus ei aina johdu kalenterista.** Myös resurssi, joka työskentelee joka päivä, voi olla ylikuormitettu. Ohjeteksti mainitsee kalenterin vain, jos päivä ei ole resurssin työpäivä.

## Katso myös

- [Kalenterit ja työpäivät](docs://uitleg-kalenders): miksi resurssikalenteri ei siirrä päivämääriä.
- [Kalenterin luominen ja määrittäminen](docs://howto-kalender-maken-en-toewijzen): kalenterilomakkeen kentät.
- [Vapaapäivien luominen ja rakennusalan kesäloma](docs://howto-feestdagen-genereren): vapaapäivien ja seisokkien lisääminen kalenteriin.
- [Kalenteri-ikkunat](docs://ref-kalenders): kaikki kalenteri-ikkunoiden kentät.
