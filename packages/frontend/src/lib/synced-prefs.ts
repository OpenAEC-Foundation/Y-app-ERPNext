/**
 * Synced prefs — per-instance encrypted blob op de server die alle relevante
 * localStorage keys spiegelt zodat een gebruiker dezelfde credentials/folder-
 * prefs/etc. op desktop + browser + mobiel ziet zonder opnieuw te configureren.
 *
 * Architectuur:
 * - Server endpoint: GET/PUT /api/instances/:id/synced-prefs (encrypted blob,
 *   AES-256-GCM met dezelfde userKey als instance_credentials)
 * - Op login / instance-switch: hydrateFromServer() → schrijft alle keys uit
 *   de blob naar localStorage, zodat bestaande code transparant blijft werken
 * - Periodieke push: elke 30s checkt het script of relevante keys gewijzigd
 *   zijn en pusht naar server. Geen wijzigingen nodig in Settings/ImapSetup;
 *   zij blijven gewoon localStorage gebruiken.
 *
 * Welke keys: alles met prefix `pref_${instanceId}_` plus enkele expliciete
 * keys zoals `email_project_links_${instanceId}`.
 */

const SYNC_INTERVAL_MS = 30_000;
const EXPLICIT_KEY_PATTERNS = [
  // pref_${id}_* — alle IMAP/SMTP/NextCloud/messenger creds + folder prefs
  (instanceId: string) => new RegExp(`^pref_${escapeRegex(instanceId)}_`),
  // Email→project links
  (instanceId: string) => new RegExp(`^email_project_links_${escapeRegex(instanceId)}$`),
  // Webmail folder visibility / favorite / collapse-state
  (instanceId: string) => new RegExp(`^webmail_(collapsed|hidden_folders|favorite_folders)_${escapeRegex(instanceId)}`),
  // Mail signature cache (v5)
  (instanceId: string) => new RegExp(`^mail_signature_v5_${escapeRegex(instanceId)}_`),
  // Mail categories + replied tracking (per instance)
  (instanceId: string) => new RegExp(`^mail_(categories|replied)_${escapeRegex(instanceId)}$`),
  // ─── Globale keys (zonder instance-prefix) — opgeslagen in elke instance-blob,
  // gehydrateerd zodra elke instance wordt geopend. Klein genoeg om redundant te
  // dupliceren, en zo wel cross-device beschikbaar. ───
  () => /^erpnext_(default_|employee_contract_hours|username)/,
  // NB: `pref_company_folder_map` / `pref_default_project_base` zijn vervallen —
  // projectmap-locaties komen nu uit de gedeelde `nas-project-folders`-config
  // (instance_settings), niet meer uit deze localStorage-keys.
  () => /^y_app_language$/,
  () => /^liquidity_start_balance$/,
  () => /^password_categories$/,
  () => /^employee_profile_/,
  () => /^onboarding_/,
];

// Sommige sleutels die qua patroon matchen maar we NIET willen syncen
// (bv. ephemeral state, debug logs, of dingen die je per-device wil houden)
const EXCLUDE_PATTERNS: RegExp[] = [
  /^pref_[^_]+_mail_dev_/, // dev-mock state
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectKeys(instanceId: string): string[] {
  const patterns = EXPLICIT_KEY_PATTERNS.map(fn => fn(instanceId));
  const result: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (EXCLUDE_PATTERNS.some(p => p.test(k))) continue;
    if (patterns.some(p => p.test(k))) result.push(k);
  }
  return result;
}

function snapshot(instanceId: string): Record<string, string> {
  const keys = collectKeys(instanceId);
  const snap: Record<string, string> = {};
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v !== null) snap[k] = v;
  }
  return snap;
}

function fingerprint(obj: Record<string, string>): string {
  // Stabiele "hash" door keys te sorteren + concat. Voor 30s polling is dit
  // voldoende — geen crypto nodig.
  const sortedKeys = Object.keys(obj).sort();
  let s = "";
  for (const k of sortedKeys) s += k + "\0" + obj[k] + "\0";
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h.toString(16);
}

/** Haal de server-blob op en schrijf alle keys naar localStorage. Wordt aangeroepen
 * op login / instance-switch. Bestaande lokale waarden worden overschreven, zodat
 * de server source-of-truth is. */
export async function hydrateFromServer(instanceId: string | number): Promise<{ applied: number; updated_at: number | null } | null> {
  try {
    const res = await fetch(`/api/instances/${instanceId}/synced-prefs`, { credentials: "same-origin" });
    if (!res.ok) {
      if (res.status === 404) return null; // instance niet van deze user
      console.warn("[synced-prefs] hydrate failed:", res.status);
      return null;
    }
    const json = await res.json();
    const prefs: Record<string, string> = json.prefs || {};
    let applied = 0;
    for (const [k, v] of Object.entries(prefs)) {
      if (typeof v === "string" && localStorage.getItem(k) !== v) {
        localStorage.setItem(k, v);
        applied++;
      }
    }
    if (applied > 0) {
      console.info(`[synced-prefs] Hydrated ${applied} keys from server for instance ${instanceId}`);
    }
    return { applied, updated_at: json.updated_at };
  } catch (err) {
    console.warn("[synced-prefs] hydrate error:", err);
    return null;
  }
}

/** Push de huidige localStorage snapshot naar de server. */
export async function pushToServer(instanceId: string | number): Promise<boolean> {
  try {
    const prefs = snapshot(String(instanceId));
    const res = await fetch(`/api/instances/${instanceId}/synced-prefs`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs }),
    });
    if (!res.ok) {
      console.warn("[synced-prefs] push failed:", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[synced-prefs] push error:", err);
    return false;
  }
}

let activeLoop: { instanceId: string; timer: ReturnType<typeof setInterval>; lastFingerprint: string } | null = null;

/** Start de auto-sync loop voor een instance. Stopt elke bestaande loop eerst. */
export function startSyncLoop(instanceId: string | number): void {
  stopSyncLoop();
  const id = String(instanceId);
  // Initiële fingerprint zodat de eerste tick niet meteen pusht
  const lastFingerprint = fingerprint(snapshot(id));
  const timer = setInterval(async () => {
    if (!activeLoop) return;
    const cur = fingerprint(snapshot(id));
    if (cur !== activeLoop.lastFingerprint) {
      const ok = await pushToServer(id);
      if (ok) activeLoop.lastFingerprint = cur;
    }
  }, SYNC_INTERVAL_MS);
  activeLoop = { instanceId: id, timer, lastFingerprint };

  // Push op pagina-sluit (best-effort, sendBeacon doet het op de achtergrond
  // ook als de pagina al weg is). beforeunload werkt voor browser-sluit en
  // tab-sluit.
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushSync, { once: false });
  }
}

export function stopSyncLoop(): void {
  if (activeLoop) {
    clearInterval(activeLoop.timer);
    activeLoop = null;
  }
}

/** Best-effort push bij beforeunload via fetch keepalive (werkt voor PUT). */
function flushSync(): void {
  if (!activeLoop) return;
  const id = activeLoop.instanceId;
  const cur = fingerprint(snapshot(id));
  if (cur === activeLoop.lastFingerprint) return;
  try {
    const prefs = snapshot(id);
    void fetch(`/api/instances/${id}/synced-prefs`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefs }),
      keepalive: true,
    });
  } catch { /* ignore */ }
}
