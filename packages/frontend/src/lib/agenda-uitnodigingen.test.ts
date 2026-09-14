import { test } from "node:test";
import assert from "node:assert/strict";
import {
  kiesUitnodigingen, wachtOpAntwoord, type MailUitnodiging,
} from "./agenda-uitnodigingen.ts";
import type { GelezenAfspraak } from "./ical.ts";

/**
 * Tests voor de open uitnodigingen in de agenda.
 *
 * Twee dingen gaan hier stil fout, en allebei kosten ze een afspraak. Een
 * afgezegde vergadering die blijft staan houdt tijd bezet die vrij is; een
 * uitnodiging die dubbel verschijnt — één keer uit de mail, één keer uit de
 * agenda zelf — laat je denken dat er twee dingen tegelijk zijn. Aan een
 * scherm vol blokken zie je geen van beide.
 */

function afspraak(over: Partial<GelezenAfspraak> = {}): GelezenAfspraak {
  return {
    uid: "u1",
    titel: "Overleg",
    start: "2026-09-15T10:00:00",
    eind: "2026-09-15T11:00:00",
    organisator: "lance@3bm.co.nl",
    genodigden: [{ email: "maarten@3bm.co.nl", status: "needs-action" }],
    volgnummer: 0,
    methode: "REQUEST",
    ...over,
  };
}

function mail(over: Partial<GelezenAfspraak> = {}, communication = "c1"): MailUitnodiging {
  return { communication, afspraak: afspraak(over) };
}

const IK = "maarten@3bm.co.nl";

test("een uitnodiging zonder antwoord wacht op jou", () => {
  const lance = { email: "lance@3bm.co.nl", organisator: true };
  assert.equal(wachtOpAntwoord([lance, { email: IK, status: "needs-action" }], IK), true);
  // Outlook laat PARTSTAT vaak weg; dat betekent hetzelfde.
  assert.equal(wachtOpAntwoord([lance, { email: IK }], IK), true);
});

test("beantwoord is beantwoord", () => {
  for (const status of ["accepted", "declined", "tentative"]) {
    assert.equal(wachtOpAntwoord([{ email: IK, status }], IK), false, status);
  }
});

test("een afspraak die je zelf belegt is geen uitnodiging aan jezelf", () => {
  assert.equal(wachtOpAntwoord([{ email: IK, status: "needs-action" }], IK, IK), false);
  assert.equal(
    wachtOpAntwoord([{ email: IK, status: "needs-action", organisator: true }], IK), false);
});

test("staat je eigen adres er niet bij, dan valt er niets te beantwoorden", () => {
  assert.equal(wachtOpAntwoord([{ email: "martin@3bm.co.nl" }], IK), false);
  assert.equal(wachtOpAntwoord([], IK), false);
  assert.equal(wachtOpAntwoord(undefined, IK), false);
});

test("hoofdletters en spaties in adressen doen er niet toe", () => {
  assert.equal(wachtOpAntwoord(
    [{ email: " Maarten@3BM.co.nl " }], "maarten@3bm.co.nl", "lance@3bm.co.nl"), true);
});

test("zonder eigen adres wordt er niets gestippeld", () => {
  // Anders staat de agenda even vol met uitnodigingen van collega's terwijl
  // het eigen adres nog binnenkomt.
  assert.equal(wachtOpAntwoord([{ email: IK }], ""), false);
});

test("een open uitnodiging uit de mail komt erbij", () => {
  const uit = kiesUitnodigingen([mail()], [], IK);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].communication, "c1");
});

test("een afzegging haalt de uitnodiging weg, ook als hij er eerder in staat", () => {
  // De uitnodigingsmail staat hier vóór de afzegging; wie ze op volgorde
  // afloopt houdt de afspraak over.
  const uit = kiesUitnodigingen([
    mail({}, "uitnodiging"),
    mail({ methode: "CANCEL" }, "afzegging"),
  ], [], IK);
  assert.deepEqual(uit, []);
});

test("een antwoord van iemand anders is geen uitnodiging", () => {
  assert.deepEqual(kiesUitnodigingen([mail({ methode: "REPLY" })], [], IK), []);
});

test("wat de agenda al tekent komt er niet gestippeld naast", () => {
  assert.deepEqual(kiesUitnodigingen([mail({ uid: "u1" })], ["u1"], IK), []);
});

test("van twee versies wint het hoogste volgnummer", () => {
  const uit = kiesUitnodigingen([
    mail({ volgnummer: 2, start: "2026-09-16T09:00:00" }, "nieuw"),
    mail({ volgnummer: 0, start: "2026-09-15T10:00:00" }, "oud"),
  ], [], IK);
  assert.equal(uit.length, 1);
  assert.equal(uit[0].communication, "nieuw");
  assert.equal(uit[0].afspraak.start, "2026-09-16T09:00:00");
});

test("zonder tijdstip of UID valt er niets te tekenen", () => {
  assert.deepEqual(kiesUitnodigingen([mail({ start: undefined })], [], IK), []);
  assert.deepEqual(kiesUitnodigingen([mail({ uid: "" })], [], IK), []);
});

test("uitnodigingen van collega's blijven buiten je eigen agenda", () => {
  // Wie de postbus van een collega mag inzien, krijgt diens uitnodigingen ook
  // te zien. Die horen niet in jouw agenda.
  const uit = kiesUitnodigingen(
    [mail({ genodigden: [{ email: "martin@3bm.co.nl", status: "needs-action" }] })], [], IK);
  assert.deepEqual(uit, []);
});

test("de lijst staat op tijd, oplopend", () => {
  const uit = kiesUitnodigingen([
    mail({ uid: "b", start: "2026-09-20T09:00:00" }),
    mail({ uid: "a", start: "2026-09-15T09:00:00" }),
  ], [], IK);
  assert.deepEqual(uit.map((u) => u.afspraak.uid), ["a", "b"]);
});

test("lege invoer geeft een lege lijst, geen fout", () => {
  assert.deepEqual(kiesUitnodigingen([], [], IK), []);
});

/* ── Je eigen afspraak is geen uitnodiging aan jezelf ── */

test("in je eentje in de deelnemerslijst is geen uitnodiging", () => {
  /*
   * Gemeten op de mailserver: een afspraak die je zelf aanmaakt zonder
   * genodigden komt terug met precies één deelnemer — jij, zonder rol en
   * zonder deelnamestand. Zonder deze regel leest de app dat als "je bent
   * uitgenodigd en moet nog antwoorden": je eigen afspraak komt gestippeld in
   * de agenda en de knop Accepteren geeft een foutmelding, want in het
   * .ics-bestand staat geen ATTENDEE om te beantwoorden.
   */
  assert.equal(wachtOpAntwoord([{ email: IK, status: "needs-action" }], IK), false);
  assert.equal(wachtOpAntwoord([{ email: IK }], IK), false);
});

test("met een organisator erbij is het wél een uitnodiging", () => {
  assert.equal(wachtOpAntwoord(
    [{ email: "lance@3bm.co.nl", organisator: true }, { email: IK }], IK), true);
  assert.equal(wachtOpAntwoord([{ email: IK }], IK, "lance@3bm.co.nl"), true);
});

test("een afspraak met collega's erbij blijft een uitnodiging", () => {
  // Twee genodigden zonder dat iemand als organisator gemarkeerd staat: dan is
  // er iemand anders in het spel en hoort de vraag gewoon gesteld te worden.
  assert.equal(wachtOpAntwoord(
    [{ email: IK }, { email: "mattias@3bm.co.nl" }], IK), true);
});

test("een uitnodiging uit de mail met alleen jou erin blijft staan", () => {
  // Uit een .ics met een organisator: die staat los van de deelnemerslijst.
  const uit = kiesUitnodigingen([mail({ genodigden: [{ email: IK, status: "needs-action" }] })], [], IK);
  assert.equal(uit.length, 1);
});
