import { zetDeelname, type Deelnamestatus } from "./ical.ts";
import { sendMail } from "./mail-erpnext.ts";

/**
 * Het antwoord op een uitnodiging terug naar de organisator.
 *
 * **Waarom de app dit zelf doet.** Bij een uitnodiging hoort een antwoord dat
 * de organisator in zijn eigen agenda ziet: het iMIP-bericht "Geaccepteerd: …"
 * met een .ics eraan waarin alleen jouw deelnemersregel veranderd is. Normaal
 * verstuurt de agendaserver dat — via de CalDAV scheduling-outbox (RFC 6638).
 * Op deze mailserver bestaat die niet: `/dav/cal/<gebruiker>/outbox/` geeft
 * 404, en ook de JMAP-weg stuurt niets. Gemeten gevolg: antwoorden die in
 * Outlook gegeven werden stonden wél als "Geaccepteerd: …" in Verzonden,
 * die uit Y-Next niet — de organisator hoorde er dus nooit iets van.
 *
 * Daarom gaat het antwoord hier als gewone ERPNext-mail de deur uit. Dat heeft
 * een prettige bijkomstigheid: het is een `Communication`, dus het staat ook
 * gewoon bij je verzonden post.
 */

/** De woorden die Outlook en Thunderbird in het onderwerp zetten. */
export const VOORVOEGSEL_NL: Record<Deelnamestatus, string> = {
  accepted: "Geaccepteerd",
  declined: "Afgewezen",
  tentative: "Voorlopig",
  "needs-action": "Antwoord",
};

export interface AntwoordMail {
  /** De organisator; die wacht op je antwoord. */
  aan: string;
  onderwerp: string;
  /** Het .ics met jouw stand erin, als METHOD:REPLY. */
  ics: string;
}

function schoon(waarde?: string): string {
  return String(waarde || "").trim().toLowerCase();
}

/**
 * Het antwoord samenstellen, of `null` als er niets te versturen valt.
 *
 * Niets te versturen bij: geen organisator (dan is er niemand die het moet
 * weten), de organisator ben jij (je eigen afspraak), of geen bestand om mee
 * te sturen — een antwoord zonder .ics kan de agenda van de organisator niet
 * bijwerken en is dus een leeg gebaar.
 */
export function maakAntwoordMail(opts: {
  organisator?: string;
  ik: string;
  titel?: string;
  stand: Deelnamestatus;
  ics: string;
  voorvoegsel: Record<Deelnamestatus, string>;
}): AntwoordMail | null {
  const naar = schoon(opts.organisator);
  const ik = schoon(opts.ik);
  if (!naar || !ik || naar === ik) return null;
  if (!opts.ics.trim()) return null;
  const titel = String(opts.titel || "").trim() || "afspraak";
  return {
    aan: naar,
    onderwerp: `${opts.voorvoegsel[opts.stand]}: ${titel}`,
    ics: zetDeelname(opts.ics, opts.ik, opts.stand),
  };
}

/**
 * Versturen. Het .ics gaat als bijlage mee: `sendMail` hangt bijlagen aan de
 * Communication, en dat is de enige vorm die ERPNext hier aanbiedt. Outlook en
 * Thunderbird lezen een meegestuurde .ics met METHOD:REPLY als antwoord.
 */
export async function verstuurAntwoordMail(
  mail: AntwoordMail, ik: string, tekst: string,
): Promise<{ name: string }> {
  const bestand = new File([mail.ics], "antwoord.ics", { type: "text/calendar" });
  return sendMail({
    to: mail.aan,
    subject: mail.onderwerp,
    html: `<p>${tekst}</p>`,
    attachments: [bestand],
    sender: ik,
  });
}
