/**
 * Btw bij het inboeken van een inkoopfactuur vanuit de mail.
 *
 * ERPNext kent per bedrijf btw-sjablonen ("Netherlands VAT 21% - 3", 9%, 0%,
 * verlegd, buitenland). Deze module beslist welk sjabloon past bij wat de
 * herkenning in de mail vond, rekent voor de dialoog netto, btw en totaal uit,
 * en maakt de regels die met de boeking meegaan.
 *
 * Een bedrag inclusief btw boekt via ERPNext's eigen weg: de btw-regels staan
 * dan op "inbegrepen" (`included_in_print_rate`) en ERPNext haalt het netto
 * zelf uit het regelbedrag. Zo rekenen de dialoog en de factuur nooit elk op
 * hun eigen manier af.
 */

export interface BtwSjabloon {
  name: string;
  is_default?: number;
}

/** Eén regel uit een Purchase Taxes and Charges (Template). */
export interface BtwRegel {
  charge_type: string;
  account_head: string;
  description?: string;
  rate: number;
  category?: string;
  add_deduct_tax?: string;
  included_in_print_rate?: number;
  cost_center?: string;
}

export type HerkendeBtw = { tarief: number } | { verlegd: true } | undefined;

const VERLEGD_RE = /shifted|verlegd|reverse\s*charge/i;
/** Varianten die niet "het gewone tarief" zijn, ook al staat het percentage erin. */
const BIJZONDER_RE = /included|inclusief|deducted|abroad|buitenland/i;

function tariefUitNaam(naam: string): number | undefined {
  const m = naam.match(/(\d{1,2})\s*%/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Het sjabloon dat bij de herkende btw past. Is er niets herkend, of past
 * niets, dan het standaardsjabloon van het bedrijf. De namen zijn de enige
 * plek waar het tarief staat zonder elk sjabloon apart op te halen; op deze
 * instance staat het percentage er altijd in.
 */
export function kiesBtwSjabloon(sjablonen: readonly BtwSjabloon[], herkend: HerkendeBtw): string | undefined {
  const standaard = sjablonen.find((s) => s.is_default === 1)?.name;
  if (herkend && "verlegd" in herkend) {
    return sjablonen.find((s) => VERLEGD_RE.test(s.name))?.name ?? standaard;
  }
  if (herkend && "tarief" in herkend) {
    const passend = sjablonen.find((s) =>
      !VERLEGD_RE.test(s.name) && !BIJZONDER_RE.test(s.name) && tariefUitNaam(s.name) === herkend.tarief);
    return passend?.name ?? standaard;
  }
  return standaard;
}

/**
 * Het btw-percentage dat deze regels samen over het netto heffen. Een
 * verlegging (−21 en +21 op een kostenrekening) telt zo netto als nul, en
 * een afgetrokken regel telt niet mee.
 */
export function tariefVanRegels(regels: readonly BtwRegel[]): number {
  let totaal = 0;
  for (const r of regels) {
    if (r.charge_type !== "On Net Total" || r.add_deduct_tax === "Deduct") continue;
    totaal += Number(r.rate) || 0;
  }
  return totaal;
}

function afronden(bedrag: number): number {
  return Math.round(bedrag * 100) / 100;
}

/** Netto, btw en totaal zoals de dialoog ze toont. */
export function btwOverzicht(bedrag: number, tarief: number, inclusief: boolean): { netto: number; btw: number; totaal: number } {
  if (inclusief) {
    const totaal = afronden(bedrag);
    const netto = afronden(bedrag / (1 + tarief / 100));
    return { netto, btw: afronden(totaal - netto), totaal };
  }
  const netto = afronden(bedrag);
  const btw = afronden(bedrag * tarief / 100);
  return { netto, btw, totaal: afronden(netto + btw) };
}

/**
 * De regels zoals ze met de boeking meegaan. "Inbegrepen" kan ERPNext alleen
 * rekenen voor regels over het netto; een regel met een vast bedrag blijft
 * er altijd bovenop komen.
 */
export function btwRegelsVoorBoeking(regels: readonly BtwRegel[], inclusief: boolean): BtwRegel[] {
  return regels.map((r) => {
    const regel: BtwRegel = {
      charge_type: r.charge_type,
      account_head: r.account_head,
      description: r.description || r.account_head,
      rate: Number(r.rate) || 0,
      included_in_print_rate: inclusief && r.charge_type === "On Net Total" ? 1 : 0,
    };
    if (r.category) regel.category = r.category;
    if (r.add_deduct_tax) regel.add_deduct_tax = r.add_deduct_tax;
    if (r.cost_center) regel.cost_center = r.cost_center;
    return regel;
  });
}
