import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings, Save, Building2, ExternalLink, Shield, CheckCircle, XCircle, Key, Eye, EyeOff, Mail, Cloud, Wifi, Bot, Video, LayoutGrid, ChevronDown, ChevronRight, Info, FileText, Plus, Trash2, Loader2, Users, FolderKanban, Puzzle, Check, Send } from "lucide-react";
import {
  fetchInvoiceEmailTemplates,
  fetchSalesInvoicePrintFormats,
  loadInvoiceEmailDefaults,
  saveInvoiceEmailDefaults,
} from "../lib/invoiceEmail";
import type { ViewMode } from "../components/Sidebar";
import { useCompanies, useEmployees } from "../lib/DataContext";
import { fetchList, ApiError } from "../lib/erpnext";
import { NasSettingsSection } from "../components/NasSettingsSection";
import { getActiveInstance, getActiveInstanceId, getActiveCompany } from "../lib/instances";
import { getErpNextLinkUrl } from "../lib/erpnext";
import { getModuleConfig, setModuleConfig, type ModuleConfig, SIDEBAR_MODULES, ALWAYS_VISIBLE } from "../lib/modules";
import { isFeatureEnabled, isPageEnabled } from "../lib/capabilities";
import ComingSoon from "../components/ComingSoon";
import type { Page } from "../components/Sidebar";

/** All modules that can appear in employee sidebar — used for employer toggle UI */
const EMPLOYEE_MANAGEABLE_MODULES: { id: Page; label: string; section: string }[] = [
  { id: "dashboard", label: "Dashboard", section: "" },
  { id: "webmail", label: "E-mail", section: "" },
  { id: "contacts", label: "Contacten", section: "" },
  { id: "messenger", label: "Berichten", section: "" },
  { id: "calendar", label: "Agenda", section: "" },
  { id: "tasks", label: "Taken", section: "Taken & Planning" },
  { id: "subtasks", label: "Subtaken", section: "Taken & Planning" },
  { id: "nextcloud-files", label: "Documenten", section: "" },
  { id: "financieel-dashboard", label: "Statistieken", section: "" },
  { id: "projects", label: "Projecten", section: "Projecten" },
  { id: "quotations", label: "Offertes", section: "Projecten" },
  { id: "salesorders", label: "Verkooporders", section: "Projecten" },
  { id: "leads", label: "Leads", section: "Projecten" },
  { id: "meeting-notes", label: "Vergadernotities", section: "Projecten" },
  { id: "deliverynotes", label: "Leveringen", section: "Projecten" },
  { id: "planning", label: "Planning", section: "Taken & Planning" },
  { id: "timesheets", label: "Urenregistratie", section: "Taken & Planning" },
  { id: "todo", label: "Todo", section: "Taken & Planning" },
  { id: "wiki", label: "Kennisbank", section: "Taken & Planning" },
  { id: "ledgers", label: "Grootboeken", section: "Boekhouding" },
  { id: "bank-transactions", label: "Banktransacties", section: "Boekhouding" },
  { id: "sales", label: "Verkoopfacturen", section: "Boekhouding" },
  { id: "purchase", label: "Inkoopfacturen", section: "Boekhouding" },
  { id: "booking-program", label: "Boekingsprogramma", section: "Boekhouding" },
  { id: "btw", label: "BTW", section: "Boekhouding" },
  { id: "jaarrekening", label: "Jaarrekening", section: "Boekhouding" },
  { id: "revenue", label: "Omzet", section: "Financieel" },
  { id: "outstanding", label: "Openstaand", section: "Financieel" },
  { id: "cost-insight", label: "Kosteninzicht", section: "Financieel" },
  { id: "profitability", label: "Rendabiliteit", section: "Financieel" },
  { id: "liquidity-planning", label: "Liquiditeitsplanning", section: "Financieel" },
  { id: "loonaangifte", label: "Loonaangifte", section: "Financieel" },
  { id: "leave", label: "Vakantie & Overuren", section: "HR & Personeel" },
  { id: "expenses", label: "Onkostenvergoeding", section: "HR & Personeel" },
  { id: "letters", label: "Brieven", section: "" },
  { id: "erpnext-overview", label: "Implementatie", section: "" },
  { id: "settings", label: "Instellingen", section: "" },
];
import { APP_VERSION, APP_NAME } from "../lib/version";
import { IS_MINI } from "../lib/variant";
import ReleaseNotes from "./ReleaseNotes";
import MailAccountSettings from "./MailAccountSettings";
import { useTranslation } from "react-i18next";
import { CATALOG, type CatalogEntry } from "../extensions/catalog";
import {
  fetchRemoteExtensions,
  saveRemoteExtensions,
  type RemoteExtension,
} from "../extensions/remote";

type SettingsTab = "general" | "companies" | "credentials" | "status" | "modules" | "email-accounts" | "employee-settings" | "project-settings" | "extensions";

const VALID_TABS: readonly SettingsTab[] = [
  "general", "companies", "credentials", "status", "modules",
  "email-accounts", "employee-settings", "project-settings", "extensions",
];
function isValidTab(v: string | undefined): v is SettingsTab {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

/**
 * Y-next fase 1: welke tabbladen zijn bruikbaar zónder de verdwenen
 * Express-server?
 *
 * Alleen tabs die uitsluitend localStorage of de standaard ERPNext-REST
 * gebruiken blijven aan. De overige tabs verdwijnen uit de tabbalk én worden
 * bij een directe URL (`/settings/<tab>`) niet gerenderd — hun panelen doen
 * hun calls in een mount-effect, dus niet-renderen is wat voorkomt dat er een
 * request vertrekt.
 */
function isSettingsTabEnabled(tab: SettingsTab): boolean {
  switch (tab) {
    // localStorage en/of /api/resource — same-origin ERPNext, altijd veilig.
    case "general":
    case "companies":
    case "modules":
      return true;
    // /api/status — aggregatie van de server-side cache.
    case "status":
      return isFeatureEnabled("stats");
    // /api/instances/<id>/settings/* en /api/shared-settings/* — de brug
    // waarmee de werkgever instellingen deelt met medewerkers.
    case "employee-settings":
    case "project-settings":
      return isFeatureEnabled("shared-settings");
    // /api/instances/<id>/mail-accounts + /api/mail/folders
    case "email-accounts":
      return isFeatureEnabled("webmail");
    // Geïnstalleerde extensies leven op ERPNext-DocType "Y Next Setting"
    // (resource-CRUD, geen Express-endpoint meer) — zie extensions/remote.ts.
    case "extensions":
      return isFeatureEnabled("extensions");
    // /api/vault/*
    case "credentials":
      return isFeatureEnabled("vault");
  }
}

function getViewMode(): ViewMode {
  return (localStorage.getItem("view_mode") as ViewMode) || "employer";
}

interface VaultEntry {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  apiSecret: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const companies = useCompanies();
  const allEmployees = useEmployees();
  const viewMode = getViewMode();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const defaultTab: SettingsTab = IS_MINI ? "credentials" : "general";
  const activeTab: SettingsTab = isValidTab(tabParam) ? tabParam : defaultTab;
  const setActiveTab = useCallback((next: SettingsTab) => {
    navigate(next === defaultTab ? "/settings" : `/settings/${next}`);
  }, [navigate, defaultTab]);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const activeInstance = getActiveInstance();

  const instanceId = getActiveInstanceId();

  const [defaultCompany, setDefaultCompany] = useState(
    () => localStorage.getItem(`pref_${instanceId}_company`) || ""
  );
  const [defaultEmployee, setDefaultEmployee] = useState(
    () => localStorage.getItem(`pref_${instanceId}_employee`) || ""
  );
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const defaultActivityType = useMemo(() => {
    if (!defaultEmployee) return "";
    return localStorage.getItem(`pref_${instanceId}_default_activity_type_${defaultEmployee}`) || "";
  }, [defaultEmployee, instanceId]);
  const [selectedActivityType, setSelectedActivityType] = useState(defaultActivityType);

  useEffect(() => {
    setSelectedActivityType(
      defaultEmployee
        ? localStorage.getItem(`pref_${instanceId}_default_activity_type_${defaultEmployee}`) || ""
        : ""
    );
  }, [defaultEmployee, instanceId]);

  useEffect(() => {
    fetchList<{ name: string }>("Activity Type", { fields: ["name"], limit_page_length: 0 })
      .then(list => setActivityTypes(list.map(a => a.name)))
      .catch(() => {});
  }, []);
  // NextCloud
  const [nextcloudUrl, setNextcloudUrl] = useState(
    () => localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || ""
  );
  // NextCloud Talk
  const [ncTalkUrl, setNcTalkUrl] = useState(() => localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_url`) || localStorage.getItem(`pref_${instanceId}_nextcloud_url`) || "");
  const [ncTalkUser, setNcTalkUser] = useState(() => localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_user`) || localStorage.getItem(`pref_${instanceId}_nextcloud_user`) || "");
  const [ncTalkPass, setNcTalkPass] = useState(() => localStorage.getItem(`pref_${instanceId}_messenger_nextcloud-talk_pass`) || localStorage.getItem(`pref_${instanceId}_nextcloud_pass`) || "");
  const [showNcTalkPass, setShowNcTalkPass] = useState(false);
  // Telegram
  const [telegramToken, setTelegramToken] = useState(() => localStorage.getItem(`pref_${instanceId}_messenger_telegram_token`) || "");
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  // MS Teams
  const [teamsEmail, setTeamsEmail] = useState(() => localStorage.getItem(`pref_${instanceId}_messenger_ms-teams_email`) || "");

  const [saved, setSaved] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<Record<string, unknown> | null>(null);
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editingVault, setEditingVault] = useState<VaultEntry | null>(null);
  const [connectionTest, setConnectionTest] = useState<{ testing: boolean; result: { ok: boolean; user?: string; error?: string } | null }>({ testing: false, result: null });
  const [ncTalkTest, setNcTalkTest] = useState<{ testing: boolean; result: { ok: boolean; message?: string; error?: string; conversations?: number; unread?: number } | null }>({ testing: false, result: null });
  const [fetchingData, setFetchingData] = useState(false);

  // Login form state (Y-mini) — pre-populate from active instance + vault
  const [loginUrl, setLoginUrl] = useState(() => activeInstance.url || "");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginName, setLoginName] = useState(() => activeInstance.name || "");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginStatus, setLoginStatus] = useState<{ loading: boolean; error?: string; success?: string }>({ loading: false });

  // Employer settings: activity types, per-employee activity types, and module visibility for employees
  const [employerActivityTypes, setEmployerActivityTypes] = useState<string[]>([]);
  const [employeeActivityMap, setEmployeeActivityMap] = useState<Record<string, string>>({});
  const [employerModules, setEmployerModules] = useState<Record<string, boolean>>({});
  const [employerSettingsLoading, setEmployerSettingsLoading] = useState(false);
  const [employerSettingsSaved, setEmployerSettingsSaved] = useState(false);

  // Active employees for the per-employee activity type table
  const defaultCompanyVal = getActiveCompany();
  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.status === "Active" && (!defaultCompanyVal || e.company === defaultCompanyVal)),
    [allEmployees, defaultCompanyVal]
  );

  // `/api/status` bestond alleen op de Express-server. Zonder deze guard vuurt
  // de enabled route /settings bij elke mount een request af die in fase 1
  // sowieso niet beantwoord kan worden.
  useEffect(() => {
    if (!isFeatureEnabled("stats")) return;
    fetch("/api/status")
      .then((r) => r.json())
      .then(setCacheStatus)
      .catch(() => {});
  }, []);

  // Load employer settings from server (Express-only shared-settings-brug).
  useEffect(() => {
    if (viewMode !== "employer" || !isFeatureEnabled("shared-settings")) return;
    const id = getActiveInstanceId();
    fetch(`/api/instances/${id}/settings`)
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.settings) {
          if (data.settings["activity-types"]) setEmployerActivityTypes(data.settings["activity-types"]);
          if (data.settings["employee-activity-types"]) setEmployeeActivityMap(data.settings["employee-activity-types"]);
          if (data.settings["employee-visible-modules"]) setEmployerModules(data.settings["employee-visible-modules"]);
        }
      })
      .catch(() => {});
  }, [viewMode]);

  async function saveEmployerSettings() {
    setEmployerSettingsLoading(true);
    const id = getActiveInstanceId();
    try {
      await Promise.all([
        fetch(`/api/instances/${id}/settings/activity-types`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: employerActivityTypes }),
        }),
        fetch(`/api/instances/${id}/settings/employee-activity-types`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: employeeActivityMap }),
        }),
        fetch(`/api/instances/${id}/settings/employee-visible-modules`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: employerModules }),
        }),
      ]);
      setEmployerSettingsSaved(true);
      setTimeout(() => setEmployerSettingsSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setEmployerSettingsLoading(false); }
  }

  function handleSave() {
    const id = getActiveInstanceId();
    // Per-instance prefs only — global keys are gone. Each instance tab keeps
    // its own company/employee/activity-type so switching between Domera and
    // 3BM doesn't leak filters across tenants.
    if (defaultCompany) {
      localStorage.setItem(`pref_${id}_company`, defaultCompany);
    } else {
      localStorage.removeItem(`pref_${id}_company`);
    }
    if (defaultEmployee) {
      localStorage.setItem(`pref_${id}_employee`, defaultEmployee);
      if (selectedActivityType) {
        localStorage.setItem(`pref_${id}_default_activity_type_${defaultEmployee}`, selectedActivityType);
      } else {
        localStorage.removeItem(`pref_${id}_default_activity_type_${defaultEmployee}`);
      }
    } else {
      localStorage.removeItem(`pref_${id}_employee`);
    }
    // NextCloud — strip trailing slashes en zorg dat protocol aanwezig is.
    // Gebruikers vullen vaak alleen "nextcloud.3bm.cloud" in; zonder
    // protocol gooit server-side fetch een DNS/parse-fout (timeout).
    const normalizeUrl = (raw: string): string => {
      const trimmed = raw.trim().replace(/\/+$/, "");
      if (!trimmed) return "";
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    };
    const cleanNcUrl = normalizeUrl(nextcloudUrl);
    if (cleanNcUrl) {
      localStorage.setItem(`pref_${id}_nextcloud_url`, cleanNcUrl);
    } else {
      localStorage.removeItem(`pref_${id}_nextcloud_url`);
    }
    // Messenger - NextCloud Talk
    const cleanNcTalkUrl = normalizeUrl(ncTalkUrl);
    if (cleanNcTalkUrl) localStorage.setItem(`pref_${id}_messenger_nextcloud-talk_url`, cleanNcTalkUrl); else localStorage.removeItem(`pref_${id}_messenger_nextcloud-talk_url`);
    if (ncTalkUser) localStorage.setItem(`pref_${id}_messenger_nextcloud-talk_user`, ncTalkUser); else localStorage.removeItem(`pref_${id}_messenger_nextcloud-talk_user`);
    if (ncTalkPass) localStorage.setItem(`pref_${id}_messenger_nextcloud-talk_pass`, ncTalkPass); else localStorage.removeItem(`pref_${id}_messenger_nextcloud-talk_pass`);
    // Messenger - Telegram
    if (telegramToken) localStorage.setItem(`pref_${id}_messenger_telegram_token`, telegramToken); else localStorage.removeItem(`pref_${id}_messenger_telegram_token`);
    // Messenger - MS Teams
    if (teamsEmail) localStorage.setItem(`pref_${id}_messenger_ms-teams_email`, teamsEmail); else localStorage.removeItem(`pref_${id}_messenger_ms-teams_email`);

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Zelfde gate als de /release-notes route (App.tsx): ReleaseNotes doet bij
  // mount een cross-origin call naar api.github.com. Fase 1 mag die request
  // nooit versturen, dus het paneel mag hier ook niet renderen.
  if (showReleaseNotes && isPageEnabled("/release-notes")) {
    return (
      <div>
        <div className="px-6 pt-4">
          <button onClick={() => setShowReleaseNotes(false)}
            className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer mb-2">
            &larr; {t("settings.back_to_settings")}
          </button>
        </div>
        <ReleaseNotes />
      </div>
    );
  }

  if (fetchingData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80">
        <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-4 max-w-sm">
          <Loader2 size={48} className="animate-spin text-y-teal" />
          <h3 className="text-xl font-bold text-slate-800">{t("settings.fetching_data")}</h3>
          <p className="text-sm text-slate-500 text-center">
            {t("settings.fetching_data_description")}
          </p>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
            <div className="h-full bg-y-teal rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-y-teal/10 rounded-lg">
          <Settings className="text-y-teal" size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">{t("nav.settings")}</h2>
        <span className="ml-2 text-sm text-slate-500">{t("y_next.direct_mode")}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        {([
          ["general", t("settings.tab.general"), Settings],
          ["modules", t("settings.tab.integrations", { defaultValue: "Integraties" }), LayoutGrid],
          ["email-accounts", t("settings.tab.email_accounts", { defaultValue: "Email accounts" }), Mail],
          ...(viewMode === "employer" ? [
            ["employee-settings" as SettingsTab, t("settings.tab.employee_settings", { defaultValue: "Medewerker instellingen" }), Users] as [SettingsTab, string, typeof Settings],
            ["project-settings" as SettingsTab, t("settings.tab.project_settings", { defaultValue: "Project instellingen" }), FolderKanban] as [SettingsTab, string, typeof Settings],
            ["extensions" as SettingsTab, t("settings.tab.extensions", { defaultValue: "Extensions" }), LayoutGrid] as [SettingsTab, string, typeof Settings],
            ["companies", t("settings.tab.companies"), Building2],
            ["status", t("settings.tab.status"), Shield],
          ] : []),
        ] as [SettingsTab, string, typeof Settings][])
          // Fase 1: alleen tabs die zonder de Express-server werken.
          .filter(([tab]) => isSettingsTabEnabled(tab))
          .map(([tab, label, Icon]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-y-teal text-y-teal"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Directe URL naar een in fase 1 uitgeschakelde tab (`/settings/<tab>`):
          het paneel wordt niet gerenderd — dus ook geen mount-effect met een
          server-only call — en de gebruiker krijgt uitleg terug. */}
      {!isSettingsTabEnabled(activeTab) && (
        activeTab === "status" ? (
          <div className="max-w-2xl bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <p className="text-sm text-slate-500">{t("y_next.direct_mode")}</p>
          </div>
        ) : (
          <ComingSoon />
        )
      )}

      {activeTab === "companies" && (
        <div className="max-w-4xl">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-700">{t("settings.companies_in_erpnext")}</h3>
              <a
                href={`${getErpNextLinkUrl()}/company`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-y-teal hover:text-y-teal-dark"
              >
                <ExternalLink size={14} /> {t("settings.manage_in_erpnext")}
              </a>
            </div>
            {companies.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">{t("settings.no_companies")}</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">{t("tasks.detail.company")}</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">{t("settings.table.abbreviation")}</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">{t("nav.employees")}</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const empCount = allEmployees.filter((e) => e.company === c.name && e.status === "Active").length;
                    return (
                      <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm font-medium text-slate-700">{c.company_name || c.name}</td>
                        <td className="px-6 py-3 text-sm text-slate-500 font-mono">{c.abbr}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">{empCount} {t("settings.active")}</td>
                        <td className="px-6 py-3 text-right">
                          <a
                            href={`${getErpNextLinkUrl()}/company/${encodeURIComponent(c.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-y-teal hover:text-y-teal-dark"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "modules" && <ModulesPanel />}

      {activeTab === "email-accounts" && isSettingsTabEnabled("email-accounts") && <MailAccountSettings />}

      {activeTab === "employee-settings" && isSettingsTabEnabled("employee-settings") && viewMode === "employer" && (
        <div className="max-w-4xl space-y-6">
          {/* Per-employee activity type assignment */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Users size={20} className="text-violet-500" />
              <div>
                <h3 className="text-base font-semibold text-slate-700">{t("settings.employee_activity_type_title", { defaultValue: "Activity type per employee" })}</h3>
                <p className="text-xs text-slate-400">{t("settings.employee_activity_type_desc", { defaultValue: "Set the default activity type per employee. This is used automatically when the employee books hours." })}</p>
              </div>
            </div>
            {activeEmployees.length === 0 ? (
              <p className="text-sm text-slate-400 italic">{t("settings.no_active_employees", { defaultValue: "No active employees found" })}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("settings.employee_name", { defaultValue: "Employee" })}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("settings.activity_type", { defaultValue: "Activity type" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map(emp => (
                      <tr key={emp.name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-sm text-slate-700">{emp.employee_name || emp.name}</td>
                        <td className="px-3 py-2">
                          <select
                            value={employeeActivityMap[emp.name] || ""}
                            onChange={(e) => {
                              setEmployeeActivityMap(prev => ({
                                ...prev,
                                [emp.name]: e.target.value,
                              }));
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                          >
                            <option value="">{t("settings.select_activity_type", { defaultValue: "-- Select --" })}</option>
                            {activityTypes.map(at => (
                              <option key={at} value={at}>{at}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Module visibility for employees */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <LayoutGrid size={20} className="text-violet-500" />
              <div>
                <h3 className="text-base font-semibold text-slate-700">{t("settings.employer_modules_title", { defaultValue: "Module visibility for employees" })}</h3>
                <p className="text-xs text-slate-400">{t("settings.employer_modules_desc", { defaultValue: "Toggle which modules employees can see in their sidebar." })}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {EMPLOYEE_MANAGEABLE_MODULES.map(item => (
                <label key={item.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 ${ALWAYS_VISIBLE.has(item.id) ? "opacity-50" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={employerModules[item.id] !== false}
                    disabled={ALWAYS_VISIBLE.has(item.id)}
                    onChange={(e) => {
                      setEmployerModules(prev => ({ ...prev, [item.id]: e.target.checked }));
                    }}
                    className="rounded border-slate-300 text-violet-500"
                  />
                  <span className="text-sm text-slate-700">{item.label}</span>
                  {item.section && <span className="text-[10px] text-slate-400 ml-auto">{item.section}</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={saveEmployerSettings}
            disabled={employerSettingsLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium cursor-pointer transition-colors"
          >
            <Save size={16} />
            {employerSettingsLoading ? t("settings.saving", { defaultValue: "Saving..." }) : employerSettingsSaved ? t("settings.saved", { defaultValue: "Saved!" }) : t("settings.save_employee_settings", { defaultValue: "Save employee settings" })}
          </button>
        </div>
      )}

      {activeTab === "project-settings" && isSettingsTabEnabled("project-settings") && viewMode === "employer" && (
        <div className="space-y-6">
          <ProjectSettingsPanel instanceId={instanceId} />
          <InvoiceEmailSettingsPanel />
        </div>
      )}

      {activeTab === "extensions" && isSettingsTabEnabled("extensions") && viewMode === "employer" && (
        <ExtensionsPanel instanceId={instanceId} />
      )}

      {activeTab === "credentials" && isSettingsTabEnabled("credentials") && (
        <div className="max-w-4xl space-y-4">
          {/* Login with username/password — works in both Y-mini and Y-app */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700">{t("settings.login_with_erpnext")}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t("settings.login_description")}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.erpnext_url_label")}</label>
                  <input
                    type="url"
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                    placeholder="https://erp.mijnbedrijf.nl"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.name_optional")}</label>
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder={t("settings.company_placeholder")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">{t("settings.display_name_hint")}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.username_email")}</label>
                  <input
                    type="email"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder={t("login.email_placeholder")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("login.password_label")}</label>
                  <div className="relative">
                    <input
                      type={showLoginPass ? "text" : "password"}
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      placeholder={t("settings.erpnext_password_placeholder")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal pr-10"
                      onKeyDown={(e) => { if (e.key === "Enter" && loginUrl && loginUser && loginPass) document.getElementById("mini-login-btn")?.click(); }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(p => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{t("settings.password_encrypted_hint")}</p>
                </div>

                {loginStatus.error && (
                  <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                    <XCircle size={16} className="flex-shrink-0" /> {loginStatus.error}
                  </div>
                )}
                {loginStatus.success && (
                  <div className="p-3 rounded-lg text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2">
                    <CheckCircle size={16} className="flex-shrink-0" /> {loginStatus.success}
                  </div>
                )}

                <button
                  id="mini-login-btn"
                  disabled={!loginUrl || !loginUser || !loginPass || loginStatus.loading}
                  onClick={async () => {
                    setLoginStatus({ loading: true });
                    const cleanUrl = loginUrl.replace(/\/+$/, "");
                    try {
                      // Step 1: Login to get session cookie
                      const loginResp = await fetch("/api/vault/login-step", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: cleanUrl, username: loginUser, password: loginPass }),
                      });
                      const loginData = await loginResp.json();
                      if (!loginData.ok) {
                        setLoginStatus({ loading: false, error: loginData.error });
                        return;
                      }
                      // Step 2: Save session credentials to vault
                      const saveResp = await fetch("/api/vault/save-session", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          url: cleanUrl,
                          username: loginUser,
                          password: loginPass,
                          sid: loginData.sid,
                          fullName: loginName || loginData.fullName,
                        }),
                      });
                      const saveData = await saveResp.json();
                      if (!saveData.ok) {
                        setLoginStatus({ loading: false, error: saveData.error });
                        return;
                      }
                      setLoginStatus({ loading: false, success: t("settings.connected_as", { fullName: loginData.fullName || loginUser }) });
                      setLoginPass("");
                      setFetchingData(true);
                      setTimeout(() => window.location.reload(), 2500);
                    } catch (err) {
                      setLoginStatus({ loading: false, error: (err as Error).message });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {loginStatus.loading ? (
                    <><Loader2 size={16} className="animate-spin" /> {t("settings.connecting")}</>
                  ) : (
                    <><Key size={16} /> {t("settings.connect_to_erpnext")}</>
                  )}
                </button>
              </div>
            </div>

          {/* Existing vault entries table (hidden in Y-mini — only login form) */}
          {!IS_MINI && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-700">{IS_MINI ? t("settings.linked_instances") : t("settings.encrypted_vault")}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {IS_MINI ? t("settings.instances_description") : t("settings.vault_description")}
                </p>
              </div>
              {!IS_MINI && (
              <button
                onClick={() => setEditingVault({ id: "", name: "", url: "", apiKey: "", apiSecret: "" })}
                className="flex items-center gap-1.5 px-3 py-2 bg-y-teal text-white text-xs font-medium rounded-lg hover:bg-y-teal-dark cursor-pointer"
              >
                <Plus size={14} />
                {t("settings.new_instance")}
              </button>
              )}
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">{t("settings.vault.instance")}</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">URL</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">Auth</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600">{t("settings.tab.credentials")}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {vaultEntries.map((entry) => {
                  const isSession = !!(entry as any).sessionUser && !(entry as any).apiKey;
                  return (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm font-medium text-slate-700">{entry.name}</td>
                    <td className="px-6 py-3 text-sm text-slate-500 font-mono text-xs">{entry.url}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isSession ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                        {isSession ? t("settings.vault.session") : t("settings.vault.api_token")}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500 font-mono text-xs">
                      {isSession ? (
                        <span className="text-slate-500">{(entry as any).sessionUser}</span>
                      ) : (
                      <button
                        onClick={() => setShowSecrets((s) => ({ ...s, [entry.id]: !s[entry.id] }))}
                        className="flex items-center gap-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showSecrets[entry.id] ? (
                          <><EyeOff size={12} /> {entry.apiKey}:{entry.apiSecret}</>
                        ) : (
                          <><Eye size={12} /> {entry.apiKey}:********</>
                        )}
                      </button>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingVault(entry)}
                        className="text-xs text-y-teal hover:text-y-teal-dark cursor-pointer"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(t("settings.confirm_delete_instance", { name: entry.name }))) return;
                          try {
                            await fetch(`/api/vault/${encodeURIComponent(entry.id)}`, { method: "DELETE" });
                            const res = await fetch("/api/vault");
                            const d = await res.json();
                            setVaultEntries(d.data || []);
                          } catch { /* ignore */ }
                        }}
                        className="text-slate-400 hover:text-red-500 cursor-pointer p-1"
                        title={t("common.delete_tooltip")}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {vaultEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      {t("settings.no_instances")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}


          {/* Edit vault entry modal */}
          {editingVault && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setEditingVault(null)} />
              <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  {editingVault.id ? `Credentials: ${editingVault.name}` : t("settings.add_new_instance")}
                </h3>
                {!editingVault.id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.instance_id_label")}</label>
                      <input
                        type="text"
                        value={editingVault.id}
                        onChange={(e) => setEditingVault({ ...editingVault, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                        placeholder="mijn-erp"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">{t("settings.instance_id_hint")}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.name_label")}</label>
                      <input
                        type="text"
                        value={editingVault.name}
                        onChange={(e) => setEditingVault({ ...editingVault, name: e.target.value })}
                        placeholder={t("settings.company_placeholder")}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.erpnext_url_label")}</label>
                  <input
                    type="url"
                    value={editingVault.url}
                    onChange={(e) => setEditingVault({ ...editingVault, url: e.target.value })}
                    placeholder="https://erp.mijnbedrijf.nl"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                  <input
                    type="text"
                    value={editingVault.apiKey}
                    onChange={(e) => setEditingVault({ ...editingVault, apiKey: e.target.value })}
                    autoComplete="off" name="vault-api-key"
                    placeholder={t("settings.api_key_hint")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
                  <input
                    type="password"
                    value={editingVault.apiSecret}
                    onChange={(e) => setEditingVault({ ...editingVault, apiSecret: e.target.value })}
                    autoComplete="new-password" name="vault-api-secret"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                {/* Connection test result */}
                {connectionTest.result && (
                  <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${connectionTest.result.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    {connectionTest.result.ok ? (
                      <><CheckCircle size={16} /> {t("settings.connection_success")} <span className="font-mono font-medium">{connectionTest.result.user}</span></>
                    ) : (
                      <><XCircle size={16} /> {t("settings.connection_failed")} {connectionTest.result.error}</>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setEditingVault(null); setConnectionTest({ testing: false, result: null }); }}
                    className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    disabled={!editingVault.url || !editingVault.apiKey || !editingVault.apiSecret || connectionTest.testing}
                    onClick={async () => {
                      setConnectionTest({ testing: true, result: null });
                      try {
                        const resp = await fetch("/api/vault/test-connection", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: editingVault.url, apiKey: editingVault.apiKey, apiSecret: editingVault.apiSecret }),
                        });
                        const result = await resp.json();
                        setConnectionTest({ testing: false, result });
                      } catch (err) {
                        setConnectionTest({ testing: false, result: { ok: false, error: (err as Error).message } });
                      }
                    }}
                    className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {connectionTest.testing ? <><Loader2 size={14} className="animate-spin" /> {t("settings.testing")}</> : <><Wifi size={14} /> {t("settings.test_connection")}</>}
                  </button>
                  <button
                    disabled={!editingVault.id || !editingVault.url || !editingVault.apiKey || !editingVault.apiSecret || connectionTest.testing}
                    onClick={async () => {
                      // First test the connection
                      setConnectionTest({ testing: true, result: null });
                      try {
                        const testResp = await fetch("/api/vault/test-connection", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ url: editingVault.url, apiKey: editingVault.apiKey, apiSecret: editingVault.apiSecret }),
                        });
                        const testResult = await testResp.json();
                        setConnectionTest({ testing: false, result: testResult });

                        if (!testResult.ok) return; // Don't save if connection fails

                        // Save to vault
                        await fetch("/api/vault", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(editingVault),
                        });
                        setEditingVault(null);
                        setConnectionTest({ testing: false, result: null });

                        // Show fetching data overlay
                        setFetchingData(true);
                        // Give the server a moment to reload instances, then refresh
                        setTimeout(() => window.location.reload(), 2000);
                      } catch { /* ignore */ }
                    }}
                    className="px-4 py-2 text-sm text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
                  >
                    {t("settings.save_to_vault")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "status" && isSettingsTabEnabled("status") && (
        <div className="max-w-4xl space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">{t("settings.cache_status")}</h3>
            {cacheStatus ? (
              <div className="space-y-4">
                {Object.entries((cacheStatus as { instances: Record<string, Record<string, unknown>> }).instances || {}).map(([id, info]) => (
                  <div key={id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {(info as { ready: boolean }).ready ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-amber-500" />
                      )}
                      <span className="font-semibold text-slate-700">
                        {(info as { name: string }).name || id}
                      </span>
                      <span className="text-xs text-slate-400">({id})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Object.entries((info as { doctypes: Record<string, { count: number; lastSync: string | null }> }).doctypes || {}).map(([dt, dtInfo]) => (
                        <div key={dt} className="bg-slate-50 rounded p-2">
                          <div className="text-xs font-medium text-slate-600">{dt}</div>
                          <div className="text-lg font-bold text-slate-800">{dtInfo.count}</div>
                          {dtInfo.lastSync && (
                            <div className="text-[10px] text-slate-400">
                              {new Date(dtInfo.lastSync).toLocaleTimeString("nl-NL")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">{t("settings.backend_unreachable")}</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "general" && (
        <div className="max-w-2xl space-y-6">
          {/* Connection info. Single-tenant heeft geen instance-URL meer (de
              app draait op dezelfde origin als ERPNext), dus tonen we dan één
              neutrale regel in plaats van een lege "Verbonden met"-waarde. */}
          <div className="bg-gradient-to-r from-y-purple-dark to-y-purple rounded-xl p-4 text-white">
            {activeInstance.url ? (
              <>
                <p className="text-sm font-medium text-y-teal-light/80 mb-1">{t("settings.connected_to")}</p>
                <p className="text-lg font-bold font-mono">{activeInstance.url}</p>
                <p className="text-xs text-white/50 mt-2">
                  {t("settings.vault_info")}
                  Instances: <code className="bg-white/10 px-1 rounded">~/.erpnext-level/</code>
                </p>
              </>
            ) : (
              <p className="text-sm font-medium">{t("y_next.direct_mode")}</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            {/* Default Company */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {t("settings.default_company")}
              </label>
              <select
                value={defaultCompany}
                onChange={(e) => setDefaultCompany(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal text-sm cursor-pointer"
              >
                <option value="">{t("instance_bar.all_companies")}</option>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.company_name || c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Employee */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {t("settings.default_employee")}
              </label>
              <select
                value={defaultEmployee}
                onChange={(e) => setDefaultEmployee(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal text-sm cursor-pointer"
              >
                <option value="">{t("settings.no_default")}</option>
                {allEmployees
                  .filter((e) => e.status === "Active")
                  .map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.employee_name} ({e.name})
                    </option>
                  ))}
              </select>
            </div>

            {/* Saved confirmation */}
            {saved && (
              <div className="p-4 rounded-lg text-sm bg-y-teal/10 border border-y-teal/20 text-y-teal-dark">
                {t("settings.saved_confirmation")}
              </div>
            )}

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2.5 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer"
            >
              <Save size={16} />
              {t("common.save")}
            </button>
          </div>

          {/* NextCloud — de bijbehorende pagina's en proxy draaiden op de
              Express-server; instellen heeft in fase 1 geen effect. */}
          {isFeatureEnabled("nextcloud") && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Cloud size={20} className="text-blue-500" />
              <h3 className="text-base font-semibold text-slate-700">NextCloud</h3>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t("settings.nextcloud_url_label")}</label>
              <input
                type="url"
                value={nextcloudUrl}
                onChange={(e) => setNextcloudUrl(e.target.value)}
                placeholder="https://cloud.example.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">{t("settings.nextcloud_url_hint")}</p>
            </div>
          </div>
          )}

          {/* E-mail-config staat uitsluitend in de "Email accounts"-tab
              (server-vault). Geen losse e-mail/IMAP-sectie meer in Algemeen. */}

          {/* Messenger-koppelingen (NextCloud Talk / Telegram / MS Teams).
              De "Test verbinding"-knop hieronder praat met /api/messenger/test
              — een Express-only endpoint — dus het hele blok hangt aan de
              messenger-feature. */}
          {isFeatureEnabled("messenger") && (
          <>
          {/* NextCloud Talk */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Cloud size={20} className="text-blue-500" />
              <h3 className="text-base font-semibold text-slate-700">{t("settings.nextcloud_talk")}</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.nextcloud_url_label")}</label>
              <input
                type="url" value={ncTalkUrl}
                onChange={(e) => setNcTalkUrl(e.target.value)}
                placeholder="https://cloud.example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.imap_username")}</label>
              <input
                type="text" value={ncTalkUser}
                onChange={(e) => setNcTalkUser(e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("login.password_label")}</label>
              <div className="relative">
                <input
                  type={showNcTalkPass ? "text" : "password"} value={ncTalkPass}
                  onChange={(e) => setNcTalkPass(e.target.value)}
                  placeholder={t("settings.app_password_placeholder")}
                  className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => setShowNcTalkPass(!showNcTalkPass)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {showNcTalkPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">{t("settings.app_password_hint")}</p>
            </div>

            {/* Test verbinding — geeft per stap aan waarom een config wel/niet werkt */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={ncTalkTest.testing || !ncTalkUrl || !ncTalkUser || !ncTalkPass}
                onClick={async () => {
                  setNcTalkTest({ testing: true, result: null });
                  try {
                    const resp = await fetch("/api/messenger/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "same-origin",
                      body: JSON.stringify({
                        platform: "nextcloud-talk",
                        url: ncTalkUrl,
                        user: ncTalkUser,
                        pass: ncTalkPass,
                      }),
                    });
                    const data = await resp.json();
                    setNcTalkTest({ testing: false, result: data });
                  } catch (err) {
                    setNcTalkTest({ testing: false, result: { ok: false, error: (err as Error).message } });
                  }
                }}
                className="self-start flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg cursor-pointer"
              >
                {ncTalkTest.testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                Test verbinding
              </button>
              {ncTalkTest.result && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${
                  ncTalkTest.result.ok
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  {ncTalkTest.result.ok ? (
                    <div className="flex items-start gap-2">
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{ncTalkTest.result.message}</p>
                        <p className="mt-1">
                          {ncTalkTest.result.conversations ?? 0} gesprek(ken) gevonden
                          {(ncTalkTest.result.unread ?? 0) > 0 && `, ${ncTalkTest.result.unread} ongelezen`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <p>{ncTalkTest.result.error || "Verbinding mislukt"}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Telegram */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Bot size={20} className="text-sky-500" />
              <h3 className="text-base font-semibold text-slate-700">{t("settings.telegram_bot")}</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bot Token</label>
              <div className="relative">
                <input
                  type={showTelegramToken ? "text" : "password"} value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button onClick={() => setShowTelegramToken(!showTelegramToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {showTelegramToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">{t("settings.telegram_hint")}</p>
            </div>
          </div>

          {/* MS Teams */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Video size={20} className="text-violet-500" />
              <h3 className="text-base font-semibold text-slate-700">MS Teams</h3>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.ms365_email_label")}</label>
              <input
                type="email" value={teamsEmail}
                onChange={(e) => setTeamsEmail(e.target.value)}
                placeholder={t("login.email_placeholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="text-xs text-slate-400 mt-1">{t("settings.teams_email_hint")}</p>
            </div>
          </div>
          </>
          )}

          {/* Save all button (bottom) */}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2.5 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer"
          >
            <Save size={16} />
            {t("settings.save_all")}
          </button>

          {/* NAS-opslag (projectmap-locaties + mailbijlage-template). ENIGE bron
              van waarheid, server-gesynct. De werkgever bewerkt dit op de
              Project-instellingen-tab; medewerkers zien het hier read-only zodat
              de ingestelde paden voor iedereen zichtbaar zijn. De vroegere
              device-lokale "NAS-map pad per bedrijf" (FSA-handle) is hier
              weggehaald — die keuze gebeurt nu inline in SaveToNasDialog. */}
          {viewMode !== "employer" && isFeatureEnabled("shared-settings") && (
            <NasSettingsSection instanceId={instanceId} readOnly />
          )}

          {/* Over Y-app */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <Info size={20} className="text-y-teal" />
              <h3 className="text-base font-semibold text-slate-700">{t("settings.about")} {APP_NAME}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">{t("settings.version")}:</span>
                <span className="text-sm font-semibold text-slate-800">v{APP_VERSION}</span>
              </div>
              <div className="flex items-center gap-3">
                {isPageEnabled("/release-notes") && (
                  <button
                    onClick={() => setShowReleaseNotes(true)}
                    className="flex items-center gap-2 text-sm text-y-teal hover:text-y-teal-dark font-medium cursor-pointer"
                  >
                    <FileText size={14} />
                    {t("settings.view_release_notes")}
                  </button>
                )}
                <a
                  href="https://github.com/rickd/y-app/blob/main/CHANGELOG.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
                >
                  <ExternalLink size={14} />
                  CHANGELOG {t("settings.on_github")}
                </a>
              </div>
              <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 mb-1.5">{t("settings.latest_update")} (v{APP_VERSION})</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>- {t("settings.changelog_1")}</li>
                  <li>- {t("settings.changelog_2")}</li>
                  <li>- {t("settings.changelog_3")}</li>
                  <li>- {t("settings.changelog_4")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Toggle Switch Component ─── */
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-y-teal focus:ring-offset-2 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-y-teal" : "bg-slate-300"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ─── Modules Panel ─── */
function ModulesPanel() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ModuleConfig>(getModuleConfig);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  const persist = useCallback((next: ModuleConfig) => {
    setConfig(next);
    setModuleConfig(next);
  }, []);

  function toggleSection(title: string) {
    const current = config.sections[title] !== false;
    persist({
      ...config,
      sections: { ...config.sections, [title]: !current },
    });
  }

  function toggleItem(itemId: string) {
    const current = config.items[itemId] !== false;
    persist({
      ...config,
      items: { ...config.items, [itemId]: !current },
    });
  }

  function toggleExpanded(title: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  }

  const alwaysVisible = new Set(["dashboard", "settings"]);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-700">{t("settings.manage_modules")}</h3>
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.manage_modules_hint")}
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {SIDEBAR_MODULES.map((mod, idx) => {
            const sectionOn = config.sections[mod.title] !== false;
            const isExpanded = expandedSections.has(mod.title || `_${idx}`);
            const hasToggleableItems = mod.items.some((i) => !alwaysVisible.has(i.id));

            return (
              <div key={mod.title || `_${idx}`}>
                {/* Section header */}
                <div className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-50 transition-colors">
                  {/* Expand/collapse arrow for item-level toggles */}
                  {hasToggleableItems ? (
                    <button
                      onClick={() => toggleExpanded(mod.title || `_${idx}`)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}

                  <span className="flex-1 text-sm font-semibold text-slate-700">{mod.title || t("settings.general_items", { defaultValue: "Algemeen" })}</span>

                  {mod.sectionToggleable ? (
                    <Toggle checked={sectionOn} onChange={() => toggleSection(mod.title)} />
                  ) : (
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t("settings.always_active")}</span>
                  )}
                </div>

                {/* Individual items */}
                {isExpanded && (
                  <div className="bg-slate-50/50 border-t border-slate-100">
                    {mod.items.map((item) => {
                      const locked = alwaysVisible.has(item.id);
                      const itemOn = locked || (sectionOn && config.items[item.id] !== false);
                      const disabled = locked || (!sectionOn && mod.sectionToggleable);

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-6 pl-14 py-2 ${
                            disabled && !locked ? "opacity-40" : ""
                          }`}
                        >
                          <span className="flex-1 text-sm text-slate-600">{item.label}</span>
                          {locked ? (
                            <span className="text-[10px] text-slate-400">{t("settings.required")}</span>
                          ) : (
                            <Toggle
                              checked={itemOn}
                              onChange={() => toggleItem(item.id)}
                              disabled={disabled}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        {t("settings.modules_save_hint")}
      </p>
    </div>
  );
}

/* ─── ProjectSettingsPanel ─── */

interface TemplateMappingRow { customer: string; customerLabel: string; template: string; }
interface CustomerOption { name: string; customer_name: string; }

function ProjectSettingsPanel({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<TemplateMappingRow[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // New row state
  const [newCustomer, setNewCustomer] = useState("");
  const [newCustomerSearch, setNewCustomerSearch] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/instances/${instanceId}/settings/project-template-mapping`).then(r => r.json()).catch(() => null),
      fetchList<{ name: string }>("Project Template", { fields: ["name"], limit_page_length: 0 }).catch(() => []),
      fetchList<CustomerOption>("Customer", { fields: ["name", "customer_name"], filters: [["disabled", "=", 0]], limit_page_length: 0, order_by: "customer_name asc" }).catch(() => []),
    ]).then(([settingData, tmplList, custList]) => {
      const custs: CustomerOption[] = Array.isArray(custList) ? custList : [];
      setCustomers(custs);
      setTemplates(Array.isArray(tmplList) ? tmplList.map((t: { name: string }) => t.name) : []);
      if (settingData?.ok && settingData?.value) {
        const raw = settingData.value as Record<string, string>;
        setMapping(Object.entries(raw).map(([customerName, template]) => {
          const found = custs.find(c => c.name === customerName);
          return { customer: customerName, customerLabel: found?.customer_name || customerName, template };
        }));
      }
    }).finally(() => setLoading(false));
  }, [instanceId]);

  const filteredCustomers = useMemo(() => {
    const q = newCustomerSearch.toLowerCase();
    const already = new Set(mapping.map(r => r.customer));
    return customers
      .filter(c => !already.has(c.name) && (c.customer_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [customers, newCustomerSearch, mapping]);

  async function handleSave() {
    setSaving(true);
    const obj: Record<string, string> = {};
    for (const { customer, template } of mapping) {
      if (customer && template) obj[customer] = template;
    }
    await fetch(`/api/instances/${instanceId}/settings/project-template-mapping`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: obj }),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addRow() {
    if (!newCustomer || !newTemplate) return;
    const found = customers.find(c => c.name === newCustomer);
    setMapping(prev => [...prev, { customer: newCustomer, customerLabel: found?.customer_name || newCustomer, template: newTemplate }]);
    setNewCustomer("");
    setNewCustomerSearch("");
    setNewTemplate("");
  }

  function removeRow(idx: number) {
    setMapping(prev => prev.filter((_, i) => i !== idx));
  }

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <FolderKanban size={20} className="text-violet-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-700">
              {t("settings.project_template_mapping_title", { defaultValue: "Taaksjabloon per klant" })}
            </h3>
            <p className="text-xs text-slate-400">
              {t("settings.project_template_mapping_desc", { defaultValue: "Koppel een klant aan een ERPNext taaksjabloon. Wordt automatisch gesuggereerd bij aanmaken van een nieuw project." })}
            </p>
          </div>
        </div>

        {/* Existing rows */}
        {mapping.length > 0 && (
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{t("common.customer")}</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">{t("settings.task_template")}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {mapping.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-sm text-slate-700">
                      <span className="font-medium">{row.customerLabel}</span>
                      <span className="text-xs text-slate-400 ml-1.5">{row.customer !== row.customerLabel ? row.customer : ""}</span>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.template}
                        onChange={(e) => setMapping(prev => prev.map((r, i) => i === idx ? { ...r, template: e.target.value } : r))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      >
                        {!templates.includes(row.template) && row.template && (
                          <option value={row.template}>{row.template}</option>
                        )}
                        {templates.map(tmpl => (
                          <option key={tmpl} value={tmpl}>{tmpl}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600 cursor-pointer p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new row */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("common.customer")}</label>
            <div className="relative">
              <input
                type="text"
                value={newCustomerSearch}
                onChange={(e) => { setNewCustomerSearch(e.target.value); setNewCustomerOpen(true); if (!e.target.value) setNewCustomer(""); }}
                onFocus={() => setNewCustomerOpen(true)}
                placeholder={t("settings.search_customer_placeholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
              {newCustomer && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-500 font-medium">{newCustomer}</span>
              )}
              {newCustomerOpen && filteredCustomers.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setNewCustomerOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button
                        key={c.name}
                        onClick={() => { setNewCustomer(c.name); setNewCustomerSearch(c.customer_name); setNewCustomerOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer text-slate-700"
                      >
                        <span className="font-medium">{c.customer_name}</span>
                        <span className="text-xs text-slate-400 ml-2">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("settings.task_template")}</label>
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="">{t("settings.select_template")}</option>
              {templates.map(tmpl => (
                <option key={tmpl} value={tmpl}>{tmpl}</option>
              ))}
            </select>
          </div>
          <button
            onClick={addRow}
            disabled={!newCustomer || !newTemplate}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 disabled:opacity-40 text-sm font-medium cursor-pointer transition-colors"
          >
            <Plus size={15} /> {t("common.add")}
          </button>
        </div>

        {mapping.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center py-2">
            {t("settings.no_template_mappings", { defaultValue: "Nog geen koppelingen ingesteld." })}
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium cursor-pointer transition-colors"
      >
        <Save size={16} />
        {saving ? t("common.saving") : saved ? t("settings.saved_confirmation") : t("settings.save_settings")}
      </button>

      <NasSettingsSection instanceId={instanceId} />
    </div>
  );
}

/* ─── InvoiceEmailSettingsPanel ──
 *
 * Slechts twee defaults: welk Email Template + welk Print Format gebruiken
 * we als de "Verstuur"-knop wordt ingedrukt op een Sales Invoice. Inhoud
 * (tekst, signature, briefpapier) wordt in ERPNext beheerd. */
function InvoiceEmailSettingsPanel() {
  const { t } = useTranslation();
  const [defaults, setDefaults] = useState<{ default_email_template: string; default_print_format: string }>({
    default_email_template: "",
    default_print_format: "",
  });
  const [templates, setTemplates] = useState<{ name: string }[]>([]);
  const [printFormats, setPrintFormats] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [loaded, tmpls, formats] = await Promise.all([
          loadInvoiceEmailDefaults(),
          fetchInvoiceEmailTemplates().catch(() => []),
          fetchSalesInvoicePrintFormats().catch(() => []),
        ]);
        setDefaults(loaded);
        setTemplates(tmpls);
        setPrintFormats(formats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveInvoiceEmailDefaults(defaults);
      // Re-load from server to confirm persistence (in case backend silently
      // mangled the value). Show the loaded values back to the user.
      const fresh = await loadInvoiceEmailDefaults();
      setDefaults(fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-400 py-4 text-center"><Loader2 className="animate-spin inline" size={16} /></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Send size={20} className="text-violet-500" />
        <div>
          <h3 className="text-base font-semibold text-slate-700">
            {t("settings.invoice_email_title", { defaultValue: "Factuur versturen" })}
          </h3>
          <p className="text-xs text-slate-400">
            {t("settings.invoice_email_desc", {
              defaultValue: "Defaults voor de Verstuur-knop op Sales Invoices. Inhoud (tekst, briefpapier, handtekening) wordt in ERPNext beheerd.",
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("settings.invoice_email_template", { defaultValue: "Standaard Email Template" })}
          </label>
          <select
            value={defaults.default_email_template}
            onChange={(e) => setDefaults((d) => ({ ...d, default_email_template: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">{t("settings.no_default", { defaultValue: "— Geen default —" })}</option>
            {templates.map((tmpl) => (
              <option key={tmpl.name} value={tmpl.name}>{tmpl.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            {t("settings.invoice_email_template_hint", {
              defaultValue: "Beheer onderwerp + body in ERPNext: /app/email-template",
            })}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {t("settings.invoice_print_format", { defaultValue: "Standaard Print Format" })}
          </label>
          <select
            value={defaults.default_print_format}
            onChange={(e) => setDefaults((d) => ({ ...d, default_print_format: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            <option value="">{t("settings.no_default", { defaultValue: "— Geen default —" })}</option>
            {printFormats.map((f) => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">
            {t("settings.invoice_print_format_hint", {
              defaultValue: "Beheer de PDF-layout in ERPNext: /app/print-format",
            })}
          </p>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800">
          {saveError}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium cursor-pointer transition-colors"
        >
          <Save size={16} />
          {saving ? t("common.saving") : saved ? t("settings.saved_confirmation") : t("settings.save_settings")}
        </button>
        {/* Diagnostics — show the active stored values so you can verify
            the save actually took. */}
        <div className="text-[11px] text-slate-400">
          <div>Template: <span className="font-mono text-slate-600">{defaults.default_email_template || "—"}</span></div>
          <div>Print Format: <span className="font-mono text-slate-600">{defaults.default_print_format || "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Extensions panel ──
 *
 * Employer-only. Two sections:
 *   1. Catalog — the curated list of extensions Y-app ships with. One click
 *      installs/uninstalls. The catalog IS the allowlist.
 *   2. Advanced (collapsed) — URL-paste form for dev/testing. Also lists
 *      any remotes whose id isn't in the catalog (legacy or ad-hoc installs).
 *
 * Installed extensions live under the `remote-extensions` setting_key on
 * the ERPNext DocType `Y Next Setting` (resource-CRUD, see
 * `extensions/remote.ts` — no Express server involved). */
function ExtensionsPanel({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const [remotes, setRemotes] = useState<RemoteExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formId, setFormId] = useState("");
  const [formSection, setFormSection] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchRemoteExtensions(instanceId).then((r) => {
      setRemotes(r);
      setLoading(false);
    });
  }, [instanceId]);

  const installedIds = useMemo(() => new Set(remotes.map((r) => r.id)), [remotes]);
  const nonCatalogRemotes = useMemo(
    () => remotes.filter((r) => !CATALOG.some((c) => c.id === r.id)),
    [remotes],
  );

  async function persistRemotes(next: RemoteExtension[]) {
    const previous = remotes;
    setRemotes(next);
    setSaving(true);
    setSaveError("");
    try {
      await saveRemoteExtensions(instanceId, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // `Y Next Setting` is System Manager-only for write/create (see
      // scripts/provision-y-next.mjs) — a non-admin viewer gets a 403 here.
      // Roll back the optimistic update and surface it instead of failing
      // silently, which would otherwise show an "installed" state that
      // never actually persisted.
      setRemotes(previous);
      if (err instanceof ApiError && err.status === 403) {
        setSaveError(t("settings.extensions.err_forbidden", {
          defaultValue: "Only an administrator (System Manager) can change the extension list. Ask an administrator to install or remove this extension.",
        }));
      } else {
        setSaveError(t("settings.extensions.err_save_failed", {
          defaultValue: "Could not save the extension list. Please try again.",
        }));
      }
    } finally { setSaving(false); }
  }

  async function installCatalogEntry(entry: CatalogEntry) {
    if (installedIds.has(entry.id)) return;
    const next: RemoteExtension[] = [
      ...remotes,
      {
        id: entry.id,
        name: entry.name,
        url: entry.url,
        sidebarSection: entry.sidebarSection,
        visibility: entry.visibility ?? "all",
      },
    ];
    await persistRemotes(next);
  }

  async function uninstall(id: string) {
    await persistRemotes(remotes.filter((r) => r.id !== id));
  }

  function slugify(s: string): string {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  async function addCustomRemote(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const name = formName.trim();
    const url = formUrl.trim();
    const id = (formId.trim() || slugify(name));
    if (!name) return setFormError(t("settings.extensions.err_name_required", { defaultValue: "Name is required" }));
    if (!/^https?:\/\//.test(url)) return setFormError(t("settings.extensions.err_invalid_url", { defaultValue: "URL must start with http:// or https://" }));
    if (!id) return setFormError(t("settings.extensions.err_id_required", { defaultValue: "ID is required" }));
    if (installedIds.has(id)) return setFormError(t("settings.extensions.err_duplicate_id", { defaultValue: "An extension with this ID already exists" }));
    const next: RemoteExtension[] = [...remotes, { id, name, url, sidebarSection: formSection.trim(), visibility: "all" }];
    await persistRemotes(next);
    setFormName(""); setFormUrl(""); setFormId(""); setFormSection("");
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* ── Catalog ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-700">
            {t("settings.extensions.catalog_title", { defaultValue: "Extension catalog" })}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {t("settings.extensions.catalog_description", {
              defaultValue: "Extensions Y-app ships with. Installing loads the extension's page in a sandboxed iframe — ERPNext calls go through this browser tab and use your session, so no credentials leave Y-app.",
            })}
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <p className="px-6 py-4 text-sm text-slate-400">{t("common.loading")}</p>
          ) : CATALOG.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">
              {t("settings.extensions.catalog_empty", { defaultValue: "No extensions available in this build." })}
            </p>
          ) : (
            CATALOG.map((entry) => {
              const installed = installedIds.has(entry.id);
              return (
                <div key={entry.id} className="flex items-start gap-4 px-6 py-4">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-y-teal/10 text-y-teal flex items-center justify-center">
                    <Puzzle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-800">{entry.name}</div>
                      {entry.author && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{entry.author}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{entry.description}</p>
                    <div className="mt-1 text-[11px] text-slate-400 font-mono truncate">{entry.url}</div>
                  </div>
                  {installed ? (
                    <button
                      onClick={() => uninstall(entry.id)}
                      className="shrink-0 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      {t("settings.extensions.uninstall", { defaultValue: "Uninstall" })}
                    </button>
                  ) : (
                    <button
                      onClick={() => installCatalogEntry(entry)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer"
                    >
                      <Check size={12} /> {t("settings.extensions.install", { defaultValue: "Install" })}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        {saveError && (
          <div className="px-6 py-2 border-t border-slate-200 bg-red-50 text-xs text-red-600">
            {saveError}
          </div>
        )}
        {(saving || saved) && !saveError && (
          <div className="px-6 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
            {saving ? t("settings.saving", { defaultValue: "Saving..." }) : t("settings.saved", { defaultValue: "Saved!" })}
          </div>
        )}
      </div>

      {/* ── Advanced / Developer ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 cursor-pointer"
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-700">
              {t("settings.extensions.advanced_title", { defaultValue: "Advanced / Developer" })}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("settings.extensions.advanced_description", {
                defaultValue: "Install an extension from a custom URL — for local development (http://localhost:5174/) or testing a pre-release build.",
              })}
            </p>
          </div>
          {advancedOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {advancedOpen && (
          <>
            {nonCatalogRemotes.length > 0 && (
              <div className="divide-y divide-slate-100">
                {nonCatalogRemotes.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                      <div className="text-xs text-slate-400 font-mono truncate">{r.id} — {r.url}</div>
                    </div>
                    <button
                      onClick={() => uninstall(r.id)}
                      className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      {t("settings.extensions.remove", { defaultValue: "Remove" })}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addCustomRemote} className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-600 space-y-1">
                  <span className="font-medium">{t("settings.extensions.name_label", { defaultValue: "Name" })}</span>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Extension"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-y-teal focus:border-y-teal outline-none bg-white"
                  />
                </label>
                <label className="text-xs text-slate-600 space-y-1">
                  <span className="font-medium">{t("settings.extensions.id_label", { defaultValue: "ID (URL slug)" })}</span>
                  <input
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="my-extension"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-y-teal focus:border-y-teal outline-none bg-white font-mono"
                  />
                </label>
                <label className="text-xs text-slate-600 space-y-1 md:col-span-2">
                  <span className="font-medium">{t("settings.extensions.url_label", { defaultValue: "iframe URL" })}</span>
                  <input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="http://localhost:5174/"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-y-teal focus:border-y-teal outline-none bg-white font-mono"
                  />
                </label>
                <label className="text-xs text-slate-600 space-y-1 md:col-span-2">
                  <span className="font-medium">{t("settings.extensions.section_label", { defaultValue: "Sidebar section (optional)" })}</span>
                  <input
                    value={formSection}
                    onChange={(e) => setFormSection(e.target.value)}
                    placeholder=""
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-y-teal focus:border-y-teal outline-none bg-white"
                  />
                </label>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer"
                >
                  {t("settings.extensions.add_button", { defaultValue: "Install extension" })}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
