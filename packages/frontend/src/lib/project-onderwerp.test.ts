import { test } from "node:test";
import assert from "node:assert/strict";
import { onderwerpMetProject, projectLabel } from "./project-onderwerp.ts";

const PLATTEWEG = { name: "3312", project_name: "Woonhuis Platteweg 14 Reeuwijk" };

test("projectLabel: nummer en naam", () => {
  assert.equal(projectLabel(PLATTEWEG), "3312 Woonhuis Platteweg 14 Reeuwijk");
  assert.equal(projectLabel({ name: "3311", project_name: "" }), "3311");
});

test("projectLabel: een naam die het nummer al bevat krijgt het niet twee keer", () => {
  assert.equal(projectLabel({ name: "3077", project_name: "(3077) Nieuwbouw HSB-woning Landekensdijk 4 Lage Zwaluwe" }),
    "3077 Nieuwbouw HSB-woning Landekensdijk 4 Lage Zwaluwe");
  assert.equal(projectLabel({ name: "3277", project_name: "3277 Constructie Woonhuis" }), "3277 Constructie Woonhuis");
  assert.equal(projectLabel({ name: "3277", project_name: "3277 - Constructie Woonhuis" }), "3277 Constructie Woonhuis");
  // Een ander getal vooraan hoort wél bij de naam.
  assert.equal(projectLabel({ name: "3308", project_name: "PRO.25.1350 Paardenveld Mockup Utrecht" }),
    "3308 PRO.25.1350 Paardenveld Mockup Utrecht");
  assert.equal(projectLabel({ name: "3310", project_name: "33100 Loods" }), "3310 33100 Loods");
});

test("onderwerpMetProject: als onderwerp vervangt alles", () => {
  assert.equal(onderwerpMetProject("RE: offerte dakopbouw", PLATTEWEG, "vervang"), "3312 Woonhuis Platteweg 14 Reeuwijk");
  assert.equal(onderwerpMetProject("", PLATTEWEG, "vervang"), "3312 Woonhuis Platteweg 14 Reeuwijk");
});

test("onderwerpMetProject: vóór het onderwerp, en niet nog eens als het er al staat", () => {
  assert.equal(onderwerpMetProject("RE: offerte", PLATTEWEG, "voor"), "3312 Woonhuis Platteweg 14 Reeuwijk RE: offerte");
  assert.equal(onderwerpMetProject("   ", PLATTEWEG, "voor"), "3312 Woonhuis Platteweg 14 Reeuwijk");
  assert.equal(onderwerpMetProject("3312 Woonhuis Platteweg 14 Reeuwijk RE: offerte", PLATTEWEG, "voor"),
    "3312 Woonhuis Platteweg 14 Reeuwijk RE: offerte");
});
