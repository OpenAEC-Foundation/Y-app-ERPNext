import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Paperclip, PenSquare, Reply } from "lucide-react";
import { getMessageBody, MAIL_FOLDER_SENT } from "../../lib/mail-erpnext";
import { bewaarRegelovergangen } from "../../lib/mail-html";

/**
 * Een gesprek als stapel berichten, onder elkaar en doorscrollbaar.
 *
 * Kwam in de plaats van een rij knopjes boven de mail, waarbij elke klik het
 * ene zichtbare bericht verving. Je kon een gesprek daardoor niet lézen — voor
 * elke zin terug moest je klikken, en wat je net gelezen had was weg. Nu staan
 * ze onder elkaar, in dezelfde volgorde als de berichtenlijst: nieuwste boven.
 *
 * Alleen het geopende bericht is uitgeklapt. De rest is één regel met afzender,
 * datum en map; klik hem open en hij blijft open. De tekst wordt pas opgehaald
 * als je hem opent — een gesprek van twintig berichten zou anders twintig
 * verzoeken kosten voordat er iets op het scherm staat.
 */

/**
 * Een onafgemaakt antwoord in dit gesprek.
 *
 * Het staat nergens op een server — het ligt in de browser waar het getypt is
 * (zie `mail-drafts.ts`). De stapel toont het toch als bericht: het hoort bij
 * het gesprek, het is alleen nog niet verstuurd.
 */
export interface GesprekConcept {
  key: string;
  /** De getypte tekst als HTML, zonder het citaat eronder. */
  html: string;
  subject: string;
  /** Aan wie het antwoord gericht is. */
  to: string;
  /** Epoch-ms van de laatste wijziging. */
  updatedAt: number;
}

export interface GesprekBericht {
  name: string;
  subject: string;
  sender: string;
  senderName?: string;
  recipients?: string;
  date: string;
  seen: boolean;
  folder?: string;
  hasAttachments?: boolean;
}

export default function GesprekStapel({
  berichten, geopend, folderLabel, formatDate, onKiesBericht,
  concepten = [], onOpenConcept, className = "",
}: {
  /** Alle berichten van het gesprek, nieuwste eerst. */
  berichten: GesprekBericht[];
  /** Het bericht dat in de lijst geselecteerd is; staat altijd open. */
  geopend: string;
  /** Naam van een map; de aanroeper kent de vertaling, wij niet. */
  folderLabel: (folder: string) => string;
  formatDate: (datum: string) => string;
  /** Een bericht openklappen maakt het ook het actieve bericht in de lijst. */
  onKiesBericht?: (name: string) => void;
  /** Onafgemaakte antwoorden in dit gesprek; komen bovenaan te staan. */
  concepten?: GesprekConcept[];
  onOpenConcept?: (key: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Set<string>>(() => new Set([geopend]));
  const [inhoud, setInhoud] = useState<Record<string, string>>({});
  const [laden, setLaden] = useState<Set<string>>(() => new Set());
  const gevraagd = useRef<Set<string>>(new Set());

  // Een ander bericht geselecteerd: dat klapt open, de rest blijft zoals hij is.
  useEffect(() => {
    setOpen((vorig) => (vorig.has(geopend) ? vorig : new Set([...vorig, geopend])));
  }, [geopend]);

  const haalOp = useCallback(async (name: string) => {
    if (gevraagd.current.has(name)) return;
    gevraagd.current.add(name);
    setLaden((v) => new Set([...v, name]));
    try {
      const body = await getMessageBody(name);
      setInhoud((v) => ({ ...v, [name]: bewaarRegelovergangen(body.html) }));
    } catch (err) {
      setInhoud((v) => ({
        ...v,
        [name]: `<p style="color:#b45309">${err instanceof Error ? err.message : String(err)}</p>`,
      }));
    } finally {
      setLaden((v) => { const n = new Set(v); n.delete(name); return n; });
    }
  }, []);

  useEffect(() => {
    for (const name of open) if (!(name in inhoud)) void haalOp(name);
  }, [open, inhoud, haalOp]);

  function wissel(name: string) {
    setOpen((vorig) => {
      const n = new Set(vorig);
      if (n.has(name)) n.delete(name);
      else { n.add(name); onKiesBericht?.(name); }
      return n;
    });
  }

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto bg-slate-50 ${className}`}>
      {/* Concepten bovenaan: het laatste wat er in dit gesprek gebeurde is dat
          jíj begon te typen. Nieuwste boven, net als de rest van de stapel. */}
      {concepten.map((c) => (
        <article key={c.key} className="border-b border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2 px-4 py-2">
            <PenSquare size={13} className="flex-shrink-0 text-amber-600" />
            <span className="flex-shrink-0 rounded bg-amber-200 px-1.5 text-[10px] font-medium text-amber-900">
              {t("y_next.mail_draft_badge")}
            </span>
            <span className="truncate text-sm text-amber-900">{c.to || c.subject}</span>
            <div className="flex-1" />
            {onOpenConcept && (
              <button type="button" onClick={() => onOpenConcept(c.key)}
                className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-amber-700">
                {t("y_next.mail_draft_resume")}
              </button>
            )}
            <span className="flex-shrink-0 text-xs text-amber-700">
              {formatDate(new Date(c.updatedAt).toISOString())}
            </span>
          </div>
          {/* In hetzelfde frame als de berichten: het is dezelfde soort inhoud,
              en zo staat een half antwoord er precies zo bij als een verstuurd. */}
          <iframe
            title={c.subject || c.key}
            srcDoc={frameDocument(c.html)}
            sandbox="allow-same-origin"
            className="w-full border-0 bg-white"
            style={{ height: 220 }}
          />
        </article>
      ))}

      {berichten.map((m) => {
        const uit = open.has(m.name);
        const verzonden = m.folder === MAIL_FOLDER_SENT;
        const wie = verzonden ? (m.recipients || m.sender) : (m.senderName || m.sender);
        return (
          <article key={m.name}
            className={`border-b border-slate-200 bg-white ${uit ? "" : "hover:bg-slate-50"}`}>
            <button type="button" onClick={() => wissel(m.name)}
              aria-expanded={uit}
              className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left">
              {uit ? <ChevronDown size={13} className="flex-shrink-0 text-slate-400" />
                   : <ChevronRight size={13} className="flex-shrink-0 text-slate-400" />}
              {verzonden && (
                <Reply size={11} className="flex-shrink-0 -scale-x-100 text-blue-500"
                  aria-label={t("y_next.mail_thread_sent_label")} />
              )}
              <span className={`truncate text-sm ${m.seen ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                {verzonden ? t("y_next.mail_thread_sent_label") : wie}
              </span>
              {verzonden && <span className="truncate text-xs text-slate-400">{wie}</span>}
              <div className="flex-1" />
              <span className="hidden flex-shrink-0 rounded bg-slate-100 px-1.5 text-[10px] text-slate-500 sm:inline">
                {folderLabel(m.folder || "")}
              </span>
              {m.hasAttachments && <Paperclip size={11} className="flex-shrink-0 text-slate-400" />}
              <span className="flex-shrink-0 text-xs text-slate-400">{formatDate(m.date)}</span>
            </button>

            {uit && (
              laden.has(m.name) || !(m.name in inhoud) ? (
                <p className="flex items-center gap-2 px-4 pb-3 text-xs text-slate-400">
                  <Loader2 size={12} className="animate-spin" /> {t("webmail.loading_message")}
                </p>
              ) : (
                /* In een eigen frame, net als het losse leesvenster: de HTML komt
                   van buiten en mag de opmaak van de app niet overnemen. */
                <iframe
                  title={m.subject || m.name}
                  srcDoc={frameDocument(inhoud[m.name])}
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  className="w-full border-0"
                  style={{ height: 420 }}
                />
              )
            )}
          </article>
        );
      })}
    </div>
  );
}

/** Dezelfde omhulling als het losse leesvenster gebruikt. */
function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<style>body{margin:0;padding:12px 16px;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b}`
    + `img{max-width:100%;height:auto}blockquote{border-left:2px solid #cbd5e1;margin:0;padding-left:12px;color:#475569}`
    + `a{color:#2563eb}</style></head><body>${html}</body></html>`;
}
