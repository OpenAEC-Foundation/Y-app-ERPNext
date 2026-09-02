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
