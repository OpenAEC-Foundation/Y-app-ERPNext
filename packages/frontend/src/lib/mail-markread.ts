/**
 * Optimistic mark-read TTL-Set (the `\Seen` STORE-race fix), extracted verbatim
 * from pages/Webmail.tsx. The mutable `recentLocallyMarkedRead` Map lives ONLY
 * here — never re-instantiate it elsewhere.
 */
import type { MailMessage } from "./webmail-prefetch";
import type { MailFolder } from "./mail-types";

// TTL-Set voor optimistic mark-read preservation. Tracks UIDs die in de
// laatste 60 s lokaal als gelezen zijn gemarkeerd (door
// applyOptimisticReadFlag bij open/handleMarkRead).
//
// Gebruikt door mini-merge in hydrate + mount-init + loadMessages om
// onderscheid te maken tussen TWEE scenario's:
//   1. Net gelezen + server STORE \Seen nog onderweg → fresh.seen=false is
//      race-artefact, lokaal seen=true moet preserve worden.
//   2. Vorige sessie / mark-as-unread vanuit andere client → fresh.seen=false
//      is de waarheid, server moet winnen.
//
// Zonder TTL preserveerde mini-merge ook stale mark-reads uit eerdere
// sessies (folderMsgCache module-level overleeft Webmail-unmount). Dat
// veroorzaakte discrepanties: cache zegt 7 unread, UI toont 1 bold (6
// uids waren ooit gelezen, niet recent).
export const RECENT_LOCAL_MARK_READ_TTL_MS = 60_000;
export const RECENT_MARK_READ_LS_KEY = "webmail_recent_mark_read";

export function loadRecentMarkReadMap(): Map<string, number> {
  try {
    const raw = localStorage.getItem(RECENT_MARK_READ_LS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    const m = new Map<string, number>();
    const now = Date.now();
    for (const [k, ts] of Object.entries(obj)) {
      if (now - ts < RECENT_LOCAL_MARK_READ_TTL_MS) m.set(k, ts);
    }
    return m;
  } catch {
    return new Map();
  }
}

export function saveRecentMarkReadMap(m: Map<string, number>): void {
  try {
    const obj: Record<string, number> = {};
    for (const [k, ts] of m) obj[k] = ts;
    localStorage.setItem(RECENT_MARK_READ_LS_KEY, JSON.stringify(obj));
  } catch { /* quota — niet kritiek */ }
}

// Persistent TTL-Set. Survives hot-reload, F5 en tab-switch. Bij elke
// trackLocalMarkRead-call wordt het naar localStorage gesynced. Stale
// entries (>60s) worden bij elke load gefilterd uit.
export const recentLocallyMarkedRead = loadRecentMarkReadMap();

export function isRecentLocalMarkRead(folder: string, uid: number): boolean {
  const key = `${folder}:${uid}`;
  const ts = recentLocallyMarkedRead.get(key);
  if (!ts) return false;
  if (Date.now() - ts > RECENT_LOCAL_MARK_READ_TTL_MS) {
    recentLocallyMarkedRead.delete(key);
    saveRecentMarkReadMap(recentLocallyMarkedRead);
    return false;
  }
  return true;
}

export function trackLocalMarkRead(folder: string, uid: number, seen: boolean): void {
  const key = `${folder}:${uid}`;
  if (seen) recentLocallyMarkedRead.set(key, Date.now());
  else recentLocallyMarkedRead.delete(key);
  saveRecentMarkReadMap(recentLocallyMarkedRead);
}

// Mini-merge: voor elke fresh-uid waar lokaal seen=true werd gemarkeerd
// binnen de laatste 60 s, preserve seen=true tegen mogelijk-niet-yet-
// gepropageerde server-state. Andere mails: vertrouw fresh (server).
export function applyRecentReadOverlay(fresh: MailMessage[], folder: string): MailMessage[] {
  return fresh.map(f => {
    if (!f.seen && isRecentLocalMarkRead(folder, f.uid)) {
      return { ...f, seen: true };
    }
    return f;
  });
}

// Tel aantal UIDs in TTL-Set voor een specifieke folder. Gebruikt om de
// server-side folder.unseen-count lokaal te corrigeren: server zegt 7
// ongelezen maar de gebruiker heeft 2 net gemarkeerd (\Seen STORE nog niet
// gepropageerd). De TTL-Set bevat 2 entries; effective unseen = 7-2 = 5.
// Zonder deze correctie zijn sidebar-badge (7) en panel-header (5) inconsistent.
export function countRecentLocalMarkReadInFolder(folder: string): number {
  let n = 0;
  const prefix = `${folder}:`;
  for (const [key, ts] of recentLocallyMarkedRead) {
    if (key.startsWith(prefix) && Date.now() - ts < RECENT_LOCAL_MARK_READ_TTL_MS) n++;
  }
  return n;
}

// Pas TTL-Set correctie toe op folder.unseen. Server-truth blijft de basis
// (folder.messages, folder.flags, etc), alleen unseen wordt verlaagd met
// recente lokale mark-reads die nog niet bij de server zijn aangekomen.
export function applyRecentReadOverlayToFolders(fresh: MailFolder[]): MailFolder[] {
  return fresh.map(f => {
    if (f.unseen === null || f.unseen === undefined) return f;
    const decrement = countRecentLocalMarkReadInFolder(f.path);
    if (decrement === 0) return f;
    return { ...f, unseen: Math.max(0, f.unseen - decrement) };
  });
}
