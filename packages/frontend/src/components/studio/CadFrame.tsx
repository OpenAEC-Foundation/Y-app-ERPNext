import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RotateCcw } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";
import { cadLoadMessage, guardCadBeforeUnload, readCadBytes, readCadReply, safeCadSource, studioAssetUrl } from "../../lib/studio";

/** De WASM-editor blijft lokaal; bijlagen worden uitsluitend als bytes aangeleverd. */
export default function CadFrame({ source, name }: { source?: string; name?: string }) {
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => guardCadBeforeUnload(window, () => dirty.current), []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true; let sent = false;
    const id = `load-${crypto.randomUUID()}`;
    dirty.current = false;
    setLoading(true); setError("");
    const fail = (code: string) => {
      if (!active) return;
      setLoading(false); setError(code); controller.abort(); window.clearTimeout(timeout);
    };
    const timeout = window.setTimeout(() => fail("timeout"), 90_000);
    async function openSource() {
      try {
        const safe = source && safeCadSource(source, window.location.origin);
        if (!safe || !name) throw new Error("invalid");
        const fetchUrl = safeCadSource(getFileUrl(new URL(safe).pathname), window.location.origin);
        if (!fetchUrl) throw new Error("invalid");
        // Een redirect mag geen geauthenticeerd bestand naar elders leiden.
        const response = await fetch(fetchUrl, { credentials: "same-origin", redirect: "error", signal: controller.signal });
        const bytes = await readCadBytes(response, controller.signal);
        controller.signal.throwIfAborted();
        if (!active || !frame.current?.contentWindow) return;
        frame.current.contentWindow.postMessage(cadLoadMessage(id, name, bytes), window.location.origin, [bytes]);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const code = cause instanceof Error ? cause.message : "load";
        fail(["invalid", "size"].includes(code) ? code : "load");
      }
    }
    function receive(event: MessageEvent) {
      const reply = readCadReply(event, window.location.origin, frame.current?.contentWindow);
      if (!reply || !active || controller.signal.aborted) return;
      if (reply.dirty !== undefined) dirty.current = reply.dirty;
      if (reply.id === "status" && !sent) {
        if (!reply.ok) { fail("load"); return; }
        sent = true;
        if (source) void openSource();
        else { setLoading(false); window.clearTimeout(timeout); }
      } else if (reply.id === id) {
        window.clearTimeout(timeout); setLoading(false);
        if (!reply.ok) fail("load");
      }
    }
    window.addEventListener("message", receive);
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); window.removeEventListener("message", receive); };
  }, [source, name, retry]);
  return <div className="relative flex min-h-0 flex-1 bg-slate-100">
    <iframe key={`${source ?? "local"}:${name ?? ""}:${retry}`} ref={frame} src={studioAssetUrl("cad", import.meta.env.BASE_URL)} title={name ?? t("start_apps.cad")} className="h-full min-h-0 w-full flex-1 border-0" />
    {(loading || error) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 px-5 text-center text-sm text-slate-600" role={error ? "alert" : "status"}>
      {error ? <><p>{t(`studio.error_${error}`)}</p><button onClick={() => setRetry((value) => value + 1)} className="flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"><RotateCcw size={14} />{t("studio.retry")}</button></>
        : <><Loader2 size={18} className="animate-spin motion-reduce:animate-none" /><p>{t("studio.loading")}</p></>}
    </div>}
  </div>;
}
