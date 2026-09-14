import { test } from "node:test";
import assert from "node:assert/strict";
import { maakAntwoordMail, VOORVOEGSEL_NL } from "./uitnodiging-antwoordmail.ts";
import { ontvouw } from "./ical.ts";

/**
 * Tests voor het antwoord dat naar de organisator gaat.
 *
 * Waarom dit bestaat: gemeten op de mailserver gaat er bij het beantwoorden in
 * Y-Next niets naar de organisator. Antwoorden in Outlook leverde wél een
 * "Geaccepteerd: …"-bericht op; die van deze app ontbraken. De mailserver kan
 * het hier niet voor ons doen — de CalDAV scheduling-outbox bestaat op deze
 * server niet (404) — dus stuurt de app het antwoord zelf.
 */

const ICS = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", "BEGIN:VEVENT",
  "UID:u-1@3bm.co.nl", "SUMMARY:Archipel Oudewater",
  "ORGANIZER;CN=Lance Post:mailto:lance@3bm.co.nl",
  "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:maarten@3bm.co.nl",
  "END:VEVENT", "END:VCALENDAR",
].join("\r\n") + "\r\n";

const BASIS = {
  organisator: "lance@3bm.co.nl",
  ik: "maarten@3bm.co.nl",
  titel: "Archipel Oudewater",
  ics: ICS,
  voorvoegsel: VOORVOEGSEL_NL,
};

test("het antwoord gaat naar de organisator, met zijn onderwerp ervoor", () => {
  const mail = maakAntwoordMail({ ...BASIS, stand: "accepted" });
  assert.equal(mail?.aan, "lance@3bm.co.nl");
  assert.equal(mail?.onderwerp, "Geaccepteerd: Archipel Oudewater");
});

test("elk antwoord heeft zijn eigen woord", () => {
  assert.equal(maakAntwoordMail({ ...BASIS, stand: "declined" })?.onderwerp,
    "Afgewezen: Archipel Oudewater");
  assert.equal(maakAntwoordMail({ ...BASIS, stand: "tentative" })?.onderwerp,
    "Voorlopig: Archipel Oudewater");
});

test("het meegestuurde bestand is een antwoord, geen nieuwe uitnodiging", () => {
  const mail = maakAntwoordMail({ ...BASIS, stand: "accepted" });
  const regels = ontvouw(mail!.ics);
  assert.ok(regels.includes("METHOD:REPLY"), "METHOD moet REPLY zijn");
  const mijn = regels.find((r) => r.startsWith("ATTENDEE") && r.endsWith("mailto:maarten@3bm.co.nl"));
  assert.match(mijn || "", /PARTSTAT=ACCEPTED/);
  // Zonder RSVP: de vraag is beantwoord.
  assert.equal(/RSVP=TRUE/.test(mijn || ""), false);
});

test("zonder organisator valt er niemand te antwoorden", () => {
  assert.equal(maakAntwoordMail({ ...BASIS, organisator: undefined, stand: "accepted" }), null);
  assert.equal(maakAntwoordMail({ ...BASIS, organisator: "  ", stand: "accepted" }), null);
});

test("aan jezelf antwoorden hoeft niet", () => {
  // Je eigen afspraak: dan is er geen ander die op bericht zit te wachten.
  assert.equal(maakAntwoordMail({ ...BASIS, organisator: "Maarten@3BM.co.nl", stand: "accepted" }), null);
});

test("zonder bestand gaat er niets de deur uit", () => {
  // Een antwoord zonder .ics is voor de agenda van de organisator waardeloos.
  assert.equal(maakAntwoordMail({ ...BASIS, ics: "", stand: "accepted" }), null);
});

test("zonder titel blijft het onderwerp bruikbaar", () => {
  const mail = maakAntwoordMail({ ...BASIS, titel: "", stand: "accepted" });
  assert.equal(mail?.onderwerp, "Geaccepteerd: afspraak");
});
