import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { getActiveInstanceId } from "../../lib/instances";
import { isFeatureEnabled } from "../../lib/capabilities";
import type { Page, ViewMode } from "../../components/Sidebar";
import UrenBoekenWidget from "../../components/UrenBoekenWidget";
import { type WidgetPlacement, type WidgetVisibility } from "./types";
import { SortableWidget } from "./SortableWidget";
import { BookingWarning, useMissingBookings } from "./useMissingBookings";
import { EmailWidget } from "./EmailWidget";
import { LeaveWidget } from "./LeaveWidget";
import { BirthdayWidget } from "./BirthdayWidget";
import { ProjectSearch } from "./ProjectSearch";
import { QuickKmBooking } from "./QuickKmBooking";
import { MyTodoList } from "./MyTodoList";
import { TaskList } from "./TaskList";
import { TodayAgendaWidget } from "./TodayAgendaWidget";

// Re-export QuickKmBooking so external imports keep working
export { QuickKmBooking } from "./QuickKmBooking";

/* ─── Widget config ─── */

const ALL_WIDGET_DEFS: { id: string; labelKey: string; visibility: WidgetVisibility }[] = [
  { id: "time-booking", labelKey: "widget.time_booking", visibility: "all" },
  { id: "km-booking", labelKey: "widget.km_booking", visibility: "all" },
  { id: "tasks", labelKey: "widget.tasks_all", visibility: "employer" },
  { id: "projects", labelKey: "widget.project_search", visibility: "all" },
  { id: "my-tasks", labelKey: "widget.my_tasks", visibility: "all" },
  { id: "todos", labelKey: "widget.my_todos", visibility: "all" },
  { id: "email", labelKey: "dashboard.email", visibility: "all" },
  { id: "leave", labelKey: "dashboard.my_leave", visibility: "employee" },
  { id: "birthdays", labelKey: "dashboard.birthdays", visibility: "employee" },
  { id: "today-agenda", labelKey: "dashboard.todays_agenda", visibility: "all" },
];

/**
 * Twee widgets hangen aan endpoints die alleen de verdwenen Express-server
 * kende: de e-mailwidget (`/api/mail/*`) en de vandaag-agenda (`/api/calendar/*`).
 * Zolang die features uit staan worden ze zowel uit de widgetlijst als uit een
 * opgeslagen layout gefilterd — anders zou een bestaande layout ze alsnog
 * mounten en meteen falende calls doen. De overige widgets draaien op
 * `/api/resource` / `/api/method` en blijven ongemoeid.
 */
function isWidgetAvailable(id: string): boolean {
  if (id === "email") return isFeatureEnabled("webmail");
  if (id === "today-agenda") return isFeatureEnabled("calendar-bridge");
  return true;
}

function getWidgetsForMode(mode: string): { id: string; labelKey: string }[] {
  return ALL_WIDGET_DEFS.filter(
    (w) => (w.visibility === "all" || w.visibility === mode) && isWidgetAvailable(w.id)
  );
}

const DEFAULT_EMPLOYER_LAYOUT: WidgetPlacement[] = [
  { id: "time-booking", col: 0 },
  { id: "km-booking", col: 0 },
  { id: "tasks", col: 0 },
  { id: "today-agenda", col: 0 },
  { id: "projects", col: 1 },
  { id: "my-tasks", col: 1 },
  { id: "todos", col: 1 },
  { id: "email", col: 1 },
];

const DEFAULT_EMPLOYEE_LAYOUT: WidgetPlacement[] = [
  { id: "time-booking", col: 0 },
  { id: "km-booking", col: 0 },
  { id: "leave", col: 0 },
  { id: "today-agenda", col: 0 },
  { id: "projects", col: 1 },
  { id: "my-tasks", col: 1 },
  { id: "todos", col: 1 },
  { id: "email", col: 1 },
  { id: "birthdays", col: 1 },
];

function getLayoutKey(mode: string): string {
  return `pref_${getActiveInstanceId()}_dashboard_widgets_${mode}`;
}

function getDefaultLayout(mode: string): WidgetPlacement[] {
  const base = mode === "employee" ? DEFAULT_EMPLOYEE_LAYOUT : DEFAULT_EMPLOYER_LAYOUT;
  return base.filter((w) => isWidgetAvailable(w.id));
}

function loadLayout(mode: string): WidgetPlacement[] {
  const defaults = getDefaultLayout(mode);
  try {
    const raw = localStorage.getItem(getLayoutKey(mode));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const saved = (parsed as WidgetPlacement[]).filter((w) => isWidgetAvailable(w.id));
        const savedIds = new Set(saved.map((w) => w.id));
        const missing = defaults.filter(w => !savedIds.has(w.id));
        if (missing.length > 0) return [...saved, ...missing];
        return saved;
      }
    }
  } catch { /* use default */ }
  return defaults;
}

function saveLayout(layout: WidgetPlacement[], mode: string) {
  localStorage.setItem(getLayoutKey(mode), JSON.stringify(layout));
}

/* ─── Inner widget wrappers (no outer card, used inside SortableWidget) ─── */

function QuickTimeBookingInner({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { missingHours } = useMissingBookings();
  return (
    <>
      <BookingWarning message={missingHours} />
      <UrenBoekenWidget showWeekTable={false} onHeaderClick={onNavigate ? () => onNavigate("timesheets") : undefined} />
    </>
  );
}

/* ─── Droppable Column ─── */

function WidgetColumn({
  items,
  onNavigate,
  onRemove,
}: {
  items: WidgetPlacement[];
  onNavigate: (page: Page) => void;
  onRemove: (id: string) => void;
}) {
  const ids = items.map((w) => w.id);

  function renderWidget(widgetId: string) {
    // Vangnet: een layout uit een eerdere fase kan nog een uitgeschakelde
    // widget bevatten. Nooit mounten — die zou meteen falende calls doen.
    if (!isWidgetAvailable(widgetId)) return null;

    let content: React.ReactNode;

    switch (widgetId) {
      case "time-booking":
        content = <QuickTimeBookingInner onNavigate={onNavigate} />;
        break;
      case "km-booking":
        content = <QuickKmBooking onHeaderClick={() => onNavigate("expenses")} />;
        break;
      case "tasks":
        content = <TaskList onNavigate={onNavigate} />;
        break;
      case "projects":
        content = <ProjectSearch onNavigate={onNavigate} />;
        break;
      case "my-tasks":
        content = <MyTodoList filterMode="tasks" onNavigate={onNavigate} />;
        break;
      case "todos":
        content = <MyTodoList filterMode="todos" onNavigate={onNavigate} />;
        break;
      case "email":
        content = <EmailWidget onNavigate={onNavigate} />;
        break;
      case "leave":
        content = <LeaveWidget onNavigate={onNavigate} />;
        break;
      case "birthdays":
        content = <BirthdayWidget />;
        break;
      case "today-agenda":
        content = <TodayAgendaWidget onNavigate={onNavigate} />;
        break;
      default:
        return null;
    }

    return (
      <SortableWidget key={widgetId} id={widgetId} onRemove={() => onRemove(widgetId)}>
        {content}
      </SortableWidget>
    );
  }

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div className="space-y-4 sm:space-y-6">
        {items.map((w) => renderWidget(w.id))}
      </div>
    </SortableContext>
  );
}

/* ─── Main Dashboard ─── */

interface DashboardProps {
  onNavigate: (page: Page) => void;
  viewMode: ViewMode;
}

export default function Dashboard({ onNavigate, viewMode }: DashboardProps) {
  const { t } = useTranslation();
  const mode = viewMode || "employer";
  const [layout, setLayout] = useState<WidgetPlacement[]>(() => loadLayout(mode));
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Reload layout when viewMode changes
  useEffect(() => {
    setLayout(loadLayout(mode));
  }, [mode]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const ALL_WIDGETS = getWidgetsForMode(mode);

  const leftWidgets = layout.filter((w) => w.col === 0);
  const rightWidgets = layout.filter((w) => w.col === 1);
  const hiddenWidgets = ALL_WIDGETS.filter((w) => !layout.find((l) => l.id === w.id));

  function handleRemove(id: string) {
    const next = layout.filter((w) => w.id !== id);
    setLayout(next);
    saveLayout(next, mode);
  }

  function handleAdd(id: string) {
    const next = [...layout, { id, col: 1 }];
    setLayout(next);
    saveLayout(next, mode);
    setAddOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeIdx = layout.findIndex((w) => w.id === activeId);
    const overIdx = layout.findIndex((w) => w.id === overId);

    if (activeIdx === -1 || overIdx === -1) return;

    // Move the active widget to the same column as the over widget
    const targetCol = layout[overIdx].col;

    // Get all widgets in the target column (including the moved one placed at target col)
    const newLayout = [...layout];
    newLayout[activeIdx] = { ...newLayout[activeIdx], col: targetCol };

    // Now reorder within the full layout: extract column items, reorder, put back
    const colItems = newLayout
      .map((w, i) => ({ ...w, _origIdx: i }))
      .filter((w) => w.col === targetCol);

    const colActiveIdx = colItems.findIndex((w) => w.id === activeId);
    const colOverIdx = colItems.findIndex((w) => w.id === overId);

    if (colActiveIdx !== -1 && colOverIdx !== -1) {
      const reordered = arrayMove(colItems, colActiveIdx, colOverIdx);
      // Rebuild layout: non-target-col items stay, target-col items get reordered
      const otherItems = newLayout.filter((w) => w.col !== targetCol);
      const finalLayout = [
        ...otherItems,
        ...reordered.map((w) => ({ id: w.id, col: w.col })),
      ];
      // Preserve original ordering: left col first, then right col
      const sorted = [
        ...finalLayout.filter((w) => w.col === 0),
        ...finalLayout.filter((w) => w.col === 1),
      ];
      setLayout(sorted);
      saveLayout(sorted, mode);
    } else {
      setLayout(newLayout);
      saveLayout(newLayout, mode);
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 min-w-0 truncate">{t("nav.dashboard")}</h2>
        <div ref={addRef} className="relative shrink-0">
          <button
            onClick={() => setAddOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg hover:border-y-teal hover:text-y-teal cursor-pointer"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">
              {hiddenWidgets.length > 0 ? t("dashboard.add_widget_count", { n: hiddenWidgets.length }) : t("dashboard.manage_widgets")}
            </span>
            <span className="sm:hidden">
              {hiddenWidgets.length > 0 ? `+ ${hiddenWidgets.length}` : ""}
            </span>
          </button>
          {addOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[220px] max-w-[90vw]">
              {hiddenWidgets.length > 0 ? (
                <>
                  <p className="px-4 py-1 text-[10px] text-slate-400 uppercase">{t("common.add")}</p>
                  {hiddenWidgets.map((w) => (
                    <button key={w.id} onClick={() => handleAdd(w.id)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-2">
                      <Plus size={12} className="text-y-teal" /> {t(w.labelKey)}
                    </button>
                  ))}
                </>
              ) : (
                <p className="px-4 py-2 text-sm text-slate-400">{t("dashboard.all_widgets_visible")}</p>
              )}
              {layout.length > 0 && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <p className="px-4 py-1 text-[10px] text-slate-400 uppercase">Reset</p>
                  <button onClick={() => { const defaults = getDefaultLayout(mode); setLayout(defaults); saveLayout(defaults, mode); setAddOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 cursor-pointer">
                    {t("dashboard.restore_default_layout")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Beta/alpha banner */}
      {mode === "employee" ? (
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="font-semibold shrink-0">Beta</span>
          <span dangerouslySetInnerHTML={{ __html: t("dashboard.beta_banner") }} />
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="font-semibold shrink-0">Alpha</span>
          <span dangerouslySetInnerHTML={{ __html: t("dashboard.alpha_banner") }} />
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          <WidgetColumn items={leftWidgets} onNavigate={onNavigate} onRemove={handleRemove} />
          <WidgetColumn items={rightWidgets} onNavigate={onNavigate} onRemove={handleRemove} />
        </div>
      </DndContext>
    </div>
  );
}
