import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, MapPin } from "lucide-react";
import { fetchList } from "../../lib/erpnext";
import { getActiveInstanceId } from "../../lib/instances";
import type { Page } from "../../components/Sidebar";

interface AgendaItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  location?: string;
  type: string;
}

const TYPE_COLORS: Record<string, string> = {
  event: "#3b82f6",
  meeting: "#7c3aed",
  o365: "#0078d4",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function getPrefKey(suffix: string): string {
  return `pref_${getActiveInstanceId()}_agenda_${suffix}`;
}

export function TodayAgendaWidget({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadToday = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const all: AgendaItem[] = [];

    try {
      // ERPNext events
      const erpEvents = await fetchList<{
        name: string; subject: string; starts_on: string; ends_on: string;
        all_day: number; location: string;
      }>("Event", {
        fields: ["name", "subject", "starts_on", "ends_on", "all_day", "location"],
        filters: [
          ["starts_on", ">=", key],
          ["starts_on", "<=", key + " 23:59:59"],
          ["status", "=", "Open"],
        ],
        limit_page_length: 50,
        order_by: "starts_on asc",
      }).catch(() => [] as any[]);

      for (const e of erpEvents) {
        all.push({
          id: `event-${e.name}`,
          title: e.subject || t("agenda.no_title"),
          start: e.starts_on,
          end: e.ends_on || undefined,
          allDay: !!e.all_day,
          color: TYPE_COLORS.event,
          location: e.location,
          type: "event",
        });
      }

      // ERPNext meetings
      try {
        const meetRes = await fetch("/api/meetings");
        const meetJson = await meetRes.json();
        const meetings = meetJson.data || meetJson || [];
        for (const m of meetings) {
          if (!m.date) continue;
          const mDate = m.date.split("T")[0];
          if (mDate !== key) continue;
          all.push({
            id: `meeting-${m.id}`,
            title: m.title || t("agenda.no_title"),
            start: m.date,
            allDay: !m.date.includes("T"),
            color: TYPE_COLORS.meeting,
            type: "meeting",
          });
        }
      } catch { /* meetings endpoint optional */ }

      // O365 calendar
      const o365Enabled = localStorage.getItem(getPrefKey("o365_enabled")) !== "false";
      if (o365Enabled) {
        const instanceId = getActiveInstanceId();
        let email = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
        if (!email) {
          try {
            const empRes = await fetchList<{ company_email: string; user_id: string }>("Employee", {
              fields: ["company_email", "user_id"],
              filters: [["status", "=", "Active"]],
              limit_page_length: 5,
            });
            for (const emp of empRes) {
              if (emp.company_email) { email = emp.company_email; break; }
              if (emp.user_id) { email = emp.user_id; break; }
            }
          } catch { /* ignore */ }
        }
        if (email) {
          try {
            const res = await fetch(`/api/calendar/o365?email=${encodeURIComponent(email)}&start=${key}&end=${key}`, { credentials: "same-origin" });
            if (res.ok) {
              const { data } = await res.json() as { data: Array<{
                id: string; subject: string; start: string; end: string;
                isAllDay: boolean; location: string;
              }> };
              for (const e of data) {
                all.push({
                  id: `o365-${e.id}`,
                  title: e.subject,
                  start: e.start,
                  end: e.end || undefined,
                  allDay: e.isAllDay,
                  color: TYPE_COLORS.o365,
                  location: e.location,
                  type: "o365",
                });
              }
            }
          } catch { /* O365 optional */ }
        }
      }

      // Sort: all-day first, then by start time
      all.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });

      setItems(all);
    } catch (err) {
      console.error("[TodayAgendaWidget] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadToday(); }, [loadToday]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={18} className="text-y-teal" />
        <button
          onClick={() => onNavigate?.("calendar")}
          className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer"
        >
          {t("dashboard.todays_agenda")} &rarr;
        </button>
        <span className="text-xs text-slate-400 ml-auto">
          {new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-y-teal" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">{t("dashboard.no_agenda_items")}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div
                className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: item.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 truncate">{item.title}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  {item.allDay ? (
                    <span>{t("agenda.all_day")}</span>
                  ) : (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} />
                      {formatTime(item.start)}
                      {item.end ? ` - ${formatTime(item.end)}` : ""}
                    </span>
                  )}
                  {item.location && (
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin size={10} />
                      {item.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
