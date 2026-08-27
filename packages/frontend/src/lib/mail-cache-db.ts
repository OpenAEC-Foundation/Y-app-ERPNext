/**
 * Mail-list IndexedDB cache.
 *
 * Vervangt de localStorage-cache uit Webmail.tsx (50 folder LRU,
 * webmail_msglist_cache_*) voor mail-lijst metadata. IndexedDB heeft
 * praktisch geen quota issue (~50% vrije schijfruimte), dus alle
 * folders kunnen lokaal staan zonder LRU-eviction.
 *
 * Schema: database "y-app-mail" v1, object store "folder_messages".
 * Key: composite string `${instanceId}::${acct}::${folder}`.
 * Value: { messages: MailMessage[], total: number, ts: number }.
 *
 * Public API mirrort de oude sync helpers maar is async.
 */
import type { MailMessage } from "./webmail-prefetch";

const DB_NAME = "y-app-mail";
// v2: + object store "message_bodies" (lokale body-cache). v1 had alleen
// "folder_messages" (lijsten). v3: body-keys gebruiken een NUL-separator i.p.v.
// "::" (mapnamen kunnen "::" bevatten → key-collisie); de oude body-entries
// worden bij de v3-upgrade gewist en opnieuw gevuld door de pre-fill.
// v4: + object store "message_attachments" (lazy bijlage-cache: bijlage wordt
// gecached zodra je 'm opent/downloadt, en valt uit het rollende venster net als
// de bodies). Blobs worden direct opgeslagen.
const DB_VERSION = 4;
const STORE = "folder_messages";
const BODY_STORE = "message_bodies";
const ATT_STORE = "message_attachments";
// Separator die niet in een IMAP-mapnaam kan voorkomen (NUL). Voor de body-keys.
const SEP = String.fromCharCode(0);

export interface CachedFolder {
  messages: MailMessage[];
  total: number;
  ts: number;
}

/**
 * Eén gecachte mail-body in IndexedDB.
 * - `body` is het volledige bericht-object zoals de server het teruggeeft op
 *   `/api/mail/message` (MailMessageFull). Generiek getypeerd om een import-
 *   cycle met Webmail.tsx te vermijden; de caller cast.
 * - `mailDate` is de verzend-/ontvangstdatum (ms) — gebruikt voor de rollende
 *   venster-eviction (mails ouder dan N dagen vallen eruit).
 * - `ts` is wanneer we 'm cachten.
 */
export interface CachedBody<T = unknown> {
  body: T;
  mailDate: number;
  ts: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(BODY_STORE)) {
        db.createObjectStore(BODY_STORE);
      } else if ((event.oldVersion || 0) < 3) {
        // v2→v3: body-keys wisselen van "::" naar NUL-separator → oude entries
        // zijn onbruikbaar. Wis ze in de versionchange-transactie; de pre-fill
        // vult ze opnieuw. (De lijst-store blijft staan.)
        try { req.transaction?.objectStore(BODY_STORE).clear(); } catch { /* ignore */ }
      }
      if (!db.objectStoreNames.contains(ATT_STORE)) {
        db.createObjectStore(ATT_STORE);
      }
    };
    // Multi-tab guard: een open oudere-versie-tab blokkeert de upgrade → zonder
    // dit hangt élke IDB-call eeuwig. Faal luid als wij geblokkeerd worden, en
    // sluit onze connectie als een andere tab wil upgraden.
    req.onblocked = () => { dbPromise = null; reject(new Error("IndexedDB-upgrade geblokkeerd door een andere tab")); };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { try { db.close(); } catch { /* ignore */ } dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function compositeKey(instanceId: string, acct: string, folder: string): string {
  return `${instanceId}::${acct || ""}::${folder}`;
}

// Body-keys gebruiken de NUL-separator i.p.v. "::" (mapnamen kunnen "::"
// bevatten → key-collisie + verkeerde prefix-matches).
function bodyPrefix(instanceId: string, acct: string, folder?: string): string {
  const base = `${instanceId}${SEP}${acct || ""}${SEP}`;
  return folder !== undefined ? `${base}${folder}${SEP}` : base;
}

function bodyKey(instanceId: string, acct: string, folder: string, uid: number): string {
  return `${bodyPrefix(instanceId, acct, folder)}${uid}`;
}

// Attachment-keys: zelfde NUL-separator + extra segment voor de bijlage-index.
function attPrefix(instanceId: string, acct: string): string {
  return `${instanceId}${SEP}${acct || ""}${SEP}`;
}
function attKey(instanceId: string, acct: string, folder: string, uid: number, index: number): string {
  return `${attPrefix(instanceId, acct)}${folder}${SEP}${uid}${SEP}${index}`;
}

/** Eén gecachte bijlage. `blob` = de ruwe bytes; `mailDate` = datum van de mail
 *  (voor rollende venster-eviction, gelijk aan de bodies); `ts` = cache-moment. */
export interface CachedAttachment {
  blob: Blob;
  filename: string;
  contentType: string;
  mailDate: number;
  ts: number;
}

/** Lees folder-cache. Returns null als folder niet gecached is. */
export async function readMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
): Promise<CachedFolder | null> {
  try {
    const db = await openDb();
    return new Promise<CachedFolder | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(compositeKey(instanceId, acct, folder));
      req.onsuccess = () => resolve((req.result as CachedFolder) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist folder-cache. Trimt tot 500 nieuwste messages (sort op uid desc
 * als proxy voor internalDate, want IMAP-uids zijn monotoon increasing per
 * folder en kosten geen Date-parse).
 */
export async function persistMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
  messages: MailMessage[],
  total: number,
): Promise<void> {
  const trimmed = messages.length > 500
    ? [...messages].sort((a, b) => b.uid - a.uid).slice(0, 500)
    : messages;
  const value: CachedFolder = { messages: trimmed, total, ts: Date.now() };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, compositeKey(instanceId, acct, folder));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Stil falen — IDB onbeschikbaar (Safari privé, quota). Caller heeft
    // localStorage-fallback via dual-write in Task 6.
  }
}

/** Geef alle folder-paden terug die gecached zijn voor deze (instance, acct). */
export async function getCachedFolderPaths(
  instanceId: string,
  acct: string,
): Promise<string[]> {
  const prefix = `${instanceId}::${acct || ""}::`;
  try {
    const db = await openDb();
    return new Promise<string[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]) || [];
        resolve(
          keys
            .filter((k) => k.startsWith(prefix))
            .map((k) => k.slice(prefix.length)),
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Wis één folder-entry uit IDB. Voor cache-invalidatie bij move/delete. */
export async function deleteMailFolderCache(
  instanceId: string,
  acct: string,
  folder: string,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(compositeKey(instanceId, acct, folder));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Wis alle cache-entries voor deze (instance, acct). */
export async function clearMailCache(
  instanceId: string,
  acct: string,
): Promise<void> {
  const prefix = `${instanceId}::${acct || ""}::`;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result as string[]) || [];
        for (const k of keys) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/* ─────────────────────────── Body-cache (v2) ───────────────────────────
 * Lokale opslag van volledige mail-inhoud zodat een mail openen instant is
 * (geen server/IMAP-roundtrip) en offline werkt. Per apparaat/browser.
 * Vullen gebeurt op de achtergrond via de server (zie body-cache fill);
 * eviction op leeftijd (rollend venster) + per-map cap gebeurt hier.
 * ----------------------------------------------------------------------- */

/** Lees een gecachte body. Null als niet lokaal aanwezig. */
export async function readMailBody<T = unknown>(
  instanceId: string,
  acct: string,
  folder: string,
  uid: number,
): Promise<CachedBody<T> | null> {
  try {
    const db = await openDb();
    return new Promise<CachedBody<T> | null>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readonly");
      const req = tx.objectStore(BODY_STORE).get(bodyKey(instanceId, acct, folder, uid));
      req.onsuccess = () => resolve((req.result as CachedBody<T>) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persist een body. Returns `quotaExceeded:true` als de browseropslag vol is —
 * de caller toont dan een waarschuwing en stopt met cachen (we evicten NIET
 * stil op grootte; alleen op leeftijd via evictBodiesOlderThan).
 */
export async function persistMailBody<T = unknown>(
  instanceId: string,
  acct: string,
  folder: string,
  uid: number,
  body: T,
  mailDate: number,
): Promise<{ stored: boolean; quotaExceeded: boolean }> {
  const value: CachedBody<T> = { body, mailDate, ts: Date.now() };
  const putOnce = async (): Promise<{ stored: boolean; quotaExceeded: boolean }> => {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      tx.objectStore(BODY_STORE).put(value, bodyKey(instanceId, acct, folder, uid));
      tx.oncomplete = () => resolve({ stored: true, quotaExceeded: false });
      tx.onerror = () => resolve({ stored: false, quotaExceeded: tx.error?.name === "QuotaExceededError" });
    });
  };
  try {
    const first = await putOnce();
    if (first.stored || !first.quotaExceeded) return first;
    // Quota vol → maak ruimte vrij (oudste 300) en probeer één keer opnieuw,
    // zodat de cache niet permanent geblokkeerd raakt op "vol".
    await reclaimOldestBodies(instanceId, acct, 300);
    return await putOnce();
  } catch (e) {
    const quota = (e as DOMException)?.name === "QuotaExceededError";
    return { stored: false, quotaExceeded: quota };
  }
}

/** UID's van alle gecachte bodies in een map (voor fill-diff + teller). */
export async function getCachedBodyUids(
  instanceId: string,
  acct: string,
  folder: string,
): Promise<Set<number>> {
  const prefix = bodyPrefix(instanceId, acct, folder);
  try {
    const db = await openDb();
    return new Promise<Set<number>>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readonly");
      const req = tx.objectStore(BODY_STORE).getAllKeys();
      req.onsuccess = () => {
        const set = new Set<number>();
        for (const k of (req.result as string[]) || []) {
          if (k.startsWith(prefix)) {
            const uid = parseInt(k.slice(prefix.length), 10);
            if (Number.isFinite(uid)) set.add(uid);
          }
        }
        resolve(set);
      };
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

/** Totaal aantal gecachte bodies voor (instance, acct) — voor de status-chip. */
export async function countCachedBodies(instanceId: string, acct: string): Promise<number> {
  const prefix = bodyPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return new Promise<number>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readonly");
      const req = tx.objectStore(BODY_STORE).getAllKeys();
      req.onsuccess = () => resolve(((req.result as string[]) || []).filter((k) => k.startsWith(prefix)).length);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Geschatte opslaggrootte (bytes) van de gecachte bodies voor deze
 * (instance, acct). Som van de UTF-8 byte-lengte van elke geserialiseerde
 * record. Ruwe schatting (IndexedDB-overhead niet meegerekend), genoeg voor
 * een leesbare indicator in de instellingen.
 */
export async function sizeOfCachedBodies(instanceId: string, acct: string): Promise<number> {
  const prefix = bodyPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readonly");
      const store = tx.objectStore(BODY_STORE);
      let bytes = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) { resolve(bytes); return; }
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
          try { bytes += new Blob([JSON.stringify(cursor.value)]).size; } catch { /* skip */ }
        }
        cursor.continue();
      };
      req.onerror = () => resolve(bytes);
    });
  } catch {
    return 0;
  }
}

/**
 * Rollend venster: verwijder bodies met mailDate < cutoff (ms) voor deze
 * (instance, acct). Houdt de cache vers zonder onbeperkt te groeien.
 */
export async function evictBodiesOlderThan(
  instanceId: string,
  acct: string,
  cutoffMs: number,
): Promise<number> {
  const prefix = bodyPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      const store = tx.objectStore(BODY_STORE);
      let removed = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const key = cursor.key as string;
        const val = cursor.value as CachedBody;
        // Buiten venster óf een onbruikbare/ontbrekende datum (zou anders nooit
        // evicten en quota voor altijd bezetten).
        const md = val?.mailDate;
        if (key.startsWith(prefix) && (!Number.isFinite(md) || (md as number) < cutoffMs)) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}

/** Wis alle gecachte bodies voor (instance, acct). */
export async function clearMailBodies(instanceId: string, acct: string): Promise<void> {
  const prefix = bodyPrefix(instanceId, acct);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      const store = tx.objectStore(BODY_STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        for (const k of (req.result as string[]) || []) {
          if (k.startsWith(prefix)) store.delete(k);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Verwijder één gecachte body (bij verwijderen/verplaatsen van een mail). */
export async function deleteMailBody(instanceId: string, acct: string, folder: string, uid: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      tx.objectStore(BODY_STORE).delete(bodyKey(instanceId, acct, folder, uid));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/** Verwijder alle gecachte bodies van één map (bij map legen/verwijderen). */
export async function deleteFolderBodies(instanceId: string, acct: string, folder: string): Promise<void> {
  const prefix = bodyPrefix(instanceId, acct, folder);
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      const store = tx.objectStore(BODY_STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => { for (const k of (req.result as string[]) || []) if (k.startsWith(prefix)) store.delete(k); };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/**
 * Maak ruimte vrij door de N oudst-gecachte bodies (op `ts`) van (instance,acct)
 * te verwijderen. Gebruikt als reclaim wanneer de browser-quota vol is, zodat de
 * cache niet permanent "vol" blijft staan.
 */
export async function reclaimOldestBodies(instanceId: string, acct: string, n: number): Promise<number> {
  const prefix = bodyPrefix(instanceId, acct);
  try {
    const db = await openDb();
    const entries = await new Promise<Array<{ key: string; ts: number }>>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readonly");
      const store = tx.objectStore(BODY_STORE);
      const out: Array<{ key: string; ts: number }> = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result as IDBCursorWithValue | null;
        if (!c) return resolve(out);
        const k = c.key as string;
        if (k.startsWith(prefix)) out.push({ key: k, ts: (c.value as CachedBody)?.ts || 0 });
        c.continue();
      };
      req.onerror = () => resolve(out);
    });
    entries.sort((a, b) => a.ts - b.ts);
    const victims = entries.slice(0, Math.max(0, n));
    if (victims.length === 0) return 0;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(BODY_STORE, "readwrite");
      const store = tx.objectStore(BODY_STORE);
      for (const v of victims) store.delete(v.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return victims.length;
  } catch { return 0; }
}

/* ─── Bijlage-cache (lazy: cachen op openen/downloaden) ─── */

/** Lees een gecachte bijlage. Null als niet aanwezig. */
export async function readAttachment(
  instanceId: string, acct: string, folder: string, uid: number, index: number,
): Promise<CachedAttachment | null> {
  try {
    const db = await openDb();
    return await new Promise<CachedAttachment | null>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readonly");
      const req = tx.objectStore(ATT_STORE).get(attKey(instanceId, acct, folder, uid, index));
      req.onsuccess = () => resolve((req.result as CachedAttachment) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Persisteer een bijlage. Reclaimt bij volle quota de oudste 50 en probeert 1x opnieuw. */
export async function persistAttachment(
  instanceId: string, acct: string, folder: string, uid: number, index: number,
  blob: Blob, filename: string, contentType: string, mailDate: number,
): Promise<{ stored: boolean; quotaExceeded: boolean }> {
  const value: CachedAttachment = { blob, filename, contentType, mailDate, ts: Date.now() };
  const putOnce = async (): Promise<{ stored: boolean; quotaExceeded: boolean }> => {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(ATT_STORE, "readwrite");
      tx.objectStore(ATT_STORE).put(value, attKey(instanceId, acct, folder, uid, index));
      tx.oncomplete = () => resolve({ stored: true, quotaExceeded: false });
      tx.onerror = () => resolve({ stored: false, quotaExceeded: tx.error?.name === "QuotaExceededError" });
    });
  };
  try {
    const first = await putOnce();
    if (first.stored || !first.quotaExceeded) return first;
    await reclaimOldestAttachments(instanceId, acct, 50);
    return await putOnce();
  } catch (e) {
    return { stored: false, quotaExceeded: (e as DOMException)?.name === "QuotaExceededError" };
  }
}

/** Rollend venster: verwijder bijlages met mailDate < cutoff (of ongeldige datum). */
export async function evictAttachmentsOlderThan(
  instanceId: string, acct: string, cutoffMs: number,
): Promise<number> {
  const prefix = attPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readwrite");
      const store = tx.objectStore(ATT_STORE);
      let removed = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const key = cursor.key as string;
        const md = (cursor.value as CachedAttachment)?.mailDate;
        if (key.startsWith(prefix) && (!Number.isFinite(md) || (md as number) < cutoffMs)) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}

/**
 * Verwijder gecachte bijlages die LANGER dan `maxAgeMs` geleden zijn OPGEHAALD
 * (filtert op `ts` = cache-moment, niet op maildatum). Gebruikt op web voor de
 * 10-minuten-retentie: bijlages blijven lazy, maar een eenmaal opgehaalde
 * bijlage wordt na 10 min opgeruimd i.p.v. het hele mail-cache-venster te
 * volgen. Desktop gebruikt de maildatum-variant (evictAttachmentsOlderThan),
 * want daar worden bijlages bewust duurzaam mee-gecacht.
 */
export async function evictAttachmentsFetchedBefore(
  instanceId: string, acct: string, cutoffTs: number,
): Promise<number> {
  const prefix = attPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return await new Promise<number>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readwrite");
      const store = tx.objectStore(ATT_STORE);
      let removed = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) return;
        const key = cursor.key as string;
        const ts = (cursor.value as CachedAttachment)?.ts;
        if (key.startsWith(prefix) && (!Number.isFinite(ts) || (ts as number) < cutoffTs)) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}

/** Geschatte opslaggrootte (bytes) van de gecachte bijlages voor (instance, acct). */
export async function sizeOfCachedAttachments(instanceId: string, acct: string): Promise<{ bytes: number; count: number }> {
  const prefix = attPrefix(instanceId, acct);
  try {
    const db = await openDb();
    return await new Promise<{ bytes: number; count: number }>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readonly");
      const store = tx.objectStore(ATT_STORE);
      let bytes = 0, count = 0;
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result as IDBCursorWithValue | null;
        if (!cursor) { resolve({ bytes, count }); return; }
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
          const b = (cursor.value as CachedAttachment)?.blob;
          if (b && typeof b.size === "number") { bytes += b.size; count++; }
        }
        cursor.continue();
      };
      req.onerror = () => resolve({ bytes, count });
    });
  } catch {
    return { bytes: 0, count: 0 };
  }
}

/** Maak ruimte vrij door de N oudst-gecachte bijlages (op `ts`) te verwijderen. */
export async function reclaimOldestAttachments(instanceId: string, acct: string, n: number): Promise<number> {
  const prefix = attPrefix(instanceId, acct);
  try {
    const db = await openDb();
    const entries = await new Promise<Array<{ key: string; ts: number }>>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readonly");
      const store = tx.objectStore(ATT_STORE);
      const out: Array<{ key: string; ts: number }> = [];
      const req = store.openCursor();
      req.onsuccess = () => {
        const c = req.result as IDBCursorWithValue | null;
        if (!c) return resolve(out);
        const k = c.key as string;
        if (k.startsWith(prefix)) out.push({ key: k, ts: (c.value as CachedAttachment)?.ts || 0 });
        c.continue();
      };
      req.onerror = () => resolve(out);
    });
    entries.sort((a, b) => a.ts - b.ts);
    const victims = entries.slice(0, Math.max(0, n));
    if (victims.length === 0) return 0;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(ATT_STORE, "readwrite");
      const store = tx.objectStore(ATT_STORE);
      for (const v of victims) store.delete(v.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return victims.length;
  } catch { return 0; }
}

/** Wis ALLE mail-cache (alle stores, alle instances/accounts). Voor logout/vault-lock. */
export async function clearAllMailCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE, BODY_STORE, ATT_STORE], "readwrite");
      tx.objectStore(STORE).clear();
      tx.objectStore(BODY_STORE).clear();
      tx.objectStore(ATT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/**
 * Migreer bestaande localStorage-entries (webmail_msglist_cache_*) naar
 * IndexedDB. Idempotent — slaat entries over die al in IDB zitten.
 * Returns aantal gemigreerde folders.
 */
export async function migrateLocalStorageMailCache(
  instanceId: string,
  acct: string,
): Promise<{ migrated: number }> {
  const prefix = `webmail_msglist_cache_${instanceId}_${acct || ""}_`;
  let migrated = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const folder = key.slice(prefix.length);
    const existing = await readMailFolderCache(instanceId, acct, folder);
    if (existing) continue; // al in IDB, skip
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CachedFolder;
      if (!parsed?.messages || !Array.isArray(parsed.messages)) continue;
      await persistMailFolderCache(
        instanceId,
        acct,
        folder,
        parsed.messages,
        parsed.total ?? parsed.messages.length,
      );
      migrated++;
    } catch {
      // skip corrupte entry
    }
  }
  return { migrated };
}
