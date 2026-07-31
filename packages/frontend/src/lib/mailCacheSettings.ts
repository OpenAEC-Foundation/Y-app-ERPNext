/**
 * Body-cache instelling: hoeveel dagen mailinhoud lokaal gecached wordt.
 *
 * Bewust PER APPARAAT (localStorage, géén `pref_${id}_`-prefix zodat
 * synced-prefs het NIET over devices synct) — opslag is apparaatgebonden, dus
 * een grote cache op je telefoon wil je niet automatisch op je laptop.
 *
 * Waarde = aantal dagen. 0 = uit. ALL_DAYS = "alles" (begrensd, zie pre-fill
 * per-map cap 1.000 + quota-stop).
 */
export const MAIL_CACHE_DEFAULT_DAYS = 30;
export const MAIL_CACHE_ALL_DAYS = 3650; // ~10 jaar = "alles" (praktisch onbegrensd)
export const MAIL_CACHE_MIN_DAYS = 7;
export const MAIL_CACHE_MAX_DAYS = 365;

function key(instanceId: string, acct?: string): string {
  // Per-account key wanneer `acct` gegeven is; anders de instance-brede key
  // (backward-compat + terugval). `acct` = het e-mailadres van het account.
  const base = `mail_cache_window_${instanceId}`;
  return acct ? `${base}__${acct.toLowerCase()}` : base;
}

export function getMailCacheWindowDays(instanceId: string, acct?: string): number {
  try {
    // Per-account waarde heeft voorrang; valt terug op de instance-brede waarde
    // (zo blijven bestaande instellingen gelden tot je 'm per account aanpast).
    let raw: string | null = acct ? localStorage.getItem(key(instanceId, acct)) : null;
    if (raw === null) raw = localStorage.getItem(key(instanceId));
    if (raw === null) return MAIL_CACHE_DEFAULT_DAYS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : MAIL_CACHE_DEFAULT_DAYS;
  } catch {
    return MAIL_CACHE_DEFAULT_DAYS;
  }
}

export function setMailCacheWindowDays(instanceId: string, days: number, acct?: string): void {
  try {
    localStorage.setItem(key(instanceId, acct), String(days));
    window.dispatchEvent(new CustomEvent("y-app:mail-cache-window-changed", { detail: { instanceId, days, acct } }));
  } catch {
    /* ignore */
  }
}
