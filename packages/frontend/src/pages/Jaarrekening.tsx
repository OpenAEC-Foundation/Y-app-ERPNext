import { useEffect, useState, useMemo } from "react";
import { fetchAll, getErpNextLinkUrl } from "../lib/erpnext";
import CompanySelect from "../components/CompanySelect";
import {
  BookOpen,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActiveCompany } from "../lib/instances";

/* ─── Types ─── */

interface GLEntry {
  account: string;
  debit: number;
  credit: number;
}

interface Account {
  name: string;
  account_name: string;
  root_type: string;
  parent_account: string;
  is_group: number;
  account_type: string;
}

interface SalarySlip {
  employee_name: string;
  gross_pay: number;
  net_pay: number;
  total_deduction: number;
  posting_date: string;
}

interface AccountRow {
  account: string;
  account_name: string;
  balance: number;
}

interface GroupRow {
  group: string;
  label: string;
  balance: number;
  accounts: AccountRow[];
}

/* ─── Helpers ─── */

const currentYear = new Date().getFullYear();
const years = [2022, 2023, 2024, 2025, 2026];

/** Accounting sign convention: Asset & Expense have natural debit balances,
 *  Liability, Equity & Income have natural credit balances. */
const CREDIT_TYPES = new Set(["Liability", "Equity", "Income"]);

function euro(value: number): string {
  return value.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function stripSuffix(parentAccount: string): string {
  return parentAccount.replace(/\s*-\s*\w+$/, "").trim();
}

const rootTypeLabelKeys: Record<string, string> = {
  Asset: "jaarrekening.root_type_asset",
  Liability: "jaarrekening.root_type_liability",
  Equity: "jaarrekening.root_type_equity",
  Income: "jaarrekening.root_type_income",
  Expense: "jaarrekening.root_type_expense",
};

/* ─── Component ─── */

export default function Jaarrekening() {
  const { t } = useTranslation();
  const [company, setCompany] = useState(getActiveCompany());
  const [year, setYear] = useState(currentYear);
  const [plEntries, setPlEntries] = useState<GLEntry[]>([]);
  const [bsEntries, setBsEntries] = useState<GLEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // P&L: all GL entries within the selected year
      const plFilters: unknown[][] = [
        ["is_cancelled", "=", 0],
        ["posting_date", ">=", `${year}-01-01`],
        ["posting_date", "<=", `${year}-12-31`],
      ];
      if (company) plFilters.push(["company", "=", company]);

      // Balance Sheet: cumulative from beginning up to year-end
      const bsFilters: unknown[][] = [
        ["is_cancelled", "=", 0],
        ["posting_date", "<=", `${year}-12-31`],
      ];
      if (company) bsFilters.push(["company", "=", company]);

      const acctFilters: unknown[][] = [["is_group", "=", 0]];
      if (company) acctFilters.push(["company", "=", company]);

      const glFields: string[] = ["account", "debit", "credit"];

      const [plData, bsData, accts, salaryData] = await Promise.all([
        fetchAll<GLEntry>("GL Entry", glFields, plFilters),
        fetchAll<GLEntry>("GL Entry", glFields, bsFilters),
        fetchAll<Account>(
          "Account",
          ["name", "account_name", "root_type", "parent_account", "is_group", "account_type"],
          acctFilters
        ),
        fetchAll<SalarySlip>(
          "Salary Slip",
          ["employee_name", "gross_pay", "net_pay", "total_deduction", "posting_date"],
          [
            ["docstatus", "=", 1],
            ["posting_date", ">=", `${year}-01-01`],
            ["posting_date", "<=", `${year}-12-31`],
            ...(company ? [["company", "=", company]] : []),
          ]
        ),
      ]);

      setPlEntries(plData);
      setBsEntries(bsData);
      setAccounts(accts);
      setSalarySlips(salaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.unknown_error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [company, year]);

  // Account lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.name, a);
    return map;
  }, [accounts]);

  // Compute balances with correct sign convention
  const accountBalances = useMemo(() => {
    const balances = new Map<string, number>();

    function addEntry(entry: GLEntry, rootType: string | undefined) {
      if (!rootType) return;
      const current = balances.get(entry.account) || 0;
      // Credit-natural accounts: credit - debit → positive means normal balance
      // Debit-natural accounts: debit - credit → positive means normal balance
      const delta = CREDIT_TYPES.has(rootType)
        ? entry.credit - entry.debit
        : entry.debit - entry.credit;
      balances.set(entry.account, current + delta);
    }

    // P&L entries for Income & Expense
    for (const entry of plEntries) {
      const acct = accountMap.get(entry.account);
      if (!acct) continue;
      if (acct.root_type === "Income" || acct.root_type === "Expense") {
        addEntry(entry, acct.root_type);
      }
    }

    // BS entries for Asset, Liability, Equity (cumulative)
    for (const entry of bsEntries) {
      const acct = accountMap.get(entry.account);
      if (!acct) continue;
      if (acct.root_type === "Asset" || acct.root_type === "Liability" || acct.root_type === "Equity") {
        addEntry(entry, acct.root_type);
      }
    }

    return balances;
  }, [plEntries, bsEntries, accountMap]);

  // Group by root_type → parent_account
  const groupedData = useMemo(() => {
    const result: Record<string, GroupRow[]> = {};
    const typeGroups = new Map<string, Map<string, AccountRow[]>>();

    for (const [acctName, balance] of accountBalances) {
      if (balance === 0) continue; // skip zero balances
      const acct = accountMap.get(acctName);
      if (!acct || !acct.root_type) continue;

      const rootType = acct.root_type;
      const parent = stripSuffix(acct.parent_account || t("modules.section.other"));

      if (!typeGroups.has(rootType)) typeGroups.set(rootType, new Map());
      const parentGroups = typeGroups.get(rootType)!;
      if (!parentGroups.has(parent)) parentGroups.set(parent, []);
      parentGroups.get(parent)!.push({ account: acctName, account_name: acct.account_name, balance });
    }

    for (const [rootType, parentGroups] of typeGroups) {
      const groups: GroupRow[] = [];
      for (const [group, accts] of parentGroups) {
        const groupBalance = accts.reduce((s, a) => s + a.balance, 0);
        accts.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
        groups.push({
          group: `${rootType}::${group}`,
          label: group,
          balance: groupBalance,
          accounts: accts,
        });
      }
      groups.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
      result[rootType] = groups;
    }

    return result;
  }, [accountBalances, accountMap]);

  // Section totals
  const sectionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const [rootType, groups] of Object.entries(groupedData)) {
      totals[rootType] = groups.reduce((s, g) => s + g.balance, 0);
    }
    return totals;
  }, [groupedData]);

  // P&L summary
  const totalIncome = sectionTotals["Income"] || 0;
  const totalExpenses = sectionTotals["Expense"] || 0;
  const netResult = totalIncome - totalExpenses;

  // Salary data
  const salaryData = useMemo(() => {
    const totalBruto = salarySlips.reduce((s, sl) => s + sl.gross_pay, 0);
    const totalNetto = salarySlips.reduce((s, sl) => s + sl.net_pay, 0);
    const totalInhouding = salarySlips.reduce((s, sl) => s + sl.total_deduction, 0);

    const byEmployee = new Map<string, { gross: number; net: number; deductions: number; count: number }>();
    for (const sl of salarySlips) {
      const existing = byEmployee.get(sl.employee_name) || { gross: 0, net: 0, deductions: 0, count: 0 };
      existing.gross += sl.gross_pay;
      existing.net += sl.net_pay;
      existing.deductions += sl.total_deduction;
      existing.count += 1;
      byEmployee.set(sl.employee_name, existing);
    }

    return { totalBruto, totalNetto, totalInhouding, byEmployee };
  }, [salarySlips]);

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }

  function renderSection(rootType: string) {
    const groups = groupedData[rootType] || [];
    const total = sectionTotals[rootType] || 0;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-100 rounded-t-xl">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            {rootTypeLabelKeys[rootType] ? t(rootTypeLabelKeys[rootType]) : rootType}
          </h4>
          <span className="text-sm font-bold text-slate-800">
            {euro(total)}
          </span>
        </div>
        <div className="border border-slate-200 border-t-0 rounded-b-xl overflow-hidden">
          {groups.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              {t("jaarrekening.no_bookings")}
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedGroups.has(group.group);
              return (
                <div key={group.group}>
                  <button
                    onClick={() => toggleGroup(group.group)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400" />
                      )}
                      <span className="text-sm font-medium text-slate-700">
                        {group.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({group.accounts.length})
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {euro(group.balance)}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-50/50">
                      {group.accounts.map((acct) => (
                        <div
                          key={acct.account}
                          className="flex items-center justify-between px-4 py-2 pl-10 border-b border-slate-50"
                        >
                          <span className="text-xs text-slate-500">
                            {acct.account_name}
                          </span>
                          <span className="text-xs font-medium text-slate-600">
                            {euro(acct.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const balansTypes = ["Asset", "Liability", "Equity"] as const;
  const plTypes = ["Income", "Expense"] as const;

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <BookOpen className="text-emerald-600" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t("jaarrekening.title")}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${getErpNextLinkUrl()}/general-ledger?company=${encodeURIComponent(company)}`}
            target="_blank"
            rel="noopener noreferrer"
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

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3">
        <CompanySelect value={company} onChange={setCompany} />
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400">
          {t("common.loading")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* =================== BALANS =================== */}
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4">{t("jaarrekening.balance_sheet")}</h3>

              {balansTypes.map((rootType) => (
                <div key={rootType}>{renderSection(rootType)}</div>
              ))}

              {/* Balans totals summary */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mt-2">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">{t("jaarrekening.total_assets")}</span>
                  <span className="font-semibold text-slate-800">
                    {euro(sectionTotals["Asset"] || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">{t("jaarrekening.total_liabilities")}</span>
                  <span className="font-semibold text-slate-800">
                    {euro((sectionTotals["Liability"] || 0) + (sectionTotals["Equity"] || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* =================== WINST & VERLIES =================== */}
            <div>
              <h3 className="text-xl font-bold text-slate-800 mb-4">
                {t("jaarrekening.profit_loss_title")}
              </h3>

              {plTypes.map((rootType) => (
                <div key={rootType}>{renderSection(rootType)}</div>
              ))}

              {/* Net Result */}
              <div
                className={`rounded-xl shadow-sm border p-5 mt-2 ${
                  netResult >= 0
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{t("jaarrekening.revenue_excl_vat")}</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {euro(totalIncome)}
                    </p>
                  </div>
                  <span className="text-2xl text-slate-300 font-light">-</span>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">{t("jaarrekening.costs_excl_vat")}</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {euro(totalExpenses)}
                    </p>
                  </div>
                  <span className="text-2xl text-slate-300 font-light">=</span>
                  <div className="text-right">
                    <p className="text-sm text-slate-500 mb-1">{t("jaarrekening.net_result")}</p>
                    <p
                      className={`text-2xl font-bold ${
                        netResult >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {euro(netResult)}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      netResult >= 0 ? "bg-green-500" : "bg-red-500"
                    }`}
                    style={{
                      width: `${
                        totalIncome > 0
                          ? Math.min(
                              (Math.abs(netResult) / totalIncome) * 100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-right">
                  {t("jaarrekening.profit_margin")}:{" "}
                  {totalIncome > 0
                    ? ((netResult / totalIncome) * 100).toFixed(1)
                    : "0.0"}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* Salarisoverzicht */}
          <div className="mt-8">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users size={20} className="text-y-teal" />
              {t("jaarrekening.salary_overview", { year })}
            </h3>

            {salarySlips.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-sm text-slate-400">
                {t("jaarrekening.no_salary_data", { year })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">{t("jaarrekening.total_gross")}</p>
                    <p className="text-2xl font-bold text-slate-800">{euro(salaryData.totalBruto)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">{t("annual_report.total_deductions")}</p>
                    <p className="text-2xl font-bold text-red-600">{euro(salaryData.totalInhouding)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <p className="text-sm text-slate-500 mb-1">{t("jaarrekening.total_net")}</p>
                    <p className="text-2xl font-bold text-green-600">{euro(salaryData.totalNetto)}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">{t("timesheets.table.employee")}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("jaarrekening.col_gross")}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("jaarrekening.col_deductions")}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("jaarrekening.col_net")}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">{t("jaarrekening.col_slips")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(salaryData.byEmployee.entries())
                        .sort((a, b) => b[1].gross - a[1].gross)
                        .map(([name, data]) => (
                          <tr key={name} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-700">{name}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right">{euro(data.gross)}</td>
                            <td className="px-4 py-3 text-sm text-red-600 text-right">{euro(data.deductions)}</td>
                            <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">{euro(data.net)}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 text-right">{data.count}</td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                        <td className="px-4 py-3 text-sm text-slate-700">{t("financial.total")}</td>
                        <td className="px-4 py-3 text-sm text-slate-800 text-right">{euro(salaryData.totalBruto)}</td>
                        <td className="px-4 py-3 text-sm text-red-700 text-right">{euro(salaryData.totalInhouding)}</td>
                        <td className="px-4 py-3 text-sm text-green-700 text-right">{euro(salaryData.totalNetto)}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 text-right">{salarySlips.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
