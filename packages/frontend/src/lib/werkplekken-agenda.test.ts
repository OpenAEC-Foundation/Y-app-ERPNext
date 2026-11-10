import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaPerDag, dagenVanAfspraak, minutenVanDuur, statusUitTitel, type AgendaAfspraak } from "./werkplekken-agenda.ts";
import { invulling, type Persoon } from "./werkplekken-model.ts";

const WEEK = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];
const dag = (gebruiker: string, titel: string, start: string, extra: Partial<AgendaAfspraak> = {}): AgendaAfspraak =>
  ({ gebruiker, titel, start: `${start}T00:00:00`, duur: "P1D", hele_dag: true, ...extra });

test("titels: kantoor, thuis en afwezig; gewone afspraken tellen niet", () => {
  assert.equal(statusUitTitel("Kantoor"), "Kantoor");
  assert.equal(statusUitTitel("op kantoor"), "Kantoor");
  assert.equal(statusUitTitel("Thuiswerken"), "Thuis");
  assert.equal(statusUitTitel("Vakantie Spanje"), "Afwezig");
  assert.equal(statusUitTitel("Vrij"), "Afwezig");
  assert.equal(statusUitTitel("Overleg op kantoor"), null);
  assert.equal(statusUitTitel(undefined), null);
});

test("duur en dagen van een afspraak", () => {
  assert.equal(minutenVanDuur("P1D"), 1440);
  assert.equal(minutenVanDuur("PT23H59M"), 1439);
  assert.equal(minutenVanDuur("P1W"), 7 * 1440);
  assert.equal(minutenVanDuur(undefined), 0);
  assert.deepEqual(dagenVanAfspraak("2026-11-04T00:00:00", "P1D"), ["2026-11-04"]);
  assert.deepEqual(dagenVanAfspraak("2026-11-04T00:00:00", "PT23H59M"), ["2026-11-04"]);
  assert.deepEqual(dagenVanAfspraak("2026-11-04T09:00:00", "PT8H"), ["2026-11-04"]);
  assert.deepEqual(dagenVanAfspraak("2026-11-02T00:00:00", "P3D"), ["2026-11-02", "2026-11-03", "2026-11-04"]);
});

test("per dag: ook tijdafspraken, meerdaagse afspraken, en afwezig wint", () => {
  const r = agendaPerDag([
    dag("Bjorn@open-aec.com", "Kantoor", "2026-11-03"),
    dag("bjorn@open-aec.com", "Thuis", "2026-11-03"),
    dag("bjorn@open-aec.com", "Kantoor", "2026-11-04", { hele_dag: false, start: "2026-11-04T09:00:00", duur: "PT8H" }),
    dag("bjorn@open-aec.com", "Overleg op kantoor", "2026-11-05"),
    dag("jan@open-aec.com", "Vakantie", "2026-10-30", { duur: "P5D" }),
  ], WEEK);
  assert.equal(r.get("bjorn@open-aec.com")?.get("2026-11-03"), "Thuis");
  assert.equal(r.get("bjorn@open-aec.com")?.get("2026-11-04"), "Kantoor");
  assert.equal(r.get("bjorn@open-aec.com")?.get("2026-11-05"), undefined);
  // 30 okt t/m 3 nov: maandag en dinsdag van deze week.
  assert.deepEqual([...(r.get("jan@open-aec.com")?.keys() ?? [])].sort(), ["2026-11-02", "2026-11-03"]);
});

test("per dag: een wekelijkse reeks valt op de goede dag", () => {
  // Zo staat hij echt in de agenda: 0:00 tot 23:59, geen hele-dag-vlag.
  const vrij = dag("nino@open-aec.com", "Vrij", "2026-10-28", {
    hele_dag: false, duur: "PT23H59M", herhaalt: true, herhaling: { frequency: "weekly", byDay: [{ day: "we" }] },
  });
  const r = agendaPerDag([vrij], WEEK);
  assert.deepEqual([...(r.get("nino@open-aec.com")?.entries() ?? [])], [["2026-11-04", "Afwezig"]]);
});

test("invulling: boeking wint van de agenda, de agenda van het patroon", () => {
  const p = { name: "Nino", naam: "Nino", gebruiker: "nino@open-aec.com", dag_ma: "Kantoor", dag_di: "", dag_wo: "", dag_do: "", dag_vr: "",
    wisselend: 0, af_en_toe: 0, geen_werkplek: 0, actief: 1, volgorde: 0, notitie: null } as Persoon;
  assert.deepEqual(invulling(p, "ma", undefined, "Thuis"), { stand: "thuis", geboekt: false, gevraagdePlek: null, uitAgenda: true });
  const boeking = { name: "b", persoon: "Nino", datum: "2026-11-02", status: "Kantoor" as const, werkplek: null, notitie: null };
  assert.equal(invulling(p, "ma", boeking, "Thuis").stand, "kantoor");
  assert.equal(invulling(p, "ma", undefined, undefined).stand, "kantoor");
});
