import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useToast } from "../Toast";
import {
  deletePersoon, deleteWerkplek, listGebruikers, savePersoon, saveWerkplek,
  type PersoonGegevens, type WerkplekGegevens,
} from "../../lib/werkplekken";
import {
  DAGEN, PATROON_WAARDEN, sorteerPersonen, sorteerWerkplekken,
  type Dag, type PatroonWaarde, type Persoon, type Werkplek,
} from "../../lib/werkplekken-model";

type Tab = "mensen" | "plekken";

/**
 * Mensen en plekken beheren, zonder code: wie er werkt, wanneer standaard,
 * met welk ERP-account, en welke bureaus er in welke ruimte staan.
 */
export default function Beheer({ personen, werkplekken, onClose, onChanged }: {
  personen: Persoon[];
  werkplekken: Werkplek[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("mensen");
  const [gebruikers, setGebruikers] = useState<{ email: string; naam: string }[]>([]);
  const [nieuwePersoon, setNieuwePersoon] = useState(false);
  const [nieuwePlek, setNieuwePlek] = useState(false);

  useEffect(() => { listGebruikers().then(setGebruikers); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const tabKlasse = (actief: boolean) =>
    `px-3 py-2 text-sm cursor-pointer ${actief ? "bg-y-teal/10 text-y-teal font-semibold" : "text-slate-600 hover:bg-slate-50"}`;
  const ruimtes = [...new Set(werkplekken.map((w) => w.ruimte).filter(Boolean))];
  const volgende = (lijst: { volgorde: number }[]) => Math.max(0, ...lijst.map((x) => x.volgorde || 0)) + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-5xl bg-white rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{t("werkplekken.beheer")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer" aria-label={t("common.close")}><X size={18} /></button>
        </div>
        <div className="px-6 pt-4">
          <div className="inline-flex border border-slate-200 rounded-lg overflow-hidden bg-white" role="group">
            <button type="button" onClick={() => setTab("mensen")} aria-pressed={tab === "mensen"} className={tabKlasse(tab === "mensen")}>{t("werkplekken.mensen")}</button>
            <button type="button" onClick={() => setTab("plekken")} aria-pressed={tab === "plekken"} className={`${tabKlasse(tab === "plekken")} border-l border-slate-200`}>{t("werkplekken.plekken")}</button>
          </div>
        </div>

        {tab === "mensen" ? (
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-slate-500">{t("werkplekken.mensen_uitleg")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[56rem]">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.naam")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.erp_account")}</th>
                    {DAGEN.map((d) => <th key={d} className="py-2 px-0.5 font-medium text-center">{t(`werkplekken.dag.${d}`)}</th>)}
                    <th className="py-2 px-1 font-medium text-center">{t("werkplekken.wisselend")}</th>
                    <th className="py-2 px-1 font-medium text-center">{t("werkplekken.actief")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.notitie")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorteerPersonen(personen).map((p) => (
                    <PersoonRij key={p.name} persoon={p} gebruikers={gebruikers} onChanged={onChanged} />
                  ))}
                  {nieuwePersoon && (
                    <PersoonRij gebruikers={gebruikers} volgorde={volgende(personen)}
                      onChanged={() => { setNieuwePersoon(false); onChanged(); }} onCancel={() => setNieuwePersoon(false)} />
                  )}
                </tbody>
              </table>
            </div>
            {!nieuwePersoon && (
              <button type="button" onClick={() => setNieuwePersoon(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <Plus size={15} /> {t("werkplekken.persoon_toevoegen")}
              </button>
            )}
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-slate-500">{t("werkplekken.plekken_uitleg")}</p>
            <datalist id="werkplek-ruimtes">{ruimtes.map((r) => <option key={r} value={r} />)}</datalist>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[52rem]">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.plek")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.ruimte")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.omschrijving")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.vaste_plek_van")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.meestal_voor")}</th>
                    <th className="py-2 pr-2 font-medium">{t("werkplekken.volgorde")}</th>
                    <th className="py-2 px-1 font-medium text-center">{t("werkplekken.actief")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorteerWerkplekken(werkplekken).map((w) => (
                    <WerkplekRij key={w.name} werkplek={w} personen={personen} onChanged={onChanged} />
                  ))}
                  {nieuwePlek && (
                    <WerkplekRij personen={personen} volgorde={volgende(werkplekken)}
                      onChanged={() => { setNieuwePlek(false); onChanged(); }} onCancel={() => setNieuwePlek(false)} />
                  )}
                </tbody>
              </table>
            </div>
            {!nieuwePlek && (
              <button type="button" onClick={() => setNieuwePlek(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <Plus size={15} /> {t("werkplekken.plek_toevoegen")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const VELD = "w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-y-teal";

/** Volgende waarde van een dagknop: leeg → kantoor → thuis → keuze → leeg. */
function volgendePatroon(w: PatroonWaarde): PatroonWaarde {
  return PATROON_WAARDEN[(PATROON_WAARDEN.indexOf(w) + 1) % PATROON_WAARDEN.length];
}
const DAGKNOP: Record<PatroonWaarde, string> = {
  "": "border-slate-200 text-slate-300",
  Kantoor: "bg-teal-50 border-teal-300 text-teal-800",
  Thuis: "bg-slate-100 border-slate-300 text-slate-600",
  Keuze: "bg-amber-50 border-amber-300 text-amber-800",
};

function leegPersoon(volgorde: number): PersoonGegevens {
  return {
    naam: "", gebruiker: null, dag_ma: "", dag_di: "", dag_wo: "", dag_do: "", dag_vr: "",
    wisselend: 0, af_en_toe: 0, actief: 1, volgorde, notitie: null,
  };
}

function PersoonRij({ persoon, gebruikers, volgorde = 0, onChanged, onCancel }: {
  persoon?: Persoon; gebruikers: { email: string; naam: string }[]; volgorde?: number; onChanged: () => void; onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const begin = persoon ? { ...persoon } : leegPersoon(volgorde);
  const [concept, setConcept] = useState<PersoonGegevens>(begin);
  const [busy, setBusy] = useState(false);
  const gewijzigd = !persoon || (Object.keys(concept) as (keyof PersoonGegevens)[]).some((k) => (concept[k] ?? "") !== (persoon[k] ?? ""));
  const zet = <K extends keyof PersoonGegevens>(k: K, v: PersoonGegevens[K]) => setConcept((c) => ({ ...c, [k]: v }));
  // Een adres dat (nog) niet bij een actieve medewerker hoort, blijft kiesbaar.
  const opties = concept.gebruiker && !gebruikers.some((g) => g.email === concept.gebruiker)
    ? [...gebruikers, { email: concept.gebruiker, naam: concept.gebruiker }] : gebruikers;

  async function bewaar() {
    if (!concept.naam.trim()) { toast.error(t("werkplekken.naam_verplicht")); return; }
    setBusy(true);
    try {
      await savePersoon(persoon?.name ?? null, { ...concept, naam: concept.naam.trim(), gebruiker: concept.gebruiker || "" });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder() {
    if (!persoon || !window.confirm(t("werkplekken.persoon_verwijderen_vraag", { naam: persoon.naam }))) return;
    try {
      await deletePersoon(persoon.name);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.verwijderen_mislukt"));
    }
  }

  return (
    <tr className="border-t border-slate-100 align-middle">
      <td className="py-1.5 pr-2"><input value={concept.naam} onChange={(e) => zet("naam", e.target.value)} className={VELD} aria-label={t("werkplekken.naam")} /></td>
      <td className="py-1.5 pr-2">
        <select value={concept.gebruiker || ""} onChange={(e) => zet("gebruiker", e.target.value || null)} className={VELD} aria-label={t("werkplekken.erp_account")}>
          <option value="">{t("werkplekken.geen_account_kort")}</option>
          {opties.map((g) => <option key={g.email} value={g.email}>{g.naam}</option>)}
        </select>
      </td>
      {DAGEN.map((d: Dag) => {
        const w = (concept[`dag_${d}`] || "") as PatroonWaarde;
        return (
          <td key={d} className="py-1.5 px-0.5 text-center">
            <button type="button" onClick={() => zet(`dag_${d}`, volgendePatroon(w))}
              title={t("werkplekken.dagknop_uitleg")}
              className={`w-16 px-1 py-1 text-xs rounded-md border cursor-pointer ${DAGKNOP[w]}`}>
              {w ? t(`werkplekken.patroon.${w}`) : "–"}
            </button>
          </td>
        );
      })}
      {(["wisselend", "actief"] as const).map((k) => (
        <td key={k} className="py-1.5 px-1 text-center">
          <input type="checkbox" checked={!!concept[k]} onChange={(e) => zet(k, e.target.checked ? 1 : 0)} aria-label={t(`werkplekken.${k}`)} className="accent-y-teal" />
        </td>
      ))}
      <td className="py-1.5 pr-2"><input value={concept.notitie || ""} onChange={(e) => zet("notitie", e.target.value || null)} className={VELD} aria-label={t("werkplekken.notitie")} /></td>
      <td className="py-1.5 whitespace-nowrap text-right">
        {gewijzigd && (
          <button type="button" onClick={bewaar} disabled={busy} title={t("werkplekken.opslaan")}
            className="p-1.5 text-y-teal hover:bg-y-teal/10 rounded cursor-pointer disabled:opacity-50"><Save size={16} /></button>
        )}
        {persoon ? (
          <button type="button" onClick={verwijder} title={t("werkplekken.verwijderen")}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={16} /></button>
        ) : (
          <button type="button" onClick={onCancel} title={t("common.cancel")}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"><X size={16} /></button>
        )}
      </td>
    </tr>
  );
}

function leegWerkplek(volgorde: number): WerkplekGegevens {
  return { plek: "", ruimte: "", omschrijving: null, vaste_persoon: null, voorkeur_persoon: null, volgorde, actief: 1 };
}

function WerkplekRij({ werkplek, personen, volgorde = 0, onChanged, onCancel }: {
  werkplek?: Werkplek; personen: Persoon[]; volgorde?: number; onChanged: () => void; onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [concept, setConcept] = useState<WerkplekGegevens>(werkplek ? { ...werkplek } : leegWerkplek(volgorde));
  const [busy, setBusy] = useState(false);
  const gewijzigd = !werkplek || (Object.keys(concept) as (keyof WerkplekGegevens)[]).some((k) => (concept[k] ?? "") !== (werkplek[k] ?? ""));
  const zet = <K extends keyof WerkplekGegevens>(k: K, v: WerkplekGegevens[K]) => setConcept((c) => ({ ...c, [k]: v }));
  const mensen = sorteerPersonen(personen.filter((p) => p.actief));

  async function bewaar() {
    if (!concept.plek.trim() || !concept.ruimte.trim()) { toast.error(t("werkplekken.plek_ruimte_verplicht")); return; }
    setBusy(true);
    try {
      // Een lege Link moet als "" mee, anders laat Frappe de oude waarde staan.
      await saveWerkplek(werkplek?.name ?? null, {
        ...concept, plek: concept.plek.trim(), ruimte: concept.ruimte.trim(),
        vaste_persoon: concept.vaste_persoon || "",
        voorkeur_persoon: concept.voorkeur_persoon || "",
        volgorde: Number(concept.volgorde) || 0,
      });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.opslaan_mislukt"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder() {
    if (!werkplek || !window.confirm(t("werkplekken.plek_verwijderen_vraag", { plek: werkplek.plek }))) return;
    try {
      await deleteWerkplek(werkplek.name);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("werkplekken.verwijderen_mislukt"));
    }
  }

  const persoonSelect = (k: "vaste_persoon" | "voorkeur_persoon", label: string) => (
    <select value={concept[k] || ""} onChange={(e) => zet(k, e.target.value || null)} className={VELD} aria-label={label}>
      <option value="">{k === "vaste_persoon" ? t("werkplekken.flexplek") : "–"}</option>
      {mensen.map((p) => <option key={p.name} value={p.name}>{p.naam}</option>)}
    </select>
  );

  return (
    <tr className="border-t border-slate-100 align-middle">
      <td className="py-1.5 pr-2"><input value={concept.plek} onChange={(e) => zet("plek", e.target.value)} className={VELD} aria-label={t("werkplekken.plek")} /></td>
      <td className="py-1.5 pr-2"><input value={concept.ruimte} list="werkplek-ruimtes" onChange={(e) => zet("ruimte", e.target.value)} className={VELD} aria-label={t("werkplekken.ruimte")} /></td>
      <td className="py-1.5 pr-2"><input value={concept.omschrijving || ""} onChange={(e) => zet("omschrijving", e.target.value || null)} className={VELD} aria-label={t("werkplekken.omschrijving")} /></td>
      <td className="py-1.5 pr-2">{persoonSelect("vaste_persoon", t("werkplekken.vaste_plek_van"))}</td>
      <td className="py-1.5 pr-2">{persoonSelect("voorkeur_persoon", t("werkplekken.meestal_voor"))}</td>
      <td className="py-1.5 pr-2 w-20"><input type="number" value={concept.volgorde} onChange={(e) => zet("volgorde", Number(e.target.value))} className={VELD} aria-label={t("werkplekken.volgorde")} /></td>
      <td className="py-1.5 px-1 text-center">
        <input type="checkbox" checked={!!concept.actief} onChange={(e) => zet("actief", e.target.checked ? 1 : 0)} aria-label={t("werkplekken.actief")} className="accent-y-teal" />
      </td>
      <td className="py-1.5 whitespace-nowrap text-right">
        {gewijzigd && (
          <button type="button" onClick={bewaar} disabled={busy} title={t("werkplekken.opslaan")}
            className="p-1.5 text-y-teal hover:bg-y-teal/10 rounded cursor-pointer disabled:opacity-50"><Save size={16} /></button>
        )}
        {werkplek ? (
          <button type="button" onClick={verwijder} title={t("werkplekken.verwijderen")}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={16} /></button>
        ) : (
          <button type="button" onClick={onCancel} title={t("common.cancel")}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"><X size={16} /></button>
        )}
      </td>
    </tr>
  );
}
