import test from "node:test";
import assert from "node:assert/strict";
import { linkAanEind, linkifyEscapedHtml, splitLinks } from "./linkify.ts";

const links = (t: string) => splitLinks(t).filter((p) => p.type === "link").map((p) => (p.type === "link" ? [p.text, p.href] : []));

test("een https-link wordt een link", () => {
  assert.deepEqual(links("Zie https://erp.voorbeeld.nl/app/project/3201 graag"), [
    ["https://erp.voorbeeld.nl/app/project/3201", "https://erp.voorbeeld.nl/app/project/3201"],
  ]);
});

test("www. krijgt https ervoor", () => {
  assert.deepEqual(links("kijk op www.bouwgroepschrijver.nl"), [["www.bouwgroepschrijver.nl", "https://www.bouwgroepschrijver.nl"]]);
});

test("een e-mailadres wordt mailto", () => {
  assert.deepEqual(links("mail kvandenboogaard@bouwgroepschrijver.nl even"), [
    ["kvandenboogaard@bouwgroepschrijver.nl", "mailto:kvandenboogaard@bouwgroepschrijver.nl"],
  ]);
});

test("leestekens aan het eind horen bij de zin", () => {
  assert.deepEqual(links("Zie https://3bm.co.nl."), [["https://3bm.co.nl", "https://3bm.co.nl"]]);
  assert.deepEqual(links("(www.3bm.co.nl), en verder"), [["www.3bm.co.nl", "https://www.3bm.co.nl"]]);
});

test("een haakje dat bij de link hoort blijft staan", () => {
  assert.deepEqual(links("https://nl.wikipedia.org/wiki/Paal_(fundering)"), [
    ["https://nl.wikipedia.org/wiki/Paal_(fundering)", "https://nl.wikipedia.org/wiki/Paal_(fundering)"],
  ]);
});

test("de tekst eromheen blijft heel", () => {
  const delen = splitLinks("a https://x.nl b");
  assert.equal(delen.map((d) => d.text).join(""), "a https://x.nl b");
});

test("javascript: wordt nooit een link", () => {
  assert.deepEqual(links("javascript:alert(1)"), []);
});

test("HTML-versie is ge-escaped en houdt de link", () => {
  assert.equal(
    linkifyEscapedHtml("<b>zie</b> https://3bm.co.nl?a=1&b=2"),
    '&lt;b&gt;zie&lt;/b&gt; <a href="https://3bm.co.nl?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://3bm.co.nl?a=1&amp;b=2</a>',
  );
});

test("tekst zonder links blijft één stuk", () => {
  assert.deepEqual(splitLinks("gewoon tekst"), [{ type: "text", text: "gewoon tekst" }]);
});

test("linkAanEind: webadres vlak voor de cursor", () => {
  const tekst = "zie https://www.dropbox.com/t/nA9a5PSSv1BiFqtx";
  assert.deepEqual(linkAanEind(tekst), { start: 4, eind: tekst.length, href: "https://www.dropbox.com/t/nA9a5PSSv1BiFqtx" });
});

test("linkAanEind: afsluitende punt hoort niet bij de link", () => {
  assert.deepEqual(linkAanEind("kijk op www.3bm.co.nl."), { start: 8, eind: 21, href: "https://www.3bm.co.nl" });
});

test("linkAanEind: gewoon woord of lege tekst geeft niets", () => {
  assert.equal(linkAanEind("groet"), null);
  assert.equal(linkAanEind(""), null);
  assert.equal(linkAanEind("adres "), null);
});
