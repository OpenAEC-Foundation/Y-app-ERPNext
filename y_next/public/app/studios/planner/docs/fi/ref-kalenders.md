# Kalenteri-ikkunat

Ikkuna *Kalenterit* hallinnoi projektin kalenterien kirjastoa. Siinä määritetään, mitkä työpäivät, työajat ja vapaapäivät ovat voimassa ja mikä kalenteri on projektin kalenteri. Lomake listan vieressä on sama kuin *Resurssikalenteri* -ikkunassa. Tämä artikkeli kertoo kustakin kentästä, mitä se tekee, mikä on oletus ja mitä siitä huomaat. Kalenterin luominen ja antaminen tehtäville on kohdassa [Kalenterin luominen ja antaminen tehtäville](docs://howto-kalender-maken-en-toewijzen). Miten sovellus laskee työpäivät, on kohdassa [Kalenterit ja työpäivät](docs://uitleg-kalenders).

## Mistä sen löytää

- **Kalenterit** — *Aikataulu › Kalenteri › Kalenteri* tai *Asetukset › Kalenteri › Kalenteri*.
- **Tehtävän kalenteri** — kenttä *Kalenteri* ikkunassa *Muokkaa tehtävää* tai *Ominaisuudet* -paneelissa. Katso [Tehtävän valintaikkuna ja ominaisuuspaneeli](docs://ref-taak-eigenschappen).
- **Resurssikalenteri** — *Resurssit* -paneelin sarake *Kalenteri*: valitse kalenteri, valitse *+ Resurssikalenteri* uuden luomiseksi, tai napsauta kynää (*Muokkaa…*) valitulle kalenterille. Katso [Resurssipaneeli](docs://ref-resourcepaneel).

## Kalenterit-ikkunan kirjasto

Vasemmalla on kalenterien luettelo, oikealla valitun kalenterin lomake. Projektikalenterissa on tähti. Kalenterissa, jossa on virheellisiä syötteitä, on punainen kolmio (*Tämä kalenteri sisältää virheellisiä syötteitä*).

- *Uusi kalenteri* (plusmerkki) — lisää kalenterin nimeltä *Uusi kalenteri* sovelluksen oletussisällöllä: ma–pe, 07:00–16:00, 8 nettotuntia. Jos *Ota rakennustila käyttöön* on päällä (oletus), siinä ovat myös hollantilaiset vapaapäivät, ilman rakennusalan kesälomaa. Jos se on pois päältä, lista on tyhjä. Jos näitä vapaapäiviä ei haluta, valitse *Luo vapaapäivät…* ja siinä *Ei vapaapäiviä*. (Nimet *Bouwkalender NL* ja *Standaardkalender* pysyvät hollanninkielisinä kaikilla kielillä.)
- **Monista** — kopioi valitun kalenterin nimellä *{name} (kopio)*.
- **Poista** (roskakori) — poistaa valitun kalenterin. Ei käytettävissä, kun jäljellä on vain yksi kalenteri. Jos se oli projektikalenteri, ensimmäisestä jäljelle jäävästä kalenterista tulee projektikalenteri. Tehtävät ja resurssit, jotka käyttivät kalenteria, palaavat projektikalenteriin.
- **Aseta projektin oletukseksi** — tekee valitusta kalenterista projektikalenterin. Kalenterissa, joka on jo projektikalenteri, näkyy *Projektikalenteri* tähden kanssa. Vaikutus: jokainen tehtävä ilman omaa kalenteria käyttää tätä kalenteria, ja sama koskee resurssia ilman omaa kalenteria. Tehtävä, jolle kalenteri on annettu itse, pitää sen.
- *Käytä* — kirjoittaa kaikki luettelon muutokset projektiin kerralla, laskee aikataulun uudelleen ja sulkee ikkunan. Se ei laske uudelleen, jos kokonaisuudessaan mitään ei muuttunut. Ei käytettävissä, kun jossakin kalenterissa on virheellisiä syötteitä. Enter tavallisessa tekstikentässä tekee saman, mutta pitää ikkunan auki.
- *Peruuta* — sulkee ikkunan ja hylkää kaikki muutokset, jotka tehtiin avaamisen jälkeen (tai viimeisen Enter-painalluksen jälkeen). Esc ja rasti toimivat kuten *Peruuta*. Klikkaus ikkunan viereen ei tee mitään, joten syötettä ei menetetä.

Oletuksena projektissa on kalenteri *Bouwkalender NL* (rakennustila päällä) tai *Standaardkalender* (rakennustila pois päältä), jossa ma–pe 07:00–16:00.

## Lomake

### Perusasetukset

- **Nimi** — nimi luettelossa ja tehtävien ja resurssien pudotusvalikoissa.
- **Työpäivät** — painike jokaiselle viikonpäivälle, *Ma* – *Su*. Painettu painike on työpäivä. Järjestys seuraa asetusta *Viikko alkaa* (*Asetukset*, välilehti *Aikataulu*). Oletus: *Ma* – *Pe*. Kaksi pikapainiketta: *Ma–pe* asettaa ma–pe, 07:00–16:00, 8 tuntia; määritetty tauko palautuu oletukseksi 12:00, 60 minuuttia. *Jatkuva (24/7)* asettaa kaikki seitsemän päivää, 00:00–24:00, 24 tuntia. Vaikutus: tehtävä työskentelee vain työpäivinä. Sovellus ei voi laskea kalenteria ilman työpäiviä (*Kalenterissa ei ole asetettu työpäiviä*).
- *Alku (tunti)* ja *Loppu (tunti)* — työpäivän alku ja loppu, muodossa TT.MM 24 tunnin kellonajassa. Oletus: 07:00 ja 16:00. Nuolet (tai nuolinäppäimet) säätävät 15 minuutin askelin. Loppu voi olla 24:00. Alun on oltava ennen loppua. Vaikutus: yhdessä tauon kanssa nämä määrittävät nettotunnit päivässä. Ne eivät vaikuta tehtävän päivämääriin päivissä, mutta vaikuttavat tehtäviin tunneissa. Nämä kentät katoavat, kun *Ota tuntisuunnittelu käyttöön* on päällä ja kalenterissa on viikonpäivittäiset työajat. Silloin työajat ovat etusijalla.
- **Tauon alku** ja **Tauon kesto (minuuttia)** — alku ja pituus, samoilla 15 minuutin askelilla. Oletus: 12:00 ja 60 minuuttia. Jos kesto asetetaan 0:ksi, työpäivä on yhtenäinen. Tauon on oltava kokonaan työpäivän sisällä, eikä se saa peittää koko päivää. Vaikutus: nettotunnit ovat loppu miinus alku miinus tauko. Tehtävälle tunneissa ei tehdä työtä tauon aikana. Samat kentät katoavat samalla ehdolla kuin *Alku (tunti)*.
- **Nettotunnit päivässä** — vain luku: työpäivän johdettu pituus kahdella desimaalilla, esimerkiksi *8,00 h*. Oletus: 8. Vaikutus: tämä on päivän pituus, kun muunnetaan päiviä ja tunteja, ja tehtäville tunneissa. Katso [Päivät ja tunnit](docs://uitleg-dagen-en-uren).

### Työajat

Tämä lohko näkyy vain, kun *Ota tuntisuunnittelu käyttöön* on päällä (*Asetukset*, välilehti *Aikataulu*). Tässä työajat ja vuorot asetetaan viikonpäivittäin. Katso [Työaikojen asettaminen](docs://howto-werktijden-instellen).

- **Esiasetukset** — painikkeet, jotka asettavat työajat kerralla: *Päivätyövuoro* (ma–pe 08:00–16:00, tavallinen päiväkalenteri), *2 työvuoroa* (ma–pe 06:00–22:00, 16 tuntia), *3 työvuoroa* (ma–pe 06:00–06:00 seuraava päivä, 24 tuntia), *Yötyövuoro* (ma–pe 22:00–06:00, 8 tuntia) ja *24/7* (kaikki päivät 00:00–24:00). Sisäänrakennettujen painikkeiden takana ovat omat esiasetukset, joissa on rasti niiden poistamiseen.
- **Tallenna esiasetukseksi…** — tallentaa nykyiset työajat omana esiasetuksena tälle laitteelle, jotta niitä voi käyttää missä tahansa projektissa. Anna nimi (*Oman esiasetuksen nimi*) ja napsauta *Tallenna* tai *Peruuta*.
- **Aseta viikonpäivittäin…** — muuttaa päiväkalenterin tuntikalenteriksi: nykyisistä ajoista tulevat jokaisen työpäivän lohkot, ja tauko jää väliksi. Tuntikalenterissa painike on nimeltään *Piilota työajat* tai *Näytä työajat* ja piilottaa tai näyttää editorin. Tuntikalenterissa editori on oletuksena auki.
- **Editori** — viikonpäivää kohti lista lohkoista (*lohko*), joilla on alku- ja loppuaika. Valintaruutu *seuraava päivä* antaa lohkon jatkua keskiyön yli, esimerkiksi yövuorossa. *Lisää lohko* (plusmerkki) lisää lohkon 08:00–16:00. *Kopioi kaikkiin työpäiviin* (vain ma–pe) kopioi sen päivän lohkot maanantaista perjantaihin. Päivä ilman lohkoja on *Ei-työpäivä*. Alareunassa on *Johdetut tunnit/päivä:*. Kun päivässä on enemmän kuin yksi lohko, näkyy vihje *Väli kahden lohkon välillä on tauko. Muokkaa aikoja tarpeen mukaan.* Vaikutus: lohkot ovat etusijalla. Viikonpäivä, jossa on lohkoja, on työpäivä. Kentät *Alku (tunti)*, *Loppu (tunti)* ja tauko katoavat.

### Vapaapäivät

- **Luo vapaapäivät…** — avaa luojan. *Maa* valitsee *Alankomaat*, *Saksa*, *Belgia*, *Ranska*, *Iso-Britannia*, *Itävalta*, *Sveitsi* tai *Ei vapaapäiviä*. *Alue* näkyy vain, jos maassa on alueita; oletus on *Valtakunnallinen*. *Rakennusalan kesäloma* näkyy vain Alankomaille ja silloin, kun *Ota rakennustila käyttöön* on päällä. Valinnat ovat *Ei mitään* (oletus), *Pohjoinen*, *Keski* ja *Eteläinen*, ja vihje on *Suosituspäivät — tarkista Bouwend Nederlandilta*. Esikatselurivi kertoo, montako vapaapäivää tulee (*… vapaapäivää, …–…*). Sen voi laajentaa luetteloksi. *Luo* kirjoittaa tuloksen muokattavana olevaan kalenteriin; se vaikuttaa vasta *Käytä*-napsautuksen jälkeen. *Peruuta* sulkee luojan. Vaikutus: koko luettelo *Vapaapäivät* korvataan, myös itse lisätyt rivit. Luodut vuodet alkavat projektin aloituspäivää edeltävästä vuodesta ja päättyvät projektin loppua seuraavaan vuoteen, mukaan lukien. Ilman projektin loppua luodaan enintään kolme vuotta aloituspäivän jälkeen. Katso [Vapaapäivien ja rakennusalan kesälomen luominen](docs://howto-feestdagen-genereren).
- **Luo uudelleen** — tulee näkyviin painikkeen viereen, kun luodut vapaapäivät eivät enää kata projektijaksoa. Teksti on *Vapaapäivät kattavat …–…; projekti kestää vuoteen …. Luodaanko uudelleen?* Klikkaus luo saman valinnan (maa, alue, rakennusalan kesäloma) uudelleen uudelle jaksolle. Ilman sitä päivät luodun jakson ulkopuolella ovat tavallisia työpäiviä.
- *Vapaapäivät* — vapaapäivien luettelo: *Kuvaus*, *Alkaen* ja *Asti*, sekä roskakori jokaisella rivillä. *Lisää vapaapäivä* lisää rivin, jossa *Alkaen* on tänään ja *Asti* on tyhjä. Tyhjä *Asti* tarkoittaa yhtä päivää. Ilman rivejä näkyy *Ei vielä vapaapäiviä*. Vaikutus: kaikki jakson päivät ovat ei-työpäiviä tässä kalenterissa, tehtäville tällä kalenterilla ja resursseille, jotka käyttävät sitä. Virheellinen rivi saa punaisen reunan ja tekstin (*Anna kelvollinen alkamispäivä.*, *Anna kelvollinen loppupäivä tai jätä kenttä tyhjäksi yhden päivän vapaapäivälle.* tai *Loppupäivä on ennen alkamispäivää.*) ja estää painikkeen *Käytä*.

### Virheilmoitukset ja poikkeukset

Virheet työajoissa näkyvät kenttien alla ja estävät painikkeen *Käytä*: *Anna kelvollinen aloitusaika muodossa TT.MM.*, *Anna kelvollinen loppuaika muodossa TT.MM.*, *Aloitusajan on oltava ennen loppuaikaa.*, *Anna kelvollinen taukoaika muodossa TT.MM.*, *Tauon keston on oltava kokonainen minuuttimäärä, joka on 0 tai suurempi.*, *Tauon on oltava kokonaan asetetun työpäivän sisällä.* ja *Tauko ei voi kattaa koko työpäivää.*

Kalenteri tuntee vapaapäivät vain poikkeuksina. MS Project -tiedoston tai Primavera-tiedoston kalenterissa voi olla myös työpoikkeuksia, eli ylimääräinen työpäivä. Ikkuna ei näytä eikä muokkaa niitä.

## Resurssikalenteri-ikkuna

- *Resurssikalenteri* — lomake yllä, ikkunassa, jossa on vain *Käytä* ja *Peruuta*. Esc ja rasti toimivat kuten *Peruuta*. Klikkaus ikkunan viereen ei tee mitään, eikä Enter tee tässä mitään. Tässä ikkunassa muokataan yhtä kalenteria: olemassa olevaa tai uutta. Uusi kalenteri saa oletusnimen *Resurssikalenteri* ja liitetään resurssiin *Käytä*-painikkeen jälkeen. *Peruuta* ei jätä mitään jälkeensä. Jos ikkuna avataan resurssipaneelin näkymässä *Kirjasto*, se muokkaa kalenteria kirjastossa. Näkymässä *Projekti* se muokkaa projektin kalenteria, vaikka se olisi tullut kirjastosta. Vaikutus: resurssikalenteri määrittää, milloin resurssi on käytettävissä histogrammissa, ylikuormituksessa ja tasaamisessa. Se ei muuta tehtävän päivämääriä. *Käytä* ei laske uudelleen. Jos kalenteri on myös tehtävillä tai on projektikalenteri, aikataulu muuttuu. Se merkitään silloin vanhentuneeksi, ja *Laske* laskee sen uudelleen. Katso [Resurssikalenterin asettaminen](docs://howto-resourcekalender-instellen).
