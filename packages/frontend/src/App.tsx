import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Sidebar, { type Page, type ViewMode, isEmployerRole } from "./components/Sidebar";
import ExtensionHost from "./components/ExtensionHost";
import AgentPanel from "./components/AgentPanel";
import { DataProvider } from "./lib/DataContext";
import { ToastProvider } from "./components/Toast";
import LoginPage from "./components/LoginPage";
import SignupPage from "./components/SignupPage";
import InstancesPage from "./components/InstancesPage";
import InstanceTabBar from "./components/InstanceTabBar";
import { setActiveInstance, type ERPInstance } from "./lib/instances";
import { BackgroundSyncProvider } from "./lib/BackgroundSyncProvider";
import { prefetchInbox } from "./lib/webmail-prefetch";
import { prefetchConversations } from "./lib/messenger-prefetch";
import ErrorBoundary from "./components/ErrorBoundary";

// Lazy-load all pages
const Dashboard = lazy(() => import("./pages/dashboard"));
const ManagementDashboard = lazy(() => import("./pages/ManagementDashboard"));
const SalesInvoices = lazy(() => import("./pages/SalesInvoices"));
const PurchaseInvoices = lazy(() => import("./pages/PurchaseInvoices"));
const Quotations = lazy(() => import("./pages/Quotations"));
const SalesOrders = lazy(() => import("./pages/SalesOrders"));
const Projects = lazy(() => import("./pages/Projects"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Subtasks = lazy(() => import("./pages/Subtasks"));
const Planning = lazy(() => import("./pages/Planning"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Employees = lazy(() => import("./pages/Employees"));
const FinancieelDashboard = lazy(() => import("./pages/FinancieelDashboard"));
const Revenue = lazy(() => import("./pages/Revenue"));
const Outstanding = lazy(() => import("./pages/Outstanding"));
const CostInsight = lazy(() => import("./pages/CostInsight"));
const Jaarrekening = lazy(() => import("./pages/Jaarrekening"));
const BTW = lazy(() => import("./pages/BTW"));
const Loonaangifte = lazy(() => import("./pages/Loonaangifte"));
const Expenses = lazy(() => import("./pages/Expenses"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const Timesheets = lazy(() => import("./pages/Timesheets"));
const Leave = lazy(() => import("./pages/Leave"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Todo = lazy(() => import("./pages/Todo"));
const Profitability = lazy(() => import("./pages/Profitability"));
const NextCloudFiles = lazy(() => import("./pages/NextCloudFiles"));
const NextCloudTalk = lazy(() => import("./pages/NextCloudTalk"));
const Webmail = lazy(() => import("./pages/Webmail"));
const Ledgers = lazy(() => import("./pages/Ledgers"));
const BankTransactions = lazy(() => import("./pages/BankTransactions"));
const BookingProgram = lazy(() => import("./pages/BookingProgram"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Passwords = lazy(() => import("./pages/Passwords"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Messenger = lazy(() => import("./pages/Messenger"));
const ErpNextOverview = lazy(() => import("./pages/ErpNextOverview"));
const MeetingNotes = lazy(() => import("./pages/MeetingNotes"));
const Leads = lazy(() => import("./pages/Leads"));
const LiquidityPlanning = lazy(() => import("./pages/LiquidityPlanning"));
const Letters = lazy(() => import("./pages/Letters"));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const MailView = lazy(() => import("./pages/MailView"));
const MessengerView = lazy(() => import("./pages/MessengerView"));
type AuthState = "checking" | "logged-in" | "logged-out";

// Y-app account user (Phase 4+)
interface YAppUser {
  id: number;
  email: string;
}

// Tab = an open instance in the in-app tab bar
export interface OpenTab {
  id: number;
  name: string;
  url: string;
  themeColor: string | null;
  /** Last in-tab pathname (e.g. "/tasks", "/projects/PROJ-001") so the
   * tab restores to where the user left it instead of jumping to the
   * page the previously-active tab was on. */
  lastPath?: string;
}

// Auth screen toggle (login vs signup)
type AuthScreen = "login" | "signup";

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

/**
 * Hydrate the active-instance state for popout windows (`/mail/view`,
 * `/messenger/view`). These windows skip the AuthenticatedApp branch where
 * `setActiveInstance()` normally runs, so without this helper the fetch
 * interceptor in lib/instances.ts has `activeInstance === null` and refuses
 * to add the `X-Y-App-Instance` header → server returns 400 (missing_instance).
 *
 * Reads the same localStorage keys that AuthenticatedApp persists to.
 */
function hydratePopoutActiveInstance(): void {
  try {
    const tabsRaw = localStorage.getItem(TABS_STORAGE_KEY);
    let tabs: OpenTab[] = [];
    if (tabsRaw) {
      const parsed = JSON.parse(tabsRaw);
      if (Array.isArray(parsed)) tabs = parsed;
    }
    // Voorkeur: instance ID expliciet meegegeven via URL-parameter
    // (`?instance=123`). Dat is robuuster dan localStorage raden wanneer
    // de popout-tab een ander instance kan willen tonen dan de hoofd-tab.
    const params = new URLSearchParams(window.location.search);
    const urlInstance = params.get("instance");
    let chosen: OpenTab | undefined;
    if (urlInstance) {
      const idNum = parseInt(urlInstance, 10);
      chosen = tabs.find(t => t.id === idNum);
      if (!chosen) {
        // URL had een instance maar we vinden geen tab-metadata — vul minimaal
        // in zodat de fetch-interceptor de header alsnog kan zetten.
        setActiveInstance({ id: urlInstance, name: "Y-App", url: "", color: "#14b8a6" });
        return;
      }
    }
    if (!chosen) {
      // Geen URL-parameter → fallback op laatst-actieve tab uit localStorage.
      const activeRaw = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
      const activeId = activeRaw ? parseInt(activeRaw, 10) : NaN;
      if (!Number.isNaN(activeId)) {
        chosen = tabs.find(t => t.id === activeId) || tabs[0];
      } else {
        chosen = tabs[0];
      }
    }
    if (!chosen) return;
    setActiveInstance({
      id: String(chosen.id),
      name: chosen.name,
      url: chosen.url,
      color: chosen.themeColor || "#14b8a6",
    });
  } catch { /* localStorage parse failure — leave activeInstance null */ }
}

interface InstanceContext {
  username: string;
  fullName: string;
  roles: string[];
  blockedModules: string[];
}

function App() {
  const { t } = useTranslation();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [user, setUser] = useState<YAppUser | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => loadOpenTabs());
  const [activeTabId, setActiveTabId] = useState<number | null>(() => loadActiveTabId());
  const [instanceContext, setInstanceContext] = useState<InstanceContext | null>(null);

  useEffect(() => {
    fetch("/api/yapp/me", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.user) {
            setUser({ id: data.user.id, email: data.user.email });
            setAuthState("logged-in");
            return;
          }
        }
        setAuthState("logged-out");
      })
      .catch(() => setAuthState("logged-out"));
  }, []);

  useEffect(() => {
    const handler = () => {
      setAuthState("logged-out"); setUser(null);
      void import("./lib/mail-cache-db").then(m => m.clearAllMailCache()).catch(() => {});
    };
    window.addEventListener("y-app:unauthorized", handler);
    return () => window.removeEventListener("y-app:unauthorized", handler);
  }, []);

  // Reset the browser URL whenever the user lands on the logged-out screen.
  // LoginPage is rendered outside BrowserRouter, so without this the URL
  // would freeze at whatever path was active when the session ended (e.g.
  // "/timesheets") and reload to a confusing "logged-out at /timesheets".
  useEffect(() => {
    if (authState === "logged-out" && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, [authState]);

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

  // Synced prefs: hydrate van server en start auto-push loop bij active instance.
  // Stop bij instance-switch / logout. Importeer lazy zodat bundle-grootte niet
  // omhoog gaat als gebruiker nooit ingelogd is.
  useEffect(() => {
    if (activeTabId == null) return;
    let cancelled = false;
    (async () => {
      const mod = await import("./lib/synced-prefs");
      if (cancelled) return;
      await mod.hydrateFromServer(activeTabId);
      if (cancelled) return;
      mod.startSyncLoop(activeTabId);
    })();
    return () => {
      cancelled = true;
      void import("./lib/synced-prefs").then(mod => mod.stopSyncLoop());
    };
  }, [activeTabId]);

  // Sync active instance state (for the fetch interceptor + theme) SYNCHRONOUSLY
  // during render — children of AuthenticatedApp mount and start fetching
  // immediately, and a useEffect here would run AFTER those fetches (parent
  // effects run after children's), so any first-mount fetch would miss the
  // X-Y-App-Instance header and return 401 → kick to login.
  // Module-level mutation during render is fine because it's idempotent.
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

  // Whenever the active instance changes, fetch the per-instance ERPNext
  // user context (full name + roles) so the Sidebar can apply role-based
  // filtering. Without this, Sidebar sees empty roles → only universal
  // pages (Email + Calendar + Settings) are visible.
  useEffect(() => {
    if (!activeTab) {
      setInstanceContext(null);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setInstanceContext({
          username: data.username || "",
          fullName: data.fullName || "",
          roles: data.roles || [],
          blockedModules: data.blockedModules || [],
        });
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [activeTab?.id]);

  function handleLogin(loggedInUser: { id?: number; email?: string }) {
    if (loggedInUser.id != null && loggedInUser.email) {
      setUser({ id: loggedInUser.id, email: loggedInUser.email });
      setAuthState("logged-in");
    }
  }

  function handleSignup(newUser: { id: number; email: string }) {
    setUser(newUser);
    setAuthState("logged-in");
  }

  function handleLogout() {
    setUser(null);
    setAuthState("logged-out");
    setAuthScreen("login");
    setOpenTabs([]);
    setActiveTabId(null);
    setActiveInstance(null);
    // Privacy: wis de lokale mail-cache (volledige bodies + lijsten) bij uitloggen
    // zodat een volgende gebruiker op dit apparaat de mailinhoud niet kan lezen.
    void import("./lib/mail-cache-db").then(m => m.clearAllMailCache()).catch(() => {});
  }

  /**
   * Save the currently-active tab's URL path to its OpenTab.lastPath, then
   * restore the new tab's lastPath to the browser URL synchronously via
   * history.pushState. This must run BEFORE setActiveTabId() because the
   * new BrowserRouter remounts (key={tab-${id}}) and reads window.location
   * once on mount.
   */
  function switchToTab(newTabId: number | null) {
    const currentPath = window.location.pathname + window.location.search;

    // Snapshot the current path into the previously-active tab
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }

    // Restore the new tab's last path (if any) before remount
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
    // Snapshot current path into the OLD tab before switching
    const currentPath = window.location.pathname + window.location.search;
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }

    // Add the new tab if not already open
    setOpenTabs((curr) => {
      if (curr.some((t) => t.id === inst.id)) return curr;
      return [...curr, inst];
    });

    // Restore the new tab's last path (if it was previously open and closed)
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
      // If the closed tab was active, fall back to the most recently opened one
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
    // Snapshot the current tab's path before leaving the workspace
    const currentPath = window.location.pathname + window.location.search;
    if (activeTabId != null) {
      setOpenTabs((curr) =>
        curr.map((t) => (t.id === activeTabId ? { ...t, lastPath: currentPath } : t))
      );
    }
    setActiveTabId(null);
  }

  // Power-user shortcut: Alt+1..9 jumps to the Nth open tab. We use Alt
  // (not Ctrl) because Chrome reserves Ctrl+1..9 to switch its own browser
  // tabs and the page never sees those events. Uses e.code (physical key)
  // instead of e.key so it works on macOS where Option+1 produces "¡".
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
    // switchToTab closes over openTabs/activeTabId from this render, so
    // we re-bind whenever those change. eslint-disable because the linter
    // can't see that switchToTab is intentionally captured fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTabs, activeTabId]);

  // Called by InstancesPage after a successful DELETE /api/instances/:id.
  // The server row is already gone; we still need to evict any open tab
  // that pointed at that instance (otherwise it becomes a ghost tab that
  // survives in localStorage and renders a dead workspace).
  function handleInstanceDeleted(deletedId: number) {
    setOpenTabs((curr) => curr.filter((t) => t.id !== deletedId));
    if (activeTabId === deletedId) setActiveTabId(null);
  }

  // On login, reconcile openTabs (which came from localStorage) against the
  // server's actual instance list. Prunes ghost tabs left behind by the
  // pre-fix delete bug, and also handles instances deleted from another
  // browser/session.
  useEffect(() => {
    if (authState !== "logged-in") return;
    let cancelled = false;
    fetch("/api/instances", { credentials: "same-origin" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data || !Array.isArray(data.instances)) return;
        const validIds = new Set<number>(data.instances.map((i: { id: number }) => i.id));
        setOpenTabs((curr) => {
          const pruned = curr.filter((t) => validIds.has(t.id));
          return pruned.length === curr.length ? curr : pruned;
        });
        setActiveTabId((curr) => (curr != null && !validIds.has(curr) ? null : curr));
      })
      .catch(() => { /* ignore — next real request will surface any auth issue */ });
    return () => { cancelled = true; };
  }, [authState]);

  if (authState === "checking") {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (authState === "logged-out") {
    return authScreen === "signup"
      ? <SignupPage onSignup={handleSignup} onSwitchToLogin={() => setAuthScreen("login")} />
      : <LoginPage onLogin={handleLogin} onSwitchToSignup={() => setAuthScreen("signup")} />;
  }

  if (!user) return null;

  // Standalone mail-view: rendered OUTSIDE the Y-app shell (no sidebar,
  // no tab bar) so the user can drag the browser tab to a second monitor
  // and only see the mail. Triggered by Webmail's message-list double-click
  // via window.open('/mail/view?uid=...&folder=...&acct=...').
  //
  // The X-Y-App-Instance header is injected door de fetch-interceptor in
  // lib/instances.ts, maar die leest `activeInstance` uit module state.
  // De popout-tabs draaien NIET door de normale AuthenticatedApp render
  // die setActiveInstance() aanroept, dus we hydrateren hier handmatig uit
  // localStorage. Zonder dit krijgt /api/* een 400 (missing_instance).
  if (typeof window !== "undefined" && (window.location.pathname === "/mail/view" || window.location.pathname === "/messenger/view")) {
    hydratePopoutActiveInstance();
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        {window.location.pathname === "/mail/view" ? <MailView /> : <MessengerView />}
      </Suspense>
    );
  }

  // Logged in. Three view states:
  //   1. No active tab → show InstancesPage (with tab bar showing open tabs)
  //   2. Active tab + no legacy app integration yet → show AuthenticatedApp
  //      wrapped in BrowserRouter, behind the tab bar
  //   3. (Future) close last tab → back to InstancesPage
  const showWorkspace = activeTabId != null && activeTab != null;

  // Standalone view: dubbelklik op een sidebar-item opent /webmail?standalone=1
  // (of /messenger?standalone=1) in een nieuw browser-tabblad. In dat tabblad
  // verbergen we de ERP-shell (InstanceTabBar + Sidebar) zodat alleen de
  // module-content overblijft — multi-monitor / focus-view.
  const isStandaloneView = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("standalone") === "1";

  return (
    <div className="flex flex-col h-screen">
      {!isStandaloneView && (
        <InstanceTabBar
          openTabs={openTabs}
          activeTabId={activeTabId}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseTab}
          onReorderTabs={setOpenTabs}
          onBackToInstances={handleBackToInstances}
          yAppUser={user}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {showWorkspace ? (
          <BrowserRouter key={`tab-${activeTab.id}`}>
            <BackgroundSyncProvider>
              <AuthenticatedApp
                user={instanceContext ? {
                  username: instanceContext.username,
                  fullName: instanceContext.fullName,
                  roles: instanceContext.roles,
                  blockedModules: instanceContext.blockedModules,
                } as any : { username: user.email, fullName: user.email, roles: [], blockedModules: [] } as any}
                onLogout={handleLogout}
              />
            </BackgroundSyncProvider>
          </BrowserRouter>
        ) : (
          <InstancesPage user={user} onLogout={handleLogout} onOpenInstance={handleOpenInstance} onInstanceDeleted={handleInstanceDeleted} />
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

/* ── Wrapper components for pages that need navigation callbacks ── */

function DashboardRoute() {
  const navigate = useNavigate();
  const viewMode = (localStorage.getItem("view_mode") as ViewMode) || "employer";
  return <Dashboard onNavigate={(p: Page) => navigate(`/${p === "dashboard" ? "" : p}`)} viewMode={viewMode} />;
}

/* ── Keep-alive Webmail ──
 *
 * Webmail is by far the heaviest page (IMAP list/body caches, iframes, an
 * effect-cascade and a per-account IMAP warmup). Rendering it only via the
 * `<Route path="/webmail">` means every navigation away unmounts it and every
 * return rebuilds it from scratch — the residual "few milliseconds before you
 * see the list" the user noticed.
 *
 * Instead we mount Webmail ONCE (lazily, on first visit) and keep it alive for
 * the lifetime of the instance-tab, toggling `display:none` when another page
 * is active. Returning to Mail is then a pure unhide of the already-built DOM
 * (instant), plus a silent background refresh so the saved view is verified
 * against the server ("op de achtergrond checken").
 *
 * Scope is deliberately limited to Webmail — no generic keep-alive stack. One
 * extra mounted page is an acceptable memory cost; keeping all pages alive is
 * not.
 *
 * Per-instance isolation is preserved for free: this component lives inside
 * AuthenticatedApp, which is remounted by `<BrowserRouter key={tab-<id>}>` on
 * every instance-switch — so switching tabs tears this Webmail down and the
 * next instance gets a fresh one. No state bleeds across instances.
 *
 * The `/webmail` <Route> becomes an empty placeholder (below): it must stay in
 * the <Routes> so the URL `/webmail` matches something and doesn't fall through
 * to the `*` → redirect-to-dashboard route. The visible Webmail is this one.
 */
function KeepAliveWebmail({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(active);
  const everShown = useRef(false);
  useEffect(() => {
    if (!active) return;
    setMounted(true); // no-op once true — React bails on identical state
    if (!everShown.current) {
      // First activation: <Webmail>'s own mount effect loads folders +
      // messages, so don't double-fetch.
      everShown.current = true;
      return;
    }
    // Re-activation (hidden → shown): kick a silent background refresh.
    // Non-blanking — the list stays visible because Webmail's loading
    // skeleton only renders when messages.length === 0.
    window.dispatchEvent(new Event("y-app:webmail-activated"));
  }, [active]);

  if (!mounted) return null;
  return (
    <div className="h-full" style={{ display: active ? undefined : "none" }} aria-hidden={active ? undefined : true}>
      <ErrorBoundary resetKey="webmail-keepalive">
        <Suspense fallback={<PageLoader />}>
          <Webmail />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/* ── Main app layout ── */

// Legacy single-instance app shell. Kept around for Phase 5 reintegration
// when we wire the per-instance proxy into these existing pages.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AuthenticatedApp({ user }: { user: { username?: string; fullName?: string; roles?: string[]; blockedModules?: string[] } | null; onLogout: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active page from URL path
  const activePage: Page = (location.pathname.split("/")[1] || "dashboard") as Page;

  // Only users holding a manager-tier ERPNext role (System Manager,
  // Administrator, or any "<Module> Manager" role) may switch into the
  // employer view — see `isEmployerRole()` in Sidebar.tsx, which is the
  // single source of truth for this check (also used for page-level role
  // access) so the definition isn't duplicated here.
  //
  // This used to be a blocklist ("roles are a subset of {Employee,
  // Employee Self Service, All, Guest, Desk User} => employee-only"),
  // which let any employee holding even a routine business role (e.g.
  // "Projects User", assigned so staff can see their own project/task
  // data) escape into the employer view — issue #104. An allowlist of
  // manager-tier roles is the correct check: these role names are created
  // by ERPNext's own module fixtures and exist on every ERPNext instance/
  // version, independent of any 3BM-specific setup. A user with no roles
  // (or none of these) safely defaults to `isEmployeeOnly = true` — never
  // a crash, never an accidental employer unlock.
  const isEmployeeOnly = useMemo(() => !isEmployerRole(user?.roles), [user?.roles]);

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem("view_mode") as ViewMode) || "employer"
  );

  // Force employee mode for employee-only users
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

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Listen for refresh events from the global tab bar (which lives outside
  // AuthenticatedApp and can't reach setInstanceKey directly).
  useEffect(() => {
    const handler = () => setInstanceKey("default-" + Date.now());
    window.addEventListener("y-app:refresh-active-tab", handler);
    return () => window.removeEventListener("y-app:refresh-active-tab", handler);
  }, []);

  // Same bridge pattern for the mobile hamburger, which now lives in
  // InstanceTabBar (above BrowserRouter) but needs to toggle this
  // component's local mobileMenuOpen state.
  useEffect(() => {
    const handler = () => setMobileMenuOpen((prev) => !prev);
    window.addEventListener("y-app:toggle-mobile-menu", handler);
    return () => window.removeEventListener("y-app:toggle-mobile-menu", handler);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      // Expand sidebar if collapsed, then focus the inline search
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

  // Surface "this instance is momentarily unreachable" without logging
  // the user out — the auth middleware sends 502 + reason for these.
  // Auto-clear after 30s so the banner doesn't stick around forever.
  const [instanceUnavailable, setInstanceUnavailable] = useState(false);
  const unavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      setInstanceUnavailable(true);
      // Rapid repeat fires (e.g. several API calls failing in a row) must
      // not stack 30s timers — cancel any pending one first.
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      unavailableTimerRef.current = setTimeout(() => {
        setInstanceUnavailable(false);
        unavailableTimerRef.current = null;
      }, 30_000);
    };
    window.addEventListener("y-app:instance-unavailable", handler);
    return () => {
      window.removeEventListener("y-app:instance-unavailable", handler);
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
    };
  }, []);

  function handleNavigate(page: Page) {
    navigate(page === "dashboard" ? "/" : `/${page}`);
  }

  function handleViewModeChange(mode: ViewMode) {
    if (isEmployeeOnly) return; // employee-only users cannot switch
    setViewMode(mode);
    localStorage.setItem("view_mode", mode);
    window.dispatchEvent(new Event("y-app:viewmode-changed"));
    navigate("/");
  }

  return (
    <ToastProvider>
    <div className="flex flex-col h-full bg-slate-100">
      <DataProvider key={instanceKey} userRoles={user?.roles}>
        <div className="flex flex-1 min-h-0">
          {/* Mobile sidebar overlay backdrop */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          {/* Standalone view (dubbelklik op sidebar-item → ?standalone=1):
              ERP-sidebar overslaan zodat alleen de module-content zichtbaar
              is in het popout-tabblad. */}
          {new URLSearchParams(window.location.search).get("standalone") !== "1" && (
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
              userRoles={user?.roles || []}
              blockedModules={user?.blockedModules || []}
            />
          )}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {instanceUnavailable && (
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
                <span>{t("app.instance_unavailable")}</span>
                <button onClick={() => setInstanceUnavailable(false)} className="text-amber-700 hover:text-amber-900 cursor-pointer">×</button>
              </div>
            )}
            <main className="flex-1 overflow-auto">
              {/* Keep-alive Webmail: stays mounted across navigation so
                  returning to Mail is an instant unhide + a silent background
                  refresh, instead of a full remount. Hidden via display:none
                  when another page is active (takes no layout space). See
                  KeepAliveWebmail above. */}
              <KeepAliveWebmail active={activePage === "webmail"} />
              {/* Defense-in-depth against issue #103 (a page-level crash
                  used to blank the entire app with no way back): any
                  uncaught render error in the active route now shows a
                  recoverable message instead, while the sidebar/tab-bar
                  outside this boundary stay usable. Keyed on the pathname
                  so navigating to a different page always clears a
                  previous error. */}
              <ErrorBoundary resetKey={activePage}>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<DashboardRoute />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/management-dashboard" element={<ManagementDashboard />} />
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
                  {/* Placeholder: the real Webmail is rendered persistently by
                      <KeepAliveWebmail> above. This route only exists so the
                      /webmail URL matches (and doesn't hit the "*" redirect). */}
                  <Route path="/webmail" element={<></>} />
                  <Route path="/nextcloud-files" element={<NextCloudFiles />} />
                  <Route path="/nextcloud-talk" element={<NextCloudTalk />} />
                  <Route path="/ledgers" element={<Ledgers />} />
                  <Route path="/bank-transactions" element={<BankTransactions />} />
                  <Route path="/booking-program" element={<BookingProgram />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/:tab" element={<SettingsPage />} />
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
                  {/* Extensions — iframe-hosted, installed per instance
                      via Settings → Extensions. A stray deep-link to an
                      uninstalled extension falls back to the dashboard via
                      the "*" route below. */}
                  <Route path="/x/:extId" element={<ExtensionHost />} />
                  <Route path="/x/:extId/*" element={<ExtensionHost />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
              </ErrorBoundary>
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

export default App;
