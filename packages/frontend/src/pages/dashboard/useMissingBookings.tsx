import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { fetchList, fetchDocument, fetchChildTable } from "../../lib/erpnext";
import { useDataLoading } from "../../lib/DataContext";
import { isHoliday } from "../../lib/holidays";
import { getActiveEmployee } from "../../lib/instances";

const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Hook: detect missing bookings on previous workday */
export function useMissingBookings(): { missingHours: string | null; missingKm: string | null } {
  const { t, i18n } = useTranslation();
  const dataLoading = useDataLoading();
  const [missingHours, setMissingHours] = useState<string | null>(null);
  const [missingKm, setMissingKm] = useState<string | null>(null);
  const myEmployeeId = getActiveEmployee();

  useEffect(() => {
    if (dataLoading || !myEmployeeId) return;
    (async () => {
      try {
        const today = new Date();
        let prevDay = new Date(today);
        prevDay.setDate(prevDay.getDate() - 1);

        let workdays = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
        try {
          const assignments = await fetchList<{ shift_plan: string }>("Shift Plan Assignment", {
            fields: ["shift_plan"], filters: [["employee", "=", myEmployeeId]], limit_page_length: 1,
          });
          if (assignments.length > 0) {
            const plan = await fetchDocument<{ repeat_on_days: { day: string }[] }>("Shift Plan", assignments[0].shift_plan);
            if (plan.repeat_on_days?.length) workdays = new Set(plan.repeat_on_days.map(d => d.day));
          }
        } catch { /* default */ }

        for (let i = 0; i < 7; i++) {
          const dayName = DAY_NAMES_EN[prevDay.getDay()];
          const dateStr = prevDay.toISOString().split("T")[0];
          if (workdays.has(dayName) && !isHoliday(dateStr, prevDay.getFullYear())) break;
          prevDay.setDate(prevDay.getDate() - 1);
        }

        const prevDateStr = prevDay.toISOString().split("T")[0];
        const localeMap: Record<string, string> = { nl: "nl-NL", en: "en-US", de: "de-DE" };
        const label = prevDay.toLocaleDateString(localeMap[i18n.language] || "nl-NL", { weekday: "long", day: "numeric", month: "long" });

        // Find timesheets that could contain the previous workday — bound to 5
        // because we only need to know "is there at least one?", not the full list.
        const timesheets = await fetchList<{ name: string }>("Timesheet", {
          fields: ["name"],
          filters: [["employee", "=", myEmployeeId], ["start_date", "<=", prevDateStr], ["end_date", ">=", prevDateStr], ["docstatus", "!=", 2]],
          limit_page_length: 5, order_by: "start_date desc",
        });

        // Old code did one fetchDocument() per timesheet to peek at time_logs.
        // Replaced with a single Timesheet Detail list query: filter by
        // parent IN [...] AND from_time within prevDateStr. limit 1 because
        // we only need to know if any row exists.
        // Frappe v16 403's a plain /api/resource list query against a
        // child-table doctype like "Timesheet Detail" — even with a
        // parenttype filter — so this goes through fetchChildTable's
        // frappe.client.get_list(parent=...) RPC instead (verified against
        // a live v16 instance; see lib/erpnext.ts for details).
        let hasHours = false;
        if (timesheets.length > 0) {
          const detailRows = await fetchChildTable<{ name: string }>(
            "Timesheet Detail", "Timesheet",
            ["name"],
            [
              ["parent", "in", timesheets.map(ts => ts.name)],
              ["from_time", ">=", `${prevDateStr} 00:00:00`],
              ["from_time", "<=", `${prevDateStr} 23:59:59`],
            ],
            1
          );
          hasHours = detailRows.length > 0;
        }
        if (!hasHours) {
          setMissingHours(t("dashboard.missing_hours", { date: label }));
        }

        const travelReqs = await fetchList<{ name: string }>("Travel Request", {
          fields: ["name"],
          filters: [["employee", "=", myEmployeeId], ["custom_from_date", "<=", prevDateStr], ["custom_to_date", ">=", prevDateStr], ["docstatus", "!=", 2]],
          limit_page_length: 1,
        });
        let hasKm = false;
        if (travelReqs.length > 0) {
          try {
            const tr = await fetchDocument<{ itinerary: { departure_date: string }[] }>("Travel Request", travelReqs[0].name);
            hasKm = (tr.itinerary || []).some(it => (it.departure_date || "").startsWith(prevDateStr));
          } catch { /* ignore */ }
        }
        if (!hasKm) setMissingKm(t("dashboard.missing_km", { date: label }));
      } catch { /* ignore */ }
    })();
  }, [dataLoading, myEmployeeId, t, i18n.language]);

  return { missingHours, missingKm };
}

/** Small inline warning banner */
export function BookingWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
      <span className="text-xs text-amber-700">{message}</span>
    </div>
  );
}
