import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileText, Loader2, Pencil, RefreshCw } from "lucide-react";
import { fetchAttachments, getFileUrl, invalidateCache, type FileInfo } from "../../lib/erpnext";
import { isPermissionError } from "../../lib/permission-error";
import { editableOfficeKind, officeEditorUrl } from "../../lib/office";

export default function ProjectFiles({ project }: { project: string }) {
  const { t } = useTranslation(); const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError("");
    fetchAttachments("Project", project).then((files) => { if (!cancelled) setFiles(files); }).catch((error) => {
      if (!cancelled) setError(t(isPermissionError(error) ? "office.no_permission" : "office.files_failed"));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project, refresh, t]);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("y-next:office-saved");
    channel.onmessage = (event) => {
      if (event.data?.doctype === "Project" && event.data?.name === project) { invalidateCache("File"); setRefresh((value) => value + 1); }
    };
    return () => channel.close();
  }, [project]);
  return <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-2 flex items-center gap-2"><FileText size={14} className="text-y-teal" /><h5 className="flex-1 text-sm font-semibold text-slate-700">{t("office.project_files")}</h5>
      <button type="button" disabled={loading} title={t("office.refresh_files")} aria-label={t("office.refresh_files")} className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-y-teal disabled:opacity-40" onClick={() => { invalidateCache("File"); setRefresh((value) => value + 1); }}><RefreshCw size={13} /></button></div>
    {loading ? <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" />{t("common.loading")}</p>
      : error ? <p role="alert" className="text-xs text-amber-800">{error}</p>
        : files.length === 0 ? <p className="text-xs text-slate-400">{t("office.no_project_files")}</p>
          : <div className="divide-y divide-slate-100">{files.map((file) => <div key={file.name} className="flex items-center gap-2 py-2 text-xs">
            <a href={getFileUrl(file.file_url)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-slate-600 hover:text-y-teal">{file.file_name}</a>
            {editableOfficeKind(file.file_name) && <a href={officeEditorUrl(file.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded px-2 py-1 text-y-teal hover:bg-slate-100"><Pencil size={12} />{t("office.edit")}</a>}
            <a href={getFileUrl(file.file_url)} download={file.file_name} title={t("office.download")} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-y-teal"><Download size={12} /></a>
          </div>)}</div>}
  </section>;
}
