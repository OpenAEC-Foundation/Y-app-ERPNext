import test from "node:test";
import assert from "node:assert/strict";
import {
  isEditableTarget, resolveMailShortcut,
  type MailShortcutContext, type MailShortcutEvent,
} from "./mail-shortcuts.ts";

/** Doelen aanwezig, niets in de weg, buiten de Prullenbak. */
const READY: MailShortcutContext = {
  editing: false,
  dialogOpen: false,
  composing: false,
  hasTargets: true,
  inTrash: false,
};

function key(k: string, extra: Partial<MailShortcutEvent> = {}): MailShortcutEvent {
  return { key: k, ...extra };
}

/* ─── De gewone gevallen ─── */

test("Delete gooit weg", () => {
  assert.equal(resolveMailShortcut(key("Delete"), READY), "trash");
});

test("Backspace doet hetzelfde als Delete", () => {
  assert.equal(resolveMailShortcut(key("Backspace"), READY), "trash");
});

test("Shift+Delete in de Prullenbak verwijdert definitief", () => {
  assert.equal(
    resolveMailShortcut(key("Delete", { shiftKey: true }), { ...READY, inTrash: true }),
    "delete-forever",
  );
});

test("Shift+Delete buiten de Prullenbak gooit gewoon weg", () => {
  assert.equal(resolveMailShortcut(key("Delete", { shiftKey: true }), READY), "trash");
});

test("U wisselt gelezen, E wisselt afgehandeld, Enter opent", () => {
  assert.equal(resolveMailShortcut(key("u"), READY), "toggle-read");
  assert.equal(resolveMailShortcut(key("U"), READY), "toggle-read");
  assert.equal(resolveMailShortcut(key("e"), READY), "toggle-handled");
  assert.equal(resolveMailShortcut(key("E"), READY), "toggle-handled");
  assert.equal(resolveMailShortcut(key("Enter"), READY), "open");
});

test("Escape sluit ook zonder doelen", () => {
  assert.equal(resolveMailShortcut(key("Escape"), { ...READY, hasTargets: false }), "dismiss");
});

/* ─── De gevallen waarin niets mag vuren ─── */

test("in een invoerveld vuurt geen enkele sneltoets", () => {
  const ctx = { ...READY, editing: true };
  for (const k of ["Delete", "Backspace", "u", "e", "Enter", "Escape"]) {
    assert.equal(resolveMailShortcut(key(k), ctx), null, k);
  }
});

test("met een open dialoog vuurt niets — die heeft zijn eigen Escape en Enter", () => {
  const ctx = { ...READY, dialogOpen: true };
  assert.equal(resolveMailShortcut(key("Delete"), ctx), null);
  assert.equal(resolveMailShortcut(key("Escape"), ctx), null);
  assert.equal(resolveMailShortcut(key("Enter"), ctx), null);
});

test("in het opstelvenster vuurt niets — elke letter is daar tekst", () => {
  const ctx = { ...READY, composing: true };
  assert.equal(resolveMailShortcut(key("e"), ctx), null);
  assert.equal(resolveMailShortcut(key("Delete"), ctx), null);
});

test("zonder doelen doen alleen Escape en de pijltjes iets", () => {
  const ctx = { ...READY, hasTargets: false };
  assert.equal(resolveMailShortcut(key("Delete"), ctx), null);
  assert.equal(resolveMailShortcut(key("u"), ctx), null);
  assert.equal(resolveMailShortcut(key("Enter"), ctx), null);
  assert.equal(resolveMailShortcut(key("Escape"), ctx), "dismiss");
  // De pijltjes doen het juist wél: met een lijst waar nog niets openstaat
  // wil je met één toets de eerste mail openen.
  assert.equal(resolveMailShortcut(key("ArrowDown"), ctx), "next");
  assert.equal(resolveMailShortcut(key("ArrowUp"), ctx), "prev");
});

test("de pijltjes lopen door de lijst, ook ingedrukt gehouden", () => {
  assert.equal(resolveMailShortcut(key("ArrowDown"), READY), "next");
  assert.equal(resolveMailShortcut(key("ArrowUp"), READY), "prev");
  // Vasthouden hoort te herhalen — anders tik je je hele inbox door.
  assert.equal(resolveMailShortcut(key("ArrowDown", { repeat: true }), READY), "next");
  // Shift+pijl is tekstselectie en blijft van de browser.
  assert.equal(resolveMailShortcut(key("ArrowDown", { shiftKey: true }), READY), null);
  // In een invoerveld of dialoog blijven ze uit, net als de rest.
  assert.equal(resolveMailShortcut(key("ArrowDown"), { ...READY, editing: true }), null);
  assert.equal(resolveMailShortcut(key("ArrowUp"), { ...READY, dialogOpen: true }), null);
  assert.equal(resolveMailShortcut(key("ArrowUp"), { ...READY, composing: true }), null);
});

test("Ctrl/Cmd/Alt blijven van de browser en van Ctrl+K", () => {
  assert.equal(resolveMailShortcut(key("Delete", { ctrlKey: true }), READY), null);
  assert.equal(resolveMailShortcut(key("e", { metaKey: true }), READY), null);
  assert.equal(resolveMailShortcut(key("u", { altKey: true }), READY), null);
});

test("een ingedrukt gehouden toets vuurt maar één keer", () => {
  assert.equal(resolveMailShortcut(key("Delete", { repeat: true }), READY), null);
});

test("Shift+letter is een hoofdletter, geen sneltoets", () => {
  assert.equal(resolveMailShortcut(key("U", { shiftKey: true }), READY), null);
  assert.equal(resolveMailShortcut(key("E", { shiftKey: true }), READY), null);
  assert.equal(resolveMailShortcut(key("Enter", { shiftKey: true }), READY), null);
});

test("onbekende toetsen lopen gewoon door", () => {
  assert.equal(resolveMailShortcut(key("a"), READY), null);
  assert.equal(resolveMailShortcut(key("F5"), READY), null);
});

/* ─── Waar de focus staat ─── */

test("isEditableTarget herkent invoer, textarea, select en contenteditable", () => {
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableTarget({ tagName: "SELECT" }), true);
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(
    isEditableTarget({ tagName: "DIV", getAttribute: (n) => (n === "contenteditable" ? "true" : null) }),
    true,
  );
});

test("isEditableTarget laat gewone elementen en niets met rust", () => {
  assert.equal(isEditableTarget({ tagName: "DIV" }), false);
  assert.equal(isEditableTarget({ tagName: "BUTTON" }), false);
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget(undefined), false);
  assert.equal(
    isEditableTarget({ tagName: "DIV", getAttribute: (n) => (n === "contenteditable" ? "false" : null) }),
    false,
  );
});
