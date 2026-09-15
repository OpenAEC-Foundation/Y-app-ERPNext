import { test } from "node:test";
import assert from "node:assert/strict";
import { bijsnijdVierkant, opmaakOndertekening } from "./mail-signature-erpnext.ts";

/**
 * Tests voor de pasfoto in de handtekening.
 *
 * De foto stond erin als "/private/files/Nino pasfoto.png": een privé bestand
 * op een relatief pad. In het opstelvenster zag hij er goed uit, want daar ben
 * je ingelogd; bij de ontvanger was het een gebroken plaatje. Daarom gaat hij
 * nu als base64 mee in de handtekening zelf.
 */

const PERSOON = {
  user: { name: "nino@3bm.co.nl", full_name: "Nino van Kleef", user_image: "/private/files/Nino pasfoto.png" },
  employee: { name: "HR-EMP-00019", employee_name: "Nino van Kleef", image: "/private/files/Nino pasfoto.png" },
  adres: null,
  bedrijf: "3BM Bouwtechniek V.O.F.",
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
  assert.ok(html.includes("Nino"), "de naam blijft wel staan");
});

test("zonder fotobron blijft het oude gedrag", () => {
  const html = opmaakOndertekening({ ...PERSOON });
  assert.ok(html.includes("/private/files/Nino pasfoto.png"));
});

test("het logo en LinkedIn blijven adressen, alleen de persoon wordt base64", () => {
  const html = opmaakOndertekening({ ...PERSOON, fotoBron: DATA });
  assert.equal((html.match(/data:image/g) || []).length, 1);
  // Die blijven een pad op deze server; bij verzenden maakt
  // `maakAfbeeldingenAbsoluut` er een volledig adres van.
  assert.match(html, /<img src="\/files\/[^"]+" width="215"/);
  assert.match(html, /<img src="\/files\/[^"]+" width="23"/);
});

test("bijsnijdVierkant: het midden van een liggende foto", () => {
  assert.deepEqual(bijsnijdVierkant(400, 200), { sx: 100, sy: 0, zijde: 200 });
});

test("bijsnijdVierkant: het midden van een staande foto", () => {
  assert.deepEqual(bijsnijdVierkant(300, 500), { sx: 0, sy: 100, zijde: 300 });
});

test("bijsnijdVierkant: een vierkante foto blijft heel", () => {
  assert.deepEqual(bijsnijdVierkant(240, 240), { sx: 0, sy: 0, zijde: 240 });
});
