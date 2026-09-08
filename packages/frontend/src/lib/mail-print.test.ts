import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrintHtml, printDocument } from "./mail-print.ts";

/**
 * Tests voor de printopmaak van een e-mail.
 *
 * Het punt van deze module is dat er op papier staat wat je nodig hebt — kop
 * én inhoud — en niets van de app eromheen. Daarnaast is de kop een plek waar
 * gebruikersinvoer ongefilterd binnenkomt (een onderwerp is tekst uit een
 * vreemde mail), dus die moet ontsnapt worden.
 */

const LABELS = {
  van: "Van",
  aan: "Aan",
  cc: "Cc",
  datum: "Datum",
  bijlagen: "Bijlagen",
  zonderOnderwerp: "(geen onderwerp)",
};

test("kop en inhoud staan allebei op papier", () => {
  const html = buildPrintHtml({
    subject: "Factuur 263-05188",
    sender: "info@vandersmit.nl",
    senderName: "Aaldert van der Smit",
    recipients: "maarten@3bm.co.nl",
    datum: "maandag 7 september 2026 om 13:38",
    bodyHtml: "<p>Beste Maarten,</p>",
  }, LABELS);

  assert.match(html, /<title>Factuur 263-05188<\/title>/);
  assert.match(html, /Aaldert van der Smit &lt;info@vandersmit\.nl&gt;/);
  assert.match(html, /maarten@3bm\.co\.nl/);
  assert.match(html, /maandag 7 september 2026/);
  assert.match(html, /<p>Beste Maarten,<\/p>/);
});

test("lege kopregels vallen weg in plaats van leeg te blijven staan", () => {
  const html = buildPrintHtml({
    subject: "Zonder cc",
    sender: "a@b.nl",
    recipients: "c@d.nl",
    bodyHtml: "<p>tekst</p>",
  }, LABELS);
  assert.equal(html.includes(">Cc<"), false, "cc hoort weg te vallen");
  assert.equal(html.includes(">Datum<"), false, "datum hoort weg te vallen");
  assert.equal(html.includes(">Bijlagen<"), false, "bijlagen horen weg te vallen");
  assert.match(html, />Aan</);
});

test("zonder onderwerp komt er een leesbare aanduiding te staan", () => {
  const html = buildPrintHtml({ sender: "a@b.nl", bodyHtml: "" }, LABELS);
  assert.match(html, /<title>\(geen onderwerp\)<\/title>/);
  assert.match(html, /<h1>\(geen onderwerp\)<\/h1>/);
});

test("een onderwerp met opmaaktekens wordt ontsnapt", () => {
  // Het onderwerp komt uit een vreemde mail; zonder ontsnapping zou het de
  // printpagina kunnen verbouwen.
  const html = buildPrintHtml({
    subject: '<script>alert(1)</script>',
    sender: "a@b.nl",
    bodyHtml: "<p>ok</p>",
  }, LABELS);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.match(html, /&lt;script&gt;/);
});

test("bijlagen komen als opsomming in de kop", () => {
  const html = buildPrintHtml({
    subject: "Met bijlagen",
    sender: "a@b.nl",
    bodyHtml: "",
    bijlagen: ["factuur.pdf", "bijlage 2.pdf"],
  }, LABELS);
  assert.match(html, /factuur\.pdf, bijlage 2\.pdf/);
});

test("printDocument meldt het wanneer er geen document is", () => {
  // In tests en bij server-rendering valt er niets af te drukken; dan hoort de
  // aanroeper dat te weten in plaats van te denken dat het gelukt is.
  assert.equal(printDocument("<html></html>", undefined), false);
});

test("printDocument zet een frame in het document en ruimt het weer op", () => {
  const verwijderd: string[] = [];
  const nep = {
    body: {
      appendChild(el: { tagName: string }) { verwijderd.push("toegevoegd:" + el.tagName); },
    },
    createElement() {
      return {
        tagName: "IFRAME",
        style: {} as Record<string, string>,
        setAttribute() { /* niets */ },
        remove() { verwijderd.push("verwijderd"); },
        set srcdoc(_v: string) { /* zonder browser gebeurt er verder niets */ },
      };
    },
  } as unknown as Document;
  assert.equal(printDocument("<html></html>", nep), true);
  assert.deepEqual(verwijderd, ["toegevoegd:IFRAME"]);
});
