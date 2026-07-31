import { useState, useEffect, useRef } from "react";
import { Search, Package, Loader2 } from "lucide-react";
import { fetchList } from "../lib/erpnext";
import { useTranslation } from "react-i18next";

export interface QuotationItem {
  item_code: string;
  item_name: string;
  description: string;
  qty: number;
  rate: number;
  uom: string;
  amount: number;
}

interface ERPItem {
  name: string;
  item_name: string;
  description: string;
  standard_rate: number;
  stock_uom: string;
}

interface ItemPriceRecord {
  item_code: string;
  price_list_rate: number;
  uom?: string;
}

interface Props {
  onAdd: (item: QuotationItem) => void;
}

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() || "";
}

export default function ItemSearchSelect({ onAdd }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ERPItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await fetchList<ERPItem>("Item", {
          fields: ["name", "item_name", "description", "standard_rate", "stock_uom"],
          filters: [
            ["item_name", "like", `%${query}%`],
            ["disabled", "=", 0],
          ],
          limit_page_length: 20,
          order_by: "item_name asc",
        });
        // Fallback voor het tarief: veel Items hebben standard_rate=0 omdat
        // de prijs in een Item Price record (Standard Selling) zit, gekoppeld
        // aan een UOM. ERPNext's pricing-waterfall = Item Price → Activity
        // Type → standard_rate; we voegen die eerste laag hier toe zodat de
        // gebruiker direct het juiste tarief ziet in de zoek-dropdown én bij
        // het toevoegen aan de factuur.
        let enriched = list;
        if (list.length > 0) {
          try {
            const codes = list.map((r) => r.name);
            const prices = await fetchList<ItemPriceRecord>("Item Price", {
              fields: ["item_code", "price_list_rate", "uom"],
              filters: [
                ["item_code", "in", codes],
                ["selling", "=", 1],
              ],
              limit_page_length: 200,
            });
            enriched = list.map((it) => {
              if (it.standard_rate > 0) return it;
              const matches = prices.filter((p) => p.item_code === it.name && p.price_list_rate > 0);
              if (matches.length === 0) return it;
              // Match-voorkeur: zelfde UOM als Item.stock_uom (zie
              // erpnext-pricing-uom-match memory). Anders eerste hit.
              const exact = matches.find((p) => p.uom === it.stock_uom);
              const chosen = exact || matches[0];
              return { ...it, standard_rate: chosen.price_list_rate };
            });
          } catch {
            // Item Price fetch is best-effort — bij fout valt de UI terug
            // op de originele standard_rate zonder hard te falen.
          }
        }
        setResults(enriched);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSelect(item: ERPItem) {
    onAdd({
      item_code: item.name,
      item_name: item.item_name,
      description: stripHtml(item.description || ""),
      qty: 1,
      rate: item.standard_rate || 0,
      uom: item.stock_uom || "Nos",
      amount: item.standard_rate || 0,
    });
    setQuery("");
    setResults([]);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={t("quotation_create.search_item")}
          className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
          {results.map((item) => {
            const desc = stripHtml(item.description || "");
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <Package size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.item_name}</p>
                      <span className="text-xs font-semibold text-y-teal flex-shrink-0">
                        {(item.standard_rate || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400">{item.name}</p>
                    {desc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{desc}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && query.length >= 2 && !loading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 px-3 py-4 text-center text-sm text-slate-400">
          {t("quotation_create.no_items_found")}
        </div>
      )}
    </div>
  );
}
