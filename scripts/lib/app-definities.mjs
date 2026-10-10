/**
 * De definities van de Frappe-app, voor de scripts van de publicatieroute.
 *
 * Wat een site nodig heeft — de eigen doctypes, de velden op
 * standaarddoctypes, de rechten en de stamgegevens — staat op één plek: in
 * `frappe-app/y_next/`. De app past die definities toe bij de installatie;
 * het provisioneringsscript leest ze hier en zet ze via de REST-API op een
 * site zonder de app.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_PACKAGE = fileURLToPath(new URL("../../frappe-app/y_next/", import.meta.url));

/**
 * Leest een definitiebestand uit `frappe-app/y_next/setup/`.
 * @param {string} name — bijvoorbeeld "custom_fields.json"
 */
export function readSetup(name) {
  return JSON.parse(readFileSync(join(APP_PACKAGE, "setup", name), "utf8"));
}

/**
 * Leest de definitie van een doctype van de app.
 * @param {string} folder — de mapnaam, bijvoorbeeld "y_meeting_note"
 */
export function readAppDoctype(folder) {
  return JSON.parse(readFileSync(join(APP_PACKAGE, "y_next", "doctype", folder, `${folder}.json`), "utf8"));
}

/** De eigenschappen van een doctype die de REST-route overneemt. */
const DOCTYPE_KEYS = ["autoname", "naming_rule", "issingle", "sort_field", "sort_order"];

/**
 * Vlaggen die in elke rechtenrij expliciet moeten staan. In de app-definitie
 * ontbreekt een vlag die 0 is; de REST-route vult een ontbrekende vlag met de
 * standaardwaarde van DocPerm, en die is 1 voor write, create en delete.
 */
const PERMISSION_FLAGS = ["permlevel", "if_owner", "write", "create", "delete", "submit", "cancel", "amend"];

/**
 * Zet een doctype van de app om naar het maatwerk-doctype dat de REST-route
 * aanmaakt: zelfde naam, velden en rechten, maar in de module "Custom".
 * @param {object} appDoctype — de inhoud van `<doctype>.json` uit de app
 * @returns {object}
 */
export function toCustomDoctype(appDoctype) {
  const definition = { doctype: "DocType", name: appDoctype.name, module: "Custom", custom: 1 };
  for (const key of DOCTYPE_KEYS) {
    if (appDoctype[key] !== undefined) definition[key] = appDoctype[key];
  }
  definition.fields = (appDoctype.fields || []).map((field) => ({ ...field }));
  definition.permissions = (appDoctype.permissions || []).map((row) => {
    const filled = { ...row };
    for (const flag of PERMISSION_FLAGS) {
      if (filled[flag] === undefined) filled[flag] = 0;
    }
    return filled;
  });
  return definition;
}
