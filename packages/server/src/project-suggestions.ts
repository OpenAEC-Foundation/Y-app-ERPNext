/**
 * Project template suggestions — server-side smart matching.
 *
 * GET /api/project-template-suggest?customer=CUST-001
 *
 * Fetches the customer's market_segment from ERPNext, looks up the employer's
 * template mapping stored in instance_settings (key: project-template-mapping),
 * and returns which Project Template to suggest.
 *
 * Requires Y-app session with a valid instance (X-Y-App-Instance header).
 */

import type { Request, Response } from "express";
import { db } from "./db.ts";
import { getInstanceForUser } from "./instances.ts";
import { getOrCreateInstanceSession } from "./instance-proxy.ts";

interface TemplateMapping {
  [customerName: string]: string; // customer (ERPNext name) → project_template name
}

interface ErpListResult<T> {
  data: T[];
}

interface ErpDocResult<T> {
  data: T;
}

async function erpGet<T>(instanceUrl: string, sid: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${instanceUrl}${path}`, {
      headers: { Cookie: sid, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function handleProjectTemplateSuggest(req: Request, res: Response): Promise<void> {
  const user = (req as any).yAppUser as { id: number; email: string };
  const userKey = (req as any).yAppUserKey as Buffer;
  const customer = req.query.customer as string | undefined;

  if (!customer) {
    res.status(400).json({ error: "Missing customer parameter" });
    return;
  }

  // Resolve instance
  const instanceHeader = req.headers["x-y-app-instance"];
  const instanceId = instanceHeader
    ? parseInt(Array.isArray(instanceHeader) ? instanceHeader[0] : String(instanceHeader), 10)
    : NaN;

  if (Number.isNaN(instanceId)) {
    res.status(400).json({ error: "Missing or invalid X-Y-App-Instance header" });
    return;
  }

  const instance = getInstanceForUser(instanceId, user.id);
  if (!instance) {
    res.status(404).json({ error: "Instance not found" });
    return;
  }

  const session = await getOrCreateInstanceSession(user.id, instance, userKey);
  if (!session) {
    res.status(502).json({ error: "Failed to authenticate to ERPNext" });
    return;
  }

  const baseUrl = instance.url.replace(/\/+$/, "");
  const sid = `sid=${session.sid}`;

  // Fetch all available Project Templates
  const templateList = await erpGet<Array<{ name: string }>>(
    baseUrl,
    sid,
    `/api/resource/Project%20Template?fields=["name"]&limit_page_length=100`
  );
  const allTemplates: string[] = Array.isArray(templateList) ? templateList.map((t) => t.name) : [];

  // Look up template mapping from instance_settings (customer name → template name)
  let mapping: TemplateMapping = {};
  try {
    const row = db
      .prepare(
        "SELECT setting_value FROM instance_settings WHERE instance_id = ? AND setting_key = ?"
      )
      .get(instanceId, "project-template-mapping") as { setting_value: string } | undefined;
    if (row) {
      mapping = JSON.parse(row.setting_value);
    }
  } catch {
    // No mapping configured — return all templates without suggestion
  }

  // Direct match on customer name
  const suggested: Array<{ name: string; reason: string }> = [];
  const mappedTemplate = mapping[customer];
  if (mappedTemplate && allTemplates.includes(mappedTemplate)) {
    suggested.push({ name: mappedTemplate, reason: `Klant: ${customer}` });
  }

  res.json({ suggested, all: allTemplates });
}
