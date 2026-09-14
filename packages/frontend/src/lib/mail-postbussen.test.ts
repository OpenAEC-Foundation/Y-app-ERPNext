import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kiesPostbussen,
  type PostbusKandidaat,
  type Postbustoegang,
} from "./mail-postbussen.ts";

/**
 * Tests voor de postbuskiezer.
 *
 * Twee gevallen gaan hier stil fout en zijn op het scherm niet te zien:
 *
 * - een tab die er wél staat maar leeg blijft, omdat ERPNext de berichten
 *   eruit filtert zonder melding;
 * - een kiezer die helemaal leeg blijft, omdat `Email Account` alleen te lezen
 *   is met de rol Inbox User of System Manager en een gewone medewerker die
 *   niet heeft.
 */

const ACCOUNTS: PostbusKandidaat[] = [
  { name: "Martin", emailId: "martin@3bm.co.nl", enableIncoming: true, enableOutgoing: true },
  { name: "Info", emailId: "info@3bm.co.nl", enableIncoming: true, enableOutgoing: true },
  { name: "cooperatie", emailId: "cooperatie@3bm.co.nl", enableIncoming: true, enableOutgoing: true },
  { name: "Waterlijn", emailId: "info@water-lijn.nl", enableIncoming: true, enableOutgoing: true },
  { name: "maarten", emailId: "maarten@3bm.co.nl", enableIncoming: true, enableOutgoing: true },
  { name: "sam", emailId: "sam@3bm.co.nl", enableIncoming: false, enableOutgoing: false },
];

const GEDEELD = ["info@3bm.co.nl", "cooperatie@3bm.co.nl"];

const namen = (p: { name: string }[]) => p.map((x) => x.name);

test("de eigen rijen zijn de lijst, ook zonder leesrecht op Email Account", () => {
  // Een gewone medewerker heeft de rol Inbox User niet, dus de accountlijst
  // komt leeg terug. Zijn kiezer hoort daar niet van af te hangen.
  const toegang: Postbustoegang = {
    accounts: [
      { name: "Lance", emailId: "lance@3bm.co.nl" },
      { name: "Waterlijn", emailId: "info@water-lijn.nl" },
    ],
    alles: false,
  };
  const uit = kiesPostbussen([], "lance@3bm.co.nl", toegang, GEDEELD);
  assert.deepEqual(namen(uit), ["Lance", "Waterlijn"]);
  assert.equal(uit[0].own, true, "de eigen bus staat vooraan");
});

test("een gedeelde postbus zonder eigen rij komt niet in beeld", () => {
  // Dit was de fout: info@ stond in de kiezer voor iedereen, maar ERPNext
  // laat alleen de accounts uit je User Email-tabel zien. Resultaat: een tab
  // die altijd leeg bleef.
  const toegang: Postbustoegang = {
    accounts: [{ name: "Nino", emailId: "nino@3bm.co.nl" }],
    alles: false,
  };
  const uit = kiesPostbussen(ACCOUNTS, "nino@3bm.co.nl", toegang, GEDEELD);
  assert.deepEqual(namen(uit), ["Nino"]);
});

test("mét een rij komt hij er wél bij", () => {
  const toegang: Postbustoegang = {
    accounts: [
      { name: "Martin", emailId: "martin@3bm.co.nl" },
      { name: "Info", emailId: "info@3bm.co.nl" },
    ],
    alles: false,
  };
  const uit = kiesPostbussen(ACCOUNTS, "martin@3bm.co.nl", toegang, GEDEELD);
  assert.deepEqual(namen(uit), ["Martin", "Info"]);
});

test("een System Manager ziet de gedeelde bussen ook zonder eigen rij", () => {
  // Hij mag alles lezen, dus daar blijft geen tab leeg. De gedeelde lijst
  // houdt het beperkt tot de bussen die een tab waard zijn.
  const toegang: Postbustoegang = {
    accounts: [{ name: "maarten", emailId: "maarten@3bm.co.nl" }],
    alles: true,
  };
  const uit = kiesPostbussen(ACCOUNTS, "maarten@3bm.co.nl", toegang, GEDEELD);
  assert.deepEqual(namen(uit), ["maarten", "cooperatie", "Info"]);
});

test("een System Manager krijgt niet alle bedrijfsaccounts als tab", () => {
  const toegang: Postbustoegang = { accounts: [], alles: true };
  const uit = kiesPostbussen(ACCOUNTS, "maarten@3bm.co.nl", toegang, GEDEELD);
  assert.equal(uit.some((p) => p.name === "Martin"), false);
  assert.equal(uit.some((p) => p.name === "maarten"), true, "zijn eigen bus hoort er wel bij");
});

test("een dood account is geen keuze", () => {
  const toegang: Postbustoegang = { accounts: [], alles: true };
  const uit = kiesPostbussen(ACCOUNTS, "sam@3bm.co.nl", toegang, [...GEDEELD, "sam@3bm.co.nl"]);
  assert.equal(uit.some((p) => p.name === "sam"), false);
});

test("dezelfde postbus uit beide bronnen levert één tab op", () => {
  const toegang: Postbustoegang = {
    accounts: [{ name: "Info", emailId: "info@3bm.co.nl" }],
    alles: true,
  };
  const uit = kiesPostbussen(ACCOUNTS, "maarten@3bm.co.nl", toegang, GEDEELD);
  assert.equal(uit.filter((p) => p.name === "Info").length, 1);
});

test("zonder bekende toegang blijft het bij de gedeelde lijst", () => {
  // Het eigen User-document was niet te lezen. Liever een tab te veel dan een
  // gebruiker die zijn postbus kwijt is.
  const uit = kiesPostbussen(ACCOUNTS, "nino@3bm.co.nl", null, GEDEELD);
  assert.deepEqual(namen(uit), ["cooperatie", "Info"]);
});

test("een rij zonder adres of zonder docnaam telt niet mee", () => {
  const toegang: Postbustoegang = {
    accounts: [
      { name: "Lance", emailId: "lance@3bm.co.nl" },
      { name: "", emailId: "kwijt@3bm.co.nl" },
      { name: "Leeg", emailId: "" },
    ],
    alles: false,
  };
  assert.deepEqual(namen(kiesPostbussen([], "lance@3bm.co.nl", toegang, GEDEELD)), ["Lance"]);
});
