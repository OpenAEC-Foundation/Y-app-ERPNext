/**
 * Tests voor de HTML-hygiëne van het opstelvenster.
 *
 * Drie groepen, en ze verdienen alle drie hun plek:
 *
 * 1. **Behoud** — wat de gebruiker bedoelde moet overleven. Een sanitizer die
 *    alles weggooit is veilig en onbruikbaar; deze tests houden hem eerlijk.
 * 2. **Word/Outlook** — het geplakte materiaal waar dit filter voor bestaat.
 *    De casussen komen uit echte Word-uitvoer (`mso-`-stijlen, `<o:p>`,
 *    conditionele commentaren, `class="MsoNormal"`, lege spans).
 * 3. **XSS** — de vectoren die een sanitizer *moet* stoppen. Deze zijn geen
 *    theorie: een geplakte "handtekening" van een website is precies de weg
 *    waarlangs zoiets binnenkomt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeEditorHtml,
  toEmailHtml,
  sanitizeStyle,
  isSafeUrl,
  normalizeLinkUrl,
  plainTextToHtml,
  htmlToPlainText,
  isHtmlEmpty,
  ensureHtmlBody,
  escapeHtml,
} from "./mail-html.ts";

/* ─── 1. Behoud van structuur ─── */

test("sanitizeEditorHtml: vet, cursief, onderstreept en doorhalen blijven", () => {
  const html = "<p><b>vet</b> <i>cursief</i> <u>onder</u> <s>door</s></p>";
  assert.equal(sanitizeEditorHtml(html), html);
});

test("sanitizeEditorHtml: lijsten blijven volledig intact", () => {
  const html = "<ul><li>een</li><li>twee</li></ul><ol><li>drie</li></ol>";
  assert.equal(sanitizeEditorHtml(html), html);
});

test("sanitizeEditorHtml: koppen, citaat en horizontale lijn blijven", () => {
  const html = "<h1>Titel</h1><h2>Sub</h2><blockquote>citaat</blockquote><hr>";
  assert.equal(sanitizeEditorHtml(html), html);
});

test("sanitizeEditorHtml: een link houdt zijn href en krijgt target/rel", () => {
  const out = sanitizeEditorHtml('<a href="https://open-aec.com">site</a>');
  assert.match(out, /href="https:\/\/open-aec\.com"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, />site<\/a>/);
});

test("sanitizeEditorHtml: een tabel uit een handtekening overleeft", () => {
  const out = sanitizeEditorHtml(
    '<table cellpadding="0"><tbody><tr><td style="color:#475569">Piet</td></tr></tbody></table>',
  );
  assert.match(out, /<table cellpadding="0">/);
  assert.match(out, /<td style="color:#475569">Piet<\/td>/);
});

test("sanitizeEditorHtml: kleur en tekengrootte blijven staan", () => {
  const out = sanitizeEditorHtml('<span style="color:#b91c1c;font-size:20px">rood</span>');
  assert.equal(out, '<span style="color:#b91c1c;font-size:20px">rood</span>');
});

/* ─── 2. Word- en Outlook-plaksel ─── */

test("sanitizeEditorHtml: class en id verdwijnen, de alinea blijft", () => {
  const out = sanitizeEditorHtml('<p class="MsoNormal" id="x">Beste Piet,</p>');
  assert.equal(out, "<p>Beste Piet,</p>");
});

test("sanitizeEditorHtml: mso-stijlen sneuvelen, echte stijlen blijven", () => {
  const out = sanitizeEditorHtml(
    '<p style="mso-margin-top-alt:auto;margin-bottom:4px;mso-list:l0 level1">tekst</p>',
  );
  assert.equal(out, '<p style="margin-bottom:4px">tekst</p>');
});

test("sanitizeEditorHtml: conditioneel Word-commentaar verdwijnt volledig", () => {
  const out = sanitizeEditorHtml(
    "<p>voor</p><!--[if gte mso 9]><xml><w:WordDocument/></xml><![endif]--><p>na</p>",
  );
  assert.equal(out, "<p>voor</p><p>na</p>");
});

test("sanitizeEditorHtml: <o:p> wordt uitgepakt, andere Office-namespaces sneuvelen", () => {
  assert.equal(sanitizeEditorHtml("<p><o:p>&nbsp;</o:p></p>"), "<p>&nbsp;</p>");
  assert.equal(sanitizeEditorHtml("<p>na<v:shape>rommel</v:shape></p>"), "<p>na</p>");
});

test("sanitizeEditorHtml: lege spans worden uitgepakt, de tekst blijft", () => {
  assert.equal(sanitizeEditorHtml("<p><span><span>Hallo</span></span></p>"), "<p>Hallo</p>");
});

test("sanitizeEditorHtml: <font> wordt een span met inline kleur", () => {
  const out = sanitizeEditorHtml('<font color="#ff0000" size="5" face="Calibri">rood</font>');
  assert.equal(out, '<span style="color:#ff0000;font-size:20px;font-family:Calibri">rood</span>');
});

test("sanitizeEditorHtml: een <font> zonder bruikbare attributen wordt uitgepakt", () => {
  assert.equal(sanitizeEditorHtml("<font>plat</font>"), "plat");
});

test("sanitizeEditorHtml: een geplakt Word-fragment houdt kop, lijst en link over", () => {
  const word = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"><head>
    <style><!-- p.MsoNormal {margin:0cm; font-family:"Calibri",sans-serif;} --></style>
    </head><body lang="NL"><div class="WordSection1">
    <p class="MsoNormal"><b><span style="mso-fareast-font-family:Calibri;font-size:14.0pt">Offerte</span></b></p>
    <p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">-</span>punt een</p>
    <p class="MsoNormal"><a href="https://open-aec.com/offerte">bekijk hem hier</a><o:p></o:p></p>
    </div></body></html>`;
  const out = sanitizeEditorHtml(word);
  assert.ok(!out.includes("MsoNormal"), "class-namen horen weg te zijn");
  assert.ok(!out.includes("mso-"), "mso-stijlen horen weg te zijn");
  assert.ok(!out.includes("<style"), "de Word-stylesheet hoort weg te zijn");
  assert.ok(!out.includes("p.MsoNormal"), "de stylesheet-inhoud hoort niet als tekst terug te komen");
  assert.match(out, /<b>/, "vet hoort te blijven");
  assert.match(out, /font-size:14\.0pt/, "de ingestelde tekengrootte hoort te blijven");
  assert.match(out, /Offerte/);
  assert.match(out, /punt een/);
  assert.match(out, /href="https:\/\/open-aec\.com\/offerte"/);
});

/* ─── 3. XSS-vectoren ─── */

test("sanitizeEditorHtml: <script> verdwijnt met inhoud en al", () => {
  assert.equal(sanitizeEditorHtml('<p>a</p><script>alert("x")</script><p>b</p>'), "<p>a</p><p>b</p>");
});

test("sanitizeEditorHtml: on*-attributen worden gestript", () => {
  const out = sanitizeEditorHtml('<p onclick="steal()" onmouseover="x()">klik</p>');
  assert.equal(out, "<p>klik</p>");
});

test("sanitizeEditorHtml: img met onerror houdt geen enkele handler over", () => {
  const out = sanitizeEditorHtml('<img src="https://x/y.png" onerror="alert(1)">');
  assert.ok(!/onerror/i.test(out));
  assert.match(out, /src="https:\/\/x\/y\.png"/);
});

test("sanitizeEditorHtml: javascript:-links verliezen hun href en dus hun anker", () => {
  const out = sanitizeEditorHtml('<a href="javascript:alert(1)">klik</a>');
  assert.ok(!/javascript/i.test(out));
  assert.equal(out, "klik");
});

test("sanitizeEditorHtml: javascript: verstopt achter entities en tabs komt er niet door", () => {
  for (const href of [
    "&#106;avascript:alert(1)",
    "java&#9;script:alert(1)",
    "  JaVaScRiPt:alert(1)",
    "jav\tascript:alert(1)",
  ]) {
    const out = sanitizeEditorHtml(`<a href="${href}">x</a>`);
    assert.ok(!/href=/.test(out), `${href} hoort geen href op te leveren`);
  }
});

test("sanitizeEditorHtml: data:text/html is geen afbeelding en gaat eruit", () => {
  const out = sanitizeEditorHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
  assert.ok(!out.includes("data:text/html"));
});

test("sanitizeEditorHtml: data:image/svg is scriptbaar en gaat eruit", () => {
  const out = sanitizeEditorHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=">');
  assert.ok(!out.includes("data:image/svg"));
});

test("sanitizeEditorHtml: een geplakt png-screenshot mag wél in de editor", () => {
  const out = sanitizeEditorHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
  assert.match(out, /data:image\/png/);
});

test("sanitizeEditorHtml: iframe, object en form verdwijnen met inhoud", () => {
  const out = sanitizeEditorHtml(
    '<iframe src="https://evil"></iframe><object data="x"></object><form action="https://evil"><input name="p"></form><p>ok</p>',
  );
  assert.equal(out, "<p>ok</p>");
});

test("sanitizeEditorHtml: CSS met url(), expression() of @import wordt geweigerd", () => {
  assert.equal(sanitizeStyle("background-color:url(javascript:1)"), "");
  assert.equal(sanitizeStyle("width:expression(alert(1))"), "");
  assert.equal(sanitizeStyle("color:red;behavior:url(#x)"), "color:red");
  assert.equal(sanitizeStyle("@import url(evil.css);color:blue"), "color:blue");
});

test("sanitizeEditorHtml: een `<` die geen tag is, blijft leesbare tekst", () => {
  assert.equal(sanitizeEditorHtml("<p>2 < 3 en 4 > 1</p>"), "<p>2 &lt; 3 en 4 > 1</p>");
});

test("sanitizeEditorHtml: niet-gesloten tags worden netjes dichtgezet", () => {
  assert.equal(sanitizeEditorHtml("<p><b>vet"), "<p><b>vet</b></p>");
});

test("sanitizeEditorHtml: een sluittag zonder opening wordt genegeerd", () => {
  assert.equal(sanitizeEditorHtml("tekst</div></b>"), "tekst");
});

test("sanitizeEditorHtml: een aanhalingsteken in een attribuut breekt niet uit", () => {
  const out = sanitizeEditorHtml('<p title=\'a > b\'>x</p>');
  assert.equal(out, '<p title="a &gt; b">x</p>');
});

/* ─── toEmailHtml ─── */

test("toEmailHtml: omhult het bericht met één basislettertype", () => {
  const out = toEmailHtml("<p>Hallo</p>");
  assert.match(out, /^<div style="font-family:/);
  assert.match(out, /<p style="margin:0 0 10px 0">Hallo<\/p>/);
  assert.match(out, /<\/div>$/);
});

test("toEmailHtml: lijsten en citaten krijgen inline stijl, geen classes", () => {
  const out = toEmailHtml("<ul><li>een</li></ul><blockquote>q</blockquote>");
  assert.match(out, /<ul style="margin:0 0 10px 0;padding-left:24px">/);
  assert.match(out, /<li style="margin:0 0 4px 0">een<\/li>/);
  assert.match(out, /<blockquote style="[^"]*border-left:2px solid #cbd5e1/);
  assert.ok(!out.includes("class="), "uitgaande mail mag nergens op een class leunen");
});

test("toEmailHtml: eigen stijl wint van de standaardstijl", () => {
  const out = toEmailHtml('<p style="text-align:center">x</p>');
  // Standaard eerst, eigen erna: bij gelijke eigenschap wint de laatste.
  assert.match(out, /style="margin:0 0 10px 0;text-align:center"/);
});

test("toEmailHtml: data:-afbeeldingen gaan niet mee de deur uit", () => {
  const out = toEmailHtml('<p>tekst<img src="data:image/png;base64,iVBORw0KGgo="></p>');
  assert.ok(!out.includes("data:image"), "een geplakt screenshot hoort een bijlage te worden");
  assert.match(out, /tekst/);
});

test("toEmailHtml: scripts en handlers komen ook hier niet door", () => {
  const out = toEmailHtml('<p onclick="x()">a</p><script>alert(1)</script>');
  assert.ok(!/onclick|script/i.test(out));
});

test("toEmailHtml: leeg blijft leeg — geen lege omhulling", () => {
  assert.equal(toEmailHtml(""), "");
  assert.equal(toEmailHtml("<p><br></p>"), "");
  assert.equal(toEmailHtml("<div><br></div>"), "");
});

test("toEmailHtml: een afbeelding of streep telt wél als inhoud", () => {
  assert.notEqual(toEmailHtml('<p><img src="https://x/y.png"></p>'), "");
  assert.notEqual(toEmailHtml("<hr>"), "");
});

/* ─── URL's ─── */

test("isSafeUrl: gewone schema's mogen, de rest niet", () => {
  assert.ok(isSafeUrl("https://open-aec.com"));
  assert.ok(isSafeUrl("mailto:piet@x.nl"));
  assert.ok(isSafeUrl("tel:+31612345678"));
  assert.ok(isSafeUrl("/files/logo.png"));
  assert.ok(isSafeUrl("cid:logo123"));
  assert.ok(!isSafeUrl("javascript:alert(1)"));
  assert.ok(!isSafeUrl("vbscript:msgbox(1)"));
  assert.ok(!isSafeUrl("file:///etc/passwd"));
  assert.ok(!isSafeUrl("data:image/png;base64,x"));
  assert.ok(isSafeUrl("data:image/png;base64,x", { allowDataImage: true }));
});

test("normalizeLinkUrl: vult het schema aan waar dat eenduidig is", () => {
  assert.equal(normalizeLinkUrl("open-aec.com"), "https://open-aec.com");
  assert.equal(normalizeLinkUrl("www.open-aec.com/x"), "https://www.open-aec.com/x");
  assert.equal(normalizeLinkUrl("https://open-aec.com"), "https://open-aec.com");
  assert.equal(normalizeLinkUrl("piet@open-aec.com"), "mailto:piet@open-aec.com");
  assert.equal(normalizeLinkUrl("//cdn.example.com/x"), "https://cdn.example.com/x");
});

test("normalizeLinkUrl: weigert wat geen link is of niet veilig is", () => {
  assert.equal(normalizeLinkUrl(""), null);
  assert.equal(normalizeLinkUrl("   "), null);
  assert.equal(normalizeLinkUrl("gewoon wat tekst"), null);
  assert.equal(normalizeLinkUrl("hallo"), null);
  assert.equal(normalizeLinkUrl("javascript:alert(1)"), null);
  assert.equal(normalizeLinkUrl("data:text/html,<script>"), null);
});

/* ─── Tekst ↔ HTML ─── */

test("plainTextToHtml: lege regels scheiden alinea's, enkele worden <br>", () => {
  assert.equal(plainTextToHtml("een\ntwee\n\ndrie"), "<p>een<br>twee</p><p>drie</p>");
});

test("plainTextToHtml: escapet HTML in de geplakte tekst", () => {
  assert.equal(plainTextToHtml("<script>x</script>"), "<p>&lt;script&gt;x&lt;/script&gt;</p>");
});

test("htmlToPlainText: geeft leesbare tekst zonder tags terug", () => {
  assert.equal(htmlToPlainText("<p>Beste Piet,</p><p>Groet<br>Maarten</p>"), "Beste Piet,\n\nGroet\nMaarten");
  assert.equal(htmlToPlainText("<p>a &amp; b</p>"), "a & b");
});

test("isHtmlEmpty: herkent de lege varianten die een editor achterlaat", () => {
  assert.ok(isHtmlEmpty(""));
  assert.ok(isHtmlEmpty("<br>"));
  assert.ok(isHtmlEmpty("<p><br></p>"));
  assert.ok(isHtmlEmpty("<div>&nbsp;</div>"));
  assert.ok(!isHtmlEmpty("<p>x</p>"));
});

test("ensureHtmlBody: een oud, plat concept wordt HTML met behoud van regels", () => {
  assert.equal(ensureHtmlBody("regel een\nregel twee"), "<p>regel een<br>regel twee</p>");
  assert.equal(ensureHtmlBody(""), "");
});

test("ensureHtmlBody: een concept dat al HTML is, gaat door het filter", () => {
  assert.equal(ensureHtmlBody('<p class="x" onclick="y()">al HTML</p>'), "<p>al HTML</p>");
});

test("escapeHtml: de drie tekens die een tag kunnen openen", () => {
  assert.equal(escapeHtml('<a href="x">&'), "&lt;a href=\"x\"&gt;&amp;");
});
