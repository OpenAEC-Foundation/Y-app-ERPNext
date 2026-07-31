import { useEffect, useMemo, useState } from "react";
import { getActiveEmployee } from "./instances";
import type { Employee } from "./DataContext";

/**
 * Resolve "who am I" as an Employee *ID* (e.g. "HR-EMP-00001"), for sites
 * where the "Standaard medewerker" instance setting (getActiveEmployee()) is
 * not configured.
 *
 * Several widgets (uren boeken, km-overzicht, ...) used to key everything
 * off getActiveEmployee() alone. On instances/sessions without that setting
 * — which is the common case for a fresh login — they'd silently render an
 * empty "Selecteer een medewerker" state forever, even though the logged-in
 * ERPNext user often *does* have a matching Employee record. This mirrors
 * the resolution chain already used for `myEmail` in Tasks.tsx and
 * dashboard/MyTodoList.tsx, but resolves to the Employee doctype name
 * instead of an email address (Timesheet.employee / Travel Request.employee
 * both reference the Employee ID, not an email).
 *
 * Priority: explicit "default employee" setting → ERPNext session user_id
 * match → full-name match → "" (nothing resolved).
 */
export function useSessionEmployeeId(employees: Employee[]): string {
  const defaultEmployeeId = getActiveEmployee();
  const [erpnextUsername, setErpnextUsername] = useState("");
  const [erpnextFullName, setErpnextFullName] = useState("");

  useEffect(() => {
    if (defaultEmployeeId) return; // already resolved, skip the session lookup
    fetch("/api/method/frappe.auth.get_logged_user", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        const username = d?.message;
        if (!username || username === "Guest") return;
        setErpnextUsername(username);
        try {
          const userRes = await fetch(`/api/resource/User/${encodeURIComponent(username)}`, { credentials: "same-origin" });
          if (userRes.ok) {
            const userBody = await userRes.json();
            if (userBody?.data?.full_name) setErpnextFullName(userBody.data.full_name);
          }
        } catch {
          // full_name is a nice-to-have; username-only matching still works
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultEmployeeId]);

  return useMemo(() => {
    if (defaultEmployeeId) return defaultEmployeeId;
    if (erpnextUsername) {
      const emp = employees.find((e) => e.user_id?.toLowerCase() === erpnextUsername.toLowerCase());
      if (emp) return emp.name;
    }
    if (erpnextFullName) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const fullNameNorm = normalize(erpnextFullName);
      const emp = employees.find((e) => normalize(e.employee_name) === fullNameNorm);
      if (emp) return emp.name;
    }
    return "";
  }, [employees, defaultEmployeeId, erpnextUsername, erpnextFullName]);
}
