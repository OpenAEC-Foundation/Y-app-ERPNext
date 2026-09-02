/**
 * De connectiekolom: navigeren op waar de mail aan hángt, niet op mappen.
 *
 * Elke categorie is zelf klikbaar ("alles wat aan een project hangt") én
 * uitklapbaar naar de concrete objecten (dit project, deze klant). Een mail
 * die aan twee dingen hangt, staat onder allebei — dat is de bedoeling en
 * wordt niet ontdubbeld.
 *
 * **Lui.** De momentopname (`loadConnectionIndex`) draait pas bij de eerste
 * uitklap, niet bij het openen van de mailpagina: de categorieën zijn meteen
 * klikbaar en de tellingen komen erbij zodra ze er zijn. Zonder die scheiding
 * zou de mailpagina drie extra queries wachten voordat er iets te zien is.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Link2 } from "lucide-react";
import {
  CONNECTION_CATEGORIES,
  connectionFolderId,
  loadConnectionIndex,
  peekConnectionIndex,
  type ConnectionCategoryId,
  type ConnectionIndex,
  type ConnectionObject,
} from "../../lib/mail-connections";
import { connectionIcon } from "../../lib/connection-visuals";

/** Hoeveel objecten per categorie in de kolom passen voordat het een lijst wordt. */
const MAX_VISIBLE_OBJECTS = 25;

export interface ConnectionNavProps {
  activeFolder: string;
  onSelect: (folderId: string) => void;
  /** Sleep een mail op een object: koppel hem eraan. Alleen zinvol voor projecten. */
  onDropOnObject?: (obj: ConnectionObject, event: React.DragEvent) => void;
  /** Signaal dat de koppelingen gewijzigd zijn (koppelen, verwijderen). */
  reloadToken?: number;
}

export default function ConnectionNav({
  activeFolder, onSelect, onDropOnObject, reloadToken = 0,
}: ConnectionNavProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<ConnectionIndex | null>(() => peekConnectionIndex());
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<Set<ConnectionCategoryId>>(() => new Set());
  const [showAll, setShowAll] = useState<Set<ConnectionCategoryId>>(() => new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);

  const ensureIndex = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    loadConnectionIndex()
      .then(setIndex)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [loading]);

  // Koppelingen zijn gewijzigd: opnieuw ophalen, maar alleen als de kolom al
  // een keer is opengeklapt — anders zou een koppelactie de luiheid ongedaan
  // maken die het openen van de mailpagina snel houdt.
  useEffect(() => {
    if (reloadToken === 0) return;
    const current = peekConnectionIndex();
    if (!current) return;
    // Bewust geen synchrone `setLoading(true)` hier: dat is een cascaderende
    // render in een effect-body, en de kolom toont ondertussen gewoon de
    // vorige tellingen door.
    loadConnectionIndex({ force: true })
      .then(setIndex)
      .catch(() => { /* de vorige momentopname blijft staan; beter dan leeg */ });
  }, [reloadToken]);

  const toggle = useCallback((id: ConnectionCategoryId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else { next.add(id); if (!index) ensureIndex(); }
      return next;
    });
  }, [index, ensureIndex]);

  return (
    <div>
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <Link2 size={10} className="text-slate-400" aria-hidden />
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {t("y_next.conn_section")}
        </span>
        {loading && <Loader2 size={9} className="animate-spin text-slate-300" />}
      </div>

      {CONNECTION_CATEGORIES.map((cat) => {
        const catFolder = connectionFolderId({ category: cat.id });
        const active = activeFolder === catFolder;
        const stats = index?.categories.find((c) => c.id === cat.id);
        const open = expanded.has(cat.id);
        const Icon = connectionIcon(cat.id);
        // "Niet gekoppeld" is de restcategorie: er zijn geen objecten om naar
        // uit te klappen, alleen de lijst zelf.
        const expandable = cat.id !== "unlinked";
        const objects = stats?.objects ?? [];
        const visible = showAll.has(cat.id) ? objects : objects.slice(0, MAX_VISIBLE_OBJECTS);

        return (
          <div key={cat.id}>
            <div className="flex items-center">
              {expandable ? (
                <button onClick={() => toggle(cat.id)} title={t("y_next.conn_expand")}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                  {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
              ) : <span className="w-[19px]" />}
              <button
                onClick={() => onSelect(catFolder)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                  active ? "bg-blue-100 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-100"
                }`}>
                <Icon size={13} className={active ? "text-blue-600" : "text-slate-400"} />
                <span className="truncate flex-1 text-left">{t(cat.labelKey)}</span>
                {stats && stats.total > 0 && (
                  <span className={`text-[10px] font-semibold ${stats.unseen > 0 ? "text-blue-600" : "text-slate-400"}`}>
                    {stats.unseen > 0 ? stats.unseen : stats.total}
                  </span>
                )}
              </button>
            </div>

            {open && (
              <div className="pl-6">
                {!index && loading && (
                  <p className="px-3 py-1 text-[11px] text-slate-400 italic">{t("common.loading")}</p>
                )}
                {failed && (
                  <button onClick={ensureIndex}
                    className="px-3 py-1 text-[11px] text-slate-400 italic hover:text-blue-600 cursor-pointer">
                    {t("y_next.conn_load_failed")}
                  </button>
                )}
                {index && objects.length === 0 && (
                  <p className="px-3 py-1 text-[11px] text-slate-400 italic">{t("y_next.conn_empty")}</p>
                )}
                {visible.map((obj) => {
                  const id = connectionFolderId({
                    category: obj.category, doctype: obj.doctype, docname: obj.name,
                  });
                  const isActive = activeFolder === id;
                  const droppable = Boolean(onDropOnObject) && obj.category === "project";
                  return (
                    <button key={id}
                      onClick={() => onSelect(id)}
                      onDragOver={droppable ? (e) => {
                        e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(id);
                      } : undefined}
                      onDragLeave={droppable ? () => setDragOver((p) => (p === id ? null : p)) : undefined}
                      onDrop={droppable ? (e) => { setDragOver(null); onDropOnObject?.(obj, e); } : undefined}
                      title={`${obj.doctype}: ${obj.name}`}
                      className={`w-full flex items-center gap-2 px-3 py-1 text-[11px] rounded-lg cursor-pointer transition-colors ${
                        dragOver === id ? "bg-blue-200 text-blue-800 ring-1 ring-blue-400"
                          : isActive ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-500 hover:bg-slate-100"
                      }`}>
                      <span className="truncate flex-1 text-left">{obj.label}</span>
                      <span className={obj.unseen > 0 ? "text-blue-600 font-semibold" : "text-slate-400"}>
                        {obj.unseen > 0 ? obj.unseen : obj.total}
                      </span>
                    </button>
                  );
                })}
                {objects.length > visible.length && (
                  <button onClick={() => setShowAll((prev) => new Set(prev).add(cat.id))}
                    className="px-3 py-1 text-[11px] text-blue-600 hover:underline cursor-pointer">
                    {t("y_next.conn_show_all", { count: objects.length })}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
