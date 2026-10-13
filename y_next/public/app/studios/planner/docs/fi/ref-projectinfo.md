# Uusi projekti ja Projektitiedot

Kentät *Uusi projekti* -ikkunassa ja *Projektitiedot*-lomakkeessa: mitä kukin kenttä tekee, mikä on oletus ja missä se vaikuttaa. Ne ovat saman lomakkeen kaksi puolta. *Uusi projekti* luo uuden projektin ja sisältää muutaman lisäkentän. *Projektitiedot* muuttaa avoinna olevaa projektia.

## Avaaminen

**Uusi projekti** — *Tiedosto › Uusi*, Ctrl+N tai plusmerkki dokumenttivälilehtien oikealla puolella (*Aloita projekti*, sitten *Luo uusi projekti*). Ikkuna avautuu, ja kohdistin on kentässä *Projektin nimi*.

**Projektitiedot** — *Asetukset › Projekti › Projektitiedot* avaa lomakkeen ikkunana nimeltä *Projektitiedot*. *Tiedosto › Projektitiedot* näyttää saman lomakkeen *Tiedosto*-näkymässä. Osio *Laskentaprofiili ja laskentavaihtoehdot* on alareunassa molemmissa paikoissa. Mitä siihen kuuluu, kerrotaan kohdassa [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

## Luo, Käytä ja peruuta

**Luo** (*Uusi projekti* -ikkunassa) luo projektin ja avaa sen omassa välilehdessään. **Käytä** (*Projektitiedot*-ikkunassa) kirjoittaa muutokset projektiin.

- **Vain kun napsautetaan Käytä.** Luonnokseen kirjoitetaan. Projekti muuttuu vasta, kun napsautetaan *Käytä*. *Käytä* kirjoittaa vain sen, minkä todella muutettiin, yhtenä vaiheena *Kumoa*-toiminnossa. Jos *Käytä* napsautetaan ilman muutoksia, ei tapahdu mitään eikä vaihetta lisätä.
- **Peruuta, rasti ja Esc** sulkevat ikkunan ilman, että mitään tallennetaan. Napsautus ikkunan viereen ei sulje sitä: kirjoitettu teksti säilyy.
- **Enter** tekee saman kuin *Luo* tai *Käytä*, paitsi kentässä *Kuvaus* ja avoimessa pudotusvalikossa.
- **Tiedosto-näkymässä** *Projektitiedot* näyttää alareunassa tekstin *Muutoksia ei ole sovellettu. Säilytä ne napsauttamalla Käytä.* niin kauan kuin luonnos poikkeaa. Jos näkymästä poistutaan, sovellus kysyy, käytetäänkö muutokset, hylätäänkö ne vai peruutetaanko poistuminen. Lisätietoja: [Valintanauha, välilehti kerrallaan](docs://ref-lint).
- **Mukautettu laskentaprofiili ilman nimeä** estää *Käytä*- ja *Luo*-painikkeet. Anna sille nimi tai hylkää muutos.

## Kentät molemmissa ikkunoissa

**Projektin nimi** — nimi projektin otsikkopalkissa, välilehdellä ja tiedostonimessä, kun tallennetaan. Oletus: tyhjä. Tyhjä kenttä on sallittu: projektin nimi on *Uusi aikataulu*, joka näkyy kentässä harmaana tekstinä. Missä: koko näkymä.

**Kuvaus** — vapaa teksti. Oletus: tyhjä. Vaikutus: tallennetaan projektiin, IFC-tiedostoon ja vientiin Primavera P6 XML -tiedostoon. Kuvaus ei vaikuta aikatauluun.

**Tekijä** — vapaa teksti. Oletus: tyhjä. Vaikutus: menee IFC-tiedostoon ja näkyy raportin otsikossa kohdassa *Tekijä:*. Raportissa sitä ei voi kirjoittaa uudelleen.

**Kirjasto** — mihin kirjastoon projekti on linkitetty. Valittavana ovat *ei kirjastoa (erillinen projekti)*, omat olemassa olevat kirjastot ja *+ Uusi kirjasto…*. Oletus: *Uusi projekti* -ikkunassa oletuskirjasto, *Projektitiedot*-lomakkeessa nykyinen linkki. Vaikutus: katso [Kirjaston käyttäminen](docs://howto-resourcebibliotheek-gebruiken). Kun valitaan *+ Uusi kirjasto…*, nimi kirjoitetaan alapuolelle ilmestyvään kenttään. Kirjasto luodaan vasta kohdassa *Luo* tai *Käytä*, joten peruuttaminen ei jätä mitään jälkeen. Linkki kohdassa *Projektitiedot* muuttuu vain, kun tätä kenttää muokataan itse.

**Asiakas/organisaatio** — vapaa teksti. Oletus: tyhjä. Vaikutus: menee IFC-tiedostoon ja näkyy raportin otsikossa kohdassa *Yritys:*.

**Aloituspäivä** — projektin aloituspäivä. Oletus: *Uusi projekti* -ikkunassa tänään. Mitä kenttä tekee, kerrotaan kohdassa *Mitä aloituspäivä tekee*.

**Päättymispäivä** — projektin suunniteltu loppu. Oletus: tyhjä. Vaikutus: tieto, ei vaatimus. Sovellus ei suunnittele projektia tätä päivää kohti. Päivä näkyy raportin otsikossa ja vienneissä, ja se määrittää, mihin vuoteen asti vapaapäivät luodaan. Pelivaran laskenta ulottuu tähän päivään asti vain Primavera-tiedostossa, kun asetus *Pelivara lasketaan projektin päättymispäivään asti* on päällä (katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies)).

**Oletusmitta uusille tehtäville** — näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Valittavana ovat *Päivät* ja *Tunnit*. Oletus: *Päivät*. Vaikutus ja ehdot: katso [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).

**Laskentaprofiili ja laskentavaihtoehdot** — *Projektitiedot*-lomakkeessa koko osio. *Uusi projekti* -ikkunassa vain avattava valikko *Laskentaprofiili*, jossa ovat *Primavera P6*, *Microsoft Project* ja *Open Planner Studio*. Oletus: *Open Planner Studio*. Laskentaprofiilin valinta asettaa myös sen oletusvaihtoehdot. Katso [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies).

## Vain Uusi projekti -ikkunassa

**Vaihepohja** — mitkä vaiheet projekti aloittaa. Valittavana ovat *Tyhjä*, *Asuntorakentaminen* ja *Toimitilarakentaminen / saneeraus*. Oletus: *Tyhjä*. Vaikutus: *Tyhjä* antaa projektin ilman tehtäviä. Kaksi muuta lisäävät valmiiksi kahdeksan vaihetehtävää. Kunkin kesto on 5 projektin oletusmitassa (5 työpäivää, tai 5 tuntia, jos *Tunnit* valitaan kohdassa *Oletusmitta uusille tehtäville*). Riippuvuuksia ei ole. Ne nimetään, siirretään ja laajennetaan itse. Asuntorakentamisen vaiheet ovat: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking ja Oplevering. Toimitilarakentamisen ja saneerauksen vaiheet ovat: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen ja Oplevering. Nimet ovat projektin tietoja. Ne pysyvät hollanniksi, myös muulla käyttöliittymän kielellä. Jos *Ota rakennustila käyttöön* on pois päältä, on olemassa vain *Tyhjä*. Katso [Asetukset](docs://ref-instellingen).

**Työvuoro** — näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä. Valittavana ovat *Päivätyövuoro*, *2 työvuoroa*, *3 työvuoroa* ja *24/7*. Oletus: *Päivätyövuoro*. Vaikutus: *Päivätyövuoro* jättää vakiokalenterin ennalleen, eli tavallisen päiväkalenterin maanantaista perjantaihin. Muut kolme lisäävät projektikalenteriin työaikalohkot, samoin kuin *Kalenterit*-ikkunan samannimiset painikkeet. Mitkä ajat ne ovat, kerrotaan kohdassa [Työaikojen asettaminen](docs://howto-werktijden-instellen). Kun *Päivätyövuoro* on valittu, *Tunnit* ei ole valittavissa kohdassa *Oletusmitta uusille tehtäville*, koska päiväkalenterissa ei ole lohkoja.

**Vapaapäiväluettelo** — mitkä vapaapäivät projektikalenteri saa. Kohdassa *Maa* valitaan *Alankomaat* (oletus), *Saksa*, *Belgia*, *Ranska*, *Iso-Britannia*, *Itävalta*, *Sveitsi*, *Ei vapaapäiviä* tai *Mukautettu…*. Jos maassa on alueita, lisätään avattava valikko *Alue*. Alankomaille valitaan myös *Rakennusalan kesäloma*, jos *Ota rakennustila käyttöön* on päällä: *Ei mitään* (oletus), *Pohjoinen*, *Keski* tai *Eteläinen*. Sen alla on rivi, esimerkiksi *36 vapaapäivä(ä), 2025–2029*. Kun se laajennetaan, luettelo tulee näkyviin. Vuodet kulkevat aloitusvuotta edeltävästä vuodesta päättymisvuotta seuraavaan vuoteen. Jos päättymispäivää ei ole, vuodet kulkevat kolmeen vuoteen aloitusvuoden jälkeen. *Mukautettu…* antaa kalenterin ilman vapaapäiviä ja avaa heti luomisen jälkeen *Kalenterit*-ikkunan, jotta ne voidaan täyttää itse. Projektikalenterin nimi on *Bouwkalender NL*, tai *Standaardkalender*, jos *Ota rakennustila käyttöön* on pois päältä. Valinta on silloin myös *Ei vapaapäiviä*. Miten generaattori toimii, kerrotaan kohdassa [Vapaapäivien ja rakennusalan kesälomän luominen](docs://howto-feestdagen-genereren).

## Mitä aloituspäivä tekee

Aloituspäivä on projektin ankkuri. Kolme sääntöä:

- **Uudet tehtävät alkavat aloituspäivänä.** Lisätty tehtävä saa projektin aloituspäivän suunnitelluksi alkupäiväksi.
- **Tehtävä, jolla on edeltäjä, ei ala koskaan ennen aloituspäivää.** Jos edeltäjän loppu on aiemmin, tehtävä odottaa aloituspäivään asti. Tehtävä *ilman* edeltäjää säilyttää oman päivänsä, vaikka se olisi ennen aloituspäivää. Tämä tarvitaan, jotta MS Project- tai Primavera-aikataulu näkyy samalla tavalla kuin lähdeohjelmassa. Rajoite *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* rikkoo molemmat säännöt: tällainen tehtävä pysyy päivässään, vaikka se osuisi ennen aloituspäivää.
- **Myöhempi aloituspäivä siirtää vapaita tehtäviä mukanaan.** Jos aloituspäivä asetetaan myöhemmäksi kohdassa *Projektitiedot* ja napsautetaan *Käytä*, tehtävät siirtyvät uudelle päivälle samassa vaiheessa *Kumoa*-toiminnossa. Kyse on tehtävistä ilman edeltäjää ja ilman rajoitetta, joka asettaa alarajan (*Alkaa aikaisintaan*, *Täytyy alkaa*, *Päättyy aikaisintaan* tai *Täytyy päättyä*). Näiden tehtävien päivä olisi uutta päivää edellä. Sovellus kertoo, kuinka monta tehtävää siirrettiin. Tämä tapahtuu vain, kun aloituspäivä muutetaan itse, ei koskaan tiedostoa avattaessa. Aloituspäivän myöhentäminen ei siirrä muuta aikataulua. Sen tekee *Siirrä projekti*, katso [Projektin siirtäminen](docs://howto-project-verplaatsen).

## Katso myös

- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): osio *Laskentaprofiili ja laskentavaihtoehdot*.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi profiili muuttaa tulosta.
- [Projektin siirtäminen](docs://howto-project-verplaatsen): koko aikataulu toiseen alkupäivään.
- [Tehtävien ja välitavoitteiden lisääminen](docs://howto-taken-en-mijlpalen-toevoegen): ensimmäisten tehtävien aloittaminen.
- [Vapaapäivien ja rakennusalan kesälomän luominen](docs://howto-feestdagen-genereren): vapaapäiväluettelo yksityiskohtaisesti.
