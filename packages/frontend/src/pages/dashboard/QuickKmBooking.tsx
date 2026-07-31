import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n/index";
import { Send, Save, ChevronDown, Car } from "lucide-react";
import { fetchList, fetchDocument, createDocument, updateDocument, getErpNextLinkUrl, ApiError } from "../../lib/erpnext";
import type { TravelTypeConfig } from "../../lib/travelType";
import { fetchTravelTypeConfig } from "../../lib/travelType";
import { useEmployees } from "../../lib/DataContext";
import { getActiveInstance, getActiveCompany, getActiveEmployee } from "../../lib/instances";
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

export function QuickKmBooking({ hideRecentTrips = false, onHeaderClick }: { hideRecentTrips?: boolean; onHeaderClick?: () => void } = {}) {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
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
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [departure, setDeparture] = useState("");
  // No hardcoded default destination — it varied per employer/customer and a
  // fixed company address ("Wattstraat 17...") doesn't apply to every Y-app
  // tenant. Prefilled per-employee from their last booking instead (see the
  // destinationAutoFilled effect below); the user can still type/pick any
  // saved address.
  const [destination, setDestination] = useState("");
  const [km, setKm] = useState(() => localStorage.getItem(`pref_${instanceId}_default_km`) || "");
  const [travelType, setTravelType] = useState(() => localStorage.getItem(`pref_${instanceId}_km_travel_type`) || "");
  const [travelTypeConfig, setTravelTypeConfig] = useState<TravelTypeConfig>({ kind: "none", options: [] });
  const [journeyType, setJourneyType] = useState<"One way" | "Return">("Return");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [currentTR, setCurrentTR] = useState<{ name: string; custom_total_distance: number } | null>(null);
  const [recentItinerary, setRecentItinerary] = useState<{ travel_from: string; travel_to: string; custom_distance: number; departure_date: string; custom_journey_type: string; parent: string }[]>([]);
  const [, setLoadingRecent] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => loadSavedAddresses());
  const [showRecent, setShowRecent] = useState(false);
  const [editingTripIdx, setEditingTripIdx] = useState<number | null>(null);
  const [editTrip, setEditTrip] = useState<{ travel_from: string; travel_to: string; custom_distance: number; departure_date: string; custom_journey_type: string }>({ travel_from: "", travel_to: "", custom_distance: 0, departure_date: "", custom_journey_type: "Return" });
  const [savingTrip, setSavingTrip] = useState(false);

  const activeEmployees = useMemo(
    () => allEmployees.filter((e) => e.status === "Active"),
    [allEmployees]
  );

  function handleSaveAddress(address: string) {
    const keyword = prompt(t("dashboard.address_save_prompt"), "");
    if (!keyword?.trim()) return;
    const updated = [...savedAddresses.filter(a => a.address !== address), { keyword: keyword.trim(), address }];
    setSavedAddresses(updated);
    saveSavedAddresses(updated);
  }

  function startTripEdit(idx: number) {
    const it = recentItinerary[idx];
    setEditingTripIdx(idx);
    setEditTrip({ travel_from: it.travel_from, travel_to: it.travel_to, custom_distance: it.custom_distance, departure_date: it.departure_date?.split(" ")[0] || "", custom_journey_type: it.custom_journey_type });
  }

  async function saveTripEdit() {
    if (editingTripIdx === null || !currentTR) return;
    setSavingTrip(true);
    try {
      const doc = await fetchDocument<{ itinerary: any[] }>("Travel Request", currentTR.name);
      const allItems = doc.itinerary || [];
      // recentItinerary is sorted desc, find the matching item by original index
      const targetItem = recentItinerary[editingTripIdx];
      const updatedItems = allItems.map((item: any) => {
        if (item.departure_date === targetItem.departure_date && item.travel_from === targetItem.travel_from) {
          return { ...item, ...editTrip, departure_date: editTrip.departure_date };
        }
        return item;
      });
      const newTotal = updatedItems.reduce((s: number, it: any) => s + (it.custom_distance || 0), 0);
      await updateDocument("Travel Request", currentTR.name, { itinerary: updatedItems, custom_total_distance: newTotal });
      // Refresh
      setRecentItinerary(prev => prev.map((it, i) => i === editingTripIdx ? { ...it, ...editTrip } : it));
      setCurrentTR(prev => prev ? { ...prev, custom_total_distance: newTotal } : prev);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.save_failed"));
    }
    setSavingTrip(false);
    setEditingTripIdx(null);
  }

  async function deleteTripRow(idx: number) {
    if (!currentTR) return;
    try {
      const doc = await fetchDocument<{ itinerary: any[] }>("Travel Request", currentTR.name);
      const targetItem = recentItinerary[idx];
      const updatedItems = (doc.itinerary || []).filter((item: any) =>
        !(item.departure_date === targetItem.departure_date && item.travel_from === targetItem.travel_from)
      );
      const newTotal = updatedItems.reduce((s: number, it: any) => s + (it.custom_distance || 0), 0);
      await updateDocument("Travel Request", currentTR.name, { itinerary: updatedItems, custom_total_distance: newTotal });
      setRecentItinerary(prev => prev.filter((_, i) => i !== idx));
      setCurrentTR(prev => prev ? { ...prev, custom_total_distance: newTotal } : prev);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.delete_failed"));
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

  // Resolve valid "Reistype" (custom_travel_type) options for this ERPNext
  // instance — see lib/travelType.ts for why this can't be hardcoded.
  useEffect(() => {
    let cancelled = false;
    fetchTravelTypeConfig().then((cfg) => {
      if (cancelled) return;
      setTravelTypeConfig(cfg);
      // Default to the first valid option so the field isn't blank for
      // users who never had to think about it before, but never invent a
      // value the field doesn't actually offer.
      setTravelType((prev) => (prev && cfg.options.includes(prev)) ? prev : (cfg.options[0] || ""));
    });
    return () => { cancelled = true; };
  }, [instanceId]);

  // Load recent travel itinerary entries for this employee
  useEffect(() => {
    if (!employee) { setRecentItinerary([]); setCurrentTR(null); return; }
    setLoadingRecent(true);
    fetchList<{ name: string; custom_total_distance: number }>(
      "Travel Request",
      {
        fields: ["name", "custom_total_distance"],
        filters: [["employee", "=", employee]],
        limit_page_length: 1,
        order_by: "custom_from_date desc",
      }
    )
      .then(async (reqs) => {
        if (reqs.length === 0) { setRecentItinerary([]); setCurrentTR(null); return; }
        setCurrentTR(reqs[0]);
        try {
          const doc = await fetchDocument<{ itinerary: { travel_from: string; travel_to: string; custom_distance: number; departure_date: string; custom_journey_type: string; parent: string }[] }>(
            "Travel Request", reqs[0].name
          );
          const items = (doc.itinerary || []).sort((a, b) =>
            (b.departure_date || "").localeCompare(a.departure_date || "")
          ).slice(0, 5);
          setRecentItinerary(items);
        } catch {
          setRecentItinerary([]);
        }
      })
      .catch(() => { setRecentItinerary([]); setCurrentTR(null); })
      .finally(() => setLoadingRecent(false));
  }, [employee, success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || !km || !departure || !destination) return;
    setSubmitting(true);
    setFormError("");
    setSuccess("");
    try {
      const company = getActiveCompany() || undefined;
      const dateObj = new Date(date + "T12:00:00");
      const monthStart = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-01`;
      const monthEnd = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
      const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;

      // Find existing Draft Travel Request for this employee + month
      const existing = await fetchList<{ name: string }>(
        "Travel Request",
        {
          fields: ["name"],
          filters: [
            ["employee", "=", employee],
            ["docstatus", "=", 0],
            ["custom_from_date", "=", monthStart],
          ],
          limit_page_length: 1,
        }
      );

      const distance = parseFloat(km);
      const itineraryRow = {
        travel_from: departure,
        travel_to: destination,
        custom_distance: distance,
        custom_journey_type: journeyType,
        departure_date: date,
        // "Business" was previously hardcoded here and ERPNext instances
        // whose custom_travel_type field doesn't offer that exact option
        // (or renamed/removed it) rejected every booking with a "not a
        // valid option" error the user couldn't work around. Only send a
        // value the instance actually offers (resolved via
        // fetchTravelTypeConfig); omit the field entirely otherwise so
        // ERPNext applies its own default/validation instead of us guessing.
        ...(travelType ? { custom_travel_type: travelType } : {}),
      };

      if (existing.length > 0) {
        // Add itinerary row to existing Travel Request
        const doc = await fetchDocument<{ itinerary: unknown[]; custom_total_distance: number }>(
          "Travel Request", existing[0].name
        );
        const updatedItinerary = [...(doc.itinerary || []), itineraryRow];
        const totalDist = (doc.custom_total_distance || 0) + distance;
        await updateDocument("Travel Request", existing[0].name, {
          itinerary: updatedItinerary,
          custom_total_distance: totalDist,
        });
        setSuccess(`Rit toegevoegd aan ${existing[0].name} (${totalDist.toFixed(1)} km totaal)`);
      } else {
        // Create new Travel Request for this month
        const doc = await createDocument<{ name: string }>("Travel Request", {
          employee,
          company,
          travel_type: "Domestic",
          custom_from_date: monthStart,
          custom_to_date: monthEndStr,
          custom_total_distance: distance,
          itinerary: [itineraryRow],
        });
        setSuccess(`Nieuwe km-declaratie: ${doc.name}`);
      }
      // Remember defaults for next time
      if (km) localStorage.setItem(`pref_${instanceId}_default_km`, km);
      if (destination) localStorage.setItem(`pref_${instanceId}_last_destination_${employee}`, destination);
      if (travelType) localStorage.setItem(`pref_${instanceId}_km_travel_type`, travelType);
      setKm("");
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      // A 403 here means there is no monthly Travel Request yet AND this
      // ERPNext account isn't allowed to create one (create on Travel Request
      // requires HR User / System Manager; a regular employee can only add
      // rows to an existing month doc). Show a clear message instead of the
      // raw "ERPNext API error: 403" — nothing was created.
      if (err instanceof ApiError && err.status === 403) {
        setFormError(t("dashboard.km_create_forbidden"));
      } else {
        setFormError(err instanceof Error ? err.message : "Onbekende fout");
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
        {currentTR && (
          <a
            href={`${getErpNextLinkUrl()}/travel-request/${currentTR.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-y-teal hover:underline"
          >
            {currentTR.name} ({(currentTR.custom_total_distance || 0).toFixed(0)} km)
          </a>
        )}
      </div>

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

        <div className={`grid grid-cols-2 gap-3 ${travelTypeConfig.kind !== "none" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("dashboard.km_distance_required")}</label>
            <input type="number" step="0.1" min="0" value={km} onChange={(e) => setKm(e.target.value)} required
              placeholder={t("dashboard.km_distance_placeholder")}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.type", { defaultValue: "Type" })}</label>
            <select value={journeyType} onChange={(e) => setJourneyType(e.target.value as "One way" | "Return")}
              className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
              <option value="Return">{t("dashboard.km_return")}</option>
              <option value="One way">{t("dashboard.km_single")}</option>
            </select>
            {journeyType === "Return" && (
              <p className="text-[10px] text-slate-400 mt-1">{t("dashboard.km_return_hint")}</p>
            )}
          </div>
          {/* Only shown when the "custom_travel_type" field could actually be
              resolved on this ERPNext instance (see lib/travelType.ts) — a
              hardcoded value here used to get silently rejected by ERPNext
              instances with different/no valid options. */}
          {travelTypeConfig.kind !== "none" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("dashboard.km_travel_type")}</label>
              <select value={travelType} onChange={(e) => setTravelType(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal">
                <option value="">{t("dashboard.km_travel_type_select")}</option>
                {travelTypeConfig.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2 sm:col-span-1 flex items-end">
            <button type="submit" disabled={submitting || !employee || !km || !departure || !destination}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 text-sm font-medium cursor-pointer">
              <Send size={14} />
              {submitting ? "..." : t("dashboard.km_submit")}
            </button>
          </div>
        </div>
      </form>

      {/* Recent itinerary — default last 3, expandable to all */}
      {!hideRecentTrips && employee && recentItinerary.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <button onClick={() => setShowRecent(!showRecent)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer w-full mb-2">
            <ChevronDown size={12} className={`transition-transform ${showRecent ? "" : "-rotate-90"}`} />
            {showRecent ? `Alle ${recentItinerary.length} ritten` : `Laatste ${Math.min(recentItinerary.length, 3)} ritten`}
            {currentTR && <span className="ml-auto text-[10px] text-slate-400">{(currentTR.custom_total_distance || 0).toFixed(0)} km deze maand</span>}
          </button>
          <div className="space-y-1">
            {(showRecent ? recentItinerary : recentItinerary.slice(0, 3)).map((it, i) => (
              editingTripIdx === i ? (
                <div key={i} className="bg-y-teal/5 rounded-lg px-3 py-2 border border-y-teal/20 space-y-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                    <input type="date" value={editTrip.departure_date} onChange={e => setEditTrip({ ...editTrip, departure_date: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" />
                    <input type="text" value={editTrip.travel_from} onChange={e => setEditTrip({ ...editTrip, travel_from: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" placeholder={t("dashboard.km_from_short", { defaultValue: "From" })} />
                    <input type="text" value={editTrip.travel_to} onChange={e => setEditTrip({ ...editTrip, travel_to: e.target.value })}
                      className="px-1 py-0.5 border border-slate-200 rounded text-xs" placeholder={t("dashboard.km_to_short", { defaultValue: "To" })} />
                    <div className="flex gap-1">
                      <input type="number" step="0.1" value={editTrip.custom_distance} onChange={e => setEditTrip({ ...editTrip, custom_distance: parseFloat(e.target.value) || 0 })}
                        className="w-14 px-1 py-0.5 border border-slate-200 rounded text-xs text-right" />
                      <select value={editTrip.custom_journey_type} onChange={e => setEditTrip({ ...editTrip, custom_journey_type: e.target.value })}
                        className="px-1 py-0.5 border border-slate-200 rounded text-xs">
                        <option value="Return">{t("dashboard.km_return_short", { defaultValue: "return" })}</option>
                        <option value="One way">{t("dashboard.km_single_short", { defaultValue: "single" })}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-end">
                    <button onClick={saveTripEdit} disabled={savingTrip} className="px-2 py-0.5 bg-y-teal text-white rounded text-xs cursor-pointer disabled:opacity-50">&#10003;</button>
                    <button onClick={() => setEditingTripIdx(null)} className="px-2 py-0.5 text-slate-400 text-xs cursor-pointer">&#10005;</button>
                    <button onClick={() => { deleteTripRow(i); setEditingTripIdx(null); }} className="px-2 py-0.5 text-red-400 hover:text-red-600 text-xs cursor-pointer">&#128465;</button>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center bg-slate-50 rounded-lg px-3 py-2 hover:bg-slate-100 group">
                  <button type="button"
                    onClick={() => { setDeparture(it.travel_from); setDestination(it.travel_to); setKm(String(it.custom_distance || "")); setJourneyType(it.custom_journey_type === "Return" ? "Return" : "One way"); }}
                    className="flex-1 text-left cursor-pointer min-w-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-400 shrink-0">
                          {it.departure_date ? new Date(it.departure_date).toLocaleDateString(localeFromI18n(), { day: "numeric", month: "short" }) : ""}
                        </span>
                        <span className="text-xs text-slate-700 truncate">
                          {it.travel_from?.split(",")[0] || "?"} &rarr; {it.travel_to?.split(",")[0] || "?"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400">{it.custom_journey_type === "Return" ? t("dashboard.km_return_short", { defaultValue: "return" }) : t("dashboard.km_single_short", { defaultValue: "single" })}</span>
                        <span className="text-xs font-bold text-slate-700">
                          {(it.custom_distance || 0).toLocaleString(localeFromI18n(), { maximumFractionDigits: 1 })} km
                        </span>
                      </div>
                    </div>
                  </button>
                  <button type="button" onClick={() => startTripEdit(i)}
                    className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-slate-400 hover:text-y-teal cursor-pointer shrink-0" title={t("common.edit")}>
                    &#9998;
                  </button>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
