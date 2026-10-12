import { useEffect, useRef, useState } from "react";
import { XlsxEditor, EditorToolbar, type XlsxEditorApi } from "@betteroffice/xlsx-react";
import { initWasm } from "@betteroffice/xlsx";
import { en, de } from "@betteroffice/xlsx-i18n";
import xlsxWasmUrl from "@office-xlsx-wasm?url";
import { xlsxNl } from "./xlsx-nl";
import type { OfficeEditorProps } from "./types";

export default function SheetEditor({ bytes, name, locale, onReady, onChange, onSave, onError }: OfficeEditorProps) {
  const [initialized, setInitialized] = useState(false);
  const capture = useRef<((bytes: Uint8Array) => void) | null>(null);
  const errorHandler = useRef(onError); errorHandler.current = onError;
  useEffect(() => {
    let cancelled = false;
    initWasm(xlsxWasmUrl).then(() => { if (!cancelled) setInitialized(true); }).catch((e) => { if (!cancelled) errorHandler.current(e); });
    return () => { cancelled = true; };
  }, []);
  function ready(api: XlsxEditorApi) {
    onReady({ serialize: () => new Promise<Uint8Array>((resolve, reject) => {
      capture.current = (data) => { capture.current = null; resolve(data); };
      // De commandqueue schrijft ook open cellen, paste en IME vóór export.
      api.commands.execute("save", null).then((result) => {
        if (!result.ok) { capture.current = null; reject(new Error(result.failure.message)); }
      }).catch((error) => { capture.current = null; reject(error); });
    }) });
  }
  if (!initialized) return null;
  return <XlsxEditor file={bytes} fileName={name} i18n={locale === "nl" ? xlsxNl : locale === "de" ? de : en}
    className="y-office-sheet h-full" onReady={ready} onChange={onChange}
    onSave={(data) => { if (capture.current) capture.current(data); else onSave(); }}
    toolbar={<EditorToolbar mode="commands">
      <EditorToolbar.Toolbar style={{ flex: "0 0 auto" }} />
      {/* De upstream formulebalk heeft een horizontale flex-basis van
          320px. In deze kolomlayout moet de hoogte inhoudgedreven zijn. */}
      <EditorToolbar.FormulaBar style={{ flex: "0 0 auto", minHeight: 36, padding: "4px 8px", boxSizing: "border-box", borderRight: "none" }} />
    </EditorToolbar>} />;
}
