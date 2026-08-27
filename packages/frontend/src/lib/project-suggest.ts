/**
 * "Hoort deze mail bij een project?" — de derde bedoeling naast inkoopfactuur
 * en lead/offerteaanvraag.
 *
 * Pure module, net als `mail-intent.ts` en `invoice-detect.ts`: alles komt
 * binnen via `ProjectSuggestSignals` en een lijst `ProjectHint`, zodat de
 * beslisregel met `node --test` tegen echte onderwerpen te toetsen is.
 *
 * ── Vier signalen, en waarom er niet één alleen beslist ───────────────────
 *
 * 1. **Eerdere mail in dezelfde conversatie is al aan een project gekoppeld.**
 *    Verreweg het sterkste signaal, want het is een keuze die een mens al
 *    gemaakt heeft. Haalt in zijn eentje de drempel.
 * 2. **Projectnummer of zeldzame projectnaam-tokens** in onderwerp, bijlagenaam
 *    of body. Een nummer is scherp; een naam-token alleen als het zeldzaam is
 *    (zie hieronder).
 * 3. **Correspondent-historie**: projecten waaraan eerdere mails van dezelfde
 *    afzender gekoppeld zijn. Sterk, maar niet beslissend — mensen mailen over
 *    meer dan één project.
 * 4. **De klant van het project is de afzender.** Uitdrukkelijk alleen als
 *    *versterking*: op deze instance heeft één klant meerdere projecten (Van
 *    Dorp Infra heeft er twee, OpenAEC Foundation ruim dertig). Een voorstel
 *    dat alleen op de klant leunt, is een muntworp met een zelfverzekerd
 *    gezicht — en dat is precies wat een gebruiker één keer accepteert en
 *    daarna nooit meer vertrouwt.
 *
 * ── Waarom zeldzaamheid (IDF) en niet "token komt voor" ──────────────────
 *
 * Op deze instance beginnen twintig projecten met "Open" ("Open Energy
 * Studio", "Open PDF Studio", "Open Field Studio", …) en tien met een cijfer
 * plus een afdelingsnaam. Een mail met het woord "open" erin zou dus twintig
 * even goede kandidaten opleveren. Tokens die in meer dan een vijfde van de
 * projecten voorkomen tellen daarom voor **nul** mee; alleen wat een project
 * echt onderscheidt, telt.
 *
 * ── Nooit voorstellen ────────────────────────────────────────────────────
 *
 * Verzonden mail, mail die al aan een document hangt, en mail waarvoor al een
 * andere bedoeling is herkend (inkoopfactuur, lead, offerteaanvraag). Dat
 * laatste is de "hooguit één voorstel per mail"-regel uit `mail-intent.ts`:
 * een factuurmail van 3BM krijgt geen projectvoorstel eronder, ook al staat
 * "3BM" in het onderwerp en heet één project "Implementatie 3BM Zwijndrecht".
 */

import { tokenizeForMatch } from "./project-folder-match.ts";
import type { MailIntentKind } from "./mail-intent.ts";

/* ─────────────────────────── Publieke vormen ─────────────────────────── */

export interface ProjectHint {
  /** Project-docname, bv. `PROJ-0087`. */
  name: string;
  projectName: string;
  /** Customer-docname van het project, indien gezet. */
  customer?: string;
}

export interface ProjectSuggestSignals {
  subject: string;
  sender: string;
  attachmentNames?: string[];
  bodyText?: string;
  /**
   * Projecten waaraan eerdere mails in **deze conversatie** al gekoppeld zijn.
   * De webmail haalt ze uit de al geladen thread — geen extra servercall.
   */
  threadProjects?: string[];
  /** Projecten waaraan eerdere mails van **deze afzender** gekoppeld zijn. */
  senderProjects?: string[];
  /** Customer-docname van de afzender, uit `classifySender`. */
  senderCustomer?: string;
  direction?: "received" | "sent";
  /** `Communication.reference_doctype` — al gekoppeld = afgehandeld. */
  linkedDoctype?: string;
  /** Wat `classifyMailIntent` van deze mail vond; alleen `"none"` mag door. */
  intentKind?: MailIntentKind;
}

export type ProjectConfidence = "high" | "medium";

export interface ProjectSuggestion {
  /** Project-docname. */
  project: string;
  confidence: ProjectConfidence;
  score: number;
  /** Stabiele codes van wat is herkend; de UI vertaalt ze. */
  reasons: string[];
}

/* ───────────────────────────── Weegfactoren ──────────────────────────── */

/** Een menselijke keuze eerder in dezelfde conversatie — haalt de drempel alleen. */
const WEIGHT_THREAD = 10;
/** Projectnummer letterlijk in onderwerp/bijlagenaam/body. */
const WEIGHT_NUMBER = 5;
/** Eerder gekoppelde mail van dezelfde afzender. */
const WEIGHT_HISTORY = 4;
/** Zeldzaam token uit de projectnaam; maximaal twee tellen mee. */
const WEIGHT_NAME_TOKEN = 2;
const MAX_NAME_TOKENS = 2;
/** De klant van het project is de afzender — nooit genoeg in zijn eentje. */
const WEIGHT_CUSTOMER = 2;

/** Vanaf hier wordt een project voorgesteld. */
const PROPOSE_THRESHOLD = 5;
/** Vanaf hier heet het "hoge zekerheid". */
const HIGH_THRESHOLD = 8;

/**
 * Tokens die in meer dan dit deel van de projecten voorkomen zijn
 * nietszeggend. Op 88 projecten is dat ruim 17 stuks — precies waar
 * "open", "studio" en "implementatie" in vallen.
 */
const COMMON_TOKEN_SHARE = 0.2;

/** Losse jaartallen zijn geen projectnummer. */
const YEAR_TOKEN = /^(19|20)\d{2}$/;

/** Projectnummer zonder het `PROJ-`-voorvoegsel: `PROJ-0087` → `0087`. */
function projectNumberTokens(hint: ProjectHint): string[] {
  return tokenizeForMatch(hint.name.replace(/^PROJ-/i, "")).filter((t) => !YEAR_TOKEN.test(t));
}

/**
 * Documentfrequentie van elk naam-token over de hele projectlijst. Wordt per
 * aanroep opnieuw berekend: de lijst is een paar honderd regels, en een cache
 * die stiekem achterloopt op een nieuw project is erger dan een microseconde
 * rekenwerk.
 */
function rareNameTokens(projects: ProjectHint[]): Map<string, Set<string>> {
  const byToken = new Map<string, Set<string>>();
  for (const p of projects) {
    for (const token of new Set(tokenizeForMatch(p.projectName))) {
      const bucket = byToken.get(token) ?? new Set<string>();
      bucket.add(p.name);
      byToken.set(token, bucket);
    }
  }
  const cap = Math.max(2, Math.floor(projects.length * COMMON_TOKEN_SHARE));
  for (const [token, owners] of byToken) {
    if (owners.size > cap) byToken.delete(token);
  }
  return byToken;
}

/* ──────────────────────────── De suggestie ───────────────────────────── */

/**
 * Het best passende project, of `null` wanneer niets de drempel haalt.
 *
 * Bij een gelijkspel tussen twee projecten wordt er **niets** voorgesteld: dat
 * is precies het geval waarin de gebruiker zelf moet kiezen (twee projecten
 * van dezelfde klant). De UI biedt daarvoor "ander project…" aan.
 */
export function suggestProject(
  signals: ProjectSuggestSignals,
  projects: ProjectHint[],
): ProjectSuggestion | null {
  if (signals.direction === "sent") return null;
  if (signals.linkedDoctype) return null;
  if (signals.intentKind && signals.intentKind !== "none") return null;
  if (projects.length === 0) return null;

  const haystack = [
    signals.subject || "",
    (signals.attachmentNames || []).join(" "),
    // Alleen het begin van de body: verderop staan geciteerde eerdere mails en
    // handtekeningen, waarin elk projectnummer uit het verleden kan opduiken.
    (signals.bodyText || "").slice(0, 2000),
  ].join(" ");
  const tokens = new Set(tokenizeForMatch(haystack));
  const rare = rareNameTokens(projects);
  const thread = new Set(signals.threadProjects || []);
  const history = new Set(signals.senderProjects || []);

  const scored: ProjectSuggestion[] = [];
  for (const project of projects) {
    let score = 0;
    const reasons: string[] = [];

    if (thread.has(project.name)) { score += WEIGHT_THREAD; reasons.push("project:thread"); }
    if (history.has(project.name)) { score += WEIGHT_HISTORY; reasons.push("project:history"); }

    const numberTokens = projectNumberTokens(project);
    if (numberTokens.length > 0 && numberTokens.every((t) => tokens.has(t))) {
      score += WEIGHT_NUMBER;
      reasons.push("project:number");
    }

    let nameHits = 0;
    for (const token of new Set(tokenizeForMatch(project.projectName))) {
      if (nameHits >= MAX_NAME_TOKENS) break;
      if (!tokens.has(token)) continue;
      if (!rare.has(token)) continue;
      nameHits += 1;
      score += WEIGHT_NAME_TOKEN;
    }
    if (nameHits > 0) reasons.push("project:name");

    if (project.customer && signals.senderCustomer && project.customer === signals.senderCustomer) {
      score += WEIGHT_CUSTOMER;
      reasons.push("project:customer");
    }

    if (score > 0) {
      scored.push({
        project: project.name,
        score,
        confidence: score >= HIGH_THRESHOLD ? "high" : "medium",
        reasons,
      });
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best.score < PROPOSE_THRESHOLD) return null;
  // Gelijkspel: laat de gebruiker kiezen in plaats van te gokken.
  if (scored.length > 1 && scored[1].score === best.score) return null;
  return best;
}
