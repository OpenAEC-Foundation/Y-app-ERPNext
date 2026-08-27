import type { Plugin, ViteDevServer } from "vite";
import { spawn, type ChildProcess } from "child_process";
import type { IncomingMessage, ServerResponse } from "http";
import { existsSync } from "fs";

/** Collect the full request body as a string */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export default function dashboardPlugin(): Plugin {
  return {
    name: "dashboard-plugin",
    configureServer(server: ViteDevServer) {
      // ── ERPNext dynamic proxy ──
      server.middlewares.use("/erpnext-proxy", async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const parsedUrl = new URL(req.url || "/", "http://localhost");
          const targetBase = parsedUrl.searchParams.get("url");
          const apiPath = parsedUrl.searchParams.get("path");
          const queryStr = parsedUrl.searchParams.get("qs") || "";

          if (!targetBase || !apiPath) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Missing url or path parameter" }));
            return;
          }

          const targetUrl = `${targetBase}${apiPath}${queryStr ? "?" + queryStr : ""}`;

          const headers: Record<string, string> = {
            "Content-Type": req.headers["content-type"] || "application/json",
            Accept: "application/json",
          };
          if (req.headers.authorization) {
            headers["Authorization"] = req.headers.authorization as string;
          }

          const fetchOptions: RequestInit = {
            method: req.method || "GET",
            headers,
          };

          if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
            fetchOptions.body = await readBody(req);
          }

          const upstream = await fetch(targetUrl, fetchOptions);
          const body = await upstream.text();

          res.writeHead(upstream.status, {
            "Content-Type": upstream.headers.get("content-type") || "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(body);
        } catch (e: unknown) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // ── Agent chat endpoint ──
      // POST /api/agent/chat
      // Body: { prompt, sessionId?, baseDir?, instanceContext }
      // Spawns `claude -p <prompt> --output-format stream-json [--resume <id>]`
      // Streams structured JSON events back as SSE
      server.middlewares.use("/api/agent/chat", async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === "OPTIONS") {
          res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          });
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.writeHead(405);
          res.end("Method not allowed");
          return;
        }

        const body = await readBody(req);
        let parsed: {
          prompt: string;
          sessionId?: string;
          baseDir?: string;
          instanceContext: { name: string; url: string };
        };
        try {
          parsed = JSON.parse(body);
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON");
          return;
        }

        const { prompt, sessionId, baseDir, instanceContext } = parsed;

        // Build system context that gets prepended on first message
        const systemPrefix = sessionId
          ? "" // Session already has context
          : [
              `[Context: ERPNext instance "${instanceContext.name}"${instanceContext.url ? `, URL: ${instanceContext.url}` : " (lokale proxy)"}. `,
              `Antwoord in het Nederlands tenzij anders gevraagd.]`,
              `\n\n`,
            ].join("");

        const fullPrompt = `${systemPrefix}${prompt}`;

        // Determine working directory
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

        // Buffer stdout line-by-line (stream-json = one JSON object per line)
        let stdoutBuf = "";
        proc.stdout?.on("data", (chunk: Buffer) => {
          stdoutBuf += chunk.toString();
          const lines = stdoutBuf.split("\n");
          stdoutBuf = lines.pop() || ""; // keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const obj = JSON.parse(trimmed);
              // Forward the structured JSON to the client as-is
              res.write(`data: ${JSON.stringify(obj)}\n\n`);
            } catch {
              // Non-JSON line, forward as raw text
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
          // Flush remaining buffer
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
      });
    },
  };
}
