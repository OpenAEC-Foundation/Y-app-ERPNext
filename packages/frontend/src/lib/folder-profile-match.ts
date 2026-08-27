/**
 * Geleerd folder-profiel (signaal C van de "Sorteer in projectmap"-voorspeller).
 *
 * Leert per BESTAANDE projectmap uit de al-gefilede mails wat de
 * onderscheidende gezamenlijke eigenschappen zijn:
 *  - correspondenten (from/to-adressen),
 *  - onderwerp-steekwoorden,
 *  - bijlagenaam-tokens (signaal F, uit de body-cache).
 *
 * Alles komt uit de reeds warme client-caches (lijst-cache + body-cache) →
 * geen servercalls. Een kandidaat-mail scoort tegen de profielen met
 * IDF-weging: een kenmerk dat in één map voorkomt weegt zwaar, een kenmerk
 * dat in veel mappen zit (dezelfde persoon/klant op meerdere projecten) telt
 * licht. Dit lost het "gedeelde contact/klant"-probleem op.
 */

import type { ProjectRecord } from "./DataContext";
import type { MailSide, FolderLike } from "./project-folder-resolve";
import type { MatchConfidence } from "./project-mail-match";
import { tokenizeForMatch, matchProjectFromFolder } from "./project-folder-match";
import { readMailFolderCache, readMailBody } from "./mail-cache-db";

export interface FolderProfile {
  path: string;
  side: MailSide;
  correspondents: Set<string>;
  subjectTokens: Set<string>;
  attachmentTokens: Set<string>;
  msgCount: number;
}

/** Hoeveel nieuwste mails/map de body-cache lezen voor bijlagenaam-tokens.
 *  Bijlage-vocabulaire stabiliseert snel; begrenst het aantal IDB-reads. */
const ATTACH_SCAN_LIMIT = 40;

type BodyWithAttachments = { attachments?: { filename?: string | null }[] };

/**
 * Bouwt profielen voor alle projectmappen (beide kanten). Async: leest de
 * lijst-cache per map + een begrensd aantal bodies voor bijlagenamen.
 */
export async function buildFolderProfiles<F extends FolderLike>(
  instanceId: string,
  acct: string,
  folders: F[],
  projects: ProjectRecord[],
  isSentContext: (folderPath: string, folders: F[]) => boolean,
): Promise<FolderProfile[]> {
  const profiles: FolderProfile[] = [];

  for (const f of folders) {
    if (f.specialUse) continue;
    if (f.path.trim().toUpperCase() === "INBOX") continue;
    // Alleen echte projectmappen (≥2-token-match tegen een project).
    if (!matchProjectFromFolder(f.name, projects)) continue;

    const cached = await readMailFolderCache(instanceId, acct, f.path);
    if (!cached || !cached.messages.length) continue;

    const side: MailSide = isSentContext(f.path, folders) ? "sent" : "inbox";
    const correspondents = new Set<string>();
    const subjectTokens = new Set<string>();
    const attachmentTokens = new Set<string>();

    for (const m of cached.messages) {
      for (const a of m.from || []) if (a.address) correspondents.add(a.address.toLowerCase());
      for (const a of m.to || []) if (a.address) correspondents.add(a.address.toLowerCase());
      for (const tok of tokenizeForMatch(m.subject)) subjectTokens.add(tok);
    }

    // Bijlagenamen: alleen de nieuwste N (uid desc) uit de body-cache.
    const newest = [...cached.messages].sort((a, b) => b.uid - a.uid).slice(0, ATTACH_SCAN_LIMIT);
    for (const m of newest) {
      const body = await readMailBody<BodyWithAttachments>(instanceId, acct, f.path, m.uid);
      for (const att of body?.body?.attachments || []) {
        for (const tok of tokenizeForMatch(att.filename)) attachmentTokens.add(tok);
      }
    }

    profiles.push({ path: f.path, side, correspondents, subjectTokens, attachmentTokens, msgCount: cached.messages.length });
  }

  return profiles;
}

export interface HistoryScoreInput {
  subject?: string | null;
  participants: string[];
  attachmentNames?: string[];
}

const ADDR_WEIGHT = 3; // adres discrimineert sterker dan een los onderwerp-woord

function idf(df: number): number {
  return 1 / Math.log(1 + Math.max(df, 1));
}

/**
 * Scoort een mail tegen alle profielen aan de gegeven kant. IDF-gewogen op
 * document-frequency (aantal mappen dat het kenmerk deelt). Gesorteerd,
 * hoogste eerst; alleen score > 0.
 */
export function scoreFoldersFromHistory(
  mail: HistoryScoreInput,
  profiles: FolderProfile[],
  side: MailSide,
): { path: string; score: number }[] {
  const sideProfiles = profiles.filter((p) => p.side === side);
  if (!sideProfiles.length) return [];

  const addrDf = new Map<string, number>();
  const tokDf = new Map<string, number>();
  for (const prof of sideProfiles) {
    for (const a of prof.correspondents) addrDf.set(a, (addrDf.get(a) || 0) + 1);
    const seenTok = new Set<string>([...prof.subjectTokens, ...prof.attachmentTokens]);
    for (const tkn of seenTok) tokDf.set(tkn, (tokDf.get(tkn) || 0) + 1);
  }

  const mailAddrs = mail.participants.map((a) => a.toLowerCase());
  const mailToks = [
    ...tokenizeForMatch(mail.subject),
    ...(mail.attachmentNames || []).flatMap((n) => tokenizeForMatch(n)),
  ];

  const results = sideProfiles.map((prof) => {
    let score = 0;
    for (const a of mailAddrs) {
      if (prof.correspondents.has(a)) score += ADDR_WEIGHT * idf(addrDf.get(a) || 1);
    }
    for (const tkn of mailToks) {
      if (prof.subjectTokens.has(tkn) || prof.attachmentTokens.has(tkn)) score += idf(tokDf.get(tkn) || 1);
    }
    return { path: prof.path, score };
  });

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

/** Vertaalt een history-score naar een zekerheids-tier (drempels afgestemd op
 *  de IDF-weging: één uniek correspondentadres ≈ 4.3). */
export function historyConfidence(score: number): MatchConfidence {
  if (score >= 3) return "high";
  if (score >= 1.2) return "medium";
  if (score > 0) return "low";
  return "none";
}
