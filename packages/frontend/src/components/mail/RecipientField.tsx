/**
 * Adresveld met contactsuggesties — één component voor Aan, Cc én Bcc.
 *
 * Elk afgerond adres staat als blokje in het veld, met naam en adres en een
 * kruisje om het weg te halen, zoals in een mailprogramma. De waarde blijft
 * wel één tekst: `draft.to/cc/bcc` gaan zo rechtstreeks het verzendpad in.
 * Het opdelen in blokjes en het weer samenvoegen staat in
 * `lib/recipient-field.ts`, met tests — dat is het deel dat stil kapot kan.
 *
 * Een hele lijst plakken (komma of puntkomma) werkt nog steeds: wat af is,
 * wordt meteen een blokje. Dubbelklik op een blokje en het is weer tekst;
 * Backspace in een leeg veld haalt het laatste blokje weg.
 *
 * Bron: `fetchRecipientSuggestions` — contacten (incl. tweede adressen uit
 * `Contact Email`), leads en de lokaal onthouden frequentie. Bij focus zonder
 * tekst verschijnen meteen de recent gebruikte adressen, zodat het veld ook
 * zonder typen iets te bieden heeft.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, User, Sparkles, X } from "lucide-react";
import {
  type RecipientSuggestion,
  fetchRecipientSuggestions, bumpFrequency,
} from "../../lib/contact-suggestions";
import {
  nextSuggestionIndex, isSelectKey, filterCachedSuggestions, sourceLabelKey,
  splitsAdresInvoer, voegAdresInvoerSamen, kiesAdres, zonderBlokje,
  blokjeTerugNaarTekst, rondAdresAf, isBruikbaarAdres,
} from "../../lib/recipient-field";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Voor de lokale frequentie-ranking; meestal `getActiveInstanceId()`. */
  instanceId: string | null;
  label: string;
  placeholder?: string;
  /** Klassen voor het veld: de rand om de blokjes en het invoerveld samen. */
  inputClassName?: string;
  autoFocus?: boolean;
}

/** Zo lang wachten we met de ERPNext-lookup terwijl er nog getypt wordt. */
const DEBOUNCE_MS = 200;

export default function RecipientField({
  value, onChange, instanceId, label, placeholder, inputClassName, autoFocus,
}: Props) {
  const { t } = useTranslation();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const { klaar, bezig } = splitsAdresInvoer(value);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Laatst opgehaalde lijst, voor instant filteren tijdens het typen. */
  const cacheRef = useRef<RecipientSuggestion[]>([]);
  /**
   * Volgnummer per lookup. Een traag antwoord op "ja" mag de lijst van "jans"
   * niet overschrijven — hetzelfde vangnet als de race-guard in de maplijst.
   */
  const seqRef = useRef(0);
  /**
   * Na unmount niets meer in state zetten. Bij het monteren weer op `true`:
   * React's StrictMode monteert in ontwikkeling één keer extra (mount →
   * opruimen → mount), en zonder deze regel bleef de vlag na die eerste
   * opruimbeurt voor altijd `false` — waarna élk opgehaald resultaat stil werd
   * weggegooid en de suggestielijst nooit verscheen.
   */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** Suggesties bij het stuk dat nog getypt wordt. */
  const refresh = useCallback((zoekwoord: string) => {
    const token = zoekwoord.trim();
    const seq = ++seqRef.current;

    // Eerst wat we al hebben — de dropdown mag niet leeg knipperen.
    const instant = filterCachedSuggestions(cacheRef.current, token);
    if (instant.length > 0) {
      setSuggestions(instant);
      setActiveIdx(0);
      setOpen(true);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchRecipientSuggestions(token, { instanceId })
        .then((list) => {
          if (!aliveRef.current || seq !== seqRef.current) return;
          cacheRef.current = list;
          setSuggestions(list);
          setActiveIdx(0);
          setOpen(list.length > 0);
        })
        // `fetchRecipientSuggestions` gooit niet; dit is de vangnet-tak.
        .catch(() => { /* geen suggesties is geen fout — typen werkt door */ });
    }, token ? DEBOUNCE_MS : 0);
  }, [instanceId]);

  const apply = useCallback((s: RecipientSuggestion) => {
    onChange(kiesAdres(value, s.email, s.label));
    bumpFrequency(instanceId, s.email, s.label);
    setOpen(false);
    setSuggestions([]);
    // Het invoerveld houdt de focus, klaar voor het volgende adres.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [instanceId, onChange, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) { e.stopPropagation(); setOpen(false); }
      return;
    }
    if (open && suggestions.length > 0) {
      const moved = nextSuggestionIndex(e.key, activeIdx, suggestions.length);
      if (moved !== null) {
        e.preventDefault();
        setActiveIdx(moved);
        return;
      }
      if (isSelectKey(e.key) && suggestions[activeIdx]) {
        e.preventDefault();
        apply(suggestions[activeIdx]);
        return;
      }
    }
    // Zonder suggestie: Enter en Tab maken van het getypte adres een blokje.
    // Enter blijft in het veld; Tab gaat daarna gewoon door naar het volgende.
    if ((e.key === "Enter" || e.key === "Tab") && bezig.trim()) {
      if (e.key === "Enter") e.preventDefault();
      onChange(rondAdresAf(value));
      setOpen(false);
      return;
    }
    // Backspace in een leeg invoerveld haalt het laatste blokje weg.
    if (e.key === "Backspace" && bezig === "" && klaar.length > 0) {
      e.preventDefault();
      onChange(zonderBlokje(value, klaar.length - 1));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] text-slate-400 flex-shrink-0">{label}</span>
      <div className="relative flex-1 min-w-0">
        <div
          className={`flex flex-wrap items-center gap-1 ${inputClassName ?? ""}`}
          // Klik naast de blokjes zet de cursor in het invoerveld, zoals je
          // van een adresveld verwacht.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          {klaar.map((blokje, i) => {
            const bruikbaar = isBruikbaarAdres(blokje);
            return (
              <span key={`${i}-${blokje}`}
                title={bruikbaar ? t("y_next.mail_recipient_edit_hint") : t("y_next.mail_recipient_invalid")}
                onDoubleClick={() => {
                  onChange(blokjeTerugNaarTekst(value, i));
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                className={`inline-flex max-w-full items-center gap-0.5 rounded border py-px pl-1.5 pr-0.5 text-xs ${
                  bruikbaar
                    ? "border-amber-300 bg-amber-50 text-slate-700"
                    : "border-red-300 bg-red-50 text-red-700"}`}>
                <span className="truncate">{blokje}</span>
                <button type="button" tabIndex={-1}
                  aria-label={t("y_next.mail_recipient_remove", { adres: blokje })}
                  // De focus blijft waar hij was; de klik haalt alleen het blokje weg.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange(zonderBlokje(value, i))}
                  className="flex-shrink-0 cursor-pointer rounded p-px text-slate-400 hover:bg-amber-100 hover:text-slate-700">
                  <X size={11} />
                </button>
              </span>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            value={bezig}
            placeholder={klaar.length === 0 ? placeholder : undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            role="combobox"
            // Het opschrift ernaast is een `span`, geen `label` — zonder dit
            // heeft het veld voor een schermlezer (en voor een test) geen naam.
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-xs focus:outline-none"
            onChange={(e) => {
              // Typ je een komma of puntkomma, dan is het adres ervoor af en
              // wordt het bij de volgende weergave vanzelf een blokje.
              // Meteen opgedeeld en weer samengevoegd, zodat een puntkomma in
              // het concept ook ", " wordt - zo gaat hij het verzendpad in.
              const delen = splitsAdresInvoer(voegAdresInvoerSamen(klaar, e.target.value));
              onChange(voegAdresInvoerSamen(delen.klaar, delen.bezig));
              refresh(delen.bezig);
            }}
            onFocus={() => refresh(bezig)}
            onBlur={() => {
              // Wie het veld verlaat, is klaar met dit adres.
              if (bezig.trim()) onChange(rondAdresAf(value));
              // Kort uitstel: een klik op een suggestie is óók een blur.
              setTimeout(() => { if (aliveRef.current) setOpen(false); }, 150);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        {open && suggestions.length > 0 && (
          <ul id={listId} role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.email} role="option" aria-selected={i === activeIdx}>
                <button type="button"
                  // Geen tab-stop: met het toetsenbord kies je een suggestie
                  // met de pijltjes + Enter/Tab ín het invoerveld. Zonder dit
                  // zou de focus-val van het opstelvenster (`focusableWithin`)
                  // de open lijst als twintig extra stops meetellen.
                  tabIndex={-1}
                  // `onMouseDown` in plaats van `onClick`: de blur van het
                  // invoerveld zou de lijst anders al weg hebben voor de klik.
                  onMouseDown={(e) => { e.preventDefault(); apply(s); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full text-left px-2.5 py-1.5 flex items-center gap-2 cursor-pointer ${i === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                  {s.source === "frequent"
                    ? <Star size={11} className="text-amber-400 flex-shrink-0" />
                    : s.source === "lead"
                      ? <Sparkles size={11} className="text-violet-400 flex-shrink-0" />
                      : <User size={11} className="text-slate-300 flex-shrink-0" />}
                  <span className="text-xs font-medium text-slate-700 truncate">{s.label || s.email}</span>
                  {s.label && s.label !== s.email && (
                    <span className="text-[11px] text-slate-400 truncate">{s.email}</span>
                  )}
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-300 flex-shrink-0">
                    {t(sourceLabelKey(s.source))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
