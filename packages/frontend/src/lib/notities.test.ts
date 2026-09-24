import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTITIE_MERK, actieOmschrijving, leesActies, naarDoc, naarNotitie, nieuwId,
  openstaand, schrijfActies, tekstUitHtml, todoPlan, vergelijkNotities, zoekNotities,
  type Actiepunt, type Notitie,
} from "./notities.ts";

function actie(over: Partial<Actiepunt> = {}): Actiepunt {
  return { id: "a1", tekst: "Bestek nalopen", wie: "", datum: "", gedaan: false, ...over };
}

function notitie(over: Partial<Notitie> = {}): Notitie {
  return {
    naam: "YMN-0001", titel: "Startoverleg", datum: "2026-09-24", project: "808",
    inhoud: "<p>Hallo</p>", acties: [], gewijzigd: "2026-09-24 10:00:00", ...over,
  };
}

test("een id is elke keer een andere", () => {
  assert.notEqual(nieuwId(), nieuwId());
});

test("acties lezen uit wat er ook in het veld staat", () => {
  assert.deepEqual(leesActies(null), []);
  assert.deepEqual(leesActies(""), []);
  assert.deepEqual(leesActies("geen json"), []);
  assert.deepEqual(leesActies('{"tekst":"x"}'), []);
  assert.deepEqual(leesActies('[null, 3, {"tekst":"   "}]'), []);
});

test("acties lezen behoudt wie, wanneer en of het af is", () => {
  const uit = leesActies('[{"id":"a9","tekst":"Bellen","wie":"nino@3bm.co.nl","datum":"2026-10-01","gedaan":true,"todo":"TODO-1"}]');
  assert.deepEqual(uit, [{
    id: "a9", tekst: "Bellen", wie: "nino@3bm.co.nl", datum: "2026-10-01", gedaan: true, todo: "TODO-1",
  }]);
});

test("de oude vorm van de vergadernotities wordt ook gelezen", () => {
  const uit = leesActies('[{"id":"z1","description":"Tekening sturen","assignedTo":"anna@zinkweg.nl","status":"done","dueDate":"2026-10-02T00:00:00"}]');
  assert.equal(uit.length, 1);
  assert.equal(uit[0].tekst, "Tekening sturen");
  assert.equal(uit[0].wie, "anna@zinkweg.nl");
  assert.equal(uit[0].datum, "2026-10-02");
  assert.equal(uit[0].gedaan, true);
  assert.equal(uit[0].todo, undefined);
});

test("schrijven en teruglezen levert hetzelfde op", () => {
  const acties = [
    actie({ id: "a1", tekst: "  Bestek nalopen  ", wie: " Nino@3bm.co.nl ", datum: "2026-10-01" }),
    actie({ id: "a2", tekst: "", wie: "x@y.nl" }),
    actie({ id: "a3", tekst: "Klaar", gedaan: true, todo: "TODO-7" }),
  ];
  const terug = leesActies(schrijfActies(acties));
  assert.equal(terug.length, 2);
  assert.equal(terug[0].tekst, "Bestek nalopen");
  assert.equal(terug[0].wie, "Nino@3bm.co.nl");
  assert.equal(terug[1].todo, "TODO-7");
});

test("een rij uit ERPNext wordt een notitie", () => {
  const n = naarNotitie({
    name: "YMN-0003", title: "Werkbespreking", meeting_date: "2026-09-24",
    project: "2892", notes: "<p>tekst</p>", action_points: "[]",
    modified: "2026-09-24 11:00:00",
  });
  assert.equal(n.naam, "YMN-0003");
  assert.equal(n.project, "2892");
  assert.deepEqual(n.acties, []);
  assert.equal(naarNotitie({ name: "x" }).titel, "");
});

test("een notitie draagt het merkje en het project", () => {
  const doc = naarDoc(notitie({ titel: "  ", acties: [actie({ wie: "nino@3bm.co.nl" })] }));
  assert.equal(doc.linked_doctype, NOTITIE_MERK);
  assert.equal(doc.linked_name, "808");
  assert.equal(doc.title, "Notitie");
  assert.equal(doc.project, "808");
  assert.equal(leesActies(doc.action_points).length, 1);
  assert.equal(naarDoc(notitie({ project: "", datum: "" })).project, null);
});

test("openstaande acties tellen", () => {
  assert.equal(openstaand([actie(), actie({ gedaan: true }), actie()]), 2);
});

test("jongste datum bovenaan, daarna het laatst bewerkt", () => {
  const lijst = [
    notitie({ naam: "a", datum: "2026-09-20" }),
    notitie({ naam: "b", datum: "" }),
    notitie({ naam: "c", datum: "2026-09-24", gewijzigd: "2026-09-24 08:00:00" }),
    notitie({ naam: "d", datum: "2026-09-24", gewijzigd: "2026-09-24 12:00:00" }),
  ];
  assert.deepEqual([...lijst].sort(vergelijkNotities).map((n) => n.naam), ["d", "c", "a", "b"]);
});

test("de tekst uit de HTML is leesbaar en afgekapt", () => {
  assert.equal(tekstUitHtml("<p>Eerste</p><p>Tweede</p>"), "Eerste Tweede");
  assert.equal(tekstUitHtml('<p>Foto:</p><img src="/files/a.png">'), "Foto:");
  assert.equal(tekstUitHtml("<p>a &amp; b</p>"), "a & b");
  assert.equal(tekstUitHtml("<p>abcdefghij</p>", 5), "abcd…");
});

test("zoeken kijkt in titel, project, tekst en acties", () => {
  const lijst = [
    notitie({ naam: "a", titel: "Startoverleg", inhoud: "<p>fundering</p>" }),
    notitie({ naam: "b", titel: "Oplevering", project: "2892", acties: [actie({ tekst: "Sleutels ophalen" })] }),
  ];
  assert.equal(zoekNotities(lijst, "").length, 2);
  assert.deepEqual(zoekNotities(lijst, "fundering").map((n) => n.naam), ["a"]);
  assert.deepEqual(zoekNotities(lijst, "SLEUTELS").map((n) => n.naam), ["b"]);
  assert.deepEqual(zoekNotities(lijst, "2892").map((n) => n.naam), ["b"]);
  assert.deepEqual(zoekNotities(lijst, "kozijn"), []);
});

test("een taak draagt de titel van de notitie mee", () => {
  assert.equal(actieOmschrijving(actie(), "Startoverleg"), "Bestek nalopen — Startoverleg");
  assert.equal(actieOmschrijving(actie(), "  "), "Bestek nalopen");
});

test("een actie met een naam erbij wordt een taak", () => {
  const plan = todoPlan([actie({ wie: "nino@3bm.co.nl" })], []);
  assert.equal(plan.maken.length, 1);
  assert.deepEqual(plan.bijwerken, []);
  assert.deepEqual(plan.opruimen, []);
});

test("een actie zonder naam wordt geen taak", () => {
  assert.deepEqual(todoPlan([actie()], []), { maken: [], bijwerken: [], opruimen: [] });
});

test("een bestaande taak wordt bijgewerkt, ook als de actie af is", () => {
  const a = actie({ wie: "nino@3bm.co.nl", todo: "TODO-1", gedaan: true });
  const plan = todoPlan([a], [a]);
  assert.deepEqual(plan.bijwerken.map((x) => x.todo), ["TODO-1"]);
  assert.deepEqual(plan.opruimen, []);
});

test("de naam weghalen laat de taak verdwijnen", () => {
  const oud = [actie({ id: "a1", wie: "nino@3bm.co.nl", todo: "TODO-1" })];
  const plan = todoPlan([actie({ id: "a1", wie: "", todo: "TODO-1" })], oud);
  assert.deepEqual(plan.opruimen, ["TODO-1"]);
  assert.deepEqual(plan.maken, []);
});

test("een weggegooide actie neemt zijn taak mee", () => {
  const oud = [
    actie({ id: "a1", wie: "nino@3bm.co.nl", todo: "TODO-1" }),
    actie({ id: "a2", wie: "anna@zinkweg.nl", todo: "TODO-2" }),
  ];
  const plan = todoPlan([oud[1]], oud);
  assert.deepEqual(plan.opruimen, ["TODO-1"]);
  assert.deepEqual(plan.bijwerken.map((x) => x.todo), ["TODO-2"]);
});

test("een taak komt niet twee keer in de opruimlijst", () => {
  const oud = [actie({ id: "a1", wie: "nino@3bm.co.nl", todo: "TODO-1" })];
  const plan = todoPlan([actie({ id: "a1", wie: "", todo: "TODO-1" })], oud);
  assert.deepEqual(plan.opruimen, ["TODO-1"]);
});
