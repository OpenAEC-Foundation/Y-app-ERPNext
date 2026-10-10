import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { haalDashboardPad } from "../lib/weekplanning";

/**
 * Het weekdashboard binnen Y-next.
 *
 * Dit dashboard is een aparte webpagina op dezelfde site, bedoeld om op de
 * wand te hangen: één scherm met de weekplanning, aanwezigheid en facturabele
 * uren. Het staat bewust níet in React — het draait ook los, op een scherm
 * zonder ingelogde gebruiker, en haalt zijn eigen cijfers op.
 *
 * Daarom sluiten we hem hier in in plaats van hem na te bouwen: één bron voor
 * de cijfers, en wat op de wand hangt is precies wat je hier ziet. Zelfde
 * herkomst, dus de insluiting mag gewoon. Welke pagina het is, staat in een
 * instelling; zie `lib/weekplanning.ts`.
 */
export default function Weekplanning() {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement | null>(null);
  // `undefined` zolang de instelling nog geladen wordt, `null` als er geen is.
  const [pad, setPad] = useState<string | null | undefined>(undefined);
  // Verandert bij elke verversing en hangt aan `key`, zodat de pagina echt
  // opnieuw laadt. Aan `src` sleutelen zou de geschiedenis van het tabblad
  // volschrijven.
  const [ronde, setRonde] = useState(0);

  useEffect(() => {
    let actief = true;
    haalDashboardPad().then((gevonden) => {
      if (actief) setPad(gevonden);
    });
    return () => {
      actief = false;
    };
  }, []);

  const verversen = useCallback(() => setRonde((r) => r + 1), []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 flex-shrink-0">
        <h1 className="text-sm font-semibold text-slate-700">{t("nav.weekplanning")}</h1>
        <div className="flex-1" />
        {pad && (
          <>
            <button onClick={verversen}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
              title={t("common.refresh")}>
              <RefreshCw size={15} />
            </button>
            <a href={pad} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100"
              title={t("weekplanning.open_new_tab")}>
              <ExternalLink size={14} />
              <span className="hidden sm:inline">{t("weekplanning.open_new_tab")}</span>
            </a>
          </>
        )}
      </div>
      {pad && (
        <iframe key={ronde} ref={frame} src={pad}
          title={t("nav.weekplanning")}
          className="flex-1 w-full min-h-0 border-0 bg-white" />
      )}
      {pad === null && (
        <p className="p-6 text-sm text-slate-500">{t("weekplanning.not_configured")}</p>
      )}
    </div>
  );
}
