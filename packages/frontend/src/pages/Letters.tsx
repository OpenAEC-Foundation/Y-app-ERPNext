import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Printer, Plus, Trash2, Save, Copy, ChevronDown } from "lucide-react";
import { getActiveInstanceId } from "../lib/instances";
import RecordLock from "../components/RecordLock";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface LetterRecipient {
  name: string;
  company: string;
  address: string;
  postcode: string;
  city: string;
}

interface Letter {
  id: string;
  recipient: LetterRecipient;
  subject: string;
  date: string;
  body: string;
  reference: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

type TemplateKey = "standaard" | "offerte" | "bevestiging" | "herinnering" | "blanco";

/* ─── Constants ─── */

const STORAGE_PREFIX = "letters_";

const COMPANY_INFO = {
  name: "[Uw bedrijf]",
  address: "Voorbeeldstraat 1",
  postcode: "3000 AA",
  city: "Rotterdam",
  phone: "+31 10 000 0000",
  email: "info@example.com",
  kvk: "12345678",
  website: "www.example.com",
};

const TEMPLATES: Record<TemplateKey, { labelKey: string; body: string; subject: string }> = {
  standaard: {
    labelKey: "brieven.template_standaard",
    subject: "",
    body: "Geachte heer/mevrouw,\n\n\n\nMet vriendelijke groet,\n\n[Uw bedrijf]",
  },
  offerte: {
    labelKey: "brieven.template_offerte",
    subject: "Begeleidend schrijven bij offerte",
    body: "Geachte heer/mevrouw,\n\nHierbij ontvangt u onze offerte conform uw aanvraag. Wij vertrouwen erop u hiermee een passend aanbod te hebben gedaan.\n\nMocht u vragen hebben over de inhoud of de voorwaarden, dan staan wij u graag te woord.\n\nWij zien uw reactie met belangstelling tegemoet.\n\nMet vriendelijke groet,\n\n[Uw bedrijf]",
  },
  bevestiging: {
    labelKey: "brieven.template_bevestiging",
    subject: "Opdrachtbevestiging",
    body: "Geachte heer/mevrouw,\n\nHierbij bevestigen wij de door u verstrekte opdracht. Wij danken u voor het in ons gestelde vertrouwen.\n\nDe werkzaamheden zullen conform de gemaakte afspraken worden uitgevoerd. Bij vragen kunt u uiteraard contact met ons opnemen.\n\nMet vriendelijke groet,\n\n[Uw bedrijf]",
  },
  herinnering: {
    labelKey: "brieven.template_herinnering",
    subject: "Betalingsherinnering",
    body: "Geachte heer/mevrouw,\n\nBij controle van onze administratie constateren wij dat onderstaande factuur nog niet door ons is ontvangen.\n\nWij verzoeken u vriendelijk het openstaande bedrag binnen 14 dagen over te maken.\n\nIndien u reeds heeft betaald, kunt u deze brief als niet verzonden beschouwen.\n\nMet vriendelijke groet,\n\n[Uw bedrijf]",
  },
  blanco: {
    labelKey: "brieven.template_blanco",
    subject: "",
    body: "",
  },
};

/* ─── Helpers ─── */

function storageKey(): string {
  return `${STORAGE_PREFIX}${getActiveInstanceId()}`;
}

function loadLetters(): Letter[] {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLetters(letters: Letter[]) {
  localStorage.setItem(storageKey(), JSON.stringify(letters));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function newLetter(template: TemplateKey = "standaard"): Letter {
  const t = TEMPLATES[template];
  return {
    id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    recipient: { name: "", company: "", address: "", postcode: "", city: "" },
    subject: t.subject,
    date: todayISO(),
    body: t.body,
    reference: "",
    template,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ─── Print View ─── */

function PrintPreview({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${t("brieven.print_title", { subject: letter.subject })}</title>
      <style>
        @page { size: A4; margin: 20mm 25mm 25mm 25mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; }
        .header { border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 32px; }
        .company-name { font-size: 18pt; font-weight: 700; color: #0d9488; }
        .company-details { font-size: 8.5pt; color: #64748b; margin-top: 4px; }
        .recipient { margin-bottom: 24px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 10pt; color: #475569; }
        .subject { font-weight: 600; font-size: 12pt; margin-bottom: 20px; }
        .body { white-space: pre-wrap; }
        .reference { margin-top: 24px; font-size: 9pt; color: #94a3b8; }
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-[210mm] w-full max-h-[90vh] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{t("brieven.print_preview")}</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-1.5 bg-y-teal text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              <Printer size={15} /> {t("brieven.print")}
            </button>
            <button onClick={onClose} className="px-4 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              {t("brieven.close")}
            </button>
          </div>
        </div>

        {/* A4 Preview */}
        <div className="flex-1 overflow-auto p-8 bg-slate-100">
          <div
            ref={printRef}
            className="bg-white mx-auto shadow-lg"
            style={{ width: "210mm", minHeight: "297mm", padding: "20mm 25mm 25mm 25mm" }}
          >
            {/* Company Header */}
            <div className="header" style={{ borderBottom: "2px solid #0d9488", paddingBottom: "16px", marginBottom: "32px" }}>
              <div className="company-name" style={{ fontSize: "18pt", fontWeight: 700, color: "#0d9488" }}>
                {COMPANY_INFO.name}
              </div>
              <div className="company-details" style={{ fontSize: "8.5pt", color: "#64748b", marginTop: "4px" }}>
                {COMPANY_INFO.address}, {COMPANY_INFO.postcode} {COMPANY_INFO.city} | Tel: {COMPANY_INFO.phone} | {COMPANY_INFO.email} | KVK: {COMPANY_INFO.kvk}
              </div>
            </div>

            {/* Recipient */}
            <div className="recipient" style={{ marginBottom: "24px" }}>
              {letter.recipient.company && <div style={{ fontWeight: 600 }}>{letter.recipient.company}</div>}
              {letter.recipient.name && <div>{t("brieven.attention", { name: letter.recipient.name })}</div>}
              {letter.recipient.address && <div>{letter.recipient.address}</div>}
              {(letter.recipient.postcode || letter.recipient.city) && (
                <div>{letter.recipient.postcode} {letter.recipient.city}</div>
              )}
            </div>

            {/* Meta row */}
            <div className="meta" style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", fontSize: "10pt", color: "#475569" }}>
              <div>{COMPANY_INFO.city}, {formatDate(letter.date)}</div>
              {letter.reference && <div>{t("brieven.ref_short", { ref: letter.reference })}</div>}
            </div>

            {/* Subject */}
            {letter.subject && (
              <div className="subject" style={{ fontWeight: 600, fontSize: "12pt", marginBottom: "20px" }}>
                {t("brieven.subject_label", { subject: letter.subject })}
              </div>
            )}

            {/* Body */}
            <div className="body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {letter.body}
            </div>

            {/* Reference footer */}
            {letter.reference && (
              <div className="reference" style={{ marginTop: "24px", fontSize: "9pt", color: "#94a3b8" }}>
                {t("brieven.reference_label", { ref: letter.reference })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function Letters() {
  const { t } = useTranslation();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeLetter = letters.find((l) => l.id === activeId) ?? null;

  /* Load letters on mount / instance change */
  useEffect(() => {
    const loaded = loadLetters();
    setLetters(loaded);
    if (loaded.length > 0) setActiveId(loaded[0].id);
  }, []);

  /* Persist on change (debounced autosave) */
  const persistLetters = useCallback(
    (updated: Letter[]) => {
      setLetters(updated);
      setSaveStatus("saving");
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        saveLetters(updated);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      }, 400);
    },
    []
  );

  /* CRUD */
  const createLetter = (template: TemplateKey) => {
    const l = newLetter(template);
    const updated = [l, ...letters];
    persistLetters(updated);
    setActiveId(l.id);
    setShowTemplateMenu(false);
  };

  const updateActive = (patch: Partial<Letter>) => {
    if (!activeId) return;
    const updated = letters.map((l) =>
      l.id === activeId ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l
    );
    persistLetters(updated);
  };

  const updateRecipient = (patch: Partial<LetterRecipient>) => {
    if (!activeLetter) return;
    updateActive({ recipient: { ...activeLetter.recipient, ...patch } });
  };

  const deleteLetter = (id: string) => {
    if (!confirm(t("brieven.delete_confirm"))) return;
    const updated = letters.filter((l) => l.id !== id);
    persistLetters(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const duplicateLetter = () => {
    if (!activeLetter) return;
    const dup: Letter = {
      ...activeLetter,
      id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subject: t("brieven.copy_suffix", { subject: activeLetter.subject }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [dup, ...letters];
    persistLetters(updated);
    setActiveId(dup.id);
  };

  /* ─── Render ─── */

  return (
    <div className="flex h-full">
      {/* ── Left: Letter list ── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText size={20} className="text-y-teal" />
              {t("brieven.title")}
            </h2>
            <div className="relative">
              <button
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="flex items-center gap-1 px-3 py-1.5 bg-y-teal text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={15} /> {t("brieven.new")} <ChevronDown size={13} />
              </button>
              {showTemplateMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1">
                  {(Object.keys(TEMPLATES) as TemplateKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => createLetter(key)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {t(TEMPLATES[key].labelKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500">{t("brieven.letter_count", { count: letters.length })}</p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {letters.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              {t("letters.no_letters")}<br />{t("letters.get_started_hint")}
            </div>
          ) : (
            letters.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveId(l.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                  l.id === activeId ? "bg-teal-50 border-l-2 border-l-y-teal" : "hover:bg-slate-50"
                }`}
              >
                <div className="font-medium text-sm text-slate-800 truncate">
                  {l.subject || t("brieven.no_subject")}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {l.recipient.company || l.recipient.name || t("brieven.no_recipient")}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {formatDate(l.date)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Editor ── */}
      <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
        {!activeLetter ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <FileText size={48} className="mx-auto mb-3 opacity-40" />
              <p>{t("brieven.select_or_create")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {TEMPLATES[activeLetter.template as TemplateKey]?.labelKey ? t(TEMPLATES[activeLetter.template as TemplateKey].labelKey) : activeLetter.template}
                </span>
                {saveStatus === "saving" && <span className="text-xs text-amber-600">{t("common.saving")}</span>}
                {saveStatus === "saved" && <span className="text-xs text-green-600">{t("brieven.saved")}</span>}
              </div>
              <div className="flex items-center gap-2">
                <RecordLock
                  recordType="letter"
                  recordId={activeLetter.id}
                  userName={t("common.user")}
                />
                <button
                  onClick={duplicateLetter}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title={t("brieven.duplicate_letter")}
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  <Printer size={15} /> {t("brieven.preview")}
                </button>
                <button
                  onClick={() => {
                    saveLetters(letters);
                    setSaveStatus("saved");
                    setTimeout(() => setSaveStatus("idle"), 1500);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-y-teal text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Save size={15} /> {t("common.save")}
                </button>
                <button
                  onClick={() => deleteLetter(activeLetter.id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title={t("brieven.delete_letter")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Ontvanger */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("brieven.recipient")}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-slate-500 mb-1">{t("tasks.detail.company")}</label>
                      <input
                        type="text"
                        value={activeLetter.recipient.company}
                        onChange={(e) => updateRecipient({ company: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder={t("letters.company_name_placeholder")}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-slate-500 mb-1">{t("settings.name_label")}</label>
                      <input
                        type="text"
                        value={activeLetter.recipient.name}
                        onChange={(e) => updateRecipient({ name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder={t("brieven.contact_person_placeholder")}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-500 mb-1">{t("brieven.address")}</label>
                      <input
                        type="text"
                        value={activeLetter.recipient.address}
                        onChange={(e) => updateRecipient({ address: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder={t("brieven.street_placeholder")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t("brieven.postcode")}</label>
                      <input
                        type="text"
                        value={activeLetter.recipient.postcode}
                        onChange={(e) => updateRecipient({ postcode: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder="1234 AB"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t("brieven.city")}</label>
                      <input
                        type="text"
                        value={activeLetter.recipient.city}
                        onChange={(e) => updateRecipient({ city: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder={t("brieven.city_placeholder")}
                      />
                    </div>
                  </div>
                </div>

                {/* Brief details */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("brieven.letter")}</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">{t("common.date")}</label>
                        <input
                          type="date"
                          value={activeLetter.date}
                          onChange={(e) => updateActive({ date: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">{t("brieven.reference_optional")}</label>
                        <input
                          type="text"
                          value={activeLetter.reference}
                          onChange={(e) => updateActive({ reference: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                          placeholder={t("brieven.project_reference_placeholder")}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t("brieven.subject")}</label>
                      <input
                        type="text"
                        value={activeLetter.subject}
                        onChange={(e) => updateActive({ subject: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                        placeholder={t("brieven.subject_placeholder")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t("brieven.content")}</label>
                      <textarea
                        value={activeLetter.body}
                        onChange={(e) => updateActive({ body: e.target.value })}
                        rows={16}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y font-[inherit] leading-relaxed"
                        placeholder={t("brieven.content_placeholder")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print Preview Modal */}
      {showPreview && activeLetter && (
        <PrintPreview letter={activeLetter} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
