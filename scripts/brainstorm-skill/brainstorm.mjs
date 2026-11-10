#!/usr/bin/env node
/**
 * Brainstorm vanuit een AI-sessie: ideeën uit de Y-next-brainstorm ophalen en
 * bijwerken. Praat rechtstreeks met de ERPNext via een API-sleutel; de
 * Y-next-pagina is hiervoor niet nodig.
 *
 *   node brainstorm.mjs instellen <erpnext-url> <api-key> <api-secret>
 *   node brainstorm.mjs lijst [--alles] [--label <label>]
 *   node brainstorm.mjs toon <nr>
 *   node brainstorm.mjs start <nr>                 status op Bezig
 *   node brainstorm.mjs vink <nr> <punt> [...]     punten afvinken (nummers uit `toon`)
 *   node brainstorm.mjs ontvink <nr> <punt> [...]
 *   node brainstorm.mjs punt <nr> "<tekst>"        punt toevoegen
 *   node brainstorm.mjs resultaat <nr> "<tekst>"
 *   node brainstorm.mjs bijlage <nr> <bestand> [...]
 *   node brainstorm.mjs klaar <nr>                 alleen na akkoord van de gebruiker
 *   node brainstorm.mjs nieuw "<titel>" ["<beschrijving>"]
 *
 * De doctypes heten zoals in packages/frontend/src/lib/brainstorm-model.ts in Y-app-ERPNext.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const DT_IDEE = "Y Brainstorm Idee";
const DT_PUNT = "Y Brainstorm Punt";
const CONFIG = join(homedir(), ".brainstorm.json");

function config() {
  const env = { url: process.env.BRAINSTORM_URL, key: process.env.BRAINSTORM_KEY, secret: process.env.BRAINSTORM_SECRET };
  if (env.url && env.key && env.secret) return env;
  if (existsSync(CONFIG)) return JSON.parse(readFileSync(CONFIG, "utf8"));
  fail(`Nog niet ingesteld. Draai: node brainstorm.mjs instellen <erpnext-url> <api-key> <api-secret>\n(of zet BRAINSTORM_URL, BRAINSTORM_KEY en BRAINSTORM_SECRET)`);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function api(path, init = {}) {
  const c = config();
  const res = await fetch(c.url.replace(/\/$/, "") + path, {
    ...init,
    headers: { Authorization: `token ${c.key}:${c.secret}`, Accept: "application/json", ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { const j = JSON.parse(text); detail = j.exception || j._server_messages || j.message || text; } catch { /* tekst houden */ }
    if (res.status === 404 && path.includes(encodeURIComponent(DT_IDEE))) fail(`Niet gevonden (404). Bestaat het idee, en is de brainstorm op deze site ingericht?\n${detail}`);
    fail(`ERPNext antwoordde ${res.status}: ${String(detail).slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

const res = (dt) => `/api/resource/${encodeURIComponent(dt)}`;
const qs = (o) => "?" + new URLSearchParams(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])));

function labelsVan(raw) {
  if (!raw) return [];
  try { const v = JSON.parse(raw); if (Array.isArray(v)) return v; } catch { /* komma's */ }
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
}

function nr(arg) {
  const n = String(arg || "").replace(/^#/, "");
  if (!/^\d+$/.test(n)) fail(`Geef het nummer van het idee, bijvoorbeeld 12 of #12 (kreeg: ${arg ?? "niets"}).`);
  return n;
}

async function getIdee(n) {
  return (await api(`${res(DT_IDEE)}/${n}`)).data;
}

async function putIdee(n, data) {
  return (await api(`${res(DT_IDEE)}/${n}`, { method: "PUT", body: JSON.stringify(data) })).data;
}

async function lijst(args) {
  const alles = args.includes("--alles");
  const li = args.indexOf("--label");
  const label = li >= 0 ? args[li + 1] : null;
  const [ideeen, punten] = await Promise.all([
    api(res(DT_IDEE) + qs({ fields: ["name", "titel", "status", "volgorde", "datum", "deadline", "labels", "koppeling", "modified"], limit_page_length: "0", order_by: "volgorde asc" })),
    api(res(DT_PUNT) + qs({ parent: DT_IDEE, fields: ["parent", "gedaan"], limit_page_length: "0" })),
  ]);
  const tel = {};
  for (const p of punten.data) { const t = (tel[p.parent] ||= [0, 0]); t[0]++; if (p.gedaan) t[1]++; }
  let rows = ideeen.data.filter((i) => alles || i.status !== "Klaar");
  if (label) rows = rows.filter((i) => labelsVan(i.labels).includes(label));
  const open = rows.filter((i) => i.status !== "Klaar");
  const klaar = rows.filter((i) => i.status === "Klaar").sort((a, b) => b.modified.localeCompare(a.modified));
  const all = [...open, ...klaar];
  if (!all.length) { console.log("Geen ideeën gevonden."); return; }
  all.forEach((i, k) => {
    const t = tel[i.name];
    const parts = [`#${i.name} ${i.titel}`, i.status];
    if (t) parts.push(`${t[1]}/${t[0]} punten`);
    if (i.deadline) parts.push(`deadline ${i.deadline}`);
    const l = labelsVan(i.labels);
    if (l.length) parts.push(l.join(", "));
    console.log(`${i.status === "Klaar" ? "-" : `${k + 1}.`} ${parts.join(" · ")}`);
  });
}

async function toon(n) {
  const i = await getIdee(n);
  const files = await api(res("File") + qs({ filters: [["attached_to_doctype", "=", DT_IDEE], ["attached_to_name", "=", n]], fields: ["file_name", "file_url"], limit_page_length: "0" }));
  const out = {
    code: `#${i.name}`,
    titel: i.titel,
    status: i.status,
    labels: labelsVan(i.labels),
    project_of_repo: i.koppeling || null,
    datum: i.datum || null,
    deadline: i.deadline || null,
    beschrijving: i.beschrijving || "",
    checklist: (i.punten || []).map((p, k) => ({ nr: k + 1, tekst: p.tekst, gedaan: !!p.gedaan })),
    resultaat: i.resultaat || null,
    bijlagen: files.data.map((f) => ({ naam: f.file_name, url: config().url.replace(/\/$/, "") + f.file_url })),
    ingezet_door: i.owner,
  };
  console.log(JSON.stringify(out, null, 2));
}

async function vink(n, nums, gedaan) {
  const i = await getIdee(n);
  const punten = i.punten || [];
  for (const s of nums) {
    const k = Number(s) - 1;
    if (!punten[k]) fail(`Punt ${s} bestaat niet; dit idee heeft ${punten.length} punten.`);
    punten[k].gedaan = gedaan ? 1 : 0;
  }
  await putIdee(n, { punten: punten.map((p) => ({ name: p.name, tekst: p.tekst, gedaan: p.gedaan })) });
  console.log(`#${n}: ${punten.filter((p) => p.gedaan).length} van ${punten.length} punten afgevinkt.`);
}

async function bijlage(n, paden) {
  for (const p of paden) {
    if (!existsSync(p)) fail(`Bestand niet gevonden: ${p}`);
    const form = new FormData();
    form.append("file", new Blob([readFileSync(p)]), basename(p));
    form.append("doctype", DT_IDEE);
    form.append("docname", n);
    form.append("is_private", "1");
    await api("/api/method/upload_file", { method: "POST", body: form });
    console.log(`#${n}: ${basename(p)} toegevoegd.`);
  }
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case "instellen": {
    const [url, key, secret] = args;
    if (!url || !key || !secret) fail("Gebruik: node brainstorm.mjs instellen <erpnext-url> <api-key> <api-secret>");
    writeFileSync(CONFIG, JSON.stringify({ url, key, secret }, null, 2), { mode: 0o600 });
    console.log(`Opgeslagen in ${CONFIG}.`);
    break;
  }
  case "lijst": await lijst(args); break;
  case "toon": await toon(nr(args[0])); break;
  case "start": await putIdee(nr(args[0]), { status: "Bezig" }); console.log(`#${nr(args[0])} staat op Bezig.`); break;
  case "klaar": await putIdee(nr(args[0]), { status: "Klaar" }); console.log(`#${nr(args[0])} staat op Klaar.`); break;
  case "vink": await vink(nr(args[0]), args.slice(1), true); break;
  case "ontvink": await vink(nr(args[0]), args.slice(1), false); break;
  case "punt": {
    const n = nr(args[0]);
    if (!args[1]) fail("Geef de tekst van het punt.");
    const i = await getIdee(n);
    const punten = (i.punten || []).map((p) => ({ name: p.name, tekst: p.tekst, gedaan: p.gedaan }));
    await putIdee(n, { punten: [...punten, { tekst: args[1], gedaan: 0 }] });
    console.log(`#${n}: punt ${punten.length + 1} toegevoegd.`);
    break;
  }
  case "resultaat": {
    const n = nr(args[0]);
    await putIdee(n, { resultaat: args.slice(1).join(" ") });
    console.log(`#${n}: resultaat opgeslagen.`);
    break;
  }
  case "bijlage": await bijlage(nr(args[0]), args.slice(1)); break;
  case "nieuw": {
    if (!args[0]) fail("Geef een titel.");
    const lijstje = await api(res(DT_IDEE) + qs({ fields: ["volgorde", "status"], limit_page_length: "0" }));
    const open = lijstje.data.filter((i) => i.status !== "Klaar").map((i) => i.volgorde || 0);
    const doc = (await api(res(DT_IDEE), { method: "POST", body: JSON.stringify({ titel: args[0], beschrijving: args[1] || "", status: "Open", volgorde: open.length ? Math.max(...open) + 1 : 1 }) })).data;
    console.log(`Nieuw idee #${doc.name}: ${doc.titel}`);
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 20).join("\n").replace(/^ ?\*\/?/gm, ""));
}
