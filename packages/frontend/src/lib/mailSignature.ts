/**
 * Handmatige e-mailhandtekening per account (override op de ERPNext-handtekening).
 *
 * Opslag = write-through, zoals email-project-links / nasConfig:
 *   in-memory map → localStorage (instant, device) → fire-and-forget PUT naar
 *   instance_settings (`mail-signatures`, cross-device sync).
 * `hydrateSignatureOverrides()` op mount haalt de server-state en overschrijft
 *   de lokale cache.
 *
 * De handtekening is HTML met eventueel base64-afbeeldingen INLINE (self-contained,
 * zodat ontvangers de plaatjes zien). Gebruikers plakken vaak een volledig
 * HTML-document; `extractSignatureFragment()` haalt daar de body-inhoud uit voor
 * gebruik in de compose-editor + uitgaande mail (inline styles + <img data:>
 * blijven behouden; de <head><style>-resets negeren mailclients toch).
 */
import { getActiveInstanceId } from "./instances";

const SETTING_KEY = "mail-signatures"; // instance_settings: { [emailLowercase]: html }

let cache: Record<string, string> | null = null;
let cacheInstanceId: string | null = null;

function lsKey(instanceId: string): string {
  return `mail-signature-overrides-${instanceId}`;
}

function loadMap(instanceId: string): Record<string, string> {
  if (cache && cacheInstanceId === instanceId) return cache;
  try {
    const raw = localStorage.getItem(lsKey(instanceId));
    cache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    cache = {};
  }
  cacheInstanceId = instanceId;
  return cache;
}

function normEmail(email: string): string {
  return (email || "").toLowerCase().trim();
}

/** De ruwe, opgeslagen handtekening-HTML voor dit adres (voor de editor). "" = geen override. */
export function getSignatureOverride(email: string): string {
  const id = getActiveInstanceId();
  if (!id) return "";
  return loadMap(id)[normEmail(email)] || "";
}

/** True als er een handmatige handtekening is ingesteld voor dit adres. */
export function hasSignatureOverride(email: string): boolean {
  return getSignatureOverride(email).trim().length > 0;
}

/** Schrijf/wis de handtekening voor een adres. Lege string = wissen (val terug op ERPNext). */
export function setSignatureOverride(email: string, html: string): void {
  const id = getActiveInstanceId();
  if (!id) return;
  const key = normEmail(email);
  if (!key) return;
  const map: Record<string, string> = { ...loadMap(id) };
  if (html && html.trim()) map[key] = html;
  else delete map[key];
  cache = map;
  cacheInstanceId = id;
  try {
    localStorage.setItem(lsKey(id), JSON.stringify(map));
  } catch {
    /* localStorage vol — de server-PUT hieronder is dan de bron */
  }
  if (id === "default") return;
  fetch(`/api/instances/${encodeURIComponent(id)}/settings/${SETTING_KEY}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: map }),
  }).catch(() => {
    /* stil — localStorage heeft de waarde, sync komt later goed */
  });
}

/** Haal de server-state op en overschrijf de lokale cache. Idempotent; call op mount. */
export async function hydrateSignatureOverrides(): Promise<void> {
  const id = getActiveInstanceId();
  if (!id || id === "default") return;
  try {
    const res = await fetch(
      `/api/instances/${encodeURIComponent(id)}/settings/${SETTING_KEY}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return;
    const data = await res.json();
    const v = data?.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      cache = v as Record<string, string>;
      cacheInstanceId = id;
      try {
        localStorage.setItem(lsKey(id), JSON.stringify(v));
      } catch {
        /* quota — in-memory cache serveert deze sessie */
      }
    }
  } catch {
    /* server onbereikbaar — behoud localStorage-cache */
  }
}

/**
 * Haal de bruikbare handtekening-fragment-HTML op: als de opgeslagen HTML een
 * volledig document is (`<html>`/`<body>`), retourneer alleen de body-inhoud;
 * anders de HTML zelf. Inline styles + `<img src="data:...">` blijven behouden.
 */
export function extractSignatureFragment(html: string): string {
  if (!html) return "";
  const isDocument = /<html[\s>]/i.test(html) || /<body[\s>]/i.test(html);
  if (!isDocument) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body?.innerHTML || html;
  } catch {
    return html;
  }
}
