import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLeadPayload,
  buildOpportunityPayload,
  isoDatePart,
  todayIso,
  validateLeadInput,
  validateOpportunityInput,
} from "./lead-payload.ts";

/* ──────────────────────────────── Lead ───────────────────────────────── */

test("lead-payload met alles wat uit de mail kwam", () => {
  const payload = buildLeadPayload({
    leadName: "Piebe van der Storm",
    firstName: "Piebe",
    lastName: "van der Storm",
    companyName: "Ekster Monument & Renovatie",
    email: "piebevdstorm@gmail.com",
    phone: "0643430257",
    company: "OpenAEC Studio BV",
    source: "Email",
    note: "Kennismaking",
  });
  assert.deepEqual(payload, {
    naming_series: "CRM-LEAD-.YYYY.-",
    status: "Lead",
    request_type: "Request for Information",
    lead_name: "Piebe van der Storm",
    first_name: "Piebe",
    last_name: "van der Storm",
    company_name: "Ekster Monument & Renovatie",
    email_id: "piebevdstorm@gmail.com",
    // `mobile_no` en niet `phone`: uit een handtekening komt een mobiel nummer.
    mobile_no: "0643430257",
    company: "OpenAEC Studio BV",
    utm_source: "Email",
    notes: [{ note: "Kennismaking" }],
  });
});

test("lege velden komen niet in de payload terecht", () => {
  const payload = buildLeadPayload({ companyName: "Gemeente Haacht" });
  assert.equal(payload.company_name, "Gemeente Haacht");
  assert.ok(!("lead_name" in payload));
  assert.ok(!("email_id" in payload));
  assert.ok(!("mobile_no" in payload));
  assert.ok(!("utm_source" in payload));
  assert.ok(!("notes" in payload));
});

test("ERPNext eist een persoons- of bedrijfsnaam — dat merkt de dialoog vooraf", () => {
  assert.deepEqual(validateLeadInput({}), ["leadName"]);
  assert.deepEqual(validateLeadInput({ leadName: "Jan" }), []);
  assert.deepEqual(validateLeadInput({ companyName: "Acme" }), []);
  assert.deepEqual(validateLeadInput({ leadName: "Jan", email: "geen adres" }), ["email"]);
  assert.throws(() => buildLeadPayload({ email: "jan@acme.nl" }), /Onvolledige lead/);
});

test("een te lange naam wordt afgekapt in plaats van de insert te laten falen", () => {
  const payload = buildLeadPayload({ leadName: "A".repeat(300) });
  assert.equal(String(payload.lead_name).length, 140);
});

/* ───────────────────────────── Opportunity ───────────────────────────── */

test("offerteaanvraag-payload koppelt party_name aan opportunity_from", () => {
  const payload = buildOpportunityPayload({
    customer: "Van Dorp Infra B.V.",
    company: "OpenAEC Studio BV",
    transactionDate: "2026-08-20",
    contactEmail: "oerlemans@vandorp.eu",
    contactPhone: "+31 657421249",
    source: "Email",
    note: "Offerte aanvraag website VDMB.eu",
  });
  assert.deepEqual(payload, {
    naming_series: "CRM-OPP-.YYYY.-",
    opportunity_from: "Customer",
    party_name: "Van Dorp Infra B.V.",
    status: "Open",
    opportunity_type: "Sales",
    company: "OpenAEC Studio BV",
    transaction_date: "2026-08-20",
    contact_email: "oerlemans@vandorp.eu",
    contact_mobile: "+31 657421249",
    utm_source: "Email",
    notes: [{ note: "Offerte aanvraag website VDMB.eu" }],
  });
});

test("klant, bedrijf en datum zijn verplicht", () => {
  assert.deepEqual(
    validateOpportunityInput({ customer: "", company: "", transactionDate: "20-08-2026" }),
    ["customer", "company", "transactionDate"],
  );
  assert.throws(
    () => buildOpportunityPayload({ customer: "X", company: "Y", transactionDate: "" }),
    /Onvolledige offerteaanvraag/,
  );
});

/* ──────────────────────────────── Hulp ───────────────────────────────── */

test("datum uit een ERPNext-datetime", () => {
  assert.equal(isoDatePart("2026-08-20 09:14:02"), "2026-08-20");
  assert.equal(isoDatePart("2026-08-20"), "2026-08-20");
  assert.equal(isoDatePart(""), "");
  assert.equal(isoDatePart(undefined), "");
});

test("vandaag is lokaal, niet UTC", () => {
  // 23:30 lokaal hoort niet als morgen te tellen.
  assert.equal(todayIso(new Date(2026, 7, 20, 23, 30)), "2026-08-20");
});
