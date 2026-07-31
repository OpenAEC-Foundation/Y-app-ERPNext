/**
 * Per-email "link to ERPNext project" mapping.
 *
 * Storage: server-side instance_settings (key `email-project-links`) zodat
 * koppelingen cross-device + cross-browser zichtbaar zijn.
 *
 * Caching strategie:
 *  - In-memory cache + localStorage = sync fallback voor instant render
 *    (zonder dat we async fetch hoeven af te wachten bij elke mail-open).
 *  - Server is bron van waarheid. hydrateEmailProjectLinks() haalt server op
 *    en overschrijft cache + localStorage. Roep dit aan bij Webmail-mount.
 *  - setEmailProjectLink schrijft synchroon naar localStorage + cache
 *    (instant UI) + fire-and-forget naar server.
 *
 * Sleutel: `${uid}:${subject}` zodat dezelfde mail altijd dezelfde link heeft.
 */
import { getActiveInstanceId } from "./instances";

const SETTING_KEY = "email-project-links";

function localKey(): string {
  return `email_project_links_${getActiveInstanceId()}`;
}

let cache: Record<string, string> | null = null;

/** Sync: returns cache, hydrates from localStorage if cold. */
export function getEmailProjectLinks(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(localKey()) || "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

/**
 * Write-through: cache + localStorage (sync, instant) + server (async, silent).
 * Sync API zodat callers niet hoeven te awaiten — UI blijft snappy.
 */
export function setEmailProjectLink(emailKey: string, projectName: string | null): void {
  const links = { ...getEmailProjectLinks() };
  if (projectName) links[emailKey] = projectName;
  else delete links[emailKey];
  cache = links;
  try {
    localStorage.setItem(localKey(), JSON.stringify(links));
  } catch {
    // localStorage vol of disabled — geen blocker, server-write gaat door
  }
  // Fire-and-forget server-sync. Conflict-resolutie: laatste write wint
  // (single-user scenario, geen race).
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  fetch(`/api/instances/${encodeURIComponent(instanceId)}/settings/${SETTING_KEY}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: links }),
  }).catch(() => {
    // Stil falen — localStorage heeft de waarde, sync komt later goed
  });
}

/**
 * Haal server-state op en overschrijf cache + localStorage. Server wint
 * over local omdat het de bron van waarheid is (cross-device).
 *
 * Call dit op Webmail-mount. Idempotent — kan meerdere keren aangeroepen.
 */
export async function hydrateEmailProjectLinks(): Promise<void> {
  const instanceId = getActiveInstanceId();
  if (!instanceId || instanceId === "default") return;
  try {
    const res = await fetch(
      `/api/instances/${encodeURIComponent(instanceId)}/settings/${SETTING_KEY}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return;
    const data = await res.json();
    const raw = data?.value;
    if (!raw || typeof raw !== "object") return;
    cache = raw as Record<string, string>;
    try {
      localStorage.setItem(localKey(), JSON.stringify(raw));
    } catch {
      // ignore
    }
  } catch {
    // Server onbereikbaar — behoud localStorage-cache
  }
}
