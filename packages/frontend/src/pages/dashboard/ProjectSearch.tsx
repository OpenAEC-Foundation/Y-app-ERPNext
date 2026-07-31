import { useState, useMemo } from "react";
import { FolderKanban, Search, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjects } from "../../lib/DataContext";
import { getErpNextLinkUrl } from "../../lib/erpnext";
import type { Page } from "../../components/Sidebar";

export function ProjectSearch({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t } = useTranslation();
  const projects = useProjects();
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const open = projects.filter((p) => p.status === "Open");
    if (!search.trim()) return open.slice(0, 10);
    const q = search.toLowerCase();
    return open.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.project_name?.toLowerCase().includes(q) ||
        p.company?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [projects, search]);

  const statusColor: Record<string, string> = {
    Open: "bg-y-teal/10 text-y-teal-dark",
    Completed: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
    "Pending Review": "bg-purple-100 text-purple-700",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <FolderKanban size={18} className="text-y-teal" />
        <button onClick={() => onNavigate("projects")} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("dashboard.project_search_title")} &rarr;</button>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("dashboard.project_search_placeholder")}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal text-sm"
        />
      </div>

      {results.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">{t("dashboard.project_search_no_results")}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {results.map((p) => (
            <a
              key={p.name}
              href={`${getErpNextLinkUrl()}/project/${p.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 group"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-y-teal group-hover:underline">
                    {p.name} {p.project_name && p.project_name !== p.name ? p.project_name : ""}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {p.status}
                  </span>
                </div>
                {p.company && <p className="text-xs text-slate-400">{p.company}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                {p.percent_complete > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-y-teal rounded-full" style={{ width: `${Math.min(p.percent_complete, 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{Math.round(p.percent_complete)}%</span>
                  </div>
                )}
                <ExternalLink size={14} className="text-slate-300 group-hover:text-y-teal" />
              </div>
            </a>
          ))}
        </div>
      )}

    </div>
  );
}
