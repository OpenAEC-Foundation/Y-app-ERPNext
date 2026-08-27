/**
 * Health Check & Auto Tests
 *
 * Simplified single-instance health checks.
 * The detailed multi-instance vault-based checks have been removed.
 * These can be re-implemented later against the new auth model.
 *
 * - GET /api/health          -> full health report
 * - GET /api/health/run      -> force re-run all tests
 * - GET /api/health/mail     -> mail-only results
 * - GET /api/health/messenger -> messenger-only results
 */

import type { Request, Response } from "express";
import { ERPNEXT_URL } from "./auth.ts";

/* --- Types --- */

interface TestResult {
  service: string;
  instance: string;
  status: "ok" | "fail" | "skip";
  message: string;
  durationMs: number;
  timestamp: string;
}

interface HealthReport {
  overall: "ok" | "degraded" | "fail";
  lastRun: string;
  tests: TestResult[];
}

let cachedReport: HealthReport | null = null;
let running = false;

/* --- Test runners --- */

async function testErpNextConnection(): Promise<TestResult> {
  const start = Date.now();
  if (!ERPNEXT_URL) {
    return {
      service: "erpnext",
      instance: "default",
      status: "fail",
      message: "ERPNEXT_URL is not configured",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const resp = await fetch(`${ERPNEXT_URL}/api/method/frappe.ping`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      return {
        service: "erpnext",
        instance: "default",
        status: "ok",
        message: `ERPNext bereikbaar: ${ERPNEXT_URL}`,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      service: "erpnext",
      instance: "default",
      status: "fail",
      message: `ERPNext HTTP ${resp.status}`,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "erpnext",
      instance: "default",
      status: "fail",
      message: (err as Error).message,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

async function testMailEnvVars(): Promise<TestResult> {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  if (host && user) {
    return {
      service: "mail-config",
      instance: "default",
      status: "ok",
      message: `Mail geconfigureerd: ${user}@${host}`,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }
  return {
    service: "mail-config",
    instance: "default",
    status: "skip",
    message: "MAIL_HOST / MAIL_USER niet geconfigureerd in env",
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };
}

async function testNextcloudEnvVars(): Promise<TestResult> {
  const url = process.env.NEXTCLOUD_URL;
  const user = process.env.NEXTCLOUD_USER;
  if (!url || !user) {
    return {
      service: "nextcloud",
      instance: "default",
      status: "skip",
      message: "NEXTCLOUD_URL / NEXTCLOUD_USER niet geconfigureerd in env",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const pass = process.env.NEXTCLOUD_PASS || "";
    const resp = await fetch(
      `${url.replace(/\/+$/, "")}/ocs/v2.php/apps/spreed/api/v4/room?format=json`,
      {
        headers: {
          "OCS-APIRequest": "true",
          Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (resp.ok) {
      return {
        service: "nextcloud",
        instance: "default",
        status: "ok",
        message: `NextCloud bereikbaar: ${url}`,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      service: "nextcloud",
      instance: "default",
      status: "fail",
      message: `NextCloud HTTP ${resp.status}`,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "nextcloud",
      instance: "default",
      status: "fail",
      message: (err as Error).message,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

async function testTelegramEnvVars(): Promise<TestResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return {
      service: "messenger-telegram",
      instance: "default",
      status: "skip",
      message: "TELEGRAM_BOT_TOKEN niet geconfigureerd in env",
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  const start = Date.now();
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      return {
        service: "messenger-telegram",
        instance: "default",
        status: "ok",
        message: `Telegram bot: @${data.result?.username}`,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      service: "messenger-telegram",
      instance: "default",
      status: "fail",
      message: `Telegram HTTP ${resp.status}`,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      service: "messenger-telegram",
      instance: "default",
      status: "fail",
      message: (err as Error).message,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

/* --- Run all tests --- */

export async function runAllTests(): Promise<HealthReport> {
  if (running) return cachedReport || { overall: "ok", lastRun: "", tests: [] };
  running = true;

  console.log("[health] Running tests...");

  const results = await Promise.all([
    testErpNextConnection(),
    testMailEnvVars(),
    testNextcloudEnvVars(),
    testTelegramEnvVars(),
  ]);

  const failCount = results.filter(t => t.status === "fail").length;
  const okCount = results.filter(t => t.status === "ok").length;

  const report: HealthReport = {
    overall: failCount === 0 ? "ok" : okCount > 0 ? "degraded" : "fail",
    lastRun: new Date().toISOString(),
    tests: results,
  };

  console.log(`[health] Done: ${okCount} ok, ${failCount} fail, ${results.length - okCount - failCount} skip`);
  cachedReport = report;
  running = false;
  return report;
}

/* --- Express handlers --- */

export function healthGetReport(_req: Request, res: Response) {
  if (!cachedReport) {
    return res.json({ overall: "pending", lastRun: null, tests: [], message: "Tests nog niet uitgevoerd. Gebruik /api/health/run" });
  }
  res.json(cachedReport);
}

export async function healthRunTests(_req: Request, res: Response) {
  try {
    const report = await runAllTests();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export function healthGetMail(_req: Request, res: Response) {
  if (!cachedReport) return res.json({ tests: [] });
  res.json({ tests: cachedReport.tests.filter(t => t.service.startsWith("mail")) });
}

export function healthGetMessenger(_req: Request, res: Response) {
  if (!cachedReport) return res.json({ tests: [] });
  res.json({ tests: cachedReport.tests.filter(t => t.service.startsWith("messenger")) });
}
