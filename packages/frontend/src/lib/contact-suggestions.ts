/**
 * Recipient autocomplete — ERPNext customer contacts + local frequency ranking.
 *
 * Gedeelde bron-van-waarheid voor contact-suggesties. Eerder leefde dit als
 * lokale functies in Webmail.tsx; nu importeren zowel de mail-compose als het
 * agenda-uitnodig-veld (RecipientInput) hieruit, zodat de suggesties + ranking
 * overal identiek zijn.
 */
import { fetchList, fetchChildTable } from "./erpnext.ts";

export interface RecipientSuggestion {
  email: string;
  label: string;
  /** Higher = better match. Used only for sorting. */
  score: number;
  /**
   * Source for UI hint (e.g. recent star / subtle source label):
   * - "frequent" — locally remembered (used before, via `bumpFrequency`)
   * - "customer" — ERPNext Contact, matched via its own top-level fields
   *   (name/email_id/etc.) — this is the contact's primary address
   * - "contact" — ERPNext Contact, matched via a secondary address in the
   *   `Contact Email` child table
   * - "lead" — ERPNext Lead.email_id
   */
  source: "frequent" | "customer" | "contact" | "lead";
  /**
   * Whether this is the contact/lead's primary address (vs. a secondary
   * `Contact Email` row). Used only to break ties in ranking — the existing
   * frequency-based score still dominates. Optional/undefined is treated
   * like `false`.
   */
  primary?: boolean;
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

/**
 * Primary-field Contact search: one `fetchList` per search field (or_filters
 * proved unreliable on Contact in this Frappe setup), deduped by email
 * afterwards. Matches only against Contact's own top-level fields, so a hit
 * is always that contact's primary address.
 */
async function fetchContactPrimaryMatches(q: string): Promise<RecipientSuggestion[]> {
  const fields = ["name", "first_name", "last_name", "full_name", "company_name", "email_id"];
  const searchFields = fields;
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
      byEmail.set(email, { email, label, score: 0, source: "customer", primary: true });
    }
  }
  return Array.from(byEmail.values());
}

interface ContactEmailChildRow {
  parent: string;
  email_id?: string;
  is_primary?: 0 | 1;
}

/**
 * Secondary-address search over the `Contact Email` child table (fields
 * `email_id` / `parent` / `is_primary`). A Contact whose email lives *only*
 * here (not mirrored onto `Contact.email_id`) is invisible to
 * `fetchContactPrimaryMatches` — this closes that gap.
 *
 * Two requests total, never N+1: one `frappe.client.get_list` over the child
 * table (the only way to list child-table rows on this Frappe version — see
 * `fetchChildTable`'s doc comment in erpnext.ts), then one batched
 * `fetchList("Contact", { filters: [["name", "in", parents]] })` to resolve
 * names/companies for whichever distinct parents were found.
 */
async function fetchContactEmailChildMatches(q: string): Promise<RecipientSuggestion[]> {
  const pattern = `%${q}%`;
  let rows: ContactEmailChildRow[];
  try {
    rows = await fetchChildTable<ContactEmailChildRow>(
      "Contact Email",
      "Contact",
      ["parent", "email_id", "is_primary"],
      [["email_id", "like", pattern]],
      30,
    );
  } catch (err) {
    console.warn("[contacts] Contact Email child-table lookup failed:", err);
    return [];
  }

  const byEmail = new Map<string, { parent: string; isPrimary: boolean }>();
  for (const r of rows) {
    const email = r.email_id?.trim().toLowerCase();
    if (!email || !r.parent) continue;
    const existing = byEmail.get(email);
    if (!existing || (!!r.is_primary && !existing.isPrimary)) {
      byEmail.set(email, { parent: r.parent, isPrimary: !!r.is_primary });
    }
  }
  if (byEmail.size === 0) return [];

  const parentNames = Array.from(new Set(Array.from(byEmail.values(), (v) => v.parent)));
  let contacts: CustomerContactRow[] = [];
  try {
    contacts = await fetchList<CustomerContactRow>("Contact", {
      fields: ["name", "first_name", "last_name", "full_name", "company_name"],
      filters: [["name", "in", parentNames]],
      limit_page_length: parentNames.length,
    });
  } catch (err) {
    console.warn("[contacts] Contact enrichment lookup for Contact Email hits failed:", err);
    // Fall through — still surface the address, labeled by its parent name.
  }
  const labelByName = new Map<string, string>();
  for (const c of contacts) {
    const label = c.full_name
      || [c.first_name, c.last_name].filter(Boolean).join(" ").trim()
      || c.company_name
      || c.name;
    labelByName.set(c.name, label);
  }

  const list: RecipientSuggestion[] = [];
  for (const [email, info] of byEmail) {
    list.push({
      email,
      label: labelByName.get(info.parent) || info.parent,
      score: 0,
      source: "contact",
      primary: info.isPrimary,
    });
  }
  return list;
}

interface LeadRow {
  name: string;
  lead_name?: string;
  company_name?: string;
  email_id?: string;
}

/** ERPNext Lead email search — leads are "contactpersonen" too, but never
 *  had an autocomplete source before. Single field (email_id) is enough:
 *  matching leads by name/company would surface leads with no usable email. */
async function fetchLeadMatches(q: string): Promise<RecipientSuggestion[]> {
  const pattern = `%${q}%`;
  try {
    const rows = await fetchList<LeadRow>("Lead", {
      fields: ["name", "lead_name", "company_name", "email_id"],
      filters: [["email_id", "like", pattern]],
      limit_page_length: 15,
    });
    const byEmail = new Map<string, RecipientSuggestion>();
    for (const r of rows) {
      const email = r.email_id?.trim().toLowerCase();
      if (!email || byEmail.has(email)) continue;
      const label = r.lead_name || r.company_name || r.name;
      byEmail.set(email, { email, label, score: 0, source: "lead", primary: false });
    }
    return Array.from(byEmail.values());
  } catch (err) {
    console.warn("[contacts] Lead lookup failed:", err);
    return [];
  }
}

/**
 * Priority used to pick a winner when the same email address turns up from
 * more than one source: primary Contact match > secondary Contact Email
 * match > Lead match; within a source, a primary address beats a secondary
 * one (relevant when merging two Contact-sourced lists that both matched).
 */
function suggestionPriority(s: RecipientSuggestion): number {
  const sourceRank = s.source === "customer" ? 3 : s.source === "contact" ? 2 : s.source === "lead" ? 1 : 0;
  return sourceRank * 10 + (s.primary ? 1 : 0);
}

/** Merge N already-fetched suggestion lists, deduping by lowercase email and
 *  keeping the highest-priority (see `suggestionPriority`) entry per address. */
function mergeContactSources(...lists: RecipientSuggestion[][]): RecipientSuggestion[] {
  const byEmail = new Map<string, RecipientSuggestion>();
  for (const list of lists) {
    for (const s of list) {
      const key = s.email.trim().toLowerCase();
      if (!key) continue;
      const existing = byEmail.get(key);
      if (!existing) {
        byEmail.set(key, s);
      } else if (suggestionPriority(s) > suggestionPriority(existing)) {
        byEmail.set(key, { ...s, label: s.label || existing.label });
      } else if (!existing.label && s.label) {
        existing.label = s.label;
      }
    }
  }
  return Array.from(byEmail.values());
}

/**
 * Fallback list for an empty query with no local frequency history yet: a
 * first page of Contacts that actually have an email address, newest-edited
 * first. Keeps the "focus with empty field" dropdown from being blank on a
 * brand new Y-app profile.
 */
async function fetchDefaultContactPage(limit: number): Promise<RecipientSuggestion[]> {
  try {
    const rows = await fetchList<CustomerContactRow>("Contact", {
      fields: ["name", "first_name", "last_name", "full_name", "company_name", "email_id"],
      filters: [["email_id", "is", "set"]],
      limit_page_length: limit,
      order_by: "modified desc",
    });
    const byEmail = new Map<string, RecipientSuggestion>();
    for (const r of rows) {
      const email = r.email_id?.trim().toLowerCase();
      if (!email || byEmail.has(email)) continue;
      const label = r.full_name
        || [r.first_name, r.last_name].filter(Boolean).join(" ").trim()
        || r.company_name
        || r.name;
      byEmail.set(email, { email, label, score: 0, source: "customer", primary: true });
    }
    return Array.from(byEmail.values());
  } catch (err) {
    console.warn("[contacts] Default contact page lookup failed:", err);
    return [];
  }
}

/**
 * ERPNext Contact search (primary fields + `Contact Email` child-table
 * secondary addresses), deduped by email. Thin wrapper kept for existing
 * callers (`ComposeWindow`, `RecipientInput`) — they now transparently pick
 * up Contact Email hits too. Prefer `fetchRecipientSuggestions` for new UI
 * (also covers Leads and the empty-query default list).
 */
export async function fetchCustomerContactSuggestions(query: string): Promise<RecipientSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [primary, child] = await Promise.all([
    fetchContactPrimaryMatches(q),
    fetchContactEmailChildMatches(q),
  ]);
  const list = mergeContactSources(primary, child);
  console.log(`[contacts] Contact lookup "${q}" → ${list.length} unique contacts`);
  return list;
}

export interface FetchRecipientSuggestionsOptions {
  /** Max number of suggestions returned. Default 20. */
  limit?: number;
  /** Y-app instance id, for scoping the local frequency map — pass the same
   *  value used elsewhere for `loadFrequencyMap`/`bumpFrequency`, typically
   *  `getActiveInstanceId()`. */
  instanceId?: string | null;
}

/**
 * Single entry point for recipient autocomplete — use this for Aan/Cc/Bcc.
 *
 * Combines every known source of "email addresses of contactpersonen":
 * local frequency (`source: "frequent"`, previously picked/used addresses),
 * ERPNext Contact primary fields (`"customer"`), ERPNext Contact Email
 * child-table secondary addresses (`"contact"`), and ERPNext Lead.email_id
 * (`"lead"`). Results are deduped by lowercase email address; when the same
 * address is found via more than one source, the higher-priority one wins
 * (primary Contact address > secondary Contact Email address > Lead). Final
 * ordering is still driven by `mergeAndRankSuggestions` — exact/prefix/
 * substring match on the query, then local-frequency boost, with a small
 * tie-breaking boost for primary addresses. Never throws: any single source
 * failing (403, doctype missing on this instance, timeout) degrades to an
 * empty contribution from that source instead of failing the whole call.
 *
 * UI usage (per field — Aan/Cc/Bcc — call once per field, debounced, with
 * that field's current token, see `getCurrentToken`):
 *
 * ```ts
 * const token = getCurrentToken(fieldValue, caretPos).token;
 * const list = await fetchRecipientSuggestions(token, { instanceId: getActiveInstanceId() });
 * ```
 *
 * - Empty token (e.g. on field focus) → a useful default list: the most
 *   recent/frequent local addresses, or — if there is no history yet — a
 *   first page of ERPNext contacts, so the dropdown is never blank.
 * - 1-character token → local frequency matches only (ERPNext lookups start
 *   at 2 characters, same threshold `fetchCustomerContactSuggestions` has
 *   always used).
 * - Selecting a suggestion should still call `bumpFrequency(instanceId,
 *   email, label)` so it ranks higher next time — this function only reads
 *   the frequency map, it doesn't write to it.
 */
export async function fetchRecipientSuggestions(
  query: string,
  opts: FetchRecipientSuggestionsOptions = {},
): Promise<RecipientSuggestion[]> {
  const limit = opts.limit ?? 20;
  const freqMap = loadFrequencyMap(opts.instanceId ?? null);
  const q = query.trim();

  if (q.length === 0) {
    const recent = topRecentFromFrequency(freqMap, Math.min(limit, RECENT_ON_FOCUS));
    if (recent.length > 0) return recent;
    return (await fetchDefaultContactPage(limit)).slice(0, limit);
  }

  if (q.length < 2) {
    return mergeAndRankSuggestions(q, [], freqMap, limit);
  }

  const [contacts, leads] = await Promise.all([
    fetchCustomerContactSuggestions(q),
    fetchLeadMatches(q),
  ]);
  const merged = mergeContactSources(contacts, leads);
  return mergeAndRankSuggestions(q, merged, freqMap, limit);
}

/** Merge ERPNext results with local frequency map, dedup + score + sort. */
export function mergeAndRankSuggestions(
  query: string,
  customer: RecipientSuggestion[],
  freqMap: FrequencyMap,
  limit = 20,
): RecipientSuggestion[] {
  const q = query.trim().toLowerCase();
  const byEmail = new Map<string, RecipientSuggestion>();

  // 1. Seed with customer results — keyed on the lowercase address so a
  // caller passing mixed-case emails (or two sources disagreeing on case)
  // still dedupes correctly instead of producing near-duplicate rows.
  for (const c of customer) {
    const key = c.email.trim().toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key);
    if (existing) {
      if (!existing.label && c.label) existing.label = c.label;
    } else {
      byEmail.set(key, { ...c, email: key });
    }
  }

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
    // Primary-address tie-break: a contact's primary address ranks above a
    // secondary one at the same match tier. Small on purpose — frequency
    // ranking (up to 100 above) and exact/prefix matching still dominate.
    if (s.primary) score += 3;
    list.push({ ...s, score });
  }

  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.label.localeCompare(b.label);
  });

  // Keep a generous cap — dropdown scrolls if needed.
  return list.slice(0, limit);
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
