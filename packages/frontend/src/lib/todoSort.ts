const PRIORITY_ORDER: Record<string, number> = {
  Urgent: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function compareTodos<
  T extends { date?: string | null; priority?: string | null },
>(a: T, b: T): number {
  if (a.date && b.date) return a.date.localeCompare(b.date);
  if (a.date) return -1;
  if (b.date) return 1;
  const pa = PRIORITY_ORDER[a.priority ?? ""] ?? 99;
  const pb = PRIORITY_ORDER[b.priority ?? ""] ?? 99;
  return pa - pb;
}
