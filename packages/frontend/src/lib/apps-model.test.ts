import { test } from "node:test";
import assert from "node:assert/strict";
import { appsVanPersoon, githubUrl, mensenVan, takenStand, takenVanProject, type App } from "./apps-model.ts";
import type { TaakRegel } from "./werkplekken-model.ts";

const app = (naam: string, extra: Partial<App> = {}): App => ({
  name: naam, naam, status: "In ontwikkeling", in_ecosysteem: 1, productmanager: null, project: null,
  repository: null, codeowners: null, beschrijving: null, volgorde: 0, team: [], ...extra,
});
const taak = (subject: string, project: string, eind: string | null, wie: string[] = [], status = "Open"): TaakRegel =>
  ({ name: subject, subject, project, status, exp_start_date: null, exp_end_date: eind, _assign: JSON.stringify(wie) });

test("mensen van een app: productmanager en team samen, zonder dubbelen", () => {
  const a = app("Planner", { productmanager: "Ethan", team: [{ persoon: "Ethan", rol: null }, { persoon: "Caspar", rol: "ontwikkelaar" }] });
  assert.deepEqual(mensenVan(a), ["Ethan", "Caspar"]);
  assert.deepEqual(appsVanPersoon([a, app("PDF")], "Caspar").map((x) => x.naam), ["Planner"]);
});

test("takenstand: open, te laat, zonder eigenaar en de volgende deadline", () => {
  const taken = [
    taak("a", "PROJ-1", "2026-10-30", ["x@y.nl"]),
    taak("b", "PROJ-1", "2026-11-10 00:00:00"),
    taak("c", "PROJ-1", "2026-11-05"),
    taak("d", "PROJ-1", null, [], "Completed"),
    taak("e", "PROJ-2", "2026-11-04"),
  ];
  assert.deepEqual(takenStand(taken, "PROJ-1", "2026-11-03"), { open: 3, teLaat: 1, zonderEigenaar: 2, volgendeDeadline: "2026-11-05" });
  assert.deepEqual(takenStand(taken, null, "2026-11-03"), { open: 0, teLaat: 0, zonderEigenaar: 0, volgendeDeadline: null });
  assert.deepEqual(takenVanProject(taken, "PROJ-1").map((t) => t.subject), ["a", "c", "b"]);
});

test("github-link uit een repositorynaam", () => {
  assert.equal(githubUrl("OpenAEC-Foundation/open-pdf-studio"), "https://github.com/OpenAEC-Foundation/open-pdf-studio");
  assert.equal(githubUrl("https://github.com/x/y"), "https://github.com/x/y");
  assert.equal(githubUrl("geen repo"), null);
  assert.equal(githubUrl(null), null);
});
