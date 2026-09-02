import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AGE_MS,
  MAX_DRAFTS,
  deleteDraft,
  draftForMessage,
  draftKeyFor,
  draftMessageNames,
  hasDraftContent,
  loadDrafts,
  newDraftKey,
  pruneDrafts,
  saveDraft,
  standaloneDrafts,
  type MailDraftMap,
  type StoredMailDraft,
} from "./mail-drafts.ts";

/**
 * `node --test` draait zonder DOM; een minimale localStorage volstaat, want de
 * module raakt alleen getItem/setItem/removeItem. Zo blijft de conceptopslag
 * testbaar zonder jsdom (zie CLAUDE.md: geen vitest/jsdom in deze suite).
 */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null { return this.map.get(key) ?? null; }
  setItem(key: string, value: string): void { this.map.set(key, value); }
  removeItem(key: string): void { this.map.delete(key); }
  clear(): void { this.map.clear(); }
  get size(): number { return this.map.size; }
  raw(key: string): string | null { return this.map.get(key) ?? null; }
  poison(key: string, value: string): void { this.map.set(key, value); }
}

const store = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = store;

const INSTANCE = "y-next";
const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);

function draft(over: Partial<StoredMailDraft> & { key: string }): Omit<StoredMailDraft, "updatedAt"> {
  return {
    mode: "reply",
    to: "klant@example.com",
    cc: "",
    bcc: "",
    subject: "Re: Offerte",
    body: "Ik kijk er morgen naar.",
    includeSignature: true,
    quoteHtml: "<p>origineel</p>",
    quoteLabel: "Op 1 mei schreef Klant",
    ...over,
  };
}

beforeEach(() => { store.clear(); });

/* ─── Drempel ─── */

test("hasDraftContent: een antwoord telt pas mee zodra er tekst staat", () => {
  const base = { mode: "reply" as const, to: "a@b.nl", cc: "", bcc: "", subject: "Re: X", body: "" };
  assert.equal(hasDraftContent(base), false, "voorgevulde Aan/Onderwerp zijn niet van de gebruiker");
  assert.equal(hasDraftContent({ ...base, body: "   " }), false);
  assert.equal(hasDraftContent({ ...base, body: "hoi" }), true);
});

test("hasDraftContent: bij een nieuw bericht telt ook een ingevuld adres of onderwerp", () => {
  const base = { mode: "new" as const, to: "", cc: "", bcc: "", subject: "", body: "" };
  assert.equal(hasDraftContent(base), false);
  assert.equal(hasDraftContent({ ...base, to: "a@b.nl" }), true);
  assert.equal(hasDraftContent({ ...base, subject: "Vraag" }), true);
  assert.equal(hasDraftContent({ ...base, bcc: "a@b.nl" }), true);
});

/* ─── Sleutels ─── */

test("draftKeyFor: antwoorden delen een sleutel, doorsturen krijgt een eigen", () => {
  assert.equal(draftKeyFor("reply", "ag6q4pllvv"), "msg:ag6q4pllvv");
  assert.equal(draftKeyFor("replyAll", "ag6q4pllvv"), "msg:ag6q4pllvv");
  assert.equal(draftKeyFor("forward", "ag6q4pllvv"), "fwd:ag6q4pllvv");
});

test("draftKeyFor/newDraftKey: nieuwe berichten krijgen elk een eigen sleutel", () => {
  const a = draftKeyFor("new");
  const b = draftKeyFor("new");
  assert.match(a, /^new:/);
  assert.notEqual(a, b);
  assert.notEqual(newDraftKey(), newDraftKey());
});

/* ─── Bewaren en herstellen ─── */

test("saveDraft + loadDrafts: bewaart en herstelt de volledige inhoud", () => {
  saveDraft(INSTANCE, { ...draft({ key: "msg:m1", messageName: "m1", inReplyTo: "m1" }) }, NOW);
  const map = loadDrafts(INSTANCE, NOW);
  const back = map["msg:m1"];
  assert.ok(back);
  assert.equal(back!.body, "Ik kijk er morgen naar.");
  assert.equal(back!.subject, "Re: Offerte");
  assert.equal(back!.quoteHtml, "<p>origineel</p>");
  assert.equal(back!.quoteLabel, "Op 1 mei schreef Klant");
  assert.equal(back!.inReplyTo, "m1");
  assert.equal(back!.messageName, "m1");
  assert.equal(back!.includeSignature, true);
  assert.equal(back!.updatedAt, NOW);
});

test("saveDraft: een tweede opslag overschrijft hetzelfde concept, geen duplicaat", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1", body: "Bijgewerkt." }), NOW + 5000);
  const map = loadDrafts(INSTANCE, NOW + 5000);
  assert.equal(Object.keys(map).length, 1);
  assert.equal(map["msg:m1"]!.body, "Bijgewerkt.");
  assert.equal(map["msg:m1"]!.updatedAt, NOW + 5000);
});

test("saveDraft: leeggetypt concept verdwijnt weer", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  assert.equal(Object.keys(loadDrafts(INSTANCE, NOW)).length, 1);
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1", body: "  " }), NOW + 1000);
  assert.deepEqual(loadDrafts(INSTANCE, NOW + 1000), {});
});

test("saveDraft: instances delen geen concepten", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  assert.deepEqual(loadDrafts("andere-instance", NOW), {});
});

test("loadDrafts: sleutel draagt geen pref_-prefix (niet synced naar andere apparaten)", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  assert.ok(store.raw("mail_drafts_y-next"), "verwachte sleutel ontbreekt");
  assert.equal(store.raw("pref_y-next_mail_drafts"), null);
});

test("deleteDraft: verwijdert precies één concept", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  saveDraft(INSTANCE, draft({ key: "msg:m2", messageName: "m2" }), NOW);
  deleteDraft(INSTANCE, "msg:m1", NOW);
  const map = loadDrafts(INSTANCE, NOW);
  assert.deepEqual(Object.keys(map), ["msg:m2"]);
});

/* ─── Opruimen en cap ─── */

test("pruneDrafts: concepten ouder dan 30 dagen vallen weg", () => {
  const map: MailDraftMap = {
    vers: { ...draft({ key: "vers" }), key: "vers", updatedAt: NOW - MAX_AGE_MS + 1000 },
    oud: { ...draft({ key: "oud" }), key: "oud", updatedAt: NOW - MAX_AGE_MS - 1000 },
  };
  assert.deepEqual(Object.keys(pruneDrafts(map, NOW)), ["vers"]);
});

test("pruneDrafts: kapt af op MAX_DRAFTS en houdt de nieuwste", () => {
  const map: MailDraftMap = {};
  for (let i = 0; i < MAX_DRAFTS + 12; i += 1) {
    map[`k${i}`] = { ...draft({ key: `k${i}` }), key: `k${i}`, updatedAt: NOW - i * 1000 };
  }
  const pruned = pruneDrafts(map, NOW);
  assert.equal(Object.keys(pruned).length, MAX_DRAFTS);
  assert.ok(pruned["k0"], "nieuwste blijft");
  assert.ok(!pruned[`k${MAX_DRAFTS + 5}`], "oudste is weggevallen");
});

test("saveDraft: opruimen gebeurt ook bij het schrijven, niet alleen bij het lezen", () => {
  for (let i = 0; i < MAX_DRAFTS + 5; i += 1) {
    saveDraft(INSTANCE, draft({ key: `msg:m${i}`, messageName: `m${i}` }), NOW + i);
  }
  const stored = JSON.parse(store.raw("mail_drafts_y-next") ?? "{}") as MailDraftMap;
  assert.equal(Object.keys(stored).length, MAX_DRAFTS);
});

test("loadDrafts: een te oud concept is ook via load niet meer zichtbaar", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  assert.deepEqual(loadDrafts(INSTANCE, NOW + MAX_AGE_MS + 1), {});
});

/* ─── Robuustheid ─── */

test("loadDrafts: onleesbare opslag geeft een lege map in plaats van een fout", () => {
  store.poison("mail_drafts_y-next", "{niet: json");
  assert.deepEqual(loadDrafts(INSTANCE, NOW), {});
  store.poison("mail_drafts_y-next", "[1,2,3]");
  assert.deepEqual(loadDrafts(INSTANCE, NOW), {});
});

test("loadDrafts: één corrupte rij neemt de goede concepten niet mee", () => {
  store.poison("mail_drafts_y-next", JSON.stringify({
    "msg:goed": { ...draft({ key: "msg:goed", messageName: "goed" }), updatedAt: NOW },
    "msg:stuk": { mode: "reply" },
    "msg:null": null,
  }));
  assert.deepEqual(Object.keys(loadDrafts(INSTANCE, NOW)), ["msg:goed"]);
});

/* ─── Wat de lijst ervan ziet ─── */

test("draftMessageNames: alleen berichten met een concept, zonder de losse nieuwe", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  saveDraft(INSTANCE, draft({ key: "fwd:m2", mode: "forward", messageName: "m2" }), NOW);
  saveDraft(INSTANCE, draft({ key: "new:abc", mode: "new", subject: "Nieuw" }), NOW);
  const names = draftMessageNames(loadDrafts(INSTANCE, NOW));
  assert.deepEqual([...names].sort(), ["m1", "m2"]);
});

test("standaloneDrafts: alleen losse nieuwe berichten, nieuwste eerst", () => {
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1" }), NOW);
  saveDraft(INSTANCE, draft({ key: "new:a", mode: "new", subject: "Eerste" }), NOW);
  saveDraft(INSTANCE, draft({ key: "new:b", mode: "new", subject: "Tweede" }), NOW + 1000);
  const loose = standaloneDrafts(loadDrafts(INSTANCE, NOW + 1000));
  assert.deepEqual(loose.map((d) => d.subject), ["Tweede", "Eerste"]);
});

test("draftForMessage: antwoord gaat voor op doorsturen", () => {
  saveDraft(INSTANCE, draft({ key: "fwd:m1", mode: "forward", messageName: "m1", body: "door" }), NOW);
  assert.equal(draftForMessage(loadDrafts(INSTANCE, NOW), "m1")!.body, "door");
  saveDraft(INSTANCE, draft({ key: "msg:m1", messageName: "m1", body: "antwoord" }), NOW);
  assert.equal(draftForMessage(loadDrafts(INSTANCE, NOW), "m1")!.body, "antwoord");
  assert.equal(draftForMessage(loadDrafts(INSTANCE, NOW), "onbekend"), undefined);
});
