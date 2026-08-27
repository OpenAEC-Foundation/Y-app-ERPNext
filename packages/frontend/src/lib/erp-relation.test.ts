import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContactPayload,
  buildCustomerPayload,
  classifyRelationError,
  emailDomain,
  extractPhone,
  guessCompanyName,
  humanizeDomain,
  isFreemailDomain,
  isNoReplyAddress,
  isRoleAddress,
  looksLikeCompanyName,
  lookupExisting,
  nameFromLocalPart,
  normalizePhone,
  parseSenderDetails,
  splitPersonName,
  toPlainText,
  validateRelationDraft,
  type RelationDraft,
} from "./erp-relation.ts";

/**
 * De fixtures hieronder zijn **echte** afzenders en handtekeningen uit de
 * inbox van de doelinstance (platgeslagen naar tekst zoals de mailweergave ze
 * ook aanlevert). Verzonnen voorbeelden zouden precies de gevallen missen
 * waarvoor de herkenning bestaat: de bedrijfsnaam die alleen als losse regel
 * ónder de naam staat, het nummer tussen haakjes, en de gmail-afzender die
 * tóch een eigen bedrijf heeft.
 */

const ARNO_BODY = `Goedemorgen Maarten,

We hebben voor de combinatie van Dorp – Max Bögl vdmb.eu een website nodig.

Wij willen een website waarop we minimaal (sub)pagina's hebben voor: over ons, projecten en nieuws.

Als je meer informatie van mij nodig hebt hoor ik het ook graag.

Met vriendelijke groet,

Arno Oerlemans
Bedrijfsleider Infra

Van Dorp Infra

+31 657421249

vandorp.eu/infra`;

const PIEBE_BODY = `Beste Maarten

Je spreekt met Piebe van der Storm,
Ik heb een klein aannemers bedrijfje en 3d computer animation gestudeerd.

Ik ben zo goed als constant bereikbaar op 0643430257.

Vriendelijke groeten;

Piebe van der Storm - Ekster Monument & Renovatie
Ekstergroep.nl`;

const DICK_BODY = `Beste Maarten,

Ik ben erg nieuwsgierig naar de open-source gebouw energie prestatie calculator: Open Energy Studio . De link(s) op de pagina https://open-aec.com/open-energy-studio werken echter niet.

Alvast veel dank!

Dick Dekker

(06 130 724 08)`;

const JOHAN_BODY = `Beste Maarten

Ik contacteer je namens de gemeente Haacht in België. Wij gebruiken momenteel een zeer oude versie van een CAD-pakket dat dringend aan vervanging toe is binnen de departementen Patrimonium en Omgeving.

Wat we zeker nodig hebben:

2D CAD-tekeningen kunnen openen, bewerken en opslaan. Import van GIS-data via Shapefiles (.shp, samen met .shx, .dbf, .prj).

Met vriendelijke groeten`;

/* ────────────────────────── Losse bouwstenen ─────────────────────────── */

test("splitPersonName houdt Nederlandse tussenvoegsels bij de achternaam", () => {
  assert.deepEqual(splitPersonName("Piebe van der Storm"), { first: "Piebe", last: "van der Storm" });
  assert.deepEqual(splitPersonName("Arno Oerlemans"), { first: "Arno", last: "Oerlemans" });
  assert.deepEqual(splitPersonName("Johan Artois"), { first: "Johan", last: "Artois" });
  assert.deepEqual(splitPersonName("Martjan den Hoed"), { first: "Martjan", last: "den Hoed" });
  assert.deepEqual(splitPersonName("Biswambar Kshetri"), { first: "Biswambar", last: "Kshetri" });
});

test("splitPersonName strip titels en draait 'Achternaam, Voornaam' om", () => {
  assert.deepEqual(splitPersonName("Ing Vladimír Zima"), { first: "Vladimír", last: "Zima" });
  assert.deepEqual(splitPersonName("Ir. Jan Bakker"), { first: "Jan", last: "Bakker" });
  assert.deepEqual(splitPersonName("Oerlemans, Arno"), { first: "Arno", last: "Oerlemans" });
  // Eén woord blijft één woord — geen verzonnen achternaam.
  assert.deepEqual(splitPersonName("Albert"), { first: "Albert" });
});

test("nameFromLocalPart maakt van het mailboxdeel iets leesbaars", () => {
  assert.deepEqual(nameFromLocalPart("linhaigui@ewpt.com"), { first: "Linhaigui" });
  assert.deepEqual(nameFromLocalPart("mojtaba.karimi1984@gmail.com"), { first: "Mojtaba", last: "Karimi" });
  assert.deepEqual(nameFromLocalPart("info@vindus.nl"), { first: "Info" });
});

test("looksLikeCompanyName kent de juridische staarten uit deze instance", () => {
  for (const yes of [
    "3BM Bouwtechniek V.O.F.", "Sympraxis B.V.", "Castellum Rosarum BV",
    "Groothandel Egg-sellent B.V.", "3BM Cooperatie U.A.", "Van Dorp Infra B.V.",
    "Ekster Groep",
  ]) {
    assert.equal(looksLikeCompanyName(yes), true, yes);
  }
  // Geen staart = geen zekerheid. En géén vals alarm op gewone zinnen die
  // toevallig op "as"/"ab"/"ag" eindigen.
  for (const no of [
    "Ekster Monument & Renovatie", "Moso Engineering", "Arno Oerlemans",
    "Import van GIS-data via Shapefiles (.shp, samen met .shx, .dbf, .prj).",
    "Het bestand staat op de as", "Dat is niet zoals het was",
  ]) {
    assert.equal(looksLikeCompanyName(no), false, no);
  }
});

test("humanizeDomain pakt het hoofdlabel, niet de subdomeinen", () => {
  assert.equal(humanizeDomain("vandorp.eu"), "Vandorp");
  assert.equal(humanizeDomain("egg-sellent.nl"), "Egg-Sellent");
  assert.equal(humanizeDomain("mail.instagram.com"), "Instagram");
  assert.equal(humanizeDomain("zima-engineering.cz"), "Zima-Engineering");
  assert.equal(humanizeDomain("something.co.uk"), "Something");
});

test("isFreemailDomain herkent de providers waar geen bedrijf achter zit", () => {
  for (const yes of ["gmail.com", "outlook.com", "ziggo.nl", "telenet.be", "icloud.com"]) {
    assert.equal(isFreemailDomain(yes), true, yes);
  }
  for (const no of ["vandorp.eu", "haacht.be", "3bm.co.nl", "ramboll.com"]) {
    assert.equal(isFreemailDomain(no), false, no);
  }
  assert.equal(emailDomain("Oerlemans@VanDorp.eu"), "vandorp.eu");
});

test("isNoReplyAddress / isRoleAddress scheiden mensen van mailboxen", () => {
  assert.equal(isNoReplyAddress("no-reply@invoices.example.com"), true);
  assert.equal(isNoReplyAddress("noreply@mail.instagram.com"), true);
  assert.equal(isNoReplyAddress("postmaster@vandorp.eu"), true);
  assert.equal(isNoReplyAddress("oerlemans@vandorp.eu"), false);
  assert.equal(isRoleAddress("facturen@egg-sellent.nl"), true);
  assert.equal(isRoleAddress("info@vindus.nl"), true);
  assert.equal(isRoleAddress("piebevdstorm@gmail.com"), false);
});

/* ─────────────────────────── Telefoonherkenning ──────────────────────── */

test("extractPhone vindt de drie schrijfwijzen uit deze mailbox", () => {
  assert.equal(extractPhone(ARNO_BODY)?.phone, "+31657421249");
  assert.equal(extractPhone(PIEBE_BODY)?.phone, "0643430257");
  assert.equal(extractPhone(DICK_BODY)?.phone, "0613072408");
});

test("extractPhone verkiest een gelabeld nummer boven een los nummer", () => {
  const body = "Ons ordernummer is 0900123456789.\n\nTel: 010 123 45 67\n";
  const guess = extractPhone(body);
  assert.equal(guess?.phone, "0101234567");
  assert.equal(guess?.source, "labeled");
});

test("extractPhone laat datums, bedragen en bankgegevens met rust", () => {
  for (const nope of [
    "De factuur van 01-09-2026 is voldaan.",
    "Het bedrag is 2 417,58 euro.",
    "IBAN NL91 0123 4567 89 t.n.v. ons.",
    "KvK 08123456 te Arnhem.",
    "Beste Maarten, alvast dank.",
  ]) {
    assert.equal(extractPhone(nope), null, nope);
  }
});

test("extractPhone pakt het laatste nummer — de handtekening, niet het citaat", () => {
  const body = "Eerder schreef je: bel me op 020 1234567.\n\nGroet,\nJan\n\n06 12 34 56 78";
  assert.equal(extractPhone(body)?.phone, "0612345678");
});

test("normalizePhone houdt het landnummer en gooit de opmaak weg", () => {
  assert.equal(normalizePhone("+31 (0)6 5742 1249"), "+310657421249");
  assert.equal(normalizePhone("(06 130 724 08)"), "0613072408");
});

test("toPlainText strip HTML maar laat platte tekst met rust", () => {
  assert.equal(toPlainText("<p>Hallo<br>Wereld</p>").trim(), "Hallo\nWereld");
  assert.equal(toPlainText("Hallo\nWereld"), "Hallo\nWereld");
  assert.match(toPlainText("<div>Jan &amp; Piet</div>"), /Jan & Piet/);
});

/* ───────────────────────── Bedrijfsnaam raden ────────────────────────── */

test("guessCompanyName: losse regel die het maildomein bevestigt", () => {
  const guess = guessCompanyName(
    { email: "oerlemans@vandorp.eu", displayName: "Arno Oerlemans", bodyText: ARNO_BODY },
    { first: "Arno", last: "Oerlemans" }
  );
  assert.deepEqual(guess, { name: "Van Dorp Infra", source: "signature" });
});

test("guessCompanyName: 'Naam - Bedrijf' wint van het (freemail-)domein", () => {
  const guess = guessCompanyName(
    { email: "piebevdstorm@gmail.com", displayName: "Piebe van der Storm", bodyText: PIEBE_BODY },
    { first: "Piebe", last: "van der Storm" }
  );
  assert.deepEqual(guess, { name: "Ekster Monument & Renovatie", source: "signature" });
});

test("guessCompanyName: weergavenaam met juridische staart is zelf de relatie", () => {
  const guess = guessCompanyName(
    { email: "info@drukwerkdeal.nl", displayName: "Drukwerkdeal.nl B.V." },
    { first: "Info" }
  );
  assert.deepEqual(guess, { name: "Drukwerkdeal.nl B.V.", source: "display" });
});

test("guessCompanyName: zonder aanwijzing in de tekst valt hij terug op het domein", () => {
  const guess = guessCompanyName(
    { email: "johan.artois@haacht.be", displayName: "Johan Artois", bodyText: JOHAN_BODY },
    { first: "Johan", last: "Artois" }
  );
  assert.deepEqual(guess, { name: "Haacht", source: "domain" });
});

test("guessCompanyName: bij een privé-provider komt er niets uit de lucht vallen", () => {
  const guess = guessCompanyName(
    { email: "dickdekker@outlook.com", displayName: "Dick Dekker", bodyText: DICK_BODY },
    { first: "Dick", last: "Dekker" }
  );
  assert.equal(guess, null);
});

/* ───────────────────────── parseSenderDetails ────────────────────────── */

test("parseSenderDetails: Arno Oerlemans — bedrijf, naam en nummer compleet", () => {
  const draft = parseSenderDetails({
    email: "Oerlemans@vandorp.eu",
    displayName: "Arno Oerlemans",
    bodyText: ARNO_BODY,
  });
  assert.equal(draft.customerName, "Van Dorp Infra");
  assert.equal(draft.customerType, "Company");
  assert.equal(draft.createCustomer, true);
  assert.equal(draft.contactFirstName, "Arno");
  assert.equal(draft.contactLastName, "Oerlemans");
  assert.equal(draft.email, "oerlemans@vandorp.eu");
  assert.equal(draft.phone, "+31657421249");
  assert.deepEqual(draft.reasons, ["name:display", "company:signature", "phone:signature"]);
});

test("parseSenderDetails: Piebe van der Storm — gmail, maar wél een eigen bedrijf", () => {
  const draft = parseSenderDetails({
    email: "piebevdstorm@gmail.com",
    displayName: "Piebe van der Storm",
    bodyText: PIEBE_BODY,
  });
  assert.equal(draft.customerName, "Ekster Monument & Renovatie");
  assert.equal(draft.createCustomer, true);
  assert.equal(draft.contactFirstName, "Piebe");
  assert.equal(draft.contactLastName, "van der Storm");
  assert.equal(draft.phone, "0643430257");
});

test("parseSenderDetails: Dick Dekker — particulier, dus géén relatie aanzetten", () => {
  const draft = parseSenderDetails({
    email: "dickdekker@outlook.com",
    displayName: "Dick Dekker",
    bodyText: DICK_BODY,
  });
  assert.equal(draft.createCustomer, false);
  assert.equal(draft.customerType, "Individual");
  // De naam staat er wél klaar voor het geval de gebruiker de schakelaar
  // tóch aanzet — maar aan blijft hij niet uit zichzelf.
  assert.equal(draft.customerName, "Dick Dekker");
  assert.equal(draft.phone, "0613072408");
  assert.equal(draft.reasons.includes("company:domain"), false);
});

test("parseSenderDetails: Johan Artois — domeinnaam als relatie, geen telefoon verzonnen", () => {
  const draft = parseSenderDetails({
    email: "johan.artois@haacht.be",
    displayName: "Johan Artois",
    bodyText: JOHAN_BODY,
  });
  assert.equal(draft.customerName, "Haacht");
  assert.equal(draft.createCustomer, true);
  assert.equal(draft.contactFirstName, "Johan");
  assert.equal(draft.contactLastName, "Artois");
  assert.equal(draft.phone, undefined);
  assert.equal(draft.reasons.includes("phone:signature"), false);
});

test("parseSenderDetails: no-reply krijgt geen contactpersoon en geen relatie", () => {
  const draft = parseSenderDetails({
    email: "no-reply@mail.instagram.com",
    displayName: "Instagram",
    bodyText: "Iemand heeft ingelogd op je account.",
  });
  assert.equal(draft.contactFirstName, "");
  assert.equal(draft.createCustomer, false);
  assert.equal(draft.reasons.includes("address:noreply"), true);
  // En daarmee is het concept ook niet schrijfbaar zonder ingrijpen.
  assert.deepEqual(validateRelationDraft(draft), ["contactFirstName"]);
});

test("parseSenderDetails: functiemailbox meldt dat de naam uit de mailbox komt", () => {
  const draft = parseSenderDetails({
    email: "facturen@egg-sellent.nl",
    displayName: "Facturen  Eggsellent",
  });
  assert.equal(draft.contactFirstName, "Facturen");
  assert.equal(draft.reasons.includes("address:role"), true);
  assert.equal(draft.customerName, "Egg-Sellent");
});

test("parseSenderDetails: weergavenaam die het adres herhaalt levert geen persoon op", () => {
  const draft = parseSenderDetails({
    email: "linhaigui@ewpt.com",
    displayName: "linhaigui@ewpt.com",
  });
  assert.equal(draft.contactFirstName, "Linhaigui");
  assert.equal(draft.reasons.includes("name:display"), false);
  assert.equal(draft.reasons.includes("name:localpart"), true);
});

/* ───────────────────────────── Payload-bouw ──────────────────────────── */

function draftOf(partial: Partial<RelationDraft> = {}): RelationDraft {
  return {
    customerName: "Van Dorp Infra",
    customerType: "Company",
    contactFirstName: "Arno",
    contactLastName: "Oerlemans",
    email: "oerlemans@vandorp.eu",
    createCustomer: true,
    reasons: [],
    ...partial,
  };
}

test("buildCustomerPayload stuurt de twee verplichte velden en niets leegs", () => {
  assert.deepEqual(buildCustomerPayload(draftOf()), {
    customer_name: "Van Dorp Infra",
    customer_type: "Company",
  });
  assert.deepEqual(
    buildCustomerPayload(draftOf({ customerGroup: "Commercial", territory: "Netherlands" })),
    {
      customer_name: "Van Dorp Infra",
      customer_type: "Company",
      customer_group: "Commercial",
      territory: "Netherlands",
    }
  );
  // Lege strings worden weggelaten: een leeg Link-veld laat ERPNext zijn
  // eigen default kiezen, een lege string is een ongeldige link.
  assert.deepEqual(buildCustomerPayload(draftOf({ customerGroup: "  ", territory: "" })), {
    customer_name: "Van Dorp Infra",
    customer_type: "Company",
  });
});

test("buildContactPayload zet het adres in de child-tabel en koppelt de relatie", () => {
  const payload = buildContactPayload(
    draftOf({ phone: "+31657421249" }),
    "Van Dorp Infra B.V."
  );
  assert.equal(payload.first_name, "Arno");
  assert.equal(payload.last_name, "Oerlemans");
  assert.deepEqual(payload.email_ids, [{ email_id: "oerlemans@vandorp.eu", is_primary: 1 }]);
  assert.deepEqual(payload.phone_nos, [{ phone: "+31657421249", is_primary_phone: 1 }]);
  assert.deepEqual(payload.links, [{ link_doctype: "Customer", link_name: "Van Dorp Infra B.V." }]);
  assert.equal(payload.company_name, "Van Dorp Infra B.V.");
  // `email_id` hoort NIET in de payload: ERPNext leidt dat zelf af uit de
  // child-rij met is_primary.
  assert.equal("email_id" in payload, false);
});

test("buildContactPayload zonder relatie laat de koppeling weg", () => {
  const payload = buildContactPayload(draftOf({ createCustomer: false }));
  assert.equal("links" in payload, false);
  assert.equal("company_name" in payload, false);
  assert.equal("phone_nos" in payload, false);
});

test("validateRelationDraft benoemt precies wat er ontbreekt", () => {
  assert.deepEqual(validateRelationDraft(draftOf()), []);
  assert.deepEqual(validateRelationDraft(draftOf({ contactFirstName: " " })), ["contactFirstName"]);
  assert.deepEqual(validateRelationDraft(draftOf({ email: "geen-adres" })), ["email"]);
  assert.deepEqual(validateRelationDraft(draftOf({ customerName: "" })), ["customerName"]);
  // Zonder relatie is een lege bedrijfsnaam geen probleem.
  assert.deepEqual(validateRelationDraft(draftOf({ customerName: "", createCustomer: false })), []);
});

/* ──────────────────────────── lookupExisting ─────────────────────────── */

interface MockRoute {
  match: (url: string) => boolean;
  rows: unknown[];
  status?: number;
}

function installFetchMock(routes: MockRoute[]): { urls: string[]; restore: () => void } {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    const route = routes.find((r) => r.match(url));
    const status = route?.status ?? 200;
    const body = status === 200 ? { data: route?.rows ?? [] } : { exception: "PermissionError" };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { urls, restore: () => { globalThis.fetch = original; } };
}

/** Cache-buster: `erpnext.ts` cachet responses 30 s op URL. */
let probe = 0;
function freshEmail(): string {
  probe += 1;
  return `probe${probe}@voorbeeld.nl`;
}

test("lookupExisting vindt de contactpersoon én de eraan gekoppelde relatie", async () => {
  const email = freshEmail();
  const mock = installFetchMock([
    {
      match: (u) => u.includes("/Contact?") && u.includes("email_id"),
      rows: [{ name: "Arno Oerlemans-Van Dorp Infra B.V.", email_id: email, link_doctype: "Customer", link_name: "Van Dorp Infra B.V." }],
    },
    { match: () => true, rows: [] },
  ]);
  try {
    const found = await lookupExisting(email.toUpperCase());
    assert.equal(found.contact, "Arno Oerlemans-Van Dorp Infra B.V.");
    assert.equal(found.customer, "Van Dorp Infra B.V.");
    assert.equal(found.lead, undefined);
    // Vier plekken worden bevraagd — het adres kan op elk ervan staan.
    assert.equal(mock.urls.filter((u) => u.includes("/api/resource/")).length, 4);
  } finally {
    mock.restore();
  }
});

test("lookupExisting vindt een secundair adres uit de Contact Email-child", async () => {
  const email = freshEmail();
  const mock = installFetchMock([
    {
      match: (u) => u.includes("Contact%20Email") || u.includes("Contact+Email"),
      rows: [{ name: "Administratie Symitech-Symitech B.V.", link_doctype: "Customer", link_name: "Symitech B.V." }],
    },
    { match: () => true, rows: [] },
  ]);
  try {
    const found = await lookupExisting(email);
    assert.equal(found.contact, "Administratie Symitech-Symitech B.V.");
    assert.equal(found.customer, "Symitech B.V.");
  } finally {
    mock.restore();
  }
});

test("lookupExisting valt terug op Customer.email_id en meldt een lopende Lead", async () => {
  const email = freshEmail();
  const mock = installFetchMock([
    { match: (u) => u.includes("/Customer?"), rows: [{ name: "AddVision BV" }] },
    { match: (u) => u.includes("/Lead?"), rows: [{ name: "CRM-LEAD-2026-00003" }] },
    { match: () => true, rows: [] },
  ]);
  try {
    const found = await lookupExisting(email);
    assert.equal(found.contact, undefined);
    assert.equal(found.customer, "AddVision BV");
    assert.equal(found.lead, "CRM-LEAD-2026-00003");
  } finally {
    mock.restore();
  }
});

test("lookupExisting laat één mislukte deelquery de rest niet slopen", async () => {
  const email = freshEmail();
  const mock = installFetchMock([
    { match: (u) => u.includes("/Lead?"), rows: [], status: 403 },
    { match: (u) => u.includes("/Customer?"), rows: [{ name: "AddVision BV" }] },
    { match: () => true, rows: [] },
  ]);
  try {
    const found = await lookupExisting(email);
    assert.equal(found.customer, "AddVision BV");
    assert.equal(found.lead, undefined);
  } finally {
    mock.restore();
  }
});

test("lookupExisting doet geen enkele call bij een onbruikbaar adres", async () => {
  const mock = installFetchMock([{ match: () => true, rows: [] }]);
  try {
    assert.deepEqual(await lookupExisting("geen adres"), {});
    assert.deepEqual(await lookupExisting(""), {});
    assert.equal(mock.urls.length, 0);
  } finally {
    mock.restore();
  }
});

/* ───────────────────────── Foutclassificatie ─────────────────────────── */

test("classifyRelationError zet een rechtenfout vooraan", () => {
  assert.equal(classifyRelationError({ status: 403, message: "already exists" }), "permission");
  assert.equal(classifyRelationError({ message: "Insufficient Permission for Customer" }), "permission");
  assert.equal(classifyRelationError({ message: "Duplicate entry 'x' for key" }), "duplicate");
  assert.equal(classifyRelationError({ message: "Could not find Customer Group: Zakelijk" }), "link-missing");
  assert.equal(classifyRelationError({ message: "First Name is mandatory" }), "mandatory");
  assert.equal(classifyRelationError(new Error("Request timed out after 30s")), "generic");
});
