/**
 * Background prefetch — warms the response cache for commonly visited pages.
 * Called after the current page's data has loaded.
 * All calls go through fetchList/fetchDocument which cache responses for 30s.
 *
 * Role gating: each prefetch fetches a specific ERPNext doctype, and most
 * doctypes require specific roles to read. Without gating, a user without
 * (e.g.) Sales access would still trigger a Sales Invoice fetch, ERPNext
 * would 403, the fetch would silently fail, but the network tab + console
 * would fill with errors. With gating, we skip fetches the user obviously
 * can't access. System Manager / Administrator bypass — they can read
 * everything. Doctypes not in the map (Task, Project, Timesheet, ToDo,
 * Activity Type, Event) are universally readable and don't get gated.
 */

import { fetchList } from "./erpnext";
import { fetchKmRegistraties } from "./declaraties";
import { getActiveCompany, getActiveEmployee } from "./instances";

const DOCTYPE_REQUIRED_ROLES: Record<string, string[]> = {
  "Sales Invoice": ["Sales User", "Sales Manager", "Accounts User", "Accounts Manager"],
  "Purchase Invoice": ["Purchase User", "Purchase Manager", "Accounts User", "Accounts Manager"],
  "Quotation": ["Sales User", "Sales Manager"],
  "Leave Allocation": ["HR User", "HR Manager"],
  "Shift Plan Assignment": ["HR User", "HR Manager"],
};

function canFetch(doctype: string, userRoles: string[]): boolean {
  // System Manager / Administrator can read everything
  if (userRoles.includes("System Manager") || userRoles.includes("Administrator")) return true;
  const required = DOCTYPE_REQUIRED_ROLES[doctype];
  if (!required) return true; // ungated doctype — anyone can try
  return required.some(role => userRoles.includes(role));
}

let prefetched = false;

/** Prefetch data for common pages in the background (non-blocking) */
export function prefetchCommonData(currentPage: string, userRoles: string[] = []) {
  if (prefetched) return;
  prefetched = true;

  const company = getActiveCompany();
  const employee = getActiveEmployee();

  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = (fn: () => void) => {
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(fn, { timeout: 5000 });
    } else {
      setTimeout(fn, 1000);
    }
  };

  schedule(() => {
    const tasks: Promise<unknown>[] = [];

    // Preload heavy page chunks so lazy-loading is instant on navigation
    import("../pages/Planning").catch(() => {});
    import("../pages/Tasks").catch(() => {});
    import("../pages/Timesheets").catch(() => {});
    import("../pages/Projects").catch(() => {});
    import("../pages/SalesInvoices").catch(() => {});

    // Skip prefetching the current page (it's already loading)
    if (currentPage !== "tasks") {
      tasks.push(
        fetchList("Task", {
          fields: ["name", "subject", "status", "workflow_state", "priority", "_assign as assigned_to", "project", "exp_end_date", "description", "company"],
          filters: company ? [["company", "=", company], ["status", "not in", ["Cancelled", "Template"]]] : [["status", "not in", ["Cancelled", "Template"]]],
          limit_page_length: 300,
          order_by: "modified desc",
        }).catch(() => {})
      );
    }

    if (currentPage !== "timesheets") {
      tasks.push(
        fetchList("Timesheet", {
          fields: ["name", "employee", "employee_name", "start_date", "end_date", "total_hours", "status", "docstatus"],
          filters: [["docstatus", "!=", 2]],
          limit_page_length: 200,
          order_by: "start_date desc",
        }).catch(() => {})
      );
    }

    if (currentPage !== "sales" && canFetch("Sales Invoice", userRoles)) {
      tasks.push(
        fetchList("Sales Invoice", {
          fields: ["name", "customer_name", "posting_date", "due_date", "grand_total", "net_total", "outstanding_amount", "status", "docstatus", "contact_email"],
          filters: [["docstatus", "=", 1], ["outstanding_amount", ">", 0]],
          limit_page_length: 200,
          order_by: "posting_date desc",
        }).catch(() => {})
      );
    }

    if (currentPage !== "projects") {
      // Projects data comes from DataContext, but timesheet hours need fetching
      tasks.push(
        fetchList("Timesheet", {
          fields: ["name", "employee_name"],
          limit_page_length: 2000,
        }).catch(() => {})
      );
    }

    // ToDo's (for dashboard)
    if (currentPage !== "dashboard" && employee) {
      tasks.push(
        fetchList("ToDo", {
          fields: ["name", "description", "status", "priority", "date", "reference_type", "reference_name", "allocated_to", "assigned_by", "color"],
          filters: [["status", "=", "Open"]],
          limit_page_length: 100,
          order_by: "modified desc",
        }).catch(() => {})
      );
    }

    // Planning page tasks
    if (currentPage !== "planning") {
      tasks.push(
        fetchList("Task", {
          fields: ["name", "subject", "status", "priority", "project", "exp_start_date", "exp_end_date"],
          filters: [["status", "not in", ["Completed", "Cancelled"]]],
          limit_page_length: 500,
          order_by: "modified desc",
        }).catch(() => {})
      );
    }

    // Kilometers (km-widget op het dashboard + de onkostenpagina). Draait op
    // Y-next' eigen doctype; geen rolcheck nodig, want het provisioningscript
    // geeft Employee en Projects User leesrecht en `if_owner` doet de
    // afscherming — zie lib/declaraties.ts.
    if (currentPage !== "expenses" && employee) {
      tasks.push(
        fetchKmRegistraties({ employee, limit: 10 }).catch(() => {})
      );
    }

    // Quotations
    if (currentPage !== "quotations" && canFetch("Quotation", userRoles)) {
      tasks.push(
        fetchList("Quotation", {
          fields: ["name", "party_name", "transaction_date", "grand_total", "status", "docstatus"],
          filters: [["docstatus", "!=", 2]],
          limit_page_length: 200,
          order_by: "transaction_date desc",
        }).catch(() => {})
      );
    }

    // Purchase Invoices
    if (currentPage !== "purchase" && canFetch("Purchase Invoice", userRoles)) {
      tasks.push(
        fetchList("Purchase Invoice", {
          fields: ["name", "supplier_name", "posting_date", "grand_total", "outstanding_amount", "status", "docstatus"],
          filters: [["docstatus", "!=", 2]],
          limit_page_length: 200,
          order_by: "posting_date desc",
        }).catch(() => {})
      );
    }

    // Leave (Leave Application is universally readable; Leave Allocation
    // and Shift Plan Assignment require HR roles).
    if (currentPage !== "leave") {
      tasks.push(
        fetchList("Leave Application", {
          fields: ["name", "employee", "employee_name", "leave_type", "from_date", "to_date", "total_leave_days", "status"],
          filters: [],
          limit_page_length: 200,
          order_by: "from_date desc",
        }).catch(() => {})
      );
      if (canFetch("Leave Allocation", userRoles)) {
        tasks.push(
          fetchList("Leave Allocation", {
            fields: ["name", "employee", "leave_type", "total_leaves_allocated", "new_leaves_allocated"],
            filters: [],
            limit_page_length: 100,
          }).catch(() => {})
        );
      }
      if (canFetch("Shift Plan Assignment", userRoles)) {
        tasks.push(
          fetchList("Shift Plan Assignment", {
            fields: ["name", "employee", "shift_plan", "year"],
            filters: [],
            limit_page_length: 100,
          }).catch(() => {})
        );
      }
    }

    // Activity Type (for employees + uren boeken)
    tasks.push(
      fetchList("Activity Type", {
        fields: ["name", "activity_type"],
        limit_page_length: 100,
      }).catch(() => {})
    );

    // Agenda — prefetch current week's events, tasks, timesheets
    if (currentPage !== "calendar") {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const start = mon.toISOString().split("T")[0];
      const end = sun.toISOString().split("T")[0];
      tasks.push(
        fetchList("Event", {
          fields: ["name", "subject", "starts_on", "ends_on", "all_day", "event_type", "description", "location"],
          filters: [["starts_on", ">=", start], ["starts_on", "<=", end + " 23:59:59"], ["status", "=", "Open"]],
          limit_page_length: 200,
          order_by: "starts_on asc",
        }).catch(() => {})
      );
    }

    // Run all prefetches in parallel (errors silently caught)
    Promise.allSettled(tasks);
  });
}

/** Reset prefetch flag (call when instance changes) */
export function resetPrefetch() {
  prefetched = false;
}
