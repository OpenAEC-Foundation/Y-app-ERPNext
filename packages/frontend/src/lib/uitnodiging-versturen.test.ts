import test from "node:test";
import assert from "node:assert/strict";
import { klok, langeDatum, maakUitnodigingMail } from "./uitnodiging-versturen.ts";

const WOORDEN = {
  onderwerp: "Uitnodiging",
  wanneer: "Wanneer",
  waar: "Waar",
  wie: "Wie",
  heleDag: "hele dag",
  uitleg: "Accepteren of afwijzen kan met de knoppen in je mailprogramma.",
};

const BASIS = {
  titel: "Planningsoverleg",
  start: "2026-09-28T10:00:00",
  eind: "2026-09-28T11:00:00",
  organisator: "maarten@3bm.co.nl",
  genodigden: ["anna@zinkweg.nl", "Nino@3BM.co.nl"],
  woorden: WOORDEN,
};

test("datum en tijd in gewone woorden", () => {
  assert.equal(langeDatum("2026-09-28T10:00:00"), "maandag 28 september 2026");
  assert.equal(klok("2026-09-28T10:00:00"), "10:00");
  assert.equal(klok("2026-09-28"), "");
});

test("de uitnodiging noemt wanneer, waar en wie", () => {
  const mail = maakUitnodigingMail({ ...BASIS, locatie: "Burgemeester de Raadtsingel 31" })!;
  assert.equal(mail.onderwerp, "Uitnodiging: Planningsoverleg");
  assert.equal(mail.aan, "anna@zinkweg.nl, nino@3bm.co.nl");
  assert.match(mail.html, /maandag 28 september 2026, 10:00 – 11:00/);
  assert.match(mail.html, /Burgemeester de Raadtsingel 31/);
  assert.match(mail.html, /maarten@3bm\.co\.nl, anna@zinkweg\.nl/);
  assert.match(mail.html, /knoppen in je mailprogramma/);
});

test("de organisator krijgt zijn eigen uitnodiging niet", () => {
  const mail = maakUitnodigingMail({ ...BASIS, genodigden: ["maarten@3bm.co.nl", "anna@zinkweg.nl"] })!;
  assert.equal(mail.aan, "anna@zinkweg.nl");
  assert.equal(maakUitnodigingMail({ ...BASIS, genodigden: ["maarten@3bm.co.nl"] }), null);
  assert.equal(maakUitnodigingMail({ ...BASIS, genodigden: [] }), null);
});

test("een afspraak van een hele dag noemt geen kloktijd", () => {
  const mail = maakUitnodigingMail({ ...BASIS, heleDag: true })!;
  assert.match(mail.html, /maandag 28 september 2026, hele dag/);
  assert.ok(!mail.html.includes("10:00"));
});

test("tekens die HTML zouden breken gaan er veilig in", () => {
  const mail = maakUitnodigingMail({ ...BASIS, titel: "Overleg <script>", omschrijving: "a & b" })!;
  assert.match(mail.html, /Overleg &lt;script&gt;/);
  assert.match(mail.html, /a &amp; b/);
  assert.ok(!mail.html.includes("<script>"));
});
