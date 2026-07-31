import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, FolderTree, FolderPlus, ChevronDown, Loader2, Check, ArrowRight } from "lucide-react";
import type { MatchConfidence } from "../lib/project-mail-match";
import type { MailSide } from "../lib/project-folder-resolve";

export interface SortRowProposal {
  uid: number;
  subject: string;
  sourceFolder: string;
  side: MailSide;
  /** Bestaande doelmap-pad, of null als er (nog) geen map is. */
  proposedFolder: string | null;
  confidence: MatchConfidence;
  /** Reden-key: "link" | "thread" | "history" | "number" | "reference" | "name". */
  reason: string;
  /** "[IN] 3001 Naam" — getoond als project matcht maar map ontbreekt. */
  createFolderName: string | null;
  ambiguous: boolean;
  /** Mail staat al in de voorgestelde map. */
  alreadyHere?: boolean;
  loadingThread?: boolean;
}

export interface SortMove {
  uid: number;
  /** Verplaats naar deze bestaande map (of null → maak createFolderName aan). */
  toFolder: string | null;
  createFolderName: string | null;
  side: MailSide;
}

interface FolderOption {
  path: string;
  name: string;
  specialUse: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  proposals: SortRowProposal[];
  folders: FolderOption[];
  onConfirm: (moves: SortMove[]) => void;
}

interface RowState {
  checked: boolean;
  targetFolder: string | null; // gekozen bestaande map (override of voorstel)
  createFolder: boolean; // maak createFolderName aan i.p.v. bestaande map
}

const CONFIDENCE_STYLE: Record<MatchConfidence, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-500",
  none: "bg-slate-100 text-slate-400",
};

function leaf(path: string): string {
  return path.split(/[./]/).pop() || path;
}

export function SortToProjectDialog({ open, onClose, proposals, folders, onConfirm }: Props) {
  const { t } = useTranslation();
  // Alleen de handmatige afwijkingen worden opgeslagen; de effectieve rij-status
  // wordt afgeleid uit de voorstellen + overrides. Zo volgt een rij die tijdens
  // de thread-verrijking van "none" naar "high" springt automatisch het nieuwe
  // voorstel, tenzij de gebruiker 'm al had aangepast. (Geen setState-in-effect.)
  const [overrides, setOverrides] = useState<Record<number, Partial<RowState>>>({});

  const rows = useMemo<Record<number, RowState>>(() => {
    const out: Record<number, RowState> = {};
    for (const p of proposals) {
      const o = overrides[p.uid] || {};
      const defChecked =
        (p.confidence === "high" || p.confidence === "medium") &&
        !p.alreadyHere &&
        !!(p.proposedFolder || p.createFolderName);
      out[p.uid] = {
        checked: o.checked ?? defChecked,
        targetFolder: o.targetFolder !== undefined ? o.targetFolder : p.proposedFolder,
        createFolder: o.createFolder ?? (!p.proposedFolder && !!p.createFolderName),
      };
    }
    return out;
  }, [proposals, overrides]);

  const confidenceLabel = (c: MatchConfidence): string =>
    t(`webmail.sort_to_project.confidence_${c}`);

  const reasonLabel = (reason: string): string => {
    const key = `webmail.sort_to_project.reason_${reason}`;
    const val = t(key);
    return val === key ? "" : val;
  };

  const actionableMoves = useMemo<SortMove[]>(() => {
    const moves: SortMove[] = [];
    for (const p of proposals) {
      const r = rows[p.uid];
      if (!r || !r.checked) continue;
      if (r.targetFolder && r.targetFolder !== p.sourceFolder) {
        moves.push({ uid: p.uid, toFolder: r.targetFolder, createFolderName: null, side: p.side });
      } else if (r.createFolder && p.createFolderName) {
        moves.push({ uid: p.uid, toFolder: null, createFolderName: p.createFolderName, side: p.side });
      }
    }
    return moves;
  }, [rows, proposals]);

  if (!open) return null;

  const setRow = (uid: number, patch: Partial<RowState>) =>
    setOverrides((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch } }));

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — 3BM huisstijl */}
        <div className="bg-[#350E35] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderTree size={20} className="text-white" />
            <div>
              <h2 className="text-base font-semibold text-white">{t("webmail.sort_to_project.title")}</h2>
              <p className="text-xs text-[#45B6A8]">{t("webmail.sort_to_project.subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 cursor-pointer" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="h-1 bg-[#45B6A8]" />

        <div className="px-4 py-3 overflow-y-auto flex-1">
          {proposals.length === 0 ? (
            <p className="text-sm text-slate-400 italic px-2 py-6 text-center">
              {t("webmail.sort_to_project.none_to_move")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="w-8"></th>
                  <th className="text-left font-medium py-1.5 px-2">{t("webmail.sort_to_project.col_subject")}</th>
                  <th className="text-left font-medium py-1.5 px-2">{t("webmail.sort_to_project.col_target")}</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const r = rows[p.uid] || { checked: false, targetFolder: p.proposedFolder, createFolder: false };
                  const disabled = !p.proposedFolder && !p.createFolderName;
                  return (
                    <tr key={p.uid} className="border-b border-slate-50 align-top">
                      <td className="py-2 px-1">
                        <input
                          type="checkbox"
                          checked={r.checked}
                          disabled={disabled}
                          onChange={(e) => setRow(p.uid, { checked: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-slate-800 truncate max-w-[280px]" title={p.subject}>
                          {p.subject || t("webmail.no_subject", { defaultValue: "(geen onderwerp)" })}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={p.sourceFolder}>
                            {leaf(p.sourceFolder)}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_STYLE[p.confidence]}`}>
                            {confidenceLabel(p.confidence)}
                          </span>
                          {p.loadingThread && <Loader2 size={11} className="animate-spin text-slate-400" />}
                          {reasonLabel(p.reason) && !p.loadingThread && (
                            <span className="text-[10px] text-slate-400 italic">{reasonLabel(p.reason)}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {p.alreadyHere ? (
                          <span className="text-xs text-slate-400 italic">{t("webmail.sort_to_project.already_here")}</span>
                        ) : (
                          <TargetCell
                            row={r}
                            proposal={p}
                            folders={folders}
                            onPickFolder={(path) => setRow(p.uid, { targetFolder: path, createFolder: false, checked: true })}
                            onToggleCreate={() => setRow(p.uid, { createFolder: true, targetFolder: null, checked: true })}
                            createLabel={t("webmail.sort_to_project.create_folder_label", { name: p.createFolderName || "" })}
                            noFolderLabel={t("webmail.sort_to_project.no_folder_this_side")}
                            searchPlaceholder={t("webmail.search_folders", { defaultValue: "Zoek mappen..." })}
                            ambiguousHint={t("webmail.sort_to_project.ambiguous_hint")}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 flex items-center justify-between gap-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            {t("webmail.sort_to_project.summary", { n: actionableMoves.length, total: proposals.length })}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
              {t("common.cancel", { defaultValue: "Annuleren" })}
            </button>
            <button
              onClick={() => onConfirm(actionableMoves)}
              disabled={actionableMoves.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#45B6A8] text-white rounded-lg hover:bg-[#3aa093] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium cursor-pointer transition-colors"
            >
              <ArrowRight size={15} />
              {t("webmail.sort_to_project.move_button")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Doel-cel: toont het huidige doel + een zoekbare map-dropdown (override),
 *  of een "map aanmaken"-optie / "geen map"-melding. */
function TargetCell({
  row,
  proposal,
  folders,
  onPickFolder,
  onToggleCreate,
  createLabel,
  noFolderLabel,
  searchPlaceholder,
  ambiguousHint,
}: {
  row: RowState;
  proposal: SortRowProposal;
  folders: FolderOption[];
  onPickFolder: (path: string) => void;
  onToggleCreate: () => void;
  createLabel: string;
  noFolderLabel: string;
  searchPlaceholder: string;
  ambiguousHint: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return folders
      .filter((f) => f.path !== proposal.sourceFolder && !f.specialUse)
      .filter((f) => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 60);
  }, [folders, search, proposal.sourceFolder]);

  const currentLabel = row.createFolder
    ? createLabel
    : row.targetFolder
      ? leaf(row.targetFolder)
      : proposal.createFolderName
        ? createLabel
        : noFolderLabel;

  const isCreate = row.createFolder || (!row.targetFolder && !!proposal.createFolderName);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded border text-xs cursor-pointer ${
          isCreate ? "border-violet-200 bg-violet-50 text-violet-700" : row.targetFolder ? "border-slate-200 text-slate-700" : "border-slate-100 text-slate-400"
        }`}
      >
        {isCreate ? <FolderPlus size={12} className="shrink-0" /> : <FolderTree size={12} className="shrink-0" />}
        <span className="truncate flex-1">{currentLabel}</span>
        <ChevronDown size={11} className="shrink-0 text-slate-400" />
      </button>
      {proposal.ambiguous && !open && (
        <p className="text-[10px] text-amber-600 mt-0.5">{ambiguousHint}</p>
      )}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-[110] flex flex-col max-h-72">
          <div className="p-2 border-b border-slate-100">
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {proposal.createFolderName && (
              <button
                onClick={() => { onToggleCreate(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-50 cursor-pointer flex items-center gap-2 border-b border-slate-50"
              >
                <FolderPlus size={12} className="shrink-0" />
                <span className="truncate">{createLabel}</span>
              </button>
            )}
            {filtered.map((f) => (
              <button
                key={f.path}
                onClick={() => { onPickFolder(f.path); setOpen(false); setSearch(""); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 cursor-pointer flex items-center gap-2"
              >
                {row.targetFolder === f.path ? <Check size={12} className="shrink-0 text-violet-600" /> : <FolderTree size={12} className="shrink-0 text-slate-400" />}
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {filtered.length === 0 && !proposal.createFolderName && (
              <p className="text-xs text-slate-400 italic px-3 py-2">{noFolderLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
