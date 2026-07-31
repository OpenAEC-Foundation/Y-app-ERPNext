/**
 * Terminal WebSocket handler.
 *
 * Spawns a shell process and bridges stdin/stdout/stderr
 * to a WebSocket connection. The frontend renders output via xterm.js.
 *
 * Each WebSocket connection gets its own shell process.
 * On Windows: PowerShell, on Linux/macOS: bash.
 */

import { spawn, type ChildProcess } from "child_process";
import type { WebSocket } from "ws";
import { ERPNEXT_URL } from "./auth.ts";

interface TerminalSession {
  process: ChildProcess;
}

const sessions = new Map<WebSocket, TerminalSession>();

export function handleTerminalConnection(ws: WebSocket, erpnextSid: string): void {
  console.log(`[terminal] New connection`);

  const isWindows = process.platform === "win32";

  // Choose shell based on OS
  const shell = isWindows ? "powershell.exe" : "bash";
  const shellArgs = isWindows ? ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass"] : ["--login"];

  const shellProcess = spawn(shell, shellArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      FORCE_COLOR: "1",
      TERM: "xterm-256color",
      ERPNEXT_URL: ERPNEXT_URL || "",
    },
    cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
  });

  sessions.set(ws, { process: shellProcess });

  // Send a welcome message with ERPNext context
  if (shellProcess.stdin && ERPNEXT_URL) {
    setTimeout(() => {
      const welcomeCmd = isWindows
        ? `Write-Host "ERPNext: ${ERPNEXT_URL}" -ForegroundColor Cyan\r\n`
        : `echo -e "\\e[36mERPNext: ${ERPNEXT_URL}\\e[0m"\n`;
      shellProcess.stdin?.write(welcomeCmd);
    }, 300);
  }

  // Pipe shell stdout → WebSocket
  shellProcess.stdout?.on("data", (data: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
    }
  });

  // Pipe shell stderr → WebSocket
  shellProcess.stderr?.on("data", (data: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
    }
  });

  // Process exit
  shellProcess.on("exit", (code) => {
    console.log(`[terminal] Shell process exited with code ${code}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "exit", code }));
    }
    sessions.delete(ws);
  });

  shellProcess.on("error", (err) => {
    console.error(`[terminal] Shell process error:`, err);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  // WebSocket messages → shell stdin
  ws.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      if (msg.type === "input" && shellProcess.stdin) {
        shellProcess.stdin.write(msg.data);
      } else if (msg.type === "resize") {
        // Resize not supported without node-pty, but kept for future
      }
    } catch {
      // Raw text input fallback
      if (shellProcess.stdin) {
        shellProcess.stdin.write(rawMsg.toString());
      }
    }
  });

  // Cleanup on WebSocket close
  ws.on("close", () => {
    console.log(`[terminal] Connection closed`);
    const session = sessions.get(ws);
    if (session) {
      session.process.kill();
      sessions.delete(ws);
    }
  });
}
