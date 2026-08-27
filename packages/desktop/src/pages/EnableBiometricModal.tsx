import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Fingerprint } from "lucide-react";

interface Props {
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

export default function EnableBiometricModal({ onEnable, onSkip }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setBusy(true);
    try {
      await onEnable();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 60, padding: 16, fontFamily: "system-ui",
    }}>
      <div style={{
        background: "white", padding: 32, borderRadius: 12,
        width: 420, maxWidth: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Fingerprint size={28} color="#0f172a" />
          <h2 style={{ fontSize: 20, margin: 0 }}>
            {t("desktop.vault_biometric_enable_title", { defaultValue: "Enable fingerprint unlock?" })}
          </h2>
        </div>

        <p style={{ color: "#475569", marginBottom: 12, lineHeight: 1.5, fontSize: 14 }}>
          {t("desktop.vault_biometric_enable_body",
            { defaultValue: "Use your fingerprint to unlock the vault next time, instead of typing your password." })}
        </p>

        <p style={{ color: "#94a3b8", marginBottom: 20, lineHeight: 1.5, fontSize: 12 }}>
          {t("desktop.vault_biometric_enable_caveat",
            { defaultValue: "Your password is stored on this device, protected by the app's private storage. This blocks casual physical access; for full protection use your vault password." })}
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            style={{
              flex: 1, padding: "10px 12px", fontSize: 16,
              background: "white", color: "#0f172a",
              border: "1px solid #e2e8f0", borderRadius: 8,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {t("desktop.vault_biometric_enable_skip", { defaultValue: "Not now" })}
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            style={{
              flex: 1, padding: "10px 12px", fontSize: 16,
              background: "#0f172a", color: "white", border: "none",
              borderRadius: 8,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy
              ? t("desktop.vault_biometric_enable_saving", { defaultValue: "Enabling..." })
              : t("desktop.vault_biometric_enable_confirm", { defaultValue: "Enable" })}
          </button>
        </div>
      </div>
    </div>
  );
}
