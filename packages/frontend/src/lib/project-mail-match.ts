/**
 * Deterministische mail → project matcher (signalen D + E van de
 * "Sorteer in projectmap"-voorspeller).
 *
 * Matcht onderwerp- en bijlagenaam-tokens tegen:
 *  - het projectnummer (`name` zonder `PROJ-`-prefix), getokeniseerd zodat
 *    ook samengestelde nummers als `2024-0142` per deel matchen ("delen van
 *    het projectnummer") — pure jaartallen (19xx/20xx) worden als los token
 *    genegeerd om false positives te voorkomen;
 *  - de klantreferentie (`custom_customer_reference`, bv. `JM24-026`);
 *  - de projectnaam (`project_name`).
 *
 * Bewust GEEN afzender/klantnaam-weging: veel projecten delen dezelfde klant
 * (zie [[project_erpnext_data_facts_3bm]]) → te zwak, zou vals-zekere
 * voorstellen geven. Het bedrijf komt terug in het geleerde folder-profiel
 * (signaal C, IDF-gewogen), niet hier.
 *
 * Signaal A (bestaande koppeling) wint altijd als `linkedProjectName` naar
 * een bekend project wijst.
 */

import type { ProjectRecord } from "./DataContext";
import { tokenizeForMatch } from "./project-folder-match";

export type MatchConfidence = "high" | "medium" | "low" | "none";

export interface MailMatchInput {
  subject?: string | null;
  /** Ruwe bijlagenamen (signaal F). Worden intern getokeniseerd. */
  attachmentNames?: string[];
  /** Bestaande koppeling uid:subject → project.name (signaal A). */
  linkedProjectName?: string | null;
}

export interface MailMatchResult {
  project: ProjectRecord | null;
  confidence: MatchConfidence;
  score: number;
  reason: "link" | "number" | "reference" | "name" | "none";
}

const YEAR_TOKEN = /^(19|20)\d{2}$/;
const STRONG_WEIGHT = 5;

function projectNumber(p: ProjectRecord): string {
  return p.name.replace(/^PROJ-/i, "");
}

/** Distinctieve sterke tokens per project: nummer-delen + referentie-delen,
 *  zonder losse jaartallen. */
function strongTokensFor(p: ProjectRecord): Set<string> {
  const out = new Set<string>();
  for (const tok of tokenizeForMatch(projectNumber(p))) {
    if (!YEAR_TOKEN.test(tok)) out.add(tok);
  }
  for (const tok of tokenizeForMatch(p.custom_customer_reference)) {
    if (!YEAR_TOKEN.test(tok)) out.add(tok);
  }
  return out;
}

function tierDownDe(t: MatchConfidence): MatchConfidence {
  return t === "high" ? "medium" : t === "medium" ? "low" : "none";
}

/**
 * Scoort een mail tegen alle projecten en geeft de beste match + zekerheid.
 * Pure functie — geen side effects, geen servercalls.
 */
export function matchProjectFromMail(
  mail: MailMatchInput,
  projects: ProjectRecord[],
): MailMatchResult {
  if (!projects.length) return { project: null, confidence: "none", score: 0, reason: "none" };

  // Signaal A: expliciete koppeling wint.
  if (mail.linkedProjectName) {
    const linked = projects.find((p) => p.name === mail.linkedProjectName);
    if (linked) return { project: linked, confidence: "high", score: 999, reason: "link" };
  }

  const tokens = [
    ...tokenizeForMatch(mail.subject),
    ...(mail.attachmentNames || []).flatMap((n) => tokenizeForMatch(n)),
  ];
  if (tokens.length === 0) return { project: null, confidence: "none", score: 0, reason: "none" };

  let best: {
    p: ProjectRecord;
    score: number;
    strong: boolean;
    nameHits: number;
    reason: MailMatchResult["reason"];
  } | null = null;
  let bestCount = 0; // aantal projecten met de huidige topscore (voor tie-detectie)

  for (const p of projects) {
    const strongToks = strongTokensFor(p);
    const refToks = new Set(tokenizeForMatch(p.custom_customer_reference).filter((t) => !YEAR_TOKEN.test(t)));
    const nameHay = `${projectNumber(p)} ${p.project_name}`.toLowerCase();

    let score = 0;
    let strong = false;
    let nameHits = 0;
    let reason: MailMatchResult["reason"] = "none";

    for (const tok of tokens) {
      if (strongToks.has(tok)) {
        score += STRONG_WEIGHT;
        strong = true;
        reason = refToks.has(tok) ? "reference" : "number";
      } else if (nameHay.includes(tok)) {
        score += 1;
        nameHits += 1;
        if (reason === "none") reason = "name";
      }
    }

    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { p, score, strong, nameHits, reason };
      bestCount = 1;
    } else if (score === best.score) {
      bestCount += 1;
    }
  }

  if (!best) return { project: null, confidence: "none", score: 0, reason: "none" };

  let confidence: MatchConfidence = best.strong
    ? "high"
    : best.nameHits >= 2
      ? "medium"
      : "low";

  // Tie tussen meerdere projecten met gelijke topscore → één tier omlaag.
  if (bestCount > 1) confidence = tierDownDe(confidence);

  return {
    project: confidence === "none" ? null : best.p,
    confidence,
    score: best.score,
    reason: confidence === "none" ? "none" : best.reason,
  };
}
