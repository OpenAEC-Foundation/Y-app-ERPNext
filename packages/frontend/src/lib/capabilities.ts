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
  "/webmail",
  "/messenger",
  "/nextcloud-files",
  "/nextcloud-talk",
  "/passwords",
  "/meeting-notes",
  "/release-notes",
  "/x",
] as const;

export function isPageEnabled(path: string): boolean {
  return !DISABLED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export type ServerFeature =
  | "webmail"
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
 * Alle server-afhankelijke features zijn in fase 1 uitgeschakeld — er is
 * geen eigen backend om ze te bedienen.
 */
export function isFeatureEnabled(_feature: ServerFeature): boolean {
  void _feature; // signature keeps the parameter for future fases; nothing to check yet
  return false;
}
