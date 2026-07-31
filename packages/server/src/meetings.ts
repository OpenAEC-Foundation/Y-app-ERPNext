/**
 * Meeting Notes — local JSON storage backend.
 *
 * Stores meeting notes in ~/.erpnext-level/meetings.json (Y-app config dir)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Request, Response } from "express";

/* ─── Types ─── */

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  deadline: string;
  status: "open" | "done";
}

export interface Participant {
  name: string;
  email: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;          // ISO datetime
  linkedType: "" | "Project" | "Quotation" | "Lead";
  linkedName: string;    // ERPNext docname
  linkedLabel: string;   // Human-readable label
  participants: Participant[];
  agenda: string;        // rich text / markdown
  report: string;        // rich text / markdown (verslag)
  actionItems: ActionItem[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Storage ─── */

function getStoreDir(): string {
  const dir = process.env.ERPNEXT_LEVEL_CONFIG_DIR || join(homedir(), ".erpnext-level");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getStorePath(): string {
  return join(getStoreDir(), "meetings.json");
}

function readMeetings(): Meeting[] {
  const p = getStorePath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

function writeMeetings(meetings: Meeting[]): void {
  writeFileSync(getStorePath(), JSON.stringify(meetings, null, 2), "utf-8");
}

/* ─── Handlers ─── */

export function meetingsGet(_req: Request, res: Response) {
  try {
    const meetings = readMeetings();
    res.json({ data: meetings });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export function meetingsCreate(req: Request, res: Response) {
  try {
    const meeting = req.body as Meeting;
    if (!meeting.id || !meeting.title) {
      return res.status(400).json({ error: "id and title are required" });
    }
    const now = new Date().toISOString();
    meeting.createdAt = now;
    meeting.updatedAt = now;

    const meetings = readMeetings();
    meetings.push(meeting);
    writeMeetings(meetings);
    res.json({ ok: true, data: meeting });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export function meetingsUpdate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const updates = req.body as Partial<Meeting>;
    const meetings = readMeetings();
    const idx = meetings.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: "Meeting not found" });

    meetings[idx] = { ...meetings[idx], ...updates, id, updatedAt: new Date().toISOString() };
    writeMeetings(meetings);
    res.json({ ok: true, data: meetings[idx] });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export function meetingsDelete(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const meetings = readMeetings();
    const filtered = meetings.filter((m) => m.id !== id);
    if (filtered.length === meetings.length) {
      return res.status(404).json({ error: "Meeting not found" });
    }
    writeMeetings(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
