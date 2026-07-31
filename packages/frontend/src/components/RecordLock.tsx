import { useState, useEffect, useCallback, useRef } from "react";
import { Lock, Unlock } from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface LockEntry {
  recordType: string;
  recordId: string;
  lockedBy: string;
  lockedAt: number; // timestamp
  tabId: string;
}

interface RecordLockProps {
  recordType: string;  // e.g. "meeting-note", "letter"
  recordId: string;
  userName?: string;
  onLockChange?: (locked: boolean) => void;
}

/* ─── Constants ─── */

const LOCK_STORAGE_KEY = "record_locks";
const LOCK_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_MS = 30_000; // refresh lock every 30s
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ─── Helpers ─── */

function getAllLocks(): LockEntry[] {
  try {
    const raw = localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return [];
    const locks: LockEntry[] = JSON.parse(raw);
    // Prune expired locks
    const now = Date.now();
    return locks.filter((l) => now - l.lockedAt < LOCK_EXPIRY_MS);
  } catch {
    return [];
  }
}

function saveLocks(locks: LockEntry[]) {
  localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(locks));
}

function findLock(recordType: string, recordId: string): LockEntry | undefined {
  return getAllLocks().find(
    (l) => l.recordType === recordType && l.recordId === recordId
  );
}

/* ─── Component ─── */

export default function RecordLock({
  recordType,
  recordId,
  userName,
  onLockChange,
}: RecordLockProps) {
  const { t } = useTranslation();
  const resolvedUserName = userName || t("common.user");
  const [lock, setLock] = useState<LockEntry | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOwnLock = lock?.tabId === TAB_ID;

  /* Refresh lock state from storage */
  const refresh = useCallback(() => {
    const current = findLock(recordType, recordId);
    setLock(current ?? null);
  }, [recordType, recordId]);

  /* Acquire lock */
  const acquire = useCallback(() => {
    const existing = findLock(recordType, recordId);
    if (existing && existing.tabId !== TAB_ID && Date.now() - existing.lockedAt < LOCK_EXPIRY_MS) {
      // Someone else holds a valid lock
      return;
    }
    const locks = getAllLocks().filter(
      (l) => !(l.recordType === recordType && l.recordId === recordId)
    );
    const entry: LockEntry = {
      recordType,
      recordId,
      lockedBy: resolvedUserName,
      lockedAt: Date.now(),
      tabId: TAB_ID,
    };
    locks.push(entry);
    saveLocks(locks);
    setLock(entry);
    onLockChange?.(true);
  }, [recordType, recordId, resolvedUserName, onLockChange]);

  /* Release lock */
  const release = useCallback(() => {
    const locks = getAllLocks().filter(
      (l) => !(l.recordType === recordType && l.recordId === recordId && l.tabId === TAB_ID)
    );
    saveLocks(locks);
    setLock(null);
    onLockChange?.(false);
  }, [recordType, recordId, onLockChange]);

  /* Heartbeat: keep own lock alive */
  useEffect(() => {
    if (isOwnLock) {
      heartbeatRef.current = setInterval(() => {
        const locks = getAllLocks().map((l) => {
          if (l.recordType === recordType && l.recordId === recordId && l.tabId === TAB_ID) {
            return { ...l, lockedAt: Date.now() };
          }
          return l;
        });
        saveLocks(locks);
      }, HEARTBEAT_MS);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [isOwnLock, recordType, recordId]);

  /* Listen for storage changes from other tabs */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LOCK_STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);

  /* Initial load + periodic check */
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      // Release our lock when component unmounts
      const locks = getAllLocks().filter(
        (l) => !(l.recordType === recordType && l.recordId === recordId && l.tabId === TAB_ID)
      );
      saveLocks(locks);
    };
  }, [recordType, recordId]);

  /* ─── Render ─── */

  const isLocked = !!lock;
  const lockedByOther = isLocked && !isOwnLock;

  const timeAgo = lock
    ? (() => {
        const sec = Math.floor((Date.now() - lock.lockedAt) / 1000);
        if (sec < 60) return t("component_record_lock.seconds_ago", { sec });
        return t("component_record_lock.minutes_ago", { min: Math.floor(sec / 60) });
      })()
    : "";

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
        isLocked
          ? lockedByOther
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-amber-50 border-amber-200 text-amber-700"
          : "bg-green-50 border-green-200 text-green-700"
      }`}
    >
      {isLocked ? (
        <Lock size={14} />
      ) : (
        <Unlock size={14} />
      )}

      <span>
        {isLocked
          ? lockedByOther
            ? t("component_record_lock.locked_by_other", { user: lock.lockedBy, time: timeAgo })
            : t("component_record_lock.locked_by_you", { time: timeAgo })
          : t("component_record_lock.not_locked")}
      </span>

      {!isLocked && (
        <button
          onClick={acquire}
          className="ml-1 px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
        >
          {t("component_record_lock.lock")}
        </button>
      )}

      {isOwnLock && (
        <button
          onClick={release}
          className="ml-1 px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
        >
          {t("component_record_lock.unlock")}
        </button>
      )}

      {lockedByOther && (
        <button
          onClick={acquire}
          className="ml-1 px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
          title={t("component_record_lock.force_title")}
        >
          {t("component_record_lock.force")}
        </button>
      )}
    </div>
  );
}

export { TAB_ID };
export type { RecordLockProps, LockEntry };
