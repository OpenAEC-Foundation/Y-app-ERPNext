import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kmBoekArgs,
  maandTarief,
  reisaanvraagFilters,
  ritUitReisaanvraag,
  type RuweReisRij,
} from "./km-reisaanvraag.ts";

/** Een regel zoals de lijstquery op `Travel Request` hem teruggeeft. */
function rij(overrides: Partial<RuweReisRij> = {}): RuweReisRij {
  return {
    name: "TRQ-Nino van Kleef-2026-MN.09-V.3324",
    employee: "HR-EMP-00019",
    employee_name: "Nino van Kleef",
    docstatus: 0,
    rij: "a1b2c3d4e5",
    departure_date: "2026-09-03 08:40:00",
    travel_from: "Leerambachtstraat 22, 3295TG, 's-Gravendeel",
    travel_to: "Burgemeester de Raadtsingel 31, \nDordrecht, \nZuid-Holland, 3311 JG, Netherlands, ",
    custom_distance: 24,
    custom_journey_type: "Return",
    custom_travel_cost: 5.76,
    ...overrides,
  };
}

/* ───────────────────────────── Omzetten ───────────────────────────── */

test("ritUitReisaanvraag: een retourrit wordt de enkele afstand met retour aan", () => {
  assert.deepEqual(ritUitReisaanvraag(rij()), {
    name: "a1b2c3d4e5",
    reisaanvraag: "TRQ-Nino van Kleef-2026-MN.09-V.3324",
    employee: "HR-EMP-00019",
    employee_name: "Nino van Kleef",
    datum: "2026-09-03",
    // Adressen uit ERPNext bevatten regeleinden; op één regel, zonder komma aan het eind.
    van: "Leerambachtstraat 22, 3295TG, 's-Gravendeel",
    naar: "Burgemeester de Raadtsingel 31, Dordrecht, Zuid-Holland, 3311 JG, Netherlands",
    kilometers: 12,
    retour: 1,
    tarief_per_km: 0.24,
    bedrag: 5.76,
    status: "Concept",
  });
});

test("ritUitReisaanvraag: enkele reis, ingediende reisaanvraag en ontbrekende velden", () => {
  const r = ritUitReisaanvraag(rij({
    docstatus: 1, custom_journey_type: "One way", custom_distance: 30, custom_travel_cost: 7.2,
  }));
  assert.equal(r.kilometers, 30);
  assert.equal(r.retour, 0);
  assert.equal(r.tarief_per_km, 0.24);
  // Een ingediende reisaanvraag is door de werkgever verwerkt.
  assert.equal(r.status, "Goedgekeurd");

  const leeg = ritUitReisaanvraag(rij({ custom_distance: null, custom_travel_cost: null, custom_journey_type: null, travel_to: null }));
  assert.equal(leeg.kilometers, 0);
  assert.equal(leeg.bedrag, 0);
  assert.equal(leeg.tarief_per_km, undefined);
  assert.equal(leeg.naar, "");
});

/* ───────────────────────────── Filters ────────────────────────────── */

test("reisaanvraagFilters: medewerker, periode op de ritdatum en nooit geannuleerd", () => {
  assert.deepEqual(reisaanvraagFilters({ employee: "HR-EMP-00019", vanaf: "2026-09-01", tot: "2026-09-30" }), [
    ["docstatus", "!=", 2],
    ["employee", "=", "HR-EMP-00019"],
    ["Travel Itinerary", "departure_date", ">=", "2026-09-01 00:00:00"],
    ["Travel Itinerary", "departure_date", "<=", "2026-09-30 23:59:59"],
  ]);
  assert.deepEqual(reisaanvraagFilters({}), [["docstatus", "!=", 2]]);
});

test("reisaanvraagFilters: status wordt de documentstatus; ingediend of afgewezen bestaat hier niet", () => {
  assert.deepEqual(reisaanvraagFilters({ status: "Concept" }), [["docstatus", "!=", 2], ["docstatus", "=", 0]]);
  assert.deepEqual(reisaanvraagFilters({ status: "Goedgekeurd" }), [["docstatus", "!=", 2], ["docstatus", "=", 1]]);
  // Er is per rit geen goedkeuring: niets te tonen, en dus geen query.
  assert.equal(reisaanvraagFilters({ status: "Ingediend" }), null);
  assert.equal(reisaanvraagFilters({ status: "Afgewezen" }), null);
});

/* ────────────────────────────── Boeken ────────────────────────────── */

test("kmBoekArgs: de parameters voor het server script", () => {
  const invoer = {
    employee: "HR-EMP-00019", datum: "2026-09-21", van: "Thuis", naar: "Kantoor",
    kilometers: 12, retour: true, project: "2022",
  };
  assert.deepEqual(kmBoekArgs(invoer), {
    actie: "boeken", employee: "HR-EMP-00019", datum: "2026-09-21", van: "Thuis", naar: "Kantoor",
    kilometers: 12, retour: 1,
  });
  assert.deepEqual(kmBoekArgs({ ...invoer, retour: false }, { toch: true }), {
    actie: "boeken", employee: "HR-EMP-00019", datum: "2026-09-21", van: "Thuis", naar: "Kantoor",
    kilometers: 12, retour: 0, toch: 1,
  });
});

test("maandTarief: het tarief van een rit in dezelfde maand, anders niets", () => {
  const ritten = [
    { datum: "2026-09-18", tarief_per_km: 0.24 },
    { datum: "2026-08-29", tarief_per_km: 0.23 },
    { datum: "2026-09-02", tarief_per_km: undefined },
  ];
  assert.equal(maandTarief(ritten, "2026-09-21"), 0.24);
  assert.equal(maandTarief(ritten, "2026-08-01"), 0.23);
  assert.equal(maandTarief(ritten, "2026-10-01"), undefined);
  assert.equal(maandTarief([], "2026-09-21"), undefined);
});
