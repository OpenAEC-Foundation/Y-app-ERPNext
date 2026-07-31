/**
 * Verzonden-/Verwijderde-items-map override — PER ACCOUNT.
 *
 * Voorheen per-instance (`pref_${id}_sent_folder`); nu per account gekeyd op het
 * e-mailadres (`pref_${id}_<email>_sent_folder`), met terugval op de oude
 * per-instance sleutel zodat bestaande instellingen blijven gelden tot je 'm per
 * account aanpast. `pref_`-prefix → wordt door synced-prefs cross-device gesynct.
 *
 * `acct` = het e-mailadres van het account. Leeg/undefined = alleen de
 * instance-brede sleutel (backward-compat).
 */
import { getActiveInstanceId } from "./instances";

export type MailFolderKind = "sent" | "trash";

function key(instanceId: string, kind: MailFolderKind, acct?: string): string {
  const base = `pref_${instanceId}`;
  return acct ? `${base}_${acct.toLowerCase()}_${kind}_folder` : `${base}_${kind}_folder`;
}

/** Gekozen map voor dit account (of de instance-brede fallback). "" = automatisch. */
export function getMailFolderPref(kind: MailFolderKind, acct?: string): string {
  try {
    const id = getActiveInstanceId();
    if (!id) return "";
    let v: string | null = acct ? localStorage.getItem(key(id, kind, acct)) : null;
    if (v === null) v = localStorage.getItem(key(id, kind)); // fallback: instance-breed
    return v || "";
  } catch {
    return "";
  }
}

/** Schrijf/wis de map voor een account. Leeg pad = wissen (val terug op automatisch). */
export function setMailFolderPref(kind: MailFolderKind, path: string, acct?: string): void {
  try {
    const id = getActiveInstanceId();
    if (!id) return;
    const k = key(id, kind, acct);
    if (path) localStorage.setItem(k, path);
    else localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
