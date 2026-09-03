import { test } from "node:test";
import assert from "node:assert/strict";
import { leesZoekantwoord, sorteerDoctypes, VEELGEBRUIKTE_DOCTYPES } from "./link-targets.ts";

test("sorteerDoctypes zet de veelgebruikte vooraan en laat de rest volgen", () => {
  const alle = ["Address", "Customer", "Project", "Warehouse"];
  const uit = sorteerDoctypes(alle, "");
  assert.equal(uit[0], "Project");
  assert.deepEqual(uit.slice(0, VEELGEBRUIKTE_DOCTYPES.length), [...VEELGEBRUIKTE_DOCTYPES]);
  // Geen dubbelen: Customer en Project staan al bovenaan.
  assert.equal(uit.filter((n) => n === "Customer").length, 1);
  assert.ok(uit.includes("Address"));
  assert.ok(uit.includes("Warehouse"));
});

test("sorteerDoctypes filtert door beide groepen heen", () => {
  const uit = sorteerDoctypes(["Sales Taxes and Charges Template", "Warehouse"], "sales");
  // De veelgebruikte treffers blijven vooraan staan.
  assert.deepEqual(uit, ["Sales Invoice", "Sales Order", "Sales Taxes and Charges Template"]);
  assert.deepEqual(sorteerDoctypes(["Warehouse"], "bestaat niet"), []);
});

test("sorteerDoctypes zoekt hoofdletterongevoelig", () => {
  assert.ok(sorteerDoctypes([], "PROJECT").includes("Project"));
  assert.ok(sorteerDoctypes([], "  invoice  ").includes("Purchase Invoice"));
});

test("leesZoekantwoord komt met elke vorm overweg die search_link teruggeeft", () => {
  const rijen = [{ value: "3304", description: "3304, Waterlijn BV io" }];
  assert.deepEqual(leesZoekantwoord({ message: rijen }), [
    { naam: "3304", omschrijving: "3304, Waterlijn BV io" },
  ]);
  assert.deepEqual(leesZoekantwoord({ results: rijen })[0].naam, "3304");
  assert.deepEqual(leesZoekantwoord(rijen)[0].naam, "3304");
  // Geen treffers, of helemaal geen antwoord: allebei een lege lijst.
  assert.deepEqual(leesZoekantwoord({ message: [] }), []);
  assert.deepEqual(leesZoekantwoord(null), []);
  assert.deepEqual(leesZoekantwoord({ exc: "iets stuk" }), []);
});

test("leesZoekantwoord maakt van HTML in de omschrijving gewone tekst", () => {
  // Adresvelden komen met <br> uit de database; die zetten we in een
  // tekstknoop, dus als opmaak zou je de tags letterlijk zien staan.
  const uit = leesZoekantwoord({
    message: [{ value: "Aannemersbedrijf Stam", description: "Pasteurstraat 7<br>\nReeuwijk-Dorp<br>" }],
  });
  assert.equal(uit[0].omschrijving, "Pasteurstraat 7, Reeuwijk-Dorp");
});

test("leesZoekantwoord slaat rijen zonder bruikbare naam over", () => {
  const uit = leesZoekantwoord({ message: [{ description: "geen value" }, { value: "" }, { value: "OK" }] });
  assert.deepEqual(uit, [{ naam: "OK", omschrijving: undefined }]);
  // Een kale lijst met strings komt ook voor.
  assert.deepEqual(leesZoekantwoord(["TASK-1"]), [{ naam: "TASK-1" }]);
});
