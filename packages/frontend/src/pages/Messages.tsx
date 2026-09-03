/**
 * Berichten — interne 1-op-1-chat tussen collega's, volledig op ERPNext.
 *
 * Dit scherm vervangt `Messenger.tsx` op de Y-next-installatie. Die pagina is
 * een aggregator over NextCloud Talk / Teams / Telegram en praat uitsluitend
 * met `/api/messenger/*` — Express-routes die hier niet bestaan. Ze blijft in
 * de repo staan voor de Y-app-build met server; op Y-next hangt `/messenger`
 * aan dit bestand.
 *
 * De databron zit in `lib/messages-erpnext.ts`; daar staat ook waarom het
 * `Notification Log` is geworden en waarom de afzender niet te vervalsen is.
 * Deze laag doet alleen presentatie, polling en gelezen-markeren — precies de
 * rolverdeling van `Webmail.tsx` + `mail-erpnext.ts`.
 *
 * Twee keuzes die je aan de code niet ziet:
 *
 *  - **Pollen, geen websocket.** Y-next heeft geen socket-laag (die zat in de
 *    verdwenen Express-server) en Frappe's eigen realtime-kanaal hangt aan de
 *    desk-bundle, niet aan een Web Page. Eén lijstquery per 20 seconden plus
 *    een ververs bij terugkeer op het tabblad is ruim genoeg voor intern
 *    berichtenverkeer en kost één request.
 *
 *  - **Gesprek = collega.** Er zijn geen groepen en geen threads: de drager
 *    kent maar één tegenpartij per bericht. Een gesprek is dus simpelweg
 *    "alles met deze persoon", en dat is ook wat de eis vraagt.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare, Send, Search, RefreshCw, Plus, ChevronLeft, X, Loader2, AlertCircle,
  Paperclip, ImageIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ImageLightbox from "../components/ImageLightbox";
import { setBadgeCount } from "../lib/badges";
import { isPermissionError } from "../lib/permission-error";
import { useIsMobile } from "../lib/useIsMobile";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MessageImageError,
  checkImage,
  contactNameMap,
  countUnread,
  groupThreads,
  listContacts,
  listMessages,
  markMessagesRead,
  sendMessage,
  type ErpMessage,
  type ErpMessageContact,
  type ErpMessageImage,
  type ErpMessageThread,
} from "../lib/messages-erpnext";

/** Ververs-interval. Zie de kopjes-uitleg: pollen in plaats van websockets. */
const POLL_INTERVAL_MS = 20_000;

/** `accept`-waarde van de bestandskiezer, afgeleid van de adapter-allowlist. */
const ACCEPTED_IMAGE_TYPES = [...ALLOWED_IMAGE_TYPES].join(",");

/* ─── Presentatie-helpers ─── */

/**
 * ERPNext levert datetimes als `2026-09-03 10:00:00.000000`. Safari (en
 * strikt gelezen ook de spec) accepteert die spatie niet als scheidingsteken,
 * dus die moet eruit vóór `new Date`.
 */
function parseErpDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: string): string {
  const date = parseErpDate(value);
  return date ? date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Tijdstempel in de gesprekslijst: vandaag de tijd, gisteren het woord, ouder de datum. */
function formatListStamp(value: string, yesterdayLabel: string): string {
  const date = parseErpDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return formatTime(value);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatDayHeader(value: string, todayLabel: string, yesterdayLabel: string): string {
  const date = parseErpDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return todayLabel;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── Pagina ─── */

export default function Messages() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [messages, setMessages] = useState<ErpMessage[]>([]);
  const [contacts, setContacts] = useState<ErpMessageContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<ErpMessageImage | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Namen die we al als gelezen hebben weggeschreven. Zonder dit stuurt elke
   * poll opnieuw een `mark_as_read` voor hetzelfde bericht: de lijst komt vers
   * van de server en het `read`-veld is pas bij de volgende ronde bijgewerkt.
   */
  const markedRef = useRef<Set<string>>(new Set());

  /**
   * Voorbeeld van de nog niet verstuurde afbeelding. Een blob-URL houdt het
   * bestand in het geheugen tot je hem intrekt, dus hij wordt bij elke
   * wisseling netjes vrijgegeven — anders stapelt dat op bij iemand die tien
   * foto's achter elkaar doorstuurt.
   */
  const previewUrl = useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage],
  );
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const names = useMemo(() => contactNameMap(contacts), [contacts]);
  const threads = useMemo(() => groupThreads(messages, names), [messages, names]);
  const unread = useMemo(() => countUnread(messages), [messages]);

  /**
   * Een gesprek bestaat pas zodra er een bericht is. Wie via "Nieuw gesprek"
   * een collega kiest die hij nog nooit geschreven heeft, moet toch een
   * invoerveld krijgen — vandaar het lege gesprek hieronder. Zonder dat
   * eindigde die klik in het lege "kies een gesprek"-scherm en was de
   * nieuw-gesprek-knop feitelijk stuk.
   */
  const activeThread: ErpMessageThread | null = useMemo(() => {
    if (!selected) return null;
    const existing = threads.find((thread) => thread.counterpart === selected);
    if (existing) return existing;
    return {
      counterpart: selected,
      counterpartName: names[selected] || selected,
      messages: [],
      lastBody: "",
      lastAt: "",
      lastHasImage: false,
      unread: 0,
    };
  }, [threads, selected, names]);

  const visibleThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter(
      (thread) =>
        thread.counterpartName.toLowerCase().includes(needle) ||
        thread.counterpart.toLowerCase().includes(needle) ||
        thread.lastBody.toLowerCase().includes(needle),
    );
  }, [threads, search]);

  /**
   * Ophalen. `silent` is de poll-variant: die mag geen spinner tonen en geen
   * eerdere foutmelding wegpoetsen zolang hij zelf niets nieuws weet — anders
   * knippert het scherm elke 20 seconden.
   */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await listMessages();
      setMessages(rows);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  // Contacten veranderen zelden; één keer bij mount is genoeg. Faalt het, dan
  // blijft de ontvangerskiezer leeg — de gesprekken zelf werken door, alleen
  // dan met de user-id als naam.
  useEffect(() => {
    void listContacts().then(setContacts).catch(() => setContacts([]));
  }, []);

  // Pollen + bijwerken zodra het tabblad weer zichtbaar wordt. Dat laatste is
  // wat het verschil maakt na een uur weggeklikt te zijn geweest: dan hoef je
  // niet op de volgende interval te wachten.
  useEffect(() => {
    const timer = setInterval(() => { void load(true); }, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) void load(true); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // Sidebar-badge. Opruimen bij unmount, anders blijft de teller van het
  // laatste bezoek hangen terwijl de gebruiker allang ergens anders is.
  useEffect(() => {
    setBadgeCount("messenger", unread);
    return () => setBadgeCount("messenger", 0);
  }, [unread]);

  // Een geopend gesprek is een gelezen gesprek. De lokale state gaat meteen
  // om (optimistisch) zodat de teller niet 20 seconden blijft staan; de
  // server volgt in dezelfde tick.
  useEffect(() => {
    if (!activeThread) return;
    const toMark = activeThread.messages
      .filter((m) => m.direction === "in" && !m.read && !markedRef.current.has(m.name))
      .map((m) => m.name);
    if (toMark.length === 0) return;
    for (const name of toMark) markedRef.current.add(name);
    setMessages((prev) => prev.map((m) => (toMark.includes(m.name) ? { ...m, read: true } : m)));
    void markMessagesRead(toMark);
  }, [activeThread]);

  // Naar het nieuwste bericht scrollen bij gespreks- of berichtwissel.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [selected, activeThread?.messages.length]);

  /**
   * Bestandkeuze. De controle gebeurt hier, vóór er iets verstuurd wordt:
   * pas ná het aanmaken van het bericht afkeuren zou een half bericht
   * achterlaten dat niet meer weg te halen is.
   */
  function handlePickImage(file: File | null) {
    if (!file) return;
    const rejection = checkImage(file);
    if (rejection === "type") {
      setSendError(t("messages.image_type_unsupported"));
      return;
    }
    if (rejection === "size") {
      setSendError(t("messages.image_too_large", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) }));
      return;
    }
    setSendError(null);
    setPendingImage(file);
  }

  function clearPendingImage() {
    setPendingImage(null);
    // De input leegmaken, anders vuurt `change` niet als je hetzelfde
    // bestand direct opnieuw kiest.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    const text = draft.trim();
    if ((!text && !pendingImage) || !selected || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendMessage(selected, text, pendingImage ?? undefined);
      setDraft("");
      clearPendingImage();
      await load(true);
    } catch (e) {
      if (e instanceof MessageImageError) {
        // De tekst ís bezorgd; alleen de foto niet. Het opstelveld wordt
        // daarom wél geleegd — nog een keer op verzenden drukken zou de
        // ontvanger een dubbel bericht bezorgen.
        setDraft("");
        clearPendingImage();
        await load(true);
        setSendError(t("messages.image_send_failed"));
      } else {
        // Een 403 is hier geen ruis maar de meest waarschijnlijke oorzaak:
        // `create` op Notification Log hangt op deze instance aan de rol
        // "Employee". Wie die rol niet heeft moet weten dat het aan rechten
        // ligt en niet aan zijn internetverbinding.
        setSendError(
          isPermissionError(e)
            ? t("messages.send_no_permission")
            : `${t("messenger.send_error")}${e instanceof Error && e.message ? `: ${e.message}` : ""}`,
        );
      }
    } finally {
      setSending(false);
    }
  }

  /**
   * Van gesprek wisselen gooit het concept én de gekozen foto weg. Ze laten
   * staan zou de volgende verzendknop de bijlage naar de verkeerde collega
   * sturen — een fout die je niet meer kunt terugnemen.
   */
  function openConversation(user: string) {
    setSelected(user);
    setDraft("");
    clearPendingImage();
    setSendError(null);
  }

  function startConversation(user: string) {
    openConversation(user);
    setPickerOpen(false);
    setPickerSearch("");
  }

  const pickerContacts = useMemo(() => {
    const needle = pickerSearch.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (c) => c.fullName.toLowerCase().includes(needle) || c.user.toLowerCase().includes(needle),
    );
  }, [contacts, pickerSearch]);

  const todayLabel = t("messenger.today");
  const yesterdayLabel = t("messenger.yesterday");

  /* ─── Gesprekslijst ─── */

  const conversationPane = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 min-h-0">
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("messages.search_conversations")}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
          />
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer text-sm font-medium"
        >
          <Plus size={15} /> {t("messenger.new_conversation")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && threads.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> {t("common.loading")}
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            {t("messenger.no_conversations")}
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <button
              key={thread.counterpart}
              onClick={() => openConversation(thread.counterpart)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                thread.counterpart === selected ? "bg-y-teal/5" : ""
              }`}
            >
              <span
                className={`flex-shrink-0 w-9 h-9 rounded-full ${avatarColor(thread.counterpart)} text-white text-xs font-semibold flex items-center justify-center`}
              >
                {initialsOf(thread.counterpartName)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{thread.counterpartName}</span>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {formatListStamp(thread.lastAt, yesterdayLabel)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={`flex items-center gap-1 text-xs truncate ${thread.unread > 0 ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                    {thread.lastHasImage && <ImageIcon size={12} className="flex-shrink-0" />}
                    {/* Een bericht dat alleen een foto is heeft geen tekst —
                        dan is het label de enige zinvolle samenvatting. */}
                    {thread.lastBody || (thread.lastHasImage ? t("messages.image_label") : "")}
                  </span>
                  {thread.unread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-y-teal text-white text-[10px] font-semibold flex items-center justify-center">
                      {thread.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  /* ─── Gesprek ─── */

  // Chronologisch oplopend renderen: de adapter levert nieuwste-eerst (dat is
  // wat de lijst nodig heeft), maar een gesprek lees je van boven naar
  // beneden met het nieuwste onderaan.
  const ordered = activeThread ? [...activeThread.messages].reverse() : [];

  const threadPane = (
    <div className="flex flex-col h-full min-h-0 bg-slate-50">
      {!activeThread ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 px-6 text-center">
          <MessageSquare size={40} className="text-slate-300" />
          <p className="text-sm">{t("messenger.select_conversation")}</p>
          <p className="text-xs text-slate-400 max-w-sm">{t("messages.storage_hint")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
            {isMobile && (
              <button
                onClick={() => setSelected(null)}
                className="p-1 -ml-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                aria-label={t("common.close")}
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <span
              className={`w-9 h-9 rounded-full ${avatarColor(activeThread.counterpart)} text-white text-xs font-semibold flex items-center justify-center`}
            >
              {initialsOf(activeThread.counterpartName)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{activeThread.counterpartName}</p>
              <p className="text-xs text-slate-400 truncate">{activeThread.counterpart}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-1">
            {ordered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{t("messages.no_messages_yet")}</p>
            ) : (
              ordered.map((message, index) => {
                const previous = ordered[index - 1];
                const showDay =
                  !previous ||
                  parseErpDate(previous.createdAt)?.toDateString() !==
                    parseErpDate(message.createdAt)?.toDateString();
                return (
                  <div key={message.name}>
                    {showDay && (
                      <div className="flex justify-center my-3">
                        <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-[11px]">
                          {formatDayHeader(message.createdAt, todayLabel, yesterdayLabel)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                          message.direction === "out"
                            ? "bg-y-teal text-white rounded-br-sm"
                            : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                        }`}
                      >
                        {message.image && (
                          // `src` is een eigen-origin pad dat de adapter al
                          // door `isSafeFileUrl` heeft gehaald; de browser
                          // stuurt de ERPNext-sessiecookie mee en Frappe
                          // beslist zelf of dit privébestand geleverd wordt.
                          <img
                            src={message.image.url}
                            alt={message.image.name}
                            loading="lazy"
                            onClick={() => setLightbox(message.image ?? null)}
                            className="mb-1.5 max-h-64 w-auto max-w-full rounded-lg cursor-zoom-in bg-slate-100"
                          />
                        )}
                        {message.body}
                        <span
                          className={`block text-[10px] mt-1 ${
                            message.direction === "out" ? "text-white/70 text-right" : "text-slate-400"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {sendError && (
            <div className="mx-4 mb-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}

          {pendingImage && previewUrl && (
            <div className="mx-3 mb-2 flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <img src={previewUrl} alt="" className="h-12 w-12 rounded object-cover flex-shrink-0" />
              <span className="flex-1 min-w-0 text-xs text-slate-600 truncate">{pendingImage.name}</span>
              <button
                onClick={clearPendingImage}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer flex-shrink-0"
                aria-label={t("messages.remove_image")}
                title={t("messages.remove_image")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              // Uit dezelfde constante als de controle in de adapter, zodat
              // de bestandskiezer nooit iets aanbiedt dat daarna alsnog
              // geweigerd wordt.
              accept={ACCEPTED_IMAGE_TYPES}
              className="hidden"
              onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="p-2 text-slate-500 hover:text-y-teal disabled:opacity-50 cursor-pointer"
              aria-label={t("messages.attach_image")}
              title={t("messages.attach_image")}
            >
              <Paperclip size={18} />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter verstuurt, Shift+Enter maakt een nieuwe regel — de
                // conventie die iedereen uit elke andere chat kent.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={1}
              placeholder={t("messenger.type_message")}
              className="flex-1 resize-none max-h-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            <button
              onClick={() => void handleSend()}
              disabled={sending || (draft.trim().length === 0 && !pendingImage)}
              className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm font-medium"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span className="hidden sm:inline">{t("messenger.send")}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="p-3 sm:p-6 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-y-teal/10 rounded-lg">
            <MessageSquare className="text-y-teal" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("nav.messenger")}</h2>
          {unread > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-y-teal text-white text-xs font-semibold">
              {t("messages.unread_count", { n: unread })}
            </span>
          )}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer text-sm"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{t("common.refresh")}</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex-shrink-0">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{t("messenger.load_messages_error")}: {error}</span>
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isMobile ? (
          <div className="h-full">{selected ? threadPane : conversationPane}</div>
        ) : (
          <div className="h-full grid grid-cols-[320px_1fr]">
            {conversationPane}
            {threadPane}
          </div>
        )}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">{t("messenger.new_conversation")}</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={t("messenger.search_colleague")}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {pickerContacts.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">{t("messages.no_contacts")}</p>
              ) : (
                pickerContacts.map((contact) => (
                  <button
                    key={contact.user}
                    onClick={() => startConversation(contact.user)}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <span
                      className={`w-8 h-8 rounded-full ${avatarColor(contact.user)} text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0`}
                    >
                      {initialsOf(contact.fullName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-800 truncate">{contact.fullName}</span>
                      <span className="block text-xs text-slate-400 truncate">{contact.user}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          imageUrl={lightbox.url}
          filename={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
