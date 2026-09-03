import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adresVanRegel,
  bouwAfspraakIcs,
  leesAfspraakIcs,
  ontvouw,
  vouw,
  zetDeelname,
  type AfspraakInvoer,
} from "./ical.ts";

const NU = new Date("2026-09-03T12:00:00Z");

function afspraak(over: Partial<AfspraakInvoer> = {}): AfspraakInvoer {
  return {
    uid: "abc-123@3bm.co.nl",
    titel: "Planningsoverleg",
    start: "2026-09-10T10:00:00",
    eind: "2026-09-10T11:00:00",
    tijdzone: "Europe/Amsterdam",
    organisator: { email: "maarten@3bm.co.nl", naam: "Maarten Vroegindeweij" },
    genodigden: [{ email: "martin@3bm.co.nl", naam: "Martin" }],
    ...over,
  };
}

/** De regels van een `.ics`, ontvouwen, zodat een test er los bij kan. */
function regels(ics: string): string[] {
  return ontvouw(ics);
}

test("bouwAfspraakIcs levert een geldig VCALENDAR met CRLF", () => {
  const ics = bouwAfspraakIcs(afspraak(), NU);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  // Losse LF's horen er niet in te staan; de norm schrijft CRLF voor.
  assert.equal(/[^\r]\n/.test(ics), false);
});

test("bouwAfspraakIcs zet tijd en tijdzone zoals de agenda hem verwacht", () => {
  const r = regels(bouwAfspraakIcs(afspraak(), NU));
  assert.ok(r.includes("DTSTART;TZID=Europe/Amsterdam:20260910T100000"));
  assert.ok(r.includes("DTEND;TZID=Europe/Amsterdam:20260910T110000"));
  assert.ok(r.includes("UID:abc-123@3bm.co.nl"));
  assert.ok(r.includes("DTSTAMP:20260903T120000Z"));
});

test("bouwAfspraakIcs maakt van een hele dag een datum, met DTEND op de dag erna", () => {
  const r = regels(bouwAfspraakIcs(afspraak({
    heleDag: true, start: "2026-09-10T00:00:00", eind: "2026-09-10T00:00:00",
  }), NU));
  assert.ok(r.includes("DTSTART;VALUE=DATE:20260910"));
  // DTEND is exclusief: één dag loopt tot de volgende.
  assert.ok(r.includes("DTEND;VALUE=DATE:20260911"));
});

test("bouwAfspraakIcs zet METHOD:REQUEST alleen als er genodigden zijn", () => {
  assert.ok(regels(bouwAfspraakIcs(afspraak(), NU)).includes("METHOD:REQUEST"));
  const zonder = regels(bouwAfspraakIcs(afspraak({ genodigden: [] }), NU));
  assert.equal(zonder.some((r) => r.startsWith("METHOD")), false);
  // Zonder genodigden blijft de organisator er wel in staan.
  assert.ok(zonder.some((r) => r.startsWith("ORGANIZER")));
});

test("bouwAfspraakIcs vraagt om een reactie zolang die er niet is", () => {
  const r = regels(bouwAfspraakIcs(afspraak(), NU));
  const genodigde = r.find((x) => x.startsWith("ATTENDEE"));
  assert.ok(genodigde?.includes("PARTSTAT=NEEDS-ACTION"));
  assert.ok(genodigde?.includes("RSVP=TRUE"));
  assert.ok(genodigde?.endsWith(":mailto:martin@3bm.co.nl"));

  // Wie al geantwoord heeft, hoeft niet opnieuw gevraagd te worden.
  const beantwoord = regels(bouwAfspraakIcs(afspraak({
    genodigden: [{ email: "martin@3bm.co.nl", status: "accepted" }],
  }), NU)).find((x) => x.startsWith("ATTENDEE"));
  assert.ok(beantwoord?.includes("PARTSTAT=ACCEPTED"));
  assert.equal(beantwoord?.includes("RSVP"), false);
});

test("bouwAfspraakIcs ontsnapt tekens die het bestand anders in stukken knippen", () => {
  const r = regels(bouwAfspraakIcs(afspraak({
    titel: "Overleg: offerte, tekening; versie 2",
    omschrijving: "Eerste regel\nTweede regel",
  }), NU));
  const titel = r.find((x) => x.startsWith("SUMMARY"));
  assert.equal(titel, "SUMMARY:Overleg: offerte\\, tekening\\; versie 2");
  assert.ok(r.includes("DESCRIPTION:Eerste regel\\nTweede regel"));
});

test("bouwAfspraakIcs zet een naam met een komma tussen aanhalingstekens", () => {
  // "Veldhuijzen, F." zou anders als twee parameters gelezen worden.
  const r = regels(bouwAfspraakIcs(afspraak({
    genodigden: [{ email: "f@hr.nl", naam: "Veldhuijzen, F. (Friedhelm)" }],
  }), NU));
  const genodigde = r.find((x) => x.startsWith("ATTENDEE"));
  assert.ok(genodigde?.includes('CN="Veldhuijzen, F. (Friedhelm)"'));
  assert.equal(adresVanRegel(genodigde as string), "f@hr.nl");
});

test("zetDeelname verandert één regel en laat de rest ongemoeid", () => {
  const ics = bouwAfspraakIcs(afspraak({
    genodigden: [
      { email: "martin@3bm.co.nl", naam: "Martin" },
      { email: "lance@3bm.co.nl", naam: "Lance" },
    ],
  }), NU);
  const na = zetDeelname(ics, "MARTIN@3bm.co.nl", "accepted");
  const r = regels(na);
  const martin = r.find((x) => x.includes("martin@3bm.co.nl"));
  const lance = r.find((x) => x.includes("lance@3bm.co.nl"));
  assert.ok(martin?.includes("PARTSTAT=ACCEPTED"));
  assert.equal(martin?.includes("RSVP"), false);
  // De andere genodigde blijft staan zoals hij stond.
  assert.ok(lance?.includes("PARTSTAT=NEEDS-ACTION"));
  assert.ok(lance?.includes("RSVP=TRUE"));
  // Een antwoord is geen verzoek meer.
  assert.ok(r.includes("METHOD:REPLY"));
  // En de afspraak zelf verandert niet.
  assert.ok(r.includes("DTSTART;TZID=Europe/Amsterdam:20260910T100000"));
  assert.ok(r.includes("UID:abc-123@3bm.co.nl"));
});

test("zetDeelname raakt niets aan wanneer het adres er niet tussen staat", () => {
  const ics = bouwAfspraakIcs(afspraak(), NU);
  const na = zetDeelname(ics, "iemand.anders@3bm.co.nl", "declined");
  assert.equal(regels(na).some((r) => r.includes("DECLINED")), false);
});

test("zetDeelname bewaart velden die wij niet kennen", () => {
  // Herhalingen en herinneringen komen uit andere agendaprogramma's; die
  // mogen niet sneuvelen op een klik "accepteren".
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", "BEGIN:VEVENT",
    "UID:x@3bm.co.nl", "RRULE:FREQ=WEEKLY;BYDAY=MO", "X-APPLE-TRAVEL-DURATION:PT15M",
    "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:martin@3bm.co.nl",
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const r = regels(zetDeelname(ics, "martin@3bm.co.nl", "tentative"));
  assert.ok(r.includes("RRULE:FREQ=WEEKLY;BYDAY=MO"));
  assert.ok(r.includes("X-APPLE-TRAVEL-DURATION:PT15M"));
  assert.ok(r.includes("TRIGGER:-PT15M"));
  assert.ok(r.some((x) => x.includes("PARTSTAT=TENTATIVE")));
});

test("leesAfspraakIcs haalt eruit wat een uitnodiging nodig heeft", () => {
  const gelezen = leesAfspraakIcs(bouwAfspraakIcs(afspraak({
    titel: "Overleg: offerte, tekening",
    volgnummer: 2,
    genodigden: [
      { email: "martin@3bm.co.nl", naam: "Martin", status: "accepted" },
      { email: "lance@3bm.co.nl", naam: "Lance" },
    ],
  }), NU));
  assert.equal(gelezen.uid, "abc-123@3bm.co.nl");
  assert.equal(gelezen.titel, "Overleg: offerte, tekening");
  assert.equal(gelezen.methode, "REQUEST");
  assert.equal(gelezen.volgnummer, 2);
  assert.equal(gelezen.organisator, "maarten@3bm.co.nl");
  assert.deepEqual(gelezen.genodigden.map((g) => [g.email, g.status]), [
    ["martin@3bm.co.nl", "accepted"],
    ["lance@3bm.co.nl", "needs-action"],
  ]);
  assert.equal(gelezen.genodigden[0].naam, "Martin");
});

test("vouw knipt op 75 octetten, niet op 75 tekens", () => {
  const kort = "SUMMARY:kort";
  assert.deepEqual(vouw(kort), [kort]);

  const lang = "SUMMARY:" + "a".repeat(100);
  const stukken = vouw(lang);
  assert.ok(stukken.length > 1);
  for (const s of stukken) assert.ok(new TextEncoder().encode(s).length <= 75);
  for (const s of stukken.slice(1)) assert.ok(s.startsWith(" "));
  // Ontvouwen levert precies het origineel weer op.
  assert.equal(ontvouw(stukken.join("\r\n"))[0], lang);
});

test("vouw knipt niet middenin een teken van meerdere octetten", () => {
  const lang = "SUMMARY:" + "é".repeat(60);
  const stukken = vouw(lang);
  for (const s of stukken) assert.ok(new TextEncoder().encode(s).length <= 75);
  assert.equal(ontvouw(stukken.join("\r\n"))[0], lang);
});

test("een gebouwd bestand overleeft ontvouwen ongeschonden", () => {
  const ics = bouwAfspraakIcs(afspraak({
    titel: "Een behoorlijk lange titel die zeker over de vijfenzeventig octetten heen gaat, met accenten: ëéü",
    genodigden: [{ email: "iemand.met.een.lang.adres@een-lange-domeinnaam.example.com", naam: "Iemand met een lange naam" }],
  }), NU);
  const r = ontvouw(ics);
  assert.ok(r.some((x) => x.startsWith("SUMMARY:Een behoorlijk lange titel")));
  assert.ok(r.some((x) => x.endsWith(":mailto:iemand.met.een.lang.adres@een-lange-domeinnaam.example.com")));
  assert.equal(leesAfspraakIcs(ics).genodigden[0].email, "iemand.met.een.lang.adres@een-lange-domeinnaam.example.com");
});
