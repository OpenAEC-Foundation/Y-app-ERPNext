/**
 * Frappe version detection + effective version resolution.
 * Single source of truth for per-instance version logic.
 */

import { db } from "./db.ts";

interface VersionRow {
  frappe_major_version: number;
  version_override: number | null;
}

const stmtGetVersion = db.prepare(
  "SELECT frappe_major_version, version_override FROM instances WHERE id = ?"
);
const stmtUpdateDetected = db.prepare(
  "UPDATE instances SET frappe_major_version = ?, version_detected_at = ? WHERE id = ?"
);
const stmtUpdateOverride = db.prepare(
  "UPDATE instances SET version_override = ? WHERE id = ?"
);

/**
 * Call ERPNext to get the Frappe major version.
 * Throws if the call fails or the version cannot be parsed.
 *
 * Direct fetch — does NOT use proxyRequest because that depends on AsyncLocalStorage
 * context which is not always set when this is called (e.g. from addInstance before
 * the instance is even persisted).
 */
export async function detectFrappeVersion(url: string, sid: string): Promise<number> {
  const fullUrl = `${url.replace(/\/+$/, "")}/api/method/frappe.utils.change_log.get_versions`;
  const res = await fetch(fullUrl, {
    method: "GET",
    headers: { Cookie: sid, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status !== 200) {
    throw new Error(`Version detection failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  const versionStr = body?.message?.frappe?.version;
  if (!versionStr) throw new Error("Frappe version not in response");
  const major = parseInt(String(versionStr).split(".")[0], 10);
  if (Number.isNaN(major) || major < 13 || major > 99) {
    throw new Error(`Invalid Frappe version: ${versionStr}`);
  }
  return major;
}

/** Get the effective version for an instance (override ?? detected). */
export function getEffectiveVersion(instanceId: number): number {
  const row = stmtGetVersion.get(instanceId) as VersionRow | undefined;
  if (!row) return 15; // default fallback for unknown instance
  return row.version_override ?? row.frappe_major_version;
}

/** Save the detected version + timestamp. */
export function saveDetectedVersion(instanceId: number, major: number): void {
  stmtUpdateDetected.run(major, Date.now(), instanceId);
}

/** Set or clear the manual version override. Pass null to clear. */
export function setVersionOverride(instanceId: number, override: number | null): void {
  stmtUpdateOverride.run(override, instanceId);
}
