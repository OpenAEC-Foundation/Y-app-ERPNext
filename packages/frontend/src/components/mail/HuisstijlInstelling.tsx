import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Type } from "lucide-react";
import {
  fetchMailOpmaak,
  saveMailOpmaak,
  opmaakStijl,
  MAIL_GROOTTES,
  MAIL_LETTERTYPEN,
  STANDAARD_MAIL_OPMAAK,
  type MailOpmaak,
} from "../../lib/mailOpmaak";

/**
 * Het lettertype voor uitgaande e-mail — één instelling voor heel 3BM.
 *
 * Opslaan kan alleen een System Manager; dat is geen beperking die hier wordt
 * afgedwongen maar een die ERPNext zelf stelt op `Y Next Setting`. Daarom
 * meldt dit scherm de uitkomst van het opslaan in plaats van te doen alsof het
 * altijd lukt: een beheerder die het niet is, hoort dat te merken.
 *
 * Het voorbeeld eronder staat in dezelfde inline stijl als de verstuurde mail
 * (`opmaakStijl`), dus wat je hier ziet is wat de ontvanger krijgt.
 */
export default function HuisstijlInstelling() {
  const { t } = useTranslation();
  const [opmaak, setOpmaak] = useState<MailOpmaak>(STANDAARD_MAIL_OPMAAK);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<"gelukt" | "geweigerd" | "">("");

  useEffect(() => {
    let afgebroken = false;
    void fetchMailOpmaak().then((o) => {
      if (afgebroken) return;
      setOpmaak(o);
      setLaden(false);
    });
    return () => { afgebroken = true; };
  }, []);

  const wijzig = (deel: Partial<MailOpmaak>) => {
    setOpmaak((vorig) => ({ ...vorig, ...deel }));
    setMelding("");
  };

  async function bewaar() {
    setBezig(true);
    setMelding("");
    const gelukt = await saveMailOpmaak(opmaak);
    setMelding(gelukt ? "gelukt" : "geweigerd");
    setBezig(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Type size={18} className="text-blue-500" />
        <div>
          <h4 className="text-sm font-semibold text-slate-700">{t("mail_style.title")}</h4>
          <p className="text-xs text-slate-400">{t("mail_style.subtitle")}</p>
        </div>
      </div>

      {laden ? (
        <div className="flex items-center gap-2 py-6 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {t("mail_style.font")}
              </span>
              <select value={opmaak.lettertype}
                onChange={(e) => wijzig({ lettertype: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MAIL_LETTERTYPEN.map((l) => (
                  <option key={l.naam} value={l.naam}>{l.naam}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {t("mail_style.size")}
              </span>
              <select value={opmaak.grootte}
                onChange={(e) => wijzig({ grootte: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MAIL_GROOTTES.map((g) => (
                  <option key={g} value={g}>{g} pt</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                {t("mail_style.colour")}
              </span>
              <div className="flex items-center gap-2">
                <input type="color" value={opmaak.kleur}
                  onChange={(e) => wijzig({ kleur: e.target.value })}
                  aria-label={t("mail_style.colour")}
                  className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1" />
                <span className="font-mono text-xs text-slate-500">{opmaak.kleur}</span>
              </div>
            </label>
          </div>

          {/* Het voorbeeld draagt exact de stijl die de mail meekrijgt. */}
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
              {t("mail_style.preview")}
            </p>
            <p style={stijlObject(opmaakStijl(opmaak))}>{t("mail_style.preview_text")}</p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => void bewaar()} disabled={bezig}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-y-teal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-y-teal-dark disabled:opacity-50">
              {bezig ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("mail_style.save")}
            </button>
            {melding === "gelukt" && (
              <span className="text-xs text-emerald-600">{t("mail_style.saved")}</span>
            )}
            {melding === "geweigerd" && (
              <span className="text-xs text-amber-700">{t("mail_style.no_permission")}</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** Dezelfde CSS-tekst als de mail krijgt, omgezet naar wat React aanneemt. */
function stijlObject(css: string): Record<string, string> {
  const uit: Record<string, string> = {};
  for (const deel of css.split(";")) {
    const i = deel.indexOf(":");
    if (i <= 0) continue;
    const naam = deel.slice(0, i).trim().replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    const waarde = deel.slice(i + 1).trim();
    if (naam && waarde) uit[naam] = waarde;
  }
  return uit;
}
