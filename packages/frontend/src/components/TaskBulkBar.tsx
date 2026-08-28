/**
 * Bulkbalk boven de takentabel: toont wat er geselecteerd is en voert er één
 * bewerking op uit.
 *
 * De balk voert zélf uit (in plaats van alleen een intentie omhoog te geven),
 * omdat voortgang en foutrapport bij elkaar horen: bij ~440 taken is "12 van 87
 * bijgewerkt…" geen sierlijkheid maar het enige signaal dat er iets gebeurt, en
 * het rapport eronder is de plek waar deelfouten zichtbaar blijven in plaats van
 * onder een toast te verdwijnen. De ouder krijgt achteraf het resultaat en
 * beslist wat er met de lijst en de selectie gebeurt.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X, ChevronDown, Flag, Briefcase, Calendar, UserPlus, Trash2,
  CircleDot, AlertTriangle, CheckCircle2, Loader2,
} from "lucide-react";
import { runBulk, type BulkResult } from "../lib/bulk-run";
import { applyTaskEdit, deleteTask, type TaskBulkEdit } from "../lib/task-bulk";
import type { ProjectRecord } from "../lib/DataContext";

/** Hoeveel taken tegelijk. Genoeg om 400 taken vlot weg te werken, laag genoeg
 * om een Frappe-instance niet plat te leggen (dezelfde orde als de
 * pagineerbatches in `fetchAll`). */
const CONCURRENCY = 5;

export interface BulkEmployee {
  name: string;
  employee_name: string;
  company_email?: string;
  user_id?: string;
}

interface Props {
  /** Alle geselecteerde taaknamen. */
  selectedIds: string[];
  /** Hoeveel taken voldoen er in totaal aan het huidige filter. */
  filteredCount: number;
  /** Mag "selecteer alle N die aan het filter voldoen" getoond worden? */
  canSelectAllFiltered: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  /** Huidige toewijzingen per taak — nodig om te kunnen vervangen zonder per
   * taak eerst het document op te halen. */
  assigneesByTask: Map<string, string[]>;
  statusOptions: string[];
  priorityOptions: string[];
  projects: ProjectRecord[];
  employees: BulkEmployee[];
  /** Na afloop: lijst verversen, selectie opschonen. */
  onFinished: (result: BulkResult) => void;
}

type Menu = "status" | "priority" | "project" | "assign" | "deadline" | null;

export default function TaskBulkBar({
  selectedIds, filteredCount, canSelectAllFiltered, onSelectAllFiltered,
  onClearSelection, assigneesByTask, statusOptions, priorityOptions,
  projects, employees, onFinished,
}: Props) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<Menu>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<BulkResult | null>(null);
  const abortRef = useRef<{ aborted: boolean } | null>(null);

  const count = selectedIds.length;
  const running = progress !== null;

  // Het rapport moet een geslaagde bulk overleven: de ouder haalt de geslaagde
  // taken meteen uit de selectie, dus bij volledig succes gaat `count` naar 0.
  // Alleen wanneer de gebruiker daarná een níeuwe selectie begint (0 → >0)
  // verdwijnt het oude rapport.
  const prevCount = useRef(count);
  useEffect(() => {
    if (prevCount.current === 0 && count > 0) setReport(null);
    prevCount.current = count;
  }, [count]);

  // Niets geselecteerd én niets te melden → de balk hoort er niet te staan.
  if (count === 0 && !running && !report) return null;

  async function execute(worker: (id: string) => Promise<void>) {
    setMenu(null);
    setReport(null);
    const signal = { aborted: false };
    abortRef.current = signal;
    setProgress({ done: 0, total: selectedIds.length });
    const result = await runBulk(selectedIds, worker, {
      concurrency: CONCURRENCY,
      signal,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    abortRef.current = null;
    setProgress(null);
    setReport(result);
    onFinished(result);
  }

  function runEdit(edit: TaskBulkEdit) {
    void execute((name) => applyTaskEdit(name, edit, assigneesByTask.get(name) ?? []));
  }

  function runDelete() {
    if (!window.confirm(t("tasks.bulk.confirm_delete", { n: count }))) return;
    void execute((name) => deleteTask(name));
  }

  return (
    <div className="mb-3 rounded-xl border border-y-teal/30 bg-y-teal/5 shadow-sm">
      {/* Selectie-regel — verdwijnt als er na een geslaagde bulk niets meer
          geselecteerd is, terwijl het rapport eronder blijft staan. */}
      {(count > 0 || running) && (
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="text-sm font-semibold text-slate-700">
          {t("tasks.bulk.selected", { n: count })}
        </span>
        <button
          onClick={onClearSelection}
          disabled={running}
          className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer disabled:opacity-50"
        >
          {t("tasks.bulk.clear_selection")}
        </button>

        {canSelectAllFiltered && (
          <button
            onClick={onSelectAllFiltered}
            disabled={running}
            className="text-xs font-medium text-y-teal hover:text-y-teal-dark underline underline-offset-2 cursor-pointer disabled:opacity-50"
          >
            {t("tasks.bulk.select_all_filtered", { n: filteredCount })}
          </button>
        )}

        <div className="flex-1" />

        {running ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={14} className="animate-spin text-y-teal" />
              {t("tasks.bulk.progress", { done: progress.done, total: progress.total })}
            </span>
            <button
              onClick={() => { if (abortRef.current) abortRef.current.aborted = true; }}
              className="text-xs text-slate-500 hover:text-red-600 underline underline-offset-2 cursor-pointer"
            >
              {t("tasks.bulk.stop")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <MenuButton icon={CircleDot} label={t("tasks.bulk.status")} open={menu === "status"}
              onToggle={() => setMenu(menu === "status" ? null : "status")}>
              <OptionList
                options={statusOptions}
                onPick={(value) => runEdit({ status: value })}
              />
            </MenuButton>

            <MenuButton icon={Flag} label={t("tasks.bulk.priority")} open={menu === "priority"}
              onToggle={() => setMenu(menu === "priority" ? null : "priority")}>
              <OptionList
                options={priorityOptions}
                onPick={(value) => runEdit({ priority: value })}
              />
            </MenuButton>

            <MenuButton icon={Briefcase} label={t("tasks.bulk.project")} open={menu === "project"}
              onToggle={() => setMenu(menu === "project" ? null : "project")}>
              <ProjectPicker
                projects={projects}
                onPick={(name) => runEdit({ project: name })}
              />
            </MenuButton>

            <MenuButton icon={UserPlus} label={t("tasks.bulk.assign")} open={menu === "assign"}
              onToggle={() => setMenu(menu === "assign" ? null : "assign")}>
              <AssignPicker employees={employees} onApply={runEdit} />
            </MenuButton>

            <MenuButton icon={Calendar} label={t("tasks.bulk.deadline")} open={menu === "deadline"}
              onToggle={() => setMenu(menu === "deadline" ? null : "deadline")}>
              <DeadlinePicker onApply={(value) => runEdit({ exp_end_date: value })} />
            </MenuButton>

            <button
              onClick={runDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 size={14} />
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
      )}

      {report && <BulkReport result={report} onDismiss={() => setReport(null)} />}
    </div>
  );
}

/* ─── Rapport ────────────────────────────────────────────────────────────── */

function BulkReport({ result, onDismiss }: { result: BulkResult; onDismiss: () => void }) {
  const { t } = useTranslation();
  const hasFailures = result.failed.length > 0;
  return (
    <div className={`border-t px-4 py-3 ${hasFailures ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-start gap-2">
        {hasFailures
          ? <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          : <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${hasFailures ? "text-amber-800" : "text-emerald-800"}`}>
            {hasFailures
              ? t("tasks.bulk.report_partial", { ok: result.succeeded.length, failed: result.failed.length })
              : t("tasks.bulk.report_ok", { n: result.succeeded.length })}
          </p>
          {hasFailures && (
            <>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.failed.map((f) => (
                  <li key={f.id} className="text-xs text-amber-900">
                    <span className="font-mono font-medium">{f.id}</span>
                    {" — "}
                    {f.permission && (
                      <span className="font-semibold">{t("tasks.bulk.no_permission")}: </span>
                    )}
                    {f.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">{t("tasks.bulk.failed_stay_selected")}</p>
            </>
          )}
        </div>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-black/5 cursor-pointer flex-shrink-0">
          <X size={14} className="text-slate-500" />
        </button>
      </div>
    </div>
  );
}

/* ─── Menu-schil ─────────────────────────────────────────────────────────── */

function MenuButton({ icon: Icon, label, open, onToggle, children }: {
  icon: typeof Flag;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
          open ? "border-y-teal bg-white text-y-teal" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        <Icon size={14} />
        {label}
        <ChevronDown size={12} className="text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[220px]">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function OptionList({ options, onPick }: { options: string[]; onPick: (value: string) => void }) {
  return (
    <>
      {options.map((value) => (
        <button
          key={value}
          onClick={() => onPick(value)}
          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          {value}
        </button>
      ))}
    </>
  );
}

/* ─── Project ────────────────────────────────────────────────────────────── */

function ProjectPicker({ projects, onPick }: { projects: ProjectRecord[]; onPick: (name: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = projects
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.project_name?.toLowerCase().includes(q))
    .slice(0, 40);
  return (
    <div className="w-72">
      <div className="px-2 pt-1 pb-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tasks.create.project_search")}
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {matches.map((p) => (
          <button
            key={p.name}
            onClick={() => onPick(p.name)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <span className="font-mono text-xs text-slate-400">{p.name}</span>
            <span className="block truncate">{p.project_name || "-"}</span>
          </button>
        ))}
        {matches.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400">{t("tasks.bulk.no_results")}</p>
        )}
      </div>
      <button
        onClick={() => onPick("")}
        className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border-t border-slate-100 cursor-pointer"
      >
        {t("tasks.bulk.clear_project")}
      </button>
    </div>
  );
}

/* ─── Toewijzen ──────────────────────────────────────────────────────────── */

function AssignPicker({ employees, onApply }: {
  employees: BulkEmployee[];
  onApply: (edit: TaskBulkEdit) => void;
}) {
  const { t } = useTranslation();
  const [replace, setReplace] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Alleen medewerkers met een e-mailadres: `assign_to` verwacht een User-id en
  // een medewerker zonder gekoppelde gebruiker levert gegarandeerd een fout per
  // taak op — die hoort niet in de keuzelijst.
  const options = employees
    .map((e) => ({ email: e.user_id || e.company_email || "", label: e.employee_name }))
    .filter((e) => e.email)
    .filter((e) => !q || e.label.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));

  return (
    <div className="w-72">
      <label className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 border-b border-slate-100 cursor-pointer">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
        />
        {t("tasks.bulk.replace_assignees")}
      </label>
      <div className="px-2 pt-2 pb-1">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tasks.create.assign")}
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {options.map((o) => (
          <button
            key={o.email}
            onClick={() => onApply({ assignAdd: [o.email], assignClear: replace })}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {o.label}
            <span className="block text-xs text-slate-400 truncate">{o.email}</span>
          </button>
        ))}
        {options.length === 0 && (
          <p className="px-3 py-2 text-sm text-slate-400">{t("tasks.bulk.no_results")}</p>
        )}
      </div>
      <button
        onClick={() => onApply({ assignClear: true })}
        className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border-t border-slate-100 cursor-pointer"
      >
        {t("tasks.bulk.clear_assignees")}
      </button>
    </div>
  );
}

/* ─── Deadline ───────────────────────────────────────────────────────────── */

function DeadlinePicker({ onApply }: { onApply: (value: string) => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  return (
    <div className="w-60 px-3 py-2 space-y-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
      />
      <button
        onClick={() => date && onApply(date)}
        disabled={!date}
        className="w-full px-3 py-1.5 rounded-lg bg-y-teal text-white text-sm hover:bg-y-teal-dark disabled:opacity-40 cursor-pointer"
      >
        {t("tasks.bulk.apply")}
      </button>
      <button
        onClick={() => onApply("")}
        className="w-full text-left text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
      >
        {t("tasks.bulk.clear_deadline")}
      </button>
    </div>
  );
}
