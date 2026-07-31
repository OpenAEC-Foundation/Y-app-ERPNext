import type { Page } from "../components/Sidebar";

/**
 * Module visibility configuration.
 * Stored in localStorage under key `enabled_modules`.
 *
 * Structure:
 *   sections: Record<sectionTitle, boolean>       -- toggle entire section
 *   items:    Record<pageId, boolean>              -- toggle individual items
 *
 * Missing keys default to `true` (enabled).
 */

export interface ModuleConfig {
  sections: Record<string, boolean>;
  items: Record<string, boolean>;
}

/** Items that can never be disabled */
export const ALWAYS_VISIBLE: Set<Page> = new Set(["dashboard", "settings", "messenger"]);

/** Canonical sidebar definition (mirrors Sidebar.tsx sections) used by Settings UI */
export interface SidebarModule {
  title: string;
  /** If false, the section header itself is not toggleable (top-level / bottom-level groups) */
  sectionToggleable: boolean;
  items: { id: Page; label: string }[];
}

export const SIDEBAR_MODULES: SidebarModule[] = [
  {
    title: "",
    sectionToggleable: false,
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "webmail", label: "E-mail" },
      { id: "contacts", label: "Contacten" },
      { id: "messenger", label: "Berichten" },
      { id: "calendar", label: "Agenda" },
      { id: "nextcloud-files", label: "Documenten" },
      { id: "financieel-dashboard", label: "Statistieken" },
    ],
  },
  {
    title: "Projecten",
    sectionToggleable: true,
    items: [
      { id: "projects", label: "Projecten" },
      { id: "quotations", label: "Offertes" },
      { id: "salesorders", label: "Verkooporders" },
      { id: "leads", label: "Leads" },
      { id: "meeting-notes", label: "Vergadernotities" },
      { id: "deliverynotes", label: "Leveringen" },
    ],
  },
  {
    title: "Taken & Planning",
    sectionToggleable: true,
    items: [
      { id: "tasks", label: "Taken" },
      { id: "subtasks", label: "Subtaken" },
      { id: "planning", label: "Planning" },
      { id: "timesheets", label: "Urenregistratie" },
      { id: "todo", label: "Todo" },
      { id: "wiki", label: "Kennisbank" },
    ],
  },
  {
    title: "Boekhouding",
    sectionToggleable: true,
    items: [
      { id: "ledgers", label: "Grootboeken" },
      { id: "bank-transactions", label: "Banktransacties" },
      { id: "sales", label: "Verkoopfacturen" },
      { id: "purchase", label: "Inkoopfacturen" },
      { id: "booking-program", label: "Boekingsprogramma" },
      { id: "btw", label: "BTW" },
      { id: "jaarrekening", label: "Jaarrekening" },
    ],
  },
  {
    title: "Financieel",
    sectionToggleable: true,
    items: [
      { id: "revenue", label: "Omzet" },
      { id: "outstanding", label: "Openstaand" },
      { id: "cost-insight", label: "Kosteninzicht" },
      { id: "profitability", label: "Rendabiliteit" },
      { id: "liquidity-planning", label: "Liquiditeitsplanning" },
      { id: "loonaangifte", label: "Loonaangifte" },
    ],
  },
  {
    title: "HR & Personeel",
    sectionToggleable: true,
    items: [
      { id: "employees", label: "Medewerkers" },
      { id: "leave", label: "Vakantie & Overuren" },
      { id: "todo", label: "Todo" },
      { id: "subtasks", label: "Subtaken" },
    ],
  },
  {
    title: "",
    sectionToggleable: false,
    items: [
      { id: "letters", label: "Brieven" },
      { id: "erpnext-overview", label: "Implementatie" },
      { id: "passwords", label: "Wachtwoorden" },
      { id: "settings", label: "Instellingen" },
    ],
  },
];

const STORAGE_KEY = "enabled_modules";

/**
 * Maps legacy Dutch page IDs to their renamed English equivalents.
 * Used to migrate persisted settings (localStorage `enabled_modules`,
 * server-side `employee-visible-modules`) after the v0.4.x rename.
 */
export const LEGACY_PAGE_ID_MIGRATION: Record<string, Page> = {
  "vakantieplanning": "leave",
  "onkosten": "expenses",
  "banktransacties": "bank-transactions",
  "boekingsprogramma": "booking-program",
  "brieven": "letters",
  "te-factureren": "to-invoice",
  "omzet": "revenue",
  "openstaand": "outstanding",
  "rendabiliteit": "profitability",
  "kosteninzicht": "cost-insight",
  "liquiditeitsplanning": "liquidity-planning",
  "grootboeken": "ledgers",
};

/** Rewrite a `pageId → boolean` map, replacing any legacy Dutch keys with the new English ones. */
export function migratePageIdMap<V>(input: Record<string, V> | undefined): Record<string, V> {
  const out: Record<string, V> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    const newKey = LEGACY_PAGE_ID_MIGRATION[key] ?? key;
    out[newKey] = value;
  }
  return out;
}

export function getModuleConfig(): ModuleConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ModuleConfig;
      const items = migratePageIdMap(parsed.items);
      const result: ModuleConfig = { sections: parsed.sections ?? {}, items };
      // If the migration changed any keys, persist the upgraded shape so
      // we never have to do it again for this user.
      if (JSON.stringify(items) !== JSON.stringify(parsed.items ?? {})) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      }
      return result;
    }
  } catch { /* ignore */ }
  return { sections: {}, items: {} };
}

export function setModuleConfig(config: ModuleConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Dispatch storage event so Sidebar picks up changes in the same tab
  window.dispatchEvent(new Event("modules-changed"));
}

/** Check whether a specific page item is enabled */
export function isItemEnabled(config: ModuleConfig, sectionTitle: string, itemId: Page): boolean {
  if (ALWAYS_VISIBLE.has(itemId)) return true;
  // If the whole section is disabled, the item is disabled
  if (sectionTitle && config.sections[sectionTitle] === false) return false;
  // Check item-level override
  if (config.items[itemId] === false) return false;
  return true;
}

/** Check whether an entire section is enabled */
export function isSectionEnabled(config: ModuleConfig, sectionTitle: string): boolean {
  if (!sectionTitle) return true; // untitled sections always visible
  return config.sections[sectionTitle] !== false;
}
