/**
 * Links in platte tekst herkennen, zodat ze aanklikbaar worden.
 *
 * Herkent `http(s)://…`, `www.…` en e-mailadressen. Leestekens direct achter
 * een link ("zie https://3bm.nl.", "(www.3bm.co.nl)") horen bij de zin, niet
 * bij de link, en vallen er dus af. Alleen `http(s)` en `mailto` worden ooit
 * een link: een `javascript:`-adres in een bericht blijft gewone tekst.
 *
 * Twee vormen, voor twee soorten weergave:
 * - `splitLinks` levert stukken op voor React (Berichten, mail zonder opmaak).
 * - `linkifyEscapedHtml` levert veilige HTML voor plekken die een HTML-string
 *   nodig hebben (het citaat bij beantwoorden, de losse mailweergave).
 */

export type LinkPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

// Eén patroon voor alle drie de soorten; de volgorde van de alternatieven
// doet ertoe: een e-mailadres mag niet als "www."-link beginnen.
const PATROON = /\b(?:https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

/** Leestekens die aan het eind van een link bij de zin horen. */
const STAART = /[.,;:!?'"»)\]]+$/;

/** Haal zinsleestekens van het eind af; een sluithaakje alleen als het niet bij de link hoort. */
function knipStaart(ruw: string): string {
  let link = ruw;
  for (;;) {
    const m = link.match(STAART);
    if (!m) return link;
    let staart = m[0];
    // "https://nl.wikipedia.org/wiki/Paal_(fundering)" houdt zijn haakje.
    if (staart.endsWith(")")) {
      const open = (link.match(/\(/g) || []).length;
      const dicht = (link.match(/\)/g) || []).length;
      if (open >= dicht) staart = staart.slice(0, -1);
    }
    if (!staart) return link;
    link = link.slice(0, link.length - staart.length);
    if (!link) return ruw;
  }
}

function hrefVan(link: string): string | null {
  if (/^https?:\/\//i.test(link)) return link;
  if (/^www\./i.test(link)) return `https://${link}`;
  if (link.includes("@")) return `mailto:${link}`;
  return null;
}

export function splitLinks(text: string): LinkPart[] {
  const bron = String(text ?? "");
  const uit: LinkPart[] = [];
  let pos = 0;
  PATROON.lastIndex = 0;
  for (let m = PATROON.exec(bron); m; m = PATROON.exec(bron)) {
    const link = knipStaart(m[0]);
    const href = hrefVan(link);
    if (!href || link.length < 4) continue;
    if (m.index > pos) uit.push({ type: "text", text: bron.slice(pos, m.index) });
    uit.push({ type: "link", text: link, href });
    pos = m.index + link.length;
    PATROON.lastIndex = pos;
  }
  if (pos < bron.length) uit.push({ type: "text", text: bron.slice(pos) });
  return uit;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

/**
 * De link die eindigt waar de cursor staat, voor het opstelvenster: wie een
 * webadres typt en op spatie of Enter drukt, krijgt er een link van.
 * `tekst` is de tekst vóór de cursor; het resultaat geeft de positie van de
 * link daarin (zonder afsluitende leestekens) of `null`.
 */
export function linkAanEind(tekst: string): { start: number; eind: number; href: string } | null {
  const m = String(tekst ?? "").match(/\S+$/);
  if (!m || m.index === undefined) return null;
  const delen = splitLinks(m[0]);
  const i = delen.findIndex((d) => d.type === "link");
  const link = delen[i];
  if (!link || link.type !== "link") return null;
  const start = m.index + delen.slice(0, i).map((d) => d.text).join("").length;
  return { start, eind: start + link.text.length, href: link.href };
}

/** Platte tekst als veilige HTML met klikbare links; regeleinden blijven `\n`. */
export function linkifyEscapedHtml(text: string): string {
  return splitLinks(text).map((p) => (p.type === "text"
    ? escapeHtml(p.text)
    : `<a href="${escapeHtml(p.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.text)}</a>`)).join("");
}
