import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar, { type Page, type ViewMode, isEmployerRole } from "./components/Sidebar";
import ComingSoon from "./components/ComingSoon";
import { DataProvider } from "./lib/DataContext";
import { ToastProvider } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { isFeatureEnabled, isPageEnabled, type ServerFeature } from "./lib/capabilities";
import { loadSession, loginUrl, SessionUnavailableError, type ERPNextSession } from "./lib/session";
import { APP_VERSION } from "./lib/version";

/** Webmail op ERPNext `Communication` (Y-next, geen eigen server). */
const ERPNEXT_MAIL: ServerFeature = "erpnext-mail";
/** Collega-berichten op ERPNext `Notification Log` (Y-next). */
const ERPNEXT_MESSAGES: ServerFeature = "erpnext-messages";

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
/**
 * De ERPNext-variant van Berichten. Draait op `Notification Log` en heeft
 * geen backend nodig; `Messenger` hierboven is de multi-platform brug uit de
 * Y-app-build en werkt alleen mét Express-server. Welke van de twee op
 * `/messenger` hangt, beslist `isFeatureEnabled` bij de route hieronder.
 */
const Messages = lazy(() => import("./pages/Messages"));
const ErpNextOverview = lazy(() => import("./pages/ErpNextOverview"));
const MeetingNotes = lazy(() => import("./pages/MeetingNotes"));
const Leads = lazy(() => import("./pages/Leads"));
const LiquidityPlanning = lazy(() => import("./pages/LiquidityPlanning"));
const Letters = lazy(() => import("./pages/Letters"));
const ReleaseNotes = lazy(() => import("./pages/ReleaseNotes"));
const MailView = lazy(() => import("./pages/MailView"));
const MessengerView = lazy(() => import("./pages/MessengerView"));
// Iframe-host voor extensies. Lazy (was statisch) zodat de host — inclusief
// zijn proxy-URL-opbouw — niet in de hoofdbundel belandt zolang extensies uit
// staan; hij hangt alleen aan de /x/:extId-routes.
const ExtensionHost = lazy(() => import("./components/ExtensionHost"));

/* ── Achtergrondlagen (server-afhankelijk, fase 1 uit) ──
 * Deze twee draaien op endpoints die alleen de verdwenen Express-server
 * kende. Ze worden lazy geïmporteerd zodat ze bij een uitgeschakelde
 * feature noch geladen worden noch in de hoofdbundel belanden. */
const BackgroundSyncProvider = lazy(() =>
  import("./lib/BackgroundSyncProvider").then((m) => ({ default: m.BackgroundSyncProvider })),
);
const AgentPanel = lazy(() => import("./components/AgentPanel"));

/**
 * Tab in de (verwijderde) multi-instance tabbalk.
 *
 * Y-next draait single-tenant: er is geen tabbalk en geen tab-persistentie
 * meer. Het type blijft geëxporteerd omdat `components/InstanceTabBar.tsx`
 * — dat als bestand bewaard blijft voor een latere fase, maar nergens meer
 * geïmporteerd wordt — er nog naar verwijst.
 */
export interface OpenTab {
  id: number;
  name: string;
  url: string;
  themeColor: string | null;
  lastPath?: string;
}

/**
 * Bootstrap-toestand van de shell. Er is precies één sessiebron: de
 * bestaande ERPNext-sessiecookie van de browser (zie `lib/session.ts`).
 */
type BootstrapState =
  | { status: "checking" }
  | { status: "ready"; session: ERPNextSession }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

interface UserContext {
  username: string;
  fullName: string;
  roles: string[];
}

function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<BootstrapState>({ status: "checking" });
  const [retryCount, setRetryCount] = useState(0);

  // Eén bootstrap: haal de ERPNext-sessie op. Guest / 401 / 403 →
  // "unauthenticated"; al het andere (netwerk, 5xx) → "error" met retry.
  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((session) => {
        if (!cancelled) setState({ status: "ready", session });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = err instanceof SessionUnavailableError ? err.status : undefined;
        if (status === 401 || status === 403) {
          setState({ status: "unauthenticated" });
          return;
        }
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => { cancelled = true; };
  }, [retryCount]);

  // De fetch-laag stuurt dit event zodra ERPNext een verlopen sessie meldt.
  // Single-tenant is er niets meer om lokaal op te ruimen: stuur de gebruiker
  // rechtstreeks naar de standaard Frappe-loginpagina.
  useEffect(() => {
    const handler = () => window.location.assign(loginUrl());
    window.addEventListener("y-app:unauthorized", handler);
    return () => window.removeEventListener("y-app:unauthorized", handler);
  }, []);

  if (state.status === "checking") {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    // Zelfde kaartopmaak als het originele Y-app loginscherm (zie
    // LoginPage.tsx): donkere teal-gradient achtergrond, glazen kaart met
    // Y-logo-badge en een footer met "OpenAEC Foundation" + versienummer.
    // Geen e-mail/wachtwoord-velden en geen /api/yapp-aanroepen — dit
    // scherm stuurt alleen door naar de bestaande ERPNext-login.
    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{
          background:
            "linear-gradient(160deg, #0a1628 0%, #0f2030 20%, #0d3b3f 45%, #0a2a35 65%, #0f1e2e 85%, #0a1628 100%)",
        }}
      >
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
              style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6, #2dd4bf)" }}
            >
              <svg viewBox="0 0 32 32" className="w-11 h-11">
                <text
                  x="16"
                  y="23"
                  textAnchor="middle"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="800"
                  fontSize="20"
                  fill="white"
                >
                  Y
                </text>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mt-5 tracking-tight">Y-next</h1>
          </div>

          <div className="bg-white/[0.08] backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/30 border border-white/[0.12] p-8 text-center space-y-5">
            <p className="text-sm text-slate-300">{t("y_next.login_required")}</p>
            <button
              onClick={() => window.location.assign(loginUrl())}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)" }}
            >
              {t("y_next.login_button")}
            </button>
          </div>

          <div className="text-center mt-8 space-y-2">
            <div className="flex items-center justify-center gap-2 opacity-60">
              <svg viewBox="0 0 140 20" className="h-3.5" fill="none">
                <text
                  x="0"
                  y="15"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  fontSize="13"
                  fill="rgba(148,163,184,0.8)"
                  letterSpacing="0.5"
                >
                  OpenAEC Foundation
                </text>
              </svg>
            </div>
            <p className="text-[10px] text-slate-600 font-mono tracking-wider">v{APP_VERSION}</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-8 text-center space-y-5">
          <p className="text-sm text-red-600 break-words">{state.message}</p>
          <button
            onClick={() => { setState({ status: "checking" }); setRetryCount((n) => n + 1); }}
            className="w-full px-4 py-2 rounded-lg bg-y-teal text-white text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            {t("extensions.retry")}
          </button>
        </div>
      </div>
    );
  }

  // Losse popout-vensters (`/mail/view`, `/messenger/view`) hingen aan de
  // Express-server. Ze blijven als bestand bestaan, maar worden pas weer
  // gerenderd zodra de bijbehorende feature aan staat.
  //
  // Twee URL-vormen: de Y-app-popout opent een écht pad (`/mail/view?…`); de
  // Y-next-popout kan dat niet — de app draait als Frappe Web Page onder één
  // vast pad — en gebruikt daarom de hash-route (`…#/mail/view?msg=…`). Deze
  // check draait vóór de <HashRouter>, dus hij moet de hash zelf lezen.
  const popoutPath = typeof window !== "undefined" ? window.location.pathname : "";
  const popoutHash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const isMailPopout = popoutPath === "/mail/view" || popoutHash.startsWith("#/mail/view");
  if ((isFeatureEnabled("webmail") || isFeatureEnabled(ERPNEXT_MAIL)) && isMailPopout) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <MailView />
      </Suspense>
    );
  }
  if (isFeatureEnabled("messenger") && popoutPath === "/messenger/view") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <MessengerView />
      </Suspense>
    );
  }

  // Modulevisibiliteit hangt niet aan de shell: de Sidebar leest de
  // ERPNext-rechten zelf uit via `lib/module-access.ts`.
  const user: UserContext = {
    username: state.session.user,
    fullName: state.session.fullName,
    roles: state.session.roles,
  };

  const shell = <AuthenticatedApp user={user} />;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 min-h-0 overflow-hidden">
        <HashRouter>
          {isFeatureEnabled("websocket") ? (
            <Suspense fallback={null}>
              <BackgroundSyncProvider>{shell}</BackgroundSyncProvider>
            </Suspense>
          ) : (
            shell
          )}
        </HashRouter>
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

/**
 * Fase-1 routegate: een route die nog niet geactiveerd is (zie
 * `lib/capabilities.ts`) rendert de ComingSoon-pagina in plaats van het
 * echte scherm. Voor routes met parameters (`/settings/:tab`, `/x/:extId`)
 * beslissen we op het statische prefix.
 */
function gate(path: string, element: ReactElement): ReactElement {
  return isPageEnabled(path) ? element : <ComingSoon />;
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
 * the lifetime of the session, toggling `display:none` when another page is
 * active. Returning to Mail is then a pure unhide of the already-built DOM
 * (instant), plus a silent background refresh so the saved view is verified
 * against the server ("op de achtergrond checken").
 *
 * Scope is deliberately limited to Webmail — no generic keep-alive stack. One
 * extra mounted page is an acceptable memory cost; keeping all pages alive is
 * not.
 *
 * Alleen gemount wanneer er een mail-databron is: `webmail` (de IMAP-brug via
 * de Express-server) of `erpnext-mail` (de Communication-variant). Staan beide
 * uit, dan is er niets om te mounten.
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

function AuthenticatedApp({ user }: { user: UserContext }) {
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
  const isEmployeeOnly = useMemo(() => !isEmployerRole(user.roles), [user.roles]);

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  // Prefetch draait op Express-only endpoints — alleen laden (en dus alleen
  // in de bundel trekken) zodra de bijbehorende feature aan staat.
  useEffect(() => {
    if (isFeatureEnabled("webmail")) {
      void import("./lib/webmail-prefetch").then((m) => m.prefetchInbox()).catch(() => {});
    }
    if (isFeatureEnabled("messenger")) {
      void import("./lib/messenger-prefetch").then((m) => m.prefetchConversations()).catch(() => {});
    }
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

  // Standalone view: dubbelklik op een sidebar-item opent dezelfde pagina in
  // een nieuw browser-tabblad zonder ERP-shell (multi-monitor / focus-view).
  const isStandaloneView = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("standalone") === "1";

  return (
    <ToastProvider>
    <div className="flex flex-col h-full bg-slate-100">
      <DataProvider userRoles={user.roles}>
        <div className="flex flex-1 min-h-0">
          {/* Mobile sidebar overlay backdrop */}
          {mobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
          {!isStandaloneView && (
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
          )}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Mobiele hamburger — de sidebar is op < md een overlay en werd
                voorheen geopend vanuit de (verwijderde) instance-tabbalk. */}
            {!isStandaloneView && (
              <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-y-purple-dark text-white">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-y-purple-light cursor-pointer"
                  title={t("sidebar.expand")}
                  aria-label={t("sidebar.expand")}
                >
                  <Menu size={20} />
                </button>
              </div>
            )}
            <main className="flex-1 overflow-auto">
              {/* Keep-alive Webmail: stays mounted across navigation so
                  returning to Mail is an instant unhide + a silent background
                  refresh, instead of a full remount. Hidden via display:none
                  when another page is active (takes no layout space). See
                  KeepAliveWebmail above. */}
              {(isFeatureEnabled("webmail") || isFeatureEnabled(ERPNEXT_MAIL))
                && <KeepAliveWebmail active={activePage === "webmail"} />}
              {/* Defense-in-depth against issue #103 (a page-level crash
                  used to blank the entire app with no way back): any
                  uncaught render error in the active route now shows a
                  recoverable message instead, while the sidebar outside
                  this boundary stays usable. Keyed on the pathname
                  so navigating to a different page always clears a
                  previous error. */}
              <ErrorBoundary resetKey={activePage}>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={gate("/", <DashboardRoute />)} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/management-dashboard" element={gate("/management-dashboard", <ManagementDashboard />)} />
                  <Route path="/sales" element={gate("/sales", <SalesInvoices />)} />
                  <Route path="/purchase" element={gate("/purchase", <PurchaseInvoices />)} />
                  <Route path="/quotations" element={gate("/quotations", <Quotations />)} />
                  <Route path="/salesorders" element={gate("/salesorders", <SalesOrders />)} />
                  <Route path="/projects" element={gate("/projects", <Projects />)} />
                  <Route path="/tasks" element={gate("/tasks", <Tasks />)} />
                  <Route path="/subtasks" element={gate("/subtasks", <Subtasks />)} />
                  <Route path="/planning" element={gate("/planning", <Planning />)} />
                  <Route path="/calendar" element={gate("/calendar", <Agenda />)} />
                  <Route path="/employees" element={gate("/employees", <Employees />)} />
                  <Route path="/financieel-dashboard" element={gate("/financieel-dashboard", <FinancieelDashboard />)} />
                  <Route path="/revenue" element={gate("/revenue", <Revenue />)} />
                  <Route path="/outstanding" element={gate("/outstanding", <Outstanding />)} />
                  <Route path="/cost-insight" element={gate("/cost-insight", <CostInsight />)} />
                  <Route path="/jaarrekening" element={gate("/jaarrekening", <Jaarrekening />)} />
                  <Route path="/btw" element={gate("/btw", <BTW />)} />
                  <Route path="/loonaangifte" element={gate("/loonaangifte", <Loonaangifte />)} />
                  <Route path="/expenses" element={gate("/expenses", <Expenses />)} />
                  <Route path="/deliverynotes" element={gate("/deliverynotes", <DeliveryNotes />)} />
                  <Route path="/timesheets" element={gate("/timesheets", <Timesheets />)} />
                  <Route path="/leave" element={gate("/leave", <Leave />)} />
                  <Route path="/profitability" element={gate("/profitability", <Profitability />)} />
                  {/* Placeholder: the real Webmail is rendered persistently by
                      <KeepAliveWebmail> above. This route only exists so the
                      /webmail URL matches (and doesn't hit the "*" redirect). */}
                  <Route path="/webmail" element={gate("/webmail", <></>)} />
                  <Route path="/nextcloud-files" element={gate("/nextcloud-files", <NextCloudFiles />)} />
                  <Route path="/nextcloud-talk" element={gate("/nextcloud-talk", <NextCloudTalk />)} />
                  <Route path="/ledgers" element={gate("/ledgers", <Ledgers />)} />
                  <Route path="/bank-transactions" element={gate("/bank-transactions", <BankTransactions />)} />
                  <Route path="/booking-program" element={gate("/booking-program", <BookingProgram />)} />
                  <Route path="/settings" element={gate("/settings", <SettingsPage />)} />
                  <Route path="/settings/:tab" element={gate("/settings", <SettingsPage />)} />
                  <Route path="/todo" element={gate("/todo", <Todo />)} />
                  <Route path="/wiki" element={gate("/wiki", <Wiki />)} />
                  <Route path="/passwords" element={gate("/passwords", <Passwords />)} />
                  <Route path="/contacts" element={gate("/contacts", <Contacts />)} />
                  <Route
                    path="/messenger"
                    element={gate("/messenger", isFeatureEnabled(ERPNEXT_MESSAGES) ? <Messages /> : <Messenger />)}
                  />
                  <Route path="/meeting-notes" element={gate("/meeting-notes", <MeetingNotes />)} />
                  <Route path="/leads" element={gate("/leads", <Leads />)} />
                  <Route path="/liquidity-planning" element={gate("/liquidity-planning", <LiquidityPlanning />)} />
                  <Route path="/letters" element={gate("/letters", <Letters />)} />
                  <Route path="/erpnext-overview" element={gate("/erpnext-overview", <ErpNextOverview />)} />
                  <Route path="/release-notes" element={gate("/release-notes", <ReleaseNotes />)} />
                  {/* Extensions — iframe-hosted, installed via Settings →
                      Extensions. A stray deep-link to an uninstalled
                      extension falls back to the dashboard via the "*"
                      route below. */}
                  <Route path="/x/:extId" element={gate("/x", <ExtensionHost />)} />
                  <Route path="/x/:extId/*" element={gate("/x", <ExtensionHost />)} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
          <div className="hidden lg:block">
            {isFeatureEnabled("terminal") && viewMode === "employer" && (
              <Suspense fallback={null}>
                <AgentPanel />
              </Suspense>
            )}
          </div>
        </div>
      </DataProvider>
    </div>
    </ToastProvider>
  );
}

export default App;
