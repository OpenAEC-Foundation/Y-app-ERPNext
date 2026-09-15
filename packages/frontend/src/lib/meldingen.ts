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

/** Eén ongelezen bericht, zoals het uit `Notification Log` komt. */
export interface OngelezenRij {
  /** Wie het stuurde; `owner` is de terugval voor oudere regels. */
  from_user?: string;
  owner?: string;
  /** De voorvertoning van de tekst. */
  subject?: string;
  creation?: string;
}

export interface Berichtsamenvatting {
  aantal: number;
  /** Naam of, bij gebrek daaraan, het deel vóór de @ van de afzender. */
  van: string;
  tekst: string;
}

/**
 * Waar de melding over gaat: het nieuwste ongelezen bericht, plus hoeveel er
 * in totaal open staan.
 *
 * Het nieuwste en niet het eerste uit de lijst: dát bericht is de reden dat de
 * melding afgaat, en de volgorde waarin de server ze teruggeeft is niet iets
 * om op te bouwen.
 */
export function vatOngelezenSamen(
  rijen: OngelezenRij[],
  naamVan?: (gebruiker: string) => string,
): Berichtsamenvatting {
  const lijst = rijen || [];
  if (lijst.length === 0) return { aantal: 0, van: "", tekst: "" };
  let nieuwste = lijst[0];
  for (const rij of lijst) {
    if (String(rij.creation || "") > String(nieuwste.creation || "")) nieuwste = rij;
  }
  const afzender = String(nieuwste.from_user || nieuwste.owner || "").trim();
  const naam = naamVan?.(afzender) || "";
  return {
    aantal: lijst.length,
    van: naam || afzender.split("@")[0] || "",
    tekst: String(nieuwste.subject || "").trim(),
  };
}
