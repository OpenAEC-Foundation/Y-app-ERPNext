#!/usr/bin/env node
/**
 * Analyse `packages/server/logs/perf.jsonl` en print top-N traagste endpoints.
 *
 * Gebruik:
 *   node scripts/perf-summary.mjs [path-to-perf.jsonl] [topN=20]
 *
 * Output per route: aantal calls, p50, p95, p99, max duration in ms.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg1 = process.argv[2];
const topN = parseInt(process.argv[3] || "20", 10);
const path = arg1 || join("packages", "server", "logs", "perf.jsonl");

if (!existsSync(path)) {
  console.error(`Geen perf-log gevonden op ${path}. Start de server met Y_APP_PERF_LOG=1.`);
  process.exit(1);
}

const lines = readFileSync(path, "utf8").trim().split("\n");
const records = [];
for (const line of lines) {
  try {
    records.push(JSON.parse(line));
  } catch {
    /* skip bad line */
  }
}

// Groepeer per route+method
const byRoute = new Map();
for (const r of records) {
  const key = `${r.method} ${r.route}`;
  if (!byRoute.has(key)) byRoute.set(key, []);
  byRoute.get(key).push(r.durationMs);
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}

const rows = [];
for (const [key, durations] of byRoute) {
  rows.push({
    route: key,
    count: durations.length,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    max: Math.max(...durations),
  });
}

// Sorteer op p95 descending
rows.sort((a, b) => b.p95 - a.p95);

console.log(`\nTop ${topN} traagste endpoints (sorted by p95):\n`);
console.log("route".padEnd(60) + "count".padStart(8) + "p50".padStart(8) + "p95".padStart(8) + "p99".padStart(8) + "max".padStart(8));
console.log("-".repeat(100));
for (const row of rows.slice(0, topN)) {
  console.log(
    row.route.padEnd(60).slice(0, 60)
    + String(row.count).padStart(8)
    + String(row.p50).padStart(8)
    + String(row.p95).padStart(8)
    + String(row.p99).padStart(8)
    + String(row.max).padStart(8),
  );
}
console.log(`\nTotal records: ${records.length}, routes: ${rows.length}\n`);
