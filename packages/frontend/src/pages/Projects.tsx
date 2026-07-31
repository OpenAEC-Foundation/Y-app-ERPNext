import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "../lib/useIsMobile";
import { fetchList, fetchDocument, fetchAll, fetchCount, fetchChildTable, callMethod, createDocument, updateDocument, getErpNextLinkUrl } from "../lib/erpnext";
import { useProjects, useCompanies, useEmployees } from "../lib/DataContext";
import { getActiveInstanceId, getActiveCompany, getActiveEmployee } from "../lib/instances";
import type { ProjectRecord } from "../lib/DataContext";
import { geocodeAddress } from "../lib/geocode";
import {
  FolderKanban, RefreshCw, Search, Plus, FolderOpen, MapPin, Map as MapIcon,
  X, ExternalLink, Clock, CheckCircle2, ListTodo, CalendarDays,
  ChevronRight, ChevronLeft, AlertCircle, List, FileText, Link2, Receipt, Pencil,
  Building2, User, Flag, ShoppingCart, LayoutTemplate, FolderPlus,
} from "lucide-react";
import { isDesktopApp } from "../lib/desktop";
import { isFeatureEnabled } from "../lib/capabilities";
import ErrorBoundary from "../components/ErrorBoundary";
import { loadProjectFoldersConfig, hydrateProjectFoldersConfig, buildProjectFolderPath } from "../lib/nasConfig";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons (Leaflet + bundler issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/index";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ─── Interfaces ─── */

interface TimesheetDetail {
  project: string;
  hours: number;
  parent: string;
}

interface TimesheetParent {
  name: string;
  employee_name: string;
}

interface AddressDoc {
  address_line1?: string;
  city?: string;
  pincode?: string;
  country?: string;
}

interface MarkerData {
  projectName: string;
  projectTitle: string;
  address: string;
  lat: number;
  lng: number;
}

interface TaskRecord {
  name: string;
  subject: string;
  status: string;
  priority: string;
  exp_start_date: string;
  exp_end_date: string;
  _assign: string;
  completed_on: string;
}

interface CustomerDoc {
  customer_name?: string;
  customer_type?: string;
  market_segment?: string;
  image?: string;
  customer_primary_address?: string;
  primary_address?: string;
  customer_primary_contact?: string;
  email_id?: string;
  mobile_no?: string;
}

interface SalesOrderDoc {
  name: string;
  title?: string;
  status?: string;
  grand_total?: number;
  total?: number;
  currency?: string;
  transaction_date?: string;
  delivery_date?: string;
  per_billed?: number;
  billing_status?: string;
  items?: Array<{ item_name?: string; amount?: number }>;
}

interface FullProjectDoc {
  custom_customer_reference?: string;
  sales_order?: string;
  custom_address?: string;
  custom_project_manager?: string;
  estimated_costing?: number;
  total_sales_amount?: number;
  total_billed_amount?: number;
}

/* ─── Constants ─── */

// getErpNextLinkUrl() is imported from erpnext.ts and reads the current instance URL
/**
 * Projectmap-locatie. ENIGE bron van waarheid = de gedeelde
 * `nas-project-folders`-config (Projectinstellingen → NAS-opslag), server-side
 * gesynct via instance_settings zodat élke gebruiker (werkgever + medewerker)
 * en élk apparaat hetzelfde pad krijgt. De vroegere hardcoded `Z:/50_projecten`
 * per-bedrijf-mapping en de `pref_company_folder_map` / `pref_default_project_base`
 * localStorage-keys zijn hiermee vervallen.
 *
 * Legacy-fallback: als `targetRoot` (nog) niet ingesteld is, valt 'ie terug op
 * een eventuele oude `pref_default_project_base`-waarde in localStorage — puur
 * zodat een niet-gemigreerde installatie niet plots een bodemloos pad krijgt.
 * Er wordt géén Z:-default meer verzonnen.
 */
function getProjectFolderPath(project: { name: string; project_name?: string }): string {
  const instId = getActiveInstanceId() || "default";
  const cfg = loadProjectFoldersConfig(instId);
  const root = cfg.targetRoot || localStorage.getItem("pref_default_project_base") || "";
  return buildProjectFolderPath({ ...cfg, targetRoot: root }, project);
}

async function openFolder(folderPath: string) {
  // Convert forward slashes to backslashes for Windows
  const winPath = folderPath.replace(/\//g, "\\");

  // Desktop (Tauri): open de projectmap echt in Windows Verkenner via de native
  // Rust-command (/api/nas/open-folder → open_in_explorer), maar alleen als de
  // nextcloud/NAS-feature aan staat (Y-next fase 1: uit — er is geen server/
  // Rust-brug om deze route te bedienen). /api/open-folder is een oude
  // web-server-route die in Y-next niet meer bestaat; zonder de feature-gate
  // vielen beide fetches altijd stil terug op de klembord-fallback hieronder.
  if (isDesktopApp() && isFeatureEnabled("nextcloud")) {
    try {
      const res = await fetch("/api/nas/open-folder", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: winPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return;
      if (String(data?.error || "").includes("not_found")) {
        alert(i18n.t("projects.detail.nas_open_not_found", { defaultValue: "Projectmap niet gevonden op de NAS." }));
        return;
      }
      // andere fout → val door naar de klembord-fallback hieronder
    } catch { /* val door naar klembord */ }
  }

  // Fallback: copy path to clipboard so user can paste in Explorer
  try {
    await navigator.clipboard.writeText(winPath);
    // Brief visual feedback via a temporary toast
    const toast = document.createElement("div");
    toast.textContent = `📋 ${i18n.t("projects.path_copied")}: ${winPath}`;
    toast.className = "fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  } catch {
    // Last resort: prompt with the path
    prompt(i18n.t("projects.copy_path_prompt"), winPath);
  }
}

const NL_CENTER: [number, number] = [52.1, 5.3];

const PROJECT_STATUSES = ["Open", "Completed", "Cancelled", "Overdue"];

const statusColors: Record<string, string> = {
  Open: "bg-y-teal/10 text-y-teal-dark",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  Overdue: "bg-orange-100 text-orange-700",
};

const taskStatusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  Working: "bg-yellow-100 text-yellow-700",
  "Pending Review": "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  Overdue: "bg-orange-100 text-orange-700",
};

const priorityColors: Record<string, string> = {
  Urgent: "text-red-600",
  High: "text-orange-500",
  Medium: "text-yellow-500",
  Low: "text-slate-400",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-y-teal", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function parseAssign(raw: string): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ─── ProjectDetail Panel ─── */

const TOC_ITEMS = [
  { id: "overzicht", labelKey: "projects.toc.overview", icon: FolderKanban },
  { id: "taken", labelKey: "projects.toc.tasks", icon: ListTodo },
  { id: "uren", labelKey: "projects.toc.hours", icon: Clock },
  { id: "planning", labelKey: "projects.toc.planning", icon: CalendarDays },
];

export function ProjectDetail({
  project,
  projectHours,
  onClose,
  onEdit,
}: {
  project: ProjectRecord;
  projectHours: Map<string, number>;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const employees = useEmployees();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("overzicht");
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskSubject, setNewTaskSubject] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskBillingType, setNewTaskBillingType] = useState("Timesheet based");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // NAS projectmappen aanmaken (alleen desktop-build + nextcloud-feature aan).
  // De knop die dit aanroept wordt al niet gerenderd als de feature uit staat
  // (zie isFeatureEnabled("nextcloud") hieronder); deze guard is verdediging
  // in de diepte mocht de functie ooit los aangeroepen worden.
  const [creatingNas, setCreatingNas] = useState(false);
  async function handleCreateNasFolders() {
    if (!isFeatureEnabled("nextcloud")) return;
    const instId = getActiveInstanceId();
    // Vers ophalen i.p.v. blind op localStorage vertrouwen — zonder dit bleef
    // een medewerker die Settings nooit bezocht (of geen toegang heeft tot de
    // werkgever-only tab) op lege/oude waarden staan, ook nadat de werkgever
    // de projectmap-instellingen had geconfigureerd.
    await hydrateProjectFoldersConfig();
    const cfg = loadProjectFoldersConfig(instId || "default");
    if (!cfg.masterPath || !cfg.targetRoot) {
      alert(t("projects.detail.nas_not_configured"));
      return;
    }
    const targetPath = buildProjectFolderPath(cfg, project);
    if (!window.confirm(t("projects.detail.nas_confirm", { path: targetPath }))) return;
    setCreatingNas(true);
    try {
      const res = await fetch("/api/nas/create-folders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masterPath: cfg.masterPath, targetPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        alert(t("projects.detail.nas_done"));
      } else if (String(data.error).includes("target_exists")) {
        alert(t("projects.detail.nas_exists"));
      } else {
        alert(t("projects.detail.nas_failed", { error: String(data.error || res.status) }));
      }
    } catch (e) {
      alert(t("projects.detail.nas_failed", { error: String(e) }));
    } finally {
      setCreatingNas(false);
    }
  }

  // NAS-projectmap openen in Verkenner (desktop-only). Geen masterPath nodig —
  // alleen de doel-root + mapnaam-template (zelfde pad als 'aanmaken').
  async function handleOpenNasFolder() {
    // Exact hetzelfde als de map-knop in de lijstweergave: getProjectFolderPath
    // (doel-root uit de gedeelde NAS-opslag-config + {nr project_name}) +
    // openFolder, die op de desktop de map in Verkenner opent via
    // /api/nas/open-folder en anders naar het klembord terugvalt. Eerst
    // hydrateren zodat een medewerker die Settings nooit bezocht toch de door
    // de werkgever ingestelde doel-root gebruikt (i.p.v. een leeg pad).
    if (!isFeatureEnabled("nextcloud")) return;
    await hydrateProjectFoldersConfig();
    openFolder(getProjectFolderPath(project));
  }

  // On-demand detail data
  const [customerDoc, setCustomerDoc] = useState<CustomerDoc | null>(null);
  const [salesOrderDoc, setSalesOrderDoc] = useState<SalesOrderDoc | null>(null);
  const [addressDoc, setAddressDoc] = useState<AddressDoc | null>(null);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fullProject, setFullProject] = useState<FullProjectDoc | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [siCount, setSiCount] = useState<number | null>(null);
  const [tsCount, setTsCount] = useState<number | null>(null);

  // Fetch tasks
  useEffect(() => {
    setTasksLoading(true);
    fetchAll<TaskRecord>(
      "Task",
      ["name", "subject", "status", "priority", "exp_start_date", "exp_end_date", "completed_on"],
      [["project", "=", project.name]],
      "exp_start_date asc"
    )
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  }, [project.name]);

  async function handleAddTask() {
    if (!newTaskSubject.trim()) return;
    setAddingTask(true);
    try {
      const doc = await createDocument<{ name: string }>("Task", {
        subject: newTaskSubject,
        project: project.name,
        company: project.company,
        priority: newTaskPriority,
        custom_billing_type: newTaskBillingType || undefined,
        exp_end_date: newTaskDeadline || undefined,
        status: "Open",
      });
      // Assign selected employees
      for (const email of newTaskAssignees) {
        await callMethod("frappe.desk.form.assign_to.add", {
          doctype: "Task",
          name: doc.name,
          assign_to: [email],
        }).catch(() => {});
      }
      // Refresh task list
      const updated = await fetchAll<TaskRecord>(
        "Task",
        ["name", "subject", "status", "priority", "exp_start_date", "exp_end_date", "_assign", "completed_on"],
        [["project", "=", project.name]],
        "exp_start_date asc"
      );
      setTasks(updated);
      setNewTaskSubject("");
      setNewTaskDeadline("");
      setNewTaskPriority("Medium");
      setNewTaskBillingType("Timesheet based");
      setNewTaskAssignees([]);
      setShowAddTask(false);
    } catch {
      // error handled silently
    } finally {
      setAddingTask(false);
    }
  }

  // Fetch detail data (customer, SO, address, counts)
  useEffect(() => {
    let cancelled = false;
    async function loadDetails() {
      setDetailLoading(true);

      // Step 1: get full project doc for fields not in list view
      let proj: FullProjectDoc | null = null;
      try {
        proj = await fetchDocument<FullProjectDoc>("Project", project.name);
        if (!cancelled) setFullProject(proj);
      } catch { /* ignore */ }

      // Step 2: parallel fetch customer, SO, address, counts
      const customerName = project.customer;
      const salesOrder = project.sales_order || proj?.sales_order;
      const addressName = project.custom_address || proj?.custom_address;

      const promises = await Promise.allSettled([
        // Customer
        customerName
          ? fetchDocument<CustomerDoc>("Customer", customerName)
          : Promise.resolve(null),
        // Sales Order
        salesOrder
          ? fetchDocument<SalesOrderDoc>("Sales Order", salesOrder)
          : Promise.resolve(null),
        // Address
        addressName
          ? fetchDocument<AddressDoc>("Address", addressName)
          : Promise.resolve(null),
        // Sales Invoice count
        fetchCount("Sales Invoice", [["project", "=", project.name]]).catch(() => 0),
        // Timesheet count
        fetchCount("Timesheet", [["project", "=", project.name]]).catch(() => 0),
      ]);

      if (cancelled) return;

      if (promises[0].status === "fulfilled" && promises[0].value) {
        setCustomerDoc(promises[0].value as CustomerDoc);
      }
      if (promises[1].status === "fulfilled" && promises[1].value) {
        setSalesOrderDoc(promises[1].value as SalesOrderDoc);
      }
      if (promises[2].status === "fulfilled" && promises[2].value) {
        const addr = promises[2].value as AddressDoc;
        setAddressDoc(addr);
        // Geocode for mini map
        const parts = [addr.address_line1, addr.city, addr.pincode, addr.country].filter(Boolean);
        const query = parts.join(", ");
        if (query) {
          geocodeAddress(query).then((coords) => {
            if (!cancelled && coords) setAddressCoords(coords);
          });
        }
      }
      if (promises[3].status === "fulfilled") {
        setSiCount(promises[3].value as number);
      }
      if (promises[4].status === "fulfilled") {
        setTsCount(promises[4].value as number);
      }

      setDetailLoading(false);
    }
    loadDetails();
    return () => { cancelled = true; };
  }, [project.name, project.customer, project.custom_address, project.sales_order]);

  // Resolve project manager name from employee list
  const projectManagerName = useMemo(() => {
    const pmId = project.custom_project_manager || fullProject?.custom_project_manager;
    if (!pmId) return null;
    const emp = employees.find((e) => e.name === pmId);
    return emp?.employee_name || pmId;
  }, [project.custom_project_manager, fullProject, employees]);

  // Customer reference
  const customerRef = project.custom_customer_reference || fullProject?.custom_customer_reference;

  // Sort hours descending
  const sortedHours = useMemo(() => {
    return Array.from(projectHours.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [projectHours]);

  const totalHours = useMemo(() => sortedHours.reduce((s, [, h]) => s + h, 0), [sortedHours]);

  // Scroll to section
  function scrollTo(id: string) {
    setActiveSection(id);
    const el = document.getElementById(`pd-${id}`);
    if (el && contentRef.current) {
      const containerTop = contentRef.current.getBoundingClientRect().top;
      const elTop = el.getBoundingClientRect().top;
      const offset = contentRef.current.scrollTop + (elTop - containerTop) - 80;
      contentRef.current.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
    }
  }

  // Observe which section is in view
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const sections = TOC_ITEMS.map((t) => document.getElementById(`pd-${t.id}`)).filter(Boolean) as HTMLElement[];

    function onScroll() {
      const scrollTop = container!.scrollTop + 80;
      for (let i = sections.length - 1; i >= 0; i--) {
        if (sections[i].offsetTop - container!.offsetTop <= scrollTop) {
          setActiveSection(TOC_ITEMS[i].id);
          return;
        }
      }
    }

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Planning: compute timeline bounds
  const planningData = useMemo(() => {
    const tasksWithDates = tasks.filter((t) => t.exp_start_date || t.exp_end_date);
    if (tasksWithDates.length === 0) return null;

    const allDates: number[] = [];
    for (const t of tasksWithDates) {
      if (t.exp_start_date) allDates.push(new Date(t.exp_start_date).getTime());
      if (t.exp_end_date) allDates.push(new Date(t.exp_end_date).getTime());
    }
    if (project.expected_start_date) allDates.push(new Date(project.expected_start_date).getTime());
    if (project.expected_end_date) allDates.push(new Date(project.expected_end_date).getTime());

    const minTime = Math.min(...allDates);
    const maxTime = Math.max(...allDates);
    const range = maxTime - minTime || 1;

    const months: { label: string; left: number }[] = [];
    const start = new Date(minTime);
    start.setDate(1);
    const end = new Date(maxTime);
    const cursor = new Date(start);
    while (cursor <= end) {
      const t = cursor.getTime();
      const left = ((t - minTime) / range) * 100;
      months.push({
        label: cursor.toLocaleDateString("nl-NL", { month: "short", year: "2-digit" }),
        left: Math.max(0, Math.min(left, 100)),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { minTime, range, months, tasksWithDates };
  }, [tasks, project]);

  const tasksDone = tasks.filter((t) => t.status === "Completed").length;
  const tasksOpen = tasks.filter((t) => t.status !== "Completed" && t.status !== "Cancelled").length;

  const erpUrl = getErpNextLinkUrl();

  return (
    <div className="fixed inset-0 z-50 flex pt-[env(safe-area-inset-top,0px)]">
      {/* Backdrop — hidden on mobile */}
      {!isMobile && <div className="flex-shrink-0 w-[15vw] bg-black/40" onClick={onClose} />}

      {/* Panel */}
      <div className="flex-1 bg-white shadow-2xl flex overflow-hidden">
        {/* TOC Sidebar — hidden on mobile */}
        {!isMobile && (
          <nav className="w-48 flex-shrink-0 border-r border-slate-200 bg-slate-50 p-4 flex flex-col">
            <div className="mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{t("tasks.detail.project")}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{project.name}</p>
            </div>
            <div className="space-y-1 flex-1">
              {TOC_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                      activeSection === item.id
                        ? "bg-y-teal/10 text-y-teal-dark font-semibold"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={16} />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
            <a
              href={`${erpUrl}/project/${project.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-y-teal mt-4"
            >
              <ExternalLink size={14} /> {t("projects.open_in_erpnext")}
            </a>
          </nav>
        )}

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {isMobile && (
                <button onClick={onClose} className="p-2.5 -ml-1 rounded-lg hover:bg-slate-100 flex-shrink-0 cursor-pointer">
                  <ChevronLeft size={22} className="text-slate-600" />
                </button>
              )}
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-800 truncate">{project.project_name}</h3>
                <p className="text-sm text-slate-500 truncate">{project.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isDesktopApp() && isFeatureEnabled("nextcloud") && (
                <button
                  onClick={handleCreateNasFolders}
                  disabled={creatingNas}
                  title={t("projects.detail.create_nas_folders")}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-100 rounded hover:bg-violet-200 disabled:opacity-40 cursor-pointer"
                >
                  <FolderPlus size={14} /> {t("projects.detail.create_nas_folders")}
                </button>
              )}
              {isDesktopApp() && isFeatureEnabled("nextcloud") && (
                <button
                  onClick={handleOpenNasFolder}
                  title={t("projects.detail.open_nas_folder")}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-100 rounded hover:bg-violet-200 cursor-pointer"
                >
                  <FolderOpen size={14} /> {t("projects.detail.open_nas_folder")}
                </button>
              )}
              {onEdit && (
                <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer" title={t("projects.edit_project")}>
                  <Pencil size={16} className="text-slate-400 hover:text-y-teal" />
                </button>
              )}
              {!isMobile && (
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
                  <X size={20} className="text-slate-400" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-10">
            {/* ═══ OVERZICHT ═══ */}
            <section id="pd-overzicht">
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FolderKanban size={20} className="text-y-teal" /> {t("projects.overview_label")}
              </h4>

              {/* Project info grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {/* Customer */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.customer")}</p>
                  {project.customer ? (
                    <a
                      href={`${erpUrl}/customer/${encodeURIComponent(project.customer)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-y-teal hover:text-y-teal-dark hover:underline flex items-center gap-1"
                    >
                      {customerDoc?.customer_name || project.customer}
                      <ExternalLink size={12} className="opacity-50" />
                    </a>
                  ) : (
                    <p className="text-sm text-slate-400">-</p>
                  )}
                  {customerDoc?.email_id && (
                    <p className="text-xs text-slate-400 mt-0.5">{customerDoc.email_id}</p>
                  )}
                </div>

                {/* Customer Reference */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.customer_reference")}</p>
                  <p className="text-sm font-semibold text-slate-700">{customerRef || "-"}</p>
                </div>

                {/* Company */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.company")}</p>
                  <p className="text-sm font-semibold text-slate-700">{project.company || "-"}</p>
                </div>

                {/* Status */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.status")}</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[project.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {project.status}
                  </span>
                </div>

                {/* Sales Order */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.sales_order")}</p>
                  {salesOrderDoc ? (
                    <div>
                      <a
                        href={`${erpUrl}/sales-order/${salesOrderDoc.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-y-teal hover:text-y-teal-dark hover:underline flex items-center gap-1"
                      >
                        {salesOrderDoc.name}
                        <ExternalLink size={12} className="opacity-50" />
                      </a>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-slate-600">
                          {salesOrderDoc.currency || "EUR"} {salesOrderDoc.grand_total?.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                        </span>
                        {salesOrderDoc.billing_status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            salesOrderDoc.billing_status === "Fully Billed" ? "bg-green-100 text-green-700"
                            : salesOrderDoc.billing_status === "Not Billed" ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                          }`}>
                            {salesOrderDoc.billing_status}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : detailLoading ? (
                    <p className="text-sm text-slate-400">{t("projects.detail.loading")}</p>
                  ) : (
                    <p className="text-sm text-slate-400">-</p>
                  )}
                </div>

                {/* Project Manager */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.project_manager")}</p>
                  <p className="text-sm font-semibold text-slate-700">{projectManagerName || "-"}</p>
                </div>
              </div>

              {/* Progress + dates row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.progress")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-y-teal rounded-full" style={{ width: `${project.percent_complete}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{project.percent_complete}%</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.start_date")}</p>
                  <p className="text-sm font-semibold text-slate-700">{project.expected_start_date || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.end_date")}</p>
                  <p className="text-sm font-semibold text-slate-700">{project.expected_end_date || "-"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{t("projects.detail.grand_total")}</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {fullProject?.total_sales_amount != null
                      ? `EUR ${fullProject.total_sales_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Address + mini map */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <MapPin size={12} /> {t("projects.detail.address")}
                </p>
                {addressDoc ? (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">
                        {[addressDoc.address_line1, addressDoc.city, addressDoc.pincode, addressDoc.country]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {customerDoc?.customer_primary_contact && (
                        <p className="text-xs text-slate-400 mt-1">
                          {t("projects.detail.contact")}: {customerDoc.customer_primary_contact}
                          {customerDoc.mobile_no ? ` - ${customerDoc.mobile_no}` : ""}
                        </p>
                      )}
                    </div>
                    {addressCoords && (
                      <div className="w-48 h-36 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                        <MapContainer
                          center={[addressCoords.lat, addressCoords.lng]}
                          zoom={14}
                          style={{ height: "100%", width: "100%" }}
                          scrollWheelZoom={false}
                          zoomControl={false}
                          dragging={false}
                          attributionControl={false}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[addressCoords.lat, addressCoords.lng]} />
                        </MapContainer>
                      </div>
                    )}
                  </div>
                ) : detailLoading ? (
                  <p className="text-sm text-slate-400">{t("projects.detail.loading")}</p>
                ) : (
                  <p className="text-sm text-slate-400">{t("projects.detail.no_address")}</p>
                )}
              </div>

              {/* Connections */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Link2 size={12} /> {t("projects.detail.connections")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {salesOrderDoc && (
                    <a
                      href={`${erpUrl}/sales-order/${salesOrderDoc.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <FileText size={12} />
                      Sales Order
                    </a>
                  )}
                  {siCount != null && siCount > 0 && (
                    <a
                      href={`${erpUrl}/sales-invoice?project=${project.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                    >
                      <Receipt size={12} />
                      {t("projects.detail.invoices")} ({siCount})
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                    <ListTodo size={12} />
                    {t("projects.toc.tasks")} ({tasksLoading ? "..." : tasks.length})
                  </span>
                  {tsCount != null && tsCount > 0 && (
                    <a
                      href={`${erpUrl}/timesheet?project=${project.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors"
                    >
                      <Clock size={12} />
                      {t("projects.detail.timesheets")} ({tsCount})
                    </a>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><ListTodo className="text-blue-600" size={18} /></div>
                  <div>
                    <p className="text-xs text-slate-500">{t("projects.detail.tasks_open")}</p>
                    <p className="text-lg font-bold text-slate-800">{tasksLoading ? "..." : tasksOpen}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="text-green-600" size={18} /></div>
                  <div>
                    <p className="text-xs text-slate-500">{t("projects.detail.tasks_done")}</p>
                    <p className="text-lg font-bold text-slate-800">{tasksLoading ? "..." : tasksDone}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg"><Clock className="text-indigo-600" size={18} /></div>
                  <div>
                    <p className="text-xs text-slate-500">{t("projects.detail.total_hours")}</p>
                    <p className="text-lg font-bold text-slate-800">{totalHours.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══ TAKEN ═══ */}
            <section id="pd-taken">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ListTodo size={20} className="text-y-teal" /> {t("projects.tasks_section")}
                  <span className="text-sm font-normal text-slate-400 ml-1">({tasks.length})</span>
                </h4>
                <button
                  onClick={() => setShowAddTask((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark cursor-pointer"
                >
                  <Plus size={14} />
                  {t("projects.add_task")}
                </button>
              </div>

              {showAddTask && (
                <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div>
                    <input
                      type="text"
                      value={newTaskSubject}
                      onChange={(e) => setNewTaskSubject(e.target.value)}
                      placeholder={t("projects.task_subject_placeholder")}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter" && newTaskSubject.trim()) handleAddTask(); }}
                    />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <select
                      value={newTaskBillingType}
                      onChange={(e) => setNewTaskBillingType(e.target.value)}
                      title={t("tasks.detail.billing_type", { defaultValue: "Facturatie" })}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                    >
                      <option value="Timesheet based">Timesheet based</option>
                      <option value="Fixed Price">Fixed Price</option>
                      <option value="Milestone based">Milestone based</option>
                      <option value="Progress based">Progress based</option>
                    </select>
                    <input
                      type="date"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      placeholder="Deadline"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                    />
                  </div>
                  {/* Employee assignment */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t("projects.assign_to")}</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {newTaskAssignees.map((email) => {
                        const emp = employees.find((e) => e.user_id === email || e.company_email === email);
                        return (
                          <span key={email} className="inline-flex items-center gap-1 px-2 py-1 bg-y-teal/10 text-y-teal-dark rounded-full text-xs">
                            <div className={`w-4 h-4 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[7px] font-bold`}>
                              {getInitials(email)}
                            </div>
                            {emp?.employee_name || email.split("@")[0]}
                            <button
                              onClick={() => setNewTaskAssignees((prev) => prev.filter((e) => e !== email))}
                              className="ml-0.5 text-y-teal hover:text-red-500 cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !newTaskAssignees.includes(e.target.value)) {
                          setNewTaskAssignees((prev) => [...prev, e.target.value]);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                    >
                      <option value="">{t("projects.select_employee")}</option>
                      {employees
                        .filter((e) => e.status === "Active" && (e.user_id || e.company_email))
                        .filter((e) => !newTaskAssignees.includes(e.user_id || e.company_email || ""))
                        .map((e) => (
                          <option key={e.name} value={e.user_id || e.company_email}>
                            {e.employee_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      onClick={() => setShowAddTask(false)}
                      className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskSubject.trim() || addingTask}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
                    >
                      {addingTask ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      {t("projects.create_task")}
                    </button>
                  </div>
                </div>
              )}
              {tasksLoading ? (
                <div className="text-center text-slate-400 py-8">{t("common.loading")}</div>
              ) : tasks.length === 0 ? (
                <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl">{t("projects.detail.no_tasks")}</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">{t("hours_widget.task")}</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">{t("projects.col_assigned")}</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">{t("projects.detail.status")}</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">{t("projects.col_prio")}</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">{t("tasks.detail.deadline")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((tk) => {
                        const assignees = parseAssign(tk._assign);
                        return (
                          <tr key={tk.name} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <a
                                href={`${erpUrl}/task/${tk.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-y-teal hover:text-y-teal-dark hover:underline font-medium flex items-center gap-1"
                              >
                                {tk.subject || tk.name}
                                <ExternalLink size={12} className="flex-shrink-0 opacity-50" />
                              </a>
                            </td>
                            <td className="px-4 py-2.5">
                              {assignees.length > 0 ? (
                                <div className="flex -space-x-1">
                                  {assignees.slice(0, 3).map((a) => (
                                    <div
                                      key={a}
                                      className={`w-6 h-6 rounded-full ${getAvatarColor(a)} flex items-center justify-center text-white text-[8px] font-bold border-2 border-white`}
                                      title={a}
                                    >
                                      {getInitials(a)}
                                    </div>
                                  ))}
                                  {assignees.length > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-white text-[8px] font-bold border-2 border-white">
                                      +{assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${taskStatusColors[tk.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {tk.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-sm font-medium ${priorityColors[tk.priority] ?? "text-slate-400"}`}>
                                {tk.priority || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {tk.exp_end_date || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ═══ UREN ═══ */}
            <section id="pd-uren">
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-y-teal" /> {t("projects.hours_per_employee")}
              </h4>
              {sortedHours.length === 0 ? (
                <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl">{t("projects.no_hours_registered")}</div>
              ) : (
                <div className="space-y-2">
                  {sortedHours.map(([empName, hours], idx) => {
                    const pct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
                    return (
                      <div key={empName} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-48 flex-shrink-0">
                          {idx === 0 && <span className="text-yellow-500 text-xs" title={t("projects.most_hours")}>&#9733;</span>}
                          <div
                            className={`w-7 h-7 rounded-full ${getAvatarColor(empName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
                          >
                            {getInitials(empName)}
                          </div>
                          <span className="text-sm text-slate-700 font-medium truncate">{empName}</span>
                        </div>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full rounded-full ${idx === 0 ? "bg-y-teal" : "bg-y-teal/60"}`}
                            style={{ width: `${pct}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-semibold text-slate-600">
                            {t("projects.hours_unit", { hours: hours.toFixed(1) })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2">
                    <span className="text-sm font-semibold text-slate-600">{t("financial.total")}</span>
                    <span className="text-sm font-bold text-slate-800">{t("projects.hours_unit", { hours: totalHours.toFixed(1) })}</span>
                  </div>
                </div>
              )}
            </section>

            {/* ═══ PLANNING ═══ */}
            <section id="pd-planning">
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CalendarDays size={20} className="text-y-teal" /> {t("projects.planning_section")}
              </h4>
              {tasksLoading ? (
                <div className="text-center text-slate-400 py-8">{t("common.loading")}</div>
              ) : !planningData || planningData.tasksWithDates.length === 0 ? (
                <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl flex flex-col items-center gap-2">
                  <AlertCircle size={20} />
                  {t("projects.no_tasks_with_dates")}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Month header */}
                  <div className="relative h-8 bg-slate-50 border-b border-slate-200">
                    {planningData.months.map((m, i) => (
                      <span
                        key={i}
                        className="absolute text-[10px] text-slate-500 font-medium top-1/2 -translate-y-1/2"
                        style={{ left: `${Math.max(m.left, 1)}%` }}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                  {/* Task bars */}
                  <div className="divide-y divide-slate-100">
                    {planningData.tasksWithDates.map((tk) => {
                      const start = tk.exp_start_date
                        ? new Date(tk.exp_start_date).getTime()
                        : new Date(tk.exp_end_date).getTime();
                      const end = tk.exp_end_date
                        ? new Date(tk.exp_end_date).getTime()
                        : start;
                      const leftPct = ((start - planningData.minTime) / planningData.range) * 100;
                      const widthPct = Math.max(((end - start) / planningData.range) * 100, 1);

                      const barColor =
                        tk.status === "Completed" ? "bg-green-400"
                          : tk.status === "Working" ? "bg-yellow-400"
                            : tk.status === "Cancelled" ? "bg-red-300"
                              : "bg-y-teal";

                      return (
                        <div key={tk.name} className="relative h-9 flex items-center px-2 hover:bg-slate-50">
                          <a
                            href={`${erpUrl}/task/${tk.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute h-5 rounded-full flex items-center px-2 text-[10px] text-white font-medium truncate hover:opacity-80"
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: 60 }}
                            title={`${tk.subject} (${tk.exp_start_date || "?"} - ${tk.exp_end_date || "?"})`}
                          >
                            <div className={`absolute inset-0 rounded-full ${barColor} opacity-90`} />
                            <span className="relative truncate">{tk.subject || tk.name}</span>
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ProjectFormSidebar ─── */

interface CustomerRecord { name: string; customer_name: string; }
interface SalesOrderRecord { name: string; customer_name?: string; }
interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    country?: string;
  };
}

function ProjectFormSidebar({
  mode,
  project,
  onClose,
  onSave,
  onOpenEdit,
  customerHint,
}: {
  mode: "create" | "edit";
  project: ProjectRecord | null;
  onClose: () => void;
  onSave: () => void;
  onOpenEdit?: (p: ProjectRecord) => void;
  /** Pre-fill the customer field when opening in "create" mode. Used by
   * deep-links from other pages (e.g. Webmail "Project aanmaken" with the
   * email sender as customer). String is matched against Customer.name and
   * Customer.customer_name once the customer list loads — exact match auto-
   * selects, otherwise it stays in the search box so the user can refine. */
  customerHint?: string;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const isCreate = mode === "create";
  const employees = useEmployees();
  const companies = useCompanies();

  const defaultCompany = getActiveCompany();
  const defaultPM = useMemo(() => {
    const defaultEmployee = getActiveEmployee();
    if (defaultEmployee) {
      const match = employees.find((e) => e.name === defaultEmployee);
      if (match) return match.name;
    }
    const companyEmployees = employees.filter((e) => e.company === defaultCompany && e.status === "Active");
    return companyEmployees[0]?.name || "";
  }, [employees, defaultCompany]);

  // Form fields
  const [projectName, setProjectName] = useState(project?.project_name || "");
  const [customer, setCustomer] = useState(project?.customer || "");
  // Auto-fill customer when a hint is supplied (deep-link from Webmail).
  // The customer list is loaded async by a useEffect below — when both the
  // list and the hint are present, try an exact case-insensitive match on
  // either Customer.name or Customer.customer_name. If matched, set the
  // selected customer; otherwise leave the hint in the search box so the
  // user can pick/refine. Only runs in "create" mode and only once.
  const customerAutofillTried = useRef(false);
  const [company, setCompany] = useState(project?.company || defaultCompany);
  const [projectManager, setProjectManager] = useState(project?.custom_project_manager || defaultPM);
  const [projectType, setProjectType] = useState("External");
  const [status, setStatus] = useState(project?.status || "Open");
  const [salesOrder, setSalesOrder] = useState(project?.sales_order || "");
  const [importSOTasks, setImportSOTasks] = useState(false);

  // Customer search
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerSearch, setCustomerSearch] = useState(project?.customer || (isCreate ? (customerHint || "") : ""));
  const [customerOpen, setCustomerOpen] = useState(false);

  // Sales orders (loaded when customer selected)
  const [salesOrders, setSalesOrders] = useState<SalesOrderRecord[]>([]);

  // Task list (pre-loaded from template when customer has a mapped template)
  // templateTaskId = de gelinkte Task-template (Project Template Task.task), zodat
  // we bij aanmaken description + custom_billing_type van die template overnemen.
  // Handmatig toegevoegde taken hebben geen templateTaskId.
  const [taskList, setTaskList] = useState<Array<{ subject: string; templateTaskId?: string }>>([]);
  const [newTaskSubject, setNewTaskSubject] = useState("");
  const [templateSource, setTemplateSource] = useState<string | null>(null); // which template was used

  // Address (edit mode only)
  const [addressSearch, setAddressSearch] = useState("");
  const [addressResults, setAddressResults] = useState<NominatimResult[]>([]);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPincode, setAddressPincode] = useState("");
  const [addressCountry, setAddressCountry] = useState("Netherlands");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [existingAddressName, setExistingAddressName] = useState(project?.custom_address || "");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load customers on mount
  useEffect(() => {
    fetchList<CustomerRecord>("Customer", {
      fields: ["name", "customer_name"],
      filters: [["disabled", "=", 0]],
      limit_page_length: 0,
      order_by: "customer_name asc",
    }).then(setCustomers).catch(() => {});
  }, []);

  // Auto-match customer from `customerHint` once the list has loaded.
  // Tries exact case-insensitive match on either Customer.name or
  // Customer.customer_name. If matched, selects it; otherwise the hint
  // stays in the search box. Guarded so we don't overwrite a user's
  // subsequent selection on a re-render.
  useEffect(() => {
    if (!isCreate || !customerHint || customerAutofillTried.current) return;
    if (customers.length === 0) return;
    customerAutofillTried.current = true;
    const hint = customerHint.trim().toLowerCase();
    const match = customers.find(
      (c) => c.name.toLowerCase() === hint || c.customer_name.toLowerCase() === hint
    );
    if (match) {
      setCustomer(match.name);
      setCustomerSearch(match.customer_name || match.name);
      setCustomerOpen(false);
    }
  }, [customers, customerHint, isCreate]);

  // Load address data in edit mode
  useEffect(() => {
    if (!isCreate && project?.custom_address) {
      fetchDocument<AddressDoc>("Address", project.custom_address)
        .then((addr) => {
          setAddressLine1(addr.address_line1 || "");
          setAddressCity(addr.city || "");
          setAddressPincode(addr.pincode || "");
          setAddressCountry(addr.country || "Netherlands");
          setExistingAddressName(project.custom_address!);
          // Geocode for map preview
          const query = [addr.address_line1, addr.city, addr.pincode, addr.country].filter(Boolean).join(", ");
          if (query) geocodeAddress(query).then((c) => { if (c) setAddressCoords(c); });
        })
        .catch(() => {});
    }
  }, [isCreate, project?.custom_address]);

  // Load sales orders when customer changes
  useEffect(() => {
    if (!customer) { setSalesOrders([]); return; }
    fetchList<SalesOrderRecord>("Sales Order", {
      fields: ["name", "customer_name"],
      filters: [["customer", "=", customer], ["docstatus", "=", 1]],
      limit_page_length: 100,
      order_by: "creation desc",
    }).then(setSalesOrders).catch(() => setSalesOrders([]));
  }, [customer]);

  // Load template tasks when customer changes (only in create mode). De
  // customer→template-koppeling komt uit de per-instance settings-bridge
  // (/api/instances/:id/settings/*), een Express-only route die in Y-next
  // niet bestaat — niet-kernfunctionaliteit (gewoon geen voorgestelde
  // template-taken), dus gate + stille fallback, zelfde patroon als
  // lib/activityTypes.ts (isFeatureEnabled("shared-settings")).
  useEffect(() => {
    if (!isCreate || !customer) { setTaskList([]); setTemplateSource(null); return; }
    if (!isFeatureEnabled("shared-settings")) { setTaskList([]); setTemplateSource(null); return; }
    const instanceId = getActiveInstanceId();
    fetch(`/api/instances/${instanceId}/settings/project-template-mapping`)
      .then((r) => r.json())
      .then((data: { ok: boolean; value?: Record<string, string> }) => {
        const templateName = data.ok && data.value ? data.value[customer] : undefined;
        if (!templateName) { setTaskList([]); setTemplateSource(null); return; }
        return fetchDocument<Record<string, unknown>>("Project Template", templateName)
          .then((tmpl) => {
            const taskArray = (tmpl.tasks as Array<Record<string, unknown>> | undefined)
              ?? Object.values(tmpl).find((v) => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === "object") as Array<Record<string, unknown>> | undefined
              ?? [];
            const tasks = taskArray
              .map((r) => ({
                subject: (r.subject ?? r.task_name ?? r.title ?? r.name ?? "") as string,
                // "task" = Link naar de Task-template; gebruikt om bij aanmaken
                // description + custom_billing_type over te nemen.
                templateTaskId: (r.task as string) || undefined,
              }))
              .filter((t) => t.subject);
            setTaskList(tasks);
            setTemplateSource(templateName);
          });
      })
      .catch(() => { setTaskList([]); setTemplateSource(null); });
  }, [customer, isCreate]);

  // Nominatim address search (debounced)
  useEffect(() => {
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (!addressSearch.trim() || addressSearch.length < 3) { setAddressResults([]); return; }
    addressDebounceRef.current = setTimeout(async () => {
      setAddressSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressSearch)}&format=json&addressdetails=1&limit=5&countrycodes=nl,be`,
          { headers: { "Accept-Language": "nl" } }
        );
        const data = await res.json() as NominatimResult[];
        setAddressResults(Array.isArray(data) ? data : []);
      } catch { setAddressResults([]); }
      setAddressSearching(false);
    }, 400);
  }, [addressSearch]);

  function selectAddressResult(r: NominatimResult) {
    const road = [r.address.road, r.address.house_number].filter(Boolean).join(" ");
    const city = r.address.city || r.address.town || r.address.village || "";
    setAddressLine1(road);
    setAddressCity(city);
    setAddressPincode(r.address.postcode || "");
    setAddressCountry(r.address.country || "Netherlands");
    setAddressCoords({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setAddressResults([]);
    setAddressSearch(r.display_name);
  }

  async function handleSaveAddress(projectDocName: string) {
    if (!addressLine1 && !addressCity) return;
    setAddressSaving(true);
    try {
      if (existingAddressName) {
        await updateDocument("Address", existingAddressName, {
          address_line1: addressLine1,
          city: addressCity,
          pincode: addressPincode,
          country: addressCountry,
        });
      } else {
        const addrDoc = await createDocument<{ name: string }>("Address", {
          address_title: projectDocName,
          address_type: "Office",
          address_line1: addressLine1,
          city: addressCity,
          pincode: addressPincode,
          country: addressCountry,
          links: [{ link_doctype: "Project", link_name: projectDocName }],
        });
        setExistingAddressName(addrDoc.name);
        await updateDocument("Project", projectDocName, { custom_address: addrDoc.name });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setAddressSaving(false);
    }
  }

  const pmEmployee = useMemo(() => employees.find((e) => e.name === projectManager), [employees, projectManager]);
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.customer_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [customers, customerSearch]);

  async function handleCreate() {
    if (!projectName.trim() || !customer) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        project_name: projectName.trim(),
        customer,
        company,
        status,
        project_type: projectType,
        custom_project_manager: projectManager || undefined,
        custom_project_manager_company: pmEmployee?.company || company,
      };
      if (salesOrder) payload.sales_order = salesOrder;

      const doc = await createDocument<ProjectRecord>("Project", payload);

      // Create tasks from task list (template tasks + user additions). Voor
      // taken die uit een Project Template komen (templateTaskId) nemen we de
      // omschrijving + billing type van de gelinkte Task-template over, zodat de
      // taken aangemaakt worden "zoals de template is ingesteld".
      if (taskList.length > 0) {
        await Promise.all(taskList.map(async (task) => {
          const extra: Record<string, unknown> = {};
          if (task.templateTaskId) {
            try {
              const tmplTask = await fetchDocument<{ description?: string; custom_billing_type?: string }>(
                "Task", task.templateTaskId,
              );
              if (tmplTask.description) extra.description = tmplTask.description;
              if (tmplTask.custom_billing_type) extra.custom_billing_type = tmplTask.custom_billing_type;
            } catch { /* template-taak onleesbaar → maak kale taak */ }
          }
          return createDocument("Task", {
            subject: task.subject,
            project: doc.name,
            company,
            ...extra,
          }).catch(() => {});
        }));
      }

      // Import SO tasks if requested
      if (importSOTasks && salesOrder) {
        try {
          const soDoc = await fetchDocument<{ items?: Array<{ item_name?: string; description?: string; qty?: number }> }>("Sales Order", salesOrder);
          if (soDoc.items?.length) {
            await Promise.all(soDoc.items.map((item, idx) =>
              createDocument("Task", {
                subject: item.item_name || `Taak ${idx + 1}`,
                description: item.description || "",
                project: doc.name,
                company,
              }).catch(() => {})
            ));
          }
        } catch { /* non-fatal */ }
      }

      onSave();
      onClose();
      if (onOpenEdit) onOpenEdit(doc);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!project || !projectName.trim() || !customer) return;
    setSaving(true);
    setError(null);
    try {
      await updateDocument("Project", project.name, {
        project_name: projectName.trim(),
        customer,
        company,
        status,
        project_type: projectType,
        custom_project_manager: projectManager || undefined,
        custom_project_manager_company: pmEmployee?.company || company,
        sales_order: salesOrder || undefined,
      });
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = projectName.trim() && customer;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end pt-[env(safe-area-inset-top,0px)]">
      {!isMobile && <div className="flex-1 bg-black/40" onClick={onClose} />}
      <div className={`${isMobile ? "w-full" : "w-full max-w-md"} bg-white shadow-2xl flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-y-teal/10 rounded-lg">
              <FolderKanban className="text-y-teal" size={18} />
            </div>
            <h3 className="font-semibold text-slate-800">
              {isCreate ? t("projects.new_project") : t("projects.edit_project")}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer p-2.5">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Project name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              {t("projects.detail.name")} *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("projects.detail.name_placeholder")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              autoFocus
            />
          </div>

          {/* Customer */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Building2 size={13} /> {t("projects.detail.customer")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true); if (!e.target.value) setCustomer(""); }}
                onFocus={() => setCustomerOpen(true)}
                placeholder={t("projects.search_customer")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
              {customer && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-y-teal font-medium">{customer}</span>
              )}
              {customerOpen && filteredCustomers.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCustomerOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => { setCustomer(c.name); setCustomerSearch(c.customer_name); setCustomerOpen(false); }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer ${customer === c.name ? "bg-y-teal/5 text-y-teal-dark" : "text-slate-700"}`}
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

          {/* Company */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Building2 size={13} /> {t("projects.detail.company")} *
            </label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              {companies.map((c) => (
                <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
              ))}
            </select>
          </div>

          {/* Project Manager */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <User size={13} /> {t("projects.detail.project_manager")}
            </label>
            <select
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value="">-</option>
              {employees.filter((e) => e.status === "Active").map((e) => (
                <option key={e.name} value={e.name}>{e.employee_name}</option>
              ))}
            </select>
          </div>

          {/* Project type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Flag size={13} /> {t("projects.detail.project_type")}
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              >
                <option value="External">External</option>
                <option value="Internal">Internal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {t("projects.detail.status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              >
                <option value="Open">Open</option>
                <option value="Draft">Draft</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Sales Order */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <ShoppingCart size={13} /> {t("projects.detail.sales_order")}
            </label>
            <select
              value={salesOrder}
              onChange={(e) => setSalesOrder(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              disabled={!customer}
            >
              <option value="">-</option>
              {salesOrders.map((so) => (
                <option key={so.name} value={so.name}>{so.name}</option>
              ))}
            </select>
            {salesOrder && isCreate && (
              <label className="flex items-center gap-2 mt-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importSOTasks}
                  onChange={(e) => setImportSOTasks(e.target.checked)}
                  className="rounded"
                />
                {t("projects.import_so_tasks")}
              </label>
            )}
          </div>

          {/* Task list (create mode only) */}
          {isCreate && customer && (
            <div className="border-t border-slate-100 pt-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <LayoutTemplate size={13} /> Taken
                {templateSource && (
                  <span className="ml-1 text-[10px] font-normal text-slate-400 normal-case">(uit {templateSource})</span>
                )}
              </label>

              {taskList.length > 0 ? (
                <ul className="space-y-1 mb-3">
                  {taskList.map((task, idx) => (
                    <li key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg text-sm text-slate-700 group">
                      <span className="flex-1">{task.subject}</span>
                      <button
                        onClick={() => setTaskList(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic mb-3">{t("projects.no_tasks_yet")}</p>
              )}

              {/* Add task input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskSubject}
                  onChange={(e) => setNewTaskSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTaskSubject.trim()) {
                      setTaskList(prev => [...prev, { subject: newTaskSubject.trim() }]);
                      setNewTaskSubject("");
                    }
                  }}
                  placeholder="Taak toevoegen..."
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
                <button
                  onClick={() => {
                    if (newTaskSubject.trim()) {
                      setTaskList(prev => [...prev, { subject: newTaskSubject.trim() }]);
                      setNewTaskSubject("");
                    }
                  }}
                  disabled={!newTaskSubject.trim()}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-sm cursor-pointer"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Address note in create mode */}
          {isCreate && (
            <p className="text-xs text-slate-400 italic">{t("projects.address_after_create")}</p>
          )}

          {/* Address section (edit mode only) */}
          {!isCreate && (
            <div className="border-t border-slate-100 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                <MapPin size={13} /> {t("projects.detail.address")}
              </p>

              {/* Search input */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={addressSearch}
                  onChange={(e) => setAddressSearch(e.target.value)}
                  placeholder={t("projects.address_search_placeholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
                {addressSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{t("common.loading")}</span>
                )}
                {addressResults.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAddressResults([])} />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {addressResults.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => selectAddressResult(r)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-700"
                        >
                          {r.display_name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Address fields (auto-filled from search) */}
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder={t("projects.address_line1")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder={t("projects.address_city")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                  <input
                    type="text"
                    value={addressPincode}
                    onChange={(e) => setAddressPincode(e.target.value)}
                    placeholder={t("projects.address_pincode")}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <input
                  type="text"
                  value={addressCountry}
                  onChange={(e) => setAddressCountry(e.target.value)}
                  placeholder={t("projects.address_country")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
              </div>

              {/* Mini map when coords available */}
              {addressCoords && (
                <div className="mb-3 rounded-lg overflow-hidden border border-slate-200" style={{ height: 160 }}>
                  <MapContainer
                    key={`${addressCoords.lat},${addressCoords.lng}`}
                    center={[addressCoords.lat, addressCoords.lng]}
                    zoom={15}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                    zoomControl={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[addressCoords.lat, addressCoords.lng]} />
                  </MapContainer>
                </div>
              )}

              {/* Address save button */}
              <button
                onClick={() => project && handleSaveAddress(project.name)}
                disabled={addressSaving || (!addressLine1 && !addressCity)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
              >
                <MapPin size={14} />
                {addressSaving ? t("common.saving") : existingAddressName ? t("projects.update_address") : t("projects.save_address")}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={isCreate ? handleCreate : handleUpdate}
            disabled={saving || !canSubmit}
            className="px-4 py-2 text-sm bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            {saving ? t("common.saving") : isCreate ? t("common.create") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ProjectMap ─── */

function ProjectMap({ projects }: { projects: ProjectRecord[] }) {
  const { t } = useTranslation();
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(false);
  const processedRef = useRef<Set<string>>(new Set());

  const geocodeProjects = useCallback(async (projs: ProjectRecord[]) => {
    const toProcess = projs.filter(
      (p) => p.custom_address && !processedRef.current.has(p.name)
    );
    if (toProcess.length === 0) return;

    setLoading(true);
    toProcess.forEach(p => processedRef.current.add(p.name));

    // Fetch all Address documents in parallel (cached after first load)
    const addressResults = await Promise.allSettled(
      toProcess.map(p => fetchDocument<AddressDoc>("Address", p.custom_address!))
    );

    // Geocode — cached results are instant, uncached get rate-limited
    for (let i = 0; i < toProcess.length; i++) {
      const addrResult = addressResults[i];
      if (addrResult.status !== "fulfilled") continue;
      const addr = addrResult.value;
      const parts = [addr.address_line1, addr.city, addr.pincode, addr.country].filter(Boolean);
      const query = parts.join(", ");
      if (!query) continue;

      const coords = await geocodeAddress(query);
      if (coords) {
        // Add each marker immediately so the map updates progressively
        setMarkers(prev => [...prev, {
          projectName: toProcess[i].name,
          projectTitle: toProcess[i].project_name,
          address: query,
          lat: coords.lat,
          lng: coords.lng,
        }]);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    geocodeProjects(projects);
  }, [projects, geocodeProjects]);

  const projectNames = useMemo(() => new Set(projects.map((p) => p.name)), [projects]);
  const visibleMarkers = useMemo(
    () => markers.filter((m) => projectNames.has(m.projectName)),
    [markers, projectNames]
  );

  const projectsWithAddress = projects.filter((p) => p.custom_address);

  return (
    <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
        <MapPin size={16} className="text-slate-500" />
        <span className="text-sm font-semibold text-slate-600">{t("projects.project_locations")}</span>
        {loading && <span className="text-xs text-slate-400 ml-2">{t("projects.geocoding")}</span>}
        <span className="text-xs text-slate-400 ml-auto">
          {t("projects.locations_summary", { visible: visibleMarkers.length, withAddress: projectsWithAddress.length, total: projects.length })}
        </span>
      </div>
      {projectsWithAddress.length === 0 && !loading && (
        <div className="px-4 py-6 text-center">
          <MapPin size={32} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">{t("projects.no_projects_with_address")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("projects.map_address_hint")}</p>
        </div>
      )}
      <MapContainer
        center={NL_CENTER}
        zoom={8}
        style={{ height: "calc(100vh - 280px)", minHeight: 500, width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visibleMarkers.map((m) => (
          <Marker key={m.projectName} position={[m.lat, m.lng]}>
            <Popup>
              <div className="text-sm">
                <a
                  href={`${getErpNextLinkUrl()}/project/${m.projectName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-blue-600 hover:underline"
                >
                  {m.projectName}
                </a>
                <div className="text-slate-700">{m.projectTitle}</div>
                <div className="text-slate-500 text-xs mt-1">{m.address}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/* ─── Projects Page ─── */

export default function Projects() {
  const { t } = useTranslation();
  // Project-aanmaak is een werkgever-actie (klanten-/sjabloon-lookups
  // vereisen employer-scoped ERPNext-permissions); de lijst zelf blijft
  // voor iedereen zichtbaar. Zelfde localStorage-signaal als elders in de
  // app (bv. Todo.tsx `isEmployer`) — geen nieuwe rol-logica.
  const isEmployer = localStorage.getItem("view_mode") !== "employee";
  const storeProjects = useProjects();
  const companies = useCompanies();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState(() => getActiveCompany());
  const [statusFilter, setStatusFilter] = useState("Open");
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);

  // Deep-link support: `?p=<projectId>` auto-opens that project's detail view.
  // Clears the param when the modal closes so back-button doesn't re-open it.
  const urlProjectId = searchParams.get("p");
  useEffect(() => {
    if (!urlProjectId || storeProjects.length === 0) return;
    if (selectedProject?.name === urlProjectId) return;
    const match = storeProjects.find((p) => p.name === urlProjectId);
    if (match) setSelectedProject(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, storeProjects]);
  const [activeTab, setActiveTab] = useState<"lijst" | "kaart">("lijst");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formProject, setFormProject] = useState<ProjectRecord | null>(null);
  // Pre-fill hint passed from other pages via URL params — e.g. Webmail's
  // "Project aanmaken" follow-up navigates to /projects?create=1&customer=<name>
  // so the sidebar opens with the customer already selected/searched.
  const [formCustomerHint, setFormCustomerHint] = useState<string>("");

  // Read deep-link params on mount. Strips them from the URL afterwards so
  // a manual refresh doesn't re-open the form. Reuses the `searchParams`
  // hook declared above (also used by the `?p=` detail deep-link).
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      const hint = searchParams.get("customer") || "";
      setFormProject(null);
      setFormCustomerHint(hint);
      setFormMode("create");
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      next.delete("customer");
      setSearchParams(next, { replace: true });
    }
    // Run once per mount; subsequent param changes can be ignored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type SortColumn = "name" | "project_name" | "customer_name" | "company" | "status" | "percent_complete" | "expected_start_date" | "expected_end_date";
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Store full hours map: project → employee → hours
  const [allProjectHours, setAllProjectHours] = useState<Map<string, Map<string, number>>>(new Map());

  // Derive topWorkers from allProjectHours
  const topWorkers = useMemo(() => {
    const result = new Map<string, { name: string; hours: number }>();
    for (const [project, empMap] of allProjectHours) {
      let topName = "";
      let topHours = 0;
      for (const [name, hours] of empMap) {
        if (hours > topHours) {
          topName = name;
          topHours = hours;
        }
      }
      if (topName) result.set(project, { name: topName, hours: topHours });
    }
    return result;
  }, [allProjectHours]);

  async function loadData() {
    // Don't block page render — project data comes from DataContext (already cached)
    setLoading(false);
    setError(null);

    // Load timesheet hours in background (non-blocking)
    try {
      let tsDetails: TimesheetDetail[] = [];
      let tsParents: TimesheetParent[] = [];
      try {
        // Frappe v16 403s a plain /api/resource list query against a
        // child-table doctype like "Timesheet Detail" — even with a
        // parenttype filter — so this goes through fetchChildTable's
        // frappe.client.get_list(parent=...) RPC instead (verified against
        // a live v16 instance; see lib/erpnext.ts for details).
        tsDetails = await fetchChildTable<TimesheetDetail>(
          "Timesheet Detail", "Timesheet",
          ["project", "hours", "parent"],
          [["project", "is", "set"]],
          5000
        );
        if (tsDetails.length > 0) {
          tsParents = await fetchList<TimesheetParent>("Timesheet", {
            fields: ["name", "employee_name"],
            limit_page_length: 2000,
          });
        }
      } catch {
        // Timesheet Detail not accessible — project hours will be empty
      }

      const parentToEmployee = new Map<string, string>();
      for (const ts of tsParents) {
        parentToEmployee.set(ts.name, ts.employee_name);
      }

      const projectEmployeeHours = new Map<string, Map<string, number>>();
      for (const detail of tsDetails) {
        if (!detail.project) continue;
        const empName = parentToEmployee.get(detail.parent);
        if (!empName) continue;

        if (!projectEmployeeHours.has(detail.project)) {
          projectEmployeeHours.set(detail.project, new Map());
        }
        const empMap = projectEmployeeHours.get(detail.project)!;
        empMap.set(empName, (empMap.get(empName) || 0) + detail.hours);
      }

      setAllProjectHours(projectEmployeeHours);
    } catch {
      // Timesheet hours are non-critical — page works without them
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const p of storeProjects) {
      if (p.expected_start_date) {
        const year = p.expected_start_date.slice(0, 4);
        if (year) years.add(year);
      }
    }
    return Array.from(years).sort().reverse();
  }, [storeProjects]);

  const filtered = useMemo(() => {
    let list = storeProjects;
    if (statusFilter) {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (companyFilter) {
      list = list.filter((p) => p.company === companyFilter);
    }
    if (yearFilter) {
      list = list.filter(
        (p) => p.expected_start_date && p.expected_start_date.startsWith(yearFilter)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.project_name.toLowerCase().includes(q) ||
          p.status.toLowerCase().includes(q) ||
          p.company?.toLowerCase().includes(q) ||
          p.customer_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [storeProjects, search, yearFilter, companyFilter, statusFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a[sortColumn] ?? "") as string | number;
      const bv = (b[sortColumn] ?? "") as string | number;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "nl") * dir;
    });
  }, [filtered, sortColumn, sortDir]);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir(col === "name" ? "desc" : "asc");
    }
  }

  const sortIndicator = (col: SortColumn) =>
    sortColumn === col ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("projects.title")}</h2>
        <div className="flex items-center gap-2">
          {isEmployer && (
            <button
              onClick={() => { setFormProject(null); setFormMode("create"); }}
              className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium"
            >
              <Plus size={16} />
              {t("projects.new")}
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FolderKanban className="text-indigo-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("projects.total_projects")}</p>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? "..." : filtered.length}
            </p>
          </div>
        </div>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer"
        >
          <option value="">{t("instance_bar.all_companies")}</option>
          {companies.map((c) => (
            <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer"
        >
          <option value="">{t("common.all_statuses")}</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer"
        >
          <option value="">{t("projects.all_years")}</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="w-full md:flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder={t("projects.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm"
          />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("lijst")}
          className={`px-4 py-2 flex items-center gap-1.5 text-sm rounded-md cursor-pointer transition-colors ${
            activeTab === "lijst" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <List size={16} /> {t("projects.tab_list")}
        </button>
        <button
          onClick={() => setActiveTab("kaart")}
          className={`px-4 py-2 flex items-center gap-1.5 text-sm rounded-md cursor-pointer transition-colors ${
            activeTab === "kaart" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <MapIcon size={16} /> {t("projects.tab_map")}
        </button>
      </div>

      {activeTab === "kaart" ? (
        <ProjectMap projects={filtered} />
      ) : (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th onClick={() => handleSort("name")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.project_nr")}{sortIndicator("name")}</th>
              <th onClick={() => handleSort("project_name")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_name")}{sortIndicator("project_name")}</th>
              <th onClick={() => handleSort("customer_name")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_customer")}{sortIndicator("customer_name")}</th>
              <th onClick={() => handleSort("company")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.company")}{sortIndicator("company")}</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("projects.col_most_work")}</th>
              <th onClick={() => handleSort("status")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_status")}{sortIndicator("status")}</th>
              <th onClick={() => handleSort("percent_complete")} className="text-right px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_progress")}{sortIndicator("percent_complete")}</th>
              <th onClick={() => handleSort("expected_start_date")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_start_date")}{sortIndicator("expected_start_date")}</th>
              <th onClick={() => handleSort("expected_end_date")} className="text-left px-4 py-3 text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-900 select-none">{t("projects.col_end_date")}{sortIndicator("expected_end_date")}</th>
              <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600">{t("projects.col_folder")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {t("common.loading")}
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {t("common.no_projects_found")}
                </td>
              </tr>
            ) : (
              sorted.map((p) => {
                const worker = topWorkers.get(p.name);
                return (
                  <tr
                    key={`${p.name}-${p.company}`}
                    onClick={() => setSelectedProject(p)}
                    className="border-b border-slate-100 hover:bg-y-teal/5 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className="text-y-teal flex items-center gap-1">
                        {p.name}
                        <ChevronRight size={14} className="text-slate-300" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {p.project_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {p.customer_name || p.customer || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {p.company || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {worker ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full ${getAvatarColor(worker.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
                            title={worker.name}
                          >
                            {getInitials(worker.name)}
                          </div>
                          <div className="min-w-[160px]">
                            <p className="text-sm text-slate-700 font-medium">{worker.name}</p>
                            <p className="text-xs text-slate-400">{t("projects.hours_unit", { hours: worker.hours.toFixed(1) })}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[p.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-y-teal rounded-full"
                            style={{ width: `${p.percent_complete}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {p.percent_complete}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {p.expected_start_date || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {p.expected_end_date || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isFeatureEnabled("nextcloud") && (
                        <button
                          title={getProjectFolderPath({ name: p.name, project_name: p.project_name })}
                          onClick={async (e) => { e.stopPropagation(); await hydrateProjectFoldersConfig(); openFolder(getProjectFolderPath({ name: p.name, project_name: p.project_name })); }}
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-y-teal hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <FolderOpen size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Project Detail Panel */}
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          projectHours={allProjectHours.get(selectedProject.name) || new Map()}
          onClose={() => {
            setSelectedProject(null);
            if (searchParams.get("p")) {
              const next = new URLSearchParams(searchParams);
              next.delete("p");
              setSearchParams(next, { replace: true });
            }
          }}
          onEdit={() => { setFormProject(selectedProject); setFormMode("edit"); }}
        />
      )}

      {/* Project Form Sidebar (create / edit). Create mode is employer-only
          (see `isEmployer` above) — guarded here too, not just on the "+
          Project" button, so an employee can never reach it regardless of
          the trigger (e.g. the `?create=1` deep-link from Webmail's
          "Project aanmaken" follow-up). Wrapped in an ErrorBoundary so a
          crash while creating/editing a project (e.g. an unexpected
          ERPNext permission-error shape) shows a recoverable message
          instead of a blank white page — see issue #103. */}
      {formMode && (formMode !== "create" || isEmployer) && (
        <ErrorBoundary
          resetKey={formMode === "create" ? `create-${formCustomerHint}` : (formProject?.name || "edit")}
          onReset={() => { setFormMode(null); setFormCustomerHint(""); }}
        >
          <ProjectFormSidebar
            key={formMode === "create" ? `create-${formCustomerHint}` : (formProject?.name || "edit")}
            mode={formMode}
            project={formMode === "edit" ? formProject : null}
            customerHint={formMode === "create" ? formCustomerHint : undefined}
            onClose={() => { setFormMode(null); setFormCustomerHint(""); }}
            onSave={() => { setSelectedProject(null); /* DataContext refreshes via storeProjects */ }}
            onOpenEdit={(p) => { setFormProject(p); setFormMode("edit"); }}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
