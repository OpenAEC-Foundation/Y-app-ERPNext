import { useEffect, useState, useMemo } from "react";
import { fetchList, updateDocument, deleteDocument, getErpNextLinkUrl } from "../lib/erpnext";
import { isPermissionError } from "../lib/permission-error";
import { compareTodos } from "../lib/todoSort";
import { useEmployees } from "../lib/DataContext";
import {
  ListTodo, RefreshCw, Plus, CheckCircle2, Circle,
  ExternalLink, ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { TodoDetail, stripHtml } from "../components/TodoDetail";
import type { ToDo } from "../components/TodoDetail";
import { getActiveEmployee } from "../lib/instances";

const priorityColors: Record<string, string> = {
  High: "text-red-600 bg-red-50",
  Medium: "text-orange-600 bg-orange-50",
  Low: "text-slate-600 bg-slate-50",
};

/* ─── Main Todo page ─── */

export default function Todo() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const [todos, setTodos] = useState<ToDo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"Open" | "Closed" | "">("Open");
  const myEmployeeId = getActiveEmployee();
  const myEmail = useMemo(() => {
    const emp = allEmployees.find(e => e.name === myEmployeeId);
    return emp?.user_id || emp?.company_email || localStorage.getItem("erpnext_username") || "";
  }, [allEmployees, myEmployeeId]);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [userTouchedFilter, setUserTouchedFilter] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<ToDo | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"create" | "edit">("create");
  const isEmployer = localStorage.getItem("view_mode") !== "employee";

  // Werkgevers: vul de employee-filter standaard in met de huidige
  // geselecteerde medewerker uit Settings zodra allEmployees gehydrateerd is.
  // Respecteer expliciete user-keuze (incl. "Alle medewerkers" = "").
  useEffect(() => {
    if (!isEmployer) return;
    if (userTouchedFilter) return;
    if (!myEmail) return;
    if (filterEmployee) return;
    setFilterEmployee(myEmail);
  }, [isEmployer, myEmail, userTouchedFilter, filterEmployee]);

  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.status === "Active").sort((a, b) => a.employee_name.localeCompare(b.employee_name)),
    [allEmployees]
  );

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [];
      if (filter) filters.push(["status", "=", filter]);
      // Verberg taak-assignments voor iedereen.
      filters.push(["reference_type", "!=", "Task"]);
      // Employees: server-side scopen op eigen todos. Employers zien alles
      // en filteren via de dropdown. Als myEmail nog leeg is (allEmployees
      // nog niet gehydrateerd) slaan we de fetch hier over — het effect
      // re-runt zodra myEmail waarde krijgt.
      if (!isEmployer) {
        if (!myEmail) { setLoading(false); return; }
        filters.push(["allocated_to", "=", myEmail]);
      }
      if (filterEmployee) filters.push(["allocated_to", "=", filterEmployee]);

      const list = await fetchList<ToDo>("ToDo", {
        fields: [
          "name", "description", "status", "priority", "date",
          "reference_type", "reference_name", "allocated_to",
        ],
        filters,
        limit_page_length: 200,
        order_by: "modified desc",
      });
      setTodos(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // myEmail is in de deps omdat employees het server-side gebruiken.
    // Voor employers is myEmail niet nodig in de query — re-fetchen als
    // het alsnog hydrateert is dan goedkoop en veilig.
    loadData();
  }, [filter, filterEmployee, myEmail, isEmployer]);

  async function toggleStatus(todo: ToDo) {
    const newStatus = todo.status === "Open" ? "Closed" : "Open";
    try {
      await updateDocument("ToDo", todo.name, { status: newStatus });
      setTodos((prev) =>
        prev.map((t) => (t.name === todo.name ? { ...t, status: newStatus } : t))
      );
    } catch {
      await loadData();
    }
  }

  /**
   * Verwijderen van een todo. `TodoDetail` rendert zijn verwijderknop alleen
   * als deze prop er is — zonder de bedrading hierboven was een in Y-next
   * aangemaakt todo dus onverwijderbaar (hooguit op "Afgerond" te zetten).
   * De bevestiging zit in `TodoDetail` zelf, vlak vóór de aanroep.
   *
   * Gooit bij een fout door: `TodoDetail` toont de melding in het paneel. Een
   * 403 betekent een ontbrekend DocPerm `delete` op ToDo (zie de
   * `ensurePermissions`-fase van de provisioning) en verdient een
   * handelingsgerichte tekst in plaats van Frappe's rauwe traceback-regel.
   */
  async function handleDeleteTodo(todoName: string) {
    if (!todoName) return;
    try {
      await deleteDocument("ToDo", todoName);
    } catch (e) {
      if (isPermissionError(e)) throw new Error(t("y_next.todo_no_delete_permission"));
      throw new Error(
        `${t("y_next.todo_delete_failed")}${e instanceof Error && e.message ? `: ${e.message}` : ""}`
      );
    }
    setSelectedTodo(null);
    await loadData();
  }

  function openCreate() {
    setSelectedTodo(null);
    setSidebarMode("create");
    // Trigger re-render with a dummy "blank" todo
    setSelectedTodo({ name: "", description: "", status: "Open", priority: "Medium", date: new Date().toISOString().split("T")[0], reference_type: "", reference_name: "", allocated_to: myEmail } as ToDo);
    setSidebarMode("create");
  }

  function openEdit(todo: ToDo) {
    setSelectedTodo(todo);
    setSidebarMode("edit");
  }

  const filteredTodos = useMemo(() => {
    const list = filterEmployee ? todos.filter((t) => t.allocated_to === filterEmployee) : todos;
    return [...list].sort(compareTodos);
  }, [todos, filterEmployee]);

  const openCount = filteredTodos.filter((t) => t.status === "Open").length;
  const closedCount = filteredTodos.filter((t) => t.status === "Closed").length;

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <ListTodo className="text-y-teal" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("nav.todo")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium"
          >
            <Plus size={16} /> {t("todo.new")}
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* KPI + Filter */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <Circle className="text-orange-500" size={20} />
          <div>
            <p className="text-sm text-slate-500">{t("todo.status_open")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : openCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <CheckCircle2 className="text-green-500" size={20} />
          <div>
            <p className="text-sm text-slate-500">{t("todo.status_done")}</p>
            <p className="text-2xl font-bold text-slate-800">{loading ? "..." : closedCount}</p>
          </div>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "Open" | "Closed" | "")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value="">{t("todo.all")}</option>
          <option value="Open">{t("todo.status_open")}</option>
          <option value="Closed">{t("todo.status_done")}</option>
        </select>
        {isEmployer && (
          <select
            value={filterEmployee}
            onChange={(e) => { setUserTouchedFilter(true); setFilterEmployee(e.target.value); }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          >
            <option value="">{t("instance_bar.all_employees")}</option>
            {activeEmployees.map((e) => (
              <option key={e.name} value={e.user_id || e.company_email || e.employee_name}>
                {e.employee_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Todo List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">{t("common.loading")}</div>
      ) : filteredTodos.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400">{t("todo.no_todos")}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
          {filteredTodos.map((todo) => (
            <div
              key={todo.name}
              className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer group"
              onClick={() => openEdit(todo)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleStatus(todo); }}
                className="mt-0.5 flex-shrink-0 cursor-pointer"
                title={todo.status === "Open" ? t("todo.mark_done") : t("todo.mark_open")}
              >
                {todo.status === "Open" ? (
                  <Circle size={20} className="text-slate-300 hover:text-y-teal" />
                ) : (
                  <CheckCircle2 size={20} className="text-green-500" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${todo.status === "Closed" ? "line-through text-slate-400" : "text-slate-700"}`}>
                  {stripHtml(todo.description)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${priorityColors[todo.priority] || "text-slate-600 bg-slate-50"}`}>
                    {todo.priority}
                  </span>
                  {todo.date && (
                    <span className="text-xs text-slate-400">{todo.date}</span>
                  )}
                  {todo.reference_type && todo.reference_name && (
                    <a
                      href={`${getErpNextLinkUrl()}/${todo.reference_type.toLowerCase().replace(/ /g, "-")}/${todo.reference_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-y-teal hover:text-y-teal-dark flex items-center gap-0.5"
                    >
                      {todo.reference_type}: {todo.reference_name}
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* Sidebar */}
      {selectedTodo !== null && (
        <TodoDetail
          key={sidebarMode === "create" ? "create" : selectedTodo.name}
          todo={sidebarMode === "create" ? null : selectedTodo}
          mode={sidebarMode}
          myEmail={myEmail}
          onClose={() => setSelectedTodo(null)}
          onSave={loadData}
          onDelete={handleDeleteTodo}
        />
      )}
    </div>
  );
}
