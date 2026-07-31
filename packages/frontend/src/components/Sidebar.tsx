import { useState, useEffect, useRef } from "react";
import {
  FileText, ShoppingCart, FolderKanban, Mail, CheckSquare,
  FileBarChart, ClipboardCheck, Users, CalendarDays, Search,
  TrendingUp, Clock, PieChart, BookOpen, Receipt, Truck, Timer,
  FileSpreadsheet, Wallet, CalendarCheck, Settings, BarChart3,
  ListTodo, LayoutDashboard, UserCheck, Cloud, ListTree,
  Calendar, ChevronDown, ChevronRight, Landmark, BookMarked, Shield, MessageSquare, ClipboardList, Contact,
  Target, Banknote, PenLine, X, PanelLeftClose, PanelLeftOpen, Puzzle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getActiveCompany } from "../lib/instances";
import { getModuleConfig, isItemEnabled, isSectionEnabled, ALWAYS_VISIBLE, migratePageIdMap } from "../lib/modules";
import { DISABLED_PAGE_MODE, isFeatureEnabled, isPageEnabled, type ServerFeature } from "../lib/capabilities";
import { unseenCount } from "../lib/mail-erpnext";
import { useRemoteExtensions } from "../extensions/remote";
import { useLeaves } from "../lib/DataContext";
import { getAllBadgeCounts, setBadgeCount } from "../lib/badges";
import { APP_VERSION, APP_NAME } from "../lib/version";
import { useTranslation } from "react-i18next";
import InlineSearch from "./InlineSearch";

/**
 * Webmail op ERPNext `Communication`. De key staat nog niet in
 * `ServerFeature` — `capabilities.ts` wordt centraal door de fase-2-controller
 * omgezet; deze ene cast overbrugt dat tot dan (zie App.tsx / Webmail.tsx).
 */
const ERPNEXT_MAIL = "erpnext-mail" as ServerFeature;

export type Page =
  | "dashboard" | "management-dashboard"
  | "sales" | "purchase" | "quotations" | "salesorders"
  | "projects" | "tasks" | "planning" | "employees"
  | "financieel-dashboard" | "revenue" | "outstanding" | "cost-insight" | "jaarrekening"
  | "btw" | "loonaangifte" | "expenses" | "deliverynotes" | "timesheets"
  | "leave" | "todo" | "settings" | "profitability"
  | "nextcloud-files" | "nextcloud-talk" | "webmail" | "subtasks"
  | "calendar" | "ledgers" | "bank-transactions" | "booking-program"
  | "wiki" | "passwords" | "messenger" | "erpnext-overview" | "contacts"
  | "meeting-notes" | "leads" | "liquidity-planning" | "letters"
  | "release-notes"
  | "to-invoice";

export type ViewMode = "employer" | "employee";

/** Visibility type for nav items and sections */
type Visibility = "all" | "employer" | "employee";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  viewMode: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  userRoles?: string[];
  blockedModules?: string[];
}

/** Map ERPNext roles to pages they can access */
const ROLE_PAGE_MAP: Record<string, Set<Page>> = {
  "HR User": new Set(["employees", "leave", "expenses", "loonaangifte", "management-dashboard"]),
  "HR Manager": new Set(["employees", "leave", "expenses", "loonaangifte", "management-dashboard"]),
  "Projects User": new Set(["projects", "tasks", "subtasks", "planning", "timesheets"]),
  "Projects Manager": new Set(["projects", "tasks", "subtasks", "planning", "timesheets"]),
  "Accounts User": new Set(["sales", "purchase", "quotations", "salesorders", "deliverynotes", "financieel-dashboard", "revenue", "outstanding", "cost-insight", "jaarrekening", "btw", "profitability", "ledgers", "bank-transactions", "booking-program", "liquidity-planning", "to-invoice", "management-dashboard"]),
  "Accounts Manager": new Set(["sales", "purchase", "quotations", "salesorders", "deliverynotes", "financieel-dashboard", "revenue", "outstanding", "cost-insight", "jaarrekening", "btw", "profitability", "ledgers", "bank-transactions", "booking-program", "liquidity-planning", "to-invoice", "management-dashboard"]),
  "Sales User": new Set(["sales", "quotations", "salesorders", "deliverynotes", "leads"]),
  "Sales Manager": new Set(["sales", "quotations", "salesorders", "deliverynotes", "leads"]),
  "System Manager": new Set(), // empty = access to all
  "Administrator": new Set(),
};

/** Pages everyone can see regardless of roles */
const UNIVERSAL_PAGES: Set<Page> = new Set([
  "dashboard", "settings", "contacts", "calendar", "todo", "wiki",
  "webmail", "messenger", "meeting-notes", "letters", "release-notes",
  "nextcloud-files", "nextcloud-talk", "passwords", "erpnext-overview",
]);

/** Routepad van een nav-item — de router-tegenhanger van `Page`. */
function pagePathFor(id: Page): string {
  return id === "dashboard" ? "/" : `/${id}`;
}

function getAccessiblePages(roles: string[]): Set<Page> | "all" {
  if (roles.includes("System Manager") || roles.includes("Administrator")) return "all";
  const pages = new Set<Page>(UNIVERSAL_PAGES);
  for (const role of roles) {
    const rolePages = ROLE_PAGE_MAP[role];
    if (rolePages) for (const p of rolePages) pages.add(p);
  }
  return pages;
}

/**
 * Does this user hold a manager-tier ERPNext role ("System Manager",
 * "Administrator", or any of the "<Module> Manager" roles already used by
 * `ROLE_PAGE_MAP` above)? These are standard roles created by ERPNext's own
 * module fixtures (System / HR / Projects / Accounts / Sales) — present on
 * every ERPNext instance and version, not a 3BM-specific role. Used to
 * decide whether a user is allowed to switch into the employer view (see
 * App.tsx `isEmployeeOnly`) — single source of truth so that logic isn't
 * duplicated with a separate role list.
 *
 * A user with no matching role (including no roles at all, e.g. a role
 * fetch that came back empty) is treated as NOT a manager — the safe
 * default is the employee view, never a crash or an accidental employer
 * unlock.
 */
export function isEmployerRole(roles: string[] | undefined): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => r === "System Manager" || r === "Administrator" || r.endsWith(" Manager"));
}

interface NavItem {
  id: Page;
  labelKey: string;
  icon: typeof LayoutDashboard;
  visibility?: Visibility;
}

interface NavSection {
  title: string;
  titleKey: string;
  collapsible: boolean;
  items: NavItem[];
  visibility?: Visibility;
}

function getSections(): NavSection[] {
  return [
    {
      title: "",
      titleKey: "",
      collapsible: false,
      items: [
        { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
        { id: "management-dashboard", labelKey: "nav.management_dashboard", icon: ClipboardCheck, visibility: "employer" },
        { id: "webmail", labelKey: "nav.email", icon: Mail },
        { id: "contacts", labelKey: "nav.contacts", icon: Contact },
        { id: "messenger", labelKey: "nav.messenger", icon: MessageSquare },
        { id: "calendar", labelKey: "nav.calendar", icon: Calendar },
        { id: "nextcloud-files", labelKey: "nav.documents", icon: Cloud, visibility: "employer" },
        { id: "financieel-dashboard", labelKey: "nav.statistics", icon: BarChart3, visibility: "employer" },
      ],
    },
    {
      title: "Projecten",
      titleKey: "nav.section.projects",
      collapsible: true,
      items: [
        { id: "projects", labelKey: "nav.projects", icon: FolderKanban },
        { id: "quotations", labelKey: "nav.quotations", icon: FileBarChart, visibility: "employer" },
        { id: "salesorders", labelKey: "nav.salesorders", icon: ClipboardCheck, visibility: "employer" },
        { id: "leads", labelKey: "nav.leads", icon: Target, visibility: "employer" },
        { id: "meeting-notes", labelKey: "nav.meeting_notes", icon: FileText, visibility: "employer" },
        { id: "deliverynotes", labelKey: "nav.deliverynotes", icon: Truck, visibility: "employer" },
      ],
    },
    {
      title: "Taken & Planning",
      titleKey: "nav.section.tasks_planning",
      collapsible: true,
      items: [
        { id: "tasks", labelKey: "nav.tasks", icon: CheckSquare },
        { id: "subtasks", labelKey: "nav.subtasks", icon: ListTree },
        { id: "planning", labelKey: "nav.planning", icon: CalendarDays },
        { id: "timesheets", labelKey: "nav.timesheets", icon: Timer },
        { id: "todo", labelKey: "nav.todo", icon: ListTodo },
        { id: "wiki", labelKey: "nav.wiki", icon: BookOpen },
      ],
    },
    {
      title: "Boekhouding",
      titleKey: "nav.section.accounting",
      collapsible: true,
      visibility: "employer",
      items: [
        { id: "ledgers", labelKey: "nav.ledgers", icon: BookOpen },
        { id: "bank-transactions", labelKey: "nav.bank_transactions", icon: Landmark },
        { id: "sales", labelKey: "nav.sales_invoices", icon: FileText },
        { id: "purchase", labelKey: "nav.purchase_invoices", icon: ShoppingCart },
        { id: "booking-program", labelKey: "nav.booking_program", icon: BookMarked },
        { id: "btw", labelKey: "nav.vat", icon: FileSpreadsheet },
        { id: "jaarrekening", labelKey: "nav.annual_accounts", icon: BookOpen },
      ],
    },
    {
      title: "Financieel",
      titleKey: "nav.section.financial",
      collapsible: true,
      visibility: "employer",
      items: [
        { id: "revenue", labelKey: "nav.revenue", icon: TrendingUp },
        { id: "outstanding", labelKey: "nav.outstanding", icon: Clock },
        { id: "cost-insight", labelKey: "nav.cost_insight", icon: PieChart },
        { id: "profitability", labelKey: "nav.profitability", icon: UserCheck },
        { id: "liquidity-planning", labelKey: "nav.liquidity", icon: Banknote },
        { id: "loonaangifte", labelKey: "nav.payroll", icon: Wallet },
      ],
    },
    {
      title: "HR & Personeel",
      titleKey: "nav.section.hr",
      collapsible: true,
      items: [
        { id: "employees", labelKey: "nav.employees", icon: Users, visibility: "employer" },
        { id: "leave", labelKey: "nav.leave_overtime", icon: CalendarCheck },
        { id: "expenses", labelKey: "nav.expenses", icon: Receipt },
      ],
    },
    {
      title: "",
      titleKey: "",
      collapsible: false,
      items: [
        { id: "letters", labelKey: "nav.letters", icon: PenLine, visibility: "employer" },
        { id: "erpnext-overview", labelKey: "nav.implementation", icon: ClipboardList, visibility: "employer" },
        { id: "passwords", labelKey: "nav.passwords", icon: Shield, visibility: "employer" },
        { id: "settings", labelKey: "nav.settings", icon: Settings },
      ],
    },
  ];
}

export default function Sidebar({ activePage, onNavigate, viewMode, onViewModeChange, sidebarCollapsed, onToggleCollapse, mobileOpen, onCloseMobile, userRoles = [], blockedModules = [] }: SidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("y-sidebar-collapsed");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
    return new Set(["Boekhouding"]);
  });
  const [moduleConfig, setModuleConfig] = useState(getModuleConfig);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const leaves = useLeaves();
  const [moduleFilter, setModuleFilter] = useState("");
  const [employerModuleConfig, setEmployerModuleConfig] = useState<Record<string, boolean> | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const sections = getSections();
  const navigate = useNavigate();
  const remoteExtensions = useRemoteExtensions();

  // On mobile, always show expanded content regardless of desktop collapsed state
  const isMobile = !!mobileOpen;
  const isExpanded = isMobile || !sidebarCollapsed;

  // Swipe-to-close (mobile only). The drawer follows the finger 1:1 while
  // dragging, then either closes (>80 px swipe-left) or snaps back. We
  // disable the CSS transition during the drag so the follow is exact.
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    if (!mobileOpen) return;
    dragStartX.current = e.touches[0].clientX;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX.current == null) return;
    const delta = e.touches[0].clientX - dragStartX.current;
    // Only swipe-LEFT closes; right gets light resistance so the drawer
    // can't be yanked off-screen in the wrong direction.
    setDragX(delta < 0 ? delta : delta * 0.2);
  }

  function handleTouchEnd() {
    if (dragX < -80 && onCloseMobile) onCloseMobile();
    setDragX(0);
    setIsDragging(false);
    dragStartX.current = null;
  }

  useEffect(() => {
    const handler = () => setModuleConfig(getModuleConfig());
    window.addEventListener("modules-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("modules-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Fetch employer module visibility config from server (applies in employee mode).
  // `/api/user-settings/*` bestond alleen op de Express-server — alleen ophalen
  // zolang die gedeelde-instellingen-feature aan staat.
  useEffect(() => {
    if (viewMode !== "employee" || !isFeatureEnabled("shared-settings")) { setEmployerModuleConfig(null); return; }
    fetch("/api/user-settings/employee-visible-modules", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ok && data.value && typeof data.value === "object") {
          setEmployerModuleConfig(migratePageIdMap<boolean>(data.value as Record<string, boolean>));
        }
      })
      .catch(() => {});
  }, [viewMode]);

  useEffect(() => {
    const handler = () => setBadges(getAllBadgeCounts());
    window.addEventListener("badge-counts-changed", handler);
    return () => window.removeEventListener("badge-counts-changed", handler);
  }, []);

  // E-mailbadge op de Communication-mail: één `get_count` per minuut. Er is
  // geen websocket/IMAP-IDLE in Y-next, dus pollen is het enige kanaal — en
  // 1×/min is goedkoop genoeg om altijd te draaien zolang de mailpagina
  // daadwerkelijk actief is. Staat de feature uit (of draait de IMAP-brug),
  // dan gebeurt hier niets: die zet zijn eigen badge vanuit Webmail.
  useEffect(() => {
    if (!isFeatureEnabled(ERPNEXT_MAIL)) return;
    let cancelled = false;
    const tick = () => {
      unseenCount()
        .then((n) => { if (!cancelled) setBadgeCount("webmail", n); })
        .catch(() => { /* teller mist een ronde; volgende tick probeert opnieuw */ });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Werkgever-badge op "Verlof & Overuren": aantal openstaande verlofaanvragen.
  // Zelfde telling als de "open aanvragen"-teller boven op de Verlof-pagina:
  // status "Open" (incl. concepten — via Y-app aangemaakte aanvragen zijn concept),
  // gescoped op het huidige kalenderjaar + de actieve company. Alleen werkgever.
  useEffect(() => {
    const compute = () => {
      if (viewMode !== "employer") { setBadgeCount("leave", 0); return; }
      const activeCompany = getActiveCompany();
      const yr = new Date().getFullYear();
      const yearFrom = `${yr}-01-01`;
      const yearTo = `${yr}-12-31`;
      const openCount = leaves.filter((l) =>
        l.status === "Open" &&
        (!activeCompany || l.company === activeCompany) &&
        l.to_date >= yearFrom && l.from_date <= yearTo,
      ).length;
      setBadgeCount("leave", openCount);
    };
    compute();
    window.addEventListener("y-app:company-changed", compute);
    return () => window.removeEventListener("y-app:company-changed", compute);
  }, [leaves, viewMode]);

  const filterLower = moduleFilter.toLowerCase().trim();
  const accessiblePages = getAccessiblePages(userRoles);

  /** Check if an item/section is visible for the current viewMode */
  const isVisible = (v?: Visibility) => !v || v === "all" || v === viewMode;

  /** In employee mode, check if employer has allowed this module */
  const isEmployerAllowed = (itemId: Page) => {
    if (!employerModuleConfig) return true; // no config = all allowed
    return employerModuleConfig[itemId] !== false;
  };

  const filteredSections = sections
    // Visibility-based filtering — hide items/sections not for this viewMode
    .filter((section) => isVisible(section.visibility))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isVisible(item.visibility)),
    }))
    .filter((section) => section.items.length > 0)
    // Employer module config filtering — hide modules employer disabled for employees
    .map((section) => viewMode !== "employee" ? section : ({
      ...section,
      items: section.items.filter((item) => ALWAYS_VISIBLE.has(item.id) || isEmployerAllowed(item.id)),
    }))
    .filter((section) => section.items.length > 0)
    // Role-based filtering — only applied in employer view. In employee view,
    // the explicit `visibility` flags + employer-config + ERPNext blockedModules
    // already handle access, and the role-map is too strict (an "Employee"-only
    // role would otherwise hide timesheets/leave/expenses/projects).
    .map((section) => (accessiblePages === "all" || viewMode === "employee") ? section : ({
      ...section,
      items: section.items.filter((item) => accessiblePages.has(item.id)),
    }))
    .filter((section) => section.items.length > 0)
    // B02: ERPNext blocked modules — hide pages for modules the user doesn't have access to
    .map((section) => blockedModules.length === 0 ? section : ({
      ...section,
      items: section.items.filter((item) => ALWAYS_VISIBLE.has(item.id) || !blockedModules.includes(item.id)),
    }))
    .filter((section) => section.items.length > 0)
    // Y-next fase 1: pagina's die nog niet geactiveerd zijn (zie
    // lib/capabilities.ts). Bij DISABLED_PAGE_MODE "hidden" verdwijnen ze uit
    // de sidebar; bij "visible" blijven ze staan — gedimd, met een
    // "volgt later"-badge — en leiden ze naar de ComingSoon-route.
    .map((section) => DISABLED_PAGE_MODE !== "hidden" ? section : ({
      ...section,
      items: section.items.filter((item) => isPageEnabled(pagePathFor(item.id))),
    }))
    .filter((section) => section.items.length > 0)
    .filter((section) => !section.title || isSectionEnabled(moduleConfig, section.title) || section.items.some((i) => ALWAYS_VISIBLE.has(i.id)))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        isItemEnabled(moduleConfig, section.title, item.id)
      ),
    }))
    .map((section) => filterLower ? ({
      ...section,
      items: section.items.filter((item) =>
        t(item.labelKey).toLowerCase().includes(filterLower) ||
        item.id.toLowerCase().includes(filterLower) ||
        (section.titleKey && t(section.titleKey).toLowerCase().includes(filterLower))
      ),
    }) : section)
    .filter((section) => section.items.length > 0);

  function toggleSection(title: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      try { localStorage.setItem("y-sidebar-collapsed", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  useEffect(() => {
    const sec = filteredSections.find((s) => s.items.some((i) => i.id === activePage));
    if (sec?.title && collapsed.has(sec.title)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(sec.title);
        try { localStorage.setItem("y-sidebar-collapsed", JSON.stringify([...next])); } catch { /* ignore */ }
        return next;
      });
    }
  // Intentionally omits filteredSections/collapsed to prevent infinite loop.
  // Only re-expands the active section when the page changes.
  }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNavClick(page: Page) {
    onNavigate(page);
    if (onCloseMobile) onCloseMobile();
  }

  return (
    <aside
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={
        mobileOpen
          ? {
              transform: `translateX(${dragX}px)`,
              transition: isDragging ? "none" : "transform 200ms ease-out",
            }
          : undefined
      }
      className={[
        "bg-y-purple-dark text-white flex flex-col flex-shrink-0",
        // Desktop: relative, width based on collapsed state. The
        // transition-all here is desktop-only because mobile gets its
        // own per-frame transform via the inline style above.
        sidebarCollapsed ? "md:w-16" : "md:w-64",
        "md:relative md:flex md:h-full md:transition-all md:duration-200",
        // Mobile: fixed overlay or hidden
        mobileOpen
          ? "fixed inset-y-0 left-0 z-50 w-72 h-full shadow-2xl"
          : "hidden",
      ].join(" ")}
    >
      {/* Header */}
      <div className={`${isExpanded ? "p-4" : "p-3"} border-b border-y-purple-light`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleNavClick("dashboard")}
            className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-y-teal/20 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
            title="Home"
            aria-label="Home"
          >
            <img src={`${import.meta.env.BASE_URL}y-logo.svg`} alt="Y-App" className="w-full h-full object-cover" />
          </button>
          {isExpanded && (
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <button
                  onClick={() => handleNavClick("dashboard")}
                  className="text-lg font-extrabold tracking-tight text-white hover:text-y-teal-light cursor-pointer transition-colors text-left"
                  title="Home"
                >
                  {APP_NAME}
                </button>
                <button onClick={() => handleNavClick("release-notes" as Page)} className="text-[10px] text-y-teal-light/50 font-medium hover:text-y-teal-light cursor-pointer transition-colors" title="Release notes">v{APP_VERSION}</button>
              </div>
              <span className="block text-[11px] leading-tight text-y-teal-light/70 font-medium">{t("y_next.direct_mode")}</span>
            </div>
          )}
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={onCloseMobile}
              className="ml-auto p-1.5 rounded-lg text-y-teal-light/60 hover:text-white hover:bg-y-purple-light transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* View mode dropdown — employer vs employee */}
        {isExpanded && onViewModeChange && (
          <div className="mt-3 relative">
            <select
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value as ViewMode)}
              className="w-full appearance-none bg-y-purple text-white text-sm font-medium px-3 py-2 pr-8 rounded-lg border border-y-purple-light hover:border-y-teal/50 focus:outline-none focus:ring-2 focus:ring-y-teal/50 cursor-pointer"
            >
              <option value="employer">{t("instance_bar.employer_mode", { defaultValue: "Employer" })}</option>
              <option value="employee">{t("instance_bar.employee_mode", { defaultValue: "Employee" })}</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-y-teal-light/60 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Inline global search — shown when expanded */}
      {isExpanded && (
        <div className="px-3 pt-3">
          <InlineSearch onNavigate={onNavigate} onCloseMobile={onCloseMobile} />
        </div>
      )}

      {/* Collapsed search icon — desktop only */}
      {!isExpanded && (
        <div className="px-1 pt-3">
          <button
            onClick={() => window.dispatchEvent(new Event("y-app:focus-search"))}
            className="w-full flex items-center justify-center py-2 rounded-lg text-y-teal-light/50 hover:text-white hover:bg-y-purple-light transition-colors cursor-pointer"
            title={t("sidebar.global_search_tooltip")}
          >
            <Search size={16} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 ${isExpanded ? "p-3" : "px-1 py-2"} space-y-1 overflow-y-auto`}>
        {filteredSections.map((section, idx) => {
          const key = section.title || `section-${idx}`;
          // There are two empty-title sections (top-level + utility bar near
          // Settings). Anchor an extension to the FIRST surviving section
          // whose title matches so it doesn't render twice.
          const isFirstWithTitle = filteredSections.findIndex((s) => s.title === section.title) === idx;
          const sectionExtensions = isFirstWithTitle
            ? remoteExtensions.filter(
                (r) =>
                  r.sidebarSection === section.title &&
                  (!r.visibility || r.visibility === "all" || r.visibility === viewMode)
              )
            : [];
          const isCollapsedSection = !filterLower && section.collapsible && collapsed.has(section.title);

          return (
            <div key={key}>
              {/* Section title — expanded mode */}
              {section.title && isExpanded && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  className={`w-full flex items-center gap-1 px-4 py-2 mt-3 text-[10px] font-bold text-y-teal/70 uppercase tracking-widest border-t border-y-purple-light/50 ${
                    section.collapsible ? "hover:text-y-teal cursor-pointer" : ""
                  }`}
                >
                  {section.collapsible && (
                    isCollapsedSection
                      ? <ChevronRight size={12} className="flex-shrink-0" />
                      : <ChevronDown size={12} className="flex-shrink-0" />
                  )}
                  {section.titleKey ? t(section.titleKey) : section.title}
                </button>
              )}
              {/* Section divider — collapsed desktop mode */}
              {section.title && !isExpanded && (
                <div className="border-t border-y-purple-light/50 mt-2 mb-1" />
              )}
              {/* Items */}
              {!isCollapsedSection && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    // Fase 1: nog niet geactiveerde pagina's blijven zichtbaar
                    // maar gedimd; klikken leidt naar de ComingSoon-route.
                    const pageEnabled = isPageEnabled(pagePathFor(item.id));
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        onDoubleClick={(e) => {
                          // Dubbelklik op een sidebar-item opent dezelfde
                          // pagina in een nieuw browser-tabblad zonder de
                          // ERP-shell (sidebar). Werkt voor élke geactiveerde
                          // module — handig voor multi-monitor workflow.
                          // Tweede klik tegen tekstselectie onderdrukken.
                          e.preventDefault();
                          e.stopPropagation();
                          if (!pageEnabled) return;
                          // HashRouter: het routepad hoort achter het hekje,
                          // `?standalone=1` blijft op de document-URL staan
                          // zodat window.location.search hem ziet.
                          const path = pagePathFor(item.id);
                          window.open(`${window.location.pathname}?standalone=1#${path}`, "_blank", "noopener");
                        }}
                        title={!isExpanded ? t(item.labelKey) : t("nav.dblclick_to_popout", "Dubbelklik = nieuw tabblad")}
                        className={`w-full flex items-center ${isExpanded ? "gap-3 px-4" : "justify-center px-2"} py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          active
                            ? "bg-y-teal text-white shadow-md shadow-y-teal/20"
                            : "text-slate-300 hover:bg-y-purple-light hover:text-white"
                        } ${pageEnabled ? "" : "opacity-50"}`}
                      >
                        <Icon size={18} className="flex-shrink-0" />
                        {isExpanded && <span className="font-medium text-sm flex-1">{t(item.labelKey)}</span>}
                        {isExpanded && !pageEnabled && (
                          <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-y-teal-light/70 border border-y-teal-light/30 rounded px-1 py-px whitespace-nowrap">
                            {t("y_next.badge_later")}
                          </span>
                        )}
                        {isExpanded && badges[item.id] > 0 && (
                          <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                            {badges[item.id]}
                          </span>
                        )}
                        {!isExpanded && badges[item.id] > 0 && (
                          <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-red-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                            {badges[item.id]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {/* Remote extensions installed on this instance, placed
                      in the first section whose title matches their
                      sidebarSection. viewMode filter is already applied. */}
                  {sectionExtensions.map((ext) => {
                    const url = `/x/${ext.id}`;
                    const active = typeof window !== "undefined" && window.location.pathname.startsWith(url);
                    const extLabel = t("settings.extensions.badge", { defaultValue: "ext" });
                    return (
                      <button
                        key={ext.id}
                        onClick={() => { navigate(url); onCloseMobile?.(); }}
                        title={!isExpanded ? `${ext.name} (${extLabel})` : undefined}
                        className={`w-full flex items-center ${isExpanded ? "gap-3 px-4" : "justify-center px-2"} py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          active
                            ? "bg-y-teal text-white shadow-md shadow-y-teal/20"
                            : "text-slate-300 hover:bg-y-purple-light hover:text-white"
                        }`}
                      >
                        <Puzzle size={18} className="flex-shrink-0" />
                        {isExpanded && (
                          <span className="font-medium text-sm flex-1">
                            {ext.name}
                            <span className="ml-1.5 text-[10px] text-red-400">({extLabel})</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Module filter — below nav, near Settings */}
      {isExpanded && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-y-teal-light/40 pointer-events-none" />
            <input
              ref={filterRef}
              type="text"
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              placeholder={t("sidebar.filter_modules_placeholder")}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-y-purple text-white text-xs placeholder:text-y-teal-light/40 focus:outline-none focus:ring-2 focus:ring-y-teal/50 border-none"
            />
            {moduleFilter && (
              <button
                onClick={() => { setModuleFilter(""); filterRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-y-teal-light/40 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-3 border-t border-y-purple-light text-y-teal-light/50 hover:text-white hover:bg-y-purple-light transition-colors cursor-pointer items-center justify-center"
          title={sidebarCollapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      )}

      {/* Footer — ERPNext × OpenAEC Foundation logos (only when expanded) */}
      {isExpanded && (
        <div className="flex items-center justify-center gap-2 px-3 py-3 border-t border-y-purple-light pointer-events-none">
          <svg viewBox="0 0 80 18" className="h-4" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="16" height="16" rx="3" fill="#0089FF" />
            <text x="8" y="13.5" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="11" fill="white">E</text>
            <text x="22" y="14" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="12" fill="rgba(255,255,255,0.85)">RPNext</text>
          </svg>
          <span className="text-xs text-slate-500 font-medium">&times;</span>
          <svg viewBox="0 0 140 18" className="h-4" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="16" height="16" rx="3" fill="#10b981" />
            <text x="8" y="13" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="10" fill="white">&#x2B21;</text>
            <text x="22" y="14" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="10.5" fill="rgba(255,255,255,0.75)">OpenAEC Foundation</text>
          </svg>
        </div>
      )}
    </aside>
  );
}
