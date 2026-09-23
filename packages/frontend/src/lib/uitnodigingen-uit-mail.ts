import { fetchList } from "./erpnext";
import { isHandledStatus } from "./mail-erpnext.ts";
import { leesAfspraakIcs } from "./ical.ts";
import type { MailUitnodiging } from "./agenda-uitnodigingen.ts";

/**
 * De uitnodigingen ophalen die nog in de mail staan.
 *
 * De .ics-bestanden zitten als bijlage aan een Communication; de leesrechten
 * van Frappe zorgen er vanzelf voor dat je alleen post ziet uit postbussen waar
 * je bij mag. Welke van die uitnodigingen daarna echt in de agenda horen,
 * beslist `kiesUitnodigingen` — dat is de kant die getest is.
 *
 * Let op: Frappe laat bij het binnenhalen van IMAP niet elk agendadeel staan.
 * Wat hier vandaan komt is dus wat ERPNext heeft bewaard, niet per se alles wat
 * er op de mailserver ligt.
 */

/** Hoever terug we kijken. Een uitnodiging die langer geleden binnenkwam
 *  staat allang in de agenda of is allang vergeten. */
const DAGEN_TERUG = 120;

/** Plafond op het aantal bijlagen dat we uitlezen — elk kost een verzoek. */
const MAX_BIJLAGEN = 40;

/** Hoe lang het antwoord meegaat. De agenda haalt bij elke maandsprong opnieuw
 *  op; zonder dit zou dezelfde stapel .ics-bestanden telkens opnieuw over de
 *  lijn gaan. */
const HOUDBAAR_MS = 5 * 60 * 1000;

let bewaard: { op: number; wat: Promise<MailUitnodiging[]> } | null = null;

/** De bewaarde uitslag weggooien, bijvoorbeeld nadat er een antwoord is gegeven. */
export function vergeetUitnodigingen(): void {
  bewaard = null;
}

export function haalOpenUitnodigingen(): Promise<MailUitnodiging[]> {
  const nu = Date.now();
  if (bewaard && nu - bewaard.op < HOUDBAAR_MS) return bewaard.wat;
  const wat = ophalen().catch((err) => {
    // Een mislukte poging hoort niet vijf minuten te blijven plakken.
    bewaard = null;
    console.error("Uitnodigingen ophalen mislukt:", err);
    return [] as MailUitnodiging[];
  });
  bewaard = { op: nu, wat };
  return wat;
}

async function ophalen(): Promise<MailUitnodiging[]> {
  const grens = new Date(Date.now() - DAGEN_TERUG * 864e5).toISOString().slice(0, 10);
  const bijlagen = await fetchList<{ file_url: string; attached_to_name: string }>("File", {
    fields: ["name", "file_url", "attached_to_name", "creation"],
    filters: [
      ["file_name", "like", "%.ics"],
      ["attached_to_doctype", "=", "Communication"],
      ["creation", ">=", grens],
    ],
    order_by: "creation desc",
    limit_page_length: MAX_BIJLAGEN,
  });
  if (bijlagen.length === 0) return [];

  /*
   * Alleen ontvangen post. Bij een uitnodiging die je zelf verstuurde hangt
   * hetzelfde .ics-bestand aan de verzonden mail; die afspraak staat al in je
   * eigen agenda en hoort er niet gestippeld naast.
   */
  const namen = [...new Set(bijlagen.map((b) => b.attached_to_name).filter(Boolean))];
  const mails = await fetchList<{ name: string; sent_or_received: string; status?: string }>("Communication", {
    fields: ["name", "sent_or_received", "status"],
    filters: [["name", "in", namen]],
    limit_page_length: namen.length,
  });
  // Afgehandelde post ook niet: die uitnodiging is beantwoord, of vanuit de
  // agenda met "Verwijderen" bewust weggelegd, en hoort niet gestippeld terug
  // te komen.
  const ontvangen = new Set(
    mails.filter((m) => m.sent_or_received === "Received" && !isHandledStatus(m.status))
      .map((m) => m.name));

  const uitslag = await Promise.allSettled(
    bijlagen
      .filter((b) => b.file_url && ontvangen.has(b.attached_to_name))
      .map(async (b): Promise<MailUitnodiging | null> => {
        const res = await fetch(b.file_url, { credentials: "same-origin" });
        if (!res.ok) return null;
        const afspraak = leesAfspraakIcs(await res.text());
        if (!afspraak.start) return null;
        return { communication: b.attached_to_name, afspraak };
      }));

  const uit: MailUitnodiging[] = [];
  for (const r of uitslag) if (r.status === "fulfilled" && r.value) uit.push(r.value);
  return uit;
}
