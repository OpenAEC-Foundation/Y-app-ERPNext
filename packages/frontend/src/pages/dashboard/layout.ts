import type { WidgetPlacement } from "./types.ts";

/** Saved selections are authoritative: hidden widgets stay hidden after reload. */
export function restoreWidgetLayout(saved: unknown, defaults: WidgetPlacement[], available: string[]): WidgetPlacement[] {
  if (!Array.isArray(saved)) return defaults.map(w => ({ ...w }));
  const allowed = new Set(available);
  const seen = new Set<string>();
  const result: WidgetPlacement[] = [];
  for (const value of saved) {
    if (!value || typeof value !== "object") continue;
    const { id, col } = value;
    if (typeof id !== "string" || !allowed.has(id) || seen.has(id) || (col !== 0 && col !== 1)) continue;
    seen.add(id);
    result.push({ id, col });
  }
  return result;
}

export function splitWorkspaceWidgets(layout: WidgetPlacement[]) {
  const columns = [0, 1].map(col => layout.filter(w => w.id !== "today-agenda" && w.col === col));
  const main: WidgetPlacement[] = [];
  for (let row = 0; row < Math.max(...columns.map(column => column.length)); row++) {
    for (const column of columns) if (column[row]) main.push(column[row]);
  }
  return {
    main,
    utility: layout.filter(w => w.id === "today-agenda"),
  };
}
