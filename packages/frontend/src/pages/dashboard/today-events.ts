import { minutenTussen, plusMinuten, regelVanErpEvent, voorkomens } from "../../lib/agenda-herhaling.ts";

export interface DashboardEvent extends Record<string, unknown> {
  name: string;
  subject?: string;
  starts_on: string;
  ends_on?: string;
  all_day?: number;
  status?: string;
}

/** Uses the same recurrence rules as Agenda; ERPNext controls which documents are readable. */
export function eventsForDay<T extends DashboardEvent>(events: T[], day: string): T[] {
  const start = day + " 00:00:00", end = day + " 23:59:59";
  const result: T[] = [];
  for (const event of events) {
    if (event.status && event.status !== "Open") continue;
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(event.starts_on)) continue;
    const rule = regelVanErpEvent(event);
    const duration = event.ends_on ? Math.max(0, minutenTussen(event.starts_on, event.ends_on)) : 0;
    const from = plusMinuten(start, -duration).slice(0, 10);
    const starts = rule ? voorkomens(event.starts_on, rule, from, day) : [event.starts_on];
    for (const starts_on of starts) {
      const ends_on = rule && event.ends_on ? plusMinuten(starts_on, duration) : event.ends_on;
      if (starts_on.replace("T", " ") <= end && (ends_on || starts_on).replace("T", " ") >= start) {
        result.push({ ...event, starts_on, ends_on });
      }
    }
  }
  return result.sort((a, b) => a.starts_on.replace("T", " ").localeCompare(b.starts_on.replace("T", " ")));
}
