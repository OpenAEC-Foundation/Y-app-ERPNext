import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractAddresses,
  groupThreads,
  hasReplyMarker,
  missingParentNames,
  neighbourInOrder,
  normalizeSubject,
  participantsOf,
  visibleThreadOrder,
  type ThreadableMessage,
} from "./mail-threads.ts";

/**
 * De gevallen hieronder komen uit de échte mailbox van de doelinstance
 * (onderwerpen, afzenders, cc-regels en `in_reply_to`-waarden zijn
 * overgenomen), aangevuld met de valkuilen die een naïeve
 * onderwerp-groepering laat vallen.
 */

function msg(over: Partial<ThreadableMessage> & { name: string }): ThreadableMessage {
  return {
    subject: "",
    sender: "",
    recipients: "",
    date: "2026-01-01 00:00:00",
    seen: true,
    ...over,
  };
}

/* ─── Onderwerp-normalisatie ─── */

test("normalizeSubject: strips Re/Fwd/Antw/AW/Doorgestuurd, ongeacht hoofdletters", () => {
  const base = "offerte mpg-berekening & bestekschrijven — sal-qtn-2026-00013";
  for (const prefix of ["Re: ", "RE: ", "Fwd: ", "FW: ", "Fw: ", "AW: ", "Antw: ", "Doorgestuurd: "]) {
    assert.equal(
      normalizeSubject(`${prefix}Offerte MPG-berekening & Bestekschrijven — SAL-QTN-2026-00013`),
      base,
      `prefix ${prefix}`,
    );
  }
});

test("normalizeSubject: gestapelde prefixen en Re[2] vallen allemaal weg", () => {
  assert.equal(normalizeSubject("Fw: Re: Offerte X"), "offerte x");
  assert.equal(normalizeSubject("RE: AW: Fwd: Offerte X"), "offerte x");
  assert.equal(normalizeSubject("Re[2]: Offerte X"), "offerte x");
  assert.equal(normalizeSubject("Re:CAD 尺寸标注问题"), "cad 尺寸标注问题");
});

test("normalizeSubject: gevouwen header-witruimte wordt één spatie", () => {
  assert.equal(
    normalizeSubject("Download link(s) van Open Energy Studio (GitHub) lijken niet te\r\n werken"),
    "download link(s) van open energy studio (github) lijken niet te werken",
  );
});

test("normalizeSubject: een onderwerp dát met 'Reactie' begint blijft heel", () => {
  // Alleen een prefix mét dubbele punt telt — anders zou "Review offerte"
  // stilletjes "view offerte" worden.
  assert.equal(normalizeSubject("Reactie op de offerte"), "reactie op de offerte");
  assert.equal(normalizeSubject("Review offerte"), "review offerte");
  assert.equal(hasReplyMarker("Review offerte"), false);
  assert.equal(hasReplyMarker("Re: Review offerte"), true);
});

/* ─── Adressen ─── */

test("extractAddresses: haalt adressen uit display-name-notatie en gevouwen cc", () => {
  assert.deepEqual(
    extractAddresses("Maarten <maarten@impertio.nl>, Mark Wieringa <mark.wieringa@gaf.eu>, Danny\r\n Werensteijn <danny.werensteijn@gaf.eu>"),
    ["maarten@impertio.nl", "mark.wieringa@gaf.eu", "danny.werensteijn@gaf.eu"],
  );
  assert.deepEqual(extractAddresses("\"albert@impertio.nl\" <albert@impertio.nl>"), ["albert@impertio.nl"]);
  assert.deepEqual(extractAddresses(""), []);
  assert.deepEqual(extractAddresses(undefined), []);
});

test("participantsOf: afzender + geadresseerden + cc, kleingeschreven", () => {
  const people = participantsOf(msg({
    name: "x",
    sender: "Martjan.DenHoed@gaf.eu",
    recipients: "\"albert@impertio.nl\" <albert@impertio.nl>",
    cc: "Maarten <maarten@impertio.nl>",
  }));
  assert.deepEqual([...people].sort(), ["albert@impertio.nl", "maarten@impertio.nl", "martjan.denhoed@gaf.eu"]);
});

/* ─── De echte SAL-QTN-thread: 6 mails, één gesprek ─── */

const QTN = "Offerte MPG-berekening & Bestekschrijven — SAL-QTN-2026-00013";
const GAF = "martjan.denhoed@gaf.eu";
const ALB = "albert@impertio.nl";
const CC = "Maarten <maarten@impertio.nl>, Mark Wieringa <mark.wieringa@gaf.eu>";

/** Nieuwste eerst, precies zoals de lijstquery ze aanlevert. */
const qtnThread: ThreadableMessage[] = [
  msg({ name: "ag6q4pllvv", subject: `Re: ${QTN}`, sender: GAF, recipients: "Maarten <maarten@impertio.nl>, Maarten Vroegindeweij <maarten@3bm.co.nl>", cc: CC, date: "2026-06-11 12:25:25", inReplyTo: "ag68fp1lod" }),
  msg({ name: "ag6gpovjr4", subject: `Fw: Re: ${QTN}`, sender: "maarten@3bm.co.nl", recipients: "Maarten <maarten@impertio.nl>", date: "2026-05-26 08:48:10" }),
  msg({ name: "ag6dca9ub8", subject: `Re: ${QTN}`, sender: ALB, recipients: `Martjan den Hoed <${GAF}>`, cc: CC, date: "2026-05-26 08:41:13", inReplyTo: "ag68fp1lod" }),
  msg({ name: "ag68fp1lod", subject: `Re: ${QTN}`, sender: GAF, recipients: `"${ALB}" <${ALB}>`, cc: CC, date: "2026-05-22 13:39:39", inReplyTo: "ag679r79qp" }),
  msg({ name: "ag679r79qp", subject: `Re: ${QTN}`, sender: ALB, recipients: `Martjan den Hoed <${GAF}>`, cc: CC, date: "2026-05-13 09:12:46", inReplyTo: "ag5fe0p6oc" }),
  msg({ name: "ag5fe0p6oc", subject: `Re: ${QTN}`, sender: GAF, recipients: `"${ALB}" <${ALB}>`, cc: CC, date: "2026-05-12 13:29:01", seen: false }),
];

test("groupThreads: de zes SAL-QTN-mails vormen één gesprek", () => {
  const threads = groupThreads(qtnThread);
  assert.equal(threads.length, 1);
  const [thread] = threads;
  assert.equal(thread!.count, 6);
  assert.equal(thread!.head.name, "ag6q4pllvv", "hoofdregel is het nieuwste bericht");
  assert.equal(thread!.id, "ag6q4pllvv");
  assert.deepEqual(
    thread!.messages.map((m) => m.name),
    ["ag5fe0p6oc", "ag679r79qp", "ag68fp1lod", "ag6dca9ub8", "ag6gpovjr4", "ag6q4pllvv"],
    "leden staan chronologisch oplopend",
  );
  assert.deepEqual([...thread!.names].sort(), [...thread!.messages.map((m) => m.name)].sort());
});

test("groupThreads: de doorgestuurde mail zonder in_reply_to hoort er toch bij", () => {
  // Alleen de ketting zou "Fw: Re: …" (geen in_reply_to, andere afzender) als
  // losse regel laten staan. Onderwerp + gedeelde deelnemer (maarten@impertio.nl)
  // + de Fw-markering trekken hem alsnog in het gesprek.
  const chainOnly = qtnThread.filter((m) => m.name === "ag6gpovjr4" || m.name === "ag6q4pllvv");
  const threads = groupThreads(chainOnly);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.count, 2);
});

test("groupThreads: één ongelezen lid maakt het gesprek ongelezen", () => {
  const threads = groupThreads(qtnThread);
  assert.equal(threads[0]!.unread, true, "ag5fe0p6oc staat op ongelezen");
  const allSeen = groupThreads(qtnThread.map((m) => ({ ...m, seen: true })));
  assert.equal(allSeen[0]!.unread, false);
});

/* ─── Negatieve gevallen ─── */

test("groupThreads: generiek onderwerp zonder gedeelde deelnemer blijft gescheiden", () => {
  const rows = [
    msg({ name: "a", subject: "Vraag", sender: "piet@klant-a.nl", recipients: "info@ons.nl", date: "2026-03-02 10:00:00" }),
    msg({ name: "b", subject: "Re: Vraag", sender: "jan@klant-b.nl", recipients: "verkoop@ons.nl", date: "2026-03-01 10:00:00" }),
  ];
  const threads = groupThreads(rows);
  assert.equal(threads.length, 2, "zelfde onderwerp, geen overlappende deelnemers → twee gesprekken");
});

test("groupThreads: twee losse mails met exact hetzelfde onderwerp blijven gescheiden", () => {
  // Echte rijen: dezelfde factuur twee keer doorgestuurd, zelfde afzender,
  // zelfde onderwerp, géén Re:/Fwd: en géén in_reply_to. Dat zijn herhalingen,
  // geen gesprek — ze onder één kop schuiven zou er één verstoppen.
  const rows = [
    msg({ name: "2m8fnofht9", subject: "Factuur Castellum Rosarum B.V. 26CRB-00007", sender: "maarten@3bm.co.nl", recipients: "info@open-aec.com", date: "2026-08-03 23:20:38" }),
    msg({ name: "8butimlndp", subject: "Factuur Castellum Rosarum B.V. 26CRB-00007", sender: "maarten@3bm.co.nl", recipients: "info@open-aec.com", date: "2026-08-03 22:12:29" }),
  ];
  assert.equal(groupThreads(rows).length, 2);
});

test("groupThreads: bijna-gelijke onderwerpen zijn niet hetzelfde gesprek", () => {
  const rows = [
    msg({ name: "a", subject: "RE: Salarisbetaling 2026-08", sender: "salaris@confianza.nl", recipients: "info@open-aec.com", date: "2026-08-31 22:12:50" }),
    msg({ name: "b", subject: "RE: Salarisbetaling 2026-08 (2e poging)", sender: "salaris@confianza.nl", recipients: "info@open-aec.com", date: "2026-08-31 20:47:52" }),
  ];
  assert.equal(groupThreads(rows).length, 2);
});

test("groupThreads: losse facturen met opeenvolgende nummers blijven losse regels", () => {
  const rows = ["263-05192", "263-05191", "263-05186", "263-05179", "263-05177"].map((nr, i) =>
    msg({
      name: `c${i}`,
      subject: `Factuur 3BM Bouwtechniek V.O.F. ${nr}`,
      sender: "maarten@3bm.co.nl",
      recipients: "info@open-aec.com",
      date: `2026-08-03 21:5${i}:00`,
    }));
  assert.equal(groupThreads(rows).length, 5);
});

test("groupThreads: leeg onderwerp klontert nooit samen", () => {
  const rows = [
    msg({ name: "a", subject: "", sender: "x@y.nl", recipients: "info@ons.nl", date: "2026-03-02 10:00:00" }),
    msg({ name: "b", subject: "   ", sender: "x@y.nl", recipients: "info@ons.nl", date: "2026-03-01 10:00:00" }),
  ];
  assert.equal(groupThreads(rows).length, 2);
});

test("groupThreads: lege invoer geeft lege uitvoer", () => {
  assert.deepEqual(groupThreads([]), []);
});

/* ─── Volgorde en stabiliteit ─── */

test("groupThreads: gesprekken houden de plek van hun nieuwste zichtbare bericht", () => {
  const rows = [
    msg({ name: "nieuw", subject: "Kennismaking", sender: "piebe@x.nl", recipients: "info@ons.nl", date: "2026-08-20 23:03:21" }),
    ...qtnThread,
    msg({ name: "oud", subject: "Tester", sender: "jr@y.es", recipients: "info@ons.nl", date: "2026-01-02 08:41:00" }),
  ];
  const threads = groupThreads(rows);
  assert.deepEqual(threads.map((th) => th.id), ["nieuw", "ag6q4pllvv", "oud"]);
  assert.deepEqual(threads.map((th) => th.count), [1, 6, 1]);
});

test("groupThreads: dubbele namen in de invoer leveren geen dubbel lid op", () => {
  const one = qtnThread[0]!;
  const threads = groupThreads([one, { ...one }]);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.count, 1);
});

test("groupThreads: een cyclus in in_reply_to loopt niet vast", () => {
  const rows = [
    msg({ name: "a", subject: "Lus", sender: "x@y.nl", date: "2026-03-02 10:00:00", inReplyTo: "b" }),
    msg({ name: "b", subject: "Lus", sender: "x@y.nl", date: "2026-03-01 10:00:00", inReplyTo: "a" }),
  ];
  const threads = groupThreads(rows);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.count, 2);
});

/* ─── extras: de apart opgehaalde verzonden mail ─── */

test("groupThreads: een verzonden antwoord uit extras komt in het gesprek, niet als eigen regel", () => {
  const inbox = [
    msg({ name: "in1", subject: "openPDFstudio", sender: "d.kelfkens@kelfkensbv.nl", recipients: "maarten@open-aec.com", date: "2026-08-28 09:17:21" }),
  ];
  const sent = [
    msg({ name: "sent1", subject: "Re: openPDFstudio", sender: "maarten@open-aec.com", recipients: "d.kelfkens@kelfkensbv.nl", date: "2026-09-02 09:38:32", inReplyTo: "in1" }),
  ];
  const threads = groupThreads(inbox, sent);
  assert.equal(threads.length, 1, "de verzonden mail vormt geen eigen regel");
  assert.equal(threads[0]!.head.name, "in1", "hoofdregel blijft het bericht uit de zichtbare map");
  assert.deepEqual(threads[0]!.messages.map((m) => m.name), ["in1", "sent1"]);
  assert.equal(threads[0]!.count, 2);
});

test("groupThreads: extras zonder enkel primair lid vallen helemaal weg", () => {
  const inbox = [msg({ name: "in1", subject: "Iets anders", sender: "a@b.nl", recipients: "c@d.nl", date: "2026-08-28 09:17:21" })];
  const sent = [
    msg({ name: "sent1", subject: "Re: Onbekend gesprek", sender: "c@d.nl", recipients: "z@z.nl", date: "2026-08-29 09:17:21" }),
  ];
  const threads = groupThreads(inbox, sent);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.count, 1);
});

test("groupThreads: extras verschuiven de volgorde van de lijst niet", () => {
  const inbox = [
    msg({ name: "in2", subject: "Nieuwer", sender: "a@b.nl", recipients: "c@d.nl", date: "2026-08-30 09:00:00" }),
    msg({ name: "in1", subject: "Ouder", sender: "a@b.nl", recipients: "c@d.nl", date: "2026-08-28 09:00:00" }),
  ];
  // Een verzonden antwoord op de óudere mail is nieuwer dan alles in de lijst.
  const sent = [msg({ name: "s1", subject: "Re: Ouder", sender: "c@d.nl", recipients: "a@b.nl", date: "2026-09-05 09:00:00", inReplyTo: "in1" })];
  const threads = groupThreads(inbox, sent);
  assert.deepEqual(threads.map((th) => th.id), ["in2", "in1"]);
});

/* ─── missingParentNames ─── */

test("missingParentNames: alleen ouders die niet in de lijst staan, ontdubbeld", () => {
  const rows = [
    msg({ name: "a", inReplyTo: "root" }),
    msg({ name: "b", inReplyTo: "root" }),
    msg({ name: "c", inReplyTo: "a" }),
    msg({ name: "d" }),
  ];
  assert.deepEqual(missingParentNames(rows), ["root"]);
  assert.deepEqual(missingParentNames([msg({ name: "x" })]), []);
});

/* ───────────────────── Zichtbare volgorde in de lijst ────────────────── */

/** Twee gesprekken: het eerste met drie berichten, het tweede met één. */
function tweeGesprekken() {
  return groupThreads([
    msg({ name: "a1", subject: "Offerte kozijnen", date: "2026-03-01 09:00:00" }),
    msg({ name: "a2", subject: "Re: Offerte kozijnen", inReplyTo: "a1", date: "2026-03-02 09:00:00" }),
    msg({ name: "a3", subject: "Re: Offerte kozijnen", inReplyTo: "a2", date: "2026-03-03 09:00:00" }),
    msg({ name: "b1", subject: "Factuur maart", date: "2026-03-04 09:00:00" }),
  ], []);
}

test("visibleThreadOrder toont ingeklapte gesprekken als één regel", () => {
  const threads = tweeGesprekken();
  const koppen = threads.map((th) => th.head.name);
  assert.deepEqual(visibleThreadOrder(threads, new Set()), koppen);
});

test("visibleThreadOrder neemt de leden mee zodra het gesprek uitgeklapt is", () => {
  const threads = tweeGesprekken();
  const groot = threads.find((th) => th.count === 3);
  assert.ok(groot, "gesprek met drie berichten hoort te bestaan");
  const orde = visibleThreadOrder(threads, new Set([groot.id]));
  assert.equal(orde.length, 4);
  // De hoofdregel blijft vooropstaan, daarna de overige leden.
  assert.equal(orde[0], groot.head.name);
  assert.deepEqual([...orde].sort(), ["a1", "a2", "a3", "b1"]);
});

test("visibleThreadOrder klapt het gesprek uit waarvan je een lid leest", () => {
  const threads = tweeGesprekken();
  const groot = threads.find((th) => th.count === 3);
  assert.ok(groot);
  const lid = groot.names.find((n) => n !== groot.head.name);
  assert.ok(lid);
  // Zonder vinkje in `expanded`, puur omdat dit lid openstaat: anders zou de
  // mail die je leest niet in de lijst staan waar de pijltjes langs lopen.
  assert.equal(visibleThreadOrder(threads, new Set(), lid).length, 4);
});

test("neighbourInOrder loopt één stap op en neer", () => {
  const orde = ["m1", "m2", "m3"];
  assert.equal(neighbourInOrder(orde, "m2", 1), "m3");
  assert.equal(neighbourInOrder(orde, "m2", -1), "m1");
});

test("neighbourInOrder blijft aan de uiteinden staan", () => {
  const orde = ["m1", "m2", "m3"];
  // Doorlopen naar de andere kant zou je met één toets van je nieuwste naar
  // je oudste mail gooien.
  assert.equal(neighbourInOrder(orde, "m3", 1), undefined);
  assert.equal(neighbourInOrder(orde, "m1", -1), undefined);
});

test("neighbourInOrder begint bovenaan wanneer er nog niets openstaat", () => {
  const orde = ["m1", "m2", "m3"];
  assert.equal(neighbourInOrder(orde, null, 1), "m1");
  assert.equal(neighbourInOrder(orde, null, -1), "m3");
  assert.equal(neighbourInOrder([], null, 1), undefined);
  // Een selectie die niet meer in de lijst staat (net verwijderd) mag geen
  // dood punt opleveren.
  assert.equal(neighbourInOrder(orde, "weg", 1), "m1");
});
