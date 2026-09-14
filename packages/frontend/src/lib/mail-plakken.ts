/**
 * De keuze die je krijgt nadat je iets in een e-mail hebt geplakt.
 *
 * Plakken uit Word, een website of een andere mail sleept opmaak mee die er
 * bijna nooit bij hoort: lettertypen, achtergrondkleuren, tabellen om één
 * regel heen. Ctrl+Shift+V bestond al, maar dat moet je wéten en vooraf
 * bedenken. Achteraf kiezen werkt beter: je plakt, je ziet het resultaat, en
 * pas dan beslis je.
 *
 * Deze module bevat de beslissingen — welke keuzes zinnig zijn, en hoe de
 * markering weer uit de tekst gaat. Het aanwijzen in het tekstvak zelf staat
 * in `components/mail/RichTextEditor`.
 */

import { markdownNaarHtml } from "./mail-markdown.ts";
import { plainTextToHtml } from "./mail-html.ts";

/** Het attribuut waarmee het zojuist geplakte stuk gemerkt wordt. */
export const PLAK_ATTRIBUUT = "data-plak";

export type Plakvorm = "opmaak" | "tekst" | "markdown";

/**
 * Welke keuzes hebben zin voor wat er op het klembord stond?
 *
 * "Opmaak behouden" alleen als er opmaak wás — anders is het dezelfde uitkomst
 * als "alleen tekst" en dan is de keuze nep. "Als Markdown" alleen als de
 * tekst er ook naar uitziet; een knop die niets doet maakt de andere knoppen
 * ongeloofwaardig.
 */
export function plakvormen(html: string, tekst: string): Plakvorm[] {
  const uit: Plakvorm[] = [];
  if (String(html || "").trim()) uit.push("opmaak");
  if (String(tekst || "").trim()) {
    uit.push("tekst");
    if (lijktMarkdown(tekst)) uit.push("markdown");
  }
  // Eén keuze is geen keuze.
  return uit.length > 1 ? uit : [];
}

/**
 * Ziet deze tekst eruit als Markdown?
 *
 * Bewust streng: losse sterretjes of streepjes komen in gewone post ook voor.
 * Er moet iets staan dat je niet per ongeluk typt — een kop, een opsomming van
 * minstens twee regels, een link met haakjes, of nadrukkelijk vette tekst.
 */
export function lijktMarkdown(tekst: string): boolean {
  const t = String(tekst || "");
  if (!t.trim()) return false;
  const regels = t.split(/\r?\n/);
  const opsomming = regels.filter((r) => /^\s*([-*+]|\d+[.)])\s+\S/.test(r)).length;
  return /^#{1,3}\s+\S/m.test(t)
    || opsomming >= 2
    || /\[[^\]]+\]\([^)\s]+\)/.test(t)
    || /\*\*\S[^*]*\S\*\*/.test(t)
    || /^\s*>\s+\S/m.test(t)
    || /```/.test(t);
}

/** De HTML die bij een gekozen vorm hoort. */
export function plakHtml(vorm: Plakvorm, html: string, tekst: string): string {
  if (vorm === "opmaak") return String(html || "");
  if (vorm === "markdown") return markdownNaarHtml(tekst);
  return plainTextToHtml(tekst);
}

/**
 * Haalt de plakmarkering uit een stuk HTML, met behoud van de inhoud.
 *
 * Dit is het vangnet dat ertoe doet: de markering zit alleen in het tekstvak
 * om het geplakte stuk te kunnen terugvinden, en mag nooit in een verstuurde
 * mail belanden. Daarom gaat hij er hier áltijd uit, ook als de gebruiker het
 * keuzeblokje nooit wegklikt.
 */
export function verwijderPlakMarkering(html: string): string {
  let s = String(html || "");
  // Herhalen tot er niets meer verandert: geplakt in geplakt kan.
  for (let ronde = 0; ronde < 5; ronde++) {
    const volgende = s.replace(
      new RegExp(`<span[^>]*\\b${PLAK_ATTRIBUUT}=(["'])[^"']*\\1[^>]*>([\\s\\S]*?)</span>`, "gi"),
      "$2",
    );
    if (volgende === s) break;
    s = volgende;
  }
  return s;
}
