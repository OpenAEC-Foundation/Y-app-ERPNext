import { test } from "node:test";
import assert from "node:assert/strict";
import { decideQuoteAction } from "./mail-quote-actions.ts";

/**
 * De beslisregel achter de knop "Offerte maken". Elk geval hieronder komt
 * overeen met een situatie die in deze mailbox voorkomt; zie de
 * moduletoelichting in `mail-quote-actions.ts` voor de afwegingen.
 */

test("offerteaanvraag van een bekende klant: offerte is de primaire actie", () => {
  const d = decideQuoteAction({
    intentKind: "quote-request", direction: "received", customer: "Van Dorp Infra B.V.",
  });
  assert.equal(d.show, true);
  assert.equal(d.emphasis, "primary");
  assert.deepEqual(d.party, { doctype: "Customer", name: "Van Dorp Infra B.V." });
  assert.equal(d.needsParty, false);
});

test("lead: de lead blijft primair, de offerte staat er secundair naast", () => {
  const d = decideQuoteAction({
    intentKind: "lead", direction: "received", lead: "CRM-LEAD-2026-00001",
  });
  assert.equal(d.show, true);
  assert.equal(d.emphasis, "secondary");
  assert.deepEqual(d.party, { doctype: "Lead", name: "CRM-LEAD-2026-00001" });
});

test("lead zonder bestaande lead of klant: de knop leidt eerst naar de partij", () => {
  const d = decideQuoteAction({ intentKind: "lead", direction: "received" });
  assert.equal(d.show, true);
  assert.equal(d.needsParty, true);
  assert.equal(d.party, undefined);
  assert.equal(d.reason, "quote:no-party");
});

test("gewone mail van een bekende klant: de knop is er, secundair", () => {
  const d = decideQuoteAction({
    intentKind: "none", direction: "received", customer: "AddVision BV",
  });
  assert.equal(d.show, true);
  assert.equal(d.emphasis, "secondary");
  assert.deepEqual(d.party, { doctype: "Customer", name: "AddVision BV" });
  assert.equal(d.reason, "quote:known-customer");
});

test("gewone mail met alleen een lopende lead: ook een offerte mogelijk", () => {
  const d = decideQuoteAction({
    intentKind: "none", direction: "received", lead: "CRM-LEAD-2026-00001",
  });
  assert.equal(d.show, true);
  assert.deepEqual(d.party, { doctype: "Lead", name: "CRM-LEAD-2026-00001" });
  assert.equal(d.reason, "quote:known-lead");
});

test("een klant wint van een lead als beide bekend zijn", () => {
  const d = decideQuoteAction({
    intentKind: "none", direction: "received",
    customer: "AddVision BV", lead: "CRM-LEAD-2026-00001",
  });
  assert.deepEqual(d.party, { doctype: "Customer", name: "AddVision BV" });
});

test("gewone mail van een volslagen onbekende afzender: geen knop", () => {
  const d = decideQuoteAction({ intentKind: "none", direction: "received" });
  assert.equal(d.show, false);
  assert.equal(d.reason, "quote:unknown-sender");
});

test("een inkoopfactuurmail krijgt nooit een offerte-knop", () => {
  const d = decideQuoteAction({
    intentKind: "purchase-invoice", direction: "received", customer: "AddVision BV",
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "quote:purchase-invoice");
});

test("verzonden mail krijgt nooit een offerte-knop", () => {
  const d = decideQuoteAction({
    intentKind: "quote-request", direction: "sent", customer: "AddVision BV",
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "quote:sent");
});

test("een mail die al aan een offerte hangt krijgt er geen tweede", () => {
  const d = decideQuoteAction({
    intentKind: "quote-request", direction: "received",
    customer: "AddVision BV", linkedDoctype: "Quotation",
  });
  assert.equal(d.show, false);
  assert.equal(d.reason, "quote:already-quoted");
});

test("een mail die aan een project hangt mag wél een offerte krijgen", () => {
  // Een projectkoppeling zegt niets over de verkoopkant; die mail kan prima
  // een meerwerk-aanvraag zijn.
  const d = decideQuoteAction({
    intentKind: "none", direction: "received",
    customer: "AddVision BV", linkedDoctype: "Project",
  });
  assert.equal(d.show, true);
});

test("elke uitkomst draagt een reden — ook 'niet tonen'", () => {
  const cases = [
    decideQuoteAction({ intentKind: "none", direction: "sent" }),
    decideQuoteAction({ intentKind: "none", direction: "received" }),
    decideQuoteAction({ intentKind: "lead", direction: "received" }),
    decideQuoteAction({ intentKind: "quote-request", direction: "received", customer: "X" }),
  ];
  for (const c of cases) assert.match(c.reason, /^quote:[a-z-]+$/);
});
