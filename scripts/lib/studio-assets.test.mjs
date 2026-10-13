import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { prepareStudioAssets, validateStudioAssets } from "./studio-assets.mjs";

const BASE = "/assets/y_next/app/studios/planner/";
function put(root, path, content) {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, content);
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ynext-studios-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cadDist = join(root, "cad-source", "dist");
  const plannerDist = join(root, "planner-source", "dist-platform");
  const outDir = join(root, "output");
  put(cadDist, "index.html", '<html><head><link href="/logo-test.svg"><script type="module">import init from "/OpenCADStudio-test.js"; await init({module_or_path:"/OpenCADStudio-test_bg.wasm"});</script><script type="module" src="domera-bridge.js"></script></head></html>');
  put(cadDist, "OpenCADStudio-test.js", 'export default function init(input = new URL("OpenCADStudio_bg.wasm", import.meta.url)){ return input; }');
  put(cadDist, "OpenCADStudio-test_bg.wasm", new Uint8Array([0,97,115,109,1,0,0,0]));
  put(cadDist, "domera-bridge.js", "globalThis.bridgePreserved = true;");
  put(cadDist, "logo-test.svg", "<svg/>");
  put(cadDist, "fonts/greek.ttf", "font bytes");
  put(cadDist, "fonts/OFL.txt", "Font attribution and license");
  put(join(cadDist, ".."), "LICENSE", "CAD source license");
  put(plannerDist, "index.html", `<html><head><script type="module" src="${BASE}assets/main.js"></script><link rel="stylesheet" href="${BASE}assets/main.css"></head><body><div id="root"></div></body></html>`);
  put(plannerDist, "assets/main.js", 'import "./runtime.js"; export const wasm = new URL("./font-subset.wasm", import.meta.url);');
  put(plannerDist, "assets/runtime.js", "export const runtime = true;");
  put(plannerDist, "assets/main.css", 'body{font-family:test}');
  put(plannerDist, "assets/font-subset.wasm", new Uint8Array([0,97,115,109,1,0,0,0]));
  put(plannerDist, ".vite/manifest.json", JSON.stringify({ "index.html": { file:"assets/main.js", isEntry:true, css:["assets/main.css"], assets:["assets/font-subset.wasm"] } }));
  put(join(plannerDist, ".."), "LICENSE", "Planner source license");
  put(join(plannerDist, ".."), "LICENSE.GPL", "Additional source license terms");
  put(join(plannerDist,".."),"src/services/pdf/fonts/Inter-OFL.txt","PDF font copyright terms");
  put(join(plannerDist,".."),"src/services/pdf/vendor/HarfBuzz-LICENSE.txt","Subsetter copyright terms");
  return { root, cadDist, plannerDist, outDir };
}

test("Lokale platformbundels behouden bridge, fonts, notices en bronarchief", (t) => {
  const f = fixture(t);
  const archive = join(f.root, "planner-source.zip");
  writeFileSync(archive, "source archive bytes");
  const result = prepareStudioAssets({ ...f, plannerSourceArchive:archive });
  assert.equal(readFileSync(join(f.outDir,"studios/cad/domera-bridge.js"), "utf8"), "globalThis.bridgePreserved = true;");
  assert.equal(readFileSync(join(f.outDir,"studios/cad/fonts/OFL.txt"), "utf8"), "Font attribution and license");
  assert.equal(readFileSync(join(f.outDir,"studios/planner/source/planner-source.zip"), "utf8"), "source archive bytes");
  const metadata = JSON.parse(readFileSync(join(f.outDir,"studios/studio-assets.json"), "utf8"));
  assert.equal(metadata.studios.planner.sourceArchive,"source/planner-source.zip");
  assert.ok(metadata.studios.cad.notices.includes("fonts/OFL.txt"));
  assert.ok(metadata.studios.planner.notices.includes("notices/LICENSE.GPL"));
  assert.equal(readFileSync(join(f.outDir,"studios/planner/notices/src/services/pdf/fonts/Inter-OFL.txt"),"utf8"),"PDF font copyright terms");
  assert.ok(metadata.studios.planner.notices.includes("notices/src/services/pdf/vendor/HarfBuzz-LICENSE.txt"));
  assert.equal(result.plannerDir,join(f.outDir,"studios/planner"));
});

function storageRealm(script, scope, shared, opened) {
  class Storage {
    getItem(key) { return shared.has(String(key)) ? shared.get(String(key)) : null; }
    setItem(key,value) { shared.set(String(key),String(value)); }
    removeItem(key) { shared.delete(String(key)); }
    clear() { throw new Error("Geen globale clear toegestaan"); }
  }
  const realm = { Storage, URLSearchParams, location:{search:scope === undefined ? "" : "?scope=" + scope}, crypto:{randomUUID:() => "unique-ephemeral-session"}, indexedDB:{open:(name,version) => {opened.push(["open",name,version]); return name; },deleteDatabase:(name) => {opened.push(["delete",name]); return name; }}, localStorage:new Storage(), sessionStorage:new Storage() };
  runInNewContext(script,realm);
  return realm;
}
test("Planner scope-isolatie bewaart voorkeuren en recovery per account zonder ruwe migratie", (t) => {
  const f = fixture(t);
  prepareStudioAssets(f);
  const html = readFileSync(join(f.outDir,"studios/planner/index.html"), "utf8");
  assert.ok(html.indexOf('src="./studio-scope.js"') > 0);
  assert.ok(html.indexOf('src="./studio-scope.js"') < html.indexOf('type="module"'));
  const script = readFileSync(join(f.outDir,"studios/planner/studio-scope.js"), "utf8");
  const shared = new Map([["ops-theme","foreign-data"],["open-planner-studio-recent-files","foreign-recent-files"]]);
  const opened = [];
  const a = storageRealm(script,"a".repeat(64),shared,opened);
  const b = storageRealm(script,"b".repeat(64),shared,opened);
  assert.equal(a.localStorage.getItem("ops-theme"),null);
  assert.equal(a.localStorage.getItem("open-planner-studio-recent-files"),null);
  a.localStorage.setItem("ops-theme","light");
  assert.equal(a.localStorage.getItem("ops-theme"),"light");
  assert.equal(b.localStorage.getItem("ops-theme"),null);
  b.localStorage.setItem("ops-theme","dark");
  a.localStorage.removeItem("ops-theme");
  assert.equal(b.localStorage.getItem("ops-theme"),"dark");
  assert.equal(shared.get("ops-theme"),"foreign-data");
  a.localStorage.removeItem("open-planner-studio-recent-files");
  assert.equal(shared.get("open-planner-studio-recent-files"),"foreign-recent-files");
  a.sessionStorage.setItem("ops-recovery-session","session-a");
  assert.equal(b.sessionStorage.getItem("ops-recovery-session"),null);
  a.indexedDB.open("ops-recovery",2);
  b.indexedDB.open("ops-recovery",2);
  a.indexedDB.deleteDatabase("ops-recovery");
  assert.deepEqual(opened,[["open","ynext-planner-" + "a".repeat(64) + "-ops-recovery",2],["open","ynext-planner-" + "b".repeat(64) + "-ops-recovery",2],["delete","ynext-planner-" + "a".repeat(64) + "-ops-recovery"]]);
  a.localStorage.setItem("other-app-setting","untouched");
  assert.equal(b.localStorage.getItem("other-app-setting"),"untouched");
});
test("Ontbrekende of ongeldige scope gebruikt uitsluitend een tijdelijke namespace", (t) => {
  const f = fixture(t);
  prepareStudioAssets(f);
  assert.ok(existsSync(join(f.outDir,"studios/planner/studio-scope.js")));
  const script = readFileSync(join(f.outDir,"studios/planner/studio-scope.js"), "utf8");
  for (const scope of [undefined,"../account","RAW-USER@EXAMPLE.TEST"]) {
    const shared = new Map([["ops-theme","foreign"]]);
    const realm = storageRealm(script,scope,shared,[]);
    realm.localStorage.setItem("ops-theme","temporary");
    assert.equal(shared.get("ops-theme"),"foreign");
    assert.equal(shared.get("ynext-planner-ephemeral-unique-ephemeral-session-ops-theme"),"temporary");
  }
});

test("CAD entry gebruikt relatieve assets en bootstrap staat vóór de module", async (t) => {
  const f = fixture(t);
  prepareStudioAssets(f);
  const html = readFileSync(join(f.outDir,"studios/cad/index.html"), "utf8");
  assert.ok(html.includes('href="./logo-test.svg"'));
  assert.ok(html.includes('from "./OpenCADStudio-test.js"'));
  assert.ok(html.includes('module_or_path:"./OpenCADStudio-test_bg.wasm"'));
  const bootstrap = html.match(/<script data-ynext-studio-bootstrap>([\s\S]*?)<\/script>/);
  assert.ok(bootstrap);
  assert.ok(html.indexOf(bootstrap[0]) < html.indexOf('<script type="module"'));
  const calls = [];
  const realm = { URL, Request, Response, TypeError, document:{baseURI:"https://host.test/assets/y_next/app/studios/cad/index.html"}, location:{href:"https://host.test/assets/y_next/app/studios/cad/index.html"}, fetch:async (input,opts) => { calls.push({url:typeof input === "string" ? input : input.url,opts}); return new Response("local asset"); } };
  realm.window = realm;
  runInNewContext(bootstrap[1], realm);
  await realm.fetch("z-cad-font-greek.ttf");
  assert.equal(calls[0].url,"https://host.test/assets/y_next/app/studios/cad/fonts/greek.ttf");
  assert.equal(calls[0].opts.credentials,"omit");
  assert.deepEqual(await (await realm.fetch("/supporters.json")).json(),[]);
  assert.equal(calls.length,1);
  await assert.rejects(realm.fetch("https://remote.test/upload"),/lokale studio/);
  await assert.rejects(realm.fetch("/api/private"),/lokale studio/);
  await assert.rejects(realm.fetch("./upload", {method:"POST"}),/lokale studio/);
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(policy.split(";").some((part) => part.trim() === "connect-src 'self'"));
  assert.ok(policy.includes("'wasm-unsafe-eval'"));
  assert.equal(readFileSync(join(f.outDir,"studios/cad/supporters.json"),"utf8"),"[]\n");
});

for (const [title,path,pattern] of [
  ["ontbrekende CAD-WASM", "cad:OpenCADStudio-test_bg.wasm", /WASM|asset ontbreekt/],
  ["ontbrekende Planner-WASM", "planner:assets/font-subset.wasm", /WASM|asset ontbreekt/],
  ["ontbrekende platformmanifest", "planner:.vite/manifest.json", /manifest/],
  ["ontbrekende importasset", "planner:assets/runtime.js", /asset ontbreekt/],
  ["ontbrekende entry", "cad:index.html", /entry|index.html/],
]) test(`${title} weigert het pakket vóór outputwijzigingen`, (t) => {
  const f = fixture(t);
  const [kind,file] = path.split(":");
  rmSync(join(kind === "cad" ? f.cadDist : f.plannerDist,file));
  put(f.outDir,"keep.txt","keep existing output");
  assert.throws(() => prepareStudioAssets(f),pattern);
  assert.equal(readFileSync(join(f.outDir,"keep.txt"),"utf8"),"keep existing output");
  assert.equal(existsSync(join(f.outDir,"studios")),false);
});

test("Verkeerde Planner-buildbase wordt niet verpakt", (t) => {
  const f = fixture(t);
  put(f.plannerDist,"index.html",'<script type="module" src="/assets/main.js"></script>');
  assert.throws(() => prepareStudioAssets(f),/buildbase/);
});
test("Assetpad buiten de bronmap wordt geweigerd", (t) => {
  const f = fixture(t);
  put(f.plannerDist,"assets/main.js",'import "../../private.js";');
  put(join(f.plannerDist,".."),"private.js","private source");
  assert.throws(() => prepareStudioAssets(f),/buiten/);
});
test("Tekst met import-achtige fragmenten wordt niet als assetpad behandeld", (t) => {
  const f = fixture(t);
  put(f.plannerDist,"assets/runtime.js",`export const caption="from')]}),e.jsxs('";`);
  assert.doesNotThrow(() => prepareStudioAssets(f));
});
test("Alleen Noorse helpkopieën krijgen equivalente venstertermen met dezelfde hoofdletters", (t) => {
  const f = fixture(t);
  const original = "vindusrammer. Vindusrammene og vinduskarmene. VINDUSRAMMER.\n";
  const expected = "rammer til vinduer. Rammene til vinduene og karmene til vinduene. RAMMER TIL VINDUER.\n";
  put(f.plannerDist,"docs/nb/windows.md",original);
  put(f.plannerDist,"docs/en/windows.md",original);
  put(f.plannerDist,"docs/nb/untouched.txt",original);
  put(f.plannerDist,"examples/windows.md",original);
  const archive = join(f.root,"source.zip");
  writeFileSync(archive,original);
  prepareStudioAssets({...f,plannerSourceArchive:archive});
  assert.equal(readFileSync(join(f.outDir,"studios/planner/docs/nb/windows.md"),"utf8"),expected);
  for (const path of ["docs/en/windows.md","docs/nb/untouched.txt","examples/windows.md"]) {
    assert.equal(readFileSync(join(f.outDir,"studios/planner",path),"utf8"),original);
  }
  assert.equal(readFileSync(join(f.plannerDist,"docs/nb/windows.md"),"utf8"),original);
  assert.equal(readFileSync(join(f.outDir,"studios/planner/source/source.zip"),"utf8"),original);
  const metadata = JSON.parse(readFileSync(join(f.outDir,"studios/studio-assets.json"),"utf8"));
  assert.deepEqual(metadata.studios.planner.localizedDocRewrites,["docs/nb/windows.md"]);
  assert.ok(metadata.studios.planner.notices.includes("Y-NEXT-PACKAGING-NOTICE.txt"));
  assert.ok(readFileSync(join(f.outDir,"studios/planner/Y-NEXT-PACKAGING-NOTICE.txt"),"utf8").includes("docs/nb/*.md"));
});
test("Bestaande studiodoelen worden niet overschreven", (t) => {
  const f = fixture(t);
  put(f.outDir,"studios/cad/user.txt","existing studio data");
  assert.throws(() => prepareStudioAssets(f),/bestaat al/);
  assert.equal(readFileSync(join(f.outDir,"studios/cad/user.txt"),"utf8"),"existing studio data");
});
test("Prebuild-validatie accepteert oude studio-output en schrijft nergens", (t) => {
  const f = fixture(t);
  put(f.outDir,"index.html","known good application");
  put(f.outDir,"studios/cad/index.html","known good CAD");
  put(f.outDir,"studios/planner/index.html","known good Planner");
  assert.ok(validateStudioAssets(f));
  assert.equal(readFileSync(join(f.outDir,"index.html"),"utf8"),"known good application");
  assert.equal(readFileSync(join(f.outDir,"studios/cad/index.html"),"utf8"),"known good CAD");
  assert.equal(readFileSync(join(f.outDir,"studios/planner/index.html"),"utf8"),"known good Planner");
  assert.equal(existsSync(join(f.outDir,"studios/planner/studio-scope.js")),false);
  const fresh = join(f.root,"new-output");
  assert.ok(validateStudioAssets({...f,outDir:fresh}));
  assert.equal(existsSync(fresh),false);
});
test("Prebuild-validatie weigert ontbrekende WASM zonder goede output te raken", (t) => {
  const f = fixture(t);
  put(f.outDir,"index.html","known good application");
  put(f.outDir,"studios/cad/index.html","known good CAD");
  put(f.outDir,"studios/planner/index.html","known good Planner");
  rmSync(join(f.cadDist,"OpenCADStudio-test_bg.wasm"));
  assert.throws(() => validateStudioAssets(f),/WASM|asset ontbreekt/);
  assert.equal(readFileSync(join(f.outDir,"index.html"),"utf8"),"known good application");
  assert.equal(readFileSync(join(f.outDir,"studios/cad/index.html"),"utf8"),"known good CAD");
  assert.equal(readFileSync(join(f.outDir,"studios/planner/index.html"),"utf8"),"known good Planner");
  assert.equal(existsSync(join(f.outDir,"studios/studio-assets.json")),false);
});
test("Een gekoppelde outputmap kan geen wijzigingen buiten het doel veroorzaken", (t) => {
  const f = fixture(t);
  const external = join(f.root,"external");
  mkdirSync(external);
  mkdirSync(f.outDir);
  symlinkSync(external,join(f.outDir,"studios"),process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareStudioAssets(f),/symbolische|gekoppelde/);
  assert.equal(existsSync(join(external,"cad")),false);
});
