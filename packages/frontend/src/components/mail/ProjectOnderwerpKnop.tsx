import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban } from "lucide-react";
import { onderwerpMetProject, projectLabel, type ProjectOnderwerpModus } from "../../lib/project-onderwerp";

interface ProjectOptie {
  name: string;
  project_name?: string;
  customer_name?: string;
  status?: string;
}

const MODUS_KEY = "ynext_project_onderwerp_modus";
const LOPEND = new Set(["Open", "Working", "In Progress"]);

function leesModus(): ProjectOnderwerpModus {
  try {
    return localStorage.getItem(MODUS_KEY) === "vervang" ? "vervang" : "voor";
  } catch {
    return "voor";
  }
}

/**
 * De knop "Project" naast het onderwerp. Kies een project en het komt in de
 * onderwerpregel: vóór wat er al staat, of als het hele onderwerp. Die keuze
 * staat bovenin de lijst en wordt onthouden.
 */
export default function ProjectOnderwerpKnop({ projects, subject, onSubject, onOpen }: {
  projects: ReadonlyArray<ProjectOptie>;
  subject: string;
  onSubject: (onderwerp: string) => void;
  /** Wordt aangeroepen als de lijst opengaat, bijvoorbeeld om andere suggesties te sluiten. */
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const [modus, setModus] = useState<ProjectOnderwerpModus>(leesModus);

  const lijst = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const gevonden = q
      ? projects.filter((p) =>
          (p.project_name || "").toLowerCase().includes(q)
          || (p.name || "").toLowerCase().includes(q)
          || (p.customer_name || "").toLowerCase().includes(q))
      : projects.filter((p) => !p.status || LOPEND.has(p.status));
    return gevonden.slice(0, 20);
  }, [projects, zoek]);

  function kiesModus(nieuw: ProjectOnderwerpModus) {
    setModus(nieuw);
    try { localStorage.setItem(MODUS_KEY, nieuw); } catch { /* alleen gemak */ }
  }

  function kies(p: ProjectOptie) {
    onSubject(onderwerpMetProject(subject, p, modus));
    setOpen(false);
    setZoek("");
  }

  const modusKnop = (waarde: ProjectOnderwerpModus, label: string) => (
    <button type="button" onClick={() => kiesModus(waarde)} aria-pressed={modus === waarde}
      className={`flex-1 rounded px-2 py-1 text-[11px] font-medium cursor-pointer ${
        modus === waarde ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}>
      {label}
    </button>
  );

  return (
    <div className="relative shrink-0">
      <button type="button" title={t("webmail.subject_add_project")}
        onClick={() => { onOpen?.(); setOpen((v) => !v); }}
        className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded cursor-pointer">
        <FolderKanban size={13} /> {t("webmail.subject_add_project_short")}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-80 z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 space-y-2">
              <div role="group" aria-label={t("webmail.subject_project_mode")}
                className="flex gap-1 rounded-md bg-slate-100 p-0.5">
                {modusKnop("voor", t("webmail.subject_project_mode_prefix"))}
                {modusKnop("vervang", t("webmail.subject_project_mode_replace"))}
              </div>
              <input type="text" value={zoek} onChange={(e) => setZoek(e.target.value)}
                placeholder={t("hours_widget.search_project_placeholder")} autoFocus
                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              {lijst.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">{t("common.no_projects_found")}</p>
              )}
              {lijst.map((p) => {
                const label = projectLabel(p);
                const naam = label.slice(p.name.length).trim();
                return (
                  <button type="button" key={p.name} onClick={() => kies(p)} title={label}
                    className="w-full text-left px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center gap-2 border-b border-slate-50">
                    <FolderKanban size={13} className="text-teal-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                        <span className="font-mono text-violet-700 shrink-0">{p.name}</span>
                        <span className="truncate">{naam}</span>
                      </div>
                      {(p.customer_name || p.status) && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {p.customer_name && <span>{p.customer_name} · </span>}
                          {p.status}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
