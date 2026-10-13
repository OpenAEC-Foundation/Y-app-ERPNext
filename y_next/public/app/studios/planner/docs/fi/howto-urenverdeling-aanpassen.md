# Tuntijakautumisen muokkaaminen

Tavoite: yhdelle resurssikohdistukselle määritetään itse, kuinka paljon resurssi työskentelee tehtävän jokaisena työpäivänä. Vakiokäyrän sijaan.

## Milloin tätä tarvitaan

Käyrä, kuten *Kellomainen*, on kiinteä muoto. Joskus tiedetään paremmin. Bricklayer-resurssi aloittaa outer cavity leaf -tehtävän puolella teholla, koska telineitä vielä pystytetään. Sen jälkeen hän työskentelee täydellä teholla. Tai huippukuorma halutaan pitää juuri kapasiteetin alapuolella. Silloin muokataan **tuntijakautumista**.

Työskennellään **vaiheilla**: peräkkäiset työpäivät, joina resurssi työskentelee samalla kuormitusasteella. Jakautuminen muuttaa vain tämän yhden resurssikohdistuksen tuntia päivässä. Tehtävän päivämäärät eivät muutu.

## Toimenpiteet

Esimerkki on outer cavity leaf: 6 työpäivää, yksi bricklayer-resurssi, 48 tuntia.

1. Valitse tehtävä. *Ominaisuudet*-paneeli on oikealla. Jos paneeli ei näy, ota se käyttöön valinnalla *Näkymä › Paneelit › Ominaisuudet*.
2. Valitse *Resurssikohdistukset*-osiosta bricklayer-resurssin vieressä pylvään muotoinen kuvake *Muokkaa tuntijakautumista…*. Avautuu *Tuntien jakautuminen vaiheisiin* -ikkuna. Lähtökohtana on se, mitä sovellus tällä hetkellä varaa: outer cavity leaf -tehtävälle yksi vaihe, 6 päivää ja kuormitusaste 1.
3. Tarvittaessa valitse lähtökohta kohdasta *Sovella muotoa:*. Kun valitaan *Kellomainen*, sovellus luo viisi vaihetta: 0.18 kuormitusastetta ensimmäiselle ja viimeiselle päivälle, 0.84 toiselle ja viidennelle päivälle sekä 1.98 kahdelle keskimmäiselle päivälle. Yhteensä on edelleen 48 tuntia.

### Vaiheiden muokkaaminen

Muokkaus onnistuu taulukossa tai sen yläpuolella olevassa nauhassa.

- Kirjoita vaiheeseen eri arvo kenttään *Kuormitusaste (yks./pv)*. Sarakkeet *Tuntia/pv* ja *Tunnit* lasketaan mukana.
- Muuta vaiheen kohdan *Päivät* arvoa. Viimeinen vaihe päättyy aina tehtävän loppuun ja saa jäljelle jäävät päivät.
- Valitse *Jaa*, jolloin vaihe jaetaan kahteen osaan, esimerkiksi 6 päivää 3 ja 3 päivään. Valitse *Yhdistä*, kun vaihe yhdistetään seuraavaan.
- Nauhassa vedetään rajaa, kun vaihe halutaan pidentää tai lyhentää. Yläreunaa vedetään, kun kuormitusaste halutaan asettaa. Päivää kaksoisnapsautetaan, kun vaihe halutaan jakaa.

### Käyttäminen

Valitse *Käytä*. Kun valitaan *Peruuta*, ikkuna sulkeutuu ilman muutoksia.

Esimerkki. Valitaan *Jaa*, asetetaan ensimmäisen vaiheen *Päivät* arvoon 2 ja tämän vaiheen kuormitusaste arvoon 0.5. Toinen vaihe kestää sitten 4 päivää kuormitusasteella 1. Yhteensä on 2 × 0.5 × 8 + 4 × 1 × 8 = 40 tuntia.

Kun *Käytä* on valittu, resurssikohdistuksen käyrä asetetaan arvoon *Jaksottuminen* ja se on pois käytöstä. *Kuorm./päivä* säilyy ennallaan. Histogrammi ja ylikuormitus seuraavat uutta jakautumista heti. Ei tarvitse laskea uudelleen, koska mikään päivämäärä ei siirry.

### Jakautumisen vapauttaminen

Jos resurssikohdistuksella on oma jakautuminen, ikkunassa on myös *Vapauta jakautuminen*. Silloin oma jakautuminen poistuu ja sovellus palaa kenttään *Kuorm./päivä* ja käyrään. Tämä valitaan myös, jos käyrää halutaan muuttaa. Pudotusvalikko *Käyrä* on nimittäin pois käytöstä niin kauan kuin oma jakautuminen on olemassa.

## Sudenkuopat ja mitä sovellus silloin tekee

**Kokonaismäärä muuttuu mukana.** Tunteja ei jaeta, vaan ne päätetään itse. Jos vaiheen arvoksi asetetaan 0.5 arvon 0.18 sijaan, kokonaismäärä kasvaa. Kokonaismäärä tunteina on ikkunan alareunassa, joten se tarkistetaan ennen kuin *Käytä* valitaan.

**Kuormitusasteen muutoksen vaikutus riippuu työsäännöstä.** Kun *Kiinteä kesto ja kuormitusaste* on käytössä, toinen *Kuorm./päivä* ei muuta jakautumista. Kun *Kiinteä kesto ja työmäärä* on käytössä, sovellus skaalaa tunnit päivässä uuden kuormitusasteen mukaan: kuormitusasteella 2 arvon 1 sijaan jokainen päivä kaksinkertaistuu, ja samoin kokonaismäärä (32 tunnista 64 tuntiin). Kesto pysyy samana. Kun *Kiinteä työmäärä* on käytössä, kuormitusaste muuttaa tehtävän kestoa: jakautuminen puristetaan tai venytetään uuteen kestoon samalla kokonaismäärällä. Kun *Kiinteä yksikkömäärä* on käytössä, kuormitusaste muuttaa myös kestoa. Sen jälkeen kokonaismäärä kannattaa tarkistaa ikkunan alareunasta.

**Kun tehtävän kestoa muutetaan, jakautuminen venyy mukana.** Muoto pysyy samana. Kun *Kiinteä kesto ja kuormitusaste* tai *Kiinteä yksikkömäärä* on käytössä, kokonaismäärä kasvaa suhteessa kestoon. Jos tehtävän kesto, jolla on oma jakautuminen, kaksinkertaistuu 4 työpäivästä 8 työpäivään, kokonaismäärä kaksinkertaistuu myös, 32 tunnista 64 tuntiin. Kun *Kiinteä kesto ja työmäärä* tai *Kiinteä työmäärä* on käytössä, kokonaismäärä pysyy samana (32 tuntia pysyy 32 tuntina) ja kuormitusasteet laskevat.

**Työ seuraa jakautumista.** *Työ (jäljellä)* on vaiheiden summa, myös silloin, kun *Kiinteä työmäärä* on käytössä. Tehtävän kesto ei muutu tämän takia.

**Virheellinen kuormitusaste.** Tyhjä tai negatiivinen kuormitusaste saa punaisen reunan, ja *Käytä* on silloin pois käytöstä. Vaihe, jonka kuormitusaste on 0, on sallittu. Tällainen vaihe pysyy tehtävän keston sisällä.

**Kaikki koskee vain tätä yhtä resurssikohdistusta.** Sovellus ilmoittaa tämän itse: *Jakautuminen muuttaa vain tämän resurssikohdistuksen tuntia päivässä; tehtävän päivämäärät ja jaot pysyvät ennallaan.* Muut saman tehtävän resurssit säilyttävät oman jakautumisensa.

**Tasaaminen seuraa jakautumista.** Tasaaja laskee samat tunnit päivässä kuin histogrammi.

**Kumoaminen.** *Käytä* ja *Vapauta jakautuminen* ovat kumpikin yksi vaihe, jonka voi kumota painamalla *Kumoa* (Ctrl+Z).

## Katso myös

- [Resurssien kohdistaminen käyrällä](docs://howto-resource-toewijzen): resurssin asettaminen tehtävälle ja käyrän valitseminen.
- [Ylikuormituksen ratkaiseminen](docs://howto-overbezetting-oplossen): mitä tehdään, kun resurssilla on liikaa tehtävää yhtenä päivänä.
