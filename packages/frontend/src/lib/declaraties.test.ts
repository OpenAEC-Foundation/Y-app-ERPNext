import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBeoordelingPatch,
  buildKmPayload,
  buildOnkostenPayload,
  computeKmBedrag,
  formatErpDate,
  formatErpDatetime,
  totaleKilometers,
} from "./declaraties.ts";
import { DEFAULT_KM_TARIEF } from "./kmTarief.ts";

/* ──────────────────────────── Rekenen ──────────────────────────── */

test("computeKmBedrag: retour telt de ingevoerde afstand dubbel", () => {
  // De gebruiker vult de enkele reis in en vinkt retour aan — dat is hoe het
  // formulier er altijd al uitzag.
  assert.equal(computeKmBedrag(10, false, 0.23), 2.3);
  assert.equal(computeKmBedrag(10, true, 0.23), 4.6);
});

test("computeKmBedrag: rondt af op hele centen", () => {
  // 0,1 x 3 levert in floating point 0.30000000000000004 op; zonder afronding
  // belandt dat zo in een Currency-veld.
  assert.equal(computeKmBedrag(1.3, false, 0.23), 0.3);
  assert.equal(computeKmBedrag(37.5, true, 0.23), 17.25);
});

test("computeKmBedrag: onbruikbare invoer levert 0, nooit een negatief bedrag", () => {
  assert.equal(computeKmBedrag(0, true, 0.23), 0);
  assert.equal(computeKmBedrag(-10, false, 0.23), 0);
  assert.equal(computeKmBedrag(10, false, 0), 0);
  assert.equal(computeKmBedrag(Number.NaN, false, 0.23), 0);
  assert.equal(computeKmBedrag(10, false, Number.NaN), 0);
});

test("totaleKilometers: retour is de gereden afstand, enkele reis niet", () => {
  assert.equal(totaleKilometers({ kilometers: 12.5, retour: 1 }), 25);
  assert.equal(totaleKilometers({ kilometers: 12.5, retour: 0 }), 12.5);
  assert.equal(totaleKilometers({ kilometers: 0, retour: 1 }), 0);
});

/* ──────────────────────────── Payloads ──────────────────────────── */

test("buildKmPayload: legt tarief én bedrag vast op het document", () => {
  const payload = buildKmPayload({
    employee: "HR-EMP-00001",
    datum: "2026-08-27",
    van: "Deventer",
    naar: "Zwolle",
    kilometers: 40,
    retour: true,
    tariefPerKm: 0.25,
  });
  // Het tarief hoort op het document, niet alleen in de instelling: een latere
  // tariefwijziging mag een geboekte rit niet herrekenen.
  assert.equal(payload.tarief_per_km, 0.25);
  assert.equal(payload.bedrag, 20);
  assert.equal(payload.retour, 1);
  assert.equal(payload.status, "Concept");
  assert.equal(payload.employee, "HR-EMP-00001");
});

test("buildKmPayload: zonder tarief valt hij terug op de gedeelde default", () => {
  const payload = buildKmPayload({
    employee: "HR-EMP-00001", datum: "2026-08-27", van: "A", naar: "B",
    kilometers: 10, retour: false,
  });
  assert.equal(payload.tarief_per_km, DEFAULT_KM_TARIEF);
  assert.equal(payload.bedrag, computeKmBedrag(10, false, DEFAULT_KM_TARIEF));
});

test("buildKmPayload: lege optionele velden worden weggelaten, niet als lege string gestuurd", () => {
  const payload = buildKmPayload({
    employee: "HR-EMP-00001", datum: "2026-08-27", van: "", naar: "",
    kilometers: 10, retour: false,
  });
  // Een leeg `project` zou een Link-validatie op "" uitlokken.
  assert.equal("project" in payload, false);
  assert.equal("omschrijving" in payload, false);
  assert.equal("van" in payload, false);
  assert.equal("naar" in payload, false);
});

test("buildOnkostenPayload: verplichte velden staan erin, lege optionele niet", () => {
  const payload = buildOnkostenPayload({
    employee: "HR-EMP-00002",
    datum: "2026-08-27",
    soort: "Parkeren",
    bedrag: 4.5,
  });
  assert.deepEqual(payload, {
    employee: "HR-EMP-00002",
    datum: "2026-08-27",
    soort: "Parkeren",
    bedrag: 4.5,
    status: "Concept",
  });
});

test("buildOnkostenPayload: een btw-bedrag van 0 wordt weggelaten (geen betekenisloze nul)", () => {
  const metBtw = buildOnkostenPayload({
    employee: "E", datum: "2026-08-27", soort: "Materiaal", bedrag: 100, btwBedrag: 21,
    omschrijving: "Boormachine", project: "PROJ-0001", leverancier: "Bouwmaat",
  });
  assert.equal(metBtw.btw_bedrag, 21);
  assert.equal(metBtw.project, "PROJ-0001");
  assert.equal(metBtw.leverancier, "Bouwmaat");

  const zonder = buildOnkostenPayload({ employee: "E", datum: "2026-08-27", soort: "Overig", bedrag: 5, btwBedrag: 0 });
  assert.equal("btw_bedrag" in zonder, false);
});

/* ────────────────────────── Beoordeling ────────────────────────── */

test("buildBeoordelingPatch: goedkeuren zet de stempel", () => {
  const patch = buildBeoordelingPatch("Goedgekeurd", "baas@example.com", new Date(2026, 7, 27, 9, 5, 3));
  assert.equal(patch.status, "Goedgekeurd");
  assert.equal(patch.goedgekeurd_door, "baas@example.com");
  assert.equal(patch.goedgekeurd_op, "2026-08-27 09:05:03");
});

test("buildBeoordelingPatch: afwijzen wist de stempel", () => {
  // Een oude stempel zou suggereren dat er ooit een geldige goedkeuring lag.
  const patch = buildBeoordelingPatch("Afgewezen", "baas@example.com");
  assert.deepEqual(patch, { status: "Afgewezen", goedgekeurd_door: null, goedgekeurd_op: null });
});

/* ──────────────────────────── Datums ──────────────────────────── */

test("formatErpDate: lokale datum, niet UTC", () => {
  // `toISOString()` schuift bij UTC+1/+2 een dag terug voor tijden vroeg op de
  // dag — een rit van 1 september zou dan op 31 augustus geboekt worden.
  assert.equal(formatErpDate(new Date(2026, 8, 1, 0, 30)), "2026-09-01");
  assert.equal(formatErpDate(new Date(2026, 0, 5)), "2026-01-05");
});

test("formatErpDatetime: het formaat dat Frappe verwacht", () => {
  assert.equal(formatErpDatetime(new Date(2026, 11, 31, 23, 59, 59)), "2026-12-31 23:59:59");
});
