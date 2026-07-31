import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, ListTodo, Plus, Trash2 } from "lucide-react";
import { fetchList, createDocument, updateDocument, deleteDocument, callMethod } from "../../lib/erpnext";
import { compareTodos } from "../../lib/todoSort";
import { useEmployees, useProjects } from "../../lib/DataContext";
import { TaskDetail } from "../Tasks";
import { TodoDetail, stripHtml } from "../../components/TodoDetail";
import type { Page } from "../../components/Sidebar";
import { isOverdue, formatDisplayName } from "./types";
import { getActiveEmployee } from "../../lib/instances";

interface TodoItem {
  name: string;
  description: string;
  status: "Open" | "Closed";
  priority: "Low" | "Medium" | "High" | "Urgent";
  date: string;
  reference_type: string;
  reference_name: string;
  allocated_to: string;
  assigned_by: string;
  color: string;
}

const todoPriorityColors: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-slate-400",
};

export function MyTodoList({ filterMode, onNavigate }: { filterMode?: "tasks" | "todos"; onNavigate?: (page: Page) => void } = {}) {
  const { t } = useTranslation();
  const employees = useEmployees();
  const storeProjects = useProjects();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTodo, setNewTodo] = useState({ description: "", priority: "Medium" as string, date: "" });
  const [error, setError] = useState("");
  const [taskDetails, setTaskDetails] = useState<Map<string, { subject: string; project: string; description?: string; workflow_state?: string }>>(new Map());
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);

  // For assigning new todos (optional)
  const myEmployeeId = getActiveEmployee();
  const myEmail = useMemo(() => {
    const emp = employees.find((e) => e.name === myEmployeeId);
    return emp?.user_id || emp?.company_email || "";
  }, [employees, myEmployeeId]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of storeProjects) if (p.name && p.project_name) map.set(p.name, p.project_name);
    return map;
  }, [storeProjects]);

  const loadTodos = useCallback(() => {
    if (!myEmail) return;
    setLoading(true);
    fetchList<TodoItem>("ToDo", {
      fields: ["name", "description", "status", "priority", "date", "reference_type", "reference_name", "allocated_to", "assigned_by", "color"],
      filters: [["status", "=", "Open"], ["allocated_to", "=", myEmail]],
      limit_page_length: 500,
      order_by: "modified desc",
    })
      .then((todos) => {
        todos.sort(compareTodos);
        setTodos(todos);
      })
      .catch((err) => { console.error("ToDo fetch error:", err); setTodos([]); })
      .finally(() => setLoading(false));
  }, [myEmail]);

  // Only fetch when myEmail is actually resolved (not empty string)
  useEffect(() => { if (myEmail) loadTodos(); }, [myEmail, loadTodos]);

  // Fetch Task details for todos that reference a Task — single bulk query
  useEffect(() => {
    const taskNames = todos
      .filter(t => t.reference_type === "Task" && t.reference_name && !taskDetails.has(t.reference_name))
      .map(t => t.reference_name);
    if (taskNames.length === 0) return;
    fetchList<{ name: string; subject: string; project: string; description: string; workflow_state: string }>("Task", {
      fields: ["name", "subject", "project", "description", "workflow_state"],
      filters: [["name", "in", taskNames]],
      limit_page_length: taskNames.length,
    }).then(tasks => {
      setTaskDetails(prev => {
        const newMap = new Map(prev);
        for (const t of tasks) newMap.set(t.name, t);
        return newMap;
      });
    }).catch(() => {});
  }, [todos]);

  async function toggleStatus(todo: TodoItem) {
    const newStatus = todo.status === "Open" ? "Closed" : "Open";
    try {
      await updateDocument("ToDo", todo.name, { status: newStatus });
      loadTodos();
    } catch {
      // silent
    }
  }

  async function handleDelete(todoName: string) {
    try {
      await deleteDocument("ToDo", todoName);
      loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.todo_delete_error"));
    }
  }

  async function handleAdd() {
    if (!newTodo.description.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createDocument("ToDo", {
        description: newTodo.description,
        priority: newTodo.priority,
        date: newTodo.date || null,
        status: "Open",
        allocated_to: myEmail,
      });
      setNewTodo({ description: "", priority: "Medium", date: "" });
      setAdding(false);
      loadTodos();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.todo_create_error"));
    } finally {
      setSaving(false);
    }
  }

  // Filter out todos whose referenced task is Completed or Cancelled
  const activeTodos = todos.filter((t) => {
    if (t.reference_type === "Task" && taskDetails.has(t.reference_name)) {
      const ws = taskDetails.get(t.reference_name)?.workflow_state;
      if (ws === "Completed" || ws === "Cancelled") return false;
    }
    // Apply filterMode: "tasks" shows only Task-linked, "todos" shows only non-Task
    if (filterMode === "tasks" && t.reference_type !== "Task") return false;
    if (filterMode === "todos" && t.reference_type === "Task") return false;
    return true;
  });
  const openTodos = activeTodos.filter((t) => t.status === "Open");
  const closedTodos = activeTodos.filter((t) => t.status === "Closed");

  const widgetTitle = filterMode === "tasks" ? t("widget.my_tasks") : t("widget.my_todos");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        {filterMode === "tasks" ? <CheckSquare size={18} className="text-y-teal" /> : <ListTodo size={18} className="text-y-teal" />}
        {onNavigate ? (
          <button onClick={() => onNavigate(filterMode === "tasks" ? "tasks" : "todo")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{widgetTitle} &rarr;</button>
        ) : (
          <h3 className="font-semibold text-slate-800">{widgetTitle}</h3>
        )}
        <span className="ml-auto text-sm text-slate-400">
          {loading ? "..." : t("dashboard.n_open", { n: openTodos.length })}
        </span>
        {filterMode !== "tasks" && (
          <button
            onClick={() => setAdding(!adding)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-y-teal cursor-pointer"
            title={t("dashboard.new_todo")}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
      )}

      {/* Add new todo */}
      {adding && (
        <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <input
            type="text"
            value={newTodo.description}
            onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
            placeholder={t("dashboard.todo_description_placeholder")}
            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <select
              value={newTodo.priority}
              onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value })}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
            <input
              type="date"
              value={newTodo.date}
              onChange={(e) => setNewTodo({ ...newTodo, date: e.target.value })}
              className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            <div className="ml-auto flex gap-1">
              <button onClick={handleAdd} disabled={saving || !newTodo.description.trim()}
                className="px-2.5 py-1 bg-y-teal text-white rounded-lg text-xs font-medium hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
                {saving ? "..." : t("common.add")}
              </button>
              <button onClick={() => setAdding(false)}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-slate-400 py-8">{t("common.loading")}</p>
      ) : (
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {/* Open todos */}
          {openTodos.map((todo) => (
            <div key={todo.name} className="group">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-slate-50">
                <button
                  onClick={() => toggleStatus(todo)}
                  className="mt-0.5 w-4 h-4 rounded border border-slate-300 hover:border-y-teal flex-shrink-0 cursor-pointer"
                  title={t("dashboard.mark_done")}
                />
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${todoPriorityColors[todo.priority] ?? "bg-slate-300"}`} title={todo.priority} />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedTodo(selectedTodo?.name === todo.name ? null : todo)}>
                  {(() => {
                    const task = todo.reference_type === "Task" ? taskDetails.get(todo.reference_name) : null;
                    const displayText = task?.subject || stripHtml(todo.description);
                    return (
                      <>
                        <p className="text-sm text-slate-700 line-clamp-2">{displayText}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task?.project && (
                            <span className="text-[10px] font-mono text-slate-500">
                              {task.project} {projectNameMap.get(task.project) || ""}
                            </span>
                          )}
                          {todo.date && (
                            <span className={`text-[10px] ${isOverdue(todo.date) ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                              {todo.date}
                            </span>
                          )}
                          {task?.workflow_state && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{task.workflow_state}</span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                {todo.reference_type !== "Task" && (
                  <button
                    onClick={() => handleDelete(todo.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                    title={t("common.delete_tooltip")}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Closed todos (collapsed) */}
          {closedTodos.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 px-3 py-1">
                {t("dashboard.n_completed", { n: closedTodos.length })}
              </summary>
              {closedTodos.map((todo) => (
                <div key={todo.name} className="flex items-start gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 group">
                  <button
                    onClick={() => toggleStatus(todo)}
                    className="mt-0.5 w-4 h-4 rounded border border-slate-300 bg-y-teal/20 flex-shrink-0 cursor-pointer flex items-center justify-center"
                    title={t("dashboard.reopen")}
                  >
                    <span className="text-y-teal text-[10px]">✓</span>
                  </button>
                  <p className="text-sm text-slate-400 line-through line-clamp-1 flex-1">{stripHtml(todo.description)}</p>
                  {todo.reference_type !== "Task" && (
                    <button
                      onClick={() => handleDelete(todo.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                      title={t("common.delete_tooltip")}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </details>
          )}

          {openTodos.length === 0 && closedTodos.length === 0 && myEmail && (
            <p className="text-sm text-slate-400 text-center py-4">{t("dashboard.no_todos")}</p>
          )}
        </div>
      )}

      {/* Task detail sliding panel for selected todo */}
      {selectedTodo && selectedTodo.reference_type === "Task" && taskDetails.has(selectedTodo.reference_name) && (() => {
        const task = taskDetails.get(selectedTodo.reference_name)!;
        const taskObj = { name: selectedTodo.reference_name, subject: task.subject, project: task.project, description: task.description || "", workflow_state: task.workflow_state || "", status: "", priority: selectedTodo.priority, assigned_to: "", exp_end_date: selectedTodo.date || "", company: "" };
        return (
          <TaskDetail
            task={taskObj as any}
            onClose={() => setSelectedTodo(null)}
            getDisplayName={formatDisplayName}
            projectName={projectNameMap.get(task.project) || ""}
            employees={employees}
            onFieldUpdate={(_name, field, value) => {
              if (field === "exp_end_date") {
                setSelectedTodo((prev) => prev ? { ...prev, date: value } : prev);
                setTodos((prev) => prev.map((t) =>
                  t.name === selectedTodo.name ? { ...t, date: value } : t
                ));
                updateDocument("ToDo", selectedTodo.name, { date: value || null }).catch(() => {});
              } else if (field === "priority") {
                setSelectedTodo((prev) => prev ? { ...prev, priority: value as TodoItem["priority"] } : prev);
                setTodos((prev) => prev.map((t) =>
                  t.name === selectedTodo.name ? { ...t, priority: value as TodoItem["priority"] } : t
                ));
              }
            }}
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
        );
      })()}

      {/* Detail panel for standalone ToDo's (not Task-linked) */}
      {selectedTodo && selectedTodo.reference_type !== "Task" && (
        <TodoDetail
          key={selectedTodo.name}
          todo={selectedTodo}
          mode="edit"
          myEmail={myEmail}
          onClose={() => setSelectedTodo(null)}
          onSave={() => { setSelectedTodo(null); loadTodos(); }}
          onDelete={async (name) => {
            await deleteDocument("ToDo", name);
            setSelectedTodo(null);
            loadTodos();
          }}
        />
      )}
    </div>
  );
}
