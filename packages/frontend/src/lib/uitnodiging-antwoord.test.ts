import { test } from "node:test";
import assert from "node:assert/strict";
import { beantwoordUitnodiging, handeltMailAf } from "./uitnodiging-antwoord.ts";

/**
 * Tests voor de twee wegen waarlangs een antwoord op een uitnodiging kan gaan.
 *
 * De fout die hier gevangen wordt: het Server Script meldt "deze uitnodiging
 * staat niet in je agenda" als een *fout*, niet als een uitslag. Wie alleen op
 * de uitslag let, breekt daar af — precies bij het geval waarvoor de tweede weg
 * bestaat, namelijk een uitnodiging van buiten die nog nergens staat. Aan het
 * scherm zie je alleen "mislukt".
 */

function ok() { return Promise.resolve({ gelukt: true }); }
function nietGelukt(reden: string) { return () => Promise.resolve({ gelukt: false, reden }); }
function gooit(bericht: string) { return () => Promise.reject(new Error(bericht)); }
function neergelegd() { return Promise.resolve({ geschreven: ["maarten@3bm.co.nl"], mislukt: [] }); }

test("staat de afspraak al in je agenda, dan is bijwerken genoeg", async () => {
  let tweede = 0;
  const uit = await beantwoordUitnodiging({
    bijwerken: ok,
    neerleggen: () => { tweede++; return neergelegd(); },
  });
  assert.deepEqual(uit, { gelukt: true, fout: "" });
  assert.equal(tweede, 0, "de tweede weg hoort niet gelopen te worden");
});

test("een fout uit de eerste weg breekt het antwoord niet af", async () => {
  // Dit is de echte fout: frappe.throw komt als exception binnen.
  const uit = await beantwoordUitnodiging({
    bijwerken: gooit("agenda_schrijven: Deze uitnodiging staat niet in je agenda."),
    neerleggen: neergelegd,
  });
  assert.deepEqual(uit, { gelukt: true, fout: "" });
});

test("een nette 'niet gelukt' uit de eerste weg gaat ook door naar de tweede", async () => {
  const uit = await beantwoordUitnodiging({
    bijwerken: nietGelukt("staat er niet"),
    neerleggen: neergelegd,
  });
  assert.equal(uit.gelukt, true);
});

test("lukken beide niet, dan hoor je waaróm het neerleggen misging", async () => {
  const uit = await beantwoordUitnodiging({
    bijwerken: gooit("staat niet in je agenda"),
    neerleggen: () => Promise.resolve({ geschreven: [], mislukt: [{ reden: "401 Unauthorized" }] }),
  });
  assert.equal(uit.gelukt, false);
  assert.match(uit.fout, /401 Unauthorized/);
});

test("zegt de tweede weg niets, dan blijft de reden van de eerste staan", async () => {
  const uit = await beantwoordUitnodiging({
    bijwerken: nietGelukt("staat er niet"),
    neerleggen: () => Promise.resolve({ geschreven: [], mislukt: [] }),
  });
  assert.deepEqual(uit, { gelukt: false, fout: "staat er niet" });
});

test("gooit ook de tweede weg, dan is dát de melding", async () => {
  const uit = await beantwoordUitnodiging({
    bijwerken: gooit("eerste"),
    neerleggen: gooit("tweede ging ook mis"),
  });
  assert.equal(uit.gelukt, false);
  assert.match(uit.fout, /tweede ging ook mis/);
});

test("zonder tweede weg blijft de fout van de eerste over", async () => {
  // Geen .ics beschikbaar: dan valt er niets neer te leggen.
  const uit = await beantwoordUitnodiging({ bijwerken: gooit("geen agenda") });
  assert.equal(uit.gelukt, false);
  assert.match(uit.fout, /geen agenda/);
});

/* ── De mail erbij ── */

test("wie antwoordt, is klaar met de mail", () => {
  // Na een ja of een nee valt er aan dat bericht niets meer te doen; het hoort
  // niet in je postvak te blijven staan als iets dat nog moet.
  assert.equal(handeltMailAf("accepted"), true);
  assert.equal(handeltMailAf("declined"), true);
});

test("voorlopig is nog geen antwoord", () => {
  // "Misschien" betekent dat je er nog op terug moet komen. Dan is de mail
  // juist níet afgehandeld.
  assert.equal(handeltMailAf("tentative"), false);
  assert.equal(handeltMailAf("needs-action"), false);
});
