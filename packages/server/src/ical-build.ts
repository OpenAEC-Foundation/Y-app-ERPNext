/**
 * Minimale RFC 5545 VEVENT-builder voor het schrijven naar een CalDAV-collectie.
 * Pure functie (geen Date.now/IO) zodat 'm los testbaar is — de aanroeper levert
 * `uid` en `dtstamp` aan.
 *
 * Tijden zijn "floating local" (geen TZID/Z): een persoonlijke agenda toont ze
 * in de lokale tijd van de gebruiker, wat overeenkomt met wat in de Y-app-modal
 * is ingevuld. All-day events gebruiken VALUE=DATE met een exclusieve DTEND
 * (de dag ná de laatste dag), zoals de iCalendar-spec voorschrijft.
 */

export interface ICalAttendee {
  email: string;
  name?: string;
}

export interface ICalEventInput {
  uid: string;
  dtstamp: string; // UTC basic, bv. "20260618T120000Z"
  summary: string;
  start: string; // "YYYY-MM-DD" (all-day) of "YYYY-MM-DD[T ]HH:mm[:ss]" (timed)
  end?: string; // idem; default = start
  allDay: boolean;
  description?: string;
  location?: string;
  /** iMIP scheduling (uitnodigingen). Weglaten = gewoon agenda-event zonder scheduling. */
  method?: "REQUEST" | "CANCEL";
  /** RFC 5545 SEQUENCE — ophogen bij elke wijziging zodat clients de update accepteren. */
  sequence?: number;
  organizer?: ICalAttendee;
  attendees?: ICalAttendee[];
  /** bv. "CANCELLED" bij een afzegging. */
  status?: string;
}

/** CN-parameterwaarde: dubbele quotes zijn niet toegestaan binnen een quoted param → strip ze. */
function cnParam(name?: string): string {
  if (!name) return "";
  return `;CN="${name.replace(/"/g, "'")}"`;
}

function organizerLine(o: ICalAttendee): string {
  return `ORGANIZER${cnParam(o.name)}:mailto:${o.email}`;
}

function attendeeLine(a: ICalAttendee): string {
  return `ATTENDEE${cnParam(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icalDate(s: string): string {
  return s.slice(0, 10).replace(/-/g, "");
}

function icalDateTime(s: string): string {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return `${icalDate(s)}T000000`;
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6] || "00"}`;
}

/** Dag ná `s` ("YYYY-MM-DD") in basic-format ("YYYYMMDD"), voor de exclusieve all-day DTEND. */
function nextDayBasic(s: string): string {
  const dt = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildICalEvent(input: ICalEventInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Y-App//Calendar//EN",
    "CALSCALE:GREGORIAN",
  ];
  if (input.method) lines.push(`METHOD:${input.method}`);
  lines.push("BEGIN:VEVENT", `UID:${input.uid}`, `DTSTAMP:${input.dtstamp}`);
  if (input.sequence !== undefined) lines.push(`SEQUENCE:${input.sequence}`);
  if (input.organizer) lines.push(organizerLine(input.organizer));
  for (const a of input.attendees || []) lines.push(attendeeLine(a));

  if (input.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${icalDate(input.start)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDayBasic(input.end || input.start)}`);
  } else {
    lines.push(`DTSTART:${icalDateTime(input.start)}`);
    lines.push(`DTEND:${icalDateTime(input.end || input.start)}`);
  }

  lines.push(`SUMMARY:${escapeText(input.summary)}`);
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.status) lines.push(`STATUS:${input.status}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
