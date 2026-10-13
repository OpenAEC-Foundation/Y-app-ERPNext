import { useTranslation } from "react-i18next";
import { Download, ExternalLink } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";
import { safeCadSource } from "../../lib/studio";
import CadFrame from "../studio/CadFrame";

/** Lokaal gehoste WASM-editor, pas geladen wanneer een CAD-bijlage opent. */

export default function CadVoorbeeld({ url, naam }: { url: string; naam: string }) {
  const { t } = useTranslation();
  const safe = safeCadSource(url, window.location.origin);
  const path = safe ? new URL(safe).pathname : "";
  const bestand = path && safeCadSource(getFileUrl(path), window.location.origin);
  const viewer = `#/voorbeeld?${new URLSearchParams({ soort: "cad", url: path, naam })}`;
  if (!bestand) return <div role="alert" className="flex flex-1 items-center justify-center px-4 text-sm text-slate-500">{t("studio.error_invalid")}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <CadFrame source={path} name={naam} />
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <span className="min-w-0 flex-1">{t("studio.preview_hint")}</span>
        <a href={bestand} download={naam}
          className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600">
          <Download size={11} /> {t("y_next.cad_preview_download")}
        </a>
        <a href={viewer} target="_blank" rel="noopener noreferrer"
          className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600">
          <ExternalLink size={11} /> {t("y_next.cad_preview_open_tab")}
        </a>
      </div>
    </div>
  );
}
