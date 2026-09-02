/**
 * Tests voor de commandolaag van de opmaak-editor.
 *
 * Het uitvoeren zelf (`document.execCommand`) leeft in de browser en valt
 * buiten deze suite; wat hier getest wordt is de *beslissing*: welke stappen
 * horen bij welke knop, welke toetsaanslag betekent wat, en hoe wordt het
 * antwoord van drie verschillende browsers op dezelfde vraag gelijkgetrokken.
 * Dat is precies het deel dat stilletjes fout gaat.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCommand, shortcutFor, normalizeBlockValue, tabCommand, toolbarRovingIndex,
  TOGGLE_STATE_COMMANDS, TEXT_COLORS,
  type EditorCommandName,
} from "./rich-text-commands.ts";

test("resolveCommand: de enkelvoudige opmaakknoppen leveren één stap", () => {
  assert.deepEqual(resolveCommand("bold"), [{ command: "bold" }]);
  assert.deepEqual(resolveCommand("italic"), [{ command: "italic" }]);
  assert.deepEqual(resolveCommand("underline"), [{ command: "underline" }]);
  assert.deepEqual(resolveCommand("strikethrough"), [{ command: "strikeThrough" }]);
});

test("resolveCommand: lijsten en in-/uitspringen", () => {
  assert.deepEqual(resolveCommand("bulletList"), [{ command: "insertUnorderedList" }]);
  assert.deepEqual(resolveCommand("numberedList"), [{ command: "insertOrderedList" }]);
  assert.deepEqual(resolveCommand("indent"), [{ command: "indent" }]);
  assert.deepEqual(resolveCommand("outdent"), [{ command: "outdent" }]);
});

test("resolveCommand: blokniveaus gaan via formatBlock met tag-haken", () => {
  assert.deepEqual(resolveCommand("paragraph"), [{ command: "formatBlock", value: "<p>" }]);
  assert.deepEqual(resolveCommand("heading1"), [{ command: "formatBlock", value: "<h1>" }]);
  assert.deepEqual(resolveCommand("heading2"), [{ command: "formatBlock", value: "<h2>" }]);
  assert.deepEqual(resolveCommand("quote"), [{ command: "formatBlock", value: "<blockquote>" }]);
});

test("resolveCommand: opmaak wissen haalt óók de link en het blokniveau weg", () => {
  // `removeFormat` alleen laat een kop, een citaat en een link staan — precies
  // wat iemand die geplakte tekst 'kaal' wil maken juist kwijt wil.
  assert.deepEqual(resolveCommand("clearFormatting"), [
    { command: "removeFormat" },
    { command: "unlink" },
    { command: "formatBlock", value: "<p>" },
  ]);
});

test("resolveCommand: kleur zonder gekozen kleur doet niets", () => {
  assert.deepEqual(resolveCommand("color"), []);
  assert.deepEqual(resolveCommand("color", "#b91c1c"), [{ command: "foreColor", value: "#b91c1c" }]);
});

test("shortcutFor: de drie klassieke opmaaktoetsen, met Ctrl én met Cmd", () => {
  assert.equal(shortcutFor({ key: "b", ctrlKey: true }), "bold");
  assert.equal(shortcutFor({ key: "i", metaKey: true }), "italic");
  assert.equal(shortcutFor({ key: "U", ctrlKey: true }), "underline");
});

test("shortcutFor: Ctrl+K opent het link-dialoogvenster", () => {
  assert.equal(shortcutFor({ key: "k", ctrlKey: true }), "link");
});

test("shortcutFor: Ctrl+Shift+V is plakken zonder opmaak", () => {
  assert.equal(shortcutFor({ key: "v", ctrlKey: true, shiftKey: true }), "plainPaste");
});

test("shortcutFor: zonder Ctrl/Cmd gebeurt er niets", () => {
  assert.equal(shortcutFor({ key: "b" }), null);
  assert.equal(shortcutFor({ key: "k" }), null);
});

test("shortcutFor: met Alt erbij blijven we van de toetsaanslag af", () => {
  // Alt+Ctrl-combinaties horen bij het besturingssysteem en bij schermlezers.
  assert.equal(shortcutFor({ key: "b", ctrlKey: true, altKey: true }), null);
});

test("shortcutFor: onbekende toetsen leveren niets op", () => {
  assert.equal(shortcutFor({ key: "s", ctrlKey: true }), null);
  assert.equal(shortcutFor({ key: "Enter", ctrlKey: true }), null);
  assert.equal(shortcutFor({ key: "", ctrlKey: true }), null);
});

test("normalizeBlockValue: browsers zijn het oneens, wij niet", () => {
  assert.equal(normalizeBlockValue("h1"), "heading1");
  assert.equal(normalizeBlockValue("H1"), "heading1");
  assert.equal(normalizeBlockValue("<h2>"), "heading2");
  assert.equal(normalizeBlockValue("h3"), "heading2");
  assert.equal(normalizeBlockValue("blockquote"), "quote");
  assert.equal(normalizeBlockValue("p"), "paragraph");
  assert.equal(normalizeBlockValue("div"), "paragraph");
  assert.equal(normalizeBlockValue(""), "paragraph");
});

test("TOGGLE_STATE_COMMANDS verwijst alleen naar bestaande commando's", () => {
  for (const [name, command] of Object.entries(TOGGLE_STATE_COMMANDS)) {
    const steps = resolveCommand(name as EditorCommandName);
    assert.equal(steps.length, 1, `${name} hoort één stap te hebben`);
    assert.equal(steps[0].command, command, `${name} moet dezelfde execCommand-naam gebruiken`);
  }
});

test("TEXT_COLORS: een klein, leesbaar palet met geldige hexwaarden", () => {
  assert.ok(TEXT_COLORS.length >= 5 && TEXT_COLORS.length <= 8);
  for (const color of TEXT_COLORS) {
    assert.match(color.value, /^#[0-9a-f]{6}$/, `${color.value} hoort een hexkleur te zijn`);
    assert.match(color.labelKey, /^webmail\.color_/);
  }
  const unique = new Set(TEXT_COLORS.map((c) => c.value));
  assert.equal(unique.size, TEXT_COLORS.length, "geen dubbele kleuren");
});

/* ─── Tab: inspringen in plaats van wegspringen ─── */

/** Een gewone alinea: niets in een lijst, niets ingesprongen. */
const PLAIN = { inList: false, indented: false };

test("tabCommand: Tab springt in, waar de cursor ook staat", () => {
  assert.equal(tabCommand({ key: "Tab" }, PLAIN), "indent");
  assert.equal(tabCommand({ key: "Tab" }, { inList: true, indented: false }), "indent");
  assert.equal(tabCommand({ key: "Tab" }, { inList: false, indented: true }), "indent");
});

test("tabCommand: Shift+Tab springt uit in een lijst en in een ingesprongen blok", () => {
  assert.equal(tabCommand({ key: "Tab", shiftKey: true }, { inList: true, indented: false }), "outdent");
  assert.equal(tabCommand({ key: "Tab", shiftKey: true }, { inList: false, indented: true }), "outdent");
});

test("tabCommand: Shift+Tab in een gewone alinea laat de focus gaan", () => {
  // Er valt niets uit te springen. Zou hij hier toch `outdent` teruggeven, dan
  // vangt het tekstvak élke Tab af en is het met het toetsenbord een
  // doodlopende straat — de knoppen onderin zouden onbereikbaar worden.
  assert.equal(tabCommand({ key: "Tab", shiftKey: true }, PLAIN), null);
});

test("tabCommand: dezelfde commando's als de werkbalkknoppen", () => {
  // De belofte uit de kop: geen aparte tak voor lijst/geen lijst, en geen `	`
  // of rij `&nbsp;` — Tab loopt door dezelfde `execCommand`-stap als de
  // in-/uitspringknop. In een lijst zet de browser het item een niveau dieper,
  // erbuiten wikkelt hij de alinea in een blok met een linkermarge.
  assert.deepEqual(resolveCommand(tabCommand({ key: "Tab" }, PLAIN)!), [{ command: "indent" }]);
  assert.deepEqual(
    resolveCommand(tabCommand({ key: "Tab", shiftKey: true }, { inList: true, indented: false })!),
    [{ command: "outdent" }],
  );
});

test("tabCommand: Ctrl/Cmd/Alt+Tab blijven van de browser en het systeem", () => {
  assert.equal(tabCommand({ key: "Tab", ctrlKey: true }, PLAIN), null);
  assert.equal(tabCommand({ key: "Tab", metaKey: true }, PLAIN), null);
  assert.equal(tabCommand({ key: "Tab", altKey: true }, PLAIN), null);
  assert.equal(tabCommand({ key: "Tab", ctrlKey: true, shiftKey: true }, { inList: true, indented: true }), null);
});

test("tabCommand: andere toetsen doen hier niets", () => {
  assert.equal(tabCommand({ key: "Escape" }, PLAIN), null);
  assert.equal(tabCommand({ key: "Enter" }, PLAIN), null);
  assert.equal(tabCommand({ key: "t" }, PLAIN), null);
  // Kleine letter "tab" is geen Tab — `KeyboardEvent.key` is hoofdlettergevoelig.
  assert.equal(tabCommand({ key: "tab" }, PLAIN), null);
});

test("shortcutFor: Tab is geen opmaak-sneltoets (die gaat via tabCommand)", () => {
  assert.equal(shortcutFor({ key: "Tab" }), null);
  assert.equal(shortcutFor({ key: "Tab", ctrlKey: true }), null);
});

/* ─── Werkbalk: één tab-stop, pijltjes ertussen ─── */

test("toolbarRovingIndex: de pijltjes lopen rond", () => {
  assert.equal(toolbarRovingIndex("ArrowRight", 0, 5), 1);
  assert.equal(toolbarRovingIndex("ArrowRight", 4, 5), 0);
  assert.equal(toolbarRovingIndex("ArrowLeft", 4, 5), 3);
  assert.equal(toolbarRovingIndex("ArrowLeft", 0, 5), 4);
});

test("toolbarRovingIndex: Home en End springen naar de randen", () => {
  assert.equal(toolbarRovingIndex("Home", 3, 5), 0);
  assert.equal(toolbarRovingIndex("End", 1, 5), 4);
});

test("toolbarRovingIndex: Tab hoort hier niet — die verlaat de werkbalk", () => {
  assert.equal(toolbarRovingIndex("Tab", 2, 5), null);
  assert.equal(toolbarRovingIndex("ArrowDown", 2, 5), null);
  assert.equal(toolbarRovingIndex("Enter", 2, 5), null);
});

test("toolbarRovingIndex: een lege werkbalk levert niets op", () => {
  assert.equal(toolbarRovingIndex("ArrowRight", 0, 0), null);
});
