import { useState, useEffect, useRef } from "react";
import { Search, X, User, Loader2, Plus, Check } from "lucide-react";
import { fetchList, createDocument } from "../lib/erpnext";
import { useTranslation } from "react-i18next";

export interface Customer {
  name: string;
  customer_name: string;
  email_id?: string;
}

interface Props {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  /** Accepted for API compatibility — Customer is global in ERPNext (no
   *  company field), so this is ignored. Kept so callers don't have to
   *  change. */
  company?: string;
}

export default function CustomerSearchSelect({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
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
        // NB: ERPNext's Customer doctype has no `company` field — it is a
        // global entity (a single customer can do business with multiple
        // companies). An earlier version filtered on company and silently
        // returned 0 rows for names that DID exist (e.g. "Ribouw").
        // Search across both `name` (the document ID / customer code) and
        // `customer_name` (the display name) via or_filters so codes and
        // names both match.
        const list = await fetchList<Customer>("Customer", {
          fields: ["name", "customer_name", "email_id"],
          filters: [["disabled", "=", 0]],
          or_filters: [
            ["customer_name", "like", `%${query}%`],
            ["name", "like", `%${query}%`],
          ],
          limit_page_length: 20,
          order_by: "customer_name asc",
        });
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  async function handleCreateCustomer() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const doc = await createDocument<Customer>("Customer", {
        customer_name: newName.trim(),
        customer_type: "Company",
        email_id: newEmail.trim() || undefined,
      });
      onChange({
        name: doc.name,
        customer_name: newName.trim(),
        email_id: newEmail.trim() || undefined,
      });
      setShowCreate(false);
      setOpen(false);
      setQuery("");
      setNewName("");
      setNewEmail("");
    } catch (err) {
      setCreateError((err as Error).message || t("quotation_create.create_customer_error"));
    } finally {
      setCreating(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
        <User size={16} className="text-y-teal flex-shrink-0" />
        <span className="text-sm font-medium text-slate-700 flex-1">{value.customer_name}</span>
        {value.email_id && <span className="text-xs text-slate-400">{value.email_id}</span>}
        <button onClick={() => { onChange(null); setQuery(""); }} className="p-0.5 text-slate-400 hover:text-red-500 cursor-pointer">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setShowCreate(false); }}
          onFocus={() => { if (results.length > 0 || query.length >= 2) setOpen(true); }}
          placeholder={t("quotation_create.search_customer")}
          className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
      </div>

      {/* Search results dropdown */}
      {open && !showCreate && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
          {/* New customer button — always visible */}
          <button
            type="button"
            onClick={() => { setShowCreate(true); setNewName(query); }}
            className="w-full text-left px-3 py-2.5 hover:bg-y-teal/5 cursor-pointer flex items-center gap-2 border-b border-slate-100 text-y-teal"
          >
            <Plus size={14} className="flex-shrink-0" />
            <span className="text-sm font-medium">{t("quotation_create.new_customer")}</span>
            {query.length >= 2 && (
              <span className="text-xs text-slate-400 ml-1">"{query}"</span>
            )}
          </button>

          {results.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
            >
              <User size={14} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate">{c.customer_name}</p>
                {c.email_id && <p className="text-xs text-slate-400 truncate">{c.email_id}</p>}
              </div>
            </button>
          ))}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-3 py-3 text-center text-xs text-slate-400">
              {t("quotation_create.no_customers_found")}
            </div>
          )}
        </div>
      )}

      {/* Inline create customer form */}
      {showCreate && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Plus size={16} className="text-y-teal" />
            <h4 className="text-sm font-semibold text-slate-700">{t("quotation_create.new_customer")}</h4>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.customer_name")}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("quotation_create.customer_name_placeholder")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) handleCreateCustomer(); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.customer_email")}</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("quotation_create.customer_email_placeholder")}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) handleCreateCustomer(); }}
            />
          </div>
          {createError && (
            <p className="text-xs text-red-600">{createError}</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError(""); }}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={!newName.trim() || creating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {t("quotation_create.create_customer_btn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
