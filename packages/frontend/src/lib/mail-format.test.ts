import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatSender, formatAddress, formatDate, getDateGroup,
  formatFullDate, getInitials, getAvatarColor, textBodyToHtml,
} from "./mail-format.ts";

test("formatSender: name, fallback to local-part, empty", () => {
  assert.deepEqual(formatSender([{ name: "Piet", address: "piet@3bm.co.nl" }]), { name: "Piet", email: "piet@3bm.co.nl" });
  assert.deepEqual(formatSender([{ name: "", address: "info@klant.nl" }]), { name: "info", email: "info@klant.nl" });
  assert.deepEqual(formatSender([]), { name: "", email: "" });
});

test("formatAddress: name-or-address joined with comma", () => {
  assert.equal(formatAddress([{ name: "Piet", address: "p@x.nl" }, { name: "", address: "c@d.nl" }]), "Piet, c@d.nl");
});

test("getInitials: two initials, uppercased", () => {
  assert.equal(getInitials("Piet Mol"), "PM");
  assert.equal(getInitials("jan"), "J");
  assert.equal(getInitials(""), "");
});

test("getAvatarColor: deterministic + returns a known class", () => {
  const a = getAvatarColor("Piet Mol");
  assert.equal(a, getAvatarColor("Piet Mol"));
  assert.match(a, /^bg-[a-z]+-500$/);
});

test("textBodyToHtml: escapes html and converts newlines", () => {
  assert.equal(textBodyToHtml("a<b>&c\r\nd"), "a&lt;b&gt;&amp;c<br>d");
  assert.equal(textBodyToHtml(""), "");
});

test("formatDate: today -> time, yesterday -> 'Gisteren', older -> day+month, null -> ''", () => {
  const now = new Date(2026, 6, 2, 12, 0, 0);       // Thu 2 Jul 2026, local
  assert.match(formatDate(new Date(2026, 6, 2, 9, 30, 0).toISOString(), now), /\d{2}:\d{2}/);
  assert.equal(formatDate(new Date(2026, 6, 1, 9, 0, 0).toISOString(), now), "Gisteren");
  assert.match(formatDate(new Date(2026, 4, 23, 9, 0, 0).toISOString(), now), /mei/);
  assert.equal(formatDate(null, now), "");
});

test("getDateGroup: today/yesterday/older/null", () => {
  const now = new Date(2026, 6, 2, 12, 0, 0);
  assert.equal(getDateGroup(new Date(2026, 6, 2, 8, 0, 0).toISOString(), now), "Vandaag");
  assert.equal(getDateGroup(new Date(2026, 6, 1, 8, 0, 0).toISOString(), now), "Gisteren");
  assert.match(getDateGroup(new Date(2026, 4, 23, 8, 0, 0).toISOString(), now), /2026/); // older -> "maand jaar"
  assert.equal(getDateGroup(null, now), "Overig");
});

test("formatFullDate: null -> '', otherwise a long NL string", () => {
  assert.equal(formatFullDate(null), "");
  assert.match(formatFullDate(new Date(2026, 6, 2, 9, 0, 0).toISOString()), /2026/);
});
