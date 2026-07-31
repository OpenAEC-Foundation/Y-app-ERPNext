/**
 * Match een mailfolder-naam tegen een lijst projecten via token-overlap.
 *
 * Gebruikt voor:
 *  - Auto-koppelen van mails aan project (ReadingPane in Webmail)
 *  - Auto-pre-select project in "Opslaan op NAS" dialog
 *
 * Strippe folder-prefixes ([IN], [OUT], INBOX/) en splitst op niet-alfanum.
 * Tokens van <3 tekens worden genegeerd. Vereist ≥2 token-matches voor
 * positief resultaat, anders kunnen losse cijfers / korte woorden tot
 * false positives leiden.
 */

export interface ProjectMatchRow {
  name: string;
  project_name: string;
}

/**
 * Splits ruwe tekst (mapnaam, onderwerp, bijlagenaam) in match-tokens:
 * normaliseert `/`+`\` naar spaties, splitst op whitespace/`-`/`_`,
 * lowercased, en dropt tokens <3 tekens (voorkomt false positives op
 * losse cijfers/korte woorden). Gedeeld door folder-, mail- en
 * profiel-matching zodat alle voorspellers identiek tokeniseren.
 */
export function tokenizeForMatch(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .replace(/[/\\]/g, " ")
    .split(/[\s\-_]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 3);
}

export function matchProjectFromFolder<T extends ProjectMatchRow>(
  folder: string | undefined | null,
  projects: T[],
): T | null {
  if (!folder || !projects.length) return null;
  const cleaned = folder
    .replace(/^INBOX[/\\]/i, "")
    .replace(/^\[(IN|OUT|UIT)\]\s*/i, "");
  const tokens = tokenizeForMatch(cleaned);
  if (tokens.length === 0) return null;
  let best: { p: T; score: number } | null = null;
  for (const p of projects) {
    const hay = `${p.name} ${p.project_name}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (hay.includes(tok)) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { p, score };
    }
  }
  return best && best.score >= 2 ? best.p : null;
}
