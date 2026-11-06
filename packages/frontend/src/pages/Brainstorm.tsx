import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical, Lightbulb, List, Plus, RefreshCw, Tags, Link2 } from "lucide-react";
import {
  brainstormStand, createIdee, listIdeeen, listLabels, setStatus, updateIdee, vulLabelsAlsLeeg,
  type BrainstormStand, type IdeeMetVoortgang,
} from "../lib/brainstorm";
import {
  NEXT_STATUS, STATUSES, ideeCode, parseLabels, sortIdeeen, volgordeNaVerplaatsing, volgordeVoorNieuw,
  type IdeeStatus, type Label,
} from "../lib/brainstorm-model";
import { getSessionUser } from "../lib/session";
import { useToast } from "../components/Toast";
import BrainstormDetail from "../components/brainstorm/BrainstormDetail";
import BrainstormLabels from "../components/brainstorm/BrainstormLabels";
import { DeadlineBadge, LabelChip, StatusKnop } from "../components/brainstorm/shared";
import { formatDatum, groepVan } from "../components/brainstorm/brainstorm-ui";

type View = "lijst" | "bord";
const VIEW_KEY = "pref_brainstorm_view";

export default function Brainstorm() {
  const { t } = useTranslation();
  const toast = useToast();
  const myEmail = getSessionUser() || "";
  const [stand, setStand] = useState<BrainstormStand | "laden">("laden");
  const [error, setError] = useState<string | null>(null);
  const [ideeen, setIdeeen] = useState<IdeeMetVoortgang[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem(VIEW_KEY) === "bord" ? "bord" : "lijst"; } catch { return "lijst"; }
  });
  const [statusFilter, setStatusFilter] = useState<IdeeStatus | "">("");
  const [labelFilter, setLabelFilter] = useState("");
  const [alleenMijn, setAlleenMijn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [nieuweTitel, setNieuweTitel] = useState("");
  const newRef = useRef<HTMLInputElement>(null);

  // Zet pas state na het eerste antwoord, zodat het ook vanuit een effect kan draaien.
  const fetchAll = useCallback(async () => {
    try {
      const s = await brainstormStand();
      setStand(s);
      setError(null);
      if (s !== "klaar") return;
      const [i, l] = await Promise.all([listIdeeen(), listLabels()]);
      setIdeeen(i);
      setLabels((await vulLabelsAlsLeeg(l)) ? await listLabels() : l);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchAll();
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function switchView(v: View) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* alleen gemak */ }
  }

  async function addIdee() {
    const titel = nieuweTitel.trim();
    if (!titel) { newRef.current?.focus(); return; }
    try {
      const idee = await createIdee({ titel, volgorde: volgordeVoorNieuw(ideeen) });
      setNieuweTitel("");
      await load();
      setSelected(idee.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
    }
  }

  async function cycleStatus(name: string, status: IdeeStatus) {
    const next = NEXT_STATUS[status];
    setIdeeen((list) => list.map((i) => (i.name === name ? { ...i, status: next, modified: new Date().toISOString() } : i)));
    try {
      await setStatus(name, next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("brainstorm.save_failed"));
      load();
    }
  }

  // Filteren op "mijn" kan alleen als we weten wie je bent; anders een lege lijst met uitleg.
  const mijnOnbekend = alleenMijn && !myEmail;
  const zichtbaar = useMemo(() => {
    if (mijnOnbekend) return [];
    return sortIdeeen(ideeen.filter((i) =>
      (!statusFilter || i.status === statusFilter)
      && (!labelFilter || parseLabels(i.labels).includes(labelFilter))
      && (!alleenMijn || i.owner === myEmail)));
  }, [ideeen, statusFilter, labelFilter, alleenMijn, myEmail, mijnOnbekend]);

  // Filters tonen alleen keuzes die iets uitmaken.
  const gebruikteStatussen = STATUSES.filter((s) => ideeen.some((i) => i.status === s));
  const gebruikteLabels = useMemo(() => [...new Set(ideeen.flatMap((i) => parseLabels(i.labels)))].sort(), [ideeen]);

  const openZichtbaar = zichtbaar.filter((i) => i.status !== "Klaar");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = openZichtbaar.findIndex((i) => i.name === e.active.id);
    const to = openZichtbaar.findIndex((i) => i.name === e.over?.id);
    if (from < 0 || to < 0) return;
    const volgorde = volgordeNaVerplaatsing(openZichtbaar, from, to);
    const name = String(e.active.id);
    setIdeeen((list) => list.map((i) => (i.name === name ? { ...i, volgorde } : i)));
    try {
      await updateIdee(name, { volgorde });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("brainstorm.save_failed"));
      load();
    }
  }

  const header = (
    <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-y-teal/10 rounded-lg"><Lightbulb className="text-y-teal" size={24} /></div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t("nav.brainstorm")}</h2>
          <p className="text-sm text-slate-500">{t("brainstorm.subtitle")}</p>
        </div>
      </div>
      {stand === "klaar" && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setLabelsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
            <Tags size={16} /> {t("brainstorm.labels")}
          </button>
          <button type="button" onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-sm">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      )}
    </div>
  );

  if (stand === "laden" && !error) {
    return <div className="p-3 sm:p-6">{header}<div className="py-16 text-center text-slate-400">{t("common.loading")}</div></div>;
  }

  if (error) {
    return <div className="p-3 sm:p-6">{header}<div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div></div>;
  }

  if (stand === "niet-ingesteld") {
    return (
      <div className="p-3 sm:p-6">
        {header}
        <div className="max-w-xl bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-3">
          <h3 className="text-lg font-semibold text-slate-800">{t("brainstorm.setup_title")}</h3>
          <p className="text-sm text-slate-600">{t("brainstorm.setup_text")}</p>
        </div>
      </div>
    );
  }

  if (stand === "geen-rechten") {
    return (
      <div className="p-3 sm:p-6">
        {header}
        <div className="max-w-xl p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">{t("brainstorm.no_rights")}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {header}

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden bg-white" role="group" aria-label={t("brainstorm.view")}>
          <button type="button" onClick={() => switchView("lijst")} aria-pressed={view === "lijst"}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer ${view === "lijst" ? "bg-y-teal/10 text-y-teal font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <List size={15} /> {t("brainstorm.view_list")}
          </button>
          <button type="button" onClick={() => switchView("bord")} aria-pressed={view === "bord"}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer border-l border-slate-200 ${view === "bord" ? "bg-y-teal/10 text-y-teal font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <Columns3 size={15} /> {t("brainstorm.view_board")}
          </button>
        </div>
        {view === "lijst" && gebruikteStatussen.length > 1 && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IdeeStatus | "")}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" aria-label={t("brainstorm.filter_status")}>
            <option value="">{t("brainstorm.filter_all_statuses")}</option>
            {gebruikteStatussen.map((s) => <option key={s} value={s}>{t(`brainstorm.status.${s}`)}</option>)}
          </select>
        )}
        {gebruikteLabels.length > 0 && (
          <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" aria-label={t("brainstorm.filter_label")}>
            <option value="">{t("brainstorm.filter_all_labels")}</option>
            {gebruikteLabels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setAlleenMijn((v) => !v)} aria-pressed={alleenMijn}
          className={`px-3 py-2 border rounded-lg text-sm cursor-pointer ${alleenMijn ? "bg-y-teal/10 border-y-teal text-y-teal font-semibold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
          {alleenMijn ? t("brainstorm.mine") : t("brainstorm.everyone")}
        </button>
      </div>

      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); addIdee(); }}>
        <input ref={newRef} value={nieuweTitel} onChange={(e) => setNieuweTitel(e.target.value)} placeholder={t("brainstorm.new_placeholder")}
          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" aria-label={t("brainstorm.new")} />
        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium">
          <Plus size={16} /> {t("brainstorm.new")}
        </button>
      </form>

      {mijnOnbekend ? (
        <div className="py-12 text-center text-slate-500 text-sm">{t("brainstorm.mine_unknown")}</div>
      ) : zichtbaar.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">{ideeen.length === 0 ? t("brainstorm.empty") : t("brainstorm.empty_filtered")}</div>
      ) : view === "lijst" ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={openZichtbaar.map((i) => i.name)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {openZichtbaar.map((i) => (
                  <SortableTegel key={i.name} idee={i} labels={labels} onOpen={() => setSelected(i.name)} onStatus={() => cycleStatus(i.name, i.status)} />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          {zichtbaar.some((i) => i.status === "Klaar") && (
            <ol className="space-y-2 mt-6">
              {zichtbaar.filter((i) => i.status === "Klaar").map((i) => (
                <li key={i.name}><Tegel idee={i} labels={labels} onOpen={() => setSelected(i.name)} onStatus={() => cycleStatus(i.name, i.status)} /></li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-slate-400">{t("brainstorm.drag_hint")}</p>
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {STATUSES.map((s) => {
            const kolom = zichtbaar.filter((i) => i.status === s);
            return (
              <div key={s} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 min-w-0">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="font-semibold text-slate-700">{t(`brainstorm.status.${s}`)}</h3>
                  <span className="text-xs text-slate-400 tabular-nums">{kolom.length}</span>
                </div>
                {kolom.map((i) => <Tegel key={i.name} idee={i} labels={labels} onOpen={() => setSelected(i.name)} onStatus={() => cycleStatus(i.name, i.status)} />)}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <BrainstormDetail key={selected} name={selected} labels={labels} onClose={() => { setSelected(null); load(); }}
          onChanged={() => { /* de lijst ververst bij het sluiten */ }}
          onDeleted={() => { setSelected(null); load(); }} />
      )}
      {labelsOpen && (
        <BrainstormLabels labels={labels} onClose={() => setLabelsOpen(false)} onChanged={() => listLabels().then(setLabels)} />
      )}
    </div>
  );
}

function SortableTegel(props: { idee: IdeeMetVoortgang; labels: Label[]; onOpen: () => void; onStatus: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.idee.name });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <li ref={setNodeRef} style={style}>
      <Tegel {...props} grip={
        <button type="button" className="mt-0.5 p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
          <GripVertical size={18} />
        </button>
      } />
    </li>
  );
}

function Tegel({ idee, labels, onOpen, onStatus, grip }: {
  idee: IdeeMetVoortgang; labels: Label[]; onOpen: () => void; onStatus: () => void; grip?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const klaar = idee.status === "Klaar";
  const ideeLabels = parseLabels(idee.labels);
  return (
    <div className={`flex items-start gap-2 bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-slate-300 hover:shadow-sm ${klaar ? "opacity-60" : ""}`}>
      {grip}
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left space-y-1.5 cursor-pointer">
        <p className={`text-sm font-semibold ${klaar ? "line-through text-slate-400" : "text-slate-800"}`}>
          <span className="font-mono text-xs text-slate-400 mr-1.5">{ideeCode(idee.name)}</span>{idee.titel}
        </p>
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
          {idee.aantalPunten > 0 && <span className="tabular-nums">{t("brainstorm.progress", { done: idee.aantalGedaan, total: idee.aantalPunten })}</span>}
          {idee.datum && <span>{formatDatum(idee.datum, i18n.language)}</span>}
          <DeadlineBadge deadline={idee.deadline} status={idee.status} />
          {idee.koppeling && <span className="inline-flex items-center gap-1 truncate max-w-[16rem]"><Link2 size={11} />{idee.koppeling}</span>}
        </div>
        {ideeLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ideeLabels.map((l) => <LabelChip key={l} label={l} groep={groepVan(l, labels)} />)}
          </div>
        )}
        {idee.aantalPunten > 0 && (
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-y-teal" style={{ width: `${(100 * idee.aantalGedaan) / idee.aantalPunten}%` }} />
          </div>
        )}
      </button>
      <StatusKnop status={idee.status} onClick={onStatus} />
    </div>
  );
}
