import { useState, useEffect, useMemo, useRef } from "react";
import { FolderKanban, X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ProjectRecord } from "../../lib/DataContext";
import { isSentParent } from "../../lib/sent-detect";

/* ─── Create Folder Modal (F06) ─── */

export default function CreateFolderModal({ parentPath, projects, onConfirm, onCancel }: {
  parentPath: string;
  projects: ProjectRecord[];
  onConfirm: (folderName: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState("");
  const [linkProject, setLinkProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const prefix = isSentParent(parentPath) ? "[OUT]" : "[IN]";

  const activeProjects = useMemo(
    () => projects.filter(p =>
      p.status === "Open" || p.status === "Working" || p.status === "In Progress"
    ),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return activeProjects.slice(0, 20);
    const q = projectSearch.toLowerCase();
    return activeProjects
      .filter(p =>
        (p.project_name || "").toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.customer_name || "").toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [activeProjects, projectSearch]);


  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const close = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showDropdown]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (showDropdown && searchRef.current) searchRef.current.focus();
  }, [showDropdown]);

  const selectedProjectObj = selectedProject
    ? projects.find(p => p.name === selectedProject)
    : null;

  return (
    // Bewust een lichte sluier (10%) in plaats van de gebruikelijke 40%: de
    // mailtekst eronder moet leesbaar blijven terwijl dit venster open staat —
    // je opent het juist om iets uit die mail over te nemen. De schaduw en de
    // rand van het paneel doen het scheiden, niet het verduisteren.
    <div className="fixed inset-0 bg-slate-900/10 flex items-center justify-center z-50"
      onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/10 w-[420px] max-w-[95vw]"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">
            {t("webmail.create_folder_title")}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("webmail.create_folder_parent", { parent: parentPath || "INBOX" })}
          </p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Project toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={linkProject}
              onChange={e => {
                setLinkProject(e.target.checked);
                if (!e.target.checked) {
                  setSelectedProject("");
                  setFolderName("");
                }
              }}
              className="rounded border-slate-300 text-blue-500"
            />
            <span className="text-sm text-slate-700">
              {t("webmail.link_to_project")}
            </span>
          </label>

          {/* Project picker */}
          {linkProject && (
            <div className="relative" ref={dropdownRef}>
              {selectedProjectObj ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                  <FolderKanban size={14} className="text-teal-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-teal-800 truncate">
                      {selectedProjectObj.project_name || selectedProjectObj.name}
                    </div>
                    <div className="text-[10px] text-teal-600 truncate">
                      {selectedProjectObj.name}
                      {selectedProjectObj.customer ? ` \u2014 ${selectedProjectObj.customer}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedProject(""); setFolderName(""); }}
                    className="text-teal-400 hover:text-teal-600 cursor-pointer flex-shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-colors"
                >
                  <Search size={14} />
                  {t("webmail.select_project")}
                </button>
              )}

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-[240px] overflow-hidden flex flex-col">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input
                      ref={searchRef}
                      type="text"
                      value={projectSearch}
                      onChange={e => setProjectSearch(e.target.value)}
                      placeholder={t("webmail.search_project")}
                      className="w-full text-sm border-0 outline-none bg-transparent placeholder:text-slate-400"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredProjects.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        {t("common.no_projects_found")}
                      </p>
                    ) : (
                      filteredProjects.map(p => (
                        <button
                          key={p.name}
                          onClick={() => {
                            // Auto-fill de mapnaam bij het KIEZEN van een project
                            // (event-driven), niet via een effect op [projects] —
                            // dat overschreef anders een handmatig getypte naam bij
                            // een achtergrond-project-refresh (bug #6).
                            setSelectedProject(p.name);
                            const num = p.name.replace(/^PROJ-/, "");
                            setFolderName(`${prefix} ${num} ${p.project_name}`);
                            setShowDropdown(false);
                            setProjectSearch("");
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2 transition-colors"
                        >
                          <FolderKanban size={12} className="text-slate-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-700 truncate">
                              {p.project_name || p.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {p.name}
                              {p.customer ? ` \u2014 ${p.customer}` : ""}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Folder name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("webmail.folder_name_prompt")}
            </label>
            <input
              type="text"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder={linkProject ? `${prefix} 0001 \u2014 Project name` : t("webmail.folder_name_placeholder")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus={!linkProject}
              onKeyDown={e => {
                if (e.key === "Enter" && folderName.trim()) {
                  onConfirm(folderName.trim());
                }
              }}
            />
            {linkProject && selectedProject && (
              <p className="text-[10px] text-slate-400 mt-1">
                {t("webmail.folder_prefix_hint", { prefix })}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => folderName.trim() && onConfirm(folderName.trim())}
            disabled={!folderName.trim()}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("webmail.create_folder_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
