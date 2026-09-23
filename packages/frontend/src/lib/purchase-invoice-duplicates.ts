/**
 * Is deze inkoopfactuur al eens ingeboekt?
 *
 * ERPNext kan dat zelf controleren (Accounts Settings → "Check Supplier Invoice
 * Number Uniqueness"), maar die staat op deze instance uit, en terecht: hij
 * weigert dan ook een factuur zonder nummer niet en ziet een doorgestuurde
 * factuur met een ander nummerformaat niet. In de data staan daardoor echte
 * dubbelingen (twee keer hetzelfde factuurnummer bij één leverancier).
 *
 * Deze module beslist alleen *wat* als dubbel telt; het ophalen staat in
 * `purchase-invoice.ts`. Drie signalen, van sterk naar zwak:
 *
 * - **factuurnummer** — hetzelfde nummer. Spaties en hoofdletters tellen niet
 *   mee: "F0000 2606" uit een mailtekst is dezelfde factuur als "f0000 2606"
 *   die iemand eerder overtypte. Bij een andere leverancier telt alleen een
 *   nummer dat lang genoeg is om uniek te zijn — zie `nummerTelt`.
 * - **bijlage** — exact dezelfde pdf (zelfde inhoudshash) hangt al aan een
 *   inkoopfactuur, ongeacht leverancier of nummer. Vangt de factuur die twee
 *   keer binnenkwam, of die bij de eerste boeking een andere leverancier kreeg.
 * - **bedrag-datum** — dezelfde leverancier, dezelfde factuurdatum en hetzelfde
 *   bedrag. Een abonnement heeft elke maand hetzelfde bedrag, maar niet
 *   dezelfde factuurdatum.
 *
 * Geannuleerde facturen (docstatus 2) tellen nooit mee: die opnieuw boeken is
 * precies wat je na een annulering wilt.
 */

export interface BestaandeInkoopfactuur {
  name: string;
  supplier?: string;
  bill_no?: string | null;
  bill_date?: string | null;
  posting_date?: string | null;
  net_total?: number | null;
  grand_total?: number | null;
  docstatus?: number;
  status?: string | null;
}

export type DubbelReden = "factuurnummer" | "bijlage" | "bedrag-datum";

export interface MogelijkeDubbele {
  factuur: BestaandeInkoopfactuur;
  redenen: DubbelReden[];
}

export interface DubbelInvoer {
  supplier: string;
  billNo?: string;
  billDate?: string;
  /** Het nettobedrag uit de dialoog; `NaN` of leeg telt als "onbekend". */
  amount?: number;
}

/** Velden die het ophalen nodig heeft; één plek zodat ze niet uit elkaar lopen. */
export const DUBBEL_VELDEN = [
  "name", "supplier", "bill_no", "bill_date", "posting_date",
  "net_total", "grand_total", "docstatus", "status",
] as const;

const VOLGORDE: DubbelReden[] = ["factuurnummer", "bijlage", "bedrag-datum"];

/** Een halve cent speling: ERPNext rondt af op twee decimalen. */
const BEDRAG_MARGE = 0.005;

/**
 * Een nummer korter dan dit zegt alleen iets binnen één leverancier: "1234"
 * staat bij drie leveranciers, "2018284392" bij één.
 */
const MIN_NUMMER_ANDERE_LEVERANCIER = 5;

export function normaliseerFactuurnummer(nummer: string | null | undefined): string {
  return (nummer ?? "").replace(/\s+/g, "").toLowerCase();
}

/**
 * Telt een gelijk (genormaliseerd) factuurnummer? Bij dezelfde leverancier
 * altijd. Bij een andere of onbekende leverancier alleen een nummer dat lang
 * genoeg is om uniek te zijn.
 *
 * Bewust niet strenger: de herkenning pakt soms de eigen bedrijfsnaam uit het
 * adresblok van de factuur als leverancier. Moest de leverancier dan kloppen,
 * dan bleef de betaalde factuur van de échte leverancier onzichtbaar.
 */
function nummerTelt(nummer: string, leverancier: string | undefined, factuur: BestaandeInkoopfactuur): boolean {
  const zelfdeLeverancier = !!leverancier && factuur.supplier === leverancier;
  return zelfdeLeverancier || nummer.length >= MIN_NUMMER_ANDERE_LEVERANCIER;
}

function zelfdeBedrag(bedrag: number, factuur: BestaandeInkoopfactuur): boolean {
  // Netto én bruto: wie het brutobedrag invulde, of een factuur waar de btw al
  // op staat, moet net zo goed als dubbel herkend worden.
  return [factuur.net_total, factuur.grand_total].some(
    (v) => typeof v === "number" && Math.abs(v - bedrag) < BEDRAG_MARGE,
  );
}

/**
 * @param kandidaten       inkoopfacturen van de gekozen leverancier en/of met
 *                         hetzelfde factuurnummer
 * @param metZelfdeBijlage inkoopfacturen waaraan een van de pdf's al hangt
 */
export function vindDubbeleInkoopfacturen(
  invoer: DubbelInvoer,
  kandidaten: BestaandeInkoopfactuur[],
  metZelfdeBijlage: BestaandeInkoopfactuur[] = [],
): MogelijkeDubbele[] {
  const gevonden = new Map<string, MogelijkeDubbele>();
  const markeer = (factuur: BestaandeInkoopfactuur, reden: DubbelReden) => {
    if (factuur.docstatus === 2) return;
    const bestaand = gevonden.get(factuur.name);
    if (!bestaand) gevonden.set(factuur.name, { factuur, redenen: [reden] });
    else if (!bestaand.redenen.includes(reden)) bestaand.redenen.push(reden);
  };

  const nummer = normaliseerFactuurnummer(invoer.billNo);
  const bedrag = typeof invoer.amount === "number" && Number.isFinite(invoer.amount) && invoer.amount !== 0
    ? invoer.amount
    : undefined;

  for (const factuur of kandidaten) {
    if (nummer && normaliseerFactuurnummer(factuur.bill_no) === nummer
      && nummerTelt(nummer, invoer.supplier || undefined, factuur)) {
      markeer(factuur, "factuurnummer");
    }
    const zelfdeLeverancier = !invoer.supplier || factuur.supplier === invoer.supplier;
    if (zelfdeLeverancier && invoer.billDate && factuur.bill_date === invoer.billDate
      && bedrag !== undefined && zelfdeBedrag(bedrag, factuur)) {
      markeer(factuur, "bedrag-datum");
    }
  }
  for (const factuur of metZelfdeBijlage) markeer(factuur, "bijlage");

  const sterkte = (d: MogelijkeDubbele) => Math.min(...d.redenen.map((r) => VOLGORDE.indexOf(r)));
  return [...gevonden.values()]
    .map((d) => ({ ...d, redenen: [...d.redenen].sort((a, b) => VOLGORDE.indexOf(a) - VOLGORDE.indexOf(b)) }))
    .sort((a, b) => sterkte(a) - sterkte(b)
      || (b.factuur.posting_date ?? "").localeCompare(a.factuur.posting_date ?? ""));
}

/** Stabiele sleutel van een uitkomst, om een bevestiging aan precies deze treffers te binden. */
export function dubbelSleutel(dubbelen: MogelijkeDubbele[]): string {
  return dubbelen.map((d) => d.factuur.name).sort().join("|");
}

/* ─────────────────── Factuurmails die al geboekt zijn ─────────────────── */

/**
 * Hoe ver een bestaande inkoopfactuur is. "Ingeboekt" is ingediend maar nog
 * (deels) open: Unpaid, Overdue en dergelijke zijn voor de mail allemaal
 * hetzelfde verhaal.
 */
export type GeboekteStand = "betaald" | "deels-betaald" | "ingeboekt" | "concept";

export function geboekteStand(factuur: BestaandeInkoopfactuur): GeboekteStand {
  if (factuur.docstatus === 0) return "concept";
  if (factuur.status === "Paid") return "betaald";
  if (factuur.status === "Partly Paid") return "deels-betaald";
  return "ingeboekt";
}

const STAND_RANG: Record<GeboekteStand, number> = {
  betaald: 0, "deels-betaald": 1, ingeboekt: 2, concept: 3,
};

/** Een factuurmail met wat de herkenning erin vond. */
export interface GeboekteKandidaat {
  /** Communication-docname. */
  naam: string;
  billNo: string;
  supplier?: string;
}

/**
 * Welke factuurmail hoort bij een factuur die al in ERPNext staat — ook als
 * die daar met de hand is ingeboekt en de mail er dus niet aan hangt.
 *
 * Alleen op factuurnummer: dat is het enige wat de lijst per mail kent, en
 * "al betaald" op grond van alleen een bedrag zou te stellig zijn. Een factuur
 * van de herkende leverancier gaat voor; een andere telt alleen bij een nummer
 * dat lang genoeg is (zie `nummerTelt`). Staan er meerdere facturen met dit
 * nummer (een echte dubbeling), dan telt daarna de verst gevorderde.
 *
 * Komt dezelfde mail twee keer voor, dan geldt de laatste: de geopende mail is
 * met bijlagen en tekst herkend en gaat voor op de lijstversie.
 */
export function koppelGeboekteFacturen(
  kandidaten: GeboekteKandidaat[],
  facturen: BestaandeInkoopfactuur[],
): Map<string, BestaandeInkoopfactuur> {
  const perNummer = new Map<string, BestaandeInkoopfactuur[]>();
  for (const factuur of facturen) {
    const nummer = normaliseerFactuurnummer(factuur.bill_no);
    if (!nummer || factuur.docstatus === 2) continue;
    const lijst = perNummer.get(nummer) ?? [];
    if (!lijst.some((f) => f.name === factuur.name)) lijst.push(factuur);
    perNummer.set(nummer, lijst);
  }

  const uit = new Map<string, BestaandeInkoopfactuur>();
  for (const kandidaat of kandidaten) {
    uit.delete(kandidaat.naam);
    const nummer = normaliseerFactuurnummer(kandidaat.billNo);
    if (!nummer) continue;
    const vanLeverancier = (f: BestaandeInkoopfactuur) =>
      Number(!!kandidaat.supplier && f.supplier === kandidaat.supplier);
    const treffers = (perNummer.get(nummer) ?? []).filter((f) => nummerTelt(nummer, kandidaat.supplier, f));
    const beste = [...treffers].sort((a, b) =>
      vanLeverancier(b) - vanLeverancier(a)
      || STAND_RANG[geboekteStand(a)] - STAND_RANG[geboekteStand(b)]
      || (b.posting_date ?? "").localeCompare(a.posting_date ?? ""))[0];
    if (beste) uit.set(kandidaat.naam, beste);
  }
  return uit;
}
