import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchList, callMethod, isDoctypeMissing } from "../lib/erpnext";
import { useEmployees, useLeaves, useProjects } from "../lib/DataContext";
import CompanySelect from "../components/CompanySelect";
import { isHoliday } from "../lib/holidays";
import { CalendarDays, RefreshCw, ChevronLeft, ChevronRight, Filter, ZoomIn, ZoomOut, LayoutGrid, GanttChart, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/index";
import { getActiveCompany } from "../lib/instances";

/** Map i18n language code → Intl locale tag used by toLocaleDateString. */
function currentLocale(): string {
  const lang = (i18n.language || "nl").split("-")[0];
  if (lang === "en") return "en-GB";
  if (lang === "de") return "de-DE";
  return "nl-NL";
}
import { KanbanView, TaskDetail, parseAssignees, type Task as TasksTask, type Employee as TasksEmployee } from "./Tasks";

interface Task {
  name: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string;
  project: string;
  exp_start_date: string;
  exp_end_date: string;
}

// Terminal states shared by both the custom Task Workflow vocabulary and
// ERPNext's built-in Task statuses — used to blacklist "done" tasks out of
// the kanban tab regardless of which vocabulary this instance uses.
const DONE_STATES = ["Completed", "Cancelled"];

const priorityColors: Record<string, string> = {
  Urgent: "bg-red-400",
  High: "bg-orange-400",
  Medium: "bg-y-teal",
  Low: "bg-slate-400",
};

const blockedCellStyle: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(148, 163, 184, 0.3) 4px, rgba(148, 163, 184, 0.3) 8px)",
};


function getWeekDates(offset: number, numWeeks: number = 1): { start: Date; days: Date[] } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const totalDays = numWeeks * 5;
  const days: Date[] = [];
  let current = new Date(monday);
  let added = 0;
  while (added < totalDays) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(current));
      added++;
    }
    current.setDate(current.getDate() + 1);
  }
  return { start: monday, days };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(currentLocale(), { weekday: "short", day: "numeric", month: "short" });
}

/** Compute the visible column span for a task within the week days.
 *  Returns [startCol, endCol] (0-based, inclusive) or null if task is not visible. */
function getTaskSpan(task: Task, dayStrs: string[]): [number, number] | null {
  const start = task.exp_start_date || task.exp_end_date;
  const end = task.exp_end_date || task.exp_start_date;
  if (!start && !end) return null;

  const taskStart = start || dayStrs[0];
  const taskEnd = end || dayStrs[dayStrs.length - 1];

  // Find first visible day where task is active
  let firstCol = -1;
  let lastCol = -1;
  for (let i = 0; i < dayStrs.length; i++) {
    if (dayStrs[i] >= taskStart && dayStrs[i] <= taskEnd) {
      if (firstCol === -1) firstCol = i;
      lastCol = i;
    }
  }

  if (firstCol === -1) return null;
  return [firstCol, lastCol];
}

export default function Planning() {
  const { t } = useTranslation();
  const storeEmployees = useEmployees();
  const allLeaves = useLeaves();
  const storeProjects = useProjects();

  const [tab, setTab] = useState<"gantt" | "kanban">("gantt");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeksToShow, setWeeksToShow] = useState(1);
  const [company, setCompany] = useState(getActiveCompany());
  const [deptFilter, setDeptFilter] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  // Set once we've confirmed Shift Plan Assignment doesn't exist on this
  // instance (no HRMS app installed — see lib/erpnext.ts's missing-doctype
  // cache). The gantt roster itself doesn't query this doctype, but its
  // near-total emptiness on such instances is a direct consequence of it —
  // so surface the same honest notice as Leave.tsx/Wiki.tsx instead of a
  // silently empty grid.
  const [shiftModuleUnavailable, setShiftModuleUnavailable] = useState(false);

  // --- Kanban-specific state ---
  const [kanbanTasks, setKanbanTasks] = useState<TasksTask[]>([]);
  const [kanbanEmployees, setKanbanEmployees] = useState<TasksEmployee[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TasksTask | null>(null);

  const { days } = useMemo(() => getWeekDates(weekOffset, weeksToShow), [weekOffset, weeksToShow]);
  const dayStrs = useMemo(() => days.map(formatDate), [days]);
  const todayStr = formatDate(new Date());

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setWeeksToShow((prev) => {
        if (e.deltaY > 0) return Math.min(prev + 1, 12); // zoom out
        return Math.max(prev - 1, 1); // zoom in
      });
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Filter employees locally from the datastore
  const employees = useMemo(() => {
    let list = storeEmployees.filter((e) => e.status === "Active");
    if (company) list = list.filter((e) => e.company === company);
    return list;
  }, [storeEmployees, company]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const taskList = await fetchList<Task>("Task", {
        fields: [
          "name", "subject", "status", "priority",
          "_assign as assigned_to", "project",
          "exp_start_date", "exp_end_date",
        ],
        filters: [["status", "not in", ["Completed", "Cancelled"]]],
        limit_page_length: 500,
        order_by: "modified desc",
      });
      setTasks(taskList);
      // Cheap existence check, kept independent of the task load above (and
      // of its error handling) — a 403 here (role-gated on some instances,
      // see lib/prefetch.ts) must never block the roster itself. Only a 404
      // "doctype not installed" response is what we care about, and that
      // degrades to [] via fetchList's own missing-doctype handling.
      fetchList("Shift Plan Assignment", { fields: ["name"], limit_page_length: 1 })
        .then(() => setShiftModuleUnavailable(isDoctypeMissing("Shift Plan Assignment")))
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // --- Kanban data loading ---
  const loadKanbanData = useCallback(async () => {
    setKanbanLoading(true);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      const [list, empList] = await Promise.all([
        fetchList<TasksTask>("Task", {
          fields: [
            "name", "subject", "status", "priority",
            "_assign as assigned_to", "project", "exp_end_date",
            "description", "company", "workflow_state",
          ],
          filters,
          limit_page_length: 300,
          order_by: "modified desc",
        }),
        fetchList<TasksEmployee>("Employee", {
          fields: ["name", "employee_name", "company_email", "user_id"],
          filters: [["status", "=", "Active"]],
          limit_page_length: 200,
        }),
      ]);
      // Same field-self-heal fallback as Tasks.tsx: on instances without a
      // Task Workflow, `workflow_state` gets silently dropped by
      // lib/erpnext.ts's 417 self-heal, so every row would otherwise carry
      // workflow_state === undefined and vanish from the active-states
      // filter below.
      setKanbanTasks(list.map((task) => ({ ...task, workflow_state: task.workflow_state || task.status })));
      setKanbanEmployees(empList);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setKanbanLoading(false);
    }
  }, [company, t]);

  // Load kanban data when switching to kanban tab
  useEffect(() => {
    if (tab === "kanban" && kanbanTasks.length === 0) {
      loadKanbanData();
    }
  }, [tab, loadKanbanData, kanbanTasks.length]);

  // Kanban helper: email → employee name
  const emailToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of kanbanEmployees) {
      if (emp.user_id) map.set(emp.user_id.toLowerCase(), emp.employee_name);
      if (emp.company_email) map.set(emp.company_email.toLowerCase(), emp.employee_name);
    }
    return map;
  }, [kanbanEmployees]);

  // Kanban helper: project name map
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

  // Kanban: filter by active (not-yet-done) states. Blacklist rather than
  // whitelist so this works regardless of whether this instance uses the
  // custom Task Workflow vocabulary or plain ERPNext statuses (both use
  // "Completed"/"Cancelled" as their terminal states).
  const kanbanFiltered = useMemo(() => {
    return kanbanTasks.filter((t) => !DONE_STATES.includes(t.workflow_state));
  }, [kanbanTasks]);

  // Kanban: group by assignee
  const kanbanData = useMemo(() => {
    const map = new Map<string, TasksTask[]>();
    for (const task of kanbanFiltered) {
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
  }, [kanbanFiltered, t]);

  // Kanban: reassign task (drag-and-drop)
  async function reassignTask(taskName: string, fromEmail: string, toEmail: string) {
    if (fromEmail === toEmail) return;

    // Optimistic update
    setKanbanTasks(prev => prev.map(task => {
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
      loadKanbanData(); // Revert on failure
      setError(e instanceof Error ? e.message : t("tasks.assign_error"));
    }
  }

  // Kanban: change assignee (from TaskDetail)
  async function changeAssignee(taskName: string, oldEmails: string[], newEmail: string) {
    setKanbanTasks(prev => prev.map(t => {
      if (t.name !== taskName) return t;
      const current = parseAssignees(t.assigned_to);
      const remaining = current.filter(e => !oldEmails.includes(e));
      if (newEmail) remaining.push(newEmail);
      return { ...t, assigned_to: JSON.stringify(remaining) };
    }));

    try {
      for (const email of oldEmails) {
        await callMethod("frappe.desk.form.assign_to.remove", {
          doctype: "Task",
          name: taskName,
          assign_to: email,
        });
      }
      if (newEmail) {
        await callMethod("frappe.desk.form.assign_to.add", {
          doctype: "Task",
          name: taskName,
          assign_to: [newEmail],
        });
      }
    } catch (e) {
      loadKanbanData();
      setError(e instanceof Error ? e.message : t("tasks.assign_error"));
    }
  }

  // Kanban: change workflow state (from TaskDetail)
  async function changeWorkflowState(taskName: string, action: string, nextState: string) {
    setKanbanTasks(prev => prev.map(t => t.name === taskName ? { ...t, workflow_state: nextState } : t));

    try {
      await callMethod("frappe.model.workflow.apply_workflow", {
        doc: { doctype: "Task", name: taskName },
        action,
      });
    } catch (e) {
      loadKanbanData();
      setError(e instanceof Error ? e.message : t("tasks.workflow_error"));
    }
  }

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) if (e.department) set.add(e.department);
    return Array.from(set).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    if (!deptFilter) return employees;
    return employees.filter((e) => e.department === deptFilter);
  }, [employees, deptFilter]);

  // Map assignee identifiers -> tasks
  // Tasks use _assign which contains email addresses, so we index by each assignee string
  const employeeTaskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const assignees = parseAssignees(task.assigned_to);
      for (const assignee of assignees) {
        const key = assignee.toLowerCase().trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    }
    return map;
  }, [tasks]);

  // Helper to find tasks for an employee by checking all identifiers
  function getTasksForEmployee(emp: { name: string; user_id: string; company_email: string }): Task[] {
    const ids = new Set<string>();
    if (emp.name) ids.add(emp.name.toLowerCase().trim());
    if (emp.user_id) ids.add(emp.user_id.toLowerCase().trim());
    if (emp.company_email) ids.add(emp.company_email.toLowerCase().trim());

    const result: Task[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      const found = employeeTaskMap.get(id);
      if (found) {
        for (const t of found) {
          if (!seen.has(t.name)) {
            seen.add(t.name);
            result.push(t);
          }
        }
      }
    }
    return result;
  }

  // Check if a cell should be blocked (holiday or approved leave)
  function getCellBlock(empName: string, empId: string, dayStr: string): string | null {
    // Check holiday
    const year = parseInt(dayStr.substring(0, 4));
    const holidayName = isHoliday(dayStr, year);
    if (holidayName) return holidayName;

    // Check approved leave
    const hasLeave = allLeaves.some(
      (l) =>
        l.status === "Approved" &&
        (l.employee === empId || l.employee_name === empName) &&
        dayStr >= l.from_date &&
        dayStr <= l.to_date
    );
    if (hasLeave) return t("planning.leave");

    return null;
  }

  /** Build the row cells for one employee.
   *  Returns an array of <td> elements that together form the 5 day-columns.
   *  Tasks that span multiple days are rendered as a single <td> with colSpan. */
  function buildRowCells(emp: { name: string; employee_name: string; user_id: string; company_email: string }) {
    const empTasks = getTasksForEmployee(emp);
    const cells: React.ReactNode[] = [];

    // Compute task spans visible in this week
    const taskSpans: { task: Task; startCol: number; endCol: number }[] = [];
    for (const task of empTasks) {
      const span = getTaskSpan(task, dayStrs);
      if (span) {
        taskSpans.push({ task, startCol: span[0], endCol: span[1] });
      }
    }

    // Sort tasks by start column, then by span width (wider first) for stacking
    taskSpans.sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));

    // For each column, track which tasks are present and where they START
    // We use a greedy approach: walk through columns, merging blocked cells
    // and rendering task strips at their start column with proper colSpan.
    const numDays = dayStrs.length;
    let col = 0;
    while (col < numDays) {
      const dayStr = dayStrs[col];
      const isToday = dayStr === todayStr;
      const blockReason = getCellBlock(emp.employee_name, emp.name, dayStr);

      if (blockReason) {
        // Merge consecutive blocked cells of the same reason
        let spanEnd = col;
        while (
          spanEnd + 1 < numDays &&
          getCellBlock(emp.employee_name, emp.name, dayStrs[spanEnd + 1]) !== null
        ) {
          spanEnd++;
        }
        const spanCount = spanEnd - col + 1;

        // Collect all distinct block reasons for the tooltip
        const reasons = new Set<string>();
        for (let c = col; c <= spanEnd; c++) {
          const r = getCellBlock(emp.employee_name, emp.name, dayStrs[c]);
          if (r) reasons.add(r);
        }
        const label = Array.from(reasons).join(" / ");

        // Check if any cell in this blocked span is today
        let spanHasToday = false;
        for (let c = col; c <= spanEnd; c++) {
          if (dayStrs[c] === todayStr) { spanHasToday = true; break; }
        }

        cells.push(
          <td
            key={dayStr}
            colSpan={spanCount}
            className={`px-2 py-2 border-r border-slate-200 align-top ${spanHasToday ? "ring-1 ring-inset ring-y-teal/30" : ""}`}
            style={blockedCellStyle}
          >
            <div className="min-h-[40px] flex items-center justify-center">
              <span className="text-xs text-slate-400 italic">{label}</span>
            </div>
          </td>
        );
        col = spanEnd + 1;
        continue;
      }

      // Not blocked: find all tasks starting at this column
      const tasksStartingHere = taskSpans.filter((ts) => ts.startCol === col);

      if (tasksStartingHere.length === 0) {
        // Empty normal cell
        cells.push(
          <td
            key={dayStr}
            className={`px-2 py-2 border-r border-slate-200 align-top ${isToday ? "bg-y-teal/5" : ""}`}
          >
            <div className="min-h-[40px]" />
          </td>
        );
        col++;
        continue;
      }

      // There are tasks starting at this column.
      // We need to determine if we can use colSpan (all tasks here have the same span, and
      // no tasks start at intermediate columns). The simplest correct approach:
      // find the maximum span among tasks starting here, use that colSpan, and render all
      // tasks starting here inside that cell. Tasks with shorter spans will just be narrower
      // via percentage width.

      // Find the max endCol among tasks starting at this col
      let maxEndCol = col;
      for (const ts of tasksStartingHere) {
        if (ts.endCol > maxEndCol) maxEndCol = ts.endCol;
      }

      // But we cannot span past a blocked cell or past a cell where a different-start task exists
      // Check for blocked cells in the range
      let effectiveEnd = col;
      for (let c = col + 1; c <= maxEndCol; c++) {
        if (getCellBlock(emp.employee_name, emp.name, dayStrs[c])) break;
        effectiveEnd = c;
      }

      // Also check: are there tasks that START at intermediate columns (between col+1 and effectiveEnd)?
      // If so, we need to stop before them so they get their own cell.
      for (let c = col + 1; c <= effectiveEnd; c++) {
        const hasNewStart = taskSpans.some((ts) => ts.startCol === c);
        if (hasNewStart) {
          effectiveEnd = c - 1;
          break;
        }
      }

      const spanCount = effectiveEnd - col + 1;

      // Check if span includes today
      let spanHasToday = false;
      for (let c = col; c <= effectiveEnd; c++) {
        if (dayStrs[c] === todayStr) { spanHasToday = true; break; }
      }

      cells.push(
        <td
          key={dayStr}
          colSpan={spanCount}
          className={`px-2 py-2 border-r border-slate-200 align-top ${spanHasToday ? "bg-y-teal/5" : ""}`}
        >
          <div className="space-y-1 min-h-[40px]">
            {tasksStartingHere.map((ts) => {
              // Calculate the visual width of this task relative to the cell's colSpan
              const taskCols = Math.min(ts.endCol, effectiveEnd) - ts.startCol + 1;
              const widthPercent = (taskCols / spanCount) * 100;

              return (
                <div
                  key={ts.task.name}
                  className={`${priorityColors[ts.task.priority] || "bg-y-teal"} text-white text-xs px-2 py-1 rounded truncate`}
                  style={spanCount > 1 ? { width: `${widthPercent}%`, minWidth: "fit-content" } : undefined}
                  title={`${ts.task.name}: ${ts.task.subject} (${ts.task.project || ""})`}
                >
                  {ts.task.subject || ts.task.name}
                </div>
              );
            })}
          </div>
        </td>
      );
      col = effectiveEnd + 1;
    }

    return cells;
  }

  const isActiveLoading = tab === "gantt" ? loading : kanbanLoading;

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{t("planning.title")}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setTab("gantt")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm cursor-pointer ${tab === "gantt" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <GanttChart size={16} /> {t("planning.tab_gantt")}
            </button>
            <button onClick={() => setTab("kanban")}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm cursor-pointer ${tab === "kanban" ? "bg-y-teal text-white" : "text-slate-500 hover:bg-slate-50"}`}>
              <LayoutGrid size={16} /> {t("tasks.view_kanban")}
            </button>
          </div>
          <button onClick={tab === "gantt" ? loadTasks : loadKanbanData} disabled={isActiveLoading}
            className="flex items-center gap-2 px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <RefreshCw size={16} className={isActiveLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{t("common.refresh")}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {!loading && shiftModuleUnavailable && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-3">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{t("y_next.module_unavailable")}</span>
        </div>
      )}

      {tab === "gantt" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset((w) => w - 1)}
                className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => setWeekOffset(0)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer">
                {t("planning.this_week")}
              </button>
              <button onClick={() => setWeekOffset((w) => w + 1)}
                className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <ChevronRight size={18} />
              </button>
            </div>

            <span className="text-sm font-medium text-slate-600">
              {days[0].toLocaleDateString(currentLocale(), { day: "numeric", month: "long" })} - {days[days.length - 1].toLocaleDateString(currentLocale(), { day: "numeric", month: "long", year: "numeric" })}
            </span>

            <div className="flex items-center gap-1">
              <button onClick={() => setWeeksToShow((w) => Math.max(1, w - 1))} disabled={weeksToShow <= 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer" title={t("planning.zoom_in")}>
                <ZoomIn size={16} />
              </button>
              <span className="text-xs text-slate-500 w-16 text-center">{weeksToShow} {weeksToShow === 1 ? t("liquidity.week_count") : t("liquidity.weeks_count")}</span>
              <button onClick={() => setWeeksToShow((w) => Math.min(12, w + 1))} disabled={weeksToShow >= 12}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 cursor-pointer" title={t("planning.zoom_out")}>
                <ZoomOut size={16} />
              </button>
            </div>

            <Filter size={16} className="text-slate-400" />
            <CompanySelect value={company} onChange={setCompany} />
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("planning.all_departments")}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>
          ) : (
            <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto">
              <table className="w-full border-collapse table-fixed" style={{ minWidth: `${128 + days.length * 96}px` }}>
                <colgroup>
                  <col className="w-32 sm:w-52" />
                  {days.map((d) => (
                    <col key={formatDate(d)} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-sm font-semibold text-slate-600 border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-10">
                      {t("planning.employee")}
                    </th>
                    {days.map((d, i) => {
                      const isToday = formatDate(d) === todayStr;
                      const isMonday = d.getDay() === 1 && i > 0;
                      return (
                        <th key={formatDate(d)}
                          className={`text-center px-1.5 py-3 font-semibold border-b border-r border-slate-200 ${
                            isToday ? "bg-y-teal/10 text-y-teal-dark" : "text-slate-600"
                          } ${isMonday ? "border-l-2 border-l-slate-300" : ""} ${weeksToShow > 2 ? "text-[11px]" : "text-sm"}`}>
                          {weeksToShow > 4
                            ? d.toLocaleDateString(currentLocale(), { day: "numeric", month: "numeric" })
                            : formatDay(d)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={days.length + 1} className="px-4 py-8 text-center text-slate-400">
                        {t("planning.no_employees")}
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <tr key={emp.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3 border-r border-slate-200 sticky left-0 bg-white z-10">
                          <div className="flex items-center gap-3">
                            <CalendarDays size={16} className="text-slate-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-800">{emp.employee_name}</p>
                              <p className="text-xs text-slate-400">{emp.designation || emp.department || ""}</p>
                            </div>
                          </div>
                        </td>
                        {buildRowCells(emp)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "kanban" && (
        <>
          <KanbanView
            data={kanbanData}
            loading={kanbanLoading}
            onReassign={reassignTask}
            getDisplayName={getDisplayName}
            onSelectTask={setSelectedTask}
            projectNameMap={projectNameMap}
          />

          {selectedTask && (
            <TaskDetail
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              getDisplayName={getDisplayName}
              projectName={projectNameMap.get(selectedTask.project) || ""}
              employees={kanbanEmployees}
              onWorkflowChange={(name, action, nextState) => {
                changeWorkflowState(name, action, nextState);
                setSelectedTask((prev) => prev && prev.name === name ? { ...prev, workflow_state: nextState } : prev);
              }}
              onAssigneeChange={(name, oldEmails, newEmail) => {
                changeAssignee(name, oldEmails, newEmail);
                setSelectedTask((prev) => {
                  if (!prev || prev.name !== name) return prev;
                  const current = parseAssignees(prev.assigned_to);
                  const remaining = current.filter((e) => !oldEmails.includes(e));
                  if (newEmail) remaining.push(newEmail);
                  return { ...prev, assigned_to: JSON.stringify(remaining) };
                });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
