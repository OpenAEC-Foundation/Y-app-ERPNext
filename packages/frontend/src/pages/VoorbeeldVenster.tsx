import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { getFileUrl } from "../lib/erpnext";
import { isEigenBestand } from "../lib/bijlage-soort";

const IfcVoorbeeld = lazy(() => import("../components/mail/IfcVoorbeeld"));
const OfficeVoorbeeld = lazy(() => import("../components/mail/OfficeVoorbeeld"));
const CadVoorbeeld = lazy(() => import("../components/mail/CadVoorbeeld"));
const AfbeeldingVoorbeeld = lazy(() => import("../components/mail/AfbeeldingVoorbeeld"));

/**
 * Een bijlage schermvullend, in een eigen tabblad.
 *
 * De kolom naast de mail is genoeg om te zien wát er in een bestand zit; om
 * er echt in te kijken — een bouwmodel ronddraaien, een tekening lezen — is
 * die kolom te smal. Deze pagina toont dezelfde viewer over het hele scherm,
 * zonder zijbalk en zonder maillijst.
 *
 * Hij hangt aan de hash-route `#/voorbeeld?soort=…&url=…&naam=…`, zodat hij in
 * een nieuw tabblad te openen is terwijl de app onder één vast pad draait.
 */
export default function VoorbeeldVenster() {
  const { t } = useTranslation();
  const vraag = new URLSearchParams((window.location.hash.split("?")[1] ?? ""));
  const soort = vraag.get("soort") ?? "";
  const url = vraag.get("url") ?? "";
  const naam = vraag.get("naam") ?? "";

  // Het bestand komt uit het adres van dit tabblad; alleen een bestand van de
  // eigen server wordt getoond, nooit een pagina van elders.
  if (!url || !isEigenBestand(url)) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-400">{t("webmail.no_results")}</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="truncate text-sm font-medium text-slate-700">{naam}</span>
        <div className="flex-1" />
        <a href={getFileUrl(url)} download={naam}
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <Download size={13} /> {t("y_next.cad_preview_download")}
        </a>
      </div>
      <Suspense fallback={(
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
        </div>
      )}>
        {soort === "ifc" ? <IfcVoorbeeld url={url} naam={naam} />
          : soort === "cad" ? <CadVoorbeeld url={url} naam={naam} />
            : soort === "office" ? <OfficeVoorbeeld url={url} naam={naam} />
              : soort === "afbeelding" ? <AfbeeldingVoorbeeld url={url} naam={naam} />
                : <iframe src={`${getFileUrl(url)}#view=FitH`} title={naam} className="flex-1 w-full border-0" />}
      </Suspense>
    </div>
  );
}
