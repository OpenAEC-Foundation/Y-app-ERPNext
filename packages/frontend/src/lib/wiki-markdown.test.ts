import test from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml, herstelPijptabellen } from "./wiki-markdown.ts";

test("koppen, vet en alinea's", () => {
  const html = markdownToHtml("# Titel\n\nTekst met **vet**.\n\n**Losse vette regel**\n\n## Kop 2");
  assert.match(html, /<h1[^>]*>Titel<\/h1>/);
  assert.match(html, /<p[^>]*>Tekst met <strong>vet<\/strong>\.<\/p>/);
  // Een regel die met vet begint, is ook een alinea.
  assert.match(html, /<p[^>]*><strong>Losse vette regel<\/strong><\/p>/);
  assert.match(html, /<h2[^>]*>Kop 2<\/h2>/);
});

test("opsommingen en genummerde lijsten krijgen elk hun eigen lijst", () => {
  const html = markdownToHtml("- een\n- **twee**\n\n1. eerste\n2. tweede");
  assert.match(html, /<ul[^>]*><li>een<\/li><li><strong>twee<\/strong><\/li><\/ul>/);
  assert.match(html, /<ol[^>]*><li>eerste<\/li><li>tweede<\/li><\/ol>/);
});

test("genummerde lijst met lege regels en ingesprongen substappen nummert door", () => {
  // De opbouw van het artikel over bouwfouten.
  const md = "1. een\n\n2. twee\n\n3. drie\n   1. drie-a\n   2. drie-b\n\n4. vier";
  assert.equal(
    markdownToHtml(md),
    "<ol><li>een</li><li>twee</li><li>drie<ol><li>drie-a</li><li>drie-b</li></ol></li><li>vier</li></ol>",
  );
});

test("een genummerde lijst die verder gaat, begint bij het juiste nummer", () => {
  assert.equal(markdownToHtml("3. drie\n4. vier"), '<ol start="3"><li>drie</li><li>vier</li></ol>');
  const html = markdownToHtml("1. een\n2. twee\n\nTussentekst.\n\n3. drie");
  assert.match(html, /<ol><li>een<\/li><li>twee<\/li><\/ol>/);
  assert.match(html, /<ol start="3"><li>drie<\/li><\/ol>/);
});

test("opsomming onder een genummerd punt wordt een geneste lijst", () => {
  assert.equal(
    markdownToHtml("1. Stap een\n   - detail\n2. Stap twee"),
    "<ol><li>Stap een<ul><li>detail</li></ul></li><li>Stap twee</li></ol>",
  );
});

test("cursief loopt niet over opsommingspunten heen", () => {
  const html = markdownToHtml("- Timmer* en metselwerk\n- over de planning *");
  assert.equal(html, "<ul><li>Timmer* en metselwerk</li><li>over de planning *</li></ul>");
});

test("een opsommingsteken * is geen cursief", () => {
  assert.equal(markdownToHtml("* een *nadruk*\n* twee"), "<ul><li>een <em>nadruk</em></li><li>twee</li></ul>");
});

test("een codeblok blijft code, zonder alinea eromheen", () => {
  const html = markdownToHtml("Voor\n\n```\na **b** <c>\n```\n\nNa");
  assert.equal(html, "<p>Voor</p>\n\n<pre><code>a **b** &lt;c&gt;\n</code></pre>\n\n<p>Na</p>");
});

test("tabellen: korte scheidingsregel, uitlijning en een pijpteken in een cel", () => {
  assert.equal(
    markdownToHtml("| a | b |\n|:--|--:|\n| x \\| y | z |"),
    "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>x | y</td><td>z</td></tr></tbody></table>",
  );
});

test("regels van een citaat zonder lege regel ertussen blijven onder elkaar", () => {
  assert.equal(
    markdownToHtml("> Beste,\n> De stukken staan klaar."),
    "<blockquote><p>Beste,<br>De stukken staan klaar.</p></blockquote>",
  );
});

test("een tabel wordt een echte tabel, met opmaak in de cellen", () => {
  const md = "| Gemeente | Periode |\n|---|---|\n| **Ridderkerk** | vóór 1942 |\n| Zwijndrecht | na 1990 |";
  const html = markdownToHtml(md);
  assert.equal(
    html,
    "<table><thead><tr><th>Gemeente</th><th>Periode</th></tr></thead><tbody>"
      + "<tr><td><strong>Ridderkerk</strong></td><td>vóór 1942</td></tr>"
      + "<tr><td>Zwijndrecht</td><td>na 1990</td></tr></tbody></table>",
  );
});

test("regels met een streep zonder scheidingsregel blijven gewone tekst", () => {
  const html = markdownToHtml("| geen tabel |");
  assert.match(html, /<p[^>]*>\| geen tabel \|<\/p>/);
});

test("een citaat, bijvoorbeeld een standaardmail, blijft één blok met alinea's", () => {
  const html = markdownToHtml("> Beste …,\n>\n> De stukken zijn **ingediend**.");
  assert.equal(html, "<blockquote><p>Beste …,</p><p>De stukken zijn <strong>ingediend</strong>.</p></blockquote>");
});

test("een afbeelding is geen link", () => {
  const html = markdownToHtml("![foto](/files/a.png)");
  assert.match(html, /<img src="\/files\/a\.png" alt="foto"/);
  assert.doesNotMatch(html, /<a /);
});

test("links", () => {
  assert.match(markdownToHtml("[Wkb](wiki/kennisbank/beleid/bouwregelgeving/wkb)"), /<a href="wiki\/kennisbank\/beleid\/bouwregelgeving\/wkb"[^>]*>Wkb<\/a>/);
});

test("HTML blijft HTML", () => {
  assert.equal(markdownToHtml("<p>al <strong>opgemaakt</strong></p>"), "<p>al <strong>opgemaakt</strong></p>");
  assert.equal(markdownToHtml(""), "");
});

test("tabelregels die als losse alinea's zijn opgeslagen, worden weer een tabel", () => {
  // Zo kwam een markdown-tabel terug na bewerken in de Y-app.
  const html = "<p>Per gemeente:</p>\n\n<p>| Gemeente | Periode |</p>\n<p>|---|---|</p>\n<p>| Ridderkerk | vóór <strong>1942</strong> |</p>\n\n<strong>Den Haag</strong>";
  assert.equal(
    herstelPijptabellen(html),
    "<p>Per gemeente:</p>\n\n<table><thead><tr><th>Gemeente</th><th>Periode</th></tr></thead><tbody>"
      + "<tr><td>Ridderkerk</td><td>vóór <strong>1942</strong></td></tr></tbody></table>\n\n<strong>Den Haag</strong>",
  );
  // Ook via de gewone omzetting van een HTML-artikel.
  assert.match(markdownToHtml(html), /<table>/);
  // Zonder scheidingsregel: niets aanraken.
  const geenTabel = "<p>| a | b |</p><p>| c | d |</p>";
  assert.equal(herstelPijptabellen(geenTabel), geenTabel);
});

test("herstel: twee tabellen na elkaar blijven twee tabellen, en <pre> doet niet mee", () => {
  const html = "<p>| a | b |</p><p>|---|---|</p><p>| 1 | 2 |</p><p>| c | d |</p><p>|---|---|</p><p>| 3 | 4 |</p>";
  assert.equal(
    herstelPijptabellen(html),
    "<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"
      + "<table><thead><tr><th>c</th><th>d</th></tr></thead><tbody><tr><td>3</td><td>4</td></tr></tbody></table>",
  );
  const metPre = "<pre>| ascii |</pre><p>| a |</p><p>|---|</p><p>| 1 |</p>";
  assert.equal(
    herstelPijptabellen(metPre),
    "<pre>| ascii |</pre><table><thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>",
  );
});
