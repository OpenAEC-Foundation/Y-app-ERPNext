/**
 * Standalone email-viewer rendered OUTSIDE the Y-app shell.
 *
 * Mounted at /mail/view?uid=...&folder=...&acct=... by App.tsx,
 * accessed via window.open() from the message list double-click.
 *
 * Deliberately minimal Y-app chrome (no Sidebar, no InstanceTabBar, no
 * DataContext), but rich enough that the user kan koppelen aan ERPNext-projecten,
 * follow-ups starten, attachments downloaden en direct beantwoorden / doorsturen
 * binnen dezelfde tab (W4/W5).
 *
 * De X-Y-App-Instance header is required by the API; lib/instances.ts leest
 * de actieve instance uit localStorage — same source als elders.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Reply, ReplyAll, Forward, Paperclip, Loader2,
  Trash2, FolderKanban, ChevronDown, ExternalLink, Zap,
  X, Send, RefreshCw, Bold, Italic, Underline,
  CheckSquare, FileBarChart, Receipt, User, Plus, Check, UserPlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActiveInstance, getActiveInstanceId } from "../lib/instances";
import { readMailBody, persistMailBody } from "../lib/mail-cache-db";
import { fetchList, fetchDocument, getFileUrl, getErpNextLinkUrl } from "../lib/erpnext";
import { isFeatureEnabled, type ServerFeature } from "../lib/capabilities";
import { getMessageBody, markRead } from "../lib/mail-erpnext";
import { getEmailProjectLinks, setEmailProjectLink, hydrateEmailProjectLinks } from "../lib/email-project-links";
import { matchProjectFromFolder } from "../lib/project-folder-match";
import { SaveToNasDialog } from "../components/SaveToNasDialog";
import { MessageAttachments } from "../components/MessageAttachments";
import ErpAttachmentList from "../components/mail/ErpAttachmentList";
import MailConnectionChips from "../components/mail/MailConnectionChips";
import {
  categoryOfDoctype, loadConnectionIndex, peekConnectionIndex,
  type ConnectionIndex, type MailConnection,
} from "../lib/mail-connections";
import { isInlineAttachment, arrayBufferToBase64 } from "../lib/attachment-utils";
import { attachExternalLinkHandler } from "../lib/mail-format";
import { makeExternalLinkOpener } from "../lib/desktop";
import BookPurchaseInvoiceDialog from "../components/BookPurchaseInvoiceDialog";
import CreateLeadDialog from "../components/CreateLeadDialog";
import AddRelationDialog from "../components/AddRelationDialog";
import SenderRelationAction, { type RelationSlotTone } from "../components/SenderRelationAction";
import {
  lookupExistingCached, primeRelationLookup, type ExistingRelation, type RelationResult,
} from "../lib/erp-relation";
import { plainTextFromHtml, type SupplierHint } from "../lib/invoice-detect";
import type { BookingResult } from "../lib/purchase-invoice";
import {
  classifyMailIntent, classifySender,
  type MailIntentContext,
} from "../lib/mail-intent";
import { fetchMailIntentContext } from "../lib/lead";
import {
  dismissMailSuggestion, isMailSuggestionDismissed, readDismissedMailSuggestions,
} from "../lib/mail-suggestions";
import { suggestProject, type ProjectHint, type ProjectSuggestion } from "../lib/project-suggest";
import { fetchProjectHints, fetchSenderProjectHistory, linkMailToProject } from "../lib/project-link";

interface MailAddress {
  name: string;
  address: string;
}

interface AttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid?: string;
  contentDisposition?: string;
}

interface MailMessageFull {
  uid: number;
  subject: string;
  from: MailAddress[];
  to: MailAddress[];
  cc: MailAddress[];
  date: string | null;
  seen: boolean;
  flagged: boolean;
  textBody: string;
  htmlBody: string;
  attachments?: AttachmentMeta[];
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

interface ProjectRow {
  name: string;
  project_name: string;
}

interface ContactRow {
  name: string;
  first_name: string;
  last_name: string;
  email_id: string;
  company_name: string;
  phone: string;
  mobile_no: string;
}

type ComposeMode = "reply" | "replyAll" | "forward";
interface ComposeDraft {
  mode: ComposeMode;
  to: string;
  cc: string;
  subject: string;
  quoteHtml: string;
  forwardedAttachments: { filename: string; contentType: string; size: number; url: string }[];
}

interface ForwardedAttachment {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

function formatAddress(addrs: MailAddress[]): string {
  if (!addrs || addrs.length === 0) return "";
  return addrs.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ");
}

function formatDate(d: string | null): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleString("nl-NL", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// `isInlineAttachment` verplaatst naar lib/attachment-utils.ts (gedeeld
// met Webmail's ReadingPane). Geen lokale duplicaat meer.

function textBodyToHtml(text: string): string {
  const escaped = (text || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  return escaped.replace(/\r?\n/g, "<br>");
}

async function fetchSignature(emailAddress: string): Promise<string> {
  const key = emailAddress.toLowerCase();
  const id = getActiveInstanceId();
  const lsKey = `mail_signature_v5_${id}_${key}`;
  const raw = localStorage.getItem(lsKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { sig: string; ts: number };
      if (parsed.sig || Date.now() - parsed.ts < 24 * 60 * 60 * 1000) return parsed.sig;
    } catch { /* fall through */ }
  }
  try {
    const res = await fetch(`/api/mail/signature?email=${encodeURIComponent(emailAddress)}`, { credentials: "same-origin" });
    if (res.ok) {
      const json = await res.json();
      const sig = json.data?.signature || "";
      localStorage.setItem(lsKey, JSON.stringify({ sig, ts: Date.now() }));
      return sig;
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Popout-parameters. De Y-next-popout gebruikt een **hash**-route
 * (`…/y-next#/mail/view?msg=<Communication>`) omdat de app als Frappe Web Page
 * onder één vast pad draait en er dus geen echte `/mail/view`-URL bestaat; de
 * klassieke Y-app-popout gebruikt een echt pad met querystring. Deze helper
 * leest allebei, hash eerst.
 */
function readPopoutParams(): URLSearchParams {
  const hash = typeof window !== "undefined" ? window.location.hash || "" : "";
  const q = hash.indexOf("?");
  if (q >= 0) return new URLSearchParams(hash.slice(q + 1));
  return new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
}

function ImapMailView() {
  const [msg, setMsg] = useState<MailMessageFull | null>(null);
  // Body-iframe groeit mee met de werkelijke inhoud i.p.v. vast op h-full: een
  // iframe schaalt nooit automatisch naar zijn content, dus zonder dit toont
  // de iframe zijn EIGEN interne scrollbar (inhoud "loopt niet door") in
  // plaats van dat de buitenste pagina scrolt. allow-same-origin is nodig om
  // de hoogte te kunnen meten — zelfde sandbox-afweging als ReadingPane.tsx
  // (hoofdapp-leespaneel) voor exact dezelfde untrusted-HTML-mailbody.
  const bodyIframeRef = useRef<HTMLIFrameElement>(null);
  const [bodyIframeHeight, setBodyIframeHeight] = useState(500);
  function handleBodyIframeLoad() {
    try {
      const doc = bodyIframeRef.current?.contentDocument;
      if (!doc) return;
      // Zorg dat http(s)-links in een nieuw tabblad openen (zie ReadingPane).
      // Op desktop opent de opener via de systeembrowser (Tauri slikt window.open).
      attachExternalLinkHandler(doc, makeExternalLinkOpener());
      const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight || 0);
      setBodyIframeHeight(Math.max(500, h + 32));
    } catch { /* cross-origin edge case — blijft op de huidige hoogte staan */ }
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [toast, setToast] = useState<string>("");

  // W4 state
  const [linkedProject, setLinkedProject] = useState<string>("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [contactStatus, setContactStatus] = useState<{ found: boolean; id?: string; company?: string } | null>(null);
  const [showCrm, setShowCrm] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmResults, setCrmResults] = useState<ContactRow[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // W5 compose state
  const [compose, setCompose] = useState<ComposeDraft | null>(null);

  // NAS-opslag state (zelfde patroon als Webmail's ReadingPane)
  const [saveToNasOpen, setSaveToNasOpen] = useState(false);
  const saveToNasAttachments = useMemo(() => {
    if (!msg?.attachments) return [];
    return msg.attachments
      .map((a, idx) => ({ att: a, index: idx }))
      .filter(({ att }) => !isInlineAttachment(att, msg.htmlBody))
      .map(({ att, index }) => ({
        index,
        filename: att.filename || `bijlage-${index}`,
        size: att.size || 0,
      }));
  }, [msg]);
  // Bijlage altijd via fetch ophalen (niet window.open): de fetch-interceptor zet
  // de X-Y-App-Instance header erop, die /api/mail/attachment achter authMiddleware
  // vereist. Een directe window.open-navigatie kan die header niet sturen → 401.
  async function fetchAttachmentBlob(index: number): Promise<Blob> {
    const url = `/api/mail/attachment?${bq({ index: String(index) })}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.blob();
  }

  async function fetchAttachmentBytesForNas(index: number): Promise<ArrayBuffer> {
    return (await fetchAttachmentBlob(index)).arrayBuffer();
  }

  // NextCloud opslag — zelfde patroon als Webmail's ReadingPane
  const [ncSaving, setNcSaving] = useState<string | null>(null);
  const NC_SAVE_TARGET = "/Email Attachments";

  async function saveAttachmentToNextCloud(index: number) {
    const att = msg?.attachments?.[index];
    if (!att) return;
    const fn = att.filename;
    setNcSaving(fn);
    try {
      const url = `/api/mail/attachment?${bq({ index: String(index) })}`;
      const resp = await fetch(url, { credentials: "same-origin" });
      if (!resp.ok) throw new Error("Bijlage ophalen mislukt");
      const blob = await resp.blob();
      const ncPath = `${NC_SAVE_TARGET.replace(/\/$/, "")}/${fn}`;
      const uploadResp = await fetch(`/api/nextcloud/upload?path=${encodeURIComponent(ncPath)}`, {
        method: "PUT",
        headers: { "Content-Type": att.contentType || "application/octet-stream" },
        credentials: "same-origin",
        body: blob,
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Upload mislukt");
      }
      setToast(`${fn} opgeslagen in NextCloud`);
    } catch (err) {
      console.error("NextCloud save failed:", err);
      alert(`NextCloud-opslag mislukt: ${(err as Error).message}`);
    } finally {
      setNcSaving(null);
    }
  }

  async function saveAllAttachmentsToNextCloud() {
    if (!msg?.attachments) return;
    setNcSaving("all");
    try {
      for (let i = 0; i < msg.attachments.length; i++) {
        if (!isInlineAttachment(msg.attachments[i], msg.htmlBody)) {
          await saveAttachmentToNextCloud(i);
        }
      }
    } finally {
      setNcSaving(null);
    }
  }

  const params = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      uid: sp.get("uid") || sp.get("msg") || "",
      folder: sp.get("folder") || "INBOX",
      acct: sp.get("acct") || "",
      // Server needs `email` om de IMAP-creds te resolven via ERPNext-fallback
      // wanneer er nog geen cached mail-session is voor deze (yAppSid, instance).
      email: sp.get("email") || "",
      // Vault-account (eigen login): de hoofd-Webmail geeft `account=<id>` mee
      // zodat de server de juiste mailbox-creds uit de vault ontsleutelt.
      account: sp.get("account") || "",
    };
  }, []);

  function bq(extra: Record<string, string> = {}): string {
    const q = new URLSearchParams(extra);
    q.set("folder", params.folder);
    q.set("uid", params.uid);
    if (params.acct) q.set("acct", params.acct);
    if (params.email) q.set("email", params.email);
    if (params.account) q.set("account", params.account);
    return q.toString();
  }

  useEffect(() => {
    if (!params.uid) {
      setError("Missing uid in URL");
      setLoading(false);
      return;
    }
    const q = new URLSearchParams();
    q.set("folder", params.folder);
    q.set("uid", params.uid);
    if (params.acct) q.set("acct", params.acct);
    if (params.email) q.set("email", params.email);
    if (params.account) q.set("account", params.account);

    const instId = getActiveInstanceId();
    // Body-cache-namespace gelijk aan de hoofd-Webmail: vault-account → `v:<id>`,
    // anders gedeeld-postvak-email of "" (primary).
    const acct = params.account ? `v:${params.account}` : (params.acct || "");
    const uidNum = parseInt(params.uid, 10);
    let cancelled = false;
    (async () => {
      // 1) Lokale body-cache → instant + offline, net als in de hoofd-Webmail.
      if (instId && instId !== "default" && Number.isFinite(uidNum)) {
        const idb = await readMailBody<MailMessageFull>(instId, acct, params.folder, uidNum);
        if (!cancelled && idb?.body) {
          setMsg(idb.body);
          if (idb.body.subject) document.title = idb.body.subject;
          setLoading(false);
          // Body kwam via PEEK → markeer alsnog read op de server (best-effort).
          fetch(`/api/mail/mark-read?${q.toString()}`, { method: "POST", credentials: "same-origin" }).catch(() => {});
          return;
        }
      }
      // 2) Server, daarna lokaal opslaan voor de volgende keer.
      try {
        const r = await fetch(`/api/mail/message?${q.toString()}`, { credentials: "same-origin" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (cancelled) return;
        if (json.data) {
          setMsg(json.data);
          if (json.data.subject) document.title = json.data.subject;
          if (instId && instId !== "default" && Number.isFinite(uidNum)) {
            const md = json.data.date ? new Date(json.data.date).getTime() : Date.now();
            persistMailBody(instId, acct, params.folder, uidNum, json.data, md || Date.now()).catch(() => {});
          }
        } else {
          setError("Bericht niet gevonden");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Onbekende fout");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.uid, params.folder, params.acct]);

  // Load project list (one-time)
  useEffect(() => {
    fetchList<ProjectRow>("Project", {
      fields: ["name", "project_name"],
      filters: [["status", "in", ["Open", "Working", "Pending Review"]]],
      limit_page_length: 500,
      order_by: "modified desc",
    }).then(setProjects).catch(() => setProjects([]));
    // Popout = nieuwe browser-tab = lege email-project-links cache. Hydrate
    // van server zodat de groene chip ook in de popout zichtbaar is. Na de
    // async hydrate herevalueren we linkedProject voor de huidige mail —
    // anders heeft de msg-useEffect een race verloren tegen de fetch.
    hydrateEmailProjectLinks().then(() => {
      if (msg) {
        const emailKey = `${msg.uid}:${msg.subject}`;
        const stored = getEmailProjectLinks()[emailKey];
        if (stored) {
          setLinkedProject(stored);
        } else {
          // Runtime folder-auto-detect (zoals Webmail's ReadingPane).
          // Bewust niet persisten — folder-naam is bron van waarheid.
          const autoMatch = matchProjectFromFolder(params.folder, projects);
          setLinkedProject(autoMatch ? autoMatch.name : "");
        }
      }
    });
  }, [msg, projects, params.folder]);

  // Check linked project + contact status when message changes
  useEffect(() => {
    if (!msg) return;
    const emailKey = `${msg.uid}:${msg.subject}`;
    const stored = getEmailProjectLinks()[emailKey];
    if (stored) {
      setLinkedProject(stored);
    } else {
      // Runtime folder-auto-detect; folder-naam is bron van waarheid.
      const autoMatch = matchProjectFromFolder(params.folder, projects);
      setLinkedProject(autoMatch ? autoMatch.name : "");
    }

    const sender = msg.from?.[0]?.address || "";
    if (sender) {
      const cp = new URLSearchParams({
        filters: JSON.stringify([["email_id", "=", sender]]),
        fields: JSON.stringify(["name", "company_name"]),
        limit_page_length: "1",
      });
      fetch(`/api/resource/Contact?${cp}`, { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const c = data?.data?.[0];
          setContactStatus(c ? { found: true, id: c.name, company: c.company_name } : { found: false });
        })
        .catch(() => setContactStatus(null));
    }
  }, [msg, projects, params.folder]);

  // CRM debounced search
  useEffect(() => {
    if (!crmSearch.trim() || !showCrm) { setCrmResults([]); return; }
    const timer = setTimeout(async () => {
      setCrmLoading(true);
      try {
        const q = crmSearch.trim();
        const params = new URLSearchParams({
          filters: JSON.stringify([["email_id", "like", `%${q}%`]]),
          fields: JSON.stringify(["name", "first_name", "last_name", "email_id", "company_name", "phone", "mobile_no"]),
          limit_page_length: "20",
        });
        const res = await fetch(`/api/resource/Contact?${params}`, { credentials: "same-origin" });
        const data = res.ok ? ((await res.json()).data || []) : [];
        setCrmResults(data);
      } catch {
        setCrmResults([]);
      } finally {
        setCrmLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [crmSearch, showCrm]);

  // Open: PDF/afbeelding/tekst inline in een nieuw tabblad, overige types downloaden.
  // Het tabblad wordt SYNCHROON binnen de klik geopend (anders blokt de popup-blocker
  // het na de async blob-fetch); daarna navigeren we het naar de blob-URL.
  async function openAttachment(idx: number) {
    const att = msg?.attachments?.[idx];
    const ct = att?.contentType || "";
    const fn = att?.filename || "bijlage";
    if (!(ct === "application/pdf" || ct.startsWith("image/") || ct.startsWith("text/"))) {
      downloadAttachment(idx);
      return;
    }
    const win = window.open("", "_blank");
    if (win) {
      try { win.document.write('<!doctype html><title>' + fn + '</title><body style="margin:0;font-family:Segoe UI,sans-serif;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh">Bijlage laden…</body>'); } catch { /* ignore */ }
    }
    try {
      const blob = await fetchAttachmentBlob(idx);
      const blobUrl = URL.createObjectURL(blob);
      if (win) {
        win.location.href = blobUrl;
      } else {
        // Popup geblokkeerd → val terug op een download.
        const a = document.createElement("a");
        a.href = blobUrl; a.download = fn;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err) {
      if (win) { try { win.close(); } catch { /* ignore */ } }
      setToast(`Bijlage openen mislukt: ${(err as Error).message}`);
    }
  }

  async function downloadAttachment(idx: number) {
    const fn = msg?.attachments?.[idx]?.filename || "bijlage";
    try {
      const blob = await fetchAttachmentBlob(idx);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setToast(`Bijlage downloaden mislukt: ${(err as Error).message}`);
    }
  }

  async function downloadAll() {
    const atts = msg?.attachments || [];
    for (let i = 0; i < atts.length; i++) {
      if (!isInlineAttachment(atts[i], msg?.htmlBody)) {
        await downloadAttachment(i);
      }
    }
  }

  async function handleDelete() {
    if (!msg) return;
    if (!confirm("Bericht verwijderen?")) return;
    try {
      const p = new URLSearchParams({ folder: params.folder, uid: String(msg.uid) });
      if (params.acct) p.set("acct", params.acct);
      const trashOv = localStorage.getItem(`pref_${getActiveInstanceId()}_trash_folder`);
      if (trashOv) p.set("trashFolder", trashOv);
      const r = await fetch(`/api/mail/message?${p}`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setToast("Bericht verplaatst naar Verwijderd");
      setTimeout(() => window.close(), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function linkToProject(projectName: string | null) {
    if (!msg) return;
    const emailKey = `${msg.uid}:${msg.subject}`;
    setEmailProjectLink(emailKey, projectName);
    setLinkedProject(projectName || "");
    setShowProjectPicker(false);
    setProjectSearch("");
  }

  function handleFollowUp(action: "task" | "quotation" | "project" | "purchase-invoice") {
    if (!msg) return;
    const inst = getActiveInstance();
    if (!inst?.url) { setToast("ERPNext URL niet beschikbaar"); return; }
    const subject = msg.subject || "";
    const senderName = msg.from?.[0]?.name || msg.from?.[0]?.address || "";
    const senderEmail = msg.from?.[0]?.address || "";
    const bodyPreview = (msg.textBody || "").slice(0, 500);
    const p = new URLSearchParams();
    switch (action) {
      case "task":
        p.set("subject", subject);
        if (bodyPreview) p.set("description", `Van: ${senderName} <${senderEmail}>\nOnderwerp: ${subject}\n\n${bodyPreview}`);
        window.open(`${inst.url}/app/task/new?${p}`, "_blank");
        break;
      case "quotation":
        if (subject) p.set("title", subject);
        if (senderName) p.set("party_name", senderName);
        window.open(`${inst.url}/app/quotation/new?${p}`, "_blank");
        break;
      case "project": {
        // Open the in-app project create sidebar (Y-app /projects) instead
        // of redirecting to ERPNext. MailView is itself a standalone tab,
        // so we window.open the Y-app route in another tab/window — the
        // sidebar there auto-opens and the customer hint is matched against
        // the loaded customer list.
        const pp = new URLSearchParams();
        pp.set("create", "1");
        if (senderName) pp.set("customer", senderName);
        window.open(`/projects?${pp.toString()}`, "_blank");
        break;
      }
      case "purchase-invoice":
        if (subject) p.set("bill_no", subject);
        window.open(`${inst.url}/app/purchase-invoice/new?${p}`, "_blank");
        break;
    }
    setShowFollowUp(false);
  }

  async function addContactFromSender() {
    if (!msg) return;
    const sender = msg.from?.[0];
    if (!sender?.address) return;
    const [first_name, ...rest] = (sender.name || sender.address.split("@")[0]).split(" ");
    try {
      const r = await fetch(`/api/resource/Contact`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name,
          last_name: rest.join(" "),
          email_ids: [{ email_id: sender.address, is_primary: 1 }],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setToast("Contact toegevoegd in ERPNext");
      setContactStatus({ found: true });
    } catch (e) {
      setError("Toevoegen contact mislukt: " + (e as Error).message);
    }
  }

  function openCompose(mode: ComposeMode) {
    if (!msg) return;
    const sender = msg.from?.[0];
    const senderName = sender?.name || sender?.address || "";
    const senderEmail = sender?.address || "";
    const dateStr = formatDate(msg.date);

    let to = "";
    let cc = "";
    let subject = msg.subject || "";
    let header = "";
    let forwardedAttachments: ForwardedAttachment[] = [];

    if (mode === "reply") {
      to = senderEmail;
      subject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
      header = `Op ${dateStr} schreef ${senderName} <${senderEmail}>:`;
    } else if (mode === "replyAll") {
      to = senderEmail;
      cc = (msg.cc || []).map(a => a.address).filter(Boolean).join(", ");
      const others = msg.to.filter(a => a.address && a.address !== senderEmail).map(a => a.address);
      if (others.length) cc = cc ? `${cc}, ${others.join(", ")}` : others.join(", ");
      subject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
      header = `Op ${dateStr} schreef ${senderName} <${senderEmail}>:`;
    } else {
      subject = subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
      header = `Doorgestuurd bericht van ${senderName} <${senderEmail}> op ${dateStr}:`;
      // Forward: include attachments
      const atts = msg.attachments || [];
      forwardedAttachments = atts
        .map((att, idx) => ({ att, idx }))
        .filter(({ att }) => !isInlineAttachment(att, msg.htmlBody))
        .map(({ att, idx }) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          url: `/api/mail/attachment?${bq({ index: String(idx) })}`,
        }));
    }

    const quoteHtml = `<div style="margin-top:16px;color:#475569;">${header}</div><blockquote style="border-left:2px solid #cbd5e1;padding-left:12px;margin:8px 0 0 0;color:#475569;">${msg.htmlBody || textBodyToHtml(msg.textBody)}</blockquote>`;
    setCompose({ mode, to, cc, subject, quoteHtml, forwardedAttachments });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error || !msg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-lg p-6 max-w-md text-center">
          <p className="text-sm text-slate-600">{error || "Bericht niet beschikbaar"}</p>
          <button onClick={() => window.close()} className="mt-4 px-4 py-2 text-sm bg-slate-700 text-white rounded hover:bg-slate-800 cursor-pointer">
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  const filteredProjects = projectSearch
    ? projects.filter(p =>
        (p.project_name || "").toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    : projects.slice(0, 50);

  const linkedProjectLabel = projects.find(p => p.name === linkedProject)?.project_name || linkedProject;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header — compact, matches Webmail ReadingPane style */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        {/* Row 1: action toolbar right-aligned */}
        <div className="flex flex-wrap items-center gap-1 justify-end mb-2">
          <button onClick={() => openCompose("reply")} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
            <Reply size={14} /> Beantwoorden
          </button>
          <button onClick={() => openCompose("replyAll")} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
            <ReplyAll size={14} /> Allen
          </button>
          <button onClick={() => openCompose("forward")} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
            <Forward size={14} /> Doorsturen
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <div className="relative">
            <button onClick={() => setShowFollowUp(!showFollowUp)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-amber-50 hover:text-amber-700 cursor-pointer">
              <Zap size={14} /> Vervolgactie <ChevronDown size={10} />
            </button>
            {showFollowUp && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFollowUp(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-52 z-50">
                  <button onClick={() => handleFollowUp("task")} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2.5">
                    <CheckSquare size={14} className="text-blue-500" /> Taak aanmaken
                  </button>
                  <button onClick={() => handleFollowUp("quotation")} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-2.5">
                    <FileBarChart size={14} className="text-purple-500" /> Offerte aanmaken
                  </button>
                  <button onClick={() => handleFollowUp("project")} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer flex items-center gap-2.5">
                    <FolderKanban size={14} className="text-teal-500" /> Project aanmaken
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button onClick={() => handleFollowUp("purchase-invoice")} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-700 cursor-pointer flex items-center gap-2.5">
                    <Receipt size={14} className="text-green-500" /> Inkoopfactuur
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowCrm(!showCrm)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
            <User size={14} /> CRM
          </button>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <button onClick={handleDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-red-50 hover:text-red-600 cursor-pointer">
            <Trash2 size={14} /> Verwijderen
          </button>
        </div>

        {/* Row 2: subject + project link inline */}
        <div className="flex flex-wrap items-center gap-2 min-w-0 mb-3">
          <h1 className="text-lg font-semibold text-slate-800 truncate min-w-0 flex-1">
            {msg.subject || "(geen onderwerp)"}
          </h1>
          <div className="flex items-center gap-1.5 shrink-0">
            <FolderKanban size={13} className="text-teal-500 shrink-0" />
            {linkedProject ? (
              <>
                <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full truncate max-w-[180px]" title={linkedProjectLabel}>
                  {linkedProjectLabel}
                </span>
                <button onClick={() => {
                  const inst = getActiveInstance();
                  if (inst?.url) window.open(`${inst.url}/app/project/${encodeURIComponent(linkedProject)}`, "_blank");
                }} className="text-[10px] text-teal-600 hover:text-teal-800 cursor-pointer"><ExternalLink size={10} /></button>
                <button onClick={() => linkToProject(null)} className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
              </>
            ) : (
              <div className="relative">
                <button onClick={() => setShowProjectPicker(!showProjectPicker)} className="text-xs text-slate-500 hover:text-teal-600 cursor-pointer flex items-center gap-1">
                  <Plus size={11} /> Toevoegen aan project
                </button>
                {showProjectPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-80 z-50 overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <input type="text" autoFocus value={projectSearch}
                          onChange={(e) => setProjectSearch(e.target.value)}
                          placeholder="Zoek project..."
                          className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto">
                        {filteredProjects.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">Geen projecten gevonden</p>
                        )}
                        {filteredProjects.map(p => (
                          <button key={p.name} onClick={() => linkToProject(p.name)}
                            className="w-full text-left px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center gap-2 border-b border-slate-50">
                            <FolderKanban size={13} className="text-teal-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-slate-700 truncate">{p.project_name || p.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{p.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: sender info + contact badge */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(msg.from[0]?.name || msg.from[0]?.address || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{msg.from[0]?.name || msg.from[0]?.address}</span>
              <span className="text-xs text-slate-400">&lt;{msg.from[0]?.address}&gt;</span>
              {contactStatus !== null && (
                contactStatus.found ? (
                  <button onClick={() => {
                    const inst = getActiveInstance();
                    if (inst?.url && contactStatus.id) window.open(`${inst.url}/app/contact/${encodeURIComponent(contactStatus.id)}`, "_blank");
                  }} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full cursor-pointer hover:bg-green-100">
                    <Check size={9} /> Contact {contactStatus.company && <span className="text-green-500">· {contactStatus.company}</span>}
                  </button>
                ) : (
                  <button onClick={addContactFromSender}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full cursor-pointer hover:bg-amber-100">
                    <Plus size={9} /> Voeg contact toe
                  </button>
                )
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 space-y-0.5">
              <div><span className="text-slate-400 mr-1">Aan:</span> {formatAddress(msg.to)}</div>
              {msg.cc && msg.cc.length > 0 && (
                <div><span className="text-slate-400 mr-1">CC:</span> {formatAddress(msg.cc)}</div>
              )}
              <div><span className="text-slate-400 mr-1">Datum:</span> {formatDate(msg.date)}</div>
            </div>
          </div>
        </div>

        {/* CRM search panel — collapsible */}
        {showCrm && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input type="text" value={crmSearch} onChange={e => setCrmSearch(e.target.value)}
              placeholder="Zoek contact op email of naam..."
              className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {crmLoading && <div className="text-xs text-slate-400 mt-2">Zoeken...</div>}
            {!crmLoading && crmResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded">
                {crmResults.map(c => (
                  <div key={c.name} className="px-3 py-2 text-xs border-b border-slate-100 last:border-b-0">
                    <div className="font-medium text-slate-700">{c.first_name} {c.last_name}</div>
                    <div className="text-slate-500">{c.email_id} {c.company_name ? `· ${c.company_name}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Attachments — shared component met Webmail's ReadingPane */}
      <MessageAttachments
        attachments={msg.attachments || []}
        htmlBody={msg.htmlBody}
        onOpen={openAttachment}
        onDownload={downloadAttachment}
        onDownloadAll={downloadAll}
        onSaveToNextCloud={saveAttachmentToNextCloud}
        onSaveAllToNextCloud={saveAllAttachmentsToNextCloud}
        onSaveToNas={() => setSaveToNasOpen(true)}
        ncSaving={ncSaving}
      />

      {/* Body */}
      <main className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <iframe
            ref={bodyIframeRef}
            title={msg.subject || "Email"}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            srcDoc={`<!DOCTYPE html><html><head><base target="_blank"></head><body>${msg.htmlBody || `<pre style="font-family:sans-serif;padding:16px;white-space:pre-wrap;">${(msg.textBody || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c))}</pre>`}</body></html>`}
            onLoad={handleBodyIframeLoad}
            className="w-full border-0"
            style={{ height: `${bodyIframeHeight}px` }}
          />
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg z-50"
          onAnimationEnd={() => setTimeout(() => setToast(""), 3000)}>
          {toast}
        </div>
      )}

      {/* W5: Inline compose overlay */}
      {compose && (
        <StandaloneCompose
          draft={compose}
          // De reply-From MOET de eigen mailbox-identiteit van deze popout zijn,
          // niet zomaar de eerste To-header van de ontvangen mail. Was de mail
          // aan een gedeeld adres (cooperatie@) gericht met piet@ in Cc of via
          // alias, dan zou `msg.to[0]` de From op het verkeerde adres zetten.
          // Volgorde: shared mailbox (acct) → eigen primary mailbox (email) →
          // pas dan terugval op de To-header.
          fromAddr={params.acct || params.email || msg.to[0]?.address || ""}
          acct={params.acct}
          account={params.account}
          inReplyTo={msg.messageId}
          references={[msg.references, msg.messageId].filter(Boolean).join(" ")}
          projects={projects}
          onClose={() => setCompose(null)}
          onSent={(warn?: string) => { setCompose(null); setToast(warn || "Bericht verzonden"); }}
        />
      )}

      {/* NAS-opslag dialog */}
      <SaveToNasDialog
        open={saveToNasOpen}
        onClose={() => setSaveToNasOpen(false)}
        instanceId={getActiveInstanceId()}
        subject={msg.subject || ""}
        from={msg.from?.[0]?.name || msg.from?.[0]?.address}
        attachments={saveToNasAttachments}
        fetchAttachmentBytes={fetchAttachmentBytesForNas}
        onToast={setToast}
        linkedProjectName={linkedProject || undefined}
        currentFolder={params.folder}
      />
    </div>
  );
}

/* ─── W5: Inline compose component (mounted binnen MailView, blijft in cleane tab) ─── */

interface StandaloneComposeProps {
  draft: ComposeDraft;
  fromAddr: string;
  /** Shared-mailbox marker (URL `acct=`) — server verstuurt met dat account. */
  acct?: string;
  /** Vault-account-id (URL `account=`) — server resolvet die creds voor SMTP. */
  account?: string;
  inReplyTo?: string;
  references?: string;
  projects: ProjectRow[];
  onClose: () => void;
  onSent: (warn?: string) => void;
}

function StandaloneCompose({ draft, fromAddr, acct, account, inReplyTo, references, projects, onClose, onSent }: StandaloneComposeProps) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(!!draft.cc);
  const [subject, setSubject] = useState(draft.subject);
  const [showSubjectProject, setShowSubjectProject] = useState(false);
  const [subjectProjectSearch, setSubjectProjectSearch] = useState("");
  const subjectProjectList = (subjectProjectSearch.trim()
    ? projects.filter(p => {
        const q = subjectProjectSearch.trim().toLowerCase();
        return (p.project_name || "").toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q);
      })
    : projects).slice(0, 20);
  function addProjectToSubject(p: ProjectRow) {
    const prefix = `${p.name}${p.project_name ? " " + p.project_name : ""}`;
    setSubject(prev => (prev.trim() ? `${prefix} ${prev}` : prefix));
    setShowSubjectProject(false);
    setSubjectProjectSearch("");
  }
  const [forwardedAttachments, setForwardedAttachments] = useState(draft.forwardedAttachments);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchSignature(fromAddr).then(sig => {
      if (!editorRef.current) return;
      const sigBlock = sig ? `<br><br><div class="email-signature" style="margin-top:8px;">${sig}</div>` : "";
      editorRef.current.innerHTML = `<br><br>${sigBlock}${draft.quoteHtml}`;
      editorRef.current.focus();
    });
  }, [draft, fromAddr]);

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  async function handleSend() {
    if (!to.trim()) { setError("Aan-veld is leeg"); return; }
    setSending(true); setError("");
    try {
      const attachmentData: { filename: string; content: string; contentType: string }[] = [];
      for (const file of attachments) {
        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        attachmentData.push({ filename: file.name, content: base64, contentType: file.type || "application/octet-stream" });
      }
      for (const fwd of forwardedAttachments) {
        const res = await fetch(fwd.url, { credentials: "same-origin" });
        if (!res.ok) throw new Error(`Bijlage "${fwd.filename}" niet beschikbaar (${res.status})`);
        attachmentData.push({ filename: fwd.filename, content: arrayBufferToBase64(await res.arrayBuffer()), contentType: fwd.contentType || "application/octet-stream" });
      }

      const htmlBody = editorRef.current?.innerHTML || "";
      const plainText = editorRef.current?.innerText || "";

      const payload = {
        email: fromAddr,
        from: fromAddr,
        // Vault-/shared-account-creds resolutie op het send-pad (zelfde als
        // Webmail's handleBackgroundSend): zonder `acct`/`account` valt de
        // server terug op de primary/ERPNext-creds → verkeerd From/SMTP-auth.
        acct: acct || undefined,
        account: account || undefined,
        to: to.split(/[,;]\s*/).filter(Boolean),
        cc: cc ? cc.split(/[,;]\s*/).filter(Boolean) : undefined,
        bcc: bcc ? bcc.split(/[,;]\s*/).filter(Boolean) : undefined,
        subject,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;line-height:1.6;">${htmlBody}</div>`,
        text: plainText,
        inReplyTo,
        references,
        attachments: attachmentData.length > 0 ? attachmentData : undefined,
        // Expliciete Verzonden-map (zelfde per-instance pref als Webmail; leeg →
        // server doet auto-detectie).
        sentFolder: localStorage.getItem(`pref_${getActiveInstanceId()}_sent_folder`) || undefined,
      };

      const res = await fetch(`/api/mail/send`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({} as { error?: string; sentSaved?: boolean | null }));
      if (!res.ok) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSent(j.sentSaved === false ? "Verzonden, maar niet in de Verzonden-map opgeslagen" : undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  }

  const title = draft.mode === "reply" ? "Beantwoorden" : draft.mode === "replyAll" ? "Allen beantwoorden" : "Doorsturen";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl flex-shrink-0">
          <h2 className="font-semibold text-sm text-slate-700">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
        </div>

        {/* Headers */}
        <div className="px-4 py-2 border-b border-slate-200 flex-shrink-0 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-12 text-slate-500">Aan</span>
            <input value={to} onChange={e => setTo(e.target.value)} className="flex-1 px-2 py-1 focus:outline-none" />
            {!showCcBcc && <button onClick={() => setShowCcBcc(true)} className="text-xs text-blue-600 hover:underline cursor-pointer">Cc/Bcc</button>}
          </div>
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-12 text-slate-500">Cc</span>
                <input value={cc} onChange={e => setCc(e.target.value)} className="flex-1 px-2 py-1 focus:outline-none" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-12 text-slate-500">Bcc</span>
                <input value={bcc} onChange={e => setBcc(e.target.value)} className="flex-1 px-2 py-1 focus:outline-none" />
              </div>
            </>
          )}
          <div className="flex items-center gap-2 text-sm relative">
            <span className="w-12 text-slate-500">Onderwerp</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} className="flex-1 px-2 py-1 focus:outline-none" />
            <div className="relative shrink-0">
              <button type="button" title="Project in onderwerp"
                onClick={() => setShowSubjectProject(v => !v)}
                className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-2 py-1 rounded cursor-pointer">
                <FolderKanban size={13} /> Project
              </button>
              {showSubjectProject && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSubjectProject(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-80 z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <input type="text" value={subjectProjectSearch} onChange={e => setSubjectProjectSearch(e.target.value)}
                        placeholder="Zoek project…" autoFocus
                        className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto">
                      {subjectProjectList.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Geen projecten gevonden</p>
                      )}
                      {subjectProjectList.map(p => (
                        <button type="button" key={p.name} onClick={() => addProjectToSubject(p)}
                          className="w-full text-left px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center gap-2 border-b border-slate-50">
                          <FolderKanban size={13} className="text-teal-500 shrink-0" />
                          <div className="min-w-0 flex-1 text-xs font-medium text-slate-700 truncate flex items-center gap-1.5">
                            <span className="font-mono text-violet-700 shrink-0">{p.name}</span>
                            <span className="truncate">{p.project_name || ""}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
          <button type="button" tabIndex={-1} onClick={() => execCmd("bold")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Bold"><Bold size={14} /></button>
          <button type="button" tabIndex={-1} onClick={() => execCmd("italic")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Italic"><Italic size={14} /></button>
          <button type="button" tabIndex={-1} onClick={() => execCmd("underline")} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Underline"><Underline size={14} /></button>
          <div className="w-px h-5 bg-slate-300 mx-1" />
          <button type="button" tabIndex={-1} onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Bijlage toevoegen"><Paperclip size={14} /></button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
          <button type="button" tabIndex={-1} onClick={async () => {
            const key = fromAddr.toLowerCase();
            const id = getActiveInstanceId();
            localStorage.removeItem(`mail_signature_v5_${id}_${key}`);
            const sig = await fetchSignature(fromAddr);
            if (!sig) console.warn("[MailView] Empty signature from ERPNext for", fromAddr);
            if (editorRef.current) {
              const existing = editorRef.current.querySelector(".email-signature");
              if (existing) existing.innerHTML = sig;
            }
          }} className="p-1.5 rounded hover:bg-slate-200 text-slate-600 cursor-pointer" title="Handtekening opnieuw laden"><RefreshCw size={14} /></button>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <div ref={editorRef} contentEditable suppressContentEditableWarning
            className="w-full min-h-full focus:outline-none text-sm leading-relaxed"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#334155", lineHeight: 1.6 }}
          />
        </div>

        {/* Attachments */}
        {(forwardedAttachments.length > 0 || attachments.length > 0) && (
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {forwardedAttachments.map((att, idx) => (
                <div key={`fwd-${idx}`} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-slate-700">
                  <Forward size={10} className="text-blue-500" />
                  <span className="truncate max-w-[120px]">{att.filename}</span>
                  <span className="text-slate-400">({formatSize(att.size)})</span>
                  <button onClick={() => setForwardedAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                </div>
              ))}
              {attachments.map((file, idx) => (
                <div key={`up-${idx}`} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                  <Paperclip size={10} className="text-slate-400" />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <span className="text-slate-400">({formatSize(file.size)})</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="px-4 py-2 bg-red-50 text-xs text-red-600 border-t border-red-200">{error}</div>}

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50 rounded-b-xl flex-shrink-0">
          <button onClick={handleSend} disabled={sending || !to.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? "Bezig..." : "Verzenden"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded cursor-pointer">Annuleer</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Y-next — popout op ERPNext `Communication`
   ══════════════════════════════════════════════════════════════════════════ */

/** Webmail op ERPNext `Communication` (Y-next, geen eigen server). */
const ERPNEXT_MAIL: ServerFeature = "erpnext-mail";

interface ErpViewDoc {
  subject?: string;
  sender?: string;
  sender_full_name?: string;
  recipients?: string;
  cc?: string;
  communication_date?: string;
  seen?: number | boolean;
  has_attachment?: number | boolean;
  sent_or_received?: string;
  reference_doctype?: string;
  reference_name?: string;
}

/**
 * Standalone lezer voor één Communication. Bewust read-only: beantwoorden en
 * doorsturen gebeuren in de hoofd-Webmail, die de conversatie en de
 * projectkoppeling in beeld heeft. Zo staan hier geen knoppen die op
 * Express-endpoints leunen die in Y-next niet bestaan.
 */
function ErpNextMailView({ name }: { name: string }) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<ErpViewDoc | null>(null);
  const [body, setBody] = useState<{ html: string; attachments: { file_url: string; file_name: string }[] } | null>(null);
  // Zonder `?msg=` valt er niets te laden — dan meteen niet in de laadstand
  // beginnen (de render hieronder toont de foutkaart).
  const [loading, setLoading] = useState(Boolean(name));
  const [error, setError] = useState("");
  /** Alleen voor de popup-blocker bij een PDF-bijlage; geen laadfout. */
  const [popupError, setPopupError] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(500);

  /* ─── Mailherkenning (zelfde flow en dezelfde modules als de webmail) ─── */
  const [intentCtx, setIntentCtx] = useState<MailIntentContext>(
    () => ({ suppliers: [], customers: [] }),
  );
  const [dismissed, setDismissed] = useState(() => readDismissedMailSuggestions());
  const [bookingOpen, setBookingOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [booked, setBooked] = useState<BookingResult | null>(null);
  const [created, setCreated] = useState<{ doctype: "Lead" | "Opportunity"; result: BookingResult } | null>(null);
  /**
   * Lokale spiegel van de koppeling, zodat de chip meteen bijwerkt zonder de
   * hele Communication opnieuw op te halen.
   */
  const [localRef, setLocalRef] = useState<{ doctype: string; name: string } | null>(null);

  /* ─── Afzender → relatie (zelfde gedrag als de webmail) ─── */
  const [relationOpen, setRelationOpen] = useState(false);
  const [senderRelation, setSenderRelation] = useState<
    { email: string; found: ExistingRelation } | null
  >(null);

  /* ─── Projectsuggestie ─── */
  const [projectHints, setProjectHints] = useState<ProjectHint[]>([]);
  /** Het adres gaat mee in de state — zie de toelichting in `Webmail.tsx`. */
  const [senderHistory, setSenderHistory] = useState<{ sender: string; projects: string[] }>(
    () => ({ sender: "", projects: [] }),
  );
  const [projectError, setProjectError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchMailIntentContext()
      .then((ctx) => { if (!cancelled) setIntentCtx(ctx); })
      .catch(() => { /* herkenning uit; de lezer werkt gewoon verder */ });
    fetchProjectHints()
      .then((rows) => { if (!cancelled) setProjectHints(rows); })
      .catch(() => { /* geen projectsuggestie in de popout */ });
    return () => { cancelled = true; };
  }, []);

  const sender = doc?.sender || "";
  useEffect(() => {
    if (!sender) return;
    let cancelled = false;
    fetchSenderProjectHistory(sender)
      .then((rows) => { if (!cancelled) setSenderHistory({ sender, projects: rows }); })
      .catch(() => { /* signaal valt weg; de andere blijven */ });
    return () => { cancelled = true; };
  }, [sender]);

  // Gememoiseerd — zie de toelichting bij dezelfde regel in `Webmail.tsx`.
  const senderProjects = useMemo(
    () => (senderHistory.sender === sender ? senderHistory.projects : []),
    [senderHistory, sender],
  );

  /* ─── Afzender → relatie: is dit adres al bekend in ERPNext? ─── */
  /**
   * Alleen bij ontvangen mail — bij verzonden mail ben jíj de afzender. De
   * check loopt via `lookupExistingCached`, dus hooguit één keer per adres per
   * sessie; de popout deelt die cache met de webmail in hetzelfde tabblad.
   */
  const relationSender = doc && doc.sent_or_received !== "Sent" ? sender : "";
  useEffect(() => {
    // Zie de toelichting bij dezelfde regel in `Webmail.tsx`.
    if (!relationSender) return;
    let cancelled = false;
    lookupExistingCached(relationSender)
      .then((found) => { if (!cancelled) setSenderRelation({ email: relationSender, found }); })
      // Mislukt de check (rechten, netwerk), dan telt het adres als onbekend:
      // de knop verschijnt en ERPNext blijft bij het aanmaken zelf het vangnet.
      .catch(() => { if (!cancelled) setSenderRelation({ email: relationSender, found: {} }); });
    return () => { cancelled = true; };
  }, [relationSender]);

  /** `null` zolang de check loopt; de actie rendert dan nog niets. */
  const relationExisting = senderRelation?.email === relationSender ? senderRelation.found : null;

  /** Zie de toelichting bij dezelfde functie in `Webmail.tsx`. */
  const handleRelationCreated = (email: string, created: RelationResult) => {
    const found: ExistingRelation = { contact: created.contact };
    if (created.customer) found.customer = created.customer;
    primeRelationLookup(email, found);
    setSenderRelation({ email, found });
  };

  /**
   * De relatie-actie staat altijd op precies één plek: in de actiebalk van de
   * herkende bedoeling als die er is, anders in de chipregel onder de kop.
   * Kleur en opschrift verschillen per plek, de rest niet.
   */
  const relationSlot = (tone: RelationSlotTone, label: string) => (
    relationSender ? (
      <SenderRelationAction
        existing={relationExisting}
        tone={tone}
        label={label}
        onAdd={() => setRelationOpen(true)}
      />
    ) : null
  );

  const reference = useMemo(
    () => localRef
      ?? (doc?.reference_doctype && doc.reference_name
        ? { doctype: doc.reference_doctype, name: doc.reference_name }
        : null),
    [localRef, doc],
  );
  /**
   * Alle connecties van deze mail, niet alleen `reference_*`. Dat veld is
   * enkelvoudig, dus het toonde altijd alleen de laatst gemaakte koppeling —
   * zie `mail-connections.ts`. De momentopname wordt hier lui geladen; hij is
   * gedeeld met de webmail en dus in dezelfde tab meestal al warm.
   */
  const [connIndex, setConnIndex] = useState<ConnectionIndex | null>(() => peekConnectionIndex());
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    loadConnectionIndex()
      .then((idx) => { if (!cancelled) setConnIndex(idx); })
      .catch(() => { /* chips zijn context, geen blokkade */ });
    return () => { cancelled = true; };
  }, [name]);

  const connections = useMemo<MailConnection[]>(() => {
    if (!name) return [];
    const out = [...(connIndex?.byMessage.get(name) ?? [])];
    if (reference) {
      const category = categoryOfDoctype(reference.doctype);
      if (category && !out.some((c) => c.doctype === reference.doctype && c.name === reference.name)) {
        out.push({ doctype: reference.doctype, name: reference.name, label: reference.name, category });
      }
    }
    return out;
  }, [name, connIndex, reference]);

  const herkenningAan = intentCtx.suppliers.length > 0 || intentCtx.customers.length > 0;

  const intent = useMemo(() => {
    if (!doc || !herkenningAan) return null;
    const guess = classifyMailIntent({
      subject: doc.subject || "",
      sender: doc.sender || "",
      senderName: doc.sender_full_name || "",
      attachmentNames: (body?.attachments ?? []).map((a) => a.file_name),
      hasAttachment: Boolean(doc.has_attachment),
      bodyText: body?.html ? plainTextFromHtml(body.html) : undefined,
      mailDate: doc.communication_date,
      direction: doc.sent_or_received === "Sent" ? "sent" : "received",
      ...(reference?.doctype ? { linkedDoctype: reference.doctype } : {}),
    }, intentCtx);
    if (guess.kind === "none") return null;
    if (isMailSuggestionDismissed(dismissed, name, guess.kind)) return null;
    return guess;
  }, [doc, body, intentCtx, dismissed, reference, name, herkenningAan]);

  const projectSuggestion: ProjectSuggestion | null = useMemo(() => {
    if (!doc || projectHints.length === 0) return null;
    if (isMailSuggestionDismissed(dismissed, name, "project")) return null;
    const facts = classifySender(doc.sender || "", intentCtx);
    return suggestProject({
      subject: doc.subject || "",
      sender: doc.sender || "",
      attachmentNames: (body?.attachments ?? []).map((a) => a.file_name),
      bodyText: body?.html ? plainTextFromHtml(body.html) : undefined,
      senderProjects,
      ...(facts.customer ? { senderCustomer: facts.customer } : {}),
      direction: doc.sent_or_received === "Sent" ? "sent" : "received",
      ...(reference?.doctype ? { linkedDoctype: reference.doctype } : {}),
      intentKind: intent?.kind ?? "none",
    }, projectHints);
  }, [doc, body, projectHints, senderProjects, intentCtx, dismissed, reference, intent, name]);

  async function handleLinkProject(project: string) {
    setProjectError("");
    setLocalRef({ doctype: "Project", name: project });
    try {
      await linkMailToProject(name, project, doc?.sender);
    } catch {
      setLocalRef(null);
      setProjectError(t("y_next.proj_suggest_failed"));
    }
  }

  useEffect(() => {
    if (!name) return;
    // Geen `setLoading(true)` hier: de begintoestand staat al op laden en
    // `name` komt uit de URL van dit tabblad, dus hij verandert niet meer.
    let cancelled = false;
    Promise.all([
      fetchDocument<ErpViewDoc>("Communication", name),
      getMessageBody(name),
    ])
      .then(([headerDoc, loaded]) => {
        if (cancelled) return;
        setDoc(headerDoc);
        setBody(loaded);
        document.title = headerDoc?.subject || t("webmail.no_subject");
        // Openen = gelezen. Fire-and-forget: mislukt de schrijfactie, dan blijft
        // de mail ongelezen in de lijst — geen reden de lezer te blokkeren.
        const alreadySeen = headerDoc?.seen === 1 || headerDoc?.seen === true;
        if (!alreadySeen) void markRead(name).catch(() => {});
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name, t]);

  function handleFrameLoad() {
    try {
      const frameDoc = frameRef.current?.contentDocument;
      if (!frameDoc) return;
      attachExternalLinkHandler(frameDoc, makeExternalLinkOpener());
      const h = Math.max(frameDoc.documentElement.scrollHeight, frameDoc.body?.scrollHeight || 0);
      setFrameHeight(Math.max(500, h + 32));
    } catch { /* cross-origin edge case — hoogte blijft staan */ }
  }

  const srcDoc = body
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${getFileUrl("/")}" target="_blank">`
      + `<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;line-height:1.6;margin:16px 24px;word-wrap:break-word;overflow-wrap:anywhere;}`
      + `img{max-width:100%}a{color:#2563eb}pre,code{white-space:pre-wrap;word-break:break-word}table{max-width:100%}`
      + `blockquote{border-left:2px solid #cbd5e1;margin:0;padding-left:12px;color:#475569}</style></head><body>`
      + `${body.html || `<p style="color:#94a3b8">${t("webmail.no_content")}</p>`}</body></html>`
    : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> {t("webmail.loading_message")}
        </div>
      </div>
    );
  }

  if (!name || error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-white shadow p-6 text-center">
          <p className="text-sm font-medium text-red-700">{t("webmail.load_failed")}</p>
          {error && <p className="mt-1 text-xs text-red-600 break-words">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto bg-white shadow-sm min-h-screen">
        <div className="px-6 py-4 border-b border-slate-200">
          <h1 className="text-lg font-semibold text-slate-900 break-words">
            {doc?.subject || t("webmail.no_subject")}
          </h1>
          <p className="text-xs text-slate-500 mt-1 break-words">
            <span className="font-medium text-slate-700">{doc?.sender_full_name || doc?.sender}</span>
            {doc?.sender_full_name ? ` <${doc.sender}>` : ""}
            {` · ${formatDate(doc?.communication_date || null)}`}
          </p>
          {doc?.recipients && (
            <p className="text-[11px] text-slate-400 mt-0.5 break-words">
              Aan: {doc.recipients}{doc.cc ? ` · Cc: ${doc.cc}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MailConnectionChips connections={connections} />
            {/* Is er geen bedoeling herkend, dan is deze regel de actiebalk
                van de mail en hoort de relatie-actie hier. Staat er wél een
                factuur- of leadbalk, dan zit hij dáár — nooit op twee plekken
                tegelijk. */}
            {!intent && relationSlot("slate", t("y_next.rel_add_button"))}
          </div>
        </div>

        {intent?.kind === "purchase-invoice" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-6 py-2">
            <Receipt size={14} className="flex-shrink-0 text-amber-600" />
            <span className="text-xs font-medium text-amber-900">{t("y_next.pinv_banner")}</span>
            <span
              title={intent.reasons
                .map((r) => t(`y_next.pinv_reason_${r.replace(/[:-]/g, "_")}`, { defaultValue: r }))
                .join(" · ")}
              className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {t(`y_next.pinv_confidence_${intent.confidence}`)}
            </span>
            <div className="flex-1" />
            <button onClick={() => setBookingOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-amber-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-700">
              <Receipt size={11} /> {t("y_next.pinv_book")}
            </button>
            {relationSlot("amber", t("y_next.rel_add_button"))}
            <button
              onClick={() => { dismissMailSuggestion(name, "purchase-invoice"); setDismissed(readDismissedMailSuggestions()); }}
              className="cursor-pointer rounded px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-100">
              {t("y_next.pinv_dismiss")}
            </button>
          </div>
        )}

        {(intent?.kind === "lead" || intent?.kind === "quote-request") && (
          <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50 px-6 py-2">
            <UserPlus size={14} className="flex-shrink-0 text-violet-600" />
            <span className="text-xs font-medium text-violet-900">
              {t(intent.kind === "quote-request" ? "y_next.quote_banner" : "y_next.lead_banner")}
            </span>
            <span
              title={intent.reasons
                .map((r) => t(`y_next.intent_reason_${r.replace(/[:-]/g, "_")}`, { defaultValue: r }))
                .join(" · ")}
              className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
              {t(`y_next.lead_confidence_${intent.confidence}`)}
            </span>
            <div className="flex-1" />
            <button onClick={() => setLeadOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-violet-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-violet-700">
              <UserPlus size={11} />
              {t(intent.kind === "quote-request" ? "y_next.lead_create_quote" : "y_next.lead_create_lead")}
            </button>
            {/* Bundeling bij een onbekende afzender — dezelfde afweging als in
                `Webmail.tsx`: de Lead blijft de primaire knop, "Alleen als
                relatie vastleggen" staat ernaast als smallere tekstknop. */}
            {relationSlot("violet", t("y_next.rel_only_relation"))}
            <button
              onClick={() => {
                dismissMailSuggestion(name, intent.kind === "quote-request" ? "quote-request" : "lead");
                setDismissed(readDismissedMailSuggestions());
              }}
              className="cursor-pointer rounded px-2 py-1 text-[11px] text-violet-800 hover:bg-violet-100">
              {t("y_next.lead_dismiss")}
            </button>
          </div>
        )}

        {/* Projectsuggestie. De popout kent geen conversatie, dus hij leunt op
            het projectnummer/de projectnaam in de mail, de historie van de
            afzender en (als versterking) de klant. */}
        {projectSuggestion && (
          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-6 py-2">
            <FolderKanban size={14} className="flex-shrink-0 text-emerald-600" />
            <span className="text-xs text-emerald-900">
              {t("y_next.proj_suggest_banner", {
                project: projectHints.find((p) => p.name === projectSuggestion.project)?.projectName
                  ?? projectSuggestion.project,
              })}
            </span>
            <span
              title={projectSuggestion.reasons
                .map((r) => t(`y_next.proj_suggest_reason_${r.replace(/[:-]/g, "_")}`, { defaultValue: r }))
                .join(" · ")}
              className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
              {t(`y_next.proj_suggest_confidence_${projectSuggestion.confidence}`)}
            </span>
            <div className="flex-1" />
            <button onClick={() => void handleLinkProject(projectSuggestion.project)}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700">
              <FolderKanban size={11} /> {t("y_next.proj_suggest_link")}
            </button>
            <button
              onClick={() => { dismissMailSuggestion(name, "project"); setDismissed(readDismissedMailSuggestions()); }}
              className="cursor-pointer rounded px-2 py-1 text-[11px] text-emerald-800 hover:bg-emerald-100">
              {t("y_next.proj_suggest_dismiss")}
            </button>
          </div>
        )}
        {projectError && <p className="border-b border-red-100 bg-red-50 px-6 py-2 text-[11px] text-red-700">{projectError}</p>}

        {created && (
          <div className="flex flex-wrap items-start gap-2 border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-xs text-emerald-800">
            <Check size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <span>{t(created.doctype === "Opportunity" ? "y_next.lead_quote_created_ok" : "y_next.lead_created_ok")} </span>
              <a href={`${getErpNextLinkUrl()}/${created.doctype === "Lead" ? "lead" : "opportunity"}/${encodeURIComponent(created.result.name)}`}
                target="_blank" rel="noopener noreferrer"
                className="font-semibold underline hover:text-emerald-900">
                {created.result.name}
              </a>
              {created.result.failedAttachments.length > 0 && (
                <p className="mt-0.5 text-[11px] text-amber-700">
                  {t("y_next.lead_attachments_failed", { names: created.result.failedAttachments.join(", ") })}
                </p>
              )}
              {created.result.linkFailed && (
                <p className="mt-0.5 text-[11px] text-amber-700">{t("y_next.lead_link_failed")}</p>
              )}
            </div>
          </div>
        )}

        {booked && (
          <div className="flex flex-wrap items-start gap-2 border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-xs text-emerald-800">
            <Check size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <span>{t("y_next.pinv_booked_ok")} </span>
              <a href={`${getErpNextLinkUrl()}/purchase-invoice/${encodeURIComponent(booked.name)}`}
                target="_blank" rel="noopener noreferrer"
                className="font-semibold underline hover:text-emerald-900">
                {booked.name}
              </a>
              {booked.failedAttachments.length > 0 && (
                <p className="mt-0.5 text-[11px] text-amber-700">
                  {t("y_next.pinv_attachments_failed", { names: booked.failedAttachments.join(", ") })}
                </p>
              )}
              {booked.linkFailed && (
                <p className="mt-0.5 text-[11px] text-amber-700">{t("y_next.pinv_link_failed")}</p>
              )}
            </div>
          </div>
        )}

        <iframe
          ref={frameRef}
          title="mail-body"
          srcDoc={srcDoc}
          onLoad={handleFrameLoad}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="w-full border-0 block"
          style={{ height: frameHeight }}
        />

        {body && (
          <ErpAttachmentList
            attachments={body.attachments}
            onError={setPopupError}
            className="border-t border-slate-200 px-6 py-4"
          />
        )}
        {popupError && (
          <p className="px-6 pb-4 text-xs text-red-600">{popupError}</p>
        )}
      </div>

      {bookingOpen && doc && intent?.kind === "purchase-invoice" && intent.invoice && (
        <BookPurchaseInvoiceDialog
          message={{
            name,
            subject: doc.subject || "",
            sender: doc.sender || "",
            date: doc.communication_date || "",
            ...(reference?.doctype === "Project" ? { project: reference.name } : {}),
          }}
          guess={intent.invoice}
          suppliers={intentCtx.suppliers as SupplierHint[]}
          onClose={() => setBookingOpen(false)}
          onBooked={(result) => {
            setBookingOpen(false);
            setBooked(result);
            if (!result.linkFailed) setLocalRef({ doctype: "Purchase Invoice", name: result.name });
          }}
        />
      )}

      {leadOpen && doc && (intent?.kind === "lead" || intent?.kind === "quote-request") && (
        <CreateLeadDialog
          message={{
            name,
            subject: doc.subject || "",
            sender: doc.sender || "",
            date: doc.communication_date || "",
          }}
          intent={intent}
          customers={intentCtx.customers}
          onClose={() => setLeadOpen(false)}
          onCreated={(doctype, result) => {
            setLeadOpen(false);
            setCreated({ doctype, result });
            if (!result.linkFailed) setLocalRef({ doctype, name: result.name });
          }}
        />
      )}

      {/* De dialoog sluit zichzelf niet na succes — hij toont eerst waar het
          terechtkwam. De chip in de balk staat op dat moment al goed. */}
      {relationOpen && doc && relationSender && (
        <AddRelationDialog
          sender={{
            email: relationSender,
            ...(doc.sender_full_name ? { displayName: doc.sender_full_name } : {}),
            ...(body?.html ? { bodyText: body.html } : {}),
          }}
          onClose={() => setRelationOpen(false)}
          onCreated={(created) => handleRelationCreated(relationSender, created)}
        />
      )}
    </div>
  );
}

/**
 * Y-next opent de popout met alleen `?msg=<Communication-docname>`; de
 * IMAP-popout heeft uid/folder/acct/email/account nodig. De feature-key bepaalt
 * welke van de twee rendert.
 */
export default function MailView() {
  if (isFeatureEnabled(ERPNEXT_MAIL)) {
    return <ErpNextMailView name={readPopoutParams().get("msg") || ""} />;
  }
  return <ImapMailView />;
}
