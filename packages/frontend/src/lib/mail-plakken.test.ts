import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lijktMarkdown,
  plakHtml,
  plakPlan,
  plakvormen,
  verwijderPlakMarkering,
} from "./mail-plakken.ts";
import { plainTextToHtml } from "./mail-html.ts";

/**
 * Tests voor de plakkeuze.
 *
 * Twee dingen mogen hier niet stil misgaan. Een keuze aanbieden die niets
 * verandert maakt de andere keuzes ongeloofwaardig. En de markering waarmee
 * het geplakte stuk wordt teruggevonden mag nóóit in een verstuurde mail
 * belanden — dat zie je aan je eigen scherm niet, alleen de ontvanger merkt het.
 */

test("zonder opmaak op het klembord valt er niets te kiezen", () => {
  assert.deepEqual(plakvormen("", "gewone tekst"), []);
});

test("met opmaak krijg je de keuze tussen behouden en alleen tekst", () => {
  assert.deepEqual(plakvormen("<b>hoi</b>", "hoi"), ["opmaak", "tekst"]);
});

test("Markdown komt er alleen bij als de tekst er ook naar uitziet", () => {
  assert.deepEqual(plakvormen("<p>x</p>", "# Kop\n\ntekst"), ["opmaak", "tekst", "markdown"]);
  assert.deepEqual(plakvormen("<p>x</p>", "gewone zin"), ["opmaak", "tekst"]);
});

test("een leeg klembord geeft geen keuzeblokje", () => {
  assert.deepEqual(plakvormen("", ""), []);
  assert.deepEqual(plakvormen("   ", "  "), []);
});

test("de Markdown-herkenning is streng genoeg voor gewone post", () => {
  // Dit soort zinnen komt in normale mail voor en mag geen Markdown heten.
  assert.equal(lijktMarkdown("Kosten 3 * 25 euro"), false);
  assert.equal(lijktMarkdown("Zie bijlage - met vriendelijke groet"), false);
  assert.equal(lijktMarkdown("factuur_2026_03.pdf"), false);
  assert.equal(lijktMarkdown(""), false);

  // En dit typ je niet per ongeluk.
  assert.equal(lijktMarkdown("# Offerte"), true);
  assert.equal(lijktMarkdown("- een\n- twee"), true);
  assert.equal(lijktMarkdown("1. een\n2. twee"), true);
  assert.equal(lijktMarkdown("zie [de site](https://3xz.co.nl)"), true);
  assert.equal(lijktMarkdown("dit is **belangrijk**"), true);
});

test("één regel opsomming is nog geen Markdown", () => {
  // "- graag voor vrijdag" is een gedachtestreepje, geen lijst.
  assert.equal(lijktMarkdown("- graag voor vrijdag"), false);
});

test("elke vorm levert zijn eigen HTML", () => {
  assert.equal(plakHtml("opmaak", "<b>hoi</b>", "hoi"), "<b>hoi</b>");
  assert.match(plakHtml("markdown", "", "# Kop"), /<h1>Kop<\/h1>/);
  const tekst = plakHtml("tekst", "<b>hoi</b>", "hoi");
  assert.equal(tekst.includes("<b>"), false, "alleen tekst laat de opmaak vallen");
  assert.match(tekst, /hoi/);
});

/* ───────────────────────────── de markering ───────────────────────────── */

test("de markering gaat eruit en de inhoud blijft", () => {
  assert.equal(verwijderPlakMarkering('<p>voor <span data-plak="a1">geplakt</span> na</p>'),
    "<p>voor geplakt na</p>");
});

test("ook met andere attributen erbij", () => {
  assert.equal(verwijderPlakMarkering('<span class="x" data-plak="a1" id="y">tekst</span>'),
    "tekst");
});

test("geplakt in geplakt gaat er ook uit", () => {
  assert.equal(
    verwijderPlakMarkering('<span data-plak="b">buiten <span data-plak="a">binnen</span></span>'),
    "buiten binnen");
});

test("gewone spans blijven staan", () => {
  // Alleen ónze markering weghalen; opmaak van de gebruiker is geen rommel.
  const html = '<span style="color:red">rood</span>';
  assert.equal(verwijderPlakMarkering(html), html);
});

test("lege invoer blijft leeg", () => {
  assert.equal(verwijderPlakMarkering(""), "");
});

/* ───────────────────────────── wat er geplakt wordt ───────────────────────────── */

const leeg = { html: "", tekst: "", afbeeldingen: [] as File[] };
const png = new File(["png"], "image.png", { type: "image/png" });

test("met opmaak op het klembord komt het keuzeblokje", () => {
  assert.deepEqual(plakPlan({ ...leeg, html: "<b>hoi</b>", tekst: "hoi" }, false),
    { soort: "kiezen", html: "<b>hoi</b>", tekst: "hoi", vormen: ["opmaak", "tekst"] });
});

test("als platte tekst: alleen de tekst, zonder keuzeblokje", () => {
  assert.deepEqual(plakPlan({ ...leeg, html: "<b>hoi</b>", tekst: "hoi" }, true),
    { soort: "invoegen", html: plainTextToHtml("hoi") });
});

test("gewone tekst gaat er meteen in", () => {
  assert.deepEqual(plakPlan({ ...leeg, tekst: "regel" }, false),
    { soort: "invoegen", html: plainTextToHtml("regel") });
});

test("een schermafdruk wordt een afbeelding", () => {
  assert.deepEqual(plakPlan({ ...leeg, afbeeldingen: [png] }, false), { soort: "afbeeldingen", bestanden: [png] });
});

test("staat er HTML bij het plaatje, dan was de tekst bedoeld", () => {
  // Word en webpagina's zetten naast de HTML ook een plaatje van de selectie op het klembord.
  const plan = plakPlan({ html: "<p>tekst</p>", tekst: "tekst", afbeeldingen: [png] }, false);
  assert.notEqual(plan.soort, "afbeeldingen");
});

test("als platte tekst met alleen een plaatje: niets om te plakken", () => {
  assert.deepEqual(plakPlan({ ...leeg, afbeeldingen: [png] }, true), { soort: "niets" });
});

test("een leeg klembord plakt niets", () => {
  assert.deepEqual(plakPlan(leeg, false), { soort: "niets" });
  assert.deepEqual(plakPlan(leeg, true), { soort: "niets" });
});
test("de plakknoppen hebben de keuze al gemaakt: geen keuzeblokje", () => {
  // "Plak" is met opmaak, "Plak als platte tekst" zonder; daarna nog eens vragen is dubbelop.
  assert.deepEqual(plakPlan({ ...leeg, html: "<b>hoi</b>", tekst: "hoi" }, false, false),
    { soort: "invoegen", html: "<b>hoi</b>" });
  assert.deepEqual(plakPlan({ ...leeg, tekst: "- een\n- twee" }, false, false),
    { soort: "invoegen", html: plainTextToHtml("- een\n- twee") });
});
