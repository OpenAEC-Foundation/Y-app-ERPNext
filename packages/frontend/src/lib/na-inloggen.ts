/**
 * Na het inloggen terug naar waar je heen wilde.
 *
 * Wie een link opent (bijvoorbeeld naar een kennisbankartikel,
 * `/y-next#/wiki/…`) en nog niet is ingelogd, gaat via de inlogpagina van
 * Frappe. Die stuurt daarna terug naar `/y-next`, maar zonder het deel achter
 * `#` — en dat deel ís het artikel. Daarom onthouden we dat deel vlak voor het
 * doorsturen, in de sessie-opslag van dit tabblad, en zetten het terug zodra
 * de sessie er is. Een half uur geldig, één keer te gebruiken.
 */

const SLEUTEL = "y-next:na-inloggen";
const GELDIG_MS = 30 * 60 * 1000;

type Opslag = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const GEEN_OPSLAG: Opslag = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/** De sessie-opslag van dit tabblad; al het lezen ervan kan in een privévenster mislukken. */
export function sessieOpslag(): Opslag {
  try {
    return window.sessionStorage ?? GEEN_OPSLAG;
  } catch {
    return GEEN_OPSLAG;
  }
}

/** Is dit het adres van de startpagina (niets om te onthouden)? */
function isStart(adres: string): boolean {
  return !adres || adres === "#" || adres === "#/";
}

/** Het huidige adres (`location.hash`) onthouden vlak voor het inloggen. */
export function onthoudAdres(adres: string, opslag: Opslag, nu: number = Date.now()): void {
  if (isStart(adres) || !adres.startsWith("#/")) return;
  try {
    opslag.setItem(SLEUTEL, JSON.stringify({ adres, tijd: nu }));
  } catch {
    // Geen opslag (privévenster, geblokkeerd): dan gewoon naar de startpagina.
  }
}

/**
 * Het onthouden adres, als het nog geldig is en je niet al op een eigen adres
 * binnenkwam. Wordt meteen gewist.
 */
export function haalAdresTerug(huidigAdres: string, opslag: Opslag, nu: number = Date.now()): string | null {
  let bewaard: { adres?: unknown; tijd?: unknown } | null;
  try {
    const ruw = opslag.getItem(SLEUTEL);
    if (ruw === null) return null;
    opslag.removeItem(SLEUTEL);
    bewaard = JSON.parse(ruw);
  } catch {
    return null;
  }
  if (!bewaard || typeof bewaard.adres !== "string" || typeof bewaard.tijd !== "number") return null;
  if (!bewaard.adres.startsWith("#/") || nu - bewaard.tijd > GELDIG_MS) return null;
  if (!isStart(huidigAdres)) return null;
  return bewaard.adres;
}
