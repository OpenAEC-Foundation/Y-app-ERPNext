# KG-Planning — Full port of the upstream Kort-Geytenbeek app into the Y-App extension

**Date:** 2026-04-17
**Branch (to create):** `feat/kg-planning-full-port`
**Status:** Design / brainstorming output — awaiting user review

## Goal

Bring the `kg-planning` extension to feature parity with the upstream SolidJS app at
`github.com/Impertio-Studio/Kort-Geytenbeek`. Today the extension ports ~57% of the
upstream source — the complete Planning tab. This spec covers the remaining ~43%:

1. **Three analytics dashboards** — Financieel, Projecten, HR.
2. **Grid ergonomics** — Excel-style clipboard copy/paste and drag-to-resize columns
   inside the existing GridView.
3. **Integrating the four tabs** into the single extension page.

## Non-goals

- No change to the existing Planning-tab code paths beyond what's needed to wire it
  alongside the new tabs.
- No rewrite of upstream's Insights/Query-Report aggregations. That's explicitly
  deferred — see "Data source" below.
- No server-side work on the Y-App Express server. Everything lives in the frontend
  extension and routes through the existing bridged ERPNext proxy (`lib/erpnext.ts`).
- No support for running the dashboards on a non-KG ERPNext instance in this pass.
  Structure allows it; implementation doesn't.

## Decisions recorded during brainstorming

| # | Decision | Chosen |
|---|----------|--------|
| 1 | How to surface the four upstream tabs | **One extension, internal tab bar** (no extra sidebar entries) |
| 2 | Data source for dashboards | **KG's ERPNext only (Insights queries) behind a swappable interface** — universal aggregation later is a one-file swap |
| 3 | Chart library | **Recharts** (React-native, newer API, lazy-loaded inside the extension chunk) |
| 4 | Scope of grid ergonomics | **Both clipboard and resizable columns** included |
| 5 | Where the extension source lives | **Monorepo, same folder as today.** Revisit as a build-variant (not a separate repo) only if bundle weight becomes measurable |

## Architecture

### File layout

```
packages/frontend/src/extensions/kg-planning/
  manifest.ts                      (unchanged — employer-only, "Taken & Planning" section)
  Page.tsx                         rewrite: owns tab state, mounts one of four tabs
  TabBar.tsx                       NEW — four-tab switcher (replaces upstream TopTabBar)

  // Planning tab (today's code, minor additions)
  store.tsx                        unchanged
  api.ts                           unchanged
  types.ts                         unchanged
  views/
    FilterBar.tsx                  unchanged
    GanttView.tsx                  unchanged
    GridView.tsx                   ADDITIONS: clipboard hook + resize hook wired in
    TeamView.tsx                   unchanged
    EditableCell.tsx               additions if needed for range-selection state
    ProgressPopover.tsx            unchanged
    ViewSwitcher.tsx               unchanged
  utils/
    weeks.ts, phases.ts, helpers.ts  unchanged
    clipboard.ts                   NEW — parse/serialize tab-separated blocks, CellRange helpers
    useColumnResize.ts             NEW — React hook replacing upstream initResizableColumns

  // Dashboards tab
  dashboards/
    store.tsx                      NEW — Context + load-once data, date-range + refresh
    types.ts                       NEW — MonthlyRow, EmployeeRow, ProjectRow, InvoiceMonthRow,
                                    InternRow, SickRow, PrevYearRow, DrilldownRow
    DataSource.ts                  NEW — interface; dashboards/store imports this, not the impl
    insightsSource.ts              NEW — the QRY-0004..QRY-0010 impl (today's default)
    reportRunner.ts                NEW — frappe.desk.query_report.run wrapper for drilldown
    format.ts                      NEW — formatEuro, formatNumber, formatUrenNL, formatDatumNL,
                                    MONTH_LABELS (ported from upstream dashboards.ts tail)

    components/
      DashboardFilters.tsx         NEW — date-range picker + quick-range buttons + Refresh
      KpiCard.tsx                  NEW
      ChartCanvas.tsx              NEW — thin wrapper around Recharts primitives
      DetailModal.tsx              NEW — drilldown modal (Escape to close, row table)

    FinancieelDashboard.tsx        NEW
    ProjectenDashboard.tsx         NEW
    HrDashboard.tsx                NEW

    store.drilldown.ts             NEW — separate tiny store for the DetailModal's cached rows
```

### Component tree

```
<KgPlanningPage>                       Page.tsx
  <TabBar tabs={planning|financieel|projecten|hr} />
  switch (activeTab) {
    case "planning":
      <KgPlanningProvider>             store.tsx (existing)
        <PlanningShell />               existing Shell() renamed
      </KgPlanningProvider>
    case "financieel"|"projecten"|"hr":
      <DashboardsProvider>             dashboards/store.tsx
        <DashboardFilters />
        switch (activeTab) {
          case "financieel":  <FinancieelDashboard />
          case "projecten":   <ProjectenDashboard />
          case "hr":          <HrDashboard />
        }
        <DetailModal />
      </DashboardsProvider>
  }
</KgPlanningPage>
```

Two independent Context providers so Planning-tab state and Dashboard-tab state never
interfere. The dashboards provider unmounts when the user flips back to Planning;
data is still cached in module-scope within the provider's closure, so re-mounting
doesn't re-fetch (mirrors upstream's `_loaded` flag behaviour).

### Data flow: the swappable source

```
dashboards/store.tsx
    │
    ▼ calls source.loadAll({from, to})
DataSource (interface)
    ▲
    ├── insightsSource     (today — calls QRY-0004..QRY-0010)
    └── aggregatedSource   (future — standard list reads + client-side aggregation)
```

`dashboards/DataSource.ts`:

```ts
export interface DashboardDataSource {
  loadAll(range: { from: string; to: string }): Promise<RawDashboardData>;
  loadDrilldown(range: { from: string; to: string }): Promise<DrilldownRow[]>;
}
```

`dashboards/store.tsx` binds to `insightsSource` at import time. Switching to a
future aggregated source is a one-line import change. No other file needs edits.

### Insights query runner

Matches the upstream three-step protocol, routed through `lib/erpnext.ts` so every
call inherits:

- the Y-App session cookie (no client-side API token),
- the `X-Y-App-Instance` header (correct ERPNext instance selection),
- the 23-hour per-instance session cache on the server,
- response-level dedup + 30s cache in `fetchList`.

Steps (per query):

1. `callMethod("run_doc_method", { dt: "Insights Query", dn: queryName, method: "run" })`
2. `fetchDocument("Insights Query", queryName, { fields: ["result_name"] })`
3. `fetchDocument("Insights Query Result", resultName, { fields: ["results"] })`
4. Parse the `results` JSON string (first row = header, rest = data rows).

### Query ID discovery

```
instance_settings key: "kg-insights-queries"
shape: {
  maandtotalen:        "QRY-0004",
  perMedewerker:       "QRY-0005",
  perProject:          "QRY-0006",
  facturatieMaand:     "QRY-0007",
  internPerOmschrijving: "QRY-0008",
  ziekteverzuim:       "QRY-0009",
  vorigJaar:           "QRY-0010"
}
```

Default if the key is absent = upstream IDs. Means KG works out of the box with no
config; another customer could later point at their own query IDs without code
changes.

### Drilldown (DetailModal)

Upstream calls `frappe.desk.query_report.run` with report name `"KG Medewerker
Periodeoverzicht"`. We mirror that, also routed through `callMethod`. The report
name is also configurable via `instance_settings` (key `kg-drilldown-report`, default
`"KG Medewerker Periodeoverzicht"`).

Cache: keyed by `{from, to}`, lives in `store.drilldown.ts` module scope. Same
invalidation rule as the dashboards store — date-range change clears.

### Grid clipboard

New `utils/clipboard.ts`:
- `parseClipboard(text: string): number[][]` — splits on `\n` / `\t`, coerces with
  `parseFloat` and `,`→`.`, NaN becomes 0. Ported from upstream.
- `toClipboardText(data: number[][]): string` — inverse. Empty cells → empty string
  (not "0"), for sane Excel round-trip.
- `CellRange` + `normalizeRange(CellRange)`.

`GridView.tsx` additions:
- Track a `selection: CellRange | null` in component state.
- `onMouseDown` on an editable cell starts a range; `onMouseEnter` while pressed
  extends it; `onMouseUp` commits.
- Global `keydown` listener (mounted via `useEffect` with a ref guard):
  - `Ctrl/Cmd+C` → `navigator.clipboard.writeText(toClipboardText(sliceRange(selection)))`
  - `Ctrl/Cmd+V` → `navigator.clipboard.readText()` → `parseClipboard` → write rows
    via `savePlannedHours` starting at `selection.startRow, selection.startCol`.
- Bounds: a paste that would overflow the selected range of weeks/employees stops
  at the edge; the excess is silently dropped (matches upstream — no destructive
  surprise).
- All paste writes go through `savePlannedHours` → the existing 500 ms debounce
  coalesces rapid writes per task.

### Grid column resize

New `utils/useColumnResize.ts` — a React hook replacing upstream's imperative
`initResizableColumns`.

```ts
export function useColumnResize(opts: { storageKey: string }): {
  widths: Record<string, number>;
  startResize: (colId: string, e: React.MouseEvent) => void;
};
```

- Persists widths to `localStorage` under `pref_${instanceId}_${storageKey}`.
- Emits `style={{ width: widths[colId] }}` on each `<col>` / `<th>`.
- A 4 px `<div className="resize-handle">` at the right edge of each header owns
  `onMouseDown` → global `mousemove`/`mouseup`, clamps to `minWidth=50`.

### i18n

All new user-facing strings go through `react-i18next` under namespace
`extensions.kg_planning.dashboards.*`. NL is primary, EN required (per
`CLAUDE.md`), DE best-effort. Dutch labels taken verbatim from upstream (`Van`,
`Tot`, `Rendement`, `Uren`, `Facturabele uren`, etc).

### Visibility

`manifest.ts` stays `visibility: "employer"`. Dashboards are firm-wide analytics —
already the right setting for the existing Planning tab too.

### Bundle impact

- `recharts`: ~90 KB gzipped. Added to `packages/frontend/package.json`.
- Dashboards + recharts only load when the user switches to a dashboard tab.
  The extension's existing `lazy(() => import("./Page"))` already chunk-splits the
  whole extension off the main bundle; charts live inside that chunk.
- Non-KG customers: extension lazy-chunk is only fetched when the user opens
  `/x/kg-planning`, which only appears in the sidebar for instances that enable
  `kg-planning` in `enabled-extensions`. Net impact on non-KG customers: zero
  network, ~700 bytes added to `registry.ts` (one manifest entry).

## Error handling

### Dashboards load failures

The dashboards store uses the same discriminated status pattern as `api.ts:68-72`:

```ts
status: "loading" | "ok" | "not_configured" | "error"
```

- **`not_configured`** — any of the Insights queries returns a "DocType not found"
  or "No such query" shape. Renders: *"Dashboards require the ERPNext Insights
  module and the KG queries (QRY-0004…QRY-0010). Ask your administrator to
  install them, or configure query IDs under Settings → Extensions."*
- **`error`** — any other failure. Shows the message + a Retry button. Matches
  existing `Shell()` error branch style.
- **Partial failure** — if 6/7 queries succeed and one fails, the whole batch
  fails (upstream behaviour). Acceptable for v1; a later refinement could render
  per-panel error states.

### Drilldown failures

Modal shows an inline error row, stays open, Retry button. Doesn't bubble up to
the whole dashboard.

### Clipboard failures

- `navigator.clipboard` unavailable (non-HTTPS contexts) → no-op, console warn once.
- `readText()` rejected (browser permission denied) → inline toast: *"Paste
  blocked by browser. Grant clipboard access and try again."*
- Paste parse yields all zeros → proceeds (zeros are a valid edit — they clear
  cells).

## Testing

Matches existing kg-planning conventions (no test infra today for this extension —
don't invent one for this PR).

**Unit tests (add `*.test.ts` next to source, new files only):**
- `utils/clipboard.ts`: `parseClipboard` round-trip, NaN handling, comma-as-decimal.
- `dashboards/insightsSource.ts`: mock `callMethod` / `fetchDocument`, verify the
  three-step protocol and column mapping for one representative query.

**Manual smoke test checklist (documented in spec, executed by user before merge):**
1. Planning tab loads and the existing grid still works unchanged.
2. Tab bar switches between all four tabs without console errors.
3. `Ctrl+C` / `Ctrl+V` round-trips between the grid and a LibreOffice Calc
   selection.
4. Drag a column header right edge → width persists across reload.
5. Each dashboard tab loads, shows KPIs and at least one chart, a KpiCard click
   opens DetailModal, Escape closes it.
6. Change date range → dashboards refresh, chart tooltips show correct values.
7. Disable `kg-planning` in Settings → Extensions → sidebar entry disappears.

**What's intentionally not tested in this PR:**
- Recharts rendering correctness (library trust).
- End-to-end Insights query execution (requires the KG ERPNext; no CI fixture).

## Dependencies

```diff
  // packages/frontend/package.json dependencies
+ "recharts": "^3.0.0"
```

No server-side package changes. No new env vars. No new instance-settings keys
required for the common path — all new keys are optional overrides.

## Migration / rollout

1. Extension is employer-only and opt-in per instance. Existing KG instance already
   has `enabled-extensions` including `kg-planning` — no flag flip needed.
2. First deploy: the new Page renders with Planning as the default tab. Users who
   never click to a dashboard tab see identical UI to today.
3. Dutch labels default; EN strings land in the same commit.

## Open questions (resolvable during implementation)

- Recharts major version — lock at install time, add to CLAUDE.md's permitted-deps
  section if that convention grows. Non-blocking.
- Whether to move `lib/erpnext.ts`'s `callMethod` return-type generic to be strictly
  typed per-caller in `insightsSource.ts`, or keep the `unknown` + local cast.
  Implementation decision, no user input needed.

## Effort estimate

- **Planning-tab integration + TabBar + manifest tweaks**: ~0.5 day.
- **Grid clipboard + resize**: ~1 day.
- **Dashboards store + DataSource interface + insightsSource + reportRunner**: ~1 day.
- **KpiCard + ChartCanvas + DashboardFilters + DetailModal**: ~1 day.
- **Three dashboards (Financieel/Projecten/HR)**: ~1.5 days.
- **i18n pass + smoke test + polish**: ~0.5 day.

**Total**: ~5.5 days of focused work. Not parallelisable into subagents cleanly
because most changes touch the same Page.tsx / store.tsx area in quick succession.
