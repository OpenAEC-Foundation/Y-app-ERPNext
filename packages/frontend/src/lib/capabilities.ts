/**
 * Fase-1 schakelkast (Y-next).
 *
 * Y-next is een fork van Y-app die single-tenant direct op ERPNext v16
 * draait, zonder eigen backend. Na de paginamigratie zijn alle schermen die
 * op de standaard ERPNext-API draaien actief; alleen Express-core-schermen
 * tonen een "volgt later"-pagina (zie `ComingSoon.tsx`). Server-afhankelijke features
 * (mail, messenger, websocket, terminal, nextcloud, calendar-bridge,
 * stats-aggregatie, vault, extensions, synced-prefs, printview,
 * shared-settings, desktop) zijn volledig uit, omdat er geen server is die
 * ze kan bedienen.
 *
 * Dit bestand is bewust simpel en puur — geen React, geen side effects —
 * zodat het zonder gedoe door de app-shell en de Sidebar geconsumeerd kan
 * worden om te bepalen welke routes/features zichtbaar en/of bruikbaar zijn.
 * Latere fases breiden `isPageEnabled` / `isFeatureEnabled` uit; deze module
 * blijft de ene plek waar dat wordt beslist.
 */

/**
 * Hoe een uitgeschakelde pagina zich gedraagt.
 * - "visible": de route bestaat en toont een ComingSoon-pagina.
 * - "hidden": de route zou volledig verborgen zijn (niet gebruikt in fase 1).
 */
export const DISABLED_PAGE_MODE: "visible" | "hidden" = "visible";

/**
 * Na de paginamigratie draait vrijwel elke pagina rechtstreeks op de
 * standaard ERPNext-API. Alleen schermen waarvan de kern een Express-only
 * dienst vereist (IMAP-webmail, messenger, Nextcloud, wachtwoordkluis,
 * meeting-JSON-store, iframe-extensies) blijven op "volgt later" staan.
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
