# Ilmoitukset ja varoitukset

Sovellus kertoo, mitä tapahtuu, kolmessa paikassa: alareunan tilarivillä, oikeanpuoleisessa sarakkeessa olevassa *Varoitukset*-paneelissa ja ilmoituksissa, jotka näkyvät lyhyen aikaa näytön alareunassa. Tässä artikkelissa kerrotaan kustakin paikasta, mitä siinä näkyy, milloin se näkyy ja mitä siinä voi tehdä. Miksi aikataulu on kriittinen tai ylikuormitettu, kerrotaan kohdassa [Kriittinen polku ja pelivara](docs://uitleg-kritiek-pad). Ylikuormituksen ratkaiseminen on kohdassa [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen). Riippuvuuksien luominen on kohdassa [Riippuvuuksien luominen](docs://howto-relaties-leggen).

## Kolmen välinen ero

- **Tilarivi** — kiinteä rivi laskureilla. Ne tulevat viimeisimmästä laskennasta ja pysyvät, kunnes aikataulu lasketaan uudelleen.
- **Varoitukset-paneeli** — luettelo, joka on laskureiden takana. Siinä on kaikki, mitä viimeisin laskenta löysi. Napsautus vie tehtävään, riippuvuuteen tai resurssiin. Luettelo johdetaan viimeisimmästä laskennasta, eikä mitään tallenneta.
- **Ilmoitukset** — lyhyet viestit siitä, mitä juuri tehtiin (tallennus epäonnistui, riippuvuus hylättiin, tuonti luettiin). Ne katoavat itsestään, eivätkä ne ole paneelissa.

## Tilarivi

Alareunan tilarivi näyttää vasemmalta oikealle:

- **Tehtävät:** — lehtitehtävien määrä (yhteenvetotehtävät eivät ole mukana).
- **Välitavoitteet:** — välitavoitteiden määrä.
- **Kriittinen polku: N tehtävää, N työpäivää** — kriittisten tehtävien määrä ja projektin kesto. Näkyy vain laskennan jälkeen.
- **Loppu:** — projektin päättymispäivä laskennasta. Näkyy vain laskennan jälkeen; tyhjässä projektissa sitä ei ole.
- **N tavoitepäivä(ä) ylitetty**, **N rajoite(tta) rikottu**, **N järjestyksestä poikkeava edistyminen** ja **N resurssi(a) ylikuormitettu** — kukin on painike, jossa on varoitusmerkki. Se näkyy vain, kun laskuri on yli 0 ja laskenta on tehty. Napsautus avaa *Varoitukset*-paneelin (vihjeteksti: *Avaa varoituspaneeli (tiedot ja navigointi)*). Jos välilehti on *IFC* tai *Raportti*, sovellus siirtyy samalla kohtaan *Aloitus*, koska oikeanpuoleista saraketta ei ole siellä. Laskuri *N resurssi(a) ylikuormitettu* päivittyy myös resurssien ja resurssikohdistusten muutosten jälkeen. Muut laskurit muuttuvat vasta, kun *Laske*-komento on suoritettu. Nämä neljä laskuria ovat valinta: se, mitä paneeli näyttää lisäksi (katkaistu limitys, ohitettu riippuvuus, riippumatto ilman loppua ohjaavaa riippuvuutta, katkaistu loppupäivä, aikataulun virhe), ei ole tilarivillä.
- **Vanhentunut — laske uudelleen (F5)** — varoitusmerkillä (vihjeteksti: *Aikataulu on vanhentunut — laske uudelleen (F5)*). Näkyy heti, kun jotakin muutetaan, mikä vaikuttaa aikatauluun, eikä aikataulua ole laskettu uudelleen. Kun *Laske automaattisesti* on päällä, se ei näy. Poikkeus on laskennan virhe: silloin se jää näkyviin.
- **Valinta: N tehtävä(ä)** — valittujen tehtävien määrä. Näkyy vain, kun jotakin on valittu.
- **Mittakaava:** ja **Zoom: N px/päivä** — aikajanan aikaskaala ja zoomitaso. Aikaskaala määräytyy zoomitasosta.
- **Tallentamaton** — niin kauan kuin asiakirjassa on muutoksia, joita ei ole tallennettu tiedostoon.
- **AI** — väripiste ja sana AI, vain kun AI-tila on päällä. Vihjeteksti näyttää *AI-silta:* ja tilan: *Pois*, *Aktiivinen portissa N*, *Portti N on varattu* tai *Virhe*. Napsautus avaa *AI*-välilehden.
- **Debug-terminaali** — terminaalipainike, joka näkyy vain, kun debug-terminaali on otettu käyttöön. Se näyttää tai piilottaa terminaalin (*Näytä debug-terminaali* / *Piilota debug-terminaali*).

## Varoitukset-paneeli

- **Avaaminen** — *Aikataulu › Aikataulu › Varoitukset*, *Näkymä › Paneelit › Varoitukset*, tai laskuri tilarivillä. Paneeli on oikeanpuoleisessa sarakkeessa, *Ominaisuudet*-paneelin ja resurssitelakan alapuolella. Se avaa supistetun sarakkeen. Oletuksena paneeli on suljettu, eikä sitä muisteta istuntojen välillä. Kun paneeli on muiden paneelien alla, sen korkeutta muutetaan vetämällä reunasta. Tämä korkeus muistetaan. Rasti oikeassa yläkulmassa sulkee paneelin (*Sulje varoitukset*).
- **Otsikkorivi** — *Virheitä: N, varoituksia: N*. Jos mitään ei ole vielä laskettu, näkyy *Ei vielä laskettu — paina Laske (F5) suorittaaksesi tarkistukset*.
- **Laske** — painike otsikkorivillä. Se näkyy, niin kauan kuin aikataulu on vanhentunut tai sitä ei ole vielä laskettu. Se tekee saman kuin *Laske* valintanauhassa.
- **Varoitusmerkki otsikkorivillä** — kun aikataulu on vanhentunut, vihjetekstinä *Aikataulu vanhentunut — tämä luettelo on viimeisimmästä laskennasta. Laske uudelleen (F5)*. Luetteloa ei piiloteta, vaan se merkitään vanhentuneeksi.
- **Tyhjä luettelo** — *Ei varoituksia. Aikataulu täyttää kaikki tarkistukset*.
- **Rivi** — ylhäällä paikka (tehtävä, riippuvuus, resurssi tai projekti) ja sen alla kuvaus. Virheellä on oma kahdeksankulmainen merkki, varoituksella kolmionmuotoinen merkki. Tehtävä näkyy muodossa `WBS-nimi`. Riippuvuus näkyy muodossa `edeltäjä → seuraaja (FS+2d)`, tyyppi ja viive mukaan lukien. Napsautus vie paikkaan (vihjeteksti *Siirry: …*), katso alla. Rivi, joka kuuluu aktiiviseen tehtävään (riippuvuudessa sen seuraajaan) tai histogrammissa valittuun resurssiin, korostetaan.
- **Järjestys** — ensin virheet. Sen jälkeen rivit lajeittain alla olevan luettelon järjestyksessä. Lajin sisällä järjestys on asiakirjan mukainen: riippuvuudessa seuraajan mukaan, resurssissa resurssiluettelon mukaan. Tehtävä, riippuvuus tai resurssi, joka on poistettu viimeisimmän laskennan jälkeen, poistuu luettelosta.

### Varoitustyypit

- **Aikataulun virhe** — *Aikataulua ei voitu laskea: …* ja syy sen jälkeen, katso alla. Napsautus: kehän tapauksessa sovellus valitsee kaikki kehän tehtävät ja siirtyy ensimmäiseen. Muissa virheissä ei ole kohdetta, johon siirtyä, eikä rivi ole painike.
- **Tavoitepäivä ylitetty** — *Tavoitepäivä {date} ylitetty — varhaisin valmistumispäivä {date}*. Tehtävällä on tavoitepäivä, eikä laskenta täytä sitä. Napsautus siirtää tehtävään. Korjaus: muokkaa logiikkaa tai kestoa, tai siirrä tavoitepäivää.
- **Rikottu rajoite** — *Logiikka ylittää rajoitteen {type and date} (negatiivinen pelivara)*. Rajoitetta ei voida täyttää rikkomatta logiikkaa, ja pelivara on negatiivinen. Napsautus siirtää tehtävään. Katso [Rajoitteet](docs://uitleg-constraints).
- **Järjestyksestä poikkeava edistyminen** — *Järjestyksestä poikkeava edistyminen: seuraajan edistyminen on ristiriidassa riippuvuuden kanssa*. Seuraajan edistyminen ei sovi riippuvuuden tyyppiin. Esimerkiksi seuraaja on jo käynnissä, vaikka edeltäjää ei ole vielä tehty lopusta alkuun -riippuvuudessa. Napsautus valitsee molemmat tehtävät, ja seuraaja on aktiivinen. Tarkista todelliset päivämäärät tai riippuvuus.
- **Limitys katkaistu** — *Limitys katkaistu projektin aloituspäivän vuoksi — riippuvuutta ei noudateta täysin*. Riippuvuuden limitys ulottuu projektin aloituspäivää ennen. Napsautus valitsee molemmat tehtävät.
- **Riippuvuus ohitettu** — *Riippuvuus ohitettu: edeltäjä tai seuraaja puuttuu tai ei ole lehtitehtävä*. Laskenta ei käytä riippuvuutta. Napsautus valitsee tehtävät, jotka ovat yhä olemassa. Katso [Riippuvuudet](docs://uitleg-relaties).
- **Riippumatto ilman loppua ohjaavaa riippuvuutta** — *Riippumatto ilman loppua ohjaavaa riippuvuutta (ei FF- tai SF-edeltäjää): kesto palautuu nollaan*. Napsautus siirtää tehtävään. Katso [Riippumattotehtävät](docs://howto-hammock).
- **Loppupäivä katkaistu** — *Loppupäivä katkaistu: kalenteri tekee tehtävän aikaikkunasta käyttökelvottoman*. Laskenta saavutti hakemiensa päivien enimmäismäärän, esimerkiksi siksi, että kalenterissa on hyvin pitkä yhtäjaksoinen sarja vapaapäiviä. Napsautus siirtää tehtävään. Katso [Kalenterit ja työpäivät](docs://uitleg-kalenders).
- **Ylikuormitus** — *Ylikuormitus N pv (first – last)*. Jos kaikki päivät ovat vapaapäiviä, lisätään *resurssi ei tee työtä näinä päivinä kalenterinsa mukaan*. Sekatapauksessa lisätään *joista N pv resurssi ei tee työtä kalenterinsa mukaan*. Napsautus valitsee tehtävät, joilla on resurssikohdistus kyseiseen resurssiin, kytkee histogrammin päälle ja valitsee siinä kyseisen resurssin. Välilehdeltä *Taulukko*, *IFC* tai *Raportti* sovellus siirtyy kohtaan *Resurssit*. Katso [Resurssipaneeli](docs://ref-resourcepaneel).

### Aikataulun virheen syyt

- *Kehäriippuvuus tehtävien välillä: {path}* — riippuvuudet muodostavat kehän. Tehtävät ovat polussa. Käännä tai poista yksi riippuvuus.
- *Kalenterissa ei ole asetettu työpäiviä* — anna kalenterille vähintään yksi työpäivä, katso [Kalenteriajat](docs://ref-kalenders).
- *Virheellinen kesto päivinä tehtävälle '{task}'* ja *Virheellinen kesto tunteina tehtävälle '{task}'* — tehtävän kesto ei ole kelvollinen luku.
- *Tuntitehtävällä '{task}' ei ole kelvollisia työtunteja kalenterissaan* — tehtävä on tuntitehtävä, ja sen kalenterissa ei ole työtunteja.
- *Virheellinen aloituspäivä tehtävälle '{task}'* — tehtävän aloituspäivä ei ole kelvollinen.

## Ilmoitukset

Ilmoitukset näkyvät ruudun alareunassa, myös taulukossa, Backstagessa ja esitystilassa. Ilmoitus on *virhe* tai *tieto*. Virhe pysyy näkyvissä, kunnes se suljetaan. Tieto häviää 5 sekunnin kuluttua. Nämä ajastimet alkavat alusta heti, kun pino muuttuu. Ilmoitusta napsautettaessa se suljetaan (ohjeteksti *Sulje ilmoitus*). Kerralla näkyy enintään kolme ilmoitusta: kun neljäs tulee, poistuu ensin vanhin tieto. Jos tietoa ei ole, poistuu vanhin ilmoitus. Tieto ei koskaan työnnä virhettä pois. Pino siirtyy pois avoimen valintaikkunan painikkeiden ja kiinteiden toimintapalkkien tieltä.

- **Laskuri ×N** — ilmoitus, jolla on kiinteä avain, kokoaa toiston yhdeksi riviksi laskurilla. Esimerkiksi tallennusvirhe, joka toistuu, tai hylätty riippuvuus, jota yritetään uudelleen. Kaikki ilmoitukset eivät tee näin.
- **Lue lisää** — joillakin ilmoituksilla on linkki *Lue lisää* tai oma aihe (esimerkiksi *Työsäännöt selitettynä*) opastukseen kohdassa Backstage › Ohje.
- **Toimintopainike** — laskentaprofiilia koskevassa ilmoituksessa on painike *Avaa laskentaprofiili*, joka vie projektitietoihin.

Alla oleva luettelo on valikoima, ryhmiteltynä aiheittain. Ellei toisin mainita, ilmoitus on tieto.

### Tallentaminen, avaaminen ja palautus

- **Tallentaminen epäonnistui** (virhe) — *Tallennus epäonnistui*, syy näkyy sen alla. Kun tallennetaan, tallennetaan nimellä tai viedään raportti.
- **Tallennettiin latauksena** (tieto) — *Tallennettiin latauksena: '{name}' on nyt latauskansiossa. …* Kun *Tallenna nimellä* tai vienti tehdään ja ympäristö ei anna sovelluksen kirjoittaa suoraan valittuun paikkaan. Kaksi latausta peräkkäin yhdistyvät yhdeksi riviksi.
- **Tallennettiin latauksena (selitys)** (tieto) — *Tallennettiin latauksena: '{name}' on latauskansiossa. Tämä selain ei anna sovelluksen kirjoittaa omaan paikkaansa, …* Kun *Tallenna* tehdään selaimessa, joka tallentaa vain latauksena. Kerran istunnossa, ja siinä on linkki tiedostoja koskevaan selitykseen.
- **Selain ei kirjoita takaisin** (tieto) — *Tämä selain ei anna sovelluksen kirjoittaa takaisin tiedostoon '{name}'. …* Kun *Tallenna* tehdään projektille, jolla on tiedosto, ja selain pyytää paikkaa uudelleen. Kerran istunnossa, ja siinä on linkki tiedostoja koskevaan selitykseen.
- **Automaattitallennus epäonnistui** (virhe) — *Automaattitallennus epäonnistui*, ja syy näkyy. Koskee automaattista tallennusta tiedostoon ja palautusta sovelluksen kaatumisen jälkeen.
- **Kirjastoa ei voitu tallentaa** (virhe) — *Kirjastoa ei voitu tallentaa*, kun resurssikirjasto tallennetaan.
- **Tiedoston avaaminen epäonnistui** (virhe) — *Avaaminen epäonnistui*, syy näkyy sen alla. Esimerkiksi viimeksi käytetty tiedosto tai tuotu tiedosto.
- **Vanha tai suojattu .mpp** (virhe) — *Tämä .mpp-tiedosto on vanhemmassa muodossa (Project 2007 tai vanhempi)…* tai *Tämä .mpp-tiedosto on salasanasuojattu…*. Molemmissa neuvotaan viemään tiedosto MS Projectista XML-muodossa ja avaamaan se.
- **Virheellinen XER-tiedosto** (virhe) — yksi *XER…*-teksteistä, esimerkiksi *Tämä ei ole kelvollinen tai tuettu XER-tiedosto.* tai *XER-tiedosto sisältää taulun kahdesti.*, ja syy lisätään.
- **IFC-tiedostoa ei voitu lukea** (virhe) — *IFC-tiedostoa ei voitu lukea*, syy näkyy IFC-näkymässä.
- **Palautus** (virhe) — *Palautettua tiedostoa ei voitu lukea*, *Palautus epäonnistui* ja *N palautustiedostoa ei voitu ladata ja ne ohitettiin.* Kun palautetaan odottamattoman sulkeutumisen jälkeen.
- **Haara tallennettiin mallina** (tieto) — *Haara tallennettiin mallina '{name}'*.
- **Viesti laajennuksesta** (tieto, tai virhe, jos laajennus antaa virheen) — *Laajennus {name}: {message}*. Laajennus voi näyttää enintään kolme uutta viestiä 10 sekunnissa, joten ne eivät täytä pinoa. Jos laajennuksen opastuksen vaihe epäonnistuu, näkyy *Laajennuksen {name} vaihe aiheutti virheen. Opastus jatkuu.* Jos laajennuksen projektitiedostoa ei voitu avata, näkyy *Laajennuksen {name} projektitiedostoa {file} ei voitu avata.* Molemmat ovat virheitä.
- **Muutos tuli väliin** (tieto) — *Tekoälyavustajan tai laajennuksen muutos tuli väliin. …* Kun tehtävän valintaikkuna peruutetaan ja tekoälyavustaja tai laajennus on sillä välin muuttanut jotain: tehtävämuokkauksia ennen sitä muutosta ei kumota. Ne jäävät tavallisiksi vaiheiksi kohtaan *Kumoa*.

### Laskeminen

- **Aikataulua ei voitu laskea** (virhe) — *Aikataulua ei voitu laskea*, syy näkyy sen alla (katso *Aikataulun virheen syyt*). Kun *Laske* valitaan, kun vaihdetaan asiakirjaa ja kun tiedosto avataan.
- **Raportointipäivä asetettiin tähän päivään** (tieto) — *Raportointipäivää ei ollut vielä asetettu: se on nyt asetettu tähän päivään ({date}), koska edistyminen mitataan raportointipäivään asti. Sen voi muuttaa kohdassa Aikataulu → Raportointipäivä.* Kun edistys kirjataan projektiin, jolla ei ole raportointipäivää.
- **Kesto on lyhyempi kuin tehty työ** (tieto) — *‘{name}’ on jo {N} % tehty: kesto, joka on lyhyempi kuin tehty työ, ei ole mahdollinen. Kestoa ei muutettu.*

### Riippuvuudet ja hierarkia

- **Riippuvuus luotu** (tieto) — *Riippuvuus luotu: {predecessor} → {successor}*.
- **Riippuvuus hylättiin** (tieto) — *Tämä riippuvuus on jo olemassa*, *Riippuvuus tehtävän ja sen oman tai sen yläpuolisen yhteenvetotehtävän välillä ei ole sallittu.* tai *Tämä riippuvuus loisi aikatauluun kehän ({cycle}), joten sitä ei luotu.* Kehä nimeää tehtävät, joten nähdään, mikä riippuvuus on ensin poistettava tai käännettävä.
- **Siirtymä hylättiin** (tieto) — *Tämä siirtymä loisi aikatauluun kehän ({cycle}): yhteenvetotehtävän riippuvuudet koskevat myös sen alitehtäviä. Mitään ei siirretty.*
- **Riippuvuudet putoavat pois siirron jälkeen** (tieto) — *Siirron jälkeen N riippuvuutta liittää tehtävän sen omaan yhteenvetotehtävään. Ne eivät enää ole mukana laskennassa.*
- **Riippuvuuksia ei luotu lisäyksessä** (tieto) — *N riippuvuutta ei luotu: virheellinen riippuvuus…*, kun liitetään tai lisätään haara.
- **Riippuvuuksia jäi laskennan ulkopuolelle** (tieto) — *Riippuvuuksia ei voitu ottaa mukaan laskentaan: N. Tarkista Edeltäjät- ja Seuraajat-sarakkeet.*
- **Kaksoistunnukset tuonnin jälkeen** (tieto) — *Kohteita, joilla on kaksoistunnus tässä tiedostossa: N. Ne saivat oman tunnuksensa…*

### Tehtävien muokkaus

- **Alku tallennettiin rajoitteeksi** (tieto) — *Tehtävällä '{name}' on edeltäjä: uusi aloitus on tallennettu rajoitteeksi Alkaa aikaisintaan (SNET) {date}. Laske uudelleen (F5), niin tehtävä ei ala ennen tätä päivää.* Kun tehtävän alkua muutetaan ja sillä on edeltäjä. Jos tehtävällä oli jo tällainen rajoite, ilmoitus kertoo, että se siirtyi. Usean tehtävän kohdalla ilmoitetaan määrä.
- **Alkua ei otettu käyttöön** (tieto) — *Tehtävän '{name}' uutta alkua ei otettu käyttöön: tehtävällä on edeltäjä ja rajoite {type} {date}, ja ne määrittävät sen alun. Alkua siirretään muuttamalla tätä rajoitetta.*
- **Välitavoitetta ei voi muuntaa** (tieto) — *'{task}' on resurssikohdistuksia, eikä siitä voi tulla välitavoitetta. Poista ensin resurssikohdistukset.* tai *'{task}' on yhteenvetotehtävä, jolla on alitehtäviä, eikä siitä voi tulla välitavoitetta.* Kun muunnetaan tehtävän valintaikkunassa, ominaisuuspaneelissa, pikavalikossa tai taulukossa.
- **Resurssikohdistus siirrettiin alitehtävään** (tieto) — *Resurssikohdistus ({resources}) on siirretty tehtävästä '{phase}' uuteen alitehtävään '{child}'. Yhteenvetotehtävä ei kanna itse resurssikohdistuksia.* Kun tehtävällä, jolla on resurssikohdistuksia, tulee alitehtäviä.
- **Välitavoitemerkintä poistettiin** (tieto) — *Välitavoite '{phase}' on nyt saanut alitehtäviä ja on muuttunut yhteenvetotehtäväksi; välitavoitemerkintä on poistettu.*
- **Yhteenvetotehtävä hylättiin** (tieto) — *'{phase}' ei voi muuttua yhteenvetotehtäväksi: …* Syy näkyy myös, ja *Mitään ei muutettu.*
- **Soluja ohitettiin liitettäessä** (tieto) — *Ohitettiin N solua: ne ovat vain luku -tilassa (esimerkiksi automaattisesti numeroitu WBS-koodi tai laskettu sarake).*
- **Viittauksia tyhjennettiin liitettäessä** (tieto) — *N viittausta eivät olleet tässä dokumentissa, ja ne tyhjennettiin (tehtäväkalenterit, mukautetut tehtävätyypit, activity codet tai mukautetut kentät lähdedokumentista).*
- **Työsääntö muutti kestoja** (tieto) — *Kalenterimuutoksen jälkeen työsääntö muutti N tehtävän kestoa (työ pysyy, tuntia päivässä muuttui).* Sen yhteydessä on linkki *Työsäännöt selitettynä*.

### Primavera (XER)

- **XER-tiedosto avattu** (tieto) — *XER-tiedosto avattu: N projektiasiakirjaa.* Yksi ilmoitus tiedostoa kohden, vaikka tiedosto avaa useita projekteja. Siinä on linkki *Lue lisää* ja sen alla yksityiskohtarivejä. Aina näkyy *N projektia löytyi.* Vain, kun luku on suurempi kuin 0: *N tyhjää projektia ohitettiin.*, *N projektia perustasosta jätettiin pois.*, *N perustasoa luotiin.*, *N irrallista perustason viittausta ohitettiin.*, *Perustasolle käytettiin suojaavaa varavaihtoehtoa.* ja *N ulkoista riippuvuutta säilytettiin.* Vain, kun merkistökoodaus on muu kuin UTF-8: *Tekstin merkistökoodaukseksi tunnistettiin {encoding}.* Lisäksi, kun luku on suurempi kuin 0: *N jäsentäjän huomautusta.*, *N kalenterihuomautusta.*, *N lukumuodon ongelmaa.*, *N luettelo-arvon varavaihtoehtoa* ja *N P6-aikataulutusasetusta käytti turvallista varavaihtoehtoa.*
- **Päivämäärät sellaisina kuin Primavera ne tallensi** (yksityiskohtarivi samassa ilmoituksessa) — *N tehtävää näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* tai, jos tilaa ei kytketty päälle, *N tehtävää poikkeaa tiedoston päivämääristä. Ne voi näyttää.*
- **XER-lähdearkisto ei kelpaa** (tieto) — *XER-lähdearkisto tässä tiedostossa on käyttökelvoton ja jätettiin pois; projekti itsessään avattiin kokonaan.* Mukana on syy (esimerkiksi *Syy: tarkistussumma ei vastaa lähdetavuja – arkisto on vioittunut.*) ja seuraus (*Aikataulu, laskentaprofiili ja kaikki projektin tiedot IFC-tiedostosta ovat täydellisiä. …*). Kun avataan IFC-tiedosto, jossa aiemmin tallennettua XER-lähdearkistoa ei voida käyttää.
- **Vienti menettää XER-tietoja** (tieto) — *Vienti muotoon {format} menettää XER-lähdetiedot.* Onnistuneen viennin jälkeen muotoon, joka ei ole IFC, projektille, jolla on tietoja, jotka ovat olemassa vain XER-tiedostossa. Sen yhteydessä on linkki *Lue lisää*.

### Tuonti, vienti ja laskentaprofiili

- **Päivämäärät tiedostossa** (tieto) — *N tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* tai *N tehtävää poikkeaa tiedoston päivämääristä. Ne voi näyttää.* Kun avataan tiedosto, jossa on tallennetut päivämäärät.
- **Työ ja työsäännöt näkyvät** (tieto) — *Tämä tiedosto sisältää tallennettua työtä tai omia työsääntöjä. Työsääntö ja jäljellä oleva työ näkyvät tälle projektille.*
- **MS Project -aikataulu luettu** (tieto) — *Tämä MS Project -tiedosto sisältää N tehtävää, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu. Ne tuodaan ja näytetään sellaisina.*
- **Taukoja ei viedä** (tieto) — *N tehtävää, joissa on taukoja, vietiin ilman taukoja: MS Project ja P6 tuntevat tauot vain työn jakautumisena.* Kun viedään MS Projectiin tai Primaveraan.
- **Projektin aloituspäivä siirrettiin** (tieto) — *Projektin aloituspäivä siirrettiin: N tehtävän ankkuria ilman edeltäjää tai rajoitetta siirtyi uuteen aloituspäivään.*
- **Päivämääräikkuna ei enää ohjaa** (tieto) — *MS Projectin päivämääräikkuna ei enää ohjaa N tehtävää tämän muokkauksen jälkeen; …* Kerran asiakirjaa kohden.
- **Tasaamisviive pyöristetty** (tieto) — *Tasaaminen pyöristää N tehtävän MS Projectin minuuttitarkan tasaamisviiveen kokonaisiin työpäiviin.* Kerran asiakirjaa kohden.
- **Laskentaprofiili otettiin käyttöön** (tieto) — *Tämä projekti lasketaan tavalla {profile}. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Mukana on painike *Avaa laskentaprofiili*. Kun profiili on otettu käyttöön, seuraa tarvittaessa *Soveltamisen jälkeen N tehtävää siirtyi.*
