import test from "node:test";
import assert from "node:assert/strict";
import { tijdlijnLabel, tijdlijnTop, totVolgendeMinuut } from "./agenda-tijdlijn.ts";

function bijna(werkelijk: number | null, verwacht: number) {
  assert.ok(werkelijk !== null && Math.abs(werkelijk - verwacht) < 1e-9, `${werkelijk} is geen ${verwacht}`);
}

test("tijdlijnTop: minuten sinds middernacht naar pixels in het rooster", () => {
  bijna(tijdlijnTop(new Date(2026, 8, 15, 11, 47), 48), (707 / 60) * 48);
  bijna(tijdlijnTop(new Date(2026, 8, 15, 0, 0), 56), 0);
  bijna(tijdlijnTop(new Date(2026, 8, 15, 23, 59), 48), (1439 / 60) * 48);
});

test("tijdlijnTop: seconden verschuiven de lijn niet", () => {
  assert.equal(
    tijdlijnTop(new Date(2026, 8, 15, 11, 47, 59), 48),
    tijdlijnTop(new Date(2026, 8, 15, 11, 47, 0), 48),
  );
});

test("tijdlijnTop: buiten het getoonde deel van de dag geen lijn", () => {
  assert.equal(tijdlijnTop(new Date(2026, 8, 15, 6, 30), 48, 7, 14), null);
  assert.equal(tijdlijnTop(new Date(2026, 8, 15, 21, 30), 48, 7, 14), null);
  bijna(tijdlijnTop(new Date(2026, 8, 15, 8, 0), 48, 7, 14), 48);
});

test("tijdlijnLabel: uren en minuten met een voorloopnul", () => {
  assert.equal(tijdlijnLabel(new Date(2026, 8, 15, 9, 5)), "09:05");
  assert.equal(tijdlijnLabel(new Date(2026, 8, 15, 23, 47)), "23:47");
});

test("totVolgendeMinuut: tot de volgende hele minuut", () => {
  assert.equal(totVolgendeMinuut(new Date(2026, 8, 15, 11, 47, 30, 250)), 29_750);
  assert.equal(totVolgendeMinuut(new Date(2026, 8, 15, 11, 47, 0, 0)), 60_000);
});
