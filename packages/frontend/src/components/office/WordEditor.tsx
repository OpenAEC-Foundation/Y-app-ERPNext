import { useCallback, useEffect, useRef, useState } from "react";
import { DocxEditor, type DocxEditorRef } from "@stll/folio-react";
import { getFolioMessages } from "@stll/folio-react/messages";
import { IntlProvider } from "use-intl";
import "@stll/folio-react/editor.css";
import { folioNlMessages } from "./folio-nl";
import type { OfficeEditorProps } from "./types";

export default function WordEditor({ bytes, locale, onReady, onChange, onSave, onError }: OfficeEditorProps) {
  const editor = useRef<DocxEditorRef>(null);
  const [parsed, setParsed] = useState(false);
  const announced = useRef(false);
  const callbacks = useRef({ onReady, onChange }); callbacks.current = { onReady, onChange };
  const serializing = useRef(false);
  const save = useCallback(async () => {
    serializing.current = true;
    try {
      const bytes = await editor.current?.save();
      if (!bytes) throw new Error("Document kan niet worden opgeslagen");
      return new Uint8Array(bytes);
    } finally { serializing.current = false; }
  }, []);
  const parsedDocument = useCallback(() => setParsed(true), []);
  const viewReady = useCallback((view: unknown) => {
    if (!view || announced.current) return;
    announced.current = true;
    callbacks.current.onReady({ serialize: save });
  }, [save]);
  useEffect(() => {
    // Het echte bewerkingsvenster wordt standaard uitgesteld tot de eerste
    // klik. Activeer het na de parse/React-commit, zonder focus te stelen.
    if (parsed) editor.current?.ensureEditorView({ focus: false });
  }, [parsed]);
  return (
    <IntlProvider locale={locale} messages={locale === "nl" ? folioNlMessages : getFolioMessages(locale)}>
      <DocxEditor ref={editor} documentBuffer={bytes} className="h-full" rulerUnit="cm" initialZoom="fit-width"
        showOutline={false} autoOpenReviewSidebar={false}
        onCompatibilityChange={parsedDocument} onEditorViewReady={viewReady}
        onChange={() => {
          // onChange is een wijzigingssignaal, geen initial-loadsignaal.
          if (announced.current) callbacks.current.onChange();
        }}
        onError={onError}
        onSave={() => { if (!serializing.current) onSave(); }} />
    </IntlProvider>
  );
}
