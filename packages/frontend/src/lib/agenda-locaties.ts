/**
 * Locaties voor een afspraak, uit de adressen in ERPNext.
 *
 * Alleen adressen van bedrijven: factuur- en kantooradressen van klanten,
 * leveranciers en de eigen bedrijven (`Billing`, `Office`, of gemarkeerd als
 * eigen bedrijfsadres). Projectlocaties (`Plant`) blijven buiten de lijst,
 * want hun titels ("Projloc_ 180") zeggen bij het kiezen niets.
 */
import { fetchChildTable, fetchList } from "./erpnext.ts";

export interface LocatieAdres {
  name: string;
  titel: string;
  straat: string;
  postcode: string;
  plaats: string;
  eigen: boolean;
  /** Het eigen bedrijf waar dit adres bij hoort, als het er een is. */
  bedrijf?: string;
}

interface AdresRij {
  name: string;
  address_title?: string;
  address_line1?: string;
  address_line2?: string;
  pincode?: string;
  city?: string;
  is_your_company_address?: number;
}

const VELDEN = ["name", "address_title", "address_line1", "address_line2", "pincode", "city", "is_your_company_address"];
const BEDRIJFSTYPEN = ["Billing", "Office"];

function naarLocatie(r: AdresRij): LocatieAdres {
  return {
    name: r.name,
    titel: String(r.address_title || "").trim(),
    straat: [r.address_line1, r.address_line2].map((x) => String(x || "").trim()).filter(Boolean).join(" "),
    postcode: String(r.pincode || "").trim(),
    plaats: String(r.city || "").trim(),
    eigen: Number(r.is_your_company_address) === 1,
  };
}

/** "Straat 1, 1234 AB Plaats", zonder lege stukken. */
export function adresRegel(a: Pick<LocatieAdres, "straat" | "postcode" | "plaats">): string {
  const plaats = [a.postcode, a.plaats].filter(Boolean).join(" ");
  return [a.straat, plaats].filter(Boolean).join(", ");
}

/** Wat er in het locatieveld komt: "Bedrijf, Straat 1, 1234 AB Plaats". */
export function locatieTekst(a: LocatieAdres): string {
  return [a.titel, adresRegel(a)].filter(Boolean).join(", ");
}

/** Dubbele adressen (zelfde titel en regel) één keer; eigen bedrijven eerst. */
export function ordenLocaties(lijst: LocatieAdres[]): LocatieAdres[] {
  const gezien = new Set<string>();
  const uit: LocatieAdres[] = [];
  for (const a of lijst) {
    const sleutel = locatieTekst(a).toLowerCase();
    if (!a.titel && !a.straat) continue;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push(a);
  }
  return uit.sort((x, y) => Number(y.eigen) - Number(x.eigen));
}

/**
 * De adressen van de eigen bedrijven, voor een leeg veld.
 *
 * Twee routes, want in ERPNext staat het niet altijd op dezelfde manier: het
 * vinkje "eigen bedrijfsadres" op het adres, of alleen een koppeling van het
 * adres aan een Company. Beide tellen.
 */
export async function eigenLocaties(): Promise<LocatieAdres[]> {
  const koppelingen = await fetchChildTable<{ parent?: string; link_name?: string }>(
    "Dynamic Link", "Address", ["parent", "link_name"],
    [["parenttype", "=", "Address"], ["link_doctype", "=", "Company"]], 100,
  ).catch(() => [] as { parent?: string; link_name?: string }[]);
  // Een uitgeschakeld bedrijf hoort niet in de keuzelijst, ook niet als zijn
  // adres zelf nog actief staat.
  const inactief = new Set((await fetchList<{ name: string }>("Company", {
    fields: ["name"], filters: [["disabled", "=", 1]], limit_page_length: 0,
  }).catch(() => [] as { name: string }[])).map((c) => c.name));
  const bedrijfVan = new Map<string, string>();
  const vanInactief = new Set<string>();
  for (const k of koppelingen) {
    if (!k.parent || !k.link_name) continue;
    if (inactief.has(k.link_name)) vanInactief.add(k.parent);
    else bedrijfVan.set(k.parent, k.link_name);
  }

  const [gemarkeerd, gekoppeld] = await Promise.all([
    fetchList<AdresRij>("Address", {
      fields: VELDEN,
      filters: [["is_your_company_address", "=", 1], ["disabled", "=", 0]],
      limit_page_length: 50,
    }).catch(() => [] as AdresRij[]),
    bedrijfVan.size === 0 ? Promise.resolve([] as AdresRij[]) : fetchList<AdresRij>("Address", {
      fields: VELDEN,
      filters: [["name", "in", [...bedrijfVan.keys()]], ["disabled", "=", 0]],
      limit_page_length: 100,
    }).catch(() => [] as AdresRij[]),
  ]);
  const uniek = new Map<string, AdresRij>();
  for (const rij of [...gemarkeerd, ...gekoppeld]) if (!vanInactief.has(rij.name)) uniek.set(rij.name, rij);
  return ordenLocaties([...uniek.values()].map((rij) => ({
    ...naarLocatie(rij),
    eigen: true,
    bedrijf: bedrijfVan.get(rij.name),
  })));
}

/**
 * Het adres dat standaard in het locatieveld van een nieuwe afspraak komt:
 * dat van het eigen bedrijf, anders het eerste eigen bedrijfsadres.
 */
export function standaardLocatie(eigen: LocatieAdres[], bedrijf: string): LocatieAdres | undefined {
  const b = bedrijf.trim().toLowerCase();
  return eigen.find((a) => b && (a.bedrijf || "").toLowerCase() === b)
    ?? eigen.find((a) => b && a.titel.toLowerCase() === b)
    ?? eigen[0];
}

/** Zoek bedrijfsadressen op naam, straat of plaats. */
export async function zoekLocaties(term: string, limiet = 10): Promise<LocatieAdres[]> {
  const q = term.trim();
  if (q.length < 2) return eigenLocaties();
  const like = `%${q}%`;
  const rijen = await fetchList<AdresRij>("Address", {
    fields: VELDEN,
    filters: [["address_type", "in", BEDRIJFSTYPEN], ["disabled", "=", 0]],
    or_filters: [["address_title", "like", like], ["address_line1", "like", like], ["city", "like", like]],
    order_by: "address_title asc",
    limit_page_length: limiet * 2,
  }).catch(() => [] as AdresRij[]);
  return ordenLocaties(rijen.map(naarLocatie)).slice(0, limiet);
}
