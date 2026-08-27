import { Fragment, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchList, fetchAll, fetchDocument, updateDocument, callMethod, getErpNextLinkUrl } from "../lib/erpnext";
import {
  RefreshCw, Filter, Search, ExternalLink,
  Car, Clock, CheckCircle, FileText, Plus, ChevronRight, AlertTriangle,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { QuickKmBooking } from "./dashboard";
import { getActiveCompany } from "../lib/instances";
import { useSessionEmployeeId } from "../lib/useSessionEmployee";
import { useTranslation } from "react-i18next";
import { useEmployees } from "../lib/DataContext";
import { fetchEmployeeShiftWorkdays } from "../lib/missingDays";
import { getEmployeeHolidaySet } from "../lib/employeeHolidays";
import { isHoliday } from "../lib/holidays";

interface TravelRequest {
  name: string;
  employee: string;
  employee_name: string;
  company: string;
  custom_from_date: string;
  custom_to_date: string;
  custom_total_distance: number;
  docstatus: number;
  travel_type: string;
}

type KmDateRangePreset = "vorige_week" | "vorige_4_weken" | "vorige_maand" | "dit_jaar" | "alle_drafts";
const KM_PRESET_LABELS: Record<KmDateRangePreset, string> = {
  vorige_4_weken: "Vorige 4 weken",
  vorige_week: "Vorige week",
  vorige_maand: "Vorige maand",
  dit_jaar: "Dit jaar",
  alle_drafts: "Alle drafts",
};
function getKmDateRange(preset: KmDateRangePreset): { from: string | null; to: string } {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Always cap "to" at the last day of the previous completed month — we
  // never list TRs from a still-running month.
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const to = fmt(prevMonthEnd);
  switch (preset) {
    case "vorige_week": {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - diffToMonday);
      const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "vorige_4_weken": {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - diffToMonday);
      const fourWeeksAgo = new Date(thisMonday); fourWeeksAgo.setDate(thisMonday.getDate() - 28);
      const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
      return { from: fmt(fourWeeksAgo), to: fmt(lastSunday) };
    }
    case "vorige_maand": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmt(first), to: fmt(last) };
    }
    case "dit_jaar": {
      return { from: `${now.getFullYear()}-01-01`, to };
    }
    case "alle_drafts": {
      return { from: null, to };
    }
  }
}

const docstatusColors: Record<number, string> = {
  0: "bg-slate-100 text-slate-600",  // Draft
  1: "bg-green-100 text-green-700",  // Submitted
  2: "bg-red-100 text-red-700",      // Cancelled
};

const docstatusLabel: Record<number, string> = {
  0: "Draft",
  1: "Submitted",
  2: "Cancelled",
};

function MyKmOverzicht() {
  const { t } = useTranslation();
  // Val terug op de ERPNext-sessiegebruiker als er geen "standaard
  // medewerker" is ingesteld — anders toont dit paneel voor iedereen zonder
  // die instelling permanent "Selecteer een medewerker in Instellingen",
  // ook als de sessie prima naar een Employee-record te herleiden is.
  const allEmployees = useEmployees();
  const employee = useSessionEmployeeId(allEmployees);
  const [trName, setTrName] = useState("");
  const [totalKm, setTotalKm] = useState(0);
  const [itinerary, setItinerary] = useState<ItineraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<Partial<ItineraryRow>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!employee) { setLoading(false); return; }
    setLoading(true);
    fetchList<{ name: string; custom_total_distance: number }>(
      "Travel Request",
      {
        fields: ["name", "custom_total_distance"],
        filters: [["employee", "=", employee]],
        limit_page_length: 1,
        order_by: "custom_from_date desc",
      }
    ).then(async (reqs) => {
      if (reqs.length === 0) { setItinerary([]); setLoading(false); return; }
      setTrName(reqs[0].name);
      setTotalKm(reqs[0].custom_total_distance || 0);
      try {
        const doc = await fetchDocument<{ itinerary: ItineraryRow[] }>("Travel Request", reqs[0].name);
        setItinerary((doc.itinerary || []).sort((a, b) => (b.departure_date || "").localeCompare(a.departure_date || "")));
      } catch { setItinerary([]); }
    }).catch(() => setItinerary([]))
      .finally(() => setLoading(false));
  }, [employee]);

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditRow({ ...itinerary[idx] });
  }

  async function saveEdit() {
    if (editingIdx === null || !trName) return;
    setSaving(true);
    try {
      const updated = [...itinerary];
      updated[editingIdx] = { ...updated[editingIdx], ...editRow } as ItineraryRow;
      await updateDocument("Travel Request", trName, { itinerary: updated, custom_total_distance: updated.reduce((s, it) => s + (it.custom_distance || 0), 0) });
      setItinerary(updated);
      setTotalKm(updated.reduce((s, it) => s + (it.custom_distance || 0), 0));
      setEditingIdx(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function deleteRow(idx: number) {
    if (!trName) return;
    const updated = itinerary.filter((_, i) => i !== idx);
    try {
      await updateDocument("Travel Request", trName, { itinerary: updated, custom_total_distance: updated.reduce((s, it) => s + (it.custom_distance || 0), 0) });
      setItinerary(updated);
      setTotalKm(updated.reduce((s, it) => s + (it.custom_distance || 0), 0));
    } catch { /* ignore */ }
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Car size={18} className="text-y-teal" />
        <h3 className="font-semibold text-slate-800">Km overzicht — {monthName}</h3>
        {trName && (
          <a href={`${getErpNextLinkUrl()}/travel-request/${trName}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs text-y-teal hover:underline">
            {trName} ({totalKm.toFixed(0)} km)
          </a>
        )}
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("common.loading")}</p>
      ) : !employee ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("y_next.no_employee_link")}</p>
      ) : itinerary.length === 0 ? (
        <p className="text-center text-slate-400 py-4 text-sm">{t("expenses.no_trips_this_month", { defaultValue: "No trips this month" })}</p>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left py-2 pr-2">{t("common.date", { defaultValue: "Date" })}</th>
                <th className="text-left py-2 pr-2">{t("dashboard.km_from_short")}</th>
                <th className="text-left py-2 pr-2">{t("dashboard.km_to_short")}</th>
                <th className="text-right py-2 pr-2">Km</th>
                <th className="text-left py-2">{t("common.type")}</th>
              </tr>
            </thead>
            <tbody>
              {itinerary.map((it, i) => (
                editingIdx === i ? (
                  <tr key={i} className="border-b border-slate-200 bg-y-teal/5">
                    <td className="py-1 pr-1"><input type="date" value={(editRow.departure_date || "").split(" ")[0]} onChange={e => setEditRow({ ...editRow, departure_date: e.target.value })} className="w-full px-1 py-1 border border-slate-200 rounded text-xs" /></td>
                    <td className="py-1 pr-1"><input type="text" value={editRow.travel_from || ""} onChange={e => setEditRow({ ...editRow, travel_from: e.target.value })} className="w-full px-1 py-1 border border-slate-200 rounded text-xs" /></td>
                    <td className="py-1 pr-1"><input type="text" value={editRow.travel_to || ""} onChange={e => setEditRow({ ...editRow, travel_to: e.target.value })} className="w-full px-1 py-1 border border-slate-200 rounded text-xs" /></td>
                    <td className="py-1 pr-1"><input type="number" step="0.1" value={editRow.custom_distance || ""} onChange={e => setEditRow({ ...editRow, custom_distance: parseFloat(e.target.value) || 0 })} className="w-16 px-1 py-1 border border-slate-200 rounded text-xs text-right" /></td>
                    <td className="py-1 flex items-center gap-1">
                      <select value={editRow.custom_journey_type || "Return"} onChange={e => setEditRow({ ...editRow, custom_journey_type: e.target.value })} className="px-1 py-1 border border-slate-200 rounded text-xs">
                        <option value="Return">{t("dashboard.km_return_short")}</option>
                        <option value="Single">{t("dashboard.km_single_short")}</option>
                      </select>
                      <button onClick={saveEdit} disabled={saving} className="px-1.5 py-1 bg-y-teal text-white rounded text-xs cursor-pointer disabled:opacity-50">&#10003;</button>
                      <button onClick={() => setEditingIdx(null)} className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-xs cursor-pointer">&#10005;</button>
                      <button onClick={() => { deleteRow(i); setEditingIdx(null); }} className="px-1.5 py-1 text-red-400 hover:text-red-600 text-xs cursor-pointer" title={t("common.delete_tooltip")}>&#128465;</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 group">
                    <td className="py-2 pr-2 text-slate-600 whitespace-nowrap">
                      {it.departure_date?.split(" ")[0] || "-"}
                    </td>
                    <td className="py-2 pr-2 text-slate-700 truncate max-w-[160px]" title={it.travel_from}>
                      {it.travel_from?.split(",")[0]?.split("\n")[0] || "-"}
                    </td>
                    <td className="py-2 pr-2 text-slate-700 truncate max-w-[160px]" title={it.travel_to}>
                      {it.travel_to?.split(",")[0]?.split("\n")[0] || "-"}
                    </td>
                    <td className="py-2 pr-2 text-right font-medium">
                      {(it.custom_distance || 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-2 text-slate-500 text-xs flex items-center gap-1">
                      {it.custom_journey_type === "Return" ? t("dashboard.km_return_short") : t("dashboard.km_single_short")}
                      <button onClick={() => startEdit(i)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-y-teal cursor-pointer ml-auto" title={t("common.edit")}>
                        &#9998;
                      </button>
                    </td>
                  </tr>
                )
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td colSpan={3} className="py-2 text-slate-700">Totaal ({itinerary.length} ritten)</td>
                <td className="py-2 text-right text-slate-800">
                  {itinerary.reduce((s, it) => s + (it.custom_distance || 0), 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ItineraryRow {
  travel_from: string;
  travel_to: string;
  custom_distance: number;
  departure_date: string;
  custom_journey_type: string;
  custom_travel_cost: number;
}

export default function Expenses() {
  const { t } = useTranslation();
  const employees = useEmployees();
  const [searchParams, setSearchParams] = useSearchParams();
  type ExpensesTab = "boeken" | "overzicht" | "goedkeuren";
  const validTabs: ExpensesTab[] = ["boeken", "overzicht", "goedkeuren"];
  const tabFromUrl = searchParams.get("tab");
  const initialTab: ExpensesTab = (validTabs.includes(tabFromUrl as ExpensesTab) ? tabFromUrl : "boeken") as ExpensesTab;
  const [activeTab, setActiveTab] = useState<ExpensesTab>(initialTab);
  const viewMode = (localStorage.getItem("view_mode") || "employer");

  // Sync state when URL changes (e.g. user re-clicks the dashboard card).
  useEffect(() => {
    if (validTabs.includes(tabFromUrl as ExpensesTab) && tabFromUrl !== activeTab) {
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

  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState(getActiveCompany());
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // Expanded TR rows + cached itinerary so re-opening doesn't re-fetch.
  const [expandedTr, setExpandedTr] = useState<Set<string>>(new Set());
  const [itineraryByTr, setItineraryByTr] = useState<Map<string, ItineraryRow[]>>(new Map());
  const [loadingTr, setLoadingTr] = useState<string | null>(null);

  // Anomaly-analysis context, shared with KmGoedkeurenView via
  // analyzeTravelRequest(). Built from the loaded TR list.
  const [shiftWorkdaysOv, setShiftWorkdaysOv] = useState<Map<string, Set<string>>>(new Map());
  const [empHolidaysOv, setEmpHolidaysOv] = useState<Map<string, Set<string>>>(new Map());
  const [onLeaveSetOv, setOnLeaveSetOv] = useState<Set<string>>(new Set());

  async function toggleTrExpand(name: string) {
    if (expandedTr.has(name)) {
      setExpandedTr(prev => { const n = new Set(prev); n.delete(name); return n; });
      return;
    }
    setExpandedTr(prev => new Set(prev).add(name));
    if (itineraryByTr.has(name)) return;
    setLoadingTr(name);
    try {
      const doc = await fetchDocument<{ itinerary?: ItineraryRow[] }>("Travel Request", name);
      const rows = (doc.itinerary || []).slice().sort((a, b) =>
        (a.departure_date || "").localeCompare(b.departure_date || ""),
      );
      setItineraryByTr(prev => new Map(prev).set(name, rows));
    } catch {
      setItineraryByTr(prev => new Map(prev).set(name, []));
    } finally {
      setLoadingTr(null);
    }
  }

  // Employee names belonging to the selected company
  const companyEmployeeNames = useMemo(() => {
    if (!company) return null;
    return new Set(employees.filter(e => e.company === company).map(e => e.employee_name));
  }, [employees, company]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [
        ["docstatus", "!=", 2],
      ];
      if (statusFilter === "Draft") filters.push(["docstatus", "=", 0]);
      if (statusFilter === "Submitted") filters.push(["docstatus", "=", 1]);
      if (fromDate) filters.push(["custom_from_date", ">=", fromDate]);
      if (toDate) filters.push(["custom_to_date", "<=", toDate]);

      const list = await fetchList<TravelRequest>("Travel Request", {
        fields: [
          "name", "employee", "employee_name", "company",
          "custom_from_date", "custom_to_date", "custom_total_distance",
          "docstatus", "travel_type",
        ],
        filters,
        limit_page_length: 200,
        order_by: "custom_from_date desc",
      });
      // Filter client-side on employees of the selected company
      const filtered = companyEmployeeNames
        ? list.filter(r => companyEmployeeNames.has(r.employee_name))
        : list;
      setRequests(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [company, statusFilter, fromDate, toDate, companyEmployeeNames]);

  // Per-employee shift workdays for anomaly detection in Overzicht.
  useEffect(() => {
    if (requests.length === 0) return;
    let cancelled = false;
    const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
    fetchEmployeeShiftWorkdays(ids).then(m => { if (!cancelled) setShiftWorkdaysOv(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [requests]);

  // Per-employee Holiday List.
  useEffect(() => {
    if (requests.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
      const m = new Map<string, Set<string>>();
      await Promise.all(ids.map(async (id) => {
        try { m.set(id, await getEmployeeHolidaySet(id)); } catch { /* ignore */ }
      }));
      if (!cancelled) setEmpHolidaysOv(m);
    })();
    return () => { cancelled = true; };
  }, [requests]);

  // Approved leaves overlapping the loaded TR range.
  useEffect(() => {
    if (requests.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
      // Use the min/max dates across the loaded requests for the range.
      let minFrom = ""; let maxTo = "";
      for (const r of requests) {
        if (r.custom_from_date && (!minFrom || r.custom_from_date < minFrom)) minFrom = r.custom_from_date;
        if (r.custom_to_date && (!maxTo || r.custom_to_date > maxTo)) maxTo = r.custom_to_date;
      }
      if (!minFrom || !maxTo) return;
      try {
        const leaves = await fetchAll<{ employee: string; from_date: string; to_date: string }>(
          "Leave Application",
          ["employee", "from_date", "to_date"],
          [
            ["employee", "in", ids],
            ["from_date", "<=", maxTo],
            ["to_date", ">=", minFrom],
            ["docstatus", "=", 1],
          ],
        );
        const set = new Set<string>();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        for (const lv of leaves) {
          if (!lv.from_date || !lv.to_date) continue;
          const f = new Date(lv.from_date + "T12:00:00");
          const u = new Date(lv.to_date + "T12:00:00");
          const cur = new Date(f);
          while (cur <= u) { set.add(`${lv.employee}|${fmt(cur)}`); cur.setDate(cur.getDate() + 1); }
        }
        if (!cancelled) setOnLeaveSetOv(set);
      } catch {
        if (!cancelled) setOnLeaveSetOv(new Set());
      }
    })();
    return () => { cancelled = true; };
  }, [requests]);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.employee_name?.toLowerCase().includes(q)
    );
  }, [requests, search]);

  // Group by employee — same layout as Timesheets Goedkeuren.
  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, TravelRequest[]>();
    for (const r of filtered) {
      const key = r.employee_name || "(onbekend)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort each employee's TRs newest-first; sort employees alphabetically.
    for (const list of map.values()) {
      list.sort((a, b) => (b.custom_from_date || "").localeCompare(a.custom_from_date || ""));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totalDistance = requests.reduce((s, r) => s + (r.custom_total_distance || 0), 0);
  const draftCount = requests.filter((r) => r.docstatus === 0).length;
  const submittedCount = requests.filter((r) => r.docstatus === 1).length;

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{t("onkosten.title")}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => selectTab("boeken")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "boeken" ? "bg-y-teal text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          <Car size={16} /> Km boeken
        </button>
        <button onClick={() => { selectTab("overzicht"); loadData(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "overzicht" ? "bg-y-teal text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}>
          <FileText size={16} /> Overzicht
        </button>
        {viewMode === "employer" && (
          <button onClick={() => selectTab("goedkeuren")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "goedkeuren" ? "bg-y-teal text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            <CheckCircle size={16} /> Goedkeuren
          </button>
        )}
      </div>

      {/* Km boeken tab — invoer links, eigen ritten rechts */}
      {activeTab === "boeken" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <QuickKmBooking hideRecentTrips />
          <MyKmOverzicht />
        </div>
      )}

      {/* Goedkeuren tab (employer-only) */}
      {activeTab === "goedkeuren" && viewMode === "employer" && <KmGoedkeurenView />}

      {/* Overzicht tab */}
      {activeTab === "overzicht" && (<div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/travel-request/new`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-y-teal rounded-lg hover:bg-y-teal-dark"
          >
            <Plus size={14} /> {t("common.new")}
          </a>
          <a
            href={`${getErpNextLinkUrl()}/travel-request`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ExternalLink size={14} /> ERPNext
          </a>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={company} onChange={setCompany} />
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          <option value="">{t("common.all_statuses")}</option>
          <option value="Draft">Draft</option>
          <option value="Submitted">Submitted</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-y-teal/10 rounded-lg"><Car className="text-y-teal" size={20} /></div>
            <p className="text-sm text-slate-500">{t("onkosten.total_km")}</p>
          </div>
          <p className="text-2xl font-bold text-slate-800">{loading ? "..." : `${totalDistance.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km`}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-orange-100 rounded-lg"><Clock className="text-orange-600" size={20} /></div>
            <p className="text-sm text-slate-500">Draft</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">{loading ? "..." : draftCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={20} /></div>
            <p className="text-sm text-slate-500">Submitted</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{loading ? "..." : submittedCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-purple-100 rounded-lg"><FileText className="text-purple-600" size={20} /></div>
            <p className="text-sm text-slate-500">{t("onkosten.total_claims")}</p>
          </div>
          <p className="text-3xl font-bold text-slate-800">{loading ? "..." : requests.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder={t("onkosten.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-y-teal text-sm"
        />
      </div>

      {/* Employee-grouped cards (same layout as Timesheets Goedkeuren) */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">{t("common.loading")}</div>
      ) : groupedByEmployee.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
          {t("onkosten.no_requests_found")}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByEmployee.map(([empName, reqs]) => {
            const empTotalKm = reqs.reduce((s, r) => s + (r.custom_total_distance || 0), 0);
            return (
              <div key={empName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-y-teal flex items-center justify-center text-white text-xs font-bold">
                      {empName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-700">{empName}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {empTotalKm.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km totaal
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {reqs.map((req) => {
                    const isOpen = expandedTr.has(req.name);
                    const itinerary = itineraryByTr.get(req.name);
                    const isItineraryLoading = loadingTr === req.name;
                    const analysis = itinerary ? analyzeTravelRequest(
                      req.employee, req.custom_from_date, req.custom_to_date, itinerary,
                      shiftWorkdaysOv, empHolidaysOv, onLeaveSetOv,
                    ) : null;
                    const anomalyCount = analysis
                      ? itinerary!.reduce((s, r) => {
                          const f = analysis.flagsForRow(r);
                          return s + (f.onNonWorkday || f.deviantKm || f.duplicateDate ? 1 : 0);
                        }, 0) + analysis.missingDays.length
                      : 0;
                    return (
                      <div key={req.name}>
                        <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleTrExpand(req.name)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                            >
                              <ChevronRight size={16} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                            <a
                              href={`${getErpNextLinkUrl()}/travel-request/${req.name}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm font-mono text-y-teal hover:underline"
                            >
                              {req.name}
                            </a>
                            <span className="text-sm text-slate-500">{req.custom_from_date} – {req.custom_to_date}</span>
                            <span className="text-sm font-medium text-slate-700">
                              {(req.custom_total_distance || 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km
                            </span>
                            {anomalyCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={12} /> {anomalyCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${docstatusColors[req.docstatus] ?? "bg-slate-100 text-slate-600"}`}>
                              {docstatusLabel[req.docstatus] ?? "Unknown"}
                            </span>
                            <a
                              href={`${getErpNextLinkUrl()}/travel-request/${req.name}`}
                              target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                              {t("timesheets.view", { defaultValue: "Bekijken" })}
                            </a>
                          </div>
                        </div>
                        {/* Expanded itinerary with anomaly highlighting */}
                        {isOpen && (
                          <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/50">
                            {isItineraryLoading && !itinerary ? (
                              <div className="text-xs text-slate-400 py-3">{t("common.loading")}</div>
                            ) : !itinerary ? null : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-slate-500">
                                    <th className="text-left px-2 py-2 font-medium">{t("common.date", { defaultValue: "Datum" })}</th>
                                    <th className="text-left px-2 py-2 font-medium">Dag</th>
                                    <th className="text-left px-2 py-2 font-medium">{t("dashboard.km_from_short", { defaultValue: "Van" })}</th>
                                    <th className="text-left px-2 py-2 font-medium">{t("dashboard.km_to_short", { defaultValue: "Naar" })}</th>
                                    <th className="text-left px-2 py-2 font-medium">{t("common.type", { defaultValue: "Type" })}</th>
                                    <th className="text-right px-2 py-2 font-medium">Km</th>
                                    <th className="text-right px-2 py-2 font-medium">€</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itinerary.map((row, i) => {
                                    const f = analysis ? analysis.flagsForRow(row) : { onNonWorkday: false, deviantKm: false, duplicateDate: false };
                                    const rowBg = f.onNonWorkday || f.duplicateDate ? "bg-amber-50" : "";
                                    const kmCls = f.deviantKm ? "bg-amber-100 text-amber-800 font-semibold rounded px-1" : "";
                                    const day = (row.departure_date || "").slice(0, 10);
                                    const dt = day ? new Date(day + "T12:00:00") : null;
                                    const dayName = dt ? NL_DAY_NAMES_EN[dt.getDay()] : "";
                                    return (
                                      <tr key={i} className={`border-t border-slate-100 ${rowBg}`}>
                                        <td className="px-2 py-1.5 text-slate-600">{day}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{dayName}</td>
                                        <td className="px-2 py-1.5 text-slate-700">{row.travel_from}</td>
                                        <td className="px-2 py-1.5 text-slate-700">{row.travel_to}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{row.custom_journey_type}</td>
                                        <td className="px-2 py-1.5 text-right">
                                          <span className={kmCls}>
                                            {(row.custom_distance || 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-slate-500">
                                          {row.custom_travel_cost
                                            ? `€ ${row.custom_travel_cost.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : ""}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {analysis?.missingDays.map((m, i) => (
                                    <tr key={`miss-${i}`} className="border-t border-slate-100 bg-orange-50 text-orange-800">
                                      <td className="px-2 py-1.5">{m.date}</td>
                                      <td className="px-2 py-1.5 italic">{m.dayName}</td>
                                      <td className="px-2 py-1.5 italic" colSpan={4}>
                                        Geen km geboekt op deze werkdag
                                      </td>
                                      <td className="px-2 py-1.5"></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {analysis && analysis.mode > 0 && (
                              <p className="mt-2 text-[10px] text-slate-400">
                                Baseline (modus woon-werk): {analysis.mode.toLocaleString("nl-NL")} km
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg flex items-center justify-between text-sm">
          <span className="text-slate-500">{filtered.length} declaraties</span>
          <span className="font-semibold text-slate-700">
            Totaal: {filtered.reduce((s, r) => s + (r.custom_total_distance || 0), 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km
          </span>
        </div>
      )}
    </div>)}
    </div>
  );
}

/* ─── Km Goedkeuren ───
   Employer-only tab that mirrors the Timesheets Goedkeuren UX:
   - draft Travel Requests only (docstatus=0)
   - period filter (default "dit_jaar"), never current month
   - per-medewerker cards, chevron to expand TR → itinerary rows
   - Goedkeuren button per TR (frappe.client.submit with full doc)
   - per-row highlight: km on a non-shift day, missing-day rows
   - anomaly highlight: km value deviating from the mode (commute baseline),
     and multiple rows on the same date
*/

const NL_DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ItineraryRowFull {
  travel_from?: string;
  travel_to?: string;
  custom_distance?: number;
  departure_date?: string;
  custom_journey_type?: string;
  custom_travel_cost?: number;
}

interface RowFlags {
  onNonWorkday: boolean;
  deviantKm: boolean;
  duplicateDate: boolean;
}

interface ItineraryAnalysis {
  mode: number;
  flagsForRow(r: ItineraryRowFull): RowFlags;
  missingDays: { date: string; dayName: string }[];
}

/**
 * Anomaly analysis for a Travel Request's itinerary, shared by the
 * Overzicht and Goedkeuren tabs.
 *
 * Detects:
 *  - rows on a non-shift day (or holiday / leave day)
 *  - rows with km value deviating from the mode (commute baseline)
 *  - multiple rows on the same date
 *  - shift workdays in the TR range with no itinerary row at all
 */
function analyzeTravelRequest(
  employee: string,
  customFromDate: string,
  customToDate: string,
  rows: ItineraryRowFull[],
  shiftWorkdays: Map<string, Set<string>>,
  empHolidays: Map<string, Set<string>>,
  onLeaveSet: Set<string>,
): ItineraryAnalysis {
  const workdays = shiftWorkdays.get(employee);
  const holidays = empHolidays.get(employee) || new Set<string>();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Mode = most common km value across the rows = the commute baseline.
  const kmCounts = new Map<number, number>();
  for (const r of rows) {
    const km = Math.round((r.custom_distance || 0) * 10) / 10;
    if (km <= 0) continue;
    kmCounts.set(km, (kmCounts.get(km) || 0) + 1);
  }
  let mode = 0; let modeCount = 0;
  for (const [km, c] of kmCounts) if (c > modeCount) { mode = km; modeCount = c; }

  const datesSeen = new Map<string, number>();
  for (const r of rows) {
    if (!r.departure_date) continue;
    const d = r.departure_date.slice(0, 10);
    datesSeen.set(d, (datesSeen.get(d) || 0) + 1);
  }

  function flagsForRow(r: ItineraryRowFull): RowFlags {
    const day = (r.departure_date || "").slice(0, 10);
    const dateObj = day ? new Date(day + "T12:00:00") : null;
    const dayName = dateObj ? NL_DAY_NAMES_EN[dateObj.getDay()] : "";
    const isShiftDay = workdays ? workdays.has(dayName) : false;
    const isHol: boolean = day ? (holidays.has(day) || !!isHoliday(day, dateObj!.getFullYear())) : false;
    const isLeave = day ? onLeaveSet.has(`${employee}|${day}`) : false;
    const onNonWorkday: boolean = Boolean(day) && (!isShiftDay || isHol || isLeave);
    const km = Math.round((r.custom_distance || 0) * 10) / 10;
    const deviantKm: boolean = mode > 0 && km > 0 && km !== mode;
    const duplicateDate: boolean = Boolean(day) && (datesSeen.get(day) || 0) > 1;
    return { onNonWorkday, deviantKm, duplicateDate };
  }

  const missingDays: { date: string; dayName: string }[] = [];
  if (workdays && customFromDate && customToDate) {
    const f = new Date(customFromDate + "T12:00:00");
    const u = new Date(customToDate + "T12:00:00");
    const seenDates = new Set<string>();
    for (const r of rows) if (r.departure_date) seenDates.add(r.departure_date.slice(0, 10));
    const cur = new Date(f);
    while (cur <= u) {
      const dStr = fmt(cur);
      const dayName = NL_DAY_NAMES_EN[cur.getDay()];
      const isShiftDay = workdays.has(dayName);
      const isHol = holidays.has(dStr) || !!isHoliday(dStr, cur.getFullYear());
      const isLeave = onLeaveSet.has(`${employee}|${dStr}`);
      if (isShiftDay && !isHol && !isLeave && !seenDates.has(dStr)) {
        missingDays.push({ date: dStr, dayName });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  return { mode, flagsForRow, missingDays };
}

function KmGoedkeurenView() {
  const { t } = useTranslation();
  const allEmployees = useEmployees();
  const company = getActiveCompany();

  const [datePreset, setDatePreset] = useState<KmDateRangePreset>("dit_jaar");
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [expandedTr, setExpandedTr] = useState<Set<string>>(new Set());
  const [itineraryByTr, setItineraryByTr] = useState<Map<string, ItineraryRowFull[]>>(new Map());
  const [loadingTr, setLoadingTr] = useState<string | null>(null);

  // Per-employee shift workdays + holidays + leave days. Used to highlight
  // anomalies in the itinerary rows (km on a non-shift day, missing-day
  // rows the employee should have driven).
  const [shiftWorkdays, setShiftWorkdays] = useState<Map<string, Set<string>>>(new Map());
  const [empHolidays, setEmpHolidays] = useState<Map<string, Set<string>>>(new Map());
  const [onLeaveSet, setOnLeaveSet] = useState<Set<string>>(new Set());

  const dateRange = useMemo(() => getKmDateRange(datePreset), [datePreset]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters: unknown[][] = [
        ["docstatus", "=", 0],
        // Never list TRs that overlap the current (still-running) month.
        ["custom_to_date", "<=", dateRange.to],
      ];
      if (dateRange.from) filters.push(["custom_from_date", ">=", dateRange.from]);
      const list = await fetchAll<TravelRequest>(
        "Travel Request",
        ["name", "employee", "employee_name", "company", "custom_from_date", "custom_to_date", "custom_total_distance", "docstatus", "travel_type"],
        filters,
        "employee_name asc, custom_from_date asc",
      );
      // Filter by company via the employee's company.
      const filtered = company
        ? list.filter((r) => {
            const emp = allEmployees.find((e) => e.name === r.employee);
            return !emp || emp.company === company;
          })
        : list;
      setRequests(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [datePreset, company]);

  // Fetch shift workdays per employee in the loaded set.
  useEffect(() => {
    if (requests.length === 0) return;
    let cancelled = false;
    const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
    fetchEmployeeShiftWorkdays(ids).then(m => { if (!cancelled) setShiftWorkdays(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [requests]);

  // Fetch holiday list per employee.
  useEffect(() => {
    if (requests.length === 0) return;
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
      const m = new Map<string, Set<string>>();
      await Promise.all(ids.map(async (id) => {
        try { m.set(id, await getEmployeeHolidaySet(id)); } catch { /* ignore */ }
      }));
      if (!cancelled) setEmpHolidays(m);
    })();
    return () => { cancelled = true; };
  }, [requests]);

  // Approved leaves overlapping the date range.
  useEffect(() => {
    if (requests.length === 0 || !dateRange.from) return;
    let cancelled = false;
    (async () => {
      const ids = Array.from(new Set(requests.map(r => r.employee).filter(Boolean)));
      try {
        const leaves = await fetchAll<{ employee: string; from_date: string; to_date: string }>(
          "Leave Application",
          ["employee", "from_date", "to_date"],
          [
            ["employee", "in", ids],
            ["from_date", "<=", dateRange.to],
            ["to_date", ">=", dateRange.from],
            ["docstatus", "=", 1],
          ],
        );
        const set = new Set<string>();
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        for (const lv of leaves) {
          if (!lv.from_date || !lv.to_date) continue;
          const f = new Date(lv.from_date + "T12:00:00");
          const u = new Date(lv.to_date + "T12:00:00");
          const cur = new Date(f);
          while (cur <= u) { set.add(`${lv.employee}|${fmt(cur)}`); cur.setDate(cur.getDate() + 1); }
        }
        if (!cancelled) setOnLeaveSet(set);
      } catch { if (!cancelled) setOnLeaveSet(new Set()); }
    })();
    return () => { cancelled = true; };
  }, [requests, dateRange.from, dateRange.to]);

  async function toggleTrExpand(name: string) {
    if (expandedTr.has(name)) {
      setExpandedTr(prev => { const n = new Set(prev); n.delete(name); return n; });
      return;
    }
    setExpandedTr(prev => new Set(prev).add(name));
    if (itineraryByTr.has(name)) return;
    setLoadingTr(name);
    try {
      const doc = await fetchDocument<{ itinerary?: ItineraryRowFull[] }>("Travel Request", name);
      const rows = (doc.itinerary || []).slice().sort((a, b) =>
        (a.departure_date || "").localeCompare(b.departure_date || ""),
      );
      setItineraryByTr(prev => new Map(prev).set(name, rows));
    } catch {
      setItineraryByTr(prev => new Map(prev).set(name, []));
    } finally {
      setLoadingTr(null);
    }
  }

  async function handleApprove(req: TravelRequest) {
    setSubmittingId(req.name);
    setError(null);
    try {
      const doc = await fetchDocument("Travel Request", req.name);
      await callMethod("frappe.client.submit", { doc: JSON.stringify(doc) });
      setRequests(prev => prev.filter(r => r.name !== req.name));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[travel-request approve]", req.name, e);
      setError(e instanceof Error && e.message ? `Goedkeuren mislukt: ${e.message}` : "Goedkeuren mislukt");
    } finally {
      setSubmittingId(null);
    }
  }

  // Group by employee, employees alphabetical.
  const grouped = useMemo(() => {
    const map = new Map<string, TravelRequest[]>();
    for (const r of requests) {
      const key = r.employee_name || r.employee || "(onbekend)";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.custom_from_date || "").localeCompare(b.custom_from_date || ""));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [requests]);

  function analyzeItinerary(req: TravelRequest, rows: ItineraryRowFull[]) {
    return analyzeTravelRequest(req.employee, req.custom_from_date, req.custom_to_date, rows, shiftWorkdays, empHolidays, onLeaveSet);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Kilometers goedkeuren</h3>
          <p className="text-sm text-slate-500">
            {dateRange.from ? `${dateRange.from} t/m ${dateRange.to}` : `Alle drafts t/m ${dateRange.to}`}
            {company && <span className="ml-2 text-slate-400">· {company}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
            {(Object.keys(KM_PRESET_LABELS) as KmDateRangePreset[]).map(p => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  datePreset === p ? "bg-y-teal text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {KM_PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer text-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Verversen
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-400 py-12">{t("common.loading")}</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">Alles goedgekeurd</p>
          <p className="text-sm text-slate-400 mt-1">Geen draft-aanvragen om te beoordelen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([empName, reqs]) => {
            const empTotalKm = reqs.reduce((s, r) => s + (r.custom_total_distance || 0), 0);
            return (
              <div key={empName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-y-teal flex items-center justify-center text-white text-xs font-bold">
                      {empName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-700">{empName}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {empTotalKm.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km totaal
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {reqs.map((req) => {
                    const isOpen = expandedTr.has(req.name);
                    const itinerary = itineraryByTr.get(req.name);
                    const isItineraryLoading = loadingTr === req.name;
                    const analysis = itinerary ? analyzeItinerary(req, itinerary) : null;
                    const anomalyCount = analysis
                      ? itinerary!.reduce((s, r) => {
                          const f = analysis.flagsForRow(r);
                          return s + (f.onNonWorkday || f.deviantKm || f.duplicateDate ? 1 : 0);
                        }, 0) + analysis.missingDays.length
                      : 0;
                    return (
                      <Fragment key={req.name}>
                        <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleTrExpand(req.name)}
                              className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                            >
                              <ChevronRight size={16} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                            <a
                              href={`${getErpNextLinkUrl()}/travel-request/${req.name}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm font-mono text-y-teal hover:underline"
                            >
                              {req.name}
                            </a>
                            <span className="text-sm text-slate-500">{req.custom_from_date} – {req.custom_to_date}</span>
                            <span className="text-sm font-medium text-slate-700">
                              {(req.custom_total_distance || 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} km
                            </span>
                            {anomalyCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={12} /> {anomalyCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`${getErpNextLinkUrl()}/travel-request/${req.name}`}
                              target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                              Bekijken
                            </a>
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={submittingId === req.name}
                              className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle size={14} />
                              {submittingId === req.name ? "Bezig..." : "Goedkeuren"}
                            </button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="px-4 pb-3 border-t border-slate-100 bg-slate-50/50">
                            {isItineraryLoading && !itinerary ? (
                              <div className="text-xs text-slate-400 py-3">{t("common.loading")}</div>
                            ) : !itinerary ? null : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-slate-500">
                                    <th className="text-left px-2 py-2 font-medium">Datum</th>
                                    <th className="text-left px-2 py-2 font-medium">Dag</th>
                                    <th className="text-left px-2 py-2 font-medium">Van</th>
                                    <th className="text-left px-2 py-2 font-medium">Naar</th>
                                    <th className="text-left px-2 py-2 font-medium">Type</th>
                                    <th className="text-right px-2 py-2 font-medium">Km</th>
                                    <th className="text-right px-2 py-2 font-medium">€</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itinerary.map((row, i) => {
                                    const f = analysis ? analysis.flagsForRow(row) : { onNonWorkday: false, deviantKm: false, duplicateDate: false };
                                    const rowBg = f.onNonWorkday || f.duplicateDate ? "bg-amber-50" : "";
                                    const kmCls = f.deviantKm ? "bg-amber-100 text-amber-800 font-semibold rounded px-1" : "";
                                    const day = (row.departure_date || "").slice(0, 10);
                                    const dt = day ? new Date(day + "T12:00:00") : null;
                                    const dayName = dt ? NL_DAY_NAMES_EN[dt.getDay()] : "";
                                    return (
                                      <tr key={i} className={`border-t border-slate-100 ${rowBg}`}>
                                        <td className="px-2 py-1.5 text-slate-600">{day}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{dayName}</td>
                                        <td className="px-2 py-1.5 text-slate-700">{row.travel_from}</td>
                                        <td className="px-2 py-1.5 text-slate-700">{row.travel_to}</td>
                                        <td className="px-2 py-1.5 text-slate-500">{row.custom_journey_type}</td>
                                        <td className="px-2 py-1.5 text-right">
                                          <span className={kmCls}>
                                            {(row.custom_distance || 0).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-slate-500">
                                          {row.custom_travel_cost ? `€ ${row.custom_travel_cost.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {analysis?.missingDays.map((m, i) => (
                                    <tr key={`miss-${i}`} className="border-t border-slate-100 bg-orange-50 text-orange-800">
                                      <td className="px-2 py-1.5">{m.date}</td>
                                      <td className="px-2 py-1.5 italic">{m.dayName}</td>
                                      <td className="px-2 py-1.5 italic" colSpan={4}>
                                        Geen km geboekt op deze werkdag
                                      </td>
                                      <td className="px-2 py-1.5"></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {analysis && analysis.mode > 0 && (
                              <p className="mt-2 text-[10px] text-slate-400">
                                Baseline (modus woon-werk): {analysis.mode.toLocaleString("nl-NL")} km
                              </p>
                            )}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
