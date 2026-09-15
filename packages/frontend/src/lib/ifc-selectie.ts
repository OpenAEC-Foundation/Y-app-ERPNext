/**
 * Een onderdeel aanklikken in de IFC-viewer — de rekenkant.
 *
 * Pure module. De viewer voegt alles met dezelfde kleur samen tot een
 * geometrie; anders staat een model van tienduizend onderdelen stil. Daarbij
 * gaat verloren welke driehoek bij welk onderdeel hoort. Die koppeling wordt
 * hier bijgehouden als reeksen driehoeken per samengevoegde geometrie, en een
 * klik wordt vertaald naar het onderdeel dat eronder ligt.
 */

/** Een aaneengesloten reeks driehoeken van een onderdeel binnen een geometrie. */
export interface Bereik {
  /** Nummer van de eerste driehoek in de samengevoegde geometrie. */
  start: number;
  /** Aantal driehoeken. */
  aantal: number;
  /** Het onderdeel in het IFC-bestand. */
  expressID: number;
}

/**
 * Bij welk onderdeel hoort deze driehoek?
 *
 * Binair zoeken: de reeksen staan op volgorde van toevoegen, en een model met
 * tienduizend onderdelen hoort bij een klik niet tienduizend keer te vergelijken.
 */
export function zoekOnderdeel(bereiken: Bereik[], driehoek: number): number | null {
  let laag = 0;
  let hoog = bereiken.length - 1;
  while (laag <= hoog) {
    const midden = (laag + hoog) >> 1;
    const b = bereiken[midden];
    if (driehoek < b.start) hoog = midden - 1;
    else if (driehoek >= b.start + b.aantal) laag = midden + 1;
    else return b.expressID;
  }
  return null;
}

/**
 * Was dit een klik, of werd er gedraaid?
 *
 * Draaien begint ook met indrukken en eindigt met loslaten. Wie het model een
 * slag draait, hoort daarna niet ineens een onderdeel geselecteerd te hebben.
 */
export function isKlik(
  neer: { x: number; y: number },
  los: { x: number; y: number },
  drempel = 4,
): boolean {
  return Math.hypot(los.x - neer.x, los.y - neer.y) <= drempel;
}

/** De IFC-soorten die in een bouwmodel het vaakst voorkomen, in gewone taal. */
const SOORTEN: Record<string, string> = {
  IFCBEAM: "Balk",
  IFCCOLUMN: "Kolom",
  IFCSLAB: "Vloer of plaat",
  IFCWALL: "Wand",
  IFCWALLSTANDARDCASE: "Wand",
  IFCDOOR: "Deur",
  IFCWINDOW: "Raam",
  IFCROOF: "Dak",
  IFCSTAIR: "Trap",
  IFCSTAIRFLIGHT: "Trapdeel",
  IFCRAILING: "Hekwerk",
  IFCPLATE: "Plaat",
  IFCMEMBER: "Staaf",
  IFCFOOTING: "Fundering",
  IFCPILE: "Paal",
  IFCCOVERING: "Afwerking",
  IFCBUILDINGELEMENTPROXY: "Bouwdeel",
  IFCFURNISHINGELEMENT: "Inrichting",
  IFCOPENINGELEMENT: "Sparing",
  IFCSPACE: "Ruimte",
  IFCMECHANICALFASTENER: "Bevestiging",
  IFCDISCRETEACCESSORY: "Hulpstuk",
  IFCREINFORCINGBAR: "Wapening",
};

/**
 * Een leesbaar label bij een IFC-soort. Wat niet in de lijst staat, blijft
 * herkenbaar als `IfcFlowTerminal` in plaats van `IFCFLOWTERMINAL`.
 */
export function soortLabel(ifcNaam: string): string {
  const schoon = String(ifcNaam || "").trim();
  const naam = schoon.toUpperCase();
  if (!naam) return "Onderdeel";
  if (SOORTEN[naam]) return SOORTEN[naam];
  // web-ifc geeft de naam al als "IfcCableCarrierSegment"; die klopt, en uit
  // hoofdletters valt hij niet foutloos terug te rekenen.
  if (/[a-z]/.test(schoon)) return schoon;
  const rest = naam.startsWith("IFC") ? naam.slice(3) : naam;
  return "Ifc" + rest.charAt(0) + rest.slice(1).toLowerCase().replace(
    /(flow|terminal|element|type|proxy|case|segment|fitting|controller|accessory|fastener)/g,
    (w) => w.charAt(0).toUpperCase() + w.slice(1),
  );
}

/**
 * Een waarde uit web-ifc als tekst. Web-ifc verpakt vrijwel alles als
 * `{ type, value }`; een waarheidswaarde wordt "ja" of "nee".
 */
export function waardeVan(attr: unknown): string {
  if (attr === null || attr === undefined) return "";
  const kaal = typeof attr === "object" && attr !== null && "value" in attr
    ? (attr as { value: unknown }).value
    : attr;
  if (kaal === null || kaal === undefined) return "";
  if (typeof kaal === "boolean") return kaal ? "ja" : "nee";
  return String(kaal);
}
