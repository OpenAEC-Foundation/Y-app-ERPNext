import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import StartAppShortcuts from "../../components/StartAppShortcuts";
import { DndContext, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restoreWidgetLayout, splitWorkspaceWidgets } from "./layout";
import { getActiveInstanceId } from "../../lib/instances";
import { isFeatureEnabled } from "../../lib/capabilities";
import type { Page, ViewMode } from "../../components/Sidebar";
import UrenBoekenWidget from "../../components/UrenBoekenWidget";
import { type WidgetPlacement, type WidgetVisibility } from "./types";
import { SortableWidget } from "./SortableWidget";
import { WerkvoorraadWidget } from "./WerkvoorraadWidget";
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
  { id: "werkvoorraad", labelKey: "werkvoorraad.title", visibility: "employer" },
  { id: "projects", labelKey: "widget.project_search", visibility: "all" },
  { id: "my-tasks", labelKey: "widget.my_tasks", visibility: "all" },
  { id: "todos", labelKey: "widget.my_todos", visibility: "all" },
  { id: "email", labelKey: "dashboard.email", visibility: "all" },
  { id: "leave", labelKey: "dashboard.my_leave", visibility: "employee" },
  { id: "birthdays", labelKey: "dashboard.birthdays", visibility: "employee" },
  { id: "today-agenda", labelKey: "dashboard.todays_agenda", visibility: "all" },
];

/**
 * De oude e-mailwidget hangt aan de verdwenen Express-server.
 * Uitgeschakelde features worden zowel uit de widgetlijst als uit een
 * opgeslagen layout gefilterd — anders zou een bestaande layout ze alsnog
 * mounten en meteen falende calls doen. De overige widgets draaien op
 * `/api/resource` / `/api/method` en blijven ongemoeid.
 */
function isWidgetAvailable(id: string): boolean {
  if (id === "email") return isFeatureEnabled("webmail");
  return true;
}

function getWidgetsForMode(mode: string): { id: string; labelKey: string }[] {
  return ALL_WIDGET_DEFS.filter(
    (w) => (w.visibility === "all" || w.visibility === mode) && isWidgetAvailable(w.id)
  );
}

const DEFAULT_EMPLOYER_LAYOUT: WidgetPlacement[] = [
  { id: "time-booking", col: 0 },
  { id: "projects", col: 1 },
  { id: "km-booking", col: 0 },
  { id: "my-tasks", col: 1 },
  { id: "today-agenda", col: 1 },
  { id: "tasks", col: 0 },
  { id: "werkvoorraad", col: 0 },
  { id: "todos", col: 1 },
  { id: "email", col: 1 },
];

const DEFAULT_EMPLOYEE_LAYOUT: WidgetPlacement[] = [
  { id: "time-booking", col: 0 },
  { id: "projects", col: 1 },
  { id: "km-booking", col: 0 },
  { id: "my-tasks", col: 1 },
  { id: "today-agenda", col: 1 },
  { id: "leave", col: 0 },
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
      return restoreWidgetLayout(parsed, defaults, getWidgetsForMode(mode).map(w => w.id));
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
  utility = false,
}: {
  items: WidgetPlacement[];
  onNavigate: (page: Page) => void;
  onRemove: (id: string) => void;
  utility?: boolean;
}) {
  const ids = items.map((w) => w.id);

  function renderWidget(placement: WidgetPlacement) {
    const widgetId = placement.id;
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
      case "werkvoorraad":
        content = <WerkvoorraadWidget onNavigate={onNavigate} />;
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
      <SortableWidget key={widgetId} id={widgetId} column={placement.col} onRemove={() => onRemove(widgetId)}>
        {content}
      </SortableWidget>
    );
  }

  return (
    <SortableContext items={ids} strategy={rectSortingStrategy}>
      <div className={utility ? "y-dashboard-utility-widgets" : "y-dashboard-grid"}>
        {items.map(renderWidget)}
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
  const { t, i18n } = useTranslation();
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

  const { main, utility } = splitWorkspaceWidgets(layout);
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

    const next = arrayMove(layout, activeIdx, overIdx);
    const moved = next.findIndex(w => w.id === activeId);
    next[moved] = { ...next[moved], col: layout[overIdx].col };
    setLayout(next);
    saveLayout(next, mode);
  }

  return (
    <div className="y-dashboard p-4 sm:p-6 lg:p-7 space-y-4">
      <div className="y-dashboard-heading flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 min-w-0 truncate">{t("nav.dashboard")}</h2>
          <time className="y-dashboard-date text-sm text-slate-500" dateTime={new Date().toLocaleDateString("en-CA")}>
            {new Date().toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </time>
        </div>
        <div ref={addRef} className="relative shrink-0">
          <button
            onClick={() => setAddOpen((o) => !o)}
            aria-expanded={addOpen}
            aria-label={t("dashboard.manage_widgets")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg hover:border-y-teal hover:text-y-teal cursor-pointer"
          >
            <LayoutGrid size={16} />
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
                      <LayoutGrid size={12} className="text-y-teal" /> {t(w.labelKey)}
                    </button>
                  ))}
                </>
              ) : (
                <p className="px-4 py-2 text-sm text-slate-400">{t("dashboard.all_widgets_visible")}</p>
              )}
              {ALL_WIDGETS.length > 0 && (
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
        <div className="flex items-start gap-3 px-4 py-2 bg-blue-50 border-l-2 border-blue-300 rounded-r-lg text-xs text-blue-800">
          <span className="font-semibold shrink-0">Beta</span>
          <span dangerouslySetInnerHTML={{ __html: t("dashboard.beta_banner") }} />
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-2 bg-amber-50 border-l-2 border-amber-300 rounded-r-lg text-xs text-amber-800">
          <span className="font-semibold shrink-0">Alpha</span>
          <span dangerouslySetInnerHTML={{ __html: t("dashboard.alpha_banner") }} />
        </div>
      )}

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="y-dashboard-workplace">
          <WidgetColumn items={main} onNavigate={onNavigate} onRemove={handleRemove} />
          <aside className="y-dashboard-utilities" aria-label={t("start_apps.title")}>
            <section className="y-app-panel">
              <h3 className="font-semibold text-lg text-slate-800">{t("start_apps.title")}</h3>
              <StartAppShortcuts />
            </section>
            <WidgetColumn utility items={utility} onNavigate={onNavigate} onRemove={handleRemove} />
          </aside>
        </div>
      </DndContext>
    </div>
  );
}
