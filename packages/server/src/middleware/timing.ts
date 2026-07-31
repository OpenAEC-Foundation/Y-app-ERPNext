/**
 * Server-side performance timings.
 *
 * Logs per-request duration to `logs/perf.jsonl` (append-only NDJSON) zodat
 * we top-N traagste endpoints kunnen analyseren met `scripts/perf-summary.mjs`.
 *
 * Privacy: GEEN `req.url`, `req.query` of `req.headers` worden gelogd — dat
 * zou folder-namen, UID's of session-cookies naar disk schrijven (AVG-issue).
 * Alleen `matchedRoute` (bv. `/api/mail/messages`), `method`, `statusCode` en
 * `durationMs` worden gelogd.
 *
 * Activatie via env var: `Y_APP_PERF_LOG=1 npm run dev` (opt-in).
 */
import type { Request, Response, NextFunction } from "express";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cwd } from "node:process";

const PERF_LOG_ENABLED = process.env.Y_APP_PERF_LOG === "1";
const PERF_LOG_PATH = process.env.Y_APP_PERF_LOG_PATH
  || join(cwd(), "logs", "perf.jsonl");

let logDirEnsured = false;
async function ensureLogDir(): Promise<void> {
  if (logDirEnsured) return;
  try {
    await mkdir(dirname(PERF_LOG_PATH), { recursive: true });
    logDirEnsured = true;
  } catch {
    /* mkdir-race or permission — append zal alsnog falen, ignore */
  }
}

interface PerfRecord {
  ts: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
}

async function writeRecord(rec: PerfRecord): Promise<void> {
  try {
    await ensureLogDir();
    await appendFile(PERF_LOG_PATH, JSON.stringify(rec) + "\n", "utf8");
  } catch {
    /* disk full / permission — silently skip */
  }
}

export function perfTimingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!PERF_LOG_ENABLED) return next();
  const start = process.hrtime.bigint();
  res.once("finish", () => {
    const durMs = Number((process.hrtime.bigint() - start) / 1000000n);
    // Express vult req.route pas in als een matched route is gevonden; voor
    // 404's gebruiken we het pad-template als beste-benadering.
    const route = (req as any).route?.path
      || (req.baseUrl + (req.path === "/" ? "" : req.path))
      || "<unknown>";
    void writeRecord({
      ts: new Date().toISOString(),
      route: String(route).slice(0, 120),
      method: req.method,
      status: res.statusCode,
      durationMs: durMs,
    });
  });
  next();
}
