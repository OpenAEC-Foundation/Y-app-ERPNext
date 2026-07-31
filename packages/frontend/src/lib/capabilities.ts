/**
 * Fase-2 schakelkast (Y-next).
 *
 * Y-next is een fork van Y-app die single-tenant direct op ERPNext v16
 * draait, zonder eigen backend. Vrijwel elk scherm draait rechtstreeks op de
 * standaard ERPNext-API, inclusief mail (Communication-adapter, zie
 * `mail-erpnext.ts`) en extensions (client-side sandbox-bridge met opslag
 * in het `Y Next Setting`-doctype). Wat écht een Express-only dienst
 * vereist — IMAP-webmail, messenger, websocket, terminal, Nextcloud,
 * CalDAV/O365-brug, stats-aggregatie, wachtwoordkluis, synced-prefs,
 * printview, shared-settings, desktop — blijft uit, omdat er geen server is
 * die het kan bedienen; die schermen tonen een "volgt later"-pagina (zie
 * `ComingSoon.tsx`).
 *
 * Dit bestand is bewust simpel en puur — geen React, geen side effects —
 * zodat het zonder gedoe door de app-shell en de Sidebar geconsumeerd kan
 * worden om te bepalen welke routes/features zichtbaar en/of bruikbaar zijn.
 * Latere fases breiden `isPageEnabled` / `isFeatureEnabled` verder uit; deze
 * module blijft de ene plek waar dat wordt beslist.
 */

/**
 * Hoe een uitgeschakelde pagina zich gedraagt.
 * - "visible": de route bestaat en toont een ComingSoon-pagina.
 * - "hidden": de route zou volledig verborgen zijn (nog niet gebruikt).
 */
export const DISABLED_PAGE_MODE: "visible" | "hidden" = "visible";

/**
 * Schermen waarvan de kern een Express-only dienst vereist (messenger,
 * Nextcloud, wachtwoordkluis) blijven op "volgt later" staan — er is geen
 * server die ze kan bedienen. Webmail (IMAP) en extensions zijn hier
 * inmiddels vanaf: die draaien nu op de ERPNext-Communication-adapter
 * resp. de `Y Next Setting`-doctype-opslag, zie `ENABLED_FEATURES`.
 */
const DISABLED_PATH_PREFIXES = [
  "/messenger",
  "/nextcloud-files",
  "/nextcloud-talk",
  "/passwords",
] as const;

export function isPageEnabled(path: string): boolean {
  return !DISABLED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export type ServerFeature =
  | "webmail"
  | "erpnext-mail"
  | "messenger"
  | "websocket"
  | "terminal"
  | "nextcloud"
  | "calendar-bridge"
  | "stats"
  | "vault"
  | "extensions"
  | "synced-prefs"
  | "printview"
  | "shared-settings"
  | "desktop";

/**
 * Features die zonder eigen server werken zijn actief: `erpnext-mail`
 * (Communication-adapter) en `extensions` (client-side sandbox-bridge met
 * opslag in het Y Next Setting-doctype). Server-afhankelijke features
 * (IMAP-webmail, messenger, websocket, terminal, Nextcloud, CalDAV/O365,
 * stats-aggregatie, vault, synced-prefs, printview, shared-settings,
 * desktop) blijven uit — er is geen backend die ze kan bedienen.
 */
const ENABLED_FEATURES: ReadonlySet<ServerFeature> = new Set([
  "erpnext-mail",
  "extensions",
]);

export function isFeatureEnabled(feature: ServerFeature): boolean {
  return ENABLED_FEATURES.has(feature);
}
