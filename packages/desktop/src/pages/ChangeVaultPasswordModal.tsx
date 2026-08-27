import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changeVaultPassword } from "../adapter/vault";

interface Props {
  onClose: () => void;
}

export default function ChangeVaultPasswordModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const valid = current.length > 0 && next.length >= 8 && next === confirm;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setSaving(true);
    try {
      await changeVaultPassword(current, next);
      setDone(true);
    } catch (err: any) {
      const msg = (err?.message ?? String(err)).toLowerCase();
      if (msg.includes("current password is incorrect")) {
        setError(t("desktop.vault_change_error_wrong_current",
          { defaultValue: "Current password is incorrect." }));
      } else if (msg.includes("at least 8")) {
        setError(t("desktop.vault_change_error_short",
          { defaultValue: "New password must be at least 8 characters." }));
      } else {
        setError(t("desktop.vault_change_error_generic",
          { defaultValue: "Could not change the password. Your existing vault is preserved." }));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 50, padding: 16, fontFamily: "system-ui",
    }}>
      <form
        onSubmit={handleSave}
        style={{ background: "white", padding: 32, borderRadius: 12, width: 420, maxWidth: "100%" }}
      >
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>
          {t("desktop.vault_change_title", { defaultValue: "Change vault password" })}
        </h2>

        {done ? (
          <>
            <p style={{ color: "#16a34a", marginBottom: 16, fontSize: 14 }}>
              {t("desktop.vault_change_success",
                { defaultValue: "Password changed. Use the new password the next time you unlock the vault." })}
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%", padding: "10px 12px", fontSize: 16,
                background: "#0f172a", color: "white", border: "none",
                borderRadius: 8, cursor: "pointer",
              }}
            >
              {t("common.close", { defaultValue: "Close" })}
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#64748b", marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
              {t("desktop.vault_change_body",
                { defaultValue: "There is no recovery — write the new password down before continuing." })}
            </p>

            {error && (
              <p style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{error}</p>
            )}

            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder={t("desktop.vault_change_current_placeholder",
                { defaultValue: "Current password" })}
              autoFocus
              disabled={saving}
              style={inputStyle}
            />
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={t("desktop.vault_change_new_placeholder",
                { defaultValue: "New password (min. 8 characters)" })}
              disabled={saving}
              style={inputStyle}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("desktop.vault_change_confirm_placeholder",
                { defaultValue: "Confirm new password" })}
              disabled={saving}
              style={inputStyle}
            />
            {next && confirm && next !== confirm && (
              <p style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>
                {t("desktop.vault_passwords_no_match",
                  { defaultValue: "Passwords do not match" })}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  flex: 1, padding: "10px 12px", fontSize: 16,
                  background: "white", color: "#0f172a",
                  border: "1px solid #e2e8f0", borderRadius: 8,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                {t("desktop.vault_change_cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="submit"
                disabled={!valid || saving}
                style={{
                  flex: 1, padding: "10px 12px", fontSize: 16,
                  background: "#0f172a", color: "white", border: "none",
                  borderRadius: 8,
                  cursor: (valid && !saving) ? "pointer" : "not-allowed",
                  opacity: (valid && !saving) ? 1 : 0.6,
                }}
              >
                {saving
                  ? t("desktop.vault_change_saving", { defaultValue: "Saving..." })
                  : t("desktop.vault_change_save", { defaultValue: "Change password" })}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 16,
  border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12,
  boxSizing: "border-box",
};
