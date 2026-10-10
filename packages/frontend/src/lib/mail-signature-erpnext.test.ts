import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bijsnijdVierkant, fotoUitOpgeslagen, huisstijlUitBedrijf, opmaakOndertekening,
} from "./mail-signature-erpnext.ts";

/**
 * Tests voor de pasfoto in de handtekening.
 *
 * De foto stond erin als "/private/files/pasfoto.png": een privé bestand op
 * een relatief pad. In het opstelvenster zag hij er goed uit, want daar ben je
 * ingelogd; bij de ontvanger was het een gebroken plaatje. Daarom gaat hij nu
 * als base64 mee in de handtekening zelf.
 */

const HUISSTIJL = huisstijlUitBedrijf({
  name: "Voorbeeld Bouw B.V.",
  company_logo: "/files/logo-voorbeeld.png",
  website: "https://www.voorbeeld.nl",
  custom_linkedin_url: "https://www.linkedin.com/company/voorbeeld",
});

const PERSOON = {
  user: { name: "jan@voorbeeld.nl", full_name: "Jan de Vries", user_image: "/private/files/pasfoto jan.png" },
  employee: { name: "HR-EMP-00019", employee_name: "Jan de Vries", image: "/private/files/pasfoto jan.png" },
  adres: null,
  huisstijl: HUISSTIJL,
};

const DATA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

test("een meegegeven foto als base64 komt in de handtekening", () => {
  const html = opmaakOndertekening({ ...PERSOON, fotoBron: DATA });
  assert.ok(html.includes('src="' + DATA + '"'), "de base64-bron moet onveranderd in de img staan");
  assert.ok(!html.includes("/private/files/"), "het privé pad mag niet meer in de mail staan");
});

test("lege fotobron betekent: geen foto, geen gebroken plaatje", () => {
  const html = opmaakOndertekening({ ...PERSOON, fotoBron: "" });
  assert.ok(!html.includes("border-radius:50%"), "geen ronde pasfoto");
  assert.ok(html.includes("Jan"), "de naam blijft wel staan");
});

test("zonder fotobron blijft het oude gedrag", () => {
  const html = opmaakOndertekening({ ...PERSOON });
  assert.ok(html.includes("/private/files/pasfoto jan.png"));
});

test("het logo blijft een adres, alleen de persoon wordt base64", () => {
  const html = opmaakOndertekening({ ...PERSOON, fotoBron: DATA });
  assert.equal((html.match(/data:image/g) || []).length, 1);
  // Het logo blijft een pad op deze server; bij verzenden maakt
  // `maakAfbeeldingenAbsoluut` er een volledig adres van.
  assert.match(html, /<img src="\/files\/logo-voorbeeld\.png" height="56"/);
});

test("bijsnijdVierkant: het midden van een liggende foto", () => {
  assert.deepEqual(bijsnijdVierkant(400, 200), { sx: 100, sy: 0, zijde: 200 });
});

test("bijsnijdVierkant: van een staande foto de bovenkant, daar zit het hoofd", () => {
  // Een profielfoto is vaak een staande foto van het hele lichaam (512 x 768).
  // Het vierkant uit het midden is dan het bovenlijf.
  assert.deepEqual(bijsnijdVierkant(300, 500), { sx: 0, sy: 0, zijde: 300 });
  assert.deepEqual(bijsnijdVierkant(512, 768), { sx: 0, sy: 0, zijde: 512 });
});

test("bijsnijdVierkant: een vierkante foto blijft heel", () => {
  assert.deepEqual(bijsnijdVierkant(240, 240), { sx: 0, sy: 0, zijde: 240 });
});

test("fotoUitOpgeslagen: de hoofdfoto uit de handtekening van de postbus, niet het logo of een pictogram", () => {
  // Een handmatig ingestelde handtekening: pasfoto, bedrijfslogo en een klein
  // pictogram van een sociaal netwerk.
  const html = '<p><img src="https://erp.voorbeeld.nl/files/pasfoto.png" width="70"></p>'
    + '<p><img src="https://erp.voorbeeld.nl/files/logo-voorbeeld.png" height="56" width="215"></p>'
    + '<p><img src="https://erp.voorbeeld.nl/files/pictogram.png" height="23" width="23"></p>';
  assert.equal(
    fotoUitOpgeslagen(html, ["/files/logo-voorbeeld.png"]),
    "https://erp.voorbeeld.nl/files/pasfoto.png",
  );
});

test("fotoUitOpgeslagen: alleen het logo en een pictogram betekent geen foto", () => {
  const html = '<img src="https://erp.voorbeeld.nl/files/logo-voorbeeld.png">'
    + '<img src="/files/pictogram.png" width="23" height="23">';
  assert.equal(fotoUitOpgeslagen(html, ["/files/logo-voorbeeld.png"]), "");
  assert.equal(fotoUitOpgeslagen("", []), "");
});

test("fotoUitOpgeslagen: zonder bekend logo telt de eerste afbeelding die geen pictogram is", () => {
  const html = '<img src="/files/pictogram.png" width="16"><img src="/files/pasfoto.png" width="70">';
  assert.equal(fotoUitOpgeslagen(html), "/files/pasfoto.png");
});

test("de foto staat op een vaste maat", () => {
  const html = opmaakOndertekening({ ...PERSOON, fotoBron: DATA });
  assert.match(html, /width="70" height="70"/);
});
