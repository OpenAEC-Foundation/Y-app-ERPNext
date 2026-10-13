# Tiedoston avaaminen ja tallentaminen

Tavoite: avata projekti tiedostosta ja säilyttää muutokset.

## Milloin tätä tarvitaan

Päivä alkaa eilisen projektin avaamisella, tiedosto saadaan kollegalta tai toisesta paketista, tai ennen suurta muutosta halutaan tallentaa väliaikainen tila. Mitä sovellus tallentaa tiedostoon ja miksi vain IFC säilyttää koko projektin, selitetään kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

## Vaiheet

### Tiedoston avaaminen

1. Valitse *Aloitus › Tiedosto › Avaa*, tai *Tiedosto › Avaa*, tai paina Ctrl+O (⌘+O Macilla). *Avaa* on myös ylimmällä rivillä. Ryhmä *Tiedosto* on myös välilehdellä *Taulukko*.
2. Valitse tiedosto. Kerrallaan avataan yksi tiedosto. Työpöytäsovelluksessa ja selaimissa, joilla on pääsy tiedostoihin, kuten Chromessa ja Edgessä, ikkunassa näytetään luettelo tiedostotyypeistä: *Kaikki tuetut*, *IFC-tiedostot*, *CSV-tiedostot*, *XML-tiedostot*, *MS Project -tiedostot* ja *Primavera XER -tiedostot*.
3. Projekti avautuu uudessa välilehdessä. Jos nykyinen välilehti oli vielä tyhjä eikä sitä ollut muutettu, projekti avautuu siihen.

IFC-tiedosto antaa nimensä välilehdelle. Projektin, jonka muoto on muu, välilehti saa projektin nimen.

Sovellus avaa tiedostot `.ifc`, `.csv`, `.xml` (MS Project XML tai Primavera P6 XML), `.mpp` ja `.xer`. Näistä kahdelle jälkimmäiselle on omat vaiheet kohdissa [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen) ja [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

### Viimeisimmän projektin avaaminen

Valitse *Aloitus › Tiedosto › Viimeisimmät* ja napsauta luettelossa olevaa tiedostoa, tai valitse *Tiedosto › Viimeisimmät*. Luettelossa on viimeiset kymmenen tiedostoa, jotka on avattu, tallennettu tai viety. Työpöytäsovellus näyttää kunkin tiedoston polun, selain vain nimen.

Jos sovellus ei enää pysty lukemaan luettelon tiedostoa, esimerkiksi koska se on siirretty, tiedosto poistuu luettelosta ilman ilmoitusta. Selaimissa ilman tiedostojen käyttöoikeutta, kuten Firefoxissa, luettelo *Viimeisimmät* pysyy tyhjänä.

### Esimerkin avaaminen

Valitse *Tiedosto › Esimerkit* ja napsauta esimerkkiprojektia. Esimerkki avautuu välilehdelle ilman tiedostoa. Siksi *Tallenna* kysyy, mihin projekti tallennetaan.

### Tallentaminen

Valitse *Aloitus › Tiedosto › Tallenna* tai *Tiedosto › Tallenna*, tai paina Ctrl+S. Mitä tapahtuu, riippuu projektista:

1. Jos projektilla on jo tiedosto, koska avasit IFC-tiedoston tai tallensit sen aiemmin, sovellus kirjoittaa siihen tiedostoon. Ikkuna ei avaudu.
2. Jos projektilla ei ole vielä tiedostoa, sovellus kysyy, mihin se tallennetaan. Se ehdottaa projektin nimeä tiedostopäätteellä `.ifc`. Sen jälkeen tämä tiedosto on projektin tiedosto.
3. Jos selaimeen tallennetaan vain latauksena (kuten Firefox), tiedosto tulee latauskansioon, ja jokainen tallennus luo uuden latauksen. Istunnon ensimmäisellä kerralla näkyy ilmoitus *Tallennettu latauksena: 'name.ifc' on latauskansiossa. Tämä selain ei anna sovelluksen kirjoittaa omaan paikkaansa, joten jokainen tallennus luo uuden latauksen. Chromessa, Edgessä tai työpöytäsovelluksessa Tallenna päivittää vain samaa tiedostoa.*
4. Jos selain ei voi kirjoittaa takaisin projektin tiedostoon, sovellus kysyy joka tallennuksella uudelleen, minne tiedosto laitetaan. Se näyttää toiminnolta *Tallenna nimellä*, mutta se on selaimen rajoitus. Istunnon ensimmäisellä kerralla ilmoitus *Tämä selain ei anna sovelluksen kirjoittaa takaisin tiedostoon 'name.ifc'.* selittää asian, ja siinä on linkki kohtaan [Tiedostot](docs://uitleg-bestanden).

Tallentamisen jälkeen merkki *Tallentamaton* häviää: välilehden piste, projektin nimen edessä oleva tähti ylhäällä ja teksti *Tallentamaton* tilarivillä oikeassa alakulmassa.

### Tallentaminen toisella nimellä

Valitse *Aloitus › Tiedosto › Tallenna nimellä* tai *Tiedosto › Tallenna nimellä*, tai paina Ctrl+Shift+S. Valitse nimi ja paikka (Firefoxissa sovellus lataa uuden tiedoston). Sen jälkeen projekti toimii tämän uuden tiedoston kanssa: seuraava *Tallenna* kirjoittaa siihen. Vanha tiedosto säilyy samassa tilassa kuin viimeksi tallennettaessa.

### Projektin sulkeminen

Napsauta välilehden ristiä tai valitse *Tiedosto › Sulje projekti*. Jos projektissa on muutoksia, joita ei ole tallennettu, sovellus kysyy: *Tallentamattomia muutoksia: 'name' sisältää muutoksia, joita ei ole vielä tallennettu.* Vaihtoehdot ovat *Peruuta* (projekti jää auki), *Älä tallenna* (projekti suljetaan ja muutokset katoavat) tai *Tallenna* (tallennetaan ensin, sitten suljetaan). Jos koko sovellus suljetaan työpöytäsovelluksessa (sulkupainikkeella, Alt+F4:llä tai käyttöjärjestelmän valikosta), sovellus kysyy tämän jokaisesta projektista, jossa on muutoksia. *Peruuta* tai epäonnistunut tallennus pysäyttää sulkemisen. Normaalin sulkemisen jälkeen sovellus poistaa tämän istunnon palautuskopiot, joten palautusikkuna näkyy vain todellisen kaatumisen jälkeen. Jos projektissa on muutoksia ja selaimen välilehti tai ikkuna suljetaan, selain pyytää vahvistusta.

## Sudenkuopat ja mitä sovellus silloin tekee

**Avattu IFC-tiedosto on heti projektin tiedosto.** *Tallenna* ylikirjoittaa tämän tiedoston, vaikka se olisi tullut toisesta ohjelmasta. Jos alkuperäinen halutaan säilyttää, valitse ensin *Tallenna nimellä*.

**Muita muotoja ei ylikirjoiteta koskaan.** Tiedostolla `.csv`, `.xml`, `.mpp` tai `.xer` ei ole avaamisen jälkeen tiedostoa. *Tallenna* kirjoittaa uuden IFC-tiedoston ja jättää alkuperäisen ennalleen.

**Firefoxissa jokainen tallennus luo uuden tiedoston.** Sovellus ei voi kirjoittaa avattuun tiedostoon siellä. Se lataa uuden tiedoston joka kerta, ja tiedoston nimenä on projektin nimi, ei avatun tiedoston nimi.

**Chrome ja Edge kysyvät lupaa.** Kun avattua tiedostoa tallennetaan ensimmäisen kerran painamalla *Tallenna*, selain kysyy, saako sovellus kirjoittaa siihen. Jos lupa evätään, sovellus avaa ikkunan, jossa valitaan uusi tiedosto. Chromessa ja Edgessä sama ikkuna avautuu myös, jos tiedoston päivittäminen epäonnistuu, esimerkiksi koska tiedosto on kadonnut tai lukittu.

**Tallentaminen voi epäonnistua.** Jos tallennus itsessään antaa virheen, sovellus näyttää ilmoituksen *Tallennus epäonnistui* ja syyn. Projekti pysyy auki, ja sen merkkinä on edelleen *Tallentamaton*.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): mitä IFC-tiedostossa on ja miten sovellus käsittelee muotoja.
- [Automaattisen tallennuksen käyttöönotto](docs://howto-automatisch-opslaan): antaa sovelluksen päivittää tiedoston itse.
- [Vieminen](docs://howto-exporteren): kopion tekeminen toisessa muodossa.
- [Palauttaminen kaatumisen jälkeen](docs://howto-herstellen-na-een-crash): mitä tehdään, jos sovellus ei sulkeutunut puhtaasti.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mitä siirtyy mukana ja mitä ei.
