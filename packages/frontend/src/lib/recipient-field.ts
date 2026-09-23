/**
 * Keuzelogica van het adresveld (Aan/Cc/Bcc) — los van React.
 *
 * Het ophalen en rangschikken van suggesties staat in
 * `contact-suggestions.ts`; hier staat alleen wat er met een *lijst* gebeurt
 * zodra hij op het scherm staat: welke rij is actief na een pijltje, welke
 * toets kiest er een, en hoe ziet het veld eruit na de keuze. Dat is precies
 * het deel dat je zonder DOM wil kunnen testen.
 */
import {
  type RecipientSuggestion,
  getCurrentToken, replaceCurrentToken,
} from "./contact-suggestions.ts";

/**
 * Nieuwe actieve rij na een pijltoets. `null` = deze toets gaat niet over de
 * lijst en mag doorlopen naar het invoerveld.
 *
 * Rondloopend: onderaan omlaag springt naar de eerste rij en omgekeerd. Dat
 * scheelt bij een korte lijst het gevoel dat de toets "vastloopt".
 */
export function nextSuggestionIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowUp") return (current - 1 + count) % count;
  // Grote sprongen: handig bij de volle lijst van twintig.
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * Kiest deze toets de actieve suggestie? Enter en Tab allebei — Tab omdat dat
 * de toets is waarmee je toch al naar het volgende veld gaat, en het adres
 * halverwege getypt laten staan is nooit wat je bedoelde.
 */
export function isSelectKey(key: string): boolean {
  return key === "Enter" || key === "Tab";
}

/**
 * Wat er in het veld komt te staan als je een suggestie kiest: het
 * halfgetypte adres onder de cursor wordt vervangen, en er komt ", " achter
 * zodat je meteen door kunt typen aan het volgende adres.
 */
export function applyRecipientSuggestion(
  value: string,
  caretPos: number,
  email: string,
): { next: string; newCaret: number } {
  const { next, newCaret } = replaceCurrentToken(value, caretPos, email);
  // `replaceCurrentToken` zet altijd ", " achter het gekozen adres. Kies je
  // een suggestie midden in een rij adressen, dan stond dáár al een komma —
  // en krijg je "a@b.nl, , c@d.nl". De dubbele scheiding hier weghalen in
  // plaats van in de gedeelde functie: die wordt ook door het agendaveld en
  // het oude opstelvenster gebruikt, en hun gedrag hoeft niet te wijzigen.
  const tail = next.slice(newCaret).replace(/^[,;]\s*/, "");
  return { next: next.slice(0, newCaret) + tail, newCaret };
}

/**
 * Onmiddellijke filtering op een eerder opgehaalde lijst, zodat de dropdown
 * tijdens het typen niet leeg knippert terwijl de ERPNext-lookup nog loopt.
 * Zoekt in zowel het adres als de naam — je typt net zo vaak "jansen" als
 * "j.jansen@".
 */
export function filterCachedSuggestions(
  cached: readonly RecipientSuggestion[],
  token: string,
): RecipientSuggestion[] {
  const q = token.trim().toLowerCase();
  if (!q) return [...cached];
  return cached.filter(
    (c) => c.email.toLowerCase().includes(q) || (c.label || "").toLowerCase().includes(q),
  );
}

/**
 * i18n-sleutel voor het bronlabel achter een suggestie. Bewust een vertaling
 * en geen ruwe doctype-naam: "Lead" zegt een gebruiker niets.
 */
export function sourceLabelKey(source: RecipientSuggestion["source"]): string {
  switch (source) {
    case "frequent": return "y_next.mail_recipient_source_frequent";
    case "lead": return "y_next.mail_recipient_source_lead";
    default: return "y_next.mail_recipient_source_contact";
  }
}

/** Het stuk tekst waarop gezocht wordt: alles ná de laatste komma/puntkomma. */
export function tokenAt(value: string, caretPos: number): string {
  return getCurrentToken(value, caretPos).token;
}

/* ─── Adresblokjes ─────────────────────────────────────────────────────────
 *
 * Het veld toont elk afgerond adres als blokje, zoals een mailprogramma dat
 * doet. De waarde zelf blijft één tekst (`draft.to`), want zo gaat hij het
 * verzendpad in. Deze functies vertalen tussen die twee: opdelen voor het
 * scherm, samenvoegen voor het concept.
 */

/**
 * Het veld opgedeeld zoals het op het scherm staat: de adressen waar een komma
 * of puntkomma achter staat zijn af en worden blokjes; wat daarna nog getypt
 * wordt, blijft tekst.
 *
 * Een komma binnen aanhalingstekens of punthaken scheidt niets:
 * `"Vroegindeweij, Maarten" <maarten@3bm.co.nl>` is één adres.
 */
export function splitsAdresInvoer(value: string): { klaar: string[]; bezig: string } {
  const klaar: string[] = [];
  let huidig = "";
  let inAanhaling = false;
  let inHaken = false;
  for (const teken of value || "") {
    if (teken === '"' && !inHaken) {
      inAanhaling = !inAanhaling;
    } else if (teken === "<" && !inAanhaling) {
      inHaken = true;
    } else if (teken === ">" && !inAanhaling) {
      inHaken = false;
    } else if ((teken === "," || teken === ";") && !inAanhaling && !inHaken) {
      if (huidig.trim()) klaar.push(huidig.trim());
      huidig = "";
      continue;
    }
    huidig += teken;
  }
  return { klaar, bezig: huidig.replace(/^\s+/, "") };
}

/**
 * Blokjes en lopende tekst weer als één veldwaarde. Na het laatste blokje
 * staat ", ", zodat het volgende adres er meteen achter kan — dezelfde vorm
 * die het veld altijd al had na het kiezen van een suggestie.
 */
export function voegAdresInvoerSamen(klaar: readonly string[], bezig: string): string {
  const lijst = klaar.map((a) => a.trim()).filter(Boolean);
  if (lijst.length === 0) return bezig;
  return lijst.join(", ") + ", " + bezig;
}

/** Het kale adres uit een blokje: `Piet <piet@x.nl>` wordt `piet@x.nl`. */
function adresUitBlokje(blokje: string): string {
  const haken = (blokje || "").match(/<([^>]*)>/);
  return (haken ? haken[1] : blokje || "").trim();
}

/**
 * Hoe een gekozen suggestie in het veld komt: met naam, zoals een
 * mailprogramma hem toont — `Maarten Vroegindeweij <maarten@3bm.co.nl>`.
 * Tekens die in een adresregel iets betekenen (komma, puntkomma,
 * aanhalingstekens, punthaken) gaan uit de naam; anders valt het adres bij het
 * versturen in stukken.
 */
export function adresMetNaam(email: string, naam?: string): string {
  const adres = (email || "").trim();
  const schoon = (naam || "").replace(/[",;<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!schoon || schoon.toLowerCase() === adres.toLowerCase()) return adres;
  return `${schoon} <${adres}>`;
}

/**
 * Een gekozen suggestie wordt een blokje in plaats van het zoekwoord. Staat
 * dat adres er al, dan komt het er geen tweede keer bij — anders krijgt
 * iemand de mail dubbel.
 */
export function kiesAdres(value: string, email: string, naam?: string): string {
  const { klaar } = splitsAdresInvoer(value);
  const doel = (email || "").trim().toLowerCase();
  if (klaar.some((k) => adresUitBlokje(k).toLowerCase() === doel)) {
    return voegAdresInvoerSamen(klaar, "");
  }
  return voegAdresInvoerSamen([...klaar, adresMetNaam(email, naam)], "");
}

/** Het veld zonder het blokje op plek `index`; de lopende tekst blijft staan. */
export function zonderBlokje(value: string, index: number): string {
  const { klaar, bezig } = splitsAdresInvoer(value);
  return voegAdresInvoerSamen(klaar.filter((_, i) => i !== index), bezig);
}

/**
 * Een blokje weer als tekst, om het aan te passen. Wat er al getypt stond,
 * wordt eerst zelf een blokje: het mag niet stilletjes verdwijnen.
 */
export function blokjeTerugNaarTekst(value: string, index: number): string {
  const { klaar, bezig } = splitsAdresInvoer(value);
  const blokje = klaar[index];
  if (blokje === undefined) return value;
  const rest = klaar.filter((_, i) => i !== index);
  if (bezig.trim()) rest.push(bezig.trim());
  return voegAdresInvoerSamen(rest, blokje);
}

/**
 * Wat nog getypt staat, wordt ook een blokje — bij Enter, Tab of het verlaten
 * van het veld. Een leeg stuk verandert niets.
 */
export function rondAdresAf(value: string): string {
  const { klaar, bezig } = splitsAdresInvoer(value);
  if (!bezig.trim()) return value;
  return voegAdresInvoerSamen([...klaar, bezig.trim()], "");
}

/**
 * Ziet het adres in dit blokje eruit als een bruikbaar e-mailadres? Zo niet,
 * dan kleurt het blokje rood: een tikfout zie je dan vóór het versturen, niet
 * pas aan de foutmelding van de mailserver.
 */
export function isBruikbaarAdres(blokje: string): boolean {
  return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:".]{2,}$/.test(adresUitBlokje(blokje));
}
