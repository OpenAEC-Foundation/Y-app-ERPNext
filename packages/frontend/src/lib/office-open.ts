import { OfficeApiError, type OfficeApi, type OfficeFile } from "./office-api.ts";
export type LoadedOfficeSource = { metadata: OfficeFile; bytes: Uint8Array };
export class OfficeOpenLoader {
  value: LoadedOfficeSource | null = null;
  private generation = 0;
  private api: Pick<OfficeApi, "open" | "content">;
  private digest: (bytes: Uint8Array) => Promise<string>;
  constructor(api: Pick<OfficeApi, "open" | "content">, digest = async (bytes: Uint8Array) => {
    const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
  }) { this.api = api; this.digest = digest; }
  async load(id: string): Promise<LoadedOfficeSource | null> {
    const generation = ++this.generation; this.value = null;
    const metadata = await this.api.open(id);
    if (generation !== this.generation) return null;
    const bytes = await this.api.content(id);
    if (generation !== this.generation) return null;
    const hash = await this.digest(bytes);
    if (generation !== this.generation) return null;
    if (hash !== metadata.sha256) throw new OfficeApiError(409);
    this.value = { metadata, bytes }; return this.value;
  }
  cancel() { this.generation++; this.value = null; }
}
