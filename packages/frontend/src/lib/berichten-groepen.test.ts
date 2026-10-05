import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROEP_PREFIX, MAX_LEDEN, geldigVoorAfzender, groepSleutel, groepUitLink, groepsverschil,
  isGroepSleutel, nieuweGroepId, ontvangersVan, ontvangersVanWijziging, schoneLeden, schoneNaam,
  voornaam, zetGroepInQuery, type Groep,
} from "./berichten-groepen.ts";

const GROEP: Groep = {
  id: "3f2a9c1e-77aa-4b1c-9e0d-1234567890ab",
  naam: "Projectteam Jelier",
  leden: ["maarten@3bm.co.nl", "nino@3bm.co.nl", "lance@3bm.co.nl"],
};

function linkMet(groep: Groep, gebeurtenis?: "aangemaakt" | "gewijzigd" | "verlaten"): string {
  const q = new URLSearchParams();
  q.set("k", "abcdef12-3456");
  zetGroepInQuery(q, groep, gebeurtenis);
  return `/y-next#/messenger?${q.toString()}`;
}

test("een groepskenmerk is elke keer anders en herkenbaar als gesprek", () => {
  assert.notEqual(nieuweGroepId(), nieuweGroepId());
  assert.equal(groepSleutel("abc"), `${GROEP_PREFIX}abc`);
  assert.ok(isGroepSleutel(groepSleutel("abc")));
  assert.ok(!isGroepSleutel("nino@3bm.co.nl"));
});

test("heen en terug door de link levert dezelfde groep op", () => {
  const uit = groepUitLink(linkMet(GROEP, "aangemaakt"));
  assert.deepEqual(uit, { groep: GROEP, gebeurtenis: "aangemaakt" });
  assert.deepEqual(groepUitLink(linkMet(GROEP)), { groep: GROEP });
});

test("een link zonder of met een kapotte groep is geen groep", () => {
  assert.equal(groepUitLink("/y-next#/messenger"), null);
  assert.equal(groepUitLink("/y-next#/messenger?k=abcdef12"), null);
  assert.equal(groepUitLink(linkMet({ ...GROEP, id: "kort" })), null);
  assert.equal(groepUitLink(linkMet({ ...GROEP, naam: "   " })), null);
  assert.equal(groepUitLink(linkMet({ ...GROEP, leden: ["maarten@3bm.co.nl"] })), null);
});

test("een onbekende gebeurtenis wordt genegeerd, de groep blijft", () => {
  const link = linkMet(GROEP).replace("?", "?gev=gehackt&");
  assert.deepEqual(groepUitLink(link), { groep: GROEP });
});

test("te veel leden is geen groep", () => {
  const leden = Array.from({ length: MAX_LEDEN + 1 }, (_, i) => `lid${i}@3bm.co.nl`);
  const q = new URLSearchParams({ g: GROEP.id, gn: "Groot", gl: leden.join(",") });
  assert.equal(groepUitLink(`/y-next#/messenger?${q}`), null);
});

test("leden worden opgeschoond: geen dubbelen, geen rommel", () => {
  assert.deepEqual(schoneLeden([" a@x.nl ", "a@x.nl", "", "b@x.nl", "c d@x.nl", "e,f@x.nl"]), ["a@x.nl", "b@x.nl"]);
  assert.equal(schoneNaam("  Team\n  Jelier  "), "Team Jelier");
  assert.equal(schoneNaam("x".repeat(200)).length, 80);
});

test("alleen een lid kan in de groep schrijven", () => {
  assert.ok(geldigVoorAfzender(GROEP, "nino@3bm.co.nl"));
  assert.ok(!geldigVoorAfzender(GROEP, "vreemde@elders.nl"));
});

test("een bericht gaat naar iedereen behalve jezelf", () => {
  assert.deepEqual(ontvangersVan(GROEP, "maarten@3bm.co.nl"), ["nino@3bm.co.nl", "lance@3bm.co.nl"]);
});

test("het verschil tussen twee versies van de groep", () => {
  const nieuw: Groep = { ...GROEP, naam: "Team Jelier", leden: ["maarten@3bm.co.nl", "nino@3bm.co.nl", "joris@3bm.co.nl"] };
  assert.deepEqual(groepsverschil(GROEP, nieuw), {
    toegevoegd: ["joris@3bm.co.nl"], verwijderd: ["lance@3bm.co.nl"], hernoemd: true,
  });
  assert.deepEqual(groepsverschil(null, nieuw), { toegevoegd: [], verwijderd: [], hernoemd: false });
});

test("wie eruit gaat, hoort het ook", () => {
  const nieuw: Groep = { ...GROEP, leden: ["maarten@3bm.co.nl", "nino@3bm.co.nl", "joris@3bm.co.nl"] };
  assert.deepEqual(ontvangersVanWijziging(GROEP, nieuw, "maarten@3bm.co.nl"),
    ["nino@3bm.co.nl", "lance@3bm.co.nl", "joris@3bm.co.nl"]);
});

test("voornaam uit een naam of een adres", () => {
  assert.equal(voornaam("Nino van Kleef"), "Nino");
  assert.equal(voornaam("nino@3bm.co.nl"), "nino");
  assert.equal(voornaam(""), "");
});
