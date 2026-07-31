import { useState, useEffect, useMemo } from "react";
import { fetchAll, fetchList, fetchCount } from "../lib/erpnext";
import { useEmployees, useProjects, useCompanies, useLeaves } from "../lib/DataContext";
import { isFeatureEnabled } from "../lib/capabilities";
import {
  ClipboardList, Users, FolderKanban, Clock, CalendarCheck,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight,
  FileText, Receipt, Timer, BookOpen, RefreshCw, Mail,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface ModuleCheck {
  label: string;
  icon: typeof Users;
  status: "ok" | "warning" | "error" | "loading";
  count?: number;
  details: string;
  items?: CheckItem[];
}

interface CheckItem {
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

interface TimesheetInfo {
  employee: string;
  employee_name: string;
  count: number;
  totalHours: number;
  lastDate: string;
}

/* ─── Component ─── */

export default function ErpNextOverview() {
  const { t } = useTranslation();
  const employees = useEmployees();
  const projects = useProjects();
  const companies = useCompanies();
  const leaves = useLeaves();

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<ModuleCheck[]>([]);

  // Derived data
  const activeEmployees = useMemo(() => employees.filter(e => e.status === "Active"), [employees]);

  function toggle(label: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  useEffect(() => {
    runChecks();
  }, [employees.length, projects.length, leaves.length]);

  async function runChecks() {
    setLoading(true);
    const checks: ModuleCheck[] = [];

    // ─── 1. Bedrijven ───
    checks.push({
      label: t("erpnext_overview.companies"),
      icon: BookOpen,
      status: companies.length > 0 ? "ok" : "error",
      count: companies.length,
      details: companies.length > 0
        ? t("erpnext_overview.companies_configured", { count: companies.length, names: companies.map(c => c.company_name || c.name).join(", ") })
        : t("erpnext_overview.no_companies"),
    });

    // ─── 2. Medewerkers ───
    const empItems: CheckItem[] = [];
    const noEmail = activeEmployees.filter(e => !e.company_email && !e.user_id);
    const noDepartment = activeEmployees.filter(e => !e.department);
    const noDesignation = activeEmployees.filter(e => !e.designation);

    if (noEmail.length > 0) {
      empItems.push({
        label: t("erpnext_overview.without_email"),
        status: "warning",
        detail: noEmail.map(e => e.employee_name).join(", "),
      });
    }
    if (noDepartment.length > 0) {
      empItems.push({
        label: t("erpnext_overview.without_department"),
        status: "warning",
        detail: noDepartment.map(e => e.employee_name).join(", "),
      });
    }
    if (noDesignation.length > 0) {
      empItems.push({
        label: t("erpnext_overview.without_designation"),
        status: "warning",
        detail: noDesignation.map(e => e.employee_name).join(", "),
      });
    }

    checks.push({
      label: t("erpnext_overview.employees_label"),
      icon: Users,
      status: empItems.some(i => i.status === "error") ? "error" : empItems.length > 0 ? "warning" : "ok",
      count: activeEmployees.length,
      details: t("erpnext_overview.active_of_total", { active: activeEmployees.length, total: employees.length }),
      items: empItems,
    });

    // ─── 3. Timesheets / Uren ───
    try {
      const year = new Date().getFullYear();
      const timesheets = await fetchAll<{
        employee: string; employee_name: string; total_hours: number; start_date: string; docstatus: number;
      }>("Timesheet", [
        "employee", "employee_name", "total_hours", "start_date", "docstatus",
      ], [
        ["start_date", ">=", `${year}-01-01`],
        ["docstatus", "!=", 2],
      ]);

      // Per employee stats
      const empMap = new Map<string, TimesheetInfo>();
      for (const ts of timesheets) {
        const existing = empMap.get(ts.employee);
        if (existing) {
          existing.count++;
          existing.totalHours += ts.total_hours || 0;
          if (ts.start_date > existing.lastDate) existing.lastDate = ts.start_date;
        } else {
          empMap.set(ts.employee, {
            employee: ts.employee,
            employee_name: ts.employee_name,
            count: 1,
            totalHours: ts.total_hours || 0,
            lastDate: ts.start_date || "",
          });
        }
      }

      const tsItems: CheckItem[] = [];
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];

      // Check which active employees have NO timesheets this year
      const noTimesheets = activeEmployees.filter(e => !empMap.has(e.name));
      if (noTimesheets.length > 0) {
        tsItems.push({
          label: t("erpnext_overview.no_hours_in_year", { year }),
          status: "error",
          detail: noTimesheets.map(e => e.employee_name).join(", "),
        });
      }

      // Check which employees haven't logged hours in 2+ weeks
      const stale = activeEmployees.filter(e => {
        const info = empMap.get(e.name);
        return info && info.lastDate < twoWeeksAgo;
      });
      if (stale.length > 0) {
        tsItems.push({
          label: t("erpnext_overview.no_hours_2_weeks"),
          status: "warning",
          detail: stale.map(e => {
            const info = empMap.get(e.name);
            return t("erpnext_overview.employee_last_date", { name: e.employee_name, date: info?.lastDate || "?" });
          }).join(", "),
        });
      }

      // Per employee summary
      for (const emp of activeEmployees) {
        const info = empMap.get(emp.name);
        tsItems.push({
          label: emp.employee_name,
          status: !info ? "error" : info.lastDate < twoWeeksAgo ? "warning" : "ok",
          detail: info
            ? t("erpnext_overview.timesheet_summary", { count: info.count, hours: info.totalHours.toFixed(1), date: info.lastDate })
            : t("erpnext_overview.no_timesheets"),
        });
      }

      checks.push({
        label: t("erpnext_overview.timesheets_hours"),
        icon: Timer,
        status: noTimesheets.length > 0 ? "error" : stale.length > 0 ? "warning" : "ok",
        count: timesheets.length,
        details: t("erpnext_overview.timesheets_details", { count: timesheets.length, year, active: empMap.size, total: activeEmployees.length }),
        items: tsItems,
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.timesheets_hours"),
        icon: Timer,
        status: "error",
        details: t("erpnext_overview.timesheets_fetch_error"),
      });
    }

    // ─── 4. Verlof / Leave ───
    {
      const approvedLeaves = leaves.filter(l => l.status === "Approved");
      const pendingLeaves = leaves.filter(l => l.status === "Open");
      const leaveItems: CheckItem[] = [];

      // Check leave allocations
      try {
        const allocations = await fetchAll<{
          employee: string; employee_name: string; leave_type: string;
          total_leaves_allocated: number; from_date: string; to_date: string;
        }>("Leave Allocation", [
          "employee", "employee_name", "leave_type", "total_leaves_allocated", "from_date", "to_date",
        ], [["docstatus", "=", 1]]);

        const empWithAllocation = new Set(allocations.map(a => a.employee));
        const noAllocation = activeEmployees.filter(e => !empWithAllocation.has(e.name));

        if (noAllocation.length > 0) {
          leaveItems.push({
            label: t("erpnext_overview.no_leave_allocation"),
            status: "error",
            detail: noAllocation.map(e => e.employee_name).join(", "),
          });
        }

        // Group by leave type
        const typeMap = new Map<string, number>();
        for (const a of allocations) {
          typeMap.set(a.leave_type, (typeMap.get(a.leave_type) || 0) + 1);
        }
        for (const [type, count] of typeMap) {
          leaveItems.push({
            label: `${type}`,
            status: "ok",
            detail: t("erpnext_overview.allocations_count", { count }),
          });
        }

        checks.push({
          label: t("erpnext_overview.leave_and_allocations"),
          icon: CalendarCheck,
          status: noAllocation.length > 0 ? "error" : pendingLeaves.length > 3 ? "warning" : "ok",
          count: approvedLeaves.length,
          details: t("erpnext_overview.leave_summary", { approved: approvedLeaves.length, pending: pendingLeaves.length, allocations: allocations.length }),
          items: leaveItems,
        });
      } catch {
        checks.push({
          label: t("erpnext_overview.leave"),
          icon: CalendarCheck,
          status: "warning",
          count: leaves.length,
          details: t("erpnext_overview.leave_requests_found", { count: leaves.length }),
        });
      }
    }

    // ─── 5. Projecten ───
    {
      const openProjects = projects.filter(p => p.status === "Open");
      const completedProjects = projects.filter(p => p.status === "Completed");
      const projItems: CheckItem[] = [];

      const noCompany = openProjects.filter(p => !p.company);
      if (noCompany.length > 0) {
        projItems.push({
          label: t("erpnext_overview.without_company"),
          status: "warning",
          detail: noCompany.map(p => `${p.name} ${p.project_name}`).slice(0, 10).join(", ") +
            (noCompany.length > 10 ? ` ${t("erpnext_overview.more_count", { count: noCompany.length - 10 })}` : ""),
        });
      }

      const noCustomer = openProjects.filter(p => !p.customer_name);
      if (noCustomer.length > 0) {
        projItems.push({
          label: t("erpnext_overview.without_customer"),
          status: "warning",
          detail: noCustomer.map(p => `${p.name} ${p.project_name}`).slice(0, 10).join(", ") +
            (noCustomer.length > 10 ? ` ${t("erpnext_overview.more_count", { count: noCustomer.length - 10 })}` : ""),
        });
      }

      const noDates = openProjects.filter(p => !p.expected_start_date || !p.expected_end_date);
      if (noDates.length > 0) {
        projItems.push({
          label: t("erpnext_overview.without_dates"),
          status: "warning",
          detail: noDates.map(p => `${p.name} ${p.project_name}`).slice(0, 10).join(", ") +
            (noDates.length > 10 ? ` ${t("erpnext_overview.more_count", { count: noDates.length - 10 })}` : ""),
        });
      }

      checks.push({
        label: t("erpnext_overview.projects_label"),
        icon: FolderKanban,
        status: projItems.some(i => i.status === "error") ? "error" : projItems.length > 0 ? "warning" : "ok",
        count: openProjects.length,
        details: t("erpnext_overview.projects_details", { open: openProjects.length, completed: completedProjects.length, total: projects.length }),
        items: projItems,
      });
    }

    // ─── 6. Facturen ───
    try {
      const [salesCount, purchaseCount, unpaidSales] = await Promise.all([
        fetchCount("Sales Invoice", [["docstatus", "=", 1]]),
        fetchCount("Purchase Invoice", [["docstatus", "=", 1]]),
        fetchCount("Sales Invoice", [["docstatus", "=", 1], ["outstanding_amount", ">", 0]]),
      ]);

      checks.push({
        label: t("erpnext_overview.invoices_label"),
        icon: FileText,
        status: salesCount > 0 ? "ok" : "warning",
        count: salesCount + purchaseCount,
        details: t("erpnext_overview.invoices_details", { salesCount, purchaseCount, unpaidSales }),
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.invoices_label"),
        icon: FileText,
        status: "warning",
        details: t("erpnext_overview.invoices_fetch_error"),
      });
    }

    // ─── 7. Expense Claims ───
    try {
      const [totalExpense, pendingExpense] = await Promise.all([
        fetchCount("Expense Claim", [["docstatus", "!=", 2]]),
        fetchCount("Expense Claim", [["approval_status", "=", "Draft"]]),
      ]);
      checks.push({
        label: t("erpnext_overview.expense_claims"),
        icon: Receipt,
        status: totalExpense > 0 ? "ok" : "warning",
        count: totalExpense,
        details: t("erpnext_overview.expense_summary", { total: totalExpense, draft: pendingExpense }),
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.expense_claims"),
        icon: Receipt,
        status: "warning",
        details: t("erpnext_overview.expense_fetch_error"),
      });
    }

    // ─── 8. Activity Types ───
    try {
      const actTypes = await fetchList<{ name: string }>("Activity Type", {
        fields: ["name"],
        limit_page_length: 0,
      });
      const items: CheckItem[] = actTypes.map(a => ({
        label: a.name,
        status: "ok" as const,
        detail: "",
      }));
      checks.push({
        label: t("erpnext_overview.activity_types"),
        icon: Clock,
        status: actTypes.length > 0 ? "ok" : "error",
        count: actTypes.length,
        details: actTypes.length > 0
          ? t("erpnext_overview.types_list", { count: actTypes.length, names: actTypes.map(a => a.name).join(", ") })
          : t("erpnext_overview.no_activity_types"),
        items: items.length > 5 ? items : undefined,
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.activity_types"),
        icon: Clock,
        status: "warning",
        details: t("erpnext_overview.activity_types_fetch_error"),
      });
    }

    // ─── 9. Leave Types ───
    try {
      const leaveTypes = await fetchList<{ name: string; max_leaves_allowed: number; is_carry_forward: number }>("Leave Type", {
        fields: ["name", "max_leaves_allowed", "is_carry_forward"],
        limit_page_length: 0,
      });
      const ltItems: CheckItem[] = leaveTypes.map(lt => ({
        label: lt.name,
        status: "ok" as const,
        detail: t("erpnext_overview.leave_type_detail", {
          max: lt.max_leaves_allowed || t("erpnext_overview.unlimited"),
          carry: lt.is_carry_forward ? t("common.yes") : t("common.no"),
        }),
      }));
      checks.push({
        label: t("erpnext_overview.leave_types"),
        icon: CalendarCheck,
        status: leaveTypes.length > 0 ? "ok" : "error",
        count: leaveTypes.length,
        details: leaveTypes.length > 0
          ? t("erpnext_overview.types_list", { count: leaveTypes.length, names: leaveTypes.map(lt => lt.name).join(", ") })
          : t("erpnext_overview.no_leave_types"),
        items: ltItems,
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.leave_types"),
        icon: CalendarCheck,
        status: "warning",
        details: t("erpnext_overview.leave_types_fetch_error"),
      });
    }

    // ─── 10. Emailondertekeningen ───
    // Express-only endpoint (/api/mail/signature) — doesn't exist on the
    // standalone ERPNext deployment. This diagnostic is non-core (one of
    // several config checks), so it's gated behind the "webmail" capability
    // and silently skipped (no module card) when disabled, same as the
    // dashboard's email widget.
    if (isFeatureEnabled("webmail")) try {
      const sigItems: CheckItem[] = [];
      let withSig = 0;
      let withoutSig = 0;

      for (const emp of activeEmployees) {
        const email = emp.company_email || emp.user_id;
        if (!email) {
          sigItems.push({
            label: emp.employee_name,
            status: "warning",
            detail: t("erpnext_overview.no_email_linked"),
          });
          withoutSig++;
          continue;
        }
        try {
          const res = await fetch(`/api/mail/signature?email=${encodeURIComponent(email)}`, { credentials: "same-origin" });
          if (res.ok) {
            const json = await res.json();
            const sig = json?.data?.signature;
            const source = json?.data?.source;
            if (sig) {
              withSig++;
              sigItems.push({
                label: emp.employee_name,
                status: "ok",
                detail: t("erpnext_overview.signature_source", { source, email }),
              });
            } else {
              withoutSig++;
              sigItems.push({
                label: emp.employee_name,
                status: "error",
                detail: t("erpnext_overview.no_signature_found", { email }),
              });
            }
          } else {
            withoutSig++;
            sigItems.push({
              label: emp.employee_name,
              status: "error",
              detail: t("erpnext_overview.fetch_error", { email }),
            });
          }
        } catch {
          withoutSig++;
          sigItems.push({
            label: emp.employee_name,
            status: "error",
            detail: t("erpnext_overview.signature_fetch_error", { email }),
          });
        }
      }

      checks.push({
        label: t("erpnext_overview.email_signatures"),
        icon: Mail,
        status: withoutSig === 0 ? "ok" : withSig === 0 ? "error" : "warning",
        count: withSig,
        details: t("erpnext_overview.signatures_summary", { withSig, total: activeEmployees.length }),
        items: sigItems,
      });
    } catch {
      checks.push({
        label: t("erpnext_overview.email_signatures"),
        icon: Mail,
        status: "warning",
        details: t("erpnext_overview.signatures_check_error"),
      });
    }

    setModules(checks);
    setLoading(false);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "ok": return <CheckCircle2 size={16} className="text-emerald-500" />;
      case "warning": return <AlertTriangle size={16} className="text-amber-500" />;
      case "error": return <XCircle size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-slate-400 animate-pulse" />;
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case "ok": return "bg-emerald-50 border-emerald-200";
      case "warning": return "bg-amber-50 border-amber-200";
      case "error": return "bg-red-50 border-red-200";
      default: return "bg-slate-50 border-slate-200";
    }
  };

  const okCount = modules.filter(m => m.status === "ok").length;
  const warnCount = modules.filter(m => m.status === "warning").length;
  const errCount = modules.filter(m => m.status === "error").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <ClipboardList size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t("erpnext_overview.title")}</h1>
            <p className="text-sm text-slate-500">{t("financial.config_overview")}</p>
          </div>
        </div>
        <button
          onClick={() => runChecks()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? t("erpnext_overview.checking") : t("erpnext_overview.recheck")}
        </button>
      </div>

      {/* Summary KPIs */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-700">{okCount}</p>
              <p className="text-xs text-emerald-600">{t("erpnext_overview.in_order")}</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={28} className="text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{warnCount}</p>
              <p className="text-xs text-amber-600">{t("erpnext_overview.attention_points")}</p>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle size={28} className="text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-700">{errCount}</p>
              <p className="text-xs text-red-600">{t("erpnext_overview.action_required")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && modules.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-indigo-400 mx-auto" />
            <p className="text-sm text-slate-500">{t("erpnext_overview.checking_config")}</p>
          </div>
        </div>
      )}

      {/* Module cards */}
      <div className="space-y-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isExpanded = expanded.has(mod.label);
          const hasItems = mod.items && mod.items.length > 0;

          return (
            <div key={mod.label} className={`border rounded-xl overflow-hidden ${statusBg(mod.status)}`}>
              <button
                onClick={() => hasItems && toggle(mod.label)}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left ${hasItems ? "cursor-pointer hover:bg-white/30" : ""}`}
              >
                <Icon size={20} className="text-slate-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{mod.label}</span>
                    {mod.count !== undefined && (
                      <span className="text-xs font-mono bg-white/60 px-2 py-0.5 rounded-full text-slate-600">
                        {mod.count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{mod.details}</p>
                </div>
                {statusIcon(mod.status)}
                {hasItems && (
                  <span className="text-slate-400 ml-1">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                )}
              </button>

              {/* Expanded detail items */}
              {isExpanded && mod.items && (
                <div className="border-t border-white/50 bg-white/40 px-5 py-3 space-y-2">
                  {mod.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {statusIcon(item.status)}
                      <div className="min-w-0">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        {item.detail && (
                          <span className="text-slate-500 ml-1.5">{item.detail}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
