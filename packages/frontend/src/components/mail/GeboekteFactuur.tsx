/**
 * De melding bij een factuurmail waarvan de factuur al in ERPNext staat.
 *
 * Komt in de plaats van het voorstel "inboeken?": een label in de maillijst en
 * een balk boven de geopende mail. Dezelfde plek en vorm als het voorstel,
 * maar in de kleur van de stand — groen betaald, indigo ingeboekt, grijs
 * concept — zodat je zonder lezen ziet dat hier niets meer te doen is.
 * "Toch inboeken" blijft kunnen; de boekingsdialoog waarschuwt dan zelf.
 */

import { useTranslation } from "react-i18next";
import { CheckCircle2, ExternalLink, ReceiptText } from "lucide-react";
import { getErpNextLinkUrl } from "../../lib/erpnext";
import {
  geboekteStand,
  type BestaandeInkoopfactuur,
  type GeboekteStand,
} from "../../lib/purchase-invoice-duplicates";

const VERTAALSLEUTEL: Record<GeboekteStand, string> = {
  betaald: "paid", "deels-betaald": "partly_paid", ingeboekt: "booked", concept: "draft",
};

const KLEUR: Record<GeboekteStand, { label: string; balk: string; icoon: string; tekst: string; knop: string }> = {
  betaald: {
    label: "bg-emerald-100 text-emerald-800",
    balk: "border-emerald-100 bg-emerald-50",
    icoon: "text-emerald-600",
    tekst: "text-emerald-900",
    knop: "text-emerald-800 hover:bg-emerald-100",
  },
  "deels-betaald": {
    label: "bg-teal-100 text-teal-800",
    balk: "border-teal-100 bg-teal-50",
    icoon: "text-teal-600",
    tekst: "text-teal-900",
    knop: "text-teal-800 hover:bg-teal-100",
  },
  ingeboekt: {
    label: "bg-indigo-100 text-indigo-800",
    balk: "border-indigo-100 bg-indigo-50",
    icoon: "text-indigo-600",
    tekst: "text-indigo-900",
    knop: "text-indigo-800 hover:bg-indigo-100",
  },
  concept: {
    label: "bg-slate-100 text-slate-700",
    balk: "border-slate-200 bg-slate-50",
    icoon: "text-slate-500",
    tekst: "text-slate-800",
    knop: "text-slate-700 hover:bg-slate-100",
  },
};

function factuurUrl(name: string): string {
  return `${getErpNextLinkUrl()}/purchase-invoice/${encodeURIComponent(name)}`;
}

export function GeboekteFactuurLabel({ factuur }: { factuur: BestaandeInkoopfactuur }) {
  const { t } = useTranslation();
  const stand = geboekteStand(factuur);
  return (
    <span data-geboekte-factuur={stand}
      title={t("y_next.pinv_known_hint", { name: factuur.name, bill_no: factuur.bill_no ?? "" })}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 text-[10px] font-medium ${KLEUR[stand].label}`}>
      {stand === "concept" ? <ReceiptText size={9} /> : <CheckCircle2 size={9} />}
      {t(`y_next.pinv_known_${VERTAALSLEUTEL[stand]}`)}
    </span>
  );
}

export function GeboekteFactuurBalk({ factuur, onTochInboeken, className = "" }: {
  factuur: BestaandeInkoopfactuur;
  onTochInboeken?: () => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const stand = geboekteStand(factuur);
  const kleur = KLEUR[stand];
  // De leverancier staat erbij: het nummer kan bij een andere leverancier
  // gevonden zijn dan de herkenning dacht, en dan zie je dat hier meteen.
  const details = [
    factuur.name,
    factuur.supplier,
    factuur.bill_no,
    factuur.bill_date?.split("-").reverse().join("-"),
    typeof factuur.grand_total === "number"
      ? new Intl.NumberFormat(i18n.language || "nl", { style: "currency", currency: "EUR" }).format(factuur.grand_total)
      : undefined,
  ].filter(Boolean).join(" · ");

  return (
    <div data-geboekte-factuur-balk={stand}
      className={`flex flex-shrink-0 flex-wrap items-center gap-2 border-b py-2 ${kleur.balk} ${className}`}>
      {stand === "concept"
        ? <ReceiptText size={14} className={`flex-shrink-0 ${kleur.icoon}`} />
        : <CheckCircle2 size={14} className={`flex-shrink-0 ${kleur.icoon}`} />}
      <span className={`text-xs font-medium ${kleur.tekst}`}>
        {t(`y_next.pinv_known_banner_${VERTAALSLEUTEL[stand]}`)}
      </span>
      <span className={`text-[11px] ${kleur.tekst} opacity-75`}>{details}</span>
      <div className="flex-1" />
      <a href={factuurUrl(factuur.name)} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${kleur.knop}`}>
        <ExternalLink size={11} /> {t("y_next.pinv_known_open")}
      </a>
      {onTochInboeken && (
        <button type="button" onClick={onTochInboeken}
          className={`cursor-pointer rounded px-2 py-1 text-[11px] ${kleur.knop}`}>
          {t("y_next.pinv_book_anyway")}
        </button>
      )}
    </div>
  );
}
