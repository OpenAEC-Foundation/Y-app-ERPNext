# Polun jäljittäminen

Tavoite: tehdä tehtävien ketju näkyväksi ennen tehtävää tai sen jälkeen, jotta nähdään, mikä määrää tehtävän ajankohdan ja mikä siirtyy, jos tehtävä myöhästyy.

## Milloin tätä tarvitaan

Kattotyö alkaa vasta kolmen viikon kuluttua, ja halutaan tietää, mikä tehtävä sen ratkaisee. Tai muurari myöhästyy viikon, ja halutaan nähdä, mitkä sen jälkeiset tehtävät siirtyvät. Aikataulussa, jossa on kymmeniä riippuvuuksia, sitä ei voi nähdä viivoista. **Polun jäljittämisellä** sovellus värittää kaikki **edeltäjät** (tehtävät, jotka tulevat ennen valittua tehtävää suoraan tai muiden tehtävien kautta) ja **seuraajat** (tehtävät, jotka tulevat sen jälkeen), ja muut himmennetään.

## Vaiheet

1. Valitse tehtävä, jonka polku halutaan nähdä, tehtävätaulukosta tai sen palkista Gantt-kaaviossa. Jos valitaan useita tehtäviä, sovellus jäljittää polun ensin valitusta tehtävästä.
2. Valitse *Aikataulu › Polun jäljittäminen › Edeltäjät* kaikelle, mikä tulee ennen tehtävää, tai *Aikataulu › Polun jäljittäminen › Seuraajat* kaikelle, mikä tulee sen jälkeen. Molemmat painikkeet voivat olla päällä samaan aikaan. Samat kaksi painiketta ovat *Taulukko*-välilehdellä, ryhmässä *Polun jäljittäminen*.
3. Jos halutaan molemmat suunnat kerralla, napsauta tehtävää hiiren oikealla painikkeella Gantt-kaaviossa tai tehtävätaulukossa ja valitse *Jäljitä polku*.
4. Katso tulos Gantt-kaaviosta ja tehtävätaulukosta. Sen lukeminen selitetään alla.
5. Lopeta jäljittäminen napsauttamalla aktiivista painiketta uudelleen, napsauttamalla tehtävää hiiren oikealla painikkeella ja valitsemalla *Lopeta polun jäljittäminen*, tai painamalla Esc. Esc poistaa myös valinnan.

Jos valitaan toinen tehtävä jäljittämisen aikana, polku seuraa uutta valintaa.

## Tuloksen lukeminen

- Edeltäjät ovat kultaisia, seuraajat violetteja. Gantt-kaaviossa palkkien väri muuttuu. Tehtävätaulukossa rivin vasemmalle puolelle ilmestyy raita: edeltäjillä yhtenäinen, seuraajilla katkoviiva. Valitulla tehtävällä on ääriviiva.
- Tummempi väri, tehtävätaulukossa paksumpi raita ja lihavoitu teksti, merkitsee ketjua, jonka muodostavat **ohjaavat riippuvuudet**: riippuvuudet, jotka todella määräävät päivämäärät. Mitä se tarkoittaa, selitetään kohdassa [Riippuvuudet ja viive](docs://uitleg-relaties).
- Kaikki polun ulkopuoliset tehtävät himmennetään. Riippuvuusviivat, jotka eivät kuulu polkuun, ovat himmeämpiä ja pisteviivoja.

## Sudenkuopat ja sovelluksen toiminta

**Tehtävää ei ole valittu.** Ilman valittua tehtävää ei ole mitään jäljitettävää: painike on päällä, mutta näytössä ei muutu mitään. Valitse ensin tehtävä.

**Ohjaavien riippuvuuksien ketjun korostus puuttuu.** Korostus tulee viimeisimmästä laskennasta. Jos aikataulua ei ole vielä laskettu tai laskenta antaa virheen, sovellus värittää kaikki edeltäjät ja seuraajat yhtä voimakkaasti. Paina **Laske** (F5) esimerkiksi kohdasta *Aloitus › Aikataulu › Laske* ja katso polku uudelleen. Muutoksen jälkeen korostus perustuu edelleen edelliseen laskentaan niin kauan kuin tilarivillä lukee *Vanhentunut — laske uudelleen (F5)*.

**Riippuvuus vaiheeseen.** Jäljitys seuraa riippuvuuksia sellaisina kuin ne on luotu. Riippuvuus vaiheesta tai vaiheeseen (yhteenvetotehtävä) yhdistää itse vaiheen. Laskennassa se koskee jokaista vaiheen tehtävää, mutta polku ei jatku vaiheen sisällä oleviin tehtäviin. Jos jäljitetään tehtävää vaiheen sisältä, ja vaihe on yhdistetty toiseen tehtävään vaiheen omalla riippuvuudella, tätä riippuvuutta ei siis näy. Valitse siinä tapauksessa vaihe itse.

**Vain valittu suunta.** Jos vain *Edeltäjät* on päällä, ei nähdä, mitä tehtävän jälkeen tulee, ja päinvastoin.

## Katso myös

- [Riippuvuudet ja viive](docs://uitleg-relaties): miksi tietty riippuvuus on ohjaava riippuvuus ja miten sovellus laskee tehtävän alkupäivän.
- [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad): mikä ketju määrää projektin päättymispäivän.
- [Riippuvuuden lisääminen](docs://howto-relaties-leggen): riippuvuuden lisääminen, jos polussa on puuttuva riippuvuus.
