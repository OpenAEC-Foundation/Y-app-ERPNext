import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Search, ChevronDown } from "lucide-react";
import { fetchList, callMethod } from "../../lib/erpnext";
import { useProjects, useEmployees, useDataLoading } from "../../lib/DataContext";
import { TaskDetail } from "../Tasks";
import type { Page } from "../../components/Sidebar";
import { type Task, statusBadge, priorityDot, isOverdue, formatDisplayName } from "./types";
import { getActiveCompany } from "../../lib/instances";

export function TaskList({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t } = useTranslation();
  const storeProjects = useProjects();
  const allEmployees = useEmployees();
  const dataLoading = useDataLoading();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["Open", "Working", "Pending Review", "Overdue"]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of storeProjects) if (p.name && p.project_name) map.set(p.name, p.project_name);
    return map;
  }, [storeProjects]);

  const company = getActiveCompany();

  useEffect(() => {
    if (dataLoading) return; // Wait for DataContext
    setLoading(true);
    const filters: unknown[][] = [];
    if (company) filters.push(["company", "=", company]);
    filters.push(["status", "not in", ["Cancelled", "Template"]]);

    fetchList<Task>("Task", {
      fields: ["name", "subject", "status", "workflow_state", "priority", "_assign as assigned_to", "project", "exp_end_date", "description", "company"],
      filters,
      limit_page_length: 300,
      order_by: "modified desc",
    })
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [company, dataLoading]);

  function toggleStatus(s: string) {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter.length > 0) result = result.filter((t) => statusFilter.includes(t.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.project?.toLowerCase().includes(q) ||
          projectNameMap.get(t.project)?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, search, statusFilter, projectNameMap]);

  const allStatuses = ["Open", "Working", "Pending Review", "Overdue", "Completed", "Cancelled"];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5 flex flex-col" style={{ maxHeight: "350px" }}>
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare size={18} className="text-y-teal" />
        <button onClick={() => onNavigate("tasks")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">Taken bureaubreed &rarr;</button>
        <span className="ml-auto text-sm text-slate-400">{loading ? "..." : `${filtered.length} taken`}</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek taken..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setStatusDropdownOpen((o) => !o)}
            className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal flex items-center gap-1.5 cursor-pointer"
          >
            {statusFilter.length === 0 ? "Alle" : `${statusFilter.length} status`}
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {statusDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                {allStatuses.map((s) => (
                  <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" checked={statusFilter.includes(s)} onChange={() => toggleStatus(s)}
                      className="rounded border-slate-300 text-y-teal focus:ring-y-teal" />
                    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${statusBadge[s] ?? "bg-slate-100 text-slate-600"}`}>
                      {s}
                    </span>
                  </label>
                ))}
                {statusFilter.length > 0 && (
                  <button onClick={() => { setStatusFilter([]); setStatusDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 border-t border-slate-100 cursor-pointer">
                    Wis filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {loading ? (
          <p className="text-center text-slate-400 py-8">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-8">{t("tasks.none_found", { defaultValue: "No tasks found" })}</p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.name}
              onClick={() => setSelectedTask(t)}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 group cursor-pointer"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[t.priority] ?? "bg-slate-300"}`} title={t.priority} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 group-hover:text-y-teal line-clamp-1">{t.subject}</p>
                {t.project && (
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {t.project} {projectNameMap.get(t.project) || ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {t.exp_end_date && (
                  <span className={`text-[10px] ${isOverdue(t.exp_end_date) ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                    {t.exp_end_date}
                  </span>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge[t.workflow_state || t.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {t.workflow_state || t.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedTask && (
        <TaskDetail
          task={selectedTask as any}
          onClose={() => setSelectedTask(null)}
          getDisplayName={formatDisplayName}
          projectName={projectNameMap.get(selectedTask.project || "") || ""}
          employees={allEmployees}
          onAssigneeChange={async (taskName, oldEmails, newEmail) => {
            for (const email of oldEmails) {
              await callMethod("frappe.desk.form.assign_to.remove", { doctype: "Task", name: taskName, assign_to: email }).catch(() => {});
            }
            if (newEmail) {
              await callMethod("frappe.desk.form.assign_to.add", { doctype: "Task", name: taskName, assign_to: [newEmail] }).catch(() => {});
            }
          }}
          onWorkflowChange={async () => {}}
        />
      )}
    </div>
  );
}
