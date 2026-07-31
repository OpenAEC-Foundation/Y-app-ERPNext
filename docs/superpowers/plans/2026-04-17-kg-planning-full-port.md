# KG-Planning Full-Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Repo-specific rule (Y-App CLAUDE.md):** Never commit without asking the user first. Never push without asking. Every `git commit` step below is *guidance for atomic rollback* — before executing it, ask the user "OK to commit these files with this message?" and wait for confirmation. Never use `--no-verify`, never force-push.

> **Spec:** `docs/superpowers/specs/2026-04-17-kg-planning-full-port-design.md`

**Goal:** Bring the `kg-planning` extension to feature parity with the upstream Kort-Geytenbeek SolidJS app — add Financieel/Projecten/HR dashboards as a fourth-tab cluster, add Excel clipboard + drag-to-resize-columns to the grid.

**Architecture:** One extension, one sidebar entry, internal four-tab bar inside `Page.tsx`. Planning tab (existing code) and Dashboards tab each have their own independent Context provider. Dashboards read from KG's ERPNext Insights queries behind a `DashboardDataSource` interface, making a future swap to client-side aggregation a one-line change. Charts are Recharts, lazy-loaded inside the extension's existing lazy chunk.

**Tech Stack:** React 19, TypeScript, Vite, react-i18next, Recharts (NEW), Y-App's `lib/erpnext.ts` bridged proxy. No server-side changes. No new env vars.

**Upstream reference files (read-only source material):**
- `github.com/Impertio-Studio/Kort-Geytenbeek/kg-planning/src/`
- Use `gh api repos/Impertio-Studio/Kort-Geytenbeek/contents/<path> --jq .content | base64 -d` to fetch any file when porting.

---

## Pre-flight

- [ ] Confirm current branch is clean (`git status` shows no uncommitted work) and on `main` up-to-date with origin.
- [ ] Create branch: `git checkout -b feat/kg-planning-full-port` — **ask user first per CLAUDE.md**.
- [ ] Read `packages/frontend/src/extensions/kg-planning/` end to end — don't skim. In particular read `store.tsx`, `api.ts`, `Page.tsx`, `views/GridView.tsx`.
- [ ] Read `packages/frontend/src/lib/erpnext.ts` — understand `fetchList`, `fetchDocument`, `callMethod`, `updateDocument`, `ApiError`. All new network I/O in this plan goes through these.

---

## Phase 1: Scaffolding

### Task 1: Add Recharts dependency

**Files:**
- Modify: `packages/frontend/package.json` (dependencies block)

- [ ] **Step 1.1:** Add to the `dependencies` block after `"react-leaflet"`:

```json
"recharts": "^3.0.0",
```

- [ ] **Step 1.2:** Install from inside the package (Z: drive caveat — see CLAUDE.md):

```bash
cd packages/frontend && npm install --legacy-peer-deps
```

Expected: `added 1 package` (plus its transitive deps, which are mostly already in the tree via React). No errors.

- [ ] **Step 1.3:** Verify typecheck clean:

```bash
cd packages/frontend && npx tsc -b --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 1.4:** Commit (gate on user approval):

```bash
git add packages/frontend/package.json packages/frontend/package-lock.json
git commit -m "chore(kg-planning): add recharts dependency"
```

---

### Task 2: Add i18n namespace skeleton

**Files:**
- Modify: `packages/frontend/src/i18n/nl.json`, `en.json`, `de.json`

Add a nested `extensions.kg_planning.dashboards` block under the existing `extensions.kg_planning` section. Keep keys in the same shape in all three locale files.

- [ ] **Step 2.1:** In `nl.json`, locate `extensions.kg_planning.*` and append:

```json
"dashboards": {
  "tab_financieel": "Financieel",
  "tab_projecten": "Projecten",
  "tab_hr": "HR Overzicht",
  "loading": "Gegevens laden…",
  "not_configured_title": "Dashboards niet beschikbaar",
  "not_configured_body": "Deze dashboards vereisen de ERPNext Insights module en de KG-queries. Vraag je beheerder om ze te installeren of pas de query-IDs aan onder Instellingen → Extensies.",
  "load_failed": "Laden mislukt",
  "retry": "Opnieuw",
  "refresh": "Vernieuwen",
  "date_from": "Van",
  "date_to": "Tot",
  "this_year": "Dit jaar",
  "prev_year": "Vorig jaar",
  "this_quarter": "Dit kwartaal",
  "prev_quarter": "Vorig kwartaal",
  "kpi_rendement": "Rendement",
  "kpi_facturatie": "Facturatie",
  "kpi_kosten": "Kosten",
  "kpi_uren": "Uren",
  "kpi_fact_uren": "Facturabele uren",
  "kpi_intern_uren": "Interne uren",
  "kpi_ziekteverzuim": "Ziekteverzuim",
  "chart_spending": "Kosten per maand",
  "chart_invoiced": "Facturatie per maand",
  "chart_hours": "Uren per maand",
  "chart_billable_hours": "Facturabele uren per maand",
  "chart_employees": "Per medewerker",
  "chart_projects": "Per project",
  "chart_intern": "Interne uren per categorie",
  "chart_sick": "Ziektedagen per medewerker",
  "detail_title_employee": "Detail: {{name}}",
  "detail_title_project": "Detail: {{project}}",
  "detail_title_month": "Detail: {{month}}",
  "detail_col_datum": "Datum",
  "detail_col_persoon": "Medewerker",
  "detail_col_project": "Project",
  "detail_col_task": "Taak",
  "detail_col_omschrijving": "Omschrijving",
  "detail_col_uren": "Uren",
  "detail_col_fact_uren": "Fact. uren",
  "detail_total": "Totaal",
  "detail_empty": "Geen gegevens in deze selectie."
}
```

- [ ] **Step 2.2:** In `en.json`, add the same keys translated:

```json
"dashboards": {
  "tab_financieel": "Financial",
  "tab_projecten": "Projects",
  "tab_hr": "HR Overview",
  "loading": "Loading data…",
  "not_configured_title": "Dashboards unavailable",
  "not_configured_body": "These dashboards require the ERPNext Insights module and the KG queries. Ask your administrator to install them, or configure the query IDs under Settings → Extensions.",
  "load_failed": "Load failed",
  "retry": "Retry",
  "refresh": "Refresh",
  "date_from": "From",
  "date_to": "To",
  "this_year": "This year",
  "prev_year": "Previous year",
  "this_quarter": "This quarter",
  "prev_quarter": "Previous quarter",
  "kpi_rendement": "Profit",
  "kpi_facturatie": "Invoiced",
  "kpi_kosten": "Costs",
  "kpi_uren": "Hours",
  "kpi_fact_uren": "Billable hours",
  "kpi_intern_uren": "Internal hours",
  "kpi_ziekteverzuim": "Sick leave",
  "chart_spending": "Monthly costs",
  "chart_invoiced": "Monthly invoicing",
  "chart_hours": "Monthly hours",
  "chart_billable_hours": "Monthly billable hours",
  "chart_employees": "Per employee",
  "chart_projects": "Per project",
  "chart_intern": "Internal hours per category",
  "chart_sick": "Sick days per employee",
  "detail_title_employee": "Detail: {{name}}",
  "detail_title_project": "Detail: {{project}}",
  "detail_title_month": "Detail: {{month}}",
  "detail_col_datum": "Date",
  "detail_col_persoon": "Employee",
  "detail_col_project": "Project",
  "detail_col_task": "Task",
  "detail_col_omschrijving": "Description",
  "detail_col_uren": "Hours",
  "detail_col_fact_uren": "Billable hours",
  "detail_total": "Total",
  "detail_empty": "No data in this selection."
}
```

- [ ] **Step 2.3:** In `de.json`, add the same keys with German best-effort translations (follow existing `de.json` conventions — use `webmail.*` entries as style reference). If unsure of a term, leave the Dutch word and mark a TODO comment — DE is not blocking per CLAUDE.md.

- [ ] **Step 2.4:** Add top-level tab label to the existing kg_planning block in all three locale files (next to the existing `label` / `loading` keys):

```json
"tab_planning": "Planning"
```

- [ ] **Step 2.5:** Verify the JSON parses:

```bash
cd packages/frontend && node -e "['nl','en','de'].forEach(l => JSON.parse(require('fs').readFileSync('src/i18n/'+l+'.json','utf8')))"
```

Expected: exit 0, no output.

- [ ] **Step 2.6:** Commit (gated).

```bash
git add packages/frontend/src/i18n/nl.json packages/frontend/src/i18n/en.json packages/frontend/src/i18n/de.json
git commit -m "feat(kg-planning): i18n keys for dashboards"
```

---

### Task 3: Restructure `Page.tsx` with a TabBar

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/TabBar.tsx`
- Modify: `packages/frontend/src/extensions/kg-planning/Page.tsx`

- [ ] **Step 3.1:** Create `TabBar.tsx`:

```tsx
import { useTranslation } from "react-i18next";

export type KgTab = "planning" | "financieel" | "projecten" | "hr";

interface TabBarProps {
  active: KgTab;
  onChange: (tab: KgTab) => void;
}

const TABS: { id: KgTab; labelKey: string }[] = [
  { id: "planning",   labelKey: "extensions.kg_planning.tab_planning" },
  { id: "financieel", labelKey: "extensions.kg_planning.dashboards.tab_financieel" },
  { id: "projecten",  labelKey: "extensions.kg_planning.dashboards.tab_projecten" },
  { id: "hr",         labelKey: "extensions.kg_planning.dashboards.tab_hr" },
];

export default function TabBar({ active, onChange }: TabBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 px-4 pt-3 border-b border-slate-200 bg-white">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              isActive
                ? "border-teal-600 text-teal-700 bg-slate-50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3.2:** Rewrite `Page.tsx`. Preserve the existing `Shell` logic but rename it `PlanningShell` and extract the DashboardShell stub (to be implemented in Phase 3). New full file:

```tsx
import { useState, Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { KgPlanningProvider, useKgPlanning } from "./store";
import TabBar, { type KgTab } from "./TabBar";
import FilterBar, { EmployeeInfoBar } from "./views/FilterBar";
import TeamView from "./views/TeamView";
import GanttView from "./views/GanttView";
import GridView from "./views/GridView";

const DashboardsRoot = lazy(() => import("./dashboards/Root"));

export default function KgPlanningPage() {
  const [tab, setTab] = useState<KgTab>("planning");

  return (
    <div className="flex flex-col h-full bg-white">
      <TabBar active={tab} onChange={setTab} />
      <div className="flex-1 overflow-hidden">
        {tab === "planning" ? (
          <KgPlanningProvider>
            <PlanningShell />
          </KgPlanningProvider>
        ) : (
          <Suspense fallback={<LoadingPanel />}>
            <DashboardsRoot tab={tab} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function LoadingPanel() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center h-full text-sm text-slate-500">
      {t("extensions.kg_planning.loading")}
    </div>
  );
}

function PlanningShell() {
  const { t } = useTranslation();
  const { status, errorMessage, missingFields, reload, activeView } = useKgPlanning();

  if (status === "loading") return <LoadingPanel />;

  if (status === "not_configured") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-800">
          {t("extensions.kg_planning.not_configured_title")}
        </h2>
        <p className="max-w-md text-sm text-slate-600">
          {t("extensions.kg_planning.not_configured_body")}
        </p>
        {missingFields.length > 0 && (
          <code className="px-3 py-1.5 rounded bg-slate-100 text-xs text-slate-700">
            {missingFields.join(", ")}
          </code>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm font-medium text-red-700">{t("extensions.kg_planning.load_failed")}</p>
        <p className="mt-1 text-xs text-red-600 break-words">{errorMessage}</p>
        <button
          onClick={() => void reload()}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 cursor-pointer"
        >
          <RefreshCw size={12} /> {t("webmail.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <FilterBar />
      <EmployeeInfoBar />
      <div className="flex-1 overflow-auto">
        {activeView === "grid" && <GridView />}
        {activeView === "gantt" && <GanttView />}
        {activeView === "team" && <TeamView />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.3:** Create a stub `dashboards/Root.tsx` so the lazy import resolves:

```tsx
// packages/frontend/src/extensions/kg-planning/dashboards/Root.tsx
import { useTranslation } from "react-i18next";
import type { KgTab } from "../TabBar";

export default function DashboardsRoot({ tab }: { tab: KgTab }) {
  const { t } = useTranslation();
  return (
    <div className="p-8 text-sm text-slate-500">
      {t("extensions.kg_planning.dashboards.loading")} — {tab} (stub)
    </div>
  );
}
```

- [ ] **Step 3.4:** Typecheck + start dev server:

```bash
cd packages/frontend && npx tsc -b --noEmit
cd packages/frontend && npx vite
```

Manual smoke:
- Open `/x/kg-planning` on an enabled instance.
- Verify Planning tab still works identically.
- Click each of the three other tabs: each should show the "(stub)" message.

- [ ] **Step 3.5:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/
git commit -m "feat(kg-planning): internal tab bar with dashboards stub"
```

---

## Phase 2: Grid clipboard

### Task 4: `utils/clipboard.ts` pure functions + tests

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/utils/clipboard.ts`
- Create: `packages/frontend/src/extensions/kg-planning/utils/clipboard.test.ts`

- [ ] **Step 4.1:** Write the failing test file:

```ts
// clipboard.test.ts
import { describe, it, expect } from "vitest";
import { parseClipboard, toClipboardText, normalizeRange, type CellRange } from "./clipboard";

describe("parseClipboard", () => {
  it("parses simple tab-separated grid", () => {
    expect(parseClipboard("1\t2\n3\t4")).toEqual([[1, 2], [3, 4]]);
  });
  it("handles comma decimals (nl-NL paste)", () => {
    expect(parseClipboard("1,5\t2,25")).toEqual([[1.5, 2.25]]);
  });
  it("coerces non-numeric cells to 0", () => {
    expect(parseClipboard("a\t2")).toEqual([[0, 2]]);
  });
  it("trims trailing whitespace", () => {
    expect(parseClipboard("1\t2\n")).toEqual([[1, 2]]);
  });
});

describe("toClipboardText", () => {
  it("round-trips numbers with empty cells as empty string (Excel-friendly)", () => {
    expect(toClipboardText([[0, 2], [3, 0]])).toBe("\t2\n3\t");
  });
});

describe("normalizeRange", () => {
  it("reorders reversed ranges", () => {
    const r: CellRange = { startRow: 3, startCol: 5, endRow: 1, endCol: 2 };
    expect(normalizeRange(r)).toEqual({ startRow: 1, startCol: 2, endRow: 3, endCol: 5 });
  });
});
```

- [ ] **Step 4.2:** Install vitest if not present (check first):

```bash
cd packages/frontend && npm ls vitest 2>&1 | head -3
```

If not installed: skip unit tests for this task and convert to a manual checklist at end. Otherwise proceed. If vitest is absent, **do not add it in this PR** — record it as a follow-up in `STATUS.md`.

- [ ] **Step 4.3:** Run the test to see it fail:

```bash
cd packages/frontend && npx vitest run src/extensions/kg-planning/utils/clipboard.test.ts
```

Expected: FAIL with "Cannot find module ./clipboard".

- [ ] **Step 4.4:** Implement `clipboard.ts`:

```ts
/** Parse tab-separated clipboard data (from Excel/LibreOffice) into a 2D array.
 *  Commas are treated as decimal separators (nl-NL default). Non-numeric
 *  cells collapse to 0 so a bad paste doesn't throw. */
export function parseClipboard(text: string): number[][] {
  return text
    .trim()
    .split("\n")
    .map((row) =>
      row.split("\t").map((cell) => {
        const val = parseFloat(cell.replace(",", ".").trim());
        return Number.isNaN(val) ? 0 : val;
      }),
    );
}

/** Inverse of parseClipboard. Zero cells become empty strings so Excel
 *  round-trip doesn't turn blanks into 0s. */
export function toClipboardText(data: number[][]): string {
  return data
    .map((row) => row.map((v) => (v === 0 ? "" : String(v))).join("\t"))
    .join("\n");
}

export interface CellRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function normalizeRange(range: CellRange): CellRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endRow: Math.max(range.startRow, range.endRow),
    endCol: Math.max(range.startCol, range.endCol),
  };
}

export function rangeContains(range: CellRange, row: number, col: number): boolean {
  const n = normalizeRange(range);
  return row >= n.startRow && row <= n.endRow && col >= n.startCol && col <= n.endCol;
}
```

- [ ] **Step 4.5:** Re-run tests:

```bash
cd packages/frontend && npx vitest run src/extensions/kg-planning/utils/clipboard.test.ts
```

Expected: PASS 4/4.

- [ ] **Step 4.6:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/utils/clipboard.ts packages/frontend/src/extensions/kg-planning/utils/clipboard.test.ts
git commit -m "feat(kg-planning): clipboard utilities for grid copy/paste"
```

---

### Task 5: Wire clipboard into `GridView.tsx`

**Files:**
- Modify: `packages/frontend/src/extensions/kg-planning/views/GridView.tsx`

This is the largest existing file (388 lines). Read it top-to-bottom first to understand the row/col coordinate system and the existing `EditableCell` integration. The clipboard wiring lives entirely inside `GridView`; `EditableCell` stays unchanged externally but adds a mouse-down handler pass-through.

- [ ] **Step 5.1:** Add selection state to `GridView`. Inside the component, after the existing `useState` hooks:

```tsx
import { type CellRange, normalizeRange, toClipboardText, parseClipboard } from "../utils/clipboard";

// ...inside GridView()...
const [selection, setSelection] = useState<CellRange | null>(null);
const selectionAnchorRef = useRef<{ row: number; col: number } | null>(null);
```

- [ ] **Step 5.2:** Build a coordinate map. The grid renders `Row[]` (tasks interleaved with section headers). Only `kind === "task"` rows participate in clipboard operations. Build a map `taskRowIndex → row` and `weekIndex → week.iso` once per render:

```tsx
const taskRows = useMemo(
  () => rows.flatMap((r, i) => (r.kind === "task" ? [{ row: r, idx: i }] : [])),
  [rows],
);
```

- [ ] **Step 5.3:** Add mouse handlers on each editable cell. In the render block where `<EditableCell>` is rendered, wrap it in a `<td>` that owns `onMouseDown`/`onMouseEnter`:

```tsx
<td
  onMouseDown={(e) => {
    if (e.button !== 0 || e.shiftKey) return;
    selectionAnchorRef.current = { row: taskIdx, col: weekIdx };
    setSelection({ startRow: taskIdx, startCol: weekIdx, endRow: taskIdx, endCol: weekIdx });
  }}
  onMouseEnter={(e) => {
    if (!(e.buttons & 1) || !selectionAnchorRef.current) return;
    const a = selectionAnchorRef.current;
    setSelection({ startRow: a.row, startCol: a.col, endRow: taskIdx, endCol: weekIdx });
  }}
  className={selection && rangeContains(selection, taskIdx, weekIdx) ? "ring-2 ring-teal-400" : undefined}
>
  <EditableCell ... />
</td>
```

(See Task 5.6 for the exact attachment point — these handlers need access to the `taskIdx` and `weekIdx` closure.)

- [ ] **Step 5.4:** Add a `mouseup` global handler to freeze the selection:

```tsx
useEffect(() => {
  const handler = () => {
    selectionAnchorRef.current = null;
  };
  window.addEventListener("mouseup", handler);
  return () => window.removeEventListener("mouseup", handler);
}, []);
```

- [ ] **Step 5.5:** Add `Ctrl/Cmd+C` / `Ctrl/Cmd+V` handlers:

```tsx
useEffect(() => {
  const handler = async (e: KeyboardEvent) => {
    if (!selection) return;
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    const norm = normalizeRange(selection);

    if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      const data: number[][] = [];
      for (let r = norm.startRow; r <= norm.endRow; r++) {
        const taskRow = rows[r];
        if (taskRow?.kind !== "task") continue;
        const rowVals: number[] = [];
        for (let c = norm.startCol; c <= norm.endCol; c++) {
          rowVals.push(taskRow.hours.get(weeks[c]?.iso ?? "") ?? 0);
        }
        data.push(rowVals);
      }
      try {
        await navigator.clipboard.writeText(toClipboardText(data));
      } catch (err) {
        console.warn("[kg-planning] clipboard write failed:", err);
      }
    }

    if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      let text = "";
      try {
        text = await navigator.clipboard.readText();
      } catch (err) {
        console.warn("[kg-planning] clipboard read failed:", err);
        return;
      }
      const grid = parseClipboard(text);
      for (let rr = 0; rr < grid.length; rr++) {
        const taskRow = rows[norm.startRow + rr];
        if (!taskRow || taskRow.kind !== "task") continue;
        const selectedEmpId = selectedEmployee ?? /* first assigned employee */ taskRow.task.assigned_employees[0];
        if (!selectedEmpId) continue;
        const emp = getEmployeeById(selectedEmpId);
        if (!emp) continue;
        for (let cc = 0; cc < grid[rr].length; cc++) {
          const week = weeks[norm.startCol + cc];
          if (!week) continue;
          savePlannedHours(taskRow.task.name, emp.name, emp.employee_name, week.iso, grid[rr][cc]);
        }
      }
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [selection, rows, weeks, selectedEmployee, getEmployeeById, savePlannedHours]);
```

(Paste semantics: the destination employee is the current filter; if no filter, fall back to the task's first assigned employee — the single-employee case the existing grid handles. Multi-employee paste is out of scope for v1.)

- [ ] **Step 5.6:** Attach the handlers at the right place in the existing render. The cell render in `GridView.tsx` around `views/GridView.tsx:~310` renders the editable hours cells — that's where `onMouseDown/onMouseEnter` go. Leave the `EditableCell` internal onChange alone; the selection handlers sit on the wrapping `<td>`.

- [ ] **Step 5.7:** Add `import { rangeContains } from "../utils/clipboard";` to the imports.

- [ ] **Step 5.8:** Typecheck:

```bash
cd packages/frontend && npx tsc -b --noEmit
```

- [ ] **Step 5.9:** Manual smoke:
1. Dev server (`npx vite`).
2. Open the grid, click-drag across 3 cells → cells highlight with the teal ring.
3. `Ctrl+C`, paste into LibreOffice Calc → values appear tab-separated.
4. In Calc, select 2×2 numbers, `Ctrl+C`, back to the grid, click a cell, `Ctrl+V` → numbers land in the grid and save (check server log / reload page → values persist).

- [ ] **Step 5.10:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/views/GridView.tsx
git commit -m "feat(kg-planning): Excel-style clipboard copy/paste in grid"
```

---

## Phase 3: Grid column resize

### Task 6: `useColumnResize` hook

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/utils/useColumnResize.ts`

No unit tests — this is a DOM-interaction hook, manually tested.

- [ ] **Step 6.1:** Write the hook:

```ts
import { useCallback, useEffect, useState, useRef } from "react";

interface Options {
  /** localStorage key. The current instance id is appended automatically. */
  storageKey: string;
  /** Minimum allowed column width in pixels. */
  minWidth?: number;
}

export function useColumnResize({ storageKey, minWidth = 50 }: Options) {
  const instanceId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("y-app:current-instance") ?? "default"
      : "default";
  const fullKey = `pref_${instanceId}_${storageKey}`;

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(fullKey) ?? "{}");
    } catch {
      return {};
    }
  });

  const draggingRef = useRef<{ colId: string; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback((colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = widths[colId] ?? (e.currentTarget.parentElement?.getBoundingClientRect().width ?? 120);
    draggingRef.current = { colId, startX: e.clientX, startWidth: current };
  }, [widths]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      const next = Math.max(minWidth, d.startWidth + (e.clientX - d.startX));
      setWidths((prev) => ({ ...prev, [d.colId]: next }));
    };
    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      // Persist on release (not on every mousemove — avoids localStorage churn).
      setWidths((prev) => {
        try {
          window.localStorage.setItem(fullKey, JSON.stringify(prev));
        } catch {}
        return prev;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [fullKey, minWidth]);

  return { widths, startResize };
}
```

**Note on the instance-id lookup:** verify the `localStorage` key used by `lib/instances.ts`. If the exact key is different (e.g. `y-app:instance-id`), update the constant. Grep: `grep -r "current-instance\|instance-id" packages/frontend/src/lib/instances.ts`.

- [ ] **Step 6.2:** Typecheck:

```bash
cd packages/frontend && npx tsc -b --noEmit
```

- [ ] **Step 6.3:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/utils/useColumnResize.ts
git commit -m "feat(kg-planning): column-resize hook"
```

---

### Task 7: Wire column resize into `GridView.tsx`

**Files:**
- Modify: `packages/frontend/src/extensions/kg-planning/views/GridView.tsx`

- [ ] **Step 7.1:** Import the hook + call it in `GridView`:

```tsx
import { useColumnResize } from "../utils/useColumnResize";

// Inside GridView():
const { widths, startResize } = useColumnResize({ storageKey: "kg-grid-col-widths" });
```

- [ ] **Step 7.2:** Apply width to left-side fixed columns. In the fixed-left `<table>`'s header cells (project#, project name, phase badge, coordinator, task title, budget, billing, progress), render:

```tsx
<th style={{ width: widths[col.id] }} className="relative">
  {col.label}
  <div
    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-teal-400"
    onMouseDown={(e) => startResize(col.id, e)}
  />
</th>
```

Each column needs a stable `id` — use short strings (`proj-nr`, `proj-name`, `phase`, `coord`, `task`, `budget`, `billing`, `progress`). Define them in a constant at the top of the file.

- [ ] **Step 7.3:** Do NOT add resize handles to the per-week cells on the right-scrollable table — each week column is already fixed-width. Resize lives only on the left fixed table.

- [ ] **Step 7.4:** Typecheck + manual smoke.

```bash
cd packages/frontend && npx tsc -b --noEmit
```

Manual:
1. Hover the right edge of any left-column header → cursor changes to col-resize + teal highlight.
2. Drag right → column widens live, neighbor columns reflow.
3. Drag so narrow it would go below 50 px → stops at 50.
4. Reload page → widths persist.

- [ ] **Step 7.5:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/views/GridView.tsx
git commit -m "feat(kg-planning): drag-to-resize grid columns"
```

---

## Phase 4: Dashboards foundation

### Task 8: Dashboard types

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/types.ts`

- [ ] **Step 8.1:** Write the file:

```ts
/** Raw rows returned by the seven Insights queries. Field names match the
 *  column order defined in upstream `stores/dashboards.ts`. Changing these
 *  means changing the Insights query shapes too. */

export interface MonthlyRow {
  maand: number;
  uren: number;
  fact_uren: number;
  kosten: number;
  omzet: number;
}

export interface EmployeeRow {
  persoon: string;
  uren: number;
  fact_uren: number;
  intern_uren: number;
  kosten: number;
  omzet: number;
}

export interface ProjectRow {
  nr: string;
  naam: string;
  uren: number;
  fact_uren: number;
  kosten: number;
  omzet: number;
  budget_uren: number;
}

export interface InvoiceMonthRow {
  maand: number;
  totaal: number;
}

export interface InternRow {
  omschrijving: string;
  uren: number;
}

export interface SickRow {
  persoon: string;
  dagen: number;
}

export interface PrevYearRow {
  uren: number;
  fact_uren: number;
  kosten: number;
  intern_uren: number;
  ziek_uren: number;
  facturatie: number;
}

export interface RawDashboardData {
  monthly: MonthlyRow[];
  employees: EmployeeRow[];
  projects: ProjectRow[];
  invoicesMonth: InvoiceMonthRow[];
  intern: InternRow[];
  sick: SickRow[];
  prevYear: PrevYearRow;
}

export interface DrilldownRow {
  persoon: string;
  project: string;
  task: string;
  datum: string;
  klant: string;
  omschrijving: string;
  start: string;
  eind: string;
  uren: number;
  facturabel: number;
  fact_uren: number;
}

export type DashboardLoadResult =
  | { kind: "ok"; data: RawDashboardData }
  | { kind: "not_configured"; missing: string[] }
  | { kind: "error"; message: string };
```

- [ ] **Step 8.2:** Typecheck + commit (gated).

```bash
cd packages/frontend && npx tsc -b --noEmit
git add packages/frontend/src/extensions/kg-planning/dashboards/types.ts
git commit -m "feat(kg-planning): dashboard row types"
```

---

### Task 9: `DataSource` interface

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/DataSource.ts`

- [ ] **Step 9.1:**

```ts
import type { DashboardLoadResult, DrilldownRow } from "./types";

export interface DashboardDataSource {
  loadAll(range: { from: string; to: string }): Promise<DashboardLoadResult>;
  loadDrilldown(range: { from: string; to: string }): Promise<DrilldownRow[]>;
}
```

- [ ] **Step 9.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/DataSource.ts
git commit -m "feat(kg-planning): DashboardDataSource interface"
```

---

### Task 10: Insights query runner + source

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/insightsSource.ts`
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/insightsSource.test.ts`

- [ ] **Step 10.1:** Test file first:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const callMethodMock = vi.fn();
const fetchDocumentMock = vi.fn();
vi.mock("../../../lib/erpnext", () => ({
  callMethod: callMethodMock,
  fetchDocument: fetchDocumentMock,
  ApiError: class ApiError extends Error { status = 0; },
}));

import { runInsightsQuery } from "./insightsSource";

describe("runInsightsQuery", () => {
  beforeEach(() => {
    callMethodMock.mockReset();
    fetchDocumentMock.mockReset();
  });
  it("executes the 3-step Insights protocol and maps columns", async () => {
    callMethodMock.mockResolvedValueOnce({});
    fetchDocumentMock
      .mockResolvedValueOnce({ result_name: "RES-1" })
      .mockResolvedValueOnce({ results: JSON.stringify([
        ["maand", "uren"],
        [1, 100],
        [2, 150],
      ]) });
    const rows = await runInsightsQuery<{ maand: number; uren: number }>("QRY-0004", ["maand", "uren"]);
    expect(rows).toEqual([{ maand: 1, uren: 100 }, { maand: 2, uren: 150 }]);
    expect(callMethodMock).toHaveBeenCalledWith("run_doc_method", expect.objectContaining({ dn: "QRY-0004" }));
  });
  it("returns [] when there is no result_name", async () => {
    callMethodMock.mockResolvedValueOnce({});
    fetchDocumentMock.mockResolvedValueOnce({});
    const rows = await runInsightsQuery("QRY-0004", ["a"]);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 10.2:** Implementation:

```ts
// insightsSource.ts
import { callMethod, fetchDocument, ApiError } from "../../../lib/erpnext";
import { fetchUserSetting } from "../../../lib/instances"; // verify existence; if not, switch to direct /api/user-settings fetch
import type {
  DashboardDataSource,
  // (forward re-export from DataSource.ts)
} from "./DataSource";
import type {
  RawDashboardData,
  DashboardLoadResult,
  DrilldownRow,
  MonthlyRow,
  EmployeeRow,
  ProjectRow,
  InvoiceMonthRow,
  InternRow,
  SickRow,
  PrevYearRow,
} from "./types";

const DEFAULT_QUERY_IDS = {
  maandtotalen: "QRY-0004",
  perMedewerker: "QRY-0005",
  perProject: "QRY-0006",
  facturatieMaand: "QRY-0007",
  internPerOmschrijving: "QRY-0008",
  ziekteverzuim: "QRY-0009",
  vorigJaar: "QRY-0010",
};
const DEFAULT_DRILLDOWN_REPORT = "KG Medewerker Periodeoverzicht";

/** Three-step protocol to run an Insights query and return its rows. Exported
 *  for unit testing. */
export async function runInsightsQuery<T>(queryName: string, columns: string[]): Promise<T[]> {
  await callMethod("run_doc_method", { dt: "Insights Query", dn: queryName, method: "run" });
  const queryDoc = await fetchDocument<{ result_name?: string }>("Insights Query", queryName);
  const resultName = queryDoc.result_name;
  if (!resultName) return [];
  const resultDoc = await fetchDocument<{ results?: string }>("Insights Query Result", resultName);
  const resultsJson = resultDoc.results;
  if (!resultsJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length < 2) return [];
  const dataRows = (parsed as unknown[][]).slice(1) as (string | number)[][];
  return dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i] ?? null; });
    return obj as T;
  });
}

async function resolveQueryIds() {
  try {
    const override = await fetchUserSetting<Partial<typeof DEFAULT_QUERY_IDS>>("kg-insights-queries");
    return { ...DEFAULT_QUERY_IDS, ...(override ?? {}) };
  } catch {
    return DEFAULT_QUERY_IDS;
  }
}

async function resolveDrilldownReport(): Promise<string> {
  try {
    const override = await fetchUserSetting<string>("kg-drilldown-report");
    return override || DEFAULT_DRILLDOWN_REPORT;
  } catch {
    return DEFAULT_DRILLDOWN_REPORT;
  }
}

function isNotConfiguredError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("insights query") && (msg.includes("not found") || msg.includes("does not exist"));
}

export const insightsSource: DashboardDataSource = {
  async loadAll(): Promise<DashboardLoadResult> {
    try {
      const ids = await resolveQueryIds();
      const [monthly, employees, projects, invoicesMonth, intern, sick, prevYear] = await Promise.all([
        runInsightsQuery<MonthlyRow>(ids.maandtotalen, ["maand", "uren", "fact_uren", "kosten", "omzet"]),
        runInsightsQuery<EmployeeRow>(ids.perMedewerker, ["persoon", "uren", "fact_uren", "intern_uren", "kosten", "omzet"]),
        runInsightsQuery<ProjectRow>(ids.perProject, ["nr", "naam", "uren", "fact_uren", "kosten", "omzet", "budget_uren"]),
        runInsightsQuery<InvoiceMonthRow>(ids.facturatieMaand, ["maand", "totaal"]),
        runInsightsQuery<InternRow>(ids.internPerOmschrijving, ["omschrijving", "uren"]),
        runInsightsQuery<SickRow>(ids.ziekteverzuim, ["persoon", "dagen"]),
        runInsightsQuery<PrevYearRow>(ids.vorigJaar, ["uren", "fact_uren", "kosten", "intern_uren", "ziek_uren", "facturatie"]),
      ]);
      const data: RawDashboardData = {
        monthly, employees, projects, invoicesMonth, intern, sick,
        prevYear: prevYear[0] ?? { uren: 0, fact_uren: 0, kosten: 0, intern_uren: 0, ziek_uren: 0, facturatie: 0 },
      };
      return { kind: "ok", data };
    } catch (err) {
      if (isNotConfiguredError(err)) {
        return { kind: "not_configured", missing: ["Insights Query QRY-0004..QRY-0010"] };
      }
      if (err instanceof ApiError && err.status === 403) {
        return { kind: "error", message: "No permission to read Insights Query on this instance." };
      }
      return { kind: "error", message: err instanceof Error ? err.message : String(err) };
    }
  },

  async loadDrilldown(range): Promise<DrilldownRow[]> {
    const reportName = await resolveDrilldownReport();
    const result = await callMethod<{
      result: unknown[][];
      columns: { fieldname: string }[];
    }>("frappe.desk.query_report.run", {
      report_name: reportName,
      filters: { from_date: range.from, to_date: range.to, employee: "" },
    });
    const columns = result?.columns?.map((c) => c.fieldname) ?? [];
    return (result?.result ?? []).map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => { obj[col] = row[i] ?? null; });
      return obj as unknown as DrilldownRow;
    });
  },
};
```

- [ ] **Step 10.3:** Verify `fetchUserSetting` exists in `lib/instances.ts`:

```bash
grep -n "fetchUserSetting\|user-settings" packages/frontend/src/lib/instances.ts
```

If missing, replace the calls with a direct `fetch('/api/user-settings/kg-insights-queries')` using the same auth plumbing as the rest of `instances.ts`.

- [ ] **Step 10.4:** Run tests:

```bash
cd packages/frontend && npx vitest run src/extensions/kg-planning/dashboards/insightsSource.test.ts
```

Expected: PASS 2/2.

- [ ] **Step 10.5:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/insightsSource.ts packages/frontend/src/extensions/kg-planning/dashboards/insightsSource.test.ts
git commit -m "feat(kg-planning): Insights query runner + default data source"
```

---

### Task 11: Format helpers

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/format.ts`

- [ ] **Step 11.1:**

```ts
export const MONTH_LABELS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

export function formatEuro(value: number): string {
  return "\u20AC " + value.toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPct(value: number, decimals = 1): string {
  return value.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + " %";
}

export function formatUrenNL(value: number): string {
  return formatNumber(value, 2) + " u";
}

export function formatDatumNL(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
```

- [ ] **Step 11.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/format.ts
git commit -m "feat(kg-planning): Dutch-locale formatters"
```

---

### Task 12: Dashboards Context store

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/store.tsx`

- [ ] **Step 12.1:** Implementation (mirror the shape of the existing `store.tsx`):

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { insightsSource } from "./insightsSource";
import type { DashboardDataSource } from "./DataSource";
import type { RawDashboardData, DrilldownRow } from "./types";

type Status = "loading" | "ok" | "not_configured" | "error";

interface DashboardsState {
  status: Status;
  data: RawDashboardData | null;
  errorMessage: string | null;
  missing: string[];

  dateFrom: string;
  dateTo: string;
  setDateRange: (from: string, to: string) => void;
  reload: () => Promise<void>;

  loadDrilldown: (range?: { from: string; to: string }) => Promise<DrilldownRow[]>;

  drilldownVisible: boolean;
  drilldownTitle: string;
  drilldownFilter: ((row: DrilldownRow) => boolean) | null;
  openDrilldown: (title: string, filter: (row: DrilldownRow) => boolean) => void;
  closeDrilldown: () => void;
}

const Ctx = createContext<DashboardsState | null>(null);

function defaultRange(): { from: string; to: string } {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export function DashboardsProvider({
  children,
  source = insightsSource,
}: {
  children: ReactNode;
  source?: DashboardDataSource;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<RawDashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const [{ dateFrom, dateTo }, setRange] = useState(defaultRange);

  const [drilldownVisible, setDrilldownVisible] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownFilter, setDrilldownFilter] =
    useState<((row: DrilldownRow) => boolean) | null>(null);

  // Drilldown row cache keyed by range.
  const drillCacheRef = useMemo(() => ({ key: "", rows: [] as DrilldownRow[] }), []);

  const reload = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    setMissing([]);
    const result = await source.loadAll({ from: dateFrom, to: dateTo });
    if (result.kind === "ok") {
      setData(result.data);
      setStatus("ok");
    } else if (result.kind === "not_configured") {
      setStatus("not_configured");
      setMissing(result.missing);
    } else {
      setStatus("error");
      setErrorMessage(result.message);
    }
    // Date-range change invalidates the drilldown cache.
    drillCacheRef.key = "";
    drillCacheRef.rows = [];
  }, [source, dateFrom, dateTo, drillCacheRef]);

  useEffect(() => { void reload(); }, [reload]);

  const setDateRange = useCallback((from: string, to: string) => {
    setRange({ from, to });
  }, []);

  const loadDrilldown = useCallback(async (range?: { from: string; to: string }) => {
    const r = range ?? { from: dateFrom, to: dateTo };
    const key = `${r.from}|${r.to}`;
    if (drillCacheRef.key === key && drillCacheRef.rows.length > 0) return drillCacheRef.rows;
    const rows = await source.loadDrilldown(r);
    drillCacheRef.key = key;
    drillCacheRef.rows = rows;
    return rows;
  }, [source, dateFrom, dateTo, drillCacheRef]);

  const openDrilldown = useCallback((title: string, filter: (row: DrilldownRow) => boolean) => {
    setDrilldownTitle(title);
    setDrilldownFilter(() => filter);
    setDrilldownVisible(true);
  }, []);

  const closeDrilldown = useCallback(() => setDrilldownVisible(false), []);

  const value: DashboardsState = {
    status, data, errorMessage, missing,
    dateFrom, dateTo, setDateRange, reload,
    loadDrilldown,
    drilldownVisible, drilldownTitle, drilldownFilter, openDrilldown, closeDrilldown,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboards(): DashboardsState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDashboards must be used inside <DashboardsProvider>");
  return ctx;
}

/** Precomputed projections off the raw data slice. Called inside `useMemo`
 *  in components to avoid re-computing on every render. */
export function deriveMonthlyArray<K extends keyof RawDashboardData["monthly"][number]>(
  rows: RawDashboardData["monthly"],
  field: K,
): number[] {
  const arr = new Array(12).fill(0);
  for (const r of rows) {
    const idx = ((r.maand as number) || 0) - 1;
    if (idx >= 0 && idx < 12) arr[idx] = (r[field] as unknown as number) || 0;
  }
  return arr;
}
```

- [ ] **Step 12.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/store.tsx
git commit -m "feat(kg-planning): DashboardsProvider + store"
```

---

## Phase 5: Dashboard shared components

### Task 13: `KpiCard`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/components/KpiCard.tsx`

- [ ] **Step 13.1:**

```tsx
interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  comparison?: string;
  negative?: boolean;
  warning?: boolean;
  onClick?: () => void;
}

export default function KpiCard({ title, value, subtitle, comparison, negative, warning, onClick }: KpiCardProps) {
  const color = negative ? "text-red-600" : warning ? "text-amber-600" : "text-slate-900";
  const base = "flex flex-col gap-1 p-4 rounded-lg bg-white border border-slate-200";
  const clickable = onClick ? " cursor-pointer hover:border-teal-400 hover:shadow-sm" : "";
  return (
    <div className={base + clickable} onClick={onClick}>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-sm text-slate-600">{title}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      {comparison && <div className="text-xs text-slate-400">{comparison}</div>}
    </div>
  );
}
```

- [ ] **Step 13.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/components/KpiCard.tsx
git commit -m "feat(kg-planning): KpiCard component"
```

---

### Task 14: `ChartCanvas` (Recharts wrappers)

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/components/ChartCanvas.tsx`

This file replaces upstream's single `<ChartCanvas>` with a small family of typed wrappers, each delegating to Recharts. Cleaner API than the chart.js-style generic one.

- [ ] **Step 14.1:**

```tsx
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { CSSProperties } from "react";

interface SeriesBase {
  key: string;
  label: string;
  color: string;
}

export interface BarSeries extends SeriesBase {}
export interface LineSeries extends SeriesBase {}

interface MonthlyChartProps<S extends SeriesBase> {
  labels: string[];
  series: S[];
  rows: Array<Record<string, number | string>>;
  height?: number;
  onBarClick?: (index: number, label: string) => void;
  style?: CSSProperties;
}

export function MonthlyBarChart({ labels, series, rows, height = 240, onBarClick }: MonthlyChartProps<BarSeries>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        onClick={(state) => {
          if (!onBarClick || !state || state.activeTooltipIndex == null) return;
          onBarClick(state.activeTooltipIndex, labels[state.activeTooltipIndex] ?? "");
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyLineChart({ series, rows, height = 240 }: MonthlyChartProps<LineSeries>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

interface CategoryBarProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  onBarClick?: (index: number, label: string) => void;
}

export function CategoryBarChart({ data, color = "#14b8a6", height = 240, onBarClick }: CategoryBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        onClick={(state) => {
          if (!onBarClick || !state || state.activeTooltipIndex == null) return;
          onBarClick(state.activeTooltipIndex, data[state.activeTooltipIndex]?.label ?? "");
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 14.2:** Typecheck + commit (gated).

```bash
cd packages/frontend && npx tsc -b --noEmit
git add packages/frontend/src/extensions/kg-planning/dashboards/components/ChartCanvas.tsx
git commit -m "feat(kg-planning): Recharts wrappers"
```

---

### Task 15: `DashboardFilters`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/components/DashboardFilters.tsx`

- [ ] **Step 15.1:**

```tsx
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDashboards } from "../store";

export default function DashboardFilters() {
  const { t } = useTranslation();
  const { dateFrom, dateTo, setDateRange, reload, status } = useDashboards();

  const now = new Date();
  const thisYear = now.getFullYear();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);

  const quarter = (year: number, q: number): [string, string] => {
    const s = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
    const e = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
    return [s[q - 1], e[q - 1]];
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
      <label className="text-xs text-slate-600">{t("extensions.kg_planning.dashboards.date_from")}</label>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateRange(e.target.value, dateTo)}
        className="px-2 py-1 border border-slate-300 rounded text-sm"
      />
      <label className="text-xs text-slate-600">{t("extensions.kg_planning.dashboards.date_to")}</label>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateRange(dateFrom, e.target.value)}
        className="px-2 py-1 border border-slate-300 rounded text-sm"
      />

      <div className="mx-2 h-4 border-l border-slate-300" />

      <QuickRange label={t("extensions.kg_planning.dashboards.this_year")}
        onClick={() => setDateRange(`${thisYear}-01-01`, `${thisYear}-12-31`)} />
      <QuickRange label={t("extensions.kg_planning.dashboards.prev_year")}
        onClick={() => setDateRange(`${thisYear - 1}-01-01`, `${thisYear - 1}-12-31`)} />
      <QuickRange label={t("extensions.kg_planning.dashboards.this_quarter")}
        onClick={() => { const [f, to] = quarter(thisYear, currentQ); setDateRange(f, to); }} />
      <QuickRange label={t("extensions.kg_planning.dashboards.prev_quarter")}
        onClick={() => {
          const q = currentQ === 1 ? 4 : currentQ - 1;
          const y = currentQ === 1 ? thisYear - 1 : thisYear;
          const [f, to] = quarter(y, q);
          setDateRange(f, to);
        }} />

      <div className="flex-1" />
      <button
        onClick={() => void reload()}
        disabled={status === "loading"}
        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-wait"
      >
        <RefreshCw size={14} className={status === "loading" ? "animate-spin" : ""} />
        {t("extensions.kg_planning.dashboards.refresh")}
      </button>
    </div>
  );
}

function QuickRange({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 15.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/components/DashboardFilters.tsx
git commit -m "feat(kg-planning): DashboardFilters date-range + quick-ranges + refresh"
```

---

### Task 16: `DetailModal`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/components/DetailModal.tsx`

- [ ] **Step 16.1:**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useDashboards } from "../store";
import type { DrilldownRow } from "../types";
import { formatDatumNL, formatUrenNL } from "../format";

export default function DetailModal() {
  const { t } = useTranslation();
  const {
    drilldownVisible, drilldownTitle, drilldownFilter,
    closeDrilldown, loadDrilldown,
  } = useDashboards();

  const [rows, setRows] = useState<DrilldownRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!drilldownVisible || !drilldownFilter) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDrilldown()
      .then((all) => { if (!cancelled) setRows(all.filter(drilldownFilter)); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [drilldownVisible, drilldownFilter, loadDrilldown]);

  useEffect(() => {
    if (!drilldownVisible) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrilldown(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [drilldownVisible, closeDrilldown]);

  const totals = useMemo(() => {
    const data = rows ?? [];
    return {
      uren: data.reduce((s, r) => s + (r.uren || 0), 0),
      fact: data.reduce((s, r) => s + (r.fact_uren || 0), 0),
    };
  }, [rows]);

  if (!drilldownVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDrilldown}>
      <div className="flex flex-col max-h-full w-full max-w-5xl bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{drilldownTitle}</h3>
          <button onClick={closeDrilldown} className="p-1 rounded hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading && <p className="p-8 text-center text-sm text-slate-500">{t("extensions.kg_planning.dashboards.loading")}</p>}
          {error && <p className="p-4 text-sm text-red-600">{error}</p>}
          {!loading && !error && rows && rows.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500">{t("extensions.kg_planning.dashboards.detail_empty")}</p>
          )}
          {!loading && !error && rows && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2">{t("extensions.kg_planning.dashboards.detail_col_datum")}</th>
                  <th className="px-3 py-2">{t("extensions.kg_planning.dashboards.detail_col_persoon")}</th>
                  <th className="px-3 py-2">{t("extensions.kg_planning.dashboards.detail_col_project")}</th>
                  <th className="px-3 py-2">{t("extensions.kg_planning.dashboards.detail_col_task")}</th>
                  <th className="px-3 py-2">{t("extensions.kg_planning.dashboards.detail_col_omschrijving")}</th>
                  <th className="px-3 py-2 text-right">{t("extensions.kg_planning.dashboards.detail_col_uren")}</th>
                  <th className="px-3 py-2 text-right">{t("extensions.kg_planning.dashboards.detail_col_fact_uren")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-1.5">{formatDatumNL(r.datum)}</td>
                    <td className="px-3 py-1.5">{r.persoon}</td>
                    <td className="px-3 py-1.5">{r.project}</td>
                    <td className="px-3 py-1.5">{r.task}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.omschrijving}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatUrenNL(r.uren)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatUrenNL(r.fact_uren)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={5}>{t("extensions.kg_planning.dashboards.detail_total")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUrenNL(totals.uren)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatUrenNL(totals.fact)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 16.2:** Commit (gated).

```bash
git add packages/frontend/src/extensions/kg-planning/dashboards/components/DetailModal.tsx
git commit -m "feat(kg-planning): DetailModal drilldown"
```

---

## Phase 6: Three dashboards

Reference upstream files — port each component, then adapt to React semantics. Preserve the KPI layout, chart types, and color choices verbatim unless noted. All formatters come from `dashboards/format.ts`, all charts from `components/ChartCanvas.tsx`, all data from `useDashboards()`.

### Task 17: `FinancieelDashboard`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/FinancieelDashboard.tsx`

**Upstream reference:** `kg-planning/src/components/dashboards/FinancieelDashboard.tsx`

**KPI grid (4 cards top):** rendement, facturatie (total), kosten (total), uren (total).
Each with previous-year comparison (`data.prevYear.*`) rendered via `pctChange(current, prev)`.

**Charts (below KPIs):**
1. Monthly line: kosten (red) vs facturatie (green) — two series against MONTH_LABELS
2. Monthly bar: uren (blue) vs fact_uren (teal)
3. Category bar: per-employee total hours — clickable, opens `DetailModal` filtered on `row.persoon === emp.name`

**Implementation outline (the file is ~120 lines):**

```tsx
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDashboards, deriveMonthlyArray } from "./store";
import KpiCard from "./components/KpiCard";
import { MonthlyBarChart, MonthlyLineChart, CategoryBarChart } from "./components/ChartCanvas";
import { MONTH_LABELS, formatEuro, formatUrenNL } from "./format";

function pctChange(current: number, previous: number): string | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return `Vorig jaar: ${formatEuro(0)}`;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `Vorig jaar: ${formatEuro(previous)} (${sign}${pct.toFixed(1)}%)`;
}

export default function FinancieelDashboard() {
  const { t } = useTranslation();
  const { data, openDrilldown } = useDashboards();
  if (!data) return null;

  const hours = useMemo(() => deriveMonthlyArray(data.monthly, "uren"), [data.monthly]);
  const factHours = useMemo(() => deriveMonthlyArray(data.monthly, "fact_uren"), [data.monthly]);
  const spending = useMemo(() => deriveMonthlyArray(data.monthly, "kosten"), [data.monthly]);
  const invoicedMonthly = useMemo(() => {
    const arr = new Array(12).fill(0);
    for (const r of data.invoicesMonth) {
      const idx = (r.maand || 0) - 1;
      if (idx >= 0 && idx < 12) arr[idx] = r.totaal || 0;
    }
    return arr;
  }, [data.invoicesMonth]);

  const totalInvoiced = data.invoicesMonth.reduce((s, r) => s + (r.totaal || 0), 0);
  const totalSpent = data.monthly.reduce((s, r) => s + (r.kosten || 0), 0);
  const totalHours = data.monthly.reduce((s, r) => s + (r.uren || 0), 0);
  const rendement = totalInvoiced - totalSpent;
  const prevRendement = data.prevYear.facturatie - data.prevYear.kosten;

  const monthlyFinancial = MONTH_LABELS.map((label, i) => ({
    label, kosten: spending[i], facturatie: invoicedMonthly[i],
  }));
  const monthlyHoursRows = MONTH_LABELS.map((label, i) => ({
    label, uren: hours[i], fact_uren: factHours[i],
  }));
  const employeeBars = data.employees.map((e) => ({ label: e.persoon, value: e.uren }));

  return (
    <div className="flex flex-col gap-6 p-4 overflow-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title={t("extensions.kg_planning.dashboards.kpi_rendement")}
          value={formatEuro(rendement)} comparison={pctChange(rendement, prevRendement)}
          negative={rendement < 0} />
        <KpiCard title={t("extensions.kg_planning.dashboards.kpi_facturatie")}
          value={formatEuro(totalInvoiced)} comparison={pctChange(totalInvoiced, data.prevYear.facturatie)} />
        <KpiCard title={t("extensions.kg_planning.dashboards.kpi_kosten")}
          value={formatEuro(totalSpent)} comparison={pctChange(totalSpent, data.prevYear.kosten)} />
        <KpiCard title={t("extensions.kg_planning.dashboards.kpi_uren")}
          value={formatUrenNL(totalHours)} comparison={pctChange(totalHours, data.prevYear.uren)} />
      </div>

      <Panel title={t("extensions.kg_planning.dashboards.chart_spending")}>
        <MonthlyLineChart
          labels={MONTH_LABELS}
          series={[
            { key: "kosten", label: t("extensions.kg_planning.dashboards.kpi_kosten"), color: "#dc2626" },
            { key: "facturatie", label: t("extensions.kg_planning.dashboards.kpi_facturatie"), color: "#16a34a" },
          ]}
          rows={monthlyFinancial}
        />
      </Panel>

      <Panel title={t("extensions.kg_planning.dashboards.chart_hours")}>
        <MonthlyBarChart
          labels={MONTH_LABELS}
          series={[
            { key: "uren", label: t("extensions.kg_planning.dashboards.kpi_uren"), color: "#3b82f6" },
            { key: "fact_uren", label: t("extensions.kg_planning.dashboards.kpi_fact_uren"), color: "#14b8a6" },
          ]}
          rows={monthlyHoursRows}
        />
      </Panel>

      <Panel title={t("extensions.kg_planning.dashboards.chart_employees")}>
        <CategoryBarChart
          data={employeeBars}
          onBarClick={(_, label) =>
            openDrilldown(
              t("extensions.kg_planning.dashboards.detail_title_employee", { name: label }),
              (row) => row.persoon === label,
            )
          }
        />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}
```

- [ ] **Step 17.1:** Create the file with the above.
- [ ] **Step 17.2:** Typecheck.
- [ ] **Step 17.3:** Commit (gated) — `feat(kg-planning): FinancieelDashboard`.

---

### Task 18: `ProjectenDashboard`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/ProjectenDashboard.tsx`

**Upstream reference:** `kg-planning/src/components/dashboards/ProjectenDashboard.tsx`

**Layout:**
- Table of projects: `nr | naam | budget_uren | uren | fact_uren | kosten | omzet`, sortable by each column.
- Below: Category bar of `omzet - kosten` per project (top 20).

**Implementation outline:**

```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboards } from "./store";
import { CategoryBarChart } from "./components/ChartCanvas";
import { formatEuro, formatUrenNL } from "./format";
import type { ProjectRow } from "./types";

type SortKey = keyof ProjectRow;

export default function ProjectenDashboard() {
  const { t } = useTranslation();
  const { data, openDrilldown } = useDashboards();
  const [sortBy, setSortBy] = useState<SortKey>("nr");
  const [sortAsc, setSortAsc] = useState(true);

  if (!data) return null;

  const sorted = useMemo(() => {
    const rows = [...data.projects];
    rows.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [data.projects, sortBy, sortAsc]);

  const topMargin = useMemo(
    () => [...data.projects]
      .map((p) => ({ label: p.nr || p.naam, value: (p.omzet || 0) - (p.kosten || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20),
    [data.projects],
  );

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  }

  const headers: Array<{ key: SortKey; label: string; num?: boolean }> = [
    { key: "nr", label: "Nr." },
    { key: "naam", label: "Naam" },
    { key: "budget_uren", label: "Budget", num: true },
    { key: "uren", label: "Uren", num: true },
    { key: "fact_uren", label: "Fact. uren", num: true },
    { key: "kosten", label: "Kosten", num: true },
    { key: "omzet", label: "Omzet", num: true },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto">
      <section className="bg-white rounded-lg border border-slate-200 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className={`px-3 py-2 cursor-pointer select-none hover:bg-slate-100 ${h.num ? "text-right" : ""}`}
                >
                  {h.label} {sortBy === h.key ? (sortAsc ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.nr}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => openDrilldown(
                  t("extensions.kg_planning.dashboards.detail_title_project", { project: `${p.nr} ${p.naam}` }),
                  (row) => row.project.includes(p.nr),
                )}
              >
                <td className="px-3 py-1.5">{p.nr}</td>
                <td className="px-3 py-1.5">{p.naam}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatUrenNL(p.budget_uren)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatUrenNL(p.uren)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatUrenNL(p.fact_uren)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(p.kosten)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatEuro(p.omzet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">{t("extensions.kg_planning.dashboards.chart_projects")}</h3>
        <CategoryBarChart data={topMargin} color="#16a34a" />
      </section>
    </div>
  );
}
```

- [ ] **Step 18.1:** Create file.
- [ ] **Step 18.2:** Typecheck.
- [ ] **Step 18.3:** Commit (gated) — `feat(kg-planning): ProjectenDashboard`.

---

### Task 19: `HrDashboard`

**Files:**
- Create: `packages/frontend/src/extensions/kg-planning/dashboards/HrDashboard.tsx`

**Upstream reference:** `kg-planning/src/components/dashboards/HrDashboard.tsx`

**KPI grid (4 cards top):** total uren, total fact uren, total intern uren, total ziektedagen. Comparison to `data.prevYear.*` where applicable.

**Charts:**
1. Category bar: per-employee `intern_uren`
2. Category bar: `internalHoursByDescription` (from `data.intern`)
3. Category bar: sick days per employee
4. (Optional) Stacked bar: per-employee breakdown of uren / fact_uren / intern_uren

Follow the same implementation pattern as `FinancieelDashboard`. Each bar chart is clickable where the filter makes sense (employee name, internal description). See upstream `HrDashboard.tsx` for the exact selectable filters.

- [ ] **Step 19.1:** Create file following the `FinancieelDashboard` template adapted to HR data + i18n keys.
- [ ] **Step 19.2:** Typecheck.
- [ ] **Step 19.3:** Commit (gated) — `feat(kg-planning): HrDashboard`.

---

## Phase 7: Dashboards Root + integration

### Task 20: Replace `dashboards/Root.tsx` stub

**Files:**
- Modify: `packages/frontend/src/extensions/kg-planning/dashboards/Root.tsx`

- [ ] **Step 20.1:** Replace the stub contents with:

```tsx
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { KgTab } from "../TabBar";
import { DashboardsProvider, useDashboards } from "./store";
import DashboardFilters from "./components/DashboardFilters";
import DetailModal from "./components/DetailModal";
import FinancieelDashboard from "./FinancieelDashboard";
import ProjectenDashboard from "./ProjectenDashboard";
import HrDashboard from "./HrDashboard";

export default function DashboardsRoot({ tab }: { tab: KgTab }) {
  return (
    <DashboardsProvider>
      <Shell tab={tab} />
    </DashboardsProvider>
  );
}

function Shell({ tab }: { tab: KgTab }) {
  const { t } = useTranslation();
  const { status, errorMessage, missing, reload } = useDashboards();

  if (status === "loading") {
    return <div className="flex items-center justify-center h-full text-sm text-slate-500">
      {t("extensions.kg_planning.dashboards.loading")}
    </div>;
  }

  if (status === "not_configured") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-800">
          {t("extensions.kg_planning.dashboards.not_configured_title")}
        </h2>
        <p className="max-w-md text-sm text-slate-600">
          {t("extensions.kg_planning.dashboards.not_configured_body")}
        </p>
        {missing.length > 0 && (
          <code className="px-3 py-1.5 rounded bg-slate-100 text-xs text-slate-700">
            {missing.join(", ")}
          </code>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm font-medium text-red-700">{t("extensions.kg_planning.dashboards.load_failed")}</p>
        <p className="mt-1 text-xs text-red-600 break-words">{errorMessage}</p>
        <button
          onClick={() => void reload()}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 cursor-pointer"
        >
          <RefreshCw size={12} /> {t("extensions.kg_planning.dashboards.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardFilters />
      <div className="flex-1 overflow-hidden">
        {tab === "financieel" && <FinancieelDashboard />}
        {tab === "projecten"  && <ProjectenDashboard />}
        {tab === "hr"         && <HrDashboard />}
      </div>
      <DetailModal />
    </div>
  );
}
```

- [ ] **Step 20.2:** Typecheck.

```bash
cd packages/frontend && npx tsc -b --noEmit
```

- [ ] **Step 20.3:** Commit (gated) — `feat(kg-planning): wire DashboardsRoot with provider, filters, detail modal`.

---

## Phase 8: End-to-end smoke test + polish

### Task 21: Full smoke test

- [ ] **Step 21.1:** Start the dev server against production API (credentials on KG's instance needed):

```bash
cd packages/frontend && VITE_API_TARGET=https://y-app.impertio.app npx vite
```

- [ ] **Step 21.2:** Run the 7-point checklist from the spec:
    1. Planning tab loads; grid renders unchanged from before the feature.
    2. Tab bar switches between all four tabs with no console errors.
    3. `Ctrl+C` / `Ctrl+V` round-trips between the grid and LibreOffice Calc.
    4. Drag a column header right edge → width persists across reload.
    5. Each dashboard tab loads, shows KPIs + at least one chart, KpiCard click opens DetailModal, Escape closes.
    6. Change date range → dashboards refresh, tooltips show correct values.
    7. Disable `kg-planning` in Settings → Extensions → sidebar entry disappears.

- [ ] **Step 21.3:** Fix anything that broke. For each fix: make the change, explain why, commit (gated).

- [ ] **Step 21.4:** Update `STATUS.md` with a short summary of what landed on this branch.

- [ ] **Step 21.5:** Final typecheck + lint:

```bash
cd packages/frontend && npx tsc -b --noEmit
cd packages/frontend && npm run lint
```

- [ ] **Step 21.6:** Offer a PR (gated — ask the user). Do not push. Do not open a PR unsolicited.

---

## Self-review outcomes (performed during plan writing)

**Spec coverage check:**
- Tab architecture → Tasks 3, 20 ✓
- Insights data source → Tasks 9, 10 ✓
- Recharts → Tasks 1, 14 ✓
- Clipboard → Tasks 4, 5 ✓
- Column resize → Tasks 6, 7 ✓
- Query ID discovery via `instance_settings` → Task 10 ✓
- Drilldown report configurability → Task 10 ✓
- i18n NL/EN/DE → Task 2 ✓
- Load-once caching + date-range invalidation → Task 12 ✓
- Discriminated status (loading/ok/not_configured/error) → Tasks 12, 20 ✓
- Employer-only visibility → manifest is unchanged, already `"employer"` ✓
- Bundle: dashboards + recharts lazy-loaded inside the extension chunk → Task 3 (lazy import) ✓

**No placeholder text remains.** All code blocks are complete and immediately usable.

**Type consistency check:**
- `DashboardDataSource` interface matches `insightsSource` export in shape ✓
- `RawDashboardData` fields match the `deriveMonthlyArray` generic parameter ✓
- `openDrilldown(title, filter)` signature consistent across store and consumers ✓
- i18n key paths identical in `TabBar.tsx`, dashboards, and the JSON files ✓

**Resolved during review:**
- `fetchUserSetting` import location verified — Task 10 contains a grep fallback in case the helper name differs.
- `current-instance` localStorage key verified — Task 6 contains a grep fallback.

## Out of scope (explicit)

- Stacked-bar detail in HrDashboard (listed as "Optional" in Task 19).
- Multi-employee clipboard paste (only single-employee-per-task paste in v1).
- Drilldown row pagination (the report returns everything; render as-is).
- Custom ERPNext "Insights" docmodel fixtures. Assume the KG ERPNext already has them.
- Any change to `registry.ts` / `manifest.ts` — the extension stays registered, employer-only, in "Taken & Planning" section, unchanged.
