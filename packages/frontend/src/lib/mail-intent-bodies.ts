/**
 * Mailteksten ophalen zodat de herkenning óók in de berichtenlijst werkt.
 *
 * `classifyMailIntent` weegt onderwerp- én bodytreffers. Het leespaneel heeft
 * de body (die is toch al opgehaald), de lijst niet — dus een offerteaanvraag
 * of lead waarvan het bewijs in de tekst staat en niet in het onderwerp kreeg
 * wél een balk bij het openen, maar géén label in de inbox.
 *
 * Live gemeten op de doelinstance: van de vier verkoopsignalen in de mailbox
 * haalde er maar één de drempel op het onderwerp alleen ("Offerte aanvraag
 * website …"); de andere drie ("CAD software voor de gemeente …", "Open PDF
 * Studio", "Open-source parametric CAD project – …") bleven onzichtbaar tot je
 * ze opende. Precies de klacht "hij moet die tag óók in de inbox krijgen".
 *
 * ── Waarom niet gewoon `content` in de lijstquery ────────────────────────
 *
 * `Communication.content` is een LONGTEXT; op de doelinstance gemiddeld 8 kB
 * per mail. Dat bij elke lijstpagina meesturen is ~400 kB voor een pagina van
 * 50 — voor een hulpmiddel dat op de meeste rijen niets oplevert. Deze module
 * haalt daarom **alleen de twijfelgevallen** op, ná de eerste render, in één
 * batch, en onthoudt het resultaat per Communication-docname.
 *
 * Kandidaat is een ontvangen mail die (a) op het onderwerp alleen geen
 * bedoeling oplevert, (b) niet al aan een document hangt, en (c) van iemand
 * komt die een klant of een onbekende is — geen collega, geen leverancier,
 * geen no-reply. Dat sluit precies de rijen uit waar een body per definitie
 * niets aan verandert.
 */

import { fetchList } from "./erpnext.ts";
import { plainTextFromHtml } from "./invoice-detect.ts";
import { classifyMailIntent, classifySender, type MailIntentContext } from "./mail-intent.ts";

/** Eén rij zoals de berichtenlijst hem kent (de velden die de keuze bepalen). */
export interface IntentBodyCandidate {
  name: string;
  subject: string;
  sender: string;
  senderName?: string;
  date: string;
  hasAttachments?: boolean;
  /** `true` voor een verzonden bericht; die krijgen nooit een voorstel. */
  sent?: boolean;
  /** Doctype waar de mail al aan hangt. */
  linkedDoctype?: string;
}

/** Hoeveel mails per ronde hun tekst krijgen. 30 × ~8 kB ≈ 240 kB. */
export const MAX_INTENT_BODIES = 30;
/** Hoeveel tekst per mail bewaard wordt; genoeg voor aanhef, vraag en handtekening. */
const MAX_BODY_CHARS = 4000;

/**
 * Welke rijen hun tekst nodig hebben. Puur: geen netwerk, zodat de keuze met
 * echte onderwerpen te toetsen is.
 *
 * `known` bevat de docnames waarvan de tekst al opgehaald is — óók de mails
 * die niets opleverden. Zonder die laatste zou het effect elke render dezelfde
 * lege batch opnieuw vragen.
 */
export function pickIntentBodyCandidates(
  rows: IntentBodyCandidate[],
  ctx: MailIntentContext,
  known: ReadonlySet<string>,
  limit: number = MAX_INTENT_BODIES,
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (out.length >= limit) break;
    if (!row.name || known.has(row.name)) continue;
    if (row.sent || row.linkedDoctype) continue;

    // Al een bedoeling op het onderwerp alleen? Dan verandert de tekst er
    // niets meer aan — de lijst toont hooguit één label per rij.
    const onSubject = classifyMailIntent({
      subject: row.subject,
      sender: row.sender,
      senderName: row.senderName,
      attachmentNames: [],
      hasAttachment: row.hasAttachments,
      mailDate: row.date,
      direction: "received",
    }, ctx);
    if (onSubject.kind !== "none") continue;

    // Alleen afzenders die tot een lead of offerteaanvraag kúnnen leiden.
    const facts = classifySender(row.sender, ctx);
    if (facts.automated) continue;
    if (facts.relation !== "customer" && facts.relation !== "unknown") continue;

    out.push(row.name);
  }
  return out;
}

/**
 * Haal de teksten op als platte tekst. Namen die ERPNext niet teruggeeft (of
 * die leeg zijn) krijgen een lege string, zodat de aanroeper ze als "gedaan"
 * kan onthouden en niet elke render opnieuw vraagt.
 */
export async function fetchIntentBodies(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (names.length === 0) return out;
  const wanted = names.slice(0, MAX_INTENT_BODIES);
  for (const name of wanted) out.set(name, "");
  try {
    const rows = await fetchList<{ name?: string; content?: string }>("Communication", {
      fields: ["name", "content"],
      filters: [["name", "in", wanted]],
      limit_page_length: wanted.length,
    });
    for (const row of rows) {
      if (!row?.name) continue;
      out.set(row.name, plainTextFromHtml(row.content ?? "").slice(0, MAX_BODY_CHARS));
    }
  } catch {
    // Geen leesrecht of netwerkfout: de lijst houdt zijn onderwerp-herkenning.
  }
  return out;
}
