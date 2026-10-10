import { test } from "node:test";
import assert from "node:assert/strict";
import { readSetup, readAppDoctype, toCustomDoctype } from "./app-definities.mjs";

test("readSetup leest de definitiebestanden van de app", () => {
  const velden = readSetup("custom_fields.json");
  assert.ok(Array.isArray(velden.Project));
  assert.ok(velden.Project.some((veld) => veld.fieldname === "custom_address"));
  assert.ok(Array.isArray(readSetup("permissions.json")));
  assert.ok(Array.isArray(readSetup("master_records.json")));
});

test("readAppDoctype leest een doctype van de app op mapnaam", () => {
  const doctype = readAppDoctype("y_next_setting");
  assert.equal(doctype.name, "Y Next Setting");
  assert.equal(doctype.module, "Y Next");
});

test("toCustomDoctype maakt er een maatwerk-doctype van en laat het origineel met rust", () => {
  const app = {
    name: "Y Voorbeeld",
    module: "Y Next",
    autoname: "field:sleutel",
    naming_rule: "By fieldname",
    sort_field: "creation",
    sort_order: "DESC",
    creation: "2026-01-01 00:00:00",
    owner: "Administrator",
    fields: [{ fieldname: "sleutel", fieldtype: "Data", label: "Sleutel", reqd: 1 }],
    permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
  };
  const custom = toCustomDoctype(app);
  assert.equal(custom.doctype, "DocType");
  assert.equal(custom.name, "Y Voorbeeld");
  assert.equal(custom.module, "Custom");
  assert.equal(custom.custom, 1);
  assert.equal(custom.autoname, "field:sleutel");
  assert.equal(custom.sort_field, "creation");
  // Beheergegevens van de app horen niet in het verzoek.
  assert.equal("creation" in custom, false);
  assert.equal("owner" in custom, false);
  assert.deepEqual(custom.fields, app.fields);
  assert.notEqual(custom.fields[0], app.fields[0]);
  assert.equal(app.module, "Y Next");
});

test("toCustomDoctype vult ontbrekende rechtenvlaggen met 0", () => {
  // De REST-route vult een ontbrekende vlag met de standaardwaarde van
  // DocPerm, en die is 1 voor write, create en delete. Een rij die in de app
  // alleen leesrecht geeft, zou zonder expliciete nullen volledige rechten
  // opleveren.
  const custom = toCustomDoctype({
    name: "Y Voorbeeld",
    fields: [],
    permissions: [{ role: "Projects User", read: 1, report: 1 }],
  });
  assert.deepEqual(custom.permissions, [
    { role: "Projects User", read: 1, report: 1, permlevel: 0, if_owner: 0, write: 0, create: 0, delete: 0, submit: 0, cancel: 0, amend: 0 },
  ]);
});

test("toCustomDoctype neemt een enkelvoudig doctype over", () => {
  const custom = toCustomDoctype({ name: "Y Instelling", issingle: 1, fields: [], permissions: [] });
  assert.equal(custom.issingle, 1);
  assert.equal("autoname" in custom, false);
});
