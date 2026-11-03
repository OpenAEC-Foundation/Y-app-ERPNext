import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deelIn, deelInWeek, groepVan, invulling, isoDatum, loopOp, maandagVan, patroonTekst, perRuimte, takenOpDag, teLaat,
  weekNummer, werkdagen, type DagInvulling, type Persoon, type TaakRegel, type Werkplek,
} from "./werkplekken-model.ts";

const persoon = (name: string, dagen: Partial<Persoon> = {}, volgorde = 0): Persoon => ({
  name, naam: name, gebruiker: `${name.toLowerCase()}@open-aec.com`,
  dag_ma: "", dag_di: "", dag_wo: "", dag_do: "", dag_vr: "",
  wisselend: 0, af_en_toe: 0, actief: 1, volgorde, notitie: null, ...dagen,
});
const plek = (name: string, volgorde: number, extra: Partial<Werkplek> = {}): Werkplek => ({
  name, plek: name, ruimte: "Hoofdkantoor", omschrijving: null, vaste_persoon: null, voorkeur_persoon: null,
  volgorde, actief: 1, ...extra,
});
const stand = (s: DagInvulling["stand"], gevraagdePlek: string | null = null): DagInvulling =>
  ({ stand: s, geboekt: !!gevraagdePlek, gevraagdePlek });

test("datums: maandag van de week, werkdagen en weeknummer", () => {
  const di = new Date(2026, 10, 3); // dinsdag 3 november 2026
  assert.equal(isoDatum(maandagVan(di)), "2026-11-02");
  assert.equal(isoDatum(maandagVan(new Date(2026, 10, 8))), "2026-11-02"); // zondag hoort bij de week ervoor
  assert.deepEqual(werkdagen(maandagVan(di)), ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  assert.equal(weekNummer(di), 45);
});

test("invulling: een boeking wint van het patroon", () => {
  const nino = persoon("Nino", { dag_wo: "", dag_do: "Kantoor" });
  assert.equal(invulling(nino, "do", undefined).stand, "kantoor");
  assert.equal(invulling(nino, "wo", undefined).stand, "vrij");
  const thuis = invulling(nino, "do", { name: "b", persoon: "Nino", datum: "2026-11-05", status: "Thuis", werkplek: null, notitie: null });
  assert.deepEqual(thuis, { stand: "thuis", geboekt: true, gevraagdePlek: null });
});

test("invulling: keuzedag en wisselend rooster blijven open tot ze doorgegeven zijn", () => {
  const bastian = persoon("Bastian", { dag_di: "Kantoor", dag_do: "Keuze", dag_vr: "Keuze" });
  assert.equal(invulling(bastian, "do", undefined).stand, "keuze");
  assert.equal(invulling(bastian, "ma", undefined).stand, "vrij");
  const jan = persoon("Jan", { wisselend: 1 });
  assert.equal(invulling(jan, "ma", undefined).stand, "onbekend");
});

test("indeling: vaste plek voor de eigenaar, flexers eerst op flexplekken", () => {
  const plekken = [
    plek("Bureau 1", 1, { vaste_persoon: "Nino" }),
    plek("Bureau 2", 2, { vaste_persoon: "Bjorn" }),
    plek("Bureau 3", 3),
    plek("Bureau 4", 4),
  ];
  const personen = [persoon("Nino"), persoon("Bjorn"), persoon("Alper", {}, 1), persoon("Bastian", {}, 2)];
  const standen = new Map([["Nino", stand("kantoor")], ["Bjorn", stand("vrij")], ["Alper", stand("kantoor")], ["Bastian", stand("kantoor")]]);
  const r = deelIn(personen, plekken, standen);
  assert.deepEqual(r.get("Nino"), { persoon: "Nino", werkplek: "Bureau 1", reden: "eigen" });
  assert.equal(r.get("Alper")?.werkplek, "Bureau 3");
  assert.equal(r.get("Bastian")?.werkplek, "Bureau 4");
  // Bureau 2 bleef leeg, hoewel Bjorn er niet is.
  assert.ok(![...r.values()].some((p) => p.werkplek === "Bureau 2"));
});

test("indeling: pas als de flexplekken op zijn, een vaste plek van iemand die er zeker niet is", () => {
  const plekken = [
    plek("Bureau 1", 1, { vaste_persoon: "Nino" }),
    plek("Bureau 7", 7, { vaste_persoon: "Jan" }),
    plek("Bureau 3", 3),
  ];
  const personen = [persoon("Nino"), persoon("Jan"), persoon("A", {}, 1), persoon("B", {}, 2), persoon("C", {}, 3)];
  // Jan is onbekend, Nino is zeker weg: eerst Nino's plek lenen, dan die van Jan.
  const standen = new Map([["Nino", stand("thuis")], ["Jan", stand("onbekend")], ["A", stand("kantoor")], ["B", stand("kantoor")], ["C", stand("kantoor")]]);
  const r = deelIn(personen, plekken, standen);
  assert.deepEqual([r.get("A")?.werkplek, r.get("B")?.werkplek, r.get("C")?.werkplek], ["Bureau 3", "Bureau 1", "Bureau 7"]);
  assert.equal(r.get("B")?.reden, "leen");
});

test("indeling: wie er niet bij past, krijgt geen plek; de plek van een aanwezige eigenaar blijft van hem", () => {
  const plekken = [plek("Bureau 1", 1, { vaste_persoon: "Nino" })];
  const personen = [persoon("Nino"), persoon("A", {}, 1)];
  const r = deelIn(personen, plekken, new Map([["Nino", stand("kantoor")], ["A", stand("kantoor")]]));
  assert.deepEqual(r.get("A"), { persoon: "A", werkplek: null, reden: null });
});

test("indeling: voorkeursplek en een geboekte plek", () => {
  const plekken = [plek("Bureau 6", 6), plek("Bureau 8", 8, { voorkeur_persoon: "Stefan" })];
  const personen = [persoon("Ethan", {}, 1), persoon("Stefan", {}, 2), persoon("Sander", {}, 3)];
  const standen = new Map([["Ethan", stand("kantoor")], ["Stefan", stand("kantoor")], ["Sander", stand("kantoor", "Bureau 8")]]);
  const r = deelIn(personen, plekken, standen);
  // Sander is met de hand op Bureau 8 gezet; Stefan (wiens plek dat meestal is)
  // gaat voor bij de rest en krijgt 6; voor Ethan is niets over.
  assert.equal(r.get("Sander")?.reden, "gekozen");
  assert.equal(r.get("Stefan")?.werkplek, "Bureau 6");
  assert.deepEqual(r.get("Ethan"), { persoon: "Ethan", werkplek: null, reden: null });
});

test("indeling: een flexplek die meestal van een ander is, komt na de echt vrije", () => {
  const plekken = [plek("Bureau 6", 6, { voorkeur_persoon: "Stefan" }), plek("Bureau 8", 8)];
  const personen = [persoon("Ethan", {}, 1), persoon("Stefan", {}, 2)];
  const r = deelIn(personen, plekken, new Map([["Ethan", stand("kantoor")], ["Stefan", stand("thuis")]]));
  assert.equal(r.get("Ethan")?.werkplek, "Bureau 8");
});

test("groepen, ruimtes en patroontekst", () => {
  const plekken = [plek("Bureau 1", 1, { vaste_persoon: "Nino" }), plek("Bureau 5", 5, { ruimte: "AI cave" }), plek("Bureau 2", 2)];
  assert.equal(groepVan(persoon("Nino"), plekken), "vast");
  assert.equal(groepVan(persoon("Ethan", { af_en_toe: 1 }), plekken), "flex");
  assert.equal(groepVan(persoon("Alper"), plekken), "flex");
  assert.deepEqual(perRuimte(plekken).map((g) => [g.ruimte, g.plekken.map((p) => p.name)]), [
    ["Hoofdkantoor", ["Bureau 1", "Bureau 2"]], ["AI cave", ["Bureau 5"]],
  ]);
  assert.equal(patroonTekst(persoon("F", { dag_ma: "Kantoor", dag_di: "Kantoor", dag_wo: "Kantoor", dag_do: "Kantoor", dag_vr: "Kantoor" })), "elke dag");
  assert.equal(patroonTekst(persoon("B", { dag_di: "Kantoor", dag_do: "Keuze", dag_vr: "Keuze" })), "di + do/vr");
});

test("week: een flexer zit alle dagen op dezelfde plek, wie vaker komt kiest eerst", () => {
  const plekken = [plek("Bureau 1", 1, { vaste_persoon: "Nino" }), plek("Bureau 3", 3), plek("Bureau 4", 4)];
  // Bastian staat eerder in de lijst, maar Alper komt twee dagen en kiest eerst.
  const personen = [persoon("Nino"), persoon("Bastian", {}, 1), persoon("Alper", {}, 2)];
  const ma = new Map([["Nino", stand("kantoor")], ["Alper", stand("kantoor")], ["Bastian", stand("vrij")]]);
  const di = new Map([["Nino", stand("kantoor")], ["Alper", stand("kantoor")], ["Bastian", stand("kantoor")]]);
  const [rMa, rDi] = deelInWeek(personen, plekken, [ma, di]);
  assert.equal(rMa.get("Alper")?.werkplek, "Bureau 3");
  assert.equal(rDi.get("Alper")?.werkplek, "Bureau 3");
  assert.equal(rDi.get("Bastian")?.werkplek, "Bureau 4");
});

test("week: de plek die op al iemands dagen vrij is, gaat voor", () => {
  const plekken = [plek("Bureau 3", 3), plek("Bureau 4", 4)];
  const personen = [persoon("A", {}, 1), persoon("B", {}, 2)];
  // A komt maandag en dinsdag, maar is dinsdag met de hand op Bureau 3 gezet...
  const ma = new Map([["A", stand("kantoor")], ["B", stand("kantoor")]]);
  const di = new Map([["A", stand("vrij")], ["B", stand("kantoor", "Bureau 3")]]);
  const [rMa, rDi] = deelInWeek(personen, plekken, [ma, di]);
  // ...dus B zit maandag ook op 3, en A krijgt 4.
  assert.equal(rDi.get("B")?.reden, "gekozen");
  assert.equal(rMa.get("A")?.werkplek, "Bureau 4");
});

test("week: een vaste plek alleen als er echt geen flexplek meer is", () => {
  const plekken = [plek("Bureau 1", 1, { vaste_persoon: "Nino" }), plek("Bureau 3", 3)];
  const personen = [persoon("Nino"), persoon("A", {}, 1), persoon("B", {}, 2)];
  const thuis = new Map([["Nino", stand("thuis")], ["A", stand("kantoor")]]);
  assert.equal(deelIn(personen, plekken, thuis).get("A")?.werkplek, "Bureau 3");
  const vol = new Map([["Nino", stand("thuis")], ["A", stand("kantoor")], ["B", stand("kantoor")]]);
  assert.deepEqual(deelIn(personen, plekken, vol).get("B"), { persoon: "B", werkplek: "Bureau 1", reden: "leen" });
  // Is de eigenaar er wel, dan blijft zijn plek van hem en heeft B geen plek.
  const nino = new Map([["Nino", stand("kantoor")], ["A", stand("kantoor")], ["B", stand("kantoor")]]);
  assert.equal(deelIn(personen, plekken, nino).get("B")?.werkplek, null);
});

const taak = (subject: string, start: string | null, eind: string | null, wie = "nino@open-aec.com", status = "Open"): TaakRegel =>
  ({ name: subject, subject, project: "PROJ-1", status, exp_start_date: start, exp_end_date: eind, _assign: JSON.stringify([wie]) });

test("taken: alleen taken met een datum lopen op een dag", () => {
  assert.equal(loopOp({ exp_start_date: null, exp_end_date: null }, "2026-11-03"), false);
  assert.equal(loopOp({ exp_start_date: null, exp_end_date: "2026-11-06" }, "2026-11-03"), true);
  assert.equal(loopOp({ exp_start_date: "2026-11-04", exp_end_date: null }, "2026-11-03"), false);
  assert.equal(loopOp({ exp_start_date: "2026-11-02", exp_end_date: "2026-11-03" }, "2026-11-03"), true);
  // Datum-tijd uit de ERP: de startdag hoort er gewoon bij.
  assert.equal(loopOp({ exp_start_date: "2026-11-03 00:00:00", exp_end_date: "2026-11-03 00:00:00" }, "2026-11-03"), true);
});

test("taken: per gebruiker, open, vroegste deadline eerst; te laat apart", () => {
  const taken = [
    taak("later", "2026-11-01", "2026-11-20"),
    taak("eerst", null, "2026-11-04"),
    taak("klaar", null, "2026-11-04", "nino@open-aec.com", "Completed"),
    taak("ander", null, "2026-11-04", "bjorn@open-aec.com"),
    taak("vergeten", null, "2026-10-30"),
  ];
  assert.deepEqual(takenOpDag(taken, "Nino@open-aec.com", "2026-11-03").map((t) => t.subject), ["eerst", "later"]);
  assert.deepEqual(takenOpDag(taken, null, "2026-11-03"), []);
  assert.deepEqual(teLaat(taken, "nino@open-aec.com", "2026-11-02").map((t) => t.subject), ["vergeten"]);
});
