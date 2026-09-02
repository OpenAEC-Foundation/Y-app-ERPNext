import test from "node:test";
import assert from "node:assert/strict";
import {
  CONNECTION_GROUP_BY,
  buildConnectionIndex,
  buildConnectionQueries,
  categoryOfDoctype,
  connectionFolderId,
  isConnectionFolder,
  messageMatchesSelection,
  parseConnectionFolder,
  type ConnectionRawInput,
} from "./mail-connections.ts";

/* ─────────────────────────────── Map-id's ─────────────────────────────── */

test("connectionFolderId/parseConnectionFolder: categorie zonder object", () => {
  const id = connectionFolderId({ category: "project" });
  assert.equal(id, "conn:project");
  assert.ok(isConnectionFolder(id));
  assert.deepEqual(parseConnectionFolder(id), { category: "project" });
});

test("connectionFolderId/parseConnectionFolder: concreet object, docname met dubbele punt blijft heel", () => {
  // ERPNext staat `:` in een docname toe; alles ná het doctype-segment hoort
  // bij de naam. Zou de parser op elke `:` splitsen, dan wees de map naar een
  // ander (of geen) document.
  const id = connectionFolderId({ category: "project", doctype: "Project", docname: "PROJ:2026:01" });
  assert.deepEqual(parseConnectionFolder(id), {
    category: "project", doctype: "Project", docname: "PROJ:2026:01",
  });
});

test("parseConnectionFolder: geen connectie-map of onbekende categorie geeft null", () => {
  assert.equal(parseConnectionFolder("INBOX"), null);
  assert.equal(parseConnectionFolder("tag:Klanten"), null);
  assert.equal(parseConnectionFolder("conn:verzonnen"), null);
  assert.equal(isConnectionFolder("INBOX"), false);
});

test("categoryOfDoctype: alleen de doctypes die een categorie vórmen", () => {
  assert.equal(categoryOfDoctype("Project"), "project");
  assert.equal(categoryOfDoctype("Customer"), "customer");
  assert.equal(categoryOfDoctype("Purchase Invoice"), "purchase-invoice");
  assert.equal(categoryOfDoctype("Quotation"), "opportunity");
  assert.equal(categoryOfDoctype("Lead"), "lead");
  // Contact is een tussenstap, geen eigen categorie.
  assert.equal(categoryOfDoctype("Contact"), null);
  assert.equal(categoryOfDoctype("Sales Invoice"), null);
});

/* ───────────────────────────── Filterbouwers ──────────────────────────── */

function filtersOf(spec: { filters: unknown[][] }): string[] {
  return spec.filters.map((f) => JSON.stringify(f));
}

test("buildConnectionQueries: een categorie levert twee takken — child-tabel én reference_*", () => {
  const specs = buildConnectionQueries({ category: "project" });
  assert.equal(specs.length, 2, "beide koppelingsbronnen moeten mee");

  // De child-tak MOET ontdubbelen: de join levert de parent één keer per
  // gematchte child-rij, en `distinct` helpt daar niet tegen.
  assert.equal(specs[0].groupBy, CONNECTION_GROUP_BY);
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Project"]]),
  ]);

  // De reference-tak joint niets en heeft dus geen group_by nodig.
  assert.equal(specs[1].groupBy, undefined);
  assert.deepEqual(filtersOf(specs[1]), [
    JSON.stringify(["reference_doctype", "in", ["Project"]]),
  ]);
});

test("buildConnectionQueries: klanten zonder momentopname nemen Contact breed mee", () => {
  const specs = buildConnectionQueries({ category: "customer" });
  assert.equal(specs.length, 2);
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Customer", "Contact"]]),
  ]);
  // De reference-tak blijft strikt: `reference_doctype = "Contact"` zou geen
  // klantconnectie zijn maar een contactpersoonkoppeling.
  assert.deepEqual(filtersOf(specs[1]), [
    JSON.stringify(["reference_doctype", "in", ["Customer"]]),
  ]);
});

test("buildConnectionQueries: mét momentopname wordt de Contact-tak afgebakend", () => {
  // Anders levert "Klanten" élke mail met een Contact-rij op — op de
  // doelinstance 32 van de 32, waarvan er 9 overblijven na het nafilter. Het
  // resultaat klopt dan wél, maar de pagina is bijna leeg.
  const index = buildConnectionIndex({
    messages: [], links: [],
    contactParties: [
      { parent: "Dylan-Egg", link_doctype: "Customer", link_name: "Egg B.V." },
      { parent: "Karel-Drukwerk", link_doctype: "Supplier", link_name: "Drukwerk B.V." },
    ],
  });
  const specs = buildConnectionQueries({ category: "customer" }, index);
  assert.equal(specs.length, 3);
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Customer"]]),
  ]);
  // Alleen de Contacts die daadwerkelijk aan een klant hangen — de
  // leverancierscontactpersoon hoort er niet bij.
  assert.deepEqual(filtersOf(specs[1]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Contact"]]),
    JSON.stringify(["Communication Link", "link_name", "in", ["Dylan-Egg"]]),
  ]);
  assert.deepEqual(filtersOf(specs[2]), [
    JSON.stringify(["reference_doctype", "in", ["Customer"]]),
  ]);
});

test("buildConnectionQueries: een concrete klant neemt de contactpersonen van díe klant mee", () => {
  const index = buildConnectionIndex({
    messages: [],
    links: [],
    contactParties: [
      { parent: "Dylan-Egg", link_doctype: "Customer", link_name: "Egg B.V." },
      { parent: "Bert-Dorp", link_doctype: "Customer", link_name: "Van Dorp" },
    ],
  });
  const specs = buildConnectionQueries({ category: "customer", doctype: "Customer", docname: "Egg B.V." }, index);

  // Twee condities op dezelfde child-tabel gelden voor dezelfde join-rij —
  // live geverifieerd — dus dit betekent "een Customer- of Contact-rij die
  // Egg B.V. of een van zijn contactpersonen noemt".
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Customer", "Contact"]]),
    JSON.stringify(["Communication Link", "link_name", "in", ["Egg B.V.", "Dylan-Egg"]]),
  ]);
  assert.deepEqual(filtersOf(specs[1]), [
    JSON.stringify(["reference_doctype", "in", ["Customer"]]),
    JSON.stringify(["reference_name", "=", "Egg B.V."]),
  ]);
});

test("buildConnectionQueries: 'niet gekoppeld' vraagt alleen de reference-loze mail op", () => {
  // "de child-tabel is leeg" is geen filter die Frappe kent; deze query is
  // daarom bewust een superset en het nafilter doet de rest.
  const specs = buildConnectionQueries({ category: "unlinked" });
  assert.equal(specs.length, 1);
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["reference_doctype", "is", "not set"]),
  ]);
});

test("buildConnectionQueries: geen index → klant-tak valt terug op de brede Contact-superset", () => {
  const specs = buildConnectionQueries({ category: "customer", doctype: "Customer", docname: "Egg B.V." });
  assert.deepEqual(filtersOf(specs[0]), [
    JSON.stringify(["Communication Link", "link_doctype", "in", ["Customer", "Contact"]]),
    JSON.stringify(["Communication Link", "link_name", "in", ["Egg B.V."]]),
  ]);
});

/* ──────────────────────── Categorie-afleiding ─────────────────────────── */

/**
 * Vorm van de echte data op de doelinstance: `reference_*` op de
 * verkoopfacturen, `Communication Link`-rijen met Contacts die ERPNext zelf op
 * e-mailadres zet, en een enkele handmatige Customer/Purchase Invoice-rij.
 */
const RAW: ConnectionRawInput = {
  messages: [
    { name: "m-pinv", reference_doctype: "Purchase Invoice", reference_name: "ACC-PINV-0043", seen: 1 },
    { name: "m-sinv", reference_doctype: "Sales Invoice", reference_name: "ACC-SINV-0012", seen: 0 },
    { name: "m-contact", seen: 0 },
    { name: "m-supplier-contact", seen: 1 },
    { name: "m-los", seen: 0 },
    { name: "m-project", seen: 1 },
  ],
  links: [
    { parent: "m-pinv", link_doctype: "Purchase Invoice", link_name: "ACC-PINV-0043" },
    { parent: "m-pinv", link_doctype: "Contact", link_name: "Dylan-Egg" },
    { parent: "m-contact", link_doctype: "Contact", link_name: "Dylan-Egg" },
    { parent: "m-contact", link_doctype: "Customer", link_name: "Egg B.V." },
    { parent: "m-supplier-contact", link_doctype: "Contact", link_name: "Karel-Drukwerk" },
    { parent: "m-project", link_doctype: "Project", link_name: "PROJ-0001" },
    // Rij van een mail die de momentopname niet kent (getrasht) — telt niet mee.
    { parent: "m-weg", link_doctype: "Project", link_name: "PROJ-0001" },
  ],
  contactParties: [
    { parent: "Dylan-Egg", link_doctype: "Customer", link_name: "Egg B.V." },
    { parent: "Karel-Drukwerk", link_doctype: "Supplier", link_name: "Drukwerk B.V." },
  ],
  labels: { "Customer::Egg B.V.": "Groothandel Egg-sellent B.V.", "Project::PROJ-0001": "Kade Noord" },
};

test("buildConnectionIndex: een mail kan in meerdere categorieën zitten", () => {
  const index = buildConnectionIndex(RAW);
  const conns = index.byMessage.get("m-pinv") ?? [];
  assert.deepEqual(conns.map((c) => `${c.category}:${c.name}`), [
    "customer:Egg B.V.",
    "purchase-invoice:ACC-PINV-0043",
  ]);
  // De Contact-rij is één keer verwerkt, en als de klant waar hij aan hangt.
  assert.equal(conns.filter((c) => c.doctype === "Contact").length, 0);
});

test("buildConnectionIndex: reference_* en de child-tabel naar hetzelfde document ontdubbelen", () => {
  const index = buildConnectionIndex(RAW);
  const pinv = (index.byMessage.get("m-pinv") ?? []).filter((c) => c.doctype === "Purchase Invoice");
  assert.equal(pinv.length, 1);
});

test("buildConnectionIndex: een Contact zonder klant maakt geen klantconnectie", () => {
  const index = buildConnectionIndex(RAW);
  // Karel hangt aan een leverancier; leveranciers zijn geen categorie.
  assert.equal(index.byMessage.has("m-supplier-contact"), false);
});

test("buildConnectionIndex: doctypes zonder categorie (Sales Invoice) tellen niet als connectie", () => {
  const index = buildConnectionIndex(RAW);
  assert.equal(index.byMessage.has("m-sinv"), false);
  const unlinked = index.categories.find((c) => c.id === "unlinked");
  assert.ok(unlinked);
  // m-sinv, m-supplier-contact en m-los.
  assert.equal(unlinked.total, 3);
  assert.equal(unlinked.unseen, 2, "m-sinv en m-los zijn ongelezen, m-supplier-contact niet");
});

test("buildConnectionIndex: link-rijen van mail die de momentopname niet kent tellen niet mee", () => {
  const index = buildConnectionIndex(RAW);
  const project = index.categories.find((c) => c.id === "project");
  assert.ok(project);
  assert.equal(project.total, 1, "m-weg staat niet in de momentopname");
  assert.equal(project.objects[0].label, "Kade Noord");
  assert.equal(project.objects[0].total, 1);
});

test("buildConnectionIndex: tellingen per categorie tellen mails, niet koppelingen", () => {
  const index = buildConnectionIndex(RAW);
  const customer = index.categories.find((c) => c.id === "customer");
  assert.ok(customer);
  // m-pinv (via Contact) en m-contact (via Contact én rechtstreeks) = 2 mails.
  assert.equal(customer.total, 2);
  assert.equal(customer.unseen, 1);
  assert.equal(customer.objects.length, 1);
  assert.equal(customer.objects[0].label, "Groothandel Egg-sellent B.V.");
  assert.equal(customer.objects[0].total, 2);
});

test("buildConnectionIndex: contactsByCustomer voedt de serverquery", () => {
  const index = buildConnectionIndex(RAW);
  assert.deepEqual(index.contactsByCustomer.get("Egg B.V."), ["Dylan-Egg"]);
  assert.equal(index.contactsByCustomer.has("Drukwerk B.V."), false);
});

/* ────────────────────────────── Nafilter ──────────────────────────────── */

test("messageMatchesSelection: categorie, concreet object en 'niet gekoppeld'", () => {
  const index = buildConnectionIndex(RAW);
  assert.ok(messageMatchesSelection(index, "m-pinv", { category: "customer" }));
  assert.ok(messageMatchesSelection(index, "m-pinv", { category: "purchase-invoice" }));
  assert.ok(!messageMatchesSelection(index, "m-pinv", { category: "project" }));
  assert.ok(messageMatchesSelection(index, "m-contact", {
    category: "customer", doctype: "Customer", docname: "Egg B.V.",
  }));
  assert.ok(!messageMatchesSelection(index, "m-contact", {
    category: "customer", doctype: "Customer", docname: "Van Dorp",
  }));
  assert.ok(messageMatchesSelection(index, "m-los", { category: "unlinked" }));
  assert.ok(!messageMatchesSelection(index, "m-contact", { category: "unlinked" }));
});

test("messageMatchesSelection: onbekende mail wordt doorgelaten, geen index betekent geen nafilter", () => {
  const index = buildConnectionIndex(RAW);
  // Net binnengekomen ná het laden van de momentopname: liever een ronde te
  // ruim tonen dan een verse mail onzichtbaar maken.
  assert.ok(messageMatchesSelection(index, "m-nieuw", { category: "project" }));
  assert.ok(messageMatchesSelection(null, "wat-dan-ook", { category: "unlinked" }));
});
