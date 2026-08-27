import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Settings, Mail, Eye } from "lucide-react";
import { getActiveInstanceId } from "../../lib/instances";
import { ensureMailConfigPushed, getImapConfig, buildQuery } from "../../lib/webmail-prefetch";
import type { Page } from "../../components/Sidebar";

/* ─── Types ─── */

interface MailAddress {
  name?: string;
  address?: string;
}

interface EmailMessage {
  uid: number;
  from: MailAddress[];
  subject: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  folder?: string;
}

const EMAIL_CATEGORIES = [
  { id: "belangrijk", nameKey: "webmail.category.important", dot: "bg-red-500" },
  { id: "werk", nameKey: "webmail.category.work", dot: "bg-blue-500" },
  { id: "persoonlijk", nameKey: "webmail.category.personal", dot: "bg-green-500" },
  { id: "financieel", nameKey: "webmail.category.financial", dot: "bg-amber-500" },
  { id: "actie", nameKey: "webmail.category.action_required", dot: "bg-purple-500" },
] as const;

/* ─── Preference helpers ─── */

function getWidgetPrefKey(): string {
  return `pref_${getActiveInstanceId()}_email_widget_filter`;
}

interface WidgetFilter {
  showUnread: boolean;
  tags: string[]; // category ids
}

function loadFilter(): WidgetFilter {
  try {
    const raw = localStorage.getItem(getWidgetPrefKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        showUnread: parsed.showUnread !== false,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }
  } catch { /* use default */ }
  return { showUnread: true, tags: [] };
}

function saveFilter(f: WidgetFilter) {
  localStorage.setItem(getWidgetPrefKey(), JSON.stringify(f));
}

function getCategoryMap(): Record<string, string> {
  try {
    const id = getActiveInstanceId();
    return JSON.parse(localStorage.getItem(`mail_categories_${id}`) || "{}");
  } catch { return {}; }
}

/* ─── Component ─── */

export function EmailWidget({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  const { t } = useTranslation();
  const config = getImapConfig();
  const configured = !!(config.host && config.user && (config.pass || config.authMode === "oauth2"));

  const [allMessages, setAllMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<WidgetFilter>(loadFilter);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  const fetchMessages = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError("");

    try {
      await ensureMailConfigPushed();
      const q = buildQuery(config, { folder: "INBOX", pageSize: "50" });
      const res = await fetch(`/api/mail/messages?${q}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const msgs: EmailMessage[] = (json?.data?.messages || []).map((m: any) => ({
        ...m,
        folder: "INBOX",
      }));
      setAllMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("dashboard.email_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [configured, config.user, config.host, t]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Apply filters
  const categoryMap = getCategoryMap();
  const filtered = allMessages.filter((msg) => {
    const catId = categoryMap[`${msg.folder || "INBOX"}:${msg.uid}`];
    const matchesUnread = filter.showUnread && !msg.seen;
    const matchesTag = filter.tags.length > 0 && catId && filter.tags.includes(catId);
    // If no filter is active, show nothing (user must pick at least one)
    if (!filter.showUnread && filter.tags.length === 0) return !msg.seen; // fallback: show unread
    return matchesUnread || matchesTag;
  });

  // Sort: unread first, then by date desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.seen !== b.seen) return a.seen ? 1 : -1;
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  }).slice(0, 8);

  function updateFilter(next: WidgetFilter) {
    setFilter(next);
    saveFilter(next);
  }

  function toggleTag(tagId: string) {
    const tags = filter.tags.includes(tagId)
      ? filter.tags.filter(t => t !== tagId)
      : [...filter.tags, tagId];
    updateFilter({ ...filter, tags });
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  function getCategoryDot(msg: EmailMessage): string | null {
    const catId = categoryMap[`${msg.folder || "INBOX"}:${msg.uid}`];
    if (!catId) return null;
    return EMAIL_CATEGORIES.find(c => c.id === catId)?.dot || null;
  }

  if (!configured) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={18} className="text-y-teal" />
          <span className="font-semibold text-slate-800">{t("dashboard.email")}</span>
        </div>
        <p className="text-sm text-slate-400 text-center py-4">{t("dashboard.email_setup_hint")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Mail size={18} className="text-y-teal" />
        <button
          onClick={() => onNavigate?.("webmail")}
          className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer"
        >
          {t("dashboard.email")} &rarr;
        </button>

        {/* Filter summary chips */}
        <div className="flex items-center gap-1 ml-auto">
          {filter.showUnread && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
              {t("dashboard.email_unread")}
            </span>
          )}
          {filter.tags.map(tagId => {
            const cat = EMAIL_CATEGORIES.find(c => c.id === tagId);
            if (!cat) return null;
            return (
              <span key={tagId} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                {t(cat.nameKey)}
              </span>
            );
          })}
        </div>

        {/* Settings button */}
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title={t("common.settings")}
          >
            <Settings size={14} />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-56">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">{t("dashboard.email_widget_show")}</div>

              {/* Unread toggle */}
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.showUnread}
                  onChange={() => updateFilter({ ...filter, showUnread: !filter.showUnread })}
                  className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
                />
                <Eye size={14} className="text-blue-500" />
                <span className="text-sm text-slate-700">{t("dashboard.email_unread")}</span>
              </label>

              <div className="border-t border-slate-100 my-1.5" />
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5">{t("dashboard.email_widget_tags")}</div>

              {/* Tag toggles */}
              {EMAIL_CATEGORIES.map(cat => (
                <label key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.tags.includes(cat.id)}
                    onChange={() => toggleTag(cat.id)}
                    className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
                  />
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.dot}`} />
                  <span className="text-sm text-slate-700">{t(cat.nameKey)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-y-teal" />
        </div>
      ) : error ? (
        <p className="text-center text-red-400 text-sm py-4">{error}</p>
      ) : sorted.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-4">{t("dashboard.no_messages")}</p>
      ) : (
        <div className="space-y-0.5">
          {sorted.map((msg) => {
            const dotClass = getCategoryDot(msg);
            return (
              <div
                key={msg.uid}
                className={`px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer ${!msg.seen ? "bg-blue-50/40" : ""}`}
                onClick={() => onNavigate?.("webmail")}
              >
                <div className="flex items-center gap-2">
                  {/* Category dot */}
                  {dotClass ? (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
                  ) : !msg.seen ? (
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-blue-500" />
                  ) : (
                    <span className="w-2 h-2 flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate flex-1 ${!msg.seen ? "font-semibold text-slate-800" : "text-slate-600"}`}>
                    {msg.from?.[0]?.name || msg.from?.[0]?.address || t("common.unknown")}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{formatDate(msg.date || "")}</span>
                </div>
                <p className={`text-sm truncate mt-0.5 ml-4 ${!msg.seen ? "font-medium text-slate-700" : "text-slate-500"}`}>
                  {msg.subject || t("dashboard.no_subject")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
