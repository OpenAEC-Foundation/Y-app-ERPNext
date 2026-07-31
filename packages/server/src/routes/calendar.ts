/**
 * Y-app — Calendar / CalDAV routes
 *
 * Extracted verbatim from index.ts. Office 365 (Microsoft Graph) calendar
 * read/update/delete + iCal proxy + authenticated CalDAV read/write.
 */

import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { buildICalEvent } from "../ical-build.ts";
import { getDecryptedMailCredentials } from "../mail-accounts.ts";

/* ─── Office 365 Calendar via Microsoft Graph ─── */

export async function calendarGetO365(req: Request, res: Response) {
  const email = req.query.email as string;
  const startDate = req.query.start as string; // ISO date: 2026-03-01
  const endDate = req.query.end as string;     // ISO date: 2026-03-31

  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    // Get fresh OAuth2 token via mail auto-config
    const { mailAutoConfigInternal } = await import("../mail.js");
    const erpnextSid = (req as any).erpnextSid as string;
    const config = await mailAutoConfigInternal(erpnextSid, email);
    if (!config?.accessToken) {
      return res.status(401).json({ error: "Geen OAuth2 token beschikbaar voor " + email });
    }

    const graphUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarview");
    graphUrl.searchParams.set("startdatetime", (startDate || new Date().toISOString().split("T")[0]) + "T00:00:00Z");
    graphUrl.searchParams.set("enddatetime", (endDate || (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split("T")[0]; })()) + "T23:59:59Z");
    graphUrl.searchParams.set("$top", "200");
    graphUrl.searchParams.set("$select", "id,subject,start,end,isAllDay,location,bodyPreview,organizer,attendees,webLink,isCancelled");
    graphUrl.searchParams.set("$orderby", "start/dateTime");

    if (!config.refreshToken || !config.clientId || !config.clientSecret || !config.tokenUri) {
      return res.status(400).json({ error: "OAuth2 refresh credentials niet beschikbaar" });
    }

    const tokenResp = await fetch(config.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      return res.status(401).json({ error: `Graph token refresh failed: ${tokenData.error_description || tokenData.error || "unknown"}` });
    }

    const graphResp = await fetch(graphUrl.toString(), {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        Prefer: 'outlook.timezone="Europe/Amsterdam"',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!graphResp.ok) {
      const errText = await graphResp.text();
      console.error("[o365-calendar] Graph API error:", graphResp.status, errText.slice(0, 200));
      return res.status(graphResp.status).json({ error: `Graph API: ${graphResp.status}` });
    }

    const graphData = await graphResp.json() as { value: any[] };
    const events = (graphData.value || [])
      .filter((e: any) => !e.isCancelled)
      .map((e: any) => ({
        id: e.id,
        subject: e.subject || "(Geen titel)",
        start: e.start?.dateTime || "",
        end: e.end?.dateTime || "",
        isAllDay: e.isAllDay || false,
        location: e.location?.displayName || "",
        bodyPreview: e.bodyPreview || "",
        organizer: e.organizer?.emailAddress?.name || "",
        attendees: (e.attendees || []).map((a: any) => a.emailAddress?.name || a.emailAddress?.address).filter(Boolean),
        webLink: e.webLink || "",
      }));

    console.log(`[o365-calendar] Loaded ${events.length} events for ${email}`);
    res.json({ data: events });
  } catch (err) {
    console.error("[o365-calendar] Error:", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
}

/* ─── O365 calendar update (PATCH) ─── */

export async function calendarPatchO365(req: Request, res: Response) {
  const email = req.query.email as string;
  const eventId = req.params.eventId;

  if (!email || !eventId) return res.status(400).json({ error: "Missing email or eventId" });

  try {
    const { mailAutoConfigInternal } = await import("../mail.js");
    const erpnextSid = (req as any).erpnextSid as string;
    const config = await mailAutoConfigInternal(erpnextSid, email);
    if (!config?.accessToken) {
      return res.status(401).json({ error: "Geen OAuth2 token beschikbaar voor " + email });
    }

    if (!config.refreshToken || !config.clientId || !config.clientSecret || !config.tokenUri) {
      return res.status(400).json({ error: "OAuth2 refresh credentials niet beschikbaar" });
    }

    const tokenResp = await fetch(config.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      return res.status(401).json({ error: `Graph token refresh failed: ${tokenData.error_description || tokenData.error || "unknown"}` });
    }

    const body = req.body as {
      subject?: string;
      start?: { dateTime: string; timeZone: string };
      end?: { dateTime: string; timeZone: string };
      isAllDay?: boolean;
      location?: { displayName: string };
      body?: { contentType: string; content: string };
    };

    const graphResp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="Europe/Amsterdam"',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!graphResp.ok) {
      const errText = await graphResp.text();
      console.error("[o365-calendar] PATCH error:", graphResp.status, errText.slice(0, 300));
      return res.status(graphResp.status).json({ error: `Graph API PATCH: ${graphResp.status}` });
    }

    const updated = await graphResp.json();
    console.log(`[o365-calendar] Updated event ${eventId} for ${email}`);
    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[o365-calendar] PATCH error:", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
}

/* ─── O365 calendar delete (DELETE) ─── */

export async function calendarDeleteO365(req: Request, res: Response) {
  const email = req.query.email as string;
  const eventId = req.params.eventId;

  if (!email || !eventId) return res.status(400).json({ error: "Missing email or eventId" });

  try {
    const { mailAutoConfigInternal } = await import("../mail.js");
    const erpnextSid = (req as any).erpnextSid as string;
    const config = await mailAutoConfigInternal(erpnextSid, email);
    if (!config?.accessToken) {
      return res.status(401).json({ error: "Geen OAuth2 token beschikbaar voor " + email });
    }

    if (!config.refreshToken || !config.clientId || !config.clientSecret || !config.tokenUri) {
      return res.status(400).json({ error: "OAuth2 refresh credentials niet beschikbaar" });
    }

    const tokenResp = await fetch(config.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/.default offline_access",
      }),
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string; error_description?: string };
    if (!tokenData.access_token) {
      return res.status(401).json({ error: `Graph token refresh failed: ${tokenData.error_description || tokenData.error || "unknown"}` });
    }

    const graphResp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!graphResp.ok && graphResp.status !== 204) {
      const errText = await graphResp.text();
      console.error("[o365-calendar] DELETE error:", graphResp.status, errText.slice(0, 300));
      return res.status(graphResp.status).json({ error: `Graph API DELETE: ${graphResp.status}` });
    }

    console.log(`[o365-calendar] Deleted event ${eventId} for ${email}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[o365-calendar] DELETE error:", (err as Error).message);
    res.status(500).json({ error: (err as Error).message });
  }
}

/* ─── iCal calendar proxy ─── */

/** Parse VEVENT blocks from raw iCalendar text into simple event objects. */
function parseICalEvents(text: string): Array<{
  uid: string; summary: string; dtstart: string; dtend: string;
  description: string; location: string; allDay: boolean;
  organizer: string; attendees: string[];
}> {
  const events: Array<{
    uid: string; summary: string; dtstart: string; dtend: string;
    description: string; location: string; allDay: boolean;
    organizer: string; attendees: string[];
  }> = [];

  const veventBlocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split("END:VEVENT")[0];

    const getField = (name: string): string => {
      // Handle folded lines (RFC 5545: continuation lines start with space/tab)
      const regex = new RegExp(`^${name}[;:](.*)`, "m");
      const match = block.match(regex);
      if (!match) return "";
      let val = match[1];
      // Unfold continuation lines
      const startIdx = block.indexOf(match[0]);
      const afterMatch = block.substring(startIdx + match[0].length);
      const continuationMatch = afterMatch.match(/^(\r?\n[ \t].*)*/);
      if (continuationMatch && continuationMatch[0]) {
        val += continuationMatch[0].replace(/\r?\n[ \t]/g, "");
      }
      return val.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\").trim();
    };

    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const summary = getField("SUMMARY");
    const uid = getField("UID") || `ical-${i}`;
    const description = getField("DESCRIPTION");
    const location = getField("LOCATION");

    // ORGANIZER + ATTENDEE: kunnen meermaals voorkomen en gevouwen zijn, dus
    // ontvouw het blok eerst en match alle mailto:-adressen. Nodig om bij een
    // edit het uitnodig-veld voor te vullen en de juiste mensen te her-notificeren.
    const unfolded = block.replace(/\r?\n[ \t]/g, "");
    const orgM = unfolded.match(/^ORGANIZER[^\r\n]*?:mailto:([^\r\n;]+)/im);
    const organizer = orgM ? orgM[1].trim() : "";
    const attendees: string[] = [];
    const attRe = /^ATTENDEE[^\r\n]*?:mailto:([^\r\n;]+)/gim;
    let am: RegExpExecArray | null;
    while ((am = attRe.exec(unfolded)) !== null) attendees.push(am[1].trim());

    // Determine if all-day (DATE format = 8 chars, no T)
    const allDay = /^\d{8}$/.test(dtstart);

    // Parse date values
    const parseICalDate = (val: string): string => {
      if (!val) return "";
      // Remove TZID parameter prefix if present (e.g., "Europe/Amsterdam:20250101T090000")
      const colonIdx = val.indexOf(":");
      const dateStr = colonIdx >= 0 ? val.substring(colonIdx + 1) : val;
      // All-day: 20250101
      if (/^\d{8}$/.test(dateStr)) {
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
      // DateTime: 20250101T090000 or 20250101T090000Z
      if (/^\d{8}T\d{6}Z?$/.test(dateStr)) {
        const d = dateStr.replace("Z", "");
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}`;
      }
      return val;
    };

    events.push({
      uid,
      summary: summary || "(Geen titel)",
      dtstart: parseICalDate(dtstart),
      dtend: parseICalDate(dtend),
      description,
      location,
      allDay,
      organizer,
      attendees,
    });
  }

  return events;
}

const XML_ENTITY_MAP: Record<string, string> = {
  "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
  "&#13;": "\r", "&#10;": "\n", "&amp;": "&",
};
function xmlUnescape(s: string): string {
  return s.replace(/&(?:lt|gt|quot|apos|amp|#13|#10);/g, (m) => XML_ENTITY_MAP[m] ?? m);
}

/**
 * Fetch all VEVENT iCalendar text from an authenticated CalDAV collection
 * (e.g. https://mail.3bm.co.nl/dav/cal/). Discovers calendar collections via
 * PROPFIND Depth:1, then runs a calendar-query REPORT per calendar and
 * concatenates the returned calendar-data. Hand-rolled (no extra dep); robust
 * to namespace-prefix variation by matching local element names.
 */
async function fetchCalDavIcs(
  baseUrl: string, username: string, password: string,
): Promise<{ ics: string; debug: Record<string, unknown> }> {
  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const origin = new URL(baseUrl).origin;
  const debug: Record<string, unknown> = { authUser: username };
  const dav = (method: string, url: string, body: string, depth = "1") =>
    fetch(url, {
      method,
      headers: { Authorization: auth, "Content-Type": 'application/xml; charset="utf-8"', Depth: depth },
      body,
      signal: AbortSignal.timeout(20000),
    });

  // 0) Find the calendar-home: PROPFIND the principal's calendar-home-set.
  //    Many servers (SabreDAV) expose a thin entry collection at /dav/cal/ that
  //    is NOT the calendar-home; we must follow current-user-principal →
  //    calendar-home-set to reach the actual calendars.
  const homeProbeBody = `<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>`;
  let homeUrl = baseUrl;
  try {
    const hp = await dav("PROPFIND", baseUrl, homeProbeBody, "0");
    const hpXml = await hp.text();
    debug.homeProbeStatus = hp.status;
    debug.homeProbeXml = hpXml.slice(0, 1500);
    const homeM = hpXml.match(/<[a-z0-9]*:?calendar-home-set[^>]*>[\s\S]*?<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (homeM) homeUrl = new URL(xmlUnescape(homeM[1].trim()), origin).href;
    else {
      const cupM = hpXml.match(/<[a-z0-9]*:?current-user-principal[^>]*>[\s\S]*?<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
      if (cupM) debug.currentUserPrincipal = new URL(xmlUnescape(cupM[1].trim()), origin).href;
    }
  } catch (e) { debug.homeProbeError = (e as Error).message; }
  debug.homeUrl = homeUrl;

  // 1) PROPFIND Depth:1 on the calendar-home to discover calendar collections.
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>`;
  const pf = await dav("PROPFIND", homeUrl, propfindBody);
  debug.propfindStatus = pf.status;
  if (pf.status === 401) throw new Error("CalDAV auth failed (401)");
  if (!pf.ok && pf.status !== 207) throw new Error(`CalDAV PROPFIND returned ${pf.status}`);
  const pfXml = await pf.text();
  debug.propfindXml = pfXml.slice(0, 3000);

  // Collect hrefs whose resourcetype contains a <calendar> element.
  const calendarHrefs: string[] = [];
  const responseRe = /<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(pfXml)) !== null) {
    const resp = m[0];
    const hrefM = resp.match(/<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (!hrefM) continue;
    const href = xmlUnescape(hrefM[1].trim());
    const rtM = resp.match(/<[a-z0-9]*:?resourcetype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?resourcetype>/i);
    const rt = rtM ? rtM[1] : "";
    if (/<[a-z0-9]*:?calendar[\s/>]/i.test(rt)) {
      calendarHrefs.push(new URL(href, origin).href);
    }
  }
  // If no child calendars found, treat the home URL itself as a calendar.
  if (calendarHrefs.length === 0) calendarHrefs.push(homeUrl);
  debug.calendarHrefs = calendarHrefs;

  // 2) REPORT calendar-query per calendar; collect calendar-data text.
  const reportBody = `<?xml version="1.0" encoding="utf-8"?>\n<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`;
  let ics = "";
  const reportStatuses: Array<{ cal: string; status: number; dataBlocks: number }> = [];
  for (const cal of calendarHrefs) {
    try {
      const rep = await dav("REPORT", cal, reportBody);
      let blocks = 0;
      if (rep.ok || rep.status === 207) {
        const repXml = await rep.text();
        const dataRe = /<[a-z0-9]*:?calendar-data[^>]*>([\s\S]*?)<\/[a-z0-9]*:?calendar-data>/gi;
        let dm: RegExpExecArray | null;
        while ((dm = dataRe.exec(repXml)) !== null) {
          ics += xmlUnescape(dm[1]) + "\n";
          blocks++;
        }
      }
      reportStatuses.push({ cal, status: rep.status, dataBlocks: blocks });
    } catch (e) { reportStatuses.push({ cal, status: -1, dataBlocks: 0 }); void e; }
  }
  debug.reportStatuses = reportStatuses;
  return { ics, debug };
}

export async function calendarGetICal(req: Request, res: Response) {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });
  const accountId = req.query.account as string | undefined;

  try {
    const fetchUrl = url.replace(/^webcal:\/\//, "https://");
    let text: string;

    if (accountId) {
      // Authenticated CalDAV using the instance's vault mail-account creds
      // (same host as the calendar URL, e.g. mail.3bm.co.nl). No plaintext
      // password is stored client-side; the server resolves it from the vault.
      const yAppUserId = (req as any).yAppUserId as number | undefined;
      const userKey = (req as any).yAppUserKey as Buffer | undefined;
      if (!yAppUserId || !userKey) return res.status(401).json({ error: "No vault key in session" });
      const dec = await getDecryptedMailCredentials(accountId, yAppUserId, userKey);
      if (!dec || !dec.username) return res.status(404).json({ error: "Mail account not found" });
      const { ics, debug } = await fetchCalDavIcs(fetchUrl, dec.username, dec.password || "");
      if (req.query.debug === "1") {
        return res.json({ data: parseICalEvents(ics), eventCount: parseICalEvents(ics).length, debug });
      }
      text = ics;
    } else {
      const response = await fetch(fetchUrl, {
        headers: { Accept: "text/calendar, text/plain, */*" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Upstream returned ${response.status}` });
      }
      text = await response.text();
    }

    res.json({ data: parseICalEvents(text) });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}

/**
 * Create an event in an authenticated CalDAV collection by PUT-ing an .ics.
 * Discovers the target collection the same way as the read path (home-set →
 * PROPFIND Depth:1 → first calendar collection) and PUTs `<collection>/<uid>.ics`.
 * Eigen, beknopte discovery (geen refactor van het load-bearing lees-pad
 * `fetchCalDavIcs`) zodat een wijziging hier dat pad niet kan breken.
 */
async function caldavCreateEvent(
  baseUrl: string, username: string, password: string, uid: string, ics: string,
): Promise<{ ok: boolean; status: number; href: string; debug: Record<string, unknown> }> {
  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  const origin = new URL(baseUrl).origin;
  const debug: Record<string, unknown> = { authUser: username };
  const dav = (method: string, url: string, body: string, depth = "1") =>
    fetch(url, {
      method,
      headers: { Authorization: auth, "Content-Type": 'application/xml; charset="utf-8"', Depth: depth },
      body,
      signal: AbortSignal.timeout(20000),
    });

  // Find the calendar-home (current-user-principal → calendar-home-set).
  const homeProbeBody = `<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><c:calendar-home-set/></d:prop></d:propfind>`;
  let homeUrl = baseUrl;
  try {
    const hp = await dav("PROPFIND", baseUrl, homeProbeBody, "0");
    const hpXml = await hp.text();
    const homeM = hpXml.match(/<[a-z0-9]*:?calendar-home-set[^>]*>[\s\S]*?<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (homeM) homeUrl = new URL(xmlUnescape(homeM[1].trim()), origin).href;
  } catch (e) { debug.homeProbeError = (e as Error).message; }

  // PROPFIND Depth:1 to discover calendar collections. Naast resourcetype/
  // displayname vragen we ook current-user-privilege-set op (RFC 3744 §5.4)
  // zodat we een collectie kunnen kiezen waar deze principal ook echt mag
  // schrijven — zie de selectie hieronder voor waarom dat nodig is.
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>\n<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/><d:current-user-privilege-set/></d:prop></d:propfind>`;
  const pf = await dav("PROPFIND", homeUrl, propfindBody);
  if (pf.status === 401) throw new Error("CalDAV auth failed (401)");
  if (!pf.ok && pf.status !== 207) throw new Error(`CalDAV PROPFIND returned ${pf.status}`);
  const pfXml = await pf.text();

  // writable: true = server rapporteert expliciet write/all-privilege; false =
  // server rapporteert expliciet GEEN write-privilege; null = server stuurt
  // geen current-user-privilege-set terug (onbekend, niet elke CalDAV-server
  // ondersteunt deze prop).
  const calendarEntries: Array<{ href: string; writable: boolean | null }> = [];
  const responseRe = /<[a-z0-9]*:?response[\s>][\s\S]*?<\/[a-z0-9]*:?response>/gi;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(pfXml)) !== null) {
    const resp = m[0];
    const hrefM = resp.match(/<[a-z0-9]*:?href[^>]*>([\s\S]*?)<\/[a-z0-9]*:?href>/i);
    if (!hrefM) continue;
    const rtM = resp.match(/<[a-z0-9]*:?resourcetype[^>]*>([\s\S]*?)<\/[a-z0-9]*:?resourcetype>/i);
    if (!rtM || !/<[a-z0-9]*:?calendar[\s/>]/i.test(rtM[1])) continue;
    const href = new URL(xmlUnescape(hrefM[1].trim()), origin).href;
    const cupsM = resp.match(/<[a-z0-9]*:?current-user-privilege-set[^>]*>([\s\S]*?)<\/[a-z0-9]*:?current-user-privilege-set>/i);
    const writable = cupsM ? /<[a-z0-9]*:?(?:write|write-content|all)[\s/>]/i.test(cupsM[1]) : null;
    calendarEntries.push({ href, writable });
  }
  if (calendarEntries.length === 0) calendarEntries.push({ href: homeUrl, writable: null });
  debug.calendarEntries = calendarEntries;

  // Het calendar-home-set kan meerdere collecties bevatten (eigen agenda +
  // een gedeelde/publieke/abonnee-agenda). Lezen (fetchCalDavIcs) aggregeert
  // gewoon ALLE collecties, dus dat werkt altijd. Schrijven kan maar naar
  // ÉÉN collectie — als we blind de eerste gevonden href pakken en die
  // toevallig een alleen-lezen collectie is, faalt de PUT met 401/403 terwijl
  // lezen prima werkt. Kies daarom een collectie met een expliciet
  // gerapporteerde write-privilege; val terug op de eerste als geen enkele
  // server dat rapporteert (privilege-set niet ondersteund — vorig gedrag).
  const explicitlyWritable = calendarEntries.filter(e => e.writable === true);
  const chosen = (explicitlyWritable[0] || calendarEntries[0]).href;
  debug.chosenCalendar = chosen;
  if (calendarEntries.length > 1) {
    console.warn(`[caldav] ${calendarEntries.length} kalender-collecties gevonden onder ${homeUrl}; gekozen om te schrijven: ${chosen}`, calendarEntries);
  }

  const target = chosen.endsWith("/") ? chosen : chosen + "/";
  const eventUrl = new URL(`${uid}.ics`, target).href;
  const put = await fetch(eventUrl, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "text/calendar; charset=utf-8" },
    body: ics,
    signal: AbortSignal.timeout(20000),
  });
  await put.text().catch(() => {});
  debug.eventUrl = eventUrl;
  debug.putStatus = put.status;
  if (put.status === 401 || put.status === 403) {
    // De PUT zelf faalde op auth/permissie ondanks een geslaagde PROPFIND —
    // log altijd (niet alleen bij ?debug=1) zodat een volgende repro
    // meteen de gekozen collectie + alle kandidaten in de server-log heeft.
    console.error(`[caldav] PUT ${eventUrl} -> ${put.status}`, debug);
  }
  return { ok: put.ok || put.status === 201 || put.status === 204, status: put.status, href: eventUrl, debug };
}

/** Parse "Naam <email>" of een kale "email" → {email, name?}. */
function parseCalAddress(s: string): { email: string; name?: string } | null {
  const t = (s || "").trim();
  if (!t) return null;
  const m = t.match(/^(.*?)<([^>]+)>$/);
  if (m) {
    const name = m[1].trim().replace(/^"|"$/g, "");
    return { email: m[2].trim(), name: name || undefined };
  }
  return { email: t };
}

export async function calendarPostEvent(req: Request, res: Response) {
  const { url, account, summary, start, end, allDay, description, location,
    attendees: attendeeInput, uid: existingUid, sequence } = (req.body || {}) as {
    url?: string; account?: string; summary?: string; start?: string; end?: string;
    allDay?: boolean; description?: string; location?: string;
    attendees?: string[]; uid?: string; sequence?: number;
  };
  if (!url || !summary || !start) return res.status(400).json({ error: "Missing url/summary/start" });
  // CalDAV-schrijven vereist geauthenticeerde creds uit de vault (geen plaintext
  // wachtwoord client-side) — publieke iCal-feeds zijn niet schrijfbaar.
  if (!account) return res.status(400).json({ error: "CalDAV write requires an authenticated account" });
  const yAppUserId = (req as any).yAppUserId as number | undefined;
  const userKey = (req as any).yAppUserKey as Buffer | undefined;
  if (!yAppUserId || !userKey) return res.status(401).json({ error: "No vault key in session" });

  try {
    const dec = await getDecryptedMailCredentials(account, yAppUserId, userKey);
    if (!dec || !dec.username) return res.status(404).json({ error: "Mail account not found" });
    // Bestaande UID = bewerken (zelfde <uid>.ics wordt overschreven); anders nieuw.
    const uid = existingUid || `${randomUUID()}@y-app`;
    const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const seq = typeof sequence === "number" ? sequence : 0;
    const attendees = (attendeeInput || [])
      .map(parseCalAddress)
      .filter((a): a is { email: string; name?: string } => !!a);
    const organizer = { email: dec.username };
    const hasAttendees = attendees.length > 0;
    // CalDAV-kopie (het opgeslagen event): met ORGANIZER + ATTENDEE zodat de
    // organisator ziet wie uitgenodigd is en we ze bij een edit terug kunnen
    // lezen. ZONDER METHOD — dat hoort alleen bij de iMIP-mailkopie.
    const ics = buildICalEvent({
      uid, dtstamp, summary, start, end, allDay: !!allDay, description, location,
      organizer: hasAttendees ? organizer : undefined,
      attendees: hasAttendees ? attendees : undefined,
      sequence: hasAttendees ? seq : undefined,
    });
    const result = await caldavCreateEvent(url.replace(/^webcal:\/\//, "https://"), dec.username, dec.password || "", uid, ics);
    const withDebug = req.query.debug === "1" ? { debug: result.debug } : {};
    if (!result.ok) {
      return res.status(502).json({ error: `CalDAV PUT returned ${result.status}`, ...withDebug });
    }
    // iMIP-kopie voor de uitnodigingsmail: zelfde event + METHOD:REQUEST. De
    // frontend stuurt 'm via /api/mail/send (icalEvent), zodat de robuuste
    // mail-flow inclusief ERPNext-relay-fallback hergebruikt wordt.
    let inviteIcs: string | undefined;
    if (hasAttendees) {
      inviteIcs = buildICalEvent({
        uid, dtstamp, summary, start, end, allDay: !!allDay, description, location,
        method: "REQUEST", organizer, attendees, sequence: seq,
      });
    }
    res.json({
      ok: true, uid, organizer: organizer.email,
      attendees: attendees.map((a) => a.email), inviteIcs, ...withDebug,
    });
  } catch (err) {
    console.error("[caldav] event create/update failed:", (err as Error).message);
    res.status(502).json({ error: (err as Error).message });
  }
}
