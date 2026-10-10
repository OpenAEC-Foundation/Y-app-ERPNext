import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STANDAARD_GROET, STANDAARD_KLEUR,
  bronUitAntwoord, gebruikOpgeslagenOndertekening, huisstijlUitBedrijf, logoAdres, opmaakOndertekening, webadres,
} from "./mail-signature-erpnext.ts";

/**
 * Welke ondertekening onder een mail komt, en hoe die eruitziet.
 *
 * De ondertekening wordt opgebouwd uit ERPNext. Hoe hij eruitziet — logo,
 * kleuren, website — komt uit het bedrijf waar de postbus bij hoort, niet uit
 * de code. Een bedrijf dat niets heeft ingevuld krijgt een neutrale
 * ondertekening, en dan gaat de eigen handtekening van de persoon voor.
 */

const OPGESLAGEN = '<table><tr><td>Met vriendelijke groet, Jan</td></tr></table><!-- y-next-signature v3 -->';

const INGEVULD = {
  name: "Voorbeeld Bouw B.V.",
  company_logo: "/files/logo-voorbeeld.png",
  website: "www.voorbeeld.nl",
  custom_trade_name: "Voorbeeld Bouw",
  custom_brand_color_dark: "#350E35",
  custom_brand_color_accent: "#44b6a8",
  custom_linkedin_url: "https://www.linkedin.com/company/voorbeeld",
  custom_signature_greeting: "Kind regards,",
};

test("huisstijlUitBedrijf: neemt over wat het bedrijf heeft ingevuld", () => {
  assert.deepEqual(huisstijlUitBedrijf(INGEVULD), {
    company: "Voorbeeld Bouw B.V.",
    handelsnaam: "Voorbeeld Bouw",
    kleurDonker: "#350E35",
    kleurAccent: "#44b6a8",
    logo: "/files/logo-voorbeeld.png",
    website: "https://www.voorbeeld.nl",
    linkedin: "https://www.linkedin.com/company/voorbeeld",
    groet: "Kind regards,",
    ingevuld: true,
  });
});

test("huisstijlUitBedrijf: een bedrijf dat niets heeft ingevuld krijgt een neutrale stijl", () => {
  assert.deepEqual(huisstijlUitBedrijf({ name: "Kaal B.V.", company_name: "Kaal B.V." }), {
    company: "Kaal B.V.",
    handelsnaam: "Kaal B.V.",
    kleurDonker: STANDAARD_KLEUR,
    kleurAccent: STANDAARD_KLEUR,
    logo: "",
    website: "",
    linkedin: "",
    groet: STANDAARD_GROET,
    ingevuld: false,
  });
  // Zonder bedrijf (geen medewerkerskaart, geen bedrijf op de postbus) net zo.
  const zonder = huisstijlUitBedrijf(null);
  assert.equal(zonder.ingevuld, false);
  assert.equal(zonder.handelsnaam, "");
});

test("huisstijlUitBedrijf: alleen een accentkleur kleurt ook alleen het accent", () => {
  const stijl = huisstijlUitBedrijf({ name: "Voorbeeld", custom_brand_color_accent: "#f00" });
  assert.equal(stijl.kleurAccent, "#f00");
  assert.equal(stijl.kleurDonker, STANDAARD_KLEUR);
  assert.equal(stijl.ingevuld, true);
});

test("huisstijlUitBedrijf: een kleur die geen kleurcode is komt niet in de opmaak", () => {
  // De waarde gaat in een style-attribuut; alleen een kleurcode mag daar staan.
  const stijl = huisstijlUitBedrijf({ name: "Voorbeeld", custom_brand_color_dark: 'red;background:url("x")' });
  assert.equal(stijl.kleurDonker, STANDAARD_KLEUR);
});

test("webadres: alleen een gewoon webadres, een kaal domein krijgt https", () => {
  assert.equal(webadres("https://www.voorbeeld.nl/"), "https://www.voorbeeld.nl/");
  assert.equal(webadres("www.voorbeeld.nl"), "https://www.voorbeeld.nl");
  assert.equal(webadres("  voorbeeld.nl "), "https://voorbeeld.nl");
  assert.equal(webadres("javascript:alert(1)"), "");
  assert.equal(webadres("mailto:info@voorbeeld.nl"), "");
  assert.equal(webadres('https://voorbeeld.nl/"onmouseover="x'), "");
  assert.equal(webadres(""), "");
  assert.equal(webadres(null), "");
});

test("logoAdres: alleen een logo dat de ontvanger kan laden", () => {
  assert.equal(logoAdres("/files/logo.png"), "/files/logo.png");
  assert.equal(logoAdres("https://cdn.voorbeeld.nl/logo.png"), "https://cdn.voorbeeld.nl/logo.png");
  // Een afgeschermd bestand ziet de ontvanger als een gebroken plaatje.
  assert.equal(logoAdres("/private/files/logo.png"), "");
  assert.equal(logoAdres("logo.png"), "");
  assert.equal(logoAdres(""), "");
});

test("een persoon met eigen handtekening, bij een bedrijf zonder huisstijl: de eigen handtekening", () => {
  assert.equal(gebruikOpgeslagenOndertekening(huisstijlUitBedrijf({ name: "Kaal B.V." }), OPGESLAGEN), true);
});

test("zonder bedrijf wint de eigen handtekening ook", () => {
  assert.equal(gebruikOpgeslagenOndertekening(huisstijlUitBedrijf(null), OPGESLAGEN), true);
});

test("bij een bedrijf met ingevulde huisstijl blijft de opgebouwde ondertekening staan", () => {
  assert.equal(gebruikOpgeslagenOndertekening(huisstijlUitBedrijf(INGEVULD), OPGESLAGEN), false);
});

test("zonder eigen handtekening valt er niets te kiezen: opbouwen", () => {
  const kaal = huisstijlUitBedrijf({ name: "Kaal B.V." });
  assert.equal(gebruikOpgeslagenOndertekening(kaal, ""), false);
  assert.equal(gebruikOpgeslagenOndertekening(kaal, "   \n "), false);
});

const PERSOON = {
  user: { name: "jan@voorbeeld.nl", first_name: "Jan", last_name: "de Vries", mobile_no: "06 12345678" },
  employee: null,
  adres: { address_title: "Voorbeeld Bouw B.V.", address_line1: "Dorpsstraat 1", pincode: "1234 AB", city: "Ons Dorp" },
  fotoBron: "",
};

test("de ondertekening draagt de huisstijl van het bedrijf", () => {
  const html = opmaakOndertekening({ ...PERSOON, huisstijl: huisstijlUitBedrijf(INGEVULD) });
  assert.match(html, /<p[^>]*>Kind regards,<\/p>/);
  assert.match(html, /<strong style="color:#44b6a8">Jan<\/strong> <span style="color:#350E35">de Vries<\/span>/);
  assert.match(html, /<a href="https:\/\/www\.voorbeeld\.nl" rel="noopener noreferrer"><img src="\/files\/logo-voorbeeld\.png" height="56" alt="Voorbeeld Bouw"><\/a>/);
  assert.match(html, /<strong style="color:#350E35">Voorbeeld Bouw<\/strong>/);
  assert.match(html, /Dorpsstraat 1/);
  assert.match(html, /1234 AB Ons Dorp/);
  assert.match(html, /06 12345678/);
  assert.match(html, /<a href="https:\/\/www\.voorbeeld\.nl"[^>]*>voorbeeld\.nl<\/a>/);
  assert.match(html, /<a href="https:\/\/www\.linkedin\.com\/company\/voorbeeld"[^>]*>LinkedIn<\/a>/);
});

test("zonder huisstijl een neutrale ondertekening: geen logo, geen website, geen lege regels", () => {
  const html = opmaakOndertekening({
    ...PERSOON,
    huisstijl: huisstijlUitBedrijf({ name: "Kaal B.V.", company_name: "Kaal B.V." }),
  });
  assert.match(html, /Met vriendelijke groet,/);
  assert.match(html, /Jan/);
  assert.match(html, /Kaal B\.V\./);
  assert.match(html, /Dorpsstraat 1/);
  assert.ok(!html.includes("<img"), "geen logo");
  assert.ok(!html.includes("<a "), "geen website of LinkedIn");
  assert.ok(!html.includes("<p style=\"margin:0 0 8px 0\"></p>"), "geen lege alinea");
});

test("gegevens uit ERPNext kunnen de opmaak niet breken", () => {
  const html = opmaakOndertekening({
    user: { name: "x@voorbeeld.nl", first_name: '<b onmouseover="x">Jan', last_name: "&co" },
    employee: null,
    adres: { address_line1: "<script>alert(1)</script>" },
    fotoBron: "",
    huisstijl: huisstijlUitBedrijf({ name: 'Bedrijf "<i>"', company_logo: '/files/a".png' }),
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b onmouseover"));
  assert.ok(!html.includes('/files/a".png'));
  assert.match(html, /&lt;script&gt;/);
});

test("bronUitAntwoord: neemt bedrijf, adres en handtekening van de postbus over", () => {
  const bron = bronUitAntwoord({
    bedrijf: INGEVULD,
    adres: { address_line1: "Dorpsstraat 1", pincode: "1234 AB", city: "Ons Dorp", phone: null },
    postbus: { signature: "<p>Team Verkoop</p>" },
  });
  assert.equal(bron?.bedrijf?.name, "Voorbeeld Bouw B.V.");
  assert.equal(bron?.adres?.address_line1, "Dorpsstraat 1");
  assert.equal(bron?.postbusOndertekening, "<p>Team Verkoop</p>");
});

test("bronUitAntwoord: zonder bedrijf, adres of postbus blijft het een geldig antwoord", () => {
  assert.deepEqual(bronUitAntwoord({ bedrijf: null, adres: null, postbus: null }), {
    bedrijf: null,
    adres: null,
    postbusOndertekening: "",
  });
});

test("bronUitAntwoord: iets anders dan het verwachte antwoord telt als geen antwoord", () => {
  // Dan valt de ondertekening terug op zelf lezen uit ERPNext.
  assert.equal(bronUitAntwoord(undefined), null);
  assert.equal(bronUitAntwoord(null), null);
  assert.equal(bronUitAntwoord("ok"), null);
  assert.equal(bronUitAntwoord({}), null);
  assert.equal(bronUitAntwoord({ bedrijf: "Voorbeeld Bouw B.V." }), null);
});
