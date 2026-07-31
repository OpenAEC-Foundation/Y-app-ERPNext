/**
 * NAS storage utilities — File System Access API + IndexedDB handle persistence.
 *
 * Used by the "Opslaan op NAS" flow in Webmail to write mail attachments
 * directly from the browser to a local/network folder the user picked once.
 *
 * Threat model: handles live only on the user's device (IndexedDB). The Y-app
 * server has no knowledge of NAS paths or filesystem access — this is purely
 * client-side, by design (different devices need different drive letters).
 */

const DB_NAME = "y-app-nas";
const DB_VERSION = 1;
const STORE_HANDLES = "handles";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet<T>(store: string, key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(store: string, key: string, val: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/* ─── Public API ─── */

export function isFsaSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickNasRoot(): Promise<FileSystemDirectoryHandle> {
  // The cast is because TypeScript's lib.dom doesn't ship showDirectoryPicker
  // typings in some configurations; runtime check covers that.
  const picker = (window as unknown as {
    showDirectoryPicker: (opts: {
      mode?: "read" | "readwrite";
      startIn?: "documents" | "downloads" | "desktop";
    }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  return picker({ mode: "readwrite", startIn: "documents" });
}

function handleKey(instanceId: string, company: string): string {
  return `${instanceId}::${company}`;
}

export function getCompanyHandle(
  instanceId: string,
  company: string,
): Promise<FileSystemDirectoryHandle | null> {
  return idbGet<FileSystemDirectoryHandle>(STORE_HANDLES, handleKey(instanceId, company));
}

export function setCompanyHandle(
  instanceId: string,
  company: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  return idbPut(STORE_HANDLES, handleKey(instanceId, company), handle);
}

export function clearCompanyHandle(instanceId: string, company: string): Promise<void> {
  return idbDelete(STORE_HANDLES, handleKey(instanceId, company));
}

/**
 * Ensure we have readwrite permission on the handle. If the browser dropped
 * the grant (e.g. after restart), prompts the user. Must be called from a
 * user gesture (button click), otherwise the request silently fails.
 */
export async function ensureHandlePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const h = handle as FileSystemDirectoryHandle & {
    queryPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  if (!h.queryPermission || !h.requestPermission) return true; // permissions API missing → assume OK
  const current = await h.queryPermission({ mode: "readwrite" });
  if (current === "granted") return true;
  const next = await h.requestPermission({ mode: "readwrite" });
  return next === "granted";
}

/**
 * Walk into nested subdirectories, creating any that don't exist.
 * segments=["a","b","c"] starting from root returns the handle for root/a/b/c.
 */
export async function getOrCreateSubdir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of segments) {
    if (!seg) continue;
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  return dir;
}

/**
 * Find the next numeric prefix for a new subfolder. Scans existing child
 * directory names, parses leading digits, returns max+1. Empty dir → 1.
 */
export async function findNextNumber(dir: FileSystemDirectoryHandle): Promise<number> {
  let max = 0;
  // FileSystemDirectoryHandle is iterable in supported browsers
  const iter = (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)[
    Symbol.asyncIterator
  ]();
  while (true) {
    const next = await iter.next();
    if (next.done) break;
    const [name, h] = next.value;
    if (h.kind !== "directory") continue;
    const m = /^(\d+)/.exec(name);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

/**
 * Write a file into dir. If the filename already exists, appends " (1)",
 * " (2)", … before the extension until a free name is found. Returns the
 * actual filename used.
 */
export async function writeFileSafe(
  dir: FileSystemDirectoryHandle,
  filename: string,
  bytes: ArrayBuffer | Blob,
): Promise<string> {
  const finalName = await findFreeName(dir, filename);
  const fileHandle = await dir.getFileHandle(finalName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return finalName;
}

async function findFreeName(
  dir: FileSystemDirectoryHandle,
  filename: string,
): Promise<string> {
  if (!(await hasEntry(dir, filename))) return filename;
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!(await hasEntry(dir, candidate))) return candidate;
  }
  throw new Error("Could not find a free filename after 1000 attempts");
}

async function hasEntry(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name, { create: false });
    return true;
  } catch {
    // fall through to directory check
  }
  try {
    await dir.getDirectoryHandle(name, { create: false });
    return true;
  } catch {
    return false;
  }
}
