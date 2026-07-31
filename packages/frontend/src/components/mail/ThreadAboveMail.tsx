import { Send, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MailAddress } from "../../lib/webmail-prefetch";
import type { MailMessageFull } from "../../lib/mail-types";

/* ─── Conversatie-overzicht BOVEN de mail-body ─────────────────────
 *
 * Twee zones:
 *  Zone A — "Vervolgacties": alleen mails na de huidige (relation=descendant),
 *           amber-blokje als attention-getter (replies + forwards).
 *  Zone B — alle thread-mails chronologisch als klikbare blokjes; de huidige
 *           mail heeft een violet ring + label "HUIDIG".
 *
 * Render condities:
 *  - 0 of 1 message → niets renderen (`return null` vóór de div, geen lege ruimte).
 *  - Klik op een ander blokje → openMessage via parent-callback.
 */
function senderShort(from: MailAddress[] | undefined): string {
  if (!from || from.length === 0) return "";
  const f = from[0];
  const display = f.name?.trim() || f.address?.split("@")[0] || "";
  if (display.length <= 22) return display;
  return display.slice(0, 21) + "…";
}

/** Eerste ontvanger (+N) kort weergeven — gebruikt voor uitgaande thread-mails
 *  zodat de rij niet de afzender (= jij) toont maar aan wie je stuurde. */
function recipientShort(to: MailAddress[] | undefined): string {
  if (!to || to.length === 0) return "";
  const r = to[0];
  const display = r.name?.trim() || r.address?.split("@")[0] || "";
  const extra = to.length > 1 ? ` +${to.length - 1}` : "";
  const base = display.length <= 18 ? display : display.slice(0, 17) + "…";
  return base + extra;
}

/** Datum + tijd voor thread-rijen, bv. "29 mei 14:41" (vorig jaar: "29 mei '25 14:41"). */
function fmtThreadDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const datePart = d.toLocaleDateString("nl-NL", {
    day: "numeric", month: "short", ...(sameYear ? {} : { year: "2-digit" }),
  });
  const timePart = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

/** Uitgaand = afzender ben jij (match op het actieve mailbox-adres), of de mail
 *  staat in een Verzonden/Sent-map ([OUT]-submappen vallen daar ook onder). */
function isThreadOutgoing(m: MailMessageFull, accountEmail?: string): boolean {
  const fromAddr = m.from?.[0]?.address?.toLowerCase();
  if (accountEmail && fromAddr && fromAddr === accountEmail.toLowerCase()) return true;
  const f = (m.folder || "").toLowerCase();
  return f.includes("verzonden") || f.startsWith("sent") || f.includes("/sent") || /\[out\]/.test(f);
}

export default function ThreadAboveMail({ messages, currentUid, currentFolder, accountEmail, onOpenMessage }: {
  messages: MailMessageFull[];
  currentUid: number;
  currentFolder: string;
  accountEmail?: string;
  onOpenMessage: (m: MailMessageFull) => void;
}) {
  const { t } = useTranslation();
  if (!messages || messages.length <= 1) return null;

  // Richting-indicator: uitgaande mail toont de ontvanger (i.p.v. jezelf als
  // afzender) + een Send-icoon; inkomende mail toont de afzender + Inbox-icoon.
  const DirIcon = ({ out }: { out: boolean }) => out
    ? <Send size={11} className="text-teal-600 shrink-0" aria-label={t("webmail.thread_outgoing", { defaultValue: "Uitgaand" })} />
    : <Inbox size={11} className="text-blue-500 shrink-0" aria-label={t("webmail.thread_incoming", { defaultValue: "Inkomend" })} />;
  const partyLabel = (m: MailMessageFull, out: boolean) =>
    out ? (recipientShort(m.to) || senderShort(m.from)) : senderShort(m.from);

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      {/* Eén gecombineerde lijst: alle thread-mails chronologisch. */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
          {t("webmail.thread_all_messages", { count: messages.length })}
        </div>
        <div className="space-y-1">
          {messages.map(m => {
            const isCurrent = m.relation === "current"
              || (m.uid === currentUid && (m.folder || currentFolder) === currentFolder);
            const k = `${m.folder || ""}:${m.uid}`;
            return (
              <button
                key={k}
                onClick={() => !isCurrent && onOpenMessage(m)}
                disabled={isCurrent}
                className={`w-full text-left rounded-md border px-2 py-1.5 text-xs flex gap-2 items-center ${
                  isCurrent
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200 cursor-default"
                    : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
                }`}
              >
                <span className="text-slate-500 w-28 shrink-0">{fmtThreadDateTime(m.date)}</span>
                <DirIcon out={isThreadOutgoing(m, accountEmail)} />
                <span className="text-slate-700 w-32 shrink-0 truncate">{partyLabel(m, isThreadOutgoing(m, accountEmail))}</span>
                <span className="text-slate-900 flex-1 truncate">{m.subject}</span>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-violet-700 shrink-0">{t("webmail.thread_current_label")}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
