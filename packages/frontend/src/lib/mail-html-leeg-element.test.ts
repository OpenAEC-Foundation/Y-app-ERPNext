import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEditorHtml } from "./mail-html.ts";
import { buildQuoteBlock } from "./mail-quote.ts";

/**
 * Tests voor lege elementen in de lijst met tags die mét inhoud weg moeten.
 *
 * `<meta>`, `<link>` en `<base>` hebben nooit een sluittag. Wie ze behandelt als
 * een blok dat pas bij `</meta>` eindigt, gooit alles erna weg — en dat is
 * gebeurd: bij doorsturen kwam alleen de kop "Doorgestuurd bericht van…" aan,
 * omdat de mails van Word, Outlook en de meeste nieuwsbrieven met een
 * `<meta charset>` beginnen. Aan het opstelvenster zag je het niet; de
 * ontvanger kreeg een lege mail.
 */

const tekst = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("een meta zonder sluittag laat de rest van de mail staan", () => {
  const uit = sanitizeEditorHtml('<meta charset="utf-8"><p>Beste Maarten,</p><p>zie bijlage.</p>');
  assert.equal(tekst(uit), "Beste Maarten, zie bijlage.");
});

test("zo begint een mail uit Word of een nieuwsbrief", () => {
  const bron = [
    "<!-- Kofax KCM Quick Template -->",
    '<meta charset="utf-8">',
    "<style> body { font-family: 'Arial'; } p { margin: 0; } </style>",
    '<meta name="Generator" content="Microsoft Word 15 (filtered medium)">',
    '<link rel="stylesheet" href="https://elders.nl/opmaak.css">',
    "<p>Uw gegevens zijn gecontroleerd.</p>",
  ].join("\n");
  const uit = sanitizeEditorHtml(bron);
  assert.equal(tekst(uit), "Uw gegevens zijn gecontroleerd.");
  // De stylesheet zelf blijft wel weg: die hoort niet als tekst in de mail.
  assert.ok(!uit.includes("font-family"));
});

test("een volledig document: head weg, body blijft", () => {
  const uit = sanitizeEditorHtml(
    '<html><head><meta charset="utf-8"><title>Onderwerp</title><base href="https://x.nl/"></head>'
    + "<body><p>hoi</p></body></html>");
  assert.equal(tekst(uit), "hoi");
});

test("lege elementen met een schuine streep blijven ook gewoon werken", () => {
  assert.equal(tekst(sanitizeEditorHtml('<meta charset="utf-8" /><p>a</p><link rel="x" /><p>b</p>')), "a b");
});

test("het citaat bij doorsturen bevat de mail zelf, niet alleen de kop", () => {
  const blok = buildQuoteBlock({
    label: "Doorgestuurd bericht van Goudse Verzekeringen:",
    bodyHtml: '<meta charset="utf-8"><style>p{margin:0}</style><p>Jaarlijkse gegevenscheck</p>',
  });
  assert.match(tekst(blok), /Jaarlijkse gegevenscheck/);
});
