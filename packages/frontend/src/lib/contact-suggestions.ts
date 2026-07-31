/**
 * Recipient autocomplete — ERPNext customer contacts + local frequency ranking.
 *
 * Gedeelde bron-van-waarheid voor contact-suggesties. Eerder leefde dit als
 * lokale functies in Webmail.tsx; nu importeren zowel de mail-compose als het
 * agenda-uitnodig-veld (RecipientInput) hieruit, zodat de suggesties + ranking
 * overal identiek zijn.
 */
import { fetchList } from "./erpnext";

export interface RecipientSuggestion {
  email: string;
  label: string;
  /** Higher = better match. Used only for sorting. */
  score: number;
  /** Source for UI hint (e.g. recent star). */
  source: "frequent" | "customer";
}

export interface FrequencyEntry {
  email: string;
  label: string;
  count: number;
  lastUsed: number;
}

export type FrequencyMap = Record<string, FrequencyEntry>;

const FREQ_CAP = 200;
export const RECENT_ON_FOCUS = 5;

function frequencyStorageKey(instanceId: string | null): string {
  return `pref_${instanceId ?? "default"}_recipient_freq`;
}

export function loadFrequencyMap(instanceId: string | null): FrequencyMap {
  try {
    const raw = localStorage.getItem(frequencyStorageKey(instanceId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as FrequencyMap;
  } catch {
    /* ignore corrupted storage */
  }
  return {};
}

export function saveFrequencyMap(instanceId: string | null, map: FrequencyMap): void {
  try {
    // Cap: keep top FREQ_CAP entries by lastUsed.
    const entries = Object.values(map);
    if (entries.length > FREQ_CAP) {
      entries.sort((a, b) => b.lastUsed - a.lastUsed);
      const kept: FrequencyMap = {};
      for (const e of entries.slice(0, FREQ_CAP)) kept[e.email] = e;
      map = kept;
    }
    localStorage.setItem(frequencyStorageKey(instanceId), JSON.stringify(map));
  } catch {
    /* storage full or unavailable — silently drop */
  }
}

export function bumpFrequency(instanceId: string | null, email: string, label: string): void {
  const key = email.trim().toLowerCase();
  if (!key || !key.includes("@")) return;
  const map = loadFrequencyMap(instanceId);
  const existing = map[key];
  map[key] = {
    email: key,
    label: label || existing?.label || "",
    count: (existing?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  saveFrequencyMap(instanceId, map);
}

/** Parse comma/semicolon-separated recipient string and return each address. */
export function parseRecipientEmails(raw: string): string[] {
  return raw.split(/[,;]\s*/).map((s) => {
    // Extract email from "Name <email@x>" format if present.
    const m = s.match(/<([^>]+)>/);
    return (m ? m[1] : s).trim().toLowerCase();
  }).filter((s) => s.includes("@"));
}

/** Get the "current token" (text after last comma/semicolon) used as search query. */
export function getCurrentToken(value: string, caretPos: number): { token: string; start: number } {
  const upto = value.slice(0, caretPos);
  const match = upto.match(/[,;]\s*([^,;]*)$/);
  if (match) {
    const start = caretPos - match[1].length;
    return { token: match[1], start };
  }
  return { token: upto, start: 0 };
}

/** Replace the current token with `email` and append ", " for next entry. */
export function replaceCurrentToken(value: string, caretPos: number, email: string): { next: string; newCaret: number } {
  const { start } = getCurrentToken(value, caretPos);
  const before = value.slice(0, start);
  const after = value.slice(caretPos);
  const insert = `${email}, `;
  const next = `${before}${insert}${after}`;
  return { next, newCaret: (before + insert).length };
}

interface CustomerContactRow {
  name: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  email_id?: string;
}

export async function fetchCustomerContactSuggestions(query: string): Promise<RecipientSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // One fetchList per search field — or_filters proved unreliable on Contact
  // in this Frappe setup. Dedup afterwards.
  const fields = ["name", "first_name", "last_name", "full_name", "company_name", "email_id"];
  const searchFields = ["name", "first_name", "last_name", "full_name", "company_name", "email_id"];
  const pattern = `%${q}%`;
  const results = await Promise.all(
    searchFields.map((f) =>
      fetchList<CustomerContactRow>("Contact", {
        fields,
        filters: [[f, "like", pattern]],
        limit_page_length: 20,
      }).catch((err) => {
        console.warn(`[contacts] Contact lookup on ${f} failed:`, err);
        return [] as CustomerContactRow[];
      })
    )
  );
  const byEmail = new Map<string, RecipientSuggestion>();
  for (const rows of results) {
    for (const r of rows) {
      const email = r.email_id?.trim().toLowerCase();
      if (!email) continue;
      if (byEmail.has(email)) continue;
      const label = r.full_name
        || [r.first_name, r.last_name].filter(Boolean).join(" ").trim()
        || r.name;
      byEmail.set(email, { email, label, score: 0, source: "customer" });
    }
  }
  const list = Array.from(byEmail.values());
  console.log(`[contacts] Contact lookup "${q}" → ${list.length} unique contacts`);
  return list;
}

/** Merge ERPNext results with local frequency map, dedup + score + sort. */
export function mergeAndRankSuggestions(
  query: string,
  customer: RecipientSuggestion[],
  freqMap: FrequencyMap,
): RecipientSuggestion[] {
  const q = query.trim().toLowerCase();
  const byEmail = new Map<string, RecipientSuggestion>();

  // 1. Seed with customer results.
  for (const c of customer) byEmail.set(c.email, { ...c });

  // 2. Overlay frequency entries (also keep those that don't appear in ERPNext).
  const freqEntries = Object.values(freqMap);
  for (const f of freqEntries) {
    if (q.length > 0) {
      const email = f.email.toLowerCase();
      const label = f.label.toLowerCase();
      if (!email.includes(q) && !label.includes(q)) continue;
    }
    const existing = byEmail.get(f.email);
    if (existing) {
      existing.source = "frequent";
      existing.label = existing.label || f.label;
    } else {
      byEmail.set(f.email, {
        email: f.email,
        label: f.label,
        score: 0,
        source: "frequent",
      });
    }
  }

  // 3. Compute score per entry.
  const list: RecipientSuggestion[] = [];
  for (const s of byEmail.values()) {
    const f = freqMap[s.email];
    const email = s.email.toLowerCase();
    const label = s.label.toLowerCase();
    let score = 0;
    if (q.length > 0) {
      if (email === q || label === q) score += 1000;
      if (email.startsWith(q) || label.startsWith(q)) score += 100;
      if (email.includes(q) || label.includes(q)) score += 10;
    }
    if (f) {
      // Frequency boost — bounded so it can't fully dominate exact matches.
      score += Math.min(f.count, 50) * 2;
      // Recency tiebreaker (tiny).
      score += Math.min(f.lastUsed / 1e13, 0.5);
    }
    list.push({ ...s, score });
  }

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label);
  });

  // Keep a generous cap — dropdown scrolls if needed.
  return list.slice(0, 20);
}

/** Build the "focus without query" list: top N most recently/frequently used. */
export function topRecentFromFrequency(freqMap: FrequencyMap, limit = RECENT_ON_FOCUS): RecipientSuggestion[] {
  const entries = Object.values(freqMap);
  entries.sort((a, b) => {
    // Recency-weighted: lastUsed primary, count tiebreaker.
    if (b.lastUsed !== a.lastUsed) return b.lastUsed - a.lastUsed;
    return b.count - a.count;
  });
  return entries.slice(0, limit).map((e) => ({
    email: e.email,
    label: e.label,
    score: 0,
    source: "frequent" as const,
  }));
}
