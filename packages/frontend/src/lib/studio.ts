export const CAD_MAX_SIZE = 100 * 1024 * 1024;
/** Native waarschuwing bij herladen/sluiten; interne navigatie houdt CAD gemount. */
export function guardCadBeforeUnload(target: EventTarget, isDirty: () => boolean): () => void {
  const leave = (event: Event) => {
    if (!isDirty()) return;
    event.preventDefault();
    (event as BeforeUnloadEvent).returnValue = "";
  };
  target.addEventListener("beforeunload", leave);
  return () => target.removeEventListener("beforeunload", leave);
}
export function studioAssetUrl(kind: "cad" | "planner", base: string): string {
  return `${base.endsWith("/") ? base : base + "/"}studios/${kind}/index.html`;
}
export function plannerAssetUrl(base: string, scope: string): string {
  if (!/^[a-f0-9]{64}$/.test(scope)) throw new Error("invalid");
  return `${studioAssetUrl("planner", base)}?scope=${scope}`;
}
/** Alleen normale bestandspaden op de eigen server, zonder tokens of redirects. */
export function safeCadSource(source: string, origin: string): string | null {
  try {
    const decoded = decodeURIComponent(source);
    if (/[\\\u0000-\u001f\u007f?#]/.test(decoded) || decoded.split("/").some((part) => part === ".." || part === ".")) return null;
    const url = new URL(source, origin);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash || !/^\/(?:private\/)?files\/[^/]/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function cadLoadMessage(id: string, name: string, bytes: ArrayBuffer) {
  if (!id || id.length >= 100 || !/\.(dwg|dxf)$/i.test(name) || !(bytes instanceof ArrayBuffer)) throw new Error("invalid");
  if (bytes.byteLength > CAD_MAX_SIZE) throw new Error("size");
  return { type: "domera.cad" as const, version: 1 as const, id, action: "load" as const, name, bytes };
}
export interface CadReply { type: "domera.cad.reply"; version: 1; id: string; ok: boolean; error?: string; dirty?: boolean; bytes?: ArrayBuffer }
export function readCadReply(event: { origin: string; source: unknown; data: unknown }, origin: string, frame: unknown): CadReply | null {
  if (!frame || event.origin !== origin || event.source !== frame || !event.data || typeof event.data !== "object") return null;
  const data = event.data as Record<string, unknown>;
  if (data.type !== "domera.cad.reply" || data.version !== 1 || typeof data.id !== "string" || !data.id || data.id.length >= 100 || typeof data.ok !== "boolean") return null;
  if (data.error !== undefined && typeof data.error !== "string" || data.dirty !== undefined && typeof data.dirty !== "boolean" || data.bytes !== undefined && (!(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength > CAD_MAX_SIZE)) return null;
  return data as unknown as CadReply;
}
/** Begrens ook streams zonder Content-Length vóór een grote bufferallocatie. */
export async function readCadBytes(response: Response, signal: AbortSignal, max = CAD_MAX_SIZE): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  if (!response.ok || !response.body) throw new Error("load");
  if (Number(response.headers.get("Content-Length")) > max) throw new Error("size");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("size");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes.buffer;
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
