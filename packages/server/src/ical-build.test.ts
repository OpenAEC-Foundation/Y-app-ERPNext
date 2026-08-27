import { test } from "node:test";
import assert from "node:assert/strict";

import { buildICalEvent } from "./ical-build.ts";

const base = { uid: "evt-1@y-app", dtstamp: "20260618T120000Z", summary: "Overleg" };

test("builds an all-day VEVENT with exclusive DTEND (next day)", () => {
  const ics = buildICalEvent({ ...base, allDay: true, start: "2026-06-18", end: "2026-06-18" });
  assert.match(ics, /DTSTART;VALUE=DATE:20260618/);
  assert.match(ics, /DTEND;VALUE=DATE:20260619/);
});

test("builds a timed VEVENT with basic-format local DTSTART/DTEND", () => {
  const ics = buildICalEvent({ ...base, allDay: false, start: "2026-06-18T09:00", end: "2026-06-18T10:30" });
  assert.match(ics, /DTSTART:20260618T090000/);
  assert.match(ics, /DTEND:20260618T103000/);
});

test("accepts space-separated date-times too", () => {
  const ics = buildICalEvent({ ...base, allDay: false, start: "2026-06-18 09:00", end: "2026-06-18 10:00" });
  assert.match(ics, /DTSTART:20260618T090000/);
  assert.match(ics, /DTEND:20260618T100000/);
});

test("escapes special characters in text fields (RFC 5545)", () => {
  const ics = buildICalEvent({
    ...base, summary: "A, B; C\nD", allDay: false, start: "2026-06-18T09:00", end: "2026-06-18T10:00",
    description: "regel1\nregel2; x, y",
  });
  assert.match(ics, /SUMMARY:A\\, B\\; C\\nD/);
  assert.match(ics, /DESCRIPTION:regel1\\nregel2\\; x\\, y/);
});

test("includes the required VCALENDAR/VEVENT skeleton and UID/DTSTAMP", () => {
  const ics = buildICalEvent({ ...base, allDay: true, start: "2026-06-18" });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /UID:evt-1@y-app/);
  assert.match(ics, /DTSTAMP:20260618T120000Z/);
  assert.match(ics, /END:VEVENT/);
  assert.match(ics, /END:VCALENDAR/);
});

test("uses CRLF line endings", () => {
  const ics = buildICalEvent({ ...base, allDay: true, start: "2026-06-18" });
  assert.ok(ics.includes("\r\n"), "ICS must use CRLF");
});

test("omits DESCRIPTION and LOCATION when empty", () => {
  const ics = buildICalEvent({ ...base, allDay: true, start: "2026-06-18" });
  assert.doesNotMatch(ics, /DESCRIPTION:/);
  assert.doesNotMatch(ics, /LOCATION:/);
});

/* ─── iMIP / scheduling fields (invitations) ─── */

const invite = {
  ...base,
  allDay: false,
  start: "2026-06-18T09:00",
  end: "2026-06-18T10:00",
  organizer: { email: "piet@3bm.co.nl", name: "Piet Mol" },
  attendees: [
    { email: "oscar@beno-groep.nl", name: "Oscar" },
    { email: "peter@beno-groep.nl" },
  ],
};

test("emits METHOD:REQUEST in the VCALENDAR when method is set", () => {
  const ics = buildICalEvent({ ...invite, method: "REQUEST" });
  assert.match(ics, /BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:[^\r]*\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST/);
});

test("emits ORGANIZER with mailto and CN", () => {
  const ics = buildICalEvent({ ...invite, method: "REQUEST" });
  assert.match(ics, /ORGANIZER;CN="Piet Mol":mailto:piet@3bm\.co\.nl/);
});

test("emits one ATTENDEE line per attendee with RSVP + NEEDS-ACTION", () => {
  const ics = buildICalEvent({ ...invite, method: "REQUEST" });
  assert.match(ics, /ATTENDEE;CN="Oscar";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:oscar@beno-groep\.nl/);
  // attendee without a name → no CN param, still a valid ATTENDEE
  assert.match(ics, /ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:peter@beno-groep\.nl/);
});

test("emits SEQUENCE when provided (for updates)", () => {
  const ics = buildICalEvent({ ...invite, method: "REQUEST", sequence: 2 });
  assert.match(ics, /SEQUENCE:2/);
});

test("emits STATUS:CANCELLED + METHOD:CANCEL for cancellations", () => {
  const ics = buildICalEvent({ ...invite, method: "CANCEL", sequence: 3, status: "CANCELLED" });
  assert.match(ics, /METHOD:CANCEL/);
  assert.match(ics, /STATUS:CANCELLED/);
});

test("plain events (no scheduling fields) stay free of METHOD/ORGANIZER/ATTENDEE/SEQUENCE", () => {
  const ics = buildICalEvent({ ...base, allDay: true, start: "2026-06-18" });
  assert.doesNotMatch(ics, /METHOD:/);
  assert.doesNotMatch(ics, /ORGANIZER/);
  assert.doesNotMatch(ics, /ATTENDEE/);
  assert.doesNotMatch(ics, /SEQUENCE/);
});
