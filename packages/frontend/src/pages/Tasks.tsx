import { useEffect, useState, useMemo, useRef, useCallback, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchList, fetchAll, fetchDocument, createDocument, updateDocument, callMethod, invalidateCache, getErpNextLinkUrl, ApiError } from "../lib/erpnext";
import {
  CheckSquare, RefreshCw, Search, LayoutGrid, List, User, Filter,
  GripVertical, ChevronDown, Plus, X, ExternalLink, Calendar, Flag,
  FileText, Briefcase, Receipt,
  Bold, Italic, Underline, Heading1, Heading2,
  ListOrdered, Link, Table, Undo, Redo, RemoveFormatting, ListChecks,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import TaskBulkBar from "../components/TaskBulkBar";
import {
  emptySelection, applyRowClick, toggleAllVisible, selectAll, pruneSelection,
  allVisibleSelected, someVisibleSelected, type SelectionState,
} from "../lib/table-selection";
import {
  fetchTaskSelectOptions, FALLBACK_STATUS_OPTIONS, FALLBACK_PRIORITY_OPTIONS,
} from "../lib/task-bulk";
import type { BulkResult } from "../lib/bulk-run";
import { useProjects, type ProjectRecord } from "../lib/DataContext";
import { IS_MINI } from "../lib/variant";
import { getActiveCompany, getActiveEmployee } from "../lib/instances";
import { useTranslation } from "react-i18next";
import { useDropdownPosition } from "../lib/useDropdownPosition";

export interface Employee {
  name: string;
  employee_name: string;
  company_email?: string;
  user_id?: string;
}

export interface Task {
  name: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string;
  project: string;
  exp_end_date: string;
  description: string;
  company: string;
  workflow_state: string;
}

const workflowColors: Record<string, string> = {
  Open: "bg-y-teal/10 text-y-teal-dark",
  Working: "bg-yellow-100 text-yellow-700",
  "Pending Review Intern": "bg-purple-100 text-purple-700",
  "Pending Review Extern": "bg-indigo-100 text-indigo-700",
  "On Hold": "bg-orange-100 text-orange-700",
  "Information required": "bg-amber-100 text-amber-700",
  "to discussed": "bg-cyan-100 text-cyan-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  // Plain ERPNext Task statuses — shown when the site has no Task Workflow
  // configured, so `workflow_state` falls back to `status` (see loadData).
  "Pending Review": "bg-purple-100 text-purple-700",
  Overdue: "bg-red-100 text-red-700",
};

// Two status vocabularies, depending on whether this Task doctype has a
// Workflow configured on the active instance:
// - WORKFLOW_STATUS_OPTIONS: the custom workflow_state values used when a
//   Task Workflow exists (this app's own history).
// - PLAIN_STATUS_OPTIONS: ERPNext's built-in Task.status values, used when
//   no workflow is configured — querying `workflow_state` then gets a 417
//   ("Field not permitted in query"), lib/erpnext.ts self-heals that by
//   dropping the field, and loadData falls back to `status` per task.
const WORKFLOW_STATUS_OPTIONS = [
  "Open", "Working", "Pending Review Intern", "Pending Review Extern",
  "On Hold", "Information required", "to discussed", "Completed", "Cancelled",
];
const PLAIN_STATUS_OPTIONS = ["Open", "Working", "Pending Review", "Overdue", "Completed", "Cancelled"];
// Default filter selections per vocabulary — everything except the "done"
// states, matching the original workflow-mode default.
const WORKFLOW_DEFAULT_FILTER = ["Open", "Working", "Pending Review Intern", "Pending Review Extern", "On Hold", "Information required", "to discussed"];
const PLAIN_DEFAULT_FILTER = ["Open", "Working", "Pending Review", "Overdue"];

// Workflow action map: { fromState: [{ action, nextState }] }
const workflowActions: Record<string, { action: string; next: string }[]> = {
  Open: [
    { action: "Working", next: "Working" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "On Hold", next: "On Hold" },
    { action: "Information Required", next: "Information required" },
    { action: "to be discussed", next: "to discussed" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  Working: [
    { action: "Send to Open", next: "Open" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "Information Required", next: "Information required" },
    { action: "to be discussed", next: "to discussed" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  "Pending Review Intern": [
    { action: "Send to Open", next: "Open" },
    { action: "Working", next: "Working" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "On Hold", next: "On Hold" },
    { action: "Information Required", next: "Information required" },
    { action: "to be discussed", next: "to discussed" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  "Pending Review Extern": [
    { action: "Send to Open", next: "Open" },
    { action: "Working", next: "Working" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "On Hold", next: "On Hold" },
    { action: "Information Required", next: "Information required" },
    { action: "to be discussed", next: "to discussed" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  "On Hold": [
    { action: "Send to Open", next: "Open" },
    { action: "Working", next: "Working" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "Information Required", next: "Information required" },
    { action: "to be discussed", next: "to discussed" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  "Information required": [
    { action: "Send to Open", next: "Open" },
    { action: "Working", next: "Working" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "On Hold", next: "On Hold" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  "to discussed": [
    { action: "Send to Open", next: "Open" },
    { action: "Completed", next: "Completed" },
    { action: "Cancel", next: "Cancelled" },
  ],
  Completed: [
    { action: "Send to Open", next: "Open" },
    { action: "Working", next: "Working" },
    { action: "Pending Review Intern", next: "Pending Review Intern" },
    { action: "Pending Review Extern", next: "Pending Review Extern" },
    { action: "On Hold", next: "On Hold" },
    { action: "Information Required", next: "Information required" },
    { action: "Cancel", next: "Cancelled" },
  ],
};


/**
 * Hoeveel rijen de tabelweergave in één keer toont.
 *
 * De pagina heeft álle taken al in het geheugen (`fetchAll`), dus dit is puur
 * een rendervenster: ~440 rijen tegelijk in de DOM maakt scrollen en
 * selecteren merkbaar traag. Het venster maakt bovendien het verschil tussen
 * "zichtbaar" en "voldoet aan het filter" expliciet — precies het onderscheid
 * dat de bulkbalk nodig heeft voor "selecteer alle N".
 */
const TABLE_PAGE_SIZE = 100;

const priorityColors: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-slate-100 text-slate-600",
};

const priorityDot: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-slate-400",
};

export function parseAssignees(assignedTo: string): string[] {
  if (!assignedTo) return [];
  try {
    const parsed = JSON.parse(assignedTo);
    if (Array.isArray(parsed)) return parsed;
    return [String(parsed)];
  } catch {
    return assignedTo ? [assignedTo] : [];
  }
}

function getInitials(email: string): string {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(email: string): string {
  const colors = [
    "bg-y-teal/100", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function isOverdue(date: string): boolean {
  if (!date) return false;
  return new Date(date) < new Date(new Date().toDateString());
}

export default function Tasks() {
  const { t } = useTranslation();
  const storeProjects = useProjects();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Empty = no filter applied yet. Populated with a sensible default (all
  // "not done" statuses, in whichever vocabulary this instance actually
  // uses) once the first load tells us whether workflow_state is available
  // — see loadData/didInitStatusFilter below. Starting non-empty here would
  // silently hide every task whenever this instance turns out to use plain
  // ERPNext statuses instead of a custom Task Workflow.
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  // Whether the Task doctype on this instance actually has a Workflow
  // configured (workflow_state query succeeds) vs. falls back to ERPNext's
  // built-in status values (workflow_state gets self-healed away as a 417).
  // Drives which status vocabulary the filter dropdown/badges use.
  const [hasWorkflowState, setHasWorkflowState] = useState(true);
  const didInitStatusFilter = useRef(false);
  const [company, setCompany] = useState(() => getActiveCompany() || "");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  /* ─── Bulkselectie (alleen tabelweergave) ─── */
  const [selection, setSelection] = useState<SelectionState>(emptySelection);
  const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE);
  // Status- en prioriteitswaarden komen uit de doctype-meta van déze instance,
  // niet uit een lijst in deze broncode — zie lib/task-bulk.ts.
  const [bulkOptions, setBulkOptions] = useState({
    status: FALLBACK_STATUS_OPTIONS,
    priority: FALLBACK_PRIORITY_OPTIONS,
  });
  useEffect(() => { fetchTaskSelectOptions().then(setBulkOptions); }, []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link support: `?t=<taskId>` auto-opens that task. Fetches the doc
  // directly if not present in the loaded list (e.g. wrong filter active).
  const urlTaskId = searchParams.get("t");
  useEffect(() => {
    if (!urlTaskId) return;
    if (selectedTask?.name === urlTaskId) return;
    const local = tasks.find((tk) => tk.name === urlTaskId);
    if (local) { setSelectedTask(local); return; }
    fetchDocument<Task>("Task", urlTaskId).then(setSelectedTask).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTaskId, tasks]);

  // Helper for the modal close handler to also strip ?t= from the URL.
  const closeSelectedTask = useCallback(() => {
    setSelectedTask(null);
    setCreateMode(false);
    if (searchParams.get("t")) {
      const next = new URLSearchParams(searchParams);
      next.delete("t");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [myTasksOnly, setMyTasksOnly] = useState(IS_MINI);

  // Build email → employee name map
  const emailToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      if (emp.user_id) map.set(emp.user_id.toLowerCase(), emp.employee_name);
      if (emp.company_email) map.set(emp.company_email.toLowerCase(), emp.employee_name);
    }
    return map;
  }, [employees]);

  // Build project ID → project name map
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of storeProjects) {
      if (p.name && p.project_name) map.set(p.name, p.project_name);
    }
    return map;
  }, [storeProjects]);

  function getDisplayName(email: string): string {
    if (email === t("tasks.unassigned")) return email;
    return emailToName.get(email.toLowerCase()) || email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      const BASE_FIELDS = [
        "name", "subject", "status", "priority",
        "_assign as assigned_to", "project", "exp_end_date",
        "description", "company",
      ];
      // Try with workflow_state first. Frappe only exposes that field when
      // the Task doctype has a Workflow configured; on instances without
      // one, lib/erpnext.ts's field self-heal silently drops workflow_state
      // from the query and retries — it does NOT throw, so every row comes
      // back with workflow_state simply absent, not a 417. (The ApiError
      // catch below is kept as a defensive fallback in case that field ever
      // surfaces as a hard error instead of self-healing.) Either way,
      // synthesize workflow_state from `status` so filtering/grouping never
      // silently loses every task (the WorkflowChanger dropdown naturally
      // degrades to empty because workflowActions has no entries for
      // ERPNext's built-in statuses).
      const fetchTasks = async (): Promise<{ rows: Task[]; hasWorkflow: boolean }> => {
        try {
          const raw = await fetchAll<Task>("Task", [...BASE_FIELDS, "workflow_state"], filters, "modified desc");
          const hasWorkflow = raw.some((r) => r.workflow_state);
          return { rows: raw.map((r) => ({ ...r, workflow_state: r.workflow_state || r.status })), hasWorkflow };
        } catch (err) {
          if (err instanceof ApiError && err.status === 417) {
            const rows = await fetchAll<Omit<Task, "workflow_state">>("Task", BASE_FIELDS, filters, "modified desc");
            return { rows: rows.map((r) => ({ ...r, workflow_state: r.status })), hasWorkflow: false };
          }
          throw err;
        }
      };
      const [{ rows: list, hasWorkflow }, empList] = await Promise.all([
        fetchTasks(),
        fetchList<Employee>("Employee", {
          fields: ["name", "employee_name", "company_email", "user_id"],
          filters: [["status", "=", "Active"]],
          limit_page_length: 200,
        }),
      ]);
      setTasks(list);
      setEmployees(empList);
      setHasWorkflowState(hasWorkflow);
      // Taken die intussen verdwenen zijn (verwijderd, of door iemand anders
      // gewijzigd) mogen niet als onzichtbare passagier in de selectie blijven.
      setSelection((prev) => pruneSelection(prev, list.map((r) => r.name)));
      if (!didInitStatusFilter.current) {
        didInitStatusFilter.current = true;
        setStatusFilter(hasWorkflow ? WORKFLOW_DEFAULT_FILTER : PLAIN_DEFAULT_FILTER);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [company]);

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // Get current user's email for "Mijn taken" filter. Standaard Frappe RPC
  // (frappe.auth.get_logged_user) i.p.v. de verdwenen Express-route
  // /api/auth/me — zelfde patroon als lib/session.ts.
  const [erpnextUsername, setErpnextUsername] = useState<string>("");
  const [erpnextFullName, setErpnextFullName] = useState<string>("");
  useEffect(() => {
    fetch("/api/method/frappe.auth.get_logged_user", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(async (d) => {
        const username = d?.message;
        if (!username || username === "Guest") return;
        setErpnextUsername(username);
        try {
          const userRes = await fetch(`/api/resource/User/${encodeURIComponent(username)}`, {
            credentials: "same-origin",
          });
          if (userRes.ok) {
            const userBody = await userRes.json();
            if (userBody?.data?.full_name) setErpnextFullName(userBody.data.full_name);
          }
        } catch {
          // full_name is a nice-to-have; username-only matching still works
        }
      })
      .catch(() => {});
  }, []);

  const myEmail = useMemo(() => {
    // Priority 1: default employee setting → resolve to email
    const empId = getActiveEmployee();
    if (empId) {
      const emp = employees.find(e => e.name === empId);
      if (emp) return emp.user_id || emp.company_email || "";
    }
    // Priority 2: match ERPNext logged-in user against Employee.user_id
    if (erpnextUsername) {
      const emp = employees.find(e => e.user_id?.toLowerCase() === erpnextUsername.toLowerCase());
      if (emp) return emp.user_id || emp.company_email || erpnextUsername;
    }
    // Priority 3: match by fullName (ERPNext User name often differs from Employee email)
    if (erpnextFullName) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const fullNameNorm = normalize(erpnextFullName);
      const emp = employees.find(e => normalize(e.employee_name) === fullNameNorm);
      if (emp) return emp.user_id || emp.company_email || "";
    }
    // Priority 4: just the ERPNext username
    if (erpnextUsername) return erpnextUsername;
    // Priority 5: legacy session user
    return localStorage.getItem("y_session_user") || "";
  }, [employees, erpnextUsername, erpnextFullName]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (myTasksOnly && myEmail) {
      result = result.filter((t) => {
        const assignees = parseAssignees(t.assigned_to);
        return assignees.some(a => a.toLowerCase() === myEmail.toLowerCase());
      });
    }
    if (statusFilter.length > 0) result = result.filter((t) => statusFilter.includes(t.workflow_state));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.project?.toLowerCase().includes(q) ||
          projectNameMap.get(t.project)?.toLowerCase().includes(q) ||
          t.assigned_to?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      if (!a.exp_end_date && !b.exp_end_date) return 0;
      if (!a.exp_end_date) return 1;
      if (!b.exp_end_date) return -1;
      return a.exp_end_date.localeCompare(b.exp_end_date);
    });
    return result;
  }, [tasks, search, statusFilter, projectNameMap, myTasksOnly, myEmail]);

  /* ─── Afgeleide selectie-toestand ─── */

  // Het rendervenster wordt bewust NIET teruggezet bij een filterwijziging: wie
  // het venster heeft opengeklapt houdt dat, en `slice` knijpt vanzelf mee als
  // het filter minder oplevert. Terugzetten zou een net uitgeklapte lijst laten
  // dichtklappen zodra je in het zoekveld typt.
  const visibleTasks = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const visibleIds = useMemo(() => visibleTasks.map((task) => task.name), [visibleTasks]);

  // Bewust afgeleid uit `filtered` en niet uit de Set zelf: een taak die door
  // een statuswijziging buiten het actieve filter valt, mag niet stiekem in de
  // volgende bulkactie meeliften.
  const selectedIds = useMemo(
    () => filtered.filter((task) => selection.selected.has(task.name)).map((task) => task.name),
    [filtered, selection],
  );

  const assigneesByTask = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const task of tasks) map.set(task.name, parseAssignees(task.assigned_to));
    return map;
  }, [tasks]);

  const handleBulkFinished = useCallback(async (result: BulkResult) => {
    // callMethod (assign_to.*) raakt de lijstcache niet aan — updateDocument en
    // deleteDocument doen dat wel. Eén keer expliciet wissen dekt beide paden.
    invalidateCache("Task");
    await loadData();
    // Geslaagde taken vallen uit de selectie; mislukte blijven staan zodat je
    // ze meteen opnieuw kunt proberen zonder ze terug te zoeken.
    setSelection((prev) => {
      const next = new Set(prev.selected);
      for (const id of result.succeeded) next.delete(id);
      return { selected: next, anchor: null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const kanbanData = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filtered) {
      const assignees = parseAssignees(task.assigned_to);
      if (assignees.length === 0) {
        const key = t("tasks.unassigned");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      } else {
        for (const email of assignees) {
          if (!map.has(email)) map.set(email, []);
          map.get(email)!.push(task);
        }
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === t("tasks.unassigned")) return 1;
      if (b[0] === t("tasks.unassigned")) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);



  async function reassignTask(taskName: string, fromEmail: string, toEmail: string) {
    if (fromEmail === toEmail) return;

    // Optimistic: update assigned_to in local state
    setTasks(prev => prev.map(task => {
      if (task.name !== taskName) return task;
      const assignees = parseAssignees(task.assigned_to);
      const newAssignees = assignees.filter(a => a !== fromEmail);
      if (toEmail !== t("tasks.unassigned")) newAssignees.push(toEmail);
      return { ...task, assigned_to: JSON.stringify(newAssignees) };
    }));

    try {
      if (fromEmail && fromEmail !== t("tasks.unassigned")) {
        await callMethod("frappe.desk.form.assign_to.remove", {
          doctype: "Task",
          name: taskName,
          assign_to: fromEmail,
        });
      }
      if (toEmail && toEmail !== t("tasks.unassigned")) {
        await callMethod("frappe.desk.form.assign_to.add", {
          doctype: "Task",
          name: taskName,
          assign_to: [toEmail],
        });
      }
    } catch (e) {
      loadData(); // Revert on failure
      setError(e instanceof Error ? e.message : t("tasks.assign_error"));
    }
  }

  async function changeWorkflowState(taskName: string, action: string, nextState: string) {
    // Optimistic update
    setTasks(prev => prev.map(t => t.name === taskName ? { ...t, workflow_state: nextState } : t));

    try {
      await callMethod("frappe.model.workflow.apply_workflow", {
        doc: { doctype: "Task", name: taskName },
        action,
      });

      // If completing a task, try to create a draft Delivery Note from the project's Sales Order
      if (nextState === "Completed") {
        const task = tasks.find((t) => t.name === taskName);
        if (task?.project) {
          try {
            await createDeliveryNoteFromProject(task.project, taskName);
          } catch (e) {
            console.warn("Delivery Note aanmaken overgeslagen:", e);
          }
        }
      }
    } catch (e) {
      loadData();
      setError(e instanceof Error ? e.message : t("tasks.workflow_error"));
    }
  }

  /** Try to create a draft Delivery Note from the project's linked Sales Order */
  async function createDeliveryNoteFromProject(projectName: string, _taskName: string) {
    // Find Sales Orders linked to this project
    const salesOrders = await fetchList<{ name: string; customer: string; company: string }>("Sales Order", {
      fields: ["name", "customer", "company"],
      filters: [["project", "=", projectName], ["docstatus", "=", 1]],
      limit_page_length: 1,
    });
    if (salesOrders.length === 0) return; // No sales order linked

    const so = salesOrders[0];
    // Fetch SO items
    const soDoc = await fetchDocument<{
      items: { item_code: string; item_name: string; qty: number; rate: number; uom: string; warehouse: string }[];
    }>("Sales Order", so.name);
    if (!soDoc.items?.length) return;

    // Create draft Delivery Note
    const dn = await createDocument<{ name: string }>("Delivery Note", {
      customer: so.customer,
      company: so.company,
      project: projectName,
      items: soDoc.items.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty,
        rate: item.rate,
        uom: item.uom,
        warehouse: item.warehouse,
        against_sales_order: so.name,
      })),
    });

    setError(null);
    const url = `${getErpNextLinkUrl()}/delivery-note/${dn.name}`;
    // Show success with link
    alert(t("tasks.delivery_note_created", { name: dn.name, url }));
    window.open(url, "_blank");
  }

  async function changeAssignee(taskName: string, oldEmails: string[], newEmail: string) {
    // Optimistic: remove old emails, add new one (preserving other assignees)
    setTasks(prev => prev.map(t => {
      if (t.name !== taskName) return t;
      const current = parseAssignees(t.assigned_to);
      const remaining = current.filter(e => !oldEmails.includes(e));
      if (newEmail) remaining.push(newEmail);
      return { ...t, assigned_to: JSON.stringify(remaining) };
    }));

    try {
      // Remove old assignments
      for (const email of oldEmails) {
        await callMethod("frappe.desk.form.assign_to.remove", {
          doctype: "Task",
          name: taskName,
          assign_to: email,
        });
      }
      // Add new assignment
      if (newEmail) {
        await callMethod("frappe.desk.form.assign_to.add", {
          doctype: "Task",
          name: taskName,
          assign_to: [newEmail],
        });
      }
    } catch (e) {
      loadData();
      setError(e instanceof Error ? e.message : t("tasks.assign_error"));
    }
  }

  return (
    <div className="p-3 sm:p-6 min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("nav.tasks")}</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setView("kanban")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm cursor-pointer ${view === "kanban" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <LayoutGrid size={16} /> {t("tasks.view_kanban")}
            </button>
            <button onClick={() => setView("table")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm cursor-pointer ${view === "table" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <List size={16} /> {t("tasks.view_table")}
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedTask({ name: "", subject: "", status: "Open", priority: "Medium", assigned_to: "", project: "", exp_end_date: "", description: "", company: getActiveCompany() || "", workflow_state: "Open" } as Task);
              setCreateMode(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer"
          >
            <Plus size={16} />
            {t("common.new")}
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CheckSquare className="text-emerald-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("nav.tasks")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : filtered.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <User className="text-y-teal" size={20} />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("nav.employees")}</p>
            <p className="text-2xl font-bold text-slate-800">
              {loading ? "..." : kanbanData.filter(([k]) => k !== t("tasks.unassigned")).length}
            </p>
          </div>
        </div>

        <Filter size={16} className="text-slate-400" />

        <button
          onClick={() => setMyTasksOnly(p => !p)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
            myTasksOnly
              ? "bg-y-teal text-white border-y-teal"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <User size={14} />
            {t("tasks.my_tasks")}
          </span>
        </button>

        <CompanySelect value={company} onChange={setCompany} />

        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen((o) => !o)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal flex items-center gap-2 cursor-pointer"
          >
            {statusFilter.length === 0
              ? t("common.all_statuses")
              : t("tasks.n_statuses", { n: statusFilter.length, sen: statusFilter.length > 1 ? "sen" : "" })}
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                {(hasWorkflowState ? WORKFLOW_STATUS_OPTIONS : PLAIN_STATUS_OPTIONS).map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
                    />
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${workflowColors[s] ?? "bg-slate-100 text-slate-600"}`}>
                      {s}
                    </span>
                  </label>
                ))}
                {statusFilter.length > 0 && (
                  <button
                    onClick={() => { setStatusFilter([]); setStatusDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-slate-600 border-t border-slate-100 cursor-pointer"
                  >
                    {t("common.clear_filters")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={t("tasks.search_placeholder")}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanView data={kanbanData} loading={loading} onReassign={reassignTask} getDisplayName={getDisplayName} onSelectTask={setSelectedTask} projectNameMap={projectNameMap} />
      ) : (
        <>
          {/* Altijd gemount: de balk verbergt zichzelf als er niets te tonen
              is, en houdt zo het rapport zichtbaar nadat een geslaagde bulk de
              selectie heeft leeggemaakt. */}
          <TaskBulkBar
            selectedIds={selectedIds}
            filteredCount={filtered.length}
            canSelectAllFiltered={
              allVisibleSelected(selection, visibleIds) && selectedIds.length < filtered.length
            }
            onSelectAllFiltered={() => setSelection(selectAll(filtered.map((task) => task.name)))}
            onClearSelection={() => setSelection(emptySelection())}
            assigneesByTask={assigneesByTask}
            statusOptions={bulkOptions.status}
            priorityOptions={bulkOptions.priority}
            projects={storeProjects}
            employees={employees}
            onFinished={handleBulkFinished}
          />
          <TableView
            tasks={visibleTasks}
            totalCount={filtered.length}
            onShowMore={() => setVisibleCount((c) => c + TABLE_PAGE_SIZE)}
            loading={loading}
            getDisplayName={getDisplayName}
            onSelectTask={setSelectedTask}
            selection={selection}
            allSelected={allVisibleSelected(selection, visibleIds)}
            someSelected={someVisibleSelected(selection, visibleIds)}
            onToggleAll={() => setSelection((prev) => toggleAllVisible(prev, visibleIds))}
            onRowSelect={(name, mods) =>
              setSelection((prev) => applyRowClick(prev, name, visibleIds, mods))
            }
          />
        </>
      )}

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          mode={createMode ? "create" : "edit"}
          onClose={closeSelectedTask}
          onCreate={() => { loadData(); setCreateMode(false); setSelectedTask(null); }}
          getDisplayName={getDisplayName}
          projectName={projectNameMap.get(selectedTask.project) || ""}
          projects={storeProjects}
          employees={employees}
          onWorkflowChange={(name, action, nextState) => {
            changeWorkflowState(name, action, nextState);
            setSelectedTask((prev) => prev && prev.name === name ? { ...prev, workflow_state: nextState } : prev);
          }}
          onAssigneeChange={(name, oldEmails, newEmail) => {
            changeAssignee(name, oldEmails, newEmail);
            // Update selected task's assignee list: remove old, add new
            setSelectedTask((prev) => {
              if (!prev || prev.name !== name) return prev;
              const current = parseAssignees(prev.assigned_to);
              const remaining = current.filter((e) => !oldEmails.includes(e));
              if (newEmail) remaining.push(newEmail);
              return { ...prev, assigned_to: JSON.stringify(remaining) };
            });
          }}
          onDescriptionChange={(name, newHtml) => {
            setSelectedTask((prev) =>
              prev && prev.name === name ? { ...prev, description: newHtml } : prev
            );
          }}
          onFieldUpdate={(name, field, value) => {
            setSelectedTask((prev) =>
              prev && prev.name === name ? { ...prev, [field]: value } : prev
            );
            setTasks((prev) =>
              prev.map((t) => (t.name === name ? { ...t, [field]: value } : t))
            );
          }}
        />
      )}
    </div>
  );
}

/* ─── Rich Text Toolbar ─── */

function RichTextToolbar({ editorRef, onDirty }: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onDirty: () => void;
}) {
  const { t } = useTranslation();

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onDirty();
  }, [editorRef, onDirty]);

  const insertLink = useCallback(() => {
    const url = prompt(t("tasks.description.link_prompt"), "https://");
    if (url) exec("createLink", url);
  }, [exec, t]);

  const insertChecklist = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      editorRef.current?.focus();
    }
    const checkHtml = '<ul><li data-list="unchecked">&nbsp;</li></ul>';
    document.execCommand("insertHTML", false, checkHtml);
    onDirty();
  }, [editorRef, onDirty]);

  const insertTable = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
      editorRef.current?.focus();
    }
    const tableHtml =
      '<table><thead><tr><th>&nbsp;</th><th>&nbsp;</th><th>&nbsp;</th></tr></thead>' +
      '<tbody><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>' +
      '<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p>&nbsp;</p>';
    document.execCommand("insertHTML", false, tableHtml);
    onDirty();
  }, [editorRef, onDirty]);

  const btnClass =
    "p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700" +
    " cursor-pointer transition-colors";
  const sepClass = "w-px h-5 bg-slate-200 mx-0.5";

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 bg-white border border-slate-200 border-b-0 rounded-t-xl flex-wrap"
      onMouseDown={(e) => e.preventDefault()}
    >
      <button type="button" className={btnClass} onClick={() => exec("bold")}
        title={t("tasks.description.bold")}><Bold size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("italic")}
        title={t("tasks.description.italic")}><Italic size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("underline")}
        title={t("tasks.description.underline")}><Underline size={15} /></button>

      <div className={sepClass} />

      <button type="button" className={btnClass} onClick={() => exec("formatBlock", "h1")}
        title={t("tasks.description.heading1")}><Heading1 size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("formatBlock", "h2")}
        title={t("tasks.description.heading2")}><Heading2 size={15} /></button>

      <div className={sepClass} />

      <button type="button" className={btnClass} onClick={() => exec("insertUnorderedList")}
        title={t("tasks.description.bullet_list")}><List size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("insertOrderedList")}
        title={t("tasks.description.numbered_list")}><ListOrdered size={15} /></button>
      <button type="button" className={btnClass} onClick={insertChecklist}
        title={t("tasks.description.checklist")}><ListChecks size={15} /></button>

      <div className={sepClass} />

      <button type="button" className={btnClass} onClick={insertLink}
        title={t("tasks.description.link")}><Link size={15} /></button>
      <button type="button" className={btnClass} onClick={insertTable}
        title={t("tasks.description.table")}><Table size={15} /></button>

      <div className={sepClass} />

      <button type="button" className={btnClass} onClick={() => exec("undo")}
        title={t("tasks.description.undo")}><Undo size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("redo")}
        title={t("tasks.description.redo")}><Redo size={15} /></button>
      <button type="button" className={btnClass} onClick={() => exec("removeFormat")}
        title={t("tasks.description.remove_format")}><RemoveFormatting size={15} /></button>
    </div>
  );
}

/* ─── Task Description with interactive checkboxes + rich text editing ─── */

function TaskDescription({ html, taskName, onDescriptionUpdate }: {
  html: string;
  taskName: string;
  onDescriptionUpdate?: (newHtml: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);

  function handleClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const li = target.closest("li[data-list]") as HTMLElement | null;
    if (!li) return;

    const current = li.getAttribute("data-list");
    if (current !== "checked" && current !== "unchecked") return;

    // Only toggle when clicking the checkbox area (::before pseudo-element, ~24px from left edge of li)
    const liRect = li.getBoundingClientRect();
    if (e.clientX - liRect.left > 28) return; // clicked on text, not checkbox

    const newState = current === "checked" ? "unchecked" : "checked";
    li.setAttribute("data-list", newState);
    setDirty(true);

    // Auto-save checkbox toggles immediately
    if (ref.current) {
      const updatedHtml = ref.current.innerHTML;
      updateDocument("Task", taskName, { description: updatedHtml }).catch(() => {
        li.setAttribute("data-list", current);
      });
      onDescriptionUpdate?.(updatedHtml);
    }
  }

  async function handleSave() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const updatedHtml = ref.current.innerHTML;
      await updateDocument("Task", taskName, { description: updatedHtml });
      onDescriptionUpdate?.(updatedHtml);
      setDirty(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  const descriptionStyles = `
    max-w-none text-sm text-slate-700 bg-slate-50 rounded-b-xl p-4
    border border-slate-200 outline-none min-h-[200px]
    [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1
    [&_b]:font-bold [&_strong]:font-bold [&_u]:underline [&_em]:italic
    [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1
    [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-1 [&_a]:text-y-teal [&_a]:underline
    [&_table]:border-collapse [&_table]:w-full [&_table]:my-2
    [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1
    [&_th]:border [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-100 [&_th]:font-semibold
    [&_li[data-list=checked]]:before:content-['☑'] [&_li[data-list=checked]]:before:mr-2 [&_li[data-list=checked]]:before:cursor-pointer
    [&_li[data-list=unchecked]]:before:content-['☐'] [&_li[data-list=unchecked]]:before:mr-2 [&_li[data-list=unchecked]]:before:cursor-pointer
    [&_li[data-list=checked]]:list-none [&_li[data-list=unchecked]]:list-none
    [&_li[data-list=checked]]:line-through [&_li[data-list=checked]]:text-slate-400
    [&_.ql-ui]:hidden focus:ring-2 focus:ring-y-teal focus:border-y-teal
  `;

  return (
    <div>
      <RichTextToolbar editorRef={ref} onDirty={markDirty} />
      <div
        ref={ref}
        className={descriptionStyles}
        contentEditable
        suppressContentEditableWarning
        onClick={handleClick}
        onInput={() => setDirty(true)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {dirty && (
        <div className="flex justify-end mt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 bg-y-teal text-white rounded-lg text-xs font-medium hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            {saving ? t("tasks.description.saving") : t("tasks.description.save")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Task Detail Panel ─── */

export function TaskDetail({
  task,
  mode = "edit",
  onClose,
  onCreate,
  getDisplayName,
  projectName,
  projects,
  employees,
  onWorkflowChange,
  onAssigneeChange,
  onDescriptionChange,
  onFieldUpdate,
}: {
  task: Task;
  mode?: "edit" | "create";
  onClose: () => void;
  onCreate?: (task: Task) => void;
  getDisplayName: (email: string) => string;
  projectName: string;
  projects?: ProjectRecord[];
  employees: Employee[];
  onWorkflowChange?: (taskName: string, action: string, nextState: string) => void;
  onAssigneeChange?: (taskName: string, oldEmails: string[], newEmail: string) => void;
  onDescriptionChange?: (taskName: string, newHtml: string) => void;
  onFieldUpdate?: (taskName: string, field: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const isCreate = mode === "create";
  const assignees = parseAssignees(task.assigned_to);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);

  // Create mode local state
  const [createSubject, setCreateSubject] = useState("");
  const [createProject, setCreateProject] = useState("");
  const [createPriority, setCreatePriority] = useState("Medium");
  const [createWorkflow, setCreateWorkflow] = useState("Open");
  const [createDeadline, setCreateDeadline] = useState("");
  const [createAssignees, setCreateAssignees] = useState<string[]>([]);
  const [createBillingType, setCreateBillingType] = useState("Timesheet based");
  const [creating, setCreating] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const [, setDescDirty] = useState(false);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const q = projectSearch.toLowerCase();
    // Toon ook Completed-projecten (taken kunnen nog aangemaakt worden op een
    // afgerond project); alleen Cancelled valt af.
    const active = projects.filter(p => p.status !== "Cancelled");
    if (!q) return active;
    return active.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.project_name.toLowerCase().includes(q)
    );
  }, [projects, projectSearch]);

  const selectedProjectName = useMemo(() => {
    if (!createProject || !projects) return "";
    const p = projects.find(p => p.name === createProject);
    return p ? p.project_name : createProject;
  }, [createProject, projects]);

  async function handleCreate() {
    setCreating(true);
    try {
      const docData: Record<string, unknown> = {
        subject: createSubject,
        project: createProject || undefined,
        description: descriptionRef.current?.innerHTML || undefined,
        priority: createPriority,
        company: getActiveCompany() || undefined,
        exp_end_date: createDeadline || undefined,
        custom_billing_type: createBillingType || undefined,
      };
      const doc = await createDocument<Task>("Task", docData);

      // Apply workflow if not default "Open"
      if (createWorkflow && createWorkflow !== "Open") {
        const transition = workflowActions["Open"]?.find(tr => tr.next === createWorkflow);
        if (transition) {
          await callMethod("frappe.model.workflow.apply_workflow", {
            doc: { doctype: "Task", name: doc.name, workflow_state: "Open" },
            action: transition.action,
          });
        }
      }

      // Assign if specified
      for (const email of createAssignees) {
        await callMethod("frappe.desk.form.assign_to.add", {
          doctype: "Task",
          name: doc.name,
          assign_to: [email],
        });
      }

      onCreate?.(doc);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("tasks.create_error"));
    } finally {
      setCreating(false);
    }
  }

  const descriptionStyles = `
    max-w-none text-sm text-slate-700 bg-slate-50 rounded-b-xl p-4
    border border-slate-200 outline-none min-h-[200px]
    [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1
    [&_b]:font-bold [&_strong]:font-bold [&_u]:underline [&_em]:italic
    [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-1
    [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-1 [&_a]:text-y-teal [&_a]:underline
    [&_table]:border-collapse [&_table]:w-full [&_table]:my-2
    [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1
    [&_th]:border [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-100 [&_th]:font-semibold
    [&_li[data-list=checked]]:before:content-['☑'] [&_li[data-list=checked]]:before:mr-2 [&_li[data-list=checked]]:before:cursor-pointer
    [&_li[data-list=unchecked]]:before:content-['☐'] [&_li[data-list=unchecked]]:before:mr-2 [&_li[data-list=unchecked]]:before:cursor-pointer
    [&_li[data-list=checked]]:list-none [&_li[data-list=unchecked]]:list-none
    [&_li[data-list=checked]]:line-through [&_li[data-list=checked]]:text-slate-400
    focus:ring-2 focus:ring-y-teal focus:border-y-teal
  `;

  // Build fields array based on mode
  const fields: { label: string; icon: typeof Briefcase; value: React.ReactNode }[] = isCreate ? [
    {
      label: t("tasks.detail.workflow"),
      icon: Flag,
      value: (
        <select
          value={createWorkflow}
          onChange={(e) => setCreateWorkflow(e.target.value)}
          className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {Object.keys(workflowColors).map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      ),
    },
    {
      label: t("tasks.detail.priority"),
      icon: Flag,
      value: (
        <select
          value={createPriority}
          onChange={(e) => setCreatePriority(e.target.value)}
          className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {["Urgent", "High", "Medium", "Low"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      ),
    },
    {
      label: t("tasks.detail.billing_type", { defaultValue: "Facturatie" }),
      icon: Receipt,
      value: (
        <select
          value={createBillingType}
          onChange={(e) => setCreateBillingType(e.target.value)}
          className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {["Timesheet based", "Fixed Price", "Milestone based", "Progress based"].map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      ),
    },
    {
      label: "Project",
      icon: Briefcase,
      value: (
        <div className="relative">
          {createProject ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">{selectedProjectName}</span>
              <button
                onClick={() => { setCreateProject(""); setProjectSearch(""); }}
                className="text-slate-400 hover:text-red-500 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => { setProjectSearch(e.target.value); setProjectDropdownOpen(true); }}
                onFocus={() => setProjectDropdownOpen(true)}
                placeholder={t("tasks.create.project_search")}
                className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
              {projectDropdownOpen && filteredProjects.length > 0 && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setProjectDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 min-w-[280px] max-w-[90vw] max-h-48 overflow-y-auto">
                    {filteredProjects.slice(0, 20).map((p) => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setCreateProject(p.name);
                          setProjectSearch("");
                          setProjectDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm cursor-pointer text-slate-700"
                      >
                        <span className="font-mono text-xs text-slate-400">{p.name}</span>
                        <span className="ml-2">{p.project_name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      label: t("tasks.detail.assigned_to"),
      icon: User,
      value: (
        <div>
          <div className="flex flex-wrap gap-1 mb-1">
            {createAssignees.map((email) => (
              <div key={email} className="flex items-center gap-1.5 bg-slate-50 rounded-full px-2 py-0.5 group/a">
                <div className={`w-5 h-5 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[9px] font-bold`}>
                  {getInitials(email)}
                </div>
                <span className="text-xs text-slate-700">{getDisplayName(email)}</span>
                <button onClick={() => setCreateAssignees(prev => prev.filter(e => e !== email))}
                  className="text-slate-400 hover:text-red-500 cursor-pointer opacity-0 group-hover/a:opacity-100"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setAssignDropdownOpen(!assignDropdownOpen); }}
              className="text-xs text-y-teal hover:underline cursor-pointer">
              {t("tasks.create.assign", { defaultValue: "Toewijzen" })}
            </button>
            {assignDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setAssignDropdownOpen(false); }} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 min-w-[220px] max-w-[90vw] max-h-60 overflow-y-auto">
                  {employees.map((emp) => {
                    const email = emp.user_id || emp.company_email;
                    if (!email) return null;
                    const selected = createAssignees.includes(email);
                    return (
                      <button key={emp.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateAssignees(prev => selected ? prev.filter(e => e !== email) : [...prev, email]);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm cursor-pointer flex items-center gap-2 ${selected ? "bg-y-teal/5 text-y-teal-dark" : "text-slate-700"}`}>
                        <div className={`w-5 h-5 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[9px] font-bold`}>
                          {selected ? "✓" : getInitials(email)}
                        </div>
                        {emp.employee_name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      label: t("tasks.detail.deadline"),
      icon: Calendar,
      value: (
        <input
          type="date"
          value={createDeadline}
          onChange={(e) => setCreateDeadline(e.target.value)}
          className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal"
        />
      ),
    },
    {
      label: t("tasks.detail.company"),
      icon: Briefcase,
      value: <span className="text-sm text-slate-700">{getActiveCompany() || "-"}</span>,
    },
  ] : [
    {
      label: t("tasks.detail.workflow"),
      icon: Flag,
      value: (
        <WorkflowChanger
          currentState={task.workflow_state}
          onWorkflowChange={(action, nextState) => onWorkflowChange?.(task.name, action, nextState)}
        />
      ),
    },
    {
      label: t("tasks.detail.priority"),
      icon: Flag,
      value: isCreate ? null : (
        <select
          value={task.priority || "Medium"}
          onChange={async (e) => {
            const newPriority = e.target.value;
            try {
              await updateDocument("Task", task.name, { priority: newPriority });
              onFieldUpdate?.(task.name, "priority", newPriority);
            } catch { /* silent */ }
          }}
          className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer"
        >
          {["Urgent", "High", "Medium", "Low"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      ),
    },
    {
      label: "Project",
      icon: Briefcase,
      value: task.project ? (
        <a
          href={`${getErpNextLinkUrl()}/project/${task.project}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-y-teal hover:underline flex items-center gap-1"
        >
          {projectName || task.project}
          <ExternalLink size={12} className="opacity-50" />
        </a>
      ) : (
        <span className="text-sm text-slate-400">-</span>
      ),
    },
    {
      label: t("tasks.detail.assigned_to"),
      icon: User,
      value: (
        <div>
          <div className="flex flex-wrap gap-2 mb-1">
            {assignees.length > 0 ? assignees.map((email) => (
              <div key={email} className="flex items-center gap-2 bg-slate-50 rounded-full px-2 py-1 group/assignee">
                <div className={`w-6 h-6 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[10px] font-bold`}>
                  {getInitials(email)}
                </div>
                <span className="text-sm text-slate-700">{getDisplayName(email)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssigneeChange?.(task.name, [email], "");
                  }}
                  className="text-slate-400 hover:text-red-500 cursor-pointer opacity-0 group-hover/assignee:opacity-100 transition-opacity"
                  title={t("tasks.remove_assignment")}
                >
                  <X size={14} />
                </button>
              </div>
            )) : (
              <span className="text-sm text-slate-400">{t("tasks.unassigned")}</span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setAssignDropdownOpen(!assignDropdownOpen); }}
              className="text-xs text-y-teal hover:underline cursor-pointer"
            >
              {t("tasks.change_assignment")}
            </button>
            {assignDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setAssignDropdownOpen(false); }} />
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 min-w-[220px] max-w-[90vw] max-h-60 overflow-y-auto">
                  {employees.map((emp) => {
                    const email = emp.user_id || emp.company_email;
                    if (!email) return null;
                    const isAssigned = assignees.includes(email);
                    return (
                      <button
                        key={emp.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAssigned) {
                            // Remove this assignee only
                            onAssigneeChange?.(task.name, [email], "");
                          } else {
                            // Add this assignee without removing existing ones
                            onAssigneeChange?.(task.name, [], email);
                          }
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm cursor-pointer flex items-center gap-2 ${
                          isAssigned ? "bg-y-teal/5 text-y-teal-dark" : "text-slate-700"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[9px] font-bold`}>
                          {isAssigned ? "✓" : getInitials(email)}
                        </div>
                        {emp.employee_name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      label: t("tasks.detail.deadline"),
      icon: Calendar,
      value: isCreate ? null : (
        <input
          type="date"
          value={task.exp_end_date || ""}
          onChange={async (e) => {
            const newDate = e.target.value;
            const oldDate = task.exp_end_date || "";
            onFieldUpdate?.(task.name, "exp_end_date", newDate);
            try {
              await updateDocument("Task", task.name, { exp_end_date: newDate || null });
            } catch {
              onFieldUpdate?.(task.name, "exp_end_date", oldDate);
            }
          }}
          className={`px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-y-teal cursor-pointer ${
            task.exp_end_date && isOverdue(task.exp_end_date) ? "text-red-500 font-semibold" : "text-slate-700"
          }`}
        />
      ),
    },
    {
      label: t("tasks.detail.company"),
      icon: Briefcase,
      value: <span className="text-sm text-slate-700">{task.company || "-"}</span>,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end pt-[env(safe-area-inset-top,0px)]">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            {isCreate ? (
              <>
                <p className="text-xs text-slate-400 font-mono mb-1">{t("tasks.create.title")}</p>
                <input
                  type="text"
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && createSubject.trim() && !creating) {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder={t("tasks.create.subject_placeholder")}
                  className="w-full text-lg font-bold text-slate-800 bg-transparent border-b border-slate-200 focus:border-y-teal focus:outline-none pb-1"
                  autoFocus
                />
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 font-mono">{task.name}</p>
                <h3 className="text-lg font-bold text-slate-800 truncate">{task.subject}</h3>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isCreate && (
              <a
                href={`${getErpNextLinkUrl()}/task/${task.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-y-teal"
                title={t("common.open_in_erpnext")}
              >
                <ExternalLink size={18} />
              </a>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Properties */}
          <div className="space-y-4">
            {fields.map(({ label, icon: Icon, value }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-32 flex-shrink-0 flex items-center gap-2 pt-1">
                  <Icon size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-500">{label}</span>
                </div>
                <div className="flex-1">{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {isCreate ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">{t("tasks.detail.description")}</span>
              </div>
              <RichTextToolbar editorRef={descriptionRef} onDirty={() => setDescDirty(true)} />
              <div
                ref={descriptionRef}
                className={descriptionStyles}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setDescDirty(true)}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">{t("tasks.detail.description")}</span>
              </div>
              <TaskDescription
                html={task.description || ""}
                taskName={task.name}
                onDescriptionUpdate={(newHtml) => {
                  onDescriptionChange?.(task.name, newHtml);
                }}
              />
            </div>
          )}

          {/* Create button */}
          {isCreate && (
            <button
              onClick={handleCreate}
              disabled={!createSubject.trim() || creating}
              className="w-full mt-4 px-4 py-2.5 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 text-sm font-medium cursor-pointer"
            >
              {creating ? t("tasks.create.creating") : t("tasks.create.submit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- KANBAN with Drag & Drop ----



function WorkflowChanger({ currentState, onWorkflowChange }: {
  currentState: string;
  onWorkflowChange: (action: string, nextState: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const transitions = workflowActions[currentState] || [];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { position, dropdownRef } = useDropdownPosition(triggerRef, { isOpen: open, preferAbove: true });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer ${workflowColors[currentState] ?? "bg-slate-100 text-slate-600"}`}
      >
        {currentState || "-"}
      </button>
      {open && transitions.length > 0 && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div ref={dropdownRef} className={`absolute left-0 ${position === "above" ? "bottom-full mb-1" : "top-full mt-1"} bg-white border border-slate-200 rounded-lg shadow-lg z-40 py-1 min-w-[200px] max-w-[90vw]`}>
            {transitions.map(({ action, next }) => (
              <button
                key={action}
                onClick={(e) => { e.stopPropagation(); onWorkflowChange(action, next); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm flex items-center gap-2 cursor-pointer"
              >
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${workflowColors[next] ?? "bg-slate-100 text-slate-600"}`}>
                  {next}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function KanbanView({
  data, loading, onReassign, getDisplayName, onSelectTask, projectNameMap,
}: {
  data: [string, Task[]][];
  loading: boolean;
  onReassign: (taskName: string, from: string, to: string) => void;
  getDisplayName: (email: string) => string;
  onSelectTask: (task: Task) => void;
  projectNameMap: Map<string, string>;
}) {
  const { t } = useTranslation();
  const [dragData, setDragData] = useState<{ taskName: string; fromColumn: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>;
  if (data.length === 0) return <div className="flex items-center justify-center py-16 text-slate-400">{t("dashboard.no_open_tasks")}</div>;

  function handleDragStart(e: DragEvent, taskName: string, fromColumn: string) {
    e.dataTransfer.effectAllowed = "move";
    setDragData({ taskName, fromColumn });
  }

  function handleDragOver(e: DragEvent, column: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(column);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: DragEvent, toColumn: string) {
    e.preventDefault();
    setDropTarget(null);
    if (dragData && dragData.fromColumn !== toColumn) {
      onReassign(dragData.taskName, dragData.fromColumn, toColumn);
    }
    setDragData(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {data.map(([assignee, tasks]) => (
        <div
          key={assignee}
          className={`flex-shrink-0 w-80 rounded-xl border transition-colors ${
            dropTarget === assignee
              ? "bg-y-teal/10 border-y-teal"
              : "bg-slate-50 border-slate-200"
          }`}
          onDragOver={(e) => handleDragOver(e, assignee)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, assignee)}
        >
          <div className="p-3 border-b border-slate-200 flex items-center gap-3">
            {assignee === t("tasks.unassigned") ? (
              <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-white text-xs font-bold">?</div>
            ) : (
              <div className={`w-8 h-8 rounded-full ${getAvatarColor(assignee)} flex items-center justify-center text-white text-xs font-bold`}>
                {getInitials(assignee)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">
                {getDisplayName(assignee)}
              </p>
              <p className="text-xs text-slate-400">{t("dashboard.n_tasks", { n: tasks.length })}</p>
            </div>
          </div>
          <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
            {tasks.map((task) => (
              <div
                key={`${assignee}-${task.name}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.name, assignee)}
                onClick={() => onSelectTask(task)}
                className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <GripVertical size={14} className="text-slate-300" />
                    <p className="text-xs font-mono text-slate-400">{task.name}</p>
                  </div>
                  {task.priority && (
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${priorityDot[task.priority] ?? "bg-slate-300"}`} title={task.priority} />
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 mb-2 line-clamp-2">{task.subject}</p>
                {task.project && (
                  <p className="text-xs text-y-teal mb-2 truncate" title={task.project}>
                    <span className="font-mono">{task.project}</span>
                    {projectNameMap.get(task.project) && (
                      <span className="text-slate-500 font-sans"> · {projectNameMap.get(task.project)}</span>
                    )}
                  </p>
                )}
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1">
                    {task.workflow_state && (
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full ${workflowColors[task.workflow_state] ?? "bg-slate-100 text-slate-600"}`}>
                        {task.workflow_state}
                      </span>
                    )}
                  </div>
                  {task.exp_end_date && (
                    <span className={`text-xs ${isOverdue(task.exp_end_date) ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                      {task.exp_end_date}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- TABLE VIEW ----


/**
 * Tabelweergave met selectievakjes voor bulkbewerking.
 *
 * Het vinkje en de rij doen bewust iets anders: op de rij klikken opent de
 * taak (zoals altijd), op het vinkje klikken selecteert. Daarom stopt de
 * vinkje-cel het event — anders zou elke selectie ook het detailpaneel
 * openklappen.
 */
function TableView({
  tasks, totalCount, onShowMore, loading, getDisplayName, onSelectTask,
  selection, allSelected, someSelected, onToggleAll, onRowSelect,
}: {
  tasks: Task[];
  totalCount: number;
  onShowMore: () => void;
  loading: boolean;
  getDisplayName: (email: string) => string;
  onSelectTask: (task: Task) => void;
  selection: SelectionState;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onRowSelect: (name: string, mods: { shift?: boolean; ctrl?: boolean; meta?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLInputElement>(null);
  // `indeterminate` bestaat alleen als DOM-property, niet als attribuut — React
  // kan hem dus niet declaratief zetten.
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const hidden = totalCount - tasks.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="w-10 px-3 py-3">
              <input
                ref={headerRef}
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label={t("tasks.bulk.select_visible")}
                title={t("tasks.bulk.select_visible")}
                className="rounded border-slate-300 text-y-teal focus:ring-y-teal cursor-pointer"
              />
            </th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("hours_widget.task")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.table.subject")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.detail.assigned_to")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.detail.project")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.detail.priority")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.detail.workflow")}</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">{t("tasks.detail.deadline")}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("common.loading")}</td></tr>
          ) : tasks.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">{t("dashboard.no_open_tasks")}</td></tr>
          ) : tasks.map((task) => {
            const assignees = parseAssignees(task.assigned_to);
            const isSelected = selection.selected.has(task.name);
            return (
              <tr
                key={task.name}
                onClick={() => onSelectTask(task)}
                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                  isSelected ? "bg-y-teal/10 hover:bg-y-teal/15" : "hover:bg-y-teal/5"
                }`}
              >
                <td
                  className="w-10 px-3 py-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowSelect(task.name, { shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    tabIndex={-1}
                    className="rounded border-slate-300 text-y-teal focus:ring-y-teal cursor-pointer pointer-events-none"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-y-teal">{task.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{task.subject}</td>
                <td className="px-4 py-3">
                  <div className="flex -space-x-1">
                    {assignees.length === 0 ? (
                      <span className="text-sm text-slate-400">-</span>
                    ) : assignees.map((email) => (
                      <div key={email}
                        className={`w-6 h-6 rounded-full ${getAvatarColor(email)} flex items-center justify-center text-white text-[10px] font-bold border-2 border-white`}
                        title={getDisplayName(email)}>
                        {getInitials(email)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{task.project || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${priorityColors[task.priority] ?? "bg-slate-100 text-slate-600"}`}>
                    {task.priority || "-"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${workflowColors[task.workflow_state] ?? "bg-slate-100 text-slate-600"}`}>
                    {task.workflow_state || "-"}
                  </span>
                </td>
                <td className={`px-4 py-3 text-sm ${isOverdue(task.exp_end_date) ? "text-red-500 font-semibold" : "text-slate-500"}`}>
                  {task.exp_end_date || "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!loading && hidden > 0 && (
        <button
          onClick={onShowMore}
          className="w-full px-4 py-3 text-sm text-y-teal hover:bg-slate-50 border-t border-slate-100 cursor-pointer"
        >
          {t("tasks.bulk.show_more", { shown: tasks.length, total: totalCount })}
        </button>
      )}
    </div>
  );
}
