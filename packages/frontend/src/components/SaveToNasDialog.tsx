import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, FolderOpen, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchList } from "../lib/erpnext";
import {
  loadConfig,
  saveConfig,
  hydrateNasConfig,
  resolveTemplate,
  buildTemplateVars,
  sanitizeForFilesystem,
  type NasConfig,
} from "../lib/nasConfig";
import {
  getCompanyHandle,
  setCompanyHandle,
  pickNasRoot,
  ensureHandlePermission,
  getOrCreateSubdir,
  findNextNumber,
  writeFileSafe,
  isFsaSupported,
} from "../lib/nasStorage";
import { matchProjectFromFolder } from "../lib/project-folder-match";

interface AttachmentInfo {
  index: number;
  filename: string;
  size: number;
}

interface ProjectRow {
  name: string;
  project_name: string;
  company: string;
  status?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  subject: string;
  from?: string;
  attachments: AttachmentInfo[];
  /** Caller supplies the fetcher because URL-building requires mail-config state */
  fetchAttachmentBytes: (index: number) => Promise<ArrayBuffer>;
  onToast?: (msg: string) => void;
  /** Project linked via ERPNext communication / project_link (groene chip) — wordt vóór folder-match gebruikt voor auto-select. */
  linkedProjectName?: string;
  /** Huidige mailfolder pad (bv. "INBOX/[IN] 3001 JM24-026 CLT Offemweg 8") — gebruikt voor token-match auto-select. */
  currentFolder?: string;
}


type Status = "idle" | "saving" | "done" | "error";

interface SaveError {
  filename: string;
  error: string;
}

export function SaveToNasDialog({
  open,
  onClose,
  instanceId,
  subject,
  from,
  attachments,
  fetchAttachmentBytes,
  onToast,
  linkedProjectName,
  currentFolder,
}: Props) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProjectRow | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<SaveError[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [previewNextNr, setPreviewNextNr] = useState<number>(1);
  // Toont "scant…" i.p.v. een (mogelijk misleidend) getal zolang de scan naar
  // het hoogste bestaande volgnummer nog loopt — vooral op een netwerkschijf
  // (UNC/SMB) kan die scan écht een paar honderd ms tot seconden duren, en
  // zonder indicator lijkt de initiële "1" een stabiele (foute) uitkomst i.p.v.
  // een tussenstand. Bug van Piet: verwachtte 25 (24 bestaande mappen), zag 1.
  const [scanningNr, setScanningNr] = useState(false);
  // Inline map-keuze: medewerkers kunnen hun NAS-hoofdmap hier kiezen i.p.v. via
  // de werkgever-only Settings-tab (waar ze niet bij kunnen).
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  // Cfg uit localStorage + server-hydrate bij open zodat een wijziging op een
  // ander device direct doorkomt in de live preview (template/submap).
  const [cfg, setCfg] = useState<NasConfig>(() => loadConfig(instanceId));
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    hydrateNasConfig().then(() => {
      if (cancelled) return;
      setCfg(loadConfig(instanceId));
    });
    return () => {
      cancelled = true;
    };
  }, [open, instanceId]);

  // Load projects when dialog opens — geen status-filter zodat ook
  // Completed/Cancelled projecten geselecteerd kunnen worden (correspondentie
  // komt vaak na afsluiting binnen).
  useEffect(() => {
    if (!open) return;
    fetchList<ProjectRow>("Project", {
      fields: ["name", "project_name", "company", "status"],
      limit_page_length: 0,
      order_by: "name desc",
    })
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [open]);

  // Auto-select project: eerst via linkedProjectName (groene chip),
  // anders via folder-naam token-match.
  useEffect(() => {
    if (!open || projects.length === 0 || selected) return;
    if (linkedProjectName) {
      const linked = projects.find((p) => p.name === linkedProjectName);
      if (linked) {
        setSelected(linked);
        setSearch(`${linked.name} — ${linked.project_name}`);
        return;
      }
    }
    if (currentFolder) {
      const match = matchProjectFromFolder(currentFolder, projects);
      if (match) {
        setSelected(match);
        setSearch(`${match.name} — ${match.project_name}`);
      }
    }
  }, [open, projects, linkedProjectName, currentFolder, selected]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setSearch("");
      setStatus("idle");
      setProgress({ done: 0, total: 0 });
      setErrors([]);
      setErrorMsg(null);
      setHandleAvailable(null);
      setPicking(false);
      setPickError(null);
    }
  }, [open]);

  // Check if handle is configured for the selected project's company
  useEffect(() => {
    if (!selected) {
      setHandleAvailable(null);
      return;
    }
    getCompanyHandle(instanceId, selected.company)
      .then((h) => setHandleAvailable(!!h))
      .catch(() => setHandleAvailable(false));
  }, [selected, instanceId]);

  // Preview-time scan: lees bestaande volgnummers uit correspondentie-map zodat
  // de preview het juiste volgnummer toont (bv. 014 i.p.v. hardcoded 001).
  // Werkt alleen als FSA-permission al granted is — anders fallback 1.
  useEffect(() => {
    if (!open || !selected || handleAvailable !== true) {
      setPreviewNextNr(1);
      setScanningNr(false);
      return;
    }
    let cancelled = false;
    setScanningNr(true);
    (async () => {
      try {
        const root = await getCompanyHandle(instanceId, selected.company);
        if (!root) return;
        const h = root as FileSystemDirectoryHandle & {
          queryPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
        };
        if (h.queryPermission) {
          const state = await h.queryPermission({ mode: "readwrite" });
          if (state !== "granted") return; // geen scan zonder permission
        }
        const projectFolder = sanitizeForFilesystem(
          `${selected.name} ${selected.project_name}`,
        );
        const sub = cfg.correspondenceSubdir.replace(/^\/+|\/+$/g, "");
        const subSegments = sub.split(/[/\\]/).filter(Boolean);
        let dir: FileSystemDirectoryHandle = root;
        for (const seg of [projectFolder, ...subSegments]) {
          try {
            dir = await dir.getDirectoryHandle(seg, { create: false });
          } catch {
            // Map bestaat nog niet → eerste entry wordt 1
            if (!cancelled) setPreviewNextNr(1);
            return;
          }
        }
        const n = await findNextNumber(dir);
        if (!cancelled) setPreviewNextNr(n);
      } catch {
        // Stil falen, behoud default 1
      } finally {
        if (!cancelled) setScanningNr(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selected, handleAvailable, instanceId, cfg]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return projects.slice(0, 50);
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.project_name.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [projects, search]);

  // Live preview path
  const previewPath = useMemo(() => {
    if (!selected) return null;
    const projectFolder = sanitizeForFilesystem(
      `${selected.name} ${selected.project_name}`,
    );
    const sub = cfg.correspondenceSubdir.replace(/^\/+|\/+$/g, "");
    const subSegments = sub.split(/[/\\]/).filter(Boolean);
    const folderPreview = resolveTemplate(
      cfg.folderTemplate,
      buildTemplateVars({ nr: previewNextNr, subject, from }),
    );
    return [projectFolder, ...subSegments, sanitizeForFilesystem(folderPreview, 100)]
      .filter(Boolean)
      .join("/");
  }, [selected, cfg, subject, from, previewNextNr]);

  // Hoofdmap (NAS-root per company) inline kiezen. Spiegelt NasSettingsSection's
  // handlePick, maar dan bereikbaar voor iedereen direct vanuit het dialoog.
  async function handlePickFolder() {
    if (!selected) return;
    setPickError(null);
    setPicking(true);
    try {
      const handle = await pickNasRoot();
      await setCompanyHandle(instanceId, selected.company, handle);
      // hasHandle-flag in nasConfig bijwerken zodat NasSettingsSection het ook ziet.
      const current = loadConfig(instanceId);
      saveConfig(instanceId, {
        ...current,
        companies: { ...current.companies, [selected.company]: { hasHandle: true } },
      });
      setHandleAvailable(true);
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const msg = e?.message || String(err);
      // Echte user-cancel uit de OS-dialog → stil. Automation-blocked (o.a.
      // Playwright's intercept, die ook AbortError gooit) → tonen.
      if (e?.name === "AbortError" && !/intercept/i.test(msg)) {
        return;
      }
      setPickError(msg);
      setTimeout(() => setPickError(null), 6000);
    } finally {
      setPicking(false);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setStatus("saving");
    setErrorMsg(null);
    setErrors([]);

    try {
      const root = await getCompanyHandle(instanceId, selected.company);
      if (!root) {
        setStatus("error");
        setErrorMsg(
          t("webmail.save_to_nas.no_handle_for_company", {
            defaultValue:
              "Geen NAS-pad ingesteld voor {{company}}. Ga naar Settings → Project instellingen.",
            company: selected.company,
          }),
        );
        return;
      }
      const granted = await ensureHandlePermission(root);
      if (!granted) {
        setStatus("error");
        setErrorMsg(
          t("webmail.save_to_nas.permission_denied", {
            defaultValue: "Geen toestemming voor map-toegang.",
          }),
        );
        return;
      }

      const projectFolder = sanitizeForFilesystem(
        `${selected.name} ${selected.project_name}`,
      );
      const sub = cfg.correspondenceSubdir.replace(/^\/+|\/+$/g, "");
      const subSegments = sub.split(/[/\\]/).filter(Boolean);

      const correspondenceDir = await getOrCreateSubdir(root, [
        projectFolder,
        ...subSegments,
      ]);

      const nextNr = await findNextNumber(correspondenceDir);
      const folderName = sanitizeForFilesystem(
        resolveTemplate(
          cfg.folderTemplate,
          buildTemplateVars({ nr: nextNr, subject, from }),
        ),
        100,
      );
      const saveDir = await getOrCreateSubdir(correspondenceDir, [folderName]);

      setProgress({ done: 0, total: attachments.length });
      const localErrors: SaveError[] = [];

      for (let i = 0; i < attachments.length; i++) {
        const a = attachments[i];
        try {
          const bytes = await fetchAttachmentBytes(a.index);
          await writeFileSafe(saveDir, a.filename, bytes);
        } catch (err) {
          localErrors.push({
            filename: a.filename,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        setProgress({ done: i + 1, total: attachments.length });
      }

      setErrors(localErrors);
      setStatus(localErrors.length === attachments.length ? "error" : "done");
      if (localErrors.length === 0 && onToast) {
        onToast(
          t("webmail.save_to_nas.toast_saved", {
            defaultValue: "{{count}} bijlages opgeslagen",
            count: attachments.length,
          }),
        );
      }
    } catch (err) {
      console.error("Save to NAS failed:", err);
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  const fsa = isFsaSupported();

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — violet, 3BM huisstijl */}
        <div className="bg-[#350E35] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen size={20} className="text-white" />
            <div>
              <h2 className="text-base font-semibold text-white">
                {t("webmail.save_to_nas.title", { defaultValue: "Opslaan op NAS" })}
              </h2>
              <p className="text-xs text-[#45B6A8]">
                {t("webmail.save_to_nas.subtitle", {
                  defaultValue: "Bijlages naar projectfolder schrijven",
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="h-1 bg-[#45B6A8]" />

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {!fsa && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle size={16} className="text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800">
                {t("webmail.save_to_nas.fsa_unsupported", {
                  defaultValue: "Vereist Chrome of Edge.",
                })}
              </p>
            </div>
          )}

          {/* Project picker */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("webmail.save_to_nas.project_label", { defaultValue: "Project" })}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder={t("webmail.save_to_nas.search_placeholder", {
                defaultValue: "Zoek op nummer of naam…",
              })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              disabled={status === "saving"}
            />
            {!selected && (
              <div className="mt-1 border border-slate-100 rounded-lg max-h-48 overflow-y-auto">
                {filteredProjects.map((p) => {
                  const isClosed =
                    p.status === "Completed" || p.status === "Cancelled";
                  return (
                    <button
                      key={p.name}
                      onClick={() => {
                        setSelected(p);
                        setSearch(`${p.name} — ${p.project_name}`);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center gap-2"
                    >
                      <span className="font-mono font-semibold text-violet-700 shrink-0">
                        {p.name}
                      </span>
                      <span className="text-slate-700 truncate flex-1">
                        {p.project_name}
                      </span>
                      <span className="text-xs text-slate-400 truncate max-w-[120px]">
                        {p.company}
                      </span>
                      {isClosed && (
                        <span className="text-[10px] uppercase font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                          {p.status}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <p className="text-xs text-slate-400 italic px-3 py-2">
                    {t("webmail.save_to_nas.no_results", {
                      defaultValue: "Geen projecten gevonden.",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Selected project info + handle status */}
          {selected && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-1">
              <p className="text-xs text-slate-500">
                {t("webmail.save_to_nas.preview_label", {
                  defaultValue: "Opslaan naar:",
                })}
              </p>
              <p className="text-xs font-mono text-slate-700 break-all">
                {scanningNr ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-400 italic">
                    <Loader2 size={11} className="animate-spin" />
                    {t("webmail.save_to_nas.scanning_number", {
                      defaultValue: "volgnummer bepalen…",
                    })}
                  </span>
                ) : (
                  <>{previewPath || "?"}/</>
                )}
              </p>
              {handleAvailable === false && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      {t("webmail.save_to_nas.pick_folder_hint", {
                        defaultValue:
                          "Nog geen NAS-hoofdmap voor {{company}} op dit apparaat. Kies de map waarin de projectmappen staan.",
                        company: selected.company,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={handlePickFolder}
                    disabled={!fsa || picking}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {picking ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
                    {t("webmail.save_to_nas.pick_folder", { defaultValue: "NAS-map kiezen" })}
                  </button>
                  {pickError && (
                    <div className="text-xs text-red-700">
                      <p className="font-medium">
                        {t("webmail.save_to_nas.pick_failed", { defaultValue: "Map-selectie mislukt" })}
                      </p>
                      <p className="font-mono mt-0.5 break-all">{pickError}</p>
                      {/intercept/i.test(pickError) && (
                        <p className="mt-1">
                          {t("settings.nas.pick_blocked_hint", {
                            defaultValue:
                              "De map-picker werd geblokkeerd door automation of een browser-extensie. Probeer Y-app in een gewone Chrome- of Edge-tab.",
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attachments list (read-only) */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">
              {t("webmail.save_to_nas.attachments_label", {
                defaultValue: "Bijlages ({{count}})",
                count: attachments.length,
              })}
            </p>
            <ul className="border border-slate-100 rounded-lg max-h-32 overflow-y-auto bg-white">
              {attachments.map((a) => (
                <li
                  key={a.index}
                  className="px-3 py-1.5 text-xs text-slate-700 border-b border-slate-50 last:border-0 flex justify-between"
                >
                  <span className="font-mono truncate">{a.filename}</span>
                  <span className="text-slate-400 ml-2 flex-shrink-0">
                    {formatBytes(a.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Status */}
          {status === "saving" && (
            <div className="flex items-center gap-2 text-sm text-violet-700">
              <Loader2 size={16} className="animate-spin" />
              <span>
                {t("webmail.save_to_nas.saving", {
                  defaultValue: "Bezig… ({{done}}/{{total}})",
                  done: progress.done,
                  total: progress.total,
                })}
              </span>
            </div>
          )}
          {status === "done" && errors.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              <span>
                {t("webmail.save_to_nas.done", {
                  defaultValue: "Klaar — {{count}} bijlages opgeslagen.",
                  count: attachments.length,
                })}
              </span>
            </div>
          )}
          {(status === "error" || errors.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              {errorMsg && <p>{errorMsg}</p>}
              {errors.map((e, i) => (
                <p key={i} className="text-xs">
                  • {e.filename}: {e.error}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            {status === "done"
              ? t("common.close", { defaultValue: "Sluiten" })
              : t("common.cancel", { defaultValue: "Annuleren" })}
          </button>
          {status !== "done" && (
            <button
              onClick={handleSave}
              disabled={
                !fsa ||
                !selected ||
                handleAvailable !== true ||
                status === "saving" ||
                attachments.length === 0 ||
                scanningNr
              }
              className="flex items-center gap-2 px-4 py-2 bg-[#45B6A8] text-white rounded-lg hover:bg-[#3aa093] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium cursor-pointer transition-colors"
            >
              <Save size={15} />
              {t("webmail.save_to_nas.save_button", { defaultValue: "Opslaan" })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
