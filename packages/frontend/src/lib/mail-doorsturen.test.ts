import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bijlagenamen,
  echteBijlagen,
  kiesDoorstuurBijlagen,
  type Berichtbijlage,
} from "./mail-doorsturen.ts";

// Eigen testwaarden voor `echteBijlagen`, vóór de tests die ze gebruiken.
const FACTUUR_VOOR_LIJST = {
  name: "0a1b2c", file_name: "Factuur 263-05188.pdf", file_url: "/private/files/Factuur 263-05188.pdf",
};
const LOGO_VOOR_LIJST = { name: "9z8y7x", file_name: "image001.png", file_url: "/private/files/image001f17d34.png" };
const FOTO_VOOR_LIJST = { name: "3d4e5f", file_name: "bouwplaats.jpg", file_url: "/private/files/bouwplaats.jpg" };
const HTML_MET_LOGO_VOOR_LIJST = '<p>Met vriendelijke groet</p><img src="/private/files/image001f17d34.png" width="120">';

test("echteBijlagen: plaatjes uit de tekst vallen weg, echte bijlagen en foto's blijven", () => {
  const uit = echteBijlagen([LOGO_VOOR_LIJST, FACTUUR_VOOR_LIJST, FOTO_VOOR_LIJST], HTML_MET_LOGO_VOOR_LIJST);
  assert.deepEqual(uit.map((b) => b.file_name), ["Factuur 263-05188.pdf", "bouwplaats.jpg"]);
});

test("echteBijlagen: zonder tekst blijft alles staan, en de volgorde verandert niet", () => {
  const lijst = [FOTO_VOOR_LIJST, LOGO_VOOR_LIJST, FACTUUR_VOOR_LIJST];
  assert.deepEqual(echteBijlagen(lijst, ""), lijst);
});

test("echteBijlagen: een plaatje met spaties in de naam, ge-escapet in de tekst, valt ook weg", () => {
  const plaatje = { name: "p1", file_name: "image 003.png", file_url: "/private/files/image 003.png" };
  const uit = echteBijlagen([plaatje, FACTUUR_VOOR_LIJST], '<img src="/private/files/image%20003.png">');
  assert.deepEqual(uit.map((b) => b.name), ["0a1b2c"]);
});

/**
 * Tests voor de bijlagen bij doorsturen.
 *
 * Twee dingen gaan hier stil fout en zijn op het scherm niet te zien: een
 * bijlage die niet meegaat (de ontvanger mist hem en niemand merkt het), en
 * een logo uit een handtekening dat wél meegaat (de mail komt aan met vier
 * naamloze plaatjes eronder).
 */

const FACTUUR: Berichtbijlage = {
  name: "0a1b2c",
  file_name: "Factuur 263-05188.pdf",
  file_url: "/private/files/Factuur 263-05188.pdf",
};
const LOGO: Berichtbijlage = {
  name: "9z8y7x",
  file_name: "image001.png",
  file_url: "/private/files/image001f17d34.png",
};
const FOTO: Berichtbijlage = {
  name: "3d4e5f",
  file_name: "bouwplaats.jpg",
  file_url: "/private/files/bouwplaats.jpg",
};

const HTML_MET_LOGO =
  '<p>Met vriendelijke groet</p><img src="/private/files/image001f17d34.png" width="120">';

test("een gewone bijlage gaat mee", () => {
  const uit = kiesDoorstuurBijlagen([FACTUUR], "<p>Zie bijlage</p>");
  assert.deepEqual(uit, [{ name: "0a1b2c", fileName: "Factuur 263-05188.pdf" }]);
});

test("een plaatje uit de opmaak gaat niet mee", () => {
  // Het logo staat al ín de doorgestuurde tekst; nog eens bijvoegen levert
  // een mail op met een naamloze png eronder.
  const uit = kiesDoorstuurBijlagen([FACTUUR, LOGO], HTML_MET_LOGO);
  assert.deepEqual(uit.map((b) => b.fileName), ["Factuur 263-05188.pdf"]);
});

test("een foto als bijlage gaat wél mee, ook al is het een plaatje", () => {
  // De toets kijkt naar de tekst, niet naar het bestandstype: aan het type is
  // een bouwfoto niet van een logo te onderscheiden.
  const uit = kiesDoorstuurBijlagen([FOTO, LOGO], HTML_MET_LOGO);
  assert.deepEqual(uit.map((b) => b.fileName), ["bouwplaats.jpg"]);
});

test("een spatie in de bestandsnaam verandert niets", () => {
  // In de `src` van een afbeelding staat %20 waar het File-record een spatie
  // heeft; zonder deze vergelijking zou zo'n plaatje alsnog meegaan.
  const metSpatie: Berichtbijlage = {
    name: "aabbcc",
    file_name: "kop banner.png",
    file_url: "/private/files/kop banner.png",
  };
  const html = '<img src="/private/files/kop%20banner.png">';
  assert.deepEqual(kiesDoorstuurBijlagen([metSpatie], html), []);
});

test("zonder docnaam valt een bijlage af", () => {
  // Het versturen kan er niets mee, en hem stil laten mislukken is erger dan
  // hem niet aanbieden.
  const uit = kiesDoorstuurBijlagen(
    [{ name: "", file_name: "kwijt.pdf", file_url: "/private/files/kwijt.pdf" }], "");
  assert.deepEqual(uit, []);
});

test("dezelfde bijlage twee keer levert er één op", () => {
  const uit = kiesDoorstuurBijlagen([FACTUUR, FACTUUR], "");
  assert.equal(uit.length, 1);
});

test("een leeg bericht laat alle bijlagen staan", () => {
  const uit = kiesDoorstuurBijlagen([FACTUUR, LOGO], "");
  assert.equal(uit.length, 2);
});

test("namen op een rij", () => {
  assert.equal(bijlagenamen([{ fileName: "a.pdf" }, { fileName: " " }, { fileName: "b.docx" }]),
    "a.pdf, b.docx");
});
