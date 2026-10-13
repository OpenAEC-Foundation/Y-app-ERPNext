# MS Project -tiedoston (.mpp) avaaminen

Tavoite: avaa Microsoft Project -aikataulu suoraan sovelluksessa, ilman että se viedään ensin.

## Milloin tätä tarvitaan

Urakoitsija, konsultti tai asiakas lähettää aikataulunsa `.mpp`-tiedostona. Tiedostoa halutaan katsoa, laskea tai kehittää edelleen. Sovellus lukee `.mpp`-tiedostoja MS Project 2010:stä 2021:een asti. Se vain lukee: se ei kirjoita `.mpp`-tiedostoa eikä muuta tiedostoa koskaan. Tiedostosta se ottaa aikataulun itsensä: tehtävät rakenteineen, kestoineen ja rajoitteineen, riippuvuudet viiveineen, kalenterit, resurssit, resurssikohdistukset ja edistymisen. Se lukee myös MS Projectin itse laskemat päivämäärät ja pelivarat, mutta käyttää niitä vain näkymässä *Tallennetut päivämäärät*, ei koskaan syötteenä.

## Vaiheet

1. Valitse *Aloitus › Tiedosto › Avaa* tai paina Ctrl+O. Valitse `.mpp`-tiedosto.
2. Projekti avautuu uuteen välilehteen. Jos nykyinen välilehti on vielä tyhjä eikä sitä ole muutettu, projekti avautuu siihen. Projektilla ei ole tiedostoa. *Tallenna* kirjoittaa myöhemmin uuden IFC-tiedoston.
3. Lue viesti alareunasta: *Tämä projekti lasketaan tavalla Microsoft Project. Muuta sitä kohdassa Tiedosto → Projektitiedot → Laskentaprofiili ja laskentavaihtoehdot.* Sovellus laskee tämän projektin MS Projectin laskentasäännöillä: laskentaprofiilina *Microsoft Project*. Valitsemalla *Avaa laskentaprofiili* siirrytään asetukseen. *Lue lisää* avaa ohjeen laskentaprofiileista.
4. Katso, näkyykö valintanauhan alla ilmoitus: *Päivämäärät näytetään sellaisina kuin ne ovat tiedostossa. Kun lasketaan uudelleen, 4 tehtävää siirtyisi.* Näissä tehtävissä sovelluksen laskema tulos poikkeaa MS Projectin tallentamista päivämääristä. Vaiheen 3 viestin alla on lisäksi rivi: *4 tehtävää näyttää päivämäärät sellaisina kuin ne ovat tiedostossa (ei laskettuina uudelleen).* Mitä tämä tarkoittaa ja miten sovelluksen oma laskenta otetaan käyttöön, kerrotaan kohdassa [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen).
5. Jos näkyy *Tämä tiedosto sisältää tuntisuunnittelua.* ja painike *Ota tuntisuunnittelu käyttöön*, tiedosto sisältää tuntitietoja. Katso [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten).

Jos tiedostossa on tehtäviä, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu, näkyy lisäksi toinen viesti, esimerkiksi *Tämä MS Project -tiedosto sisältää 3 tehtävää, joiden aikataulu on tauotettu, tasattu tai resurssiohjattu. Ne tuodaan ja näytetään sellaisina.* Kun tehtävä on vain yksi, viesti on yksikkömuodossa.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kaikki ei tule mukana.** Sovellus ei tuo mukanaan MS Projectin perustasoja, kustannuksia ja normaalihintoja, muistiinpanoja eikä mukautettuja kenttiä. WBS-koodi, joka on täytetty itse MS Projectissa, tuodaan mukaan. Muuten sovellus numeroi tehtävät rakenteen mukaan.

**Tiedosto MS Project 2007:stä tai vanhemmasta.** Sovellus ei avaa sitä ja näyttää: *Tämä .mpp-tiedosto on vanhassa muodossa (Project 2007 tai vanhempi). Vie se MS Projectissa XML-muodossa (Tiedosto → Tallenna nimellä → XML) ja avaa se.* Viestin alla sovellus lisää teknisen syyn englanniksi.

**Salasanalla suojattu tiedosto.** Sovellus näyttää: *Tämä .mpp-tiedosto on suojattu salasanalla. Vie se MS Projectissa XML-muodossa (Tiedosto → Tallenna nimellä → XML) ja avaa se.* Myös tässä viestin mukana tulee tekninen syy englanniksi.

**Tiedosto, joka ei olekaan `.mpp`.** Sovellus näyttää: *Avaaminen epäonnistui*, ja mukana on tekninen syy.

**XML-vienti lasketaan toisin.** Jos avataan MS Projectin XML-vienti `.mpp`-tiedoston sijaan, sovellus laskee laskentaprofiililla *Open Planner Studio*, eikä viestiä *Microsoft Project* näy. Päivämäärät voivat silloin olla erilaisia kuin `.mpp`-tiedostolla.

**Muokkaus irrottaa tehtävän MS Projectin ohjauksesta.** Jos muokataan tehtävää, jonka aikataulua ohjasi MS Projectin päivämääräikkuna, sovellus näyttää kerran projektia kohden: *MS Projectin päivämääräikkuna ei enää ohjaa 2 tehtävää tämän muokkauksen jälkeen. Työn jakautuminen sen sijaan pätee edelleen ja säilyy tiedostossa.* Kun tehtävä on vain yksi, viesti on yksikkömuodossa.

**Tallentaminen ei koskaan korvaa `.mpp`-tiedostoa.** Projektilla ei ole tiedostoa. *Tallenna* kysyy, minne uusi IFC-tiedosto tallennetaan.

## Katso myös

- [Tiedostot ja muodot](docs://uitleg-bestanden): miksi `.mpp`-tiedostoa vain luetaan ja mitä tallennus kirjoittaa.
- [Tallennetut päivämäärät](docs://uitleg-datums-zoals-opgeslagen): näkymä MS Projectin omista päivämääristä.
- [Tuntisuunnittelun käyttöönotto](docs://howto-urenplanning-aanzetten): jos tiedostossa on tuntitietoja.
- [Primavera P6 -tiedoston (.xer) avaaminen](docs://howto-xer-openen): sama Primaveralle.
- [Tuonti- ja vientimuodot](docs://ref-import-exportformaten): muodoittain, mitä siirtyy mukana ja mitä ei.
- [Laskentaprofiilit ja laskentasäännöt](docs://uitleg-rekenprofielen): miksi MS Project -tiedosto avautuu omalla laskentaprofiilillaan.
