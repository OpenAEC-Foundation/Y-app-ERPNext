import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Boxes, FolderOpen, Loader2, X } from "lucide-react";
import { validateIfcFile } from "../lib/ifc-file";

const Model = lazy(() => import("../components/mail/IfcVoorbeeld"));

export default function IfcViewer() {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [model, setModel] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => () => { if (model) URL.revokeObjectURL(model.url); }, [model]);
  useEffect(() => () => { generation.current++; }, []);

  async function open(file: File | undefined) {
    if (!file) return;
    const current = ++generation.current;
    setError("");
    setLoading(true);
    try {
      // Read only a small header before handing a potentially large file to WebAssembly.
      const header = await file.slice(0, 512).text();
      if (current !== generation.current) return;
      const problem = validateIfcFile(file, header);
      if (problem) { setError(t(`ifc_viewer.error_${problem}`)); return; }
      setModel({ name: file.name, url: URL.createObjectURL(file) });
    } catch {
      if (current === generation.current) setError(t("ifc_viewer.error_read"));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }

  function close() {
    generation.current++;
    setModel(null);
    setLoading(false);
    setError("");
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col gap-4 p-3 sm:p-6"
      onDragOver={(event) => { event.preventDefault(); }}
      onDrop={(event) => { event.preventDefault(); void open(event.dataTransfer.files[0]); }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Boxes size={24} className="text-y-teal" />{t("start_apps.ifc")}</h2>
        <div className="flex items-center gap-2">
          {model && <button type="button" onClick={close} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-y-teal" aria-label={t("common.close")}><X size={18} /></button>}
          <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-lg bg-y-teal px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}{t("ifc_viewer.open")}
          </button>
        </div>
        <input ref={input} type="file" accept=".ifc" className="hidden" aria-label={t("ifc_viewer.open")}
          onChange={(event) => { void open(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
      {model ? (
        <div className="flex min-h-[65dvh] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600">{model.name}</p>
          <div className="min-h-[60dvh] flex-1">
            <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />{t("common.loading")}</p>}>
              <Model key={model.url} url={model.url} naam={model.name} />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
          <Boxes size={56} strokeWidth={1.3} className="text-y-teal" />
          <h3 className="text-lg font-semibold text-slate-700">{t("ifc_viewer.drop")}</h3>
          <p className="max-w-md text-sm text-slate-500">{t("ifc_viewer.local")}</p>
        </div>
      )}
    </div>
  );
}
