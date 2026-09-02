import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n/index";
import { Send, Save, ChevronDown, Car, AlertTriangle } from "lucide-react";
import { fetchDocument, updateDocument, deleteDocument, isDoctypeMissing, ApiError } from "../../lib/erpnext";
import {
  KM_DOCTYPE,
  computeKmBedrag,
  createKmRegistratie,
  fetchKmRegistraties,
  formatErpDate,
  totaleKilometers,
  type KmRegistratie,
} from "../../lib/declaraties";
import { fetchKmTarief } from "../../lib/kmTarief";
import { useEmployees, useProjects } from "../../lib/DataContext";
import { getActiveInstance, getActiveEmployee } from "../../lib/instances";
import { useSessionEmployeeId } from "../../lib/useSessionEmployee";
import { BookingWarning, useMissingBookings } from "./useMissingBookings";

/** Map active i18n language → Intl locale tag for toLocaleDateString /
 * toLocaleString. Avoids hardcoded "nl-NL" on user-visible dates + numbers. */
function localeFromI18n(): string {
  const lang = (i18n.language || "nl").split("-")[0];
  if (lang === "en") return "en-GB";
  if (lang === "de") return "de-DE";
  return "nl-NL";
}

export function formatEuro(value: number): string {
  return value.toLocaleString(localeFromI18n(), { style: "currency", currency: "EUR" });
}

const SAVED_ADDRESSES_KEY = "y_app_saved_addresses";

interface SavedAddress { keyword: string; address: string; }

function loadSavedAddresses(): SavedAddress[] {
  try { return JSON.parse(localStorage.getItem(SAVED_ADDRESSES_KEY) || "[]"); } catch { return []; }
}

function saveSavedAddresses(addrs: SavedAddress[]) {
  localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(addrs));
}

function AddressInput({ value, onChange, placeholder, savedAddresses, onSave }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  savedAddresses: SavedAddress[]; onSave: (address: string) => void;
}) {
  const { t } = useTranslation();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const matches = useMemo(() => {
    if (!value.trim()) return savedAddresses;
    const q = value.toLowerCase();
    return savedAddresses.filter(a => a.keyword.toLowerCase().includes(q) || a.address.toLowerCase().includes(q));
  }, [value, savedAddresses]);

  return (
    <div className="relative min-w-0">
      <div className="flex gap-1 min-w-0">
        <input type="text" value={value} onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder} required
          className="flex-1 min-w-0 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
        {value.trim() && !savedAddresses.some(a => a.address === value) && (
          <button type="button" onClick={() => onSave(value)}
            className="px-1.5 text-slate-400 hover:text-y-teal cursor-pointer" title={t("dashboard.address_save_tooltip")}>
            <Save size={14} />
          </button>
        )}
        {savedAddresses.some(a => a.address === value) && (
          <span className="px-1.5 flex items-center text-slate-300" title={t("dashboard.address_saved_tooltip")}>
            <Save size={14} />
          </span>
        )}
      </div>
      {showSuggestions && matches.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
          {matches.map((a, i) => (
            <button key={i} type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(a.address); setShowSuggestions(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
              <span className="font-medium text-slate-700">{a.keyword}</span>
              <span className="text-slate-400 ml-1 text-xs">({a.address})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Statuslabel van een declaratie. Gedeeld met de onkostenpagina, zodat km en
 * onkosten er identiek uitzien.
 */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cls =
    status === "Goedgekeurd" ? "bg-green-100 text-green-700"
      : status === "Ingediend" ? "bg-blue-100 text-blue-700"
        : status === "Afgewezen" ? "bg-red-100 text-red-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full ${cls}`}>
      {t(`declaraties.status_${status.toLowerCase()}`, { defaultValue: status })}
    </span>
  );
}

/**
 * Kilometers boeken.
 *
 * Elke rit is één `Y Km Registratie`-document (zie lib/declaraties.ts). Het
 * kilometertarief komt uit de gedeelde instelling en wordt op het document
 * vastgelegd, zodat een latere tariefwijziging bestaande ritten niet herrekent.
 */
export function QuickKmBooking({ hideRecentTrips = false, onHeaderClick }: { hideRecentTrips?: boolean; onHeaderClick?: () => void } = {}) {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const projects = useProjects();
  const instanceId = getActiveInstance().id;
  const [employee, setEmployee] = useState(() => getActiveEmployee());
  // Val terug op de ERPNext-sessiegebruiker als er geen "standaard
  // medewerker" is ingesteld, zodat het MDW-veld niet permanent op
  // "Selecteer..." blijft staan terwijl de sessie wel naar een
  // Employee-record te herleiden is (zelfde patroon als UrenBoekenWidget).
  const resolvedSessionEmployee = useSessionEmployeeId(allEmployees);
  useEffect(() => {
    if (!employee && resolvedSessionEmployee) setEmployee(resolvedSessionEmployee);
  }, [employee, resolvedSessionEmployee]);
  const [date, setDate] = useState(() => formatErpDate(new Date()));
  const [departure, setDeparture] = useState("");
  // No hardcoded default destination — it varied per employer/customer and a
  // fixed company address doesn't apply to every tenant. Prefilled per-employee
  // from their last booking instead (see the destinationAutoFilled effect
  // below); the user can still type/pick any saved address.
  const [destination, setDestination] = useState("");
  const [km, setKm] = useState(() => localStorage.getItem(`pref_${instanceId}_default_km`) || "");
  const [project, setProject] = useState(() => localStorage.getItem(`pref_${instanceId}_km_project`) || "");
  const [retour, setRetour] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [tarief, setTarief] = useState<number | null>(null);
  const [recentTrips, setRecentTrips] = useState<KmRegistratie[]>([]);
  const [, setLoadingRecent] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => loadSavedAddresses());
  const [showRecent, setShowRecent] = useState(false);
  const [editingTripName, setEditingTripName] = useState<string | null>(null);
  const [editTrip, setEditTrip] = useState<{ van: string; naar: string; kilometers: number; datum: string; retour: boolean }>(
    { van: "", naar: "", kilometers: 0, datum: "", retour: true },
  );
  const [savingTrip, setSavingTrip] = useState(false);
  // Waar zodra een lijstquery heeft bevestigd dat `Y Km Registratie` niet op
  // deze site bestaat — dan is het provisioningscript nog niet gedraaid.
  // Zonder deze check toont het formulier zich als werkend en faalt pas de
  // knop, met een kale 404.
  const [doctypeMissing, setDoctypeMissing] = useState(false);

  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.status === "Active"),
    [allEmployees]
  );

  const openProjects = useMemo(
    () => projects.filter((p) => p.status !== "Cancelled"),
    [projects],
  );

  function handleSaveAddress(address: string) {
    const keyword = prompt(t("dashboard.address_save_prompt"), "");
    if (!keyword?.trim()) return;
    const updated = [...savedAddresses.filter(a => a.address !== address), { keyword: keyword.trim(), address }];
    setSavedAddresses(updated);
    saveSavedAddresses(updated);
  }

  /**
   * Een 403 betekent hier dat deze ERPNext-gebruiker het document niet mag
   * wijzigen — bijna altijd omdat het niet van hemzelf is (`if_owner` op de
   * medewerkersrollen). Structureel en uitlegbaar, dus een eigen tekst.
   */
  function describeError(err: unknown, fallback: string): string {
    if (err instanceof ApiError && err.status === 403) return t("declaraties.not_your_record");
    return err instanceof Error && err.message ? err.message : fallback;
  }

  function startTripEdit(trip: KmRegistratie) {
    setEditingTripName(trip.name);
    setEditTrip({
      van: trip.van || "",
      naar: trip.naar || "",
      kilometers: trip.kilometers || 0,
      datum: (trip.datum || "").slice(0, 10),
      retour: !!trip.retour,
    });
  }

  /**
   * Een rit bewerken is een gewone documentupdate. Het tarief van dát document
   * blijft leidend — een tariefwijziging ná het boeken mag een correctie niet
   * stilzwijgend herrekenen.
   */
  async function saveTripEdit() {
    const original = recentTrips.find((r) => r.name === editingTripName);
    if (!original) return;
    setSavingTrip(true);
    setFormError("");
    try {
      const tariefVoorRit = original.tarief_per_km || tarief || 0;
      const bedrag = computeKmBedrag(editTrip.kilometers, editTrip.retour, tariefVoorRit);
      await updateDocument(KM_DOCTYPE, original.name, {
        datum: editTrip.datum,
        van: editTrip.van,
        naar: editTrip.naar,
        kilometers: editTrip.kilometers,
        retour: editTrip.retour ? 1 : 0,
        bedrag,
      });
      setRecentTrips((prev) => prev.map((r) => (
        r.name === original.name
          ? { ...r, ...editTrip, retour: (editTrip.retour ? 1 : 0) as 0 | 1, bedrag }
          : r
      )));
      setEditingTripName(null);
    } catch (err) {
      setFormError(describeError(err, t("common.save_failed")));
    }
    setSavingTrip(false);
  }

  async function deleteTrip(trip: KmRegistratie) {
    setFormError("");
    try {
      await deleteDocument(KM_DOCTYPE, trip.name);
      setRecentTrips((prev) => prev.filter((r) => r.name !== trip.name));
    } catch (err) {
      setFormError(describeError(err, t("common.delete_failed")));
    }
  }

  // Pre-fill departure from employee address
  const departureAutoFilled = useRef(false);
  useEffect(() => {
    if (!employee) { departureAutoFilled.current = false; return; }
    if (departureAutoFilled.current) return;
    fetchDocument<{ current_address?: string; permanent_address?: string }>("Employee", employee)
      .then((emp) => {
        const addr = (emp.current_address || emp.permanent_address || "").replace(/\n/g, ", ").trim();
        if (addr) { setDeparture(addr); departureAutoFilled.current = true; }
      })
      .catch(() => {});
  }, [employee]);

  // Pre-fill destination from this employee's last-used destination (written
  // on submit below) instead of a hardcoded company address.
  const destinationAutoFilled = useRef(false);
  useEffect(() => {
    if (!employee) { destinationAutoFilled.current = false; return; }
    if (destinationAutoFilled.current) return;
    const last = localStorage.getItem(`pref_${instanceId}_last_destination_${employee}`);
    if (last) setDestination(last);
    destinationAutoFilled.current = true;
  }, [employee, instanceId]);

  // Het gedeelde kilometertarief.
  useEffect(() => {
    let cancelled = false;
    fetchKmTarief().then((value) => { if (!cancelled) setTarief(value); });
    return () => { cancelled = true; };
  }, [instanceId]);

  // De laatste ritten van deze medewerker. `if_owner` beperkt dit server-side
  // al tot eigen documenten voor een gewone medewerker; het employee-filter is
  // er voor de werkgever, die ze allemaal mag zien.
  useEffect(() => {
    if (!employee) { setRecentTrips([]); return; }
    setLoadingRecent(true);
    fetchKmRegistraties({ employee, limit: 10 })
      .then((rows) => setRecentTrips(rows))
      .catch(() => setRecentTrips([]))
      .finally(() => {
        setLoadingRecent(false);
        setDoctypeMissing(isDoctypeMissing(KM_DOCTYPE));
      });
  }, [employee, success]);

  /** Totaal van de ritten in de kalendermaand van vandaag. */
  const maandTotaal = useMemo(() => {
    const nu = new Date();
    const prefix = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
    const dezeMaand = recentTrips.filter((r) => (r.datum || "").startsWith(prefix));
    return {
      km: dezeMaand.reduce((s, r) => s + totaleKilometers(r), 0),
      bedrag: dezeMaand.reduce((s, r) => s + (r.bedrag || 0), 0),
    };
  }, [recentTrips]);

  const voorbeeldBedrag = useMemo(
    () => computeKmBedrag(parseFloat(km) || 0, retour, tarief ?? 0),
    [km, retour, tarief],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || !km || !departure || !destination) return;
    setSubmitting(true);
    setFormError("");
    setSuccess("");
    try {
      const doc = await createKmRegistratie({
        employee,
        datum: date,
        van: departure,
        naar: destination,
        kilometers: parseFloat(km),
        retour,
        project: project || undefined,
        tariefPerKm: tarief ?? undefined,
      });
      setSuccess(t("declaraties.km_booked", {
        name: doc.name,
        amount: formatEuro(computeKmBedrag(parseFloat(km), retour, tarief ?? 0)),
      }));
      // Remember defaults for next time
      if (km) localStorage.setItem(`pref_${instanceId}_default_km`, km);
      if (destination) localStorage.setItem(`pref_${instanceId}_last_destination_${employee}`, destination);
      if (project) localStorage.setItem(`pref_${instanceId}_km_project`, project);
      setKm("");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      // Een 403 betekent hier dat deze ERPNext-gebruiker geen `create` heeft op
      // Y Km Registratie — het provisioningscript kent dat recht toe aan de
      // rollen Employee en Projects User.
      if (err instanceof ApiError && err.status === 403) {
        setFormError(t("declaraties.create_forbidden"));
      } else {
        setFormError(err instanceof Error ? err.message : t("common.unknown_error"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const { missingKm } = useMissingBookings();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5">
      <BookingWarning message={missingKm} />
      <div className="flex items-center gap-2 mb-4">
        <Car size={18} className="text-y-teal" />
        {onHeaderClick ? (
          <button onClick={onHeaderClick} className="font-semibold text-slate-800 hover:text-y-teal cursor-pointer">{t("dashboard.km_booking")} &rarr;</button>
        ) : (
          <h3 className="font-semibold text-slate-800">{t("dashboard.km_booking")}</h3>
        )}
        {maandTotaal.km > 0 && (
          <span className="ml-auto text-xs text-slate-500">
            {t("declaraties.month_total", {
              km: maandTotaal.km.toLocaleString(localeFromI18n(), { maximumFractionDigits: 1 }),
              amount: formatEuro(maandTotaal.bedrag),
            })}
          </span>
        )}
      </div>

      {doctypeMissing && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{t("declaraties.doctypes_missing")}</span>
        </div>
      )}
      {success && <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
      {formError && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{formError}</div>}

      <form onSubmit={handleSubmit} className="space-y-3 min-w-0">
        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div className="min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.employee_required")}</label>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("common.select")}</option>
              {activeEmployees.map((emp) => (
                <option key={emp.name} value={emp.name}>{emp.employee_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.date_required")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
        </div>

        {/* Van ⇄ Naar — stacked on mobile so the address inputs don't
            squeeze to unreadable widths; horizontal from sm: upwards. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("dashboard.km_from_required")}</label>
            <AddressInput value={departure} onChange={setDeparture} placeholder={t("dashboard.km_departure_placeholder")}
              savedAddresses={savedAddresses} onSave={handleSaveAddress} />
          </div>
          <button type="button" onClick={() => { const tmp = departure; setDeparture(destination); setDestination(tmp); }}
            className="self-center sm:self-end px-2 py-2 text-slate-400 hover:text-y-teal cursor-pointer shrink-0" title={t("dashboard.km_swap_locations")}>
            ⇄
          </button>
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("dashboard.km_to_required")}</label>
            <AddressInput value={destination} onChange={setDestination} placeholder={t("dashboard.km_destination_placeholder")}
              savedAddresses={savedAddresses} onSave={handleSaveAddress} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("dashboard.km_distance_required")}</label>
            <input type="number" step="0.1" min="0" value={km} onChange={(e) => setKm(e.target.value)} required
              placeholder={t("dashboard.km_distance_placeholder")}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.type", { defaultValue: "Type" })}</label>
            <select value={retour ? "retour" : "enkel"} onChange={(e) => setRetour(e.target.value === "retour")}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="retour">{t("dashboard.km_return")}</option>
              <option value="enkel">{t("dashboard.km_single")}</option>
            </select>
            {retour && (
              <p className="text-[10px] text-slate-400 mt-1">{t("dashboard.km_return_hint")}</p>
            )}
          </div>
          {/* Het "Reistype"-veld van de oude Travel-Request-opzet is vervangen
              door een projectkoppeling: dat is een echt veld op
              `Y Km Registratie` en bruikbaar voor projectkosten. */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("declaraties.project_optional")}</label>
            <select value={project} onChange={(e) => setProject(e.target.value)}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="">{t("common.select")}</option>
              {openProjects.map((p) => (
                <option key={p.name} value={p.name}>{p.project_name || p.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-end">
            <button type="submit" disabled={submitting || doctypeMissing || !employee || !km || !departure || !destination}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 text-sm font-medium cursor-pointer">
              <Send size={14} />
              {submitting ? "..." : t("dashboard.km_submit")}
            </button>
          </div>
        </div>
        {voorbeeldBedrag > 0 && (
          <p className="text-[11px] text-slate-500">
            {t("declaraties.amount_preview", {
              amount: formatEuro(voorbeeldBedrag),
              rate: formatEuro(tarief ?? 0),
            })}
          </p>
        )}
      </form>

      {/* Recent trips — default last 3, expandable to all */}
      {!hideRecentTrips && employee && recentTrips.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <button onClick={() => setShowRecent(!showRecent)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer w-full mb-2">
            <ChevronDown size={12} className={`transition-transform ${showRecent ? "" : "-rotate-90"}`} />
            {showRecent
              ? t("declaraties.all_trips", { count: recentTrips.length })
              : t("declaraties.last_trips", { count: Math.min(recentTrips.length, 3) })}
          </button>
          <div className="space-y-1">
            {(showRecent ? recentTrips : recentTrips.slice(0, 3)).map((trip) => (
              editingTripName === trip.name ? (
                <div key={trip.name} className="bg-y-teal/5 rounded-lg px-3 py-2 border border-y-teal/20 space-y-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    <input type="date" value={editTrip.datum} onChange={e => setEditTrip({ ...editTrip, datum: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" />
                    <input type="text" value={editTrip.van} onChange={e => setEditTrip({ ...editTrip, van: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" placeholder={t("dashboard.km_from_short", { defaultValue: "From" })} />
                    <input type="text" value={editTrip.naar} onChange={e => setEditTrip({ ...editTrip, naar: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" placeholder={t("dashboard.km_to_short", { defaultValue: "To" })} />
                    <div className="flex gap-1">
                      <input type="number" step="0.1" value={editTrip.kilometers} onChange={e => setEditTrip({ ...editTrip, kilometers: parseFloat(e.target.value) || 0 })}
                        className="w-14 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" />
                      <select value={editTrip.retour ? "retour" : "enkel"} onChange={e => setEditTrip({ ...editTrip, retour: e.target.value === "retour" })}
                        className="px-1 py-0.5 border border-slate-200 rounded text-xs">
                        <option value="retour">{t("dashboard.km_return_short", { defaultValue: "return" })}</option>
                        <option value="enkel">{t("dashboard.km_single_short", { defaultValue: "single" })}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button onClick={saveTripEdit} disabled={savingTrip} className="px-2 py-0.5 bg-y-teal text-white rounded text-xs cursor-pointer disabled:opacity-50">&#10003;</button>
                    <button onClick={() => setEditingTripName(null)} className="px-2 py-0.5 text-slate-400 text-xs cursor-pointer">&#10005;</button>
                    <button onClick={() => { deleteTrip(trip); setEditingTripName(null); }} className="px-2 py-0.5 text-red-400 hover:text-red-600 text-xs cursor-pointer">&#128465;</button>
                  </div>
                </div>
              ) : (
                <div key={trip.name} className="flex items-center bg-slate-50 rounded-lg px-3 py-2 hover:bg-slate-100 group">
                  <button type="button"
                    onClick={() => { setDeparture(trip.van || ""); setDestination(trip.naar || ""); setKm(String(trip.kilometers || "")); setRetour(!!trip.retour); }}
                    className="flex-1 text-left cursor-pointer min-w-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-400 shrink-0">
                          {trip.datum ? new Date(trip.datum + "T12:00:00").toLocaleDateString(localeFromI18n(), { day: "numeric", month: "short" }) : ""}
                        </span>
                        <span className="text-xs text-slate-700 truncate">
                          {trip.van?.split(",")[0] || "?"} &rarr; {trip.naar?.split(",")[0] || "?"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400">{trip.retour ? t("dashboard.km_return_short", { defaultValue: "return" }) : t("dashboard.km_single_short", { defaultValue: "single" })}</span>
                        <span className="text-xs font-bold text-slate-700">
                          {totaleKilometers(trip).toLocaleString(localeFromI18n(), { maximumFractionDigits: 1 })} km
                        </span>
                        <StatusBadge status={trip.status} />
                      </div>
                    </div>
                  </button>
                  {trip.status === "Concept" && (
                    <button type="button" onClick={() => startTripEdit(trip)}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-slate-400 hover:text-y-teal cursor-pointer shrink-0" title={t("common.edit")}>
                      &#9998;
                    </button>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
