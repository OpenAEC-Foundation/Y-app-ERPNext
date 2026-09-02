import test from "node:test";
import assert from "node:assert/strict";
import { pickIntentBodyCandidates, type IntentBodyCandidate } from "./mail-intent-bodies.ts";
import type { MailIntentContext } from "./mail-intent.ts";

const CTX: MailIntentContext = {
  suppliers: [{ name: "Drukwerk B.V.", emails: ["orders@drukwerk.nl"] }],
  customers: [{ name: "Egg B.V.", emails: ["dylan@egg-sellent.nl"] }],
  ownDomains: ["openaec.studio"],
};

function row(over: Partial<IntentBodyCandidate>): IntentBodyCandidate {
  return {
    name: "m1", subject: "Vraagje", sender: "iemand@nieuwbedrijf.nl",
    date: "2026-08-20 10:00:00", ...over,
  };
}

test("pickIntentBodyCandidates: onbekende afzender zonder onderwerp-signaal is een kandidaat", () => {
  // Precies het gemeten geval: "CAD software voor de gemeente …" zegt niets in
  // het onderwerp, maar de body vraagt om een alternatief.
  const names = pickIntentBodyCandidates(
    [row({ name: "m-cad", subject: "CAD software voor de gemeente Haacht." })], CTX, new Set());
  assert.deepEqual(names, ["m-cad"]);
});

test("pickIntentBodyCandidates: klant zonder onderwerp-signaal is óók een kandidaat", () => {
  const names = pickIntentBodyCandidates(
    [row({ name: "m-klant", sender: "dylan@egg-sellent.nl", subject: "Even overleggen" })],
    CTX, new Set());
  assert.deepEqual(names, ["m-klant"]);
});

test("pickIntentBodyCandidates: rijen waar de tekst niets aan verandert vallen af", () => {
  const names = pickIntentBodyCandidates([
    // Onderwerp levert al een voorstel: hooguit één label per rij.
    row({ name: "m-offerte", sender: "dylan@egg-sellent.nl", subject: "Offerte aanvraag website" }),
    // Verzonden.
    row({ name: "m-sent", sent: true }),
    // Hangt al aan een document.
    row({ name: "m-linked", linkedDoctype: "Purchase Invoice" }),
    // Leverancier die iets vraagt is inkoop, geen verkoopkans.
    row({ name: "m-supplier", sender: "orders@drukwerk.nl" }),
    // Eigen domein.
    row({ name: "m-collega", sender: "piet@openaec.studio" }),
    // No-reply.
    row({ name: "m-noreply", sender: "no-reply@platform.io" }),
  ], CTX, new Set());
  assert.deepEqual(names, []);
});

test("pickIntentBodyCandidates: al opgehaalde namen komen niet terug (ook de lege)", () => {
  // Zonder dit zou het effect elke render dezelfde batch opnieuw vragen.
  const rows = [row({ name: "m-a" }), row({ name: "m-b" })];
  assert.deepEqual(pickIntentBodyCandidates(rows, CTX, new Set(["m-a"])), ["m-b"]);
  assert.deepEqual(pickIntentBodyCandidates(rows, CTX, new Set(["m-a", "m-b"])), []);
});

test("pickIntentBodyCandidates: begrensd, want elke tekst is een LONGTEXT-kolom", () => {
  const rows = Array.from({ length: 60 }, (_, i) => row({ name: `m-${i}` }));
  assert.equal(pickIntentBodyCandidates(rows, CTX, new Set()).length, 30);
  assert.equal(pickIntentBodyCandidates(rows, CTX, new Set(), 5).length, 5);
});
