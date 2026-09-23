import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderKanban, UserRound, Sparkles } from "lucide-react";
import { zoekConnectieKeuzes, type ConnectieKeuze } from "../../lib/zoek-connecties";

/**
 * Keuzelijst onder de zoekbalk: projecten en relaties die bij de zoekterm
 * passen. Een keuze opent de connectiemap van dat document.
 */
export default function ZoekConnectieKeuze({
  term, open, onKies,
}: { term: string; open: boolean; onKies: (keuze: ConnectieKeuze) => void }) {
  const { t } = useTranslation();
  const [keuzes, setKeuzes] = useState<ConnectieKeuze[]>([]);
  const [voorTerm, setVoorTerm] = useState("");
  const volgnr = useRef(0);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const nr = ++volgnr.current;
    const timer = window.setTimeout(() => {
      void zoekConnectieKeuzes(q).then((r) => {
        if (nr !== volgnr.current) return;
        setKeuzes(r);
        setVoorTerm(q);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  const zichtbaar = open && term.trim().length >= 2 && voorTerm === term.trim() && keuzes.length > 0;
  if (!zichtbaar) return null;

  const groepen: { titel: string; icoon: typeof FolderKanban; items: ConnectieKeuze[] }[] = [
    { titel: t("y_next.conn_cat_project"), icoon: FolderKanban, items: keuzes.filter((k) => k.category === "project") },
    { titel: t("y_next.conn_cat_customer"), icoon: UserRound, items: keuzes.filter((k) => k.category === "customer") },
    { titel: t("y_next.conn_cat_lead"), icoon: Sparkles, items: keuzes.filter((k) => k.category === "lead") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
      <p className="px-3 pb-1 pt-0.5 text-[10px] text-slate-400">{t("y_next.mail_search_pick_connection")}</p>
      {groepen.map((g) => (
        <div key={g.titel}>
          <p className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g.titel}</p>
          {g.items.map((k) => {
            const Icoon = g.icoon;
            return (
              <button key={`${k.doctype}:${k.name}`} type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onKies(k)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1 text-left text-xs text-slate-700 hover:bg-blue-50">
                <Icoon size={12} className="flex-shrink-0 text-slate-400" />
                <span className="truncate">{k.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
