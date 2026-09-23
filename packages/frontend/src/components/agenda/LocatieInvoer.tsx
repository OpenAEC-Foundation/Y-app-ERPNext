import { useEffect, useRef, useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { adresRegel, locatieTekst, zoekLocaties, type LocatieAdres } from "../../lib/agenda-locaties";

/**
 * Locatieveld voor een afspraak dat meezoekt in de bedrijfsadressen van
 * ERPNext. Vrije tekst ("Teams", "Online") blijft gewoon mogelijk: de lijst
 * is een hulp, geen verplichting.
 */
export default function LocatieInvoer({
  value, onChange, placeholder, className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [lijst, setLijst] = useState<LocatieAdres[]>([]);
  const [actief, setActief] = useState(-1);
  const [zoekterm, setZoekterm] = useState<string | null>(null);
  const volgnr = useRef(0);

  // Zoeken met een korte pauze na het typen; een laat antwoord overschrijft geen nieuwer.
  useEffect(() => {
    if (zoekterm === null) return;
    const nr = ++volgnr.current;
    const timer = window.setTimeout(() => {
      void zoekLocaties(zoekterm).then((r) => {
        if (nr !== volgnr.current) return;
        setLijst(r);
        setActief(-1);
        setOpen(r.length > 0);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [zoekterm]);

  function kies(a: LocatieAdres) {
    onChange(locatieTekst(a));
    setOpen(false);
    setZoekterm(null);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setZoekterm(e.target.value); }}
        onFocus={() => setZoekterm(value)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || lijst.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActief((i) => (i + 1) % lijst.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActief((i) => (i <= 0 ? lijst.length - 1 : i - 1)); }
          else if (e.key === "Enter" && actief >= 0) { e.preventDefault(); kies(lijst[actief]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {open && lijst.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
          {lijst.map((a, i) => (
            <li key={a.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => kies(a)}
                className={`w-full flex items-start gap-2 px-3 py-1.5 text-left cursor-pointer ${i === actief ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                {a.eigen
                  ? <Building2 size={13} className="mt-0.5 flex-shrink-0 text-blue-600" />
                  : <MapPin size={13} className="mt-0.5 flex-shrink-0 text-slate-400" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{a.titel || adresRegel(a)}</span>
                  {a.titel && <span className="block truncate text-xs text-slate-500">{adresRegel(a)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
