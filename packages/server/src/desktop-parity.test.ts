/**
 * Fase 5 — TS↔Rust drift-safety.
 *
 * De web-server (TypeScript) en de desktop-backend (Rust + fetch-adapter) zijn
 * twee losse implementaties. Niets in de compiler bewaakt dat ze gelijk lopen.
 * Deze tests falen hard zodra iets dat aan BEIDE kanten identiek moet zijn uit
 * elkaar loopt — zodat een stille regressie (een config-key of route die de
 * desktop nooit bereikt) bij `npm test`/CI opvalt i.p.v. pas in productie.
 *
 * Bewaakt:
 *  1. DESKTOP_CONFIG_KEYS (server index.ts ↔ Rust commands.rs) — zie CLAUDE.md
 *     "Central config sync": lopen de lijsten uit sync, dan bereikt een key de
 *     desktop nooit.
 *  2. De volledige /api/*-route-surface: elke server-route is op desktop óf
 *     mechanisch gedekt door de fetch-adapter, óf gedekt door de ERPNext-proxy-
 *     fallback, óf expliciet geclassificeerd (web-only / bekende gap). Nieuwe
 *     routes dwingen een bewuste keuze af.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverIndex = readFileSync(resolve(here, "index.ts"), "utf8");
const rustCommands = readFileSync(
  resolve(here, "../../desktop/src-tauri/src/commands.rs"),
  "utf8",
);
const adapterFetch = readFileSync(
  resolve(here, "../../desktop/src/adapter/fetch.ts"),
  "utf8",
);

/** Haal de string-literals uit de eerste array-body die op `declRegex` volgt. */
function extractKeys(src: string, declRegex: RegExp, label: string): string[] {
  const m = src.match(declRegex);
  assert.ok(m, `Kon ${label} niet vinden — is de declaratie hernoemd/verplaatst?`);
  const body = m![1];
  const keys = [...body.matchAll(/"([^"]+)"/g)].map((k) => k[1]);
  assert.ok(keys.length > 0, `${label} bevat geen keys (parse-fout?)`);
  return keys;
}

test("DESKTOP_CONFIG_KEYS: server (TS) en desktop (Rust) lopen synchroon", () => {
  const tsKeys = extractKeys(
    serverIndex,
    /const DESKTOP_CONFIG_KEYS\s*=\s*\[([\s\S]*?)\]/,
    "DESKTOP_CONFIG_KEYS in packages/server/src/index.ts",
  );
  const rustKeys = extractKeys(
    rustCommands,
    /const DESKTOP_CONFIG_KEYS:\s*&\[&str\]\s*=\s*&\[([\s\S]*?)\]/,
    "DESKTOP_CONFIG_KEYS in packages/desktop/src-tauri/src/commands.rs",
  );

  const tsSet = new Set(tsKeys);
  const rustSet = new Set(rustKeys);
  const missingInRust = tsKeys.filter((k) => !rustSet.has(k));
  const missingInTs = rustKeys.filter((k) => !tsSet.has(k));

  assert.deepEqual(
    { missingInRust, missingInTs },
    { missingInRust: [], missingInTs: [] },
    "DESKTOP_CONFIG_KEYS uit sync tussen server (TS) en desktop (Rust). " +
      "Werk beide lijsten bij (index.ts + commands.rs), anders bereikt de key de desktop nooit.",
  );
});

/* ────────────────────────────────────────────────────────────────────────
 * Route-pariteit over de VOLLEDIGE /api/*-surface.
 *
 * Hoe de desktop een /api/*-fetch afhandelt (installDesktopFetchInterceptor
 * in packages/desktop/src/adapter/fetch.ts):
 *   1. een if-chain met drie match-stijlen: `url === "…"`,
 *      `url.startsWith("…")` en `url.match(/…/)`;
 *   2. onbehandelde /api/mail/* → expliciete 501;
 *   3. ál het overige → de "ERPNext proxy (everything else)"-fallback, die de
 *      request rechtstreeks naar de ERPNext van de actieve instance stuurt.
 *      Voor /api/resource/* is dat correct (zelfde semantiek als de server-
 *      bridge); voor Y-app-server-specifieke routes betekent het een 4xx bij
 *      ERPNext — d.w.z. een SILENTE gap.
 *
 * Deze test simuleert de if-chain mechanisch: hij extraheert de exacte,
 * prefix- en regex-patronen uit de adapter-bron en matcht elke server-route
 * (met ingevulde :params) daartegen. Wat niet matcht moet in één van de
 * geclassificeerde lijsten hieronder staan — anders faalt de test en dwingt
 * hij een bewuste keuze af: spiegelen in fetch.ts of hier classificeren.
 * Onbekende route blind allowlisten is NIET de bedoeling: eerst uitzoeken.
 *
 * Beperking (bewust): de match is method-blind — een adapter-branch die
 * alleen GET afhandelt "dekt" hier ook PATCH/DELETE op hetzelfde pad. Dat
 * houdt de test simpel; de winst zit in het detecteren van volledig
 * ongespiegelde paden (de 501/4xx-klasse die "map verwijderen" trof).
 * ──────────────────────────────────────────────────────────────────────── */

/** Routes die op desktop bewust door de ERPNext-proxy-fallback gedekt worden
 *  (zelfde semantiek als de server-bridge — geen gap). */
const ERPNEXT_PROXY_COVERED = new Set([
  "/api/resource/:doctype",
  "/api/resource/:doctype/:name",
]);

/** Web-only by design — de desktop heeft dit pad niet nodig of consumeert het
 *  buiten de interceptor om. */
const WEB_ONLY = new Map<string, string>([
  ["/api/yapp/login", "desktop heeft geen Y-app-account; Stronghold-vault vervangt het"],
  ["/api/yapp/logout", "idem — 'uitloggen' = kluis vergrendelen"],
  ["/api/yapp/signup", "idem"],
  ["/api/erpnext-asset", "desktop embedt afbeeldingen als data:-URLs (zie CLAUDE.md fetch-adapter-uitzondering)"],
  ["/api/messenger/file-proxy", "idem — Rust haalt previews server-side op en embedt ze"],
  ["/api/desktop-config", "door desktop-Rust out-of-band geconsumeerd (sync_instance_config), niet via de interceptor"],
  ["/api/app-version", "UpdateBanner haalt 'm absoluut op bij de web-server (VERSION_URL), niet ge-intercept"],
  ["/api/health", "server-monitoring; geen desktop-equivalent"],
  ["/api/health/mail", "idem"],
  ["/api/health/mail/upstream", "idem"],
  ["/api/health/messenger", "idem"],
  ["/api/health/run", "idem"],
  ["/api/debug/user-visibility", "debug-endpoint"],
  ["/api/project-template-suggest", "dode route: de frontend haalt de template-mapping direct op (geen caller meer)"],
]);

/** Bekende, nog-niet-gespiegelde gaps: deze vallen op desktop door naar de
 *  ERPNext-proxy (→ 4xx bij ERPNext) of de mail-501. Gedocumenteerd zodat een
 *  NIEUWE route niet stil in deze categorie belandt. Spiegelen = entry hier
 *  weghalen (de hygiëne-check dwingt dat af zodra het pad mechanisch dekt). */
const KNOWN_GAPS = new Map<string, string>([
  ["/api/mail/move-cross-account", "bewust 501 (vereist 2-account cred-resolver; zie OPMERKINGEN punt 1)"],
  ["/api/mail/test-shared", "shared-mailbox test-flow niet gespiegeld"],
  ["/api/mail/warm", "server-only isWarm-probe; frontend roept 'm niet aan"],
  ["/api/messenger/subscribe", "PWA-workaround voor /ws/events; desktop heeft geen WS-kanaal"],
  ["/api/agent/chat", "AgentPanel-chat draait op server-side sleutels; niet lokaal te spiegelen"],
  ["/api/instances/:id/invalidate-session", "sessie-cache is een web-serverconcept"],
  ["/api/instances/:id/refresh-version", "instance-versie-refresh nog niet gespiegeld"],
  ["/api/instances/:id/version-override", "idem"],
]);

/** Adapter-patronen die géén server-route dekken: desktop-only endpoints. */
const DESKTOP_ONLY = new Map<string, string>([
  ["/api/desktop/preferences", "lokale desktop-preferences (Rust), bestaat niet op de web-server"],
  ["/api/desktop/open-external", "externe link in de systeembrowser openen (shell-plugin); op web opent window.open gewoon een tabblad"],
  ["/api/nas/create-folders", "native NAS-mapaanmaak (Rust), desktop-only"],
  ["/api/nas/open-folder", "Verkenner openen (Rust), desktop-only"],
  ["/api/nas/pick-folder", "native mapkiezer (rfd), desktop-only"],
  ["/api/mail/config", "op web bewust NIET gemount (zie CLAUDE.md credential-resolutie); desktop gebruikt 'm wel"],
  ["/api/mail/attachment/open-external", "PDF direct openen met de OS-standaardviewer (Rust, geen base64-omweg); web gebruikt hiervoor gewoon window.open naar een echt browsertabblad"],
  ["/api/messenger/full-image", "lazy full-size afbeelding als data: URL voor de lightbox (Rust, NC Basic auth); web gebruikt hiervoor /api/messenger/file-proxy met een <img>-URL — dat pad bestaat op desktop niet (fetch-adapter exception)"],
]);

/** Vul :params in met plausibele concrete waarden zodat de patronen matchen. */
function concretize(route: string): string {
  return route
    .split("/")
    .map((seg) =>
      seg.startsWith(":")
        ? ({
            ":id": "3",
            ":instanceId": "3",
            ":accountId": "5",
            ":key": "some-key",
            ":doctype": "Project",
            ":name": "DOC-001",
            ":eventId": "7",
          } as Record<string, string>)[seg] ?? "x1"
        : seg,
    )
    .join("/");
}

function extractAdapterPatterns() {
  const exacts = new Set(
    [...adapterFetch.matchAll(/url === "(\/api\/[^"]+)"/g)].map((m) => m[1]),
  );
  const prefixes = [...adapterFetch.matchAll(/url\.startsWith\("(\/api\/[^"]+)"/g)]
    .map((m) => m[1])
    // "/api/mail/" is de 501-CATCH-ALL (rejector, geen handler) — meetellen
    // zou élke mail-route als gedekt markeren.
    .filter((p) => p !== "/api/mail/");
  // Regex-literal-body: tolereert een onge-escapete `/` bínnen een
  // character-class (bv. `[^/?]` in de mail-accounts-matchers).
  const regexes = [
    ...adapterFetch.matchAll(/url\.match\(\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/\)/g),
  ].map((m) => new RegExp(m[1]));
  assert.ok(exacts.size >= 10, `te weinig exact-patronen gevonden (${exacts.size}) — parse-fout?`);
  assert.ok(prefixes.length >= 15, `te weinig prefix-patronen gevonden (${prefixes.length}) — parse-fout?`);
  assert.ok(regexes.length >= 5, `te weinig regex-patronen gevonden (${regexes.length}) — parse-fout?`);
  return { exacts, prefixes, regexes };
}

function extractServerRoutes(): string[] {
  const routes = new Set(
    [...serverIndex.matchAll(/app\.(?:get|post|delete|put|patch)\("(\/api\/[^"]+)"/g)].map(
      (m) => m[1],
    ),
  );
  assert.ok(routes.size >= 80, `te weinig server-routes gevonden (${routes.size}) — parse-fout?`);
  return [...routes].sort();
}

/** Prefix-match mét segment-grens: `/api/mail/move` dekt `/api/mail/move` en
 *  `/api/mail/move?…`, maar NIET `/api/mail/move-cross-account` — die valt in
 *  de praktijk wel de move-branch binnen maar wordt daar met lege params
 *  mishandeld (4xx/502), dus "gedekt" zou een leugen zijn. */
function coveredByPrefix(u: string, p: string): boolean {
  if (!u.startsWith(p)) return false;
  if (u.length === p.length) return true;
  const next = u[p.length];
  return next === "?" || next === "/" || p.endsWith("?") || p.endsWith("/");
}

/** Dekt de adapter-if-chain deze route mechanisch? (method-blind) */
function adapterCovers(
  route: string,
  pat: { exacts: Set<string>; prefixes: string[]; regexes: RegExp[] },
): boolean {
  const bare = concretize(route);
  const withQuery = `${bare}?x=1`; // frontend-calls dragen vrijwel altijd een query
  if (pat.exacts.has(bare)) return true;
  if (pat.prefixes.some((p) => coveredByPrefix(bare, p) || coveredByPrefix(withQuery, p))) return true;
  return pat.regexes.some((r) => r.test(bare) || r.test(withQuery));
}

test("route-pariteit: elke server-route is op desktop gedekt of geclassificeerd", () => {
  const routes = extractServerRoutes();
  const pat = extractAdapterPatterns();

  const unclassified = routes.filter(
    (r) =>
      !adapterCovers(r, pat) &&
      !ERPNEXT_PROXY_COVERED.has(r) &&
      !WEB_ONLY.has(r) &&
      !KNOWN_GAPS.has(r),
  );
  assert.deepEqual(
    unclassified,
    [],
    "Nieuwe/ongedekte server-route(s) zonder desktop-classificatie. Kies bewust: " +
      "spiegelen in packages/desktop/src/adapter/fetch.ts, of classificeren in " +
      "WEB_ONLY / KNOWN_GAPS / ERPNEXT_PROXY_COVERED in deze test (met motivering). " +
      "NIET blind allowlisten — een ongespiegelde route faalt op desktop met 4xx/501.",
  );

  // Hygiëne 1: allowlist-entries voor routes die niet meer bestaan → opruimen.
  const routeSet = new Set(routes);
  const stale = [...WEB_ONLY.keys(), ...KNOWN_GAPS.keys(), ...ERPNEXT_PROXY_COVERED].filter(
    (r) => !routeSet.has(r),
  );
  assert.deepEqual(stale, [], "Allowlist-entries voor niet-(meer-)bestaande server-routes; opruimen.");

  // Hygiëne 2: KNOWN_GAPS die inmiddels mechanisch gedekt zijn → entry weghalen
  // (de gap is gedicht; de lijst moet de werkelijkheid blijven beschrijven).
  const healed = [...KNOWN_GAPS.keys()].filter((r) => adapterCovers(r, pat));
  assert.deepEqual(
    healed,
    [],
    "KNOWN_GAPS-entries die inmiddels gespiegeld zijn — verwijder ze uit de lijst.",
  );
});

test("route-pariteit omgekeerd: adapter-patronen zonder server-route zijn desktop-only geclassificeerd", () => {
  const routes = extractServerRoutes();
  const pat = extractAdapterPatterns();
  const concretes = routes.map((r) => concretize(r));

  // Exact- en prefix-patronen die geen enkele server-route dekken, moeten in
  // DESKTOP_ONLY staan. (Regex-patronen dekken aantoonbaar server-routes en
  // worden hier overgeslagen.)
  const orphanExacts = [...pat.exacts].filter(
    (e) => !concretes.includes(e) && !DESKTOP_ONLY.has(e),
  );
  const orphanPrefixes = pat.prefixes.filter(
    (p) =>
      !concretes.some((c) => coveredByPrefix(c, p) || coveredByPrefix(`${c}?x=1`, p)) &&
      ![...DESKTOP_ONLY.keys()].some((d) => p.startsWith(d) || d.startsWith(p)),
  );
  assert.deepEqual(
    { orphanExacts, orphanPrefixes },
    { orphanExacts: [], orphanPrefixes: [] },
    "Adapter-patronen die geen server-route dekken en niet in DESKTOP_ONLY staan — " +
      "verwijder dood adapter-pad of classificeer het hier.",
  );
});
