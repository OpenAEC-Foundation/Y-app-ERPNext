# Rakenteen muokkaaminen

Tavoite: järjestää tehtävät vaiheisiin ja alitehtäviin, muuttaa niiden järjestystä ja pitää WBS-numerot oikein.

## Milloin tätä tarvitaan

Aikataulu on puu: vaiheet (yhteenvetotehtävät) ja niiden alla alitehtävät, esimerkiksi *Foundation* ja sen alla *Groundwork*, *Reinforcement* ja *Pouring*. Puuta muokataan, kun tehtävä halutaan lisätä vaiheen alle, irrottaa vaiheesta tai kun järjestys on väärä. **WBS-koodi** (1, 1.1, 1.2, 2, …) on tehtävän numero tässä puussa.

## Toimenpiteet

### Tehtävän sisentäminen

1. Valitse tehtävä. Useiden tehtävien valitseminen on sallittua.
2. Valitse *Aikataulu › Rakenne › Sisennä*. Pikanäppäin Alt+→ (tai Alt+Shift+→) toimii myös, ja *Sisennä* on hiiren oikean painikkeen valikossa.

Tehtävästä tulee edellisen samantasoisen tehtävän viimeinen alitehtävä. Edellisestä tehtävästä tulee tämän seurauksena yhteenvetotehtävä. Jos valitaan yhtenäinen joukko tehtäviä, joukko sisennetään kokonaisena. Jos tehtävällä ei ole edellistä samantasoista tehtävää, mitään ei tapahdu eikä viestiä näytetä.

### Tehtävän ulontaminen

Valitse *Aikataulu › Rakenne › Ulonna*, paina Alt+← (tai Alt+Shift+←) tai valitse hiiren oikean painikkeen valikosta *Ulonna*.

Tehtävästä tulee samantasoinen tehtävä heti sen vaiheen jälkeen, jonka alla se oli. Sen omat alitehtävät siirtyvät mukana. Tehtävät, jotka tulivat sen jälkeen samaan vaiheeseen, jäävät siihen. Ylimmän tason tehtävää ei voi ulontaa enempää.

### Tehtävän siirtäminen

Siirtämiseen on kolme tapaa.

- **Näppäimistöllä.** Alt+↑ ja Alt+↓ vaihtavat tehtävän naapurinsa kanssa samalta tasolta. Yhteenvetotehtävän mukana siirtyvät sen alitehtävät. Tason ylä- tai alareunassa ei tapahdu mitään. Kun useita tehtäviä on valittu, siirtyy vain ensin klikattu tehtävä.
- **Vetäminen tehtävätaulukossa.** Paina riviä ja vedä pystysuunnassa. Rivin ylin neljännes tarkoittaa *ennen*, alin neljännes *jälkeen*. Yhteenvetotehtävän keskikohta ripustaa tehtävän sen alle viimeiseksi alitehtäväksi. Tavallisen tehtävän keskikohta lasketaan lähimmäksi reunaksi. Jos vedetään rivi, joka kuuluu useamman rivin valintaan, siirtyy koko valinta.
- **Vetäminen Gantt-kaaviossa.** Vedä palkki pystysuunnassa toiselle riville. Se toimii samoin kuin vetäminen tehtävätaulukossa, eikä päivämäärät muutu. Jos vedetään vaakasuunnassa, siirretään päivämääriä.

Jokainen siirtäminen on yksi vaihe *Kumoa*-toiminnossa (Ctrl+Z).

### WBS-numeroiden pitäminen ajan tasalla

Katso painiketta *WBS auto* kohdassa *Aikataulu › Rakenne*.

- **Päällä (oletus uudessa projektissa).** Sovellus numeroi koko puun uudelleen jokaisen lisäyksen, poiston ja siirtämisen yhteydessä. WBS-koodia ei voi silloin kirjoittaa käsin, ei tehtävätaulukossa eikä *Ominaisuudet*-paneelissa. *Numeroi WBS uudelleen* on pois käytöstä.
- **Pois.** Koodit pysyvät ennallaan, myös siirtämisen ja sisentämisen jälkeen. Koodit kirjoitetaan itse *WBS*-sarakkeeseen tai *WBS-koodi*-kenttään *Ominaisuudet*-paneelissa. Vaihtoehtoisesti koodit numeroidaan kerran uudelleen painikkeella *Numeroi WBS uudelleen*. Tämä ylikirjoittaa myös itse kirjoitetut koodit.

Kun *WBS auto* kytketään päälle, sovellus numeroi puun heti. Sekä *WBS auto* että *Numeroi WBS uudelleen* voidaan kumota painikkeella *Kumoa*.

## Valkuilut ja mitä sovellus tekee

**Suodatus, ryhmittely tai lajittelu on päällä.** Näkymän järjestys ei silloin ole aikataulun järjestys, joten sovellus lukitsee rakenteen. *Sisennä* ja *Ulonna* ovat pois käytöstä, ja työkaluvihjeessä lukee *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana*. Alt+→ ja vetäminen näyttävät saman tekstin nauhassa, jossa on painike *Tyhjennä*. Painike poistaa suodatuksen, ryhmittelyn ja lajittelun kerralla, eikä Ctrl+Z palauta niitä. *Sisennä* ja *Ulonna* puuttuvat silloin hiiren oikean painikkeen valikosta.

Alt+↑ ja Alt+↓ toimivat kuitenkin tällaisessa näkymässä ilman viestiä. Pelkällä suodatuksella uusi järjestys näkyy heti. Lajittelun kanssa järjestys aikataulussa muuttuu, mutta muutos näkyy vasta, kun *Tyhjennä* on painettu.

**WBS auto on pois päältä.** Uusi tehtävä saa koodin, joka sopii sen paikkaan puussa, vaikka toisella tehtävällä on jo sama koodi. Näin voi syntyä päällekkäisiä numeroita. Myös sisentämisen jälkeen koodit eivät enää vastaa puuta. *Numeroi WBS uudelleen* korjaa molemmat.

**Välitavoitteelle lisätään alitehtävä.** Välitavoite on hetki, eikä sillä ole alitehtäviä. Sovellus poistaa välitavoitemerkinnän ja ilmoittaa siitä.

**Tehtävällä, jolla on resurssikohdistuksia, lisätään alitehtäviä.** Yhteenvetotehtävällä ei ole itsellään kohdistuksia. Sovellus siirtää ne ensimmäiseen uuteen alitehtävään, joka voi kantaa ne, ja ilmoittaa siitä. Jos sellaista alitehtävää ei ole, tai sillä on jo sama resurssi, mitään ei tapahdu ja viesti kertoo syyn.

**Riippuvuus loisi kehän.** Yhteenvetotehtävän riippuvuudet koskevat myös sen alitehtäviä. Jos siirtäminen loisi tämän vuoksi kehän, sovellus kieltäytyy siitä viestillä *Tämä siirtäminen loisi aikatauluun kehän (…)*. Mitään ei muutu.

**Riippuvuus tehtävän ja oman vaiheensa välillä.** Jos tehtävä ripustetaan vaiheen alle, johon sillä on jo riippuvuus, riippuvuus säilyy, mutta ei enää vaikuta laskentaan. Sovellus ilmoittaa siitä. Lisätietoja yhteenvetotehtävien riippuvuuksista on kohdassa [Riippuvuudet ja viive](docs://uitleg-relaties).

**Aikataulu ei ole enää ajan tasalla.** Siirtäminen toiseen vaiheeseen voi muuttaa päivämääriä. Paina **Laske** (F5). Pelkkä järjestyksen vaihto saman vaiheen sisällä ei muuta päivämääriä.

## Katso myös

- [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen): aseta uudet tehtävät oikeaan paikkaan.
- [WBS-mallien tallentaminen ja lisääminen](docs://howto-wbs-sjablonen): käytä koko vaihe uudelleen.
- [Riippuvuuksien lisääminen](docs://howto-relaties-leggen): linkitse tehtävät toisiinsa.
- [Tehtävien valitseminen, poistaminen ja kumoaminen](docs://howto-taken-selecteren-verwijderen): kumoa siirtäminen.
- [Refurbishment & Extension of a Family Home](examples://showcase-verbouwing-eengezinswoning.ifc): neljä vaihetta alitehtävineen, rakennettuna sisentämällä.
