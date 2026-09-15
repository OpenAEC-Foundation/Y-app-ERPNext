import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maakAfbeeldingenAbsoluut,
  plakBestandsnaam,
  schaalBreedte,
  sleepBreedte,
} from "./mail-afbeeldingen.ts";

/**
 * Tests voor geplakte afbeeldingen in een mail.
 *
 * Wat hier stil fout gaat: een afbeelding die in het opstelvenster prima
 * staat maar bij de ontvanger een gebroken plaatje is, omdat de mail naar een
 * pad op deze server verwijst dat de ontvanger niet kan openen. En een
 * bestandsnaam als "image.png" die voor iedereen te raden is.
 */

const ORIGIN = "https://3bm.prilk.cloud";

test("een afbeelding van deze server krijgt een volledig adres in de uitgaande mail", () => {
  // Zo staan de logo's in de handtekeningen er ook in, en zo komen die aan.
  const uit = maakAfbeeldingenAbsoluut('<p>zie</p><img src="/files/plak-ab12.png" width="320">', ORIGIN);
  assert.equal(uit, '<p>zie</p><img src="https://3bm.prilk.cloud/files/plak-ab12.png" width="320">');
});

test("wat al een volledig adres of een cid is, blijft staan", () => {
  const html = '<img src="https://elders.nl/a.png"><img src="cid:logo1"><img src="data:image/png;base64,AAA">';
  assert.equal(maakAfbeeldingenAbsoluut(html, ORIGIN), html);
});

test("enkele aanhalingstekens en een schuine streep aan het eind van de origin", () => {
  assert.equal(
    maakAfbeeldingenAbsoluut("<img alt='x' src='/files/b.jpg'>", ORIGIN + "/"),
    "<img alt='x' src='https://3bm.prilk.cloud/files/b.jpg'>",
  );
});

test("alleen img-bronnen, geen links of tekst", () => {
  const html = '<a href="/files/x.pdf">/files/x.pdf</a>';
  assert.equal(maakAfbeeldingenAbsoluut(html, ORIGIN), html);
});

test("de bestandsnaam van een geplakte afbeelding is niet te raden", () => {
  const a = plakBestandsnaam("image/png");
  const b = plakBestandsnaam("image/png");
  assert.match(a, /^plak-[a-z0-9]{12,}\.png$/);
  assert.notEqual(a, b);
  assert.match(plakBestandsnaam("image/jpeg"), /\.jpg$/);
  // Een onbekend soort valt terug op png in plaats van een naam zonder extensie.
  assert.match(plakBestandsnaam("image/x-onbekend"), /\.png$/);
});

test("schaalBreedte: een deel van de echte breedte, nooit breder dan het venster", () => {
  assert.equal(schaalBreedte(1200, 0.5, 600), 600);
  assert.equal(schaalBreedte(800, 0.5, 600), 400);
  assert.equal(schaalBreedte(800, 1, 600), 600);
  assert.equal(schaalBreedte(300, 1, 600), 300);
  // Nooit kleiner dan een herkenbaar plaatje.
  assert.equal(schaalBreedte(100, 0.1, 600), 40);
});

test("sleepBreedte: slepen maakt breder of smaller binnen de grenzen", () => {
  assert.equal(sleepBreedte(300, 50, 40, 600), 350);
  assert.equal(sleepBreedte(300, -400, 40, 600), 40);
  assert.equal(sleepBreedte(300, 900, 40, 600), 600);
  assert.equal(sleepBreedte(300, 12.6, 40, 600), 313);
});
