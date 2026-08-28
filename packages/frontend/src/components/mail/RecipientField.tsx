/**
 * Adresveld met contactsuggesties — één component voor Aan, Cc én Bcc.
 *
 * Blijft bewust een gewoon tekstveld: `draft.to/cc/bcc` zijn strings die
 * rechtstreeks het verzendpad in gaan, en chips zouden daar een parse-laag
 * tussen zetten die alleen maar kapot kan. Meerdere adressen (komma of
 * puntkomma) en het plakken van een hele lijst werken dus onveranderd; de
 * suggesties vervangen alleen het adres onder de cursor.
 *
 * Bron: `fetchRecipientSuggestions` — contacten (incl. tweede adressen uit
 * `Contact Email`), leads en de lokaal onthouden frequentie. Bij focus zonder
 * tekst verschijnen meteen de recent gebruikte adressen, zodat het veld ook
 * zonder typen iets te bieden heeft.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star, User, Sparkles } from "lucide-react";
import {
  type RecipientSuggestion,
  fetchRecipientSuggestions, bumpFrequency,
} from "../../lib/contact-suggestions";
import {
  nextSuggestionIndex, isSelectKey, applyRecipientSuggestion,
  filterCachedSuggestions, sourceLabelKey, tokenAt,
} from "../../lib/recipient-field";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Voor de lokale frequentie-ranking; meestal `getActiveInstanceId()`. */
  instanceId: string | null;
  label: string;
  placeholder?: string;
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

  const refresh = useCallback((val: string, caret: number) => {
    const token = tokenAt(val, caret).trim();
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
    const input = inputRef.current;
    const caret = input?.selectionStart ?? value.length;
    const { next, newCaret } = applyRecipientSuggestion(value, caret, s.email);
    onChange(next);
    bumpFrequency(instanceId, s.email, s.label);
    setOpen(false);
    setSuggestions([]);
    // De cursor hoort achter het zojuist ingevulde adres te staan, klaar voor
    // het volgende — zonder dit springt hij naar het einde van de hele string.
    requestAnimationFrame(() => {
      if (input && document.activeElement === input) input.setSelectionRange(newCaret, newCaret);
    });
  }, [instanceId, onChange, value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) { e.stopPropagation(); setOpen(false); }
      return;
    }
    if (!open || suggestions.length === 0) return;
    const moved = nextSuggestionIndex(e.key, activeIdx, suggestions.length);
    if (moved !== null) {
      e.preventDefault();
      setActiveIdx(moved);
      return;
    }
    if (isSelectKey(e.key) && suggestions[activeIdx]) {
      e.preventDefault();
      apply(suggestions[activeIdx]);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] text-slate-400 flex-shrink-0">{label}</span>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          // Het opschrift ernaast is een `span`, geen `label` — zonder dit
          // heeft het veld voor een schermlezer (en voor een test) geen naam.
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={inputClassName}
          onChange={(e) => {
            onChange(e.target.value);
            refresh(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onFocus={(e) => refresh(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          // Kort uitstel: een klik op een suggestie is óók een blur.
          onBlur={() => setTimeout(() => { if (aliveRef.current) setOpen(false); }, 150)}
          onKeyDown={handleKeyDown}
        />
        {open && suggestions.length > 0 && (
          <ul id={listId} role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {suggestions.map((s, i) => (
              <li key={s.email} role="option" aria-selected={i === activeIdx}>
                <button type="button"
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
