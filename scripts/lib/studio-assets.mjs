import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const PLANNER_BASE = "/assets/y_next/app/studios/planner/";
const NOTICE = /^(?:licen[sc]e|notice|copying|ofl|third[-_]party[-_]notices|.*[-_](?:licen[sc]e|ofl|notice))(?:[.-].*)?$/i;
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";

// Alleen de gegenereerde CAD-entry krijgt een lokale fetch-adapter; er komt geen studio-code in
// de React-importgraaf. De adapter loopt vóór WASM-init en stuurt nooit documenten naar een API.
const CAD_BOOTSTRAP = `<script data-ynext-studio-bootstrap>
(() => {
  const originalFetch = window.fetch.bind(window);
  const local = new URL('./', document.baseURI);
  window.fetch = async (input, options = {}) => {
    const request = typeof input === 'string' || input instanceof URL ? null : input;
    let url = new URL(request ? request.url : String(input), document.baseURI);
    const method = String(options.method || (request && request.method) || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') throw new TypeError('Alleen lezen van lokale studio-assets is toegestaan');
    if (url.origin !== local.origin) throw new TypeError('Alleen lokale studio-assets zijn toegestaan');
    if (url.pathname === '/supporters.json' || url.pathname === local.pathname + 'supporters.json') {
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }
    const name = url.pathname.split('/').pop();
    const font = /^z-cad-font-([a-z0-9_-]+)\\.ttf$/i.exec(name);
    if (font) url = new URL('./fonts/' + font[1] + '.ttf', local);
    if (!url.pathname.startsWith(local.pathname)) throw new TypeError('Alleen lokale studio-assets zijn toegestaan');
    const forwarded = request ? new Request(url.href, request) : url.href;
    return originalFetch(forwarded, { ...options, credentials: 'omit' });
  };
})();
</script>`;

// Voorkomt onbedoeld herstel van een ander account op dezelfde browserorigin. Dit is géén
// beveiligingsgrens tegen andere same-origin scripts. Ruwe oude recovery wordt nooit geïmporteerd.
const PLANNER_SCOPE = `(() => {
  const supplied = new URLSearchParams(location.search).get('scope');
  const scope = /^[0-9a-f]{64}$/.test(supplied || '') ? supplied : 'ephemeral-' + crypto.randomUUID();
  const prefix = 'ynext-planner-' + scope + '-';
  const legacy = 'open-planner-studio-recent-files';
  const map = (key) => {
    const text = String(key);
    return text.startsWith('ops-') || text === legacy ? prefix + text : text;
  };
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function(key) { return originalGet.call(this, map(key)); };
  Storage.prototype.setItem = function(key, value) { return originalSet.call(this, map(key), value); };
  Storage.prototype.removeItem = function(key) { return originalRemove.call(this, map(key)); };
  const originalOpen = indexedDB.open.bind(indexedDB);
  const originalDelete = indexedDB.deleteDatabase.bind(indexedDB);
  indexedDB.open = (name, ...args) => originalOpen(map(name), ...args);
  indexedDB.deleteDatabase = (name) => originalDelete(map(name));
})();\n`;

function assertNoLinks(path) {
  let current = resolve(path);
  for (;;) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error("Gekoppelde of symbolische map niet toegestaan: " + current);
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function filesIn(root) {
  assertNoLinks(root);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) throw new Error("Studiobundel ontbreekt: " + root);
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Symbolische bronasset niet toegestaan: " + path);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
      else throw new Error("Ongeldige bronasset: " + path);
    }
  }
  visit(root);
  return files.sort();
}

function assertFile(root, file, label = "asset ontbreekt") {
  const target = resolve(root, file);
  const rel = relative(root, target);
  if (rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) throw new Error("Assetpad buiten studiobundel: " + file);
  if (!existsSync(target) || !lstatSync(target).isFile()) throw new Error(label + ": " + file);
  return rel.split(sep).join('/');
}

function validateReference(root, owner, reference, kind) {
  if (!reference || /^(?:data:|blob:|#)/i.test(reference)) return;
  if (/^(?:[a-z]+:|\/\/)/i.test(reference)) throw new Error("Externe asset niet toegestaan: " + reference);
  const path = reference.split(/[?#]/)[0];
  if (!path) return;
  let asset;
  if (path.startsWith('/')) {
    if (kind !== 'planner' || !path.startsWith(PLANNER_BASE)) throw new Error("Verkeerde studio-buildbase: " + reference);
    asset = path.slice(PLANNER_BASE.length);
  } else asset = join(dirname(owner), decodeURIComponent(path));
  assertFile(root, asset);
}

function validateReferences(root, files, index, kind) {
  for (const file of files) {
    if (!/\.(?:html|js|css)$/.test(file)) continue;
    const text = file === 'index.html' ? index : readFileSync(join(root, file), 'utf8');
    const refs = [];
    if (file.endsWith('.html')) {
      for (const match of text.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) refs.push(match[2]);
      for (const match of text.matchAll(/(["'])([^"'\r\n]+\.(?:wasm|js))\1/g)) refs.push(match[2]);
    }
    if (file.endsWith('.js')) {
      for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])([A-Za-z0-9_./:%~+@?#=-]+)\1/g)) refs.push(match[2]);
      for (const match of text.matchAll(/new URL\(\s*(["'])([^"']+)\1\s*,\s*import\.meta\.url/g)) refs.push(match[2]);
      for (const match of text.matchAll(/(["'])((?:\.\.?\/|\/)[^"'\r\n]+\.(?:wasm|ttf|woff2?))\1/g)) refs.push(match[2]);
    }
    if (file.endsWith('.css')) for (const match of text.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/g)) refs.push(match[2]);
    for (const ref of refs) {
      // wasm-bindgen houdt een ongehashte default in zijn JS; Trunk geeft in index.html expliciet
      // de gecontroleerde gehashte WASM-URL door. Die ongebruikte default is geen ontbrekende asset.
      if (kind === 'cad' && file.endsWith('.js') && ref === 'OpenCADStudio_bg.wasm'
        && /module_or_path\s*:\s*["']\.\/OpenCADStudio[^"']+\.wasm["']/.test(index)) continue;
      validateReference(root, file, ref, kind);
    }
  }
}

function validatePlannerManifest(root, index) {
  assertFile(root, '.vite/manifest.json', 'Platformmanifest ontbreekt');
  let manifest;
  try { manifest = JSON.parse(readFileSync(join(root, '.vite/manifest.json'), 'utf8')); }
  catch { throw new Error("Ongeldig platformmanifest"); }
  if (!manifest || typeof manifest !== 'object' || !manifest['index.html']?.isEntry) throw new Error("Platformmanifest mist index.html-entry");
  for (const item of Object.values(manifest)) {
    if (!item || typeof item.file !== 'string') throw new Error("Ongeldige manifestasset");
    assertFile(root, item.file);
    for (const asset of [...(item.css || []), ...(item.assets || [])]) assertFile(root, asset);
    for (const key of [...(item.imports || []), ...(item.dynamicImports || [])]) {
      if (!Object.hasOwn(manifest, key)) throw new Error("Manifestimport ontbreekt: " + key);
    }
  }
  if (!index.includes(PLANNER_BASE + manifest['index.html'].file)) throw new Error("Planner-entry heeft een verkeerde buildbase");
}

function insertHead(index, content) {
  if (!/<head(?:\s[^>]*)?>/i.test(index)) throw new Error("Studio-entry mist head-element");
  return index.replace(/<head(?:\s[^>]*)?>/i, (head) => head + '\n' + content + '\n');
}

function noticesFor(root, files) {
  const notices = files.filter((file) => NOTICE.test(basename(file))).map((file) => ({ from:join(root,file), to:file }));
  for (const name of ['LICENSE', 'LICENSE.GPL', 'NOTICE', 'THIRD-PARTY-NOTICES.md']) {
    const path = join(dirname(root), name);
    if (existsSync(path) && lstatSync(path).isFile()) notices.push({ from:path, to:'notices/' + name });
  }
  // Vite kopieert de ?url-font/WASM-assets, niet hun bronlicenties; die moeten expliciet mee.
  for (const directory of ['src/services/pdf/fonts', 'src/services/pdf/vendor', 'node_modules/@fontsource/inter', 'node_modules/@fontsource/jetbrains-mono', 'node_modules/@fontsource/space-grotesk']) {
    const source = join(dirname(root), directory);
    if (!existsSync(source)) continue;
    assertNoLinks(source);
    for (const name of readdirSync(source).filter((name) => NOTICE.test(name))) {
      const from = join(source,name);
      assertNoLinks(from);
      if (lstatSync(from).isFile()) notices.push({ from, to:'notices/' + directory + '/' + name });
    }
  }
  return notices;
}

function rewriteNorwegianHelp(target, files) {
  const equivalents = {
    vindusrammer:'rammer til vinduer',
    vindusrammene:'rammene til vinduene',
    vinduskarmene:'karmene til vinduene',
  };
  const changed = [];
  for (const file of files.filter((file) => /^docs\/nb\/[^/]+\.md$/.test(file))) {
    const path = join(target,file);
    const original = readFileSync(path,'utf8');
    const rewritten = original.replace(/\b(vindusrammer|vindusrammene|vinduskarmene)\b/gi, (term) => {
      const equivalent = equivalents[term.toLowerCase()];
      if (term === term.toUpperCase()) return equivalent.toUpperCase();
      if (term[0] === term[0].toUpperCase()) return equivalent[0].toUpperCase() + equivalent.slice(1);
      return equivalent;
    });
    if (rewritten !== original) {
      writeFileSync(path,rewritten);
      changed.push(file);
    }
  }
  return changed;
}

function inspectStudioAssets({ cadDist, plannerDist, outDir, cadSourceArchive, plannerSourceArchive }, rejectExistingTargets) {
  if (!cadDist || !plannerDist || !outDir) throw new Error("cadDist, plannerDist en outDir zijn verplicht");
  const output = resolve(outDir);
  const studios = join(output, 'studios');
  assertNoLinks(studios);
  const prepared = [];
  for (const [kind, source, archive] of [['cad',cadDist,cadSourceArchive], ['planner',plannerDist,plannerSourceArchive]]) {
    const root = resolve(source);
    const target = join(studios, kind);
    if (rejectExistingTargets && existsSync(target)) throw new Error("Studiodoel bestaat al; gebruik een nieuwe outputmap: " + target);
    if (root === output || relative(root, output).split(sep)[0] !== '..') throw new Error("Output ligt binnen studiobron");
    const files = filesIn(root);
    assertFile(root, 'index.html', 'Studio-entry ontbreekt');
    let index = readFileSync(join(root, 'index.html'), 'utf8');
    if (kind === 'cad') {
      assertFile(root, 'domera-bridge.js');
      if (!files.some((file) => /\.wasm$/i.test(file))) throw new Error("CAD-WASM ontbreekt");
      if (!files.some((file) => /^fonts\/.*\.ttf$/i.test(file))) throw new Error("CAD-fonts ontbreken");
      if (!files.some((file) => /^fonts\//.test(file) && NOTICE.test(basename(file)))) throw new Error("CAD-fontlicentie ontbreekt");
      index = index.replace(/(["'])\/(OpenCADStudio[^"']+|logo[^"']+)\1/g, (_,quote,name) => quote + './' + name + quote);
    } else validatePlannerManifest(root, index);
    validateReferences(root, files, index, kind);
    if (archive) {
      assertNoLinks(archive);
      if (!existsSync(archive) || !lstatSync(archive).isFile()) throw new Error("Bronarchief ontbreekt: " + archive);
    }
    index = insertHead(index, '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">' + (kind === 'cad' ? '\n' + CAD_BOOTSTRAP : '\n<script src="./studio-scope.js"></script>'));
    prepared.push({ kind, root, target, files, index, archive, notices:noticesFor(root, files) });
  }
  return { studios, prepared };
}

/** Schrijfvrije prebuild-poort: alle broncontroles, ook als er nog een goede vorige build staat. */
export function validateStudioAssets(options) {
  return inspectStudioAssets(options, false);
}

/** Kopieert reeds lokaal gebouwde studio's; nooit downloaden, bouwen, wissen of bestaande doelen vervangen. */
export function prepareStudioAssets(options) {
  const { studios, prepared } = inspectStudioAssets(options, true);
  const metadata = { schemaVersion:1, studios:{} };
  // Beide bundels zijn hierboven gecontroleerd voordat er ook maar één outputbestand ontstaat.
  mkdirSync(studios, { recursive:true });
  for (const p of prepared) {
    cpSync(p.root, p.target, { recursive:true, force:false, errorOnExist:true });
    writeFileSync(join(p.target, 'index.html'), p.index);
    if (p.kind === 'cad') writeFileSync(join(p.target, 'supporters.json'), '[]\n');
    if (p.kind === 'planner') writeFileSync(join(p.target, 'studio-scope.js'), PLANNER_SCOPE);
    const localizedDocRewrites = p.kind === 'planner' ? rewriteNorwegianHelp(p.target,p.files) : [];
    const ownNotice = 'Y-NEXT-PACKAGING-NOTICE.txt';
    writeFileSync(join(p.target,ownNotice),
      "Y-next local studio packaging\n" +
      "Runtime wrappers enforce local asset fetching and account-scoped browser storage.\n" +
      (p.kind === 'planner' ? "Only docs/nb/*.md uses semantically equivalent Norwegian window terminology, preserving capitalization. Other locales and original source archives remain unchanged.\n" : "CAD entry paths are relative; font requests resolve to bundled fonts and the supporter list is local.\n"));
    for (const notice of p.notices) {
      const target = join(p.target, notice.to);
      if (notice.from !== join(p.root, notice.to)) {
        mkdirSync(dirname(target), { recursive:true });
        cpSync(notice.from, target, { force:false, errorOnExist:true });
      }
    }
    const sourceArchive = p.archive ? 'source/' + basename(p.archive) : null;
    if (sourceArchive) {
      mkdirSync(join(p.target,'source'), { recursive:true });
      cpSync(p.archive, join(p.target,sourceArchive), { force:false, errorOnExist:true });
    }
    metadata.studios[p.kind] = { entry:'index.html', wasm:p.files.filter((file) => file.endsWith('.wasm')), notices:[...p.notices.map((n) => n.to),ownNotice].sort(), sourceArchive, localizedDocRewrites };
  }
  const metadataPath = join(studios,'studio-assets.json');
  writeFileSync(metadataPath, JSON.stringify(metadata,null,2) + '\n');
  return { cadDir:join(studios,'cad'), plannerDir:join(studios,'planner'), metadataPath };
}
