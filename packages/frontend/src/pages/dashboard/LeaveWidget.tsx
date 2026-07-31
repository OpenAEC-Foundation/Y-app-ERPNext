import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Palmtree } from "lucide-react";
import { useLeaves } from "../../lib/DataContext";
import type { Page } from "../../components/Sidebar";
import { getActiveEmployee } from "../../lib/instances";

export function LeaveWidget({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t } = useTranslation();
  const leaves = useLeaves();
  const myEmployeeId = getActiveEmployee();
  const myLeaveStats = useMemo(() => {
    const year = new Date().getFullYear();
    const myLeaves = leaves.filter(l => l.employee === myEmployeeId && l.status === "Approved" && l.from_date.startsWith(String(year)));
    const totalDays = myLeaves.reduce((s, l) => s + (l.total_leave_days || 0), 0);
    const byType = new Map<string, number>();
    for (const l of myLeaves) byType.set(l.leave_type, (byType.get(l.leave_type) || 0) + (l.total_leave_days || 0));
    return { totalDays, byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]) };
  }, [leaves, myEmployeeId]);
  const onLeaveToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return leaves.filter(l => l.status === "Approved" && l.from_date <= today && l.to_date >= today).map(l => l.employee_name);
  }, [leaves]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Palmtree size={18} className="text-y-teal" />
        <button onClick={() => onNavigate("leave")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("dashboard.my_leave_year", { year: new Date().getFullYear() })} &rarr;</button>
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-3">{myLeaveStats.totalDays} <span className="text-base font-normal text-slate-400">{t("dashboard.days_taken")}</span></div>
      {myLeaveStats.byType.length > 0 ? (
        <div className="space-y-2">{myLeaveStats.byType.map(([type, days]) => (
          <div key={type} className="flex items-center justify-between text-sm"><span className="text-slate-600">{type}</span><span className="font-semibold text-slate-700">{t("common.days_count", { count: days })}</span></div>
        ))}</div>
      ) : <p className="text-sm text-slate-400">{t("dashboard.no_leave_taken")}</p>}
      {onLeaveToday.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-1">{t("dashboard.absent_today")}</p>
          <div className="flex flex-wrap gap-1.5">{onLeaveToday.map(name => (
            <span key={name} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{name}</span>
          ))}</div>
        </div>
      )}
    </div>
  );
}
