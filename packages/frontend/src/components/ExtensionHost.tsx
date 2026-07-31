/**
 * ExtensionHost — renders a sandboxed iframe for runtime ("remote")
 * extensions and brokers their ERPNext calls through a postMessage RPC.
 *
 * Threat model: the iframe is served from a third-party origin (e.g.
 * github.io). It has no cookies for y-app.impertio.app, so it cannot call
 * /api/* directly. Everything the extension does against ERPNext goes
 * through this bridge, which runs in the parent Y-app tab and therefore
 * uses the user's authenticated session. The iframe never sees credentials.
 *
 * Wire protocol (version 1):
 *   iframe → parent   { id, type: "yapp-ext.rpc",       method, args }
 *   parent → iframe   { id, type: "yapp-ext.rpc.reply", ok: true,  result }
 *                   | { id, type: "yapp-ext.rpc.reply", ok: false, error }
 *
 * Only methods in DISPATCH are callable. Anything else is rejected.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import {
  fetchList,
  fetchDocument,
  updateDocument,
  createDocument,
  callMethod,
  getErpNextAppUrl,
} from "../lib/erpnext";
import { getActiveInstanceId, getActiveInstance } from "../lib/instances";
import {
  buildExtensionSrc,
  extensionOrigin,
  useRemoteExtensions,
} from "../extensions/remote";

type RpcEnvelope = {
  id: string | number;
  type: "yapp-ext.rpc";
  method: string;
  args: unknown[];
};

type RpcReply =
  | { id: string | number; type: "yapp-ext.rpc.reply"; ok: true; result: unknown }
  | { id: string | number; type: "yapp-ext.rpc.reply"; ok: false; error: string };

/**
 * Fetch an ERPNext-hosted private file (e.g. Employee.image) through the
 * bridged per-instance proxy. The extension iframe has no ERPNext session,
 * so returning the blob as base64 lets the extension wrap it in a data:
 * URL without exposing a URL the browser would have to refetch (and fail
 * on) cross-origin. Accepts either a full URL, a relative ERPNext path
 * (`/private/files/...`, `/files/...`) or a bare filename.
 */
async function fetchPrivateFile(rawPath: string): Promise<{ contentType: string; base64: string }> {
  const inst = getActiveInstance();
  let path = rawPath;
  // Accept a full URL and strip the origin so we always go through the
  // bridged `/api/i/:id/*` proxy — the browser has no ERPNext cookies.
  if (/^https?:\/\//i.test(path)) {
    try { path = new URL(path).pathname; } catch { /* fall through */ }
  }
  if (!path.startsWith("/")) path = "/" + path;
  const url = `/api/i/${inst.id}${path}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`fetchPrivateFile ${res.status}: ${path}`);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buf = await res.arrayBuffer();
  // Chunked base64 encoding to avoid the "call stack exceeded" that
  // String.fromCharCode(...new Uint8Array(…)) hits on large binaries.
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { contentType, base64: btoa(binary) };
}

const DISPATCH: Record<string, (args: unknown[]) => Promise<unknown>> = {
  fetchList: async (args) => fetchList(args[0] as string, args[1] as Parameters<typeof fetchList>[1]),
  fetchDocument: async (args) => fetchDocument(args[0] as string, args[1] as string),
  updateDocument: async (args) => updateDocument(args[0] as string, args[1] as string, args[2] as Record<string, unknown>),
  createDocument: async (args) => createDocument(args[0] as string, args[1] as Record<string, unknown>),
  callMethod: async (args) => callMethod(args[0] as string, (args[1] as Record<string, unknown>) ?? {}),
  getActiveInstanceId: async () => getActiveInstanceId(),
  getErpNextAppUrl: async () => getErpNextAppUrl(),
  fetchPrivateFile: async (args) => fetchPrivateFile(args[0] as string),
};

export default function ExtensionHost() {
  const { t, i18n } = useTranslation();
  const { extId } = useParams<{ extId: string }>();
  const remotes = useRemoteExtensions();
  const ext = useMemo(() => remotes.find((r) => r.id === extId), [remotes, extId]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  // 10s timeout — if the iframe never reports `load` (network blocked,
  // CSP frame-ancestors denial, DNS failure, etc.) flip into the error
  // state so the user sees something actionable instead of a blank page.
  useEffect(() => {
    if (!ext || status !== "loading") return;
    const timer = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), 10_000);
    return () => clearTimeout(timer);
  }, [ext, status, reloadKey]);

  useEffect(() => {
    if (!ext) return;
    const allowedOrigin = extensionOrigin(ext);

    const onMessage = (e: MessageEvent) => {
      if (allowedOrigin !== "*" && e.origin !== allowedOrigin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;

      const data = e.data as RpcEnvelope | null;
      if (!data || data.type !== "yapp-ext.rpc" || typeof data.method !== "string") return;

      const handler = DISPATCH[data.method];
      const reply = (payload: RpcReply) => {
        iframeRef.current?.contentWindow?.postMessage(payload, allowedOrigin);
      };

      if (!handler) {
        reply({ id: data.id, type: "yapp-ext.rpc.reply", ok: false, error: `Unknown method: ${data.method}` });
        return;
      }

      const argsList = Array.isArray(data.args) ? data.args : [];
      handler(argsList)
        .then((result) => reply({ id: data.id, type: "yapp-ext.rpc.reply", ok: true, result }))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          reply({ id: data.id, type: "yapp-ext.rpc.reply", ok: false, error: msg });
        });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [ext]);

  if (!ext) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-800">
          {t("extensions.not_found_title", { defaultValue: "Extension not found" })}
        </h2>
        <p className="text-sm text-slate-500">
          {t("extensions.not_found_body", {
            defaultValue: "This extension is not installed on this instance.",
          })}
        </p>
      </div>
    );
  }

  const src = buildExtensionSrc(ext, {
    hostOrigin: window.location.origin,
    instanceId: getActiveInstanceId(),
    erpUrl: getErpNextAppUrl(),
    lang: i18n.language || "nl",
  });

  function retry() {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={src}
        title={ext.name}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        className="w-full h-full border-0"
        onLoad={() => setStatus((s) => (s === "loading" ? "ready" : s))}
        onError={() => setStatus("error")}
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <RefreshCw size={16} className="animate-spin" />
            <span>{t("extensions.loading", { defaultValue: "Loading extension…" })}</span>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg shadow-sm p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-slate-800">
                  {t("extensions.load_failed_title", { defaultValue: "Extension could not load" })}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {t("extensions.load_failed_body", {
                    defaultValue:
                      "Check your network or ask the extension author whether the URL is reachable.",
                  })}
                </p>
                <div className="mt-2 text-xs font-mono text-slate-400 break-all">{ext.url}</div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={retry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-y-teal text-white hover:bg-y-teal/90 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    {t("extensions.retry", { defaultValue: "Retry" })}
                  </button>
                  <a
                    href={ext.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink size={12} />
                    {t("extensions.open_in_new_tab", { defaultValue: "Open in new tab" })}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
