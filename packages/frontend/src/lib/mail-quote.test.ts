/**
 * Tests voor het geciteerde origineel in het opstelvenster.
 *
 * Drie dingen moeten kloppen, en ze hangen samen:
 *
 * 1. het citaat komt zichtbaar ín de opsteller (en de inklapdrempel bepaalt of
 *    het open of afgeknot begint);
 * 2. het komt er bij verzenden weer netjes uit, ónder de handtekening — óók
 *    nadat de gebruiker eraan gezeten heeft;
 * 3. een binnengekomen mail is vijandige invoer: wat erin zat mag niet in de
 *    eigen editor tot leven komen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  QUOTE_ATTR,
  QUOTE_COLLAPSE_LINES,
  buildComposeBodyWithQuote,
  buildQuoteBlock,
  estimateQuoteLines,
  hasQuote,
  heeftOndertekening,
  shouldCollapseQuote,
  splitQuoteFromBody,
  splitsOndertekening,
  voegOndertekeningIn,
} from "./mail-quote.ts";
import { buildOutgoingHtml } from "./mail-erpnext-compose.ts";
import { sanitizeEditorHtml, toEmailHtml } from "./mail-html.ts";

const LABEL = "Op 1 mei 2026 schreef Klant <klant@example.com>:";
/** Zoals de regel er ge-escaped in de HTML uitziet. */
const LABEL_HTML = "Op 1 mei 2026 schreef Klant &lt;klant@example.com&gt;:";

/** Een citaat van `n` regels. */
function longBody(n: number): string {
  return Array.from({ length: n }, (_, i) => `<p>regel ${i + 1}</p>`).join("");
}

/* ─── Opbouw ─── */

test("buildQuoteBlock: label boven het origineel, in één gemarkeerd blockquote", () => {
  const html = buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Hallo</p>" });
  assert.match(html, new RegExp(`^<blockquote ${QUOTE_ATTR}="1"`));
  assert.ok(html.includes(LABEL_HTML), "de attributieregel hoort in het citaat te staan");
  assert.ok(html.includes("<p>Hallo</p>"), "het origineel hoort in het citaat te staan");
  assert.ok(html.endsWith("</blockquote>"));
});

test("buildQuoteBlock: de doorstuur-bijlagenregel blijft staan", () => {
  const html = buildQuoteBlock({
    label: LABEL,
    bodyHtml: "<p>Zie bijlage</p>",
    noticeHtml: '<p style="color:#64748b">Bijlagen van het oorspronkelijke bericht: tekening.pdf</p>',
  });
  assert.ok(html.includes("tekening.pdf"), "de bijlagenopsomming mag niet wegvallen");
  // En hij staat vóór het originele bericht, niet erachter.
  assert.ok(html.indexOf("tekening.pdf") < html.indexOf("Zie bijlage"));
});

test("buildComposeBodyWithQuote: twee lege alinea's boven het citaat om in te typen", () => {
  const body = buildComposeBodyWithQuote(buildQuoteBlock({ label: LABEL, bodyHtml: "<p>x</p>" }));
  assert.ok(body.startsWith("<p><br></p><p><br></p><blockquote"));
  assert.equal(hasQuote(body), true);
});

test("buildComposeBodyWithQuote: zonder citaat blijft de opsteller leeg", () => {
  assert.equal(buildComposeBodyWithQuote(""), "");
  assert.equal(hasQuote(""), false);
  assert.equal(hasQuote("<p>gewoon een nieuw bericht</p>"), false);
});

/* ─── Veiligheid: het origineel komt van buiten ─── */

test("buildQuoteBlock: script, onerror en javascript:-links overleven het citaat niet", () => {
  const hostile =
    '<p>Hoi</p><script>alert(1)</script>' +
    '<img src="x" onerror="alert(2)">' +
    '<a href="javascript:alert(3)">klik</a>' +
    '<div style="background:url(javascript:alert(4))">rommel</div>';
  const html = buildQuoteBlock({ label: LABEL, bodyHtml: hostile });
  assert.ok(!/<script/i.test(html), "geen script-tag");
  assert.ok(!/onerror/i.test(html), "geen event-handler");
  assert.ok(!/javascript:/i.test(html), "geen javascript:-URL");
  assert.ok(html.includes("<p>Hoi</p>"), "de leesbare tekst blijft juist wél staan");
});

test("buildQuoteBlock: een label met HTML erin wordt tekst, geen opmaak", () => {
  const html = buildQuoteBlock({ label: "Op 1 mei schreef <script>x</script>", bodyHtml: "" });
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("de markering overleeft het editor-filter, andere data-attributen niet", () => {
  const body = buildComposeBodyWithQuote(buildQuoteBlock({ label: LABEL, bodyHtml: "<p>x</p>" }));
  // Dit is wat er bij het terughalen van een concept gebeurt.
  const round = sanitizeEditorHtml(body);
  assert.equal(hasQuote(round), true, "zonder markering weet het verzendpad niets meer");
  assert.equal(
    sanitizeEditorHtml('<p data-tracking="1">x</p>').includes("data-tracking"),
    false,
    "de rest van de data-ruimte blijft dicht",
  );
});

/* ─── Splitsen bij verzenden ─── */

test("splitQuoteFromBody: zonder citaat is alles getypte tekst", () => {
  const { typed, quote } = splitQuoteFromBody("<p>Nieuw bericht</p>");
  assert.equal(typed, "<p>Nieuw bericht</p>");
  assert.equal(quote, "");
});

test("splitQuoteFromBody: haalt het citaat er zonder omhulsel weer af", () => {
  const body = "<p>Mijn antwoord</p>" + buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Origineel</p>" });
  const { typed, quote } = splitQuoteFromBody(body);
  assert.equal(typed, "<p>Mijn antwoord</p>");
  assert.ok(quote.includes("<p>Origineel</p>"));
  assert.ok(!quote.includes("blockquote"), "het omhulsel zet buildOutgoingHtml er zelf omheen");
});

test("splitQuoteFromBody: een genest citaat in het origineel telt correct mee", () => {
  const inner = "<p>nu</p><blockquote><p>eerder</p></blockquote>";
  const body = "<p>Antwoord</p>" + buildQuoteBlock({ label: LABEL, bodyHtml: inner });
  const { typed, quote } = splitQuoteFromBody(body);
  assert.equal(typed, "<p>Antwoord</p>");
  assert.ok(quote.includes("<p>eerder</p>"), "de hele draad hoort mee te gaan");
});

test("splitQuoteFromBody: tekst ónder het citaat komt bij de getypte tekst", () => {
  const body =
    "<p>Boven</p>" +
    buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Origineel</p>" }) +
    "<p>Onder</p>";
  const { typed } = splitQuoteFromBody(body);
  assert.equal(typed, "<p>Boven</p><p>Onder</p>");
});

test("splitQuoteFromBody: wie het citaat weggooit, verstuurt het ook niet", () => {
  const { typed, quote } = splitQuoteFromBody("<p>Alleen mijn tekst</p>");
  assert.equal(quote, "");
  assert.equal(typed, "<p>Alleen mijn tekst</p>");
});

/* ─── De ondertekening als gewone tekst in de opsteller ─── */

const ONDERTEKENING = '<div style="font-family:Segoe UI"><p>Met vriendelijke groet,</p>'
  + '<p><img src="data:image/jpeg;base64,/9j/4AAQ" width="70" height="70"> <strong>Maarten</strong></p></div>';

test("voegOndertekeningIn: bij een antwoord tussen de schrijfruimte en het citaat", () => {
  const body = buildComposeBodyWithQuote(buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Origineel</p>" }));
  const uit = voegOndertekeningIn(body, ONDERTEKENING);
  const plek = uit.indexOf("data-y-ondertekening");
  assert.ok(plek > 0, "de ondertekening staat erin");
  assert.ok(uit.startsWith("<p><br></p>"), "bovenaan blijft ruimte om te typen");
  assert.ok(plek < uit.indexOf(QUOTE_ATTR), "boven het citaat");
  assert.ok(uit.includes("data:image/jpeg;base64"), "de foto blijft in het tekstvak staan");
});

test("voegOndertekeningIn: bij een nieuw bericht onderaan, met ruimte erboven", () => {
  assert.ok(voegOndertekeningIn("", ONDERTEKENING).startsWith("<p><br></p><p><br></p><div data-y-ondertekening"));
});

test("voegOndertekeningIn: maar één keer, ook als hij intussen is aangepast", () => {
  const eenmaal = voegOndertekeningIn("", ONDERTEKENING);
  const aangepast = eenmaal.replace("Met vriendelijke groet,", "Groet,");
  assert.equal(voegOndertekeningIn(aangepast, ONDERTEKENING), aangepast);
  assert.equal(voegOndertekeningIn("<p>tekst</p>", ""), "<p>tekst</p>");
});

test("de ondertekening overleeft het editor-filter, met markering en foto", () => {
  const rond = sanitizeEditorHtml(voegOndertekeningIn("", ONDERTEKENING));
  assert.equal(heeftOndertekening(rond), true, "zonder markering weet het verzendpad niet waar hij staat");
  assert.ok(rond.includes("data:image/jpeg;base64"));
});

test("splitsOndertekening: haalt de ondertekening eruit, geneste div incluis", () => {
  const typed = "<p>Mijn antwoord</p>" + voegOndertekeningIn("<p>x</p>", ONDERTEKENING).replace("<p>x</p>", "");
  const { tekst, ondertekening } = splitsOndertekening(typed);
  assert.equal(tekst, "<p>Mijn antwoord</p>");
  assert.ok(ondertekening.includes("Met vriendelijke groet,"));
  assert.ok(ondertekening.endsWith("</div>"), "de binnenste div van de ondertekening hoort erbij");
  assert.ok(!ondertekening.includes("data-y-ondertekening"));
});

test("verzonden: eerst de tekst, dan de ondertekening met foto, dan het citaat", () => {
  const body = voegOndertekeningIn(
    buildComposeBodyWithQuote(buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Vraag van de klant</p>" })),
    ONDERTEKENING,
  ).replace("<p><br></p><p><br></p>", "<p>Dank je!</p>");
  const { typed, quote } = splitQuoteFromBody(body);
  const { tekst, ondertekening } = splitsOndertekening(typed);
  const html = buildOutgoingHtml({
    bodyHtml: toEmailHtml(tekst), signature: ondertekening, includeSignature: true, quoteHtml: quote,
  });
  const dank = html.indexOf("Dank je!");
  const groet = html.indexOf("Met vriendelijke groet,");
  const vraag = html.indexOf("Vraag van de klant");
  assert.ok(dank >= 0 && dank < groet && groet < vraag, "volgorde: tekst, ondertekening, citaat");
  assert.ok(html.includes("data:image/jpeg;base64"), "de foto gaat mee");
  assert.equal((html.match(/Met vriendelijke groet,/g) || []).length, 1, "één ondertekening");
});

/* ─── Het geheel: wat er echt de deur uit gaat ─── */

test("het origineel staat in de verzonden HTML, ónder de handtekening", () => {
  const body = "<p>Dank je!</p>" + buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Vraag van de klant</p>" });
  const { typed, quote } = splitQuoteFromBody(body);
  const html = buildOutgoingHtml({
    bodyHtml: toEmailHtml(typed),
    signature: "<p>Maarten</p>",
    includeSignature: true,
    quoteHtml: quote,
  });
  assert.ok(html.includes("Dank je!"), "de getypte tekst gaat mee");
  assert.ok(html.includes("Vraag van de klant"), "het geciteerde origineel gaat mee");
  assert.ok(html.includes(LABEL_HTML), "en de attributieregel ook");
  assert.ok(
    html.indexOf("Maarten") < html.indexOf("Vraag van de klant"),
    "handtekening boven het citaat, niet eronder",
  );
  assert.ok(!html.includes(QUOTE_ATTR), "de interne markering hoort niet bij de ontvanger");
});

test("een bewerkt citaat gaat bewerkt de deur uit", () => {
  // De gebruiker heeft in de opsteller een alinea uit het citaat geknipt.
  const body =
    "<p>Zie mijn opmerking.</p>" +
    buildQuoteBlock({ label: LABEL, bodyHtml: "<p>Blijft staan</p>" });
  const { typed, quote } = splitQuoteFromBody(body);
  const html = buildOutgoingHtml({
    bodyHtml: toEmailHtml(typed), signature: "", includeSignature: false, quoteHtml: quote,
  });
  assert.ok(html.includes("Blijft staan"));
  assert.ok(!html.includes("Weggeknipt"));
});

/* ─── Inklapdrempel ─── */

test("estimateQuoteLines: telt alinea's en <br>, geen lege regels", () => {
  assert.equal(estimateQuoteLines("<p>een</p><p>twee</p>"), 2);
  assert.equal(estimateQuoteLines("een<br>twee<br>drie"), 3);
  assert.equal(estimateQuoteLines("<p>een</p><p></p><p>&nbsp;</p><p>twee</p>"), 2);
  assert.equal(estimateQuoteLines(""), 0);
});

test("shouldCollapseQuote: kort citaat staat gewoon open", () => {
  const body = buildComposeBodyWithQuote(
    buildQuoteBlock({ label: LABEL, bodyHtml: longBody(QUOTE_COLLAPSE_LINES - 2) }),
  );
  assert.equal(shouldCollapseQuote(body), false);
});

test("shouldCollapseQuote: lang citaat begint ingeklapt", () => {
  const body = buildComposeBodyWithQuote(
    buildQuoteBlock({ label: LABEL, bodyHtml: longBody(QUOTE_COLLAPSE_LINES + 5) }),
  );
  assert.equal(shouldCollapseQuote(body), true);
});

test("shouldCollapseQuote: precies op de drempel klapt nog niet in", () => {
  // De attributieregel telt mee — vandaar één regel minder in het origineel.
  const body = buildComposeBodyWithQuote(
    buildQuoteBlock({ label: LABEL, bodyHtml: longBody(QUOTE_COLLAPSE_LINES - 1) }),
  );
  assert.equal(estimateQuoteLines(splitQuoteFromBody(body).quote), QUOTE_COLLAPSE_LINES);
  assert.equal(shouldCollapseQuote(body), false);
});

test("shouldCollapseQuote: een nieuw bericht heeft niets in te klappen", () => {
  assert.equal(shouldCollapseQuote("<p>nieuw</p>"), false);
  assert.equal(shouldCollapseQuote(""), false);
});
