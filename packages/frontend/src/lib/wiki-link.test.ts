import test from "node:test";
import assert from "node:assert/strict";
import {
  artikelPad, zoekArtikelOpPad, urlVoorPad, urlVoorArtikel, deelbareLink, interneWikiLink, herschrijfWikiLinks,
} from "./wiki-link.ts";

const artikelen = [
  { name: "1l1g8v2vah", route: "wiki/kennisbank/procedures/algemeen/archiefonderzoek" },
  { name: "3bb6lp2kkn", route: "wiki/kennisbank/procedures/algemeen/archieftekeningen" },
  { name: "90n3lhc9nr", route: "wiki/kennisbank/procedures" },
  { name: "56e9gmktj4", route: "wiki/3xz-bouwadvies" },
];
const SITE = "https://3xz.erphost.cloud";

test("het pad van een artikel: de route zonder wiki/ en zonder schuine strepen eromheen", () => {
  assert.equal(artikelPad("wiki/kennisbank/procedures/algemeen/archiefonderzoek"), "kennisbank/procedures/algemeen/archiefonderzoek");
  assert.equal(artikelPad("/wiki/kennisbank/procedures/"), "kennisbank/procedures");
  assert.equal(artikelPad("wiki"), "");
  assert.equal(artikelPad(""), "");
  // Een route zonder wiki/ ervoor blijft zoals hij is.
  assert.equal(artikelPad("kennisbank/beleid"), "kennisbank/beleid");
});

test("artikel zoeken op het pad uit het adres", () => {
  assert.equal(zoekArtikelOpPad(artikelen, "kennisbank/procedures/algemeen/archiefonderzoek")?.name, "1l1g8v2vah");
  // Ook met wiki/ ervoor, een schuine streep erachter of in hoofdletters.
  assert.equal(zoekArtikelOpPad(artikelen, "wiki/kennisbank/procedures/")?.name, "90n3lhc9nr");
  assert.equal(zoekArtikelOpPad(artikelen, "Kennisbank/Procedures")?.name, "90n3lhc9nr");
  // Gecodeerde tekens in het adres.
  assert.equal(zoekArtikelOpPad(artikelen, "3xz%2Dbouwadvies")?.name, "56e9gmktj4");
  // Een ERPNext-naam werkt ook, voor wie die heeft.
  assert.equal(zoekArtikelOpPad(artikelen, "3bb6lp2kkn")?.name, "3bb6lp2kkn");
  assert.equal(zoekArtikelOpPad(artikelen, "kennisbank/bestaat-niet"), undefined);
  assert.equal(zoekArtikelOpPad(artikelen, ""), undefined);
});

test("adres in de app voor een pad en voor een artikel", () => {
  assert.equal(urlVoorPad("kennisbank/procedures/algemeen/archiefonderzoek"), "/wiki/kennisbank/procedures/algemeen/archiefonderzoek");
  assert.equal(urlVoorPad(""), "/wiki");
  // Vreemde tekens worden per stuk gecodeerd, de schuine strepen blijven.
  assert.equal(urlVoorPad("kennisbank/a b#c"), "/wiki/kennisbank/a%20b%23c");
  assert.equal(urlVoorArtikel(artikelen[0]), "/wiki/kennisbank/procedures/algemeen/archiefonderzoek");
  // Zonder route: dan de naam.
  assert.equal(urlVoorArtikel({ name: "abc123", route: "" }), "/wiki/abc123");
});

test("een deelbare link wijst naar de Y-app, met het artikel achter #", () => {
  assert.equal(
    deelbareLink(artikelen[0], "https://3xz.erphost.cloud/y-next"),
    "https://3xz.erphost.cloud/y-next#/wiki/kennisbank/procedures/algemeen/archiefonderzoek",
  );
  assert.equal(deelbareLink(artikelen[2], "https://3xz.erphost.cloud/y-next/"), "https://3xz.erphost.cloud/y-next#/wiki/kennisbank/procedures");
});

test("een link naar een sectie opent het overzichtsartikel van die sectie", () => {
  const metIndex = [...artikelen, { name: "idx", route: "wiki/kennisbank/functiegebouw/rollen/index" }];
  assert.equal(zoekArtikelOpPad(metIndex, "kennisbank/functiegebouw/rollen")?.name, "idx");
  // Een artikel met precies die route gaat voor.
  assert.equal(zoekArtikelOpPad(metIndex, "kennisbank/procedures")?.name, "90n3lhc9nr");
});

test("verwijzingen naar andere artikelen herkennen", () => {
  const pad = (href: string) => interneWikiLink(href, SITE);
  // Zoals ze in de kennisbank staan.
  assert.equal(pad("wiki/kennisbank/procedures/algemeen/archieftekeningen"), "kennisbank/procedures/algemeen/archieftekeningen");
  assert.equal(pad("/wiki/kennisbank/procedures/bouwregelgeving"), "kennisbank/procedures/bouwregelgeving");
  // Een link uit de Y-app zelf, kort of volledig.
  assert.equal(pad("#/wiki/kennisbank/procedures"), "kennisbank/procedures");
  assert.equal(pad("https://3xz.erphost.cloud/y-next#/wiki/kennisbank/procedures"), "kennisbank/procedures");
  // Een link naar de ERPNext-wiki op dezelfde site.
  assert.equal(pad("https://3xz.erphost.cloud/wiki/kennisbank/procedures?x=1#kop"), "kennisbank/procedures");
  // Naar het overzicht van de kennisbank.
  assert.equal(pad("/wiki"), "");
  assert.equal(pad("#/wiki"), "");
  // Geen verwijzing naar een artikel.
  assert.equal(pad("https://nl.wikipedia.org/wiki/Paal_(fundering)"), null);
  assert.equal(pad("https://bagviewer.kadaster.nl"), null);
  assert.equal(pad("mailto:info@3xz.co.nl"), null);
  assert.equal(pad("/y-next#/projects"), null);
  assert.equal(pad("wikipedia/iets"), null);
  assert.equal(pad("#kop"), null);
  assert.equal(pad(""), null);
});

test("links in een artikel die naar een ander artikel wijzen, openen in de Y-app", () => {
  const html =
    '<p>Zie <a href="wiki/kennisbank/procedures/algemeen/archieftekeningen" target="_blank" rel="noopener noreferrer" class="text-blue-600">Archieftekeningen</a>' +
    ' en <a class="x" href=\'/wiki/kennisbank/procedures\'>Procedures</a>' +
    ' en <a href="https://nl.wikipedia.org/wiki/Paal" target="_blank">Wikipedia</a>.</p>';
  const uit = herschrijfWikiLinks(html, SITE);
  assert.ok(uit.includes('<a href="#/wiki/kennisbank/procedures/algemeen/archieftekeningen" class="text-blue-600">Archieftekeningen</a>'), uit);
  assert.ok(uit.includes('<a class="x" href="#/wiki/kennisbank/procedures">Procedures</a>'), uit);
  // Een link naar een andere site blijft precies zoals hij was.
  assert.ok(uit.includes('<a href="https://nl.wikipedia.org/wiki/Paal" target="_blank">Wikipedia</a>'), uit);
  // Tekst zonder links verandert niet.
  assert.equal(herschrijfWikiLinks("<p>geen links</p>", SITE), "<p>geen links</p>");
});

test("herschrijven maakt van tekst in een attribuut nooit een echt attribuut", () => {
  // "rel=x" staat in de title en " style=… onmouseover=…" in lang: gewone tekst.
  const payload = '<a href="https://3xz.erphost.cloud/wiki/x" title="a rel=x" lang=" style=position:fixed onmouseover=alert(1) x"'
    + ' target="_blank" rel="noopener noreferrer">link</a>';
  const uit = herschrijfWikiLinks(payload, SITE);
  assert.equal(uit, '<a href="#/wiki/x" title="a rel=x" lang=" style=position:fixed onmouseover=alert(1) x">link</a>');
  // Een "<a …>" als tekst in een attribuut van een andere tag blijft tekst.
  const inAlt = `<img alt="<a href='wiki/x' onerror=alert(1) >" src="/files/a.png"><a href="wiki/y">y</a>`;
  assert.equal(
    herschrijfWikiLinks(inAlt, SITE),
    `<img alt="<a href='wiki/x' onerror=alert(1) >" src="/files/a.png"><a href="#/wiki/y">y</a>`,
  );
  // Een aanhalingsteken in een waarde tussen enkele aanhalingstekens.
  assert.equal(
    herschrijfWikiLinks(`<a title='zeg "hoi"' href='wiki/y'>y</a>`, SITE),
    '<a title="zeg &quot;hoi&quot;" href="#/wiki/y">y</a>',
  );
  // Commentaar blijft staan.
  assert.equal(herschrijfWikiLinks('<!-- <a href="wiki/x"> --><p>x</p>', SITE), '<!-- <a href="wiki/x"> --><p>x</p>');
});
