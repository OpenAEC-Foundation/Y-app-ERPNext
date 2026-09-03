import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  haalKoppelbareDoctypes,
  sorteerDoctypes,
  zoekKoppeldoelen,
  type LinkDoel,
} from "../../lib/link-targets";

/**
 * "Koppel deze mail aan …" — eerst het soort document, dan het document zelf.
 *
 * Twee kolommen in plaats van twee schermen: welk soort je zoekt weet je al,
 * en zo kun je ertussen springen zonder terug te hoeven. Links de soorten (de
 * veelgebruikte bovenaan, daaronder alles wat deze installatie kent), rechts
 * de documenten van de gekozen soort.
 *
 * Het zoeken rechts gaat naar de server en wacht daarom even af voordat het
 * vuurt — anders stuurt elke aanslag een verzoek. Links filtert lokaal, want
 * de lijst met soorten staat er al.
 */
const TIK_VERTRAGING_MS = 250;

export default function LinkAnythingDialog({ onPick, onClose, subject }: {
  /** Wordt aangeroepen met de gekozen koppeling; de dialoog sluit zichzelf. */
  onPick: (doctype: string, docname: string) => void;
  onClose: () => void;
  /** Onderwerp van de mail, als kop boven de dialoog. */
  subject?: string;
}) {
  const { t } = useTranslation();
  const [doctypes, setDoctypes] = useState<string[]>([]);
  const [doctypeZoek, setDoctypeZoek] = useState("");
  const [gekozen, setGekozen] = useState("Project");
  const [zoek, setZoek] = useState("");
  const [doelen, setDoelen] = useState<LinkDoel[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  // Houdt bij welke zoekopdracht de laatste is; een trager antwoord van een
  // eerdere aanslag mag een verser resultaat niet overschrijven.
  const beurt = useRef(0);

  useEffect(() => {
    let afgebroken = false;
    haalKoppelbareDoctypes()
      .then((namen) => { if (!afgebroken) setDoctypes(namen); })
      // Zonder de volledige lijst blijven de veelgebruikte over; die staan in
      // de code en dekken het dagelijkse werk.
      .catch(() => { if (!afgebroken) setDoctypes([]); });
    return () => { afgebroken = true; };
  }, []);

  useEffect(() => {
    const mijn = ++beurt.current;
    const timer = setTimeout(() => {
      // Het molentje hoort te draaien zodra er écht gezocht wordt, niet al
      // tijdens het aftikken van de vertraging.
      setBezig(true);
      setFout(null);
      zoekKoppeldoelen(gekozen, zoek)
        .then((rijen) => { if (beurt.current === mijn) { setDoelen(rijen); setBezig(false); } })
        .catch((err) => {
          if (beurt.current !== mijn) return;
          setDoelen([]);
          setBezig(false);
          setFout(err instanceof Error ? err.message : String(err));
        });
    }, TIK_VERTRAGING_MS);
    return () => clearTimeout(timer);
  }, [gekozen, zoek]);

  const zichtbareDoctypes = useMemo(
    () => sorteerDoctypes(doctypes, doctypeZoek),
    [doctypes, doctypeZoek],
  );

  const sluitOpEscape = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={sluitOpEscape}
        className="flex h-[26rem] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Link2 size={15} className="text-slate-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-800">{t("y_next.link_any_title")}</h2>
            {subject && <p className="truncate text-[11px] text-slate-400">{subject}</p>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Links: het soort document. */}
          <div className="flex w-52 flex-col border-r border-slate-200">
            <input type="search" value={doctypeZoek}
              onChange={(e) => setDoctypeZoek(e.target.value)}
              placeholder={t("y_next.link_any_type_search")}
              className="m-2 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <div className="flex-1 overflow-y-auto pb-1">
              {zichtbareDoctypes.length === 0 ? (
                <p className="px-3 py-2 text-xs italic text-slate-400">{t("webmail.no_results")}</p>
              ) : zichtbareDoctypes.map((dt) => (
                <button key={dt} onClick={() => { setGekozen(dt); setZoek(""); }}
                  className={`w-full truncate px-3 py-1.5 text-left text-xs cursor-pointer ${
                    dt === gekozen
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}>
                  {dt}
                </button>
              ))}
            </div>
          </div>

          {/* Rechts: het document zelf. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative m-2">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" autoFocus value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder={t("y_next.link_any_search", { doctype: gekozen })}
                className="w-full rounded border border-slate-200 py-1 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
              {bezig && (
                <Loader2 size={13} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-300" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto pb-1">
              {fout ? (
                <p className="px-3 py-2 text-xs text-red-600">{t("y_next.link_any_failed", { error: fout })}</p>
              ) : doelen.length === 0 ? (
                <p className="px-3 py-2 text-xs italic text-slate-400">
                  {bezig ? t("common.loading") : t("webmail.no_results")}
                </p>
              ) : doelen.map((doel) => (
                <button key={doel.naam} onClick={() => onPick(gekozen, doel.naam)}
                  className="w-full px-3 py-1.5 text-left hover:bg-blue-50 cursor-pointer">
                  <span className="block truncate text-xs font-medium text-slate-700">{doel.naam}</span>
                  {doel.omschrijving && (
                    <span className="block truncate text-[11px] text-slate-400">{doel.omschrijving}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
