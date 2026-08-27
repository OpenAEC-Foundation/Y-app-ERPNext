import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ApiError, deleteDocument, fetchAttachments, getFileUrl, isDoctypeMissing, uploadFile,
} from "../lib/erpnext";
import {
  Car, CheckCircle, Clock, FileText, Receipt, RefreshCw, Search, Send, XCircle,
  AlertTriangle, Paperclip, Filter, Euro,
} from "lucide-react";
import { QuickKmBooking, StatusBadge, formatEuro } from "./dashboard/QuickKmBooking";
import { useEmployees, useProjects } from "../lib/DataContext";
import { useSessionEmployeeId } from "../lib/useSessionEmployee";
import { useTranslation } from "react-i18next";
import { resolveSessionUser } from "../lib/session";
import {
  DECLARATIE_STATUSSEN, KM_DOCTYPE, ONKOSTEN_DOCTYPE,
  beoordeel, createOnkosten, dienIn,
  fetchKmRegistraties, fetchOnkosten, fetchOnkostensoorten,
  formatErpDate, totaleKilometers,
  type DeclaratieStatus, type KmRegistratie, type Onkostenpost,
} from "../lib/declaraties";
import { DEFAULT_KM_TARIEF, fetchKmTarief, saveKmTarief } from "../lib/kmTarief";

/**
 * Kilometers & onkosten.
 *
 * Draait op Y-next' eigen doctypes `Y Km Registratie` en `Y Onkosten` — zie
 * `lib/declaraties.ts` voor waarom dat geen HRMS `Travel Request` /
 * `Expense Claim` meer is.
 *
 * Vier tabbladen. De eerste drie zijn er voor iedereen: een medewerker ziet
 * dankzij `if_owner` server-side alléén zijn eigen documenten, dus er is geen
 * apart medewerkersscherm nodig. "Goedkeuren" is werkgeversgebied.
 */

type ExpensesTab = "boeken" | "onkosten" | "overzicht" | "goedkeuren";
const VALID_TABS: ExpensesTab[] = ["boeken", "onkosten", "overzicht", "goedkeuren"];

/** Eerste en laatste dag van de kalendermaand van `d`. */
function monthRange(d: Date): { from: string; to: string } {
  return {
    from: formatErpDate(new Date(d.getFullYear(), d.getMonth(), 1)),
    to: formatErpDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

function formatKm(value: number): string {
  return `${value.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km`;
}

/**
 * Vertaalt een mislukte schrijfactie. Een 403 op deze doctypes betekent bijna
 * altijd `if_owner`: het document is niet van deze gebruiker. Dat expliciet
 * zeggen scheelt een zoektocht — een generieke "mislukt" laat de gebruiker
 * denken dat de app hapert.
 */
function useDeclaratieError() {
  const { t } = useTranslation();
  return useCallback((err: unknown, fallbackKey: string): string => {
    if (err instanceof ApiError && err.status === 403) return t("declaraties.not_your_record");
    return err instanceof Error && err.message ? err.message : t(fallbackKey);
  }, [t]);
}

export default function Expenses() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab: ExpensesTab = (VALID_TABS.includes(tabFromUrl as ExpensesTab) ? tabFromUrl : "boeken") as ExpensesTab;
  const [activeTab, setActiveTab] = useState<ExpensesTab>(initialTab);
  const viewMode = (localStorage.getItem("view_mode") || "employer");

  // Sync state when URL changes (e.g. user re-clicks the dashboard card).
  useEffect(() => {
    if (VALID_TABS.includes(tabFromUrl as ExpensesTab) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl as ExpensesTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  function selectTab(id: ExpensesTab) {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  }

  const tabs: { id: ExpensesTab; label: string; icon: typeof Car; employerOnly?: boolean }[] = [
    { id: "boeken", label: t("declaraties.tab_km"), icon: Car },
    { id: "onkosten", label: t("declaraties.tab_expenses"), icon: Receipt },
    { id: "overzicht", label: t("declaraties.tab_overview"), icon: FileText },
    { id: "goedkeuren", label: t("declaraties.tab_approve"), icon: CheckCircle, employerOnly: true },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("onkosten.title")}</h2>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.filter((tab) => !tab.employerOnly || viewMode === "employer").map((tab) => (
          <button key={tab.id} onClick={() => selectTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id ? "bg-y-teal text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "boeken" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <QuickKmBooking hideRecentTrips />
          <MijnKilometers />
        </div>
      )}

      {activeTab === "onkosten" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <OnkostenBoeken />
          <MijnOnkosten />
        </div>
      )}

      {activeTab === "overzicht" && <DeclaratieOverzicht />}

      {activeTab === "goedkeuren" && viewMode === "employer" && <GoedkeurenView />}
    </div>
  );
}

/** De melding wanneer het provisioningscript nog niet gedraaid is. */
function ModuleNotice({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start gap-2">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <span>{t("declaraties.doctypes_missing")}</span>
    </div>
  );
}

/* ─────────────────────── Km boeken: eigen ritten ─────────────────────── */

/**
 * De eigen ritten van deze maand, met een bulkknop om alle concepten in één
 * keer in te dienen — dat is wat een medewerker aan het eind van de maand
 * daadwerkelijk doet.
 */
function MijnKilometers() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const employee = useSessionEmployeeId(allEmployees);
  const describeError = useDeclaratieError();

  const [ritten, setRitten] = useState<KmRegistratie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doctypeMissing, setDoctypeMissing] = useState(false);
  const [maand] = useState(() => new Date());

  const range = useMemo(() => monthRange(maand), [maand]);

  const load = useCallback(async () => {
    if (!employee) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setRitten(await fetchKmRegistraties({ employee, vanaf: range.from, tot: range.to }));
    } catch (err) {
      setError(describeError(err, "common.unknown_error"));
    } finally {
      setLoading(false);
      setDoctypeMissing(isDoctypeMissing(KM_DOCTYPE));
    }
  }, [employee, range.from, range.to, describeError]);

  useEffect(() => { load(); }, [load]);

  const concepten = useMemo(() => ritten.filter((r) => r.status === "Concept"), [ritten]);

  async function dienConceptenIn() {
    setBusy(true);
    setError(null);
    try {
      for (const rit of concepten) await dienIn(KM_DOCTYPE, rit.name);
      await load();
    } catch (err) {
      setError(describeError(err, "declaraties.submit_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder(rit: KmRegistratie) {
    setError(null);
    try {
      await deleteDocument(KM_DOCTYPE, rit.name);
      setRitten((prev) => prev.filter((r) => r.name !== rit.name));
    } catch (err) {
      setError(describeError(err, "common.delete_failed"));
    }
  }

  const totaalKm = ritten.reduce((s, r) => s + totaleKilometers(r), 0);
  const totaalBedrag = ritten.reduce((s, r) => s + (r.bedrag || 0), 0);
  const monthName = maand.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Car size={18} className="text-y-teal" />
        <h3 className="font-semibold text-slate-800">{t("declaraties.my_km_title", { month: monthName })}</h3>
        {concepten.length > 0 && (
          <button onClick={dienConceptenIn} disabled={busy}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-y-teal text-white rounded-lg text-xs hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <Send size={12} /> {t("declaraties.submit_all", { count: concepten.length })}
          </button>
        )}
      </div>

      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <ModuleNotice show={!loading && doctypeMissing} />

      {loading ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("common.loading")}</p>
      ) : doctypeMissing ? null : !employee ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("y_next.no_employee_link")}</p>
      ) : ritten.length === 0 ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("expenses.no_trips_this_month", { defaultValue: "Geen ritten deze maand" })}</p>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left py-2 pr-2">{t("common.date", { defaultValue: "Datum" })}</th>
                <th className="text-left py-2 pr-2">{t("dashboard.km_from_short")}</th>
                <th className="text-left py-2 pr-2">{t("dashboard.km_to_short")}</th>
                <th className="text-right py-2 pr-2">Km</th>
                <th className="text-right py-2 pr-2">€</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {ritten.map((rit) => (
                <tr key={rit.name} className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">{rit.datum}</td>
                  <td className="py-2 pr-2 text-slate-700 truncate max-w-[160px]" title={rit.van}>{rit.van?.split(",")[0] || "-"}</td>
                  <td className="py-2 pr-2 text-slate-700 truncate max-w-[160px]" title={rit.naar}>{rit.naar?.split(",")[0] || "-"}</td>
                  <td className="py-2 pr-2 text-right font-medium">{formatKm(totaleKilometers(rit))}</td>
                  <td className="py-2 pr-2 text-right text-slate-600">{formatEuro(rit.bedrag || 0)}</td>
                  <td className="py-2 flex items-center gap-1">
                    <StatusBadge status={rit.status} />
                    {rit.status === "Concept" && (
                      <button onClick={() => verwijder(rit)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 cursor-pointer ml-auto"
                        title={t("common.delete_tooltip")}>&#128465;</button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td colSpan={3} className="py-2 text-slate-700">{t("declaraties.total_trips", { count: ritten.length })}</td>
                <td className="py-2 text-right text-slate-800">{formatKm(totaalKm)}</td>
                <td className="py-2 text-right text-slate-800">{formatEuro(totaalBedrag)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── Onkosten boeken ────────────────────────── */

/**
 * Een onkostenpost invoeren. Het bonnetje is een gewone ERPNext-bijlage: het
 * document wordt eerst aangemaakt en het bestand daarna aan die naam gehangen
 * (`upload_file` heeft een bestaande docname nodig). Mislukt alléén de upload,
 * dan blijft de post staan met een waarschuwing — beter dan de hele boeking
 * weggooien omdat een foto niet doorkwam.
 */
function OnkostenBoeken() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const projects = useProjects();
  const sessionEmployee = useSessionEmployeeId(allEmployees);

  const [employee, setEmployee] = useState("");
  const [datum, setDatum] = useState(() => formatErpDate(new Date()));
  const [soort, setSoort] = useState("");
  const [soorten, setSoorten] = useState<string[]>([]);
  const [bedrag, setBedrag] = useState("");
  const [btw, setBtw] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [project, setProject] = useState("");
  const [leverancier, setLeverancier] = useState("");
  const [bon, setBon] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [doctypeMissing, setDoctypeMissing] = useState(false);

  useEffect(() => { if (!employee && sessionEmployee) setEmployee(sessionEmployee); }, [employee, sessionEmployee]);

  useEffect(() => {
    let cancelled = false;
    fetchOnkostensoorten()
      .then((rows) => { if (!cancelled) { setSoorten(rows); setSoort((prev) => prev || rows[0] || ""); } })
      .catch(() => { if (!cancelled) setSoorten([]); })
      .finally(() => { if (!cancelled) setDoctypeMissing(isDoctypeMissing(ONKOSTEN_DOCTYPE)); });
    return () => { cancelled = true; };
  }, []);

  const activeEmployees = useMemo(() => allEmployees.filter((e) => e.status === "Active"), [allEmployees]);
  const openProjects = useMemo(() => projects.filter((p) => p.status !== "Cancelled"), [projects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || !soort || !bedrag) return;
    setSubmitting(true);
    setError("");
    setWarning("");
    setSuccess("");
    try {
      const doc = await createOnkosten({
        employee,
        datum,
        soort,
        bedrag: parseFloat(bedrag),
        btwBedrag: btw ? parseFloat(btw) : undefined,
        omschrijving: omschrijving || undefined,
        project: project || undefined,
        leverancier: leverancier || undefined,
      });
      if (bon) {
        try {
          // Privé, want een bon is bedrijfsadministratie: een publieke
          // File-URL is voor iedereen met de link leesbaar.
          await uploadFile(bon, ONKOSTEN_DOCTYPE, doc.name, true);
        } catch {
          setWarning(t("declaraties.receipt_upload_failed", { name: doc.name }));
        }
      }
      setSuccess(t("declaraties.expense_booked", { name: doc.name, amount: formatEuro(parseFloat(bedrag)) }));
      setBedrag("");
      setBtw("");
      setOmschrijving("");
      setLeverancier("");
      setBon(null);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError(t("declaraties.create_forbidden"));
      else setError(err instanceof Error ? err.message : t("common.unknown_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={18} className="text-y-teal" />
        <h3 className="font-semibold text-slate-800">{t("declaraties.book_expense")}</h3>
      </div>

      <ModuleNotice show={doctypeMissing} />
      {success && <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
      {warning && <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">{warning}</div>}
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.employee_required")}</label>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("common.select")}</option>
              {activeEmployees.map((emp) => <option key={emp.name} value={emp.name}>{emp.employee_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.date_required")}</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.kind_required")}</label>
            <select value={soort} onChange={(e) => setSoort(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              {soorten.length === 0 && <option value="">{t("common.select")}</option>}
              {soorten.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.amount_required")}</label>
            <input type="number" step="0.01" min="0" value={bedrag} onChange={(e) => setBedrag(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.vat_optional")}</label>
            <input type="number" step="0.01" min="0" value={btw} onChange={(e) => setBtw(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.supplier_optional")}</label>
            <input type="text" value={leverancier} onChange={(e) => setLeverancier(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.project_optional")}</label>
            <select value={project} onChange={(e) => setProject(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("common.select")}</option>
              {openProjects.map((p) => <option key={p.name} value={p.name}>{p.project_name || p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.description_optional")}</label>
          <textarea value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} rows={2}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.receipt_optional")}</label>
            <input type="file" accept="image/*,application/pdf"
              onChange={(e) => setBon(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700 cursor-pointer" />
          </div>
          <button type="submit" disabled={submitting || doctypeMissing || !employee || !soort || !bedrag}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 text-sm font-medium cursor-pointer">
            <Send size={14} /> {submitting ? "..." : t("declaraties.book")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ────────────────────── Onkosten: eigen overzicht ────────────────────── */

function MijnOnkosten() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const employee = useSessionEmployeeId(allEmployees);
  const describeError = useDeclaratieError();

  const [posten, setPosten] = useState<Onkostenpost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doctypeMissing, setDoctypeMissing] = useState(false);
  const [maand] = useState(() => new Date());
  const range = useMemo(() => monthRange(maand), [maand]);

  const load = useCallback(async () => {
    if (!employee) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      setPosten(await fetchOnkosten({ employee, vanaf: range.from, tot: range.to }));
    } catch (err) {
      setError(describeError(err, "common.unknown_error"));
    } finally {
      setLoading(false);
      setDoctypeMissing(isDoctypeMissing(ONKOSTEN_DOCTYPE));
    }
  }, [employee, range.from, range.to, describeError]);

  useEffect(() => { load(); }, [load]);

  const concepten = useMemo(() => posten.filter((p) => p.status === "Concept"), [posten]);

  async function dienConceptenIn() {
    setBusy(true);
    setError(null);
    try {
      for (const post of concepten) await dienIn(ONKOSTEN_DOCTYPE, post.name);
      await load();
    } catch (err) {
      setError(describeError(err, "declaraties.submit_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder(post: Onkostenpost) {
    setError(null);
    try {
      await deleteDocument(ONKOSTEN_DOCTYPE, post.name);
      setPosten((prev) => prev.filter((p) => p.name !== post.name));
    } catch (err) {
      setError(describeError(err, "common.delete_failed"));
    }
  }

  const totaal = posten.reduce((s, p) => s + (p.bedrag || 0), 0);
  const monthName = maand.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={18} className="text-y-teal" />
        <h3 className="font-semibold text-slate-800">{t("declaraties.my_expenses_title", { month: monthName })}</h3>
        {concepten.length > 0 && (
          <button onClick={dienConceptenIn} disabled={busy}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-y-teal text-white rounded-lg text-xs hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
            <Send size={12} /> {t("declaraties.submit_all", { count: concepten.length })}
          </button>
        )}
      </div>

      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <ModuleNotice show={!loading && doctypeMissing} />

      {loading ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("common.loading")}</p>
      ) : doctypeMissing ? null : !employee ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("y_next.no_employee_link")}</p>
      ) : posten.length === 0 ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("declaraties.no_expenses_this_month")}</p>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left py-2 pr-2">{t("common.date", { defaultValue: "Datum" })}</th>
                <th className="text-left py-2 pr-2">{t("declaraties.kind")}</th>
                <th className="text-left py-2 pr-2">{t("declaraties.description")}</th>
                <th className="text-right py-2 pr-2">€</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {posten.map((post) => (
                <tr key={post.name} className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">{post.datum}</td>
                  <td className="py-2 pr-2 text-slate-700">{post.soort}</td>
                  <td className="py-2 pr-2 text-slate-600 truncate max-w-[200px]" title={post.omschrijving}>{post.omschrijving || "-"}</td>
                  <td className="py-2 pr-2 text-right font-medium">{formatEuro(post.bedrag || 0)}</td>
                  <td className="py-2 flex items-center gap-1">
                    <StatusBadge status={post.status} />
                    {post.status === "Concept" && (
                      <button onClick={() => verwijder(post)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 cursor-pointer ml-auto"
                        title={t("common.delete_tooltip")}>&#128465;</button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td colSpan={3} className="py-2 text-slate-700">{t("declaraties.total_expenses", { count: posten.length })}</td>
                <td className="py-2 text-right text-slate-800">{formatEuro(totaal)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Overzicht ─────────────────────────── */

interface TabelRij {
  name: string;
  datum: string;
  employee: string;
  omschrijving: string;
  extra: string;
  bedrag: number;
  status: DeclaratieStatus;
  goedgekeurdDoor?: string;
}

/**
 * Alles wat deze gebruiker mag zien, gefilterd op periode/status/medewerker.
 * Voor een medewerker levert dit dankzij `if_owner` automatisch alleen zijn
 * eigen declaraties op — er is dus geen aparte werkgeversvariant nodig.
 */
function DeclaratieOverzicht() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const describeError = useDeclaratieError();

  const [vanaf, setVanaf] = useState(() => formatErpDate(new Date(new Date().getFullYear(), 0, 1)));
  const [tot, setTot] = useState(() => formatErpDate(new Date()));
  const [status, setStatus] = useState<DeclaratieStatus | "">("");
  const [employee, setEmployee] = useState("");
  const [zoek, setZoek] = useState("");

  const [ritten, setRitten] = useState<KmRegistratie[]>([]);
  const [posten, setPosten] = useState<Onkostenpost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doctypeMissing, setDoctypeMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filter = { vanaf, tot, status: status || undefined, employee: employee || undefined };
    try {
      const [km, on] = await Promise.all([fetchKmRegistraties(filter), fetchOnkosten(filter)]);
      setRitten(km);
      setPosten(on);
    } catch (err) {
      setError(describeError(err, "common.unknown_error"));
    } finally {
      setLoading(false);
      setDoctypeMissing(isDoctypeMissing(KM_DOCTYPE) && isDoctypeMissing(ONKOSTEN_DOCTYPE));
    }
  }, [vanaf, tot, status, employee, describeError]);

  useEffect(() => { load(); }, [load]);

  const naamVan = useCallback(
    (id: string) => allEmployees.find((e) => e.name === id)?.employee_name || id,
    [allEmployees],
  );

  const q = zoek.trim().toLowerCase();
  const zichtbareRitten = useMemo(
    () => (!q ? ritten : ritten.filter((r) => `${r.name} ${naamVan(r.employee)} ${r.van} ${r.naar}`.toLowerCase().includes(q))),
    [ritten, q, naamVan],
  );
  const zichtbarePosten = useMemo(
    () => (!q ? posten : posten.filter((p) => `${p.name} ${naamVan(p.employee)} ${p.soort} ${p.omschrijving}`.toLowerCase().includes(q))),
    [posten, q, naamVan],
  );

  const totaalKm = zichtbareRitten.reduce((s, r) => s + totaleKilometers(r), 0);
  const totaalKmBedrag = zichtbareRitten.reduce((s, r) => s + (r.bedrag || 0), 0);
  const totaalOnkosten = zichtbarePosten.reduce((s, p) => s + (p.bedrag || 0), 0);
  const openCount = [...zichtbareRitten, ...zichtbarePosten].filter((d) => d.status === "Ingediend").length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <input type="date" value={vanaf} onChange={(e) => setVanaf(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
        <input type="date" value={tot} onChange={(e) => setTot(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value as DeclaratieStatus | "")}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
          <option value="">{t("common.all_statuses")}</option>
          {DECLARATIE_STATUSSEN.map((s) => (
            <option key={s} value={s}>{t(`declaraties.status_${s.toLowerCase()}`, { defaultValue: s })}</option>
          ))}
        </select>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
          <option value="">{t("declaraties.all_employees")}</option>
          {allEmployees.map((e) => <option key={e.name} value={e.name}>{e.employee_name}</option>)}
        </select>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer text-sm">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
      <ModuleNotice show={!loading && doctypeMissing} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Car} tint="teal" label={t("onkosten.total_km")} value={loading ? "..." : formatKm(totaalKm)} />
        <KpiCard icon={Euro} tint="teal" label={t("declaraties.km_amount")} value={loading ? "..." : formatEuro(totaalKmBedrag)} />
        <KpiCard icon={Receipt} tint="purple" label={t("declaraties.expenses_amount")} value={loading ? "..." : formatEuro(totaalOnkosten)} />
        <KpiCard icon={Clock} tint="orange" label={t("declaraties.open_count")} value={loading ? "..." : String(openCount)} />
      </div>

      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder={t("onkosten.search_placeholder")} value={zoek} onChange={(e) => setZoek(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm" />
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">{t("common.loading")}</div>
      ) : (
        <div className="space-y-6">
          <DeclaratieTabel
            title={t("declaraties.tab_km")}
            leeg={t("declaraties.no_km_found")}
            rows={zichtbareRitten.map((r) => ({
              name: r.name,
              datum: r.datum,
              employee: naamVan(r.employee),
              omschrijving: `${r.van?.split(",")[0] || "?"} → ${r.naar?.split(",")[0] || "?"}${r.retour ? " (retour)" : ""}`,
              extra: formatKm(totaleKilometers(r)),
              bedrag: r.bedrag || 0,
              status: r.status,
              goedgekeurdDoor: r.goedgekeurd_door,
            }))}
          />
          <DeclaratieTabel
            title={t("declaraties.tab_expenses")}
            leeg={t("declaraties.no_expenses_found")}
            rows={zichtbarePosten.map((p) => ({
              name: p.name,
              datum: p.datum,
              employee: naamVan(p.employee),
              omschrijving: p.omschrijving || "-",
              extra: p.soort,
              bedrag: p.bedrag || 0,
              status: p.status,
              goedgekeurdDoor: p.goedgekeurd_door,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, tint, label, value }: { icon: typeof Car; tint: "teal" | "orange" | "purple"; label: string; value: string }) {
  const tints = {
    teal: "bg-y-teal/10 text-y-teal",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  } as const;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-1">
        <div className={`p-2 rounded-lg ${tints[tint]}`}><Icon size={20} /></div>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function DeclaratieTabel({ title, leeg, rows }: { title: string; leeg: string; rows: TabelRij[] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="text-sm text-slate-500">{formatEuro(rows.reduce((s, r) => s + r.bedrag, 0))}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">{leeg}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-left px-4 py-2 font-medium">{t("common.date", { defaultValue: "Datum" })}</th>
              <th className="text-left px-2 py-2 font-medium">{t("common.employee", { defaultValue: "Medewerker" })}</th>
              <th className="text-left px-2 py-2 font-medium">{t("declaraties.description")}</th>
              <th className="text-left px-2 py-2 font-medium"></th>
              <th className="text-right px-2 py-2 font-medium">€</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.datum}</td>
                <td className="px-2 py-2 text-slate-700">{row.employee}</td>
                <td className="px-2 py-2 text-slate-600">{row.omschrijving}</td>
                <td className="px-2 py-2 text-slate-500">{row.extra}</td>
                <td className="px-2 py-2 text-right font-medium">{formatEuro(row.bedrag)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={row.status} />
                  {/* Een "Goedgekeurd" zonder goedkeurstempel kan niet van de
                      werkgever komen: die twee velden staan op permlevel 1. */}
                  {row.status === "Goedgekeurd" && !row.goedgekeurdDoor && (
                    <span className="ml-1 text-[10px] text-amber-700" title={t("declaraties.unstamped_hint")}>⚠</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─────────────────────────── Goedkeuren ─────────────────────────── */

/** De velden van een bijlage die dit scherm gebruikt. */
interface Bijlage { name: string; file_url: string; file_name: string }

interface TeBeoordelen {
  doctype: string;
  name: string;
  datum: string;
  employee: string;
  regel: string;
  bedrag: number;
}

/**
 * Werkgeversweergave: alles met status "Ingediend", per stuk, per medewerker
 * of in bulk goed te keuren. Bevat ook het kilometertarief — de enige
 * instelling die bij dit scherm hoort.
 */
function GoedkeurenView() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const describeError = useDeclaratieError();

  const [ritten, setRitten] = useState<KmRegistratie[]>([]);
  const [posten, setPosten] = useState<Onkostenpost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [gebruiker, setGebruiker] = useState<string | null>(null);
  const [bijlagen, setBijlagen] = useState<Map<string, Bijlage[]>>(new Map());

  useEffect(() => { resolveSessionUser().then(setGebruiker).catch(() => setGebruiker(null)); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [km, on] = await Promise.all([
        fetchKmRegistraties({ status: "Ingediend" }),
        fetchOnkosten({ status: "Ingediend" }),
      ]);
      setRitten(km);
      setPosten(on);
      setGeselecteerd(new Set());
      // Bonnen zijn gewone bijlagen; ze per post ophalen houdt de lijstquery
      // licht en is begrensd door het aantal ingediende posten.
      const paren = await Promise.all(on.map(async (p): Promise<[string, Bijlage[]]> => {
        try { return [p.name, await fetchAttachments(ONKOSTEN_DOCTYPE, p.name)]; }
        catch { return [p.name, []]; }
      }));
      setBijlagen(new Map(paren));
    } catch (err) {
      setError(describeError(err, "common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }, [describeError]);

  useEffect(() => { load(); }, [load]);

  const naamVan = useCallback(
    (id: string) => allEmployees.find((e) => e.name === id)?.employee_name || id,
    [allEmployees],
  );

  const items: TeBeoordelen[] = useMemo(() => [
    ...ritten.map((r) => ({
      doctype: KM_DOCTYPE,
      name: r.name,
      datum: r.datum,
      employee: naamVan(r.employee),
      regel: `${r.van?.split(",")[0] || "?"} → ${r.naar?.split(",")[0] || "?"} · ${formatKm(totaleKilometers(r))}`,
      bedrag: r.bedrag || 0,
    })),
    ...posten.map((p) => ({
      doctype: ONKOSTEN_DOCTYPE,
      name: p.name,
      datum: p.datum,
      employee: naamVan(p.employee),
      regel: `${p.soort}${p.omschrijving ? ` · ${p.omschrijving}` : ""}`,
      bedrag: p.bedrag || 0,
    })),
  ].sort((a, b) => (a.employee.localeCompare(b.employee) || a.datum.localeCompare(b.datum))), [ritten, posten, naamVan]);

  const perMedewerker = useMemo(() => {
    const map = new Map<string, TeBeoordelen[]>();
    for (const item of items) {
      if (!map.has(item.employee)) map.set(item.employee, []);
      map.get(item.employee)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  function toggle(key: string) {
    setGeselecteerd((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  /**
   * Beoordeelt één of meer declaraties. Een 403 hier betekent dat deze
   * gebruiker geen schrijfrecht op **permlevel 1** heeft — dus geen System
   * Manager is. Dat is de bedoelde grens, en de melding zegt dat ook.
   */
  async function beoordeelItems(lijst: TeBeoordelen[], status: "Goedgekeurd" | "Afgewezen") {
    if (lijst.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const item of lijst) {
        await beoordeel(item.doctype, item.name, status, gebruiker || "");
      }
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError(t("declaraties.approve_forbidden"));
      else setError(describeError(err, "declaraties.approve_failed"));
    } finally {
      setBusy(false);
    }
  }

  const geselecteerdeItems = items.filter((i) => geselecteerd.has(`${i.doctype}:${i.name}`));

  return (
    <div>
      <KmTariefInstelling />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{t("declaraties.approve_title")}</h3>
          <p className="text-sm text-slate-500">{t("declaraties.approve_subtitle", { count: items.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {geselecteerdeItems.length > 0 && (
            <>
              <button onClick={() => beoordeelItems(geselecteerdeItems, "Goedgekeurd")} disabled={busy}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 cursor-pointer">
                <CheckCircle size={14} /> {t("declaraties.approve_selected", { count: geselecteerdeItems.length })}
              </button>
              <button onClick={() => beoordeelItems(geselecteerdeItems, "Afgewezen")} disabled={busy}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50 cursor-pointer">
                <XCircle size={14} /> {t("declaraties.reject")}
              </button>
            </>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-400 py-12">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">{t("declaraties.nothing_to_approve")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {perMedewerker.map(([naam, rijen]) => (
            <div key={naam} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-y-teal flex items-center justify-center text-white text-xs font-bold">
                    {naam.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-700">{naam}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">{formatEuro(rijen.reduce((s, r) => s + r.bedrag, 0))}</span>
                  <button onClick={() => beoordeelItems(rijen, "Goedgekeurd")} disabled={busy}
                    className="px-3 py-1.5 text-xs text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer">
                    {t("declaraties.approve_all")}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {rijen.map((rij) => {
                  const key = `${rij.doctype}:${rij.name}`;
                  const bonnen = bijlagen.get(rij.name) || [];
                  return (
                    <Fragment key={key}>
                      <div className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50">
                        <input type="checkbox" checked={geselecteerd.has(key)} onChange={() => toggle(key)}
                          className="cursor-pointer" />
                        <span className="text-xs font-mono text-slate-400 w-36 shrink-0 truncate">{rij.name}</span>
                        <span className="text-sm text-slate-500 w-24 shrink-0">{rij.datum}</span>
                        <span className="text-sm text-slate-700 flex-1 truncate">{rij.regel}</span>
                        {bonnen.map((bon) => (
                          <a key={bon.name} href={getFileUrl(bon.file_url)} target="_blank" rel="noopener noreferrer"
                            className="text-slate-400 hover:text-y-teal" title={bon.file_name}>
                            <Paperclip size={14} />
                          </a>
                        ))}
                        <span className="text-sm font-medium text-slate-700 w-24 text-right">{formatEuro(rij.bedrag)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => beoordeelItems([rij], "Goedgekeurd")} disabled={busy}
                            title={t("declaraties.approve")}
                            className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 cursor-pointer">
                            <CheckCircle size={12} />
                          </button>
                          <button onClick={() => beoordeelItems([rij], "Afgewezen")} disabled={busy}
                            title={t("declaraties.reject")}
                            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 cursor-pointer">
                            <XCircle size={12} />
                          </button>
                        </div>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────── Instelling: kilometertarief ────────────────────── */

/**
 * Het kilometertarief. Klein blok bovenaan het werkgeverstabblad, want dat is
 * de enige plek waar de instelling betekenis heeft. Schrijven kan alleen als
 * System Manager (`Y Next Setting`); lukt dat niet, dan zegt de melding dat —
 * niet "opgeslagen".
 */
function KmTariefInstelling() {
  const { t } = useTranslation();
  const [tarief, setTarief] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "forbidden">("idle");

  useEffect(() => {
    let cancelled = false;
    fetchKmTarief().then((value) => { if (!cancelled) setTarief(String(value)); });
    return () => { cancelled = true; };
  }, []);

  async function opslaan() {
    const value = Number(tarief.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    setStatus("saving");
    const result = await saveKmTarief(value);
    setStatus(result === "saved" ? "saved" : "forbidden");
  }

  return (
    <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.km_rate_label")}</label>
        <input type="number" step="0.01" min="0" value={tarief} onChange={(e) => { setTarief(e.target.value); setStatus("idle"); }}
          className="w-28 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
      </div>
      <button onClick={opslaan} disabled={status === "saving"}
        className="px-3 py-2 bg-y-teal text-white rounded-lg text-sm hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
        {t("common.save", { defaultValue: "Opslaan" })}
      </button>
      <p className="text-xs text-slate-500 flex-1 min-w-[16rem]">
        {t("declaraties.km_rate_hint", { amount: String(DEFAULT_KM_TARIEF) })}
      </p>
      {status === "saved" && <span className="text-xs text-green-600">{t("declaraties.km_rate_saved")}</span>}
      {status === "forbidden" && <span className="text-xs text-red-600">{t("declaraties.km_rate_forbidden")}</span>}
    </div>
  );
}
