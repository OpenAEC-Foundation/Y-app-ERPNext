# Tehtävän jakaminen

Tavoite: lisätä tauko, jotta työ pysähtyy ja jatkuu myöhemmin, mutta tehtävä pysyy yhtenä.

## Milloin tätä tarvitset

Raudoituksen asentaminen vie kahdeksan työpäivää. Neljän päivän jälkeen nosturi on kuitenkin siirrettävä toiseen työhön, ja työ jatkuu kaksi päivää myöhemmin. Kaksi erillistä tehtävää tarkoittaa, että riippuvuudet ja resurssikohdistukset pitää tehdä kahteen kertaan. Kun **taukoa** käytetään, tehtävä pysyy yhtenä, yhdellä palkilla, jossa on aukko. Sovelluksen käyttöliittymässä tämä on myös nimeltään *tauko*.

Työn määrä pysyy samana, mutta tehtävä kestää kalenterissa pidempään. Esimerkki: 8 työpäivän tehtävä, joka alkaa tiistaina 29. syyskuuta 2026, päättyy torstaina 8. lokakuuta. Jos 2 työpäivän tauko lisätään 4 työpäivän työn jälkeen, tehtävä päättyy maanantaina 12. lokakuuta. Kesto on edelleen 8 työpäivää, vain loppu siirtyy kaksi työpäivää.

## Vaiheet

### Jakaminen Gantt-kaaviossa

1. Valitse *Aloitus › Tehtävät › Jaa tehtävä* (tai *Aikataulu › Riippuvuudet › Jaa tehtävä*). Aikataulun yläpuolelle ilmestyy ilmoitus *Napsauta palkkia päivänä, jona tauko alkaa, ja vedä oikealle sen pituudeksi. Esc lopettaa*. Painike on myös *Taulukko*-välilehdellä (*Taulukko › Tehtävät › Jaa tehtävä*), mutta se on siellä pois käytöstä.
2. Siirrä hiiri palkin päälle. Katkoviiva ja päivämäärällä varustettu tunniste näyttävät, mistä tauko alkaisi. Paina palkkia päivänä, jona tauko alkaa.
3. Vedä oikealle. Tunniste näyttää pituuden, esimerkiksi *2 työpäivää tauko*: etäisyyden työpäivinä hiiren alla olevaan päivään. Vapauta.

Jos vain napsautetaan ilman vetämistä, tauosta tulee yksi työpäivä. Vetämällä takaisin vasemmalle tauko lyhenee, mutta ei alle yhden työpäivän. Tuntitehtävän kohdalla toimitaan tunneilla.

Tila pysyy päällä, joten useita tehtäviä voi jakaa peräkkäin. Lopeta painamalla Esc tai ilmoituksen *Lopeta*-painiketta. Jos Esc painetaan vedon aikana, sovellus kumoaa tauon ja tila päättyy. Jokainen ele on yksi vaihe, jonka voi kumota *Kumoa*-komennolla.

Jaon jälkeen aikataulu ei ole enää ajan tasalla. Paina **Laske** (F5) lopullisia päivämääriä varten.

### Olemassa olevan tauon vetäminen Gantt-kaaviossa

Tämä toimii ilman jakotilaa, suoraan palkilla, jolla on tauko.

- Vedä tauon **jälkeistä** osaa oikealle tai vasemmalle. Tauko pitenee tai lyhenee, ja tunnisteessa näkyy *3 työpäivää tauko*. Jos osa vedetään takaisin, kunnes tauko on 0, tunnisteessa näkyy *Yhdistä*, ja kaksi osaa ovat taas yksi.
- Vedä tauon **ennen** olevan osan oikeaa reunaa. Osa pitenee tai lyhenee, ja tunnisteessa näkyy *Osa: 5 työpäivää*. Myös tehtävän kesto muuttuu samalla.
- Jos ensimmäistä osaa vedetään, koko tehtävää siirretään, kuten millä tahansa palkilla.

### Jakaminen ja säätäminen ominaisuuspaneelissa

Valitse tehtävä. *Ominaisuudet*-paneelissa *Tauot*-osio on *Riippuvuudet*-osion alapuolella ja *Resurssikohdistukset*-osion yläpuolella. Vieritä tarvittaessa sen kohdalle.

- *Lisää tauko* lisää yhden työpäivän tauon pisimmän osan keskikohtaan.
- Jokaisessa tauossa on kaksi kenttää: *jälkeen* (kuinka monta työpäivää työtä on ennen taukoa) ja *tauko* (taukon pituus). Niiden vieressä näkyvät tauon jälkeisen osan päivämäärät. Tuntitehtävän kohdalla ne näyttävät tunteja.
- Jos *tauko*-kentän arvoksi asetetaan 0, tauko poistuu. Pieni roskakori (*Poista tauko*) tekee saman.

Ole varovainen *jälkeen*-kentän kanssa. Se pidentää tai lyhentää taukoa edeltävää työosaa, ja sen mukana myös koko tehtävän kestoa. Kun *tauko*-kenttää muutetaan, muuttuu vain tehtävän loppu.

### Tauon poistaminen

Napsauta taukoa Gantt-kaaviossa hiiren oikealla painikkeella tai taukoa seuraavaa osaa ja valitse *Poista tauko*. *Poista kaikki tauot* on oikean painikkeen valikossa jokaisella palkilla, jossa on tauko. Tai käytä *Tauot*-osiota *Ominaisuudet*-paneelissa, kuten yllä.

### Tekoälyavustajalla

Liitetty tekoälyavustaja asettaa tauot työkalulla `planner_set_task_splits`, samassa muodossa kuin paneelissa: kuinka monen työpäivän (tai työtunnin) työn jälkeen ja kuinka monen työpäivän (tai työtunnin) mittainen tauko. Se antaa aina koko listan. Tyhjä lista poistaa kaikki tauot. Tauot luetaan takaisin työkalulla `planner_get_task`. Samat säännöt kuin alla pätevät: tehtävää, jota ei voi jakaa, ei voi jakaa myöskään avustaja. Toisin kuin itse tehdyn jaon kohdalla, aikataulu lasketaan uudelleen itsestään. Avustajan liittämisen ohje on kohdassa [Tekoälyavustajan liittäminen (MCP)](docs://howto-ai-assistent-koppelen).

## Sudenkuopat ja mitä sovellus tekee

**Kaikkia tehtäviä ei voi jakaa.** Välitavoitetta, yhteenvetotehtävää, tehtävää, jossa *Riippumatto (johdettu kesto)* on käytössä (katso [Riippumatto-tehtävän luominen](docs://howto-hammock)), tehtävää, jonka kestotyyppi on *Kulunut aika*, tehtävää, jolle on valittu *Manuaalisesti ajoitettu*, tai tehtävää, jonka kesto on alle kaksi työpäivää, ei voi jakaa. Jakotilassa hiiren osoitin näyttää kieltomerkin, eikä mitään tapahdu. Tällaisessa tehtävässä *Tauot*-osio puuttuu myös *Ominaisuudet*-paneelista.

**Taulukko-välilehdellä painike ei toimi.** *Jaa tehtävä* on siellä pois käytöstä, ja ohjeteksti on *Käytettävissä vain, kun Gantt-kaavio on näkyvissä*. Ele tarvitsee palkin. Jakotila ja linkitystila sammuttavat toisensa.

**Napsautus, joka ei vaikuta mitään.** Tauko ei voi alkaa tehtävän ensimmäisenä päivänä, eikä olemassa olevan tauon sisällä. Jokaisen työosan pitää myös olla vähintään yhden työpäivän pituinen. Jos tällaista kohtaa napsautetaan, mitään ei tapahdu, eikä viestiä näy.

**Tehtävä, jolla on edistymistä.** Jos tehtävässä on edistymistä, tauko voi alkaa vain jo tehdyn työn jälkeen. Kun 8 työpäivän tehtävä on 50 % valmis, tauko voi alkaa aikaisintaan viidennen työpäivän kohdalla. Napsautus tehdyssä osassa ei tee mitään. Tehtävää, jonka valmiusaste on 100 %, ei voi enää jakaa. *Lisää tauko* on paneelissa silloin pois käytöstä. Sama pätee, jos pisimmän osan keskikohta osuu tehtyyn työhön, esimerkiksi 8 työpäivän tehtävässä, joka on 75 % valmis.

**Tasaaminen luo myös taukoja.** Ne näkyvät *Tauot*-osiossa tunnisteella *tasaaminen*. *Resurssit › Tasaaminen › Poista tasaaminen* poistaa ne taas. Jos tällaisen tehtävän taukoja muokataan itse, kaikista sen tasaamistauoista tulee omiksi, eikä *Poista tasaaminen* enää poista niitä.

**Tauot eivät siirry MS Project -ohjelmaan tai Primaveraan.** Jos tiedosto viedään muotoon *MS Project XML* tai *Primavera P6 XML*, ohjelma tuntee tauon vain resurssikohdistuksen työn jakautumisena. Ilman tällaista jakautumista tehtävä saapuu ilman taukoa. Sovellus näyttää, kuinka monta tehtävää näin kävi: *1 tehtävä, jossa on taukoja, vietiin ilman taukoja: MS Project ja P6 tuntevat tauot vain työn jakautumisena.* Sovelluksen IFC-tiedostossa ne säilyvät.

**Tiedosto taukoineen, joita sovellus ei voi muokata.** Lähdetiedoston tauot, jotka eivät mahdu sovelluksen muotoon, näyttävät paneelissa viestin *Nämä tauot tulevat lähdetiedostosta muodossa, jota ei voi muokata täällä*. Paneelissa on silloin käytettävissä vain *Poista kaikki tauot*.

## Katso myös

- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): miten aikataulu lasketaan työpäivinä ja miksi loppu siirtyy.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): toinen tila Gantt-kaaviossa, jota käytetään vetämällä palkkia.
- [Tehtävän valintaikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen): *Tauot*-osio ominaisuuspaneelissa.
