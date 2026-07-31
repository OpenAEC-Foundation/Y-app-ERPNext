import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchList, createDocument, callMethod, getErpNextLinkUrl } from "../lib/erpnext";
import { useProjects, useEmployees } from "../lib/DataContext";
import {
  ListTree, Search, Plus, Check, ChevronRight, ChevronDown,
  ExternalLink, RefreshCw, Trash2, MessageSquare, UserPlus, Send, X,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface Task {
  name: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  project: string;
  parent_task: string;
  _assign: string;
  exp_end_date: string;
  company: string;
  is_group: number;
}

interface Comment {
  name: string;
  comment_type: string;
  content: string;
  comment_by: string;
  creation: string;
}

interface TreeNode {
  task: Task;
  children: TreeNode[];
}

const statusColors: Record<string, string> = {
  Open: "bg-y-teal/10 text-y-teal-dark",
  Working: "bg-yellow-100 text-yellow-700",
  "Pending Review": "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-slate-100 text-slate-500",
  Overdue: "bg-red-100 text-red-700",
};

const priorityDot: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-slate-400",
};

function parseAssign(raw: string): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function buildTree(tasks: Task[]): TreeNode[] {
  const taskMap = new Map<string, TreeNode>();
  for (const t of tasks) {
    taskMap.set(t.name, { task: t, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of taskMap.values()) {
    if (node.task.parent_task && taskMap.has(node.task.parent_task)) {
      taskMap.get(node.task.parent_task)!.children.push(node);
    } else if (!node.task.parent_task) {
      roots.push(node);
    } else {
      // Parent not in current set — treat as root
      roots.push(node);
    }
  }
  return roots;
}

function countDescendants(node: TreeNode): { total: number; done: number } {
  let total = 0, done = 0;
  for (const child of node.children) {
    total++;
    if (child.task.status === "Completed") done++;
    const sub = countDescendants(child);
    total += sub.total;
    done += sub.done;
  }
  return { total, done };
}

export default function Subtasks() {
  const { t } = useTranslation();
  const projects = useProjects();
  const employees = useEmployees();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(getActiveCompany());
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Add task form
  const [addingFor, setAddingFor] = useState<string | null>(null); // parent task name, or "__root__" for top-level
  const [newSubject, setNewSubject] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [submitting, setSubmitting] = useState(false);

  // Assign
  const [showAssignFor, setShowAssignFor] = useState<string | null>(null);

  // Properties panel
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);

  // Comments
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) {
      if (e.user_id) map.set(e.user_id, e.employee_name);
      map.set(e.name, e.employee_name);
    }
    return map;
  }, [employees]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.name, p.project_name);
    return map;
  }, [projects]);

  const loadTasks = useCallback(async (preserveScroll = false) => {
    const scrollTop = preserveScroll ? treeScrollRef.current?.scrollTop : undefined;
    setLoading(prev => preserveScroll ? prev : true);
    try {
      const filters: unknown[][] = [];
      if (company) filters.push(["company", "=", company]);
      filters.push(["status", "not in", ["Cancelled", "Template"]]);

      const list = await fetchList<Task>("Task", {
        fields: ["name", "subject", "description", "status", "priority", "project", "parent_task", "exp_end_date", "company", "is_group"],
        filters,
        limit_page_length: 0,
        order_by: "creation asc",
      });
      setTasks(list);
      // Restore scroll position after React re-renders
      if (scrollTop !== undefined) {
        requestAnimationFrame(() => {
          if (treeScrollRef.current) treeScrollRef.current.scrollTop = scrollTop;
        });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const projectsWithTasks = useMemo(() => {
    const taskProjectIds = new Set(tasks.filter(t => !t.parent_task && t.project).map(t => t.project));
    const matched = projects.filter(p => taskProjectIds.has(p.name));
    if (matched.length > 0) return matched.sort((a, b) => a.name.localeCompare(b.name));
    return Array.from(taskProjectIds).sort().map(id => ({
      name: id,
      project_name: projectNameMap.get(id) || id,
      status: "Open", percent_complete: 0, expected_start_date: "", expected_end_date: "", company: "", custom_address: "",
    }));
  }, [tasks, projects, projectNameMap]);

  // Build tree from flat task list
  const tree = useMemo(() => {
    const s = search.toLowerCase();
    let filtered = tasks;
    if (projectFilter) filtered = filtered.filter(t => t.project === projectFilter);
    if (s) {
      // When searching, include matching tasks AND their ancestors
      const matchIds = new Set<string>();
      for (const t of filtered) {
        if (t.subject.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) ||
          (projectNameMap.get(t.project) || "").toLowerCase().includes(s)) {
          matchIds.add(t.name);
          // Walk up the parent chain
          let cur = t;
          while (cur.parent_task) {
            matchIds.add(cur.parent_task);
            const parent = filtered.find(p => p.name === cur.parent_task);
            if (!parent) break;
            cur = parent;
          }
        }
      }
      filtered = filtered.filter(t => matchIds.has(t.name));
    }
    return buildTree(filtered);
  }, [tasks, search, projectFilter, projectNameMap]);

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    const all = new Set<string>();
    for (const t of tasks) {
      if (t.is_group || tasks.some(c => c.parent_task === t.name)) {
        all.add(t.name);
      }
    }
    setExpanded(all);
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  async function addTask(parentTaskName: string | null) {
    if (!newSubject.trim()) return;
    setSubmitting(true);
    try {
      const parentTask = parentTaskName ? tasks.find(t => t.name === parentTaskName) : null;
      const doc: Record<string, unknown> = {
        subject: newSubject.trim(),
        priority: newPriority,
        status: "Open",
      };
      if (parentTaskName) doc.parent_task = parentTaskName;
      if (parentTask?.project) doc.project = parentTask.project;
      else if (projectFilter) doc.project = projectFilter;
      if (parentTask?.company) doc.company = parentTask.company;
      else if (company) doc.company = company;

      await createDocument("Task", doc);
      setNewSubject("");
      setNewPriority("Medium");
      setAddingFor(null);
      // Auto-expand parent
      if (parentTaskName) setExpanded(prev => new Set(prev).add(parentTaskName));
      await loadTasks(true);
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  }

  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === "Completed" ? "Open" : "Completed";
    try {
      await callMethod("frappe.client.set_value", {
        doctype: "Task", name: task.name, fieldname: "status", value: newStatus,
      });
      setTasks(prev => prev.map(t => t.name === task.name ? { ...t, status: newStatus } : t));
    } catch { /* ignore */ }
  }

  async function deleteTask(task: Task) {
    try {
      await callMethod("frappe.client.set_value", {
        doctype: "Task", name: task.name, fieldname: "status", value: "Cancelled",
      });
      setTasks(prev => prev.filter(t => t.name !== task.name));
    } catch { /* ignore */ }
  }

  async function assignUser(taskName: string, userId: string) {
    try {
      await callMethod("frappe.desk.form.assign_to.add", {
        doctype: "Task", name: taskName, assign_to: [userId],
      });
      setShowAssignFor(null);
      await loadTasks(true);
    } catch { /* ignore */ }
  }

  async function removeAssign(taskName: string, userId: string) {
    try {
      await callMethod("frappe.desk.form.assign_to.remove", {
        doctype: "Task", name: taskName, assign_to: userId,
      });
      await loadTasks(true);
    } catch { /* ignore */ }
  }

  function selectTask(task: Task) {
    setSelectedTask(task);
    setEditingDesc(false);
    setDescDraft(task.description || "");
    // Also load comments for this task
    loadComments(task);
  }

  async function saveDescription() {
    if (!selectedTask) return;
    setSavingDesc(true);
    try {
      await callMethod("frappe.client.set_value", {
        doctype: "Task", name: selectedTask.name, fieldname: "description", value: descDraft,
      });
      setTasks(prev => prev.map(t => t.name === selectedTask.name ? { ...t, description: descDraft } : t));
      setSelectedTask(prev => prev ? { ...prev, description: descDraft } : prev);
      setEditingDesc(false);
    } catch { /* ignore */ }
    finally { setSavingDesc(false); }
  }

  async function saveField(taskName: string, field: string, value: unknown) {
    try {
      await callMethod("frappe.client.set_value", {
        doctype: "Task", name: taskName, fieldname: field, value,
      });
      setTasks(prev => prev.map(t => t.name === taskName ? { ...t, [field]: value } : t));
      setSelectedTask(prev => prev && prev.name === taskName ? { ...prev, [field]: value } : prev);
    } catch { /* ignore */ }
  }

  async function loadComments(task: Task) {
    setCommentTask(task);
    setLoadingComments(true);
    setNewComment("");
    try {
      const list = await fetchList<Comment>("Comment", {
        fields: ["name", "comment_type", "content", "comment_by", "creation"],
        filters: [
          ["reference_doctype", "=", "Task"],
          ["reference_name", "=", task.name],
          ["comment_type", "=", "Comment"],
        ],
        limit_page_length: 50,
        order_by: "creation asc",
      });
      setComments(list);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  }

  async function addComment() {
    const task = selectedTask || commentTask;
    if (!newComment.trim() || !task) return;
    setSubmittingComment(true);
    try {
      await createDocument("Comment", {
        comment_type: "Comment",
        reference_doctype: "Task",
        reference_name: task.name,
        content: newComment.trim(),
      });
      setNewComment("");
      await loadComments(task);
    } catch { /* ignore */ }
    finally { setSubmittingComment(false); }
  }

  // Add form component
  function AddForm({ parentName, depth }: { parentName: string | null; depth: number }) {
    if (addingFor !== (parentName || "__root__")) return null;
    return (
      <div className="bg-white rounded-lg border border-y-teal/30 p-3 space-y-2 my-1" style={{ marginLeft: depth * 32 + 8 }}>
        <input
          type="text" value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder={parentName ? t("subtasks.subtask_placeholder") : t("subtasks.parent_task_placeholder")}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && newSubject.trim()) addTask(parentName); if (e.key === "Escape") setAddingFor(null); }}
        />
        <div className="flex items-center gap-2">
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal">
            <option value="Low">{t("subtasks.priority_low")}</option>
            <option value="Medium">{t("subtasks.priority_medium")}</option>
            <option value="High">{t("subtasks.priority_high")}</option>
            <option value="Urgent">{t("subtasks.priority_urgent")}</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => setAddingFor(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer">{t("common.cancel")}</button>
          <button onClick={() => addTask(parentName)} disabled={!newSubject.trim() || submitting}
            className="px-3 py-1.5 text-xs bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer font-medium">
            {submitting ? t("common.saving") : t("common.add")}
          </button>
        </div>
      </div>
    );
  }

  // Tree node component
  function TreeNodeRow({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
    const { task } = node;
    const isDone = task.status === "Completed";
    const assigned = parseAssign(task._assign);
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(task.name);
    const counts = hasChildren ? countDescendants(node) : null;

    const isSelected = selectedTask?.name === task.name;

    return (
      <>
        <div
          className={`flex items-center gap-2 px-3 py-2 group transition-colors border-b border-slate-100 ${isDone ? "opacity-50" : ""} ${isSelected ? "bg-y-teal/5 border-l-2 border-l-y-teal" : "hover:bg-slate-50"} ${depth === 1 ? "bg-slate-50/50" : depth >= 2 ? "bg-slate-100/40" : ""}`}
          style={{ paddingLeft: depth * 32 + 12 }}
        >
          {/* Expand/collapse */}
          {hasChildren ? (
            <button onClick={() => toggleExpand(task.name)}
              className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-700 cursor-pointer rounded hover:bg-slate-200">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5 shrink-0" />
          )}

          {/* Checkbox */}
          <button onClick={() => toggleTaskStatus(task)}
            className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              isDone ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-y-teal"
            }`}>
            {isDone && <Check size={10} />}
          </button>

          {/* Priority dot */}
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || "bg-slate-300"}`} />

          {/* Subject — click to open properties */}
          <button onClick={() => selectTask(task)}
            className={`text-sm flex-1 min-w-0 truncate text-left cursor-pointer hover:text-y-teal ${isDone ? "line-through text-slate-400" : "text-slate-700"} ${hasChildren ? "font-semibold" : ""}`}>
            {task.subject}
          </button>

          {/* Counts badge for parent tasks */}
          {counts && counts.total > 0 && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">
              {counts.done}/{counts.total}
            </span>
          )}

          {/* Project (only for top-level) */}
          {depth === 0 && task.project && (
            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shrink-0 max-w-[120px] truncate">
              {projectNameMap.get(task.project) || task.project}
            </span>
          )}

          {/* Assigned users */}
          {assigned.map(u => (
            <span key={u} title={u}
              className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full max-w-[90px] truncate shrink-0">
              {employeeMap.get(u) || u.split("@")[0]}
              <button onClick={() => removeAssign(task.name, u)}
                className="hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100">
                <X size={8} />
              </button>
            </span>
          ))}

          {/* Status badge */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusColors[task.status] || "bg-slate-100 text-slate-500"}`}>
            {task.status}
          </span>

          {/* Date */}
          {task.exp_end_date && (
            <span className="text-[10px] text-slate-400 shrink-0">
              {new Date(task.exp_end_date + "T12:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => { setAddingFor(addingFor === task.name ? null : task.name); setNewSubject(""); }}
              title={t("subtasks.add_subtask")}
              className="p-1 text-slate-300 hover:text-y-teal cursor-pointer">
              <Plus size={13} />
            </button>
            <button onClick={() => setShowAssignFor(showAssignFor === task.name ? null : task.name)}
              title={t("subtasks.assign")}
              className="p-1 text-slate-300 hover:text-blue-500 cursor-pointer">
              <UserPlus size={13} />
            </button>
            <button onClick={() => loadComments(task)}
              title={t("subtasks.comment")}
              className="p-1 text-slate-300 hover:text-y-teal cursor-pointer">
              <MessageSquare size={13} />
            </button>
            <a href={`${getErpNextLinkUrl()}/task/${task.name}`}
              target="_blank" rel="noopener noreferrer"
              title={t("subtasks.open_in_erpnext")}
              className="p-1 text-slate-300 hover:text-y-teal">
              <ExternalLink size={11} />
            </a>
            <button onClick={() => deleteTask(task)}
              className="p-1 text-slate-300 hover:text-red-500 cursor-pointer">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Assign dropdown inline */}
        {showAssignFor === task.name && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-2 mx-4 my-1 max-h-48 overflow-y-auto"
            style={{ marginLeft: depth * 32 + 40 }}>
            <p className="text-[10px] text-slate-400 uppercase mb-1 px-1">{t("subtasks.assign_to")}</p>
            {employees.filter(e => e.status === "Active" && e.user_id).map(emp => (
              <button key={emp.name}
                onClick={() => assignUser(task.name, emp.user_id)}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50 rounded cursor-pointer flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-y-teal/10 text-y-teal text-[10px] flex items-center justify-center font-bold shrink-0">
                  {emp.employee_name.charAt(0)}
                </div>
                <span>{emp.employee_name}</span>
                <span className="text-slate-400 text-[10px] ml-auto">{emp.user_id}</span>
              </button>
            ))}
          </div>
        )}

        {/* Add child form */}
        <AddForm parentName={task.name} depth={depth + 1} />

        {/* Children */}
        {isExpanded && hasChildren && node.children.map(child => (
          <TreeNodeRow key={child.task.name} node={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main tree */}
      <div className={`flex-1 flex flex-col min-w-0 ${commentTask ? "" : ""}`}>
        {/* Header */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTree size={18} className="text-y-teal" />
              <h2 className="text-lg font-bold text-slate-800">{t("nav.tasks")}</h2>
              <span className="text-xs text-slate-400">{t("subtasks.tasks_count", { count: tasks.length })}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={expandAll} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
                {t("subtasks.expand_all")}
              </button>
              <button onClick={collapseAll} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer">
                {t("subtasks.collapse_all")}
              </button>
              <button onClick={() => loadTasks()} disabled={loading}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-48">
              <CompanySelect value={company} onChange={setCompany} />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value="">{t("subtasks.all_projects")}</option>
              {projectsWithTasks.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} — {p.project_name}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("hours_widget.search_task_placeholder")}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </div>
            <button onClick={() => { setAddingFor(addingFor === "__root__" ? null : "__root__"); setNewSubject(""); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer shrink-0">
              <Plus size={14} /> {t("subtasks.parent_task")}
            </button>
          </div>
        </div>

        {/* Tree */}
        <div ref={treeScrollRef} className="flex-1 overflow-y-auto bg-white">
          {loading && <p className="p-4 text-sm text-slate-400">{t("common.loading")}</p>}
          {!loading && tree.length === 0 && (
            <p className="p-4 text-sm text-slate-400">{t("subtasks.no_tasks")}</p>
          )}

          {/* Root add form */}
          <AddForm parentName={null} depth={0} />

          {tree.map(node => (
            <TreeNodeRow key={node.task.name} node={node} depth={0} />
          ))}
        </div>
      </div>

      {/* Properties panel */}
      {selectedTask && (
        <div className="w-96 flex flex-col bg-white border-l border-slate-200 shrink-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-800 truncate">{selectedTask.subject}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-400 font-mono">{selectedTask.name}</span>
                <a href={`${getErpNextLinkUrl()}/task/${selectedTask.name}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-y-teal hover:text-y-teal-dark flex items-center gap-0.5">
                  <ExternalLink size={9} /> ERPNext
                </a>
              </div>
            </div>
            <button onClick={() => { setSelectedTask(null); setCommentTask(null); }}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0">
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Properties */}
            <div className="px-4 py-3 space-y-3 border-b border-slate-200">
              {/* Status */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-1">{t("projects.detail.status")}</label>
                <select value={selectedTask.status}
                  onChange={(e) => saveField(selectedTask.name, "status", e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal">
                  <option value="Open">{t("subtasks.status_open")}</option>
                  <option value="Working">{t("subtasks.status_working")}</option>
                  <option value="Pending Review">{t("subtasks.status_pending_review")}</option>
                  <option value="Completed">{t("subtasks.status_completed")}</option>
                  <option value="Cancelled">{t("subtasks.status_cancelled")}</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-1">{t("tasks.detail.priority")}</label>
                <select value={selectedTask.priority}
                  onChange={(e) => saveField(selectedTask.name, "priority", e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal">
                  <option value="Low">{t("subtasks.priority_low")}</option>
                  <option value="Medium">{t("subtasks.priority_medium")}</option>
                  <option value="High">{t("subtasks.priority_high")}</option>
                  <option value="Urgent">{t("subtasks.priority_urgent")}</option>
                </select>
              </div>

              {/* Project */}
              {selectedTask.project && (
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-medium block mb-1">{t("tasks.detail.project")}</label>
                  <p className="text-xs text-slate-700">{projectNameMap.get(selectedTask.project) || selectedTask.project}</p>
                </div>
              )}

              {/* Due date */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-1">{t("tasks.detail.deadline")}</label>
                <input type="date" value={selectedTask.exp_end_date || ""}
                  onChange={(e) => saveField(selectedTask.name, "exp_end_date", e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
                />
              </div>

              {/* Assigned */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-1">{t("tasks.detail.assigned_to")}</label>
                <div className="space-y-1">
                  {parseAssign(selectedTask._assign).map(u => (
                    <div key={u} className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      <span className="flex-1 truncate">{employeeMap.get(u) || u}</span>
                      <button onClick={() => removeAssign(selectedTask.name, u)}
                        className="text-blue-400 hover:text-red-500 cursor-pointer"><X size={10} /></button>
                    </div>
                  ))}
                  {parseAssign(selectedTask._assign).length === 0 && (
                    <p className="text-[11px] text-slate-400">{t("subtasks.nobody_assigned")}</p>
                  )}
                  <div className="pt-1">
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) assignUser(selectedTask.name, e.target.value); }}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-y-teal text-slate-400">
                      <option value="">{t("subtasks.assign_dropdown")}</option>
                      {employees.filter(e => e.status === "Active" && e.user_id).map(emp => (
                        <option key={emp.name} value={emp.user_id}>{emp.employee_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400 uppercase font-medium">{t("instance_bar.feedback_description_label")}</label>
                {!editingDesc ? (
                  <button onClick={() => { setEditingDesc(true); setDescDraft(selectedTask.description || ""); }}
                    className="text-[10px] text-y-teal hover:text-y-teal-dark cursor-pointer">{t("common.edit")}</button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingDesc(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer">{t("common.cancel")}</button>
                    <button onClick={saveDescription} disabled={savingDesc}
                      className="text-[10px] text-y-teal hover:text-y-teal-dark cursor-pointer font-medium">
                      {savingDesc ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                )}
              </div>
              {editingDesc ? (
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal resize-y"
                  autoFocus
                />
              ) : (
                <div className="text-xs text-slate-600 min-h-[40px]">
                  {selectedTask.description ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedTask.description }} className="prose prose-xs max-w-none" />
                  ) : (
                    <p className="text-slate-400 italic">{t("subtasks.no_description")}</p>
                  )}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={12} className="text-y-teal" />
                <label className="text-[10px] text-slate-400 uppercase font-medium">{t("subtasks.comments_label")}</label>
              </div>

              <div className="space-y-2 mb-3">
                {loadingComments && <p className="text-[11px] text-slate-400">{t("common.loading")}</p>}
                {!loadingComments && comments.length === 0 && (
                  <p className="text-[11px] text-slate-400">{t("subtasks.no_comments")}</p>
                )}
                {comments.map(c => (
                  <div key={c.name} className="text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-slate-700">
                        {employeeMap.get(c.comment_by) || c.comment_by.split("@")[0]}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(c.creation).toLocaleDateString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-slate-600 bg-slate-50 rounded px-2 py-1.5"
                      dangerouslySetInnerHTML={{ __html: c.content }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text" value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t("subtasks.add_comment_placeholder")}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
                  onKeyDown={(e) => { if (e.key === "Enter" && newComment.trim()) addComment(); }}
                />
                <button onClick={addComment} disabled={!newComment.trim() || submittingComment}
                  className="px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
