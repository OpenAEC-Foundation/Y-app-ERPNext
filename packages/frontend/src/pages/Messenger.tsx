import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import {
  MessageSquare, Send, Search, Users, Cloud,
  Bot, Phone, Shield, Loader2, AlertCircle, Paperclip, Smile,
  ChevronLeft, CheckCheck, Video, Layers, ThumbsUp, Pin,
  Plus, UserPlus, Reply, X, MoreVertical, Pencil, Trash2, AlertTriangle,
} from "lucide-react";
import { useEmployees } from "../lib/DataContext";
import { getActiveInstanceId } from "../lib/instances";
import { isDesktopApp } from "../lib/desktop";
import { setBadgeCount } from "../lib/badges";
import { useTranslation } from "react-i18next";
import ImageLightbox from "../components/ImageLightbox";
import { useBackgroundSync } from "../lib/BackgroundSyncProvider";
import { playNotificationSound as playMessageSound } from "../lib/notify-sound";
import {
  API_BASE,
  CONVO_CACHE_TTL,
  getConvoCache,
  setConvoCache,
  type Conversation,
} from "../lib/messenger-prefetch";

const API = import.meta.env.VITE_API || "";

/* ─── M4: Update document title met unread-counter ─── */
function setTitleUnread(count: number) {
  const base = "Y-app";
  document.title = count > 0 ? `(${count}) ${base}` : base;
}

/* ─── Types ─── */

interface Reaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  senderDisplayName: string;
  timestamp: string;
  isOwn: boolean;
  platform: string;
  messageType?: string;
  reactions?: Reaction[];
  attachments?: Array<{
    id: string;
    name: string;
    mimetype: string;
    size: number;
    link: string;
    previewUrl?: string;
  }>;
  /** M2: parent message info als dit een threaded reply is */
  parent?: { id: string; text: string; sender: string };
  /** Unix-seconds van laatste bewerking; toont "(bewerkt)" label */
  lastEditTimestamp?: number;
  /** True als NC Talk dit bericht als verwijderd rapporteert */
  deleted?: boolean;
}

const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️\s]{1,8}$/u;
function isEmojiOnlyReply(msg: Message): boolean {
  if (!msg.parent) return false;
  const trimmed = msg.text?.trim() || "";
  if (!trimmed) return false;
  return EMOJI_ONLY_RE.test(trimmed);
}

interface PlatformConfig {
  configured: boolean;
  label: string;
  color: string;
  bgColor: string;
  icon: typeof MessageSquare;
}

type Platform = "all" | "nextcloud-talk" | "ms-teams" | "telegram" | "whatsapp" | "signal";

/* ─── Platform metadata ─── */

const PLATFORMS: Record<Platform, PlatformConfig> = {
  all: { configured: true, label: "Alle", color: "text-slate-300", bgColor: "bg-slate-600", icon: Layers },
  "nextcloud-talk": { configured: false, label: "NextCloud Talk", color: "text-blue-500", bgColor: "bg-blue-500", icon: Cloud },
  "ms-teams": { configured: false, label: "MS Teams", color: "text-violet-500", bgColor: "bg-violet-500", icon: Video },
  telegram: { configured: false, label: "Telegram", color: "text-sky-500", bgColor: "bg-sky-500", icon: Bot },
  whatsapp: { configured: false, label: "WhatsApp", color: "text-green-500", bgColor: "bg-green-500", icon: Phone },
  signal: { configured: false, label: "Signal", color: "text-indigo-500", bgColor: "bg-indigo-500", icon: Shield },
};

const PLATFORM_LABEL_KEYS: Partial<Record<Platform, string>> = {
  all: "messenger.platform_all",
};

/* ─── Helpers ─── */

function getInstanceId() {
  return getActiveInstanceId();
}

function getPref(key: string): string {
  return localStorage.getItem(`pref_${getInstanceId()}_messenger_${key}`) || "";
}


interface BackendServices {
  nextcloud?: { url: string; user: string; pass: string } | null;
  telegram?: { token: string } | null;
  whatsapp?: { enabled: boolean } | null;
}

function getTeamsEmail(): string {
  // Use the mail user from vault or localStorage as the Teams identity
  return getPref("ms-teams_email") || localStorage.getItem(`pref_${getInstanceId()}_mail_user`) || "";
}

/**
 * Resolve NextCloud Talk credentials with proper Chinese-walls priority:
 * per-instance prefs first, server-wide env-var fallback last. The reverse
 * order leaks credentials across instance tabs (the bug that made Impertio
 * show 3BM's messages). Always go through this helper instead of inlining
 * the chain so a future regression can't reintroduce the leak.
 */
function getNextcloudCreds(backend: BackendServices = {}): { url: string; user: string; pass: string } {
  const id = getInstanceId();
  const url = getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || backend.nextcloud?.url || "";
  const user = getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || backend.nextcloud?.user || "";
  const pass = getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || backend.nextcloud?.pass || "";
  return { url, user, pass };
}

function getTelegramToken(backend: BackendServices = {}): string {
  return getPref("telegram_token") || backend.telegram?.token || "";
}

function buildQuery(platform: Platform, extra: Record<string, string> = {}, backend: BackendServices = {}): string {
  const params = new URLSearchParams({ platform, ...extra });

  // Wave 0a: NextCloud Talk credentials are pushed once over the
  // /ws/events WebSocket (subscribe-messenger / subscribe-conversation)
  // and stored server-side per (yAppSid, instanceId). HTTP routes
  // resolve them from cache, so we no longer send `url=&user=&pass=`
  // in every URL. Server keeps a backward-compat fallback for one
  // release in case a stale browser still emits them.
  if (platform === "telegram") {
    const token = getPref("telegram_token") || backend.telegram?.token;
    if (token) params.set("token", token);
  } else if (platform === "ms-teams") {
    params.set("email", getTeamsEmail());
  }

  return params.toString();
}

function isPlatformConfigured(platform: Platform, backend: BackendServices = {}): boolean {
  if (platform === "nextcloud-talk") {
    // Per-instance prefs first — only fall back to backend env-var creds when
    // the active instance has nothing of its own configured.
    const id = getInstanceId();
    const url = getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
    const user = getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
    const pass = getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
    if (url && user && pass) return true;
    return !!(backend.nextcloud?.url && backend.nextcloud?.user && backend.nextcloud?.pass);
  }
  if (platform === "ms-teams") return !!getTeamsEmail();
  if (platform === "all") return true;
  if (platform === "telegram") return !!(getPref("telegram_token") || backend.telegram?.token);
  if (platform === "whatsapp") return !!backend.whatsapp?.enabled;
  return false;
}

function formatTime(isoStr: string, yesterdayLabel: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) {
    return d.toLocaleDateString("nl-NL", { weekday: "short" });
  }
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatMessageTime(isoStr: string): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(isoStr: string, todayLabel: string, yesterdayLabel: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return yesterdayLabel;
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name
    .split(/[\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  "bg-orange-500", "bg-pink-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── Dev mock data ─── */

const DEV_MOCK_CONVO: Conversation = {
  id: "dev-test-room",
  name: "Dev Test Conversatie",
  platform: "nextcloud-talk",
  unreadCount: 0,
  participants: 2,
  type: "group",
  lastMessage: "Test met bijlagen",
  lastMessageTime: new Date().toISOString(),
};

// Small inline PNG (1x1 teal pixel) as data URI — no network needed
// 100x100 teal block for dev testing
const DEV_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%2345B6A8'/%3E%3Ctext x='10' y='55' font-size='12' fill='white'%3EIMG TEST%3C/text%3E%3C/svg%3E";

const DEV_MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    text: "Hoi, ik stuur een screenshot",
    sender: "jochem",
    senderDisplayName: "Jochem",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    isOwn: false,
    platform: "nextcloud-talk",
  },
  {
    id: "2",
    text: "",
    sender: "jochem",
    senderDisplayName: "Jochem",
    timestamp: new Date(Date.now() - 50000).toISOString(),
    isOwn: false,
    platform: "nextcloud-talk",
    attachments: [
      {
        id: "101",
        name: "screenshot.png",
        mimetype: "image/png",
        size: 45678,
        link: DEV_IMG,
        previewUrl: DEV_IMG,
      },
    ],
  },
  {
    id: "3",
    text: "En een PDF document",
    sender: "piet",
    senderDisplayName: "Piet",
    timestamp: new Date(Date.now() - 30000).toISOString(),
    isOwn: true,
    platform: "nextcloud-talk",
    attachments: [
      {
        id: "102",
        name: "Berekening_2024-0142.pdf",
        mimetype: "application/pdf",
        size: 123456,
        link: "#",
      },
    ],
  },
  {
    id: "4",
    text: "Nog een afbeelding (jpg)",
    sender: "piet",
    senderDisplayName: "Piet",
    timestamp: new Date(Date.now() - 10000).toISOString(),
    isOwn: true,
    platform: "nextcloud-talk",
    attachments: [
      {
        id: "103",
        name: "foto.jpg",
        mimetype: "image/jpeg",
        size: 89012,
        link: DEV_IMG,
        previewUrl: DEV_IMG,
      },
    ],
  },
];

/* ─── Per-conversation localStorage cache (stale-while-revalidate) ───
 *
 * Was eerst alleen in-memory (`messagesCacheRef`) — bij page-refresh leeg en
 * elke conversation-open kostte ~500 ms-2 s voordat berichten zichtbaar
 * waren. Gevolg: scroll-to-bottom-effect omdat berichten in twee batches
 * binnenkomen (eerste fetch + polling/long-poll), en de tweede batch landt
 * pas nadat de smooth-scroll van de eerste batch al gestart is.
 *
 * Met localStorage cache: bij heropenen instant alle laatste berichten op
 * scherm, scroll-to-bottom op de complete set, daarna onzichtbaar revalidate.
 *
 * LRU-cap op 30 conversations × max ~50 messages = worst case ~750 KB.
 * Per message ~500 bytes (sender, text, timestamp, attachments-meta).
 */
const MESSENGER_CONV_CACHE_MAX = 30;
const MESSENGER_CONV_CACHE_TTL = 5 * 60_000; // 5 min
function _messengerCacheKey(instanceId: string, convId: string): string {
  return `messenger_msgs_${instanceId}_${convId}`;
}
function _messengerIndexKey(instanceId: string): string {
  return `messenger_msgs_index_${instanceId}`;
}
function readConversationMessageCache(
  instanceId: string,
  convId: string,
): { messages: Message[]; hasMore: boolean; ts: number } | null {
  try {
    const raw = localStorage.getItem(_messengerCacheKey(instanceId, convId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.ts || Date.now() - parsed.ts > MESSENGER_CONV_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}
function persistConversationMessageCache(
  instanceId: string,
  convId: string,
  messages: Message[],
  hasMore: boolean,
): void {
  try {
    const key = _messengerCacheKey(instanceId, convId);
    // Houd alleen de laatste 50 berichten — meer is overkill voor scroll-to-bottom-UX
    // en voorkomt grote localStorage-payloads bij chats met honderden berichten.
    const recent = messages.slice(-50);
    localStorage.setItem(key, JSON.stringify({ messages: recent, hasMore, ts: Date.now() }));
    const indexKey = _messengerIndexKey(instanceId);
    let index: string[] = [];
    try {
      index = JSON.parse(localStorage.getItem(indexKey) || "[]");
      if (!Array.isArray(index)) index = [];
    } catch {
      index = [];
    }
    index = index.filter((id) => id !== convId);
    index.push(convId);
    while (index.length > MESSENGER_CONV_CACHE_MAX) {
      const evict = index.shift();
      if (evict) {
        try {
          localStorage.removeItem(_messengerCacheKey(instanceId, evict));
        } catch {
          /* ignore */
        }
      }
    }
    localStorage.setItem(indexKey, JSON.stringify(index));
  } catch {
    /* quota of andere storage-fout */
  }
}

/* ─── Component ─── */

export default function Messenger() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const employees = useEmployees();
  const [activePlatform, setActivePlatform] = useState<Platform>("all");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const devMockActive = useRef(false);
  const [devMockEnabled, setDevMockEnabled] = useState(false);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Guards the NextCloud Talk long-poll loop. Without this, the loop kicks
  // off the instant `selectedConvo` changes — before `loadMessages` has
  // populated the message list — and the first iteration fires with no
  // `lastKnownMessageId`, which NC Talk treats as "send the whole chat
  // history as if it just arrived" → playMessageSound() + Notification +
  // scroll fire for every batch. Set true after the initial load completes,
  // reset to false on conversation switch.
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false);
  // In-memory cache van messages per conversatie zodat conv-switch instant
  // is — bij heropenen wordt direct de oude lijst getoond en daarna in de
  // achtergrond gerevalideerd. WS-push merged sowieso nieuwe berichten in,
  // dus stale-while-revalidate is veilig binnen normale TTL.
  const messagesCacheRef = useRef<Map<string, { messages: Message[]; ts: number; hasMore: boolean }>>(new Map());
  const MESSAGES_CACHE_TTL = 60_000; // 1 min — push-events vullen sowieso aan
  const [messageInput, setMessageInput] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [creatingChat, setCreatingChat] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addPartSearch, setAddPartSearch] = useState("");
  // Multi-file paste/picker — een bericht kan meerdere bijlagen tegelijk
  // bevatten. Volgorde = volgorde van plakken/picken.
  const [pastedFiles, setPastedFiles] = useState<{ file: File; preview?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // M2: actieve "reply to" parent — voor threaded replies in NextCloud Talk
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  // Edit-mode: als !== null vult send-knop een edit i.p.v. nieuwe message
  const [editingMessage, setEditingMessage] = useState<{ id: string; originalText: string } | null>(null);
  // Open 3-dot menu per bericht-id
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // True zodra het laden van berichten > ~5s duurt → toont een "trage
  // verbinding / berichten laden nog" waarschuwing i.p.v. een lege weergave.
  const [slowLoading, setSlowLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  // §5/§14: BackgroundSync subscribe/unsubscribe voor NC Talk long-poll
  // events. Wanneer een gesprek geopend wordt, abonneren we op WS-push;
  // bij sluiten/wisselen unsubscriben we zodat de server-side long-poll
  // stopt en geen resources blijft slokken.
  const { subscribeConversation, unsubscribeConversation } = useBackgroundSync();
  // Trage-verbinding waarschuwing: als het laden van berichten > 5s duurt, toon
  // een hint. Reset zodra het laden klaar is.
  useEffect(() => {
    if (!loadingMessages) { setSlowLoading(false); return; }
    const timer = setTimeout(() => setSlowLoading(true), 5000);
    return () => clearTimeout(timer);
  }, [loadingMessages]);
  // M2: highlight + scroll-to-message wanneer gebruiker op een quoted-reply klikt
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  // §9: fullscreen image lightbox state. Replaces "open in new tab" voor
  // images zodat de gebruiker niet uit de chat-flow geduwd wordt.
  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string; downloadUrl?: string } | null>(null);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      // Bericht zit niet in de huidige geladen geschiedenis — eventueel kunnen
      // we later loadOlderMessages triggeren, voor nu een korte toast.
      console.warn(`[Messenger] Quoted message ${messageId} not in view`);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMsgId(messageId);
    window.setTimeout(() => {
      setHighlightedMsgId(prev => (prev === messageId ? null : prev));
    }, 2000);
  }, []);

  // Backend service credentials (from vault)
  const [backendServices, setBackendServices] = useState<{
    nextcloud?: { url: string; user: string; pass: string } | null;
    telegram?: { token: string } | null;
    whatsapp?: { enabled: boolean } | null;
  }>({});

  // Load service credentials from backend on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/services`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setBackendServices(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // M4: Vraag eenmalig browser-notification permission
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // M4: Clear tab-title bij component-unmount
  useEffect(() => () => setTitleUnread(0), []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const convoPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Mirror of `messages` for reading the latest list synchronously inside the
  // long-poll loop (detecting genuinely-new incoming messages) without adding
  // `messages` to that effect's dependency array.
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Conversations recently marked read this session: convId → { readId, ts }.
  // `readId` is the raw NC id we told the server to mark read up to. Used to
  // suppress a stale unread count that NC hasn't propagated yet, WITHOUT hiding
  // a genuinely newer message (lastMessageId > readId → keep the badge).
  const recentlyReadRef = useRef<Map<string, { readId: number; ts: number }>>(new Map());
  const RECENT_READ_TTL_MS = 30_000;
  // Signature of the last conversation list we pushed to state — skip redundant
  // setConversations when a poll returns byte-identical data (kills the visible
  // "refresh"/flicker on every 15s poll and every messenger-changed push).
  const lastConvosSigRef = useRef<string>("");

  /**
   * Force unreadCount to 0 for conversations we just read, until NC catches up.
   * Precise: only suppresses when no message newer than what we read arrived
   * (`lastMessageId <= readId`). A genuinely new message drops the overlay so
   * the badge stays honest. Falls back to a plain TTL suppression when the
   * server didn't supply `lastMessageId` (e.g. non-NC platforms / desktop).
   */
  const applyReadOverlay = useCallback((convos: Conversation[]): Conversation[] => {
    const now = Date.now();
    for (const [id, e] of recentlyReadRef.current) {
      if (now - e.ts > RECENT_READ_TTL_MS) recentlyReadRef.current.delete(id);
    }
    if (recentlyReadRef.current.size === 0) return convos;
    return convos.map((c) => {
      const e = recentlyReadRef.current.get(c.id);
      if (!e) return c;
      const lastId = typeof c.lastMessageId === "number" ? c.lastMessageId : undefined;
      if (lastId === undefined || lastId <= e.readId) {
        return c.unreadCount ? { ...c, unreadCount: 0 } : c;
      }
      // Something newer than what we read has arrived — stop overlaying.
      recentlyReadRef.current.delete(c.id);
      return c;
    });
  }, []);

  /**
   * Mark a conversation read: record the overlay, optimistically zero the badge,
   * and persist to the server with the newest raw id (`lastReadMessage`) so NC's
   * read marker actually advances — the root fix for the badge coming back.
   */
  const markConversationRead = useCallback((convo: Conversation, readUpTo?: number | string) => {
    const readId = typeof readUpTo === "string" ? parseInt(readUpTo, 10) : readUpTo;
    const hasReadId = typeof readId === "number" && Number.isFinite(readId) && readId > 0;
    if (hasReadId) recentlyReadRef.current.set(convo.id, { readId: readId as number, ts: Date.now() });
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === convo.id ? { ...c, unreadCount: 0 } : c));
      const totalUnread = next.reduce((s, c) => s + (c.unreadCount || 0), 0);
      setBadgeCount("messenger", totalUnread);
      setTitleUnread(totalUnread);
      return next;
    });
    const { url: ncUrl, user: ncUser, pass: ncPass } = getNextcloudCreds(backendServices);
    const tgToken = getTelegramToken(backendServices);
    fetch(`${API}/api/messenger/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: convo.platform,
        conversation: convo.id,
        ...(hasReadId ? { lastReadMessage: readId } : {}),
        ...(convo.platform === "nextcloud-talk"
          ? { url: ncUrl, user: ncUser, pass: ncPass }
          : {}),
        ...(convo.platform === "telegram" ? { token: tgToken } : {}),
        ...(convo.platform === "ms-teams" ? { email: getTeamsEmail() } : {}),
      }),
    }).catch(() => {});
  }, [backendServices]);

  /* ─── Scroll to bottom (skip when loading older messages — M6) ─── */
  useEffect(() => {
    // M6: reset de ref hier (na render+paint), niet in de rAF van loadOlderMessages.
    // Anders is de ref al `false` tegen de tijd dat deze useEffect loopt → scroll springt alsnog naar onder.
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      return;
    }
    const end = messagesEndRef.current;
    if (!end) return;
    // Instant i.p.v. smooth: een smooth-animatie landt te hoog wanneer
    // afbeeldingen ná de scroll async inladen en de content-hoogte groeit
    // (probleem in web én desktop). Scroll meteen én nog een paar keer terwijl
    // de hoogte settelt, zodat we echt op het laatste bericht eindigen.
    const toBottom = () => end.scrollIntoView({ behavior: "auto", block: "end" });
    toBottom();
    const timers = [80, 250, 600].map((ms) => window.setTimeout(toBottom, ms));
    return () => timers.forEach((tid) => window.clearTimeout(tid));
  }, [messages]);

  /* ─── Load conversations ─── */
  const loadConversations = useCallback(async (silent = false) => {
    if (devMockActive.current) return; // dev mock active — skip real fetch
    if (!isPlatformConfigured(activePlatform, backendServices)) return;

    // Use prefetch cache on first load for "all" platform.
    // NB: read PER-INSTANCE so 3BM's cache never surfaces on Impertio.
    const cacheSnapshot = getConvoCache();
    if (!silent && activePlatform === "all" && cacheSnapshot.data && Date.now() - cacheSnapshot.ts < CONVO_CACHE_TTL) {
      setConversations(cacheSnapshot.data);
      return;
    }

    // B04: Hydrate from localStorage if no in-memory cache (stale-while-revalidate)
    if (!silent && activePlatform === "all" && !cacheSnapshot.data) {
      try {
        const instanceId = getInstanceId();
        const cached = localStorage.getItem(`messenger_convos_${instanceId}`);
        if (cached) {
          const data = JSON.parse(cached);
          if (data.ts && Date.now() - data.ts < 5 * 60 * 1000) { // 5 min TTL
            setConvoCache(data.data, instanceId);
            setConversations(data.data);
            // Continue to fetch in background (don't return)
          }
        }
      } catch { /* ignore */ }
    }

    if (!silent) setLoading(true);
    setError("");
    try {
      let resp: globalThis.Response;
      if (activePlatform === "all") {
        // Wave 0a: NC creds zitten server-side in cache (via WS
        // subscribe-messenger / subscribe-conversation), niet meer in URL.
        // Wel sturen we nog tg-token + teams-email mee — die hebben nog
        // geen WS-subscribe-pad.
        const params = new URLSearchParams();
        const tgToken = getTelegramToken(backendServices);
        if (tgToken) params.set("token", tgToken);
        const teamsEmail = getTeamsEmail();
        if (teamsEmail) {
          params.set("email", teamsEmail);
        }
        resp = await fetch(`${API}/api/messenger/all-conversations?${params.toString()}`);
      } else {
        const qs = buildQuery(activePlatform, {}, backendServices);
        resp = await fetch(`${API}/api/messenger/conversations?${qs}`);
      }
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.load_conversations_error"));
      if (json.config && !json.data?.length) {
        setConversations([]);
      } else {
        // Apply the local read-overlay so a conversation we just opened doesn't
        // flip its unread badge back on for the ~seconds NC needs to propagate
        // our mark-read (the "counter keeps coming back" complaint).
        const convos = applyReadOverlay(json.data || []);
        // Update sidebar badge + tab title from the overlaid list.
        const totalUnread = convos.reduce((s: number, c: Conversation) => s + (c.unreadCount || 0), 0);
        setBadgeCount("messenger", totalUnread);
        setTitleUnread(totalUnread); // M4: tab-titel toont (N) Y-app
        // Only re-render the list when something actually changed. A byte-
        // identical poll result (every 15s, and on every messenger-changed
        // push) otherwise re-runs setConversations → the visible refresh/flicker.
        const sig = convos
          .map((c) => `${c.id}:${c.unreadCount}:${c.lastMessageTime}:${c.lastMessage}:${c.pinned ? 1 : 0}`)
          .join("|");
        if (sig !== lastConvosSigRef.current) {
          lastConvosSigRef.current = sig;
          setConversations(convos);
        }
        if (activePlatform === "all") {
          const instanceId = getInstanceId();
          setConvoCache(convos, instanceId);
          // B04: Persist to localStorage for stale-while-revalidate on reload
          try {
            localStorage.setItem(`messenger_convos_${instanceId}`, JSON.stringify({ data: convos, ts: Date.now() }));
          } catch { /* quota exceeded, ignore */ }
        }
      }
    } catch (err) {
      if (!silent) setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activePlatform, backendServices, applyReadOverlay]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Poll conversations every 15s
  useEffect(() => {
    if (convoPollerRef.current) clearInterval(convoPollerRef.current);
    if (isPlatformConfigured(activePlatform, backendServices)) {
      convoPollerRef.current = setInterval(() => loadConversations(true), 15000);
    }
    return () => {
      if (convoPollerRef.current) clearInterval(convoPollerRef.current);
    };
  }, [activePlatform, loadConversations]);

  /* ─── Load messages (initial load or poll for new) ─── */
  const loadMessages = useCallback(async (convo: Conversation, silent = false) => {
    if (import.meta.env.DEV && convo.id === "dev-test-room") return; // skip fetch for dev mock
    // Cache-hit pad: bij niet-silent (= user opent convo) zien we eerst de
    // lokale cache zodat de UI direct iets toont. Daarna lopen we door naar
    // de echte fetch en vervangen de lijst met verse data.
    if (!silent) {
      const cached = messagesCacheRef.current.get(convo.id);
      if (cached && Date.now() - cached.ts < MESSAGES_CACHE_TTL) {
        setMessages(cached.messages);
        setHasMoreMessages(cached.hasMore);
        setInitialMessagesLoaded(true);
        // Continue async revalidate i.p.v. spinner tonen.
        silent = true; // behandel rest als silent refresh
      } else {
        // Geen in-memory cache (verse browser-load): probeer localStorage
        // zodat scroll-to-bottom direct op de juiste positie staat in plaats
        // van halverwege te eindigen wanneer de tweede batch later binnenkomt.
        try {
          const persisted = readConversationMessageCache(getInstanceId(), convo.id);
          if (persisted && persisted.messages.length > 0) {
            setMessages(persisted.messages);
            setHasMoreMessages(persisted.hasMore);
            setInitialMessagesLoaded(true);
            silent = true; // revalidate in achtergrond, geen spinner
          } else {
            setLoadingMessages(true);
          }
        } catch {
          setLoadingMessages(true);
        }
      }
    }
    try {
      const qs = buildQuery(convo.platform as Platform, { conversation: convo.id }, backendServices);
      const resp = await fetch(`${API}/api/messenger/messages?${qs}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.load_messages_error"));
      const freshMessages: Message[] = json.data || [];
      // Highest raw NC id in this batch (incl. filtered reaction/system rows) —
      // the id we tell the server to mark read up to. Falls back to the newest
      // visible message id when the server didn't send lastGivenId.
      const readUpTo: number | string | undefined =
        typeof json.lastGivenId === "number" && json.lastGivenId > 0
          ? json.lastGivenId
          : freshMessages.length > 0
            ? freshMessages[freshMessages.length - 1].id
            : undefined;
      // Detect genuinely-new incoming (non-own) messages vs the currently
      // rendered list, so we can re-mark the OPEN conversation read below
      // (outside the setMessages updater).
      const beforeIds = new Set(messagesRef.current.map((m) => m.id));
      const incomingNew = freshMessages.filter((m) => !beforeIds.has(m.id) && !m.isOwn);
      // Update memory cache zodat volgende open instant is.
      messagesCacheRef.current.set(convo.id, {
        messages: freshMessages,
        ts: Date.now(),
        hasMore: !!json.hasMore,
      });
      // Persist naar localStorage zodat verse browser-loads ook instant cache-hits.
      // LRU-cap 30 conversations × max 50 berichten = worst case ~750 KB.
      persistConversationMessageCache(getInstanceId(), convo.id, freshMessages, !!json.hasMore);

      if (silent) {
        // Polling: merge new messages into existing list (keep older loaded messages)
        setMessages(prev => {
          if (prev.length === 0) return freshMessages;
          const existingIds = new Set(prev.map(m => m.id));
          const newOnly = freshMessages.filter(m => !existingIds.has(m.id));
          if (newOnly.length > 0) {
            // M4: notificatie + geluid bij inkomende berichten (niet eigen berichten)
            const incoming = newOnly.filter(m => !m.isOwn);
            if (incoming.length > 0) {
              playMessageSound();
              if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") {
                const last = incoming[incoming.length - 1];
                try {
                  const n = new Notification(last.senderDisplayName || t("messenger.new_message_notification"), {
                    body: last.text || t("messenger.attachment"),
                    icon: "/favicon.svg",
                    tag: `y-app-msg-${convo.id}`,
                  });
                  n.onclick = () => {
                    try { window.focus(); } catch { /* ignore */ }
                    try { if (window.location.pathname !== "/messenger") window.location.assign("/messenger"); } catch { /* ignore */ }
                    try { n.close(); } catch { /* ignore */ }
                  };
                } catch { /* notification blocked */ }
              }
            }
            return [...prev, ...newOnly];
          }
          return prev;
        });
      } else {
        // Initial load: replace all
        setMessages(freshMessages);
        setHasMoreMessages(!!json.hasMore);
        // Signal the long-poll loop that it has a valid baseline to poll
        // from (or an explicit empty-chat). Without this the loop would
        // fire with `latestId = ""` and NC Talk re-emits the whole history.
        setInitialMessagesLoaded(true);
      }

      // Mark as read — optimistic badge clear + server persist (with the newest
      // raw id so NC's read marker actually advances; see markConversationRead).
      // - Initial open: mark when the conversation shows unread.
      // - Silent revalidate/poll: mark when a new incoming message arrived while
      //   the conversation is open, otherwise the badge would flip back on for
      //   the very message the user is looking at.
      if (!silent) {
        if (convo.unreadCount > 0) markConversationRead(convo, readUpTo);
      } else if (incomingNew.length > 0) {
        markConversationRead(convo, readUpTo);
      }
    } catch (err) {
      if (!silent) setError((err as Error).message);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [backendServices, markConversationRead]);

  /* ─── Load older messages ─── */
  const loadOlderMessages = useCallback(async (convo: Conversation) => {
    if (loadingMore || !hasMoreMessages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestId = messages[0].id;
      const qs = buildQuery(convo.platform as Platform, { conversation: convo.id, before: oldestId }, backendServices);
      const resp = await fetch(`${API}/api/messenger/messages?${qs}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.load_messages_error"));
      const olderMessages: Message[] = json.data || [];
      setHasMoreMessages(!!json.hasMore);
      if (olderMessages.length > 0) {
        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        loadingOlderRef.current = true;
        setMessages(prev => [...olderMessages, ...prev]);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }
          // M6: ref-reset gebeurt nu in de scroll-to-bottom useEffect (na paint), niet hier.
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [backendServices, loadingMore, hasMoreMessages, messages]);

  // Poll messages while a conversation is open.
  // - NextCloud Talk uses long-polling via `lookIntoFuture=1` so new messages
  //   arrive within ~1s instead of every 5s. The server holds the request
  //   open for up to 30s, returning early when something new appears.
  // - Other platforms still poll every 5s.
  useEffect(() => {
    if (msgPollerRef.current) clearInterval(msgPollerRef.current);
    if (!selectedConvo) return;

    // §5/§14: subscribe op WS push voor NC Talk-conversaties zodat ook
    // andere browser-tabs (popout, dashboard met sidebar-badge) direct
    // weten dat er een nieuw bericht is. De server start een long-poll
    // tegen NC Talk's lookIntoFuture=1 endpoint.
    if (selectedConvo.platform === "nextcloud-talk") {
      const creds = getNextcloudCreds(backendServices);
      if (creds.url && creds.user && creds.pass) {
        subscribeConversation(selectedConvo.id, creds);
      }
    }

    if (selectedConvo.platform !== "nextcloud-talk") {
      msgPollerRef.current = setInterval(() => loadMessages(selectedConvo, true), 5000);
      return () => {
        if (msgPollerRef.current) clearInterval(msgPollerRef.current);
      };
    }

    // Long-poll must NOT start until the initial loadMessages has populated
    // the list (or confirmed an empty chat). Otherwise the first iteration
    // has `latestId = ""`, NC Talk treats the whole chat history as new,
    // and every batch fires playMessageSound() / Notification / scroll.
    // The effect re-runs as soon as initialMessagesLoaded flips true.
    if (!initialMessagesLoaded) return;

    // ─── NextCloud Talk long-poll loop ───
    let cancelled = false;
    let aborter: AbortController | null = null;
    let backoffMs = 0;
    // Highest NC message id we've already polled through — INCLUDING reaction/
    // system rows the server filtered out of `data`. NC Talk emits a reaction
    // (👍/❤️) as its own message with an id past the last visible bubble; the
    // server strips it, so `data` comes back empty. If we kept polling from the
    // last *visible* id we'd re-fetch that same reaction event forever, in a
    // tight loop (the "berichten blijft laden" storm). The server now returns
    // `lastGivenId` (max raw id incl. filtered rows) so we can advance past it.
    let polledThrough = 0;
    const POLL_MIN_SPACING_MS = 1000;
    (async () => {
      while (!cancelled) {
        const iterationStart = Date.now();
        // Resolve the latest visible message ID at iteration time so a message
        // the user just sent also advances the cursor.
        const latestVisibleId = await new Promise<string>((resolve) => {
          setMessages((prev) => {
            resolve(prev.length > 0 ? prev[prev.length - 1].id : "");
            return prev;
          });
        });
        // Poll from whichever is higher: the last visible bubble, or the last
        // raw id the server told us about (which may be a filtered reaction).
        const cursorNum = Math.max(parseInt(latestVisibleId || "0", 10) || 0, polledThrough);
        const cursor = cursorNum > 0 ? String(cursorNum) : "";
        try {
          aborter = new AbortController();
          const baseQs = buildQuery(selectedConvo.platform as Platform, { conversation: selectedConvo.id }, backendServices);
          const url = `${API}/api/messenger/messages?${baseQs}&lookIntoFuture=1${cursor ? `&lastKnownMessageId=${encodeURIComponent(cursor)}` : ""}`;
          const resp = await fetch(url, { signal: aborter.signal });
          if (cancelled) break;
          if (!resp.ok) {
            // 5xx / network blip — backoff and retry.
            backoffMs = Math.min((backoffMs || 1000) * 2, 30_000);
            await new Promise(r => setTimeout(r, backoffMs));
            continue;
          }
          backoffMs = 0;
          const json = await resp.json();
          if (typeof json.lastGivenId === "number" && json.lastGivenId > polledThrough) {
            polledThrough = json.lastGivenId;
          }
          const fresh: Message[] = json.data || [];
          if (fresh.length === 0) {
            // Defense-in-depth: even if a server/NC edge case keeps returning
            // an empty batch instantly, never spin faster than once per second.
            const elapsed = Date.now() - iterationStart;
            if (elapsed < POLL_MIN_SPACING_MS) {
              await new Promise(r => setTimeout(r, POLL_MIN_SPACING_MS - elapsed));
            }
          }
          if (fresh.length > 0) {
            // Detect incoming (non-own) messages against the rendered list so we
            // can re-mark the OPEN conversation read after the updater — the user
            // is actively viewing it, so a new message must not resurrect the badge.
            const beforeIds = new Set(messagesRef.current.map(m => m.id));
            const incomingWhileOpen = fresh.filter(m => !beforeIds.has(m.id) && !m.isOwn);
            setMessages(prev => {
              const existing = new Set(prev.map(m => m.id));
              const newOnly = fresh.filter(m => !existing.has(m.id));
              if (newOnly.length === 0) return prev;
              const incoming = newOnly.filter(m => !m.isOwn);
              if (incoming.length > 0) {
                playMessageSound();
                if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") {
                  const last = incoming[incoming.length - 1];
                  try {
                    const n = new Notification(last.senderDisplayName || t("messenger.new_message_notification"), {
                      body: last.text || t("messenger.attachment"),
                      icon: "/favicon.svg",
                      tag: `y-app-msg-${selectedConvo.id}`,
                    });
                    n.onclick = () => {
                      try { window.focus(); } catch { /* ignore */ }
                      try { if (window.location.pathname !== "/messenger") window.location.assign("/messenger"); } catch { /* ignore */ }
                      try { n.close(); } catch { /* ignore */ }
                    };
                  } catch { /* notification blocked */ }
                }
              }
              return [...prev, ...newOnly];
            });
            if (incomingWhileOpen.length > 0) {
              markConversationRead(selectedConvo, polledThrough || json.lastGivenId);
            }
          }
        } catch (e) {
          if (cancelled) break;
          // AbortError on unmount/conversation-switch: exit silently.
          if ((e as Error)?.name === "AbortError") break;
          backoffMs = Math.min((backoffMs || 1000) * 2, 30_000);
          await new Promise(r => setTimeout(r, backoffMs));
        }
      }
    })();

    return () => {
      cancelled = true;
      aborter?.abort();
      // §5/§14: unsubscribe WS-push voor deze conversatie zodat de server-
      // side long-poll vrijkomt wanneer we wisselen of de pagina sluiten.
      if (selectedConvo && selectedConvo.platform === "nextcloud-talk") {
        unsubscribeConversation(selectedConvo.id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConvo, initialMessagesLoaded, loadMessages, backendServices, t, subscribeConversation, unsubscribeConversation]);

  /* ─── Send message (text only) ─── */
  async function sendText(text: string, replyTo?: string): Promise<void> {
    if (!selectedConvo || !text) return;
    const body: Record<string, string> = {
      platform: selectedConvo.platform,
      conversation: selectedConvo.id,
      message: text,
    };
    if (replyTo) body.replyTo = replyTo;
    // Use the Chinese-walls helpers so per-instance prefs always win over
    // server-wide env-var fallback. Reverting to the inline chain (env-var
    // first) is what made Impertio see 3BM's messages — don't undo this.
    if (selectedConvo.platform === "nextcloud-talk") {
      const creds = getNextcloudCreds(backendServices);
      body.url = creds.url;
      body.user = creds.user;
      body.pass = creds.pass;
    } else if (selectedConvo.platform === "telegram") {
      body.token = getTelegramToken(backendServices);
    } else if (selectedConvo.platform === "ms-teams") {
      body.email = getTeamsEmail();
    }

    const resp = await fetch(`${API}/api/messenger/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || t("webmail.send_error"));
  }

  async function handleSend() {
    if (!messageInput.trim() || !selectedConvo || sending) return;
    setSending(true);
    try {
      const text = messageInput.trim();
      if (editingMessage) {
        await sendEdit(editingMessage.id, text);
        setMessages(prev => prev.map(m =>
          m.id === editingMessage.id
            ? { ...m, text, lastEditTimestamp: Math.floor(Date.now() / 1000) }
            : m
        ));
        setEditingMessage(null);
      } else {
        await sendText(text, replyingTo?.id);
        setReplyingTo(null);
      }
      setMessageInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await loadMessages(selectedConvo, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function sendEdit(messageId: string, newText: string) {
    if (!selectedConvo) return;
    const body: Record<string, unknown> = {
      platform: selectedConvo.platform,
      conversation: selectedConvo.id,
      messageId,
      message: newText,
    };
    if (selectedConvo.platform === "nextcloud-talk") {
      const creds = getNextcloudCreds(backendServices);
      body.url = creds.url;
      body.user = creds.user;
      body.pass = creds.pass;
    }
    const resp = await fetch(`${API}/api/messenger/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || t("messenger.edit_failed"));
  }

  function startEdit(msg: Message) {
    setReplyingTo(null);
    setEditingMessage({ id: msg.id, originalText: msg.text });
    setMessageInput(msg.text);
    setOpenActionMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditingMessage(null);
    setMessageInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  async function handleDelete(msg: Message) {
    if (!selectedConvo) return;
    setOpenActionMenu(null);
    if (!window.confirm(t("messenger.confirm_delete"))) return;
    try {
      const body: Record<string, unknown> = {
        platform: selectedConvo.platform,
        conversation: selectedConvo.id,
        messageId: msg.id,
      };
      if (selectedConvo.platform === "nextcloud-talk") {
        const creds = getNextcloudCreds(backendServices);
        body.url = creds.url;
        body.user = creds.user;
        body.pass = creds.pass;
      }
      const resp = await fetch(`${API}/api/messenger/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.delete_failed"));
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, text: "", attachments: undefined, deleted: true, messageType: "comment_deleted" }
          : m
      ));
      await loadMessages(selectedConvo, true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /* ─── React to message ─── */
  async function handleReact(msg: Message, emoji = "\u{1F44D}") {
    if (!selectedConvo) return;
    const existing = msg.reactions?.find(r => r.emoji === emoji);
    const remove = existing?.userReacted === true;

    try {
      const body: Record<string, unknown> = {
        platform: selectedConvo.platform,
        conversation: selectedConvo.id,
        messageId: msg.id,
        reaction: emoji,
        remove,
      };
      if (selectedConvo.platform === "nextcloud-talk") {
        const creds = getNextcloudCreds(backendServices);
        body.url = creds.url;
        body.user = creds.user;
        body.pass = creds.pass;
      }

      await fetch(`${API}/api/messenger/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Optimistic update
      setMessages(prev => prev.map(m => {
        if (m.id !== msg.id) return m;
        const reactions = [...(m.reactions || [])];
        const idx = reactions.findIndex(r => r.emoji === emoji);
        if (remove) {
          if (idx >= 0) {
            reactions[idx] = { ...reactions[idx], count: Math.max(0, reactions[idx].count - 1), userReacted: false };
            if (reactions[idx].count === 0) reactions.splice(idx, 1);
          }
        } else {
          if (idx >= 0) {
            reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userReacted: true };
          } else {
            reactions.push({ emoji, count: 1, userReacted: true });
          }
        }
        return { ...m, reactions: reactions.length > 0 ? reactions : undefined };
      }));
    } catch (err) {
      console.error("[Messenger] React failed:", err);
    }
  }

  /* ─── Select conversation ─── */
  function handleSelectConvo(convo: Conversation) {
    setSelectedConvo(convo);
    setMessages([]);
    setHasMoreMessages(false);
    setMobileShowChat(true);
    setReplyingTo(null); // M2: clear reply context bij wisselen
    setInitialMessagesLoaded(false); // long-poll wacht tot initial load klaar is
    loadMessages(convo);
  }

  /* ─── Auto-resize textarea ─── */
  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessageInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (pastedFiles.length > 0) {
        handleUploadFile();
      } else {
        handleSend();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newFiles: { file: File; preview?: string }[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        newFiles.push({ file, preview: URL.createObjectURL(file) });
      }
    }
    if (newFiles.length > 0) {
      e.preventDefault();
      setPastedFiles(prev => [...prev, ...newFiles]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const items = files.map(file => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setPastedFiles(prev => [...prev, ...items]);
    e.target.value = "";
  }

  function removePastedFile(idx: number) {
    setPastedFiles(prev => {
      const removed = prev[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function clearAllPastedFiles() {
    pastedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setPastedFiles([]);
  }

  /** M1+M3+M5: upload bestanden (elke type, meerdere tegelijk) en optioneel meegestuurde tekst als caption. */
  async function handleUploadFile() {
    if (pastedFiles.length === 0 || !selectedConvo || uploading) return;
    if (selectedConvo.platform !== "nextcloud-talk") {
      setError(t("messenger.upload_only_nc_talk"));
      return;
    }
    setUploading(true);
    setSending(true);
    try {
      // Per-instance creds first (Chinese walls) — env-var fallback last.
      const creds = getNextcloudCreds(backendServices);

      // Caption + replyTo komen op het LAATSTE plaatje (talkMetaData), zodat
      // we geen losse text-message daarna meer hoeven te sturen. NC Talk
      // protocol kent één file per message, dus N plaatjes = N bubbles. De
      // caption hangt visueel aan de laatste bubble (zoals WhatsApp/Slack).
      const caption = messageInput.trim();

      for (let i = 0; i < pastedFiles.length; i++) {
        const pf = pastedFiles[i];
        const isLast = i === pastedFiles.length - 1;
        const buffer = await pf.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let j = 0; j < bytes.length; j += 8192) {
          binary += String.fromCharCode(...bytes.subarray(j, j + 8192));
        }
        const base64 = btoa(binary);
        const fileName = pf.file.name && pf.file.name !== "image.png"
          ? pf.file.name
          : `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${pf.file.type.split("/")[1] || "png"}`;
        const body: Record<string, string> = {
          platform: "nextcloud-talk",
          conversation: selectedConvo.id,
          fileData: base64,
          fileName,
          mimeType: pf.file.type || "application/octet-stream",
          url: creds.url, user: creds.user, pass: creds.pass,
        };
        // Alleen op het laatste plaatje: caption + replyTo. NC Talk 19+ rendert
        // de caption als bijschrift in dezelfde message bubble als het plaatje.
        if (isLast) {
          if (caption) body.caption = caption;
          if (replyingTo?.id) body.replyTo = replyingTo.id;
        }
        const resp = await fetch(`${API}/api/messenger/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || t("messenger.upload_failed"));
      }

      if (caption) {
        setMessageInput("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
      clearAllPastedFiles();
      setReplyingTo(null);
      await loadMessages(selectedConvo, true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setSending(false);
    }
  }

  /* ─── Filter & sort conversations (pinned first, then by last activity) ─── */
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return conversations
      .filter((c) => c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const ta = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const tb = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return tb - ta;
      });
  }, [conversations, searchQuery]);

  /* ─── Group messages by date ─── */
  /* ─── Filter employees voor "Nieuw gesprek"-panel (memoized: triggert
     elke keystroke in newChatSearch, lijst is potentieel 50-200 medewerkers). ─── */
  const filteredEmployees = useMemo(() => {
    const q = newChatSearch.toLowerCase();
    return employees
      .filter((e) => e.status === "Active" && (e.user_id || e.company_email))
      .filter((e) => !q || e.employee_name.toLowerCase().includes(q) || (e.user_id || "").toLowerCase().includes(q))
      .slice(0, 15);
  }, [employees, newChatSearch]);

  const activeMessages = devMockEnabled ? DEV_MOCK_MESSAGES : messages;
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    for (const msg of activeMessages) {
      const d = msg.timestamp ? new Date(msg.timestamp).toDateString() : "unknown";
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: msg.timestamp, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [activeMessages]);

  const configured = isPlatformConfigured(activePlatform, backendServices);

  return (
    <div className="h-full flex bg-slate-100">
      {/* ─── Left sidebar: conversation list ─── */}
      {/* Conversation list: w-80 op desktop ALTIJD (geen chat open vs.
          chat open ALLEEN scheelt of de chat-area rechts zichtbaar is).
          Vroeger zat hier `flex-1 md:w-80` — flex-grow:1 overheerst de
          width zodat de lijst uitrekte naar ~650px op een 1500px scherm.
          `w-full md:w-80` is het juiste idiom: vol op mobiel, vast 320px
          op md+, en de chat-area krijgt `flex-1` voor de rest. */}
      <div className={`bg-white border-r border-slate-200 flex-col w-full md:w-80 md:flex-shrink-0 ${mobileShowChat ? "hidden md:flex" : "flex"}`}>
        {/* Platform tabs */}
        <div className="p-3 border-b border-slate-200 bg-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg font-bold text-white">{t("messenger.messages_title")}</h1>
              {loading && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap">
                  <Loader2 size={11} className="animate-spin" /> {t("messenger.syncing")}
                </span>
              )}
            </div>
            <button onClick={() => setShowNewChat(true)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer" title={t("messenger.new_conversation")}>
              <Plus size={18} />
            </button>
          </div>
          <div className="flex gap-1">
            {(Object.entries(PLATFORMS) as [Platform, PlatformConfig][]).map(([key, p]) => {
              const Icon = p.icon;
              const active = activePlatform === key;
              const isConfigured = isPlatformConfigured(key, backendServices);
              return (
                <button
                  key={key}
                  onClick={() => { setActivePlatform(key); setSelectedConvo(null); setMessages([]); setMobileShowChat(false); }}
                  className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-slate-700 text-white"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                  }`}
                  title={PLATFORM_LABEL_KEYS[key] ? t(PLATFORM_LABEL_KEYS[key]!) : p.label}
                >
                  <div className="relative">
                    <Icon size={18} />
                    {isConfigured && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
                    )}
                  </div>
                  <span className="truncate w-full text-center" style={{ fontSize: "10px" }}>{(PLATFORM_LABEL_KEYS[key] ? t(PLATFORM_LABEL_KEYS[key]!) : p.label).split(" ").pop()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sidebar.global_search") + "..."}
              className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-0"
            />
          </div>
        </div>

        {/* New conversation panel */}
        {showNewChat && (
          <div className="border-b border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{t("messenger.new_conversation")}</span>
              <button onClick={() => { setShowNewChat(false); setNewChatSearch(""); }} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
            </div>
            <input type="text" value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)}
              placeholder={t("messenger.search_colleague")} autoFocus
              className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-0" />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredEmployees.map((emp) => (
                  <button key={emp.name} type="button"
                    disabled={creatingChat}
                    onClick={async () => {
                      setCreatingChat(true);
                      try {
                        const ncUrl = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_url`) || "";
                        const ncUser = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_user`) || "";
                        const ncPass = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_pass`) || "";
                        const res = await fetch(`${API}/api/messenger/create-conversation`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            ncUrl, user: ncUser, pass: ncPass,
                            roomType: 1,
                            invite: emp.user_id?.split("@")[0] || emp.company_email?.split("@")[0] || emp.employee_name,
                          }),
                        });
                        const data = await res.json().catch(() => null) as { ok?: boolean; conversation?: { id: string }; error?: string } | null;
                        if (!res.ok || !data?.ok || !data.conversation) {
                          setError(data?.error || t("messenger.create_conversation_failed"));
                          return;
                        }
                        setShowNewChat(false);
                        setNewChatSearch("");
                        await loadConversations(false);
                        const found = conversations.find((c) => c.id === data.conversation!.id);
                        if (found) setSelectedConvo(found);
                      } catch (err) {
                        setError((err as Error).message || t("messenger.create_conversation_failed"));
                      } finally { setCreatingChat(false); }
                    }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded cursor-pointer disabled:opacity-50"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {emp.employee_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{emp.employee_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{emp.user_id || emp.company_email}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {!configured && (
            <div className="p-6 text-center space-y-3">
              <div className="p-3 bg-slate-100 rounded-xl inline-block">
                <AlertCircle size={32} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">
                {activePlatform === "whatsapp" || activePlatform === "signal"
                  ? t("messenger.platform_not_available", { platform: PLATFORMS[activePlatform].label })
                  : activePlatform === "ms-teams"
                  ? t("messenger.teams_setup_hint")
                  : t("messenger.configure_platform_hint", { platform: PLATFORMS[activePlatform].label })}
              </p>
              <p className="text-xs text-slate-400 mt-1">{t("messenger.setup_hint")}</p>
            </div>
          )}
          {import.meta.env.DEV && (
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={() => {
                  devMockActive.current = true;
                  setDevMockEnabled(true);
                  if (convoPollerRef.current) clearInterval(convoPollerRef.current);
                  if (msgPollerRef.current) clearInterval(msgPollerRef.current);
                  setConversations([DEV_MOCK_CONVO]);
                  setSelectedConvo(DEV_MOCK_CONVO);
                  setMessages(DEV_MOCK_MESSAGES);
                  setMobileShowChat(true);
                }}
                className="w-full px-3 py-1.5 text-xs bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 cursor-pointer border border-violet-200"
              >
                [DEV] Test bijlagen
              </button>
            </div>
          )}

          {configured && loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          )}

          {configured && !loading && error && (
            <div className="p-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {configured && !loading && !error && filtered.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-400">{t("messenger.no_conversations")}</p>
            </div>
          )}

          {filtered.map((convo) => {
            const active = selectedConvo?.id === convo.id;
            const PIcon = PLATFORMS[convo.platform as Platform]?.icon || MessageSquare;
            return (
              <button
                key={convo.id}
                onClick={() => {
                  // Direct openen — géén 250ms defer meer (die blokkeerde élke
                  // open, ook cache-hits). Net als de mail-lijst: een dubbelklik
                  // opent daarnaast een popout; dat het gesprek dan ook in dit
                  // tabblad opent is prima (zelfde gedrag als Webmail).
                  handleSelectConvo(convo);
                }}
                onDoubleClick={() => {
                  // Desktop (Tauri): window.open naar een interne route navigeert
                  // de ene webview wég ("gaat terug"); open dan in het huidige paneel.
                  // Pop-out: open conversation in standalone tab (web) of een
                  // echt popout-venster (desktop, via y-app:open-popout).
                  const q = new URLSearchParams({ convo: convo.id, platform: convo.platform, name: convo.name });
                  const instId = getActiveInstanceId();
                  if (instId && instId !== "default") q.set("instance", instId);
                  if (isDesktopApp()) {
                    window.dispatchEvent(new CustomEvent("y-app:open-popout", {
                      detail: { route: `/messenger/view?${q.toString()}`, title: convo.name || "Y-app — chat" },
                    }));
                    return;
                  }
                  window.open(`/messenger/view?${q.toString()}`, "_blank", "noopener");
                }}
                title={t("messenger.dblclick_to_popout", "Dubbelklik om in nieuw tabblad te openen")}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b border-slate-100 ${
                  active ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor(convo.name)}`}>
                  {getInitials(convo.name)}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-800 truncate flex items-center gap-1">
                      {convo.pinned && <Pin size={10} className="text-y-teal flex-shrink-0" />}
                      {convo.name}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(convo.lastMessageTime, t("messenger.yesterday"))}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 truncate">{convo.lastMessage || "\u00A0"}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <PIcon size={10} className={PLATFORMS[convo.platform as Platform]?.color || "text-slate-400"} />
                      {convo.unreadCount > 0 && (
                        <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Right pane: messages ─── */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileShowChat ? (isMobile ? "fixed inset-0 z-40 bg-white pt-[env(safe-area-inset-top,0px)]" : "flex") : "hidden md:flex"}`}>
        {!selectedConvo ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <div className="p-4 bg-slate-200/50 rounded-2xl inline-block">
                <MessageSquare size={48} className="text-slate-300" />
              </div>
              <p className="text-slate-400 text-sm">{t("messenger.select_conversation")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => { setMobileShowChat(false); }}
                className="md:hidden p-2 hover:bg-slate-700 rounded cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColor(selectedConvo.name)}`}>
                {getInitials(selectedConvo.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-sm truncate">{selectedConvo.name}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {selectedConvo.participants > 0 && (
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {t("messenger.participants_count", { count: selectedConvo.participants })}
                    </span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PLATFORMS[selectedConvo.platform as Platform]?.bgColor || "bg-slate-600"} text-white`}>
                    {PLATFORM_LABEL_KEYS[selectedConvo.platform as Platform]
                      ? t(PLATFORM_LABEL_KEYS[selectedConvo.platform as Platform]!)
                      : (PLATFORMS[selectedConvo.platform as Platform]?.label || selectedConvo.platform)}
                  </span>
                </div>
              </div>
              {/* Add participant button (group chats) */}
              {selectedConvo.type === "group" && selectedConvo.platform === "nextcloud-talk" && (
                <button onClick={() => setShowAddParticipant(!showAddParticipant)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg cursor-pointer flex-shrink-0" title={t("messenger.add_participant")}>
                  <UserPlus size={18} />
                </button>
              )}
            </div>

            {/* Add participant dropdown */}
            {showAddParticipant && (
              <div className="border-b border-slate-200 bg-white p-3 space-y-2">
                <input type="text" value={addPartSearch} onChange={(e) => setAddPartSearch(e.target.value)}
                  placeholder={t("messenger.search_colleague")} autoFocus
                  className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-0" />
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {employees
                    .filter((e) => e.status === "Active" && (e.user_id || e.company_email))
                    .filter((e) => !addPartSearch || e.employee_name.toLowerCase().includes(addPartSearch.toLowerCase()))
                    .slice(0, 10)
                    .map((emp) => (
                      <button key={emp.name} type="button"
                        onClick={async () => {
                          const ncUrl = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_url`) || "";
                          const ncUser = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_user`) || "";
                          const ncPass = localStorage.getItem(`pref_${getActiveInstanceId()}_messenger_nextcloud-talk_pass`) || "";
                          await fetch(`${API}/api/messenger/add-participant`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ncUrl, user: ncUser, pass: ncPass,
                              conversation: selectedConvo!.id,
                              userId: emp.user_id?.split("@")[0] || emp.company_email?.split("@")[0] || emp.employee_name,
                            }),
                          });
                          setShowAddParticipant(false);
                          setAddPartSearch("");
                        }}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-bold">
                          {emp.employee_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-700 truncate">{emp.employee_name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Messages area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-slate-100 px-4 py-3">
              {loadingMessages && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={20} className="animate-spin" /> {t("messenger.loading_messages")}
                  </div>
                  {slowLoading && (
                    <div className="mt-4 max-w-sm flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700">
                      <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                      <span>{t("common.slow_loading_warning")}</span>
                    </div>
                  )}
                </div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-slate-400">{t("messenger.no_messages_in_convo")}</p>
                </div>
              )}

              {!loadingMessages && hasMoreMessages && selectedConvo && (
                <div className="flex items-center justify-center py-3">
                  <button
                    onClick={() => loadOlderMessages(selectedConvo)}
                    disabled={loadingMore}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white hover:bg-slate-50 rounded-full shadow-sm border border-slate-200 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t("common.loading")}</span>
                    ) : (
                      t("messenger.load_older_messages", "Laad oudere berichten")
                    )}
                  </button>
                </div>
              )}

              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-white rounded-full text-[11px] text-slate-500 font-medium shadow-sm">
                      {formatDateHeader(group.date, t("messenger.today"), t("messenger.yesterday"))}
                    </span>
                  </div>
                  {/* Messages — consecutive messages from the same sender are
                       visually bundled: only the first in a bundle shows the
                       avatar + name; the rest get tight spacing and a 8px
                       gutter to keep horizontal alignment with the bundle.
                       Timestamps stay on every bubble per user request. */}
                  {group.messages.map((msg, idx, arr) => {
                    // Defense-in-depth: emoji-only quoted replies zijn al
                    // server-side gefilterd, maar oude browser-cache kan ze nog
                    // bevatten. Stilte verbergen — het origineel-bericht en
                    // de native reaction-pil tonen de duimpje al.
                    if (isEmojiOnlyReply(msg)) return null;
                    const isContinuation = idx > 0 && arr[idx - 1].sender === msg.sender;
                    const isHighlighted = highlightedMsgId === msg.id;
                    const isDeleted = msg.deleted || msg.messageType === "comment_deleted";
                    return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex ${isContinuation ? "mb-0.5" : "mb-3"} ${msg.isOwn ? "justify-end" : "justify-start"} ${isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 rounded-xl transition-shadow duration-500" : "transition-shadow duration-500"}`}
                    >
                      {!msg.isOwn && (
                        isContinuation ? (
                          // Empty gutter so bubble stays aligned with the bundle.
                          <div className="w-8 mr-2 flex-shrink-0" aria-hidden />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold mr-2 mt-1 flex-shrink-0 ${avatarColor(msg.senderDisplayName)}`}>
                            {getInitials(msg.senderDisplayName)}
                          </div>
                        )
                      )}
                      <div className={`max-w-[85%] md:max-w-[70%] group`}>
                        {!msg.isOwn && !isContinuation && (
                          <span className="text-[10px] text-slate-500 font-medium ml-1 mb-0.5 block">
                            {msg.senderDisplayName}
                          </span>
                        )}
                        <div className="relative">
                          <div
                            className={`px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                              isDeleted
                                ? msg.isOwn
                                  ? "bg-emerald-500/30 text-emerald-50 italic rounded-2xl rounded-br-sm ml-12"
                                  : "bg-slate-100 text-slate-500 italic rounded-2xl rounded-bl-sm"
                                : msg.isOwn
                                  ? "bg-emerald-500 text-white rounded-2xl rounded-br-sm ml-12"
                                  : "bg-white text-slate-800 rounded-2xl rounded-bl-sm"
                            }`}
                          >
                            {/* M2: parent-preview voor threaded replies — klikbaar scroll naar origineel */}
                            {msg.parent && !isDeleted && (
                              <button
                                type="button"
                                onClick={() => scrollToMessage(msg.parent!.id)}
                                className={`mb-1.5 pl-2 border-l-2 text-xs truncate text-left w-full hover:bg-black/5 rounded-r transition-colors cursor-pointer ${msg.isOwn ? "border-emerald-200 text-emerald-50" : "border-slate-300 text-slate-500"}`}
                                title={t("messenger.scroll_to_original", "Spring naar origineel bericht")}
                              >
                                <div className="font-medium">{msg.parent.sender}</div>
                                <div className="truncate opacity-80">{msg.parent.text || t("messenger.attachment")}</div>
                              </button>
                            )}
                            {isDeleted ? (
                              <p className="whitespace-pre-wrap break-words">{t("messenger.deleted_placeholder")}</p>
                            ) : (
                              msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            )}
                            {!isDeleted && msg.attachments?.map((att) => (
                              <div key={att.id} className="mt-2">
                                {att.mimetype?.startsWith("image/") && att.previewUrl ? (
                                  (() => {
                                    // file-proxy zit in de auth-whitelist (img-tags kunnen
                                    // geen X-Y-App-Instance header sturen). Server leest
                                    // de instance daarom uit ?instance=NN query param.
                                    const instParam = `&instance=${encodeURIComponent(getInstanceId())}`;
                                    const fullUrl = att.link.startsWith("data:")
                                      ? att.link
                                      : `${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.link)}&${buildQuery(selectedConvo!.platform as Platform, {}, backendServices)}${instParam}`;
                                    const previewUrl = att.previewUrl!.startsWith("data:")
                                      ? att.previewUrl!
                                      : `${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.previewUrl!)}&${buildQuery(selectedConvo!.platform as Platform, {}, backendServices)}${instParam}`;
                                    return (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          // Desktop: att.link is een 300px data:-thumb (geen img-proxy
                                          // in de webview) — haal lazy de full-size preview op via Rust.
                                          let url = fullUrl;
                                          if (isDesktopApp() && att.id) {
                                            try {
                                              const r = await fetch(`/api/messenger/full-image?fileId=${encodeURIComponent(att.id)}`);
                                              if (r.ok) {
                                                const j = await r.json();
                                                if (j.url) url = j.url;
                                              }
                                            } catch { /* fallback: thumb */ }
                                          }
                                          setLightboxImage({ url, filename: att.name, downloadUrl: url });
                                        }}
                                        className="block cursor-pointer"
                                        title={att.name}
                                      >
                                        <img
                                          src={previewUrl}
                                          alt={att.name}
                                          loading="lazy"
                                          decoding="async"
                                          className="max-w-[280px] rounded-lg"
                                        />
                                      </button>
                                    );
                                  })()
                                ) : (
                                  <a
                                    href={att.link.startsWith("data:") || att.link === "#" ? att.link : `${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.link)}&${buildQuery(selectedConvo!.platform as Platform, {}, backendServices)}&instance=${encodeURIComponent(getInstanceId())}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 p-2 bg-slate-100/50 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    <Paperclip size={14} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-xs text-blue-600 underline truncate">{att.name}</span>
                                    <span className="text-[10px] text-slate-400 flex-shrink-0">{formatFileSize(att.size)}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                            <div className={`flex items-center justify-end gap-1 mt-1 ${msg.isOwn ? "text-emerald-100" : "text-slate-400"}`}>
                              {!isDeleted && msg.lastEditTimestamp && (
                                <span className="text-[10px] italic opacity-80" title={new Date(msg.lastEditTimestamp * 1000).toLocaleString()}>
                                  {t("messenger.edited")}
                                </span>
                              )}
                              <span className="text-[10px]">{formatMessageTime(msg.timestamp)}</span>
                              {msg.isOwn && !isDeleted && <CheckCheck size={12} />}
                            </div>
                          </div>
                          {/* Action buttons — appear on hover. Side depends on isOwn (eigen berichten links, anders rechts) */}
                          {!isDeleted && (
                          <div className={`absolute ${msg.isOwn ? "-left-20" : "-right-20"} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                            <button
                              onClick={() => handleReact(msg)}
                              className={`p-1 rounded-full hover:bg-slate-200 cursor-pointer ${
                                msg.reactions?.some(r => r.emoji === "\u{1F44D}" && r.userReacted) ? "!opacity-100 text-blue-500" : "text-slate-400"
                              }`}
                              title={t("messenger.like")}
                            >
                              <ThumbsUp size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setReplyingTo({ id: msg.id, text: msg.text, sender: msg.senderDisplayName });
                                setEditingMessage(null);
                                textareaRef.current?.focus();
                              }}
                              className="p-1 rounded-full hover:bg-slate-200 cursor-pointer text-slate-400"
                              title={t("messenger.reply")}
                            >
                              <Reply size={14} />
                            </button>
                            {msg.isOwn && (
                              <div className="relative">
                                <button
                                  onClick={() => setOpenActionMenu(openActionMenu === msg.id ? null : msg.id)}
                                  className="p-1 rounded-full hover:bg-slate-200 cursor-pointer text-slate-400"
                                  title={t("messenger.more_actions")}
                                >
                                  <MoreVertical size={14} />
                                </button>
                                {openActionMenu === msg.id && (
                                  <>
                                    <button
                                      type="button"
                                      className="fixed inset-0 z-10 cursor-default"
                                      onClick={() => setOpenActionMenu(null)}
                                      aria-label="close menu"
                                    />
                                    <div className={`absolute z-20 ${msg.isOwn ? "right-0" : "left-0"} top-7 min-w-[140px] bg-white border border-slate-200 rounded-lg shadow-lg py-1`}>
                                      <button
                                        onClick={() => startEdit(msg)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 text-left cursor-pointer"
                                      >
                                        <Pencil size={12} />
                                        <span>{t("messenger.edit")}</span>
                                      </button>
                                      <button
                                        onClick={() => handleDelete(msg)}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 text-left cursor-pointer"
                                      >
                                        <Trash2 size={12} />
                                        <span>{t("messenger.delete")}</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          )}
                          {/* Reactions display */}
                          {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                            <div className={`flex gap-1 mt-1 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                              {msg.reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  onClick={() => handleReact(msg, r.emoji)}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                                    r.userReacted
                                      ? "bg-blue-100 border border-blue-300 text-blue-700"
                                      : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  <span>{r.emoji}</span>
                                  {r.count > 1 && <span className="text-[10px] font-medium">{r.count}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-end gap-2 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0 mb-0.5"
                title={t("messenger.attachment")}
              >
                <Paperclip size={20} />
              </button>
              <div className="flex-1 relative">
                {/* M2: Reply-context banner */}
                {replyingTo && (
                  <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <Reply size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-blue-700">{t("messenger.replying_to")}: {replyingTo.sender}</div>
                      <div className="text-xs text-slate-600 truncate">{replyingTo.text || t("messenger.attachment")}</div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                      title={t("messenger.cancel_reply")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {/* Edit-mode banner */}
                {editingMessage && (
                  <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <Pencil size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-amber-700">{t("messenger.editing")}</div>
                      <div className="text-xs text-slate-600 truncate">{editingMessage.originalText}</div>
                    </div>
                    <button
                      onClick={cancelEdit}
                      className="text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                      title={t("messenger.cancel_edit")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {pastedFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {pastedFiles.map((pf, idx) => (
                      <div key={`${pf.file.name}-${idx}`} className="relative inline-block">
                        {pf.preview ? (
                          <img
                            src={pf.preview}
                            alt={pf.file.name || "Geplakte afbeelding"}
                            className="max-h-32 max-w-[200px] rounded-lg border border-slate-200"
                          />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg max-w-[200px]">
                            <Paperclip size={16} className="text-slate-500 flex-shrink-0" />
                            <span className="text-sm text-slate-700 truncate">{pf.file.name}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{formatFileSize(pf.file.size)}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removePastedFile(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-red-600"
                          title={t("messenger.remove")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={messageInput}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={pastedFiles.length > 0 ? t("messenger.add_caption_placeholder") : t("messenger.type_message")}
                  rows={1}
                  className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 resize-none overflow-hidden"
                  style={{ minHeight: 40, maxHeight: 120 }}
                />
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0 mb-0.5" title={t("messenger.emoji")}>
                <Smile size={20} />
              </button>
              <button
                onClick={pastedFiles.length > 0 ? handleUploadFile : handleSend}
                disabled={(!messageInput.trim() && pastedFiles.length === 0) || sending || uploading}
                className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0 mb-0.5"
                title={t("messenger.send")}
              >
                {(sending || uploading) ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </>
        )}
      </div>

      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage.url}
          filename={lightboxImage.filename}
          downloadUrl={lightboxImage.downloadUrl}
          onClose={() => setLightboxImage(null)}
        />
      )}

    </div>
  );
}
