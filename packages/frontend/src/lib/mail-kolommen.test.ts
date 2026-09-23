import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KOLOM_START, LEESPANEEL_MIN, VOORBEELD_START, begrensKolom, begrensVoorbeeld, opgeslagenKolom, opgeslagenVoorbeeld,
} from "./mail-kolommen.ts";

test("begrensKolom: de mappenkolom blijft tussen 160 en 400", () => {
  assert.equal(begrensKolom("mappen", 100, 2000, 384), 160);
  assert.equal(begrensKolom("mappen", 999, 2000, 384), 400);
  assert.equal(begrensKolom("mappen", 250.6, 2000, 384), 251);
});

test("begrensKolom: de lijst laat het leespaneel altijd minstens zijn minimum", () => {
  // Rij van 1600: mappen 224, dus de lijst mag tot 1600 - 224 - 420 = 956, maar nooit boven 900.
  assert.equal(begrensKolom("lijst", 1200, 1600, 224), 900);
  // Rij van 1200: tot 1200 - 224 - 420 = 556.
  assert.equal(begrensKolom("lijst", 800, 1200, 224), 1200 - 224 - LEESPANEEL_MIN);
  assert.equal(begrensKolom("lijst", 100, 1200, 224), 280);
});

test("begrensKolom: op een te smal scherm wint het minimum van de kolom", () => {
  assert.equal(begrensKolom("lijst", 500, 800, 224), 280);
});

test("begrensKolom: zonder bekende ruimte gelden alleen de vaste grenzen", () => {
  assert.equal(begrensKolom("lijst", 1000, Number.NaN, 224), 900);
  assert.equal(begrensKolom("lijst", 500, 0, 224), 500);
});

test("opgeslagenKolom: niets of onzin geeft de standaardbreedte", () => {
  assert.equal(opgeslagenKolom("lijst", null), KOLOM_START.lijst);
  assert.equal(opgeslagenKolom("lijst", ""), KOLOM_START.lijst);
  assert.equal(opgeslagenKolom("mappen", "breed"), KOLOM_START.mappen);
});

test("opgeslagenKolom: een bewaarde breedte komt terug, binnen de grenzen", () => {
  assert.equal(opgeslagenKolom("lijst", "520"), 520);
  assert.equal(opgeslagenKolom("lijst", "5000"), 900);
  assert.equal(opgeslagenKolom("mappen", "20"), 160);
});

test("voorbeeldpaneel: grenzen en bewaarde breedte", () => {
  assert.equal(begrensVoorbeeld(560, 1400), 560);
  assert.equal(begrensVoorbeeld(100, 1400), 320, "niet smaller dan het minimum");
  assert.equal(begrensVoorbeeld(1200, 1000), 580, "de mail houdt zijn minimumbreedte");
  assert.equal(opgeslagenVoorbeeld(null), VOORBEELD_START);
  assert.equal(opgeslagenVoorbeeld("onzin"), VOORBEELD_START);
  assert.equal(opgeslagenVoorbeeld("700"), 700);
});
