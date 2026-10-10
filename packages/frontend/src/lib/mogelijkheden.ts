/**
 * Wat er op deze site beschikbaar is.
 *
 * Y-next draait op kale ERPNext; alles daarbuiten (HRMS, Wiki, een rooster,
 * een taak-workflow) is een koppeling die aangaat als het aanwezig is. De
 * Frappe-app geeft bij het laden van de pagina mee wat de site heeft, in
 * `window.y_next_mogelijkheden`. Daarmee hoeft de app niet eerst een verzoek
 * te doen dat op een fout uitloopt om te ontdekken dat iets er niet is.
 *
 * Op een site zonder de app (de publicatieroute) geeft de pagina niets mee.
 * Dan is er geen voorkennis en geldt het gedrag van voorheen: `erpnext.ts`
 * merkt een ontbrekend veld of doctype op bij het eerste verzoek en onthoudt
 * dat.
 */

export interface Mogelijkheden {
  app_versie?: string;
  /** Optionele apps: `true` als de app op de site is geïnstalleerd. */
  apps?: Record<string, boolean>;
  /** Doctypes die niet in kale ERPNext zitten: `true` als ze bestaan. */
  doctypes?: Record<string, boolean>;
  /** Velden die niet overal bestaan, per doctype: `true` als het veld er is. */
  velden?: Record<string, Record<string, boolean>>;
  taak_workflow?: boolean;
  mailserver_ingesteld?: boolean;
  cad_viewer?: boolean;
}

declare global {
  interface Window {
    y_next_mogelijkheden?: unknown;
  }
}

function isObject(waarde: unknown): waarde is Record<string, unknown> {
  return typeof waarde === "object" && waarde !== null && !Array.isArray(waarde);
}

function vanDePagina(): unknown {
  return typeof window === "undefined" ? undefined : window.y_next_mogelijkheden;
}

/** Wat de pagina meegaf, of `null` op een site zonder de app. */
export function leesMogelijkheden(bron: unknown = vanDePagina()): Mogelijkheden | null {
  return isObject(bron) ? (bron as Mogelijkheden) : null;
}

/** De doctypes waarvan de site uitdrukkelijk meldt dat ze er niet zijn. */
export function ontbrekendeDoctypes(mogelijkheden: Mogelijkheden | null): string[] {
  const doctypes = mogelijkheden?.doctypes;
  if (!isObject(doctypes)) return [];
  return Object.entries(doctypes)
    .filter(([, aanwezig]) => aanwezig === false)
    .map(([doctype]) => doctype);
}

/** Per doctype de velden waarvan de site uitdrukkelijk meldt dat ze er niet zijn. */
export function ontbrekendeVelden(mogelijkheden: Mogelijkheden | null): Record<string, string[]> {
  const velden = mogelijkheden?.velden;
  if (!isObject(velden)) return {};
  const uit: Record<string, string[]> = {};
  for (const [doctype, perVeld] of Object.entries(velden)) {
    if (!isObject(perVeld)) continue;
    const ontbreekt = Object.entries(perVeld)
      .filter(([, aanwezig]) => aanwezig === false)
      .map(([veld]) => veld);
    if (ontbreekt.length > 0) uit[doctype] = ontbreekt;
  }
  return uit;
}
