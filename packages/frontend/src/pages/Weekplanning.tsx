import { useCallback, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Het 3BM-weekdashboard binnen Y-Next.
 *
 * Dit dashboard is een aparte ERPNext-webpagina die op de wand hangt: één
 * scherm met de weekplanning, aanwezigheid en facturabele uren. Het staat
 * bewust níet in React — het draait ook los, op een scherm zonder ingelogde
 * gebruiker, en haalt zijn eigen cijfers op.
 *
 * Daarom sluiten we hem hier in in plaats van hem na te bouwen: één bron voor
 * de cijfers, en wat op de wand hangt is precies wat je hier ziet. Zelfde
 * herkomst, dus de insluiting mag gewoon.
 */
const DASHBOARD_PAD = "/3bm-dashboard-algemeen";

export default function Weekplanning() {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement | null>(null);
  // Verandert bij elke verversing en hangt aan `key`, zodat de pagina echt
  // opnieuw laadt. Aan `src` sleutelen zou de geschiedenis van het tabblad
  // volschrijven.
  const [ronde, setRonde] = useState(0);

  const verversen = useCallback(() => setRonde((r) => r + 1), []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 flex-shrink-0">
        <h1 className="text-sm font-semibold text-slate-700">{t("nav.weekplanning")}</h1>
        <div className="flex-1" />
        <button onClick={verversen}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
          title={t("common.refresh")}>
          <RefreshCw size={15} />
        </button>
        <a href={DASHBOARD_PAD} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100"
          title={t("weekplanning.open_new_tab")}>
          <ExternalLink size={14} />
          <span className="hidden sm:inline">{t("weekplanning.open_new_tab")}</span>
        </a>
      </div>
      <iframe key={ronde} ref={frame} src={DASHBOARD_PAD}
        title={t("nav.weekplanning")}
        className="flex-1 w-full min-h-0 border-0 bg-white" />
    </div>
  );
}
