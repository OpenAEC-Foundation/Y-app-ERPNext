import { useTranslation } from "react-i18next";
import { Download, ExternalLink } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";

/**
 * Een tekening (dwg/dxf) naast de mail bekijken met Open CAD Studio.
 *
 * Open CAD Studio draait als WebAssembly-app, gehost op deze ERPNext zelf
 * (pagina `/ocs-viewer`, bestanden onder `/files/ocs_*`). Dat is bewust geen
 * verwijzing naar een website elders: de tekening blijft binnen de eigen
 * omgeving, en dezelfde sessie geeft toegang tot het bestand.
 *
 * **Pas laden bij de eerste tekening.** Deze component zit achter een
 * `lazy`-import en de `iframe` wordt pas aangemaakt als je een tekening
 * openklikt; daarvóór haalt niemand die 18 MB binnen. Daarna staat het in de
 * cache van de browser.
 *
 * **De brug naar de bestandskiezer.** De viewer kan een tekening alleen via
 * zijn eigen bestandskiezer openen. De laadpagina zet het bestand klaar en
 * onderschept die kiezer: kies je in de viewer Openen (Ctrl+O), dan krijgt hij
 * meteen déze tekening in plaats van een bestandsvenster.
 */

/** De pagina op deze ERPNext waar de viewer draait. */
export const CAD_VIEWER_PAGINA = "/ocs-viewer";

export default function CadVoorbeeld({ url, naam }: { url: string; naam: string }) {
  const { t } = useTranslation();
  const bestand = getFileUrl(url);
  const viewer = `${CAD_VIEWER_PAGINA}?src=${encodeURIComponent(bestand)}&naam=${encodeURIComponent(naam)}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#1e1e1e]">
      <iframe src={viewer} title={naam} className="min-h-0 flex-1 w-full border-0" />
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-black/40 bg-[#252526] px-3 py-2 text-[11px] text-slate-300">
        <span className="min-w-0 flex-1 truncate">{t("y_next.cad_preview_hint")}</span>
        <a href={bestand} download={naam}
          className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20">
          <Download size={11} /> {t("y_next.cad_preview_download")}
        </a>
        <a href={viewer} target="_blank" rel="noopener noreferrer"
          className="flex flex-shrink-0 cursor-pointer items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20">
          <ExternalLink size={11} /> {t("y_next.cad_preview_open_tab")}
        </a>
      </div>
    </div>
  );
}
