import { useState, useEffect, useMemo, useRef } from "react";
import {
  ChevronRight, ChevronDown, X, FolderKanban, Star, ExternalLink,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link, Image,
  RefreshCw, Paperclip, Send, Cloud, Loader2, Folder, File, Link2, Forward,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../lib/useIsMobile";
import { getActiveInstanceId } from "../../lib/instances";
import { useProjects, type ProjectRecord } from "../../lib/DataContext";
import {
  type RecipientSuggestion,
  loadFrequencyMap, bumpFrequency, parseRecipientEmails,
  getCurrentToken, replaceCurrentToken,
  fetchCustomerContactSuggestions, mergeAndRankSuggestions, topRecentFromFrequency,
} from "../../lib/contact-suggestions";
import { arrayBufferToBase64 } from "../../lib/attachment-utils";
import { signatureCache, fetchEmailSignature } from "../../lib/mail-signature-cache";
import { type ImapConfig } from "../../lib/webmail-prefetch";
import type {
  ForwardedAttachment, ComposeState, SendPayload,
} from "../../lib/mail-types";

/* ─── Send sound (Web Audio API "whoosh") ─── */
function playSendSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => ctx.close(), 500);
  } catch { /* audio not supported */ }
}

/* ─── Compose window (Outlook-style, bottom-right floating) ─── */

/* Recipient autocomplete — verplaatst naar lib/contact-suggestions.ts en gedeeld
   met het agenda-uitnodig-veld (RecipientInput). Webmail importeert de functies
   bovenaan dit bestand. */

export default function ComposeWindow({ compose, onClose, onSendBackground, config, inline = false, onPopout }: {
  compose: ComposeState; onClose: () => void; onSendBackground: (payload: SendPayload) => void; config: ImapConfig;
  /** inline=true: render als vast paneel in de leespaneel-kolom (geen
   *  zwevend/sleepbaar/resizebaar venster, geen minimaliseren). Dit is het
   *  standaardgedrag in Webmail sinds nieuwe mail/beantwoorden in het
   *  preview-paneel moet verschijnen i.p.v. een los popup-venster. */
  inline?: boolean;
  /** Alleen relevant in inline-modus: toont een popout-knop die het concept
   *  naar een eigen zwevend venster verplaatst (Webmail zet composeFloating). */
  onPopout?: () => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [from] = useState(compose.from || config.user);
  const [to, setTo] = useState(compose.to);
  const [cc, setCc] = useState(compose.cc);
  const [bcc, setBcc] = useState(compose.bcc);
  const [subject, setSubject] = useState(compose.subject);
  const [body] = useState(compose.body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(!!compose.cc || !!compose.bcc);
  const [minimized, setMinimized] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [forwardedAttachments, setForwardedAttachments] = useState<ForwardedAttachment[]>(compose.forwardedAttachments || []);
  const [dragging, setDragging] = useState(false);
  const [showNcPicker, setShowNcPicker] = useState(false);
  const [ncPath, setNcPath] = useState("/");
  const [ncFiles, setNcFiles] = useState<{ name: string; path: string; size: number; isDirectory: boolean }[]>([]);
  const [ncLoading, setNcLoading] = useState(false);
  const [ncAdding, setNcAdding] = useState<Set<string>>(new Set());
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Project → onderwerp: kies een ERPNext-project en plak "<id> <projectnaam>"
  // vóór het onderwerp. Hergebruikt dezelfde projectenlijst als de ReadingPane.
  const projects = useProjects();
  const [showSubjectProject, setShowSubjectProject] = useState(false);
  const [subjectProjectSearch, setSubjectProjectSearch] = useState("");
  const subjectProjectList = useMemo(() => {
    const q = subjectProjectSearch.trim().toLowerCase();
    const list = q
      ? projects.filter(p =>
          (p.project_name || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q) ||
          (p.customer_name || "").toLowerCase().includes(q))
      : projects.filter(p => p.status === "Open" || p.status === "Working" || p.status === "In Progress");
    return list.slice(0, 20);
  }, [projects, subjectProjectSearch]);
  function addProjectToSubject(p: ProjectRecord) {
    const prefix = `${p.name}${p.project_name ? " " + p.project_name : ""}`;
    setSubject(prev => (prev.trim() ? `${prefix} ${prev}` : prefix));
    setShowSubjectProject(false);
    setSubjectProjectSearch("");
  }

  // Draggable & resizable state
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from default position
  const [size, setSize] = useState({ w: 680, h: 620 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origPosX: number; origPosY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const toInputRef = useRef<HTMLInputElement>(null);
  const ccInputRef = useRef<HTMLInputElement>(null);
  const bccInputRef = useRef<HTMLInputElement>(null);
  const editorInitialized = useRef(false);

  /* ─── Recipient autocomplete state ─── */
  const activeFieldRef = useRef<"to" | "cc" | "bcc" | null>(null);
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [suggestHighlight, setSuggestHighlight] = useState(0);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestField, setSuggestField] = useState<"to" | "cc" | "bcc" | null>(null);
  const suggestAbortRef = useRef<{ cancelled: boolean } | null>(null);
  const instanceIdRef = useRef<string | null>(null);
  if (instanceIdRef.current === null) instanceIdRef.current = getActiveInstanceId();
  /** Last fetched ERPNext contacts — kept across queries so narrowing filters client-side without waiting for a new fetch. */
  const lastContactsRef = useRef<RecipientSuggestion[]>([]);

  /** Refresh suggestions for a given field value. `value` is the raw input string. */
  function refreshSuggestions(field: "to" | "cc" | "bcc", value: string, caret: number): void {
    const { token } = getCurrentToken(value, caret);
    const freqMap = loadFrequencyMap(instanceIdRef.current);

    // Cancel any in-flight fetch by marking it stale.
    if (suggestAbortRef.current) suggestAbortRef.current.cancelled = true;
    const abort = { cancelled: false };
    suggestAbortRef.current = abort;

    if (token.trim().length < 2) {
      // Show top-recent (focus or very short token).
      const recent = topRecentFromFrequency(freqMap);
      setSuggestions(recent);
      setSuggestHighlight(0);
      setSuggestOpen(recent.length > 0);
      setSuggestField(field);
      return;
    }

    // Optimistic: filter last-known contacts + frequency map client-side immediately.
    // This keeps matches visible while the user keeps typing, without waiting on ERPNext.
    const q = token.trim().toLowerCase();
    const filteredCached = lastContactsRef.current.filter((c) => {
      return c.email.toLowerCase().includes(q) || c.label.toLowerCase().includes(q);
    });
    const immediate = mergeAndRankSuggestions(token, filteredCached, freqMap);
    setSuggestions(immediate);
    setSuggestHighlight(0);
    setSuggestOpen(immediate.length > 0);
    setSuggestField(field);

    // Debounced ERPNext fetch — adds freshly-matched contacts that aren't in the cache.
    setTimeout(() => {
      if (abort.cancelled) return;
      fetchCustomerContactSuggestions(token).then((customer) => {
        if (abort.cancelled) return;
        // Union with last cache — new fetch might miss contacts that still match the
        // narrowing query but fell off the result cap. Filter the union by current token.
        const unionByEmail = new Map<string, RecipientSuggestion>();
        for (const c of lastContactsRef.current) unionByEmail.set(c.email, c);
        for (const c of customer) unionByEmail.set(c.email, c);
        const union = Array.from(unionByEmail.values()).filter((c) =>
          c.email.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)
        );
        lastContactsRef.current = union;
        const merged = mergeAndRankSuggestions(token, union, freqMap);
        setSuggestions(merged);
        setSuggestHighlight(0);
        setSuggestOpen(merged.length > 0);
      });
    }, 120);
  }

  function closeSuggestions(): void {
    setSuggestOpen(false);
    setSuggestions([]);
    setSuggestField(null);
    if (suggestAbortRef.current) suggestAbortRef.current.cancelled = true;
  }

  function applySuggestion(s: RecipientSuggestion): void {
    const field = suggestField ?? activeFieldRef.current;
    if (!field) return;
    const input = field === "to" ? toInputRef.current : field === "cc" ? ccInputRef.current : bccInputRef.current;
    if (!input) return;
    const value = input.value;
    const caret = input.selectionStart ?? value.length;
    const { next, newCaret } = replaceCurrentToken(value, caret, s.email);
    if (field === "to") setTo(next);
    else if (field === "cc") setCc(next);
    else setBcc(next);
    // Bump frequency — explicit selection is a strong signal.
    bumpFrequency(instanceIdRef.current, s.email, s.label);
    // Restore caret and focus after React flushes the new value.
    requestAnimationFrame(() => {
      input.focus();
      try { input.setSelectionRange(newCaret, newCaret); } catch { /* ignore */ }
    });
    closeSuggestions();
  }

  function handleRecipientKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    // Explicit Tab handling: ensure CC/BCC are skipped regardless of browser quirks.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      closeSuggestions();
      // Find the Subject input — it's the only text input after To/CC/BCC in this form.
      const compose = e.currentTarget.closest("form, .flex.flex-col") as HTMLElement | null;
      const host = compose ?? document;
      const allInputs = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="text"]'));
      // Subject is the last text input in the recipient/subject block (has font-medium class).
      const subjectInput = allInputs.find((el) => el.className.includes("font-medium"));
      subjectInput?.focus();
      return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestHighlight((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestHighlight((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = suggestions[suggestHighlight];
      if (chosen) applySuggestion(chosen);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSuggestions();
    }
  }

  useEffect(() => {
    // Focus "Aan" field when composing new or forwarding, editor for reply
    setTimeout(() => {
      if (compose.mode === "new" || compose.mode === "forward") toInputRef.current?.focus();
      else editorRef.current?.focus();
    }, 100);
  }, []);

  // Initialize rich text editor with body content + signature from ERPNext
  useEffect(() => {
    if (editorInitialized.current) return;
    editorInitialized.current = true;

    const emailAddr = from || config.user;
    fetchEmailSignature(emailAddr).then((sig) => {
      if (!editorRef.current) return;

      // Convert plain text body to HTML paragraphs
      const bodyHtml = body ? body.replace(/\n/g, "<br>") : "<br>";
      const sigBlock = sig ? `<br><br><div class="email-signature" style="margin-top:8px;">${sig}</div>` : "";

      // W3: bij reply/forward — bewaar originele HTML opmaak in een <blockquote>.
      // Body bevat alleen de header tot "---"; quoteHtml is de originele body.
      if (compose.quoteHtml) {
        const sepIdx = body.indexOf("\n\n---\n");
        const beforeQuote = sepIdx > -1 ? body.slice(0, sepIdx).replace(/\n/g, "<br>") : bodyHtml;
        const header = sepIdx > -1 ? body.slice(sepIdx).replace(/\n/g, "<br>") : "";
        const quoteBlock = `<blockquote style="border-left:2px solid #cbd5e1;padding-left:12px;margin:8px 0 0 0;color:#475569;">${compose.quoteHtml}</blockquote>`;
        editorRef.current.innerHTML = `${beforeQuote}${sigBlock}${header}${quoteBlock}`;
      } else if (sig) {
        // Legacy path (reply zonder htmlBody beschikbaar): plain-text quote.
        const sepIdx = body.indexOf("\n\n---\n");
        if (sepIdx > -1) {
          const beforeQuote = body.slice(0, sepIdx).replace(/\n/g, "<br>");
          const quotedPart = body.slice(sepIdx).replace(/\n/g, "<br>");
          editorRef.current.innerHTML = `${beforeQuote}${sigBlock}${quotedPart}`;
        } else {
          editorRef.current.innerHTML = `${bodyHtml}${sigBlock}`;
        }
      } else {
        editorRef.current.innerHTML = bodyHtml;
      }
    });
  }, []);

  /** Execute a formatting command on the editor */
  function execCmd(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }

  function insertImage() {
    imgInputRef.current?.click();
  }

  function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        execCmd("insertImage", reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function insertLink() {
    const url = prompt(t("webmail.enter_url"));
    if (url) execCmd("createLink", url);
  }

  /** W1: clear caches en herlaad signature uit ERPNext. */
  async function refreshSignature() {
    const emailAddr = from || config.user;
    const key = emailAddr.toLowerCase();
    signatureCache.delete(key);
    const lsKey = `mail_signature_v5_${getActiveInstanceId()}_${key}`;
    localStorage.removeItem(lsKey);
    const sig = await fetchEmailSignature(emailAddr);
    if (!sig) {
      console.warn("[Webmail] Empty signature from ERPNext for", emailAddr, "— check User.email_signature, Email Account.signature, or default outgoing account");
    }
    if (!editorRef.current) return;
    const existing = editorRef.current.querySelector(".email-signature");
    if (existing) {
      existing.innerHTML = sig;
    } else if (sig) {
      const sigDiv = document.createElement("div");
      sigDiv.className = "email-signature";
      sigDiv.setAttribute("style", "margin-top:8px;");
      sigDiv.innerHTML = sig;
      const blockquote = editorRef.current.querySelector("blockquote");
      if (blockquote) {
        editorRef.current.insertBefore(document.createElement("br"), blockquote);
        editorRef.current.insertBefore(sigDiv, blockquote);
      } else {
        editorRef.current.appendChild(document.createElement("br"));
        editorRef.current.appendChild(sigDiv);
      }
    }
  }

  // Drag handlers
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
      }
      if (resizeRef.current) {
        const dx = resizeRef.current.startX - e.clientX;
        const dy = resizeRef.current.startY - e.clientY;
        setSize({
          w: Math.max(400, resizeRef.current.origW + dx),
          h: Math.max(300, resizeRef.current.origH + dy),
        });
        setPos({
          x: resizeRef.current.origPosX - dx,
          y: resizeRef.current.origPosY - dy,
        });
      }
    }
    function onMouseUp() { dragRef.current = null; resizeRef.current = null; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  function startDrag(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.preventDefault();
  }

  function startResize(e: React.MouseEvent) {
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h, origPosX: pos.x, origPosY: pos.y };
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) setAttachments(prev => [...prev, ...files]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function ncBrowse(path: string) {
    setNcPath(path);
    setNcLoading(true);
    try {
      const res = await fetch(`/api/nextcloud/files?path=${encodeURIComponent(path)}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setNcFiles((json.data || []).filter((f: { name: string }) => f.name !== ""));
    } catch { setNcFiles([]); }
    finally { setNcLoading(false); }
  }

  async function ncAttachFile(filePath: string, fileName: string) {
    setNcAdding(prev => new Set(prev).add(filePath));
    try {
      const res = await fetch(`/api/nextcloud/download?path=${encodeURIComponent(filePath)}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const file = new window.File([blob], fileName, { type: blob.type || "application/octet-stream" });
      setAttachments(prev => [...prev, file]);
    } catch { /* ignore */ }
    finally { setNcAdding(prev => { const n = new Set(prev); n.delete(filePath); return n; }); }
  }

  async function ncInsertLink(filePath: string, fileName: string) {
    setNcAdding(prev => new Set(prev).add(filePath));
    try {
      const res = await fetch(`/api/nextcloud/share?path=${encodeURIComponent(filePath)}`, { method: "POST", credentials: "same-origin" });
      if (!res.ok) throw new Error("Share failed");
      const json = await res.json();
      const url = json.url;
      if (url) {
        if (editorRef.current) {
          editorRef.current.focus();
          document.execCommand("insertHTML", false, `<br><br>📎 <a href="${url}" target="_blank">${fileName}</a>`);
        }
        setShowNcPicker(false);
      }
    } catch (err) {
      alert(t("webmail.link_create_error", { message: (err as Error).message }));
    }
    finally { setNcAdding(prev => { const n = new Set(prev); n.delete(filePath); return n; }); }
  }

  function openNcPicker() {
    setShowNcPicker(true);
    ncBrowse("/");
  }

  async function handleSend() {
    if (!to.trim()) { setError(t("webmail.fill_recipient")); return; }
    setSending(true); setError("");
    // Convert attachments to base64
    const attachmentData: { filename: string; content: string; contentType: string }[] = [];
    try {
      for (const file of attachments) {
        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        attachmentData.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream" });
      }
      // W2: forwarded bijlages downloaden vanaf server + meesturen
      for (const fwd of forwardedAttachments) {
        const res = await fetch(fwd.url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(t("webmail.attachment_unavailable", { filename: fwd.filename, status: res.status, defaultValue: `Bijlage "{{filename}}" niet beschikbaar ({{status}})` }));
        attachmentData.push({ filename: fwd.filename, content: arrayBufferToBase64(await res.arrayBuffer()), contentType: fwd.contentType || "application/octet-stream" });
      }
    } catch (err) { setError(t("webmail.attachment_read_error") + " " + (err as Error).message); setSending(false); return; }

    // Guard tegen nginx client_max_body_size (50MB) — base64 inflateert ~33%,
    // dus 45MB base64 ≈ 34MB origineel. Voorkomt 413 server-error.
    const MAX_PAYLOAD_BYTES = 45 * 1024 * 1024;
    const totalBase64Bytes = attachmentData.reduce((sum, a) => sum + a.content.length, 0);
    if (totalBase64Bytes > MAX_PAYLOAD_BYTES) {
      setError(t("webmail.attachments_too_large"));
      setSending(false);
      return;
    }

    // Get HTML content directly from the rich text editor
    const htmlBody = editorRef.current?.innerHTML || "";
    const plainText = editorRef.current?.innerText || editorRef.current?.textContent || "";

    const payload: SendPayload = {
      email: config.user,
      from: from,
      to: to.split(/[,;]\s*/).filter(Boolean),
      cc: cc ? cc.split(/[,;]\s*/).filter(Boolean) : undefined,
      bcc: bcc ? bcc.split(/[,;]\s*/).filter(Boolean) : undefined,
      subject,
      html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;line-height:1.6;">${htmlBody}</div>`,
      text: plainText,
      inReplyTo: compose.inReplyTo,
      references: compose.references,
      attachments: attachmentData.length > 0 ? attachmentData : undefined,
      _replyToUid: compose.replyToUid,
      _replyToFolder: compose.replyToFolder,
    };

    // Track frequency for every successful recipient.
    const allRecipients = [
      ...parseRecipientEmails(to),
      ...parseRecipientEmails(cc),
      ...parseRecipientEmails(bcc),
    ];
    for (const email of allRecipients) {
      bumpFrequency(instanceIdRef.current, email, "");
    }

    // Close window immediately and send in background
    playSendSound();
    onSendBackground(payload);
    onClose();
  }

  const title = compose.mode === "new" ? t("webmail.new_message") :
    compose.mode === "reply" ? t("webmail.reply") :
    compose.mode === "replyAll" ? t("webmail.reply_all") : t("webmail.forward");

  if (minimized && !inline) {
    return (
      <div className="fixed bottom-0 right-6 w-80 bg-blue-600 text-white rounded-t-lg shadow-2xl z-50 cursor-pointer" onClick={() => setMinimized(false)}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm font-medium truncate">{title}{subject ? ` - ${subject}` : ""}</span>
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setMinimized(false); }} className="text-white/80 hover:text-white cursor-pointer p-0.5"><ChevronRight size={14} className="rotate-[-90deg]" /></button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-white/80 hover:text-white cursor-pointer p-0.5"><X size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={windowRef}
      className={inline
        ? "bg-white flex flex-col h-full w-full min-h-0"
        : isMobile
        ? "fixed inset-0 bg-white flex flex-col z-50 pt-[env(safe-area-inset-top,0px)]"
        : "fixed bg-white rounded-t-xl shadow-2xl border border-slate-300 flex flex-col z-50"}
      style={inline || isMobile ? undefined : { bottom: -pos.y, right: 24 - pos.x, width: size.w, height: size.h, maxHeight: "90vh" }}>
      {/* Resize handle (top-left corner) — alleen bij het zwevende venster */}
      {!isMobile && !inline && <div className="absolute -top-1 -left-1 w-4 h-4 cursor-nwse-resize z-10" onMouseDown={startResize} />}
      {/* Header — sleepbaar alleen bij het zwevende venster; inline is vast */}
      <div className={`flex items-center justify-between px-4 py-2.5 bg-blue-600 flex-shrink-0 select-none ${inline ? "" : "rounded-t-xl cursor-move"}`} onMouseDown={isMobile || inline ? undefined : startDrag}>
        <span className="text-white font-semibold text-sm">{title}</span>
        <div className="flex items-center gap-1">
          {!isMobile && inline && onPopout && (
            <button onClick={onPopout} title={t("webmail.open_in_new_window")}
              className="text-white/80 hover:text-white cursor-pointer p-1"><ExternalLink size={14} /></button>
          )}
          {!isMobile && !inline && <button onClick={() => setMinimized(true)} className="text-white/80 hover:text-white cursor-pointer p-1"><ChevronDown size={14} /></button>}
          <button onClick={onClose} className="text-white/80 hover:text-white cursor-pointer p-1"><X size={isMobile ? 18 : 14} /></button>
        </div>
      </div>

      {/* From / To / CC / BCC / Subject */}
      <div className="flex-shrink-0 divide-y divide-slate-100 relative">
        <div className="flex items-center px-4 py-1.5">
          <label className="text-xs font-medium text-slate-500 w-16">{t("webmail.from_label")}</label>
          <span className="flex-1 text-sm text-slate-700 py-1">{from}</span>
        </div>
        <div className="flex items-center px-4 py-1.5">
          <label className="text-xs font-medium text-slate-500 w-16">{t("webmail.to_label")}</label>
          <input ref={toInputRef} type="text" value={to}
            onChange={(e) => {
              setTo(e.target.value);
              activeFieldRef.current = "to";
              refreshSuggestions("to", e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onFocus={(e) => {
              activeFieldRef.current = "to";
              refreshSuggestions("to", e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onBlur={() => { setTimeout(() => { if (activeFieldRef.current === "to") closeSuggestions(); }, 150); }}
            onKeyDown={handleRecipientKeyDown}
            autoComplete="off"
            className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 py-1" placeholder={t("webmail.recipient_placeholder")} />
          {!showCcBcc && (
            <button onClick={() => setShowCcBcc(true)} className="text-xs text-blue-600 hover:underline cursor-pointer ml-2">CC/BCC</button>
          )}
        </div>
        {showCcBcc && (
          <>
            <div className="flex items-center px-4 py-1.5">
              <label className="text-xs font-medium text-slate-500 w-16">CC</label>
              <input ref={ccInputRef} tabIndex={-1} type="text" value={cc}
                onChange={(e) => {
                  setCc(e.target.value);
                  activeFieldRef.current = "cc";
                  refreshSuggestions("cc", e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onFocus={(e) => {
                  activeFieldRef.current = "cc";
                  refreshSuggestions("cc", e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onBlur={() => { setTimeout(() => { if (activeFieldRef.current === "cc") closeSuggestions(); }, 150); }}
                onKeyDown={handleRecipientKeyDown}
                autoComplete="off"
                className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 py-1" />
            </div>
            <div className="flex items-center px-4 py-1.5">
              <label className="text-xs font-medium text-slate-500 w-16">BCC</label>
              <input ref={bccInputRef} tabIndex={-1} type="text" value={bcc}
                onChange={(e) => {
                  setBcc(e.target.value);
                  activeFieldRef.current = "bcc";
                  refreshSuggestions("bcc", e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onFocus={(e) => {
                  activeFieldRef.current = "bcc";
                  refreshSuggestions("bcc", e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onBlur={() => { setTimeout(() => { if (activeFieldRef.current === "bcc") closeSuggestions(); }, 150); }}
                onKeyDown={handleRecipientKeyDown}
                autoComplete="off"
                className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 py-1" />
            </div>
          </>
        )}
        <div className="flex items-center px-4 py-1.5 relative">
          <label className="text-xs font-medium text-slate-500 w-16">{t("webmail.subject_label")}</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
            onFocus={closeSuggestions}
            className="flex-1 text-sm border-0 focus:outline-none focus:ring-0 py-1 font-medium" />
          <div className="relative shrink-0">
            <button type="button" title={t("webmail.subject_add_project")}
              onClick={() => { closeSuggestions(); setShowSubjectProject(v => !v); }}
              className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded cursor-pointer">
              <FolderKanban size={13} /> {t("webmail.subject_add_project_short")}
            </button>
            {showSubjectProject && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSubjectProject(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-80 z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <input type="text" value={subjectProjectSearch} onChange={(e) => setSubjectProjectSearch(e.target.value)}
                      placeholder={t("hours_widget.search_project_placeholder")} autoFocus
                      className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {subjectProjectList.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">{t("common.no_projects_found")}</p>
                    )}
                    {subjectProjectList.map(p => (
                      <button type="button" key={p.name} onClick={() => addProjectToSubject(p)}
                        className="w-full text-left px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center gap-2 border-b border-slate-50">
                        <FolderKanban size={13} className="text-teal-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                            <span className="font-mono text-violet-700 shrink-0">{p.name}</span>
                            <span className="truncate">{p.project_name || ""}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {p.customer_name && <span>{p.customer_name} · </span>}
                            {p.status}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Recipient suggestions dropdown — positioned below the active field. */}
        {suggestOpen && suggestions.length > 0 && suggestField && (() => {
          const activeInput = suggestField === "to" ? toInputRef.current
            : suggestField === "cc" ? ccInputRef.current
            : bccInputRef.current;
          if (!activeInput) return null;
          const rect = activeInput.getBoundingClientRect();
          const parentRect = activeInput.closest(".flex-shrink-0")?.getBoundingClientRect();
          const topOffset = parentRect ? (rect.bottom - parentRect.top) + 2 : 56;
          return (
            <div className="absolute left-16 right-4 z-30 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
              style={{ top: topOffset }}>
              {suggestions.map((s, idx) => (
                <button
                  key={s.email}
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                  onMouseEnter={() => setSuggestHighlight(idx)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${idx === suggestHighlight ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  {s.source === "frequent" && <Star size={12} className="text-amber-400 flex-shrink-0" />}
                  <span className="flex-1 truncate">
                    {s.label && <span className="text-slate-700">{s.label}</span>}
                    {s.label && <span className="text-slate-400"> &lt;</span>}
                    <span className="text-slate-500">{s.email}</span>
                    {s.label && <span className="text-slate-400">&gt;</span>}
                  </span>
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-t border-slate-200 bg-slate-50/80 flex-shrink-0 flex-wrap">
        <button type="button" tabIndex={-1} onClick={() => execCmd("bold")} title={t("webmail.tt_bold")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><Bold size={14} /></button>
        <button type="button" tabIndex={-1} onClick={() => execCmd("italic")} title={t("webmail.tt_italic")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><Italic size={14} /></button>
        <button type="button" tabIndex={-1} onClick={() => execCmd("underline")} title={t("webmail.tt_underline")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><Underline size={14} /></button>
        <button type="button" tabIndex={-1} onClick={() => execCmd("strikeThrough")} title={t("webmail.tt_strikethrough")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer hidden md:inline-flex"><Strikethrough size={14} /></button>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" tabIndex={-1} onClick={() => execCmd("insertUnorderedList")} title={t("webmail.tt_bullet_list")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><List size={14} /></button>
        <button type="button" tabIndex={-1} onClick={() => execCmd("insertOrderedList")} title={t("webmail.tt_numbered_list")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer hidden md:inline-flex"><ListOrdered size={14} /></button>
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" tabIndex={-1} onClick={insertLink} title={t("webmail.tt_insert_link")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><Link size={14} /></button>
        <button type="button" tabIndex={-1} onClick={insertImage} title={t("webmail.tt_insert_image")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><Image size={14} /></button>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageInsert} />
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" tabIndex={-1} onClick={refreshSignature} title={t("webmail.refresh_signature")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer"><RefreshCw size={14} /></button>
        <div className="w-px h-5 bg-slate-300 mx-1 hidden md:block" />
        <select tabIndex={-1} onChange={(e) => { if (e.target.value) execCmd("formatBlock", e.target.value); e.target.value = ""; }} defaultValue="" title={t("webmail.tt_heading")}
          className="text-xs text-slate-600 bg-transparent border border-slate-200 rounded px-1.5 py-1 cursor-pointer hover:bg-slate-100 hidden md:inline-flex">
          <option value="" disabled>{t("webmail.heading_placeholder")}</option>
          <option value="p">{t("webmail.heading_normal")}</option>
          <option value="h1">{t("webmail.heading_1")}</option>
          <option value="h2">{t("webmail.heading_2")}</option>
          <option value="h3">{t("webmail.heading_3")}</option>
        </select>
        <select tabIndex={-1} onChange={(e) => { if (e.target.value) execCmd("fontSize", e.target.value); e.target.value = ""; }} defaultValue="" title={t("webmail.tt_font_size")}
          className="text-xs text-slate-600 bg-transparent border border-slate-200 rounded px-1.5 py-1 cursor-pointer hover:bg-slate-100 ml-1 hidden md:inline-flex">
          <option value="" disabled>{t("webmail.size_placeholder")}</option>
          <option value="1">{t("webmail.size_small")}</option>
          <option value="3">{t("webmail.size_normal")}</option>
          <option value="5">{t("webmail.size_large")}</option>
          <option value="7">{t("webmail.size_xlarge")}</option>
        </select>
        <input tabIndex={-1} type="color" onChange={(e) => execCmd("foreColor", e.target.value)} defaultValue="#334155" title={t("webmail.tt_text_color")}
          className="w-6 h-6 border border-slate-200 rounded cursor-pointer ml-1 hidden md:inline-flex" />
      </div>

      {/* Rich text editor body with drag-and-drop */}
      <div className={`flex-1 min-h-0 overflow-auto border-t border-slate-200 relative ${dragging ? "bg-blue-50" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}>
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 border-2 border-dashed border-blue-400 rounded z-10 pointer-events-none">
            <div className="text-center">
              <Paperclip size={24} className="mx-auto text-blue-500 mb-1" />
              <p className="text-sm font-medium text-blue-600">{t("webmail.drop_files_here")}</p>
            </div>
          </div>
        )}
        <div ref={editorRef} contentEditable suppressContentEditableWarning tabIndex={0}
          className="w-full h-full min-h-[180px] p-4 text-sm focus:outline-none leading-relaxed"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: 14, color: "#334155", lineHeight: 1.6 }}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
            }
          }}
          onPaste={(e) => {
            // Allow pasting rich content (images, formatted text)
            const html = e.clipboardData.getData("text/html");
            if (html) {
              e.preventDefault();
              document.execCommand("insertHTML", false, html);
            }
          }}
          data-placeholder={t("webmail.editor_placeholder")}
        />
      </div>

      {/* Attachments */}
      {(attachments.length > 0 || forwardedAttachments.length > 0) && (
        <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {forwardedAttachments.map((att, idx) => (
              <div key={`fwd-${att.filename}-${idx}`} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700" title={t("webmail.forwarded_attachment")}>
                <Forward size={10} className="text-blue-500" />
                <span className="truncate max-w-[120px]">{att.filename}</span>
                <span className="text-slate-400">({formatFileSize(att.size)})</span>
                <button onClick={() => setForwardedAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
              </div>
            ))}
            {attachments.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                <Paperclip size={10} className="text-slate-400" />
                <span className="truncate max-w-[120px]">{file.name}</span>
                <span className="text-slate-400">({formatFileSize(file.size)})</span>
                <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="px-4 py-2 bg-red-50 text-xs text-red-600 border-t border-red-200">{error}</div>}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50 rounded-b-none flex-shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))]">
        <button onClick={handleSend} disabled={sending || !to.trim()}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
          <Send size={14} /> {sending ? t("webmail.sending") : t("webmail.send")}
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 text-slate-500 text-sm hover:bg-slate-200 rounded-lg cursor-pointer">
          <Paperclip size={14} /> <span className="hidden md:inline">{t("webmail.attachment_btn")}</span>
        </button>
        <button onClick={openNcPicker}
          className="flex items-center gap-1.5 px-3 py-2 text-slate-500 text-sm hover:bg-blue-50 hover:text-blue-600 rounded-lg cursor-pointer">
          <Cloud size={14} /> <span className="hidden md:inline">NextCloud</span>
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
        <div className="flex-1" />
        <button onClick={onClose} className="px-4 py-2 text-slate-500 text-sm hover:bg-slate-200 rounded-lg cursor-pointer">{t("common.cancel")}</button>
      </div>

      {/* NextCloud file picker modal */}
      {showNcPicker && (
        <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowNcPicker(false)}>
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-w-[95vw] max-h-[400px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-slate-800">{t("webmail.nextcloud_picker_title")}</span>
              </div>
              <button onClick={() => setShowNcPicker(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
            </div>
            {/* Breadcrumb */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1 text-xs text-slate-500 flex-shrink-0">
              <button onClick={() => ncBrowse("/")} className="hover:text-blue-600 cursor-pointer font-medium">{t("webmail.home")}</button>
              {ncPath.split("/").filter(Boolean).map((seg, i, arr) => {
                const path = "/" + arr.slice(0, i + 1).join("/");
                return (
                  <span key={path} className="flex items-center gap-1">
                    <ChevronRight size={10} />
                    <button onClick={() => ncBrowse(path)} className="hover:text-blue-600 cursor-pointer">{seg}</button>
                  </span>
                );
              })}
            </div>
            {/* File list */}
            <div className="flex-1 overflow-y-auto">
              {ncLoading && <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>}
              {!ncLoading && ncFiles.length === 0 && <p className="text-xs text-slate-400 text-center py-8">{t("webmail.empty_folder")}</p>}
              {!ncLoading && ncFiles.map(f => (
                <div key={f.path}
                  className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 border-b border-slate-50 text-sm cursor-pointer"
                  onClick={() => f.isDirectory ? ncBrowse(f.path) : undefined}
                >
                  {f.isDirectory
                    ? <Folder size={16} className="text-yellow-500 shrink-0" />
                    : <File size={16} className="text-slate-400 shrink-0" />
                  }
                  <span className="flex-1 truncate text-slate-700">{f.name}</span>
                  {!f.isDirectory && (
                    <span className="text-[10px] text-slate-400 shrink-0">{formatFileSize(f.size)}</span>
                  )}
                  {/* Link button — works for both files and folders */}
                  <button
                    onClick={(e) => { e.stopPropagation(); ncInsertLink(f.path, f.name); }}
                    disabled={ncAdding.has(f.path)}
                    title={t("webmail.tt_insert_link_email")}
                    className="px-2 py-1 text-xs bg-slate-50 text-slate-600 rounded hover:bg-slate-100 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1">
                    {ncAdding.has(f.path) ? <Loader2 size={12} className="animate-spin" /> : <><Link2 size={11} /> {t("webmail.link_label")}</>}
                  </button>
                  {/* Attach button — only for files */}
                  {!f.isDirectory && (
                    <button
                      onClick={(e) => { e.stopPropagation(); ncAttachFile(f.path, f.name); }}
                      disabled={ncAdding.has(f.path)}
                      title={t("webmail.tt_add_as_attachment")}
                      className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1">
                      {ncAdding.has(f.path) ? <Loader2 size={12} className="animate-spin" /> : <><Paperclip size={11} /> {t("webmail.attachment_label")}</>}
                    </button>
                  )}
                  {f.isDirectory && !ncAdding.has(f.path) && <ChevronRight size={14} className="text-slate-300 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
