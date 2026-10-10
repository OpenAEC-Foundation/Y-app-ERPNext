import { test } from "node:test";
import assert from "node:assert/strict";
import { leesMogelijkheden, ontbrekendeDoctypes, ontbrekendeVelden } from "./mogelijkheden.ts";

const KAAL = {
  app_versie: "0.40.0",
  apps: { hrms: false, wiki: false },
  doctypes: { "Leave Application": false, "Wiki Page": false, "Shift Plan": false, "Travel Request": true },
  velden: { Task: { workflow_state: false }, Timesheet: { workflow_state: true } },
  taak_workflow: false,
  mailserver_ingesteld: false,
  cad_viewer: false,
};

test("leesMogelijkheden: geeft door wat de pagina meegaf", () => {
  assert.deepEqual(leesMogelijkheden(KAAL), KAAL);
});

test("leesMogelijkheden: null op een site zonder de app", () => {
  // De publicatieroute heeft geen app en geeft dus niets mee. Dan geldt het
  // gedrag van voorheen: niets vooraf uitsluiten.
  assert.equal(leesMogelijkheden(undefined), null);
  assert.equal(leesMogelijkheden(null), null);
  assert.equal(leesMogelijkheden("ja"), null);
  assert.equal(leesMogelijkheden([]), null);
});

test("ontbrekendeDoctypes: alleen wat uitdrukkelijk ontbreekt", () => {
  assert.deepEqual(ontbrekendeDoctypes(KAAL), ["Leave Application", "Wiki Page", "Shift Plan"]);
  assert.deepEqual(ontbrekendeDoctypes(null), []);
  assert.deepEqual(ontbrekendeDoctypes({}), []);
  // Een onbruikbare waarde telt niet als "ontbreekt".
  assert.deepEqual(ontbrekendeDoctypes({ doctypes: { A: 0, B: null, C: "nee", D: false } as never }), ["D"]);
});

test("ontbrekendeVelden: per doctype de velden die er niet zijn", () => {
  assert.deepEqual(ontbrekendeVelden(KAAL), { Task: ["workflow_state"] });
  assert.deepEqual(ontbrekendeVelden(null), {});
  assert.deepEqual(ontbrekendeVelden({ velden: { Task: "kapot" } as never }), {});
});
