import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Shield, Search, Plus, Trash2, Edit, Eye, EyeOff, Copy,
  RefreshCw, Key, Lock, Download, Upload, X, Check, FolderOpen,
} from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  category: string;
  notes?: string;
  created: string;
  modified: string;
}

type SortField = "title" | "username" | "category" | "modified";
type SortDir = "asc" | "desc";

/* ─── Default categories ─── */

const DEFAULT_CATEGORIES = [
  "Alle",
  "E-mail",
  "Websites",
  "Servers",
  "API Keys",
  "Databases",
  "Overig",
];

const DEFAULT_CATEGORY_KEYS: Record<string, string> = {
  "Alle": "passwords.category_all",
  "E-mail": "passwords.category_email",
  "Websites": "passwords.category_websites",
  "Servers": "passwords.category_servers",
  "API Keys": "passwords.category_api_keys",
  "Databases": "passwords.category_databases",
  "Overig": "passwords.category_other",
};

function loadCategories(): string[] {
  try {
    const stored = localStorage.getItem("password_categories");
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES;
}

function saveCategories(cats: string[]) {
  localStorage.setItem("password_categories", JSON.stringify(cats));
}

/* ─── Password generator ─── */

function generatePassword(
  length: number,
  upper: boolean,
  lower: boolean,
  numbers: boolean,
  symbols: boolean,
): string {
  let chars = "";
  if (upper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (lower) chars += "abcdefghijklmnopqrstuvwxyz";
  if (numbers) chars += "0123456789";
  if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:',.<>?/~`";
  if (!chars) chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => chars[v % chars.length]).join("");
}

function uuid(): string {
  return crypto.randomUUID();
}

/* ─── Toast component ─── */

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <Check size={16} className="text-emerald-400" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/* ─── Main component ─── */

export default function Passwords() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState(loadCategories);
  const [activeCategory, setActiveCategory] = useState("Alle");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<PasswordEntry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Fetch ─── */

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/passwords");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntries(json.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  /* ─── Filter & sort ─── */

  const filtered = useMemo(() => {
    let list = entries;
    if (activeCategory !== "Alle") {
      list = list.filter((e) => e.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          (e.url || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = (a[sortField] || "").toLowerCase();
      const bv = (b[sortField] || "").toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return list;
  }, [entries, activeCategory, search, sortField, sortDir]);

  /* ─── Category counts ─── */

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Alle: entries.length };
    for (const e of entries) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, [entries]);

  /* ─── CRUD ─── */

  async function saveEntry(entry: PasswordEntry) {
    try {
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchEntries();
      setShowModal(false);
      setEditEntry(null);
      setToast(t("passwords.saved"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteEntry(id: string) {
    try {
      const res = await fetch(`/api/passwords/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchEntries();
      setDeleteId(null);
      setToast(t("passwords.deleted"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /* ─── Import / Export ─── */

  async function handleExport() {
    try {
      const res = await fetch("/api/passwords/export", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wachtwoorden-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(t("passwords.exported"));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as PasswordEntry[];
      if (!Array.isArray(data)) throw new Error(t("passwords.invalid_file_format"));
      const res = await fetch("/api/passwords/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: data }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchEntries();
      setToast(t("passwords.imported_count", { count: data.length }));
    } catch (err) {
      setError((err as Error).message);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ─── Clipboard ─── */

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setToast(t("passwords.copied"));
  }

  /* ─── Sort toggle ─── */

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  /* ─── Add category ─── */

  function addCategory() {
    const name = newCat.trim();
    if (!name || categories.includes(name)) return;
    const updated = [...categories, name];
    setCategories(updated);
    saveCategories(updated);
    setNewCat("");
    setShowNewCat(false);
  }

  function removeCategory(cat: string) {
    if (DEFAULT_CATEGORIES.includes(cat)) return;
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    saveCategories(updated);
    if (activeCategory === cat) setActiveCategory("Alle");
  }

  /* ─── Filtered categories for sidebar ─── */

  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, catSearch]);

  /* ─── Render ─── */

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left sidebar — categories */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">{t("passwords.title")}</h2>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("passwords.search_category")}
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors group ${
                activeCategory === cat
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen size={14} />
                <span>{DEFAULT_CATEGORY_KEYS[cat] ? t(DEFAULT_CATEGORY_KEYS[cat]) : cat}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400">{categoryCounts[cat] || 0}</span>
                {!DEFAULT_CATEGORIES.includes(cat) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCategory(cat); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5"
                    title={t("passwords.delete_category")}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </button>
          ))}

          {showNewCat ? (
            <div className="flex items-center gap-1 px-2 mt-1">
              <input
                autoFocus
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                placeholder={t("passwords.name_placeholder")}
                className="flex-1 text-sm px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={addCategory} className="text-blue-600 hover:text-blue-800 p-1">
                <Check size={14} />
              </button>
              <button onClick={() => setShowNewCat(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCat(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-50 mt-1"
            >
              <Plus size={14} />
              <span>{t("passwords.add_category")}</span>
            </button>
          )}
        </div>

        {/* Import/Export */}
        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            <Download size={14} />
            <span>{t("passwords.export")}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg"
          >
            <Upload size={14} />
            <span>{t("passwords.import")}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Right panel — entries list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("passwords.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchEntries}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
            title={t("common.refresh")}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              setEditEntry({
                id: uuid(),
                title: "",
                username: "",
                password: "",
                url: "",
                category: activeCategory === "Alle" ? "Overig" : activeCategory,
                notes: "",
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            {t("passwords.new_password_btn")}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" />
              {t("common.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Key size={40} className="mb-3 text-slate-300" />
              <p className="text-lg font-medium">{t("passwords.no_passwords")}</p>
              <p className="text-sm mt-1">{t("passwords.no_passwords_hint")}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {(
                      [
                        ["title", t("passwords.col_title")],
                        ["username", t("passwords.username")],
                        ["category", t("passwords.col_category")],
                        ["modified", t("passwords.col_modified")],
                      ] as [SortField, string][]
                    ).map(([field, label]) => (
                      <th
                        key={field}
                        onClick={() => toggleSort(field)}
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                      >
                        {label}
                        {sortField === field && (
                          <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
                        )}
                      </th>
                    ))}
                    <th className="w-32 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {t("passwords.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((entry) => (
                    <PasswordRow
                      key={entry.id}
                      entry={entry}
                      onEdit={() => { setEditEntry({ ...entry }); setShowModal(true); }}
                      onDelete={() => setDeleteId(entry.id)}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-400">
            {t("passwords.count_of_total", { count: filtered.length, total: entries.length })}
          </div>
        </div>
      </div>

      {/* Modal: Add/Edit */}
      {showModal && editEntry && (
        <EntryModal
          entry={editEntry}
          categories={categories.filter((c) => c !== "Alle")}
          onSave={saveEntry}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
          onCopy={copyToClipboard}
        />
      )}

      {/* Modal: Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">{t("common.delete_tooltip")}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              {t("passwords.delete_confirm_msg")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => deleteEntry(deleteId)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t("common.delete_tooltip")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

/* ─── Table row ─── */

function PasswordRow({
  entry,
  onEdit,
  onDelete,
  onCopy,
}: {
  entry: PasswordEntry;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [showPw, setShowPw] = useState(false);

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-blue-500 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-slate-800">{entry.title}</div>
            {entry.url && (
              <a
                href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                {entry.url}
              </a>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-600">{entry.username}</span>
          {entry.username && (
            <button
              onClick={() => onCopy(entry.username)}
              className="text-slate-300 hover:text-blue-500 p-0.5"
              title={t("passwords.copy_username")}
            >
              <Copy size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-slate-400 font-mono">
            {showPw ? entry.password : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
          </span>
          <button
            onClick={() => setShowPw(!showPw)}
            className="text-slate-300 hover:text-slate-500 p-0.5"
            title={showPw ? t("passwords.hide") : t("passwords.show")}
          >
            {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={() => onCopy(entry.password)}
            className="text-slate-300 hover:text-blue-500 p-0.5"
            title={t("passwords.copy_password")}
          >
            <Copy size={12} />
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
          {DEFAULT_CATEGORY_KEYS[entry.category] ? t(DEFAULT_CATEGORY_KEYS[entry.category]) : entry.category}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {new Date(entry.modified).toLocaleDateString("nl-NL")}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            title={t("common.edit")}
          >
            <Edit size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title={t("common.delete_tooltip")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Entry Modal ─── */

function EntryModal({
  entry,
  categories,
  onSave,
  onClose,
  onCopy,
}: {
  entry: PasswordEntry;
  categories: string[];
  onSave: (e: PasswordEntry) => void;
  onClose: () => void;
  onCopy: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PasswordEntry>(entry);
  const [showPw, setShowPw] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);

  const isNew = entry.title === "";

  function handleGenerate() {
    const pw = generatePassword(genLength, genUpper, genLower, genNumbers, genSymbols);
    setForm((f) => ({ ...f, password: pw }));
    setShowPw(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-800">
              {isNew ? t("passwords.new_password") : t("common.edit")}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("instance_bar.feedback_title_label")}</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t("passwords.title_placeholder")}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("settings.imap_username")}</label>
            <div className="flex gap-1">
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t("passwords.username_placeholder")}
              />
              {form.username && (
                <button
                  type="button"
                  onClick={() => onCopy(form.username)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  title={t("passwords.copy")}
                >
                  <Copy size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("login.password_label")}</label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => onCopy(form.password)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                title={t("passwords.copy")}
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowGen(!showGen)}
                className={`p-2 rounded-lg ${showGen ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
                title={t("passwords.generate_tooltip")}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Generator */}
            {showGen && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-600 w-16">{t("passwords.length")}</label>
                  <input
                    type="range"
                    min={8}
                    max={64}
                    value={genLength}
                    onChange={(e) => setGenLength(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-slate-500 w-6 text-right">{genLength}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {([
                    ["passwords.uppercase", genUpper, setGenUpper] as const,
                    ["passwords.lowercase", genLower, setGenLower] as const,
                    ["passwords.numbers", genNumbers, setGenNumbers] as const,
                    ["passwords.symbols", genSymbols, setGenSymbols] as const,
                  ]).map(([labelKey, val, setter]) => (
                    <label key={labelKey} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) => setter(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      {t(labelKey)}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="w-full py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  {t("passwords.generate")}
                </button>
              </div>
            )}
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <input
              value={form.url || ""}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("passwords.category")}</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{DEFAULT_CATEGORY_KEYS[cat] ? t(DEFAULT_CATEGORY_KEYS[cat]) : cat}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t("passwords.notes")}</label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={t("passwords.notes_placeholder")}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
