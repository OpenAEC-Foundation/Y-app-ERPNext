/**
 * Runtime ("remote") extensions.
 *
 * Remote extensions are iframe-hosted pages installed per-instance by the
 * employer via Settings → Extensions. They live at an arbitrary HTTPS URL
 * (typically GitHub Pages) and talk to ERPNext through a postMessage
 * bridge in `components/ExtensionHost.tsx`.
 *
 * Y-next draait zonder eigen server, dus dit slaat niet meer op via
 * `/api/instances/.../settings` (Express, `instance_settings`-tabel).
 * De installed-extensions-lijst leeft nu in ERPNext zelf, op één document
 * van het generieke custom DocType `Y Next Setting` (autoname
 * "field:setting_key", dus de docname IS de sleutel): key
 * `remote-extensions`, waarde de JSON-gestringify'de `RemoteExtension[]`
 * in `setting_value`. Zelfde provisioning-script als "Y Meeting Note"
 * (scripts/provision-y-next.mjs). localStorage blijft de leescache zodat
 * de sidebar meteen rendert; revalidatie loopt op de achtergrond.
 */

import { useEffect, useState } from "react";
import { getActiveInstanceId } from "../lib/instances";
import { isFeatureEnabled } from "../lib/capabilities";
import { fetchDocument, createDocument, updateDocument, ApiError } from "../lib/erpnext";

export interface RemoteExtension {
  /** Stable, URL-safe machine ID. Used in the route `/x/<id>`. */
  id: string;
  /** Display label shown in the sidebar and tabs. */
  name: string;
  /** Base URL of the extension's static build (no trailing slash required). */
  url: string;
  /** Sidebar section title to place it under. "" = top-level. */
  sidebarSection: string;
  /** Visibility filter — defaults to "all". */
  visibility?: "all" | "employer" | "employee";
}

const SETTING_DOCTYPE = "Y Next Setting";
const SETTING_KEY = "remote-extensions";
const LS_PREFIX = "pref_";
const CHANGE_EVENT = "y-app:remote-extensions-changed";

interface YNextSettingDoc {
  name: string;
  setting_key: string;
  setting_value?: string;
}

function cacheKey(instanceId: string): string {
  return `${LS_PREFIX}${instanceId}_${SETTING_KEY}`;
}

function readCache(instanceId: string): RemoteExtension[] {
  try {
    const raw = localStorage.getItem(cacheKey(instanceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RemoteExtension[]) : [];
  } catch {
    return [];
  }
}

function writeCache(instanceId: string, list: RemoteExtension[]): void {
  try {
    localStorage.setItem(cacheKey(instanceId), JSON.stringify(list));
  } catch { /* quota — ignore */ }
}

export async function fetchRemoteExtensions(instanceId: string | number): Promise<RemoteExtension[]> {
  try {
    const doc = await fetchDocument<YNextSettingDoc>(SETTING_DOCTYPE, SETTING_KEY);
    const value = doc.setting_value ? JSON.parse(doc.setting_value) : [];
    if (!Array.isArray(value)) return readCache(String(instanceId));
    const list = (value as RemoteExtension[]).filter(isValidRemote);
    writeCache(String(instanceId), list);
    return list;
  } catch (err) {
    // Nog geen extensies geïnstalleerd (record bestaat nog niet) of het
    // DocType zelf is nog niet geprovisioned — beide zijn een gewone 404 in
    // Frappe's REST API, geen fout die de sidebar moet blokkeren.
    if (err instanceof ApiError && err.status === 404) return [];
    return readCache(String(instanceId));
  }
}

export async function saveRemoteExtensions(
  instanceId: string | number,
  list: RemoteExtension[],
): Promise<void> {
  const payload = { setting_value: JSON.stringify(list) };
  try {
    await updateDocument(SETTING_DOCTYPE, SETTING_KEY, payload);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Eerste installatie op deze instance — het record bestaat nog niet.
      await createDocument(SETTING_DOCTYPE, { setting_key: SETTING_KEY, ...payload });
    } else {
      throw err;
    }
  }
  writeCache(String(instanceId), list);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: { instanceId: String(instanceId), list },
  }));
}

/** Stabiele lege lijst zodat een uitgeschakelde feature geen render-churn
 *  veroorzaakt bij consumers die op referentie-identiteit vergelijken. */
const NO_EXTENSIONS: RemoteExtension[] = [];

export function useRemoteExtensions(): RemoteExtension[] {
  // Fase 1: extensies zijn uit — geen settings-call, geen cache-hydratie.
  const enabled = isFeatureEnabled("extensions");
  const instanceId = getActiveInstanceId();
  const [list, setList] = useState<RemoteExtension[]>(() => (enabled ? readCache(instanceId) : NO_EXTENSIONS));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchRemoteExtensions(instanceId).then((fresh) => {
      if (!cancelled) setList(fresh);
    });
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ instanceId: string; list: RemoteExtension[] }>).detail;
      if (detail?.instanceId === instanceId) setList(detail.list);
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [enabled, instanceId]);

  return enabled ? list : NO_EXTENSIONS;
}

/** Normalise the URL the iframe will load. Appends the bridge query params. */
export function buildExtensionSrc(ext: RemoteExtension, params: {
  hostOrigin: string;
  instanceId: string;
  erpUrl: string;
  lang: string;
}): string {
  const base = ext.url.replace(/\/+$/, "");
  const q = new URLSearchParams({
    host: params.hostOrigin,
    instance: params.instanceId,
    erpUrl: params.erpUrl,
    lang: params.lang,
  });
  return `${base}/?${q.toString()}`;
}

/** Extract the origin from a remote extension's URL for postMessage
 * targetOrigin and incoming event.origin checks. Returns "*" only as a
 * last-resort fallback for malformed URLs (which should never pass
 * isValidRemote anyway). */
export function extensionOrigin(ext: RemoteExtension): string {
  try {
    return new URL(ext.url).origin;
  } catch {
    return "*";
  }
}

function isValidRemote(v: unknown): v is RemoteExtension {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" && r.id.length > 0 &&
    typeof r.name === "string" && r.name.length > 0 &&
    typeof r.url === "string" && /^https?:\/\//.test(r.url) &&
    typeof r.sidebarSection === "string"
  );
}
