# Automaattitallennuksen käyttöönotto

Tavoite: sovellus päivittää projektitiedoston työn aikana, jolloin Ctrl+S-näppäintä ei tarvitse painaa jatkuvasti.

## Kun tarvitset tätä

Yhden aikataulun parissa työskennellään pitkään tai tallentaminen unohtuu usein, ja tiedoston levyllä tai jaetussa kansiossa halutaan pysyvän ajan tasalla. Automaattitallennus ei korvaa kaatumispalautusta. Kaatumispalautus on aina käytössä ja toimii erillään tästä. Eron lukee kohdasta [Tiedostot ja tallennusmuodot](docs://uitleg-bestanden).

## Vaiheet

1. Jos projektilla ei ole vielä tiedostoa, tallenna se ensin kerran valitsemalla *Aloitus › Tiedosto › Tallenna nimellä*. Niin kauan kuin tiedostoa ei ole, kytkin on harmaa ja ohjeteksti kertoo: *Tallenna projekti ensin, jotta automaattitallennus toimii*.
2. Napsauta yläpalkin vasemmassa reunassa olevaa *Automaattitallennus*-kytkintä. Kun se on päällä, ohjeteksti kertoo: *Automaattitallennus on päällä: muutokset kirjoitetaan tähän tiedostoon*.
3. Jatka työskentelyä. Heti kun projektissa on muutoksia, sovellus kirjoittaa sen tiedostoon ilman ikkunaa, enintään kerran kymmenessä sekunnissa. Sen jälkeen *Tallentamaton*-merkki häviää itsestään.
4. Jos automaattitallennus halutaan lopettaa, napsauta kytkintä vielä kerran. Ohjeteksti kertoo silloin: *Automaattitallennus on pois päältä. Kaatumispalautus on aina käytössä*.

Chrome ja Edge sallivat aluksi vain avatun tiedoston lukemisen. Kytkin ei tee Chromessa eikä Edgessä mitään, ennen kuin tiedosto on tallennettu kerran komennolla *Tallenna* (Ctrl+S) ja selain on antanut luvan kirjoittaa. Sen jälkeen kytkimen voi ottaa käyttöön. Firefoxissa kytkin pysyy harmaana, koska sovellus ei voi kirjoittaa tiedostoon siellä.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kytkin kuuluu yhteen projektiin.** Jokaisella välilehdellä on oma tila. Projektin avaamisen jälkeen kytkin on aina pois päältä, eikä sovellus muista sitä seuraavaa kertaa varten.

**Automaattitallennus kirjoittaa vain siihen tiedostoon, jonka projektilla jo on.** Jos valitset *Tallenna nimellä*, sovellus kirjoittaa siitä lähtien uuteen tiedostoon. Sovellus kirjoittaa vain, jos projektissa on muutoksia.

**Kirjoittaminen voi epäonnistua.** Jos tiedosto on esimerkiksi poistettu tai lukittu, näkyviin tulee viesti *Automaattitallennus epäonnistui* ja syy. Jos selaimella ei ole lupaa kirjoittaa tai lupa on mennyt, sovellus ohittaa kierroksen hiljaa. Se ei pyydä lupaa.

**Tiedostoon tulee myös muutoksia, joita et halua säilyttää.** Automaattitallennus kirjoittaa projektin tilan sellaisena kuin se on sillä hetkellä. Jos jokin asia kumotaan painamalla Ctrl+Z, tiedostoon tulee kumottu tila kymmenen sekunnin kuluessa. Jos vanha versio halutaan säilyttää, tee ensin kopio komennolla *Tallenna nimellä*.

**Kaatuminen vie silti viimeiset sekunnit.** Sovellus kirjoittaa enintään kerran kymmenessä sekunnissa. Työ, joka on tehty sen välissä, ei ole vielä tiedostossa. Kaatumispalautuksessa on sama raja.

**Selaimessa palautuksen jälkeen kytkin on taas harmaa.** Selaimesta kaatumisen jälkeen takaisin saatu projekti ei ole enää yhteydessä tiedostoonsa. Tallenna se kerran, jolloin kytkin toimii taas. Lue lisää kohdasta [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash).

**Projektilla, joka on tuotu toisesta muodosta, ei ole tiedostoa.** CSV-, XML-, `.mpp`- tai `.xer`-tiedosto saa IFC-tiedoston vasta tallennettaessa. Sen jälkeen automaattitallennuksen voi ottaa käyttöön.

## Katso myös

- [Tiedostot ja tallennusmuodot](docs://uitleg-bestanden): ero tallentamisen, automaattitallennuksen ja kaatumispalautuksen välillä.
- [Tiedoston avaaminen ja tallentaminen](docs://howto-bestand-openen-en-opslaan): tallentaminen, *Tallenna nimellä* ja *Tallentamaton*-merkki.
- [Palautus kaatumisen jälkeen](docs://howto-herstellen-na-een-crash): mitä sovellus tarjoaa, jos se ei sulkeutunut kunnolla.
