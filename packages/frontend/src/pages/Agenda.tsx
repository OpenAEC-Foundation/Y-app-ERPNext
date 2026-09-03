import { useEffect, useState, useMemo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { fetchList, fetchChildTable, createDocument, updateDocument, deleteDocument } from "../lib/erpnext";
import {
  aggregateHoursByEmployeeDay,
  fetchTimesheetHourRows,
  type EmployeeDayTotal,
} from "../lib/timesheet-hours";
import { useLeaves } from "../lib/DataContext";
import { getActiveInstanceId } from "../lib/instances";
import { isFeatureEnabled } from "../lib/capabilities";
import { haalAgendas, eindTijd, haalCollegas, kleurenVoorCollegas, type Collega } from "../lib/agenda-mailserver";
import { resolveSessionUser } from "../lib/session";
import { RecipientInput } from "../components/RecipientInput";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users,
  Plus, RefreshCw, X, Send, Video, CheckSquare, CalendarDays,
  Settings, Trash2, ExternalLink, Pencil, Save,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface EventItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  type: "event" | "task" | "leave" | "timesheet" | "meeting" | "ical" | "o365" | "mailbox";
  color: string;
  description?: string;
  location?: string;
  owner?: string;
  calendarId?: string;
  webLink?: string;
  /** Voor CalDAV (type "ical"): de VEVENT-UID + huidige deelnemers, zodat het
   *  detail/edit-scherm dezelfde afspraak kan bijwerken en mensen kan her-notificeren. */
  icalUid?: string;
  attendees?: string[];
}

type ViewType = "month" | "week" | "day";

/** Actieve sleep-selectie in de week-/dagweergave om een nieuw item te maken. */
interface DragCreateState {
  dateKey: string;
  hourHeight: number;
  rectTop: number;
  startY: number;
  currentY: number;
  moved: boolean;
}

interface CreateForm {
  type: "event" | "task";
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  description: string;
  location: string;
  assignTo: string;
  inviteEmails: string;
  jitsiRoom: string;
  withJitsi: boolean;
  calendarTarget: string; // "erpnext" | "caldav:<calendarId>"
}

interface CustomCalendar {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
  // Optioneel: id van een Y-app vault-mailaccount. Als gezet, gebruikt de
  // server diens (server-side ontsleutelde) creds voor CalDAV Basic-Auth —
  // zodat privé-agenda's achter inlog (bv. mail.3bm.co.nl/dav/cal/) werken
  // zonder wachtwoord in localStorage. Leeg = publieke iCal-feed.
  accountId?: string;
}

/* ─── ERPNext source toggle types ─── */

// "meetings" bestond hier ooit als ERPNext-bron, maar dat draaide op het
// Express-only /api/meetings-endpoint (server-side JSON store) — die bestaat
// niet op de standalone ERPNext-deployment en er is geen standaard-doctype
// (Event/Note/eigen doctype) dat de gestructureerde meeting-notes-data
// (deelnemers, actiepunten) dekt. Zie MeetingNotes.tsx (BLOCKED) — deze bron
// is daarom hier verwijderd i.p.v. gegate, zodat de agenda geen dode toggle
// toont voor data die nooit kan laden.
type ErpSourceKey = "events" | "tasks" | "leaves" | "timesheets" | "mailbox";

interface ErpSourceConfig {
  key: ErpSourceKey;
  label: string;
  color: string;
}

const ERP_SOURCES: ErpSourceConfig[] = [
  { key: "events", label: "agenda.source_events", color: "#3b82f6" },
  { key: "tasks", label: "agenda.source_tasks", color: "#f59e0b" },
  { key: "leaves", label: "agenda.source_leaves", color: "#ef4444" },
  { key: "timesheets", label: "agenda.source_timesheets", color: "#10b981" },
  { key: "mailbox", label: "agenda.source_mailbox", color: "#0ea5e9" },
];

const TYPE_COLORS: Record<string, string> = {
  event: "#3b82f6",
  task: "#f59e0b",
  leave: "#ef4444",
  timesheet: "#10b981",
  meeting: "#7c3aed",
  ical: "#8b5cf6",
  o365: "#0078d4",
  mailbox: "#0ea5e9",
};

const TYPE_LABEL_KEYS: Record<string, string> = {
  event: "agenda.type_event",
  task: "agenda.type_task",
  leave: "agenda.type_leave",
  timesheet: "agenda.type_timesheet",
  meeting: "agenda.type_meeting",
  ical: "agenda.type_ical",
  o365: "agenda.type_o365",
};

const CALENDAR_COLORS = [
  "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#84cc16", "#e11d48", "#0ea5e9", "#a855f7",
];

/* ─── Helpers ─── */

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const startOffset = startDay === 0 ? 6 : startDay - 1;
  const start = new Date(first);
  start.setDate(start.getDate() - startOffset);
  const endDay = last.getDay();
  const endOffset = endDay === 0 ? 0 : 7 - endDay;
  const end = new Date(last);
  end.setDate(end.getDate() + endOffset);
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) { days.push(new Date(current)); current.setDate(current.getDate() + 1); }
  return days;
}

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); days.push(d); }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function generateJitsiRoom(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let room = "erpnext-";
  for (let i = 0; i < 10; i++) room += chars[Math.floor(Math.random() * chars.length)];
  return room;
}

const WEEKDAY_KEYS = [
  "agenda.weekday_mon", "agenda.weekday_tue", "agenda.weekday_wed",
  "agenda.weekday_thu", "agenda.weekday_fri", "agenda.weekday_sat", "agenda.weekday_sun",
];
const MONTH_KEYS = [
  "agenda.month_january", "agenda.month_february", "agenda.month_march", "agenda.month_april",
  "agenda.month_may", "agenda.month_june", "agenda.month_july", "agenda.month_august",
  "agenda.month_september", "agenda.month_october", "agenda.month_november", "agenda.month_december",
];

/* ─── Preferences helpers ─── */

function getPrefKey(suffix: string): string {
  const id = getActiveInstanceId();
  return `pref_${id}_agenda_${suffix}`;
}

/**
 * Bronnen die standaard AAN staan. Een agenda die bij eerste gebruik leeg is
 * ("Geen bronnen actief") ziet eruit als een kapotte agenda — de gebruiker
 * moet eerst instellingen openen om iets te zien. Afspraken, taken en verlof
 * komen rechtstreeks uit ERPNext en horen er dus meteen te staan; geboekte
 * uren blijven uit omdat die de weergave vol zetten met terugkijk-informatie
 * in plaats van planning. Een expliciete keuze van de gebruiker wint altijd.
 */
const ERP_SOURCE_DEFAULTS: Record<ErpSourceKey, boolean> = {
  events: true,
  tasks: true,
  leaves: true,
  timesheets: false,
  mailbox: true,
};

const COLLEGA_SLEUTEL = "agenda_collegas";

/**
 * Welke collega-agenda's aan staan. Onthouden in de browser, want het is een
 * kijkvoorkeur en geen instelling die voor iedereen hetzelfde hoort te zijn.
 * Nog nooit iets gekozen (`null`) is iets anders dan bewust alles uitgezet
 * (lege lijst): in het eerste geval vullen we hem met de gebruiker zelf.
 */
function getGekozenCollegas(): string[] | null {
  try {
    const rauw = localStorage.getItem(COLLEGA_SLEUTEL);
    if (rauw === null) return null;
    const lijst = JSON.parse(rauw);
    return Array.isArray(lijst) ? lijst.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function setGekozenCollegas(lijst: string[]): void {
  try {
    localStorage.setItem(COLLEGA_SLEUTEL, JSON.stringify(lijst));
  } catch {
    // Privémodus of vol geheugen — de keuze geldt dan alleen deze sessie.
  }
}

function getErpSourceEnabled(key: ErpSourceKey): boolean {
  const stored = localStorage.getItem(getPrefKey(`show_${key}`));
  if (stored === null) return ERP_SOURCE_DEFAULTS[key];
  return stored === "true";
}

function setErpSourceEnabled(key: ErpSourceKey, enabled: boolean): void {
  localStorage.setItem(getPrefKey(`show_${key}`), String(enabled));
}

function getCustomCalendars(): CustomCalendar[] {
  try {
    const raw = localStorage.getItem(getPrefKey("calendars"));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveCustomCalendars(calendars: CustomCalendar[]): void {
  localStorage.setItem(getPrefKey("calendars"), JSON.stringify(calendars));
}

// Default-doelagenda voor nieuwe items. "erpnext" of "caldav:<calendarId>".
// Per-device (zoals de overige agenda-prefs); de laatst gekozen waarde in de
// aanmaak-modal wordt de nieuwe default.
function getDefaultCalendarTarget(): string {
  return localStorage.getItem(getPrefKey("default_calendar")) || "erpnext";
}

function setDefaultCalendarTarget(target: string): void {
  localStorage.setItem(getPrefKey("default_calendar"), target);
}

// Schrijfbare CalDAV-agenda's: alleen geauthenticeerde collecties (accountId
// gezet). Publieke iCal-feeds zijn alleen-lezen en vallen af.
// De iCal/O365-brug draait volledig op Express-only /api/calendar/*-routes,
// die niet bestaan op de standalone ERPNext-deployment — gate achter de
// "calendar-bridge"-capability zodat er nooit een aanroep naar die routes
// ontstaat (ook niet vanuit oude localStorage-voorkeuren van vóór Y-next).
function getWritableCalDavCalendars(): CustomCalendar[] {
  if (!isFeatureEnabled("calendar-bridge")) return [];
  return getCustomCalendars().filter(c => c.accountId && c.enabled !== false);
}

/* ─── Add Calendar Modal ─── */

function AddCalendarModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (cal: CustomCalendar) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState(CALENDAR_COLORS[0]);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  // Vault-mailaccounts van deze instance, voor CalDAV-inlog (optioneel).
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string; label: string }>>([]);
  // Deze modal is alleen bereikbaar via de (op calendar-bridge gegate)
  // "Add calendar"-knop in SettingsPanel, maar herhaalt de check hier
  // expliciet: /api/instances/*/mail-accounts en /api/calendar/ical zijn
  // Express-only en mogen nooit aangeroepen worden zonder die capability.
  useEffect(() => {
    if (!isFeatureEnabled("calendar-bridge")) return;
    const instId = getActiveInstanceId();
    if (!instId || instId === "default") return;
    fetch(`/api/instances/${instId}/mail-accounts`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []))
      .catch(() => {});
  }, []);

  async function handleAdd() {
    if (!name.trim()) { setError(t("agenda.fill_name")); return; }
    if (!url.trim()) { setError(t("agenda.fill_url")); return; }
    if (!isFeatureEnabled("calendar-bridge")) { setError(t("agenda.fetch_calendar_error")); return; }
    setTesting(true);
    setError("");
    try {
      const acctParam = accountId ? `&account=${encodeURIComponent(accountId)}` : "";
      const res = await fetch(`/api/calendar/ical?url=${encodeURIComponent(url)}${acctParam}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: t("agenda.fetch_calendar_error") }));
        setError(data.error || t("agenda.error_status", { status: res.status }));
        return;
      }
      onAdd({
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        url: url.trim(),
        color,
        enabled: true,
        accountId: accountId || undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">{t("agenda.add_calendar")}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.name_label")}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("agenda.ical_placeholder")} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.url_label")}</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("agenda.url_placeholder")} />
          </div>
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.login_account", { defaultValue: "Inloggen via mailaccount (voor privé-/CalDAV-agenda)" })}</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t("agenda.login_public", { defaultValue: "Geen — publieke agenda" })}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.label || a.email}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.color")}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CALENDAR_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <div className="p-2 bg-red-50 text-xs text-red-600 rounded border border-red-200">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">{t("common.cancel")}</button>
          <button onClick={handleAdd} disabled={testing || !name.trim() || !url.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {testing ? t("agenda.testing_add") : (<><Plus size={14} /> {t("common.add")}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Panel ─── */

function SettingsPanel({ erpSources, calendars, o365Enabled, collegas, gekozenCollegas, collegaKleuren, onErpToggle, onCollegaToggle, onCalendarToggle, onCalendarRemove, onAddCalendar, onO365Toggle }: {
  erpSources: Record<ErpSourceKey, boolean>;
  collegas: Collega[];
  gekozenCollegas: string[];
  /** Kleur per collega, zodat de stip in de lijst en de afspraak overeenkomen. */
  collegaKleuren: Map<string, string>;
  onCollegaToggle: (email: string) => void;
  calendars: CustomCalendar[];
  o365Enabled: boolean;
  onErpToggle: (key: ErpSourceKey) => void;
  onCalendarToggle: (id: string) => void;
  onCalendarRemove: (id: string) => void;
  onAddCalendar: () => void;
  onO365Toggle: () => void;
}) {
  const { t } = useTranslation();
  // De iCal/O365-brug (/api/calendar/*) is Express-only en bestaat niet op de
  // standalone ERPNext-deployment — deze secties worden stil verborgen i.p.v.
  // getoond-maar-kapot zolang de "calendar-bridge"-capability uit staat.
  const bridgeEnabled = isFeatureEnabled("calendar-bridge");
  return (
    <div className="w-64 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Office 365 Calendar — alleen tonen als de calendar-bridge actief is */}
      {bridgeEnabled && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Office 365</h3>
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <button onClick={onO365Toggle}
              className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${o365Enabled ? "bg-blue-500" : "bg-slate-300"}`}>
              <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${o365Enabled ? "left-[16px]" : "left-[2px]"}`} />
            </button>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS.o365 }} />
            <span className="text-xs text-slate-700 group-hover:text-slate-900">{t("agenda.outlook_calendar")}</span>
          </label>
        </div>
      )}

      {/* ERPNext Sources */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t("agenda.sources_erpnext")}</h3>
        <div className="space-y-2">
          {ERP_SOURCES.map(src => (
            <label key={src.key} className="flex items-center gap-2.5 cursor-pointer group">
              <button onClick={() => onErpToggle(src.key)}
                className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${erpSources[src.key] ? "bg-blue-500" : "bg-slate-300"}`}>
                <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${erpSources[src.key] ? "left-[16px]" : "left-[2px]"}`} />
              </button>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: src.color }} />
              <span className="text-xs text-slate-700 group-hover:text-slate-900">{t(src.label)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Collega-agenda's. Alleen tonen als de bron aanstaat — een lijst met
          namen die nergens toe leidt is verwarrender dan geen lijst. */}
      {erpSources.mailbox && collegas.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            {t("agenda.colleagues")}
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {collegas.map((c) => {
              const aan = gekozenCollegas.includes(c.email);
              return (
                <label key={c.email} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" checked={aan} onChange={() => onCollegaToggle(c.email)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 cursor-pointer" />
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: collegaKleuren.get(c.email) || "#94a3b8" }} />
                  <span className="text-xs text-slate-700 group-hover:text-slate-900 truncate" title={c.email}>
                    {c.naam}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Calendars — CalDAV/iCal-brug draait op Express, dus alleen
          tonen (en aanmaken toestaan) als de calendar-bridge actief is. */}
      {bridgeEnabled && (
        <div className="px-4 py-3 flex-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{t("agenda.external_calendars")}</h3>
          <div className="space-y-2 mb-3">
            {calendars.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">{t("agenda.no_external_calendars")}</p>
            )}
            {calendars.map(cal => (
              <div key={cal.id} className="flex items-center gap-2 group">
                <button onClick={() => onCalendarToggle(cal.id)}
                  className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer flex-shrink-0 ${cal.enabled ? "bg-blue-500" : "bg-slate-300"}`}>
                  <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${cal.enabled ? "left-[16px]" : "left-[2px]"}`} />
                </button>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
                <span className="text-xs text-slate-700 flex-1 truncate" title={cal.name}>{cal.name}</span>
                <button onClick={() => onCalendarRemove(cal.id)}
                  className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={onAddCalendar}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer w-full">
            <Plus size={13} /> {t("agenda.add_calendar")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Create/Edit modal ─── */

function CreateModal({ initial, onClose, onCreated }: {
  initial: Partial<CreateForm>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateForm>({
    type: initial.type || "event",
    title: initial.title || "",
    date: initial.date || formatDateKey(new Date()),
    startTime: initial.startTime || "09:00",
    endTime: initial.endTime || "10:00",
    allDay: initial.allDay ?? false,
    description: initial.description || "",
    location: initial.location || "",
    assignTo: "",
    inviteEmails: "",
    jitsiRoom: "",
    withJitsi: false,
    calendarTarget: getDefaultCalendarTarget(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  // Schrijfbare CalDAV-agenda's voor de doel-dropdown (alleen events).
  const writableCalDav = useMemo(() => getWritableCalDavCalendars(), []);

  function toggleJitsi() {
    setForm(f => ({
      ...f,
      withJitsi: !f.withJitsi,
      jitsiRoom: !f.withJitsi ? (f.jitsiRoom || generateJitsiRoom()) : f.jitsiRoom,
    }));
  }

  const jitsiUrl = form.jitsiRoom ? `https://meet.jit.si/${form.jitsiRoom}` : "";

  async function handleSave() {
    if (!form.title.trim()) { setError(t("agenda.fill_title")); return; }
    setSaving(true); setError("");

    try {
      const startDt = form.allDay ? form.date : `${form.date} ${form.startTime}:00`;
      const endDt = form.allDay ? form.date : `${form.date} ${form.endTime}:00`;

      let description = form.description;
      if (form.withJitsi && jitsiUrl) {
        description += `\n\n${t("agenda.jitsi_meeting_label", { url: jitsiUrl })}`;
      }

      // Deelnemers voor de uitnodiging. Op het CalDAV-pad geeft de server een
      // iMIP invite-.ics terug, die we daarna als echte agenda-uitnodiging mailen.
      const inviteRecipients = form.inviteEmails.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
      let inviteIcs: string | undefined;
      let inviteAccount: string | undefined;

      if (form.type === "event" && form.calendarTarget.startsWith("caldav:") && isFeatureEnabled("calendar-bridge")) {
        // Doel = privé CalDAV-agenda: schrijf een VEVENT via de server (PUT .ics).
        const calId = form.calendarTarget.slice("caldav:".length);
        const cal = writableCalDav.find(c => c.id === calId);
        if (!cal) throw new Error(t("agenda.calendar_not_found", { defaultValue: "Gekozen agenda niet gevonden" }));
        const res = await fetch("/api/calendar/event", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: cal.url,
            account: cal.accountId,
            summary: form.title,
            start: form.allDay ? form.date : `${form.date}T${form.startTime}`,
            end: form.allDay ? form.date : `${form.date}T${form.endTime}`,
            allDay: form.allDay,
            description,
            location: form.location,
            attendees: inviteRecipients.length ? inviteRecipients : undefined,
          }),
        });
        const j = await res.json().catch(() => ({} as { ok?: boolean; error?: string; inviteIcs?: string }));
        if (!res.ok || !j.ok) throw new Error(j.error || `CalDAV ${res.status}`);
        inviteIcs = j.inviteIcs;
        inviteAccount = cal.accountId;
      } else if (form.type === "event") {
        await createDocument("Event", {
          subject: form.title,
          starts_on: startDt,
          ends_on: endDt,
          all_day: form.allDay ? 1 : 0,
          event_type: "Public",
          description,
          location: form.location,
          status: "Open",
        });
      } else {
        await createDocument("Task", {
          subject: form.title,
          exp_start_date: form.date,
          exp_end_date: form.date,
          description,
          priority: "Medium",
          status: "Open",
        });
      }

      // Verstuur een echte agenda-uitnodiging (iMIP) als er deelnemers zijn en de
      // server een invite-.ics teruggaf (CalDAV-pad). Géén localStorage-SMTP meer
      // (die was vaak leeg → stil niets versturen): we gebruiken de normale
      // mail-flow met server-side cred-resolutie + ERPNext-relay-fallback.
      if (inviteIcs && inviteRecipients.length) {
        setSendingInvite(true);
        const timeInfo = form.allDay ? t("agenda.all_day") : `${form.startTime} - ${form.endTime}`;
        const bodyHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;">
            <h2 style="color:#1e293b;margin-bottom:4px;">📅 ${form.title}</h2>
            <p style="color:#64748b;margin:4px 0;"><strong>${t("agenda.date_label")}:</strong> ${new Date(form.date).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            <p style="color:#64748b;margin:4px 0;"><strong>${t("agenda.time_label")}:</strong> ${timeInfo}</p>
            ${form.location ? `<p style="color:#64748b;margin:4px 0;"><strong>${t("agenda.location")}:</strong> ${form.location}</p>` : ""}
            ${form.description ? `<p style="color:#475569;margin:12px 0;">${form.description.replace(/\n/g, "<br>")}</p>` : ""}
            ${form.withJitsi && jitsiUrl ? `
              <div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
                <p style="margin:0 0 8px;font-weight:600;color:#1d4ed8;">${t("agenda.jitsi_video_meeting")}</p>
                <a href="${jitsiUrl}" style="color:#2563eb;text-decoration:none;font-size:14px;">${jitsiUrl}</a>
              </div>
            ` : ""}
          </div>
        `;
        try {
          await fetch("/api/mail/send", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              account: inviteAccount,
              to: inviteRecipients,
              subject: t("agenda.invite_subject", { title: form.title, date: form.date }),
              html: bodyHtml,
              text: t("agenda.invite_text", { title: form.title, date: form.date, time: timeInfo, location: form.location ? `\n${t("agenda.location")}: ${form.location}` : "", jitsi: form.withJitsi ? `\nJitsi: ${jitsiUrl}` : "" }),
              icalEvent: { method: "REQUEST", content: inviteIcs },
            }),
          });
        } catch {
          // Uitnodiging-fout mag het aanmaken niet blokkeren.
        } finally {
          setSendingInvite(false);
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
      setSendingInvite(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">
            {form.type === "event" ? t("agenda.new_appointment") : t("agenda.new_task")}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded cursor-pointer"><X size={16} className="text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
            <button onClick={() => setForm(f => ({ ...f, type: "event" }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${form.type === "event" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
              <CalendarDays size={13} /> {t("agenda.appointment")}
            </button>
            <button onClick={() => setForm(f => ({ ...f, type: "task" }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${form.type === "task" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"}`}>
              <CheckSquare size={13} /> {t("agenda.task")}
            </button>
          </div>

          {/* Doel-agenda (alleen voor afspraken, en alleen als er schrijfbare
              CalDAV-agenda's zijn). Laatst gekozen wordt de default. */}
          {form.type === "event" && writableCalDav.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.target_calendar_label", { defaultValue: "Agenda" })}</label>
              <select value={form.calendarTarget}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, calendarTarget: v })); setDefaultCalendarTarget(v); }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="erpnext">{t("agenda.target_erpnext", { defaultValue: "ERPNext" })}</option>
                {writableCalDav.map(c => (
                  <option key={c.id} value={`caldav:${c.id}`}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.title_label")}</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("agenda.meeting_placeholder")} autoFocus />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.date_label")}</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {!form.allDay && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.from")}</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.to")}</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.allDay} onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))} className="rounded border-slate-300" />
            {t("agenda.all_day")}
          </label>

          {/* Location (events only) */}
          {form.type === "event" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.location")}</label>
              <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("agenda.location_placeholder")} />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instance_bar.feedback_description_label")}</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3} placeholder={t("agenda.description_placeholder")} />
          </div>

          {/* Jitsi toggle */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
              <input type="checkbox" checked={form.withJitsi} onChange={toggleJitsi} className="rounded border-slate-300" />
              <Video size={15} className="text-blue-600" /> {t("agenda.add_jitsi_video")}
            </label>
            {form.withJitsi && (
              <div className="ml-6">
                <div className="flex items-center gap-2">
                  <input type="text" value={form.jitsiRoom} onChange={e => setForm(f => ({ ...f, jitsiRoom: e.target.value }))}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t("agenda.room_name_placeholder")} />
                </div>
                {jitsiUrl && (
                  <a href={jitsiUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block">{jitsiUrl}</a>
                )}
              </div>
            )}
          </div>

          {/* Invite emails */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Send size={11} className="inline mr-1" />
              {t("agenda.send_invite_optional")}
            </label>
            <RecipientInput
              value={form.inviteEmails}
              onChange={(v) => setForm(f => ({ ...f, inviteEmails: v }))}
              instanceId={getActiveInstanceId()}
              placeholder={t("agenda.invite_emails_placeholder")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-slate-400 mt-0.5">{t("agenda.separate_addresses_hint")}</p>
          </div>

          {error && <div className="p-2 bg-red-50 text-xs text-red-600 rounded border border-red-200">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">{t("common.cancel")}</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {saving ? (sendingInvite ? t("agenda.sending_invite") : t("common.saving")) : (
              <><Plus size={14} /> {form.inviteEmails.trim() ? t("agenda.save_and_invite") : t("common.save")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Event detail / edit modal ─── */

function EventDetailModal({ event, calendars, onClose, onUpdated }: {
  event: EventItem;
  calendars: CustomCalendar[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation();
  const isErpEvent = event.type === "event";
  const isErpTask = event.type === "task";
  // O365- en CalDAV-events worden alleen geladen als "calendar-bridge" actief
  // is (zie loadIcalEvents/loadO365Events) — event.type kan dus in Fase 1
  // nooit "o365"/"ical" zijn. De check hier is een expliciete tweede grendel
  // zodat de PATCH/POST-aanroepen naar /api/calendar/* hieronder nooit
  // bereikbaar zijn, ook niet via een stale event-object.
  const bridgeEnabled = isFeatureEnabled("calendar-bridge");
  const isO365 = bridgeEnabled && event.type === "o365";
  // CalDAV-event is bewerkbaar als de bron-agenda schrijfbaar is (vault-account
  // met server-side creds). Publieke iCal-feeds (geen accountId) blijven read-only.
  const calDavSource = bridgeEnabled && event.type === "ical"
    ? calendars.find(c => c.id === event.calendarId && !!c.accountId)
    : undefined;
  const isCalDav = !!calDavSource;
  const canEdit = isErpEvent || isErpTask || isO365 || isCalDav;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  // Editable fields
  const startDate = new Date(event.start);
  const endDate = event.end ? new Date(event.end) : null;
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(formatDateKey(startDate));
  const [startTime, setStartTime] = useState(
    event.allDay ? "09:00" : `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`
  );
  const [endTime, setEndTime] = useState(
    event.allDay || !endDate ? "10:00" : `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`
  );
  const [allDay, setAllDay] = useState(event.allDay);
  const [description, setDescription] = useState(event.description || "");
  const [location, setLocation] = useState(event.location || "");
  // Pre-fill deelnemers vanuit het bestaande CalDAV-event zodat een wijziging
  // dezelfde mensen opnieuw een (bijgewerkte) uitnodiging stuurt.
  const [inviteEmails, setInviteEmails] = useState(() => (event.attendees || []).join(", "));
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // Extract ERPNext document name from event id (e.g. "event-EVT-00123" → "EVT-00123")
  const docName = event.id.replace(/^(event|task)-/, "");

  async function handleSave() {
    if (!title.trim()) { setError(t("agenda.fill_title")); return; }
    setSaving(true);
    setError("");
    try {
      const startDt = allDay ? date : `${date} ${startTime}:00`;
      const endDt = allDay ? date : `${date} ${endTime}:00`;
      const inviteRecipients = inviteEmails.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
      let inviteIcs: string | undefined;
      let inviteAccount: string | undefined;

      if (isErpEvent) {
        await updateDocument("Event", docName, {
          subject: title,
          starts_on: startDt,
          ends_on: endDt,
          all_day: allDay ? 1 : 0,
          description,
          location,
        });
      } else if (isErpTask) {
        await updateDocument("Task", docName, {
          subject: title,
          exp_start_date: date,
          exp_end_date: date,
          description,
        });
      } else if (isO365) {
        const graphEventId = event.id.replace(/^o365-/, "");
        const instanceId = getActiveInstanceId();
        const email = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
        const body: Record<string, unknown> = { subject: title };
        if (allDay) {
          body.isAllDay = true;
          body.start = { dateTime: `${date}T00:00:00`, timeZone: "Europe/Amsterdam" };
          // Graph API requires end = day AFTER for all-day events
          const nextDay = new Date(date);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextKey = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
          body.end = { dateTime: `${nextKey}T00:00:00`, timeZone: "Europe/Amsterdam" };
        } else {
          body.isAllDay = false;
          body.start = { dateTime: `${date}T${startTime}:00`, timeZone: "Europe/Amsterdam" };
          body.end = { dateTime: `${date}T${endTime}:00`, timeZone: "Europe/Amsterdam" };
        }
        if (location) body.location = { displayName: location };
        if (description) body.body = { contentType: "text", content: description };

        const res = await fetch(`/api/calendar/o365/${encodeURIComponent(graphEventId)}?email=${encodeURIComponent(email)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((err as any).error || `O365 update failed: ${res.status}`);
        }
      } else if (isCalDav && calDavSource) {
        // CalDAV-event bijwerken: zelfde UID (overschrijft <uid>.ics) + hogere
        // SEQUENCE zodat de agenda van genodigden de wijziging accepteert.
        const res = await fetch("/api/calendar/event", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: calDavSource.url,
            account: calDavSource.accountId,
            uid: event.icalUid,
            sequence: Math.floor(Date.now() / 1000),
            summary: title,
            start: allDay ? date : `${date}T${startTime}`,
            end: allDay ? date : `${date}T${endTime}`,
            allDay,
            description,
            location,
            attendees: inviteRecipients.length ? inviteRecipients : undefined,
          }),
        });
        const j = await res.json().catch(() => ({} as { ok?: boolean; error?: string; inviteIcs?: string }));
        if (!res.ok || !j.ok) throw new Error(j.error || `CalDAV ${res.status}`);
        inviteIcs = j.inviteIcs;
        inviteAccount = calDavSource.accountId;
      }
      // Echte iMIP-uitnodiging (UPDATE) versturen als de CalDAV-edit een invite-.ics
      // teruggaf: zelfde UID + hogere SEQUENCE → de agenda van de genodigde werkt
      // zichzelf bij. Geen losse platte mail meer.
      if (inviteIcs && inviteRecipients.length) {
        setSendingInvite(true);
        const timeInfo = allDay ? t("agenda.all_day") : `${startTime} - ${endTime}`;
        try {
          await fetch("/api/mail/send", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              account: inviteAccount,
              to: inviteRecipients,
              subject: t("agenda.invite_subject", { title, date }),
              html: `<div style="font-family:sans-serif;max-width:520px;">
                <h2>${title}</h2>
                <p><strong>${t("agenda.date_label")}:</strong> ${new Date(date).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                <p><strong>${t("agenda.time_label")}:</strong> ${timeInfo}</p>
                ${location ? `<p><strong>${t("agenda.location")}:</strong> ${location}</p>` : ""}
                ${description ? `<p>${description.replace(/\n/g, "<br>")}</p>` : ""}
              </div>`,
              text: `${title}\n${t("agenda.date_label")}: ${date}\n${t("agenda.time_label")}: ${timeInfo}${location ? `\n${t("agenda.location")}: ${location}` : ""}`,
              icalEvent: { method: "REQUEST", content: inviteIcs },
            }),
          });
          setInviteSent(true);
        } catch { /* uitnodiging-fout blokkeert de update niet */ }
        finally { setSendingInvite(false); }
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      if (isErpEvent) {
        await deleteDocument("Event", docName);
      } else if (isErpTask) {
        await deleteDocument("Task", docName);
      } else if (isO365) {
        const graphEventId = event.id.replace(/^o365-/, "");
        const instanceId = getActiveInstanceId();
        const email = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
        const res = await fetch(`/api/calendar/o365/${encodeURIComponent(graphEventId)}?email=${encodeURIComponent(email)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error((err as any).error || `O365 delete failed: ${res.status}`);
        }
      }
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const typeLabel = event.type === "ical" ? t("nav.calendar") : t(TYPE_LABEL_KEYS[event.type] || "nav.calendar");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: event.color + "20", color: event.color }}>
              {typeLabel}
            </span>
            {!editing && canEdit && (
              <button onClick={() => setEditing(true)}
                className="p-1 hover:bg-slate-100 rounded cursor-pointer text-slate-400 hover:text-slate-600" title={t("common.edit")}>
                <Pencil size={14} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded cursor-pointer">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Title */}
          {editing ? (
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus />
          ) : (
            <h3 className="text-lg font-semibold text-slate-800">{event.title}</h3>
          )}

          {/* Date & time */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.date_label")}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={allDay} onChange={() => setAllDay(!allDay)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                {t("agenda.all_day")}
              </label>
              {!allDay && (
                <div className="flex items-center gap-2">
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-slate-400">–</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                {startDate.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </span>
              {!event.allDay && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  {formatTime(event.start)}
                  {event.end ? ` – ${formatTime(event.end)}` : ""}
                </span>
              )}
              {event.allDay && (
                <span className="text-xs text-slate-400">{t("agenda.all_day")}</span>
              )}
            </div>
          )}

          {/* Location */}
          {editing && (isErpEvent || isO365) ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.location")}</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ) : event.location ? (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-400" />
              {event.location}
            </div>
          ) : null}

          {/* Owner */}
          {event.owner && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <Users size={14} className="text-slate-400" />
              {event.owner}
            </div>
          )}

          {/* Description */}
          {editing ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.description_label")}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          ) : event.description ? (
            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{event.description}</div>
          ) : null}

          {/* Invite emails — visible in edit mode */}
          {editing && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("agenda.invite_people")}</label>
              <RecipientInput
                value={inviteEmails}
                onChange={setInviteEmails}
                instanceId={getActiveInstanceId()}
                placeholder={t("agenda.invite_placeholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-[10px] text-slate-400 mt-1">{t("agenda.invite_hint")}</p>
              {inviteSent && (
                <p className="text-xs text-green-600 mt-1">{t("agenda.invite_sent")}</p>
              )}
            </div>
          )}

          {/* Jitsi link */}
          {event.description?.includes("meet.jit.si") && !editing && (
            <a href={event.description.match(/https:\/\/meet\.jit\.si\/\S+/)?.[0] || "#"}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <Video size={14} /> {t("agenda.open_jitsi_meeting")}
            </a>
          )}

          {/* Outlook link */}
          {event.webLink && !editing && (
            <a href={event.webLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm hover:underline" style={{ color: TYPE_COLORS.o365 }}>
              <ExternalLink size={14} /> {t("agenda.open_in_outlook")}
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          {/* Delete button (left) */}
          <div>
            {canEdit && !editing && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">{t("agenda.confirm_delete")}</span>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                    {deleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {t("common.delete")}
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 rounded-lg cursor-pointer">
                    {t("common.cancel")}
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs cursor-pointer transition-colors">
                  <Trash2 size={13} />
                  {t("common.delete")}
                </button>
              )
            )}
          </div>

          {/* Save/close buttons (right) */}
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">
                  {t("common.cancel")}
                </button>
                <button onClick={handleSave} disabled={saving || sendingInvite || !title.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {t("common.save")}
                </button>
              </>
            ) : (
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">
                {t("common.close")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Component ─── */

export default function Agenda() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [viewType, setViewType] = useState<ViewType>("week");
  // On mobile, week view is unusable (42px columns) — fall back to day view
  useEffect(() => { if (isMobile && viewType === "week") setViewType("day"); }, [isMobile]);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [icalEvents, setIcalEvents] = useState<EventItem[]>([]);
  const [o365Events, setO365Events] = useState<EventItem[]>([]);
  const [o365Enabled, setO365Enabled] = useState(() => localStorage.getItem(getPrefKey("o365_enabled")) !== "false");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createModal, setCreateModal] = useState<Partial<CreateForm> | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  // Het bronnenpaneel staat standaard open: daar zitten de agenda’s van
  // collega’s in, en die zijn onvindbaar als je eerst een tandwiel moet
  // aanklikken. Wie het dichtklapt houdt het dicht.
  const [showSettings, setShowSettings] = useState(() => {
    try {
      return localStorage.getItem("agenda_panel_dicht") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("agenda_panel_dicht", showSettings ? "0" : "1");
    } catch {
      // Privémodus — de stand geldt dan alleen deze sessie.
    }
  }, [showSettings]);
  const [addCalendarModal, setAddCalendarModal] = useState(false);
  const [dragCreate, setDragCreate] = useState<DragCreateState | null>(null);
  const dragCreateRef = useRef<DragCreateState | null>(null);
  useEffect(() => { dragCreateRef.current = dragCreate; }, [dragCreate]);
  const leaves = useLeaves();

  // Collega-agenda's: de lijst om uit te kiezen, en wat er aan staat.
  const [collegas, setCollegas] = useState<Collega[]>([]);
  const [gekozenCollegas, setGekozenCollegasState] = useState<string[]>([]);

  useEffect(() => {
    let gestopt = false;
    void (async () => {
      const [lijst, ik] = await Promise.all([haalCollegas(), resolveSessionUser()]);
      if (gestopt) return;
      setCollegas(lijst);
      const bewaard = getGekozenCollegas();
      if (bewaard !== null) { setGekozenCollegasState(bewaard); return; }
      // Eerste keer: alleen je eigen agenda. Meteen die van iedereen tonen
      // maakt de agenda onleesbaar en kost vijftien keer zoveel ophaalwerk.
      const eigen = String(ik || "").toLowerCase();
      const start = lijst.some((c) => c.email === eigen) ? [eigen] : [];
      setGekozenCollegasState(start);
      setGekozenCollegas(start);
    })();
    return () => { gestopt = true; };
  }, []);

  const collegaKleuren = useMemo(() => kleurenVoorCollegas(collegas), [collegas]);

  function handleCollegaToggle(email: string) {
    setGekozenCollegasState((vorige) => {
      const next = vorige.includes(email) ? vorige.filter((e) => e !== email) : [...vorige, email];
      setGekozenCollegas(next);
      return next;
    });
  }

  // ERPNext source toggles
  const [erpSources, setErpSources] = useState<Record<ErpSourceKey, boolean>>({
    events: getErpSourceEnabled("events"),
    tasks: getErpSourceEnabled("tasks"),
    leaves: getErpSourceEnabled("leaves"),
    timesheets: getErpSourceEnabled("timesheets"),
    mailbox: getErpSourceEnabled("mailbox"),
  });

  // Custom calendars
  const [calendars, setCalendars] = useState<CustomCalendar[]>(() => getCustomCalendars());

  const today = useMemo(() => new Date(), []);

  const dateRange = useMemo(() => {
    if (viewType === "month") {
      const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
      return { start: formatDateKey(days[0]), end: formatDateKey(days[days.length - 1]) };
    } else if (viewType === "week") {
      const days = getWeekDays(currentDate);
      return { start: formatDateKey(days[0]), end: formatDateKey(days[6]) };
    } else {
      const key = formatDateKey(currentDate);
      return { start: key, end: key };
    }
  }, [currentDate, viewType]);

  /* ─── Toggle handlers ─── */

  function handleErpToggle(key: ErpSourceKey) {
    setErpSources(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setErpSourceEnabled(key, next[key]);
      return next;
    });
  }

  function handleCalendarToggle(id: string) {
    setCalendars(prev => {
      const next = prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c);
      saveCustomCalendars(next);
      return next;
    });
  }

  function handleCalendarRemove(id: string) {
    setCalendars(prev => {
      const next = prev.filter(c => c.id !== id);
      saveCustomCalendars(next);
      return next;
    });
  }

  function handleAddCalendar(cal: CustomCalendar) {
    setCalendars(prev => {
      const next = [...prev, cal];
      saveCustomCalendars(next);
      return next;
    });
  }

  /* ─── Load ERPNext events ─── */

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const fetches: Promise<any>[] = [];
      const fetchLabels: string[] = [];

      if (erpSources.events) {
        fetches.push(fetchList<{
          name: string; subject: string; starts_on: string; ends_on: string;
          all_day: number; event_type: string; description: string; location: string;
        }>("Event", {
          fields: ["name", "subject", "starts_on", "ends_on", "all_day", "event_type", "description", "location"],
          filters: [
            ["starts_on", ">=", dateRange.start],
            ["starts_on", "<=", dateRange.end + " 23:59:59"],
            ["status", "=", "Open"],
          ],
          limit_page_length: 200,
          order_by: "starts_on asc",
        }));
        fetchLabels.push("events");
      }

      if (erpSources.tasks) {
        fetches.push(fetchList<{
          name: string; subject: string; exp_start_date: string; exp_end_date: string;
          status: string; priority: string;
        }>("Task", {
          fields: ["name", "subject", "exp_start_date", "exp_end_date", "status", "priority"],
          filters: [
            ["exp_start_date", ">=", dateRange.start],
            ["exp_start_date", "<=", dateRange.end],
            ["status", "not in", ["Cancelled", "Completed"]],
          ],
          limit_page_length: 200,
        }));
        fetchLabels.push("tasks");
      }

      if (erpSources.timesheets) {
        // Eén agenda-item per medewerker per DAG, uit de geboekte regels —
        // niet één item per Timesheet. Sinds de urenstaat per jaar loopt
        // (lib/year-timesheet.ts) zou een sheet-item één blok van twaalf
        // maanden zijn, en het oude filter op `start_date` binnen het bereik
        // liet hem buiten januari zelfs helemaal weg. Eén gedeelde fetch voor
        // het hele zichtbare bereik, geen call per dag.
        fetches.push(
          fetchTimesheetHourRows(
            { from: dateRange.start, to: dateRange.end },
            { fetchList, fetchChildTable }
          ).then(aggregateHoursByEmployeeDay)
        );
        fetchLabels.push("timesheets");
      }

      const results = await Promise.allSettled(fetches);
      const items: EventItem[] = [];

      results.forEach((result, idx) => {
        if (result.status !== "fulfilled") return;
        const label = fetchLabels[idx];

        if (label === "events") {
          for (const e of result.value) {
            items.push({
              id: `event-${e.name}`, title: e.subject || t("agenda.no_title"),
              start: e.starts_on, end: e.ends_on || undefined,
              allDay: !!e.all_day, type: "event", color: TYPE_COLORS.event,
              description: e.description, location: e.location,
            });
          }
        } else if (label === "tasks") {
          for (const t of result.value) {
            if (t.exp_start_date) {
              items.push({
                id: `task-${t.name}`, title: t.subject,
                start: t.exp_start_date, end: t.exp_end_date || undefined,
                allDay: true, type: "task", color: TYPE_COLORS.task,
              });
            }
          }
        } else if (label === "timesheets") {
          for (const day of result.value as EmployeeDayTotal[]) {
            items.push({
              id: `ts-${day.employee}-${day.date}`,
              title: `${day.employee_name || day.employee} - ${day.hours}u`,
              start: day.date, end: undefined,
              allDay: true, type: "timesheet", color: TYPE_COLORS.timesheet,
              owner: day.employee_name,
            });
          }
        }
      });

      // Agenda's van de mailserver. Los van `fetches` hierboven omdat het
      // resultaat een andere vorm heeft en de adapter zijn eigen fouten al
      // opvangt — een onbereikbare mailserver hoort de agenda niet leeg te maken.
      if (erpSources.mailbox) {
        const { afspraken } = await haalAgendas(dateRange.start, dateRange.end, gekozenCollegas);
        for (const a of afspraken) {
          if (!a.start) continue;
          items.push({
            id: `mb-${a.gebruiker}-${a.id}`,
            title: a.titel || t("agenda.no_title"),
            start: a.start.replace("T", " "),
            end: eindTijd(a.start, a.duur),
            allDay: !!a.hele_dag,
            type: "mailbox",
            color: collegaKleuren.get(a.gebruiker) || TYPE_COLORS.mailbox,
            owner: a.gebruiker.split("@")[0],
          });
        }
      }

      // Leaves
      if (erpSources.leaves) {
        for (const lv of leaves) {
          if (lv.status !== "Approved") continue;
          if (lv.from_date <= dateRange.end && lv.to_date >= dateRange.start) {
            items.push({
              id: `leave-${lv.name}`, title: `${lv.employee_name} - ${lv.leave_type}`,
              start: lv.from_date, end: lv.to_date,
              allDay: true, type: "leave", color: TYPE_COLORS.leave,
              owner: lv.employee_name,
            });
          }
        }
      }

      setEvents(items);
    } catch (err) {
      console.error("Agenda fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end, leaves, erpSources]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  /* ─── Load iCal events ─── */

  const loadIcalEvents = useCallback(async () => {
    // /api/calendar/ical is Express-only — gate the whole CalDAV/iCal bridge
    // behind "calendar-bridge" so it never fires against the standalone
    // ERPNext deployment (see getWritableCalDavCalendars above).
    if (!isFeatureEnabled("calendar-bridge")) { setIcalEvents([]); return; }
    const enabledCals = calendars.filter(c => c.enabled);
    if (enabledCals.length === 0) { setIcalEvents([]); return; }

    const allIcalItems: EventItem[] = [];

    await Promise.allSettled(enabledCals.map(async (cal) => {
      try {
        const acctParam = cal.accountId ? `&account=${encodeURIComponent(cal.accountId)}` : "";
        const res = await fetch(`/api/calendar/ical?url=${encodeURIComponent(cal.url)}${acctParam}`);
        if (!res.ok) return;
        const { data } = await res.json() as {
          data: Array<{
            uid: string; summary: string; dtstart: string; dtend: string;
            description: string; location: string; allDay: boolean;
            organizer?: string; attendees?: string[];
          }>;
        };

        for (const ev of data) {
          // Filter to date range
          const evStart = ev.dtstart.split(" ")[0];
          const evEnd = ev.dtend ? ev.dtend.split(" ")[0] : evStart;
          if (evEnd < dateRange.start || evStart > dateRange.end) continue;

          allIcalItems.push({
            id: `ical-${cal.id}-${ev.uid}`,
            title: ev.summary,
            start: ev.dtstart,
            end: ev.dtend || undefined,
            allDay: ev.allDay,
            type: "ical",
            color: cal.color,
            description: ev.description,
            location: ev.location,
            calendarId: cal.id,
            icalUid: ev.uid,
            attendees: ev.attendees || [],
          });
        }
      } catch (err) {
        console.warn(`[agenda] Failed to load calendar ${cal.name}:`, err);
      }
    }));

    setIcalEvents(allIcalItems);
  }, [calendars, dateRange.start, dateRange.end]);

  useEffect(() => { loadIcalEvents(); }, [loadIcalEvents]);

  /* ─── Load Office 365 calendar ─── */

  const loadO365Events = useCallback(async () => {
    // /api/calendar/o365 is Express-only (Graph API bridge) — gate behind
    // "calendar-bridge" so it never fires against the standalone ERPNext
    // deployment, regardless of the (per-device) o365Enabled preference.
    if (!isFeatureEnabled("calendar-bridge") || !o365Enabled) { setO365Events([]); return; }
    const instanceId = getActiveInstanceId();
    // Try to resolve the user's email — first from localStorage (Webmail
    // config), then by looking up the Employee in ERPNext.
    let email = localStorage.getItem(`pref_${instanceId}_imap_user`) || "";
    if (!email) {
      try {
        const empRes = await fetchList<{ company_email: string; user_id: string }>("Employee", {
          fields: ["company_email", "user_id"],
          filters: [["status", "=", "Active"]],
          limit_page_length: 5,
        });
        for (const emp of empRes) {
          if (emp.company_email) { email = emp.company_email; break; }
          if (emp.user_id) { email = emp.user_id; break; }
        }
      } catch { /* ignore */ }
    }
    if (!email) { setO365Events([]); return; }

    try {
      const res = await fetch(`/api/calendar/o365?email=${encodeURIComponent(email)}&start=${dateRange.start}&end=${dateRange.end}`, { credentials: "same-origin" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("[agenda] O365 calendar error:", (err as any).error || res.status);
        return;
      }
      const { data } = await res.json() as { data: Array<{
        id: string; subject: string; start: string; end: string;
        isAllDay: boolean; location: string; bodyPreview: string;
        organizer: string; attendees: string[]; webLink: string;
      }> };

      const items: EventItem[] = data.map(e => ({
        id: `o365-${e.id}`,
        title: e.subject,
        start: e.start,
        end: e.end || undefined,
        allDay: e.isAllDay,
        type: "o365" as const,
        color: TYPE_COLORS.o365,
        description: e.bodyPreview,
        location: e.location,
        owner: e.organizer,
        webLink: e.webLink,
      }));

      console.log(`[agenda] Loaded ${items.length} O365 events`);
      setO365Events(items);
    } catch (err) {
      console.warn("[agenda] O365 calendar fetch error:", err);
    }
  }, [o365Enabled, dateRange.start, dateRange.end]);

  useEffect(() => { loadO365Events(); }, [loadO365Events]);

  /* ─── Combined events ─── */

  const allEvents = useMemo(() => [...events, ...icalEvents, ...o365Events], [events, icalEvents, o365Events]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const e of allEvents) {
      const startDate = e.start.split("T")[0].split(" ")[0];
      const endDate = e.end ? e.end.split("T")[0].split(" ")[0] : startDate;
      const current = new Date(startDate + "T12:00:00");
      const last = new Date(endDate + "T12:00:00");
      while (current <= last) {
        const key = formatDateKey(current);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [allEvents]);

  /* ─── Active legend (only show visible sources) ─── */

  const activeLegend = useMemo(() => {
    const items: Array<{ label: string; color: string }> = [];
    // Alleen tonen als de calendar-bridge daadwerkelijk actief is: anders
    // suggereert dit label een gekoppelde, live Outlook-bron terwijl
    // loadO365Events() hierboven altijd leeg blijft (Express-only route,
    // bestaat niet op de standalone ERPNext-deployment) — dat oogde als een
    // "verbonden maar leeg" agenda i.p.v. een simpelweg niet-actieve bron.
    if (o365Enabled && isFeatureEnabled("calendar-bridge")) {
      items.push({ label: t("agenda.outlook_365"), color: TYPE_COLORS.o365 });
    }
    if (erpSources.events) items.push({ label: t("agenda.source_events"), color: TYPE_COLORS.event });
    if (erpSources.tasks) items.push({ label: t("agenda.source_tasks"), color: TYPE_COLORS.task });
    if (erpSources.leaves) items.push({ label: t("agenda.legend_leaves"), color: TYPE_COLORS.leave });
    if (erpSources.timesheets) items.push({ label: t("agenda.source_timesheets"), color: TYPE_COLORS.timesheet });
    for (const cal of calendars) {
      if (cal.enabled) items.push({ label: cal.name, color: cal.color });
    }
    return items;
  }, [erpSources, calendars, o365Enabled, gekozenCollegas, collegaKleuren, t]);

  /* ─── Click-to-create handler ─── */

  function handleSlotClick(date: string, hour?: number) {
    const startTime = hour !== undefined ? `${String(hour).padStart(2, "0")}:00` : "09:00";
    const endHour = hour !== undefined ? hour + 1 : 10;
    const endTime = `${String(endHour).padStart(2, "0")}:00`;
    setCreateModal({
      type: "event",
      date,
      startTime,
      endTime,
      allDay: hour === undefined,
    });
  }

  /* ─── Navigation ─── */

  function navigate(dir: number) {
    const d = new Date(currentDate);
    if (viewType === "month") d.setMonth(d.getMonth() + dir);
    else if (viewType === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }

  function goToday() { setCurrentDate(new Date()); }

  /* ─── Month view ─── */

  function renderMonthView() {
    const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAY_KEYS.map((key) => (
            <div key={key} className="px-1 md:px-2 py-1.5 md:py-2 text-[10px] md:text-xs font-semibold text-slate-500 text-center">{t(key)}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {days.map((day) => {
            const key = formatDateKey(day);
            const isToday = isSameDay(day, today);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayEvents = eventsByDate.get(key) || [];

            return (
              <div key={key} onClick={() => setSelectedDate(day)}
                onDoubleClick={() => handleSlotClick(key)}
                className={`border-b border-r border-slate-100 p-0.5 md:p-1 min-h-[60px] md:min-h-[80px] cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                } ${!isCurrentMonth ? "bg-slate-50/50" : ""}`}>
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-medium ${
                    isToday ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" :
                    isCurrentMonth ? "text-slate-700" : "text-slate-400"
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="mt-0.5 md:mt-1 space-y-0.5">
                  {isMobile ? (
                    /* Mobile: compact dot indicators */
                    dayEvents.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 px-0.5">
                        {dayEvents.slice(0, 4).map((e) => (
                          <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                        ))}
                        {dayEvents.length > 4 && <span className="text-[8px] text-slate-400">+{dayEvents.length - 4}</span>}
                      </div>
                    )
                  ) : (
                    /* Desktop: full event labels */
                    <>
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate hover:brightness-90 transition-all"
                          onClick={(ev) => { ev.stopPropagation(); setDetailEvent(e); }}
                          style={{ backgroundColor: e.color + "20", color: e.color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                          <span className="truncate font-medium">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-slate-400 px-1">{t("agenda.more_count", { count: dayEvents.length - 3 })}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── Helpers for time-based positioning ─── */

  const HOUR_HEIGHT = 48;
  const START_HOUR = 7;
  const TOTAL_HOURS = 14;
  const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

  function getEventPosition(e: EventItem) {
    const start = new Date(e.start);
    const startMin = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    let durationMin = 60;
    if (e.end) {
      durationMin = Math.max(15, (new Date(e.end).getTime() - start.getTime()) / 60000);
    }
    return {
      top: (startMin / 60) * HOUR_HEIGHT,
      height: Math.max(20, (durationMin / 60) * HOUR_HEIGHT),
    };
  }

  /* ─── Drag-to-create (week- & dagweergave) ─── */

  const SNAP_MINUTES = 30;

  function minutesToTime(min: number): string {
    const h = START_HOUR + Math.floor(min / 60);
    return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  function getDragSelection(d: DragCreateState): { startMin: number; endMin: number } {
    const toMin = (y: number) => Math.max(0, Math.min(TOTAL_HOURS * 60, (y / d.hourHeight) * 60));
    let startMin = Math.floor(toMin(Math.min(d.startY, d.currentY)) / SNAP_MINUTES) * SNAP_MINUTES;
    let endMin = Math.ceil(toMin(Math.max(d.startY, d.currentY)) / SNAP_MINUTES) * SNAP_MINUTES;
    if (endMin - startMin < SNAP_MINUTES) endMin = startMin + SNAP_MINUTES;
    if (endMin > TOTAL_HOURS * 60) { endMin = TOTAL_HOURS * 60; startMin = Math.min(startMin, endMin - SNAP_MINUTES); }
    return { startMin, endMin };
  }

  function handleDragStart(ev: ReactMouseEvent<HTMLDivElement>, dateKey: string, hourHeight: number) {
    if (ev.button !== 0 || isMobile) return;
    ev.preventDefault(); // geen tekstselectie tijdens het slepen
    const rect = ev.currentTarget.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    setDragCreate({ dateKey, hourHeight, rectTop: rect.top, startY: y, currentY: y, moved: false });
  }

  const isDragging = dragCreate !== null;
  useEffect(() => {
    if (!isDragging) return;
    function onMove(ev: globalThis.MouseEvent) {
      setDragCreate(prev => {
        if (!prev) return prev;
        const y = Math.max(0, Math.min(TOTAL_HOURS * prev.hourHeight, ev.clientY - prev.rectTop));
        return { ...prev, currentY: y, moved: prev.moved || Math.abs(y - prev.startY) > 4 };
      });
    }
    function onUp() {
      const d = dragCreateRef.current;
      setDragCreate(null);
      // Drempel van 4px: een gewone (dubbel)klik blijft gewoon werken
      if (d?.moved) {
        const { startMin, endMin } = getDragSelection(d);
        setCreateModal({
          type: "event",
          date: d.dateKey,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          allDay: false,
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  function renderDragOverlay(dateKey: string, hourHeight: number) {
    if (!dragCreate || !dragCreate.moved || dragCreate.dateKey !== dateKey) return null;
    const { startMin, endMin } = getDragSelection(dragCreate);
    return (
      <div className="absolute left-0.5 right-0.5 rounded bg-blue-500/15 border border-blue-400 z-20 pointer-events-none px-1.5 py-0.5 overflow-hidden"
        style={{ top: (startMin / 60) * hourHeight, height: ((endMin - startMin) / 60) * hourHeight }}>
        <span className="text-[10px] font-medium text-blue-700 whitespace-nowrap">
          {minutesToTime(startMin)} – {minutesToTime(endMin)}
        </span>
      </div>
    );
  }

  /** Lay out overlapping events side-by-side */
  function layoutOverlaps(events: EventItem[]): (EventItem & { left: number; width: number })[] {
    if (events.length === 0) return [];
    const positioned = events.map(e => {
      const pos = getEventPosition(e);
      return { ...e, _top: pos.top, _bottom: pos.top + pos.height, left: 0, width: 1 };
    }).sort((a, b) => a._top - b._top || a._bottom - b._bottom);

    const columns: { end: number }[][] = [];
    for (const ev of positioned) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].every(c => c.end <= ev._top)) {
          columns[col].push({ end: ev._bottom });
          ev.left = col;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.left = columns.length;
        columns.push([{ end: ev._bottom }]);
      }
    }
    const totalCols = columns.length;
    for (const ev of positioned) {
      ev.width = 1 / totalCols;
      ev.left = ev.left / totalCols;
    }
    return positioned;
  }

  /* ─── Week view ─── */

  function renderWeekView() {
    const days = getWeekDays(currentDate);
    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div />
          {days.map((day, idx) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={formatDateKey(day)} className="px-2 py-2 text-center border-l border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase">{t(WEEKDAY_KEYS[idx])}</div>
                <div className={`text-lg font-semibold mt-0.5 ${isToday ? "text-blue-600" : "text-slate-700"}`}>{day.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-white flex-shrink-0 min-h-[28px]">
          <div className="text-[10px] text-slate-400 px-2 py-1">{t("agenda.all_day")}</div>
          {days.map((day) => {
            const key = formatDateKey(day);
            const allDayEvents = (eventsByDate.get(key) || []).filter(e => e.allDay);
            return (
              <div key={key} className="border-l border-slate-200 px-1 py-0.5 space-y-0.5 cursor-pointer"
                onDoubleClick={() => handleSlotClick(key)}>
                {allDayEvents.slice(0, 2).map((e) => (
                  <div key={e.id} className="text-[10px] px-1 py-0.5 rounded truncate font-medium"
                    style={{ backgroundColor: e.color + "20", color: e.color }}>
                    {e.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]" style={{ height: GRID_HEIGHT }}>
            {/* Time labels column */}
            <div className="relative">
              {hours.map((hour) => (
                <div key={hour} className="absolute text-[10px] text-slate-400 text-right pr-3 w-full"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                  <span className="relative -top-[6px]">{String(hour).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* Day columns */}
            {days.map((day) => {
              const key = formatDateKey(day);
              const timedEvents = (eventsByDate.get(key) || []).filter(e => !e.allDay);
              const laid = layoutOverlaps(timedEvents);
              return (
                <div key={key} className="relative border-l border-slate-100"
                  onMouseDown={(ev) => handleDragStart(ev, key, HOUR_HEIGHT)}
                  onDoubleClick={(ev) => {
                    const rect = ev.currentTarget.getBoundingClientRect();
                    const y = ev.clientY - rect.top;
                    const hour = Math.floor(y / HOUR_HEIGHT) + START_HOUR;
                    handleSlotClick(key, hour);
                  }}>
                  {/* Hour grid lines */}
                  {hours.map((hour) => (
                    <div key={hour} className="absolute w-full border-b border-slate-100"
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
                  ))}
                  {/* Events */}
                  {laid.map((e) => {
                    const pos = getEventPosition(e);
                    return (
                      <div key={e.id}
                        className="absolute text-[10px] px-1.5 py-0.5 rounded font-medium overflow-hidden cursor-pointer z-10 hover:brightness-95 transition-all"
                        onMouseDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => { ev.stopPropagation(); setDetailEvent(e); }}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `calc(${e.left * 100}% + 2px)`,
                          width: `calc(${e.width * 100}% - 4px)`,
                          backgroundColor: e.color + "20",
                          color: e.color,
                          borderLeft: `3px solid ${e.color}`,
                        }}>
                        <div className="truncate leading-tight">{e.title}</div>
                        <div className="text-[9px] opacity-70">{formatTime(e.start)}</div>
                      </div>
                    );
                  })}
                  {renderDragOverlay(key, HOUR_HEIGHT)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Day view ─── */

  function renderDayView() {
    const DAY_HOUR_HEIGHT = 56;
    const DAY_GRID_HEIGHT = TOTAL_HOURS * DAY_HOUR_HEIGHT;
    const key = formatDateKey(currentDate);
    const dayEvents = eventsByDate.get(key) || [];
    const allDayEvents = dayEvents.filter(e => e.allDay);
    const timedEvents = dayEvents.filter(e => !e.allDay);
    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);

    function getDayEventPosition(e: EventItem) {
      const start = new Date(e.start);
      const startMin = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
      let durationMin = 60;
      if (e.end) {
        durationMin = Math.max(15, (new Date(e.end).getTime() - start.getTime()) / 60000);
      }
      return {
        top: (startMin / 60) * DAY_HOUR_HEIGHT,
        height: Math.max(28, (durationMin / 60) * DAY_HOUR_HEIGHT),
      };
    }

    // Reuse overlap layout with day-specific positioning
    const laid = (() => {
      if (timedEvents.length === 0) return [];
      const positioned = timedEvents.map(e => {
        const pos = getDayEventPosition(e);
        return { ...e, _top: pos.top, _bottom: pos.top + pos.height, left: 0, width: 1 };
      }).sort((a, b) => a._top - b._top || a._bottom - b._bottom);

      const columns: { end: number }[][] = [];
      for (const ev of positioned) {
        let placed = false;
        for (let col = 0; col < columns.length; col++) {
          if (columns[col].every(c => c.end <= ev._top)) {
            columns[col].push({ end: ev._bottom });
            ev.left = col;
            placed = true;
            break;
          }
        }
        if (!placed) {
          ev.left = columns.length;
          columns.push([{ end: ev._bottom }]);
        }
      }
      const totalCols = columns.length;
      for (const ev of positioned) {
        ev.width = 1 / totalCols;
        ev.left = ev.left / totalCols;
      }
      return positioned;
    })();

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {allDayEvents.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex-shrink-0">
            <div className="text-[10px] text-slate-400 mb-1">{t("agenda.all_day")}</div>
            <div className="flex flex-wrap gap-1">
              {allDayEvents.map((e) => (
                <span key={e.id} className="text-xs px-2 py-1 rounded font-medium"
                  style={{ backgroundColor: e.color + "20", color: e.color }}>
                  {e.title}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <div className="flex" style={{ height: DAY_GRID_HEIGHT }}>
            {/* Time labels */}
            <div className="w-16 shrink-0 relative">
              {hours.map((hour) => (
                <div key={hour} className="absolute text-xs text-slate-400 text-right pr-3 w-full"
                  style={{ top: (hour - START_HOUR) * DAY_HOUR_HEIGHT }}>
                  <span className="relative -top-[7px]">{String(hour).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
            {/* Event column */}
            <div className="flex-1 relative border-l border-slate-200"
              onMouseDown={(ev) => handleDragStart(ev, key, DAY_HOUR_HEIGHT)}
              onDoubleClick={(ev) => {
                const rect = ev.currentTarget.getBoundingClientRect();
                const y = ev.clientY - rect.top;
                const hour = Math.floor(y / DAY_HOUR_HEIGHT) + START_HOUR;
                handleSlotClick(key, hour);
              }}>
              {/* Hour grid lines */}
              {hours.map((hour) => (
                <div key={hour} className="absolute w-full border-b border-slate-100"
                  style={{ top: (hour - START_HOUR) * DAY_HOUR_HEIGHT, height: DAY_HOUR_HEIGHT }} />
              ))}
              {/* Events */}
              {laid.map((e) => {
                const pos = getDayEventPosition(e);
                return (
                  <div key={e.id}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => { ev.stopPropagation(); setDetailEvent(e); }}
                    className="absolute rounded overflow-hidden cursor-pointer z-10 px-3 py-1.5 hover:brightness-95 transition-all"
                    style={{
                      top: pos.top,
                      height: pos.height,
                      left: `calc(${e.left * 100}% + 4px)`,
                      width: `calc(${e.width * 100}% - 8px)`,
                      backgroundColor: e.color + "15",
                      borderLeft: `4px solid ${e.color}`,
                    }}>
                    <div className="text-sm font-medium truncate" style={{ color: e.color }}>{e.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span>{formatTime(e.start)}{e.end ? ` - ${formatTime(e.end)}` : ""}</span>
                      {e.location && <span className="ml-3"><MapPin size={10} className="inline mr-0.5" />{e.location}</span>}
                    </div>
                    {pos.height >= 56 && e.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.description}</p>}
                  </div>
                );
              })}
              {renderDragOverlay(key, DAY_HOUR_HEIGHT)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Selected date detail panel ─── */

  function renderDayDetail() {
    if (!selectedDate) return null;
    const key = formatDateKey(selectedDate);
    const dayEvents = eventsByDate.get(key) || [];

    return (
      <div className={isMobile
        ? "fixed inset-0 z-40 bg-white flex flex-col pt-[env(safe-area-inset-top,0px)]"
        : "w-72 bg-white border-l border-slate-200 flex flex-col flex-shrink-0"}>
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={() => setSelectedDate(null)} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100">
                  <ChevronLeft size={20} className="text-slate-600" />
                </button>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedDate.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-xs text-slate-400">{t("agenda.items_count", { count: dayEvents.length })}</p>
              </div>
            </div>
            <button onClick={() => handleSlotClick(key)}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer" title={t("agenda.new_item_title")}>
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {dayEvents.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-2">{t("agenda.no_appointments")}</p>
              <button onClick={() => handleSlotClick(key)}
                className="text-xs text-blue-600 hover:underline cursor-pointer">{t("agenda.new_item_create")}</button>
            </div>
          )}
          {dayEvents.map((e) => (
            <div key={e.id} className="p-3 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setDetailEvent(e)}
              style={{ borderLeftColor: e.color, borderLeftWidth: 3 }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: e.color + "20", color: e.color }}>
                  {e.type === "ical" ? (calendars.find(c => c.id === e.calendarId)?.name || t("nav.calendar")) : t(TYPE_LABEL_KEYS[e.type])}
                </span>
                {!e.allDay && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} />{formatTime(e.start)}</span>}
              </div>
              <p className="text-sm font-medium text-slate-800">{e.title}</p>
              {e.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin size={10} />{e.location}</p>}
              {e.owner && <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Users size={10} />{e.owner}</p>}
              {e.description?.includes("meet.jit.si") && (
                <a href={e.description.match(/https:\/\/meet\.jit\.si\/\S+/)?.[0] || "#"}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
                  <Video size={11} /> {t("agenda.open_jitsi_meeting")}
                </a>
              )}
              {e.webLink && (
                <a href={e.webLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-2 text-xs hover:underline" style={{ color: TYPE_COLORS.o365 }}>
                  <ExternalLink size={11} /> {t("agenda.open_in_outlook")}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Header title ─── */

  const headerTitle = viewType === "month"
    ? `${t(MONTH_KEYS[currentDate.getMonth()])} ${currentDate.getFullYear()}`
    : viewType === "week"
    ? (() => {
        const days = getWeekDays(currentDate);
        const start = days[0]; const end = days[6];
        return `${start.getDate()} ${t(MONTH_KEYS[start.getMonth()]).slice(0, 3)} - ${end.getDate()} ${t(MONTH_KEYS[end.getMonth()]).slice(0, 3)} ${end.getFullYear()}`;
      })()
    : currentDate.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex flex-col border-b border-slate-200 flex-shrink-0">
        {/* Row 1: title + navigation */}
        <div className="flex items-center justify-between px-4 py-2 md:py-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Calendar className="text-blue-600 flex-shrink-0" size={isMobile ? 18 : 20} />
            <h1 className="text-sm md:text-lg font-bold text-slate-800 truncate">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"><ChevronLeft size={16} className="text-slate-600" /></button>
            <button onClick={goToday} className="px-2 md:px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded cursor-pointer">{t("agenda.today")}</button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-slate-100 rounded cursor-pointer"><ChevronRight size={16} className="text-slate-600" /></button>
            <div className="w-px h-5 bg-slate-200 hidden md:block" />
            <button onClick={loadEvents} disabled={loading} className="p-1.5 hover:bg-slate-100 rounded cursor-pointer disabled:opacity-50">
              <RefreshCw size={14} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {/* Row 2: view switcher + actions */}
        <div className="flex items-center justify-between px-4 pb-2 md:pb-3 gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            {(isMobile ? ["month", "day"] as ViewType[] : ["month", "week", "day"] as ViewType[]).map((v) => (
              <button key={v} onClick={() => setViewType(v)}
                className={`px-2 md:px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewType === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {v === "month" ? t("agenda.view_month") : v === "week" ? t("agenda.view_week") : t("agenda.view_day")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button onClick={() => setCreateModal({ type: "event", date: formatDateKey(currentDate) })}
              className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 cursor-pointer">
              <Plus size={14} /> <span className="hidden md:inline">{t("common.new")}</span>
            </button>
            <button onClick={() => setShowSettings(s => !s)}
              className={`p-1.5 rounded cursor-pointer transition-colors ${showSettings ? "bg-slate-200 text-slate-700" : "hover:bg-slate-100 text-slate-500"}`}
              title={t("agenda.sources_and_calendars")}>
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="hidden md:flex items-center gap-4 px-4 py-1.5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        {activeLegend.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-slate-500">{item.label}</span>
          </div>
        ))}
        {activeLegend.length === 0 && (
          <span className="text-[10px] text-slate-400 italic">{t("agenda.no_sources_active")}</span>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400">{t("agenda.create_hint")}</span>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Calendar views */}
        {viewType === "month" && renderMonthView()}
        {viewType === "week" && renderWeekView()}
        {viewType === "day" && renderDayView()}

        {/* Day detail panel (month view) */}
        {viewType === "month" && selectedDate && renderDayDetail()}

        {/* Settings panel — full-screen overlay on mobile, inline on desktop */}
        {showSettings && (
          isMobile ? (
            <div className="fixed inset-0 z-40 bg-white flex flex-col pt-[env(safe-area-inset-top,0px)]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
                <button onClick={() => setShowSettings(false)} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100">
                  <ChevronLeft size={20} className="text-slate-600" />
                </button>
                <span className="text-sm font-semibold text-slate-800">{t("agenda.sources_and_calendars")}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SettingsPanel
                  erpSources={erpSources}
                  collegas={collegas}
                  gekozenCollegas={gekozenCollegas}
                  collegaKleuren={collegaKleuren}
                  onCollegaToggle={handleCollegaToggle}
                  calendars={calendars}
                  o365Enabled={o365Enabled}
                  onErpToggle={handleErpToggle}
                  onCalendarToggle={handleCalendarToggle}
                  onCalendarRemove={handleCalendarRemove}
                  onAddCalendar={() => setAddCalendarModal(true)}
                  onO365Toggle={() => {
                    setO365Enabled(prev => {
                      const next = !prev;
                      localStorage.setItem(getPrefKey("o365_enabled"), String(next));
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <SettingsPanel
              erpSources={erpSources}
              collegas={collegas}
              gekozenCollegas={gekozenCollegas}
              collegaKleuren={collegaKleuren}
              onCollegaToggle={handleCollegaToggle}
              calendars={calendars}
              o365Enabled={o365Enabled}
              onErpToggle={handleErpToggle}
              onCalendarToggle={handleCalendarToggle}
              onCalendarRemove={handleCalendarRemove}
              onAddCalendar={() => setAddCalendarModal(true)}
              onO365Toggle={() => {
                setO365Enabled(prev => {
                  const next = !prev;
                  localStorage.setItem(getPrefKey("o365_enabled"), String(next));
                  return next;
                });
              }}
            />
          )
        )}
      </div>

      {/* Event detail modal */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          calendars={calendars}
          onClose={() => setDetailEvent(null)}
          onUpdated={loadEvents}
        />
      )}

      {/* Create modal */}
      {createModal && (
        <CreateModal
          initial={createModal}
          onClose={() => setCreateModal(null)}
          onCreated={loadEvents}
        />
      )}

      {/* Add calendar modal */}
      {addCalendarModal && (
        <AddCalendarModal
          onClose={() => setAddCalendarModal(false)}
          onAdd={handleAddCalendar}
        />
      )}
    </div>
  );
}
