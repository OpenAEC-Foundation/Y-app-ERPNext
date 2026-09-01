import { test } from "node:test";
import assert from "node:assert/strict";
import { invalidateCache } from "./erpnext.ts";
import {
  fetchGlobalDefaultCompany,
  pickDefaultCompany,
  resetDefaultCompanyCache,
  resolveDefaultCompany,
  sortCompanies,
} from "./default-company.ts";

/**
 * De bedrijven van de doelinstance, in de volgorde waarin een ongesorteerde
 * fetch ze zou kunnen teruggeven. "Castellum Rosarum" is hier het bewijsstuk:
 * dat is wat de dialogen vóór deze module als standaard pakten, terwijl
 * ERPNext zelf "OpenAEC Studio BV" als `Global Defaults.default_company` heeft
 * staan.
 */
const COMPANIES = [
  { name: "Castellum Rosarum" },
  { name: "OpenAEC Studio BV" },
  { name: "Vroughindeweij Industries BV" },
  { name: "Waterlijn BV i.o." },
  { name: "Zera Investments BV" },
];

/* ─────────────────────────── De keuzeregel ───────────────────────────── */

test("tak 1 — een expliciete gebruikersvoorkeur wint van alles", () => {
  const chosen = pickDefaultCompany({
    preference: "Zera Investments BV",
    globalDefault: "OpenAEC Studio BV",
    companies: COMPANIES,
  });
  assert.equal(chosen, "Zera Investments BV");
});

test("tak 2 — zonder voorkeur wint Global Defaults, niet het eerste bedrijf", () => {
  const chosen = pickDefaultCompany({
    preference: "",
    globalDefault: "OpenAEC Studio BV",
    companies: COMPANIES,
  });
  assert.equal(chosen, "OpenAEC Studio BV");
  // Precies de regressie waarvoor deze module bestaat.
  assert.notEqual(chosen, "Castellum Rosarum");
});

test("tak 3 — zonder voorkeur én zonder standaard: alfabetisch de eerste", () => {
  const chosen = pickDefaultCompany({ companies: COMPANIES });
  assert.equal(chosen, "Castellum Rosarum");
});

test("tak 3 sorteert zelf: de volgorde van de server telt niet mee", () => {
  const shuffled = [{ name: "Zera Investments BV" }, { name: "Castellum Rosarum" }];
  assert.equal(pickDefaultCompany({ companies: shuffled }), "Castellum Rosarum");
  // Twee keer dezelfde uitkomst, ongeacht de aangeleverde volgorde.
  assert.equal(pickDefaultCompany({ companies: [...shuffled].reverse() }), "Castellum Rosarum");
});

test("een voorkeur naar een verwijderd bedrijf valt door naar de standaard", () => {
  const chosen = pickDefaultCompany({
    preference: "Bedrijf Dat Niet Meer Bestaat",
    globalDefault: "OpenAEC Studio BV",
    companies: COMPANIES,
  });
  assert.equal(chosen, "OpenAEC Studio BV");
});

test("een standaard naar een verwijderd bedrijf valt door naar het vangnet", () => {
  const chosen = pickDefaultCompany({
    globalDefault: "Ooit BV",
    companies: COMPANIES,
  });
  assert.equal(chosen, "Castellum Rosarum");
});

test("zonder bedrijvenlijst blijft de voorkeur staan (geen lijst = niets te toetsen)", () => {
  // Een mislukte Company-fetch mag de keuze van de gebruiker niet wissen.
  assert.equal(pickDefaultCompany({ preference: "Waterlijn BV i.o." }), "Waterlijn BV i.o.");
  assert.equal(pickDefaultCompany({ globalDefault: "OpenAEC Studio BV" }), "OpenAEC Studio BV");
  assert.equal(pickDefaultCompany({}), "");
});

test("witruimte telt niet als keuze", () => {
  const chosen = pickDefaultCompany({
    preference: "   ",
    globalDefault: "OpenAEC Studio BV",
    companies: COMPANIES,
  });
  assert.equal(chosen, "OpenAEC Studio BV");
});

test("sortCompanies laat het origineel met rust", () => {
  const input = [{ name: "Zera Investments BV" }, { name: "Castellum Rosarum" }];
  const sorted = sortCompanies(input);
  assert.equal(sorted[0].name, "Castellum Rosarum");
  assert.equal(input[0].name, "Zera Investments BV");
});

/* ───────────────────────── De opgehaalde kant ────────────────────────── */

interface MockRoute {
  match: (url: string) => boolean;
  /** Response-`data`; een object voor `fetchDocument`, een array voor `fetchList`. */
  data: unknown;
  status?: number;
}

function installFetchMock(routes: MockRoute[]): { urls: string[]; restore: () => void } {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    const route = routes.find((r) => r.match(url));
    const status = route?.status ?? 200;
    const body = status === 200 ? { data: route?.data ?? [] } : { exception: "PermissionError" };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { urls, restore: () => { globalThis.fetch = original; } };
}

/**
 * Zowel de module-cache als de 30-seconden-cache van `erpnext.ts`.
 *
 * De wachttijd is er niet voor de sier: `fetchDocument` houdt een in-flight
 * Promise nog **100 ms** na afloop in `inflightRequests`, zodat dubbele
 * useEffect-fires één request delen. Twee tests achter elkaar bevragen
 * dezelfde URL (`Global Defaults` is een Single), dus zonder deze pauze krijgt
 * de tweede test het antwoord van de eerste — en dat zegt niets over de code
 * die hier getoetst wordt.
 */
async function freshCaches(): Promise<void> {
  resetDefaultCompanyCache();
  invalidateCache();
  await new Promise((r) => setTimeout(r, 150));
}

test("resolveDefaultCompany leest Global Defaults als er geen voorkeur is", async () => {
  await freshCaches();
  const mock = installFetchMock([
    { match: (u) => u.includes("Global%20Defaults"), data: { default_company: "OpenAEC Studio BV" } },
    { match: (u) => u.includes("/Company"), data: COMPANIES },
  ]);
  try {
    assert.equal(await resolveDefaultCompany({ preference: "" }), "OpenAEC Studio BV");
    // Beide bronnen zijn daadwerkelijk bevraagd — niet stiekem geraden.
    assert.ok(mock.urls.some((u) => u.includes("Global%20Defaults")));
    assert.ok(mock.urls.some((u) => u.includes("/Company")));
  } finally {
    mock.restore();
    await freshCaches();
  }
});

test("resolveDefaultCompany valt bij een 403 op Global Defaults terug op het vangnet", async () => {
  await freshCaches();
  const mock = installFetchMock([
    { match: (u) => u.includes("Global%20Defaults"), data: null, status: 403 },
    { match: (u) => u.includes("/Company"), data: COMPANIES },
  ]);
  try {
    assert.equal(await resolveDefaultCompany({ preference: "" }), "Castellum Rosarum");
  } finally {
    mock.restore();
    await freshCaches();
  }
});

test("resolveDefaultCompany respecteert de voorkeur zonder Global Defaults te hoeven volgen", async () => {
  await freshCaches();
  const mock = installFetchMock([
    { match: (u) => u.includes("Global%20Defaults"), data: { default_company: "OpenAEC Studio BV" } },
    { match: (u) => u.includes("/Company"), data: COMPANIES },
  ]);
  try {
    assert.equal(
      await resolveDefaultCompany({ preference: "Waterlijn BV i.o." }),
      "Waterlijn BV i.o.",
    );
  } finally {
    mock.restore();
    await freshCaches();
  }
});

test("fetchGlobalDefaultCompany cachet: een tweede aanroep doet geen request", async () => {
  await freshCaches();
  const mock = installFetchMock([
    { match: () => true, data: { default_company: "OpenAEC Studio BV" } },
  ]);
  try {
    assert.equal(await fetchGlobalDefaultCompany(), "OpenAEC Studio BV");
    const after = mock.urls.length;
    assert.equal(await fetchGlobalDefaultCompany(), "OpenAEC Studio BV");
    assert.equal(mock.urls.length, after);
  } finally {
    mock.restore();
    await freshCaches();
  }
});
