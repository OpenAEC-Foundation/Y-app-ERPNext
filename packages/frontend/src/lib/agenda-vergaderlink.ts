/**
 * De videobellink uit de omschrijving van een afspraak — Jitsi of Teams.
 *
 * Beide staan als gewone URL ergens in de tekst: Jitsi omdat Y-Next hem daar
 * zelf in zet (zie `jitsiRoom` in Agenda.tsx), Teams omdat Outlook/Teams dat
 * doet bij het aanmaken van een Teams-vergadering ("Microsoft Teams
 * meeting / Deelnemen op internet ... https://teams.microsoft.com/l/...").
 * Wie zo'n afspraak van buitenaf krijgt, heeft dus geen apart veld nodig —
 * alleen deze ene regex per soort.
 */

export type VergaderSoort = "jitsi" | "teams";

// Een link eindigt bij witruimte of bij de haakjes/aanhalingstekens waar
// Outlook hem in platte tekst omheen zet ("<https://...>").
const PATRONEN: { soort: VergaderSoort; regex: RegExp }[] = [
  { soort: "jitsi", regex: /https:\/\/meet\.jit\.si\/[^\s<>"']+/ },
  // Zakelijk ("teams.microsoft.com/meet/..." en "/l/meetup-join/...") en
  // persoonlijk ("teams.live.com/meet/..."). Niet de links naar
  // vergaderopties of hulp: alleen die om deel te nemen.
  { soort: "teams", regex: /https:\/\/(?:teams\.microsoft\.com\/(?:meet|l\/meetup-join)|teams\.live\.com\/meet)\/[^\s<>"']+/ },
];

/** Vindt de eerste videobellink in de omschrijving, met de soort erbij. */
export function vindVergaderlink(omschrijving: string | undefined): { url: string; soort: VergaderSoort } | null {
  if (!omschrijving) return null;
  for (const { soort, regex } of PATRONEN) {
    const treffer = omschrijving.match(regex);
    if (treffer) return { url: treffer[0], soort };
  }
  return null;
}
