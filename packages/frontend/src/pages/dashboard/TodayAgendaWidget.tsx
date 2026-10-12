import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight } from "lucide-react";
import { fetchList } from "../../lib/erpnext";
import { resolveSessionUser } from "../../lib/session";
import { haalAgendas, eindTijd } from "../../lib/agenda-mailserver";
import { kerenInPeriode } from "../../lib/agenda-herhaling";
import { eventsForDay, type DashboardEvent } from "./today-events";
import type { Page } from "../../components/Sidebar";

interface AgendaItem { id: string; title: string; start: string; end?: string; allDay: boolean; source: string; }
const FIELDS = ["name", "subject", "starts_on", "ends_on", "all_day", "status", "repeat_this_event", "repeat_on", "repeat_till", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function TodayAgendaWidget({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setRefresh(value => value + 1), 60_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const day = localDay();
      const [native, mailbox] = await Promise.allSettled([
        Promise.all([
          fetchList<DashboardEvent>("Event", {
            fields: FIELDS, filters: [["status", "=", "Open"], ["repeat_this_event", "=", 0], ["starts_on", "<=", day + " 23:59:59"]],
            or_filters: [["ends_on", ">=", day + " 00:00:00"], ["starts_on", ">=", day + " 00:00:00"]],
            order_by: "starts_on asc", limit_page_length: 200,
          }),
          fetchList<DashboardEvent>("Event", {
            fields: FIELDS, filters: [["status", "=", "Open"], ["repeat_this_event", "=", 1], ["starts_on", "<=", day + " 23:59:59"]],
            or_filters: [["repeat_till", "is", "not set"], ["repeat_till", ">=", day]],
            limit_page_length: 200,
          }),
        ]),
        resolveSessionUser().then(user => user?.includes("@") ? haalAgendas(day, day, [user]) : { afspraken: [], mislukt: 0 }),
      ]);
      if (cancelled) return;
      const all: AgendaItem[] = [];
      if (native.status === "fulfilled") {
        for (const event of eventsForDay(native.value.flat(), day)) all.push({
          id: `erp-${event.name}-${event.starts_on}`, title: event.subject || t("agenda.no_title"),
          start: event.starts_on, end: event.ends_on, allDay: !!event.all_day, source: "ERPNext",
        });
      }
      if (mailbox.status === "fulfilled") {
        for (const event of mailbox.value.afspraken) {
          for (const occurrence of kerenInPeriode(event, day, day)) all.push({
            id: `mail-${event.id}-${occurrence.start}`, title: event.titel || t("agenda.no_title"),
            start: occurrence.start, end: eindTijd(occurrence.start, occurrence.duur),
            allDay: !!event.hele_dag, source: event.locatie || "",
          });
        }
      }
      const todayItems = eventsForDay(all.map(item => ({
        ...item, name: item.id, starts_on: item.start.replace("T", " "), ends_on: item.end?.replace("T", " "),
      })), day).map(event => ({ ...event, start: event.starts_on, end: event.ends_on }));
      setItems(todayItems.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)));
      setError(native.status === "rejected" || mailbox.status === "rejected" || (mailbox.status === "fulfilled" && mailbox.value.mislukt > 0));
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [refresh, t]);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <CalendarDays size={21} className="text-y-teal" />
        <button onClick={() => onNavigate?.("calendar")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("dashboard.todays_agenda")}</button>
        <ChevronRight size={16} className="ml-auto text-slate-500" />
      </div>
      {error && <div role="alert" className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2">{t("dashboard.error_load_data")}<button onClick={() => setRefresh(value => value + 1)} className="ml-2 underline cursor-pointer">{t("common.retry")}</button></div>}
      {loading ? <p className="text-sm text-slate-400 py-4">{t("common.loading")}</p>
        : items.length === 0 ? <p className="text-sm text-slate-400 py-5">{!error && t("dashboard.no_agenda_items")}</p>
        : items.slice(0, 8).map(item => (
          <button key={item.id} onClick={() => onNavigate?.("calendar")} className="y-agenda-item">
            <span className="text-[11px] text-slate-500 leading-5">{item.allDay ? t("agenda.all_day") : <>{item.start.slice(11, 16)}{item.end && <><br />– {item.end.slice(11, 16)}</>}</>}</span>
            <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-y-teal" />
            <span className="min-w-0"><span className="block text-sm font-medium text-slate-800 truncate">{item.title}</span><span className="block text-xs text-slate-500 mt-1 truncate">{item.source}</span></span>
          </button>
        ))}
    </div>
  );
}
