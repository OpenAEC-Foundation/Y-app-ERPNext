/**
 * Het geciteerde origineel in het opstelvenster.
 *
 * ── Wat er veranderde, en waarom ──────────────────────────────────────────
 *
 * Het citaat wás een apart veld (`ErpDraft.quoteHtml`) dat onder het typvak
 * hing in een eigen, standaard dichtgeklapt paneeltje. Het ging wél mee de
 * deur uit, maar tijdens het schrijven zag je het niet — precies de klacht:
 * "bij het beantwoorden wil ik wél kunnen zien wat er in die vorige mail
 * stond." En je kon er niets aan doen: niet knippen, niet inkorten, niet
 * ertussen typen, want het stond buiten de editor.
 *
 * Nu is het citaat **gewone inhoud van de opsteller**: één `<blockquote>` aan
 * het einde van `draft.body`, herkenbaar aan het attribuut `data-y-quote`.
 * Daarmee is het te lezen, te scrollen, te bewerken en te verwijderen zoals
 * elke andere alinea — en blijft het bij verzenden onder de handtekening
 * staan, omdat `splitQuoteFromBody` het er vlak voor verzenden weer afhaalt en
 * `buildOutgoingHtml` de volgorde tekst → handtekening → citaat bewaakt.
 *
 * ── De inklapregel (één regel, expres) ───────────────────────────────────
 *
 * Een citaat van **meer dan `QUOTE_COLLAPSE_LINES` (15) regels** staat bij het
 * openen ingeklapt achter een uitklapper; korter dan dat staat het gewoon
 * open. De reden voor de drempel is het kleine opstelvenster: een draad van
 * veertig regels zou de schrijfruimte opeten, terwijl een citaat van vier
 * regels juist context geeft die je meteen wilt zien. Inklappen is puur een
 * weergavekwestie (CSS op `blockquote[data-y-quote]`, zie `index.css`) — de
 * inhoud staat er altijd volledig in en gaat altijd volledig mee.
 *
 * ── Waarom een attribuut en geen positie-afspraak ────────────────────────
 *
 * "Het laatste blockquote is het citaat" breekt zodra iemand zelf een citaat
 * invoegt met de citaatknop van de werkbalk, of onder het citaat verder typt.
 * Het attribuut overleeft `sanitizeEditorHtml` (het staat als enige
 * `data-*`-attribuut op de whitelist in `mail-html.ts`) en overleeft dus ook
 * het opslaan en terughalen van een concept.
 *
 * Puur en DOM-loos, om dezelfde reden als `mail-html.ts`: zo is het met
 * `node --test` te controleren zonder jsdom.
 */

import { sanitizeEditorHtml } from "./mail-html.ts";

/** Het attribuut dat ons citaatblok markeert. */
export const QUOTE_ATTR = "data-y-quote";

/**
 * Boven hoeveel regels het citaat ingeklapt opent. Zie de kop voor de
 * afweging; 15 regels is ruwweg een half opstelvenster op een laptop.
 */
export const QUOTE_COLLAPSE_LINES = 15;

/** De stijl van het citaatblok in de opsteller — dezelfde dunne lijn die de
 *  ontvanger straks ook ziet (`buildOutgoingHtml` zet 'm daar opnieuw). */
const QUOTE_STYLE =
  "margin:16px 0 0 0;padding:0 0 0 12px;border-left:2px solid #cbd5e1;color:#475569";

/** Opent het citaatblok; `[^>]*` volstaat omdat wij de tag zelf schrijven. */
const QUOTE_OPEN_RE = new RegExp(`<blockquote\\b[^>]*\\b${QUOTE_ATTR}\\b[^>]*>`, "i");
/** Elke blockquote-tag, om geneste citaten in het origineel goed te tellen. */
const ANY_BLOCKQUOTE_RE = /<(\/?)blockquote\b[^>]*>/gi;

/**
 * Bouwt het citaatblok voor een antwoord of doorsturen.
 *
 * De originele mail passeert `sanitizeEditorHtml`: hij komt van buiten (een
 * afzender die je niet kent) en belandt hier in een `contentEditable`. Zonder
 * dat filter zou een `<img onerror=…>` of een `javascript:`-link uit een
 * binnengekomen mail in je eigen opsteller uitgevoerd worden — en daarna
 * ongefilterd meegaan naar de volgende ontvanger.
 *
 * @param label   "Op <datum> schreef <naam> <adres>:" — als platte tekst.
 * @param bodyHtml De HTML van het originele bericht.
 * @param noticeHtml Optionele extra regel boven het origineel (bij doorsturen
 *   de opsomming van bijlagen die níet automatisch meegaan).
 */
export function buildQuoteBlock(input: {
  label: string;
  bodyHtml: string;
  noticeHtml?: string;
}): string {
  const label = escapeText(input.label || "");
  const notice = (input.noticeHtml || "").trim();
  const body = sanitizeEditorHtml(input.bodyHtml || "");
  const head = label ? `<p>${label}</p>` : "";
  return (
    `<blockquote ${QUOTE_ATTR}="1" style="${QUOTE_STYLE}">` +
    `${head}${notice ? sanitizeEditorHtml(notice) : ""}${body}` +
    "</blockquote>"
  );
}

/**
 * De begininhoud van de opsteller bij een antwoord: twee lege alinea's waar de
 * cursor landt, met het citaat eronder. De lege alinea's zijn er zodat er
 * meteen ruimte is om te typen zonder in het citaat te belanden.
 */
export function buildComposeBodyWithQuote(quoteBlock: string): string {
  const quote = (quoteBlock || "").trim();
  if (!quote) return "";
  return `<p><br></p><p><br></p>${quote}`;
}

/** Staat er een citaatblok in deze opsteller-inhoud? */
export function hasQuote(html: string): boolean {
  return QUOTE_OPEN_RE.test(String(html || ""));
}

/**
 * Splitst de opsteller-inhoud in "wat de gebruiker schreef" en "het citaat".
 *
 * Geen citaat → alles is getypte tekst. Wél een citaat → de inhoud ervan komt
 * er als `quote` uit (zonder het omhullende `<blockquote>`, want
 * `buildOutgoingHtml` zet daar zijn eigen, mailclient-veilige omhulsel omheen)
 * en de rest is `typed`.
 *
 * Tekst die iemand *onder* het citaat typte wordt bij `typed` gevoegd, dus
 * boven de handtekening. Dat is bewust: de volgorde in een verzonden mail is
 * tekst → handtekening → citaat, en een losse alinea onder een citaat achter
 * de handtekening laten hangen zou hem in een lange draad onvindbaar maken.
 */
export function splitQuoteFromBody(html: string): { typed: string; quote: string } {
  const src = String(html || "");
  const open = QUOTE_OPEN_RE.exec(src);
  if (!open) return { typed: src, quote: "" };

  const innerStart = open.index + open[0].length;
  let depth = 1;
  let innerEnd = src.length;
  let afterStart = src.length;

  ANY_BLOCKQUOTE_RE.lastIndex = innerStart;
  let m: RegExpExecArray | null;
  while ((m = ANY_BLOCKQUOTE_RE.exec(src))) {
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) {
      innerEnd = m.index;
      afterStart = m.index + m[0].length;
      break;
    }
  }
  ANY_BLOCKQUOTE_RE.lastIndex = 0;

  return {
    typed: src.slice(0, open.index) + src.slice(afterStart),
    quote: src.slice(innerStart, innerEnd),
  };
}

/**
 * Ruwe schatting van het aantal regels dat een stuk HTML oplevert.
 *
 * Bewust een schatting: exact meten kan alleen in een echte browser-layout, en
 * daar hangt hier niets vanaf — het antwoord bepaalt alleen of het citaat
 * ingeklapt of open begint. Blokafsluitingen en `<br>` tellen als regeleinde,
 * lege regels tellen niet mee.
 */
export function estimateQuoteLines(html: string): number {
  const text = String(html || "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|blockquote|pre|dd|dt|table)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  return text
    .split("\n")
    .filter((line) => line.replace(/&nbsp;|[\s\u00a0]/g, "") !== "").length;
}

/**
 * Opent het citaat ingeklapt? Zie `QUOTE_COLLAPSE_LINES` voor de regel.
 * Zonder citaat is er niets in te klappen.
 */
export function shouldCollapseQuote(html: string): boolean {
  const { quote } = splitQuoteFromBody(html);
  if (!quote) return false;
  return estimateQuoteLines(quote) > QUOTE_COLLAPSE_LINES;
}

/** Escapet platte tekst voor gebruik in de citaatkop. */
function escapeText(text: string): string {
  return String(text || "").replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
}
