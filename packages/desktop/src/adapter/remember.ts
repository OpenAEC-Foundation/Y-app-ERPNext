/**
 * "Remember on this device" — silent vault auto-unlock backed by the Windows
 * Credential Manager (Rust `keyring`). Opt-in. Unlike the Android biometric
 * adapter there is no prompt: the OS already gates access via the Windows
 * account login. Every function is a safe no-op on platforms without a
 * credential store (the Rust commands return not-supported / false there).
 */
import { invoke } from "@tauri-apps/api/core";

/** True when this platform has a usable credential store (Windows today). */
export async function isRememberSupported(): Promise<boolean> {
  try {
    return await invoke<boolean>("remember_supported");
  } catch {
    return false;
  }
}

/** True when a vault password is currently stored for auto-unlock. */
export async function isRemembered(): Promise<boolean> {
  try {
    return await invoke<boolean>("remember_has_password");
  } catch {
    return false;
  }
}

/** Retrieve the stored vault password, or null if none / unsupported. */
export async function getRememberedPassword(): Promise<string | null> {
  try {
    return await invoke<string | null>("remember_get_password");
  } catch {
    return null;
  }
}

/** Store the vault password for future auto-unlock. Caller must have just
 *  unlocked the vault with this exact password. */
export async function enableRemember(password: string): Promise<void> {
  await invoke("remember_set_password", { content: password });
}

/** Forget the stored vault password (no-op if none). */
export async function clearRemember(): Promise<void> {
  try {
    await invoke("remember_clear");
  } catch {
    /* ignore — entry may already be absent */
  }
}
