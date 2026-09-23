import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Clock, FileText, Search, Star } from "lucide-react";
import {
  groepeer, laatstGewijzigd, vaakstGeopend, zoekArtikelen,
  type Tellingen, type WikiArtikel,
} from "../../lib/wiki-overzicht";

/**
 * De hoofdpagina van de kennisbank.
 *
 * Wat je hier ziet in plaats van een leeg vlak: hoeveel artikelen er zijn,
 * waar ze over gaan (de secties komen uit het pad van elk artikel), wat er
 * pas gewijzigd is, en welke artikelen jij zelf het vaakst opent. Zoeken
 * filtert alles tegelijk.
 */
export default function KennisbankHome({ artikelen, tellingen, onOpen, onNieuw }: {
  artikelen: WikiArtikel[];
  tellingen: Tellingen;
  onOpen: (naam: string) => void;
  onNieuw?: () => void;
}) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");

  const gevonden = useMemo(() => zoekArtikelen(artikelen, term), [artikelen, term]);
  const secties = useMemo(() => groepeer(gevonden), [gevonden]);
  const recent = useMemo(() => laatstGewijzigd(artikelen), [artikelen]);
  const favoriet = useMemo(() => vaakstGeopend(artikelen, tellingen), [artikelen, tellingen]);

  const datum = (waarde?: string) =>
    (waarde ? new Date(waarde).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) : "");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex items-start gap-3">
          <BookOpen size={26} className="mt-1 flex-shrink-0 text-y-teal" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{t("wiki.home_title")}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t("wiki.home_intro", { count: artikelen.length, sections: groepeer(artikelen).length })}
            </p>
          </div>
          {onNieuw && (
            <button type="button" onClick={onNieuw}
              className="flex-shrink-0 cursor-pointer rounded-lg bg-y-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-y-teal-dark">
              {t("wiki.new_page")}
            </button>
          )}
        </div>

        <div className="relative mt-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)}
            placeholder={t("wiki.home_search_placeholder")}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-y-teal/40" />
        </div>

        {/* Twee korte lijsten bovenaan: wat er net veranderd is, en wat jij
            steeds opzoekt. Bij zoeken hebben ze geen zin. */}
        {!term && (recent.length > 0 || favoriet.length > 0) && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {favoriet.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Star size={12} /> {t("wiki.home_most_opened")}
                </h2>
                <ul className="mt-2 space-y-1">
                  {favoriet.map(({ artikel, aantal }) => (
                    <li key={artikel.name}>
                      <button type="button" onClick={() => onOpen(artikel.name)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left text-sm text-slate-700 hover:bg-slate-50">
                        <span className="min-w-0 flex-1 truncate">{artikel.title || artikel.name}</span>
                        <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                          {t("wiki.home_open_count", { count: aantal })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {recent.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Clock size={12} /> {t("wiki.home_recent")}
                </h2>
                <ul className="mt-2 space-y-1">
                  {recent.map((artikel) => (
                    <li key={artikel.name}>
                      <button type="button" onClick={() => onOpen(artikel.name)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left text-sm text-slate-700 hover:bg-slate-50">
                        <span className="min-w-0 flex-1 truncate">{artikel.title || artikel.name}</span>
                        <span className="flex-shrink-0 text-[11px] text-slate-400">{datum(artikel.modified)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Alles, per onderwerp. */}
        <div className="mt-6 space-y-4">
          {secties.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              {t("wiki.no_results")}
            </p>
          )}
          {secties.map((sectie) => (
            <section key={sectie.pad || "algemeen"} className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {sectie.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                  {sectie.artikelen.length}
                </span>
              </h2>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {sectie.artikelen.map((artikel) => (
                  <li key={artikel.name}>
                    <button type="button" onClick={() => onOpen(artikel.name)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                      <FileText size={12} className="flex-shrink-0 text-slate-300" />
                      <span className="min-w-0 flex-1 truncate">{artikel.title || artikel.name}</span>
                      {(tellingen[artikel.name] ?? 0) > 0 && (
                        <span className="flex-shrink-0 text-[11px] text-slate-400">{tellingen[artikel.name]}×</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
