import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";

type Stand = "laden" | "klaar" | "fout";

/**
 * Een afbeelding uit de bijlagen, naast de mail of schermvullend.
 *
 * De browser tekent hem zelf; deze viewer voegt alleen toe wat je bij een foto
 * van de bouwplaats nodig hebt: passend in het paneel, één klik voor de ware
 * grootte (dan is het beeld te verschuiven), en bladeren naar de vorige en
 * volgende afbeelding uit dezelfde mail.
 *
 * De knoppenbalk blijft bij het bladeren dezelfde: zo houdt een knop die je
 * net aanklikte zijn focus, en blijven de bladerknoppen staan als één
 * afbeelding niet te tonen is — anders liep de reeks daar dood.
 */
export default function AfbeeldingVoorbeeld({
  url, naam, positie, totaal, onVorige, onVolgende,
}: {
  url: string;
  naam: string;
  /** Plaats binnen de afbeeldingen van de mail, vanaf 1. */
  positie?: number;
  totaal?: number;
  onVorige?: () => void;
  onVolgende?: () => void;
}) {
  const { t } = useTranslation();
  const vak = useRef<HTMLDivElement>(null);
  const schuifvlak = useRef<HTMLDivElement>(null);
  // Zoom en laadstand horen bij één afbeelding: een andere begint weer
  // passend en ladend, zonder dat daar een effect voor nodig is.
  const [bewaard, setBewaard] = useState<{ url: string; waar: boolean; stand: Stand }>(
    { url, waar: false, stand: "laden" });
  const beeld = bewaard.url === url ? bewaard : { url, waar: false, stand: "laden" as Stand };
  const zet = (deel: { waar?: boolean; stand?: Stand }) => setBewaard({ ...beeld, ...deel });
  const bladeren = (totaal ?? 0) > 1 && (positie ?? 0) > 0;

  // De pijltjestoetsen horen meteen te werken, ook vlak na het openen en na
  // een klik op Vorige of Volgende.
  useEffect(() => {
    vak.current?.focus({ preventScroll: true });
  }, [url]);

  function toets(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft" && onVorige) {
      e.preventDefault();
      e.stopPropagation();
      onVorige();
      return;
    }
    if (e.key === "ArrowRight" && onVolgende) {
      e.preventDefault();
      e.stopPropagation();
      onVolgende();
      return;
    }
    // Op ware grootte verschuiven omhoog en omlaag het beeld. Zonder dit
    // opende pijl-omlaag de volgende mail: die toets is van de maillijst.
    const vlak = schuifvlak.current;
    if (!beeld.waar || !vlak) return;
    const stap = e.key === "PageUp" || e.key === "PageDown" ? vlak.clientHeight * 0.9 : 60;
    if (e.key === "ArrowUp" || e.key === "PageUp") vlak.scrollBy({ top: -stap });
    else if (e.key === "ArrowDown" || e.key === "PageDown") vlak.scrollBy({ top: stap });
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div ref={vak} tabIndex={0} onKeyDown={toets} aria-label={naam}
      className="relative flex min-h-0 flex-1 flex-col bg-slate-100 outline-none">
      <div ref={schuifvlak} className="min-h-0 flex-1 overflow-auto">
        {beeld.stand === "fout" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
            <ImageOff size={24} className="text-slate-300" />
            {t("y_next.image_preview_failed")}
          </div>
        ) : (
          /* `m-auto` op het beeld centreert het zolang het past, en laat het
             bij ware grootte gewoon van linksboven af verschuiven; centreren
             met `justify-center` zou de linker- en bovenrand afsnijden. */
          <div className={beeld.waar ? "flex min-h-full min-w-full p-3" : "flex h-full w-full p-3"}>
            {beeld.stand === "laden" && (
              <Loader2 size={18} className="absolute left-1/2 top-1/2 -ml-2 -mt-2 animate-spin text-slate-400" />
            )}
            {/* De sleutel maakt per afbeelding een nieuw element: een laat
                binnenkomend "geladen" van de vorige kan de nieuwe niet raken. */}
            <img key={url} src={getFileUrl(url)} alt={naam}
              onLoad={() => setBewaard((b) => (b.url === url ? { ...b, stand: "klaar" } : { url, waar: false, stand: "klaar" }))}
              onError={() => setBewaard({ url, waar: false, stand: "fout" })}
              onClick={() => zet({ waar: !beeld.waar })}
              className={`m-auto select-none ${beeld.waar
                ? "max-w-none cursor-zoom-out"
                : "max-h-full max-w-full cursor-zoom-in object-contain"} ${beeld.stand === "laden" ? "opacity-0" : ""}`} />
          </div>
        )}
      </div>
      {(bladeren || beeld.stand !== "fout") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-sm">
            {bladeren && (
              <>
                <button type="button" onClick={onVorige} disabled={!onVorige}
                  title={t("y_next.image_preview_previous")} aria-label={t("y_next.image_preview_previous")}
                  className="cursor-pointer rounded-full p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[3rem] text-center text-xs tabular-nums text-slate-600">
                  {positie} / {totaal}
                </span>
                <button type="button" onClick={onVolgende} disabled={!onVolgende}
                  title={t("y_next.image_preview_next")} aria-label={t("y_next.image_preview_next")}
                  className="cursor-pointer rounded-full p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            {bladeren && beeld.stand !== "fout" && <span className="mx-1 h-4 w-px bg-slate-200" />}
            {beeld.stand !== "fout" && (
              <button type="button" onClick={() => zet({ waar: !beeld.waar })}
                title={beeld.waar ? t("y_next.image_preview_fit") : t("y_next.image_preview_actual")}
                aria-label={beeld.waar ? t("y_next.image_preview_fit") : t("y_next.image_preview_actual")}
                className="cursor-pointer rounded-full p-1 text-slate-600 hover:bg-slate-100">
                {beeld.waar ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
