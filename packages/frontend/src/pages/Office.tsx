import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, FileSpreadsheet, FileText, FolderOpen, Loader2, RefreshCw, Save, AlertTriangle } from "lucide-react";
import { OfficeApi, OfficeApiError, OfficeSaveUnknown, type OfficeFile } from "../lib/office-api";
import { OfficeOpenLoader } from "../lib/office-open";
import { createOfficePackage, inspectOfficePackage, OfficePackageError, OfficeRevision, OFFICE_MAX_SIZE, preserveOfficeParts, type OfficeKind } from "../lib/office";
import type { OfficeEditorHandle } from "../components/office/types";
import ErrorBoundary from "../components/ErrorBoundary";
import "../components/office/office.css";

const WordEditor = lazy(() => import("../components/office/WordEditor"));
const SheetEditor = lazy(() => import("../components/office/SheetEditor"));
const api = new OfficeApi();
type OpenDocument = { key: string; bytes: Uint8Array; name: string; kind: OfficeKind; macros: boolean; source?: OfficeFile };
type PendingSave = { operation: string; source: OfficeFile; bytes: Uint8Array; revision: number; documentKey: string };

export default function Office() {
  const { t, i18n } = useTranslation(); const navigate = useNavigate(); const [query] = useSearchParams();
  const fileId = query.get("file") ?? "";
  const newKind = query.get("new");
  const [doc, setDoc] = useState<OpenDocument | null>(null);
  const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<PendingSave | null>(null);
  const exporter = useRef<OfficeEditorHandle | null>(null); const revision = useRef(new OfficeRevision());
  const busyRef = useRef(false); const pendingRef = useRef<PendingSave | null>(null);
  const source = useRef<OfficeFile | undefined>(undefined); const original = useRef<Uint8Array | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loader = useRef(new OfficeOpenLoader(api)); const openSequence = useRef(0); const activeKey = useRef<string | null>(null);
  const locale = i18n.language.startsWith("de") ? "de" : i18n.language.startsWith("en") ? "en" : "nl";

  const errorMessage = useCallback((error: unknown) => {
    if (error instanceof OfficePackageError) return t(`office.error_${error.code}`);
    if (error instanceof OfficeApiError && error.status === 403) return t("office.no_permission");
    if (error instanceof OfficeApiError && error.status === 409) return t("office.conflict");
    if (error instanceof OfficeApiError && error.status === 413) return t("office.error_size");
    return t("office.failed");
  }, [t]);
  function open(bytes: Uint8Array, name: string, metadata?: OfficeFile, isNew = false) {
    const info = inspectOfficePackage(bytes, name);
    exporter.current = null; revision.current = new OfficeRevision();
    if (isNew) revision.current.change();
    source.current = metadata; original.current = bytes;
    const key = crypto.randomUUID(); activeKey.current = key;
    setDoc({ key, bytes, name, kind: info.kind, macros: info.hasMacros, source: metadata });
    setReady(false); setDirty(revision.current.dirty); setError(""); setNotice(""); setPending(null); pendingRef.current = null;
  }
  function clearDocument() {
    activeKey.current = null; exporter.current = null; source.current = undefined; original.current = null;
    revision.current = new OfficeRevision(); busyRef.current = false; pendingRef.current = null;
    setDoc(null); setReady(false); setLoading(false); setDirty(false); setBusy(false); setPending(null); setError(""); setNotice("");
  }
  useEffect(() => {
    const sequence = ++openSequence.current; loader.current.cancel(); clearDocument();
    if (!fileId) {
      if (newKind === "word" || newKind === "excel") open(createOfficePackage(newKind), t(newKind === "word" ? "office.new_document_name" : "office.new_workbook_name"), undefined, true);
      return;
    }
    let cancelled = false; setLoading(true);
    void (async () => {
      try {
        const loaded = await loader.current.load(fileId);
        if (cancelled || sequence !== openSequence.current || !loaded) return;
        open(loaded.bytes, loaded.metadata.file_name, loaded.metadata);
      } catch (error) { if (!cancelled && sequence === openSequence.current) setError(errorMessage(error)); }
      finally { if (!cancelled && sequence === openSequence.current) setLoading(false); }
    })();
    return () => { cancelled = true; loader.current.cancel(); };
    // Een ander File-id opent een nieuwe sessie; locale-wijziging niet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, newKind]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (revision.current.dirty || busyRef.current || pendingRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    let previousUrl = window.location.href;
    const guard = (event: Event) => {
      if (!(revision.current.dirty || busyRef.current || pendingRef.current) || window.location.href === previousUrl) return;
      if (window.confirm(t("office.leave_warning"))) { previousUrl = window.location.href; return; }
      event.stopImmediatePropagation(); window.history.replaceState(window.history.state, "", previousUrl);
    };
    window.addEventListener("popstate", guard, true); window.addEventListener("hashchange", guard, true);
    return () => { window.removeEventListener("popstate", guard, true); window.removeEventListener("hashchange", guard, true); };
  }, [doc?.key, t]);
  function changed() { revision.current.change(); setDirty(true); setNotice(""); }
  function acceptSaved(file: OfficeFile, snapshot: PendingSave) {
    if (activeKey.current !== snapshot.documentKey) return;
    source.current = file; original.current = snapshot.bytes; revision.current.saved(snapshot.revision);
    setDirty(revision.current.dirty); pendingRef.current = null; setPending(null);
    setNotice(t("office.saved", { name: file.file_name })); setError("");
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("y-next:office-saved");
      channel.postMessage({ doctype: file.attached_to_doctype, name: file.attached_to_name }); channel.close();
    }
  }
  async function reconcile(snapshot: PendingSave) {
    const saved = await api.status(snapshot.operation, snapshot.source.name);
    if (activeKey.current !== snapshot.documentKey) return;
    if (saved) acceptSaved(saved, snapshot);
    // 'Niet gevonden' kan ook betekenen dat de eerste upload nog loopt.
    // Houd deze operatie vast; nooit blind een tweede POST versturen.
    else setError(t("office.save_unknown"));
  }
  async function snapshotBytes() {
    if (!exporter.current || !doc || !original.current) throw new OfficePackageError("format");
    return preserveOfficeParts(original.current, await exporter.current.serialize(), doc.name);
  }
  function downloadBytes(bytes: Uint8Array) {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)])); const link = document.createElement("a");
    link.href = url; link.download = doc.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  async function download() {
    if (busyRef.current || !ready) return;
    busyRef.current = true; setBusy(true); const snapshotRevision = revision.current.current; const documentKey = activeKey.current;
    try {
      const bytes = await snapshotBytes(); if (documentKey !== activeKey.current) return; downloadBytes(bytes);
      if (!source.current) { revision.current.saved(snapshotRevision); setDirty(revision.current.dirty); }
      setNotice(t("office.downloaded"));
    } catch (error) { if (documentKey === activeKey.current) setError(errorMessage(error)); }
    finally { if (documentKey === activeKey.current) { busyRef.current = false; setBusy(false); } }
  }
  async function save() {
    if (busyRef.current || pendingRef.current || !ready || !doc) return;
    if (!source.current) { await download(); return; }
    if (!source.current.can_save) { setError(t("office.no_save_permission")); return; }
    busyRef.current = true; setBusy(true); setError("");
    const snapshot: PendingSave = { operation: crypto.randomUUID(), source: source.current, bytes: new Uint8Array(), revision: revision.current.current, documentKey: doc.key };
    try {
      snapshot.bytes = await snapshotBytes();
      if (snapshot.documentKey !== activeKey.current) return;
      if (snapshot.bytes.length > Math.min(snapshot.source.max_size, OFFICE_MAX_SIZE)) throw new OfficePackageError("size");
      acceptSaved(await api.save(snapshot.source, snapshot.bytes, snapshot.operation), snapshot);
    } catch (error) {
      if (snapshot.documentKey !== activeKey.current) return;
      if (error instanceof OfficeSaveUnknown) {
        pendingRef.current = snapshot; setPending(snapshot); setError(t("office.save_unknown"));
        try { await reconcile(snapshot); } catch { if (snapshot.documentKey === activeKey.current) setError(t("office.save_unknown")); }
      } else setError(errorMessage(error));
    } finally { if (snapshot.documentKey === activeKey.current) { busyRef.current = false; setBusy(false); } }
  }
  const saveRef = useRef(save); saveRef.current = save;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); event.stopImmediatePropagation(); void saveRef.current(); }
    };
    window.addEventListener("keydown", shortcut, true); return () => window.removeEventListener("keydown", shortcut, true);
  }, []);
  async function choose(file?: File) {
    if (!file || busyRef.current || pendingRef.current) return;
    if (revision.current.dirty && !window.confirm(t("office.leave_warning"))) return;
    const sequence = ++openSequence.current; loader.current.cancel(); clearDocument(); setLoading(true);
    try {
      if (file.size > OFFICE_MAX_SIZE) throw new OfficePackageError("size");
      const bytes = new Uint8Array(await file.arrayBuffer()); if (sequence !== openSequence.current) return; open(bytes, file.name);
    } catch (error) { if (sequence === openSequence.current) setError(errorMessage(error)); }
    finally { if (sequence === openSequence.current) { setLoading(false); if (fileInput.current) fileInput.current.value = ""; } }
  }
  function newDocument(kind: OfficeKind) {
    if (busyRef.current || pendingRef.current || (revision.current.dirty && !window.confirm(t("office.leave_warning")))) return;
    openSequence.current++; loader.current.cancel(); clearDocument(); setLoading(false);
    open(createOfficePackage(kind), t(kind === "word" ? "office.new_document_name" : "office.new_workbook_name"), undefined, true);
  }
  function back() {
    if ((revision.current.dirty || busyRef.current || pendingRef.current) && !window.confirm(t("office.leave_warning"))) return;
    const parent = source.current; navigate(parent?.attached_to_doctype === "Communication" ? "/webmail" : parent?.attached_to_doctype === "Project" ? `/projects?p=${encodeURIComponent(parent.attached_to_name ?? "")}` : "/");
  }
  const button = "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-y-teal";
  const editorEvents = {
    onReady: (handle: OfficeEditorHandle) => { if (activeKey.current === doc?.key) { exporter.current = handle; setReady(true); } },
    onChange: () => { if (activeKey.current === doc?.key) changed(); },
    onSave: () => { if (activeKey.current === doc?.key) void save(); },
    onError: (error: unknown) => { if (activeKey.current === doc?.key) { if (!busyRef.current) setReady(false); setError(errorMessage(error)); } },
  };
  return <div className="y-office fixed inset-0 z-50 flex h-dvh flex-col bg-slate-100" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
    <header className="flex min-h-12 flex-shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <button type="button" onClick={back} className={`${button} text-slate-600 hover:bg-slate-100`}><ArrowLeft size={14} />{t("office.back")}</button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {doc?.kind === "excel" ? <FileSpreadsheet size={18} className="text-y-teal" /> : <FileText size={18} className="text-y-teal" />}
        <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{doc?.name ?? t("office.title")}</span>
        {doc && <span className="whitespace-nowrap text-[11px] text-slate-400" aria-live="polite">{dirty ? t("office.unsaved") : t("office.unchanged")}</span>}
      </div>
      <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || !!pending || loading} className={`${button} text-slate-600 hover:bg-slate-100`}><FolderOpen size={14} />{t("office.open")}</button>
      {doc && <><button type="button" onClick={() => void download()} disabled={!ready || busy} className={`${button} text-slate-600 hover:bg-slate-100`}><Download size={14} />{t("office.download")}</button>
        <button type="button" onClick={() => void save()} disabled={!ready || busy || !!pending || (!!source.current && !source.current.can_save)} className={`${button} bg-y-teal text-white hover:bg-y-teal-dark`}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{t(source.current ? "office.save_version" : "office.save_local")}</button></>}
      <input ref={fileInput} type="file" accept=".docx,.xlsx,.xlsm" className="hidden" onChange={(event) => void choose(event.target.files?.[0])} />
    </header>
    {(error || notice || pending) && <div role={error ? "alert" : "status"} className={`flex flex-shrink-0 items-center gap-2 border-b px-4 py-2 text-xs ${error ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}>
      {error && <AlertTriangle size={14} />}<span className="flex-1">{error || notice}</span>
      {pending && <button type="button" disabled={busy} className={`${button} hover:bg-amber-100`} onClick={() => {
        if (busyRef.current) return; busyRef.current = true; setBusy(true);
        const snapshot = pending;
        void reconcile(snapshot).catch(() => { if (snapshot.documentKey === activeKey.current) setError(t("office.save_unknown")); }).finally(() => { if (snapshot.documentKey === activeKey.current) { busyRef.current = false; setBusy(false); } });
      }}><RefreshCw size={13} />{t("office.check_save")}</button>}
    </div>}
    {doc && <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-500">
      {t(source.current ? "office.version_hint" : "office.local_hint")}
      {source.current && !source.current.can_save && <span className="ml-2">{t("office.no_save_permission")}</span>}
      {doc.macros && <span className="ml-2">{t("office.macro_hint")}</span>}
      {doc.kind === "excel" && locale === "nl" && <span className="ml-2">{t("office.decimal_hint")}</span>}
    </div>}
    {loading ? <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{t("office.loading")}</div>
      : doc ? <main className="relative min-h-0 flex-1 overflow-hidden" onInputCapture={editorEvents.onChange}>
        {!ready && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-100/80 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{t("office.loading")}</div>}
        <ErrorBoundary resetKey={doc.key}><Suspense fallback={null}>
          {doc.kind === "word" ? <WordEditor key={doc.key} bytes={doc.bytes} name={doc.name} locale={locale} {...editorEvents} />
            : <SheetEditor key={doc.key} bytes={doc.bytes} name={doc.name} locale={locale} {...editorEvents} />}
        </Suspense></ErrorBoundary>
      </main> : <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-y-teal/10 text-y-teal"><FileText size={30} /></div>
        <h1 className="text-xl font-semibold text-slate-800">{t("office.title")}</h1><p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">{t("office.intro")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => fileInput.current?.click()} className={`${button} bg-y-teal text-white hover:bg-y-teal-dark`}><FolderOpen size={15} />{t("office.open")}</button>
          <button type="button" onClick={() => newDocument("word")} className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><FileText size={15} />{t("office.new_document")}</button>
          <button type="button" onClick={() => newDocument("excel")} className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><FileSpreadsheet size={15} />{t("office.new_workbook")}</button></div>
        <p className="mt-4 text-xs text-slate-400">{t("office.supported")}</p>
      </main>}
  </div>;
}
