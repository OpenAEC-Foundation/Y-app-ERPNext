# Primavera P6 -tiedoston (.xer) avaaminen

Tavoite: avata Primavera P6:n aikataulu suoraan sovelluksessa. Sitä ei tarvitse ensin viedä XML-muotoon.

## Milloin tätä tarvitaan

Asiakas tai pääurakoitsija työskentelee Primaverassa ja toimittaa aikataulunsa `.xer`-tiedostona. Aikataulu halutaan tarkastella, laskea tai täydentää. Sovellus lukee vain `.xer`-tiedostoja. Se ei kirjoita `.xer`-tiedostoa eikä muuta tiedostoa koskaan. Tiedostosta sovellus ottaa WBS-rakenteen sekä tehtävät ja niiden kesto, päivämäärät, rajoitteet ja edistyminen. Lisäksi se ottaa riippuvuudet ja viiveet, kalenterit sekä resurssit ja niiden resurssikohdistukset. Se ottaa myös tehtäväkoodit, mukautetut kentät (UDF), muistiinpanot ja P6:n aikataulutusasetukset. Tehtävä, jonka tyyppi on *Level of Effort*, on riippumatto.

## Vaiheet

1. Valitse *Aloitus › Tiedosto › Avaa* tai paina Ctrl+O. Valitse `.xer`-tiedosto.
2. Sovellus avaa yhden välilehden jokaiselle projektille, jossa on tehtäviä. Projekti, jossa on eniten tehtäviä, on aktiivinen välilehti. Välilehden nimi on *Projektin nimi (Projektitunnus)*, jos P6-projektitunnus eroaa nimestä.
3. Lue viesti alareunassa. Kolmen projektin tiedostossa viesti voi näyttää tältä: *XER-tiedosto avattu: 3 projektiasiakirjaa.* Sen alla on rivejä, jotka selittävät, mitä sovellus teki. Katso alla oleva otsikko.
4. Tarkista, onko valintanauhan alla viestipalkki: *Aikataulu näytetään sellaisena kuin Primavera sen tallensi. Kun lasketaan uudelleen, 1 tehtävä siirtyisi.* Primavera tallentaa tiedostoon omat lasketut päivämääränsä. Jos sovelluksen laskenta poikkeaa niistä, sovellus näyttää Primaveran päivämäärät niin kauan kuin mitään ei muuteta. Mitä tämä tarkoittaa ja miten sovelluksen oma laskenta otetaan käyttöön, kerrotaan kohdassa [Päivämäärät sellaisina kuin ne tallennettiin](docs://uitleg-datums-zoals-opgeslagen). Viesti *Tämä tiedosto sisältää tuntisuunnittelua.* voi myös näkyä. Silloin näkyy painike *Ota tuntisuunnittelu käyttöön*. Katso [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).
5. Tallenna projekti painamalla Ctrl+S. Koska `.xer`-tiedostoa ei koskaan korvata, sovellus kysyy, mihin uusi IFC-tiedosto tallennetaan. Se ehdottaa tiedostonimeksi *Projektin nimi (Projektitunnus)*.

### Viestin alla olevat rivit

Viestin ensimmäinen rivi kertoo avattujen välilehtien määrän. Sen alla ovat vain ne rivit, jotka koskevat tiedostoa. Näihin kannattaa kiinnittää huomiota:

- *Tämä projekti lasketaan tavalla Primavera P6. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Sovellus laskee tämän projektin Primaveran laskentasäännöillä. Painikkeella *Avaa laskentaprofiili* pääset asetukseen.
- *1 projekti perustasosta jätettiin pois.* ja *1 perustaso luotiin.* Jos P6:ssa projektin perustaso on toinen projekti, tätä toista projektia ei avata omana välilehtenään. Toisesta projektista tulee sen projektin aktiivinen perustaso, joka viittaa siihen.
- *Perustasolle käytettiin suojaavaa varavaihtoehtoa.* Jos perustasot estäisivät kaikkien projektien avautumisen, jos projekti viittaa itseensä tai jos projektit viittaavat toisiinsa silmukassa, sovellus yksinkertaisesti avaa kaikki projektit eikä luo perustasoja.
- *1 ulkoinen riippuvuus säilytettiin.* Tämä on riippuvuus kahden projektin välillä. Sovellus säilyttää sen lähdetietona, mutta ei tee siitä aikataulun riippuvuutta.
- *1 tehtävä näyttää päivämäärät sellaisina kuin Primavera ne tallensi (ei laskettuina uudelleen).* Tämä on niiden tehtävien määrä, jotka näkyvät näkymässä *Päivämäärät sellaisina kuin ne tallennettiin*.

Muut rivit ovat diagnostiikkaa itse lukemisesta: löydettyjen projektien määrä, ohitettu tyhjä projekti, ohitettu perustasoviite, jonka kohde puuttuu, tekstin merkistö, joka ei ole tavallinen UTF-8, sekä laskurit löydöksille taulujen, kalenterien ja numeroiden osalta, tuntemattomille kenttäarvoille ja P6:n aikataulutusasetuksille, jotka sovellus korvasi turvallisella valinnalla. Niihin ei tarvitse reagoida. *Lue lisää* avaa ohjeen Primavera-tiedostojen avaamisesta.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kaikki ei muutu välilehdeksi tai riippuvuudeksi.** Projekti ilman tehtäviä ei avaudu. Perustasoprojekti ei avaudu omana välilehtenään. Riippuvuus kahden projektin välillä ei tule aikataulun riippuvuudeksi. Viestin alla olevilla riveillä sovellus kertoo siitä.

**Jokainen välilehti on oma projektinsa.** Kun yksi välilehti tallennetaan, IFC-tiedosto säilyttää mukanaan koko `.xer`-lähdetiedoston. Kun IFC-tiedosto avataan myöhemmin, sovellus tuntee yhä Primaveran päivämäärät. Jos tuo lähdearkisto on vioittunut tai toinen IFC-ohjelma kirjoitti tiedoston uudelleen, sovellus näyttää viestin: *XER-lähdearkisto tässä tiedostossa on käyttökelvoton ja jätettiin pois; projekti itsessään avattiin kokonaan.* Aikataulu, laskentaprofiili ja kaikki projektitiedot ovat täydellisiä. Puuttuu se, mitä Primavera tallensi päivämääriksi, sekä lähteen alkuperätiedot tekoälylle ja laajennuksille. Arkisto saadaan takaisin avaamalla `.xer`-lähdetiedosto uudelleen.

**Vienti muotoon CSV, MS Project XML tai P6 XML menettää tietoja.** Sovellus varoittaa: *Vienti muotoon CSV menettää XER-lähdetiedot.* IFC ei menetä mitään.

**Tiedosto, jota sovellus ei voi lukea.** Näkyviin tulee virheviesti, jossa on syy. Muutama esimerkki:

- *Tämä ei ole kelvollinen tai tuettu XER-tiedosto.*
- *XER-taulusta puuttuu pakollisia sarakkeita.*
- *P6-projekti tässä XER-tiedostossa ei sisällä tehtäviä.*

Silloin mitään ei avaudu. Tiedosto kannattaa tarkistaa P6:ssa, tai uusi vienti kannattaa pyytää lähettäjältä.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi `.xer`-tiedostoa vain luetaan ja mitä vienti menettää.
- [Päivämäärät sellaisina kuin ne tallennettiin](docs://uitleg-datums-zoals-opgeslagen): näkymä Primaveran omille päivämäärille.
- [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen): sama asia MS Projectille.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): jos tiedostossa on tietoja tunteina.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): per muoto, mitä siirtyy mukana ja mitä ei.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi P6-tiedosto avautuu sen oman laskentaprofiilin mukaan.
