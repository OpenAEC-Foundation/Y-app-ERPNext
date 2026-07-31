/**
 * NAS-configuratie: gesplitst tussen device-only en shared fields.
 *
 * - `correspondenceSubdir` + `folderTemplate`: machine-onafhankelijk →
 *   server-side gesynct via instance_settings key `nas-attachment-template`.
 *   Write-through naar localStorage (instant) + fire-and-forget PUT.
 *   `hydrateNasConfig()` op mount haalt server-state en overschrijft de
 *   shared bits in localStorage.
 * - `companies` map (hasHandle flags): per-device → blijft localStorage.
 *
 * De feitelijke FileSystemDirectoryHandles staan in IndexedDB (nasStorage.ts);
 * dit config-object bevat alleen metadata + templates.
 */
import { getActiveInstanceId } from "./instances";

const SERVER_SETTING_KEY = "nas-attachment-template";

export interface NasCompanyConfig {
  /** True if a FileSystemDirectoryHandle exists in IndexedDB for this company. */
  hasHandle: boolean;
}

export interface NasConfig {
  companies: Record<string, NasCompanyConfig>;
  /** Subfolder within the project folder where correspondence sits. Default "01 Correspondentie". */
  correspondenceSubdir: string;
  /** Template for the per-mail subfolder name. */
  folderTemplate: string;
}

export const DEFAULT_NAS_CONFIG: Readonly<NasConfig> = Object.freeze({
  companies: {},
  correspondenceSubdir: "01 Correspondentie",
  folderTemplate: "{nr:03d} {dd-mm-yyyy} {subject}",
});

function configKey(instanceId: string): string {
  return `y-app-nas-config-${instanceId}`;
}

export function loadConfig(instanceId: string): NasConfig {
  try {
    const raw = localStorage.getItem(configKey(instanceId));
    if (!raw) return { ...DEFAULT_NAS_CONFIG, companies: {} };
    const parsed = JSON.parse(raw) as Partial<NasConfig>;
    return {
      companies: parsed.companies ?? {},
      correspondenceSubdir:
        typeof parsed.correspondenceSubdir === "string"
          ? parsed.correspondenceSubdir
          : DEFAULT_NAS_CONFIG.correspondenceSubdir,
      folderTemplate:
        typeof parsed.folderTemplate === "string"
          ? parsed.folderTemplate
          : DEFAULT_NAS_CONFIG.folderTemplate,
    };
  } catch {
    return { ...DEFAULT_NAS_CONFIG, companies: {} };
  }
}

export function saveConfig(instanceId: string, cfg: NasConfig): void {
  localStorage.setItem(configKey(instanceId), JSON.stringify(cfg));
}

/**
 * Schrijf alleen de shared (server-synced) velden weg. Merget in bestaande
 * localStorage-config (companies blijft onaangeraakt), schrijft synchroon
 * naar localStorage en fire-and-forget naar server.
 *
 * Sync-API zodat callers niet hoeven te awaiten — UI blijft snappy.
 */
export function saveSharedNasConfig(
  instanceId: string,
  shared: { correspondenceSubdir: string; folderTemplate: string },
): void {
  const current = loadConfig(instanceId);
  const next: NasConfig = {
    ...current,
    correspondenceSubdir: shared.correspondenceSubdir,
    folderTemplate: shared.folderTemplate,
  };
  saveConfig(instanceId, next);

  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  fetch(
    `/api/instances/${encodeURIComponent(activeId)}/settings/${SERVER_SETTING_KEY}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: {
          correspondenceSubdir: shared.correspondenceSubdir,
          folderTemplate: shared.folderTemplate,
        },
      }),
    },
  ).catch(() => {
    // Stil falen — localStorage heeft de waarde, sync komt later goed
  });
}

/**
 * Haal server-state op en overschrijf de shared velden in localStorage.
 * Companies-map blijft onaangeraakt (per-device). Idempotent.
 *
 * Call op mount van NasSettingsSection en SaveToNasDialog zodat een
 * ander device dat de template aanpaste hier ook gezien wordt.
 */
export async function hydrateNasConfig(): Promise<void> {
  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  try {
    // Eerst het EIGEN account (werkt direct voor de werkgever, die de waarde
    // zelf via PUT op zijn/haar eigen instance-rij zette). Een medewerker
    // heeft een ANDER Y-app-account en dus een andere instance_id-rij voor
    // dezelfde ERPNext-URL — daar staat dit setting-key nooit op, dus dat
    // geeft 404. Val dan terug op de cross-account employer→employee-bridge
    // (URL-match), die WEL de werkgever-rij voor dezelfde ERPNext-URL vindt.
    // Zonder deze fallback bleef een medewerker altijd op de defaults staan,
    // ook als de werkgever de submap/template al had ingesteld.
    let res = await fetch(
      `/api/instances/${encodeURIComponent(activeId)}/settings/${SERVER_SETTING_KEY}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) {
      res = await fetch(`/api/shared-settings/${SERVER_SETTING_KEY}`, { credentials: "same-origin" });
    }
    if (!res.ok) return;
    const data = await res.json();
    const raw = data?.value;
    if (!raw || typeof raw !== "object") return;
    const correspondenceSubdir =
      typeof raw.correspondenceSubdir === "string" ? raw.correspondenceSubdir : null;
    const folderTemplate =
      typeof raw.folderTemplate === "string" ? raw.folderTemplate : null;
    if (correspondenceSubdir === null && folderTemplate === null) return;
    const current = loadConfig(activeId);
    const merged: NasConfig = {
      ...current,
      correspondenceSubdir: correspondenceSubdir ?? current.correspondenceSubdir,
      folderTemplate: folderTemplate ?? current.folderTemplate,
    };
    saveConfig(activeId, merged);
  } catch {
    // Server onbereikbaar — behoud localStorage-cache
  }
}

/* ─── NAS projectmappen (desktop-only) ─── */

const PROJECT_FOLDERS_KEY = "nas-project-folders";

export interface NasProjectFoldersConfig {
  masterPath: string;
  targetRoot: string;
  folderTemplate: string;
}

const DEFAULT_PROJECT_FOLDERS: Readonly<NasProjectFoldersConfig> = Object.freeze({
  masterPath: "",
  targetRoot: "",
  folderTemplate: "{nr} {project_name}",
});

function projectFoldersKey(instanceId: string): string {
  return `y-app-nas-project-folders-${instanceId}`;
}

export function loadProjectFoldersConfig(instanceId: string): NasProjectFoldersConfig {
  try {
    const raw = localStorage.getItem(projectFoldersKey(instanceId));
    if (!raw) return { ...DEFAULT_PROJECT_FOLDERS };
    const p = JSON.parse(raw) as Partial<NasProjectFoldersConfig>;
    return {
      masterPath: typeof p.masterPath === "string" ? p.masterPath : "",
      targetRoot: typeof p.targetRoot === "string" ? p.targetRoot : "",
      folderTemplate:
        typeof p.folderTemplate === "string"
          ? p.folderTemplate
          : DEFAULT_PROJECT_FOLDERS.folderTemplate,
    };
  } catch {
    return { ...DEFAULT_PROJECT_FOLDERS };
  }
}

function saveProjectFoldersLocalOnly(instanceId: string, cfg: NasProjectFoldersConfig): void {
  try {
    localStorage.setItem(projectFoldersKey(instanceId), JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function saveProjectFoldersConfig(
  instanceId: string,
  cfg: NasProjectFoldersConfig,
): void {
  saveProjectFoldersLocalOnly(instanceId, cfg);
  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  fetch(
    `/api/instances/${encodeURIComponent(activeId)}/settings/${PROJECT_FOLDERS_KEY}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: cfg }),
    },
  ).catch(() => {
    /* stil — localStorage heeft de waarde */
  });
}

export async function hydrateProjectFoldersConfig(): Promise<void> {
  const activeId = getActiveInstanceId();
  if (!activeId || activeId === "default") return;
  try {
    // Zelfde employer→employee-fallback als hydrateNasConfig hierboven —
    // zie die comment voor de volledige uitleg (account-scoped instance_id
    // vs. de URL-match shared-settings-bridge).
    let res = await fetch(
      `/api/instances/${encodeURIComponent(activeId)}/settings/${PROJECT_FOLDERS_KEY}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) {
      res = await fetch(`/api/shared-settings/${PROJECT_FOLDERS_KEY}`, { credentials: "same-origin" });
    }
    if (!res.ok) return;
    const data = await res.json();
    const v = data?.value;
    if (!v || typeof v !== "object") return;
    saveProjectFoldersLocalOnly(activeId, {
      masterPath: typeof v.masterPath === "string" ? v.masterPath : "",
      targetRoot: typeof v.targetRoot === "string" ? v.targetRoot : "",
      folderTemplate:
        typeof v.folderTemplate === "string"
          ? v.folderTemplate
          : DEFAULT_PROJECT_FOLDERS.folderTemplate,
    });
  } catch {
    /* server onbereikbaar — behoud localStorage */
  }
}

/* ─── Template resolution ─── */

export type TemplateVars = Record<string, string | number>;

/**
 * Replace {placeholder} and {placeholder:NNd} tokens. Numeric padding with
 * {name:03d} applies zero-padding to that width. Unknown placeholders are
 * left as-is (no crash) so the user can spot the typo in the preview.
 */
export function resolveTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zA-Z_][\w-]*)(?::(\d+)d)?\}/g, (full, name, pad) => {
    const v = vars[name];
    if (v === undefined || v === null) return full; // leave as-is
    let str = String(v);
    if (pad) {
      const n = parseInt(pad, 10);
      while (str.length < n) str = "0" + str;
    }
    return str;
  });
}

/* ─── Filesystem-safe string handling ─── */

const ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeForFilesystem(input: string, maxLen = 100): string {
  let s = input.replace(ILLEGAL, "_").replace(/\s+/g, " ").trim();
  // Strip trailing dots/spaces which Windows refuses
  s = s.replace(/[. ]+$/g, "");
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s || "_";
}

/**
 * Strip RE:/FW:/FWD: prefixes (any number, any case, optional brackets like "[EXT]")
 * so reply chains collapse to the conversation subject.
 */
export function stripSubjectPrefixes(subject: string): string {
  let s = subject.trim();
  // Repeatedly strip leading RE:/FW:/FWD:/R:/AW: prefixes
  for (;;) {
    const before = s;
    s = s.replace(/^(re|fw|fwd|aw|r|antw)\s*:\s*/i, "");
    s = s.replace(/^\[[^\]]+\]\s*/i, ""); // [EXT], [SPAM] etc
    if (s === before) break;
  }
  return s.trim();
}

/* ─── Date helpers ─── */

export function formatDateDDMMYYYY(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateYYYYMMDD(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build the variables dict for the folder template from raw mail/project
 * inputs. The caller supplies the next sequence number from findNextNumber().
 */
export function buildTemplateVars(opts: {
  nr: number;
  subject: string;
  from?: string;
  date?: Date;
}): TemplateVars {
  const d = opts.date ?? new Date();
  return {
    nr: opts.nr,
    "dd-mm-yyyy": formatDateDDMMYYYY(d),
    "yyyy-mm-dd": formatDateYYYYMMDD(d),
    subject: sanitizeForFilesystem(stripSubjectPrefixes(opts.subject || ""), 60),
    from: sanitizeForFilesystem(opts.from || "", 40),
  };
}

/* ─── Project-folder path resolution (single source of truth) ─── */

/**
 * Bouw de mapnaam voor een project uit de gedeelde `nas-project-folders`-config
 * (Projectinstellingen → NAS-opslag). Gebruikt door zowel "Maak NAS-mappen aan"
 * als "Open in Verkenner"/de map-knop, zodat beide exact dezelfde map raken.
 */
export function resolveProjectFolderName(
  cfg: NasProjectFoldersConfig,
  project: { name: string; project_name?: string },
): string {
  return sanitizeForFilesystem(
    resolveTemplate(cfg.folderTemplate || DEFAULT_PROJECT_FOLDERS.folderTemplate, {
      nr: project.name,
      project_name: project.project_name || "",
    }),
    120,
  );
}

/** Voeg een root-pad en mapnaam samen met de juiste separator (UNC/backslash of forward-slash). */
export function joinNasPath(root: string, name: string): string {
  const base = (root || "").replace(/[\\/]+$/, "");
  if (!base) return name;
  const sep = base.includes("/") ? "/" : "\\";
  return `${base}${sep}${name}`;
}

/**
 * Volledig doelpad voor de projectmap: `{targetRoot}{sep}{folderName}`, uit de
 * gedeelde config. Dit is de ENIGE bron van waarheid voor projectmap-locaties —
 * de vroegere hardcoded `Z:/50_projecten`-mapping en de `pref_company_folder_map`
 * / `pref_default_project_base` localStorage-keys zijn hiermee vervallen.
 */
export function buildProjectFolderPath(
  cfg: NasProjectFoldersConfig,
  project: { name: string; project_name?: string },
): string {
  return joinNasPath(cfg.targetRoot, resolveProjectFolderName(cfg, project));
}
