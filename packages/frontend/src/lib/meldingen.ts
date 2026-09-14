/**
 * Meldingen voor nieuwe post en nieuwe berichten — de regel erachter.
 *
 * Pure module: wanneer er wél en niet gemeld wordt is de hele vraag, en die
 * hoort met `node --test` te beantwoorden te zijn in plaats van door te wachten
 * tot er post binnenkomt. Het pollen en het tonen staat in
 * `meldingen-poller.ts`.
 *
 * De bestaande meldingen (`BackgroundSyncProvider`) hangen aan
 * `/api/mail/unseen-summary` en `/api/messenger/all-conversations`: routes van
 * de Express-server die op deze installatie niet bestaat. Op Y-Next werd er dus
 * nooit iets gemeld, en stond de teller in de zijbalk alleen goed zolang je het
 * scherm zelf openhad. Deze poller telt hetzelfde uit ERPNext zelf.
 *
 * Twee keuzes:
 *
 * - **Pollen, geen socket.** Y-Next is een Frappe Web Page; het realtime-kanaal
 *   van Frappe hangt aan de desk-bundel. Twee lijsttellingen per minuut is wat
 *   het kost, en dat is ruim binnen wat de rest van de app al doet.
 * - **Niet tellen op het scherm dat er zelf over gaat.** Staat de mail open, dan
 *   houdt dat scherm zijn eigen teller bij — en die loopt vóór op de server
 *   zodra je een bericht opent. Een poller die er dwars doorheen telt zet de
 *   badge terug op een getal dat de gebruiker net heeft weggeklikt.
 */

/** Wat er bij de vorige meting stond; `null` = nog niets gemeten. */
export type Meldingstand = number | null;

export interface Meldinguitslag {
  /** Is er iets bij gekomen sinds de vorige meting? */
  melden: boolean;
  /** Hoeveel erbij. Nul wanneer er niets te melden valt. */
  nieuw: number;
  /** De stand om de volgende keer mee te vergelijken. */
  stand: number;
}

/**
 * Moet deze meting een melding opleveren?
 *
 * De eerste meting meldt nooit: die zet alleen de stand. Anders zou de app
 * pingen zodra je hem opent, met alles wat er al lag — en dan leert iedereen
 * de melding wegklikken.
 */
export function bepaalMelding(vorig: Meldingstand, nu: number): Meldinguitslag {
  const gemeten = Number(nu);
  if (!Number.isFinite(gemeten)) {
    return { melden: false, nieuw: 0, stand: vorig ?? 0 };
  }
  const nieuweStand = Math.max(0, Math.round(gemeten));
  if (vorig === null) return { melden: false, nieuw: 0, stand: nieuweStand };
  if (nieuweStand > vorig) {
    return { melden: true, nieuw: nieuweStand - vorig, stand: nieuweStand };
  }
  // Gezakt of gelijk: geen melding, maar de stand zakt wél mee. Anders blijft
  // hij op de oude piek staan en meldt het volgende bericht niets.
  return { melden: false, nieuw: 0, stand: nieuweStand };
}
