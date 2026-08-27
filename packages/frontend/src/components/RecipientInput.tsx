import { useRef, useState, type KeyboardEvent } from "react";
import {
  type RecipientSuggestion,
  loadFrequencyMap, bumpFrequency,
  getCurrentToken, replaceCurrentToken,
  fetchCustomerContactSuggestions, mergeAndRankSuggestions, topRecentFromFrequency,
} from "../lib/contact-suggestions";

interface Props {
  value: string;
  onChange: (value: string) => void;
  instanceId: string | null;
  placeholder?: string;
  className?: string;
  id?: string;
}

/**
 * Tekstveld met contact-suggesties (ERPNext-contacten + lokale frequentie),
 * dezelfde bron + ranking als de mail-compose (lib/contact-suggestions.ts).
 * Ondersteunt meerdere adressen (komma/puntkomma) + toetsenbordnavigatie.
 * Gebruikt o.a. in het agenda-uitnodig-veld zodat dat dezelfde suggesties geeft.
 */
export function RecipientInput({ value, onChange, instanceId, placeholder, className, id }: Props) {
  const [suggestions, setSuggestions] = useState<RecipientSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContactsRef = useRef<RecipientSuggestion[]>([]);

  function refresh(val: string, caret: number) {
    const { token } = getCurrentToken(val, caret);
    const freqMap = loadFrequencyMap(instanceId);
    const q = token.trim();
    if (q.length === 0) {
      const recent = topRecentFromFrequency(freqMap);
      setSuggestions(recent);
      setActiveIdx(0);
      setOpen(recent.length > 0);
      return;
    }
    // Direct mergen uit eerder opgehaalde contacten + frequentie (instant),
    // daarna async een ERPNext-lookup die de lijst aanvult.
    const lq = q.toLowerCase();
    const cached = lastContactsRef.current.filter(
      (c) => c.email.toLowerCase().includes(lq) || c.label.toLowerCase().includes(lq),
    );
    setSuggestions(mergeAndRankSuggestions(q, cached, freqMap));
    setActiveIdx(0);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCustomerContactSuggestions(q)
        .then((customer) => {
          lastContactsRef.current = customer;
          const merged = mergeAndRankSuggestions(q, customer, freqMap);
          setSuggestions(merged);
          setActiveIdx(0);
          setOpen(merged.length > 0);
        })
        .catch(() => { /* lookup-fout = stil, instant-resultaat blijft staan */ });
    }, 200);
  }

  function apply(s: RecipientSuggestion) {
    const caret = inputRef.current?.selectionStart ?? value.length;
    const { next } = replaceCurrentToken(value, caret, s.email);
    onChange(next);
    bumpFrequency(instanceId, s.email, s.label);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[activeIdx]) {
        e.preventDefault();
        apply(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onFocus={(e) => refresh(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg text-sm">
          {suggestions.map((s, i) => (
            <li key={s.email}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); apply(s); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left px-3 py-1.5 cursor-pointer flex items-center gap-2 ${i === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                {s.source === "frequent" && <span className="text-amber-400 flex-shrink-0">★</span>}
                <span className="font-medium text-slate-700 truncate">{s.label || s.email}</span>
                {s.label && s.label !== s.email && (
                  <span className="text-slate-400 truncate">{s.email}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
