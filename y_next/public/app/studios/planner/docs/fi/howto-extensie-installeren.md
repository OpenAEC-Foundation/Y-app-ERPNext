# Laajennuksen asentaminen ja hallinta

Tavoite: asentaa laajennus, lukea käyttöoikeuksia koskeva kysymys ja myöhemmin poistaa laajennus käytöstä tai poistaa se kokonaan.

## Milloin tarvitset tätä

Laajennus lisää sovellukseen toiminnon ilman, että uutta versiota tarvitsee odottaa. Laajennus voi esimerkiksi lisätä tuontimuodon, joka näkyy valikossa *Tiedosto › Tuo*. Se voi myös lisätä painikkeen valintanauhaan tai toimittaa fontin PDF-vientiä varten. Virallinen luettelo jakaa laajennukset luokkiin: *Tuonti/vienti*, *Aikataulu*, *Raportointi*, *Apuohjelma*, *Fontit* ja *Muu*.

Harkitse tarkkaan ennen asentamista. Laajennus on ohjelmakoodia, joka toimii samoilla oikeuksilla kuin sovellus itse. Sovellus ei voi rajoittaa sitä. Siksi sovellus kysyy luvan jokaisessa asennuksessa. Kysymyksen sisältö selitetään jäljempänä.

## Vaiheet

### Asenna laajennus luettelosta

1. Valitse *Tiedosto › Laajennukset*.
2. Valitse välilehti *Selaa*. Sovellus hakee luettelon, kun siinä lukee *Ladataan luetteloa...*. Luettelon sisällön päättää OpenAEC Foundation, joka ylläpitää sitä. Sisältö voi muuttua.
3. Hae laajennusta kentässä *Etsi laajennuksia...*. Haku etsii nimestä, kuvauksesta, tekijästä ja tunnisteista.
4. Jokaisessa kortissa näkyy nimi, versio, luokka, kuvaus ja tekijä. Valitse *Asenna*.
5. Ikkuna *Asennetaanko laajennus?* avautuu. Lue se ja katso seuraava vaihe.
6. Valitse *Asenna*, jos haluat jatkaa. Painikkeella *Peruuta* ei tapahdu mitään. Myös Esc-näppäin tai napsautus ikkunan viereen tarkoittaa kieltäytymistä. Sovellus ei näytä silloin virheilmoitusta.

Asennuksen jälkeen laajennus otetaan heti käyttöön. Kortissa välilehdellä *Selaa* lukee nyt *Asennettu*. Sen, mitä laajennus lisää, näkyy itse sovelluksessa: uusi painike valintanauhassa tai tuontimuoto valikossa *Tiedosto › Tuo*. Jotkin laajennukset näyttävät myös viestin. Tunnistat sen etuliitteestä *Laajennus* ja laajennuksen nimestä.

### Asenna laajennus tiedostosta

Jos sait laajennuksen tiedostona, asenna se näin.

1. Valitse *Tiedosto › Laajennukset*.
2. Valitse oikeasta yläkulmasta *ZIP* ZIP-tiedostolle tai *JS* erilliselle JavaScript-tiedostolle.
3. Valitse tiedosto. Ikkuna *Asennetaanko laajennus?* avautuu, kuten yllä.

ZIP-tiedoston pitää sisältää tiedosto `manifest.json` ja laajennuksen pääasiallinen tiedosto. Jos asennat laajennuksen, joka on jo asennettu, uusi versio korvaa vanhan. Jos sovellus ei voi asentaa tiedostoa, esimerkiksi koska ZIP-tiedosto on vioittunut, mitään ei tapahdu. Sovellus ei näytä virheilmoitusta ZIP- tai JS-tiedoston asennuksesta, eikä laajennus ilmesty luetteloon. Syy näkyy kuitenkin debug-terminaalissa. Ota se käyttöön valitsemalla *Asetukset › Projekti › Asetukset*, välilehti *Lisäasetukset*, *Ota debug-terminaali käyttöön*. Avaa terminaali tilarivin painikkeella *Näytä debug-terminaali*. Siellä lukee esimerkiksi *[Extensies] ZIP-installatie mislukt: Error: Geen manifest.json gevonden in ZIP* (sovellus kirjoittaa tämän teknisen tekstin hollanniksi).

### Lue asennusikkunan kysymys

Kysymyksessä näkyy, mistä päätös on tehtävä.

- *Tekijä* ja *Repositorio* kertovat, kuka laajennuksen on tehnyt ja missä lähdekoodi on.
- *Alkuperä* kertoo, mistä tiedosto tulee: *Verkon laajennusluettelosta*, *ZIP-tiedostosta tällä tietokoneella* tai *JavaScript-tiedostosta tällä tietokoneella*. Sen alla kerrotaan, onko tiedosto tarkistettu. Luettelon laajennuksille lukee *Lataus vahvistettu luettelon tarkistesummalla.* Jos luettelossa ei ole tarkistesummaa, punaisella lukee *Luettelo ei anna tarkistesummaa. Tätä latausta ei ole vahvistettu.* Omalle tiedostolle lukee *Tämän tiedoston valitsit itse; vahvistamiseen ei ole ulkoista lähdettä.*
- *Mihin suostutaan* sanoo: *Laajennus on ohjelmakoodia, joka toimii samoilla oikeuksilla kuin Open Planner Studio itse. Mikään ei rajoita sitä. Asennetaan vain laajennuksia, joiden tekijään luotetaan.* Sen alla kerrotaan, mitä tämä tarkoittaa omalla alustallasi. Työpöytäsovelluksessa lukee *Työpöytäsovelluksessa tämä tarkoittaa muun muassa: tiedostojen lukemista ja kirjoittamista koko käyttäjäkansiossa sekä pääsyä projekteihin, asetuksiin ja leikepöydälle.* Selaimessa lukee *Selaimessa tämä tarkoittaa: pääsyä tallennettuihin projekteihin ja asetuksiin, tiedostoihin, joihin annettiin pääsy, sekä verkkoon.*
- *Mitä laajennus sanoo käyttävänsä* näyttää tekijän ilmoittamat oikeudet pieninä merkkeinä. Tämä on tekijän ilmoitus, ei rajoitus: *Tämä on tekijän ilmoitus, ei rajoitus. Koodi voi silti tehdä enemmän.* Jos merkkejä ei ole, lukee *Ei ilmoitettu mitään.* Se ei tarkoita, että laajennus ei voi tehdä mitään. Ilman merkkejäkin laajennus voi lukea ja muuttaa aikataulun tietoja ja näyttää viestejä.

Merkkien merkitys:

- *ribbon*: laajennus lisää painikkeita valintanauhaan.
- *events*: laajennus kuuntelee sovelluksen tapahtumia.
- *backstage*: laajennus lisää tuontimuotoja valikkoon *Tiedosto › Tuo*.
- *pdf-fonts*: laajennus toimittaa fontin PDF-vientiä varten.
- *importSource*: laajennus voi lukea jokaisen tuomasi tiedoston alkuperäiset tavut kokonaisuudessaan, esimerkiksi raa'an Primavera-tiedoston, myös kentät, jotka eivät päädy projektiisi. Ikkuna selittää tämän myös itse.
- *help*: laajennus voi lisätä ohjeartikkeleita, avata mukana toimitettuja projekteja uutena asiakirjana ja näyttää oppaan, joka osoittaa sovelluksen osia. Ikkuna selittää tämän myös itse.
- *filesystem* ja *network*: nämä ovat vain tekijän aikomuksia. Sovelluksessa ei ole toimintoa niille.

### Laajennuksen poistaminen käytöstä, uudelleen käyttöön ottaminen tai poistaminen

1. Valitse *Tiedosto › Laajennukset* ja välilehti *Asennetut*. Jokaisessa kortissa on nimi, versio, luokka, kuvaus ja tekijä.
2. Kortin kytkimellä otat laajennuksen pois käytöstä (*Poista käytöstä*) tai otat sen uudelleen käyttöön (*Ota käyttöön*). Kun laajennus on pois käytöstä, sen lisäämät painikkeet ja tuontimuodot katoavat, mutta laajennus pysyy asennettuna. Se pysyy pois käytöstä myös sovelluksen uudelleenkäynnistyksen jälkeen. Käytössä oleva laajennus käynnistyy itsestään, kun sovellus käynnistyy.
3. Valitse *Poista*. Painike muuttuu painikkeeksi *Vahvista*, ja sen selitys on *Napsauta uudelleen, jos haluat poistaa pysyvästi*. Valitse *Vahvista* vielä kerran, jolloin laajennus poistetaan. Sovellus siivoaa myös laajennuksen tallentamat asetukset.

## Ongelmatilanteet ja mitä sovellus silloin tekee

**Luettelo ei lataudu.** Sovellus sanoo *Luetteloa ei voitu ladata:* ja kertoo tekniset syyt sen perässä. Näkyviin tulee painike *Yritä uudelleen*. Syynä voi olla, ettei internet-yhteyttä ole.

**Kortin alla lukee *Asennus epäonnistui.*** Lataus tai asennus epäonnistui, esimerkiksi koska tarkistesumma ei täsmännyt. Silloin mitään ei ole asennettu. Tämä on eri asia kuin kysymyksen hylkääminen, jolloin virheilmoitusta ei tule.

**Luettelon yläpuolella lukee *Ohitetut luettelomerkinnät: 1*.** Luettelossa oli kohde, jota sovellus ei voi käyttää. Muut laajennukset voi asentaa tavalliseen tapaan.

**Laajennus ei käynnisty.** Kortissa näkyy silloin virheilmoitus, esimerkiksi että laajennus vaatii uudemman version Open Planner Studiosta. Näkyviin tulee myös nykyinen versio. Virheilmoituksena voi olla myös laajennuksen oma virhe. Laajennus ei ole silloin aktiivinen. Päivitä sovellus tai poista laajennus.

**Kortti, jossa lukee *Karanteeni*.** Sovellus ei voinut käyttää tallennettua laajennusta. Nimen alla lukee *Syy:* ja syy. Painikkeella *Poista tallennustilasta* siivoat sen.

**Laajennuksen kirjoittaminen itse.** Ohje laajennuksen tekijöille (manifesti, API, oikeudet) on GitHubissa repositoriossa `OpenAEC-Foundation/open-planner-studio`, tiedostossa `docs/extensions.md`.

**Laajennus ei kuulu projektiin.** Laajennukset on tallennettu sovellukseen. Työpöytäsovelluksessa ne ovat tällä tietokoneella, selaimessa selaimen omassa tallennustilassa. Ne koskevat kaikkia projektejasi, eivätkä ne kuulu projektitiedostoon. Jos sivuston tiedot tyhjennetään selaimessa, laajennukset katoavat.

## Katso myös

- [Sovelluksen päivittäminen](docs://howto-app-bijwerken): laajennus voi vaatia sovelluksen uudempaa versiota.
- [Laajennusten käyttöoikeudet](docs://ref-extensiepermissies): mitä kukin käyttöoikeus tarkoittaa asennuskysymyksessä.
