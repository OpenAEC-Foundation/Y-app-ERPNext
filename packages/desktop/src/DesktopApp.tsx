import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { installPopoutOpener } from "./adapter/window";
import { loadCredentialCache, installDesktopFetchInterceptor, syncConfigForInstance } from "./adapter/fetch";
import { openVault, vaultExists, setInstanceCredentials, removeInstanceCredentials, resetVault, closeVault, changeVaultPassword } from "./adapter/vault";
import { getRememberedPassword, enableRemember, clearRemember, isRememberSupported } from "./adapter/remember";
import { UpdateBanner } from "./UpdateBanner";
import VaultUnlock from "./pages/VaultUnlock";
import FirstLaunch from "./pages/FirstLaunch";
import ChangeVaultPasswordModal from "./pages/ChangeVaultPasswordModal";
import EnableBiometricModal from "./pages/EnableBiometricModal";
import {
  getBiometricStatus,
  isBiometricEnrolled,
  enableBiometricUnlock,
} from "./adapter/biometric";

// Shared frontend components (via @frontend alias → packages/frontend/src/)
import Sidebar, { type Page, type ViewMode } from "@frontend/components/Sidebar";
import AgentPanel from "@frontend/components/AgentPanel";
import { DataProvider } from "@frontend/lib/DataContext";
import { ToastProvider } from "@frontend/components/Toast";
import InstancesPage from "@frontend/components/InstancesPage";
import InstanceTabBar from "@frontend/components/InstanceTabBar";
import { setActiveInstance, type ERPInstance } from "@frontend/lib/instances";
import { prefetchInbox } from "@frontend/lib/webmail-prefetch";
import { prefetchConversations } from "@frontend/lib/messenger-prefetch";
import { clearAllMailCache } from "@frontend/lib/mail-cache-db";
import { useDesktopMailNotifications } from "./lib/mail-notifications";
import type { OpenTab } from "@frontend/App";

// Lazy-loaded pages from the shared frontend
const Dashboard = lazy(() => import("@frontend/pages/dashboard"));
const MailView = lazy(() => import("@frontend/pages/MailView"));
const MessengerView = lazy(() => import("@frontend/pages/MessengerView"));
const SalesInvoices = lazy(() => import("@frontend/pages/SalesInvoices"));
const PurchaseInvoices = lazy(() => import("@frontend/pages/PurchaseInvoices"));
const Quotations = lazy(() => import("@frontend/pages/Quotations"));
const SalesOrders = lazy(() => import("@frontend/pages/SalesOrders"));
const Projects = lazy(() => import("@frontend/pages/Projects"));
const Tasks = lazy(() => import("@frontend/pages/Tasks"));
const Subtasks = lazy(() => import("@frontend/pages/Subtasks"));
const Planning = lazy(() => import("@frontend/pages/Planning"));
const Agenda = lazy(() => import("@frontend/pages/Agenda"));
const Employees = lazy(() => import("@frontend/pages/Employees"));
const FinancieelDashboard = lazy(() => import("@frontend/pages/FinancieelDashboard"));
const Revenue = lazy(() => import("@frontend/pages/Revenue"));
const Outstanding = lazy(() => import("@frontend/pages/Outstanding"));
const CostInsight = lazy(() => import("@frontend/pages/CostInsight"));
const Jaarrekening = lazy(() => import("@frontend/pages/Jaarrekening"));
const BTW = lazy(() => import("@frontend/pages/BTW"));
const Loonaangifte = lazy(() => import("@frontend/pages/Loonaangifte"));
const Expenses = lazy(() => import("@frontend/pages/Expenses"));
const DeliveryNotes = lazy(() => import("@frontend/pages/DeliveryNotes"));
const Timesheets = lazy(() => import("@frontend/pages/Timesheets"));
const Leave = lazy(() => import("@frontend/pages/Leave"));
const SettingsPage = lazy(() => import("@frontend/pages/Settings"));
const ManagementDashboard = lazy(() => import("@frontend/pages/ManagementDashboard"));
const ExtensionHost = lazy(() => import("@frontend/components/ExtensionHost"));
const Todo = lazy(() => import("@frontend/pages/Todo"));
const Profitability = lazy(() => import("@frontend/pages/Profitability"));
const NextCloudFiles = lazy(() => import("@frontend/pages/NextCloudFiles"));
const NextCloudTalk = lazy(() => import("@frontend/pages/NextCloudTalk"));
const Webmail = lazy(() => import("@frontend/pages/Webmail"));
const Ledgers = lazy(() => import("@frontend/pages/Ledgers"));
const BankTransactions = lazy(() => import("@frontend/pages/BankTransactions"));
const BookingProgram = lazy(() => import("@frontend/pages/BookingProgram"));
const Wiki = lazy(() => import("@frontend/pages/Wiki"));
const Passwords = lazy(() => import("@frontend/pages/Passwords"));
const Contacts = lazy(() => import("@frontend/pages/Contacts"));
const Messenger = lazy(() => import("@frontend/pages/Messenger"));
const ErpNextOverview = lazy(() => import("@frontend/pages/ErpNextOverview"));
const MeetingNotes = lazy(() => import("@frontend/pages/MeetingNotes"));
const Leads = lazy(() => import("@frontend/pages/Leads"));
const LiquidityPlanning = lazy(() => import("@frontend/pages/LiquidityPlanning"));
const Letters = lazy(() => import("@frontend/pages/Letters"));
const ReleaseNotes = lazy(() => import("@frontend/pages/ReleaseNotes"));

/* ── Bug 1: intercept POST /api/instances to persist credentials to Stronghold ── */

let instanceCredentialInterceptorInstalled = false;

function installInstanceCredentialInterceptor() {
  if (instanceCredentialInterceptorInstalled) return;
  instanceCredentialInterceptorInstalled = true;

  // The shared InstancesPage POSTs { name, url, themeColor, erpnextUsername, erpnextPassword }
  // to /api/instances. After a successful response, we capture the credentials from the
  // request body and persist them to the Stronghold vault.
  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isInstanceAdd = (url === "/api/instances" || url.endsWith("//api/instances")) && (init?.method ?? "GET").toUpperCase() === "POST";
    const isInstanceDelete = /\/api\/instances\/(\d+)$/.test(url) && (init?.method ?? "GET").toUpperCase() === "DELETE";

    // Capture the request body BEFORE calling fetch (body stream can only be read once)
    let bodySnapshot: string | undefined;
    if (isInstanceAdd && init?.body && typeof init.body === "string") {
      bodySnapshot = init.body;
    }

    const response = await originalFetch.call(window, input, init);

    if (isInstanceAdd && response.ok && bodySnapshot) {
      // Clone to avoid consuming the body for the caller
      response.clone().json().then(async (data: any) => {
        if (data?.ok && data?.instance?.id) {
          try {
            const body = JSON.parse(bodySnapshot!);
            await setInstanceCredentials({
              instance_id: data.instance.id,
              erpnext_username: body.erpnextUsername ?? body.erpnext_username ?? "",
              erpnext_password: body.erpnextPassword ?? body.erpnext_password ?? "",
            });
            // Refresh the in-memory credential cache used by the fetch
            // interceptor — without this, opening the just-added instance
            // returns "No credentials for instance" until the app is restarted.
            await loadCredentialCache();
          } catch { /* vault may not be open yet during tests */ }
        }
      }).catch(() => { /* ignore */ });
    }

    if (isInstanceDelete && response.ok) {
      const match = url.match(/\/api\/instances\/(\d+)$/);
      if (match) {
        const instanceId = parseInt(match[1], 10);
        removeInstanceCredentials(instanceId)
          .then(() => loadCredentialCache())
          .catch(() => { /* ignore */ });
      }
    }

    return response;
  };
}

/* ── Vault flow types ── */

type AppState = "loading" | "first-launch" | "locked" | "unlocking" | "ready";

/**
 * Translate Stronghold / Tauri vault errors into user-facing text.
 * Raw errors look like: "inner error occurred (invalid file failed to
 * decode/decrypt age content BadFileKey)" — unhelpful for end users.
 */
function friendlyVaultError(
  raw: unknown,
  mode: "unlock" | "create",
  t: (key: string) => string,
): string {
  const msg = (typeof raw === "string" ? raw : (raw as any)?.message ?? "").toString().toLowerCase();
  if (msg.includes("badfilekey") || msg.includes("failed to decode") || msg.includes("failed to decrypt")) {
    return mode === "unlock"
      ? t("desktop.vault_error_wrong_password")
      : t("desktop.vault_error_existing_vault_mismatch");
  }
  return mode === "unlock"
    ? t("desktop.vault_error_unlock_generic")
    : t("desktop.vault_error_create_generic");
}

/* ── Tab persistence ── */

const TABS_STORAGE_KEY = "y_app_open_tabs";
const ACTIVE_TAB_STORAGE_KEY = "y_app_active_tab";

function loadOpenTabs(): OpenTab[] {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return [];
}

function loadActiveTabId(): number | null {
  const raw = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/* ── Instance context (per-tab ERPNext user info) ── */

interface InstanceContext {
  username: string;
  fullName: string;
  roles: string[];
}

/* ── Root component: vault unlock → workspace ── */

/** Route uit `?popout=` — dit venster is dan een popout (MailView/MessengerView). */
const POPOUT_ROUTE = (() => {
  try { return new URLSearchParams(window.location.search).get("popout"); } catch { return null; }
})();

export default function DesktopApp() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Install fetch interceptor (routes /api/* through Tauri invoke)
      installDesktopFetchInterceptor();

      // Bug 1: intercept POST /api/instances to persist credentials to Stronghold.
      // The shared InstancesPage POSTs credentials to the sidecar but does not
      // call back into the desktop layer with the credential values. We intercept
      // the response here so we can save them to the Stronghold vault.
      installInstanceCredentialInterceptor();

      // Check if vault file exists to determine first-launch vs unlock
      const exists = await vaultExists();

      // Popout-venster: probeer eerst de SNELLE handoff — de al-ontsleutelde
      // credential-snapshot uit het hoofdvenster (Rust-procesgeheugen). Dan
      // hoeft dit venster de Stronghold-kluis (Argon2, seconden!) helemaal
      // niet te openen. Valt terug op de wachtwoord-handoff (wel openVault),
      // en daarna op de normale unlock-flow.
      if (exists && POPOUT_ROUTE) {
        try {
          const credsJson = await invoke<string | null>("session_get_creds");
          if (credsJson) {
            const { primeCredentialSnapshot } = await import("./adapter/vault");
            primeCredentialSnapshot(JSON.parse(credsJson));
            await loadCredentialCache();
            setState("ready");
            return;
          }
        } catch { /* val door naar de wachtwoord-handoff */ }
        try {
          const secret = await invoke<string | null>("session_get_unlock");
          if (secret) {
            await openVault(secret);
            await loadCredentialCache();
            setState("ready");
            return;
          }
        } catch { /* val terug op de normale unlock-flow */ }
      }

      // Dev-mode auto-unlock: skip the password prompt when running
      // in development. Set VITE_VAULT_PASSWORD in your environment
      // (e.g. .env.local) to enable this.
      const devPassword = import.meta.env.VITE_VAULT_PASSWORD;
      if (exists && devPassword) {
        try {
          await openVault(devPassword);
          await loadCredentialCache();
          setState("ready");
          return;
        } catch {
          // Dev password didn't match — fall back to manual unlock
        }
      }

      // "Remember on this device": silently auto-unlock with the stored vault
      // password so the user doesn't re-type it every launch. App-local store
      // (no Windows credentials). Guarded by isRememberSupported so Android —
      // which uses the prompt-gated biometric flow — skips this silent path.
      // Wrong/changed password → wipe it and fall back to manual unlock.
      if (exists && (await isRememberSupported())) {
        try {
          const remembered = await getRememberedPassword();
          if (remembered) {
            await openVault(remembered);
            await loadCredentialCache();
            setState("ready");
            return;
          }
        } catch {
          await clearRemember();
        }
      }

      setState(exists ? "locked" : "first-launch");
    }
    init();
  }, []);

  // After vault is opened, load credentials from Stronghold into the fetch adapter's memory.
  async function onVaultOpened() {
    await loadCredentialCache();
    setState("ready");
  }

  // Used by the "Enable biometric unlock?" prompt rendered after a
  // successful vault open. Held in a ref (not state) so the password is not
  // serialised into React DevTools / error overlays.
  const pendingBiometricPasswordRef = useRef<string | null>(null);
  const [showEnableBiometric, setShowEnableBiometric] = useState(false);

  /** After any successful vault open, check whether to offer biometric
   * enrollment. No-op on platforms without biometric, or if already enrolled. */
  async function maybeOfferBiometric(password: string) {
    try {
      const status = await getBiometricStatus();
      if (!status.available) return;
      if (await isBiometricEnrolled()) return;
      pendingBiometricPasswordRef.current = password;
      setShowEnableBiometric(true);
    } catch { /* ignore — biometric is opt-in convenience */ }
  }

  const handleUnlock = async (password: string, remember: boolean) => {
    setError(null);
    try {
      // Open Stronghold vault with password (verifies password against existing vault)
      await openVault(password);
      // Opt-in "remember on this device": store the password only after it has
      // successfully unlocked the vault (so a wrong one is never cached).
      if (remember) {
        try { await enableRemember(password); } catch { /* convenience only */ }
      } else {
        await clearRemember();
      }
      await onVaultOpened();
      await maybeOfferBiometric(password);
    } catch (e: any) {
      setError(friendlyVaultError(e, "unlock", t));
      setState("locked");
    }
  };

  const handleCreate = async (password: string) => {
    setError(null);
    try {
      // Create new Stronghold vault with password (creates vault.hold file)
      await openVault(password);
      await onVaultOpened();
      await maybeOfferBiometric(password);
    } catch (e: any) {
      setError(friendlyVaultError(e, "create", t));
      setState("first-launch");
    }
  };

  const handleReset = async () => {
    setError(null);
    await clearRemember();
    await resetVault();
    setState("first-launch");
  };

  const handleLockVault = async () => {
    await closeVault();
    // Drain the in-memory credential cache so a future unlock starts fresh.
    await loadCredentialCache();
    setError(null);
    setState("locked");
  };

  if (state === "loading") {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{t("desktop.loading")}</div>
      </div>
    );
  }

  if (state === "first-launch") {
    return <FirstLaunch onCreate={handleCreate} error={error} />;
  }

  if (state === "locked") {
    return <VaultUnlock onUnlock={handleUnlock} onReset={handleReset} error={error} />;
  }

  if (state === "unlocking") {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{t("desktop.unlocking")}</div>
      </div>
    );
  }

  if (POPOUT_ROUTE) {
    return <PopoutShell route={POPOUT_ROUTE} />;
  }

  return (
    <>
      <DesktopWorkspace onLockVault={handleLockVault} />
      {showEnableBiometric && (
        <EnableBiometricModal
          onEnable={async () => {
            const pwd = pendingBiometricPasswordRef.current;
            pendingBiometricPasswordRef.current = null;
            setShowEnableBiometric(false);
            if (pwd) {
              try { await enableBiometricUnlock(pwd); } catch { /* ignore */ }
            }
          }}
          onSkip={() => {
            pendingBiometricPasswordRef.current = null;
            setShowEnableBiometric(false);
          }}
        />
      )}
    </>
  );
}

/* ── Auto-lock: lock the vault after N min of background or idle time ── */

const AUTO_LOCK_MINUTES_KEY = "vault_auto_lock_minutes";
const DEFAULT_AUTO_LOCK_MINUTES = 5;

function useAutoLock(onLock: () => void) {
  useEffect(() => {
    const raw = localStorage.getItem(AUTO_LOCK_MINUTES_KEY);
    const minutes = raw == null ? DEFAULT_AUTO_LOCK_MINUTES : parseInt(raw, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const idleMs = minutes * 60 * 1000;

    let lastActivity = Date.now();
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;

    const onActivity = () => { lastActivity = Date.now(); };
    const events: Array<keyof WindowEventMap> = [
      "mousedown", "mousemove", "keydown", "touchstart", "scroll", "click",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true } as AddEventListenerOptions));

    const onVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimer = setTimeout(() => onLock(), idleMs);
      } else {
        if (backgroundTimer) { clearTimeout(backgroundTimer); backgroundTimer = null; }
        lastActivity = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const idleCheck = setInterval(() => {
      if (!document.hidden && Date.now() - lastActivity > idleMs) {
        onLock();
      }
    }, Math.min(30_000, Math.max(5_000, idleMs / 4)));

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(idleCheck);
      if (backgroundTimer) clearTimeout(backgroundTimer);
    };
  }, [onLock]);
}

/* ── Full workspace (replaces placeholder) ── */

/**
 * Kaal popout-venster: alleen de mail-/messenger-view, geen tabbar/sidebar.
 *
 * MailView/MessengerView zijn GEEN react-router-componenten — ze lezen hun
 * params rechtstreeks via `window.location.search` (zelfde patroon als de
 * web-popout-tabs, die op een echte browser-URL draaien). Een MemoryRouter
 * raakt `window.location` niet aan; het venster zag dan alleen de buitenste
 * `?popout=...`-query en gaf "Missing uid in URL". Fix: zet de échte
 * `window.location` op de binnen-route via `history.replaceState` (geen
 * page-reload) vóórdat de view mount, en render die view direct — geen
 * Router-laag nodig.
 */
function PopoutShell({ route }: { route: string }) {
  const [ready, setReady] = useState(false);
  const pathname = route.split("?")[0];
  useEffect(() => {
    (async () => {
      try {
        window.history.replaceState(null, "", route);
        const q = new URLSearchParams(route.split("?")[1] || "");
        const instId = parseInt(q.get("instance") || "", 10);
        if (!Number.isNaN(instId)) {
          const list = await invoke<{ instances: any[] }>("list_instances");
          const inst = list.instances.find((i: any) => i.id === instId);
          if (inst) {
            setActiveInstance({ id: String(inst.id), name: inst.name, url: inst.url, color: inst.theme_color || "#14b8a6" });
          }
        }
      } catch { /* zonder instance faalt de view zelf met een nette fout */ }
      setReady(true);
    })();
  }, [route]);
  if (!ready) return <PageLoader />;
  return (
    <ToastProvider>
      <Suspense fallback={<PageLoader />}>
        {pathname === "/messenger/view" ? <MessengerView /> : <MailView />}
      </Suspense>
    </ToastProvider>
  );
}

function DesktopWorkspace({ onLockVault }: { onLockVault: () => Promise<void> }) {
  const { t } = useTranslation();
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => loadOpenTabs());
  const [activeTabId, setActiveTabId] = useState<number | null>(() => loadActiveTabId());
  const [instanceContext, setInstanceContext] = useState<InstanceContext | null>(null);

  // Desktop uses a synthetic user object (no Y-app account login — vault unlock replaces it)
  const desktopUser = useMemo(() => ({ id: 0, email: "desktop@local" }), []);

  // Popout-verzoeken uit de gedeelde frontend (y-app:open-popout) afvangen.
  useEffect(() => installPopoutOpener(), []);

  // Persist open tabs to localStorage
  useEffect(() => {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs]);

  useEffect(() => {
    if (activeTabId != null) {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, String(activeTabId));
    } else {
      localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
    }
  }, [activeTabId]);

  // Sync active instance state (for the fetch interceptor + theme) SYNCHRONOUSLY
  // during render — children mount and start fetching immediately, and a useEffect
  // would run AFTER those fetches, causing the first-mount fetch to miss the header.
  const activeTab = openTabs.find((t) => t.id === activeTabId) || null;
  if (activeTab) {
    const inst: ERPInstance = {
      id: String(activeTab.id),
      name: activeTab.name,
      url: activeTab.url,
      color: activeTab.themeColor || "#14b8a6",
    };
    setActiveInstance(inst);
  } else {
    setActiveInstance(null);
  }

  // When the active instance changes, tell the desktop sidecar AND fetch context
  useEffect(() => {
    if (!activeTab) {
      setInstanceContext(null);
      return;
    }
    let cancelled = false;

    // Tell the sidecar which instance to proxy for
    fetch("/api/desktop/set-active-instance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId: activeTab.id }),
    }).catch(() => { /* ignore */ });

    // Fetch ERPNext user context (roles, fullName) for Sidebar filtering
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setInstanceContext({
          username: data.username || "",
          fullName: data.fullName || "",
          roles: data.roles || [],
        });
      })
      .catch(() => { /* ignore */ });

    // Niet-geheime werkgever-config van de server pullen naar de lokale cache
    // (best-effort; offline / geen sessie → de bestaande lokale cache blijft leidend).
    syncConfigForInstance(activeTab.id, activeTab.url).then(() => {
      if (!cancelled) window.dispatchEvent(new Event("y-app:settings-synced"));
    });

    return () => { cancelled = true; };
  }, [activeTab?.id]);

  // Eenmalig na de afbeelding-inbed-fix: de lokale body-cache kan nog oude
  // bodies bevatten met niet-ingebedde cid:-afbeeldingen (gebroken plaatjes).
  // Wis 'm één keer zodat mails opnieuw — mét ingebedde afbeeldingen — worden
  // opgehaald. Best-effort; bij falen opnieuw proberen bij de volgende start.
  useEffect(() => {
    const FLAG = "desktop_mail_reembed_v1";
    if (localStorage.getItem(FLAG)) return;
    clearAllMailCache()
      .then(() => { try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ } })
      .catch(() => { /* retry bij volgende start */ });
  }, []);

  // On mount, reconcile openTabs against the server's instance list.
  // Desktop server returns a flat array (not { instances: [...] }).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/instances", { credentials: "same-origin" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        // Handle both formats: flat array (desktop) or { instances: [...] } (web)
        const list = Array.isArray(data) ? data : (Array.isArray(data.instances) ? data.instances : null);
        if (!list) return;
        const validIds = new Set<number>(list.map((i: { id: number }) => i.id));
        setOpenTabs((curr) => {
          const pruned = curr.filter((t) => validIds.has(t.id));
          return pruned.length === curr.length ? curr : pruned;
        });
        setActiveTabId((curr) => (curr != null && !validIds.has(curr) ? null : curr));
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  /* ── Tab management (mirrors web App.tsx) ── */

  function switchToTab(newTabId: number | null) {
    const currentPath = window.location.pathname + window.location.search;
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }
    if (newTabId != null) {
      const target = openTabs.find((t) => t.id === newTabId);
      const targetPath = target?.lastPath || "/";
      if (targetPath !== currentPath) {
        window.history.pushState(null, "", targetPath);
      }
    }
    setActiveTabId(newTabId);
  }

  function handleOpenInstance(inst: { id: number; name: string; url: string; themeColor: string | null }) {
    const currentPath = window.location.pathname + window.location.search;
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }
    setOpenTabs((curr) => {
      if (curr.some((t) => t.id === inst.id)) return curr;
      return [...curr, inst];
    });
    const existing = openTabs.find((t) => t.id === inst.id);
    const targetPath = existing?.lastPath || "/";
    if (targetPath !== currentPath) {
      window.history.pushState(null, "", targetPath);
    }
    setActiveTabId(inst.id);
  }

  function handleCloseTab(id: number) {
    setOpenTabs((curr) => {
      const next = curr.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const fallbackId = next.length > 0 ? next[next.length - 1].id : null;
        const fallback = next.find((t) => t.id === fallbackId);
        const targetPath = fallback?.lastPath || "/";
        if (targetPath !== window.location.pathname + window.location.search) {
          window.history.pushState(null, "", targetPath);
        }
        setActiveTabId(fallbackId);
      }
      return next;
    });
  }

  function handleSwitchTab(id: number) {
    switchToTab(id);
  }

  function handleBackToInstances() {
    const currentPath = window.location.pathname + window.location.search;
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }
    setActiveTabId(null);
  }

  function handleInstanceDeleted(deletedId: number) {
    setOpenTabs((curr) => curr.filter((t) => t.id !== deletedId));
    if (activeTabId === deletedId) setActiveTabId(null);
  }

  // On desktop / Android the vault lock IS the logout — there is no Y-app
  // session to terminate. The InstanceTabBar's "Sign out" button is rebadged
  // as "Lock vault" via localVaultMode and wired here.
  function handleLogout() {
    onLockVault().catch(() => { /* ignore */ });
  }

  // Auto-lock vault after N minutes of background/idle (default 5 min,
  // 0 = disabled, configurable via localStorage.vault_auto_lock_minutes)
  const lockCallback = useCallback(() => {
    onLockVault().catch(() => { /* ignore */ });
  }, [onLockVault]);
  useAutoLock(lockCallback);

  // Change-password modal (opened from the InstanceTabBar account dropdown)
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Alt+1..9 tab switching (mirrors web App.tsx)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!e.code.startsWith("Digit")) return;
      const n = parseInt(e.code.slice(5), 10);
      if (Number.isNaN(n) || n < 1 || n > 9) return;
      const target = openTabs[n - 1];
      if (!target || target.id === activeTabId) return;
      e.preventDefault();
      switchToTab(target.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTabs, activeTabId]);

  const showWorkspace = activeTabId != null && activeTab != null;

  return (
    <div className="flex flex-col h-full">
      <InstanceTabBar
        openTabs={openTabs}
        activeTabId={activeTabId}
        onSwitchTab={handleSwitchTab}
        onCloseTab={handleCloseTab}
        onReorderTabs={setOpenTabs}
        onBackToInstances={handleBackToInstances}
        yAppUser={desktopUser}
        onLogout={handleLogout}
        localVaultMode={true}
        onChangeVaultPassword={() => setShowChangePassword(true)}
      />
      <UpdateBanner />

      {showChangePassword && (
        <ChangeVaultPasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {showWorkspace ? (
          <BrowserRouter key={`tab-${activeTab.id}`}>
            <DesktopAuthenticatedApp
              user={instanceContext ? {
                username: instanceContext.username,
                fullName: instanceContext.fullName,
                roles: instanceContext.roles,
              } : { username: "desktop", fullName: "Desktop User", roles: [] }}
            />
          </BrowserRouter>
        ) : (
          <InstancesPage
            user={desktopUser}
            onLogout={handleLogout}
            onOpenInstance={handleOpenInstance}
            onInstanceDeleted={handleInstanceDeleted}
          />
        )}
      </div>
    </div>
  );
}

/* ── Page loading fallback ── */

function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 text-sm">{t("common.loading")}</div>
    </div>
  );
}

/* ── Dashboard wrapper (needs useNavigate) ── */

function DashboardRoute() {
  const navigate = useNavigate();
  const viewMode = (localStorage.getItem("view_mode") as ViewMode) || "employer";
  return <Dashboard onNavigate={(p: Page) => navigate(`/${p === "dashboard" ? "" : p}`)} viewMode={viewMode} />;
}

/* ── Per-tab authenticated app shell ── */

function DesktopAuthenticatedApp({ user }: { user: { username: string; fullName: string; roles: string[] } }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const activePage: Page = (location.pathname.split("/")[1] || "dashboard") as Page;

  const EMPLOYER_ROLES = useMemo(() => new Set([
    "System Manager", "Administrator", "HR User", "HR Manager",
    "Accounts User", "Accounts Manager", "Sales User", "Sales Manager",
  ]), []);

  const isEmployeeOnly = useMemo(() => {
    const roles = user.roles;
    return roles.length > 0 && !roles.some(r => EMPLOYER_ROLES.has(r));
  }, [user.roles, EMPLOYER_ROLES]);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("view_mode") as ViewMode) || "employer"
  );

  useEffect(() => {
    if (isEmployeeOnly && viewMode !== "employee") {
      setViewMode("employee");
      localStorage.setItem("view_mode", "employee");
      window.dispatchEvent(new Event("y-app:viewmode-changed"));
    }
  }, [isEmployeeOnly, viewMode]);

  const [instanceKey, setInstanceKey] = useState("default");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => setInstanceKey("default-" + Date.now());
    window.addEventListener("y-app:refresh-active-tab", handler);
    return () => window.removeEventListener("y-app:refresh-active-tab", handler);
  }, []);

  useEffect(() => {
    const handler = () => setMobileMenuOpen((prev) => !prev);
    window.addEventListener("y-app:toggle-mobile-menu", handler);
    return () => window.removeEventListener("y-app:toggle-mobile-menu", handler);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
        localStorage.setItem("sidebar_collapsed", "false");
      }
      window.dispatchEvent(new Event("y-app:focus-search"));
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => { document.title = t("app.document_title"); }, [t]);
  useEffect(() => { prefetchInbox(); prefetchConversations(); }, []);

  // Desktop heeft geen BackgroundSyncProvider/WS/IMAP IDLE — deze poll-loop
  // levert nieuwe-mail-notificaties + badge-updates via de Tauri notification-
  // plugin. (Punt 4b uit OPMERKINGEN.)
  useDesktopMailNotifications();

  function handleNavigate(page: Page) {
    navigate(page === "dashboard" ? "/" : `/${page}`);
  }

  function handleViewModeChange(mode: ViewMode) {
    if (isEmployeeOnly) return;
    setViewMode(mode);
    localStorage.setItem("view_mode", mode);
    window.dispatchEvent(new Event("y-app:viewmode-changed"));
    navigate("/");
  }

  return (
    <ToastProvider>
      <div className="flex flex-col h-full bg-slate-100">
        <DataProvider key={instanceKey} userRoles={user.roles}>
          <div className="flex flex-1 min-h-0">
            {mobileMenuOpen && (
              <div
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}
            <Sidebar
              activePage={activePage}
              onNavigate={handleNavigate}
              viewMode={viewMode}
              onViewModeChange={isEmployeeOnly ? undefined : handleViewModeChange}
              sidebarCollapsed={sidebarCollapsed}
              onToggleCollapse={() => {
                setSidebarCollapsed(prev => {
                  localStorage.setItem("sidebar_collapsed", String(!prev));
                  return !prev;
                });
              }}
              mobileOpen={mobileMenuOpen}
              onCloseMobile={() => setMobileMenuOpen(false)}
              userRoles={user.roles}
            />
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <main className="flex-1 overflow-auto">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<DashboardRoute />} />
                    <Route path="/dashboard" element={<Navigate to="/" replace />} />
                    <Route path="/sales" element={<SalesInvoices />} />
                    <Route path="/purchase" element={<PurchaseInvoices />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/salesorders" element={<SalesOrders />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/subtasks" element={<Subtasks />} />
                    <Route path="/planning" element={<Planning />} />
                    <Route path="/calendar" element={<Agenda />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/financieel-dashboard" element={<FinancieelDashboard />} />
                    <Route path="/revenue" element={<Revenue />} />
                    <Route path="/outstanding" element={<Outstanding />} />
                    <Route path="/cost-insight" element={<CostInsight />} />
                    <Route path="/jaarrekening" element={<Jaarrekening />} />
                    <Route path="/btw" element={<BTW />} />
                    <Route path="/loonaangifte" element={<Loonaangifte />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/deliverynotes" element={<DeliveryNotes />} />
                    <Route path="/timesheets" element={<Timesheets />} />
                    <Route path="/leave" element={<Leave />} />
                    <Route path="/profitability" element={<Profitability />} />
                    <Route path="/webmail" element={<Webmail />} />
                    <Route path="/nextcloud-files" element={<NextCloudFiles />} />
                    <Route path="/nextcloud-talk" element={<NextCloudTalk />} />
                    <Route path="/ledgers" element={<Ledgers />} />
                    <Route path="/bank-transactions" element={<BankTransactions />} />
                    <Route path="/booking-program" element={<BookingProgram />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/:tab" element={<SettingsPage />} />
                    <Route path="/management-dashboard" element={<ManagementDashboard />} />
                    <Route path="/x/:extId" element={<ExtensionHost />} />
                    <Route path="/x/:extId/*" element={<ExtensionHost />} />
                    <Route path="/todo" element={<Todo />} />
                    <Route path="/wiki" element={<Wiki />} />
                    <Route path="/passwords" element={<Passwords />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/messenger" element={<Messenger />} />
                    <Route path="/meeting-notes" element={<MeetingNotes />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/liquidity-planning" element={<LiquidityPlanning />} />
                    <Route path="/letters" element={<Letters />} />
                    <Route path="/erpnext-overview" element={<ErpNextOverview />} />
                    <Route path="/release-notes" element={<ReleaseNotes />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
            <div className="hidden lg:block">
              {viewMode === "employer" && <AgentPanel />}
            </div>
          </div>
        </DataProvider>
      </div>
    </ToastProvider>
  );
}
