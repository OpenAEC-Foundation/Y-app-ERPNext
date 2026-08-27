/**
 * Shared invoice validation warnings.
 *
 * Used by both ToInvoice (pre-invoice check) and Timesheets Goedkeuren.
 * Import this module instead of duplicating validation logic.
 */

// Re-export the types so consumers only need one import
export type { ValidationWarning } from "./timesheetValidation";
export { warningTypeLabels, WARN_HL, ERR_HL } from "./timesheetValidation";

// ─── Invoice-specific warning types ───

export type InvoiceWarningType =
  | "draft_timesheets"
  | "company_mismatch"
  | "no_project"
  | "no_activity_type"
  | "no_customer"
  | "missing_billing_rate"
  | "billed_check"
  | "already_on_draft_si";

export interface InvoiceWarning {
  type: InvoiceWarningType;
  severity: "error" | "warning" | "info";
  message: string;
  details?: string;
  /** If true, this warning blocks invoice creation (user must fix first) */
  blocking: boolean;
}

export const invoiceWarningLabels: Record<InvoiceWarningType, { label: string; color: string }> = {
  draft_timesheets:     { label: "Draft timesheets",   color: "bg-red-100 text-red-800" },
  company_mismatch:     { label: "Bedrijf mismatch",   color: "bg-red-100 text-red-800" },
  no_project:           { label: "Geen project",       color: "bg-amber-100 text-amber-800" },
  no_activity_type:     { label: "Geen activiteit",    color: "bg-red-100 text-red-800" },
  no_customer:          { label: "Geen klant",         color: "bg-red-100 text-red-800" },
  missing_billing_rate: { label: "Geen tarief",        color: "bg-amber-100 text-amber-800" },
  billed_check:         { label: "Al gefactureerd",    color: "bg-red-100 text-red-800" },
  already_on_draft_si:  { label: "Op concept factuur", color: "bg-red-100 text-red-800" },
};

// ─── Config flags ───

/** Set to false to enable custom_is_billed check (production mode) */
export const SKIP_BILLED_CHECK = false;

// ─── Types for validation input ───

export interface InvoiceRow {
  key: string;
  project: string;
  projectName: string;
  projectCompany: string;
  customer: string;
  employeeName: string;
  employeeCompany: string;
  activityType: string;
  hours: number;
  toTime: string;
  billingHours: number;
  isBillable: boolean;
  isBilled: boolean;
  customIsBilled: boolean;
  salesInvoice: string;
  task: string;
  taskName: string;
  taskBilling: string;
  tsName: string;
}

export interface InvoiceValidationContext {
  /** Currently selected company in the frontend */
  company: string;
  /** Activity type → billing_rate lookup */
  billingRates: Map<string, number>;
  /** Draft timesheet names for the selected projects */
  draftTimesheetNames: string[];
}

// ─── Main validation function ───

/**
 * Run pre-invoice validation on selected rows.
 * Returns a list of warnings — some blocking, some informational.
 */
export function runInvoiceValidation(
  rows: InvoiceRow[],
  ctx: InvoiceValidationContext,
): InvoiceWarning[] {
  const warnings: InvoiceWarning[] = [];

  // 1. Draft timesheets in selection
  // TODO: zet blocking terug op true na testfase
  if (ctx.draftTimesheetNames.length > 0) {
    warnings.push({
      type: "draft_timesheets",
      severity: "warning",
      message: `${ctx.draftTimesheetNames.length} timesheet(s) in Draft — deze moeten eerst goedgekeurd worden`,
      details: ctx.draftTimesheetNames.join(", "),
      blocking: false,
    });
  }

  // 2. Group by project for project-level checks
  const projectGroups = new Map<string, InvoiceRow[]>();
  for (const r of rows) {
    const key = r.project || "(geen)";
    if (!projectGroups.has(key)) projectGroups.set(key, []);
    projectGroups.get(key)!.push(r);
  }

  // 3. Rows without project
  const noProject = rows.filter(r => !r.project);
  if (noProject.length > 0) {
    const hrs = noProject.reduce((s, r) => s + r.hours, 0);
    warnings.push({
      type: "no_project",
      severity: "error",
      message: `${noProject.length} regel(s) zonder project (${hrs.toFixed(1)} uur) — kan geen factuur aanmaken`,
      details: noProject.map(r => `${r.employeeName}: ${r.hours.toFixed(1)}u`).join(", "),
      blocking: true,
    });
  }

  // 4. Per-project checks
  for (const [projId, projRows] of projectGroups) {
    if (projId === "(geen)") continue;

    const first = projRows[0];

    // No customer linked to project
    if (!first.customer) {
      warnings.push({
        type: "no_customer",
        severity: "error",
        message: `Project ${first.projectName || projId} heeft geen klant — factuur kan niet worden aangemaakt`,
        blocking: true,
      });
    }

    // Company mismatch: employee company ≠ project company
    const mismatched = projRows.filter(r => r.employeeCompany && r.projectCompany && r.employeeCompany !== r.projectCompany);
    if (mismatched.length > 0) {
      const emps = [...new Set(mismatched.map(r => r.employeeName))];
      warnings.push({
        type: "company_mismatch",
        severity: "warning",
        message: `${first.projectName || projId}: ${emps.length} medewerker(s) van andere company`,
        details: emps.join(", "),
        blocking: false,
      });
    }
  }

  // 5. Rows without activity type
  const noActivity = rows.filter(r => !r.activityType);
  if (noActivity.length > 0) {
    warnings.push({
      type: "no_activity_type",
      severity: "error",
      message: `${noActivity.length} regel(s) zonder activiteitstype`,
      details: noActivity.map(r => `${r.employeeName}: ${r.tsName}`).join(", "),
      blocking: true,
    });
  }

  // 6. Missing billing rates
  const activityTypes = [...new Set(rows.map(r => r.activityType).filter(Boolean))];
  const missingRates = activityTypes.filter(at => !ctx.billingRates.has(at) || ctx.billingRates.get(at) === 0);
  if (missingRates.length > 0) {
    warnings.push({
      type: "missing_billing_rate",
      severity: "warning",
      message: `Geen tarief gevonden voor: ${missingRates.join(", ")}`,
      details: "Factuurregels worden aangemaakt met tarief €0. Pas dit handmatig aan in ERPNext.",
      blocking: false,
    });
  }

  // 7. Rows already on a draft SI (custom_is_billed) — always warn, never blocking
  const onDraftSI = rows.filter(r => r.customIsBilled);
  if (onDraftSI.length > 0) {
    const hrs = onDraftSI.reduce((s, r) => s + r.hours, 0);
    warnings.push({
      type: "already_on_draft_si",
      severity: "warning",
      message: `${onDraftSI.length} regel(s) staan reeds op een Concept Verkoopfactuur (${hrs.toFixed(1)} uur)`,
      details: onDraftSI.map(r => `${r.employeeName}: ${r.tsName} ${r.hours.toFixed(1)}u`).join(", "),
      blocking: false,
    });
  }

  // 8. Already-billed check (skippable via SKIP_BILLED_CHECK)
  if (!SKIP_BILLED_CHECK) {
    const alreadyBilled = rows.filter(r => r.isBilled || r.salesInvoice);
    if (alreadyBilled.length > 0) {
      warnings.push({
        type: "billed_check",
        severity: "error",
        message: `${alreadyBilled.length} regel(s) zijn al gefactureerd (custom_is_billed)`,
        details: alreadyBilled.map(r => `${r.employeeName}: ${r.tsName} → ${r.salesInvoice}`).join(", "),
        blocking: true,
      });
    }
  }

  return warnings;
}
