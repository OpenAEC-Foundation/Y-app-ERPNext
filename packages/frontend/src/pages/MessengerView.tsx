/**
 * Standalone messenger conversation view — rendered OUTSIDE the Y-app shell.
 *
 * Mounted at /messenger/view?convo=...&platform=...&name=... by App.tsx,
 * accessed via double-click on a conversation row in Messenger.tsx.
 *
 * Self-contained: laadt z'n eigen credentials uit /api/services + localStorage,
 * pollt elke 5s voor nieuwe berichten, support reply/file upload/notifications
 * identiek aan de hoofdpagina maar zonder sidebar/tab-switcher.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Loader2, Paperclip, ThumbsUp, Reply, X, CheckCheck,
  MoreVertical, Pencil, Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActiveInstanceId } from "../lib/instances";
import ImageLightbox from "../components/ImageLightbox";

const API = import.meta.env.VITE_API || "";
const API_BASE = "";

/* ─── Types ─── */
interface Reaction { emoji: string; count: number; userReacted: boolean; }
interface Attachment { id: string; name: string; mimetype: string; size: number; link: string; previewUrl?: string; }
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
  attachments?: Attachment[];
  parent?: { id: string; text: string; sender: string };
  lastEditTimestamp?: number;
  deleted?: boolean;
}

const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}‍️\s]{1,8}$/u;
function isEmojiOnlyReply(msg: Message): boolean {
  if (!msg.parent) return false;
  const trimmed = msg.text?.trim() || "";
  if (!trimmed) return false;
  return EMOJI_ONLY_RE.test(trimmed);
}
type Platform = "nextcloud-talk" | "ms-teams" | "telegram" | "whatsapp" | "signal";
interface BackendServices {
  nextcloud?: { url: string; user: string; pass: string } | null;
  telegram?: { token: string } | null;
}

/* ─── Helpers (gedupliceerd uit Messenger.tsx, bewust geen extractie ivm merge-risico) ─── */

function getInstanceId() { return getActiveInstanceId(); }
function getPref(key: string): string {
  return localStorage.getItem(`pref_${getInstanceId()}_messenger_${key}`) || "";
}
function getTeamsEmail(): string {
  return getPref("ms-teams_email") || localStorage.getItem(`pref_${getInstanceId()}_mail_user`) || "";
}

function buildQuery(platform: Platform, extra: Record<string, string>, backend: BackendServices): string {
  const params = new URLSearchParams({ platform, ...extra });
  if (platform === "nextcloud-talk") {
    const id = getInstanceId();
    let url = backend.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
    if (url && !url.match(/^https?:\/\//)) url = `https://${url}`;
    const user = backend.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
    const pass = backend.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
    if (url) params.set("url", url);
    if (user) params.set("user", user);
    if (pass) params.set("pass", pass);
  } else if (platform === "telegram") {
    const token = backend.telegram?.token || getPref("telegram_token");
    if (token) params.set("token", token);
  } else if (platform === "ms-teams") {
    params.set("email", getTeamsEmail());
  }
  return params.toString();
}

function formatMessageTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(iso: string, today: string, yesterday: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return today;
  if (diffDays === 1) return yesterday;
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}

const AVATAR_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close(), 400);
  } catch { /* audio not supported */ }
}

export default function MessengerView() {
  const { t } = useTranslation();
  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      convoId: sp.get("convo") || "",
      platform: (sp.get("platform") || "nextcloud-talk") as Platform,
      convoName: sp.get("name") || "Gesprek",
    };
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pastedFiles, setPastedFiles] = useState<{ file: File; preview?: string }[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; originalText: string } | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [backendServices, setBackendServices] = useState<BackendServices>({});
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string; downloadUrl?: string } | null>(null);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      console.warn(`[MessengerView] Quoted message ${messageId} not in view`);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMsgId(messageId);
    window.setTimeout(() => {
      setHighlightedMsgId(prev => (prev === messageId ? null : prev));
    }, 2000);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingOlderRef = useRef(false);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = `${params.convoName} · Y-app`;
  }, [params.convoName]);

  // Load backend services + initial messages
  useEffect(() => {
    fetch(`${API_BASE}/api/services`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(json => { if (json.data) setBackendServices(json.data); })
      .catch(() => {});
  }, []);

  // Notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Initial + polling fetch
  useEffect(() => {
    if (!params.convoId) return;
    loadMessages(false);
    pollerRef.current = setInterval(() => loadMessages(true), 5000);
    return () => { if (pollerRef.current) clearInterval(pollerRef.current); };
  }, [params.convoId, backendServices]);

  // Scroll to bottom on new messages (skip if loading older — M6 fix)
  useEffect(() => {
    if (loadingOlderRef.current) {
      loadingOlderRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages(silent: boolean) {
    if (!silent) setLoading(true);
    try {
      const qs = buildQuery(params.platform, { conversation: params.convoId }, backendServices);
      const resp = await fetch(`${API}/api/messenger/messages?${qs}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.load_messages_error"));
      const fresh: Message[] = json.data || [];

      if (silent) {
        setMessages(prev => {
          if (prev.length === 0) return fresh;
          const existing = new Set(prev.map(m => m.id));
          const newOnly = fresh.filter(m => !existing.has(m.id));
          if (newOnly.length > 0) {
            const incoming = newOnly.filter(m => !m.isOwn);
            if (incoming.length > 0) {
              playMessageSound();
              if (document.visibilityState !== "visible" && typeof Notification !== "undefined" && Notification.permission === "granted") {
                const last = incoming[incoming.length - 1];
                try {
                  const n = new Notification(last.senderDisplayName, {
                    body: last.text || t("messenger.attachment"),
                    icon: "/favicon.svg",
                    tag: `y-app-msg-${params.convoId}`,
                  });
                  // Popout = eigen gespreksvenster → alleen focussen bij klik.
                  n.onclick = () => {
                    try { window.focus(); } catch { /* ignore */ }
                    try { n.close(); } catch { /* ignore */ }
                  };
                } catch { /* blocked */ }
              }
            }
            return [...prev, ...newOnly];
          }
          return prev;
        });
      } else {
        setMessages(fresh);
        setHasMoreMessages(!!json.hasMore);
      }
    } catch (err) {
      if (!silent) setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadOlderMessages() {
    if (loadingMore || !hasMoreMessages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestId = messages[0].id;
      const qs = buildQuery(params.platform, { conversation: params.convoId, before: oldestId }, backendServices);
      const resp = await fetch(`${API}/api/messenger/messages?${qs}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || t("messenger.load_messages_error"));
      const older: Message[] = json.data || [];
      setHasMoreMessages(!!json.hasMore);
      if (older.length > 0) {
        const container = messagesContainerRef.current;
        const prevH = container?.scrollHeight ?? 0;
        loadingOlderRef.current = true;
        setMessages(prev => [...older, ...prev]);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevH;
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function sendText(text: string, replyTo?: string): Promise<void> {
    const body: Record<string, string> = { platform: params.platform, conversation: params.convoId, message: text };
    if (replyTo) body.replyTo = replyTo;
    if (params.platform === "nextcloud-talk") {
      const id = getInstanceId();
      body.url = backendServices.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
      body.user = backendServices.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
      body.pass = backendServices.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
    } else if (params.platform === "telegram") {
      body.token = backendServices.telegram?.token || getPref("telegram_token");
    } else if (params.platform === "ms-teams") {
      body.email = getTeamsEmail();
    }
    const resp = await fetch(`${API}/api/messenger/send`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || t("webmail.send_error"));
  }

  async function handleSend() {
    if (!messageInput.trim() || sending) return;
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
      await loadMessages(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function sendEdit(messageId: string, newText: string) {
    const id = getInstanceId();
    const body: Record<string, unknown> = {
      platform: params.platform,
      conversation: params.convoId,
      messageId,
      message: newText,
    };
    if (params.platform === "nextcloud-talk") {
      body.url = backendServices.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
      body.user = backendServices.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
      body.pass = backendServices.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
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
    setOpenActionMenu(null);
    if (!window.confirm(t("messenger.confirm_delete"))) return;
    try {
      const id = getInstanceId();
      const body: Record<string, unknown> = {
        platform: params.platform,
        conversation: params.convoId,
        messageId: msg.id,
      };
      if (params.platform === "nextcloud-talk") {
        body.url = backendServices.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
        body.user = backendServices.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
        body.pass = backendServices.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
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
      await loadMessages(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newFiles: { file: File; preview?: string }[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) newFiles.push({ file: f, preview: URL.createObjectURL(f) });
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

  async function handleUploadFile() {
    if (pastedFiles.length === 0 || uploading) return;
    if (params.platform !== "nextcloud-talk") {
      setError(t("messenger.upload_only_nc_talk"));
      return;
    }
    setUploading(true);
    setSending(true);
    try {
      const id = getInstanceId();
      const ncUrl = backendServices.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
      const ncUser = backendServices.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
      const ncPass = backendServices.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";

      // Caption + replyTo komen op het LAATSTE plaatje (talkMetaData) zodat
      // we geen losse text-message daarna meer hoeven te sturen.
      const caption = messageInput.trim();

      for (let i = 0; i < pastedFiles.length; i++) {
        const pf = pastedFiles[i];
        const isLast = i === pastedFiles.length - 1;
        const buffer = await pf.file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let j = 0; j < bytes.length; j += 8192) binary += String.fromCharCode(...bytes.subarray(j, j + 8192));
        const base64 = btoa(binary);
        const fileName = pf.file.name && pf.file.name !== "image.png"
          ? pf.file.name
          : `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${pf.file.type.split("/")[1] || "png"}`;
        const body: Record<string, string> = {
          platform: "nextcloud-talk",
          conversation: params.convoId,
          fileData: base64,
          fileName,
          mimeType: pf.file.type || "application/octet-stream",
          url: ncUrl, user: ncUser, pass: ncPass,
        };
        if (isLast) {
          if (caption) body.caption = caption;
          if (replyingTo?.id) body.replyTo = replyingTo.id;
        }
        const resp = await fetch(`${API}/api/messenger/upload`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
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
      await loadMessages(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      setSending(false);
    }
  }

  async function handleReact(msg: Message, emoji = "\u{1F44D}") {
    const existing = msg.reactions?.find(r => r.emoji === emoji);
    const remove = existing?.userReacted === true;
    const id = getInstanceId();
    const body: Record<string, unknown> = {
      platform: params.platform, conversation: params.convoId, messageId: msg.id, reaction: emoji, remove,
    };
    if (params.platform === "nextcloud-talk") {
      body.url = backendServices.nextcloud?.url || getPref("nextcloud-talk_url") || localStorage.getItem(`pref_${id}_nextcloud_url`) || "";
      body.user = backendServices.nextcloud?.user || getPref("nextcloud-talk_user") || localStorage.getItem(`pref_${id}_nextcloud_user`) || "";
      body.pass = backendServices.nextcloud?.pass || getPref("nextcloud-talk_pass") || localStorage.getItem(`pref_${id}_nextcloud_pass`) || "";
    }
    await fetch(`${API}/api/messenger/react`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex(r => r.emoji === emoji);
      if (remove) {
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], count: Math.max(0, reactions[idx].count - 1), userReacted: false };
          if (reactions[idx].count === 0) reactions.splice(idx, 1);
        }
      } else if (idx >= 0) {
        reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userReacted: true };
      } else {
        reactions.push({ emoji, count: 1, userReacted: true });
      }
      return { ...m, reactions: reactions.length > 0 ? reactions : undefined };
    }));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (pastedFiles.length > 0) handleUploadFile();
      else handleSend();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setMessageInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  /* ─── Group messages by date ─── */
  const grouped = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    for (const m of messages) {
      const date = m.timestamp ? new Date(m.timestamp).toDateString() : "unknown";
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.messages.push(m);
      else groups.push({ date: m.timestamp || "", messages: [m] });
    }
    return groups;
  }, [messages]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${avatarColor(params.convoName)}`}>
          {getInitials(params.convoName)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{params.convoName}</h1>
          <span className="text-[10px] text-slate-400">{params.platform}</span>
        </div>
      </header>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-slate-100 px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-400">{t("messenger.no_messages_in_convo")}</p>
          </div>
        )}

        {!loading && hasMoreMessages && (
          <div className="flex items-center justify-center py-3">
            <button onClick={loadOlderMessages} disabled={loadingMore}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-white hover:bg-slate-50 rounded-full shadow-sm border border-slate-200 disabled:opacity-50 cursor-pointer">
              {loadingMore ? (
                <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {t("common.loading")}</span>
              ) : (
                t("messenger.load_older_messages", "Laad oudere berichten")
              )}
            </button>
          </div>
        )}

        {grouped.map((group, gi) => (
          <div key={gi}>
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 bg-white rounded-full text-[11px] text-slate-500 font-medium shadow-sm">
                {formatDateHeader(group.date, t("messenger.today"), t("messenger.yesterday"))}
              </span>
            </div>
            {group.messages.map((msg) => {
              if (isEmojiOnlyReply(msg)) return null;
              const isHighlighted = highlightedMsgId === msg.id;
              const isDeleted = msg.deleted || msg.messageType === "comment_deleted";
              return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`flex mb-3 ${msg.isOwn ? "justify-end" : "justify-start"} ${isHighlighted ? "ring-2 ring-amber-400 ring-offset-2 rounded-xl transition-shadow duration-500" : "transition-shadow duration-500"}`}
              >
                {!msg.isOwn && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold mr-2 mt-1 flex-shrink-0 ${avatarColor(msg.senderDisplayName)}`}>
                    {getInitials(msg.senderDisplayName)}
                  </div>
                )}
                <div className="max-w-[85%] md:max-w-[70%] group">
                  {!msg.isOwn && (
                    <span className="text-[10px] text-slate-500 font-medium ml-1 mb-0.5 block">{msg.senderDisplayName}</span>
                  )}
                  <div className="relative">
                    <div className={`px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                      isDeleted
                        ? msg.isOwn
                          ? "bg-emerald-500/30 text-emerald-50 italic rounded-2xl rounded-br-sm ml-12"
                          : "bg-slate-100 text-slate-500 italic rounded-2xl rounded-bl-sm"
                        : msg.isOwn
                          ? "bg-emerald-500 text-white rounded-2xl rounded-br-sm ml-12"
                          : "bg-white text-slate-800 rounded-2xl rounded-bl-sm"
                    }`}>
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
                              const fullUrl = `${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.link)}&${buildQuery(params.platform, {}, backendServices)}`;
                              const previewUrl = `${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.previewUrl!)}&${buildQuery(params.platform, {}, backendServices)}`;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage({ url: fullUrl, filename: att.name, downloadUrl: fullUrl })}
                                  className="block cursor-pointer"
                                  title={att.name}
                                >
                                  <img src={previewUrl} alt={att.name} className="max-w-[280px] rounded-lg" />
                                </button>
                              );
                            })()
                          ) : (
                            <a href={`${API_BASE}/api/messenger/file-proxy?fileUrl=${encodeURIComponent(att.link)}&${buildQuery(params.platform, {}, backendServices)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 bg-slate-100/50 rounded-lg hover:bg-slate-100 transition-colors">
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
                    {!isDeleted && (
                    <div className={`absolute ${msg.isOwn ? "-left-20" : "-right-20"} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity`}>
                      <button onClick={() => handleReact(msg)}
                        className={`p-1 rounded-full hover:bg-slate-200 cursor-pointer ${msg.reactions?.some(r => r.emoji === "\u{1F44D}" && r.userReacted) ? "!opacity-100 text-blue-500" : "text-slate-400"}`}
                        title={t("messenger.like")}>
                        <ThumbsUp size={14} />
                      </button>
                      <button onClick={() => {
                        setReplyingTo({ id: msg.id, text: msg.text, sender: msg.senderDisplayName });
                        setEditingMessage(null);
                        textareaRef.current?.focus();
                      }} className="p-1 rounded-full hover:bg-slate-200 cursor-pointer text-slate-400" title={t("messenger.reply")}>
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
                    {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className={`flex gap-1 mt-1 ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                        {msg.reactions.map((r) => (
                          <button key={r.emoji} onClick={() => handleReact(msg, r.emoji)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs cursor-pointer transition-colors ${
                              r.userReacted ? "bg-blue-100 border border-blue-300 text-blue-700" : "bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200"
                            }`}>
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

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-xs text-red-600 border-t border-red-200">{error}</div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-end gap-2 flex-shrink-0">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer flex-shrink-0 mb-0.5" title={t("messenger.attachment")}>
          <Paperclip size={20} />
        </button>
        <div className="flex-1 relative">
          {replyingTo && (
            <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <Reply size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-blue-700">{t("messenger.replying_to")}: {replyingTo.sender}</div>
                <div className="text-xs text-slate-600 truncate">{replyingTo.text || t("messenger.attachment")}</div>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0" title={t("messenger.cancel_reply")}>
                <X size={14} />
              </button>
            </div>
          )}
          {editingMessage && (
            <div className="mb-2 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Pencil size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-amber-700">{t("messenger.editing")}</div>
                <div className="text-xs text-slate-600 truncate">{editingMessage.originalText}</div>
              </div>
              <button onClick={cancelEdit} className="text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0" title={t("messenger.cancel_edit")}>
                <X size={14} />
              </button>
            </div>
          )}
          {pastedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pastedFiles.map((pf, idx) => (
                <div key={`${pf.file.name}-${idx}`} className="relative inline-block">
                  {pf.preview ? (
                    <img src={pf.preview} alt={pf.file.name} className="max-h-32 max-w-[200px] rounded-lg border border-slate-200" />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg max-w-[200px]">
                      <Paperclip size={16} className="text-slate-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">{pf.file.name}</span>
                      <span className="text-xs text-slate-400 flex-shrink-0">{formatFileSize(pf.file.size)}</span>
                    </div>
                  )}
                  <button onClick={() => removePastedFile(idx)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer hover:bg-red-600" title={t("messenger.remove")}>×</button>
                </div>
              ))}
            </div>
          )}
          <textarea ref={textareaRef} value={messageInput} onChange={handleTextareaChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
            placeholder={pastedFiles.length > 0 ? t("messenger.add_caption_placeholder") : t("messenger.type_message")} rows={1}
            className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 border-0 resize-none overflow-hidden"
            style={{ minHeight: 40, maxHeight: 120 }} />
        </div>
        <button onClick={pastedFiles.length > 0 ? handleUploadFile : handleSend} disabled={(!messageInput.trim() && pastedFiles.length === 0) || sending || uploading}
          className="p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0 mb-0.5" title={t("messenger.send")}>
          {(sending || uploading) ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
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
