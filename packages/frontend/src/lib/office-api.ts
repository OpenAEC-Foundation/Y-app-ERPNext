import { ensureCsrfToken } from "./csrf.ts";
export interface OfficeFile {
  name: string; file_name: string; file_url: string; content_hash: string; sha256: string;
  attached_to_doctype: string | null; attached_to_name: string | null; can_save: boolean; max_size: number;
  source_file?: string; operation_id?: string;
}
export class OfficeApiError extends Error {
  status: number;
  constructor(status: number) { super(`HTTP ${status}`); this.status = status; }
}
export class OfficeSaveUnknown extends OfficeApiError { constructor() { super(0); } }
const endpoint = (method: string) => `/api/method/y_next.api.office.${method}`;
function metadata(value: unknown): OfficeFile {
  const file = value as OfficeFile;
  if (!file || typeof file.name !== "string" || !file.name || typeof file.file_name !== "string" || !/^[a-f\d]{64}$/i.test(file.sha256)) throw new Error("Ongeldig bestandsantwoord");
  if (typeof file.can_save !== "boolean" || !Number.isFinite(file.max_size) || file.max_size <= 0 || typeof file.file_url !== "string" || !/^\/(?:private\/)?files\//.test(file.file_url)) throw new Error("Ongeldige bestandsrechten of limiet");
  return file;
}
export class OfficeApi {
  private fetcher: typeof fetch; private csrf: () => Promise<string | null>;
  constructor(fetcher: typeof fetch = fetch, csrf: () => Promise<string | null> = ensureCsrfToken) { this.fetcher = fetcher; this.csrf = csrf; }
  private async get(method: string, query: Record<string, string>) {
    const response = await this.fetcher(`${endpoint(method)}?${new URLSearchParams(query)}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new OfficeApiError(response.status);
    return response;
  }
  async open(id: string): Promise<OfficeFile> {
    const file = metadata((await (await this.get("open_file", { file_name: id })).json()).message);
    if (file.name !== id) throw new Error("File-id komt niet overeen");
    return file;
  }
  async content(id: string): Promise<Uint8Array> { return new Uint8Array(await (await this.get("file_content", { file_name: id })).arrayBuffer()); }
  async save(source: OfficeFile, bytes: Uint8Array, operation: string): Promise<OfficeFile> {
    if (!source.can_save) throw new OfficeApiError(403);
    const token = await this.csrf();
    if (!token) throw new OfficeApiError(403);
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(bytes)]), source.file_name);
    body.append("source_file", source.name); body.append("expected_sha256", source.sha256); body.append("operation_id", operation);
    let response: Response;
    try {
      response = await this.fetcher(endpoint("save_file"), { method: "POST", credentials: "same-origin", headers: { Accept: "application/json", "X-Frappe-CSRF-Token": token }, body, signal: AbortSignal.timeout(60_000) });
    } catch { throw new OfficeSaveUnknown(); }
    if (!response.ok) {
      if (response.status >= 500 || response.status === 408) throw new OfficeSaveUnknown();
      const error = await response.clone().json().catch(() => null);
      if (error?.office_error === "office_save_pending") throw new OfficeSaveUnknown();
      throw new OfficeApiError(response.status);
    }
    try {
      const file = metadata((await response.json()).message);
      if (file.operation_id !== operation || file.source_file !== source.name) throw new Error("Operatie komt niet overeen");
      return file;
    } catch { throw new OfficeSaveUnknown(); }
  }
  async status(operation: string, source: string): Promise<OfficeFile | null> {
    const result = (await (await this.get("save_status", { operation_id: operation })).json()).message;
    if (result?.operation_id !== operation || typeof result?.found !== "boolean") throw new Error("Operatie komt niet overeen");
    if (!result.found) return null;
    const file = metadata(result.file);
    if (file.operation_id !== operation || file.source_file !== source) throw new Error("Bron komt niet overeen");
    return file;
  }
}
