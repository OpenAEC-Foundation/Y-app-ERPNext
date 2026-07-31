import { useEffect, useState, useMemo, useRef } from "react";
import { fetchList, fetchAll, fetchDocument, createDocument, updateDocument, getErpNextLinkUrl } from "../lib/erpnext";
import { useEmployees, useProjects } from "../lib/DataContext";
import { getActiveInstance, getActiveCompany, getActiveEmployee } from "../lib/instances";
import { useSessionEmployeeId } from "../lib/useSessionEmployee";
import { fetchActivityTypes, fetchEmployeeActivityType } from "../lib/activityTypes";
import { TimesheetDetailsTable } from "../pages/Timesheets";
import type { TimesheetDetail as TSDetail, ProjectInfo } from "../lib/timesheetValidation";
import {
  Clock, Send, ChevronDown, AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface TimesheetDetail {
  name: string;
  parent: string;
  activity_type: string;
  hours: number;
  project: string;
  task: string;
  task_name?: string;
  from_time: string;
  to_time: string;
  description: string;
  billable?: number;
}

interface UrenBoekenWidgetProps {
  showWeekTable?: boolean;
  layout?: "stacked" | "side-by-side";
  onHeaderClick?: () => void;
}

/* ─── Helpers ─── */

function localDateStr(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getWeekMonday(d: string): string {
  const dt = new Date(d + "T12:00:00"); // noon to avoid timezone edge
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return localDateStr(dt);
}

function getWeekSaturday(d: string): string {
  const mon = new Date(getWeekMonday(d) + "T12:00:00");
  mon.setDate(mon.getDate() + 5); // Saturday, not Sunday
  return localDateStr(mon);
}

/* ─── Component ─── */

export default function UrenBoekenWidget({
  showWeekTable = false,
  layout = "stacked",
  onHeaderClick,
}: UrenBoekenWidgetProps) {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const projects = useProjects();
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [employee, setEmployee] = useState(() => getActiveEmployee());

  // Fall back to the ERPNext session user when no "default employee" is
  // configured in Settings (getActiveEmployee() then returns "") — without
  // this the "Uren boeken" widget silently starts with an empty MDW-select
  // and "0 uur"/"Geen details gevonden" for any user who never set a
  // default employee, even though their session usually maps to one.
  const resolvedSessionEmployee = useSessionEmployeeId(allEmployees);
  useEffect(() => {
    if (!employee && resolvedSessionEmployee) setEmployee(resolvedSessionEmployee);
  }, [employee, resolvedSessionEmployee]);
  const [project, setProject] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [task, setTask] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskOpen, setTaskOpen] = useState(false);
  const [tasks, setTasks] = useState<{ name: string; subject: string }[]>([]);
  const [activityType, setActivityType] = useState("Execution");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromTime, setFromTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [toTime, setToTime] = useState("17:00");
  const [duurInput, setDuurInput] = useState("");
  const [inputMode, setInputMode] = useState<"tijd" | "duur">("tijd");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const projectRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<HTMLDivElement>(null);

  // Week data
  const [weekEntries, setWeekEntries] = useState<TSDetail[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekTimesheet, setWeekTimesheet] = useState<string | null>(null);

  // View mode (hide activity type + billable for employees)
  const [isEmployee, setIsEmployee] = useState(() => localStorage.getItem("view_mode") === "employee");
  useEffect(() => {
    const sync = () => setIsEmployee(localStorage.getItem("view_mode") === "employee");
    window.addEventListener("y-app:viewmode-changed", sync);
    return () => window.removeEventListener("y-app:viewmode-changed", sync);
  }, []);

  // Collapsible for stacked layout
  const [expanded, setExpanded] = useState(false);

  // Calculate hours from time range (integer minute math to avoid floating-point errors)
  const hours = useMemo(() => {
    if (!fromTime || !toTime) return 0;
    const [fh, fm] = fromTime.split(":").map(Number);
    const [th, tm] = toTime.split(":").map(Number);
    const totalMinutes = (th * 60 + tm) - (fh * 60 + fm);
    return Math.max(0, Math.round(totalMinutes * 100 / 60) / 100);
  }, [fromTime, toTime]);

  function handleDuurChange(val: string) {
    setDuurInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0 && fromTime) {
      const [fh, fm] = fromTime.split(":").map(Number);
      const totalMin = (fh * 60 + fm) + Math.round(parsed * 60);
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      setToTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  function handleToTimeChange(val: string) {
    setToTime(val);
    setDuurInput("");
    setInputMode("tijd");
  }

  // Active employees
  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.status === "Active"),
    [allEmployees]
  );

  // Selected employee's company
  const selectedEmployeeCompany = useMemo(() => {
    const emp = allEmployees.find((e) => e.name === employee);
    return emp?.company || "";
  }, [allEmployees, employee]);

  // Selected employee's default activity type
  const selectedEmployeeDefaultActivity = useMemo(() => {
    const emp = allEmployees.find((e) => e.name === employee);
    return emp?.default_activity_type || undefined;
  }, [allEmployees, employee]);

  // Sorted projects: Open first, then 0000-projects, employee's company, rest.
  // Closed (Completed/Hold) projects appear at the bottom so naboeken op een
  // afgerond project kan, zonder dat ze de actieve lijst vervuilen.
  // Cancelled blijft uitgesloten.
  const sortedActiveProjects = useMemo(() => {
    const visible = projects.filter((p) => p.status !== "Cancelled");
    return visible.sort((a, b) => {
      const aOpen = a.status === "Open";
      const bOpen = b.status === "Open";
      if (aOpen !== bOpen) return aOpen ? -1 : 1;

      const aIs0000 = a.name.startsWith("0000");
      const bIs0000 = b.name.startsWith("0000");
      if (aIs0000 && !bIs0000) return -1;
      if (!aIs0000 && bIs0000) return 1;

      const aIsEmpCompany = a.company === selectedEmployeeCompany;
      const bIsEmpCompany = b.company === selectedEmployeeCompany;
      if (aIsEmpCompany && !bIsEmpCompany) return -1;
      if (!aIsEmpCompany && bIsEmpCompany) return 1;

      return 0;
    });
  }, [projects, selectedEmployeeCompany]);

  // Searchable projects
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return sortedActiveProjects.slice(0, 50);
    const q = projectSearch.toLowerCase();
    return sortedActiveProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.project_name?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [sortedActiveProjects, projectSearch]);

  // Auto-toggle billable based on project type (0000 = internal = not billable)
  useEffect(() => {
    if (project) {
      setBillable(!project.startsWith("0000"));
    }
  }, [project]);

  // Check if selected project is from a different company
  const projectCompanyWarning = useMemo(() => {
    if (!project || !selectedEmployeeCompany) return null;
    const proj = projects.find((p) => p.name === project);
    if (proj && proj.company && proj.company !== selectedEmployeeCompany) {
      return t("hours_widget.company_warning", { projectCompany: proj.company, employeeCompany: selectedEmployeeCompany });
    }
    return null;
  }, [project, projects, selectedEmployeeCompany]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    if (!taskSearch.trim()) return tasks;
    const q = taskSearch.toLowerCase();
    return tasks.filter(
      (t) => t.name.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q)
    );
  }, [tasks, taskSearch]);

  // Project info for TimesheetDetailsTable
  const projectInfos: ProjectInfo[] = useMemo(
    () => projects.map((p) => ({ name: p.name, company: p.company, project_name: p.project_name })),
    [projects]
  );

  // Week total
  const weekTotal = useMemo(
    () => weekEntries.reduce((s, d) => s + d.hours, 0),
    [weekEntries]
  );

  // Load activity types via shared utility (B09: employer config or default)
  useEffect(() => {
    const viewMode = isEmployee ? "employee" : "employer";
    fetchActivityTypes(viewMode)
      .then((names) => {
        setActivityTypes(names);
        if (!names.includes(activityType) && names.length > 0) {
          setActivityType(names[0]);
        }
      })
      .catch(() => {
        setActivityTypes(["Execution"]);
        setActivityType("Execution");
      });
  }, [isEmployee]);

  // Update activity type when employee changes
  // For employees: fetch employer-configured per-employee activity type
  // For employers: use saved local default or employee's ERPNext default
  useEffect(() => {
    if (!employee) return;
    if (isEmployee) {
      // Employee mode: fetch the employer-configured activity type for this employee
      fetchEmployeeActivityType(employee).then((type) => {
        if (activityTypes.length === 0 || activityTypes.includes(type)) {
          setActivityType(type);
        }
      });
    } else {
      // Employer mode: use saved local default or employee's ERPNext default
      const instanceId = getActiveInstance().id;
      const savedDefault = localStorage.getItem(`pref_${instanceId}_default_activity_type_${employee}`);
      if (savedDefault && activityTypes.includes(savedDefault)) {
        setActivityType(savedDefault);
      } else if (selectedEmployeeDefaultActivity && activityTypes.includes(selectedEmployeeDefaultActivity)) {
        setActivityType(selectedEmployeeDefaultActivity);
      }
    }
  }, [employee, isEmployee, selectedEmployeeDefaultActivity, activityTypes]);

  // Save activity type default when user changes it
  useEffect(() => {
    if (employee && activityType) {
      const instanceId = getActiveInstance().id;
      localStorage.setItem(`pref_${instanceId}_default_activity_type_${employee}`, activityType);
    }
  }, [activityType, employee]);

  // Load tasks when project changes
  useEffect(() => {
    if (!project) { setTasks([]); setTask(""); return; }
    fetchAll<{ name: string; subject: string }>(
      "Task",
      ["name", "subject"],
      [["project", "=", project], ["status", "not in", ["Cancelled"]]],
      "modified desc",
    ).then(setTasks).catch(() => setTasks([]));
  }, [project]);

  // Find existing week timesheet
  useEffect(() => {
    if (!employee || !date) { setWeekTimesheet(null); return; }
    const monday = getWeekMonday(date);
    const saturday = getWeekSaturday(date);
    fetchList<{ name: string }>("Timesheet", {
      fields: ["name"],
      filters: [
        ["employee", "=", employee],
        ["start_date", ">=", monday],
        ["start_date", "<=", saturday],
        ["docstatus", "=", 0],
      ],
      limit_page_length: 1,
      order_by: "modified desc",
    }).then((list) => {
      setWeekTimesheet(list.length > 0 ? list[0].name : null);
    }).catch(() => setWeekTimesheet(null));
  }, [employee, date]);

  // Load week entries (parallel fetch for speed)
  useEffect(() => {
    if (!employee || !date) { setWeekEntries([]); return; }
    const monday = getWeekMonday(date);
    const saturday = getWeekSaturday(date);
    const delay = 0;
    const timer = setTimeout(() => {
      setLoadingWeek(true);
      fetchList<{ name: string }>("Timesheet", {
        fields: ["name"],
        filters: [
          ["employee", "=", employee],
          ["start_date", ">=", monday],
          ["start_date", "<=", saturday],
          ["docstatus", "!=", 2],
        ],
        limit_page_length: 20,
        order_by: "start_date asc",
      }).then(async (timesheets) => {
        if (timesheets.length === 0) { setWeekEntries([]); setLoadingWeek(false); return; }
        const docs = await Promise.all(
          timesheets.map(ts =>
            fetchDocument<{ name: string; time_logs: TimesheetDetail[]; docstatus?: number }>("Timesheet", ts.name)
              .then(doc => ({ tsName: ts.name, doc }))
              .catch(() => null)
          )
        );
        const allDetails: TSDetail[] = [];
        for (const result of docs) {
          if (!result?.doc.time_logs) continue;
          for (const log of result.doc.time_logs) {
            allDetails.push({
              name: log.name,
              parent: result.tsName,
              activity_type: log.activity_type || "",
              hours: log.hours || 0,
              project: log.project || "",
              from_time: log.from_time || "",
              task: log.task || "",
              task_name: (log as any).custom_subject || log.task_name,
              description: log.description,
              billable: (log as any).is_billable,
              // docstatus=1 (submitted) timesheets reject time_logs edits from
              // the REST API — the filter above only excludes docstatus=2
              // (cancelled) so this week's list can still include a submitted
              // sheet. TimesheetDetailsTable uses this to disable edit/delete
              // on those rows instead of letting the update fail silently.
              parent_docstatus: result.doc.docstatus,
            });
          }
        }
        // Filter out empty rows and weekend days with no hours
        const filtered = allDetails.filter(d => {
          if (!d.from_time || !d.hours) return false; // skip empty rows
          const day = new Date(d.from_time).getDay();
          const isWeekend = day === 0 || day === 6;
          return !isWeekend || d.hours > 0;
        });
        filtered.sort((a, b) => (b.from_time || "").localeCompare(a.from_time || ""));
        setWeekEntries(filtered);
      }).catch(() => setWeekEntries([]))
        .finally(() => setLoadingWeek(false));
    }, delay);
    return () => clearTimeout(timer);
  }, [employee, date, refreshKey]);

  // Update a timesheet detail (task, description, billable, or times)
  async function handleUpdateDetail(detail: TSDetail, field: "task" | "description" | "billable" | "from_time" | "to_time", value: string) {
    // Fetch the full timesheet document
    const doc = await fetchDocument<{ name: string; time_logs: TimesheetDetail[] }>("Timesheet", detail.parent);
    if (!doc.time_logs) return;
    // Map frontend field name to ERPNext field name
    const erpField = field === "billable" ? "is_billable" : field;
    // Find and update the specific time_log row
    const updatedLogs = doc.time_logs.map((log) => {
      if (log.name === detail.name) {
        const val = field === "billable" ? parseInt(value) : value;
        const updated = { ...log, [erpField]: val };
        // Recalculate hours when time changes
        if (field === "from_time" || field === "to_time") {
          const from = new Date(field === "from_time" ? value : log.from_time);
          const to = new Date(field === "to_time" ? value : log.to_time);
          if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
            updated.hours = Math.max(0, (to.getTime() - from.getTime()) / 3600000);
          }
        }
        return updated;
      }
      return log;
    });
    // Save back
    await updateDocument("Timesheet", detail.parent, { time_logs: updatedLogs });
    // Update local state
    if (field === "from_time") {
      setWeekEntries(prev => prev.map(e => {
        if (e.name !== detail.name) return e;
        const from = new Date(value);
        const to = new Date(e.from_time.split(" ")[0] + " " + (doc.time_logs.find(l => l.name === e.name)?.to_time?.split(" ")[1] || "17:00:00"));
        const hours = Math.max(0, (to.getTime() - from.getTime()) / 3600000);
        return { ...e, from_time: value, hours };
      }));
    } else {
      const localVal = field === "billable" ? parseInt(value) : value;
      setWeekEntries(prev => prev.map(e =>
        e.name === detail.name ? { ...e, [field]: localVal, ...(field === "task" ? { task_name: undefined } : {}) } : e
      ));
    }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) setProjectOpen(false);
      if (taskRef.current && !taskRef.current.contains(e.target as Node)) setTaskOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || hours <= 0 || !activityType) return;

    // Warn if hours seem unrealistic (possible AM/PM confusion on 12h locale systems)
    if (hours > 10 && inputMode === "tijd") {
      const confirmed = window.confirm(
        t("hours_widget.confirm_long_booking", {
          defaultValue: `Je staat op het punt ${hours} uur te boeken (${fromTime} - ${toTime}). Klopt dit? Op sommige systemen kan AM/PM verwarring optreden.`,
          hours,
          from: fromTime,
          to: toTime,
        })
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    setFormError("");
    setSuccess("");
    try {
      const company = getActiveCompany() || undefined;
      const newTimeLog = {
        activity_type: activityType,
        from_time: `${date} ${fromTime}:00`,
        to_time: `${date} ${toTime}:00`,
        hours,
        project: project || undefined,
        task: task || undefined,
        description: description || undefined,
        is_billable: billable ? 1 : 0,
      };

      let tsName: string;

      if (weekTimesheet) {
        const existing = await fetchDocument<{ name: string; time_logs: Record<string, unknown>[] }>("Timesheet", weekTimesheet);
        const existingLogs = (existing.time_logs || [])
          .filter((log) => log.from_time && log.hours) // skip empty rows
          .map((log) => ({
          name: log.name,
          doctype: "Timesheet Detail",
          parent: weekTimesheet,
          parenttype: "Timesheet",
          parentfield: "time_logs",
          activity_type: log.activity_type,
          from_time: log.from_time,
          to_time: log.to_time,
          hours: log.hours,
          project: log.project,
          task: log.task,
          description: log.description,
          is_billable: log.is_billable,
        }));
        await updateDocument("Timesheet", weekTimesheet, {
          time_logs: [...existingLogs, newTimeLog],
        });
        tsName = weekTimesheet;
      } else {
        const doc = await createDocument<{ name: string }>("Timesheet", {
          employee,
          company,
          time_logs: [newTimeLog],
        });
        tsName = doc.name;
      }

      setSuccess(t("hours_widget.success_message", { tsName }));
      // Add new entry to weekEntries locally (no re-fetch needed)
      const newEntry: TSDetail = {
        name: `local-${Date.now()}`,
        parent: tsName,
        activity_type: activityType,
        hours: parseFloat(duurInput) || hours,
        project,
        from_time: `${date} ${fromTime}:00`,
        task,
        task_name: tasks.find(t => t.name === task)?.subject || taskSearch || undefined,
        description,
        billable: billable ? 1 : 0,
        parent_docstatus: 0, // just created/appended to a draft timesheet
      };
      setWeekEntries(prev => [newEntry, ...prev]);
      // Next booking starts where this one ended
      setFromTime(toTime);
      setToTime("");
      setDuurInput("");
      setDescription("");
      setProject("");
      setProjectSearch("");
      setTask("");
      setTaskSearch("");
      setTimeout(() => setSuccess(""), 5000);
      // Trigger server refetch so the widget stays in sync
      setRefreshKey(k => k + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.unknown_error"));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProject = projects.find((p) => p.name === project);
  const selectedTask = tasks.find((t) => t.name === task);

  /* ─── Form Card ─── */
  const formContent = (
    <>

      <form onSubmit={handleSubmit} className="space-y-2 min-w-0">
        {/* Row 1: MDW (130px) | PROJECT (~40%) | TAAK (~40%) */}
        <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr_1fr] gap-2 items-end min-w-0">
          <div className="min-w-0">
            <label className="block h-[18px] leading-[18px] text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("common.employee_short", { defaultValue: "Mdw." })}</label>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} required
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("common.select")}</option>
              {activeEmployees.map((emp) => (
                <option key={emp.name} value={emp.name}>{emp.employee_name}</option>
              ))}
            </select>
          </div>
          <div ref={projectRef} className="relative min-w-0">
            <label className="block h-[18px] leading-[18px] text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("hours_widget.project")}</label>
            {projectCompanyWarning && (
              <div className="flex items-center gap-1 mb-0.5 text-[10px] text-amber-600">
                <AlertTriangle size={10} />
                <span>{projectCompanyWarning}</span>
              </div>
            )}
            <input
              type="text"
              value={projectOpen ? projectSearch : (selectedProject ? `${selectedProject.name} — ${selectedProject.project_name}` : projectSearch)}
              onChange={(e) => { setProjectSearch(e.target.value); setProjectOpen(true); if (!e.target.value) { setProject(""); setTask(""); } }}
              onFocus={() => setProjectOpen(true)}
              placeholder={t("hours_widget.search_project_placeholder")}
              className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal ${
                projectCompanyWarning ? "border-amber-400" : "border-slate-200"
              }`}
            />
            {projectOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                <button type="button" onClick={() => { setProject(""); setTask(""); setProjectSearch(""); setProjectOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm text-slate-400 cursor-pointer">
                  {t("hours_widget.no_project")}
                </button>
                {filteredProjects.map((p) => {
                  const isDiffCompany = selectedEmployeeCompany && p.company && p.company !== selectedEmployeeCompany;
                  const isClosed = p.status !== "Open";
                  const closedLabel = p.status === "Completed"
                    ? t("hours_widget.status_completed", { defaultValue: "afgesloten" })
                    : p.status === "Hold"
                    ? t("hours_widget.status_hold", { defaultValue: "on hold" })
                    : p.status;
                  return (
                    <button key={p.name} type="button"
                      onClick={() => { setProject(p.name); setProjectSearch(""); setProjectOpen(false); setTask(""); }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm cursor-pointer ${project === p.name ? "bg-y-teal/5 text-y-teal-dark" : isClosed ? "text-slate-400" : "text-slate-700"}`}>
                      <span className="font-mono text-xs text-slate-400">{p.name}</span>
                      <span className="ml-1.5">{p.project_name}</span>
                      {isClosed && (
                        <span className="ml-1.5 text-xs text-slate-400">({closedLabel})</span>
                      )}
                      {isDiffCompany && (
                        <span className="ml-1.5 text-xs text-amber-500">({p.company})</span>
                      )}
                    </button>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">{t("common.no_projects_found")}</div>
                )}
              </div>
            )}
          </div>
          {/* TAAK in row 1 */}
          <div ref={taskRef} className="relative min-w-0">
            <label className="block h-[18px] leading-[18px] text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("hours_widget.task")}</label>
            <input
              type="text"
              value={taskOpen ? taskSearch : (selectedTask ? selectedTask.subject : taskSearch)}
              onChange={(e) => { setTaskSearch(e.target.value); setTaskOpen(true); if (!e.target.value) setTask(""); }}
              onFocus={() => setTaskOpen(true)}
              placeholder={t("hours_widget.search_task_placeholder")}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            {taskOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                <button type="button" onClick={() => { setTask(""); setTaskSearch(""); setTaskOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm text-slate-400 cursor-pointer">
                  {t("hours_widget.no_task")}
                </button>
                {filteredTasks.map((t) => (
                  <button key={t.name} type="button"
                    onClick={() => { setTask(t.name); setTaskSearch(""); setTaskOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-50 text-sm cursor-pointer ${task === t.name ? "bg-y-teal/5 text-y-teal-dark" : "text-slate-700"}`}>
                    <span className="truncate">{t.subject || t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: DATUM | STARTTIJD [Nu] | Tot/Duur | EINDTIJD [Nu] | Uren | Omschrijving | Boeken
            Mobile: single column stacks every field full-width; ≥md: original
            dense 7-column layout for desktop efficiency. */}
        <div className="grid grid-cols-1 md:grid-cols-[144px_76px_44px_76px_48px_1fr_auto] gap-2 md:gap-1 md:items-end min-w-0">
          <div className="min-w-0">
            <label className="block h-[18px] leading-[18px] text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("common.date_required")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          {/* STARTTIJD + Nu boven */}
          <div className="min-w-0">
            <div className="flex items-center justify-between h-[18px] leading-[18px]">
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.km_from_required")}</label>
              <button type="button" tabIndex={-1} onClick={() => { const now = new Date(); setFromTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`); }}
                className="h-[16px] px-1 bg-y-teal/10 text-y-teal text-[8px] font-medium rounded cursor-pointer leading-none">{t("component_uren_boeken.now")}</button>
            </div>
            <input type="text" inputMode="numeric" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="HH:MM" value={fromTime}
              onChange={(e) => { let v = e.target.value.replace(/[^\d:]/g, ""); if (v.length === 2 && !v.includes(":")) v += ":"; setFromTime(v); }}
              onBlur={(e) => { const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/); if (m) setFromTime(`${m[1].padStart(2,"0")}:${m[2]}`); }}
              required tabIndex={1} maxLength={5}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          {/* Tot/Duur toggle — groter, onder elkaar */}
          <div className="flex flex-col items-center justify-end gap-0.5 pb-1">
            <button type="button" tabIndex={-1} onClick={() => { setInputMode("tijd"); setDuurInput(""); }}
              className={`text-[10px] font-semibold cursor-pointer leading-tight ${inputMode === "tijd" ? "text-y-teal underline" : "text-slate-400 hover:text-slate-600"}`}>{t("component_uren_boeken.until")}</button>
            <button type="button" tabIndex={-1} onClick={() => setInputMode("duur")}
              className={`text-[10px] font-semibold cursor-pointer leading-tight ${inputMode === "duur" ? "text-y-teal underline" : "text-slate-400 hover:text-slate-600"}`}>{t("component_uren_boeken.duration")}</button>
          </div>
          {/* EINDTIJD + Nu boven */}
          <div className="min-w-0">
            <div className="flex items-center justify-between h-[18px] leading-[18px]">
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                {inputMode === "tijd" ? t("component_uren_boeken.until") : t("component_uren_boeken.duration")}
              </label>
              {inputMode === "tijd" && (
                <button type="button" tabIndex={-1} onClick={() => { const now = new Date(); setToTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`); }}
                  className="h-[16px] px-1 bg-y-teal/10 text-y-teal text-[8px] font-medium rounded cursor-pointer leading-none">{t("component_uren_boeken.now")}</button>
              )}
            </div>
            {inputMode === "tijd" ? (
              <input type="text" inputMode="numeric" pattern="[0-2][0-9]:[0-5][0-9]" placeholder="HH:MM" value={toTime}
                onChange={(e) => { let v = e.target.value.replace(/[^\d:]/g, ""); if (v.length === 2 && !v.includes(":")) v += ":"; handleToTimeChange(v); }}
                onBlur={(e) => { const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/); if (m) setToTime(`${m[1].padStart(2,"0")}:${m[2]}`); }}
                required tabIndex={2} maxLength={5}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal" />
            ) : (
              <input type="number" step="0.25" min="0.25" max="24" value={duurInput} onChange={(e) => handleDuurChange(e.target.value)}
                placeholder="0.25" required tabIndex={2}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
            )}
          </div>
          {/* Berekende uren */}
          <div className="flex items-end justify-center pb-1">
            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{hours > 0 ? `${hours}u` : "\u2014"}</span>
          </div>
          {/* Omschrijving */}
          <div className="min-w-0">
            <label className="block h-[18px] leading-[18px] text-[10px] font-medium text-slate-500 uppercase tracking-wide">{t("hours_widget.description_label", { defaultValue: "Omschrijving" })}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t("hours_widget.description_placeholder")}
              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          {/* Boeken knop */}
          <div className="flex items-end">
            {!isEmployee && (
              <select value={activityType} onChange={(e) => setActivityType(e.target.value)} required style={{ display: "none" }}>
                {activityTypes.map((at) => <option key={at} value={at}>{at}</option>)}
              </select>
            )}
            <button type="submit" disabled={submitting || !employee || hours <= 0 || !activityType}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 text-sm font-medium cursor-pointer whitespace-nowrap">
              <Send size={13} />
              {submitting ? "..." : t("dashboard.km_submit")}
            </button>
          </div>
        </div>

      </form>
    </>
  );

  /* ─── Layout: side-by-side (Timesheets page) — stacks vertically on
         mobile / narrow screens, side-by-side from lg: upwards ─── */
  if (layout === "side-by-side" && showWeekTable) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="w-full lg:w-[750px] lg:flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
            {formContent}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">{t("hours_widget.hours_this_week")}</h3>
              <span className="text-sm font-semibold text-slate-700">
                {weekTotal.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {t("common.hour_unit")}
              </span>
            </div>
            <TimesheetDetailsTable
              details={weekEntries}
              sortAscending={true}
              projects={projectInfos}
              employeeCompany={selectedEmployeeCompany}
              defaultActivityType={selectedEmployeeDefaultActivity}
              loading={loadingWeek}
              defaultGroupBy="dag"
              hideBillable
              onUpdateDetail={handleUpdateDetail}
              onRefresh={() => setRefreshKey(k => k + 1)}
              onDetailsChange={setWeekEntries}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ─── Layout: stacked (Dashboard) ─── */
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      {/* Form (reuse formCard content inline) */}
      <div className="flex items-center flex-wrap gap-2 mb-4">
        <Clock size={18} className="text-y-teal shrink-0" />
        {onHeaderClick ? (
          <button onClick={onHeaderClick} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("hours_widget.title")} &rarr;</button>
        ) : (
          <h3 className="font-semibold text-slate-800">{t("hours_widget.title")}</h3>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-500 min-w-0">
          {weekTimesheet && (
            <a href={`${getErpNextLinkUrl()}/timesheet/${weekTimesheet}`} target="_blank" rel="noopener noreferrer"
              className="text-xs text-y-teal hover:underline font-mono truncate">{weekTimesheet}</a>
          )}
          {weekTotal > 0 && <span className="font-semibold shrink-0">{weekTotal.toFixed(2)}u</span>}
        </div>
      </div>

      {success && <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
      {formError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}

      {formContent}

      {/* Recent bookings inside same card */}
      {employee && weekEntries.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer w-full mb-2"
          >
            <ChevronDown size={12} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
            {expanded ? t("uren_widget.all_bookings_this_week") : t("uren_widget.last_3_bookings")}
          </button>
          <TimesheetDetailsTable
            key={expanded ? "week-all" : "week-last3"}
            details={expanded ? weekEntries : weekEntries.slice(0, 3)}
            sortAscending={expanded}
            projects={projectInfos}
            employeeCompany={selectedEmployeeCompany}
            defaultActivityType={selectedEmployeeDefaultActivity}
            loading={loadingWeek}
            defaultGroupBy={expanded ? "dag" : null}
            hideBillable
            onUpdateDetail={handleUpdateDetail}
            onRefresh={() => setRefreshKey(k => k + 1)}
            onDetailsChange={setWeekEntries}
          />
        </div>
      )}
    </div>
  );
}
