import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Save, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { fetchList } from "../lib/erpnext";
import {
  loadConfig,
  saveConfig,
  saveSharedNasConfig,
  hydrateNasConfig,
  DEFAULT_NAS_CONFIG,
  loadProjectFoldersConfig,
  saveProjectFoldersConfig,
  hydrateProjectFoldersConfig,
  type NasConfig,
  type NasProjectFoldersConfig,
} from "../lib/nasConfig";
import {
  isFsaSupported,
  pickNasRoot,
  getCompanyHandle,
  setCompanyHandle,
  clearCompanyHandle,
} from "../lib/nasStorage";
import { isDesktopApp } from "../lib/desktop";

interface CompanyRow {
  name: string;
  handleName: string | null;
}

/**
 * NAS-instellingen (zie CLAUDE.md "NAS-bijlage config: shared template +
 * device-only handles"):
 *
 * - {@link NasSharedSection} — correspondentie-submap/template + projectmappen-
 *   config (master-map, doel-root, mapnaam-template). Dit is de ENIGE bron van
 *   waarheid voor projectmap-locaties: organisatie-breed beleid, server-gesynct
 *   via instance_settings (`nas-attachment-template` + `nas-project-folders`).
 *   De werkgever bewerkt dit op de Project-instellingen-tab; medewerkers zien
 *   het read-only op de Algemeen-tab (`readOnly`-prop) zodat de door de
 *   werkgever ingestelde paden voor iedereen zichtbaar/leesbaar zijn.
 * - {@link NasDeviceSection} — device-lokale FileSystemDirectoryHandle per
 *   bedrijf voor de web-build Save-to-NAS-flow. NIET meer los in Settings
 *   gemount (de per-bedrijf FSA-map wordt nu on-demand gekozen via de inline
 *   picker in {@link ../pages/Webmail} → SaveToNasDialog). Component blijft
 *   behouden voor die inline-picker-logica / eventueel hergebruik.
 *
 * {@link NasSettingsSection} is de wrapper die enkel het gedeelde deel rendert.
 */

/**
 * Device-lokaal: kies per bedrijf de NAS-hoofdmap waarin de projectmappen
 * staan. De handle leeft alleen in deze browser (IndexedDB, nasStorage.ts) en
 * moet per apparaat gezet worden. Niet meer in Settings gemount — de
 * SaveToNasDialog biedt dezelfde keuze inline aan iedereen aan.
 *
 * Schrijft NOOIT de gedeelde template-velden: bij elke wijziging wordt de
 * config vers uit localStorage gelezen en alleen `companies` aangepast, zodat
 * een template-edit van de werkgever niet per ongeluk teruggedraaid wordt.
 */
export function NasDeviceSection({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const fsa = isFsaSupported();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [pickError, setPickError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchList<{ name: string }>("Company", { fields: ["name"], limit_page_length: 0 })
      .then(async (list) => {
        if (cancelled) return;
        const rows: CompanyRow[] = [];
        for (const c of list) {
          const h = await getCompanyHandle(instanceId, c.name);
          rows.push({ name: c.name, handleName: h ? h.name : null });
        }
        if (!cancelled) setCompanies(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  async function handlePick(company: string) {
    setPickError(null);
    try {
      const handle = await pickNasRoot();
      await setCompanyHandle(instanceId, company, handle);
      setCompanies((prev) =>
        prev.map((r) => (r.name === company ? { ...r, handleName: handle.name } : r)),
      );
      // Vers inlezen zodat een template-edit van de werkgever behouden blijft.
      const current = loadConfig(instanceId);
      saveConfig(instanceId, {
        ...current,
        companies: { ...current.companies, [company]: { hasHandle: true } },
      });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const msg = e?.message || String(err);
      // Real user cancel from OS dialog → silent. Automation-blocked or other
      // failures (incl. Playwright's setInterceptFileChooserDialog intercept,
      // which also throws AbortError) → show feedback so the user knows the
      // click wasn't ignored.
      if (e?.name === "AbortError" && !/intercept/i.test(msg)) {
        return; // genuine user cancel — silent
      }
      console.error("Failed to pick NAS folder:", err);
      setPickError(msg);
      setTimeout(() => setPickError(null), 6000);
    }
  }

  async function handleClear(company: string) {
    await clearCompanyHandle(instanceId, company);
    setCompanies((prev) =>
      prev.map((r) => (r.name === company ? { ...r, handleName: null } : r)),
    );
    const current = loadConfig(instanceId);
    const { [company]: _removed, ...rest } = current.companies;
    saveConfig(instanceId, { ...current, companies: rest });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <FolderOpen size={20} className="text-violet-500" />
        <div>
          <h3 className="text-base font-semibold text-slate-700">
            {t("settings.nas.device_title", { defaultValue: "NAS-map (dit apparaat)" })}
          </h3>
          <p className="text-xs text-slate-400">
            {t("settings.nas.device_desc", {
              defaultValue:
                "Kies per bedrijf de NAS-hoofdmap waarin de projectmappen staan. Deze keuze geldt alleen op dit apparaat en wordt gebruikt bij het opslaan van mailbijlages.",
            })}
          </p>
        </div>
      </div>

      {!fsa && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {t("settings.nas.fsa_unsupported", {
              defaultValue:
                "Vereist Chrome of Edge. Deze browser ondersteunt geen directe map-toegang.",
            })}
          </p>
        </div>
      )}

      {pickError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-medium">
              {t("settings.nas.pick_failed", { defaultValue: "Map-selectie mislukt" })}
            </p>
            <p className="text-xs mt-0.5 font-mono">{pickError}</p>
            {/intercept/i.test(pickError) && (
              <p className="text-xs mt-1 text-red-700">
                {t("settings.nas.pick_blocked_hint", {
                  defaultValue:
                    "De map-picker werd geblokkeerd door automation of een browser-extensie. Probeer Y-app in een gewone Chrome- of Edge-tab.",
                })}
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-600 mb-2">
          {t("settings.nas.paths_title", { defaultValue: "Pad per bedrijf" })}
        </h4>
        {companies.length === 0 ? (
          <p className="text-xs text-slate-400 italic">
            {t("settings.nas.no_companies", { defaultValue: "Geen bedrijven gevonden in ERPNext." })}
          </p>
        ) : (
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">
                    {t("settings.nas.company", { defaultValue: "Bedrijf" })}
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">
                    {t("settings.nas.folder", { defaultValue: "Map" })}
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 w-44">
                    {t("settings.nas.actions", { defaultValue: "Acties" })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 text-sm text-slate-700 font-medium">
                      {row.name}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {row.handleName ? (
                        <span className="text-emerald-700 font-mono text-xs">
                          {row.handleName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          {t("settings.nas.not_set", { defaultValue: "Niet ingesteld" })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handlePick(row.name)}
                        disabled={!fsa}
                        className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium hover:bg-violet-200 disabled:opacity-40 cursor-pointer mr-1"
                      >
                        {row.handleName
                          ? t("settings.nas.change", { defaultValue: "Wijzig" })
                          : t("settings.nas.choose", { defaultValue: "Selecteer" })}
                      </button>
                      {row.handleName && (
                        <button
                          onClick={() => handleClear(row.name)}
                          className="px-1.5 py-1 text-red-400 hover:text-red-600 cursor-pointer"
                          aria-label={t("settings.nas.clear", { defaultValue: "Wissen" })}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Gedeeld organisatie-beleid (werkgever-only): correspondentie-submap +
 * submap-naam-template + projectmappen-aanmaak-config. Server-gesynct via
 * instance_settings zodat medewerkers deze waarden erven zonder ze te kunnen
 * wijzigen.
 */
export function NasSharedSection({
  instanceId,
  readOnly = false,
}: {
  instanceId: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<NasConfig>(() => loadConfig(instanceId));
  const [pf, setPf] = useState<NasProjectFoldersConfig>(() =>
    loadProjectFoldersConfig(instanceId),
  );
  const [saved, setSaved] = useState(false);

  // Hydrate shared template-velden vanaf server zodat een wijziging op een
  // ander device hier zichtbaar wordt.
  useEffect(() => {
    let cancelled = false;
    hydrateNasConfig().then(() => {
      if (cancelled) return;
      setCfg(loadConfig(instanceId));
    });
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  // Hydrate de project-folders config (master/doel/mapnaam) vanaf server.
  useEffect(() => {
    let cancelled = false;
    hydrateProjectFoldersConfig().then(() => {
      if (!cancelled) setPf(loadProjectFoldersConfig(instanceId));
    });
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  function savePf(next: NasProjectFoldersConfig) {
    setPf(next);
    saveProjectFoldersConfig(instanceId, next);
  }

  function handleTemplateChange<K extends "correspondenceSubdir" | "folderTemplate">(
    key: K,
    value: string,
  ) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    // Alleen de gedeelde template-velden. Companies-map blijft device-lokaal
    // (NasDeviceSection) en wordt hier niet aangeraakt.
    const current = loadConfig(instanceId);
    saveConfig(instanceId, {
      ...current,
      correspondenceSubdir: cfg.correspondenceSubdir,
      folderTemplate: cfg.folderTemplate,
    });
    saveSharedNasConfig(instanceId, {
      correspondenceSubdir: cfg.correspondenceSubdir,
      folderTemplate: cfg.folderTemplate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setCfg((prev) => ({
      ...prev,
      correspondenceSubdir: DEFAULT_NAS_CONFIG.correspondenceSubdir,
      folderTemplate: DEFAULT_NAS_CONFIG.folderTemplate,
    }));
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <FolderOpen size={20} className="text-violet-500" />
        <div>
          <h3 className="text-base font-semibold text-slate-700">
            {t("settings.nas.title", { defaultValue: "NAS opslag (mailbijlages)" })}
          </h3>
          <p className="text-xs text-slate-400">
            {t("settings.nas.desc", {
              defaultValue:
                "Configureer waar mail-bijlages opgeslagen worden. Per device en per company.",
            })}
          </p>
        </div>
      </div>

      {readOnly && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          {t("settings.nas.readonly_note", {
            defaultValue:
              "Deze instellingen worden door de werkgever beheerd. Je ziet ze hier alleen ter info.",
          })}
        </p>
      )}

      {/* Subfolder en template */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t("settings.nas.correspondence_subdir", {
              defaultValue: "Correspondentie-submap",
            })}
          </label>
          <input
            type="text"
            value={cfg.correspondenceSubdir}
            onChange={(e) => handleTemplateChange("correspondenceSubdir", e.target.value)}
            disabled={readOnly}
            placeholder="01 Correspondentie"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.nas.correspondence_subdir_help", {
              defaultValue:
                "Binnen elke projectmap; gebruik forward-slashes voor geneste mappen (bv. '01 Correspondentie/In').",
            })}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t("settings.nas.folder_template", { defaultValue: "Submap-naam (template)" })}
          </label>
          <input
            type="text"
            value={cfg.folderTemplate}
            onChange={(e) => handleTemplateChange("folderTemplate", e.target.value)}
            disabled={readOnly}
            placeholder="{nr:03d} {dd-mm-yyyy} {subject}"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.nas.folder_template_help", {
              defaultValue:
                "Placeholders: {nr} {nr:03d} (volgnummer) · {dd-mm-yyyy} {yyyy-mm-dd} (datum) · {subject} (onderwerp zonder RE:/FW:) · {from} (afzendernaam).",
            })}
          </p>
        </div>
      </div>

      {/* Projectmappen aanmaken (NAS, desktop-only) */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        <h4 className="text-sm font-semibold text-slate-600">
          {t("settings.nas.project_folders_title", {
            defaultValue: "Projectmappen aanmaken (NAS)",
          })}
        </h4>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t("settings.nas.project_master")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pf.masterPath}
              onChange={(e) => savePf({ ...pf, masterPath: e.target.value })}
              disabled={readOnly}
              placeholder="\\DRIEBM-NAS\3bm\_TEMPLATES\Projectmap"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-500"
            />
            {isDesktopApp() && !readOnly && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/nas/pick-folder", {
                      method: "POST",
                      credentials: "same-origin",
                    });
                    const j = await res.json();
                    if (j.ok && j.path) savePf({ ...pf, masterPath: j.path });
                  } catch {
                    /* geannuleerd of mislukt */
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                {t("settings.nas.browse", { defaultValue: "Bladeren" })}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.nas.project_master_help")}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t("settings.nas.project_target_root")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pf.targetRoot}
              onChange={(e) => savePf({ ...pf, targetRoot: e.target.value })}
              disabled={readOnly}
              placeholder="\\DRIEBM-NAS\3bm\Projecten"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-500"
            />
            {isDesktopApp() && !readOnly && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/nas/pick-folder", {
                      method: "POST",
                      credentials: "same-origin",
                    });
                    const j = await res.json();
                    if (j.ok && j.path) savePf({ ...pf, targetRoot: j.path });
                  } catch {
                    /* geannuleerd of mislukt */
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                {t("settings.nas.browse", { defaultValue: "Bladeren" })}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.nas.project_target_root_help")}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {t("settings.nas.project_folder_name")}
          </label>
          <input
            type="text"
            value={pf.folderTemplate}
            onChange={(e) => savePf({ ...pf, folderTemplate: e.target.value })}
            disabled={readOnly}
            placeholder="{nr} {project_name}"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            {t("settings.nas.project_folder_name_help")}
          </p>
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium cursor-pointer transition-colors"
          >
            <Save size={15} />
            {saved
              ? t("settings.saved_confirmation", { defaultValue: "Opgeslagen!" })
              : t("settings.save_settings", { defaultValue: "Opslaan" })}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
            title={t("settings.nas.reset_defaults", { defaultValue: "Reset naar defaults" })}
          >
            <RotateCcw size={14} />
            {t("settings.nas.reset", { defaultValue: "Reset" })}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Rendert het gedeelde NAS-opslag-beleid. Bewerkbaar op de werkgever-only
 * Project-instellingen-tab; met `readOnly` ook op de Algemeen-tab getoond aan
 * medewerkers zodat de door de werkgever ingestelde paden voor iedereen
 * zichtbaar/leesbaar zijn (zonder schrijfrechten).
 */
export function NasSettingsSection({
  instanceId,
  readOnly = false,
}: {
  instanceId: string;
  readOnly?: boolean;
}) {
  return <NasSharedSection instanceId={instanceId} readOnly={readOnly} />;
}
