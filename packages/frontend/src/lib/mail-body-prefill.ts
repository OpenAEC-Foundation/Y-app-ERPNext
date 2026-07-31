/**
 * Body-cache pre-fill (component 3).
 *
 * Vult op de achtergrond de lokale body-cache (IndexedDB, zie mail-cache-db.ts)
 * met de volledige mailinhoud van de laatste N dagen, voor álle echte mappen
 * (incl. subfolders). Doel: na de pre-fill openen recente mails — ook in
 * subfolders — instant en offline, zonder server/IMAP-roundtrip.
 *
 * Eigenschappen:
 * - **PEEK**: het server-endpoint /api/mail/bodies haalt bodies via BODY.PEEK[]
 *   → markeert NIETS als gelezen.
 * - **Per map max 1.000 nieuwste** binnen het venster.
 * - **Activity-aware**: pauzeert zolang de gebruiker klikt (isUserBusy), zodat
 *   de pre-fill nooit met interactieve acties concurreert.
 * - **Stream-through**: server houdt bodies niet duurzaam vast; de browser is de
 *   permanente opslag.
 * - **Quota**: bij volle browseropslag stopt de pre-fill en meldt het via
 *   onQuotaFull (caller toont waarschuwing).
 * - **Skip** Trash/Junk/systeem/kapotte mappen.
 */
import { persistMailBody, persistAttachment, getCachedBodyUids, readMailFolderCache, deleteMailBody } from "./mail-cache-db";

/**
 * Persist eventuele bijlage-bytes uit een prefill-body naar de bijlagecache.
 * Op desktop stuurt de Rust-laag base64-bytes mee in body.attachments[i]
 * .contentBase64 (de bytes komen tijdens de body-prefill tóch al binnen). Web
 * laat dit veld weg → dan is dit een no-op en blijft web lazy. Index = positie
 * in body.attachments, exact wat de read-path (fetchAttachmentBlob(uid,index))
 * gebruikt. Best-effort: bij quota-vol stoppen we stil (de body zelf is al
 * bewaard; bijlages zijn een extra).
 */
async function persistBodyAttachments(
  instanceId: string, acct: string, folder: string,
  body: { uid: number; attachments?: Array<{ filename?: string; contentType?: string; contentBase64?: string }> },
  mailDate: number,
): Promise<void> {
  const atts = body.attachments;
  if (!Array.isArray(atts)) return;
  for (let index = 0; index < atts.length; index++) {
    const a = atts[index];
    if (!a?.contentBase64) continue;
    try {
      const bytes = Uint8Array.from(atob(a.contentBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: a.contentType || "application/octet-stream" });
      const r = await persistAttachment(
        instanceId, acct, folder, body.uid, index, blob,
        a.filename || "attachment", a.contentType || "", mailDate,
      );
      if (r.quotaExceeded) return; // opslag vol → stop met bijlages, body blijft
    } catch { /* corrupte base64 / decode-fout → sla deze bijlage over */ }
  }
}

export interface PrefillProgress {
  done: number;        // bodies gecached deze run
  total: number;       // geschat aantal te cachen bodies
  folder: string;      // huidige map
  folderIndex: number; // hoeveelste map (1-based) — voor zichtbare voortgang
  folderTotal: number; // totaal aantal te verwerken mappen
}

interface MsgLite {
  uid: number;
  date: string | null;
}

/** Mappen die we nooit pre-fillen (geen echte mail / niet-selecteerbaar). */
function shouldSkipFolder(path: string): boolean {
  const leaf = (path.split(/[/.]/).pop() || path).toLowerCase().trim();
  return /^(trash|prullenbak|deleted|verwijderde|junk|spam|ongewenst|drafts?|concepten|outbox|postvak uit|notes?|notities|journal|logboek|rss|sync|problemen|voorgestelde|contactpersonen|agenda|calendar|gesprekgeschiedenis|conversation)/.test(leaf);
}

const CHUNK = 40;          // uids per /api/mail/bodies call
const PER_FOLDER_CAP = 1000;

/**
 * @param opts.fetchListUrl  bouwt de /api/mail/messages URL voor een map
 * @param opts.fetchBodiesUrl bouwt de /api/mail/bodies URL voor (map, uids)
 */
export async function prefillBodies(opts: {
  instanceId: string;
  acct: string;
  folders: string[];
  windowDays: number;
  fetchListUrl: (folder: string, pageSize: number) => string;
  fetchBodiesUrl: (folder: string, uids: number[]) => string;
  isUserBusy: () => boolean;
  onProgress: (p: PrefillProgress | null) => void;
  onQuotaFull: () => void;
  isCancelled: () => boolean;
}): Promise<void> {
  const { instanceId, acct, folders, windowDays, fetchListUrl, fetchBodiesUrl,
    isUserBusy, onProgress, onQuotaFull, isCancelled } = opts;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const targets = folders.filter((f) => !shouldSkipFolder(f));
  // INBOX + Sent eerst, daarna de rest.
  targets.sort((a, b) => {
    const score = (p: string) => (p === "INBOX" ? 0 : /sent|verzonden/i.test(p) ? 1 : 2);
    return score(a) - score(b);
  });

  let done = 0;
  let total = 0;
  const folderTotal = targets.length;
  let folderIndex = 0;

  for (const folder of targets) {
    if (isCancelled()) { onProgress(null); return; }
    folderIndex++;
    // Meld voortgang per map zodat de chip zichtbaar beweegt — óók door mappen
    // zonder recente mail (anders lijkt het te hangen).
    onProgress({ done, total, folder, folderIndex, folderTotal });

    const computeInWindow = (list: MsgLite[]) => list
      .filter((m) => m.date && new Date(m.date).getTime() >= cutoff)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, PER_FOLDER_CAP);

    // 1) Lijst: LEES uit de lokale IndexedDB lijst-cache (door de lijst-warmup
    //    al gevuld, nieuwste ~50) → instant, geen IMAP. Fallback naar een korte
    //    fetch als de lijst nog niet lokaal staat.
    let msgs: MsgLite[] | undefined =
      (await readMailFolderCache(instanceId, acct, folder))?.messages as MsgLite[] | undefined;
    if (!msgs) {
      try {
        const res = await fetch(fetchListUrl(folder, 50));
        if (!res.ok) continue; // kapotte/niet-selecteerbare map → skip
        msgs = ((await res.json())?.data?.messages || []) as MsgLite[];
      } catch { continue; }
    }

    // 2) Binnen venster.
    let inWindow = computeInWindow(msgs);
    // 2b) Diepere ophaal: als de ~50-lijst VOLLEDIG binnen het venster valt, zit
    //     er waarschijnlijk méér recente mail dan die 50 (drukke map). Haal dan
    //     een diepere lijst op (tot 1000) zodat álle mail binnen het venster
    //     gecached wordt. Rustige mappen (lijst rijkt voorbij het venster)
    //     blijven snel via de 50-lijst.
    if (msgs.length >= 50 && inWindow.length >= msgs.length) {
      try {
        const res = await fetch(fetchListUrl(folder, PER_FOLDER_CAP));
        if (res.ok) {
          const deep = ((await res.json())?.data?.messages || []) as MsgLite[];
          if (deep.length > msgs.length) { msgs = deep; inWindow = computeInWindow(msgs); }
        }
      } catch { /* houd de 50-lijst bij fout */ }
    }
    if (inWindow.length === 0) continue;

    // 3) Diff tegen wat al lokaal staat.
    const cached = await getCachedBodyUids(instanceId, acct, folder);
    const missing = inWindow.filter((m) => !cached.has(m.uid)).map((m) => m.uid);
    total += missing.length;
    onProgress({ done, total, folder, folderIndex, folderTotal });
    if (missing.length === 0) continue;

    // 4) Bodies in chunks ophalen (PEEK) en lokaal opslaan.
    const byUidDate = new Map(inWindow.map((m) => [m.uid, m.date]));
    for (let i = 0; i < missing.length; i += CHUNK) {
      if (isCancelled()) { onProgress(null); return; }
      // Alleen vóór een body-download even wijken als de gebruiker actief klikt
      // (dit is het echte IMAP-werk). Kort venster zodat het snel hervat.
      let w = 0;
      while (isUserBusy() && w < 8000) { await sleep(300); w += 300; }
      const chunk = missing.slice(i, i + CHUNK);
      try {
        const res = await fetch(fetchBodiesUrl(folder, chunk));
        if (!res.ok) break;
        const data = await res.json();
        const bodies = (data?.data || []) as Array<{ uid: number }>;
        for (const body of bodies) {
          const d = byUidDate.get(body.uid);
          const mailDate = d ? new Date(d).getTime() : Date.now();
          const r = await persistMailBody(instanceId, acct, folder, body.uid, body, mailDate || Date.now());
          if (r.quotaExceeded) { onQuotaFull(); onProgress(null); return; }
          await persistBodyAttachments(instanceId, acct, folder, body as never, mailDate || Date.now());
          done++;
        }
        onProgress({ done, total, folder, folderIndex, folderTotal });
      } catch { break; }
      await sleep(50); // korte yield tussen chunks
    }
  }
  onProgress(null); // klaar → chip verbergen
}

/**
 * Delta-sync: houd alleen de WIJZIGINGEN bij. Voor de gegeven mappen (typisch
 * INBOX + de actieve map) haalt het de nieuwste lijst op, pakt de mails binnen
 * het venster die nog NIET lokaal staan, en cachet alleen die. Lichtgewicht —
 * geen warmup-wait, geen voortgangs-chip, geen activity-pauze. Bedoeld om te
 * draaien op het `mail-changed` push-event (nieuwe mail). Returns aantal
 * toegevoegd.
 */
export async function syncNewBodies(opts: {
  instanceId: string;
  acct: string;
  folders: string[];
  windowDays: number;
  fetchListUrl: (folder: string, pageSize: number) => string;
  fetchBodiesUrl: (folder: string, uids: number[]) => string;
}): Promise<number> {
  const { instanceId, acct, folders, windowDays, fetchListUrl, fetchBodiesUrl } = opts;
  if (windowDays <= 0) return 0;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  let added = 0;
  for (const folder of folders) {
    if (shouldSkipFolder(folder)) continue;
    let msgs: MsgLite[] = [];
    try {
      const res = await fetch(fetchListUrl(folder, 50));
      if (!res.ok) continue;
      msgs = ((await res.json())?.data?.messages || []) as MsgLite[];
    } catch { continue; }
    const inWindow = msgs.filter((m) => m.date && new Date(m.date).getTime() >= cutoff);
    const cached = await getCachedBodyUids(instanceId, acct, folder);
    // Reconciliatie van verwijderingen: de opgehaalde lijst is de NIEUWSTE ~50
    // (hoogste uids). Een gecachte uid die binnen dat bereik valt maar NIET meer
    // in de lijst zit, is op de server verwijderd/verplaatst → lokaal wissen.
    // (Gecachte uids ónder het bereik blijven staan; die kunnen legitiem
    // ouder-maar-in-venster zijn en worden door leeftijd-eviction afgehandeld.)
    if (msgs.length > 0 && cached.size > 0) {
      const fetchedUids = msgs.map((m) => m.uid);
      const minFetched = Math.min(...fetchedUids);
      const fetchedSet = new Set(fetchedUids);
      for (const u of cached) {
        if (u >= minFetched && !fetchedSet.has(u)) {
          await deleteMailBody(instanceId, acct, folder, u);
          cached.delete(u);
        }
      }
    }
    if (inWindow.length === 0) continue;
    const missing = inWindow.filter((m) => !cached.has(m.uid));
    if (missing.length === 0) continue;
    const byUidDate = new Map(missing.map((m) => [m.uid, m.date]));
    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK).map((m) => m.uid);
      try {
        const res = await fetch(fetchBodiesUrl(folder, chunk));
        if (!res.ok) break;
        const bodies = ((await res.json())?.data || []) as Array<{ uid: number }>;
        for (const body of bodies) {
          const d = byUidDate.get(body.uid);
          const md = (d ? new Date(d).getTime() : Date.now()) || Date.now();
          const r = await persistMailBody(instanceId, acct, folder, body.uid, body, md);
          if (r.quotaExceeded) return added;
          await persistBodyAttachments(instanceId, acct, folder, body as never, md);
          added++;
        }
      } catch { break; }
    }
  }
  return added;
}
