import test from "node:test";
import assert from "node:assert/strict";
import {
  nextSuggestionIndex, isSelectKey, applyRecipientSuggestion,
  filterCachedSuggestions, sourceLabelKey, tokenAt,
  splitsAdresInvoer, voegAdresInvoerSamen, adresMetNaam, kiesAdres,
  zonderBlokje, blokjeTerugNaarTekst, rondAdresAf, isBruikbaarAdres,
} from "./recipient-field.ts";
import type { RecipientSuggestion } from "./contact-suggestions.ts";

function sug(email: string, label: string, source: RecipientSuggestion["source"] = "customer"): RecipientSuggestion {
  return { email, label, score: 0, source };
}

/* ─── Navigeren door de lijst ─── */

test("pijltjes lopen door de lijst", () => {
  assert.equal(nextSuggestionIndex("ArrowDown", 0, 3), 1);
  assert.equal(nextSuggestionIndex("ArrowUp", 2, 3), 1);
});

test("de lijst loopt rond in plaats van vast te lopen", () => {
  assert.equal(nextSuggestionIndex("ArrowDown", 2, 3), 0);
  assert.equal(nextSuggestionIndex("ArrowUp", 0, 3), 2);
});

test("Home en End springen naar de randen", () => {
  assert.equal(nextSuggestionIndex("Home", 2, 4), 0);
  assert.equal(nextSuggestionIndex("End", 0, 4), 3);
});

test("andere toetsen en een lege lijst laten de lijst met rust", () => {
  assert.equal(nextSuggestionIndex("a", 0, 3), null);
  assert.equal(nextSuggestionIndex("ArrowDown", 0, 0), null);
});

test("Enter en Tab kiezen, andere toetsen niet", () => {
  assert.equal(isSelectKey("Enter"), true);
  assert.equal(isSelectKey("Tab"), true);
  assert.equal(isSelectKey("ArrowDown"), false);
  assert.equal(isSelectKey("Escape"), false);
});

/* ─── Adresblokjes ─── */

test("afgeronde adressen worden blokjes, wat nog getypt wordt blijft tekst", () => {
  assert.deepEqual(splitsAdresInvoer("a@b.nl, c@d.nl; jan"), { klaar: ["a@b.nl", "c@d.nl"], bezig: "jan" });
  assert.deepEqual(splitsAdresInvoer("a@b.nl, "), { klaar: ["a@b.nl"], bezig: "" });
  assert.deepEqual(splitsAdresInvoer(""), { klaar: [], bezig: "" });
});

test("een komma in een naam tussen aanhalingstekens splitst het adres niet", () => {
  const { klaar, bezig } = splitsAdresInvoer('"Vroegindeweij, Maarten" <maarten@3bm.co.nl>, ');
  assert.deepEqual(klaar, ['"Vroegindeweij, Maarten" <maarten@3bm.co.nl>']);
  assert.equal(bezig, "");
});

test("samenvoegen geeft de waarde terug die het verzendpad kent", () => {
  assert.equal(voegAdresInvoerSamen(["a@b.nl", "Piet <piet@x.nl>"], ""), "a@b.nl, Piet <piet@x.nl>, ");
  assert.equal(voegAdresInvoerSamen([], "ja"), "ja");
  // Heen en terug verandert niets aan een veld dat al zo stond.
  const waarde = "Maarten Vroegindeweij <maarten@3bm.co.nl>, jan";
  const { klaar, bezig } = splitsAdresInvoer(waarde);
  assert.equal(voegAdresInvoerSamen(klaar, bezig), waarde);
});

test("een gekozen suggestie komt er met naam in, zonder tekens die het adres breken", () => {
  assert.equal(adresMetNaam("maarten@3bm.co.nl", "Maarten Vroegindeweij"),
    "Maarten Vroegindeweij <maarten@3bm.co.nl>");
  assert.equal(adresMetNaam("a@b.nl", "a@b.nl"), "a@b.nl");
  assert.equal(adresMetNaam("a@b.nl", ""), "a@b.nl");
  assert.equal(adresMetNaam("m@x.nl", 'Vroegindeweij, "Maarten"'), "Vroegindeweij Maarten <m@x.nl>");
});

test("kiezen vervangt het zoekwoord door een blokje en zet een adres er geen twee keer in", () => {
  assert.equal(kiesAdres("a@b.nl, maar", "maarten@3bm.co.nl", "Maarten"),
    "a@b.nl, Maarten <maarten@3bm.co.nl>, ");
  assert.equal(kiesAdres("Maarten <MAARTEN@3bm.co.nl>, maar", "maarten@3bm.co.nl", "Maarten"),
    "Maarten <MAARTEN@3bm.co.nl>, ");
});

test("een blokje weghalen laat de andere en de lopende tekst staan", () => {
  assert.equal(zonderBlokje("a@b.nl, c@d.nl, e@f.nl, jan", 1), "a@b.nl, e@f.nl, jan");
  assert.equal(zonderBlokje("a@b.nl, ", 0), "");
});

test("dubbelklikken maakt een blokje weer tekst; wat al getypt stond wordt een blokje", () => {
  assert.equal(blokjeTerugNaarTekst("a@b.nl, c@d.nl, ", 0), "c@d.nl, a@b.nl");
  assert.equal(blokjeTerugNaarTekst("a@b.nl, jan", 0), "jan, a@b.nl");
  assert.equal(blokjeTerugNaarTekst("a@b.nl, ", 5), "a@b.nl, ");
});

test("afronden maakt van getypte tekst een blokje; zonder getypte tekst verandert niets", () => {
  assert.equal(rondAdresAf("a@b.nl, c@d.nl"), "a@b.nl, c@d.nl, ");
  assert.equal(rondAdresAf("a@b.nl, "), "a@b.nl, ");
  assert.equal(rondAdresAf(""), "");
});

test("een blokje zonder bruikbaar adres valt op", () => {
  assert.equal(isBruikbaarAdres("Maarten <maarten@3bm.co.nl>"), true);
  assert.equal(isBruikbaarAdres("maarten@3bm.co.nl"), true);
  assert.equal(isBruikbaarAdres("jan"), false);
  assert.equal(isBruikbaarAdres("jan@"), false);
  assert.equal(isBruikbaarAdres("jan@klant"), false);
});

/* ─── Wat er in het veld belandt ─── */

test("een keuze vervangt alleen het halfgetypte adres onder de cursor", () => {
  const value = "eer@ste.nl, jan";
  const { next, newCaret } = applyRecipientSuggestion(value, value.length, "jansen@klant.nl");
  assert.equal(next, "eer@ste.nl, jansen@klant.nl, ");
  assert.equal(newCaret, next.length);
});

test("een keuze midden in de tekst laat wat erachter staat intact", () => {
  const value = "jan, tweede@adres.nl";
  const { next, newCaret } = applyRecipientSuggestion(value, 3, "jansen@klant.nl");
  assert.equal(next, "jansen@klant.nl, tweede@adres.nl");
  // De cursor staat klaar voor het volgende adres, niet aan het einde.
  assert.equal(newCaret, "jansen@klant.nl, ".length);
});

test("een keuze in een leeg veld vult gewoon aan", () => {
  assert.equal(applyRecipientSuggestion("", 0, "a@b.nl").next, "a@b.nl, ");
});

test("het zoekwoord is alleen wat na de laatste scheiding staat", () => {
  assert.equal(tokenAt("een@a.nl, jans", 14), "jans");
  assert.equal(tokenAt("een@a.nl; jans", 14), "jans");
  assert.equal(tokenAt("jans", 4), "jans");
  assert.equal(tokenAt("een@a.nl, ", 10), "");
});

/* ─── Direct filteren terwijl de lookup nog loopt ─── */

test("filteren zoekt in zowel het adres als de naam", () => {
  const cached = [
    sug("p.jansen@klant.nl", "Piet Jansen"),
    sug("info@bouwbedrijf.nl", "Bouwbedrijf BV"),
  ];
  assert.deepEqual(filterCachedSuggestions(cached, "jansen").map((s) => s.email), ["p.jansen@klant.nl"]);
  assert.deepEqual(filterCachedSuggestions(cached, "bouw").map((s) => s.email), ["info@bouwbedrijf.nl"]);
  assert.deepEqual(filterCachedSuggestions(cached, "KLANT").map((s) => s.email), ["p.jansen@klant.nl"]);
});

test("een leeg zoekwoord houdt de hele lijst", () => {
  const cached = [sug("a@b.nl", "A"), sug("c@d.nl", "C")];
  assert.equal(filterCachedSuggestions(cached, "").length, 2);
  assert.equal(filterCachedSuggestions(cached, "   ").length, 2);
});

test("filteren raakt de doorgegeven lijst niet aan", () => {
  const cached = [sug("a@b.nl", "A")];
  const out = filterCachedSuggestions(cached, "");
  out.pop();
  assert.equal(cached.length, 1);
});

/* ─── Bronlabel ─── */

test("elke bron krijgt zijn eigen label-sleutel", () => {
  assert.equal(sourceLabelKey("frequent"), "y_next.mail_recipient_source_frequent");
  assert.equal(sourceLabelKey("lead"), "y_next.mail_recipient_source_lead");
  assert.equal(sourceLabelKey("contact"), "y_next.mail_recipient_source_contact");
  // Een contact via zijn primaire adres is voor de gebruiker gewoon "contact".
  assert.equal(sourceLabelKey("customer"), "y_next.mail_recipient_source_contact");
});
