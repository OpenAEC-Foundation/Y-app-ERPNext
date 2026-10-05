/**
 * De factuurdatum van de facturenfabriek (Te Factureren).
 *
 * Facturen over een maand worden meestal de eerste dagen van de volgende
 * maand gemaakt, maar horen op de laatste dag van de maand waarover ze gaan —
 * anders schuiven ze een maand en een btw-tijdvak op. Zonder datum zet ERPNext
 * de dag van vandaag. Deze module kiest een verstandige standaard en onthoudt
 * wat je zelf koos, zolang je in dezelfde maand factureert.
 *
 * Pure module: geen netwerk, geen opslag; de pagina doet het lezen en schrijven.
 */

export const FACTUURDATUM_SLEUTEL = "ynext_te_factureren_factuurdatum";

/** Tot en met deze dag van de maand factureer je nog over de vorige maand. */
export const GRENSDAG = 15;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isIsoDatum(waarde: unknown): waarde is string {
  if (typeof waarde !== "string" || !ISO_RE.test(waarde)) return false;
  const [j, m, d] = waarde.split("-").map(Number);
  const dt = new Date(j, m - 1, d);
  return dt.getFullYear() === j && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** De laatste dag van de maand vóór `nu`, lokaal gerekend. */
export function laatsteDagVorigeMaand(nu: Date): string {
  return iso(new Date(nu.getFullYear(), nu.getMonth(), 0));
}

/** Begin van de maand: de laatste dag van de vorige maand. Later in de maand: vandaag. */
export function standaardFactuurdatum(nu: Date): string {
  return nu.getDate() <= GRENSDAG ? laatsteDagVorigeMaand(nu) : iso(nu);
}

/**
 * De datum die de pagina gebruikt: wat je eerder koos, als je dat in deze
 * maand deed; anders de standaard. Een keuze uit een vorige maand geldt niet
 * meer — dan factureer je over een andere periode.
 */
export function bepaalFactuurdatum(opgeslagen: unknown, nu: Date): string {
  if (opgeslagen && typeof opgeslagen === "object") {
    const { datum, gekozenOp } = opgeslagen as { datum?: unknown; gekozenOp?: unknown };
    if (isIsoDatum(datum) && isIsoDatum(gekozenOp) && gekozenOp.slice(0, 7) === iso(nu).slice(0, 7)) return datum;
  }
  return standaardFactuurdatum(nu);
}

/** Wat er opgeslagen wordt als je een datum kiest. */
export function bewaarFactuurdatum(datum: string, nu: Date): { datum: string; gekozenOp: string } {
  return { datum, gekozenOp: iso(nu) };
}
