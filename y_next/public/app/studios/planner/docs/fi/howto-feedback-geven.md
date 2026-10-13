# Palautteen antaminen

Tavoite: kertoa virheestä tai esittää idean, tarvittaessa kuvakaappauksen kanssa, jotta se päätyy GitHubiin ongelmana.

## Milloin tarvitset tätä

Aikataulu laskee jotain, mitä et ymmärrä, painike ei tee sitä, mitä sen pitäisi, tai sovelluksesta puuttuu jotain. Hyvä raportti auttaa kehittäjiä löytämään ongelman. Siksi sovellus itse lisää raporttiin version, käyttöjärjestelmän ja kielen. Se, mitä kuvaat itse, ratkaisee, voivatko he tehdä sillä jotain: mitä teit, mitä odotit ja mitä tapahtui.

## Vaiheet

1. Napsauta ikkunan yläreunassa painiketta *Anna palautetta*. Painike on aina otsikkopalkissa. Sen teksti vaihtuu kymmenen minuutin välein: *Anna palautetta*, *Tee virheraportti* tai *Lisää uusi ominaisuus*. Kyseessä on aina sama painike. *Anna palautetta* -ikkuna avautuu.
2. Valitse *Virhe*, jos jokin ei toimi kuten pitäisi, tai *Ominaisuuspyyntö*, jos kyseessä on idea. *Virhe* on oletuksena valittuna.
3. Täytä kenttä *Otsikko*. Ilman otsikkoa painike *Lähetä GitHubiin* on harmaa. Täytä myös kenttä *Kuvaus*, esimerkiksi: mitä tehtävää muutit, mitä odotit ja mitä näit.
4. Jos haluat näyttää jotain, ota käyttöön *Liitä kuvakaappaus*. Sovellus ottaa silloin kuvan itsestään ilman tätä ikkunaa. Hetken kuluttua näkyy pieni esikatselu. Kun *Merkitse* valitaan, avautuu muokkain, jossa kuvaan voi lisätä nuolia, suorakulmioita, vapaamuotoisia viivoja ja tekstiä. Muokkaimessa valitaan väri, viimeisin muutos peruutetaan komennolla *Kumoa* tai aloitetaan alusta komennolla *Tyhjennä kaikki*. Kun olet tyytyväinen, napsauta *Tehty*.
5. Napsauta *Lähetä GitHubiin*.
6. Ei liitetty kuvakaappausta? Silloin GitHub-sivu, jolla uusi ongelma luodaan, avautuu heti selaimeen. Jatka vaiheesta 8.
7. Liitettiinkö kuvakaappaus? Silloin ensin näkyy ikkuna *Melkein tehty — kuvakaappaus on leikepöydällä.*, jossa on neljä vaihetta. Napsauta *OK, siirry GitHubiin*, napsauta ongelmasivun suurta tekstikenttää ja paina Ctrl+V (Macilla Cmd+V). Kuva ladataan ja näkyy tekstissä.
8. Napsauta ongelmasivun alareunassa *Submit new issue*. Vasta sitten raportti lähetetään. Kirjaudu GitHubiin, ellei sitä ole jo tehty.

Ongelmasivulla otsikko ja kuvaus on jo täytetty. Sovellus ehdottaa tunnisteeksi *bug* tai *enhancement* ja lisää kuvauksen alle rivin, jossa on tyyppi, Open Planner Studion versio, käyttöjärjestelmä ja sovelluksen kieli.

## Sudenkuopat ja mitä sovellus silloin tekee

**Sovellus ei lähetä mitään itsestään.** *Lähetä GitHubiin* avaa vain täytetyn ongelmasivun. Jos sivu suljetaan napsauttamatta *Submit new issue*, mitään ei ole lähetetty. Tähän tarvitaan GitHub-tili.

**Raportti päätyy GitHubiin.** Siihen ei kirjoiteta mitään, mitä ei haluta jakaa. Sama koskee kuvakaappausta: kuvassa näkyy kaikki, mikä sovelluksessa on sillä hetkellä näkyvissä, esimerkiksi projektin tehtävien nimet ja resurssit. Sovellus ottaa kuvakaappauksen siinä vaiheessa, kun *Liitä kuvakaappaus* otetaan käyttöön. Siksi tarkistetaan ennen sitä, että näyttö on oikea, ja jätetään pois se, mitä ei haluta näyttää.

**Liittäminen ei onnistu.** Kuvakaappaus tallennetaan myös tiedostona tietokoneeseen. Työpöytäsovelluksessa ikkuna kertoo polun: *Liittäminen ei onnistu? Kuvakaappaus tallennettiin myös* tuohon polkuun *— vedä tiedosto tekstikenttään.* Selaimessa sovellus lataa kuvan tiedostona nimellä `feedback-` ja numerolla, tiedostopäätteenä `.png`. Tiedosto löytyy latauskansiosta. Vedä se tekstikenttään.

**Kuvakaappaus epäonnistuu.** Sovellus näyttää viestin *Kuvakaappauksen ottaminen epäonnistui. Palautteen voi silti lähettää ilman kuvakaappausta.* Valintaruudun valinta poistuu, ja raportin voi lähettää ilman kuvaa.

**Paljon tekstiä on kirjoitettu, ja ikkunan viereen napsautetaan vahingossa.** Tämä ei sulje ikkunaa, joten teksti säilyy. Näppäin Esc tai *Peruuta* sulkee ikkunan, ja silloin teksti katoaa.

## Katso myös

- [Sovelluksen päivittäminen](docs://howto-app-bijwerken): tarkista ennen raportin lähettämistä, onko käytössä uusin versio.
