import test from "node:test";
import assert from "node:assert/strict";
import { CONCEPT_MARKERING, conceptenVoorGesprek, naarConcept } from "./mail-concepten.ts";

test("een rij uit ERPNext wordt een concept", () => {
  const c = naarConcept({
    name: "abc123", subject: "Offerte 3070", content: "<p>Hoi</p>",
    recipients: "august@innovias.nl", cc: "", bcc: null, sender: "maarten@3bm.co.nl",
    modified: "2026-09-22 15:00:00", reference_doctype: "Project", reference_name: "3070",
  });
  assert.equal(c.name, "abc123");
  assert.equal(c.aan, "august@innovias.nl");
  assert.equal(c.cc, "");
  assert.equal(c.bcc, "");
  assert.equal(c.inhoud, "<p>Hoi</p>");
  assert.deepEqual(c.reference, { doctype: "Project", name: "3070" });
});

test("zonder koppeling geen referentie", () => {
  const c = naarConcept({ name: "x", subject: "", reference_doctype: "Project" });
  assert.equal(c.reference, undefined);
  assert.equal(c.onderwerp, "");
});

test("de markering is een vaste waarde", () => {
  assert.equal(CONCEPT_MARKERING, "Y-NEXT-CONCEPT");
});

test("concepten horen bij het gesprek via in_reply_to of het onderwerp", () => {
  const maak = (naam: string, onderwerp: string, inReplyTo = "") => ({
    name: naam, aan: "", cc: "", bcc: "", onderwerp, inhoud: "", afzender: "", gewijzigd: "", inReplyTo,
  });
  const lijst = [
    maak("a", "RE: FW: rente aflossing", "dta6t315gc"),
    maak("b", "Re: rente aflossing"),
    maak("c", "Offerte 3070"),
  ];
  const uit = conceptenVoorGesprek(lijst, ["dta6t315gc", "xyz"], "FW: rente aflossing");
  assert.deepEqual(uit.map((c) => c.name), ["a", "b"]);
  assert.deepEqual(conceptenVoorGesprek(lijst, [], "Offerte 3070").map((c) => c.name), ["c"]);
});
