import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inhoudUitDataTransfer,
  inhoudUitItems,
  leesKlembord,
  type KlembordItem,
} from "./klembord-lezen.ts";

/**
 * Tests voor het lezen van het klembord door de plakknoppen.
 *
 * De knoppen kunnen niet leunen op het plak-event van Ctrl+V: ze vragen het
 * klembord zelf op. Dat kan op drie manieren misgaan — de browser weigert,
 * de browser kan het niet, of er staat niets bruikbaars op — en elk daarvan
 * moet een eigen, begrijpelijke melding opleveren in plaats van stilte.
 */

function item(inhoud: Record<string, Blob | string>): KlembordItem {
  return {
    types: Object.keys(inhoud),
    getType: async (type: string) => {
      const waarde = inhoud[type];
      return typeof waarde === "string" ? new Blob([waarde], { type }) : waarde;
    },
  };
}

function domFout(name: string): DOMException {
  return new DOMException("klembord", name);
}

test("HTML, tekst en een schermafdruk komen alle drie mee", async () => {
  const png = new Blob(["png"], { type: "image/png" });
  const uit = await inhoudUitItems([item({ "text/html": "<b>hoi</b>", "text/plain": "hoi", "image/png": png })]);
  assert.equal(uit.html, "<b>hoi</b>");
  assert.equal(uit.tekst, "hoi");
  assert.equal(uit.afbeeldingen.length, 1);
  assert.equal(uit.afbeeldingen[0].type, "image/png");
  assert.ok(uit.afbeeldingen[0].name.endsWith(".png"), "de upload heeft een bestandsnaam nodig");
});

test("een SVG is geen afbeelding om te plakken: dat is een scriptbaar document", async () => {
  const uit = await inhoudUitItems([item({ "image/svg+xml": "<svg/>" })]);
  assert.deepEqual(uit.afbeeldingen, []);
});

test("de knop leest het klembord via read()", async () => {
  const uit = await leesKlembord({ read: async () => [item({ "text/plain": "regel" })] });
  assert.ok("inhoud" in uit);
  if ("inhoud" in uit) assert.equal(uit.inhoud.tekst, "regel");
});

test("weigert de browser, dan zegt de knop dat — en vraagt het niet nog eens", async () => {
  let readTextGevraagd = false;
  const uit = await leesKlembord({
    read: async () => { throw domFout("NotAllowedError"); },
    readText: async () => { readTextGevraagd = true; return "x"; },
  });
  assert.deepEqual(uit, { fout: "geweigerd" });
  assert.equal(readTextGevraagd, false, "een tweede toestemmingsvraag direct na een nee is irritant");
});

test("zonder read() valt de knop terug op readText()", async () => {
  const uit = await leesKlembord({ readText: async () => "alleen tekst" });
  assert.deepEqual(uit, { inhoud: { html: "", tekst: "alleen tekst", afbeeldingen: [] } });
});

test("kan read() niets met het klembord, dan probeert de knop het nog als tekst", async () => {
  const uit = await leesKlembord({
    read: async () => { throw domFout("DataError"); },
    readText: async () => "toch tekst",
  });
  assert.ok("inhoud" in uit);
  if ("inhoud" in uit) assert.equal(uit.inhoud.tekst, "toch tekst");
});

test("een leeg klembord is een melding, geen stille klik", async () => {
  assert.deepEqual(await leesKlembord({ read: async () => [] }), { fout: "leeg" });
  assert.deepEqual(await leesKlembord({ read: async () => [item({ "text/plain": "  " })] }), { fout: "leeg" });
  assert.deepEqual(await leesKlembord({
    read: async () => { throw domFout("DataError"); },
    readText: async () => "",
  }), { fout: "leeg" });
});

test("zonder klembord-API kan de knop niets, en dat zegt hij", async () => {
  assert.deepEqual(await leesKlembord(undefined), { fout: "niet_ondersteund" });
  assert.deepEqual(await leesKlembord({}), { fout: "niet_ondersteund" });
});

test("Ctrl+V levert dezelfde inhoud op als de knop", () => {
  const png = new File(["png"], "image.png", { type: "image/png" });
  const pdf = new File(["pdf"], "offerte.pdf", { type: "application/pdf" });
  const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
  const bestanden = [png, pdf, svg].map((f) => ({ kind: "file", type: f.type, getAsFile: () => f }));
  const data = {
    getData: (type: string) => ({ "text/html": "<i>x</i>", "text/plain": "x" } as Record<string, string>)[type] ?? "",
    items: [{ kind: "string", type: "text/plain", getAsFile: () => null }, ...bestanden],
  };
  const uit = inhoudUitDataTransfer(data);
  assert.equal(uit.html, "<i>x</i>");
  assert.equal(uit.tekst, "x");
  assert.deepEqual(uit.afbeeldingen, [png]);
});
