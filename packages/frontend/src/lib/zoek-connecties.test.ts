import test from "node:test";
import assert from "node:assert/strict";
import { naarKeuzes, vergelijkProjectnummer } from "./zoek-connecties.ts";

test("projectnummers van hoog naar laag, tekstnamen daarna", () => {
  const namen = ["2196", "3201", "PROJ-0087", "0000", "3215"];
  assert.deepEqual([...namen].sort(vergelijkProjectnummer), ["3215", "3201", "2196", "0000", "PROJ-0087"]);
});

test("projectkeuzes krijgen nummer en naam als label", () => {
  const uit = naarKeuzes(
    { category: "project", doctype: "Project", naamveld: "project_name", zoekvelden: [] },
    [{ name: "2618", project_name: "Uitbreiding kantoorpand Klundert" }, { name: "3201", project_name: "Controle Sparingen Pauluskerk" }],
  );
  assert.deepEqual(uit.map((k) => k.name), ["3201", "2618"]);
  assert.match(uit[0].label, /3201/);
  assert.match(uit[0].label, /Pauluskerk/);
});

test("klanten alfabetisch op naam, lege rijen vallen weg", () => {
  const uit = naarKeuzes(
    { category: "customer", doctype: "Customer", naamveld: "customer_name", zoekvelden: [] },
    [{ name: "Zettex Group", customer_name: "Zettex Group" }, { name: "" }, { name: "Domera B.V.", customer_name: "Domera B.V." }],
  );
  assert.deepEqual(uit.map((k) => k.name), ["Domera B.V.", "Zettex Group"]);
});
