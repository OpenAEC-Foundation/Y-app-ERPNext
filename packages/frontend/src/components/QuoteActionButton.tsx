/**
 * De knop "Offerte maken" bij een mail — één component voor de webmail
 * (`Webmail.tsx`) en de popout-lezer (`MailView.tsx`).
 *
 * Waarom een component en geen stukje JSX per scherm: de twee weergaven tonen
 * dezelfde actiebalk, en elke eerdere gedeelde actie die *niet* in een
 * component zat (de bijlagenstrook, de relatie-actie) is uit elkaar gelopen.
 * De beslisregel zélf — wanneer de knop er staat en met hoeveel nadruk — zit
 * in `mail-quote-actions.ts` en is daar los getest; dit bestand rendert alleen
 * de uitkomst.
 *
 * Twee standen:
 *
 * - **Er is een partij** (klant of lead) → de knop opent de offertedialoog.
 *   `primary` levert een gevulde knop (de aanvraag ís een offerteaanvraag),
 *   `secondary` een smallere tekstknop naast de hoofdactie.
 * - **`needsParty`** → er is nog geen klant of lead. De knop staat er wél,
 *   maar leidt eerst naar het vastleggen van de relatie: falen op een
 *   ontbrekende partij ná het invullen van vier offerteregels is de slechtste
 *   van alle uitkomsten. De tooltip zegt waarom.
 */

import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import type { QuoteActionDecision, QuoteParty } from "../lib/mail-quote-actions";

interface Props {
  decision: QuoteActionDecision;
  /** De partij staat vast: open de offertedialoog. */
  onQuote: (party: QuoteParty) => void;
  /** Er is nog geen partij: leid de gebruiker naar lead/relatie vastleggen. */
  onNeedParty: () => void;
}

export default function QuoteActionButton({ decision, onQuote, onNeedParty }: Props) {
  const { t } = useTranslation();
  if (!decision.show) return null;

  const reasonTitle = t(`y_next.quote_reason_${decision.reason.replace(/[:-]/g, "_")}`, {
    defaultValue: decision.reason,
  });

  if (decision.needsParty || !decision.party) {
    return (
      <button
        onClick={onNeedParty}
        title={t("y_next.quote_needs_party_hint")}
        className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-[11px] text-violet-800 hover:bg-violet-100"
      >
        <FileText size={11} /> {t("y_next.quote_create")}
      </button>
    );
  }

  const party = decision.party;
  if (decision.emphasis === "primary") {
    return (
      <button
        onClick={() => onQuote(party)}
        title={reasonTitle}
        className="flex cursor-pointer items-center gap-1.5 rounded bg-violet-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-violet-700"
      >
        <FileText size={11} /> {t("y_next.quote_create")}
      </button>
    );
  }

  return (
    <button
      onClick={() => onQuote(party)}
      title={reasonTitle}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
    >
      <FileText size={11} /> {t("y_next.quote_create")}
    </button>
  );
}
