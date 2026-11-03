import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Armchair, ChevronRight } from "lucide-react";
import type { Page } from "../../components/Sidebar";
import { resolveSessionUser } from "../../lib/session";
import { listBoekingen, listPersonen, listWerkplekken, werkplekkenStand } from "../../lib/werkplekken";
import {
  berekenWeek, isoDatum, maandagVan, persoonVanGebruiker, sorteerPersonen, werkdagen,
  type Boeking, type Persoon, type Werkplek,
} from "../../lib/werkplekken-model";
import { VAKJE, persoonsKleur } from "../../components/werkplekken/werkplekken-ui";

interface Gegevens {
  gebruiker: string | null;
  personen: Persoon[];
  werkplekken: Werkplek[];
  boekingen: Boeking[];
}

/**
 * Jouw werkplek deze week, voor wie aan een persoon in Werkplekken gekoppeld
 * is (via het ERP-account). Rekent met dezelfde indeling als de pagina, dus
 * hier staat altijd hetzelfde bureau als daar.
 */
export function MijnWerkplekWidget({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { t, i18n } = useTranslation();
  const [gegevens, setGegevens] = useState<Gegevens | null | "niet-ingesteld">(null);
  const maandag = useMemo(() => maandagVan(new Date()), []);

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        if (await werkplekkenStand() !== "klaar") { if (actief) setGegevens("niet-ingesteld"); return; }
        const dagen = werkdagen(maandag);
        const [gebruiker, personen, werkplekken, boekingen] = await Promise.all([
          resolveSessionUser(), listPersonen(), listWerkplekken(), listBoekingen(dagen[0], dagen[4]),
        ]);
        if (actief) setGegevens({ gebruiker, personen, werkplekken, boekingen });
      } catch {
        if (actief) setGegevens("niet-ingesteld");
      }
    })();
    return () => { actief = false; };
  }, [maandag]);

  const kop = (
    <button type="button" onClick={() => onNavigate("werkplekken")}
      className="flex items-center gap-2 mb-4 cursor-pointer group text-left">
      <Armchair size={18} className="text-y-teal" />
      <h3 className="font-semibold text-slate-800 group-hover:text-y-teal">{t("widget.my_workplace")}</h3>
      <ChevronRight size={16} className="text-slate-400 group-hover:text-y-teal" />
    </button>
  );
  const kader = (inhoud: React.ReactNode) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">{kop}{inhoud}</div>
  );

  if (gegevens === null) return kader(<p className="text-sm text-slate-400 text-center py-4">{t("common.loading")}</p>);
  if (gegevens === "niet-ingesteld") return kader(<p className="text-sm text-slate-400 text-center py-4">{t("werkplekken.widget_niet_ingesteld")}</p>);

  const ik = persoonVanGebruiker(gegevens.personen, gegevens.gebruiker);
  if (!ik) return kader(<p className="text-sm text-slate-500 py-2">{t("werkplekken.widget_niet_gekoppeld")}</p>);
  if (ik.geen_werkplek) return kader(<p className="text-sm text-slate-500 py-2">{t("werkplekken.widget_geen_werkplek")}</p>);

  const week = berekenWeek(gegevens.personen, gegevens.werkplekken, gegevens.boekingen, maandag);
  const actief = sorteerPersonen(gegevens.personen.filter((p) => p.actief));
  const kleur = persoonsKleur(actief.findIndex((p) => p.name === ik.name));
  const plek = (id: string | null | undefined) => gegevens.werkplekken.find((w) => w.name === id);
  const vandaag = isoDatum(new Date());

  const beschrijf = (datum: string) => {
    const d = week.find((x) => x.datum === datum);
    const s = d?.standen.get(ik.name)?.stand;
    if (s === "kantoor") {
      const w = plek(d?.plaatsing.get(ik.name)?.werkplek);
      return w ? { klasse: kleur, kort: w.plek, lang: `${w.plek} · ${w.ruimte}` } : { klasse: VAKJE.fout, kort: t("werkplekken.geen_plek"), lang: t("werkplekken.geen_plek") };
    }
    if (s === "thuis") return { klasse: VAKJE.thuis, kort: t("werkplekken.thuis"), lang: t("werkplekken.thuis") };
    if (s === "afwezig") return { klasse: VAKJE.vrij, kort: t("werkplekken.afwezig"), lang: t("werkplekken.afwezig") };
    if (s === "keuze" || s === "onbekend") return { klasse: VAKJE.open, kort: "?", lang: t("werkplekken.widget_nog_open") };
    return { klasse: VAKJE.vrij, kort: "—", lang: t("werkplekken.widget_vrij") };
  };

  const isWerkdag = week.some((d) => d.datum === vandaag);
  const nu = isWerkdag ? beschrijf(vandaag) : null;

  return kader(
    <div className="space-y-3">
      {nu && (
        <div className={`rounded-lg border px-3 py-2.5 ${nu.klasse}`}>
          <span className="block text-[11px] uppercase tracking-wide opacity-70">{t("werkplekken.vandaag")}</span>
          <span className="block text-base font-semibold">{nu.lang}</span>
        </div>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {week.map((d) => {
          const b = beschrijf(d.datum);
          return (
            <div key={d.datum} className="text-center">
              <span className={`block text-[11px] mb-1 ${d.datum === vandaag ? "text-y-teal font-semibold" : "text-slate-400"}`}>
                {new Date(`${d.datum}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "short" })}
              </span>
              <span className={`block rounded-md border px-1 py-1.5 text-xs font-medium truncate ${b.klasse}`} title={b.lang}>{b.kort}</span>
            </div>
          );
        })}
      </div>
    </div>,
  );
}
