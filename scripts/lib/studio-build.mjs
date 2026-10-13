import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Controle vóór de hoofdbuild: een distributie bevat beide lokale studio's en bronarchieven. */
export function studioBuildInputs(env, root) {
  const cadDist = resolve(env.YNEXT_CAD_DIST || join(root, "studio-runtime", "cad"));
  const plannerDist = resolve(env.YNEXT_PLANNER_DIST || join(root, "studio-runtime", "planner"));
  const cadSourceArchive = resolve(env.YNEXT_CAD_SOURCE_ARCHIVE || join(cadDist, "source.zip"));
  const plannerSourceArchive = resolve(env.YNEXT_PLANNER_SOURCE_ARCHIVE || join(plannerDist, "source.zip"));
  for (const [label, file] of [["CAD-bundel", join(cadDist, "index.html")], ["Planner-bundel", join(plannerDist, "index.html")], ["CAD-bronarchief", cadSourceArchive], ["Planner-bronarchief", plannerSourceArchive]]) {
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(label + " ontbreekt: " + file);
  }
  return { cadDist, plannerDist, cadSourceArchive, plannerSourceArchive };
}
