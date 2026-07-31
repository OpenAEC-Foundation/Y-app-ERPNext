/**
 * Shared activity types utility.
 *
 * - Employer: all Activity Types from ERPNext (for configuration in Settings)
 * - Employee: subset configured by employer via URL-match bridge, default ["Execution"]
 */

import { fetchList } from "./erpnext";

const DEFAULT_ACTIVITY_TYPES = ["Execution"];

/**
 * Fetch activity types based on view mode.
 *
 * Employer sees all types from ERPNext.
 * Employee sees only the types the employer configured, or default ["Execution"].
 */
export async function fetchActivityTypes(
  viewMode: "employer" | "employee",
): Promise<string[]> {
  if (viewMode === "employer") {
    const list = await fetchList<{ name: string }>("Activity Type", {
      fields: ["name"],
      limit_page_length: 0,
    });
    return list.map((a) => a.name);
  }

  // Employee: try employer-configured subset via URL-match bridge
  try {
    const res = await fetch("/api/shared-settings/activity-types", {
      credentials: "same-origin",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.value) && data.value.length > 0) {
        return data.value;
      }
    }
  } catch {
    // fall through to default
  }

  return DEFAULT_ACTIVITY_TYPES;
}

/**
 * Fetch the employer-configured activity type for a specific employee.
 *
 * Uses the shared-settings bridge so an employee account can read
 * the employer's per-employee configuration. Returns the default
 * "Execution" if nothing is configured.
 */
export async function fetchEmployeeActivityType(
  employeeId: string,
): Promise<string> {
  try {
    const res = await fetch("/api/shared-settings/employee-activity-types", {
      credentials: "same-origin",
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.value && data.value[employeeId]) {
        return data.value[employeeId];
      }
    }
  } catch {
    // fall through to default
  }
  return "Execution";
}
