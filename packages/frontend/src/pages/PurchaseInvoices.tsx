import { useEffect, useState } from "react";
import { fetchCount, fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { ShoppingCart, RefreshCw, Filter, Plus } from "lucide-react";
import InvoiceModal from "../components/InvoiceModal";
import CompanySelect from "../components/CompanySelect";
import DateRangeFilter from "../components/DateRangeFilter";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

interface PurchaseInvoice {
  name: string;
  supplier_name: string;
  grand_total: number;
  net_total: number;
  outstanding_amount: number;
  posting_date: string;
  status: string;
  company: string;
}

export default function PurchaseInvoices() {
  const { t } = useTranslation();
  const [count, setCount] = useState<number | null>(null);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessUnit, setBusinessUnit] = useState(getActiveCompany());
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const baseFilters: unknown[][] = [
    ["docstatus", "=", 1],
    ["outstanding_amount", ">", 0],
  ];

  function getFilters() {
    const filters = [...baseFilters];
    if (businessUnit) {
      filters.push(["company", "=", businessUnit]);
    }
    if (fromDate) filters.push(["posting_date", ">=", fromDate]);
    if (toDate) filters.push(["posting_date", "<=", toDate]);
    return filters;
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters = getFilters();
      const [cnt, list] = await Promise.all([
        fetchCount("Purchase Invoice", filters),
        fetchList<PurchaseInvoice>("Purchase Invoice", {
          fields: [
            "name",
            "supplier_name",
            "grand_total",
            "net_total",
            "outstanding_amount",
            "posting_date",
            "status",
            "company",
          ],
          filters,
          limit_page_length: 100,
          order_by: "posting_date desc",
        }),
      ]);
      setCount(cnt);
      setInvoices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [businessUnit, fromDate, toDate]);



  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + inv.outstanding_amount,
    0
  );

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          {t("purchase_invoices.title")}
        </h2>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/purchase-invoice/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <Plus size={16} />
            {t("common.new")}
          </a>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <Filter size={16} className="text-slate-400" />
        <CompanySelect value={businessUnit} onChange={setBusinessUnit} />
        <DateRangeFilter fromDate={fromDate} toDate={toDate} onFromChange={setFromDate} onToChange={setToDate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ShoppingCart className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t("purchase_invoices.count_outstanding")}</p>
              <p className="text-3xl font-bold text-slate-800">
                {loading ? "..." : count}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShoppingCart className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">{t("outstanding.total_outstanding")}</p>
              <p className="text-3xl font-bold text-slate-800">
                {loading
                  ? "..."
                  : `\u20AC ${totalOutstanding.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("purchase_invoices.invoice_nr")}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("purchase_invoices.col_supplier")}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("purchase_invoices.col_business_unit")}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("common.date")}
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">
                {t("purchase_invoices.col_amount_excl_vat")}
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600">
                {t("purchase_invoices.col_outstanding")}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600">
                {t("projects.detail.status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {t("common.loading")}
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {t("purchase_invoices.no_outstanding")}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.name}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="text-y-teal hover:text-y-teal-dark hover:underline cursor-pointer"
                    >
                      {inv.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {inv.supplier_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {inv.company || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {inv.posting_date}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">
                    {`\u20AC ${inv.net_total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-orange-600 text-right">
                    {`\u20AC ${inv.outstanding_amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          doctype="Purchase Invoice"
          name={selectedInvoice.name}
          title={selectedInvoice.supplier_name}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
