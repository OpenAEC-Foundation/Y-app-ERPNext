import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Fingerprint } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  getBiometricStatus,
  isBiometricEnrolled,
  unlockWithBiometric,
  disableBiometricUnlock,
} from "../adapter/biometric";
import { isRememberSupported, isRemembered } from "../adapter/remember";

interface Props {
  onUnlock: (password: string, remember: boolean) => Promise<void>;
  onReset: () => Promise<void>;
  error: string | null;
}

export default function VaultUnlock({ onUnlock, onReset, error }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  // "Remember on this device" (Windows Credential Manager). Default the
  // checkbox on when already remembered (so re-typing after an explicit lock
  // keeps it remembered), else off.
  const [rememberSupported, setRememberSupported] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await isRememberSupported())) return;
      if (cancelled) return;
      setRememberSupported(true);
      const already = await isRemembered();
      if (!cancelled) setRemember(already);
    })();
    return () => { cancelled = true; };
  }, []);

  // On mount: detect whether biometric unlock is available + previously
  // enrolled. If enrolled, auto-trigger the prompt after a short delay so
  // the unlock screen renders first (the user sees the password field
  // behind the system biometric dialog as a visual fallback).
  // Once they cancel or it fails, the dialog is dismissed and they're left
  // on the screen with the password field + fingerprint button to retry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await getBiometricStatus();
      if (cancelled || !status.available) return;
      const enrolled = await isBiometricEnrolled();
      if (cancelled) return;
      setBiometricEnrolled(enrolled);
      if (enrolled) {
        // Tiny delay so the screen paints before the prompt covers it —
        // makes the fallback UI visible immediately on cancel.
        setTimeout(() => {
          if (!cancelled) handleBiometricUnlock();
        }, 150);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBiometricUnlock() {
    if (biometricBusy) return;
    setBiometricBusy(true);
    setBiometricError(null);
    try {
      const stored = await unlockWithBiometric(
        t("desktop.vault_biometric_prompt", { defaultValue: "Unlock Y-app vault" }),
      );
      await onUnlock(stored, false);
    } catch (e: any) {
      const raw = e?.message ?? String(e);
      const msg = raw.toLowerCase();
      // If the stored password no longer unlocks the vault (e.g. user
      // changed it elsewhere), wipe the biometric file so the wrong
      // password isn't auto-supplied forever.
      if (msg.includes("badfilekey") || msg.includes("decode") || msg.includes("decrypt")) {
        await disableBiometricUnlock();
        setBiometricEnrolled(false);
      }
      // Surface the raw error so we can debug. User-cancelled prompts
      // tend to include "userCancel" / "Cancel" — those we silence.
      if (!/usercancel|user cancel|cancelled|canceled/i.test(raw)) {
        setBiometricError(raw);
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUnlock(password, remember);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
      setShowReset(false);
      setConfirmText("");
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontFamily: "system-ui", background: "#f8fafc",
      position: "relative",
    }}>
      <LanguageSwitcher />
      <form onSubmit={handleSubmit} style={{
        background: "white", padding: 40, borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 360,
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{t("desktop.vault_unlock_title")}</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>{t("desktop.vault_unlock_subtitle")}</p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("desktop.vault_password_placeholder")}
          autoFocus
          autoComplete="off"
          data-1p-ignore
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            background: "#0f172a", color: "white", border: "none",
            borderRadius: 8, cursor: loading ? "wait" : "pointer",
            opacity: loading || !password ? 0.6 : 1,
          }}
        >
          {loading ? t("desktop.vault_unlocking_button") : t("desktop.vault_unlock_button")}
        </button>
        {rememberSupported && (
          <label
            style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 14,
              fontSize: 13, color: "#475569", cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            {t("desktop.vault_remember_device", { defaultValue: "Onthoud op dit apparaat" })}
          </label>
        )}
        {biometricError && (
          <p style={{ color: "#ef4444", marginTop: 12, fontSize: 12, wordBreak: "break-word" }}>
            biometric error: {biometricError}
          </p>
        )}
        {biometricEnrolled && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={biometricBusy || loading}
            style={{
              width: "100%", marginTop: 12, padding: "10px 12px", fontSize: 15,
              background: "white", color: "#0f172a",
              border: "1px solid #e2e8f0", borderRadius: 8,
              cursor: (biometricBusy || loading) ? "wait" : "pointer",
              opacity: (biometricBusy || loading) ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Fingerprint size={18} />
            {biometricBusy
              ? t("desktop.vault_biometric_authenticating", { defaultValue: "Authenticating..." })
              : t("desktop.vault_biometric_unlock_button", { defaultValue: "Unlock with fingerprint" })}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowReset(true)}
          style={{
            width: "100%", marginTop: 16, padding: 0, fontSize: 14,
            background: "none", border: "none", color: "#64748b",
            cursor: "pointer", textDecoration: "underline",
          }}
        >
          {t("desktop.vault_forgot_password")}
        </button>
      </form>

      {showReset && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50, padding: 16,
        }}>
          <div style={{
            background: "white", padding: 32, borderRadius: 12,
            width: 420, maxWidth: "100%",
          }}>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>
              {t("desktop.vault_reset_title")}
            </h2>
            <p style={{ color: "#475569", marginBottom: 16, lineHeight: 1.5 }}>
              {t("desktop.vault_reset_body")}
            </p>
            <p style={{ color: "#475569", marginBottom: 8, fontSize: 14 }}>
              {t("desktop.vault_reset_confirm_hint")}
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", fontSize: 16,
                border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => { setShowReset(false); setConfirmText(""); }}
                disabled={resetting}
                style={{
                  flex: 1, padding: "10px 12px", fontSize: 16,
                  background: "white", color: "#0f172a",
                  border: "1px solid #e2e8f0", borderRadius: 8,
                  cursor: resetting ? "wait" : "pointer",
                }}
              >
                {t("desktop.vault_reset_cancel")}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={confirmText !== "RESET" || resetting}
                style={{
                  flex: 1, padding: "10px 12px", fontSize: 16,
                  background: "#dc2626", color: "white", border: "none",
                  borderRadius: 8,
                  cursor: (confirmText === "RESET" && !resetting) ? "pointer" : "not-allowed",
                  opacity: (confirmText === "RESET" && !resetting) ? 1 : 0.6,
                }}
              >
                {resetting ? t("desktop.vault_resetting_button") : t("desktop.vault_reset_confirm_button")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
