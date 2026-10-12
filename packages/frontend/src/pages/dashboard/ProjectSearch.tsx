import { useState, useMemo } from "react";
import { Folder, Search, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjects } from "../../lib/DataContext";
import { getErpNextLinkUrl } from "../../lib/erpnext";
import type { Page } from "../../components/Sidebar";

export function ProjectSearch({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t, i18n } = useTranslation();
  const projects = useProjects();
  const [search, setSearch] = useState("");
  const results = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return projects.filter(p => p.status === "Open" && (!q ||
      [p.name, p.project_name, p.company, p.customer_name, p.customer].some(value => value?.toLocaleLowerCase().includes(q))
    )).slice(0, 10);
  }, [projects, search]);
  const date = (value?: string) => {
    if (!value) return "—";
    const parsed = new Date(value.slice(0, 10) + "T12:00:00");
    return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(i18n.language);
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <Folder size={21} className="text-y-teal" />
        <button onClick={() => onNavigate("projects")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("dashboard.project_search_title")}</button>
      </div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={search} onChange={e => setSearch(e.target.value)}
          aria-label={t("dashboard.project_search_title")} placeholder={t("dashboard.project_search_placeholder")}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
      </div>
      <div className="y-project-table-scroll">
        <table className="y-project-table">
          <caption className="sr-only">{t("dashboard.project_search_title")}</caption>
          <thead><tr>
            <th scope="col">{t("hours_widget.project")}</th><th scope="col">{t("common.name")}</th>
            <th scope="col">{t("common.customer")}</th><th scope="col">{t("common.status")}</th>
            <th scope="col">{t("projects.col_start_date")}</th><th scope="col">{t("projects.col_end_date")}</th>
            <th scope="col"><span className="sr-only">{t("common.open_in_erpnext")}</span></th>
          </tr></thead>
          <tbody>
            {results.map(p => (
              <tr key={p.name}>
                <td><a className="hover:underline text-blue-700 font-medium" href={`${getErpNextLinkUrl()}/project/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer">{p.name}</a></td>
                <td title={p.project_name}>{p.project_name || p.name}{p.percent_complete > 0 && <span className="ml-2 text-[10px] text-slate-400">{Math.round(p.percent_complete)}%</span>}</td>
                <td>{p.customer_name || p.customer || "—"}</td>
                <td><span className="bg-emerald-50 text-emerald-700 rounded px-2 py-1">{t("common.open", { defaultValue: p.status })}</span></td>
                <td>{date(p.expected_start_date)}</td><td>{date(p.expected_end_date)}</td>
                <td><a href={`${getErpNextLinkUrl()}/project/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer"
                  aria-label={`${t("common.open_in_erpnext")}: ${p.project_name || p.name}`} className="inline-flex text-slate-400 hover:text-blue-600"><ExternalLink size={14} /></a></td>
              </tr>
            ))}
            {results.length === 0 && <tr><td colSpan={7} className="!text-slate-400 text-center !py-6">{t("dashboard.project_search_no_results")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
