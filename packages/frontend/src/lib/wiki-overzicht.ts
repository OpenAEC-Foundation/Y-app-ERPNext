/**
 * De hoofdpagina van de kennisbank: wat staat er allemaal, en wat gebruik je.
 *
 * De kennisbank is gegroeid tot bijna tweehonderd artikelen achter één lange
 * lijst. Dan weet niemand meer wát er staat. Deze module maakt van de vlakke
 * lijst een indeling: per onderwerp (uit het pad van het artikel), met de
 * laatst gewijzigde artikelen en de artikelen die je zelf het vaakst opent.
 *
 * Het aantal keer geopend is **persoonlijk** en staat in deze browser. Frappe
 * houdt voor Wiki Page geen weergaven bij, en dat aanzetten zou een wijziging
 * aan ERPNext zijn; een eigen teller zegt bovendien precies wat hij is —
 * "hoe vaak jij dit artikel opende".
 */

export interface WikiArtikel {
  name: string;
  title: string;
  route: string;
  modified?: string;
}

export interface WikiSectie {
  /** Sleutel van de sectie: het pad zonder het artikel zelf. */
  pad: string;
  /** Leesbare naam, bijvoorbeeld "Procedures · Detail engineering". */
  label: string;
  artikelen: WikiArtikel[];
}

const WOORDEN: Record<string, string> = {
  "3bm": "3BM",
  ai: "AI",
  so: "SO",
  uo: "UO",
  vo: "VO",
  erp: "ERP",
  hr: "HR",
  ict: "ICT",
  bim: "BIM",
};

/** "detail-engineering" → "Detail engineering"; bekende afkortingen blijven staan. */
export function leesbaar(deel: string): string {
  const schoon = (deel || "").replace(/[-_]+/g, " ").trim();
  if (!schoon) return "";
  const woorden = schoon.split(/\s+/).map((w, i) => {
    const vast = WOORDEN[w.toLowerCase()];
    if (vast) return vast;
    return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  return woorden.join(" ");
}

/** Het pad van een artikel zonder "wiki/" ervoor en zonder het artikel zelf. */
export function sectiePad(route: string): string {
  const delen = String(route || "").split("/").filter(Boolean);
  if (delen[0] === "wiki") delen.shift();
  delen.pop();
  return delen.join("/");
}

/** Alle artikelen gegroepeerd per sectie, alfabetisch, met de titels op volgorde. */
export function groepeer(artikelen: WikiArtikel[]): WikiSectie[] {
  const per = new Map<string, WikiArtikel[]>();
  for (const a of artikelen) {
    const pad = sectiePad(a.route);
    const lijst = per.get(pad);
    if (lijst) lijst.push(a);
    else per.set(pad, [a]);
  }
  return [...per.entries()]
    .map(([pad, lijst]) => ({
      pad,
      label: pad ? pad.split("/").map(leesbaar).join(" · ") : "Algemeen",
      artikelen: [...lijst].sort((x, y) => (x.title || x.name).localeCompare(y.title || y.name)),
    }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

/** De laatst gewijzigde artikelen, nieuwste eerst. */
export function laatstGewijzigd(artikelen: WikiArtikel[], aantal = 6): WikiArtikel[] {
  return [...artikelen]
    .filter((a) => a.modified)
    .sort((x, y) => String(y.modified).localeCompare(String(x.modified)))
    .slice(0, aantal);
}

/** Artikelen waarvan de titel of het pad op de zoekterm past. */
export function zoekArtikelen(artikelen: WikiArtikel[], term: string): WikiArtikel[] {
  const q = term.trim().toLowerCase();
  if (!q) return artikelen;
  return artikelen.filter((a) =>
    (a.title || "").toLowerCase().includes(q) || (a.route || "").toLowerCase().includes(q));
}

/* ───────────────── Hoe vaak jij een artikel opende ───────────────── */

const SLEUTEL = "ynext_wiki_geopend";

export type Tellingen = Record<string, number>;

export function leesTellingen(): Tellingen {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    const data = ruw ? JSON.parse(ruw) : null;
    if (!data || typeof data !== "object") return {};
    const uit: Tellingen = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) uit[k] = Math.floor(n);
    }
    return uit;
  } catch {
    return {};
  }
}

/** Eén erbij; geeft de nieuwe stand terug zodat de pagina meteen klopt. */
export function telGeopend(naam: string, huidig: Tellingen = leesTellingen()): Tellingen {
  if (!naam) return huidig;
  const nieuw = { ...huidig, [naam]: (huidig[naam] ?? 0) + 1 };
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(nieuw));
  } catch { /* privémodus: dan telt het deze sessie niet mee */ }
  return nieuw;
}

/** De vaakst geopende artikelen, met hun aantal. */
export function vaakstGeopend(
  artikelen: WikiArtikel[],
  tellingen: Tellingen,
  aantal = 6,
): { artikel: WikiArtikel; aantal: number }[] {
  return artikelen
    .map((artikel) => ({ artikel, aantal: tellingen[artikel.name] ?? 0 }))
    .filter((x) => x.aantal > 0)
    .sort((x, y) => y.aantal - x.aantal || (x.artikel.title || "").localeCompare(y.artikel.title || ""))
    .slice(0, aantal);
}
