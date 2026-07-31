import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cake } from "lucide-react";
import { useEmployees } from "../../lib/DataContext";

export function BirthdayWidget() {
  const { t } = useTranslation();
  const employees = useEmployees();
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return employees.filter(e => e.status === "Active" && e.date_of_birth).map(e => {
      const dob = new Date(e.date_of_birth);
      const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      nextBday.setHours(0, 0, 0, 0);
      if (nextBday < today) nextBday.setFullYear(nextBday.getFullYear() + 1);
      return { ...e, daysUntil: Math.floor((nextBday.getTime() - today.getTime()) / 86400000), age: nextBday.getFullYear() - dob.getFullYear() };
    }).filter(e => e.daysUntil >= 0 && e.daysUntil <= 30).sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cake size={18} className="text-y-teal" />
        <h3 className="font-semibold text-slate-800">{t("dashboard.birthdays")}</h3>
      </div>
      {upcomingBirthdays.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">{t("dashboard.no_birthdays")}</p>
      ) : (
        <div className="space-y-2">{upcomingBirthdays.map(e => (
          <div key={e.name} className="flex items-center justify-between text-sm">
            <span className="text-slate-700">{e.employee_name}</span>
            <span className="text-xs text-slate-400">{e.daysUntil === 0 ? `🎂 ${t("dashboard.today")}` : `${t("dashboard.in_n_days", { n: e.daysUntil })} (${e.age})`}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}
