/**
 * Biometric unlock for the Stronghold vault on Android.
 *
 * Threat model: the vault password is stored as plain bytes in a file inside
 * the app's private data directory (not readable by other apps without root
 * access). The biometric prompt acts as a UX gate before the JS layer asks
 * the Rust command to read that file. This protects against casual physical
 * access (someone picks up an unlocked phone and opens Y-app), but does NOT
 * protect against a rooted attacker who can read the file directly. That
 * limitation is surfaced in the UI copy that asks the user to opt in.
 *
 * On non-Android platforms every function returns "not available" so the
 * desktop builds compile and behave normally without ever showing biometric
 * UI.
 */

import { invoke } from "@tauri-apps/api/core";

const ANDROID_REGEX = /android/i;

function isAndroid(): boolean {
  // Tauri's webview reports "Android" in the user agent on Android builds.
  return typeof navigator !== "undefined" && ANDROID_REGEX.test(navigator.userAgent);
}

export type BiometricStatus =
  | { available: true }
  | { available: false; reason: string };

/**
 * True if the device exposes a usable biometric authenticator (fingerprint
 * or face) AND the user has enrolled at least one. Returns `available: false`
 * with a reason on every other platform / state.
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (!isAndroid()) return { available: false, reason: "not_android" };
  try {
    const { checkStatus } = await import("@tauri-apps/plugin-biometric");
    const status = await checkStatus();
    if (status.isAvailable) return { available: true };
    return { available: false, reason: status.error ?? status.errorCode ?? "unavailable" };
  } catch (e) {
    return { available: false, reason: String(e) };
  }
}

/** True if the user has previously opted in and the vault password file exists on disk. */
export async function isBiometricEnrolled(): Promise<boolean> {
  if (!isAndroid()) return false;
  try {
    return await invoke<boolean>("biometric_has_password");
  } catch {
    return false;
  }
}

/**
 * Opt-in: store the user's vault password so a future biometric unlock can
 * retrieve it. Caller must have just successfully unlocked the vault with
 * this exact password (otherwise the wrong password gets cached and every
 * future biometric unlock fails).
 */
export async function enableBiometricUnlock(password: string): Promise<void> {
  if (!isAndroid()) throw new Error("Biometric unlock is only available on Android");
  await invoke<void>("biometric_write_password", { content: password });
}

/**
 * Trigger the biometric prompt. On success, return the stored vault password.
 * On user cancel, biometric failure, or no enrolled fingerprint, throws
 * with a code suitable for switching on at the call site.
 */
export async function unlockWithBiometric(reason: string): Promise<string> {
  if (!isAndroid()) throw new Error("not_android");
  const { authenticate } = await import("@tauri-apps/plugin-biometric");

  // 30 s timeout so a never-appearing prompt doesn't leave the UI stuck on
  // "Authenticating..." forever. The plugin's authenticate() can hang on
  // some devices when its host activity / theme is not registered.
  const TIMEOUT_MS = 30_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("biometric prompt timed out — no system dialog appeared")),
      TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([
      authenticate(reason, {
        allowDeviceCredential: false,
        cancelTitle: "Cancel",
        title: "Unlock Y-app",
        confirmationRequired: false,
      }),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  // authenticate() throws on failure; if we reach here biometric succeeded
  return await invoke<string>("biometric_read_password");
}

/** Remove the stored vault password. Used by "Disable biometric unlock" in settings. */
export async function disableBiometricUnlock(): Promise<void> {
  if (!isAndroid()) return;
  try {
    await invoke<void>("biometric_clear_password");
  } catch {
    /* ignore — file may already be absent */
  }
}
