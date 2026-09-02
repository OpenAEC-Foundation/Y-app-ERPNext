/**
 * Intent-matching engine for the Open AEC Assistent.
 * Maps natural language to ERPNext API actions.
 */

import { createDocument, updateDocument, fetchList, callMethod } from "./erpnext";
import { getActiveCompany, getActiveEmployee } from "./instances";
import {
  SALES_INVOICE_ACTIVE_FILTER,
  SALES_INVOICE_FINAL_FILTER,
  draftShare,
  isDraftInvoice,
} from "./invoice-docstatus";

/* ─── Types ─── */

export type SlotType = "number" | "text" | "project" | "employee" | "task" | "date" | "activity_type" | "priority" | "company";

export interface SlotDef {
  name: string;
  type: SlotType;
  required: boolean;
  label: string;        // shown in UI: "Project", "Uren", etc.
  defaultFn?: () => string; // e.g. () => localStorage.getItem("erpnext_default_employee")
}

export interface Intent {
  id: string;
  category: string;
  name: string;           // display name: "Uren boeken"
  description: string;    // shown in autocomplete
  patterns: string[];     // fuzzy match patterns
  slots: SlotDef[];
  execute: (slots: Record<string, string>, context: IntentContext) => Promise<string>;
}

export interface IntentContext {
  employees: { name: string; employee_name: string; user_id: string; company: string }[];
  projects: { name: string; project_name: string; status: string; company: string }[];
  companies: { name: string; company_name: string }[];
}

export interface MatchResult {
  intent: Intent;
  score: number;
  extractedSlots: Record<string, string>;
}

/* ─── Helpers ─── */

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function defaultEmployee(): string {
  return getActiveEmployee();
}

function defaultCompany(): string {
  return getActiveCompany();
}

/* ─── Intent Definitions ─── */

export const INTENTS: Intent[] = [

  // ━━━ UREN / TIMESHEET ━━━
  {
    id: "book_hours",
    category: "Uren",
    name: "Uren boeken",
    description: "Boek uren op een project of taak",
    patterns: [
      "boek uren", "uren boeken", "uren registreren", "tijd boeken", "timesheet",
      "boek {hours} uur", "schrijf uren", "registreer {hours} uur",
      "boek {hours} uur op {project}", "uren schrijven op {project}",
      "ik heb {hours} uur gewerkt", "{hours} uur gewerkt aan {project}",
      "log {hours} hours", "book time", "urenregistratie",
      "vandaag {hours} uur", "boek tijd", "uren invoeren",
      "schrijf {hours} uur op {project}", "boek mijn uren",
    ],
    slots: [
      { name: "employee", type: "employee", required: true, label: "Medewerker", defaultFn: defaultEmployee },
      { name: "hours", type: "number", required: true, label: "Uren" },
      { name: "project", type: "project", required: false, label: "Project" },
      { name: "task", type: "task", required: false, label: "Taak" },
      { name: "activity_type", type: "activity_type", required: true, label: "Type activiteit", defaultFn: () => "Execution" },
      { name: "date", type: "date", required: true, label: "Datum", defaultFn: today },
      { name: "description", type: "text", required: false, label: "Omschrijving" },
    ],
    execute: async (slots) => {
      const h = parseFloat(slots.hours);
      if (isNaN(h) || h <= 0) return "Ongeldig aantal uren.";
      const fromTime = "08:00";
      const toH = 8 + h;
      const toTime = `${String(Math.floor(toH)).padStart(2, "0")}:${String(Math.round((toH % 1) * 60)).padStart(2, "0")}`;
      await createDocument("Timesheet", {
        employee: slots.employee,
        company: slots.company || defaultCompany() || undefined,
        time_logs: [{
          activity_type: slots.activity_type || "Execution",
          from_time: `${slots.date} ${fromTime}:00`,
          to_time: `${slots.date} ${toTime}:00`,
          hours: h,
          project: slots.project || undefined,
          task: slots.task || undefined,
          description: slots.description || undefined,
        }],
      });
      return `✓ ${h} uur geboekt${slots.project ? ` op ${slots.project}` : ""} voor ${slots.date}`;
    },
  },

  // ━━━ PROJECT ━━━
  {
    id: "create_project",
    category: "Projecten",
    name: "Project aanmaken",
    description: "Maak een nieuw project aan",
    patterns: [
      "maak project aan", "nieuw project", "project aanmaken", "project maken",
      "maak project {name} aan", "create project", "start project",
      "maak een project aan voor {customer}", "nieuw project voor {customer}",
      "project opzetten", "project starten", "open project",
    ],
    slots: [
      { name: "project_name", type: "text", required: true, label: "Projectnaam" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
      { name: "expected_start_date", type: "date", required: false, label: "Startdatum", defaultFn: today },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Project", {
        project_name: slots.project_name,
        company: slots.company || defaultCompany() || undefined,
        expected_start_date: slots.expected_start_date || today(),
        status: "Open",
      });
      return `✓ Project aangemaakt: ${doc.name} — ${slots.project_name}`;
    },
  },
  {
    id: "find_project",
    category: "Projecten",
    name: "Project zoeken",
    description: "Zoek een project op naam of nummer",
    patterns: [
      "zoek project", "vind project", "project zoeken", "welk project",
      "zoek project {query}", "project {query}", "toon project {query}",
      "find project", "search project", "waar is project",
    ],
    slots: [
      { name: "query", type: "text", required: true, label: "Zoekterm" },
    ],
    execute: async (slots, ctx) => {
      const q = slots.query.toLowerCase();
      const matches = ctx.projects.filter(
        (p) => p.name.toLowerCase().includes(q) || p.project_name?.toLowerCase().includes(q)
      ).slice(0, 5);
      if (matches.length === 0) return `Geen projecten gevonden voor "${slots.query}".`;
      return `Gevonden:\n${matches.map((p) => `• ${p.name} — ${p.project_name} (${p.status})`).join("\n")}`;
    },
  },

  // ━━━ TAAK ━━━
  {
    id: "create_task",
    category: "Taken",
    name: "Taak aanmaken",
    description: "Maak een nieuwe taak aan",
    patterns: [
      "maak taak aan", "nieuwe taak", "taak aanmaken", "taak maken",
      "maak taak {subject} aan", "create task", "add task",
      "maak een taak aan voor {project}", "taak toevoegen",
      "voeg taak toe", "nieuwe taak voor {project}",
    ],
    slots: [
      { name: "subject", type: "text", required: true, label: "Taaknaam" },
      { name: "project", type: "project", required: false, label: "Project" },
      { name: "priority", type: "priority", required: false, label: "Prioriteit", defaultFn: () => "Medium" },
      { name: "exp_end_date", type: "date", required: false, label: "Deadline" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Task", {
        subject: slots.subject,
        project: slots.project || undefined,
        priority: slots.priority || "Medium",
        exp_end_date: slots.exp_end_date || undefined,
        company: defaultCompany() || undefined,
      });
      return `✓ Taak aangemaakt: ${doc.name} — ${slots.subject}`;
    },
  },
  {
    id: "my_tasks",
    category: "Taken",
    name: "Mijn taken",
    description: "Toon mijn openstaande taken",
    patterns: [
      "mijn taken", "mijn openstaande taken", "wat moet ik doen",
      "taken", "takenlijst", "my tasks", "show tasks", "open taken",
      "welke taken heb ik", "to do", "what should i do",
    ],
    slots: [],
    execute: async (_slots, ctx) => {
      const emp = ctx.employees.find((e) => e.name === defaultEmployee());
      if (!emp?.user_id) return "Stel je medewerker-ID in via Instellingen.";
      const tasks = await fetchList<{ name: string; subject: string; status: string; priority: string; project: string }>("Task", {
        fields: ["name", "subject", "status", "priority", "project"],
        filters: [
          ["_assign", "like", `%${emp.user_id}%`],
          ["status", "not in", ["Cancelled", "Template", "Completed"]],
        ],
        limit_page_length: 10,
        order_by: "modified desc",
      });
      if (tasks.length === 0) return "Geen openstaande taken gevonden.";
      return `Mijn taken (${tasks.length}):\n${tasks.map((t) => `• [${t.priority}] ${t.subject} (${t.status})${t.project ? ` — ${t.project}` : ""}`).join("\n")}`;
    },
  },

  // ━━━ TODO ━━━
  {
    id: "create_todo",
    category: "ToDo",
    name: "ToDo aanmaken",
    description: "Maak een nieuwe todo/herinnering aan",
    patterns: [
      "maak todo aan", "nieuwe todo", "todo aanmaken", "herinnering",
      "onthoud {description}", "reminder", "herinner mij aan {description}",
      "todo: {description}", "notitie: {description}", "voeg toe: {description}",
      "maak notitie", "add todo", "remember {description}",
    ],
    slots: [
      { name: "description", type: "text", required: true, label: "Beschrijving" },
      { name: "date", type: "date", required: false, label: "Datum" },
      { name: "priority", type: "priority", required: false, label: "Prioriteit", defaultFn: () => "Medium" },
    ],
    execute: async (slots, ctx) => {
      const emp = ctx.employees.find((e) => e.name === defaultEmployee());
      await createDocument("ToDo", {
        description: slots.description,
        status: "Open",
        priority: slots.priority || "Medium",
        date: slots.date || null,
        allocated_to: emp?.user_id || undefined,
      });
      return `✓ ToDo aangemaakt: ${slots.description}`;
    },
  },

  // ━━━ FACTUREN ━━━
  {
    id: "find_invoice",
    category: "Facturen",
    name: "Factuur zoeken",
    description: "Zoek een verkoopfactuur",
    patterns: [
      "zoek factuur", "vind factuur", "factuur zoeken", "factuur van {query}",
      "invoice", "zoek factuur {query}", "openstaande facturen",
      "onbetaalde facturen", "find invoice", "search invoice",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Zoekterm (klant/nummer)" },
    ],
    execute: async (slots) => {
      // Zoeken op klant → ook concepten tonen (die zijn juist het meest gezocht).
      // Zonder zoekterm valt de intent terug op "openstaand", en dat is per
      // definitie alleen een definitieve factuur.
      const filters: unknown[][] = slots.query
        ? [SALES_INVOICE_ACTIVE_FILTER, ["customer_name", "like", `%${slots.query}%`]]
        : [SALES_INVOICE_FINAL_FILTER, ["outstanding_amount", ">", 0]];
      const invoices = await fetchList<{ name: string; customer_name: string; net_total: number; outstanding_amount: number; status: string; docstatus?: number }>("Sales Invoice", {
        fields: ["name", "customer_name", "net_total", "outstanding_amount", "status", "docstatus"],
        filters,
        limit_page_length: 10,
        order_by: "posting_date desc",
      });
      if (invoices.length === 0) return `Geen facturen gevonden${slots.query ? ` voor "${slots.query}"` : ""}.`;
      return invoices.map((i) =>
        `• ${i.name} — ${i.customer_name}: €${i.net_total?.toLocaleString("nl-NL")} (openstaand: €${i.outstanding_amount?.toLocaleString("nl-NL")}) [${i.status}]${isDraftInvoice(i) ? " (concept)" : ""}`
      ).join("\n");
    },
  },

  // ━━━ MEDEWERKERS ━━━
  {
    id: "find_employee",
    category: "Medewerkers",
    name: "Medewerker zoeken",
    description: "Zoek een medewerker",
    patterns: [
      "zoek medewerker", "wie is {query}", "medewerker zoeken",
      "vind medewerker {query}", "collega {query}", "find employee",
      "medewerkers", "wie werkt hier", "teamleden", "personeel",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Naam" },
    ],
    execute: async (slots, ctx) => {
      let emps = ctx.employees.filter((e) => (e as unknown as { status: string }).status === "Active");
      if (slots.query) {
        const q = slots.query.toLowerCase();
        emps = emps.filter((e) => e.employee_name.toLowerCase().includes(q));
      }
      if (emps.length === 0) return `Geen medewerker gevonden${slots.query ? ` voor "${slots.query}"` : ""}.`;
      return emps.slice(0, 10).map((e) =>
        `• ${e.employee_name} (${e.name})`
      ).join("\n");
    },
  },

  // ━━━ VERLOF ━━━
  {
    id: "request_leave",
    category: "Verlof",
    name: "Verlof aanvragen",
    description: "Vraag verlof of vakantie aan",
    patterns: [
      "verlof aanvragen", "vakantie aanvragen", "vrij nemen", "dag vrij",
      "ik wil vrij op {date}", "verlofaanvraag", "leave request",
      "ik wil vakantie", "vrije dag", "ziek melden",
      "request leave", "request time off",
    ],
    slots: [
      { name: "employee", type: "employee", required: true, label: "Medewerker", defaultFn: defaultEmployee },
      { name: "from_date", type: "date", required: true, label: "Van datum" },
      { name: "to_date", type: "date", required: true, label: "Tot datum" },
      { name: "leave_type", type: "text", required: true, label: "Type verlof", defaultFn: () => "Leave Without Pay" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Leave Application", {
        employee: slots.employee,
        leave_type: slots.leave_type || "Leave Without Pay",
        from_date: slots.from_date,
        to_date: slots.to_date,
        status: "Open",
        company: defaultCompany() || undefined,
      });
      return `✓ Verlofaanvraag ingediend: ${doc.name} (${slots.from_date} t/m ${slots.to_date})`;
    },
  },

  // ━━━ ONKOSTEN ━━━
  {
    id: "create_expense",
    category: "Onkosten",
    name: "Onkostendeclaratie",
    description: "Dien een onkostendeclaratie in",
    patterns: [
      "onkosten declareren", "declaratie", "expense claim", "onkosten",
      "ik heb {amount} uitgegeven", "declareer {amount}", "kosten declareren",
      "onkostennota", "expense", "bonnetje indienen",
    ],
    slots: [
      { name: "employee", type: "employee", required: true, label: "Medewerker", defaultFn: defaultEmployee },
      { name: "amount", type: "number", required: true, label: "Bedrag (€)" },
      { name: "description", type: "text", required: true, label: "Omschrijving" },
      { name: "date", type: "date", required: true, label: "Datum", defaultFn: today },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Expense Claim", {
        employee: slots.employee,
        company: defaultCompany() || undefined,
        posting_date: slots.date,
        expenses: [{
          expense_date: slots.date,
          expense_type: "Miscellaneous Expenses",
          amount: parseFloat(slots.amount),
          description: slots.description,
        }],
      });
      return `✓ Onkostendeclaratie ingediend: ${doc.name} — €${slots.amount}`;
    },
  },

  // ━━━ STATUS / INFO ━━━
  {
    id: "project_status",
    category: "Projecten",
    name: "Projectstatus",
    description: "Bekijk de status van een project",
    patterns: [
      "status van {project}", "hoe staat {project} ervoor",
      "projectstatus", "project voortgang", "project status",
      "hoever is {project}", "wat is de status van {project}",
    ],
    slots: [
      { name: "project", type: "project", required: true, label: "Project" },
    ],
    execute: async (slots, ctx) => {
      const p = ctx.projects.find((pr) => pr.name === slots.project || pr.project_name?.toLowerCase() === slots.project.toLowerCase());
      if (!p) return `Project "${slots.project}" niet gevonden.`;
      const tasks = await fetchList<{ status: string }>("Task", {
        fields: ["status"],
        filters: [["project", "=", p.name]],
        limit_page_length: 0,
      });
      const total = tasks.length;
      const done = tasks.filter((t) => t.status === "Completed").length;
      const open = tasks.filter((t) => !["Completed", "Cancelled", "Template"].includes(t.status)).length;
      return `Project: ${p.name} — ${p.project_name}\nStatus: ${p.status}\nVoortgang: ${(p as unknown as { percent_complete: number }).percent_complete || 0}%\nTaken: ${total} totaal, ${done} afgerond, ${open} open`;
    },
  },
  {
    id: "close_project",
    category: "Projecten",
    name: "Project sluiten",
    description: "Sluit een project af (status → Completed)",
    patterns: [
      "sluit project", "project sluiten", "project afsluiten", "project afronden",
      "sluit {project} af", "project klaar", "project gereed", "close project",
    ],
    slots: [
      { name: "project", type: "project", required: true, label: "Project" },
    ],
    execute: async (slots) => {
      await updateDocument("Project", slots.project, { status: "Completed" });
      return `✓ Project ${slots.project} afgesloten`;
    },
  },

  // ━━━ VERKOOP ━━━
  {
    id: "create_quotation",
    category: "Verkoop",
    name: "Offerte aanmaken",
    description: "Maak een nieuwe offerte aan",
    patterns: [
      "offerte aanmaken", "nieuwe offerte", "maak offerte", "offerte maken",
      "offerte voor {customer}", "create quotation", "quote aanmaken",
      "maak een offerte voor {customer}", "offerte opstellen",
    ],
    slots: [
      { name: "customer", type: "text", required: true, label: "Klant" },
      { name: "item", type: "text", required: true, label: "Artikel/dienst" },
      { name: "qty", type: "number", required: true, label: "Aantal", defaultFn: () => "1" },
      { name: "rate", type: "number", required: true, label: "Prijs (€)" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Quotation", {
        party_name: slots.customer,
        company: slots.company || defaultCompany(),
        items: [{
          item_name: slots.item,
          description: slots.item,
          qty: parseFloat(slots.qty) || 1,
          rate: parseFloat(slots.rate) || 0,
        }],
      });
      return `✓ Offerte aangemaakt: ${doc.name} voor ${slots.customer}`;
    },
  },
  {
    id: "find_quotation",
    category: "Verkoop",
    name: "Offerte zoeken",
    description: "Zoek een offerte op klantnaam",
    patterns: [
      "zoek offerte", "offerte zoeken", "vind offerte", "offerte van {query}",
      "offertes", "openstaande offertes", "find quotation",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Zoekterm (klant)" },
    ],
    execute: async (slots) => {
      const filters: unknown[][] = [["docstatus", "<", 2]];
      if (slots.query) filters.push(["party_name", "like", `%${slots.query}%`]);
      const docs = await fetchList<{ name: string; party_name: string; net_total: number; status: string }>("Quotation", {
        fields: ["name", "party_name", "net_total", "status"],
        filters,
        limit_page_length: 10,
        order_by: "creation desc",
      });
      if (docs.length === 0) return "Geen offertes gevonden.";
      return docs.map((d) => `• ${d.name} — ${d.party_name}: €${d.net_total?.toLocaleString("nl-NL")} [${d.status}]`).join("\n");
    },
  },
  {
    id: "create_sales_order",
    category: "Verkoop",
    name: "Opdrachtbevestiging aanmaken",
    description: "Maak een nieuwe sales order aan",
    patterns: [
      "opdrachtbevestiging aanmaken", "sales order", "nieuwe opdracht",
      "maak opdrachtbevestiging", "order aanmaken", "create sales order",
      "opdracht voor {customer}", "bestelling aanmaken",
    ],
    slots: [
      { name: "customer", type: "text", required: true, label: "Klant" },
      { name: "item", type: "text", required: true, label: "Artikel/dienst" },
      { name: "qty", type: "number", required: true, label: "Aantal", defaultFn: () => "1" },
      { name: "rate", type: "number", required: true, label: "Prijs (€)" },
      { name: "delivery_date", type: "date", required: true, label: "Leverdatum" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Sales Order", {
        customer: slots.customer,
        company: slots.company || defaultCompany(),
        delivery_date: slots.delivery_date,
        items: [{
          item_name: slots.item,
          description: slots.item,
          qty: parseFloat(slots.qty) || 1,
          rate: parseFloat(slots.rate) || 0,
          delivery_date: slots.delivery_date,
        }],
      });
      return `✓ Opdrachtbevestiging aangemaakt: ${doc.name} voor ${slots.customer}`;
    },
  },
  {
    id: "find_sales_order",
    category: "Verkoop",
    name: "Opdrachtbevestiging zoeken",
    description: "Zoek een sales order",
    patterns: [
      "zoek opdracht", "zoek sales order", "opdrachtbevestiging zoeken",
      "vind opdracht", "orders van {query}", "find sales order",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Zoekterm (klant/nummer)" },
    ],
    execute: async (slots) => {
      const filters: unknown[][] = [["docstatus", "<", 2]];
      if (slots.query) filters.push(["customer_name", "like", `%${slots.query}%`]);
      const docs = await fetchList<{ name: string; customer_name: string; net_total: number; status: string; per_delivered: number }>("Sales Order", {
        fields: ["name", "customer_name", "net_total", "status", "per_delivered"],
        filters,
        limit_page_length: 10,
        order_by: "creation desc",
      });
      if (docs.length === 0) return "Geen opdrachtbevestigingen gevonden.";
      return docs.map((d) => `• ${d.name} — ${d.customer_name}: €${d.net_total?.toLocaleString("nl-NL")} [${d.status}] ${d.per_delivered || 0}% geleverd`).join("\n");
    },
  },
  {
    id: "create_sales_invoice",
    category: "Verkoop",
    name: "Verkoopfactuur aanmaken",
    description: "Maak een nieuwe verkoopfactuur aan",
    patterns: [
      "factuur aanmaken", "nieuwe factuur", "maak factuur", "factuur maken",
      "factureer {customer}", "create invoice", "sales invoice",
      "maak een factuur voor {customer}", "factureren",
    ],
    slots: [
      { name: "customer", type: "text", required: true, label: "Klant" },
      { name: "item", type: "text", required: true, label: "Artikel/dienst" },
      { name: "qty", type: "number", required: true, label: "Aantal", defaultFn: () => "1" },
      { name: "rate", type: "number", required: true, label: "Prijs (€)" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Sales Invoice", {
        customer: slots.customer,
        company: slots.company || defaultCompany(),
        items: [{
          item_name: slots.item,
          description: slots.item,
          qty: parseFloat(slots.qty) || 1,
          rate: parseFloat(slots.rate) || 0,
        }],
      });
      return `✓ Verkoopfactuur aangemaakt: ${doc.name} voor ${slots.customer}`;
    },
  },

  // ━━━ INKOOP ━━━
  {
    id: "create_purchase_invoice",
    category: "Inkoop",
    name: "Inkoopfactuur aanmaken",
    description: "Maak een nieuwe inkoopfactuur aan",
    patterns: [
      "inkoopfactuur aanmaken", "nieuwe inkoopfactuur", "maak inkoopfactuur",
      "purchase invoice", "inkoop factuur", "factuur van leverancier",
      "boek inkoopfactuur", "inkoopfactuur boeken",
    ],
    slots: [
      { name: "supplier", type: "text", required: true, label: "Leverancier" },
      { name: "item", type: "text", required: true, label: "Artikel/dienst" },
      { name: "qty", type: "number", required: true, label: "Aantal", defaultFn: () => "1" },
      { name: "rate", type: "number", required: true, label: "Prijs (€)" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Purchase Invoice", {
        supplier: slots.supplier,
        company: slots.company || defaultCompany(),
        items: [{
          item_name: slots.item,
          description: slots.item,
          qty: parseFloat(slots.qty) || 1,
          rate: parseFloat(slots.rate) || 0,
        }],
      });
      return `✓ Inkoopfactuur aangemaakt: ${doc.name} van ${slots.supplier}`;
    },
  },
  {
    id: "find_purchase_invoice",
    category: "Inkoop",
    name: "Inkoopfactuur zoeken",
    description: "Zoek een inkoopfactuur",
    patterns: [
      "zoek inkoopfactuur", "inkoopfactuur zoeken", "vind inkoopfactuur",
      "inkoopfacturen van {query}", "find purchase invoice", "leveranciersfactuur",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Zoekterm (leverancier)" },
    ],
    execute: async (slots) => {
      const filters: unknown[][] = [["docstatus", "=", 1]];
      if (slots.query) filters.push(["supplier_name", "like", `%${slots.query}%`]);
      const docs = await fetchList<{ name: string; supplier_name: string; net_total: number; outstanding_amount: number }>("Purchase Invoice", {
        fields: ["name", "supplier_name", "net_total", "outstanding_amount"],
        filters,
        limit_page_length: 10,
        order_by: "posting_date desc",
      });
      if (docs.length === 0) return "Geen inkoopfacturen gevonden.";
      return docs.map((d) => `• ${d.name} — ${d.supplier_name}: €${d.net_total?.toLocaleString("nl-NL")} (openstaand: €${d.outstanding_amount?.toLocaleString("nl-NL")})`).join("\n");
    },
  },

  // ━━━ KLANTEN & LEVERANCIERS ━━━
  {
    id: "find_customer",
    category: "Klanten",
    name: "Klant zoeken",
    description: "Zoek een klant op naam",
    patterns: [
      "zoek klant", "klant zoeken", "vind klant", "klant {query}",
      "wie is klant {query}", "customer {query}", "find customer",
      "klantgegevens", "klantinfo", "klanten zoeken",
    ],
    slots: [
      { name: "query", type: "text", required: true, label: "Klantnaam" },
    ],
    execute: async (slots) => {
      const docs = await fetchList<{ name: string; customer_name: string; customer_group: string; territory: string }>("Customer", {
        fields: ["name", "customer_name", "customer_group", "territory"],
        filters: [["customer_name", "like", `%${slots.query}%`]],
        limit_page_length: 10,
      });
      if (docs.length === 0) return `Geen klant gevonden voor "${slots.query}".`;
      return docs.map((d) => `• ${d.customer_name} (${d.name})${d.customer_group ? ` — ${d.customer_group}` : ""}${d.territory ? ` [${d.territory}]` : ""}`).join("\n");
    },
  },
  {
    id: "create_customer",
    category: "Klanten",
    name: "Klant aanmaken",
    description: "Maak een nieuwe klant aan",
    patterns: [
      "klant aanmaken", "nieuwe klant", "maak klant aan", "klant toevoegen",
      "voeg klant {customer_name} toe", "create customer", "add customer",
      "nieuwe klant {customer_name}", "klant registreren",
    ],
    slots: [
      { name: "customer_name", type: "text", required: true, label: "Klantnaam" },
      { name: "customer_group", type: "text", required: false, label: "Klantgroep", defaultFn: () => "All Customer Groups" },
      { name: "territory", type: "text", required: false, label: "Regio", defaultFn: () => "Netherlands" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Customer", {
        customer_name: slots.customer_name,
        customer_group: slots.customer_group || "All Customer Groups",
        territory: slots.territory || "Netherlands",
        customer_type: "Company",
      });
      return `✓ Klant aangemaakt: ${doc.name} — ${slots.customer_name}`;
    },
  },
  {
    id: "find_supplier",
    category: "Inkoop",
    name: "Leverancier zoeken",
    description: "Zoek een leverancier",
    patterns: [
      "zoek leverancier", "leverancier zoeken", "vind leverancier",
      "leverancier {query}", "supplier {query}", "find supplier",
      "wie is leverancier {query}", "leveranciers",
    ],
    slots: [
      { name: "query", type: "text", required: true, label: "Leveranciersnaam" },
    ],
    execute: async (slots) => {
      const docs = await fetchList<{ name: string; supplier_name: string; supplier_group: string }>("Supplier", {
        fields: ["name", "supplier_name", "supplier_group"],
        filters: [["supplier_name", "like", `%${slots.query}%`]],
        limit_page_length: 10,
      });
      if (docs.length === 0) return `Geen leverancier gevonden voor "${slots.query}".`;
      return docs.map((d) => `• ${d.supplier_name} (${d.name})${d.supplier_group ? ` — ${d.supplier_group}` : ""}`).join("\n");
    },
  },
  {
    id: "create_supplier",
    category: "Inkoop",
    name: "Leverancier aanmaken",
    description: "Maak een nieuwe leverancier aan",
    patterns: [
      "leverancier aanmaken", "nieuwe leverancier", "maak leverancier aan",
      "voeg leverancier toe", "create supplier", "add supplier",
      "leverancier toevoegen", "leverancier registreren",
    ],
    slots: [
      { name: "supplier_name", type: "text", required: true, label: "Leveranciersnaam" },
      { name: "supplier_group", type: "text", required: false, label: "Leveranciersgroep", defaultFn: () => "All Supplier Groups" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Supplier", {
        supplier_name: slots.supplier_name,
        supplier_group: slots.supplier_group || "All Supplier Groups",
        supplier_type: "Company",
      });
      return `✓ Leverancier aangemaakt: ${doc.name} — ${slots.supplier_name}`;
    },
  },

  // ━━━ DELIVERY NOTES ━━━
  {
    id: "create_delivery_note",
    category: "Verkoop",
    name: "Leveringsbon aanmaken",
    description: "Maak een delivery note aan",
    patterns: [
      "leveringsbon aanmaken", "delivery note", "nieuwe leveringsbon",
      "maak leveringsbon", "levering registreren", "create delivery note",
      "leveringsbon voor {customer}",
    ],
    slots: [
      { name: "customer", type: "text", required: true, label: "Klant" },
      { name: "item", type: "text", required: true, label: "Artikel" },
      { name: "qty", type: "number", required: true, label: "Aantal", defaultFn: () => "1" },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Delivery Note", {
        customer: slots.customer,
        company: slots.company || defaultCompany(),
        items: [{
          item_name: slots.item,
          description: slots.item,
          qty: parseFloat(slots.qty) || 1,
        }],
      });
      return `✓ Leveringsbon aangemaakt: ${doc.name} voor ${slots.customer}`;
    },
  },

  // ━━━ ITEMS / ARTIKELEN ━━━
  {
    id: "find_item",
    category: "Artikelen",
    name: "Artikel zoeken",
    description: "Zoek een artikel/product",
    patterns: [
      "zoek artikel", "artikel zoeken", "vind artikel", "product zoeken",
      "item {query}", "find item", "search item", "welke artikelen",
      "zoek product {query}", "artikel {query}",
    ],
    slots: [
      { name: "query", type: "text", required: true, label: "Zoekterm" },
    ],
    execute: async (slots) => {
      const docs = await fetchList<{ name: string; item_name: string; item_group: string; stock_uom: string }>("Item", {
        fields: ["name", "item_name", "item_group", "stock_uom"],
        filters: [["item_name", "like", `%${slots.query}%`]],
        limit_page_length: 10,
      });
      if (docs.length === 0) return `Geen artikelen gevonden voor "${slots.query}".`;
      return docs.map((d) => `• ${d.item_name} (${d.name}) — ${d.item_group || ""} [${d.stock_uom}]`).join("\n");
    },
  },
  {
    id: "create_item",
    category: "Artikelen",
    name: "Artikel aanmaken",
    description: "Maak een nieuw artikel/product aan",
    patterns: [
      "artikel aanmaken", "nieuw artikel", "maak artikel aan", "product aanmaken",
      "item aanmaken", "create item", "add item", "voeg artikel toe",
      "nieuw product", "maak product aan",
    ],
    slots: [
      { name: "item_name", type: "text", required: true, label: "Artikelnaam" },
      { name: "item_group", type: "text", required: false, label: "Artikelgroep", defaultFn: () => "All Item Groups" },
      { name: "rate", type: "number", required: false, label: "Standaard prijs (€)" },
      { name: "description", type: "text", required: false, label: "Omschrijving" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Item", {
        item_name: slots.item_name,
        item_group: slots.item_group || "All Item Groups",
        description: slots.description || slots.item_name,
        standard_rate: slots.rate ? parseFloat(slots.rate) : undefined,
      });
      return `✓ Artikel aangemaakt: ${doc.name} — ${slots.item_name}`;
    },
  },

  // ━━━ RAPPORTAGE ━━━
  {
    id: "revenue_summary",
    category: "Rapportage",
    name: "Omzet overzicht",
    description: "Toon de omzet van dit jaar",
    patterns: [
      "omzet", "omzet overzicht", "hoeveel omzet", "wat is de omzet",
      "revenue", "omzet dit jaar", "jaaromzet", "totale omzet",
      "omzet bekijken", "verkoopcijfers", "sales summary",
    ],
    slots: [
      { name: "company", type: "company", required: false, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const year = new Date().getFullYear();
      // Zelfde keuze als de Omzet-pagina: concepten tellen mee, geannuleerde niet.
      const filters: unknown[][] = [
        SALES_INVOICE_ACTIVE_FILTER,
        ["posting_date", ">=", `${year}-01-01`],
        ["posting_date", "<=", `${year}-12-31`],
      ];
      if (slots.company) filters.push(["company", "=", slots.company]);
      const invoices = await fetchList<{ net_total: number; posting_date: string; docstatus?: number }>("Sales Invoice", {
        fields: ["net_total", "posting_date", "docstatus"],
        filters,
        limit_page_length: 0,
      });
      const total = invoices.reduce((s, i) => s + (i.net_total || 0), 0);
      const share = draftShare(invoices, (i) => i.net_total);
      const months = new Map<string, number>();
      for (const inv of invoices) {
        const m = inv.posting_date?.slice(0, 7) || "onbekend";
        months.set(m, (months.get(m) || 0) + (inv.net_total || 0));
      }
      const monthLines = Array.from(months).sort().map(([m, v]) => `  ${m}: €${v.toLocaleString("nl-NL")}`).join("\n");
      const draftLine = share.hasDrafts
        ? `\nWaarvan concept: €${share.draftAmount.toLocaleString("nl-NL")} (${share.draftCount} factuur/facturen nog niet ingeboekt)`
        : "";
      return `Omzet ${year}${slots.company ? ` (${slots.company})` : ""}:\nTotaal: €${total.toLocaleString("nl-NL")}${draftLine}\n${invoices.length} facturen\n\nPer maand:\n${monthLines}`;
    },
  },
  {
    id: "outstanding_invoices",
    category: "Rapportage",
    name: "Openstaande facturen",
    description: "Toon alle onbetaalde facturen",
    patterns: [
      "openstaande facturen", "onbetaalde facturen", "wat staat er open",
      "outstanding invoices", "unpaid invoices", "openstaand", "debiteurenlijst",
      "wie moet nog betalen", "openstaande debiteuren",
    ],
    slots: [
      { name: "company", type: "company", required: false, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      // Openstaand = vordering → alleen definitieve facturen.
      const filters: unknown[][] = [SALES_INVOICE_FINAL_FILTER, ["outstanding_amount", ">", 0]];
      if (slots.company) filters.push(["company", "=", slots.company]);
      const invoices = await fetchList<{ name: string; customer_name: string; outstanding_amount: number; posting_date: string }>("Sales Invoice", {
        fields: ["name", "customer_name", "outstanding_amount", "posting_date"],
        filters,
        limit_page_length: 50,
        order_by: "outstanding_amount desc",
      });
      if (invoices.length === 0) return "Geen openstaande facturen gevonden.";
      const total = invoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0);
      const lines = invoices.slice(0, 15).map((i) =>
        `• ${i.name} — ${i.customer_name}: €${i.outstanding_amount?.toLocaleString("nl-NL")} (${i.posting_date})`
      ).join("\n");
      return `Openstaand: €${total.toLocaleString("nl-NL")} (${invoices.length} facturen)\n\n${lines}${invoices.length > 15 ? `\n... en ${invoices.length - 15} meer` : ""}`;
    },
  },
  {
    id: "hours_overview",
    category: "Rapportage",
    name: "Uren overzicht",
    description: "Toon uren overzicht per medewerker",
    patterns: [
      "uren overzicht", "hoeveel uren", "timesheet overzicht",
      "uren deze maand", "wie heeft hoeveel uren", "hours overview",
      "urenregistratie overzicht", "uren per medewerker",
    ],
    slots: [
      { name: "company", type: "company", required: false, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const filters: unknown[][] = [
        ["docstatus", "=", 1],
        ["start_date", ">=", monthStart],
      ];
      if (slots.company) filters.push(["company", "=", slots.company]);
      const timesheets = await fetchList<{ employee_name: string; total_hours: number }>("Timesheet", {
        fields: ["employee_name", "total_hours"],
        filters,
        limit_page_length: 0,
      });
      if (timesheets.length === 0) return "Geen timesheets gevonden deze maand.";
      const empHours = new Map<string, number>();
      for (const ts of timesheets) {
        empHours.set(ts.employee_name, (empHours.get(ts.employee_name) || 0) + (ts.total_hours || 0));
      }
      const sorted = Array.from(empHours).sort((a, b) => b[1] - a[1]);
      const total = sorted.reduce((s, [, h]) => s + h, 0);
      return `Uren deze maand (vanaf ${monthStart}):\nTotaal: ${Math.round(total)} uur\n\n${sorted.map(([name, hours]) => `• ${name}: ${Math.round(hours)} uur`).join("\n")}`;
    },
  },

  // ━━━ NOTITIE / COMMENT ━━━
  {
    id: "add_comment",
    category: "Notities",
    name: "Notitie toevoegen",
    description: "Voeg een notitie/comment toe aan een document",
    patterns: [
      "notitie toevoegen", "voeg notitie toe", "comment", "opmerking",
      "voeg opmerking toe aan {reference_name}", "notitie bij {reference_name}",
      "add comment", "add note", "schrijf notitie",
    ],
    slots: [
      { name: "reference_type", type: "text", required: true, label: "Document type (bijv. Project, Task)" },
      { name: "reference_name", type: "text", required: true, label: "Document naam/nummer" },
      { name: "content", type: "text", required: true, label: "Notitie" },
    ],
    execute: async (slots) => {
      // ERPNext v15 kent `frappe.client.add_comment` niet; de desk-variant
      // is daar het equivalent en vereist ook `comment_email`.
      const commentBy = defaultEmployee() || "Administrator";
      await callMethod("frappe.desk.form.utils.add_comment", {
        reference_doctype: slots.reference_type,
        reference_name: slots.reference_name,
        content: slots.content,
        comment_email: commentBy,
        comment_by: commentBy,
      });
      return `✓ Notitie toegevoegd aan ${slots.reference_type} ${slots.reference_name}`;
    },
  },

  // ━━━ TAKEN EXTRA ━━━
  {
    id: "complete_task",
    category: "Taken",
    name: "Taak afronden",
    description: "Markeer een taak als voltooid",
    patterns: [
      "taak afronden", "taak voltooien", "taak klaar", "taak afvinken",
      "sluit taak", "complete task", "finish task", "taak gereed",
      "markeer taak als klaar", "taak sluiten",
    ],
    slots: [
      { name: "task", type: "text", required: true, label: "Taak ID (bijv. TASK-001)" },
    ],
    execute: async (slots) => {
      await updateDocument("Task", slots.task, { status: "Completed" });
      return `✓ Taak ${slots.task} afgerond`;
    },
  },
  {
    id: "assign_task",
    category: "Taken",
    name: "Taak toewijzen",
    description: "Wijs een taak toe aan een medewerker",
    patterns: [
      "wijs taak toe", "taak toewijzen", "assign task", "taak geven aan",
      "wijs {task} toe aan {employee}", "geef taak aan {employee}",
    ],
    slots: [
      { name: "task", type: "text", required: true, label: "Taak ID" },
      { name: "employee", type: "employee", required: true, label: "Medewerker" },
    ],
    execute: async (slots, ctx) => {
      const emp = ctx.employees.find((e) => e.name === slots.employee);
      if (!emp?.user_id) return "Medewerker heeft geen user_id, kan niet toewijzen.";
      await callMethod("frappe.desk.form.assign_to.add", {
        doctype: "Task",
        name: slots.task,
        assign_to: [emp.user_id],
      });
      return `✓ Taak ${slots.task} toegewezen aan ${emp.employee_name}`;
    },
  },

  // ━━━ LEAD / CRM ━━━
  {
    id: "create_lead",
    category: "CRM",
    name: "Lead aanmaken",
    description: "Maak een nieuwe lead aan",
    patterns: [
      "lead aanmaken", "nieuwe lead", "maak lead aan", "prospect",
      "nieuwe prospect", "create lead", "add lead", "potentiële klant",
      "lead toevoegen", "prospect aanmaken",
    ],
    slots: [
      { name: "lead_name", type: "text", required: true, label: "Naam" },
      { name: "company_name", type: "text", required: false, label: "Bedrijfsnaam" },
      { name: "email", type: "text", required: false, label: "E-mail" },
      { name: "phone", type: "text", required: false, label: "Telefoon" },
      { name: "source", type: "text", required: false, label: "Bron", defaultFn: () => "Website" },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Lead", {
        lead_name: slots.lead_name,
        company_name: slots.company_name || undefined,
        email_id: slots.email || undefined,
        phone: slots.phone || undefined,
        source: slots.source || "Website",
      });
      return `✓ Lead aangemaakt: ${doc.name} — ${slots.lead_name}`;
    },
  },
  {
    id: "find_lead",
    category: "CRM",
    name: "Lead zoeken",
    description: "Zoek een lead/prospect",
    patterns: [
      "zoek lead", "lead zoeken", "vind lead", "zoek prospect",
      "leads", "prospects", "find lead", "search lead",
    ],
    slots: [
      { name: "query", type: "text", required: false, label: "Zoekterm" },
    ],
    execute: async (slots) => {
      const filters: unknown[][] = [];
      if (slots.query) filters.push(["lead_name", "like", `%${slots.query}%`]);
      const docs = await fetchList<{ name: string; lead_name: string; status: string; company_name: string }>("Lead", {
        fields: ["name", "lead_name", "status", "company_name"],
        filters,
        limit_page_length: 10,
        order_by: "creation desc",
      });
      if (docs.length === 0) return "Geen leads gevonden.";
      return docs.map((d) => `• ${d.lead_name}${d.company_name ? ` (${d.company_name})` : ""} — ${d.status} [${d.name}]`).join("\n");
    },
  },

  // ━━━ BETALING ━━━
  {
    id: "create_payment",
    category: "Financieel",
    name: "Betaling registreren",
    description: "Registreer een ontvangen betaling",
    patterns: [
      "betaling registreren", "betaling ontvangen", "payment entry",
      "klant heeft betaald", "betaling boeken", "register payment",
      "ontvangst boeken", "geld ontvangen van {party}",
    ],
    slots: [
      { name: "party", type: "text", required: true, label: "Klant/Leverancier" },
      { name: "amount", type: "number", required: true, label: "Bedrag (€)" },
      { name: "payment_type", type: "text", required: true, label: "Type", defaultFn: () => "Receive" },
      { name: "date", type: "date", required: true, label: "Datum", defaultFn: today },
      { name: "company", type: "company", required: true, label: "Bedrijf", defaultFn: defaultCompany },
    ],
    execute: async (slots) => {
      const doc = await createDocument<{ name: string }>("Payment Entry", {
        payment_type: slots.payment_type === "Pay" ? "Pay" : "Receive",
        party_type: slots.payment_type === "Pay" ? "Supplier" : "Customer",
        party: slots.party,
        paid_amount: parseFloat(slots.amount),
        received_amount: parseFloat(slots.amount),
        posting_date: slots.date || today(),
        company: slots.company || defaultCompany(),
      });
      return `✓ Betaling geregistreerd: ${doc.name} — €${slots.amount} van ${slots.party}`;
    },
  },

  // ━━━ HELP ━━━
  {
    id: "help",
    category: "Help",
    name: "Help",
    description: "Toon wat ik allemaal kan",
    patterns: [
      "help", "wat kan je", "hulp", "welke commando's", "opties",
      "what can you do", "commands", "mogelijkheden", "features",
    ],
    slots: [],
    execute: async () => {
      const categories = new Map<string, string[]>();
      for (const intent of INTENTS) {
        if (intent.id === "help") continue;
        if (!categories.has(intent.category)) categories.set(intent.category, []);
        categories.get(intent.category)!.push(`• ${intent.name} — ${intent.description}`);
      }
      let result = "Dit kan ik voor je doen:\n\n";
      for (const [cat, items] of categories) {
        result += `**${cat}**\n${items.join("\n")}\n\n`;
      }
      result += "Typ gewoon wat je wilt doen, ik snap het wel!";
      return result;
    },
  },
];

/* ─── Matching Engine ─── */

/** Normalize text for matching */
function normalize(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[?!.,;:'"]/g, "")
    .replace(/\s+/g, " ");
}

/** Calculate similarity between two strings (0-1) */
function similarity(a: string, b: string): number {
  const wordsA = normalize(a).split(" ");
  const wordsB = normalize(b).split(" ");

  // Count matching words
  let matches = 0;
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wb.startsWith("{")) continue; // skip slot placeholders
      if (wa === wb) { matches++; break; }
      // Partial match for longer words
      if (wa.length > 3 && wb.length > 3) {
        if (wa.includes(wb) || wb.includes(wa)) { matches += 0.7; break; }
      }
    }
  }

  const maxLen = Math.max(wordsA.length, wordsB.filter((w) => !w.startsWith("{")).length);
  return maxLen > 0 ? matches / maxLen : 0;
}

/** Extract slot values from input based on pattern */
function extractSlots(input: string, pattern: string): Record<string, string> {
  const slots: Record<string, string> = {};
  const normInput = normalize(input);

  // Extract numbers
  const numberMatch = normInput.match(/(\d+(?:[.,]\d+)?)\s*(?:uur|uren|hours?|u\b)/);
  if (numberMatch) slots.hours = numberMatch[1].replace(",", ".");

  const amountMatch = normInput.match(/€?\s*(\d+(?:[.,]\d+)?)\s*(?:euro)?/);
  if (amountMatch && !slots.hours) slots.amount = amountMatch[1].replace(",", ".");

  // Extract dates (dd-mm-yyyy, yyyy-mm-dd, or relative)
  const dateMatch = normInput.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) slots.date = dateMatch[1];

  const nlDateMatch = normInput.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (nlDateMatch) slots.date = `${nlDateMatch[3]}-${nlDateMatch[2].padStart(2, "0")}-${nlDateMatch[1].padStart(2, "0")}`;

  if (normInput.includes("vandaag")) slots.date = today();
  if (normInput.includes("morgen")) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    slots.date = d.toISOString().split("T")[0];
  }

  // Try to extract slot values from pattern positions
  // e.g. "boek {hours} uur op {project}" + "boek 4 uur op PROJ-001"
  const patternParts = pattern.replace(/[?!.,;:'"]/g, "").split(" ");
  const inputParts = normInput.split(" ");

  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    if (pp.startsWith("{") && pp.endsWith("}")) {
      const slotName = pp.slice(1, -1);
      // Find the corresponding position in input
      // Look for the word before this slot in the pattern
      if (i > 0) {
        const anchor = patternParts[i - 1].toLowerCase();
        const anchorIdx = inputParts.findIndex((w) => w.toLowerCase() === anchor);
        if (anchorIdx >= 0 && anchorIdx + 1 < inputParts.length) {
          // Collect remaining words until next pattern word
          const nextPatternWord = i + 1 < patternParts.length && !patternParts[i + 1].startsWith("{")
            ? patternParts[i + 1].toLowerCase()
            : null;

          const valueParts: string[] = [];
          for (let j = anchorIdx + 1; j < inputParts.length; j++) {
            if (nextPatternWord && inputParts[j].toLowerCase() === nextPatternWord) break;
            valueParts.push(inputParts[j]);
          }
          if (valueParts.length > 0 && !slots[slotName]) {
            slots[slotName] = valueParts.join(" ");
          }
        }
      }
    }
  }

  return slots;
}

/** Match user input against all intents, return ranked results */
export function matchIntents(input: string): MatchResult[] {
  if (!input.trim()) return [];

  const results: MatchResult[] = [];

  for (const intent of INTENTS) {
    let bestScore = 0;
    let bestSlots: Record<string, string> = {};

    for (const pattern of intent.patterns) {
      const score = similarity(input, pattern);
      if (score > bestScore) {
        bestScore = score;
        bestSlots = extractSlots(input, pattern);
      }
    }

    // Also match against intent name and description
    const nameScore = similarity(input, intent.name) * 0.8;
    const descScore = similarity(input, intent.description) * 0.6;
    bestScore = Math.max(bestScore, nameScore, descScore);

    if (bestScore > 0.15) {
      results.push({ intent, score: bestScore, extractedSlots: bestSlots });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/** Get autocomplete suggestions for partial input */
export function getAutocompleteSuggestions(input: string): MatchResult[] {
  return matchIntents(input).slice(0, 5);
}

/** Build the GitHub issue URL for an unmatched prompt */
export function buildUnmatchedIssueUrl(prompt: string): string {
  const url = new URL("https://github.com/OpenAEC-Foundation/y-app/issues/new");
  url.searchParams.set("title", `[Intent] Onherkenbaar commando: "${prompt.slice(0, 80)}"`);
  url.searchParams.set("body", `## Onherkend commando\n\n\`\`\`\n${prompt}\n\`\`\`\n\nDit commando werd niet herkend door de Open AEC Assistent.\n\n**Verwachte actie:** _Beschrijf wat je verwachtte dat er zou gebeuren_\n\n---\n*Automatisch aangemaakt vanuit Y-app*`);
  url.searchParams.set("labels", "enhancement,intent-request");
  return url.toString();
}
