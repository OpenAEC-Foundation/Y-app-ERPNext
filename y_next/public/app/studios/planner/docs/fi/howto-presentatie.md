# Esittäminen suurella näytöllä

Tavoite: näytä Gantt-kaavio koko näytössä ilman valintanauhaa ja paneeleja, esimerkiksi projektorilla tai televisiossa työmaapalaverissa.

## Milloin tätä tarvitset

Kymmenen ihmistä katsoo yhtä näyttöä työmaakopissa. Valintanauha, tilarivi ja ominaisuuspaneeli vievät silloin tilaa, jota aikataulu tarvitsee. Ne myös häiritsevät. Sovellus näyttää **esitystilassa** vain tehtävätaulukon ja Gantt-kaavion koko näytössä.

## Vaiheet

### Näkymän valmistelu

Esitystilassa valintanauha ei ole näkyvissä. Valmistele siksi haluamasi näkymä etukäteen.

1. Paina **Laske** (F5), jotta näytetyt päivämäärät ovat oikein.
2. Valitse näkymä, jonka haluat näyttää, esimerkiksi asettelu, joka näyttää vain kriittiset tehtävät (katso [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken)).
3. Valitse aikaskaala ja zoomaustaso, joilla tehtävien nimet ovat luettavissa etäältä. Tiivistä tai laajenna vaiheet painikkeilla *Tiivistä* ja *Laajenna* ryhmässä *Jäsennys* välilehdellä *Näkymä*.
4. Jos haluat käyttää niitä, ota käyttöön *Jaettu näkymä* ja *Pienoiskartta* (katso [Jaetun näkymän ja pienoiskartan käyttö](docs://howto-split-view-en-mini-map)).

### Esityksen käynnistäminen

Valitse *Näkymä › Esitys › Esitys* tai paina F11. Valintanauha, välilehdet, tilarivi ja oikeanpuoleinen paneeli katoavat. Näkyviin tulevat tehtävätaulukko ja Gantt-kaavio. Jos otit ne käyttöön, näkyviin tulevat myös histogrammi ja pienoiskartta. Muutaman sekunnin ajan alareunassa näkyy teksti *Paina Esc tai F11 poistuaksesi koko näytön tilasta.*

Esitystilan voi käynnistää millä tahansa välilehdeltä, myös välilehdeltä *Taulukko* tai *Raportti*. Näkyvissä on aina avoimen projektin Gantt-kaavio. Kun lopetat, palaat välilehdelle, jolta aloitit.

### Esityksen lopettaminen

Paina Esc tai F11. Valintanauha ja paneelit palaavat välilehdelle, jolta aloitit.

## Sudenkuopat ja mitä sovellus tekee

**Esitystilassa voi edelleen muokata.** Napsautus, vetäminen, solujen muokkaus ja Delete toimivat edelleen. Jos vedät palkin vahingossa, se siirtyy ja aikataulu ei ole enää ajan tasalla. Tehtävän, jonka poistit vahingossa, palautat näppäinyhdistelmällä Ctrl+Z, myös esitystilassa. Napsauta siksi varovasti, kun työskentelet ryhmän kanssa.

**Ilmoitukset näkyvät edelleen.** Sovelluksen viesti, esimerkiksi tallennusvirhe, näkyy myös esitystilassa. Muuten valintanauhaa ja tilariviä ei ole näkyvissä, joten viesti on ainoa merkki siitä, että jokin on vialla.

**Valmistele jaettu näkymä, pienoiskartta ja asettelut etukäteen.** Niihin tarvitaan valintanauha, ja se on tässä tilassa piilossa. Zoomaus toimii hiiren rullalla tai näppäimillä Ctrl+= ja Ctrl+-. Myös + ja - toimivat, mutta vain, kun kohdistus on Gantt-kaaviossa. Kun painat F11, kohdistus on usein tehtävätaulukossa. Napsauta siksi ensin Gantt-kaaviota.

**Koko näyttötila ei toimi.** Sovellus piilottaa valintanauhan ja pyytää lisäksi koko näytön tilaa. Jos selain tai ikkuna ei hyväksy sitä, vain valintanauha ja paneelit katoavat. Esitystila toimii silti. Jos poistut koko näytön tilasta muuten kuin Esc- tai F11-näppäimellä, esimerkiksi käyttöjärjestelmän näppäimellä, myös esitystila päättyy.

**Esitystilaa ei muisteta.** Kun sovellus suljetaan ja avataan uudelleen, esitystila on pois päältä.

## Katso myös

- [Jaetun näkymän ja pienoiskartan käyttö](docs://howto-split-view-en-mini-map): kaksi aikaikkunaa tai yleiskuvapalkki esityksen aikana.
- [Asettelun luominen ja käyttö](docs://howto-layouts-gebruiken): haluamasi näkymän asettaminen yhdellä napsautuksella.
- [Pikanäppäimet](docs://ref-sneltoetsen): F11 ja muut näppäimet.
