/**
 * De werkvoorraad: hoeveel uur werk staat er open, en kan dat opgepakt worden?
 *
 * Pure module — geen netwerk, geen React. De indeling is de hele vraag ("telt
 * dit mee?"), en die hoort met `node --test` te beantwoorden te zijn in plaats
 * van door naar een scherm te kijken.
 *
 * ── Waarom `workflow_state` en niet `status` ──────────────────────────────
 *
 * Het Task-doctype draagt allebei. `status` is dat van ERPNext zelf en loopt
 * achter: op deze installatie staan 187 taken op `Overdue` terwijl hun
 * workflow al op `Completed` staat — afgerond werk dat op `status` nog als
 * openstaand meetelt. `workflow_state` is wat mensen zelf bijhouden, dus dat
 * is de waarheid. Draait er geen workflow op een installatie, dan is er geen
 * `workflow_state` en valt de indeling terug op `status`.
 *
 * ── Waarom "wacht" apart staat ────────────────────────────────────────────
 *
 * Werk dat op iemand anders wacht — een beoordeling, ontbrekende informatie,
 * bewust geparkeerd — is geen capaciteit die je deze week kunt inzetten. Bij
 * elkaar optellen maakt de voorraad groter dan wat er te doen valt, en dat is
 * precies het getal waarop je zou gaan plannen.
 */

/** Het minimum dat een taak moet dragen om meegeteld te kunnen worden. */
export interface VoorraadTaak {
  name: string;
  /** De stand uit de workflow; leeg wanneer die niet draait. */
  workflow_state?: string;
  /** ERPNext's eigen status; terugval als er geen workflow is. */
  status?: string;
  /** Begrote uren. */
  expected_time?: number;
  /** Al geboekte uren. */
  actual_time?: number;
}

export type Voorraadsoort = "actief" | "wacht" | "klaar";

/*
 * Er is geen lijst van "actieve" standen, en dat is opzet: actief is wat
 * overblijft. Open, Working en Overdue vallen er vanzelf onder, en een stand
 * die later wordt bedacht ook — zie `soortVan`.
 */

/** Standen waarin het werk op iets of iemand anders wacht. */
const WACHT = new Set([
  "on hold",
  "information required",
  "pending review",
  "pending review intern",
  "pending review extern",
  "to discussed",
]);

/** Standen waarin er niets meer te doen valt. */
const KLAAR = new Set(["completed", "cancelled", "template", "closed"]);

/**
 * Waar hoort deze taak bij?
 *
 * Onbekende standen tellen als `actief`. Dat is de veilige kant: een stand die
 * later wordt toegevoegd verdwijnt zo niet stilletjes uit de voorraad — je
 * ziet hem staan en kunt hem alsnog indelen. Andersom zou werk onzichtbaar
 * worden zonder dat iemand het merkt.
 */
export function soortVan(taak: VoorraadTaak): Voorraadsoort {
  const stand = String(taak.workflow_state || taak.status || "").trim().toLowerCase();
  if (!stand) return "actief";
  if (KLAAR.has(stand)) return "klaar";
  if (WACHT.has(stand)) return "wacht";
  return "actief";
}

/** Eén hoop werk. */
export interface Voorraadhoop {
  /** Aantal taken. */
  taken: number;
  /** Som van de begrote uren. */
  begroot: number;
  /** Som van de al geboekte uren op die taken. */
  geboekt: number;
  /**
   * Wat er volgens de begroting nog te doen is: begroot min geboekt, nooit
   * onder nul. Een taak waar meer op geboekt staat dan begroot levert geen
   * negatieve voorraad op — dat zou het totaal van ander werk wegpoetsen.
   */
  resterend: number;
  /**
   * Taken zonder begrote uren. Die tellen wel als taak maar niet als uren, en
   * dat hoort erbij te staan: op deze installatie heeft het merendeel geen
   * schatting, en dan is een urentotaal zonder dit getal misleidend.
   */
  zonderSchatting: number;
}

export interface Werkvoorraad {
  actief: Voorraadhoop;
  wacht: Voorraadhoop;
  /** Per stand, aflopend op begrote uren — voor de uitsplitsing. */
  perStand: { stand: string; soort: Voorraadsoort; taken: number; begroot: number }[];
}

function legeHoop(): Voorraadhoop {
  return { taken: 0, begroot: 0, geboekt: 0, resterend: 0, zonderSchatting: 0 };
}

/**
 * Telt de werkvoorraad op. Afgeronde en geannuleerde taken vallen weg.
 */
export function telWerkvoorraad(taken: VoorraadTaak[]): Werkvoorraad {
  const uit: Werkvoorraad = { actief: legeHoop(), wacht: legeHoop(), perStand: [] };
  const standen = new Map<string, { stand: string; soort: Voorraadsoort; taken: number; begroot: number }>();

  for (const taak of taken || []) {
    const soort = soortVan(taak);
    if (soort === "klaar") continue;
    const hoop = uit[soort];
    const begroot = getal(taak.expected_time);
    const geboekt = getal(taak.actual_time);

    hoop.taken += 1;
    hoop.begroot += begroot;
    hoop.geboekt += geboekt;
    hoop.resterend += Math.max(begroot - geboekt, 0);
    if (begroot <= 0) hoop.zonderSchatting += 1;

    const stand = String(taak.workflow_state || taak.status || "").trim() || "—";
    const rij = standen.get(stand) ?? { stand, soort, taken: 0, begroot: 0 };
    rij.taken += 1;
    rij.begroot += begroot;
    standen.set(stand, rij);
  }

  uit.perStand = [...standen.values()].sort((a, b) => b.begroot - a.begroot || b.taken - a.taken);
  return uit;
}

function getal(waarde: unknown): number {
  const n = typeof waarde === "number" ? waarde : Number(waarde);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Uren zoals ze op het scherm horen: één decimaal, en geen `-0`. */
export function toonUren(uren: number): string {
  const afgerond = Math.round((uren || 0) * 10) / 10;
  return (afgerond === 0 ? 0 : afgerond).toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
