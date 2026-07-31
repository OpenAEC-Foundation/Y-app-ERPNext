import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

interface Props {
  onCreate: (password: string) => Promise<void>;
  error: string | null;
}

export default function FirstLaunch({ onCreate, error }: Props) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const valid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    try {
      await onCreate(password);
    } finally {
      setLoading(false);
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
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 400,
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{t("desktop.first_launch_title")}</h1>
        <p style={{ color: "#64748b", marginBottom: 24 }}>{t("desktop.first_launch_subtitle")}</p>
        {error && <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("desktop.vault_password_create_placeholder")}
          autoFocus
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 12,
            boxSizing: "border-box",
          }}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("desktop.vault_password_confirm_placeholder")}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        {password && confirm && password !== confirm && (
          <p style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>
            {t("desktop.vault_passwords_no_match")}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !valid}
          style={{
            width: "100%", padding: "10px 12px", fontSize: 16,
            background: "#0f172a", color: "white", border: "none",
            borderRadius: 8, cursor: loading ? "wait" : "pointer",
            opacity: loading || !valid ? 0.6 : 1,
          }}
        >
          {loading ? t("desktop.vault_creating_button") : t("desktop.vault_create_button")}
        </button>
      </form>
    </div>
  );
}
