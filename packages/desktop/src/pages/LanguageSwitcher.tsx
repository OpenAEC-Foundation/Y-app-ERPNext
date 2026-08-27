import { useTranslation } from "react-i18next";
import { changeLanguage } from "@frontend/i18n/index";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div style={{
      position: "absolute", top: 16, right: 16,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 13, color: "#94a3b8" }}>{t("desktop.language")}</span>
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        style={{
          background: "white", color: "#334155", fontSize: 13,
          padding: "4px 8px", borderRadius: 6,
          border: "1px solid #e2e8f0", cursor: "pointer",
        }}
      >
        <option value="nl">NL</option>
        <option value="en">EN</option>
        <option value="de">DE</option>
      </select>
    </div>
  );
}
