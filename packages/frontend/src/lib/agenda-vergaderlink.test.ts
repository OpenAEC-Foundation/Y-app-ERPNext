import { test } from "node:test";
import assert from "node:assert/strict";
import { vindVergaderlink } from "./agenda-vergaderlink.ts";

/**
 * Tests voor het herkennen van een videobellink in de omschrijving van een
 * afspraak. Vooral van belang: een afspraak die uit een extern
 * agendaprogramma komt (zoals een Teams-uitnodiging van een klant) mag
 * dezelfde link tonen als een Jitsi-afspraak uit Y-Next zelf.
 */

test("geen omschrijving: geen link", () => {
  assert.equal(vindVergaderlink(undefined), null);
  assert.equal(vindVergaderlink(""), null);
});

test("gewone tekst zonder link", () => {
  assert.equal(vindVergaderlink("Bespreken hoe het met het project gaat."), null);
});

test("Jitsi-link wordt herkend", () => {
  const omschr = "Bel in via https://meet.jit.si/3bm-2892-overleg als je zover bent.";
  assert.deepEqual(vindVergaderlink(omschr), { url: "https://meet.jit.si/3bm-2892-overleg", soort: "jitsi" });
});

test("Teams-link wordt herkend, tussen de rest van de uitnodigingstekst", () => {
  const omschr = [
    "Microsoft Teams-vergadering",
    "Deelnemen op uw computer, mobiele app of apparaat voor telefonisch vergaderen",
    "Klik hier om deel te nemen aan de vergadering",
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123%40thread.v2/0",
    "Vergader-ID: 123 456 789 012",
  ].join("\n");
  assert.deepEqual(vindVergaderlink(omschr), {
    url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123%40thread.v2/0",
    soort: "teams",
  });
});

test("persoonlijke Teams-link (teams.live.com) wordt ook herkend", () => {
  const omschr = "Kom binnen via https://teams.live.com/meet/12345678901234";
  assert.deepEqual(vindVergaderlink(omschr), { url: "https://teams.live.com/meet/12345678901234", soort: "teams" });
});

test("staan er allebei in, dan wint Jitsi (de eigen link van Y-Next)", () => {
  const omschr = "Oorspronkelijk https://teams.microsoft.com/l/meetup-join/x maar we bellen nu in via https://meet.jit.si/vervanging";
  assert.equal(vindVergaderlink(omschr)?.soort, "jitsi");
});

test("echte Teams-uitnodiging: de deelnamelink, niet de hulp- of optieslinks", () => {
  const omschr = "Microsoft Teams-vergadering\nDeelnemen: https://teams.microsoft.com/meet/336852290416336?p=abc\n"
    + "Heeft u hulp nodig?<https://aka.ms/JoinTeamsMeeting>\n"
    + "Opties <https://teams.microsoft.com/meetingOptions/?organizerId=x>";
  assert.deepEqual(vindVergaderlink(omschr), { url: "https://teams.microsoft.com/meet/336852290416336?p=abc", soort: "teams" });
});

test("link tussen punthaken: de > hoort er niet bij", () => {
  const omschr = "Deelnemen <https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0>";
  assert.equal(vindVergaderlink(omschr)?.url, "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0");
});
