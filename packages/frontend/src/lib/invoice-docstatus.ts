/**
 * Gedeelde `docstatus`-filters voor het ERPNext-doctype **Sales Invoice**.
 *
 * ERPNext kent drie waarden: `0` = concept (draft), `1` = definitief
 * (submitted/ingeboekt), `2` = geannuleerd.
 *
 * ## Waarom `docstatus != 2` voor statistiek
 *
 * Op instances waar verkoopfacturen lang als concept blijven staan — de
 * factuur is inhoudelijk af, maar nog niet ingeboekt — laat een
 * `docstatus = 1`-filter de omzetcijfers vrijwel leeg. Dat is precies dezelfde
 * situatie als eerder bij Timesheets, waar de keuze al op `docstatus != 2`
 * viel: tel alles wat bestaat, sluit alleen geannuleerde documenten uit.
 *
 * Statistiek- en stuurcijfers die **rechtstreeks op het Sales Invoice-doctype**
 * rekenen gebruiken daarom {@link SALES_INVOICE_ACTIVE_FILTER}. Waar concepten
 * meetellen hoort de UI het conceptdeel zichtbaar te maken (badge, aparte
 * teller of tooltip-regel) — zie {@link draftShare} — zodat niemand een
 * conceptbedrag voor definitieve omzet aanziet.
 *
 * ## Waar dit bewust NIET mag
 *
 * - **GL Entry-gebaseerde schermen** (grootboek, jaarrekening, saldi,
 *   kosteninzicht). Een concept heeft géén boekingsregels; er valt niets te
 *   filteren. Niet forceren.
 * - **Fiscale cijfers** (BTW-aangifte, jaarrekening). Alleen definitieve,
 *   geboekte omzet hoort in een aangifte. Gebruik
 *   {@link SALES_INVOICE_FINAL_FILTER} en toon het conceptbedrag als
 *   informatieregel ernaast.
 * - **Vorderingen / openstaand / DSO / liquiditeit.** Een conceptfactuur is
 *   niet naar de klant verstuurd en dus geen vordering. Ook hier:
 *   `FINAL` rekenen, conceptbedrag apart tonen.
 *
 * Gebruik {@link SALES_INVOICE_DRAFT_FILTER} voor die losse concept-tellers.
 */

/** Eén ERPNext-listfilter: `[veld, operator, waarde]`. */
export type ErpFilter = [field: string, op: string, value: unknown];

/** Concept **en** definitief, nooit geannuleerd — de statistiek-filter. */
export const SALES_INVOICE_ACTIVE_FILTER: ErpFilter = ["docstatus", "!=", 2];

/** Alleen definitieve (ingeboekte) facturen — fiscaal + vorderingen. */
export const SALES_INVOICE_FINAL_FILTER: ErpFilter = ["docstatus", "=", 1];

/** Alleen concepten — voor de "nog niet definitief"-teller naast een FINAL-berekening. */
export const SALES_INVOICE_DRAFT_FILTER: ErpFilter = ["docstatus", "=", 0];

/** ERPNext-docstatus van een concept. */
export const DOCSTATUS_DRAFT = 0;
/** ERPNext-docstatus van een definitief (submitted) document. */
export const DOCSTATUS_SUBMITTED = 1;
/** ERPNext-docstatus van een geannuleerd document. */
export const DOCSTATUS_CANCELLED = 2;

/** Rij met (optioneel) een docstatus — alles wat uit een Sales Invoice-fetch komt. */
export interface WithDocstatus {
  docstatus?: number;
}

/**
 * Is deze rij een conceptfactuur?
 *
 * Rijen zónder `docstatus`-veld (het veld is niet opgevraagd) gelden bewust
 * **niet** als concept: liever een concept missen dan een definitieve factuur
 * ten onrechte als "nog niet definitief" labelen.
 */
export function isDraftInvoice(row: WithDocstatus | null | undefined): boolean {
  return row?.docstatus === DOCSTATUS_DRAFT;
}

/** Uitsplitsing concept vs. definitief over een set facturen. */
export interface DraftShare {
  draftCount: number;
  draftAmount: number;
  finalCount: number;
  finalAmount: number;
  totalCount: number;
  totalAmount: number;
  /** `true` zodra er minstens één concept in de set zit — de render-guard. */
  hasDrafts: boolean;
}

/**
 * Splitst een lijst facturen in het concept- en het definitieve deel.
 *
 * Bedoeld voor de zichtbaarheids-eis: een omzetcijfer dat concepten meetelt
 * moet ernaast kunnen tonen hoeveel daarvan nog concept is.
 *
 * Geannuleerde rijen (`docstatus = 2`) worden genegeerd — ze horen sowieso
 * niet in een set te zitten die met {@link SALES_INVOICE_ACTIVE_FILTER} is
 * opgehaald, maar een lokaal gefilterde lijst mag er niet op stukgaan.
 * Ontbrekende/NaN-bedragen tellen als 0.
 */
export function draftShare<T extends WithDocstatus>(
  rows: readonly T[],
  amountOf: (row: T) => number | null | undefined,
): DraftShare {
  let draftCount = 0;
  let draftAmount = 0;
  let finalCount = 0;
  let finalAmount = 0;

  for (const row of rows) {
    if (row?.docstatus === DOCSTATUS_CANCELLED) continue;
    const raw = amountOf(row);
    const amount = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (isDraftInvoice(row)) {
      draftCount++;
      draftAmount += amount;
    } else {
      finalCount++;
      finalAmount += amount;
    }
  }

  return {
    draftCount,
    draftAmount,
    finalCount,
    finalAmount,
    totalCount: draftCount + finalCount,
    totalAmount: draftAmount + finalAmount,
    hasDrafts: draftCount > 0,
  };
}
