/**
 * De uitnodiging die de genodigde in zijn mail krijgt.
 *
 * Tot nu toe kwam een afspraak uit Y-next alleen in de agenda's op onze eigen
 * mailserver terecht. Wie zijn post elders leest — Outlook, Gmail, een telefoon
 * — kreeg hooguit een kale mededeling van de server, zonder knoppen. Dit
 * bestand maakt er een echte uitnodiging van: een leesbaar bericht met de
 * afspraak erin, en het `.ics`-bestand als bijlage.
 *
 * **Wat de knoppen "Accepteren" en "Afwijzen" oproept** is die bijlage: een
 * `text/calendar`-bestand met `METHOD:REQUEST`, een ORGANIZER en per genodigde
 * een ATTENDEE met `RSVP=TRUE`. Dat maakt `bouwAfspraakIcs` al. Outlook, Apple
 * Mail en Thunderbird tonen daarop hun antwoordknoppen; Gmail toont een kaart
 * met Ja / Misschien / Nee.
 *
 * Het bericht zelf blijft nuttig als een mailprogramma die knoppen niet toont:
 * dan staat er tenminste wanneer het is, waar het is en wie er komen.
 */
import { sendMail } from "./mail-erpnext.ts";

export interface UitnodigingMail {
  aan: string;
  onderwerp: string;
  html: string;
}

function esc(tekst: string): string {
  const tabel: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(tekst ?? "").replace(/[&<>"]/g, (c) => tabel[c]);
}

const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

/** "2026-09-28T10:00:00" → "maandag 28 september 2026". */
export function langeDatum(tijd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(tijd || ""));
  if (!m) return "";
  const [, jaar, maand, dag] = m;
  const d = new Date(Date.UTC(Number(jaar), Number(maand) - 1, Number(dag)));
  return `${DAGEN[d.getUTCDay()]} ${Number(dag)} ${MAANDEN[Number(maand) - 1]} ${jaar}`;
}

/** "2026-09-28T10:00:00" → "10:00". */
export function klok(tijd: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(String(tijd || ""));
  return m ? `${m[1]}:${m[2]}` : "";
}

export interface UitnodigingInvoer {
  titel: string;
  /** Lokale tijd zonder zone: "2026-09-28T10:00:00". */
  start: string;
  eind: string;
  heleDag?: boolean;
  locatie?: string;
  omschrijving?: string;
  organisator: string;
  genodigden: string[];
  /** Woorden voor de kop en de regels; zo blijft deze module taalloos. */
  woorden: {
    onderwerp: string;
    wanneer: string;
    waar: string;
    wie: string;
    heleDag: string;
    uitleg: string;
  };
}

/** Het bericht, of `null` als er niemand is om het naartoe te sturen. */
export function maakUitnodigingMail(invoer: UitnodigingInvoer): UitnodigingMail | null {
  const aan = [...new Set(invoer.genodigden.map((g) => g.trim().toLowerCase()).filter(Boolean))]
    .filter((g) => g !== invoer.organisator.trim().toLowerCase());
  if (aan.length === 0) return null;

  const datum = langeDatum(invoer.start);
  const tijd = invoer.heleDag
    ? invoer.woorden.heleDag
    : [klok(invoer.start), klok(invoer.eind)].filter(Boolean).join(" – ");

  const regels: string[] = [
    `<h2 style="margin:0 0 12px 0;font-size:17px">${esc(invoer.titel)}</h2>`,
    `<p style="margin:0 0 4px 0"><strong>${esc(invoer.woorden.wanneer)}:</strong> ${esc([datum, tijd].filter(Boolean).join(", "))}</p>`,
  ];
  if (invoer.locatie) {
    regels.push(`<p style="margin:0 0 4px 0"><strong>${esc(invoer.woorden.waar)}:</strong> ${esc(invoer.locatie)}</p>`);
  }
  regels.push(`<p style="margin:0 0 4px 0"><strong>${esc(invoer.woorden.wie)}:</strong> ${esc([invoer.organisator, ...aan].join(", "))}</p>`);
  if (invoer.omschrijving?.trim()) {
    regels.push(`<p style="margin:12px 0 0 0;white-space:pre-wrap">${esc(invoer.omschrijving.trim())}</p>`);
  }
  regels.push(`<p style="margin:16px 0 0 0;color:#64748b;font-size:12px">${esc(invoer.woorden.uitleg)}</p>`);

  return {
    aan: aan.join(", "),
    onderwerp: `${invoer.woorden.onderwerp}: ${invoer.titel}`,
    html: regels.join(""),
  };
}

/**
 * De uitnodiging versturen, met het `.ics` als bijlage.
 *
 * De naam van de bijlage doet ertoe: mailprogramma's kijken naar de extensie
 * `.ics` en het type `text/calendar` om er een uitnodiging in te herkennen.
 */
export async function verstuurUitnodigingMail(
  mail: UitnodigingMail, ics: string, organisator: string,
): Promise<{ name: string }> {
  const bestand = new File([ics], "uitnodiging.ics", { type: "text/calendar" });
  return sendMail({
    to: mail.aan,
    subject: mail.onderwerp,
    html: mail.html,
    attachments: [bestand],
    sender: organisator,
  });
}
