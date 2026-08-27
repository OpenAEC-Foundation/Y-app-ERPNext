/**
 * Agent chat handler: spawns Claude CLI and streams responses as SSE.
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import type { Request, Response } from "express";

interface AgentRequest {
  prompt: string;
  sessionId?: string;
  baseDir?: string;
  instanceContext: { name: string; url: string };
}

export function handleAgentChat(req: Request, res: Response): void {
  const parsed = req.body as AgentRequest;
  const { prompt, sessionId, baseDir, instanceContext } = parsed;

  if (!prompt) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  // Build system context for first message in session
  const systemPrefix = sessionId
    ? ""
    : [
        `[Context: ERPNext instance "${instanceContext?.name || "Unknown"}"`,
        instanceContext?.url ? `, URL: ${instanceContext.url}` : " (lokale proxy)",
        `. Antwoord in het Nederlands tenzij anders gevraagd.]\n\n`,
      ].join("");

  const fullPrompt = `${systemPrefix}${prompt}`;
  const cwd = baseDir && existsSync(baseDir) ? baseDir : process.cwd();

  // Build claude args
  const args: string[] = ["-p", fullPrompt, "--output-format", "stream-json"];
  if (sessionId) {
    args.push("--resume", sessionId);
  }

  // SSE response
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  let proc: ChildProcess;
  try {
    proc = spawn("claude", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
  } catch {
    res.write(`data: ${JSON.stringify({ type: "error", content: "Claude CLI niet beschikbaar." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  let stdoutBuf = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ type: "raw", content: trimmed })}\n\n`);
      }
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text && (text.includes("Error") || text.includes("error"))) {
      res.write(`data: ${JSON.stringify({ type: "error", content: text })}\n\n`);
    }
  });

  proc.on("close", (code) => {
    if (stdoutBuf.trim()) {
      try {
        const obj = JSON.parse(stdoutBuf.trim());
        res.write(`data: ${JSON.stringify(obj)}\n\n`);
      } catch { /* ignore */ }
    }
    res.write(`data: ${JSON.stringify({ type: "close", code })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });

  proc.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  });

  req.on("close", () => {
    proc.kill();
  });
}
