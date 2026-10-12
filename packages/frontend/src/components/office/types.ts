export interface OfficeEditorHandle { serialize(): Promise<Uint8Array>; }
export interface OfficeEditorProps {
  bytes: Uint8Array; name: string; locale: "nl" | "en" | "de";
  onReady(handle: OfficeEditorHandle): void;
  onChange(): void;
  onSave(): void;
  onError(error: unknown): void;
}
