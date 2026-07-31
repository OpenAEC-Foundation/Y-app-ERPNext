import { useState, useEffect, useMemo } from "react";
import {
  Mail, Reply, ReplyAll, Forward, Zap, ChevronDown, CheckSquare, FileBarChart,
  FolderKanban, Receipt, User, Trash2, Check, ExternalLink, Plus, X, Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "../../lib/useIsMobile";
import { useProjects, type ProjectRecord } from "../../lib/DataContext";
import { getActiveInstance } from "../../lib/instances";
import { getEmailProjectLinks, setEmailProjectLink } from "../../lib/email-project-links";
import { matchProjectFromFolder } from "../../lib/project-folder-match";
import { makeExternalLinkOpener } from "../../lib/desktop";
import {
  formatSender, formatAddress, formatFullDate, getInitials, getAvatarColor,
  attachExternalLinkHandler,
} from "../../lib/mail-format";
import type { MailMessageFull } from "../../lib/mail-types";
import { MessageAttachments } from "../MessageAttachments";
import ThreadAboveMail from "./ThreadAboveMail";

/* ─── Reading pane ─── */

/** Score how well a project matches an email based on sender, subject, customer name */
function scoreProjectMatch(project: ProjectRecord, senderName: string, senderEmail: string, subject: string): number {
  let score = 0;
  const pname = (project.project_name || project.name || "").toLowerCase();
  const customer = (project.customer_name || project.customer || "").toLowerCase();
  const subjectLower = subject.toLowerCase();
  const senderLower = senderName.toLowerCase();
  const emailDomain = senderEmail.split("@")[1]?.toLowerCase() || "";

  // Direct project name match in subject
  if (pname && subjectLower.includes(pname)) score += 50;
  // Subject words in project name
  const subjectWords = subjectLower.split(/\s+/).filter(w => w.length > 3);
  for (const w of subjectWords) {
    if (pname.includes(w)) score += 10;
  }
  // Customer name matches sender
  if (customer && senderLower.includes(customer)) score += 40;
  if (customer && customer.includes(senderLower.split(/\s+/)[0])) score += 20;
  // Email domain matches customer name
  if (customer && emailDomain) {
    const domainBase = emailDomain.split(".")[0];
    if (customer.includes(domainBase) || domainBase.includes(customer.replace(/\s+/g, ""))) score += 30;
  }
  // Project name words in sender name
  const pnameWords = pname.split(/[\s\-_]+/).filter(w => w.length > 3);
  for (const w of pnameWords) {
    if (senderLower.includes(w)) score += 8;
  }
  return score;
}

/** Get stored email-project links from localStorage */
// (verplaatst naar imports bovenaan — zie lib/email-project-links.ts)

export default function ReadingPane({ message, onReply, onReplyAll, onForward, onDelete, onOpenAttachment, onDownloadAttachment, onDownloadAll, onSaveToNextCloud, onSaveAllToNextCloud, ncSaving, onFollowUp, onSaveToNas, conversationMessages, loadingConversation, currentFolder, accountEmail, onOpenThreadMessage, onPopout }: {
  message: MailMessageFull | null; onReply: () => void; onReplyAll: () => void; onForward: () => void; onDelete: () => void;
  onPopout?: () => void;
  onOpenAttachment?: (index: number) => void;
  onDownloadAttachment?: (index: number) => void;
  onDownloadAll?: () => void;
  onSaveToNextCloud?: (index: number) => void;
  onSaveAllToNextCloud?: () => void;
  ncSaving?: string | null;
  onFollowUp?: (action: "task" | "quotation" | "project" | "purchase-invoice") => void;
  onSaveToNas?: () => void;
  conversationMessages?: MailMessageFull[];
  loadingConversation?: boolean;
  currentFolder?: string;
  accountEmail?: string;
  onOpenThreadMessage?: (msg: MailMessageFull) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [showFollowUp, setShowFollowUp] = useState(false);
  // showHiddenAttachments verhuisde naar MessageAttachments-component.
  const projects = useProjects();
  const [linkedProject, setLinkedProject] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [erpnextComm, setErpnextComm] = useState<{ found: boolean; refDoctype?: string; refName?: string } | null>(null);
  const [contactStatus, setContactStatus] = useState<{ found: boolean; id?: string; company?: string; designation?: string } | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [showCrm, setShowCrm] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmResults, setCrmResults] = useState<{ name: string; first_name: string; last_name: string; email_id: string; company_name: string; phone: string; mobile_no: string }[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);

  // When message changes, look up stored link, check ERPNext Communication, and check contact
  useEffect(() => {
    if (!message) { setLinkedProject(""); setErpnextComm(null); setContactStatus(null); return; }
    // Race-guard (bug #2): snel A->B klikken liet de trage lookup van A de
    // pane van B overschrijven. Cancel bij message-change/unmount.
    let cancelled = false;
    const emailKey = `${message.uid}:${message.subject}`;
    const stored = getEmailProjectLinks()[emailKey];
    if (stored) {
      setLinkedProject(stored);
    } else {
      // Auto-koppel via folder-naam (bv. "[IN] 3001 JM24-026 CLT Offemweg 8" → project 3001)
      // Persist NIET in localStorage zodat folder/project-renames automatisch reflecteren.
      const autoMatch = matchProjectFromFolder(currentFolder, projects);
      setLinkedProject(autoMatch ? autoMatch.name : "");
    }
    setShowProjectPicker(false);
    setProjectSearch("");
    setShowCrm(false);

    const sender = message.from?.[0]?.address || "";
    const subject = message.subject || "";

    // Check if email exists in ERPNext Communications cache
    const commParams = new URLSearchParams({
      filters: JSON.stringify([["sender", "like", `%${sender}%`], ["subject", "like", `%${subject.slice(0, 60)}%`]]),
      fields: JSON.stringify(["name", "reference_doctype", "reference_name"]),
      limit_page_length: "1",
    });
    fetch(`/api/resource/Communication?${commParams}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const comm = data?.data?.[0];
        if (comm) {
          setErpnextComm({ found: true, refDoctype: comm.reference_doctype, refName: comm.reference_name });
        } else {
          setErpnextComm({ found: false });
        }
      })
      .catch(() => { if (!cancelled) setErpnextComm(null); });

    // Check if sender is a known Contact in ERPNext
    if (sender) {
      const contactParams = new URLSearchParams({
        filters: JSON.stringify([["email_id", "=", sender]]),
        fields: JSON.stringify(["name", "company_name", "designation"]),
        limit_page_length: "1",
      });
      fetch(`/api/resource/Contact?${contactParams}`, { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled) return;
          const c = data?.data?.[0];
          if (c) {
            setContactStatus({ found: true, id: c.name, company: c.company_name, designation: c.designation });
          } else {
            setContactStatus({ found: false });
          }
        })
        .catch(() => { if (!cancelled) setContactStatus(null); });
    }
    return () => { cancelled = true; };
  }, [message?.uid, message?.subject, message?.from, currentFolder, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRM search
  useEffect(() => {
    if (!crmSearch.trim() || !showCrm) { setCrmResults([]); return; }
    let cancelled = false; // bug #8: negeer trage resultaten na een nieuwere query
    const timer = setTimeout(async () => {
      setCrmLoading(true);
      try {
        const q = crmSearch.trim();
        const params = new URLSearchParams({
          filters: JSON.stringify([["email_id", "like", `%${q}%`]]),
          fields: JSON.stringify(["name", "first_name", "last_name", "email_id", "company_name", "phone", "mobile_no"]),
          limit_page_length: "20",
          order_by: "first_name asc",
        });
        // Search by email first
        const res1 = await fetch(`/api/resource/Contact?${params}`, { credentials: "same-origin" });
        let results = res1.ok ? ((await res1.json()).data || []) : [];
        // Also search by name
        if (results.length < 20) {
          const params2 = new URLSearchParams({
            filters: JSON.stringify([["first_name", "like", `%${q}%`]]),
            fields: JSON.stringify(["name", "first_name", "last_name", "email_id", "company_name", "phone", "mobile_no"]),
            limit_page_length: "20",
            order_by: "first_name asc",
          });
          const res2 = await fetch(`/api/resource/Contact?${params2}`, { credentials: "same-origin" });
          if (res2.ok) {
            const extra = (await res2.json()).data || [];
            const existing = new Set(results.map((r: { name: string }) => r.name));
            results = [...results, ...extra.filter((e: { name: string }) => !existing.has(e.name))];
          }
        }
        // Also search by company name
        if (results.length < 20) {
          const params3 = new URLSearchParams({
            filters: JSON.stringify([["company_name", "like", `%${q}%`]]),
            fields: JSON.stringify(["name", "first_name", "last_name", "email_id", "company_name", "phone", "mobile_no"]),
            limit_page_length: "20",
            order_by: "first_name asc",
          });
          const res3 = await fetch(`/api/resource/Contact?${params3}`, { credentials: "same-origin" });
          if (res3.ok) {
            const extra = (await res3.json()).data || [];
            const existing = new Set(results.map((r: { name: string }) => r.name));
            results = [...results, ...extra.filter((e: { name: string }) => !existing.has(e.name))];
          }
        }
        if (!cancelled) setCrmResults(results.slice(0, 20));
      } catch { if (!cancelled) setCrmResults([]); }
      finally { if (!cancelled) setCrmLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [crmSearch, showCrm]);

  async function handleAddContact() {
    if (!message || addingContact) return;
    const senderName = message.from?.[0]?.name || "";
    const senderEmail = message.from?.[0]?.address || "";
    if (!senderEmail) return;
    setAddingContact(true);
    try {
      const nameParts = senderName.split(/\s+/);
      const firstName = nameParts[0] || senderEmail.split("@")[0];
      const lastName = nameParts.slice(1).join(" ") || "";
      const res = await fetch(`/api/resource/Contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email_id: senderEmail,
          email_ids: [{ email_id: senderEmail, is_primary: 1 }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setContactStatus({ found: true, id: data.data?.name });
      } else {
        const err = await res.json().catch(() => ({})) as { exc?: string; message?: string };
        alert(t("webmail.contact_add_error", { message: err.exc || err.message || res.statusText }));
      }
    } catch (err) {
      alert(t("webmail.contact_add_error", { message: (err as Error).message }));
    } finally {
      setAddingContact(false);
    }
  }

  // Auto-suggest best matching project
  const suggestedProjects = useMemo(() => {
    if (!message) return [];
    const senderName = message.from?.[0]?.name || message.from?.[0]?.address || "";
    const senderEmail = message.from?.[0]?.address || "";
    const subject = message.subject || "";
    const activeProjects = projects.filter(p => p.status === "Open" || p.status === "Working" || p.status === "In Progress");
    return activeProjects
      .map(p => ({ project: p, score: scoreProjectMatch(p, senderName, senderEmail, subject) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [message?.uid, projects]);

  function handleLinkProject(projectName: string) {
    if (!message) return;
    const emailKey = `${message.uid}:${message.subject}`;
    setLinkedProject(projectName);
    setEmailProjectLink(emailKey, projectName);
    setShowProjectPicker(false);
    setProjectSearch("");
  }

  function handleUnlinkProject() {
    if (!message) return;
    const emailKey = `${message.uid}:${message.subject}`;
    setLinkedProject("");
    setEmailProjectLink(emailKey, null);
  }

  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <div className="text-center text-slate-400">
          <Mail size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm">{t("webmail.select_message")}</p>
        </div>
      </div>
    );
  }

  const sender = formatSender(message.from);
  const filteredProjects = projectSearch
    ? projects.filter(p => {
        const q = projectSearch.toLowerCase();
        return (p.project_name || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q) ||
          (p.customer_name || "").toLowerCase().includes(q);
      }).slice(0, 10)
    : suggestedProjects.map(s => s.project);

  const linkedProjectObj = linkedProject ? projects.find(p => p.name === linkedProject) : null;

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      <div className={`${isMobile ? "px-4 py-3" : "px-6 py-4"} border-b border-slate-200 flex-shrink-0 min-w-0`}>
        <div className="mb-3">
          {/* Row 1: action toolbar — right aligned */}
          {!isMobile && <div className="flex flex-wrap items-center gap-1 justify-end mb-2">
            {onPopout && (
              <>
                <button onClick={onPopout} title={t("webmail.open_in_new_tab")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer"><ExternalLink size={14} /> {t("webmail.open_in_new_tab")}</button>
                <div className="w-px h-4 bg-slate-200 mx-0.5" />
              </>
            )}
            <button onClick={onReply} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer"><Reply size={14} /> {t("webmail.reply")}</button>
            <button onClick={onReplyAll} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer"><ReplyAll size={14} /> {t("webmail.reply_all")}</button>
            <button onClick={onForward} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer"><Forward size={14} /> {t("webmail.forward")}</button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <div className="relative">
              <button onClick={() => setShowFollowUp(!showFollowUp)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-amber-50 hover:text-amber-700 cursor-pointer">
                <Zap size={14} /> {t("webmail.follow_up")} <ChevronDown size={10} />
              </button>
              {showFollowUp && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFollowUp(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-52 z-50">
                    <button onClick={() => { onFollowUp?.("task"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2.5">
                      <CheckSquare size={14} className="text-blue-500" /> {t("webmail.create_task")}
                    </button>
                    <button onClick={() => { onFollowUp?.("quotation"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-2.5">
                      <FileBarChart size={14} className="text-purple-500" /> {t("webmail.create_quotation")}
                    </button>
                    <button onClick={() => { onFollowUp?.("project"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer flex items-center gap-2.5">
                      <FolderKanban size={14} className="text-teal-500" /> {t("webmail.project_create")}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => { onFollowUp?.("purchase-invoice"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-700 cursor-pointer flex items-center gap-2.5">
                      <Receipt size={14} className="text-green-500" /> {t("webmail.create_purchase_invoice")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowCrm(!showCrm)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
              <User size={14} /> CRM
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 size={14} /> {t("common.delete_tooltip")}</button>
          </div>}
          {/* Row 2: subject + ERPNext badge + project link */}
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className={`${isMobile ? "text-base" : "text-lg"} font-semibold text-slate-800 truncate min-w-0 flex-1`}>{message.subject || t("webmail.no_subject")}</h2>
            {erpnextComm !== null && (
              erpnextComm.found ? (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full shrink-0" title={erpnextComm.refName ? t("webmail.linked_to", { doctype: erpnextComm.refDoctype, name: erpnextComm.refName }) : t("webmail.found_in_erpnext")}>
                  <Check size={10} /> {t("webmail.in_erpnext")}
                  {erpnextComm.refName && <span className="text-green-500 ml-0.5">({erpnextComm.refDoctype})</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-200 rounded-full shrink-0">
                  {t("webmail.not_in_erpnext")}
                </span>
              )
            )}
            {/* Project link — at end */}
            <div className="flex items-center gap-1.5 shrink-0">
              <FolderKanban size={13} className="text-teal-500 shrink-0" />
              {linkedProjectObj ? (
                <>
                  <span className="text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full truncate max-w-[220px]" title={`${linkedProjectObj.name} ${linkedProjectObj.project_name || ""}`.trim()}>
                    <span className="font-mono">{linkedProjectObj.name}</span>
                    {linkedProjectObj.project_name && <span className="ml-1">{linkedProjectObj.project_name}</span>}
                  </span>
                  <button onClick={() => {
                    const inst = getActiveInstance();
                    if (inst?.url) window.open(`${inst.url}/app/project/${encodeURIComponent(linkedProject)}`, "_blank");
                  }} className="text-[10px] text-teal-600 hover:text-teal-800 cursor-pointer"><ExternalLink size={10} /></button>
                  <button onClick={handleUnlinkProject} className="text-[10px] text-slate-400 hover:text-red-500 cursor-pointer"><X size={12} /></button>
                </>
              ) : (
                <div className="relative">
                  <button onClick={() => setShowProjectPicker(!showProjectPicker)}
                    className="text-xs text-slate-500 hover:text-teal-600 cursor-pointer flex items-center gap-1">
                    <Plus size={11} /> {t("webmail.link_to_project")}
                    {suggestedProjects.length > 0 && (
                      <span className="text-[10px] text-teal-500 ml-1">({suggestedProjects.length === 1 ? t("webmail.one_suggestion") : t("webmail.n_suggestions", { count: suggestedProjects.length })})</span>
                    )}
                  </button>
                  {showProjectPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 w-80 z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-100">
                          <input type="text" value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)}
                            placeholder={t("hours_widget.search_project_placeholder")} autoFocus
                            className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                          />
                        </div>
                        <div className="max-h-[250px] overflow-y-auto">
                          {filteredProjects.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">{t("common.no_projects_found")}</p>
                          )}
                          {filteredProjects.map(p => {
                            const match = suggestedProjects.find(s => s.project.name === p.name);
                            return (
                              <button key={p.name} onClick={() => handleLinkProject(p.name)}
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
                                {match && match.score > 0 && (
                                  <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                                    {match.score >= 40 ? t("webmail.match_strong") : t("webmail.match_label")}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full ${getAvatarColor(sender.email)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {getInitials(sender.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{sender.name}</span>
              <span className="text-xs text-slate-400">&lt;{sender.email}&gt;</span>
              {/* Contact status */}
              {contactStatus !== null && (
                contactStatus.found ? (
                  <button onClick={() => {
                    const inst = getActiveInstance();
                    if (inst?.url && contactStatus.id) window.open(`${inst.url}/app/contact/${encodeURIComponent(contactStatus.id)}`, "_blank");
                  }} className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full cursor-pointer hover:bg-green-100"
                    title={contactStatus.company ? t("webmail.contact_with_company", { id: contactStatus.id, company: contactStatus.company }) : t("webmail.contact_only", { id: contactStatus.id })}>
                    <User size={9} /> {t("webmail.contact_label")}
                    {contactStatus.company && <span className="text-green-500">· {contactStatus.company}</span>}
                  </button>
                ) : (
                  <button onClick={handleAddContact} disabled={addingContact}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full cursor-pointer hover:bg-amber-100 disabled:opacity-50"
                    title={t("webmail.tt_add_contact_erpnext")}>
                    {addingContact ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
                    {addingContact ? t("webmail.adding_contact") : t("webmail.add_contact")}
                  </button>
                )
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {t("webmail.to_prefix")}: {formatAddress(message.to)}
              {message.cc.length > 0 && <span className="ml-2">CC: {formatAddress(message.cc)}</span>}
            </div>
          </div>
          <span className="text-xs text-slate-400 shrink-0 pt-0.5">{formatFullDate(message.date)}</span>
        </div>
      </div>

      {/* CRM search panel */}
      {showCrm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCrm(false)} />
          <div className="fixed inset-x-3 top-[80px] md:absolute md:inset-x-auto md:right-6 md:top-[120px] bg-white rounded-xl shadow-2xl border border-slate-200 w-auto md:w-[420px] max-w-[90vw] z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">{t("webmail.crm_search_title")}</span>
              </div>
              <button onClick={() => setShowCrm(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
            </div>
            <div className="px-4 py-2 border-b border-slate-100">
              <input type="text" value={crmSearch} onChange={(e) => setCrmSearch(e.target.value)}
                placeholder={t("webmail.search_contacts_placeholder")} autoFocus
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="max-h-[350px] overflow-y-auto">
              {crmLoading && <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>}
              {!crmLoading && crmSearch && crmResults.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">{t("contacts.no_contacts")}</p>
              )}
              {!crmLoading && !crmSearch && (
                <p className="text-xs text-slate-400 text-center py-6">{t("webmail.search_erpnext_contacts")}</p>
              )}
              {!crmLoading && crmResults.map(c => (
                <button key={c.name} onClick={() => {
                  const inst = getActiveInstance();
                  if (inst?.url) window.open(`${inst.url}/app/contact/${encodeURIComponent(c.name)}`, "_blank");
                }} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-slate-50">
                  <div className={`w-8 h-8 rounded-full ${getAvatarColor(c.email_id || c.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {getInitials(`${c.first_name} ${c.last_name}`)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-700">{c.first_name} {c.last_name}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {c.email_id && <span>{c.email_id}</span>}
                      {c.company_name && <span> · {c.company_name}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                    {c.mobile_no && <div className="text-[10px] text-slate-400">{c.mobile_no}</div>}
                  </div>
                  <ExternalLink size={12} className="text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Attachments bar — shared component met MailView. Eén code-pad. */}
      <MessageAttachments
        attachments={message.attachments || []}
        htmlBody={message.htmlBody}
        onOpen={onOpenAttachment}
        onDownload={onDownloadAttachment}
        onDownloadAll={onDownloadAll}
        onSaveToNextCloud={onSaveToNextCloud}
        onSaveAllToNextCloud={onSaveAllToNextCloud}
        onSaveToNas={onSaveToNas}
        ncSaving={ncSaving}
      />

      <div className="flex-1 overflow-auto">
        {/* Thread-overzicht BOVEN de mail-body: 2 zones.
            Zone A (amber) toont alleen latere replies/forwards. Zone B
            toont alle thread-mails chronologisch met de huidige gehighlight. */}
        <ThreadAboveMail
          messages={conversationMessages || []}
          currentUid={message.uid}
          currentFolder={currentFolder || ""}
          accountEmail={accountEmail}
          onOpenMessage={(m) => onOpenThreadMessage?.(m)}
        />
        {loadingConversation && (
          <div className="px-4 py-2 text-xs text-slate-400 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> {t("webmail.loading_conversation")}
          </div>
        )}

        {message.htmlBody ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><base target="_blank"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;line-height:1.6;margin:16px 24px;word-wrap:break-word;overflow-wrap:anywhere;}img{max-width:100%}a{color:#2563eb;}pre,code{white-space:pre-wrap;word-break:break-word;}table{max-width:100%;}</style></head><body>${message.htmlBody}</body></html>`}
            className="w-full h-full border-0" title="Email content" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            onLoad={(e) => {
              try {
                const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
                if (doc) attachExternalLinkHandler(doc, makeExternalLinkOpener());
              } catch { /* cross-origin edge case — laat links met de rust */ }
            }}
          />
        ) : (
          <pre className="p-6 text-sm text-slate-700 whitespace-pre-wrap break-words font-sans leading-relaxed">{message.textBody || t("webmail.no_content")}</pre>
        )}
      </div>

      {/* Mobile bottom action bar — fixed at bottom, safe area for Android nav */}
      {isMobile && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-2 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex items-center justify-around py-2">
            <button onClick={onReply} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 cursor-pointer min-w-[56px]">
              <Reply size={20} />
              <span className="text-[10px]">{t("webmail.reply")}</span>
            </button>
            <button onClick={onReplyAll} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 cursor-pointer min-w-[56px]">
              <ReplyAll size={20} />
              <span className="text-[10px]">{t("webmail.reply_all")}</span>
            </button>
            <button onClick={onForward} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-blue-50 hover:text-blue-600 active:bg-blue-100 cursor-pointer min-w-[56px]">
              <Forward size={20} />
              <span className="text-[10px]">{t("webmail.forward")}</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowFollowUp(!showFollowUp)} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-amber-50 hover:text-amber-600 active:bg-amber-100 cursor-pointer min-w-[56px]">
                <Zap size={20} />
                <span className="text-[10px]">{t("webmail.follow_up")}</span>
              </button>
              {showFollowUp && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFollowUp(false)} />
                  <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border border-slate-200 py-1 w-52 z-50">
                    <button onClick={() => { onFollowUp?.("task"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2.5">
                      <CheckSquare size={16} className="text-blue-500" /> {t("webmail.create_task")}
                    </button>
                    <button onClick={() => { onFollowUp?.("quotation"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 cursor-pointer flex items-center gap-2.5">
                      <FileBarChart size={16} className="text-purple-500" /> {t("webmail.create_quotation")}
                    </button>
                    <button onClick={() => { onFollowUp?.("project"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer flex items-center gap-2.5">
                      <FolderKanban size={16} className="text-teal-500" /> {t("webmail.project_create")}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => { onFollowUp?.("purchase-invoice"); setShowFollowUp(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-green-50 hover:text-green-700 cursor-pointer flex items-center gap-2.5">
                      <Receipt size={16} className="text-green-500" /> {t("webmail.create_purchase_invoice")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={onDelete} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 active:bg-red-100 cursor-pointer min-w-[56px]">
              <Trash2 size={20} />
              <span className="text-[10px]">{t("webmail.delete_btn")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
