import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import nl from "./nl.json";
import en from "./en.json";
import de from "./de.json";

const savedLang = localStorage.getItem("y_app_language") || "nl";

i18n.use(initReactI18next).init({
  resources: { nl: { translation: nl }, en: { translation: en }, de: { translation: de } },
  lng: savedLang,
  fallbackLng: "nl",
  interpolation: { escapeValue: false },
});

export function changeLanguage(lang: string) {
  i18n.changeLanguage(lang);
  localStorage.setItem("y_app_language", lang);
}

export default i18n;
