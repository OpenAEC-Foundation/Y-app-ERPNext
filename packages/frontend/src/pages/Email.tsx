import { useEffect, useState, useMemo } from "react";
import { fetchList } from "../lib/erpnext";
import { Mail, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Communication {
  name: string;
  subject: string;
  sender: string;
  recipients: string;
  communication_date: string;
  status: string;
}

interface DayStat {
  date: string;
  count: number;
}

export default function Email() {
  const { t } = useTranslation();
  const [emails, setEmails] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchList<Communication>("Communication", {
        fields: [
          "name",
          "subject",
          "sender",
          "recipients",
          "communication_date",
          "status",
        ],
        filters: [
          ["communication_type", "=", "Communication"],
          ["sent_or_received", "=", "Sent"],
        ],
        limit_page_length: 500,
        order_by: "communication_date desc",
      });
      setEmails(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const dailyStats: DayStat[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const email of emails) {
      const date = email.communication_date?.split(" ")[0];
      if (date) {
        map.set(date, (map.get(date) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }, [emails]);

  const maxCount = Math.max(...dailyStats.map((d) => d.count), 1);

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("email.statistics_title")}</h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
        {t("email.full_functionality_hint")}
        {t("email.sent_overview_hint")}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-100 rounded-lg">
              <Mail className="text-violet-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t("email.total_sent_loaded")}</p>
              <p className="text-3xl font-bold text-slate-800">
                {loading ? "..." : emails.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-100 rounded-lg">
              <Mail className="text-teal-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t("email.sent_today")}</p>
              <p className="text-3xl font-bold text-slate-800">
                {loading
                  ? "..."
                  : dailyStats.find(
                      (d) => d.date === new Date().toISOString().split("T")[0]
                    )?.count ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          {t("email.sent_emails_per_day")}
        </h3>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-slate-400">
            {t("common.loading")}
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400">
            {t("email.no_data_available")}
          </div>
        ) : (
          <div className="flex items-end gap-1 h-48">
            {[...dailyStats].reverse().map((day) => (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div className="absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {day.date}: {day.count}
                </div>
                <div
                  className="w-full bg-y-teal rounded-t hover:bg-y-teal transition-colors min-h-[2px]"
                  style={{ height: `${(day.count / maxCount) * 100}%` }}
                />
                <span className="text-[9px] text-slate-400 mt-1 -rotate-45 origin-top-left whitespace-nowrap">
                  {day.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("common.date")}
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">
                {t("email.amount_sent")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                  {t("common.loading")}
                </td>
              </tr>
            ) : (
              dailyStats.map((day) => (
                <tr
                  key={day.date}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm text-slate-700">{day.date}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">
                    {day.count}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
