import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Sparkles, Send, Loader2, Trash2, ChevronDown,
  Maximize2, Minimize2, Undo2, Zap, HelpCircle,
  Terminal as TerminalIcon, RefreshCw,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { getActiveInstance, getActiveInstanceId } from "../lib/instances";
import { useEmployees, useProjects, useCompanies } from "../lib/DataContext";
import {
  matchIntents, buildUnmatchedIssueUrl, INTENTS,
  type MatchResult, type IntentContext, type Intent,
} from "../lib/intents";
import { deleteDocument } from "../lib/erpnext";
import { useTranslation } from "react-i18next";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

/* ─── Types ─── */

interface LogEntry {
  id: number;
  kind: "user" | "result" | "error";
  content: string;
  undoInfo?: { doctype: string; name: string }; // for undo (delete created doc)
}

let logCounter = 0;

/* ─── Main Panel ─── */

export default function AgentPanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [tall, setTall] = useState(false);
  const [activeTab, setActiveTab] = useState<"agent" | "terminal">("agent");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<MatchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [activeIntent, setActiveIntent] = useState<Intent | null>(null);
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [showAllCommands, setShowAllCommands] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  // Terminal state
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [termConnected, setTermConnected] = useState(false);

  const employees = useEmployees();
  const projects = useProjects();
  const companies = useCompanies();

  const context: IntentContext = useMemo(() => ({
    employees: employees.filter((e: { status: string }) => e.status === "Active").map((e) => ({
      name: e.name, employee_name: e.employee_name, user_id: e.user_id, company: e.company,
    })),
    projects: projects.map((p) => ({
      name: p.name, project_name: p.project_name, status: p.status, company: p.company,
    })),
    companies: companies.map((c) => ({ name: c.name, company_name: c.company_name })),
  }), [employees, projects, companies]);

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  useEffect(() => { scrollToBottom(); }, [log, scrollToBottom]);
  useEffect(() => { if (expanded && !activeIntent) inputRef.current?.focus(); }, [expanded, activeIntent]);

  // Autocomplete
  useEffect(() => {
    if (activeIntent) { setSuggestions([]); return; }
    if (input.trim().length < 1) {
      setSuggestions([]);
      setSelectedIdx(-1);
      return;
    }
    setSuggestions(matchIntents(input).slice(0, 6));
    setSelectedIdx(-1);
  }, [input, activeIntent]);

  /* ─── Select an intent: show inline slot form ─── */
  function selectIntent(match: MatchResult) {
    const vals: Record<string, string> = { ...match.extractedSlots };
    for (const s of match.intent.slots) {
      if (!vals[s.name] && s.defaultFn) vals[s.name] = s.defaultFn();
    }
    setActiveIntent(match.intent);
    setSlotValues(vals);
    setInput("");
    setSuggestions([]);
    // Focus first empty required slot after render
    setTimeout(() => {
      const firstEmpty = match.intent.slots.find((s) => s.required && !vals[s.name]);
      if (firstEmpty) slotRefs.current.get(firstEmpty.name)?.focus();
    }, 50);
  }

  function cancelIntent() {
    setActiveIntent(null);
    setSlotValues({});
    inputRef.current?.focus();
  }

  /* ─── Execute ─── */
  async function executeIntent() {
    if (!activeIntent) return;
    setExecuting(true);
    const intentName = activeIntent.name;
    try {
      const result = await activeIntent.execute(slotValues, context);
      // Try to extract created document name for undo
      let undoInfo: LogEntry["undoInfo"];
      const createdMatch = result.match(/✓.*?:\s*([\w-]+)/);
      if (createdMatch && activeIntent.id.startsWith("create")) {
        const doctypeMap: Record<string, string> = {
          create_project: "Project", create_task: "Task", create_todo: "ToDo",
          create_expense: "Expense Claim", request_leave: "Leave Application",
          book_hours: "Timesheet",
        };
        const dt = doctypeMap[activeIntent.id];
        if (dt) undoInfo = { doctype: dt, name: createdMatch[1] };
      }
      setLog((prev) => [...prev,
        { id: ++logCounter, kind: "user", content: `${intentName}: ${formatSlotSummary(activeIntent, slotValues)}` },
        { id: ++logCounter, kind: "result", content: result, undoInfo },
      ]);
      setActiveIntent(null);
      setSlotValues({});
      inputRef.current?.focus();
    } catch (err) {
      setLog((prev) => [...prev,
        { id: ++logCounter, kind: "error", content: `${intentName}: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setExecuting(false);
    }
  }

  function formatSlotSummary(intent: Intent, vals: Record<string, string>): string {
    return intent.slots
      .filter((s) => vals[s.name])
      .map((s) => {
        let val = vals[s.name];
        if (s.type === "employee") {
          const emp = context.employees.find((e) => e.name === val);
          if (emp) val = emp.employee_name;
        }
        if (s.type === "project") {
          const proj = context.projects.find((p) => p.name === val);
          if (proj) val = `${proj.name} — ${proj.project_name}`;
        }
        return `${s.label}: ${val}`;
      })
      .join(", ");
  }

  /* ─── Undo ─── */
  async function handleUndo(entry: LogEntry) {
    if (!entry.undoInfo) return;
    try {
      await deleteDocument(entry.undoInfo.doctype, entry.undoInfo.name);
      setLog((prev) => [
        ...prev.filter((e) => e.id !== entry.id),
        { id: ++logCounter, kind: "result", content: t("component_agent_panel.undone", { doctype: entry.undoInfo!.doctype, name: entry.undoInfo!.name }) },
      ]);
    } catch (err) {
      setLog((prev) => [...prev,
        { id: ++logCounter, kind: "error", content: t("component_agent_panel.undo_failed", { error: err instanceof Error ? err.message : String(err) }) },
      ]);
    }
  }

  /* ─── Keyboard ─── */
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        selectIntent(suggestions[selectedIdx]);
      } else if (suggestions.length > 0) {
        selectIntent(suggestions[0]);
      } else if (input.trim()) {
        // No match
        const issueUrl = buildUnmatchedIssueUrl(input);
        setLog((prev) => [...prev,
          { id: ++logCounter, kind: "user", content: input },
          { id: ++logCounter, kind: "error", content: t("component_agent_panel.not_recognized", { url: issueUrl }) },
        ]);
        setInput("");
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setInput("");
    }
  }

  function handleSlotKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeIntent();
    } else if (e.key === "Escape") {
      cancelIntent();
    }
  }

  /* ─── Build suggestion label with slot highlights ─── */
  function buildSuggestionLabel(intent: Intent, extracted: Record<string, string>): React.JSX.Element {
    // Build a readable sentence
    const parts: React.JSX.Element[] = [];
    // Find the best pattern that has slots
    const patternWithSlots = intent.patterns.find((p) => p.includes("{")) || intent.patterns[0];
    const tokens = patternWithSlots.split(/(\{[^}]+\})/g);

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.startsWith("{") && tok.endsWith("}")) {
        const slotName = tok.slice(1, -1);
        const slot = intent.slots.find((s) => s.name === slotName);
        const val = extracted[slotName];
        parts.push(
          <span key={i} className={`inline-block px-1 mx-0.5 rounded ${val ? "bg-y-teal/20 text-y-teal-dark font-medium" : "bg-amber-100 text-amber-700"}`}>
            {val || slot?.label || slotName}
          </span>
        );
      } else if (tok) {
        parts.push(<span key={i}>{tok}</span>);
      }
    }
    return <span className="leading-relaxed">{parts}</span>;
  }

  /* ─── All commands view ─── */
  const commandsByCategory = useMemo(() => {
    const map = new Map<string, Intent[]>();
    for (const i of INTENTS) {
      if (!map.has(i.category)) map.set(i.category, []);
      map.get(i.category)!.push(i);
    }
    return map;
  }, []);

  const instance = getActiveInstance();
  const panelHeight = tall ? "h-[560px]" : "h-[420px]";

  /* ─── Terminal connect ─── */
  const connectTerminal = useCallback(() => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (terminalRef.current) { terminalRef.current.dispose(); terminalRef.current = null; }

    const instanceId = getActiveInstanceId();
    const terminal = new Terminal({
      cursorBlink: true, fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
      theme: {
        background: "#1a1b26", foreground: "#a9b1d6", cursor: "#c0caf5",
        selectionBackground: "#33467c", black: "#15161e", red: "#f7768e",
        green: "#9ece6a", yellow: "#e0af68", blue: "#7aa2f7", magenta: "#bb9af7",
        cyan: "#7dcfff", white: "#a9b1d6", brightBlack: "#414868",
        brightRed: "#f7768e", brightGreen: "#9ece6a", brightYellow: "#e0af68",
        brightBlue: "#7aa2f7", brightMagenta: "#bb9af7", brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
      rows: 24, cols: 80, scrollback: 5000, convertEol: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    if (termRef.current) {
      terminal.open(termRef.current);
      setTimeout(() => fitAddon.fit(), 50);
    }

    terminal.writeln("\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m");
    terminal.writeln(`\x1b[1;36m║\x1b[0m  Y-app Terminal                          \x1b[1;36m║\x1b[0m`);
    terminal.writeln(`\x1b[1;36m║\x1b[0m  Instance: \x1b[1;33m${(instance.name || instanceId).padEnd(28)}\x1b[0m \x1b[1;36m║\x1b[0m`);
    terminal.writeln("\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m");
    terminal.writeln(`\x1b[90m${t("component_agent_panel.connecting")}\x1b[0m\n`);

    // Same-origin: dev uses Vite's /ws proxy, prod uses nginx upgrade
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const activeInst = getActiveInstance();
    const instanceQuery = activeInst && activeInst.id !== "default" ? `?instance=${encodeURIComponent(activeInst.id)}` : "";
    const wsUrl = `${protocol}//${window.location.host}/ws/terminal${instanceQuery}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => { setTermConnected(true); terminal.writeln(`\x1b[1;32m${t("component_agent_panel.connected")}\x1b[0m\n`); };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") terminal.write(msg.data);
        else if (msg.type === "exit") { terminal.writeln(`\n\x1b[90m${t("component_agent_panel.process_ended", { code: msg.code })}\x1b[0m`); setTermConnected(false); }
        else if (msg.type === "error") terminal.writeln(`\n\x1b[1;31m${msg.message}\x1b[0m`);
      } catch { terminal.write(event.data); }
    };
    ws.onclose = () => { setTermConnected(false); terminal.writeln(`\n\x1b[90m${t("component_agent_panel.connection_closed")}\x1b[0m`); };
    ws.onerror = () => { terminal.writeln(`\n\x1b[1;31m${t("component_agent_panel.websocket_error")}\x1b[0m`); setTermConnected(false); };
    terminal.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data })); });
  }, [instance.name]);

  useEffect(() => {
    if (expanded && activeTab === "terminal") {
      const timer = setTimeout(connectTerminal, 100);
      return () => { clearTimeout(timer); wsRef.current?.close(); terminalRef.current?.dispose(); };
    }
  }, [expanded, activeTab, connectTerminal]);

  useEffect(() => {
    if (expanded && activeTab === "terminal" && fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 100);
      return () => clearTimeout(timer);
    }
  }, [tall, expanded, activeTab]);

  // Raise button on pages with their own input bar to avoid overlap
  const raiseOnPages = ["/messenger", "/webmail"];
  const raised = raiseOnPages.some(p => location.pathname.startsWith(p));

  /* ─── Collapsed state ─── */
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`fixed ${raised ? "bottom-20" : "bottom-5"} right-5 z-40 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-y-purple-dark to-y-purple text-white rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer`}
      >
        <Sparkles size={16} />
        <span className="text-sm font-medium">{t("component_agent_panel.open_aec_assistant")}</span>
      </button>
    );
  }

  /* ─── Expanded ─── */
  const panelWidth = activeTab === "terminal" && tall ? "w-[700px]" : "w-[440px]";
  const panelBg = activeTab === "terminal" ? "bg-[#1a1b26] border-[#33467c]" : "bg-white border-slate-200";

  return (
    <div className={`fixed bottom-5 right-5 z-40 ${panelWidth} ${panelHeight} ${panelBg} rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 h-10 ${activeTab === "terminal" ? "bg-[#24283b] text-[#a9b1d6]" : "bg-gradient-to-r from-y-purple-dark to-y-purple text-white"} flex-shrink-0 select-none rounded-t-xl`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {/* Tab buttons */}
          <button
            onClick={() => setActiveTab("agent")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "agent" ? "bg-white/20" : "hover:bg-white/10 opacity-60"
            }`}
          >
            <Sparkles size={12} />
            Agent
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              activeTab === "terminal" ? "bg-white/20" : "hover:bg-white/10 opacity-60"
            }`}
          >
            <TerminalIcon size={12} />
            Terminal
            {activeTab === "terminal" && (
              <span className={`w-1.5 h-1.5 rounded-full ${termConnected ? "bg-[#9ece6a]" : "bg-[#f7768e]"}`} />
            )}
          </button>
          <span className="text-[10px] opacity-50 ml-1">{instance.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeTab === "agent" && (
            <button onClick={(e) => { e.stopPropagation(); setShowAllCommands(!showAllCommands); }}
              className="p-1 hover:bg-white/10 rounded cursor-pointer" title={t("agent.all_commands")}>
              <HelpCircle size={12} />
            </button>
          )}
          {activeTab === "terminal" && (
            <button onClick={connectTerminal}
              className="p-1 hover:bg-white/10 rounded cursor-pointer" title={t("agent.reconnect")}>
              <RefreshCw size={11} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); setTall(!tall); }}
            className="p-1 hover:bg-white/10 rounded cursor-pointer" title={tall ? t("agent.smaller") : t("agent.larger")}>
            {tall ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {activeTab === "agent" && log.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLog([]); }}
              className="p-1 hover:bg-white/10 rounded cursor-pointer" title={t("agent.clear")}>
              <Trash2 size={12} />
            </button>
          )}
          <button onClick={() => setExpanded(false)} className="cursor-pointer p-1 hover:bg-white/10 rounded">
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Terminal tab */}
      {activeTab === "terminal" && (
        <div ref={termRef} className="flex-1 min-h-0 p-1" />
      )}

      {/* Agent Body */}
      {activeTab === "agent" && <div className="flex-1 overflow-y-auto min-h-0">
        {/* All commands overview */}
        {showAllCommands ? (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700">{t("agent.all_commands")}</h4>
              <button onClick={() => setShowAllCommands(false)} className="text-[10px] text-y-teal cursor-pointer hover:underline">{t("agent.close")}</button>
            </div>
            {Array.from(commandsByCategory).map(([cat, intents]) => (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{cat}</p>
                <div className="space-y-0.5">
                  {intents.map((intent) => (
                    <button
                      key={intent.id}
                      onClick={() => {
                        setShowAllCommands(false);
                        selectIntent({ intent, score: 1, extractedSlots: {} });
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Zap size={10} className="text-y-teal flex-shrink-0" />
                      <span className="font-medium">{intent.name}</span>
                      <span className="text-slate-400 truncate">{intent.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 space-y-1.5">
            {/* Empty state with quick actions */}
            {log.length === 0 && !activeIntent && (
              <div className="text-center py-4 space-y-3">
                <Sparkles size={24} className="mx-auto text-slate-300" />
                <p className="text-xs text-slate-500">{t("component_agent_panel.empty_prompt")}</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {INTENTS.filter((i) => !["help", "find_employee"].includes(i.id)).slice(0, 8).map((intent) => (
                    <button
                      key={intent.id}
                      onClick={() => selectIntent({ intent, score: 1, extractedSlots: {} })}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-y-teal/10 hover:text-y-teal text-slate-600 rounded-full text-[11px] cursor-pointer transition-colors"
                    >
                      {intent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Log */}
            {log.map((entry) => (
              <div key={entry.id}>
                {entry.kind === "user" && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-y-teal text-white rounded-lg px-2.5 py-1.5 text-xs">
                      {entry.content}
                    </div>
                  </div>
                )}
                {entry.kind === "result" && (
                  <div className="flex justify-start gap-1">
                    <div className="max-w-[85%] bg-slate-100 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap">
                      {entry.content}
                    </div>
                    {entry.undoInfo && (
                      <button
                        onClick={() => handleUndo(entry)}
                        className="self-start p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer flex-shrink-0"
                        title={t("component_agent_panel.undo")}
                      >
                        <Undo2 size={12} />
                      </button>
                    )}
                  </div>
                )}
                {entry.kind === "error" && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[11px]">
                    {entry.content.includes("[") ? (
                      <span dangerouslySetInnerHTML={{
                        __html: entry.content.replace(
                          /\[([^\]]+)\]\(([^)]+)\)/g,
                          '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline font-medium">$1</a>'
                        ),
                      }} />
                    ) : entry.content}
                  </div>
                )}
              </div>
            ))}

            <div ref={logEndRef} />
          </div>
        )}
      </div>}

      {/* Active intent: inline slot form */}
      {activeTab === "agent" && activeIntent && (
        <div className="border-t border-slate-200 px-3 py-2.5 bg-slate-50 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-y-teal" />
              <span className="text-xs font-semibold text-slate-700">{activeIntent.name}</span>
            </div>
            <button onClick={cancelIntent} className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer">{t("component_agent_panel.cancel")}</button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {activeIntent.slots.map((slot) => (
              <div key={slot.name} className={slot.type === "text" && slot.name === "description" ? "col-span-2" : ""}>
                <label className="block text-[9px] font-medium text-slate-500 mb-0.5">
                  {slot.label}{slot.required ? " *" : ""}
                </label>
                {slot.type === "project" ? (
                  <select
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal bg-white"
                  >
                    <option value="">—</option>
                    {context.projects.filter((p) => p.status === "Open").map((p) => (
                      <option key={p.name} value={p.name}>{p.name} — {p.project_name}</option>
                    ))}
                  </select>
                ) : slot.type === "employee" ? (
                  <select
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal bg-white"
                  >
                    <option value="">—</option>
                    {context.employees.map((e) => (
                      <option key={e.name} value={e.name}>{e.employee_name}</option>
                    ))}
                  </select>
                ) : slot.type === "company" ? (
                  <select
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal bg-white"
                  >
                    <option value="">—</option>
                    {context.companies.map((c) => (
                      <option key={c.name} value={c.name}>{c.company_name}</option>
                    ))}
                  </select>
                ) : slot.type === "priority" ? (
                  <select
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    value={slotValues[slot.name] || "Medium"}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                ) : slot.type === "date" ? (
                  <input
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    type="date"
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal"
                  />
                ) : slot.type === "number" ? (
                  <input
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    type="number"
                    step="0.5"
                    min="0"
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    placeholder={slot.label}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal"
                  />
                ) : (
                  <input
                    ref={(el) => { if (el) slotRefs.current.set(slot.name, el); }}
                    type="text"
                    value={slotValues[slot.name] || ""}
                    onChange={(e) => setSlotValues((v) => ({ ...v, [slot.name]: e.target.value }))}
                    onKeyDown={handleSlotKeyDown}
                    placeholder={slot.label}
                    className="w-full px-1.5 py-1 border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-y-teal"
                  />
                )}
              </div>
            ))}
          </div>

          <button
            onClick={executeIntent}
            disabled={executing || activeIntent.slots.some((s) => s.required && !slotValues[s.name]?.trim())}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-y-teal text-white rounded-lg text-xs font-medium hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
          >
            {executing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {executing ? t("component_agent_panel.busy") : t("component_agent_panel.execute")}
          </button>
        </div>
      )}

      {/* Input bar */}
      {activeTab === "agent" && !activeIntent && (
        <div className="border-t border-slate-200 px-3 py-2 flex-shrink-0 relative">
          {/* Autocomplete */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-[240px] overflow-y-auto">
              {suggestions.map((match, i) => (
                <button
                  key={match.intent.id}
                  onClick={() => selectIntent(match)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full text-left px-3 py-2.5 text-xs cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                    i === selectedIdx ? "bg-y-teal/5" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Zap size={10} className="text-y-teal flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      {buildSuggestionLabel(match.intent, match.extractedSlots)}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-medium text-slate-400">{match.intent.category}</span>
                        <span className="text-[9px] text-slate-300">{match.intent.description}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={t("component_agent_panel.input_placeholder")}
              className="flex-1 px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            {input.trim() && (
              <button
                onClick={() => {
                  if (suggestions.length > 0) selectIntent(suggestions[0]);
                }}
                className="p-1.5 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark cursor-pointer"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
