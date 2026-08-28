import test from "node:test";
import assert from "node:assert/strict";
import {
  nextSuggestionIndex, isSelectKey, applyRecipientSuggestion,
  filterCachedSuggestions, sourceLabelKey, tokenAt,
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
