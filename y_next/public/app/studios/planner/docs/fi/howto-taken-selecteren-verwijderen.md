# Tehtävien valitseminen, poistaminen ja kumoaminen

Tavoite: tehtävien valitseminen, poistaminen ja virheen kumoaminen.

## Milloin tarvitset tätä

Lähes kaikki toiminnot aikataulussa kohdistuvat valittuihin tehtäviin: poistaminen, kopiointi, sisentäminen sekä välitavoitteen kytkeminen päälle tai pois. Tehtäviä poistetaan, kun työ jää pois tai aikataulua muutetaan. Koska sovellus ei pyydä vahvistusta poistettaessa, *Kumoa* on turvaverkko.

## Vaiheet

### Tehtävien valitseminen

- **Yksi tehtävä.** Napsauta riviä tehtävätaulukossa tai palkkia Gantt-kaaviossa.
- **Useita tehtäviä.** Ctrl+napsautus (⌘+napsautus Macissa) lisää tehtävän valintaan tai poistaa sen valinnasta. Tehtävätaulukossa Shift+napsautus valitsee kaikki tehtävät aktiivisesta tehtävästä napsauttamaasi tehtävään asti.
- **Kaikki näkyvät tehtävät.** Paina Ctrl+A, kun kohdistus on tehtävätaulukossa tai Gantt-kaaviossa. Suodattimen piilottamat tehtävät jäävät valinnan ulkopuolelle, samoin tiivistetyn vaiheen alitehtävät.
- **Laatikko Gantt-kaaviossa.** Pidä Ctrl painettuna ja vedä tyhjän taustan yli. Kaikki tehtävät niillä riveillä, joihin laatikko koskee, valitaan, vaikka niiden palkki on laatikon vieressä. Ratkaisee vain laatikon korkeus, ei aika-akseli. Jos Ctrl vapautetaan vasta hiiren painikkeen jälkeen, tehtävät lisätään olemassa olevaan valintaan. Muuten ne korvaavat sen. Ilman Ctrl-näppäintä tuo veto vierittää aikajanaa oletusasetuksella.
- **Ei mitään.** Paina Esc tai napsauta tyhjää taustaa Gantt-kaaviossa.

Kun yhteenvetotehtävä valitaan, sen alitehtäviä ei valita mukaan. Poistaminen ja kopiointi kuitenkin vievät ne mukanaan.

### Tehtävien poistaminen

Valitse tehtävät ja käytä jotakin seuraavista tavoista:

- *Aloitus › Muokkaa › Poista*. Sama painike on välilehdellä *Taulukko*.
- Delete tai Backspace, jos kohdistus ei ole tehtävätaulukossa. Napsauta siis ensin palkkia Gantt-kaaviossa.
- *Poista* hiiren kakkospainikkeen valikossa. Jos napsauttamasi tehtävä kuuluu valintaan, komento koskee koko valintaa. Muuten se koskee vain tuota yhtä tehtävää.
- Pieni roskakori *Ominaisuudet*-paneelin yläosassa (ohjeteksti *Poista tehtävä*). Se poistaa paneelin näyttämän tehtävän.

Sovellus ei pyydä vahvistusta. Jos poistat useita tehtäviä kerralla, *Kumoa* peruu ne yhdellä vaiheella.

Poiston yhteydessä häviävät: kaikki poistetun yhteenvetotehtävän alitehtävät, kaikki poistettuihin tehtäviin tai niistä lähtevät riippuvuudet sekä niiden resurssikohdistukset. Jos poistat yhteenvetotehtävän viimeisen alitehtävän, siitä jää jäljelle tavallinen tehtävä. Jos *WBS auto* on päällä, sovellus numeroi rakenteen uudelleen. Aikataulu ei ole sen jälkeen enää ajan tasalla: paina **Laske** (F5), ellei *Laske automaattisesti* ole päällä.

### Tiivistäminen ja laajentaminen

Yhteenvetotehtävän nimen edessä on tehtävätaulukossa kolmio. Napsauta sitä, kun haluat piilottaa tai näyttää sen alitehtävät. Komennoilla *Näkymä › Jäsennys › Tiivistä* ja *Laajenna* toimitaan valittujen yhteenvetotehtävien kanssa. Jos mitään ei ole valittu, komento koskee kaikkia. Yhteenvetotehtävän kakkospainikkeen valikossa on myös *Tiivistä* ja *Laajenna*. Ryhmitellyssä näkymässä painikkeet koskevat ryhmiä.

Sovellus muistaa tiivistämisen ja laajentamisen erikseen kullekin avoimelle asiakirjalle. Ne eivät kuulu komentoon *Kumoa* eivätkä ole projektitiedostossa.

### Kumoaminen ja uudelleen tekeminen

- *Aloitus › Muokkaa › Kumoa* ja *Tee uudelleen* (myös välilehdellä *Taulukko*), otsikkopalkin nuolet tai Ctrl+Z kumoamiseen sekä Ctrl+Y tai Ctrl+Shift+Z uudelleen tekemiseen.
- Jos teet uuden muutoksen kumoamisen jälkeen, *Tee uudelleen* häviää.

*Kumoa* koskee projektitietojen muutoksia (tehtäviä, riippuvuuksia, resursseja, kalentereita ja vastaavia) sekä asettelun käyttämistä. Tehtävätaulukon sarakkeiden muutokset ovat myös vaiheita: sarakkeen lisääminen, poistaminen, siirtäminen, koon muuttaminen, automaattinen sovittaminen, kiinnittäminen ja sarakeasettelun palauttaminen oletukseksi. Nämä sarakevaiheet kuuluvat itse tehtävätaulukkoon ja koskevat koko sovellusta, eivät yhtä asiakirjaa. Sovellus säilyttää kullekin asiakirjalle viimeiset sata vaihetta. Hyvin suurelle projektille niitä säilytetään vähemmän.

## Sudenkuopat ja sovelluksen toiminta

**Delete tehtävätaulukossa ei poista tehtävää.** Kun kohdistus on tehtävätaulukossa, Delete tai Backspace tyhjentää valittujen solujen sisällön. Pakollisen tai lasketun solun, kuten nimen tai keston, kohdalla sovellus ei suorita komentoa ja näyttää viestin tehtävätaulukon alla. Nimen kohdalla viesti on esimerkiksi *Tämä arvo on pakollinen eikä sitä voi jättää tyhjäksi.* Silloin mitään ei tyhjennetä, ei edes muissa valituissa soluissa. Gantt-kaaviossa voi napsauttaa palkkia tai käyttää *Poista*-komentoa (välilehdellä *Taulukko*, jolla ei ole Gantt-kaaviota: *Taulukko › Muokkaa › Poista* tai kakkospainikkeen valikko).

**Koko vaihe häviää kerralla.** Kun poistat yhteenvetotehtävän, sen alitehtävät sekä niiden riippuvuudet ja resurssikohdistukset häviävät mukana. *Kumoa* (Ctrl+Z) palauttaa kaiken, myös riippuvuudet ja resurssikohdistukset.

**Mikä ei palaudu.** Valinta, tiivistäminen ja laajentaminen sekä painike *Tyhjennä* ilmoitusrivillä *Ei käytettävissä suodatuksen, ryhmittelyn tai lajittelun aikana* eivät kuulu komentoon *Kumoa*. Jos painat Ctrl+Z painikkeen *Tyhjennä* jälkeen, kumoat siis edellisen vaiheen etkä tyhjentämistä.

**Tehtävän poistaminen, johon muut tehtävät ovat riippuvaisia.** Myös riippuvuudet, jotka kulkevat tuohon tehtävään tai siitä pois, häviävät. Tehtävät, jotka olivat kiinni vain siinä, irtoavat. Kun **Laske** on suoritettu, ne alkavat taas omasta suunnitellusta alkamispäivästään. Uusia riippuvuuksia voi tarvittaessa lisätä, katso [Riippuvuuksien lisääminen](docs://howto-relaties-leggen).

## Katso myös

- [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen): päinvastainen toiminta sekä tehtävien kopioiminen.
- [Rakenteen muokkaaminen](docs://howto-structuur-aanpassen): tehtävän voi siirtää toisen vaiheen alle poistamisen sijaan.
- [Vetäminen, siirtäminen ja zoomaus Gantt-kaaviossa](docs://howto-gantt-bedienen): valintalaatikko ja vieritystilat.
- [Kakkospainikkeen valikot](docs://ref-contextmenus): mitä *Poista* ja muut kohdat tekevät valinnalle.
