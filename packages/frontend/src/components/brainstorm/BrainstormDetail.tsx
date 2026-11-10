import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Download, Lightbulb, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import {
  deleteBijlage, deleteIdee, getIdee, listBijlagen, updateIdee, uploadBijlage, type IdeeWijziging,
} from "../../lib/brainstorm";
import {
  LABEL_GROUPS, NEXT_STATUS, ideeAlsTekst, ideeCode, parseLabels, serializeLabels,
  type Idee, type Label, type Punt,
} from "../../lib/brainstorm-model";
import { getFileUrl, type FileInfo } from "../../lib/erpnext";
import { useToast } from "../Toast";
import { DeadlineBadge, LabelChip, StatusKnop } from "./shared";
import { groepVan } from "./brainstorm-ui";

const input = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal";
const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-slate-500";

/**
 * Het open idee. Elk veld bewaart zichzelf zodra je het verlaat; er is geen
 * opslaanknop, zodat een AI-sessie en een collega niet op elkaars knop wachten.
 */
export default function BrainstormDetail({
  name, labels, onClose, onChanged, onDeleted,
}: {
  name: string;
  labels: Label[];
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [idee, setIdee] = useState<Idee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bijlagen, setBijlagen] = useState<FileInfo[]>([]);
  const [nieuwPunt, setNieuwPunt] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Het paneel krijgt per idee een eigen key, dus de begintoestand is al leeg.
    let alive = true;
    getIdee(name).then((d) => { if (alive) setIdee(d); }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    listBijlagen(name).then((b) => { if (alive) setBijlagen(b); }).catch(() => undefined);
    return () => { alive = false; };
  }, [name]);

  async function save(patch: IdeeWijziging) {
    if (!idee) return;
    const vorige = idee;
    setIdee({ ...idee, ...patch } as Idee);
    try {
      await updateIdee(name, patch);
      onChanged();
    } catch (e) {
      setIdee(vorige);
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    }
  }

  function saveIfChanged<K extends keyof IdeeWijziging>(key: K, value: IdeeWijziging[K]) {
    if (!idee) return;
    const cur = (idee as unknown as Record<string, unknown>)[key as string] ?? "";
    if ((value ?? "") !== cur) save({ [key]: value } as IdeeWijziging);
  }

  if (error) {
    return (
      <Panel onClose={onClose} title={t("nav.brainstorm")}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      </Panel>
    );
  }
  if (!idee) {
    return <Panel onClose={onClose} title={t("nav.brainstorm")}><p className="text-slate-400 text-sm">{t("common.loading")}</p></Panel>;
  }

  const punten = idee.punten || [];
  const ideeLabels = parseLabels(idee.labels);
  const gedaan = punten.filter((p) => p.gedaan).length;

  function setPunten(next: Punt[]) { save({ punten: next }); }

  function addPunt() {
    const tekst = nieuwPunt.trim();
    if (!tekst) return;
    setNieuwPunt("");
    setPunten([...punten, { tekst, gedaan: 0 }]);
  }

  async function copyAsText() {
    const tekst = ideeAlsTekst(idee as Idee, punten);
    try {
      await navigator.clipboard.writeText(tekst);
      toast.success(t("brainstorm.copied"));
    } catch {
      toast.error(t("brainstorm.copy_failed"));
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) await uploadBijlage(name, f);
      setBijlagen(await listBijlagen(name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.upload_failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeBijlage(f: FileInfo) {
    try {
      await deleteBijlage(f.name);
      setBijlagen((b) => b.filter((x) => x.name !== f.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    }
  }

  async function remove() {
    try {
      await deleteIdee(name);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    }
  }

  const beschikbaar = labels.filter((l) => !ideeLabels.includes(l.label));

  return (
    <Panel onClose={onClose} title={`${ideeCode(idee.name)}`}>
      <input
        key={`titel-${idee.modified}`}
        defaultValue={idee.titel}
        onBlur={(e) => { const v = e.target.value.trim(); if (v) saveIfChanged("titel", v); else e.target.value = idee.titel; }}
        className="w-full text-xl font-bold text-slate-800 px-2 py-1 -mx-2 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none"
        aria-label={t("brainstorm.title")}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <StatusKnop groot status={idee.status} onClick={() => save({ status: NEXT_STATUS[idee.status] })} />
        <span className="text-xs text-slate-400">{t("brainstorm.status_click", { next: t(`brainstorm.status.${NEXT_STATUS[idee.status]}`) })}</span>
      </div>

      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <span className="font-mono font-semibold text-slate-700">{ideeCode(idee.name)}</span>{" "}
        {t("brainstorm.ai_hint", { code: ideeCode(idee.name) })}
      </p>

      <div className="space-y-2">
        <p className={sectionLabel}>{t("brainstorm.labels")}</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {ideeLabels.map((l) => (
            <LabelChip key={l} label={l} groep={groepVan(l, labels)}
              onRemove={() => save({ labels: serializeLabels(ideeLabels.filter((x) => x !== l)) })} />
          ))}
          <select
            value=""
            onChange={(e) => { if (e.target.value) save({ labels: serializeLabels([...ideeLabels, e.target.value]) }); }}
            className="px-2 py-1 bg-white border border-dashed border-slate-300 rounded-full text-xs text-slate-500 cursor-pointer"
            aria-label={t("brainstorm.label_add")}
          >
            <option value="">+ {t("brainstorm.label_add")}</option>
            {LABEL_GROUPS.map((g) => {
              const inGroep = beschikbaar.filter((l) => l.groep === g);
              if (!inGroep.length) return null;
              return (
                <optgroup key={g} label={t(`brainstorm.group.${g}`)}>
                  {inGroep.map((l) => <option key={l.name} value={l.label}>{l.label}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className={sectionLabel}>{t("brainstorm.date")}</span>
          <input type="date" className={input} key={`datum-${idee.modified}`} defaultValue={idee.datum || ""}
            onChange={(e) => saveIfChanged("datum", e.target.value || null)} />
        </label>
        <label className="space-y-1">
          <span className={sectionLabel}>{t("brainstorm.deadline")}</span>
          <input type="date" className={input} key={`deadline-${idee.modified}`} defaultValue={idee.deadline || ""}
            onChange={(e) => saveIfChanged("deadline", e.target.value || null)} />
        </label>
      </div>
      <DeadlineBadge deadline={idee.deadline} status={idee.status} />

      <label className="block space-y-1">
        <span className={sectionLabel}>{t("brainstorm.link")}</span>
        <input className={input} key={`koppeling-${idee.modified}`} defaultValue={idee.koppeling || ""}
          placeholder={t("brainstorm.link_placeholder")}
          onBlur={(e) => saveIfChanged("koppeling", e.target.value.trim() || null)} />
      </label>

      <label className="block space-y-1">
        <span className={sectionLabel}>{t("brainstorm.description")}</span>
        <textarea rows={4} className={input} key={`beschrijving-${idee.modified}`} defaultValue={idee.beschrijving || ""}
          placeholder={t("brainstorm.description_placeholder")}
          onBlur={(e) => saveIfChanged("beschrijving", e.target.value || null)} />
      </label>

      <div className="space-y-2">
        <p className={sectionLabel}>{t("brainstorm.checklist", { done: gedaan, total: punten.length })}</p>
        <ul className="space-y-1">
          {punten.map((p, i) => (
            <li key={p.name || `nieuw-${i}`} className="flex items-start gap-2 group">
              <input type="checkbox" checked={!!p.gedaan} className="mt-1 w-4 h-4 accent-y-teal cursor-pointer"
                onChange={() => setPunten(punten.map((x, j) => (j === i ? { ...x, gedaan: x.gedaan ? 0 : 1 } : x)))}
                aria-label={p.tekst} />
              <span className={`flex-1 text-sm ${p.gedaan ? "line-through text-slate-400" : "text-slate-700"}`}>{p.tekst}</span>
              <button type="button" onClick={() => setPunten(punten.filter((_, j) => j !== i))}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-slate-400 hover:text-red-500 cursor-pointer"
                aria-label={t("brainstorm.point_remove")}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className={input} value={nieuwPunt} onChange={(e) => setNieuwPunt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPunt(); } }}
            placeholder={t("brainstorm.point_add")} />
          <button type="button" onClick={addPunt} className="px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer" aria-label={t("brainstorm.point_add")}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <label className="block space-y-1">
        <span className={sectionLabel}>{t("brainstorm.result")}</span>
        <textarea rows={2} className={input} key={`resultaat-${idee.modified}`} defaultValue={idee.resultaat || ""}
          placeholder={t("brainstorm.result_placeholder")}
          onBlur={(e) => saveIfChanged("resultaat", e.target.value || null)} />
      </label>

      <div className="space-y-2">
        <p className={`${sectionLabel} flex items-center gap-1.5`}><Paperclip size={13} /> {t("brainstorm.attachments")}</p>
        {bijlagen.length > 0 && (
          <ul className="space-y-1">
            {bijlagen.map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                <span className="flex-1 min-w-0 truncate text-slate-700">{f.file_name}</span>
                <a href={getFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer"
                  className="p-1 hover:bg-slate-200 rounded" title={t("brainstorm.attachment_open")}>
                  <Download size={14} className="text-y-teal" />
                </a>
                <button type="button" onClick={() => removeBijlage(f)} className="p-1 hover:bg-red-50 rounded cursor-pointer" title={t("common.delete")}>
                  <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
          <Upload size={14} /> {uploading ? t("brainstorm.uploading") : t("brainstorm.attachment_add")}
        </button>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <button type="button" onClick={copyAsText}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:bg-slate-50 cursor-pointer">
          <Copy size={14} /> {t("brainstorm.copy_text")}
        </button>
        <span className="flex-1" />
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            {t("brainstorm.delete_confirm")}
            <button type="button" onClick={remove} className="px-3 py-1.5 bg-red-600 text-white rounded-lg cursor-pointer">{t("common.delete")}</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer">{t("common.cancel")}</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-red-600 cursor-pointer">
            <Trash2 size={14} /> {t("common.delete")}
          </button>
        )}
      </div>
    </Panel>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex justify-end pt-[env(safe-area-inset-top,0px)]">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-y-teal/10 rounded-lg"><Lightbulb className="text-y-teal" size={18} /></div>
            <h3 className="font-semibold text-slate-800 font-mono">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg cursor-pointer" aria-label={t("common.close")}>
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}
