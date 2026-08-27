/**
 * Icoon en ERPNext-route per connectiecategorie.
 *
 * Staat bewust náást de componenten en niet erin: een bestand dat zowel een
 * component als losse waarden exporteert, breekt React Fast Refresh (de
 * `react-refresh/only-export-components`-regel). Bovendien hebben zowel de
 * chips als de connectiekolom deze twee nodig.
 */

import { FolderKanban, Building2, ReceiptText, UserPlus, FileBarChart } from "lucide-react";
import { getErpNextLinkUrl } from "./erpnext.ts";
import type { ConnectionCategoryId } from "./mail-connections.ts";

/** Frappe's desk-route van een doctype: `Purchase Invoice` → `purchase-invoice`. */
export function erpDocPath(doctype: string, name: string): string {
  const slug = doctype.trim().toLowerCase().replace(/\s+/g, "-");
  return `${getErpNextLinkUrl()}/${slug}/${encodeURIComponent(name)}`;
}

export function connectionIcon(category: ConnectionCategoryId) {
  switch (category) {
    case "project": return FolderKanban;
    case "customer": return Building2;
    case "purchase-invoice": return ReceiptText;
    case "opportunity": return FileBarChart;
    case "lead": return UserPlus;
    default: return FolderKanban;
  }
}

/** Kleurstelling per categorie, zodat een chip en zijn rij in de kolom rijmen. */
export const CONNECTION_TONE: Record<ConnectionCategoryId, string> = {
  project: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  customer: "bg-sky-50 text-sky-700 hover:bg-sky-100",
  "purchase-invoice": "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  opportunity: "bg-purple-50 text-purple-700 hover:bg-purple-100",
  lead: "bg-violet-50 text-violet-700 hover:bg-violet-100",
  unlinked: "bg-slate-50 text-slate-600 hover:bg-slate-100",
};
