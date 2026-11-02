import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NEXT_STATUS, deadlineStand, ideeAlsTekst, parseLabels, serializeLabels, sortIdeeen,
  volgordeNaVerplaatsing, volgordeVoorNieuw, type Idee,
} from "./brainstorm-model.ts";

const rij = (name: string, status: Idee["status"], volgorde: number, modified = "2026-11-01 10:00:00") =>
  ({ name, status, volgorde, modified });

test("status loopt met één klik rond: Open, Bezig, Klaar, Open", () => {
  assert.equal(NEXT_STATUS.Open, "Bezig");
  assert.equal(NEXT_STATUS.Bezig, "Klaar");
  assert.equal(NEXT_STATUS.Klaar, "Open");
});

test("labels: JSON-lijst, met de hand getypte komma's en lege waarden", () => {
  assert.deepEqual(parseLabels('["PR","YouTube"]'), ["PR", "YouTube"]);
  assert.deepEqual(parseLabels("PR, YouTube ,"), ["PR", "YouTube"]);
  assert.deepEqual(parseLabels(null), []);
  assert.equal(serializeLabels(["PR", " PR ", "", "Video"]), '["PR","Video"]');
});

test("sorteren: open op volgorde, Klaar onderaan met de laatst afgeronde eerst", () => {
  const sorted = sortIdeeen([
    rij("1", "Klaar", 0, "2026-11-01 09:00:00"),
    rij("2", "Bezig", 3),
    rij("3", "Open", 1),
    rij("4", "Klaar", 9, "2026-11-02 09:00:00"),
  ]);
  assert.deepEqual(sorted.map((r) => r.name), ["3", "2", "4", "1"]);
});

test("verplaatsen geeft een waarde tussen de nieuwe buren", () => {
  const lijst = [{ volgorde: 1 }, { volgorde: 2 }, { volgorde: 3 }, { volgorde: 4 }];
  assert.equal(volgordeNaVerplaatsing(lijst, 3, 0), 0);    // onderste naar boven
  assert.equal(volgordeNaVerplaatsing(lijst, 0, 3), 5);    // bovenste naar onder
  assert.equal(volgordeNaVerplaatsing(lijst, 0, 1), 2.5);  // één plek omlaag: tussen 2 en 3
  assert.equal(volgordeNaVerplaatsing(lijst, 3, 1), 1.5);  // naar de tweede plek: tussen 1 en 2
  assert.equal(volgordeNaVerplaatsing([{ volgorde: 7 }], 0, 0), 1);
});

test("een nieuw idee komt onder de open ideeën, niet onder de afgeronde", () => {
  assert.equal(volgordeVoorNieuw([rij("1", "Open", 2), rij("2", "Klaar", 50)]), 3);
  assert.equal(volgordeVoorNieuw([]), 1);
});

test("deadline: verlopen, binnen een week, later; een afgerond idee heeft geen stand", () => {
  assert.equal(deadlineStand("2026-11-01", "Open", "2026-11-02"), "verlopen");
  assert.equal(deadlineStand("2026-11-09", "Bezig", "2026-11-02"), "binnenkort");
  assert.equal(deadlineStand("2026-11-20", "Open", "2026-11-02"), "later");
  assert.equal(deadlineStand("2026-11-01", "Klaar", "2026-11-02"), null);
  assert.equal(deadlineStand(null, "Open", "2026-11-02"), null);
});

test("als tekst: code, labels en checklist staan erin", () => {
  const idee = {
    name: "12", titel: "PR-video", status: "Bezig", labels: '["PR","Video"]', koppeling: "OpenAEC-Foundation/open-planner-studio",
    beschrijving: "Korte promo", datum: null, deadline: "2026-11-20", resultaat: null, volgorde: 1, owner: "", modified: "",
  } as Idee;
  const tekst = ideeAlsTekst(idee, [{ tekst: "Logo", gedaan: 1 }, { tekst: "Voice-over", gedaan: 0 }]);
  assert.match(tekst, /^Brainstorm #12: PR-video/);
  assert.match(tekst, /Labels: PR, Video/);
  assert.match(tekst, /- \[x\] Logo\n- \[ \] Voice-over/);
});
