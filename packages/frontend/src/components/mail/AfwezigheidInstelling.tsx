import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { standaardTekst, isStandaardTekst } from "../../lib/afwezigheid-tekst";
import { haalCollegas, type Collega } from "../../lib/agenda-mailserver";
import { ondertekeningVoor } from "../../lib/mail-signature-erpnext";
import { htmlToPlainText } from "../../lib/mail-html";
import { resolveSessionUser } from "../../lib/session";
import {
  haalAfwezigheid,
  naarMailserver,
  vanMailserver,
  zetAfwezigheid,
  type AfwezigheidFormulier,
  type AfwezigheidStand,
} from "../../lib/mail-afwezigheid";

/**
 * De afwezigheidsmelding van je eigen postbus instellen.
 *
 * Op de mailserver, niet in ERPNext: dan antwoordt de mailserver zelf, ook als
 * ERPNext even geen mail ophaalt. Met een begin- en einddatum, zodat hij na je
 * vakantie vanzelf weer uit gaat — de melding die blijft staan terwijl je allang
 * terug bent, is de klassieke fout.
 */
export default function AfwezigheidInstelling({ onSluit, onOpgeslagen }: {
  onSluit: () => void;
  /** De stand zoals de mailserver hem na het opslaan heeft. */
  onOpgeslagen: (stand: AfwezigheidStand) => void;
}) {
  const { t } = useTranslation();
  const [formulier, setFormulier] = useState<AfwezigheidFormulier | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  /** Collega's om naar door te verwijzen, uit de medewerkers met een mailadres. */
  const [collegas, setCollegas] = useState<Collega[]>([]);
  const [collega, setCollega] = useState("");
  /** De eigen ondertekening als platte tekst, voor onder de melding. */
  const [ondertekening, setOndertekening] = useState("");

  useEffect(() => {
    let afgebroken = false;
    void (async () => {
      const ik = String((await resolveSessionUser().catch(() => "")) || "").toLowerCase();
      const lijst = await haalCollegas().catch(() => [] as Collega[]);
      if (afgebroken) return;
      // Jezelf niet in de lijst: naar jezelf doorverwijzen heeft geen zin.
      const zonderMij = lijst.filter((c) => c.email.toLowerCase() !== ik);
      setCollegas(zonderMij);
      if (!ik) return;
      const html = await ondertekeningVoor(ik).catch(() => "");
      if (afgebroken) return;
      const onder = html ? htmlToPlainText(html).trim() : "";
      setOndertekening(onder);
      setFormulier((f) => (f ? metStandaardtekst(f, "", zonderMij, onder) : f));
    })();
    return () => { afgebroken = true; };
  }, []);

  /**
   * De tekst schrijft zichzelf, zolang jij hem niet hebt aangepast: de datums
   * en de gekozen collega komen er meteen in te staan. Zodra je er zelf iets
   * van maakt, blijft die tekst staan.
   */
  function metStandaardtekst(
    f: AfwezigheidFormulier,
    wie: string,
    lijst: Collega[],
    onder: string,
  ): AfwezigheidFormulier {
    if (!isStandaardTekst(f.tekst)) return f;
    const gekozen = lijst.find((c) => c.email === wie);
    return {
      ...f,
      tekst: standaardTekst({
        van: f.van,
        tot: f.tot,
        collega: gekozen?.naam || "",
        collegaEmail: gekozen?.email || "",
        ondertekening: onder,
      }),
    };
  }

  useEffect(() => {
    let afgebroken = false;
    haalAfwezigheid()
      .then((stand) => {
        if (afgebroken) return;
        const f = vanMailserver(stand);
        setFormulier(metStandaardtekst(f, "", [], ""));
      })
      .catch((err) => {
        if (afgebroken) return;
        setFout(err instanceof Error ? err.message : String(err));
        setFormulier({ aan: false, van: "", tot: "", onderwerp: "", tekst: "" });
      });
    return () => { afgebroken = true; };
  }, []);

  const zet = <K extends keyof AfwezigheidFormulier>(sleutel: K, waarde: AfwezigheidFormulier[K]) =>
    setFormulier((f) => (f ? { ...f, [sleutel]: waarde } : f));

  async function opslaan() {
    if (!formulier) return;
    setFout("");
    if (formulier.aan && !formulier.tekst.trim()) {
      setFout(t("webmail.away_text_required"));
      return;
    }
    let stand: AfwezigheidStand;
    try {
      stand = naarMailserver(formulier);
    } catch {
      setFout(t("webmail.away_dates_invalid"));
      return;
    }
    setBezig(true);
    try {
      onOpgeslagen(await zetAfwezigheid(stand));
      onSluit();
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
    } finally {
      setBezig(false);
    }
  }

  const veld = "w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-y-teal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onSluit}>
      <div className="w-[440px] max-w-[95vw] rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{t("webmail.away_title")}</h3>
          <button type="button" onClick={onSluit} title={t("common.close")}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>

        {!formulier ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
          </p>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formulier.aan} onChange={(e) => zet("aan", e.target.checked)}
                className="h-4 w-4 cursor-pointer" />
              {t("webmail.away_enabled")}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-500">
                {t("webmail.away_from")}
                <input type="date" value={formulier.van}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormulier((f) => (f ? metStandaardtekst({ ...f, van: v }, collega, collegas, ondertekening) : f));
                  }}
                  className={veld + " mt-1"} />
              </label>
              <label className="block text-xs text-slate-500">
                {t("webmail.away_until")}
                <input type="date" value={formulier.tot} min={formulier.van || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormulier((f) => (f ? metStandaardtekst({ ...f, tot: v }, collega, collegas, ondertekening) : f));
                  }}
                  className={veld + " mt-1"} />
              </label>
            </div>
            <p className="-mt-1 text-[11px] text-slate-400">{t("webmail.away_dates_hint")}</p>

            {/* Naar wie mensen kunnen bellen of mailen terwijl jij weg bent. */}
            <label className="block text-xs text-slate-500">
              {t("webmail.away_colleague")}
              <select value={collega}
                onChange={(e) => {
                  const wie = e.target.value;
                  setCollega(wie);
                  setFormulier((f) => (f ? metStandaardtekst(f, wie, collegas, ondertekening) : f));
                }}
                className={veld + " mt-1 bg-white"}>
                <option value="">{t("webmail.away_colleague_none")}</option>
                {collegas.map((c) => (
                  <option key={c.email} value={c.email}>{c.naam || c.email}</option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-slate-500">
              {t("webmail.away_subject")}
              <input type="text" value={formulier.onderwerp} placeholder={t("webmail.away_subject_placeholder")}
                onChange={(e) => zet("onderwerp", e.target.value)} className={veld + " mt-1"} />
            </label>

            <label className="block text-xs text-slate-500">
              {t("webmail.away_message")}
              <textarea value={formulier.tekst} rows={8} placeholder={t("webmail.away_message_placeholder")}
                onChange={(e) => zet("tekst", e.target.value)} className={veld + " mt-1 resize-y"} />
            </label>
            <div className="-mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">{t("webmail.away_message_hint")}</p>
              <button type="button"
                onClick={() => {
                  const gekozen = collegas.find((c) => c.email === collega);
                  zet("tekst", standaardTekst({
                    van: formulier.van, tot: formulier.tot,
                    collega: gekozen?.naam || "", collegaEmail: gekozen?.email || "",
                    ondertekening,
                  }));
                }}
                className="flex-shrink-0 cursor-pointer rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                {t("webmail.away_message_reset")}
              </button>
            </div>

            {fout && <p className="rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-600">{fout}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onSluit}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200">
            {t("common.cancel")}
          </button>
          <button type="button" onClick={() => void opslaan()} disabled={!formulier || bezig}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-y-teal px-4 py-1.5 text-sm font-medium text-white hover:bg-y-teal-dark disabled:opacity-50">
            {bezig && <Loader2 size={13} className="animate-spin" />}
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
