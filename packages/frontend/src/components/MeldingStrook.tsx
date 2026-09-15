import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Mail, X } from "lucide-react";
import { MELDING_EVENT, type Melding } from "../lib/melding-popup";

/**
 * De melding in het scherm zelf: wie er iets stuurde, en wat.
 *
 * Rechtsonder en niet in het midden: hij onderbreekt niet waar je mee bezig
 * bent. Klik erop en je bent bij het bericht; hij gaat vanzelf weg als je hem
 * laat staan, want een melding die blijft hangen wordt een lijstje dat je moet
 * opruimen.
 */

/** Hoe lang hij blijft staan. Lang genoeg om te lezen wie er iets stuurde. */
const ZICHTBAAR_MS = 8000;

interface Getoond extends Melding {
  id: number;
}

let volgende = 0;

export default function MeldingStrook() {
  const [meldingen, setMeldingen] = useState<Getoond[]>([]);

  const weg = useCallback((id: number) => {
    setMeldingen((vorige) => vorige.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    const opgevangen = (e: Event) => {
      const melding = (e as CustomEvent<Melding>).detail;
      if (!melding?.titel) return;
      const id = ++volgende;
      // Nooit meer dan drie tegelijk: daarboven verbergt de stapel het scherm.
      setMeldingen((vorige) => [...vorige.slice(-2), { ...melding, id }]);
      window.setTimeout(() => weg(id), ZICHTBAAR_MS);
    };
    window.addEventListener(MELDING_EVENT, opgevangen);
    return () => window.removeEventListener(MELDING_EVENT, opgevangen);
  }, [weg]);

  if (meldingen.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex flex-col gap-2">
      {meldingen.map((m) => (
        <button key={m.id} type="button"
          onClick={() => { window.location.hash = m.naar; weg(m.id); }}
          className="pointer-events-auto flex w-[320px] max-w-[85vw] cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-lg transition-colors hover:border-y-teal">
          <span className="mt-0.5 flex-shrink-0 rounded-full bg-y-teal/10 p-1.5 text-y-teal">
            {m.soort === "bericht" ? <MessageSquare size={14} /> : <Mail size={14} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-800">{m.titel}</span>
            <span className="block truncate text-xs text-slate-500">{m.tekst}</span>
          </span>
          <span onClick={(e) => { e.stopPropagation(); weg(m.id); }}
            className="mt-0.5 flex-shrink-0 rounded p-0.5 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </span>
        </button>
      ))}
    </div>
  );
}
