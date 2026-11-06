import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useToast } from "../Toast";
import { zetDag } from "../../lib/werkplekken";
import type { Boeking, DagInvulling, Persoon, Werkplek } from "../../lib/werkplekken-model";

/**
 * Iemand op één dag op een vrije flexplek neerzetten. Dat wordt een boeking
 * "Kantoor" op die plek; de automatische indeling houdt er rekening mee.
 */
export default function IemandNeerzetten({ werkplek, datum, datumTekst, personen, standen, boekingen, onClose, onChanged }: {
  werkplek: Werkplek;
  datum: string;
  datumTekst: (iso: string) => string;
  personen: Persoon[];
  standen: Map<string, DagInvulling>;
  boekingen: Boeking[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Flexers die die dag nog niet op kantoor zijn; wie een vaste plek heeft,
  // zit als hij komt gewoon op die plek (dat zet je in zijn dagvenster).
  const kandidaten = personen.filter((p) => p.actief && standen.get(p.name)?.stand !== "kantoor");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function zet(p: Persoon) {
    setBusy(true);
    try {
      await zetDag(p.name, datum, "Kantoor", werkplek.name, boekingen.filter((b) => b.persoon === p.name && b.datum === datum));
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-800">{werkplek.plek} · {werkplek.ruimte}</h3>
            <p className="text-sm text-slate-500">{datumTekst(datum)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label={t("common.close")}><X size={18} /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-slate-500 mb-3">{t("werkplekken.wie_zit_hier")}</p>
          {kandidaten.length === 0 ? (
            <p className="text-sm text-slate-400">{t("werkplekken.iedereen_heeft_plek")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {kandidaten.map((p) => (
                <li key={p.name}>
                  <button type="button" disabled={busy} onClick={() => zet(p)}
                    className="w-full px-3 py-2 text-sm text-left border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                    {p.naam}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
