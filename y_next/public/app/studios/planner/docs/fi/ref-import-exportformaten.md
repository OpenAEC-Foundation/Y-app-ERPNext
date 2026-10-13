# Tuonti- ja vientimuodot

Tässä kerrotaan kustakin tiedostomuodosta: voiko sen avata, tallentaa ja viedä, mikä siirtyy mukana ja mikä ei, sekä millä laskentaprofiililla se avautuu. Taustat ja esimerkki luvuin ovat kohdassa [Tiedostot ja muodot](docs://uitleg-bestanden).

## Yhteenveto

**Avaaminen** onnistuu muodoilla IFC, CSV, MS Project XML, Primavera P6 XML, `.mpp` ja `.xer`. Muun tiedostopäätteen tiedosto käsitellään sovelluksessa IFC-tiedostona.

**Tallentaminen** kirjoittaa aina IFC-muodossa. Vain avattu IFC-tiedosto tulee tallennuskohteeksi. Projektilla toisesta muodosta ei ole tiedostoa avaamisen jälkeen, ja *Tallenna* kysyy silloin, mihin IFC-tiedosto tallennetaan.

**Vienti** onnistuu muotoihin IFC 4x3, MS Project XML, Primavera P6 XML, CSV ja kahteen edistymistaulukkoon (Excel ja CSV). Vienti ei muuta projektia.

**Vain luettavat** ovat `.mpp` ja `.xer`: sovellus voi avata ne, mutta ei kirjoittaa niitä.

**PDF** tulee vain raportista (katso [Raporttityypit](docs://ref-rapporttypes)). Sovellus ei lue PDF-tiedostoja.

**Sijainti.** Avaaminen: *Aloitus › Tiedosto › Avaa*, *Tiedosto › Avaa* tai Ctrl+O. Vienti: *Aloitus › Tiedosto › Vienti* tai *Tiedosto › Vienti*. Täytetyn edistymistaulukon voi tuoda sovellukseen valinnalla *Tiedosto › Tuo* tai painikkeella *Tuo edistyminen taulukosta* valintanauhan ryhmässä *Edistyminen* välilehdillä *Aikataulu*, *Taulukko* ja *Raportti*.

**Laskentaprofiili avattaessa.** Jokainen muoto avautuu laskentaprofiilin kanssa. Mitä se on, kerrotaan kohdassa [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies). `.xer` avautuu profiililla *Primavera P6*, `.mpp` profiililla *Microsoft Project* ja CSV, MS Project XML ja P6 XML profiililla *Open Planner Studio*. IFC säilyttää tiedostossa olevan profiilin. Sovellus näyttää `.xer`- ja `.mpp`-tiedostoille, että projekti lasketaan tällä tavalla. Vain IFC-tiedosto sisältää laskentaprofiilin ja laskentavaihtoehdot. Laskentavaihtoehdoista MS Project XML kirjoittaa enintään kriittisen kynnysarvon. Toisesta muodosta viety tiedosto, joka avataan uudelleen, lasketaan profiilina *Open Planner Studio*.

## IFC

**Avaaminen** — kyllä, `.ifc`. Sovellus lukee IFC 4.3:a. Laskentaprofiili: se, joka on tiedostossa.

**Tallentaminen** — kyllä, ja se on ainoa muoto, johon tallennetaan. *Tallenna* kirjoittaa koko projektin IFC-tiedostoksi. Tiedostosta tulee tallennuskohde.

**Vienti** — kyllä, muodossa *IFC 4x3* (kuvattu tekstillä BuildingSMART-standardi. 4D-linkki BIM-malleihin.). Oletusnimi: projektin nimi tiedostopäätteellä `.ifc`. Jos projekti on linkitetty resurssien kirjastoon, valintaruutu *Tallenna kirjastotiedosto rinnalle* on korttien alla kohdassa *Tiedosto › Vienti*. Kun ruutu on valittu, sovellus kysyy projektin jälkeen paikkaa tiedostolle *projectname-bibliotheek.ifc*. Valintaruutu ei ole luettelossa *Aloitus* -välilehdellä.

**Mukana** — kaikki, mikä kuuluu projektiin: tehtävät rakenteineen, kestoineen, päivämäärineen ja edistymisineen; riippuvuudet viiveineen; rajoitteet ja tavoitepäivät; kalenterit; resurssit ja resurssikohdistukset, mukaan lukien tuntijakautuminen; perustasot; tehtäväkoodit ja mukautetut kentät; muistiinpanot; ulkoiset riippuvuudet toisiin projekteihin; tauot; työsäännöt ja tehtävätyypit; projektin asetukset, kuten raportointipäivä, edistymistapa, laskentaprofiili ja laskentavaihtoehdot; linkki resurssien kirjaston kanssa. Jos projekti tulee `.xer`-tiedostosta, mukana kulkee myös sen lähdetiedosto. Mukautettu tehtävätyyppi tallennetaan IFC-tyyppinä `USERDEFINED`, ja sen nimi on kentässä ObjectType. Muut IFC-ohjelmat lukevat tehtävän silloin normaalisti. Sovellus säilyttää tyypin kiinteän tunnuksen, joten nimen muuttaminen ei katkaise linkkiä. Jos joku avaa tiedoston toisella tietokoneella, tyyppi näkyy siellä kohdassa *Tästä projektista* -kohdassa, ei kohdassa *Omat tehtävätyypit*.

**Ei mukana** — näytön asetukset (zoomaus, vierityskohta, valittu tehtävä, supistetut vaiheet, valittu suodatin ja ryhmittely) ja sovelluksen asetukset ([Asetukset](docs://ref-instellingen)). Välilehdellä *IFC* näkyy projektin IFC-teksti.

## MS Project XML (MSPDI)

**Avaaminen** — kyllä. Sovellus tunnistaa `.xml`-tiedoston MS Project XML:ksi juurielementin `Project` perusteella MS Project -nimiavaruudesta (tai ilman nimiavaruutta). Laskentaprofiili: *Open Planner Studio*.

**Tallentaminen** — ei. Tällaiselle projektille ei tule tallennuskohdetta.

**Vienti** — kyllä, muodossa *MS Project XML* (*Avattavissa ohjelmassa Microsoft Project. Täysi WBS-rakenne.*). Oletusnimi: projektin nimi tiedostopäätteellä `.xml`.

**Mukana** — tehtävät rakenteineen (taso ja WBS), kesto, päivämäärät ja edistyminen; riippuvuudet viiveineen, myös tunteina tai prosentteina; rajoitteet, tavoitepäivä mukaan lukien; kalenterit, myös tehtävä- ja resurssikalenterit; resurssit ja resurssikohdistukset, myös käyrä tai tuntijakautuminen; raportointipäivä; kriittinen kynnysarvo kokonaislukuna, joka on työpäivien määrä (0 tai enemmän), valinnalla *Kokonaispelivara ≤ kynnysarvo*; tehtävän kuvaus muistiinpanona; tehtävän työsääntö MS Project -tehtävätyyppinä; mukautettu tehtävätyyppi vapaassa kentässä (`ExtendedAttribute`), jonka sovellus lukee takaisin ja jonka MS Project voi jättää huomiotta. Perustasoista mukana on vain aktiivinen perustaso, perustasona 0. Tehtävä tunneissa säilyttää yksikkönsä ja välitavoite lajinsa (alku, loppu tai automaattinen).

**Ei mukana** — muistiinpanot (tehtävän tarkistuslista), ulkoiset riippuvuudet toisiin projekteihin, tehtäväkoodit ja mukautetut kentät, toinen rajoite, merkintä *Manuaalisesti ajoitettu*, tasaamisviive, järjestyksestä poikkeavan edistymisen jatko- ja pysäytyskohta, MS Project -laskentaprofiilin laskentasäännöt *Jäljellä oleva työ jatkuu kuluneen ajan jälkeen* ja *Aloittamattomia tehtäviä ei siirretä raportointipäivään*, sekä muut laskentavaihtoehdot. Tehtävät, joissa on taukoja mutta ei tuntijakautumista, siirtyvät ilman näitä taukoja.

**Matkalla muuttuu** — rajoite *Täytyy alkaa (MSO)* tai *Täytyy päättyä (MFO)* ilman valintaa *Pakollinen (kiinnityslogiikka)* muuttuu rajoitteeksi *Alkaa aikaisintaan (SNET)* tai *Päättyy aikaisintaan (FNET)*. Riippumatto muuttuu tavalliseksi tehtäväksi, jolla on lasketut päivämäärät.

## MS Project -tiedosto (`.mpp`)

**Avaaminen** — kyllä, MS Project 2010:stä 2021:een. Laskentaprofiili: *Microsoft Project*. Sovellus vain lukee tiedoston eikä muuta `.mpp`-tiedostoa koskaan. Sovellus hylkää tiedoston, joka on MS Project 2007:stä tai vanhemmasta, ja salasanalla suojatun tiedoston. Se näyttää viestin, joka ohjaa MS Project -ohjelman XML-vientiin.

**Tallentaminen** — ei, eikä tiedostolle tule tallennuskohdetta: *Tallenna* kirjoittaa uuden IFC-tiedoston.

**Vienti** — ei.

**Mukana** — tehtävät rakenteineen, kestoineen ja rajoitteineen; riippuvuudet viiveineen; kalenterit; resurssit ja resurssikohdistukset; edistyminen; WBS-koodi, joka on täytetty itse MS Projectissa. Myös MS Projectin itse laskemat päivämäärät ja pelivara luetaan, jotta ne näkyvät näkymässä *Päivämäärät tallennettuina*.

**Ei mukana** — perustasot, kustannukset ja normaalihinnat, muistiinpanot sekä MS Projectin mukautetut kentät. Katso [MS Project -tiedoston (.mpp) avaaminen](docs://howto-mpp-openen).

**Alkuperä ja lisenssi** — `.mpp`-lukija on kirjoitettu Open Planner Studiolle. Se perustuu MPXJ:n (`github.com/joniles/mpxj`, Jon Iles ym.) lähdekoodiin ja rakennetuntemukseen. MPXJ on Java-kirjasto, joka on LGPL-2.1-lisenssin alainen. Rakenne ja kenttävakiot on siirretty TypeScriptiin. Open Planner Studio itse on avointa lähdekoodia LGPL-3.0-lisenssillä. `.xer`-lukija ei ole johdannainen: MPXJ:ta käytettiin siinä vain ymmärryksen lähteenä.

## Primavera P6 XML

**Avaaminen** — kyllä. Sovellus tunnistaa `.xml`-tiedoston P6 XML:ksi juurielementin `APIBusinessObjects` perusteella. Laskentaprofiili: *Open Planner Studio*.

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *Primavera P6 XML* (*Oracle Primavera P6 -ohjelmalle.*). Oletusnimi: projektin nimi tiedostopäätteellä `.xml`, eli sama nimi kuin MS Project XML -viennissä. Eri nimet on annettava itse.

**Mukana** — WBS-rakenne ja tehtävät kestoineen, päivämäärineen ja edistymisineen; riippuvuudet viiveineen; rajoitteet, myös toinen rajoite pehmeänä rajoitteena; kalenterit; resurssit ja resurssikohdistukset; raportointipäivä (kenttänä `DataDate`); mukautettu tehtävätyyppi omassa kentässään, `OPS Custom Task Type`, jonka sovellus lukee takaisin ja jonka P6 voi jättää huomiotta.

**Ei mukana** — perustasot ja tavoitepäivät; tehtäväkoodit, mukautetut kentät, muistiinpanot ja ulkoiset riippuvuudet; laskentavaihtoehdot. P6:ssa ei ole viivettä prosentteina: sovellus muuntaa sen kiinteäksi määräksi päiviä. Viive kalenteripäivinä muuttuu työajan viiveeksi: 3 kalenteripäivää tulee 3 työpäivää. Riippumatto muuttuu tavalliseksi tehtäväksi, manuaalisesti ajoitettu tehtävä tavalliseksi tehtäväksi lasketuilla päivämäärillä, ja tasaamisviive, joka on alle päivän, pudotetaan pois.

## Primavera-tiedosto (`.xer`)

**Avaaminen** — kyllä. Laskentaprofiili: *Primavera P6*. Sovellus vain lukee tiedoston: se ei kirjoita `.xer`-tiedostoa eikä muuta tiedostoa koskaan. Jokaiselle projektille, jossa on tehtäviä, avautuu oma välilehti. Tiedoston, jossa ei ole tehtäviä tai jossa taulukot ovat vahingoittuneet, sovellus hylkää viestillä.

**Tallentaminen** — ei, eikä tiedostolle tule tallennuskohdetta: *Tallenna* kirjoittaa uuden IFC-tiedoston, jonka sisällä on `.xer`-tiedosto sellaisenaan.

**Vienti** — ei. Jos `.xer`-projekti viedään CSV-, MS Project XML- tai P6 XML -muotoon, sovellus näyttää viestin, jonka mukaan XER-lähdetiedot katoavat, vaikka projekti olisi tallennettu välissä IFC-muotoon. IFC-muotoon mitään ei katoa.

**Mukana** — WBS-rakenne ja tehtävät kestoineen, päivämäärineen, rajoitteineen ja edistymisineen; riippuvuudet viiveineen; kalenterit; resurssit ja resurssikohdistukset; tehtäväkoodit; mukautetut kentät (UDF); muistiinpanot; P6:n aikataulutusasetukset. Tehtävä, jonka tyyppi on *Level of Effort*, on riippumatto. Perustasoprojekti on sen projektin aktiivinen perustaso, johon se viittaa. Ulkoinen riippuvuus säilytetään sovelluksessa lähdetietona.

**Ei mukana** — projekti ilman tehtäviä ja ulkoinen riippuvuus oikeana riippuvuutena aikataulun sisällä. Katso [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen).

## CSV

**Avaaminen** — kyllä. Sovellus lukee erottimena `;` ja `,`. Se tunnistaa sarakeotsikot englanniksi ja hollanniksi (esimerkiksi `Name` tai `Naam`, `Duration` tai `Duur`, `Predecessors` tai `Voorgangers`). Päivämäärät voivat olla muodossa *vvvv-kk-pp*, *pp.kk.vvvv* tai *pp/kk/vvvv*. Edeltäjä kirjoitetaan WBS-koodina, riippuvuustyyppinä ja viiveenä, esimerkiksi `1.2FS+2d`. Laskentaprofiili: *Open Planner Studio*. Projektin nimi on *CSV Import*. `Task Type`-arvo, joka ei ole yksikään kiinteistä koodeista (kuten `CONSTRUCTION` tai `INSTALLATION`, jotka sovellus kirjoittaa itse), tulee mukautetuksi tehtävätyypiksi kohdassa *Tästä projektista* -kohdassa, ei kohdassa *Omat tehtävätyypit*. Kentällä `OPS Custom Task Type ID` säilyy mukautetun tyypin tunnus.

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *CSV (;)* (*Yleinen taulukkovienti. Kaikki tehtävät päivämäärineen ja kestoineen.*), kortilla *CSV (puolipisteillä erotettu)*. Tiedostossa erottimena on puolipiste. Tiedosto on UTF-8-muodossa BOM-merkillä, ja sarakeotsikot ovat englanniksi.

**Mukana** — tehtävää kohti nämä sarakkeet: `OPS Task ID`, `WBS`, `Outline Level`, `Name`, `Duration (days)`, `Start`, `Finish`, `Predecessors`, `Task Type`, `OPS Custom Task Type ID`, `Status`, `Completion (%)`, `Actual Start`, `Actual Finish`, `Critical`, `Total Float` ja `Description`. Valmiusaste on kokonaisina prosentteina.

**Ei mukana** — resurssit, resurssikohdistukset, kalenterit, rajoitteet, tavoitepäivät, perustasot ja raportointipäivä. Jos päivämäärät ovat näkymässä *Päivämäärät tallennettuina*, vienti jättää sarakkeet `Critical` ja `Total Float` tyhjiksi niille tehtäville, joiden lähdetiedosto ei tallentanut niitä.

## Edistymistaulukko (Excel ja CSV)

**Avaaminen** — kyllä, kohdasta *Tiedosto › Tuo* (*Tuo edistyminen taulukosta*) tai samannimisestä painikkeesta valintanauhan ryhmässä *Edistyminen* välilehdillä *Aikataulu*, *Taulukko* ja *Raportti*. Sovellus lukee `.xlsx`- ja `.csv`-tiedostoja, enintään 16 MB ja 50 000 riviä. Tämä ei avaa projektia: se päivittää avoimen projektin edistymisen. Katso [Edistymisen tuominen taulukosta](docs://howto-voortgang-importeren).

**Tallentaminen** — ei.

**Vienti** — kyllä, muodossa *Edistymistaulukko (Excel)* (luettelossa *Edistyminen (Excel)*) ja *Edistymistaulukko (CSV)* (*Edistyminen (CSV)*). Oletusnimi: *projectname-voortgang*. Painike *Vie edistymisen taulukko* samassa valintanauhan ryhmässä tekee Excel-taulukon yhdellä napsautuksella. Excel-taulukossa on kiinteät sarakeleveydet, lukitut kentät ja päivämäärien tarkistus. CSV-taulukko on sama sisältö pelkkänä tekstinä.

**Mukana** — sarakkeet `OPS Task ID`, `WBS`, `Name`, `Start`, `Finish`, `Completion (%)`, `Actual Start` ja `Actual Finish`. Tuotaessa sovellus lukee sarakkeet `Completion (%)`, `Actual Start` ja `Actual Finish`. `Start` ja `Finish` vain tunnistavat päivämäärämuodon eivätkä muuta aikataulua. Rivit linkitään tehtäviin tunnuksella `OPS Task ID` tai muutoin yksilöllisellä WBS-koodilla.

**Ei mukana** — kaikki näiden sarakkeiden ulkopuolella: kesto, riippuvuudet, resurssit ja muu aikataulu. Yhteenvetotehtävä ei saa edistymistä taulukosta.

## PDF

**Avaaminen** — ei.

**Tallentaminen** — ei.

**Vienti** — kyllä, raportista: välilehdellä *Raportti* painike *Vie PDF*. Sovellus ei lähetä raporttia itse tulostimelle. Paperille pääsee PDF:n kautta. Sisältö riippuu siitä, mikä raporttityyppi on valittu, katso [Raporttityypit](docs://ref-rapporttypes) ja [Raportin tekeminen ja tulostaminen](docs://howto-rapport-maken-en-afdrukken).

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi IFC on oma muoto ja mitä vienti menettää, esimerkin kanssa.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): vaiheet.
- [Vienti](docs://howto-exporteren): muodon valinta ja viestit viennin jälkeen.
- [Päivämäärät tallennettuina](docs://uitleg-datums-zoals-opgeslagen): miksi avattu tiedosto voi näyttää muita päivämääriä.
- [Laskentavaihtoehdot ja laskentasäännöt](docs://ref-rekenopties-en-conventies): laskentaprofiilit.
