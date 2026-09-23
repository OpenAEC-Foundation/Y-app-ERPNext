import test from "node:test";
import assert from "node:assert/strict";
import { AgendaGeheugen, GEHEUGEN_MS, maandagVan, wekenIn, wekenVanAfspraak, type GeheugenAfspraak } from "./agenda-geheugen.ts";

test("weken en maandagen", () => {
  assert.equal(maandagVan("2026-09-27"), "2026-09-21");
  assert.equal(maandagVan("2026-09-21"), "2026-09-21");
  assert.deepEqual(wekenIn("2026-09-23", "2026-10-06"), ["2026-09-21", "2026-09-28", "2026-10-05"]);
});

test("afspraak valt in de juiste week; een reeks in alle", () => {
  const weken = ["2026-09-21", "2026-09-28"];
  assert.deepEqual(wekenVanAfspraak({ gebruiker: "a", id: "1", start: "2026-09-29T09:00:00", duur: "PT1H" }, weken), ["2026-09-28"]);
  assert.deepEqual(wekenVanAfspraak({ gebruiker: "a", id: "2", start: "2026-09-27T00:00:00", duur: "P2D" }, weken), weken);
  assert.deepEqual(wekenVanAfspraak({ gebruiker: "a", id: "3", start: "2026-07-13T09:00:00", herhaalt: true }, weken), weken);
});

test("tweede keer uit het geheugen, collega erbij haalt alleen die op", async () => {
  let klok = 0;
  const geheugen = new AgendaGeheugen<GeheugenAfspraak>(() => klok);
  const vragen: string[] = [];
  const haal = async (van: string, tot: string, wie: string[]) => {
    vragen.push(`${van}..${tot}:${wie.join(",")}`);
    return {
      afspraken: wie.map((g) => ({ gebruiker: g, id: `${g}-x`, start: "2026-09-22T09:00:00", duur: "PT1H" })),
      mislukt: [] as string[],
    };
  };
  const een = await geheugen.lees("2026-09-21", "2026-10-11", ["maarten@3bm.co.nl"], haal);
  assert.equal(een.afspraken.length, 1);
  assert.deepEqual(vragen, ["2026-09-21..2026-10-11:maarten@3bm.co.nl"]);

  await geheugen.lees("2026-09-28", "2026-10-04", ["maarten@3bm.co.nl"], haal);
  assert.equal(vragen.length, 1, "volgende week stond al klaar");

  const twee = await geheugen.lees("2026-09-21", "2026-09-27", ["maarten@3bm.co.nl", "nino@3bm.co.nl"], haal);
  assert.equal(vragen[1], "2026-09-21..2026-09-27:nino@3bm.co.nl");
  assert.equal(twee.afspraken.length, 2);

  klok += GEHEUGEN_MS + 1;
  await geheugen.lees("2026-09-21", "2026-09-27", ["maarten@3bm.co.nl"], haal);
  assert.equal(vragen.length, 3, "verlopen week wordt opnieuw gehaald");
});

test("gelijktijdig vragen wacht op de lopende ronde; wissen tussendoor levert toch resultaat", async () => {
  const geheugen = new AgendaGeheugen<GeheugenAfspraak>(() => 0);
  let aantal = 0;
  let laat!: () => void;
  const wacht = new Promise<void>((r) => { laat = r; });
  const haal = async (_v: string, _t: string, wie: string[]) => {
    aantal += 1;
    await wacht;
    return { afspraken: [{ gebruiker: wie[0], id: "1", start: "2026-09-22T09:00:00", duur: "PT1H" }], mislukt: [] as string[] };
  };
  const a = geheugen.lees("2026-09-21", "2026-09-27", ["m"], haal);
  const b = geheugen.lees("2026-09-21", "2026-09-27", ["m"], haal);
  laat();
  assert.equal((await a).afspraken.length, 1);
  assert.equal((await b).afspraken.length, 1);
  assert.equal(aantal, 1);

  let laat2!: () => void;
  const wacht2 = new Promise<void>((r) => { laat2 = r; });
  geheugen.wis();
  const c = geheugen.lees("2026-09-21", "2026-09-27", ["m"], async (_v, _t, wie) => {
    await wacht2;
    return { afspraken: [{ gebruiker: wie[0], id: "2", start: "2026-09-22T09:00:00" }], mislukt: [] };
  });
  await Promise.resolve();
  geheugen.wis();
  laat2();
  assert.deepEqual((await c).afspraken.map((x) => x.id), ["2"]);
});

test("een agenda die niet te lezen was wordt niet als leeg onthouden", async () => {
  const geheugen = new AgendaGeheugen<GeheugenAfspraak>(() => 0);
  let aantal = 0;
  const haal = async () => { aantal += 1; return { afspraken: [], mislukt: ["m"] }; };
  await geheugen.lees("2026-09-21", "2026-09-27", ["m"], haal);
  await geheugen.lees("2026-09-21", "2026-09-27", ["m"], haal);
  assert.equal(aantal, 2);
});
