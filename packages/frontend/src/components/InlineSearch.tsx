import { useState, useEffect, useRef, useCallback } from "react";
import { fetchList } from "../lib/erpnext";
import {
  Search, X, FileText, ShoppingCart, FileBarChart,
  ClipboardCheck, FolderKanban, CheckSquare, Users, Loader2,
  CalendarCheck,
} from "lucide-react";
import type { Page } from "./Sidebar";
import { useTranslation } from "react-i18next";

interface SearchResult {
  doctype: string;
  name: string;
  label: string;
  description: string;
  page: Page;
  icon: typeof FileText;
}

interface InlineSearchProps {
  onNavigate: (page: Page) => void;
  onCloseMobile?: () => void;
}

const searchTargets: {
  doctype: string;
  page: Page;
  icon: typeof FileText;
  labelField: string;
  descField: string;
  labelKey: string;
}[] = [
  { doctype: "Sales Invoice", page: "sales", icon: FileText, labelField: "name", descField: "customer_name", labelKey: "search.sales_invoice" },
  { doctype: "Purchase Invoice", page: "purchase", icon: ShoppingCart, labelField: "name", descField: "supplier_name", labelKey: "search.purchase_invoice" },
  { doctype: "Quotation", page: "quotations", icon: FileBarChart, labelField: "name", descField: "party_name", labelKey: "search.quotation" },
  { doctype: "Sales Order", page: "salesorders", icon: ClipboardCheck, labelField: "name", descField: "customer_name", labelKey: "search.sales_order" },
  { doctype: "Project", page: "projects", icon: FolderKanban, labelField: "name", descField: "project_name", labelKey: "search.project" },
  { doctype: "Task", page: "tasks", icon: CheckSquare, labelField: "name", descField: "subject", labelKey: "search.task" },
  { doctype: "Employee", page: "employees", icon: Users, labelField: "name", descField: "employee_name", labelKey: "search.employee" },
  { doctype: "Leave Application", page: "leave", icon: CalendarCheck, labelField: "name", descField: "employee_name", labelKey: "search.leave_application" },
];

export default function InlineSearch({ onNavigate, onCloseMobile }: InlineSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Listen for Ctrl+K focus event
  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    window.addEventListener("y-app:focus-search", handler);
    return () => window.removeEventListener("y-app:focus-search", handler);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const promises = searchTargets.map(async (target) => {
        try {
          const byName = await fetchList<Record<string, string>>(target.doctype, {
            fields: [target.labelField, target.descField],
            filters: [[target.labelField, "like", `%${q}%`]],
            limit_page_length: 5,
          });
          const byDesc = await fetchList<Record<string, string>>(target.doctype, {
            fields: [target.labelField, target.descField],
            filters: [[target.descField, "like", `%${q}%`]],
            limit_page_length: 5,
          });
          const seen = new Set<string>();
          const merged: SearchResult[] = [];
          for (const item of [...byName, ...byDesc]) {
            const name = item[target.labelField];
            if (seen.has(name)) continue;
            seen.add(name);
            merged.push({
              doctype: t(target.labelKey),
              name,
              label: name,
              description: item[target.descField] || "",
              page: target.page,
              icon: target.icon,
            });
          }
          return merged;
        } catch {
          return [];
        }
      });
      const allResults = (await Promise.all(promises)).flat();
      setResults(allResults.slice(0, 30));
      setSelectedIndex(0);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length >= 2) {
      timerRef.current = setTimeout(() => doSearch(query), 300);
    } else {
      setResults([]);
    }
    return () => clearTimeout(timerRef.current);
  }, [query, doSearch]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setDropdownOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      onNavigate(results[selectedIndex].page);
      setDropdownOpen(false);
      setQuery("");
      if (onCloseMobile) onCloseMobile();
    }
  }

  function handleSelect(result: SearchResult) {
    onNavigate(result.page);
    setDropdownOpen(false);
    setQuery("");
    if (onCloseMobile) onCloseMobile();
  }

  // Group results by doctype
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.doctype]) acc[r.doctype] = [];
    acc[r.doctype].push(r);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-y-teal-light/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
          onFocus={() => { if (query.length >= 2) setDropdownOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-y-purple text-white text-sm placeholder:text-y-teal-light/40 focus:outline-none focus:ring-2 focus:ring-y-teal/50 border-none"
        />
        {loading && <Loader2 size={14} className="absolute right-8 top-1/2 -translate-y-1/2 text-y-teal-light/40 animate-spin" />}
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setDropdownOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-y-teal-light/40 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {dropdownOpen && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-2xl border border-slate-200 max-h-[60vh] overflow-y-auto z-50">
          {!loading && results.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-400 text-sm">
              {t("search.no_results")} "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([doctype, items]) => (
              <div key={doctype}>
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide sticky top-0">
                  {doctype}
                </div>
                {items.map((result) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const Icon = result.icon;
                  return (
                    <button
                      key={`${result.doctype}-${result.name}`}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                        idx === selectedIndex ? "bg-y-teal/10" : "hover:bg-slate-50"
                      }`}
                    >
                      <Icon size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{result.label}</p>
                        {result.description && (
                          <p className="text-[10px] text-slate-500 truncate">{result.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
