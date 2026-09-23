import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gebruikOpgeslagenOndertekening, heeftEigenHuisstijl, huisstijlVoor, opmaakOndertekening,
} from "./mail-signature-erpnext.ts";

/**
 * Welke ondertekening onder een mail komt.
 *
 * De opgebouwde ondertekening draagt vaste beeldmerken van één bedrijf (logo,
 * website, LinkedIn). Op een installatie van een ander bedrijf kwam dat merk
 * onder elke mail te staan, over de eigen handtekening van de persoon heen.
 */

const OPGESLAGEN = '<table><tr><td>Met vriendelijke groet, Nino</td></tr></table><!-- y-next-signature v3 -->';

test("heeftEigenHuisstijl: alleen bedrijven waarvoor de beeldmerken gemaakt zijn", () => {
  assert.equal(heeftEigenHuisstijl("3BM Bouwtechniek V.O.F."), true);
  assert.equal(heeftEigenHuisstijl("OpenAEC Studio BV"), false);
  assert.equal(heeftEigenHuisstijl(""), false);
});

test("een persoon met eigen handtekening, bij een bedrijf zonder vaste huisstijl: de eigen handtekening", () => {
  assert.equal(gebruikOpgeslagenOndertekening("OpenAEC Studio BV", OPGESLAGEN), true);
});

test("zonder medewerkerskaart (geen bedrijf) wint de eigen handtekening ook", () => {
  assert.equal(gebruikOpgeslagenOndertekening("", OPGESLAGEN), true);
});

test("bij het bedrijf met vaste huisstijl blijft de opgebouwde ondertekening staan", () => {
  assert.equal(gebruikOpgeslagenOndertekening("3BM Bouwtechniek V.O.F.", OPGESLAGEN), false);
});

test("zonder eigen handtekening valt er niets te kiezen: opbouwen", () => {
  assert.equal(gebruikOpgeslagenOndertekening("OpenAEC Studio BV", ""), false);
  assert.equal(gebruikOpgeslagenOndertekening("OpenAEC Studio BV", "   \n "), false);
});

test("huisstijlVoor: de postbus bepaalt het beeldmerk", () => {
  assert.equal(huisstijlVoor("info@vindus.nl").company, "Vroughindeweij Industries B.V.");
  assert.equal(huisstijlVoor("maarten@3bm.co.nl").company, "3BM Bouwtechniek V.O.F.");
  assert.equal(huisstijlVoor("").company, "3BM Bouwtechniek V.O.F.");
});

test("de ondertekening van Vindus draagt geen 3BM-beeldmerken", () => {
  const html = opmaakOndertekening({
    user: { name: "maarten@3bm.co.nl", full_name: "Maarten Vroegindeweij" },
    employee: null,
    adres: { address_title: "Vroughindeweij Industries B.V.", address_line1: "Burgemeester de Raadtsingel 31", pincode: "3311 JG", city: "Dordrecht" },
    bedrijf: "Vroughindeweij Industries B.V.",
    fotoBron: "",
    huisstijl: huisstijlVoor("info@vindus.nl"),
  });
  assert.match(html, /vindus-logo\.png/);
  assert.match(html, /Vroughindeweij Industries/);
  assert.match(html, /Burgemeester de Raadtsingel 31/);
  assert.ok(!html.includes("3bm.co.nl"), "geen 3BM-website");
  assert.ok(!html.includes("linkedin"), "geen LinkedIn-knop");
});
