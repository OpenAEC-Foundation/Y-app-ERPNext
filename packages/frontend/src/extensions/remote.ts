/**
 * Runtime ("remote") extensions.
 *
 * Remote extensions are iframe-hosted pages installed per-instance by the
 * employer via Settings → Extensions. They live at an arbitrary HTTPS URL
 * (typically GitHub Pages) and talk to ERPNext through a postMessage
 * bridge in `components/ExtensionHost.tsx`.
 *
 * Stored server-side under the `remote-extensions` key in the existing
 * `instance_settings` table (value: `RemoteExtension[]`). Cached in
 * localStorage per instance so the sidebar renders immediately on page
 * load; revalidated in the background.
 */

import { useEffect, useState } from "react";
import { getActiveInstanceId } from "../lib/instances";

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

const SETTING_KEY = "remote-extensions";
const LS_PREFIX = "pref_";
const CHANGE_EVENT = "y-app:remote-extensions-changed";

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
    const res = await fetch(`/api/instances/${instanceId}/settings/${SETTING_KEY}`, {
      credentials: "same-origin",
    });
    if (res.status === 404) return [];
    if (!res.ok) return readCache(String(instanceId));
    const data = await res.json().catch(() => null) as { ok?: boolean; value?: unknown } | null;
    const value = data?.ok ? data.value : undefined;
    if (!Array.isArray(value)) return readCache(String(instanceId));
    const list = (value as RemoteExtension[]).filter(isValidRemote);
    writeCache(String(instanceId), list);
    return list;
  } catch {
    return readCache(String(instanceId));
  }
}

export async function saveRemoteExtensions(
  instanceId: string | number,
  list: RemoteExtension[],
): Promise<void> {
  const res = await fetch(`/api/instances/${instanceId}/settings/${SETTING_KEY}`, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: list }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save remote extensions (HTTP ${res.status})`);
  }
  writeCache(String(instanceId), list);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: { instanceId: String(instanceId), list },
  }));
}

export function useRemoteExtensions(): RemoteExtension[] {
  const instanceId = getActiveInstanceId();
  const [list, setList] = useState<RemoteExtension[]>(() => readCache(instanceId));

  useEffect(() => {
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
  }, [instanceId]);

  return list;
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
