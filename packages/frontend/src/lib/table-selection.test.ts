import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptySelection,
  applyRowClick,
  toggleAllVisible,
  selectAll,
  pruneSelection,
  allVisibleSelected,
  someVisibleSelected,
  type SelectionState,
} from "./table-selection.ts";

const ROWS = ["T1", "T2", "T3", "T4", "T5"];

function ids(state: SelectionState): string[] {
  return [...state.selected].sort();
}

test("gewone klik toggelt en laat de rest van de selectie staan", () => {
  let s = emptySelection();
  s = applyRowClick(s, "T2", ROWS);
  s = applyRowClick(s, "T4", ROWS);
  assert.deepEqual(ids(s), ["T2", "T4"]);

  // Nogmaals klikken zet hem uit — en raakt T4 niet.
  s = applyRowClick(s, "T2", ROWS);
  assert.deepEqual(ids(s), ["T4"]);
});

test("Ctrl/Cmd-klik toggelt net als een gewone klik", () => {
  let s = applyRowClick(emptySelection(), "T1", ROWS, { ctrl: true });
  s = applyRowClick(s, "T3", ROWS, { meta: true });
  assert.deepEqual(ids(s), ["T1", "T3"]);
});

test("Shift-klik selecteert het bereik vanaf het anchor, in beide richtingen", () => {
  let s = applyRowClick(emptySelection(), "T2", ROWS);
  s = applyRowClick(s, "T4", ROWS, { shift: true });
  assert.deepEqual(ids(s), ["T2", "T3", "T4"]);

  // Omhoog vanaf hetzelfde anchor (T2) — het anchor is niet meegeschoven.
  assert.equal(s.anchor, "T2");
  s = applyRowClick(s, "T1", ROWS, { shift: true });
  assert.deepEqual(ids(s), ["T1", "T2", "T3", "T4"]);
});

test("Shift-klik is optellend: een eerdere losse selectie blijft staan", () => {
  let s = applyRowClick(emptySelection(), "T5", ROWS);
  s = applyRowClick(s, "T1", ROWS);
  s = applyRowClick(s, "T3", ROWS, { shift: true });
  assert.deepEqual(ids(s), ["T1", "T2", "T3", "T5"]);
});

test("Shift-klik zonder anchor valt terug op een gewone toggle", () => {
  const s = applyRowClick(emptySelection(), "T3", ROWS, { shift: true });
  assert.deepEqual(ids(s), ["T3"]);
  assert.equal(s.anchor, "T3");
});

test("Shift-klik met een anchor dat uit het filter is gevallen toggelt alleen de aangeklikte rij", () => {
  let s = applyRowClick(emptySelection(), "T2", ROWS);
  // T2 valt weg uit de zichtbare lijst (filter gewijzigd).
  const narrowed = ["T4", "T5"];
  s = applyRowClick(s, "T5", narrowed, { shift: true });
  assert.deepEqual(ids(s), ["T2", "T5"]);
  assert.equal(s.anchor, "T5");
});

test("het bereik volgt de zichtbare volgorde, niet de oorspronkelijke", () => {
  const resorted = ["T5", "T4", "T3", "T2", "T1"];
  let s = applyRowClick(emptySelection(), "T5", resorted);
  s = applyRowClick(s, "T3", resorted, { shift: true });
  assert.deepEqual(ids(s), ["T3", "T4", "T5"]);
});

test("kopcheckbox zet het zichtbare venster aan en daarna weer uit", () => {
  const visible = ["T1", "T2", "T3"];
  let s = toggleAllVisible(emptySelection(), visible);
  assert.deepEqual(ids(s), ["T1", "T2", "T3"]);
  assert.equal(allVisibleSelected(s, visible), true);

  s = toggleAllVisible(s, visible);
  assert.deepEqual(ids(s), []);
});

test("kopcheckbox raakt selectie buiten het zichtbare venster niet aan", () => {
  // Alles-in-het-filter geselecteerd, maar er zijn er maar 3 zichtbaar.
  let s = selectAll(ROWS);
  const visible = ["T1", "T2", "T3"];
  s = toggleAllVisible(s, visible);
  // Alleen het zichtbare blok gaat uit; T4/T5 blijven geselecteerd.
  assert.deepEqual(ids(s), ["T4", "T5"]);
});

test("kopcheckbox vult een deels geselecteerd venster aan in plaats van het te wissen", () => {
  let s = applyRowClick(emptySelection(), "T2", ROWS);
  s = toggleAllVisible(s, ["T1", "T2", "T3"]);
  assert.deepEqual(ids(s), ["T1", "T2", "T3"]);
});

test("someVisibleSelected is alleen waar bij een gedeeltelijke selectie", () => {
  const visible = ["T1", "T2", "T3"];
  const partial = applyRowClick(emptySelection(), "T2", ROWS);
  assert.equal(someVisibleSelected(partial, visible), true);
  assert.equal(someVisibleSelected(toggleAllVisible(emptySelection(), visible), visible), false);
  assert.equal(someVisibleSelected(emptySelection(), visible), false);
});

test("selecteer alle N die aan het filter voldoen pakt ook de niet-getoonde rijen", () => {
  const s = selectAll(ROWS);
  assert.equal(s.selected.size, 5);
  // ... en het venster toont er maar twee.
  assert.equal(allVisibleSelected(s, ["T1", "T2"]), true);
});

test("pruneSelection gooit verdwenen taken eruit en wist een verdwenen anchor", () => {
  let s = selectAll(ROWS);
  s = applyRowClick(s, "T5", ROWS); // anchor = T5, T5 gaat uit
  s = applyRowClick(s, "T5", ROWS); // anchor = T5, T5 weer aan
  const pruned = pruneSelection(s, ["T1", "T2"]);
  assert.deepEqual(ids(pruned), ["T1", "T2"]);
  assert.equal(pruned.anchor, null);
});

test("pruneSelection laat een ongewijzigde selectie letterlijk met rust", () => {
  const s = selectAll(["T1", "T2"]);
  assert.equal(pruneSelection(s, ROWS), s);
});
