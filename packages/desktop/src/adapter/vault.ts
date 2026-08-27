/**
 * Stronghold vault integration for Y-app Desktop.
 *
 * All credentials (ERPNext, IMAP, SMTP, NextCloud, Telegram) are stored
 * in a Stronghold encrypted vault file, protected by the user's vault password.
 * The Store API is used for key-value storage of credential JSON blobs.
 */

import { Stronghold, type Client, type Store } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

const CLIENT_NAME = "y-app-desktop";
const CREDENTIALS_KEY = "instance_credentials";

let stronghold: Stronghold | null = null;
let store: Store | null = null;
/** Held in-memory while the vault is open so the change-password flow can
 * verify the user's "current password" entry against what actually unlocked
 * the vault. Cleared on closeVault / resetVault. */
let unlockedPassword: string | null = null;

/** A named mail account, the desktop equivalent of a row in the web server's
 *  `mail_accounts` table. Stored inside the encrypted Stronghold vault. The
 *  password lives here (encrypted at rest); it is never returned by the GET
 *  list route. */
export interface MailAccount {
  id: string;
  email: string;
  label: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username: string;
  password: string;
}

export interface InstanceCredentials {
  instance_id: number;
  erpnext_username: string;
  erpnext_password: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_pass?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  /** Named mail accounts (multi-account, like the web). When present, the
   *  mail routes use the one selected via ?account=<id>; otherwise mail falls
   *  back to the single imap_ fields or the ERPNext auto-resolve. */
  mail_accounts?: MailAccount[];
  nextcloud_url?: string;
  nextcloud_user?: string;
  nextcloud_pass?: string;
  nextcloud_talk_url?: string;
  nextcloud_talk_user?: string;
  nextcloud_talk_pass?: string;
  telegram_token?: string;
}

function encode(data: unknown): number[] {
  return Array.from(new TextEncoder().encode(JSON.stringify(data)));
}

function decode<T>(bytes: Uint8Array | null): T | null {
  if (!bytes || bytes.length === 0) return null;
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * Create a new vault or open an existing one.
 * Stronghold.load() handles both cases: if the file exists, the password
 * must match; if it doesn't exist, a new vault is created.
 */
export async function openVault(password: string): Promise<void> {
  const dir = await appDataDir();
  const vaultPath = `${dir}/vault.hold`;
  stronghold = await Stronghold.load(vaultPath, password);

  // Try to load existing client, or create a new one
  try {
    const client = await stronghold.loadClient(CLIENT_NAME);
    store = client.getStore();
  } catch {
    // Client doesn't exist yet (first launch) — create it
    const client = await stronghold.createClient(CLIENT_NAME);
    store = client.getStore();
    await stronghold.save();
  }
  unlockedPassword = password;
  // Vault-handoff voor popout-vensters: bewaar het werkende wachtwoord in
  // Rust-procesgeheugen (NOOIT op schijf) zodat een nieuw venster stil kan
  // unlocken. Best-effort; gewist in closeVault.
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("session_put_unlock", { secret: password });
  } catch { /* popouts vragen dan zelf om het wachtwoord */ }
}

/** Check if the vault file exists on disk. */
export async function vaultExists(): Promise<boolean> {
  // Use the Tauri command since we can't do fs checks from webview directly
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<boolean>("vault_exists");
}

/** Close the vault and clear references. */
export async function closeVault(): Promise<void> {
  if (stronghold) {
    await stronghold.save();
    await stronghold.unload();
    stronghold = null;
    store = null;
  }
  unlockedPassword = null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("session_clear_unlock");
  } catch { /* ignore */ }
}

/**
 * Permanently delete the vault file and its per-device salt. All locally saved
 * credentials are erased. Called from the "Forgot password" flow on the unlock
 * screen when the user can no longer unlock the existing vault.
 */
export async function resetVault(): Promise<void> {
  if (stronghold) {
    try { await stronghold.unload(); } catch { /* ignore */ }
    stronghold = null;
    store = null;
  }
  unlockedPassword = null;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("reset_vault");
}

/**
 * Re-encrypt the vault with a new password.
 *
 * Stronghold has no native rekey, so this:
 *   1. Verifies `oldPassword` against the in-memory unlock password
 *   2. Snapshots all credentials currently in memory
 *   3. Closes the vault and backs up vault.hold + stronghold-salt.txt
 *   4. Wipes the live files and creates a fresh vault with `newPassword`
 *   5. Writes the credentials back into the new vault
 *   6. Deletes the backup
 *
 * On any failure between steps 4 and 5, the .bak files are restored and the
 * vault is reopened with the old password — credentials are not lost.
 */
export async function changeVaultPassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (unlockedPassword == null) {
    throw new Error("Vault is not open");
  }
  if (oldPassword !== unlockedPassword) {
    throw new Error("Current password is incorrect");
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }

  const { invoke } = await import("@tauri-apps/api/core");

  // Step 2: snapshot creds
  const all = await getAllCredentials();

  // Step 3: close + back up
  await closeVault();
  await invoke<void>("backup_vault");

  try {
    // Step 4: wipe + reopen with new password (creates fresh vault.hold + salt)
    await invoke<void>("reset_vault");
    await openVault(newPassword);

    // Step 5: write credentials back
    for (const cred of all) {
      await setInstanceCredentials(cred);
    }

    // Step 6: success — also clear any biometric-stored password since it
    // no longer matches the new vault password.
    await invoke<void>("delete_vault_backup");
    try { await invoke<void>("biometric_clear_password"); } catch { /* ignore */ }
    // The remembered (Windows Credential Manager) password is now stale too.
    try { await invoke<void>("remember_clear"); } catch { /* ignore */ }
  } catch (e) {
    // Roll back: close anything we opened, restore .bak files, reopen with old
    try { await closeVault(); } catch { /* ignore */ }
    try { await invoke<void>("reset_vault"); } catch { /* ignore */ }
    await invoke<void>("restore_vault_backup");
    try { await openVault(oldPassword); } catch { /* user must unlock manually */ }
    throw e;
  }
}

/** Get all stored instance credentials. */
/** Popout-sneltoegang: al-ontsleutelde snapshot uit het hoofdvenster (via de
 *  Rust creds-handoff). Alleen als LEES-fallback wanneer de kluis in dit
 *  venster niet geopend is — schrijfacties blijven vereisen dat de kluis
 *  echt open is (saveAllCredentials no-op't zonder store, zoals voorheen). */
let credentialSnapshot: InstanceCredentials[] | null = null;
export function primeCredentialSnapshot(creds: InstanceCredentials[]): void {
  credentialSnapshot = creds;
}

export async function getAllCredentials(): Promise<InstanceCredentials[]> {
  if (!store) return credentialSnapshot ?? [];
  const bytes = await store.get(CREDENTIALS_KEY);
  return decode<InstanceCredentials[]>(bytes) ?? [];
}

/** Save the full credential list (replaces all). */
async function saveAllCredentials(creds: InstanceCredentials[]): Promise<void> {
  if (!store || !stronghold) return;
  await store.insert(CREDENTIALS_KEY, encode(creds));
  await stronghold.save();
}

/** Store or update credentials for a specific instance. */
export async function setInstanceCredentials(creds: InstanceCredentials): Promise<void> {
  const all = await getAllCredentials();
  const idx = all.findIndex((c) => c.instance_id === creds.instance_id);
  if (idx >= 0) {
    all[idx] = creds;
  } else {
    all.push(creds);
  }
  await saveAllCredentials(all);
}

/** Remove credentials for a specific instance. */
export async function removeInstanceCredentials(instanceId: number): Promise<void> {
  const all = await getAllCredentials();
  const filtered = all.filter((c) => c.instance_id !== instanceId);
  await saveAllCredentials(filtered);
}

/** Get credentials for a specific instance. */
export async function getInstanceCredentials(instanceId: number): Promise<InstanceCredentials | null> {
  const all = await getAllCredentials();
  return all.find((c) => c.instance_id === instanceId) ?? null;
}

/* ─── Mail accounts (per instance, multi-account) ─── */

/** List the named mail accounts stored for an instance (empty if none). */
export async function listMailAccounts(instanceId: number): Promise<MailAccount[]> {
  const c = await getInstanceCredentials(instanceId);
  return c?.mail_accounts ?? [];
}

/** Insert or replace a mail account (matched by id) for an instance. */
export async function upsertMailAccount(instanceId: number, acc: MailAccount): Promise<void> {
  const c = await getInstanceCredentials(instanceId);
  if (!c) throw new Error("Instance not found in vault");
  const list = c.mail_accounts ? [...c.mail_accounts] : [];
  const idx = list.findIndex((a) => a.id === acc.id);
  if (idx >= 0) list[idx] = acc;
  else list.push(acc);
  await setInstanceCredentials({ ...c, mail_accounts: list });
}

/** Remove a mail account by id. Returns false if it did not exist. */
export async function removeMailAccount(instanceId: number, accountId: string): Promise<boolean> {
  const c = await getInstanceCredentials(instanceId);
  if (!c?.mail_accounts) return false;
  const list = c.mail_accounts.filter((a) => a.id !== accountId);
  if (list.length === c.mail_accounts.length) return false;
  await setInstanceCredentials({ ...c, mail_accounts: list });
  return true;
}

/**
 * Push all credentials to the desktop-server sidecar.
 * Called after vault unlock so the sidecar has credentials in memory.
 */
export async function syncCredentialsToSidecar(): Promise<void> {
  const all = await getAllCredentials();
  await fetch("/api/desktop/load-credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instances: all }),
  });
}
