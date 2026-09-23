import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { getFileUrl } from "../../lib/erpnext";
import { sanitizeEditorHtml } from "../../lib/mail-html";
import { officeSoort } from "../../lib/bijlage-soort";

/**
 * Een Word- of Excel-bijlage naast de mail lezen, zonder hem te downloaden.
 *
 * Alleen lezen: dit is een leesvenster, geen editor. Wie het bestand wil
 * wijzigen, downloadt het — daarvoor staat de downloadknop in de kopbalk.
 *
 * **Alles laadt pas bij het openen.** `mammoth` (docx → HTML) en `xlsx`
 * (rekenbladen) zitten achter een dynamische import, net als de IFC-viewer;
 * anders draagt iedereen die alleen mail leest die bundel mee.
 *
 * **De uitkomst gaat door dezelfde filter als geplakte mail.** Een document
 * kan van buiten komen; `sanitizeEditorHtml` haalt scripts, stijlen en
 * verwijzingen naar buiten eruit voordat er iets op het scherm komt.
 */
interface Stand {
  /** Van welk bestand deze uitkomst is; een ander bestand = opnieuw laden. */
  url: string;
  html: string;
  bladen: { naam: string; html: string }[];
  fout: string;
}

export default function OfficeVoorbeeld({ url, naam }: { url: string; naam: string }) {
  const { t } = useTranslation();
  const [stand, setStand] = useState<Stand | null>(null);
  const [blad, setBlad] = useState(0);

  useEffect(() => {
    let gestopt = false;
    void (async () => {
      const leeg: Stand = { url, html: "", bladen: [], fout: "" };
      try {
        const res = await fetch(getFileUrl(url), { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();

        if (officeSoort(naam) === "word") {
          const mammoth = await import("mammoth");
          const uit = await mammoth.convertToHtml({ arrayBuffer: data });
          if (gestopt) return;
          setBlad(0);
          setStand({ ...leeg, html: sanitizeEditorHtml(uit.value) });
          return;
        }

        const XLSX = await import("xlsx");
        const boek = XLSX.read(data, { type: "array" });
        const bladen = boek.SheetNames.map((bladnaam) => ({
          naam: bladnaam,
          html: sanitizeEditorHtml(XLSX.utils.sheet_to_html(boek.Sheets[bladnaam])),
        }));
        if (gestopt) return;
        setBlad(0);
        setStand({ ...leeg, bladen });
      } catch (err) {
        if (!gestopt) setStand({ ...leeg, fout: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { gestopt = true; };
  }, [url, naam]);

  if (!stand || stand.url !== url) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  if (stand.fout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-slate-500">{t("y_next.office_preview_failed")}</p>
        <p className="text-xs text-slate-400">{stand.fout}</p>
      </div>
    );
  }

  const bladen = stand.bladen;
  const isBlad = bladen.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Tabbladen van een werkboek; bij één blad heeft een rij tabs geen zin. */}
      {isBlad && bladen.length > 1 && (
        <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-1">
          {bladen.map((b, i) => (
            <button key={b.naam} type="button" onClick={() => setBlad(i)}
              className={`cursor-pointer whitespace-nowrap rounded px-2 py-1 text-xs ${
                i === blad ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500 hover:bg-white/70"
              }`}>
              {b.naam}
            </button>
          ))}
        </div>
      )}
      <div
        className="flex-1 overflow-auto px-5 py-4 text-sm text-slate-800
          [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold
          [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6
          [&_table]:w-max [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1
          [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_img]:max-w-full"
        // De HTML is door `sanitizeEditorHtml` gegaan: geen scripts, geen
        // stijlen, geen verwijzingen naar buiten.
        dangerouslySetInnerHTML={{ __html: isBlad ? (bladen[blad]?.html ?? "") : stand.html }}
      />
      <p className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-400">
        {t("y_next.office_preview_readonly")}
      </p>
    </div>
  );
}
