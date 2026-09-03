import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { fetchList, fetchAll, ApiError } from "./erpnext";
import { prefetchCommonData } from "./prefetch";

/* ─── Types ─── */

export interface Company {
  name: string;
  company_name: string;
  abbr: string;
}

export interface Employee {
  name: string;
  employee_name: string;
  designation: string;
  department: string;
  company: string;
  status: string;
  user_id: string;
  company_email: string;
  date_of_birth: string;
  date_of_joining?: string;
  contract_end_date?: string;
  image: string;
  default_activity_type?: string;
}

export interface ProjectRecord {
  name: string;
  project_name: string;
  status: string;
  percent_complete: number;
  expected_start_date: string;
  expected_end_date: string;
  company: string;
  custom_address?: string;
  customer?: string;
  customer_name?: string;
  custom_project_manager?: string;
  custom_project_manager_company?: string;
  sales_order?: string;
  custom_customer_reference?: string;
}

export interface CustomerRecord {
  name: string;
  customer_name: string;
}

export interface LeaveRecord {
  name: string;
  employee: string;
  employee_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  total_leave_days: number;
  status: string;
  company: string;
  /** 0 = concept (niet ingediend), 1 = ingediend, 2 = geannuleerd. */
  docstatus?: 0 | 1 | 2;
}

interface DataStore {
  companies: Company[];
  employees: Employee[];
  projects: ProjectRecord[];
  leaves: LeaveRecord[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataStore | null>(null);

/* ─── Provider ─── */

const REFRESH_INTERVAL = 5 * 60_000; // 5 min (was 60s)

export function DataProvider({ children, userRoles }: { children: ReactNode; userRoles?: string[] }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const initialDone = useRef(false);
  const lastFetchRef = useRef(0);

  const refreshData = useCallback(async () => {
    // Throttle: na de eerste load niet vaker dan 1×/60s daadwerkelijk
    // refetchen. De `visibilitychange`/`focus`-listeners roepen refreshData
    // bij elke tab-focus aan; zonder deze rem jaagt dat ERPNext in een
    // request-storm (gemeten: 143× in 45 min). De 5-min-interval ligt ruim
    // boven de gap, dus normale refreshes lopen gewoon door.
    const now = Date.now();
    if (initialDone.current && now - lastFetchRef.current < 60_000) return;
    lastFetchRef.current = now;
    // Only show loading spinner on initial fetch
    if (!initialDone.current) setLoading(true);

    // Fetch each independently so one failure doesn't block the rest
    const [compResult, empResult, projResult, custResult, leaveResult] = await Promise.allSettled([
      fetchList<Company>("Company", {
        fields: ["name", "company_name", "abbr"],
        // Uitgeschakelde bedrijven horen niet in een keuzelijst; hun boekingen
        // blijven wel bestaan. Het vinkje staat op de Company in ERPNext.
        filters: [["disabled", "=", 0]],
        limit_page_length: 0,
      }),
      // Fetch employees
      fetchAll<Employee>(
        "Employee",
        ["name", "employee_name", "designation", "department", "company", "status", "user_id", "company_email", "date_of_birth", "date_of_joining", "contract_end_date", "image"],
        [],
        "employee_name asc"
      ),
      // Project doctype has `customer` (Link) but not `customer_name` — we resolve
      // it client-side via the Customer fetch below so search + list show readable names.
      fetchAll<ProjectRecord>(
        "Project",
        ["name", "project_name", "status", "percent_complete", "expected_start_date", "expected_end_date", "company", "custom_address", "customer", "custom_project_manager", "custom_project_manager_company", "sales_order", "custom_customer_reference"],
        [],
        "creation desc"
      ).catch(() =>
        fetchAll<ProjectRecord>(
          "Project",
          ["name", "project_name", "status", "percent_complete", "expected_start_date", "expected_end_date", "company", "custom_address", "customer", "sales_order"],
          [],
          "creation desc"
        )
      ).catch(() =>
        fetchAll<ProjectRecord>(
          "Project",
          ["name", "project_name", "status", "percent_complete", "expected_start_date", "expected_end_date", "company", "sales_order"],
          [],
          "creation desc"
        )
      ),
      fetchList<CustomerRecord>("Customer", {
        fields: ["name", "customer_name"],
        filters: [["disabled", "=", 0]],
        limit_page_length: 0,
        order_by: "customer_name asc",
      }),
      fetchAll<LeaveRecord>(
        "Leave Application",
        ["name", "employee", "employee_name", "leave_type", "from_date", "to_date", "total_leave_days", "status", "company", "docstatus"],
        [],
        "from_date asc"
      ),
    ]);

    if (compResult.status === "fulfilled") setCompanies(compResult.value);
    else console.error("Company fetch error:", compResult.reason);

    if (empResult.status === "fulfilled") setEmployees(empResult.value);
    else console.error("Employee fetch error:", empResult.reason);

    if (projResult.status === "fulfilled") {
      const rawProjects = projResult.value;
      const custMap = custResult.status === "fulfilled"
        ? new Map(custResult.value.map((c) => [c.name, c.customer_name]))
        : new Map<string, string>();
      const enriched = rawProjects.map((p) =>
        p.customer ? { ...p, customer_name: custMap.get(p.customer) || p.customer } : p
      );
      setProjects(enriched);
    } else {
      console.error("Project fetch error:", projResult.reason);
    }

    if (leaveResult.status === "fulfilled") setLeaves(leaveResult.value);
    else if (leaveResult.reason instanceof ApiError && leaveResult.reason.status === 404) {
      // "Leave Application" doesn't exist on instances without the HRMS
      // app installed — leave the list empty and let the leave widgets
      // fall back to their normal empty state, no console spam.
      setLeaves([]);
    } else {
      console.error("Leave fetch error:", leaveResult.reason);
    }

    if (!initialDone.current) {
      initialDone.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const id = setInterval(refreshData, REFRESH_INTERVAL);
    // Also refresh when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", handleVisibility); };
  }, [refreshData]);

  // Background prefetch — fired separately from refreshData so it can wait
  // for userRoles to arrive before kicking off. Otherwise role-gated
  // doctypes (Sales Invoice, Quotation, Travel Request, …) get skipped
  // on the very first prefetch and the user sees the prefetched 403s on
  // their next page navigation. Fires exactly once per DataProvider mount.
  // (DataProvider is keyed on instance, so this also re-runs on instance switch.)
  const prefetchFired = useRef(false);
  useEffect(() => {
    if (prefetchFired.current) return;
    // `undefined` = "roles not fetched yet, wait"; `[]` = "fetched, user
    // has no roles, proceed with empty role set" (most prefetches will
    // be gated out, which is correct).
    if (userRoles === undefined) return;
    prefetchFired.current = true;
    const currentPage = window.location.pathname.split("/")[1] || "dashboard";
    prefetchCommonData(currentPage, userRoles);
  }, [userRoles]);

  // Memo'iseer de context-value zodat consumers niet bij elke DataProvider-
  // render opnieuw renderen (de oude inline-object-literal maakte elke render
  // een nieuwe referentie → onnodige re-renders door de hele app).
  const value = useMemo(
    () => ({ companies, employees, projects, leaves, loading, refresh: refreshData }),
    [companies, employees, projects, leaves, loading, refreshData],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

/* ─── Hooks ─── */

export function useDataStore(): DataStore {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataStore must be used inside <DataProvider>");
  return ctx;
}

export function useCompanies(): Company[] {
  return useDataStore().companies;
}

export function useEmployees(): Employee[] {
  return useDataStore().employees;
}

export function useProjects(): ProjectRecord[] {
  return useDataStore().projects;
}

export function useLeaves(): LeaveRecord[] {
  return useDataStore().leaves;
}

export function useDataLoading(): boolean {
  return useDataStore().loading;
}
