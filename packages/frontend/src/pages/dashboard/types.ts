/**
 * Shared types and helpers used across the dashboard widgets.
 */

export interface Task {
  name: string;
  subject: string;
  status: string;
  workflow_state?: string;
  priority: string;
  assigned_to: string;
  project: string;
  exp_end_date: string;
  description?: string;
}

export interface WidgetPlacement {
  id: string;
  col: number;
}

export type WidgetVisibility = "all" | "employer" | "employee";

export const statusBadge: Record<string, string> = {
  Open: "bg-y-teal/10 text-y-teal-dark",
  Working: "bg-yellow-100 text-yellow-700",
  "Pending Review": "bg-purple-100 text-purple-700",
  Overdue: "bg-red-100 text-red-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-slate-100 text-slate-600",
};

export const priorityDot: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-slate-400",
};

export function isOverdue(date: string): boolean {
  if (!date) return false;
  return new Date(date) < new Date(new Date().toDateString());
}

/** Convert email to display name (used across multiple widgets) */
export function formatDisplayName(email: string): string {
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
