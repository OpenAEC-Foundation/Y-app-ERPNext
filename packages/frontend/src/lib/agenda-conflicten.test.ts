import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alsBereik,
  naarMinuten,
  overlapt,
  zoekConflicten,
  type Bezetting,
} from "./agenda-conflicten.ts";

/**
 * Tests voor de conflictcontrole bij een uitnodiging.
 *
 * De randen zijn hier het hele punt: aansluiten is geen conflict, een hele dag
 * botst met alles op die dag, en een afspraak die je hebt afgezegd houdt je
 * niet bezig. Aan een agenda op het scherm zie je zulke gevallen niet af.
 */

test("aansluitende afspraken botsen niet", () => {
  // 10:00-11:00 en 11:00-12:00: je kunt allebei.
  assert.equal(overlapt(
    { start: "2026-09-10T10:00:00", eind: "2026-09-10T11:00:00" },
    { start: "2026-09-10T11:00:00", eind: "2026-09-10T12:00:00" },
  ), false);
});

test("een kwartier overlap is een conflict", () => {
  assert.equal(overlapt(
    { start: "2026-09-10T10:00:00", eind: "2026-09-10T11:00:00" },
    { start: "2026-09-10T10:45:00", eind: "2026-09-10T12:00:00" },
  ), true);
});

test("een afspraak die de andere helemaal omsluit telt ook", () => {
  assert.equal(overlapt(
    { start: "2026-09-10T09:00:00", eind: "2026-09-10T17:00:00" },
    { start: "2026-09-10T13:00:00", eind: "2026-09-10T13:30:00" },
  ), true);
});

test("een hele dag botst met alles op die dag, en niet met de dag erna", () => {
  const vrijedag = { start: "2026-09-10", heleDag: true };
  assert.equal(overlapt(vrijedag, { start: "2026-09-10T08:00:00", eind: "2026-09-10T09:00:00" }), true);
  assert.equal(overlapt(vrijedag, { start: "2026-09-11T08:00:00", eind: "2026-09-11T09:00:00" }), false);
});

test("meerdaags verlof beslaat alle dagen ertussen", () => {
  const verlof = { start: "2026-09-09", eind: "2026-09-11", heleDag: true };
  assert.equal(overlapt(verlof, { start: "2026-09-10T16:00:00", eind: "2026-09-10T17:00:00" }), true);
  assert.equal(overlapt(verlof, { start: "2026-09-12T16:00:00", eind: "2026-09-12T17:00:00" }), false);
});

test("een afspraak zonder eindtijd is één moment", () => {
  const moment = { start: "2026-09-10T10:30:00" };
  assert.equal(overlapt(moment, { start: "2026-09-10T10:00:00", eind: "2026-09-10T11:00:00" }), true);
  // Precies op de begintijd van een andere afspraak: die begint dan pas.
  assert.equal(overlapt({ start: "2026-09-10T11:00:00" },
    { start: "2026-09-10T11:00:00", eind: "2026-09-10T12:00:00" }), false);
});

test("de spatie-notatie van ERPNext leest net zo goed als de T-notatie", () => {
  assert.equal(naarMinuten("2026-09-10 16:00:00"), naarMinuten("2026-09-10T16:00:00"));
});

test("dagen tellen door over maand- en jaargrenzen", () => {
  const dag = 1440;
  assert.equal(naarMinuten("2026-10-01") - naarMinuten("2026-09-30"), dag);
  assert.equal(naarMinuten("2027-01-01") - naarMinuten("2026-12-31"), dag);
  // 2028 is een schrikkeljaar: 29 februari bestaat en telt gewoon mee.
  assert.equal(naarMinuten("2028-03-01") - naarMinuten("2028-02-28"), 2 * dag);
  assert.equal(naarMinuten("2027-03-01") - naarMinuten("2027-02-28"), dag);
});

test("onleesbare invoer botst met niets in plaats van met alles", () => {
  assert.equal(alsBereik({ start: "" }), null);
  assert.equal(overlapt({ start: "geen datum" },
    { start: "2026-09-10T10:00:00", eind: "2026-09-10T11:00:00" }), false);
});

const AGENDA: Bezetting[] = [
  { id: "b", titel: "Werkoverleg", start: "2026-09-10T15:30:00", eind: "2026-09-10T16:30:00" },
  { id: "a", titel: "Belafspraak", start: "2026-09-10T09:00:00", eind: "2026-09-10T09:30:00" },
  { id: "c", titel: "Afgezegd overleg", start: "2026-09-10T16:00:00", eind: "2026-09-10T17:00:00", vrij: true },
  { id: "d", titel: "Morgen", start: "2026-09-11T16:00:00", eind: "2026-09-11T17:00:00" },
];

test("conflicten komen op volgorde van tijd, afgezegde afspraken niet", () => {
  const uit = zoekConflicten(
    { start: "2026-09-10T16:00:00", eind: "2026-09-10T17:00:00" }, AGENDA);
  assert.deepEqual(uit.map((b) => b.id), ["b"]);
});

test("geen conflict is een lege lijst, niet een fout", () => {
  assert.deepEqual(zoekConflicten(
    { start: "2026-09-10T11:00:00", eind: "2026-09-10T12:00:00" }, AGENDA), []);
});
