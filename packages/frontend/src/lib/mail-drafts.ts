/**
 * Concepten: een half getypt antwoord overleeft het wegklikken.
 *
 * Wie halverwege een antwoord op mail A naar mail B springt, hoort bij
 * terugkomst zijn tekst terug te vinden — en in de berichtenlijst te zien
 * wáár nog iets afgemaakt moet worden. Dat is wat deze module bewaart.
 *
 * ── Waar het staat, en waarom dáár ───────────────────────────────────────
 *
 * **localStorage, per instance, per apparaat.** De sleutel is
 * `mail_drafts_<instanceId>` — bewust **zonder** de `pref_`-prefix, want die
 * prefix is precies wat `synced-prefs` meeneemt naar andere apparaten. Een
 * halfgetypt antwoord is geen instelling: het hoort bij de plek waar je zit te
 * typen, en het naar een ander apparaat spiegelen zou twee versies van
 * dezelfde tekst laten ontstaan zonder dat iets ze samenvoegt. Het is dus
 * expliciet **niet** cross-device — dezelfde afweging als het mail-cachevenster.
 *
 * Een concept in ERPNext zetten (een `Communication` met `sent_or_received`
 * leeg, of een eigen doctype) zou wél synchroniseren, maar kost een schrijfactie
 * per toetsaanslag-venster en laat halfbakken rijen achter in de mailhistorie
 * van iedereen die meekijkt. Dat is een grotere prijs dan "je concept staat op
 * de laptop waar je het typte".
 *
 * ── Wat er níet in gaat ──────────────────────────────────────────────────
 *
 * **Bijlagen.** Een `File` uit een `<input type="file">` is niet serialiseerbaar
 * en de browser geeft het pad na een herlaadbeurt niet terug. Een hersteld
 * concept begint dus zonder bestanden; de tekst is wat bewaard wordt.
 *
 * ── Grenzen ──────────────────────────────────────────────────────────────
 *
 * `MAX_DRAFTS` (nieuwste eerst) en `MAX_AGE_MS` (30 dagen) worden bij élke
 * lees- en schrijfactie toegepast, zodat een vergeten concept uit maart de
 * opslag niet oneindig laat groeien en een volle `localStorage` nooit door
 * deze module veroorzaakt wordt.
 */

import { isHtmlEmpty } from "./mail-html.ts";
import { splitQuoteFromBody } from "./mail-quote.ts";

/** Hoeveel concepten er maximaal bewaard blijven, nieuwste eerst. */
export const MAX_DRAFTS = 50;
/** Ouder dan dit → weg. 30 dagen: lang genoeg voor "ik pak het maandag op". */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type MailDraftMode = "new" | "reply" | "replyAll" | "forward";

/** Eén bewaard concept, zoals het in localStorage staat. */
export interface StoredMailDraft {
  /** Sleutel binnen de map; zie `draftKeyFor`. */
  key: string;
  mode: MailDraftMode;
  /** Communication waarop dit een antwoord/doorsturen is. Leeg bij een nieuw bericht. */
  messageName?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  includeSignature: boolean;
  /** Het geciteerde origineel, zodat een hersteld antwoord er hetzelfde uitziet. */
  quoteHtml: string;
  quoteLabel: string;
  inReplyTo?: string;
  reference?: { doctype: string; name: string };
  /** Epoch-ms van de laatste wijziging — sorteersleutel voor cap en opruiming. */
  updatedAt: number;
}

export type MailDraftMap = Record<string, StoredMailDraft>;

function storageKey(instanceId: string): string {
  return `mail_drafts_${instanceId || "default"}`;
}

/**
 * Sleutel van een concept.
 *
 * Beantwoorden en doorsturen van hetzelfde bericht zijn twee verschillende
 * brieven en krijgen dus twee sleutels; "beantwoorden" en "allen beantwoorden"
 * delen er één (je wisselt daar tussen binnen hetzelfde antwoord).
 *
 * Een nieuw bericht heeft geen bericht om aan te hangen en krijgt daarom een
 * eigen, eenmalig gegenereerde sleutel mee.
 */
export function draftKeyFor(mode: MailDraftMode, messageName?: string): string {
  if (mode === "forward" && messageName) return `fwd:${messageName}`;
  if (messageName && mode !== "new") return `msg:${messageName}`;
  return newDraftKey();
}

/** Verse sleutel voor een losstaand nieuw bericht. */
export function newDraftKey(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `new:${Date.now().toString(36)}${rand}`;
}

/**
 * Is hier genoeg getypt om te bewaren?
 *
 * Zonder deze drempel zou het openen én meteen sluiten van een antwoordvenster
 * al een "Concept"-label in de lijst achterlaten: het onderwerp (`Re: …`) en de
 * geadresseerde zijn dan namelijk al ingevuld door de app zelf, niet door de
 * gebruiker. Bij een antwoord telt daarom alléén de getypte tekst; bij een
 * nieuw bericht telt ook een ingevulde geadresseerde of onderwerpregel, want
 * dáár heeft de gebruiker die zelf ingetikt.
 *
 * Sinds het citaat gewone inhoud van de opsteller is (zie `mail-quote.ts`),
 * staat het geciteerde origineel ín `body`. Dat is niet "getypt": het wordt er
 * door de app in gezet. Daarom eerst afsplitsen, en pas dan kijken of er nog
 * iets zichtbaars overblijft — twee lege alinea's boven een citaat zijn geen
 * concept.
 */
export function hasDraftContent(draft: {
  mode: MailDraftMode; to: string; cc: string; bcc: string; subject: string; body: string;
}): boolean {
  if (!isHtmlEmpty(splitQuoteFromBody(draft.body).typed)) return true;
  if (draft.mode !== "new") return false;
  return Boolean(draft.to.trim() || draft.cc.trim() || draft.bcc.trim() || draft.subject.trim());
}

/**
 * Pas de grenzen toe: te oud eruit, daarna afkappen op `MAX_DRAFTS` (nieuwste
 * blijven). Puur, zodat het gedrag zonder browser te testen is.
 */
export function pruneDrafts(map: MailDraftMap, now: number = Date.now()): MailDraftMap {
  const fresh = Object.values(map).filter(
    (d) => typeof d?.updatedAt === "number" && now - d.updatedAt <= MAX_AGE_MS,
  );
  fresh.sort((a, b) => b.updatedAt - a.updatedAt);
  const out: MailDraftMap = {};
  for (const draft of fresh.slice(0, MAX_DRAFTS)) out[draft.key] = draft;
  return out;
}

function readRaw(instanceId: string): MailDraftMap {
  try {
    const raw = localStorage.getItem(storageKey(instanceId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: MailDraftMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const d = value as Partial<StoredMailDraft> | null;
      // Alles wat niet als concept te herkennen is wordt overgeslagen in
      // plaats van de hele map weg te gooien: één corrupte rij mag niet
      // negenenveertig goede concepten meenemen.
      if (!d || typeof d !== "object" || typeof d.body !== "string") continue;
      out[key] = {
        key,
        mode: (d.mode ?? "new") as MailDraftMode,
        ...(d.messageName ? { messageName: d.messageName } : {}),
        to: d.to ?? "",
        cc: d.cc ?? "",
        bcc: d.bcc ?? "",
        subject: d.subject ?? "",
        body: d.body,
        includeSignature: d.includeSignature !== false,
        quoteHtml: d.quoteHtml ?? "",
        quoteLabel: d.quoteLabel ?? "",
        ...(d.inReplyTo ? { inReplyTo: d.inReplyTo } : {}),
        ...(d.reference ? { reference: d.reference } : {}),
        updatedAt: typeof d.updatedAt === "number" ? d.updatedAt : 0,
      };
    }
    return out;
  } catch {
    /* privémodus, vol quotum of onleesbare JSON: geen concepten is geen fout */
    return {};
  }
}

function writeRaw(instanceId: string, map: MailDraftMap): void {
  try {
    if (Object.keys(map).length === 0) localStorage.removeItem(storageKey(instanceId));
    else localStorage.setItem(storageKey(instanceId), JSON.stringify(map));
  } catch {
    /* opslag vol/geblokkeerd — het opstelvenster blijft gewoon werken */
  }
}

/** Alle concepten van deze instance, al opgeschoond. */
export function loadDrafts(instanceId: string, now: number = Date.now()): MailDraftMap {
  return pruneDrafts(readRaw(instanceId), now);
}

/**
 * Bewaar (of verwijder) één concept en geef de nieuwe map terug.
 *
 * Leegt de gebruiker zijn tekst weer, dan verdwijnt het concept: een leeg
 * "Concept"-label in de lijst is misleidender dan geen label.
 */
export function saveDraft(
  instanceId: string,
  draft: Omit<StoredMailDraft, "updatedAt"> & { updatedAt?: number },
  now: number = Date.now(),
): MailDraftMap {
  const map = loadDrafts(instanceId, now);
  if (!hasDraftContent(draft)) {
    delete map[draft.key];
  } else {
    map[draft.key] = { ...draft, updatedAt: draft.updatedAt ?? now };
  }
  const pruned = pruneDrafts(map, now);
  writeRaw(instanceId, pruned);
  return pruned;
}

/** Gooi één concept weg (verzenden, of de expliciete "concept verwijderen"). */
export function deleteDraft(instanceId: string, key: string, now: number = Date.now()): MailDraftMap {
  const map = loadDrafts(instanceId, now);
  delete map[key];
  writeRaw(instanceId, map);
  return map;
}

/**
 * Communication-namen waar een concept aan hangt — dat is wat de
 * berichtenlijst nodig heeft om het "Concept"-label op de juiste regel te
 * zetten. Losstaande nieuwe berichten horen bij geen enkel bericht en zitten
 * hier dus niet in; die krijgen hun eigen sectie bovenaan de lijst.
 */
export function draftMessageNames(map: MailDraftMap): Set<string> {
  const out = new Set<string>();
  for (const draft of Object.values(map)) {
    if (draft.messageName) out.add(draft.messageName);
  }
  return out;
}

/** De losstaande nieuwe berichten, nieuwste eerst. */
export function standaloneDrafts(map: MailDraftMap): StoredMailDraft[] {
  return Object.values(map)
    .filter((d) => !d.messageName)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Het concept dat bij dit bericht hoort, of `undefined`. Een antwoord gaat
 * voor op een doorstuurconcept: dát is wat "hervatten" bij een geopende mail
 * meestal bedoelt.
 */
export function draftForMessage(map: MailDraftMap, messageName: string): StoredMailDraft | undefined {
  return map[`msg:${messageName}`] ?? map[`fwd:${messageName}`];
}
