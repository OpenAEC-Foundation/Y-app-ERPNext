import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { fetchList } from "../lib/erpnext";
import { getActiveInstanceId } from "../lib/instances";
import {
  FileText, Plus, Search, Calendar, Users, CheckSquare, Trash2, Edit3,
  X, ChevronDown, ChevronRight, Clock, Save, Copy, Send, Eye,
  ClipboardList, Circle, CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface ActionPoint {
  id: string;
  description: string;
  assignedTo: string;
  status: "open" | "done";
  dueDate: string;
}

interface Participant {
  name: string;
  email: string;
}

interface MeetingNote {
  id: string;
  title: string;
  date: string;
  linkedType: "" | "Project" | "Quotation" | "Lead";
  linkedName: string;
  linkedLabel: string;
  participants: Participant[];
  agenda: string;
  content: string;       // verslag / report
  actionPoints: ActionPoint[];
  createdAt: string;
  updatedAt: string;
}

interface LinkOption {
  name: string;
  label: string;
}

/* ─── Helpers ─── */

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createEmptyNote(): MeetingNote {
  return {
    id: generateId(),
    title: "",
    date: new Date().toISOString().slice(0, 16),
    linkedType: "",
    linkedName: "",
    linkedLabel: "",
    participants: [],
    agenda: "",
    content: "",
    actionPoints: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createEmptyActionPoint(): ActionPoint {
  return {
    id: generateId(),
    description: "",
    assignedTo: "",
    status: "open",
    dueDate: "",
  };
}

function formatDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function formatDateTime(d: string): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("nl-NL", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

/* ─── API (server-side JSON storage) ─── */

async function apiGetMeetings(): Promise<MeetingNote[]> {
  const r = await fetch("/api/meetings");
  const j = await r.json();
  return j.data || [];
}

async function apiSaveMeeting(m: MeetingNote, isNew: boolean): Promise<void> {
  if (isNew) {
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
  } else {
    await fetch(`/api/meetings/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(m),
    });
  }
}

async function apiDeleteMeeting(id: string): Promise<void> {
  await fetch(`/api/meetings/${id}`, { method: "DELETE" });
}

/* ─── Migrate old localStorage notes to server ─── */

async function migrateLocalStorageNotes(): Promise<boolean> {
  const key = `meeting_notes_${getActiveInstanceId()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  try {
    const old: Array<Record<string, unknown>> = JSON.parse(raw);
    if (!Array.isArray(old) || old.length === 0) return false;
    // Convert old format to new format
    for (const note of old) {
      const m: MeetingNote = {
        id: (note.id as string) || generateId(),
        title: (note.title as string) || "",
        date: (note.date as string) || "",
        linkedType: "",
        linkedName: "",
        linkedLabel: "",
        participants: [],
        agenda: "",
        content: (note.content as string) || "",
        actionPoints: Array.isArray(note.actionPoints) ? (note.actionPoints as ActionPoint[]) : [],
        createdAt: (note.createdAt as string) || new Date().toISOString(),
        updatedAt: (note.updatedAt as string) || new Date().toISOString(),
      };
      // Map old fields
      if (note.project) m.linkedType = "Project", m.linkedLabel = note.project as string;
      else if (note.quotation) m.linkedType = "Quotation", m.linkedLabel = note.quotation as string;
      else if (note.lead) m.linkedType = "Lead", m.linkedLabel = note.lead as string;
      // Convert attendees string to participants
      if (typeof note.attendees === "string" && note.attendees) {
        m.participants = (note.attendees as string).split(",").map((s) => ({ name: s.trim(), email: "" })).filter((p) => p.name);
      }
      // Merge transcription into content
      if (note.transcription) {
        m.content = m.content + (m.content ? "\n\n--- Transcriptie ---\n\n" : "") + (note.transcription as string);
      }
      await apiSaveMeeting(m, true);
    }
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/* ─── Email report ─── */

async function apiSendReport(meeting: MeetingNote, t: (key: string, opts?: Record<string, unknown>) => string): Promise<{ ok: boolean; error?: string }> {
  const recipients = meeting.participants.filter((p) => p.email).map((p) => p.email);
  if (recipients.length === 0) return { ok: false, error: t("meeting.no_participants_email") };

  // Get mail account from IMAP config stored in localStorage
  const id = getActiveInstanceId();
  const email = localStorage.getItem(`pref_${id}_imap_user`) || "";
  if (!email) return { ok: false, error: t("meeting.no_mail_account") };

  // Build HTML email
  const participantsHtml = meeting.participants.length > 0
    ? `<p><strong>${t("meeting_notes.participants")}:</strong> ${meeting.participants.map((p) => p.name + (p.email ? ` &lt;${p.email}&gt;` : "")).join(", ")}</p>`
    : "";

  const actionHtml = meeting.actionPoints.length > 0
    ? `<h3 style="color:#334155;margin-top:24px">${t("meeting_notes.action_points")}</h3>
       <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;border-color:#e2e8f0;font-size:14px">
        <tr style="background:#f8fafc"><th style="text-align:left">${t("meeting_notes.action")}</th><th style="text-align:left">${t("meeting_notes.who")}</th><th style="text-align:left">${t("tasks.detail.deadline")}</th><th style="text-align:left">${t("projects.detail.status")}</th></tr>
        ${meeting.actionPoints.map((a) => `<tr>
          <td>${a.description || "-"}</td>
          <td>${a.assignedTo || "-"}</td>
          <td>${a.dueDate ? formatDate(a.dueDate) : "-"}</td>
          <td style="color:${a.status === "done" ? "#16a34a" : "#ea580c"}">${a.status === "done" ? t("meeting_notes.done") : t("meeting_notes.open")}</td>
        </tr>`).join("")}
       </table>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;color:#334155">
      <h2 style="color:#0d9488;margin-bottom:4px">${meeting.title || t("meeting_notes.meeting_note")}</h2>
      <p style="color:#64748b;margin-top:0"><strong>${t("meeting_notes.date")}:</strong> ${formatDateTime(meeting.date)}</p>
      ${meeting.linkedLabel ? `<p><strong>${t("meeting_notes.linked_to")}:</strong> ${meeting.linkedType === "Quotation" ? t("meeting_notes.quotation") : meeting.linkedType} - ${meeting.linkedLabel}</p>` : ""}
      ${participantsHtml}
      ${meeting.agenda ? `<h3 style="color:#334155;margin-top:24px">${t("meeting_notes.agenda")}</h3><div style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;font-size:14px">${meeting.agenda}</div>` : ""}
      ${meeting.content ? `<h3 style="color:#334155;margin-top:24px">${t("meeting_notes.report")}</h3><div style="white-space:pre-wrap;background:#f8fafc;padding:12px;border-radius:8px;font-size:14px">${meeting.content}</div>` : ""}
      ${actionHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin-top:32px" />
      <p style="color:#94a3b8;font-size:12px">${t("meeting_notes.sent_via")}</p>
    </div>
  `;

  const r = await fetch("/api/mail/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      from: email,
      to: recipients,
      subject: t("meeting_notes.email_subject", { title: meeting.title, date: formatDate(meeting.date) }),
      html,
    }),
  });

  const j = await r.json();
  if (!r.ok) return { ok: false, error: j.error || t("meeting.send_failed") };
  return { ok: true };
}

/* ─── Link search hook ─── */

function useLinkOptions(doctype: string) {
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (search?: string) => {
    if (!doctype) { setOptions([]); return; }
    setLoading(true);
    try {
      const fieldMap: Record<string, { fields: string[]; labelField: string }> = {
        Project: { fields: ["name", "project_name", "status"], labelField: "project_name" },
        Quotation: { fields: ["name", "party_name", "status"], labelField: "party_name" },
        Lead: { fields: ["name", "lead_name", "company_name"], labelField: "lead_name" },
      };
      const cfg = fieldMap[doctype] || { fields: ["name"], labelField: "name" };
      const filters: unknown[][] = [];
      if (search) {
        filters.push([cfg.labelField, "like", `%${search}%`]);
      }
      const list = await fetchList<Record<string, string>>(doctype, {
        fields: cfg.fields,
        filters,
        limit_page_length: 30,
        order_by: "modified desc",
      });
      setOptions(list.map((r) => ({
        name: r.name,
        label: `${r[cfg.labelField] || r.name} (${r.name})`,
      })));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [doctype]);

  return { options, loading, load };
}

/* ─── Component ─── */

export default function MeetingNotes() {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"" | "Project" | "Quotation" | "Lead">("");
  const [editDraft, setEditDraft] = useState<MeetingNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewNote, setIsNewNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(["details", "agenda", "content", "actions"])
  );

  // Participant input
  const [newPartName, setNewPartName] = useState("");
  const [newPartEmail, setNewPartEmail] = useState("");

  // Link search
  const [linkSearch, setLinkSearch] = useState("");
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  const linkOpts = useLinkOptions(editDraft?.linkedType || "");

  /* ─── Load data ─── */

  async function loadData() {
    setLoading(true);
    try {
      // Migrate localStorage notes on first load
      const migrated = await migrateLocalStorageNotes();
      const data = await apiGetMeetings();
      setNotes(data);
      if (migrated) console.log("[meeting-notes] Migrated localStorage notes to server");
    } catch (e) {
      console.error("[meeting-notes] Load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Close link dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) {
        setLinkDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─── Derived state ─── */

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return notes
      .filter((n) => {
        if (filterType && n.linkedType !== filterType) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.linkedLabel.toLowerCase().includes(q) ||
          n.participants.some((p) => p.name.toLowerCase().includes(q)) ||
          n.content.toLowerCase().includes(q) ||
          n.agenda.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [notes, searchQuery, filterType]);

  /* ─── Section toggle ─── */

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* ─── Actions ─── */

  function handleNew() {
    const note = createEmptyNote();
    setSelectedId(note.id);
    setEditDraft({ ...note });
    setIsEditing(true);
    setIsNewNote(true);
    setViewMode("edit");
    setSendResult(null);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    setIsEditing(false);
    setEditDraft(null);
    setIsNewNote(false);
    setSendResult(null);
  }

  function handleEdit() {
    if (selectedNote) {
      setEditDraft(JSON.parse(JSON.stringify(selectedNote)));
      setIsEditing(true);
      setIsNewNote(false);
      setViewMode("edit");
    }
  }

  async function handleSave() {
    if (!editDraft) return;
    setSaving(true);
    try {
      const updated = { ...editDraft, updatedAt: new Date().toISOString() };
      if (!updated.title.trim()) {
        updated.title = t("meeting_notes.default_title", { date: formatDate(updated.date) });
      }
      await apiSaveMeeting(updated, isNewNote);
      await loadData();
      setSelectedId(updated.id);
      setIsEditing(false);
      setEditDraft(null);
      setIsNewNote(false);
    } catch (e) {
      console.error("[meeting-notes] Save error:", e);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setEditDraft(null);
    if (isNewNote) {
      setSelectedId(null);
      setIsNewNote(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("meeting_notes.delete_confirm"))) return;
    try {
      await apiDeleteMeeting(id);
      if (selectedId === id) {
        setSelectedId(null);
        setIsEditing(false);
        setEditDraft(null);
      }
      await loadData();
    } catch (e) {
      console.error("[meeting-notes] Delete error:", e);
    }
  }

  function handleDuplicate(note: MeetingNote) {
    const dup: MeetingNote = {
      ...JSON.parse(JSON.stringify(note)),
      id: generateId(),
      title: t("meeting_notes.copy_suffix", { title: note.title }),
      date: new Date().toISOString().slice(0, 16),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      actionPoints: note.actionPoints.map((ap) => ({ ...ap, id: generateId(), status: "open" as const })),
    };
    setEditDraft(dup);
    setSelectedId(dup.id);
    setIsEditing(true);
    setIsNewNote(true);
    setViewMode("edit");
  }

  async function handleSendReport() {
    const note = isEditing ? editDraft : selectedNote;
    if (!note) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await apiSendReport(note, t);
      setSendResult({ ok: result.ok, msg: result.ok ? t("meeting.report_sent_success") : (result.error || t("meeting.error")) });
    } catch (e) {
      setSendResult({ ok: false, msg: e instanceof Error ? e.message : t("meeting.error_sending") });
    } finally {
      setSending(false);
    }
  }

  /* ─── Participants ─── */

  function addParticipant() {
    if (!editDraft || !newPartName.trim()) return;
    setEditDraft({
      ...editDraft,
      participants: [...editDraft.participants, { name: newPartName.trim(), email: newPartEmail.trim() }],
    });
    setNewPartName("");
    setNewPartEmail("");
  }

  function removeParticipant(idx: number) {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      participants: editDraft.participants.filter((_, i) => i !== idx),
    });
  }

  /* ─── Action Points ─── */

  function addActionPoint() {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      actionPoints: [...editDraft.actionPoints, createEmptyActionPoint()],
    });
  }

  function updateActionPoint(apId: string, field: keyof ActionPoint, value: string) {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      actionPoints: editDraft.actionPoints.map((ap) =>
        ap.id === apId ? { ...ap, [field]: value } : ap
      ),
    });
  }

  function removeActionPoint(apId: string) {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      actionPoints: editDraft.actionPoints.filter((ap) => ap.id !== apId),
    });
  }

  async function toggleActionPointStatus(noteId: string, apId: string) {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    const updated = {
      ...note,
      actionPoints: note.actionPoints.map((ap) =>
        ap.id === apId ? { ...ap, status: (ap.status === "open" ? "done" : "open") as "open" | "done" } : ap
      ),
      updatedAt: new Date().toISOString(),
    };
    try {
      await apiSaveMeeting(updated, false);
      await loadData();
    } catch (e) {
      console.error("[meeting-notes] Toggle action error:", e);
    }
  }

  /* ─── Section header helper ─── */
  function SectionHeader({ id, label, icon: Icon }: { id: string; label: string; icon: typeof FileText }) {
    const expanded = expandedSections.has(id);
    return (
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center gap-2 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className="text-slate-500" />
        {label}
      </button>
    );
  }

  /* ─── Render ─── */

  const currentNote = isEditing ? editDraft : selectedNote;

  return (
    <div className="flex h-full">
      {/* ─── Left panel: list ─── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-y-teal" />
              {t("meeting_notes.title")}
            </h1>
            <button
              onClick={handleNew}
              className="p-2 rounded-lg bg-y-teal text-white hover:bg-y-teal-dark transition-colors cursor-pointer"
              title={t("meeting.new_note_title")}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("sidebar.global_search") + "..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 bg-white"
          >
            <option value="">{t("meeting.all_types")}</option>
            <option value="Project">{t("projects.title")}</option>
            <option value="Quotation">{t("meeting_notes.quotations")}</option>
            <option value="Lead">{t("meeting_notes.leads")}</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 text-center text-sm text-slate-400">{t("common.loading")}</div>
          )}
          {!loading && filteredNotes.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">
              {searchQuery || filterType ? t("meeting.no_results") : t("meeting.no_notes_yet")}
            </div>
          )}
          {filteredNotes.map((note) => {
            const isActive = note.id === selectedId;
            const openActions = note.actionPoints.filter((a) => a.status === "open").length;
            return (
              <button
                key={note.id}
                onClick={() => handleSelect(note.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-y-teal/10 border-l-2 border-l-y-teal"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="font-medium text-sm text-slate-800 truncate">
                  {note.title || t("meeting.new_meeting")}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    {formatDateTime(note.date)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {note.linkedType && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                      {note.linkedType === "Quotation" ? t("meeting_notes.quotation") : note.linkedType}
                    </span>
                  )}
                  {note.participants.length > 0 && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Users size={10} />
                      {note.participants.length}
                    </span>
                  )}
                  {openActions > 0 && (
                    <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                      <CheckSquare size={10} />
                      {t("meeting_notes.open_count", { count: openActions })}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-200">
          {t("meeting_notes.note_count", { count: notes.length })}
        </div>
      </div>

      {/* ─── Right panel: detail/edit ─── */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {!currentNote ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <FileText size={48} className="mb-3 opacity-30" />
            <p className="text-sm">{t("meeting.select_or_create")}</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-y-teal text-white hover:bg-y-teal-dark disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Save size={14} />
                      {saving ? t("common.saving") : t("common.save")}
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                      {t("common.cancel")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-y-teal text-white hover:bg-y-teal-dark transition-colors cursor-pointer"
                    >
                      <Edit3 size={14} />
                      {t("meeting.edit")}
                    </button>
                    <button
                      onClick={() => handleDuplicate(currentNote)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title={t("meeting_notes.duplicate")}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(currentNote.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title={t("common.delete_tooltip")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Preview toggle */}
                {isEditing && (
                  <button
                    onClick={() => setViewMode(viewMode === "edit" ? "preview" : "edit")}
                    className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {viewMode === "edit" ? <Eye size={14} /> : <Edit3 size={14} />}
                    {viewMode === "edit" ? t("meeting.preview") : t("common.edit")}
                  </button>
                )}
                {/* Send report button */}
                <button
                  onClick={handleSendReport}
                  disabled={sending || currentNote.participants.filter((p) => p.email).length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                  title={currentNote.participants.filter((p) => p.email).length === 0
                    ? t("meeting.add_participants_hint")
                    : t("meeting_notes.send_report_to_all")}
                >
                  <Send size={14} />
                  {sending ? t("meeting.sending") : t("meeting.email_report")}
                </button>
                <div className="text-xs text-slate-400 flex items-center gap-1 ml-2">
                  <Clock size={12} />
                  {formatDate(currentNote.updatedAt)}
                </div>
              </div>
            </div>

            {/* Send result */}
            {sendResult && (
              <div className={`p-3 rounded-lg text-sm ${sendResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {sendResult.msg}
              </div>
            )}

            {/* ── Preview mode ── */}
            {isEditing && viewMode === "preview" ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">{editDraft?.title || t("meeting.no_title")}</h2>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1"><Calendar size={14} /> {formatDateTime(editDraft?.date || "")}</span>
                  {editDraft?.linkedLabel && (
                    <span className="flex items-center gap-1">
                      <ClipboardList size={14} />
                      {editDraft.linkedType === "Quotation" ? t("meeting_notes.quotation") : editDraft.linkedType}: {editDraft.linkedLabel}
                    </span>
                  )}
                </div>
                {(editDraft?.participants.length || 0) > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-1"><Users size={16} /> {t("meeting_notes.participants")}</h3>
                    <p className="text-sm text-slate-600">
                      {editDraft!.participants.map((p) => p.name + (p.email ? ` <${p.email}>` : "")).join(", ")}
                    </p>
                  </div>
                )}
                {editDraft?.agenda && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-1">{t("meeting_notes.agenda")}</h3>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4">{editDraft.agenda}</div>
                  </div>
                )}
                {editDraft?.content && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-1">{t("meeting_notes.report")}</h3>
                    <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4">{editDraft.content}</div>
                  </div>
                )}
                {(editDraft?.actionPoints.length || 0) > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2">{t("meeting_notes.action_points")}</h3>
                    <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2 font-medium">{t("projects.detail.status")}</th>
                          <th className="text-left p-2 font-medium">{t("instance_bar.feedback_description_label")}</th>
                          <th className="text-left p-2 font-medium">{t("meeting_notes.who")}</th>
                          <th className="text-left p-2 font-medium">{t("tasks.detail.deadline")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editDraft!.actionPoints.map((a) => (
                          <tr key={a.id} className="border-t border-slate-100">
                            <td className="p-2">
                              {a.status === "done"
                                ? <CheckCircle2 size={16} className="text-green-500" />
                                : <Circle size={16} className="text-slate-400" />}
                            </td>
                            <td className="p-2">{a.description || "-"}</td>
                            <td className="p-2 text-slate-600">{a.assignedTo || "-"}</td>
                            <td className="p-2 text-slate-600">{a.dueDate ? formatDate(a.dueDate) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ─── Details section ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 border-b border-slate-100">
                    <SectionHeader id="details" label={t("meeting_notes.details")} icon={FileText} />
                  </div>
                  {expandedSections.has("details") && (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Title */}
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">{t("meeting_notes.subject")}</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft!.title}
                              onChange={(e) => setEditDraft({ ...editDraft!, title: e.target.value })}
                              placeholder={t("meeting_notes.subject_placeholder")}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal"
                              autoFocus
                            />
                          ) : (
                            <div className="text-sm font-semibold text-slate-800">
                              {currentNote.title || <span className="text-slate-400 italic">{t("brieven.no_subject")}</span>}
                            </div>
                          )}
                        </div>

                        {/* Date & Time */}
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">{t("meeting.datetime_label")}</label>
                          {isEditing ? (
                            <input
                              type="datetime-local"
                              value={editDraft!.date}
                              onChange={(e) => setEditDraft({ ...editDraft!, date: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal"
                            />
                          ) : (
                            <div className="text-sm text-slate-700">{formatDateTime(currentNote.date)}</div>
                          )}
                        </div>

                        {/* Linked to */}
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">{t("meeting.linked_to")}</label>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <select
                                value={editDraft!.linkedType}
                                onChange={(e) => {
                                  const val = e.target.value as MeetingNote["linkedType"];
                                  setEditDraft({ ...editDraft!, linkedType: val, linkedName: "", linkedLabel: "" });
                                  setLinkSearch("");
                                }}
                                className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                              >
                                <option value="">{t("meeting.none")}</option>
                                <option value="Project">{t("tasks.detail.project")}</option>
                                <option value="Quotation">{t("search.quotation")}</option>
                                <option value="Lead">Lead</option>
                              </select>
                              {editDraft!.linkedType && (
                                <div className="relative flex-1" ref={linkRef}>
                                  <input
                                    type="text"
                                    value={linkSearch || editDraft!.linkedLabel}
                                    onChange={(e) => {
                                      setLinkSearch(e.target.value);
                                      setLinkDropdownOpen(true);
                                      linkOpts.load(e.target.value);
                                    }}
                                    onFocus={() => {
                                      setLinkDropdownOpen(true);
                                      linkOpts.load(linkSearch);
                                    }}
                                    placeholder={t("meeting.search_linked", { type: editDraft!.linkedType })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                                  />
                                  {editDraft!.linkedName && (
                                    <button
                                      onClick={() => {
                                        setEditDraft({ ...editDraft!, linkedName: "", linkedLabel: "" });
                                        setLinkSearch("");
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                  {linkDropdownOpen && linkOpts.options.length > 0 && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                      {linkOpts.options.map((opt) => (
                                        <button
                                          key={opt.name}
                                          onClick={() => {
                                            setEditDraft({ ...editDraft!, linkedName: opt.name, linkedLabel: opt.label });
                                            setLinkSearch("");
                                            setLinkDropdownOpen(false);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-y-teal/10 cursor-pointer"
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-700">
                              {currentNote.linkedType ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                  {currentNote.linkedType === "Quotation" ? t("meeting_notes.quotation") : currentNote.linkedType}
                                  {currentNote.linkedLabel && `: ${currentNote.linkedLabel}`}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Participants */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          <Users size={12} className="inline mr-1" />
                          {t("meeting_notes.participants")}
                        </label>
                        {isEditing ? (
                          <div>
                            {editDraft!.participants.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {editDraft!.participants.map((p, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-y-teal/10 text-y-teal-dark rounded-lg text-xs"
                                  >
                                    {p.name}
                                    {p.email && <span className="text-y-teal/60">&lt;{p.email}&gt;</span>}
                                    <button
                                      onClick={() => removeParticipant(idx)}
                                      className="ml-0.5 text-y-teal/50 hover:text-red-500 cursor-pointer"
                                    >
                                      <X size={12} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newPartName}
                                onChange={(e) => setNewPartName(e.target.value)}
                                placeholder={t("settings.name_label")}
                                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                              />
                              <input
                                type="email"
                                value={newPartEmail}
                                onChange={(e) => setNewPartEmail(e.target.value)}
                                placeholder={t("meeting_notes.email_optional")}
                                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30"
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                              />
                              <button
                                onClick={addParticipant}
                                disabled={!newPartName.trim()}
                                className="px-3 py-1.5 bg-y-teal text-white rounded-lg text-sm hover:bg-y-teal-dark disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-700">
                            {currentNote.participants.length > 0
                              ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {currentNote.participants.map((p, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs">
                                      {p.name}
                                      {p.email && <span className="text-slate-400">&lt;{p.email}&gt;</span>}
                                    </span>
                                  ))}
                                </div>
                              )
                              : <span className="text-slate-400">-</span>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Agenda section ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 border-b border-slate-100">
                    <SectionHeader id="agenda" label={t("meeting_notes.agenda")} icon={ClipboardList} />
                  </div>
                  {expandedSections.has("agenda") && (
                    <div className="p-5">
                      {isEditing ? (
                        <textarea
                          value={editDraft!.agenda}
                          onChange={(e) => setEditDraft({ ...editDraft!, agenda: e.target.value })}
                          placeholder={t("meeting_notes.agenda_placeholder")}
                          rows={6}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal resize-y"
                        />
                      ) : (
                        <div className="text-sm text-slate-700 whitespace-pre-wrap min-h-[40px]">
                          {currentNote.agenda || (
                            <span className="text-slate-400 italic">{t("meeting.no_agenda")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Content/report section ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 border-b border-slate-100">
                    <SectionHeader id="content" label={t("meeting_notes.report")} icon={Edit3} />
                  </div>
                  {expandedSections.has("content") && (
                    <div className="p-5">
                      {isEditing ? (
                        <textarea
                          value={editDraft!.content}
                          onChange={(e) => setEditDraft({ ...editDraft!, content: e.target.value })}
                          placeholder={t("meeting_notes.content_placeholder")}
                          rows={10}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal resize-y"
                        />
                      ) : (
                        <div className="text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">
                          {currentNote.content || (
                            <span className="text-slate-400 italic">{t("meeting.no_report")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Action points section ─── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="px-5 border-b border-slate-100 flex items-center justify-between">
                    <SectionHeader id="actions" label={t("meeting_notes.action_points")} icon={CheckSquare} />
                    {isEditing && expandedSections.has("actions") && (
                      <button
                        onClick={addActionPoint}
                        className="flex items-center gap-1 text-xs font-medium text-y-teal hover:text-y-teal-dark transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        {t("common.add")}
                      </button>
                    )}
                  </div>
                  {expandedSections.has("actions") && (
                    <div className="p-5">
                      {currentNote.actionPoints.length === 0 && !isEditing && (
                        <div className="text-sm text-slate-400 italic">{t("meeting.no_action_points")}</div>
                      )}

                      {isEditing ? (
                        <div className="space-y-3">
                          {editDraft!.actionPoints.map((ap, _idx) => (
                            <div
                              key={ap.id}
                              className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                            >
                              <button
                                onClick={() => updateActionPoint(ap.id, "status", ap.status === "open" ? "done" : "open")}
                                className="mt-2 cursor-pointer flex-shrink-0"
                              >
                                {ap.status === "done"
                                  ? <CheckCircle2 size={18} className="text-green-500" />
                                  : <Circle size={18} className="text-slate-400 hover:text-y-teal" />}
                              </button>
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                  <input
                                    type="text"
                                    value={ap.description}
                                    onChange={(e) =>
                                      updateActionPoint(ap.id, "description", e.target.value)
                                    }
                                    placeholder={t("meeting_notes.action_description_placeholder")}
                                    className={`w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal ${ap.status === "done" ? "line-through text-slate-400" : ""}`}
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={ap.assignedTo}
                                  onChange={(e) =>
                                    updateActionPoint(ap.id, "assignedTo", e.target.value)
                                  }
                                  placeholder={t("meeting_notes.assigned_to_placeholder")}
                                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal"
                                />
                                <input
                                  type="date"
                                  value={ap.dueDate}
                                  onChange={(e) =>
                                    updateActionPoint(ap.id, "dueDate", e.target.value)
                                  }
                                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-y-teal/30 focus:border-y-teal"
                                />
                              </div>
                              <button
                                onClick={() => removeActionPoint(ap.id)}
                                className="p-1 text-red-400 hover:text-red-600 transition-colors mt-1 cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          {editDraft!.actionPoints.length === 0 && (
                            <button
                              onClick={addActionPoint}
                              className="w-full py-3 text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg hover:text-y-teal hover:border-y-teal transition-colors cursor-pointer"
                            >
                              <Plus size={14} className="inline mr-1" />
                              {t("meeting_notes.add_first_action")}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {currentNote.actionPoints.map((ap) => (
                            <div
                              key={ap.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                ap.status === "done"
                                  ? "bg-green-50/50 border-green-200"
                                  : "bg-white border-slate-200"
                              }`}
                            >
                              <button
                                onClick={() => toggleActionPointStatus(currentNote.id, ap.id)}
                                className={`mt-0.5 cursor-pointer ${
                                  ap.status === "done"
                                    ? "text-green-500"
                                    : "text-slate-300 hover:text-y-teal"
                                }`}
                              >
                                {ap.status === "done"
                                  ? <CheckCircle2 size={16} />
                                  : <Circle size={16} />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm ${
                                    ap.status === "done"
                                      ? "line-through text-slate-400"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {ap.description || <span className="italic text-slate-400">{t("meeting.no_description")}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  {ap.assignedTo && (
                                    <span className="flex items-center gap-1">
                                      <Users size={10} />
                                      {ap.assignedTo}
                                    </span>
                                  )}
                                  {ap.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar size={10} />
                                      {formatDate(ap.dueDate)}
                                    </span>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      ap.status === "done"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-orange-100 text-orange-700"
                                    }`}
                                  >
                                    {ap.status === "done" ? t("meeting_notes.done") : t("meeting_notes.open")}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
