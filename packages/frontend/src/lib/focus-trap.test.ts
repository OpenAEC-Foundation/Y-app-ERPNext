/**
 * Tests voor de focus-val van het opstelvenster.
 *
 * Het verplaatsen van de focus zelf gebeurt in de browser; wat hier getest
 * wordt is de *beslissing* — en die heeft precies de vorm waarin dit soort
 * dingen stilletjes fout gaat: de randen (eerste/laatste element), de toetsen
 * die je nooit mag inslikken (Ctrl/Cmd/Alt+Tab), en de voorrang van een kind
 * dat de Tab al heeft afgehandeld.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { focusTrapAction, FOCUSABLE_SELECTOR } from "./focus-trap.ts";

test("focusTrapAction: Tab op het laatste element loopt om naar het eerste", () => {
  assert.equal(focusTrapAction({ key: "Tab" }, { index: 4, count: 5 }), "first");
});

test("focusTrapAction: Shift+Tab op het eerste element loopt om naar het laatste", () => {
  assert.equal(focusTrapAction({ key: "Tab", shiftKey: true }, { index: 0, count: 5 }), "last");
});

test("focusTrapAction: er tussenin doet de browser het zelf", () => {
  assert.equal(focusTrapAction({ key: "Tab" }, { index: 2, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "Tab", shiftKey: true }, { index: 2, count: 5 }), null);
  // De randen aan de "verkeerde" kant zijn ook gewoon doorloop.
  assert.equal(focusTrapAction({ key: "Tab" }, { index: 0, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "Tab", shiftKey: true }, { index: 4, count: 5 }), null);
});

test("focusTrapAction: focus nog nergens in het venster → naar het eerste (of laatste)", () => {
  assert.equal(focusTrapAction({ key: "Tab" }, { index: -1, count: 5 }), "first");
  assert.equal(focusTrapAction({ key: "Tab", shiftKey: true }, { index: -1, count: 5 }), "last");
});

test("focusTrapAction: één enkel element is meteen eerste én laatste", () => {
  assert.equal(focusTrapAction({ key: "Tab" }, { index: 0, count: 1 }), "first");
  assert.equal(focusTrapAction({ key: "Tab", shiftKey: true }, { index: 0, count: 1 }), "last");
});

test("focusTrapAction: een leeg venster vangt niets af", () => {
  assert.equal(focusTrapAction({ key: "Tab" }, { index: -1, count: 0 }), null);
});

test("focusTrapAction: een kind dat de Tab al afhandelde wint", () => {
  // Zo blijft de inspringing in het tekstvak (RichTextEditor) en de gekozen
  // adressuggestie (RecipientField) staan — allebei doen ze preventDefault.
  assert.equal(
    focusTrapAction({ key: "Tab", defaultPrevented: true }, { index: 4, count: 5 }),
    null,
  );
  assert.equal(
    focusTrapAction({ key: "Tab", shiftKey: true, defaultPrevented: true }, { index: 0, count: 5 }),
    null,
  );
});

test("focusTrapAction: Ctrl/Cmd/Alt+Tab zijn van de browser en het systeem", () => {
  assert.equal(focusTrapAction({ key: "Tab", ctrlKey: true }, { index: 4, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "Tab", metaKey: true }, { index: 4, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "Tab", altKey: true }, { index: 4, count: 5 }), null);
  assert.equal(
    focusTrapAction({ key: "Tab", ctrlKey: true, shiftKey: true }, { index: 0, count: 5 }),
    null,
  );
});

test("focusTrapAction: andere toetsen gaan de val niet aan", () => {
  // Escape hoort hier niets te doen: dat is de uitweg, en die wordt in
  // `Webmail.tsx` afgehandeld (venster sluiten, concept blijft bewaard).
  assert.equal(focusTrapAction({ key: "Escape" }, { index: 4, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "Enter" }, { index: 4, count: 5 }), null);
  assert.equal(focusTrapAction({ key: "ArrowDown" }, { index: 0, count: 5 }), null);
});

test("FOCUSABLE_SELECTOR: sluit tabindex=-1 uit en pakt het tekstvak mee", () => {
  // Het `contentEditable`-tekstvak draagt een expliciete tabIndex={0}; zonder
  // die tak in de selector zou de cyclus het tekstvak overslaan.
  assert.match(FOCUSABLE_SELECTOR, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
  assert.match(FOCUSABLE_SELECTOR, /input:not\(\[disabled\]\)/);
});
