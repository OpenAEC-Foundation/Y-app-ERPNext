import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlNaarMarkdown, markdownNaarHtml } from "./mail-markdown.ts";

/**
 * Tests voor het schrijven van e-mail in Markdown.
 *
 * De gevallen die ertoe doen zijn de dingen die eruitzien als opmaak maar het
 * niet zijn: een sterretje in een opsomming, een underscore in een
 * bestandsnaam, een cijfer in een zin. Die gaan stil fout — de mail vertrekt,
 * en pas de ontvanger ziet dat er iets raars staat.
 */

test("koppen, vet en cursief", () => {
  assert.equal(markdownNaarHtml("# Offerte\n\nDit is **belangrijk** en *dit* niet."),
    "<h1>Offerte</h1><p>Dit is <strong>belangrijk</strong> en <em>dit</em> niet.</p>");
});

test("een opsomming met streepjes wordt een lijst", () => {
  assert.equal(markdownNaarHtml("- een\n- twee"), "<ul><li>een</li><li>twee</li></ul>");
});

test("een genummerde lijst blijft genummerd", () => {
  assert.equal(markdownNaarHtml("1. een\n2. twee"), "<ol><li>een</li><li>twee</li></ol>");
});

test("een sterretje als opsommingsteken is geen cursief", () => {
  // Dit is de klassieke misser: `* punt` als lijst lezen, niet als de start
  // van cursieve tekst.
  assert.equal(markdownNaarHtml("* punt een\n* punt twee"),
    "<ul><li>punt een</li><li>punt twee</li></ul>");
});

test("een underscore in een bestandsnaam blijft staan", () => {
  // `factuur_2026_03.pdf` is geen cursief; dat zou de naam onleesbaar maken.
  assert.match(markdownNaarHtml("Zie factuur_2026_03.pdf in de bijlage."),
    /factuur_2026_03\.pdf/);
});

test("een link wordt een link, een eng schema niet", () => {
  assert.equal(markdownNaarHtml("[onze site](https://3bm.co.nl)"),
    '<p><a href="https://3bm.co.nl">onze site</a></p>');
  // Een javascript-link hoort gewone tekst te worden, geen klikbare val.
  assert.equal(markdownNaarHtml("[klik](javascript:alert(1))"), "<p>klik</p>");
});

test("HTML in de tekst wordt tekst, geen opmaak", () => {
  // Wat je in Markdown typt is tekst; een script-tag hoort als letters aan te
  // komen en niet als iets dat de mail verbouwt.
  const uit = markdownNaarHtml("<script>alert(1)</script>");
  assert.equal(uit.includes("<script>"), false);
  assert.match(uit, /&lt;script&gt;/);
});

test("code tussen backticks blijft letterlijk", () => {
  const uit = markdownNaarHtml("gebruik `a * b` in de formule");
  assert.match(uit, /<code>a \* b<\/code>/);
  assert.equal(uit.includes("<em>"), false, "het sterretje in code is geen cursief");
});

test("een cijfer in een gewone zin blijft een cijfer", () => {
  // De code-stukken worden tijdelijk vervangen door een plaatshouder; met een
  // gewoner teken zou "wij hebben 3 opties" hier verminkt raken.
  assert.equal(markdownNaarHtml("wij hebben 3 opties"), "<p>wij hebben 3 opties</p>");
  assert.match(markdownNaarHtml("`x` en 2 en `y`"), /<code>x<\/code> en 2 en <code>y<\/code>/);
});

test("een codeblok slikt alles ertussen", () => {
  const uit = markdownNaarHtml("```\n# geen kop\n- geen lijst\n```");
  assert.match(uit, /<pre><code># geen kop\n- geen lijst<\/code><\/pre>/);
});

test("citaat en scheidingslijn", () => {
  assert.equal(markdownNaarHtml("> let op"), "<blockquote>let op</blockquote>");
  assert.equal(markdownNaarHtml("---"), "<hr>");
});

test("losse regels in één alinea worden regelovergangen", () => {
  assert.equal(markdownNaarHtml("eerste\ntweede"), "<p>eerste<br>tweede</p>");
});

/* ─────────────────────────────── terugweg ─────────────────────────────── */

test("de terugweg levert weer bruikbare Markdown op", () => {
  assert.equal(htmlNaarMarkdown("<h1>Offerte</h1><p>Dit is <strong>vet</strong>.</p>"),
    "# Offerte\n\nDit is **vet**.");
});

test("lijsten komen terug als lijsten", () => {
  assert.equal(htmlNaarMarkdown("<ul><li>een</li><li>twee</li></ul>"), "- een\n- twee");
  assert.equal(htmlNaarMarkdown("<ol><li>een</li><li>twee</li></ol>"), "1. een\n2. twee");
});

test("een link houdt zijn adres", () => {
  assert.equal(htmlNaarMarkdown('<p>zie <a href="https://3bm.co.nl">de site</a></p>'),
    "zie [de site](https://3bm.co.nl)");
});

test("heen en weer laat de tekst heel", () => {
  // Niet byte-voor-byte gelijk — dat kan niet — maar wat er staat moet blijven.
  const bron = "# Kop\n\nTekst met **vet**, *cursief* en een [link](https://3bm.co.nl).\n\n- een\n- twee";
  const terug = htmlNaarMarkdown(markdownNaarHtml(bron));
  assert.equal(terug, bron);
});

test("wat de terugweg niet kent verliest zijn tags, niet zijn tekst", () => {
  // Liever een regel die er kaal uitziet dan een alinea die verdwijnt bij het
  // wisselen van modus.
  assert.match(htmlNaarMarkdown('<p>een <span style="color:red">gekleurd</span> woord</p>'),
    /een gekleurd woord/);
  assert.match(htmlNaarMarkdown("<table><tr><td>cel</td></tr></table>"), /cel/);
});

test("een script overleeft de terugweg niet", () => {
  assert.equal(htmlNaarMarkdown("<p>hallo</p><script>alert(1)</script>"), "hallo");
});

test("lege invoer geeft lege uitvoer", () => {
  assert.equal(markdownNaarHtml(""), "");
  assert.equal(htmlNaarMarkdown(""), "");
});
