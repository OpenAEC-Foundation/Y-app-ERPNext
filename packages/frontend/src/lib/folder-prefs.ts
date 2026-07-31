/**
 * Mail-folder preferences (hidden / favorite / sent-override / trash-override)
 * with fire-and-forget server sync, extracted verbatim from pages/Webmail.tsx.
 */
import { getActiveInstanceId } from "./instances";
import { getMailFolderPref, setMailFolderPref } from "./mailFolderPrefs";

export const DEFAULT_HIDDEN_FOLDERS = ["Calendar", "Contacts", "Conversation History", "Journal", "Notes", "Tasks", "Suggested Contacts", "RSS Feeds", "Outbox", "Sync Issues"];

export function getHiddenFolders(): Set<string> {
  try {
    const raw = localStorage.getItem(`pref_${getActiveInstanceId()}_hidden_mail_folders`);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set(DEFAULT_HIDDEN_FOLDERS);
}

export function setHiddenFolders(paths: Set<string>) {
  const id = getActiveInstanceId();
  localStorage.setItem(`pref_${id}_hidden_mail_folders`, JSON.stringify([...paths]));
  // Server-sync fire-and-forget zodat hidden-instelling cross-device
  // beschikbaar is. Bestaand /api/instances/:id/settings/:key endpoint.
  if (id && id !== "default") {
    fetch(`/api/instances/${encodeURIComponent(id)}/settings/mail-hidden-folders`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: [...paths] }),
    }).catch(() => { /* silent */ });
  }
}

export function getFavoriteFolders(): Set<string> {
  try {
    const raw = localStorage.getItem(`pref_${getActiveInstanceId()}_favorite_mail_folders`);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

export function setFavoriteFolders(paths: Set<string>) {
  const id = getActiveInstanceId();
  localStorage.setItem(`pref_${id}_favorite_mail_folders`, JSON.stringify([...paths]));
  // Server-sync zelfde patroon als hidden — cross-device, fire-and-forget.
  if (id && id !== "default") {
    fetch(`/api/instances/${encodeURIComponent(id)}/settings/mail-favorite-folders`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: [...paths] }),
    }).catch(() => { /* silent */ });
  }
}

/**
 * Expliciete "Verzonden items"-map. Sommige mailservers (Stalwart) hebben
 * naast een \Sent-gevlagde "Sent" óók een gelokaliseerde "Verzonden items"
 * die de gebruiker feitelijk gebruikt; zonder override landt de sent-kopie in
 * de verkeerde map en lijkt verzonden mail te verdwijnen. Per-instance,
 * device-lokaal (geen pref_-sync nodig — mailbox-eigenschap, zelden meerdere
 * devices). Leeg = auto-detectie op de server.
 */
export function getSentFolderOverride(acct?: string): string {
  return getMailFolderPref("sent", acct);
}

export function setSentFolderOverride(path: string, acct?: string) {
  setMailFolderPref("sent", path, acct);
}

/**
 * Verwijderde-map override: kies handmatig welke server-map de Trash is.
 * Zelfde patroon als de Verzonden-override; cross-device via synced-prefs
 * (pref_-prefix). Leeg = auto-detectie op de server (\\Trash-vlag → naam-match).
 */
export function getTrashFolderOverride(acct?: string): string {
  return getMailFolderPref("trash", acct);
}

export function setTrashFolderOverride(path: string, acct?: string) {
  setMailFolderPref("trash", path, acct);
}

/**
 * Hydrate favorite + hidden folders van server bij Webmail-mount. Server
 * is bron van waarheid (cross-device); localStorage is sync-fallback voor
 * instant render. Overschrijft localStorage met server-state.
 */
export async function hydrateFolderPrefs(): Promise<void> {
  const id = getActiveInstanceId();
  if (!id || id === "default") return;
  const fetchOne = async (key: string, localKey: string) => {
    try {
      const res = await fetch(
        `/api/instances/${encodeURIComponent(id)}/settings/${key}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const value = data?.value;
      if (Array.isArray(value)) {
        try { localStorage.setItem(localKey, JSON.stringify(value)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  };
  await Promise.all([
    fetchOne("mail-favorite-folders", `pref_${id}_favorite_mail_folders`),
    fetchOne("mail-hidden-folders", `pref_${id}_hidden_mail_folders`),
  ]);
}
