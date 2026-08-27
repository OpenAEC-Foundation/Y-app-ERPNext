import { useState, useEffect } from "react";
import { Plus, Trash2, ExternalLink, Loader2, XCircle, CheckCircle2, RefreshCw, Server, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { APP_NAME, APP_VERSION } from "../lib/version";

interface Instance {
  id: number;
  name: string;
  url: string;
  themeColor: string | null;
  createdAt: number;
  hasCredentials: boolean;
  lastUsedAt: number | null;
  frappe_major_version?: number;
  version_detected_at?: number | null;
  version_override?: number | null;
}

interface InstancesPageProps {
  user: { id: number; email: string };
  onLogout: () => void;
  onOpenInstance?: (inst: { id: number; name: string; url: string; themeColor: string | null }) => void;
  onInstanceDeleted?: (id: number) => void;
}

const DEFAULT_COLORS = ["#14b8a6", "#0ea5e9", "#8b5cf6", "#ec4899", "#f97316", "#84cc16", "#06b6d4", "#a855f7"];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function InstancesPage({ user: _user, onLogout, onOpenInstance, onInstanceDeleted }: InstancesPageProps) {
  const { t } = useTranslation();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  async function loadInstances() {
    setLoading(true);
    try {
      const res = await fetch("/api/instances", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances || []);
      } else if (res.status === 401) {
        onLogout();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInstances(); }, []);

  async function handleDelete(id: number, name: string) {
    if (!confirm(t("instances.confirm_delete", { defaultValue: `Delete instance "${name}"? Stored credentials will be permanently lost.`, name }))) return;
    try {
      const res = await fetch(`/api/instances/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) {
        setInstances((curr) => curr.filter((i) => i.id !== id));
        onInstanceDeleted?.(id);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header (slim — global controls live in InstanceTabBar above) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d9488, #14b8a6)" }}>
            <span className="text-white font-extrabold text-base">Y</span>
          </div>
          <h1 className="text-base font-bold text-slate-800 flex-1">{APP_NAME}</h1>
          <button
            onClick={() => loadInstances()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title={t("instances.refresh", { defaultValue: "Refresh" })}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t("instances.title", { defaultValue: "Your ERPNext instances" })}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("instances.subtitle", { defaultValue: "Connect and manage multiple ERPNext deployments from one account" })}</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-y-teal hover:bg-y-teal-dark text-white text-sm font-medium rounded-lg cursor-pointer transition-colors"
          >
            <Plus size={16} />
            {t("instances.add", { defaultValue: "Add instance" })}
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Loader2 size={24} className="mx-auto text-slate-300 animate-spin mb-3" />
            <p className="text-sm text-slate-500">{t("instances.loading", { defaultValue: "Loading instances..." })}</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Server size={32} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">{t("instances.empty_title", { defaultValue: "Welcome to Y-app" })}</h3>
            <p className="text-sm text-slate-500 mb-6">{t("instances.empty_subtitle", { defaultValue: "Connect your first ERPNext instance to get started" })}</p>

            <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-amber-900 mb-2">
                {t("instances.onboarding_heading", { defaultValue: "Coming from the previous Y-app version?" })}
              </p>
              <ul className="text-[11px] text-amber-800 space-y-1.5">
                <li>
                  • {t("instances.onboarding_point_1", { defaultValue: "Your Y-app account password is the one you just signed up with — it is NOT your ERPNext password." })}
                </li>
                <li>
                  • {t("instances.onboarding_point_2", { defaultValue: "On the next screen you will enter your ERPNext URL plus your existing ERPNext username and password." })}
                </li>
                <li>
                  • {t("instances.onboarding_point_3", { defaultValue: "Y-app encrypts those credentials with your account password and stores them server-side, so you only type them once." })}
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-y-teal hover:bg-y-teal-dark text-white text-sm font-medium rounded-lg cursor-pointer transition-colors"
            >
              <Plus size={16} />
              {t("instances.add_first", { defaultValue: "Add your first instance" })}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((inst) => (
              <div
                key={inst.id}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="h-1.5" style={{ backgroundColor: inst.themeColor || "#14b8a6" }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-800 truncate">{inst.name}</h3>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => setEditingInstance(inst)}
                        className="p-1 text-slate-400 hover:text-y-teal hover:bg-y-teal/10 rounded cursor-pointer"
                        title={t("instances.edit", { defaultValue: "Edit" })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(inst.id, inst.name)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded cursor-pointer"
                        title={t("instances.delete", { defaultValue: "Delete" })}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    <ExternalLink size={11} /> {inst.url}
                  </p>
                  {(inst.frappe_major_version || inst.version_override) && (
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">
                        Frappe v{inst.version_override ?? inst.frappe_major_version}
                      </span>
                      {inst.version_override && <span className="text-amber-600">override</span>}
                    </p>
                  )}
                  {inst.lastUsedAt && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      {t("instances.last_used", { defaultValue: "Last used" })}: {new Date(inst.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                  <button
                    className="mt-4 w-full px-3 py-2 bg-slate-50 hover:bg-y-teal/10 text-sm font-medium text-slate-700 hover:text-y-teal rounded-lg cursor-pointer transition-colors"
                    onClick={() => onOpenInstance?.({ id: inst.id, name: inst.name, url: inst.url, themeColor: inst.themeColor })}
                  >
                    {t("instances.open", { defaultValue: "Open" })} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddInstanceModal
          onClose={() => setShowAddModal(false)}
          onAdded={(inst) => {
            setInstances((curr) => [...curr, { ...inst, hasCredentials: true, lastUsedAt: null }]);
            setShowAddModal(false);
          }}
        />
      )}

      {editingInstance && (
        <EditInstanceModal
          instance={editingInstance}
          onClose={() => setEditingInstance(null)}
          onSaved={(updated) => {
            setInstances((curr) => curr.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
            setEditingInstance(null);
          }}
        />
      )}

      <footer className="text-center text-[10px] text-slate-400 py-6">
        {APP_NAME} v{APP_VERSION} · OpenAEC Foundation
      </footer>
    </div>
  );
}

/* ── Add Instance Modal ── */

interface AddInstanceModalProps {
  onClose: () => void;
  onAdded: (instance: { id: number; name: string; url: string; themeColor: string | null; createdAt: number }) => void;
}

function AddInstanceModal({ onClose, onAdded }: AddInstanceModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [erpnextUsername, setErpnextUsername] = useState("");
  const [erpnextPassword, setErpnextPassword] = useState("");
  const [themeColor, setThemeColor] = useState(DEFAULT_COLORS[0]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/instances/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ url, erpnextUsername, erpnextPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: t("instances.test_success", { defaultValue: `Connection OK — ${data.fullName || erpnextUsername} (${(data.roles || []).length} roles)`, fullName: data.fullName, roleCount: (data.roles || []).length }),
        });
      } else {
        // Prefer translated message based on stable error code from backend.
        // Fall back to the raw English detail (or generic) if no mapping.
        const code = data.errorCode as string | undefined;
        const i18nKey = code ? `instances.test_error_${code}` : "instances.test_failed";
        const translated = t(i18nKey, { defaultValue: "" });
        const message = translated
          || data.error
          || t("instances.test_failed", { defaultValue: "Connection failed" });
        setTestResult({ ok: false, message });
      }
    } catch (err) {
      setTestResult({ ok: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, url, themeColor, erpnextUsername, erpnextPassword }),
      });
      const data = await res.json();
      if (data.ok && data.instance) {
        onAdded(data.instance);
      } else {
        setError(data.error || t("instances.save_failed", { defaultValue: "Failed to add instance" }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{t("instances.add_title", { defaultValue: "Add ERPNext instance" })}</h2>
          <p className="text-xs text-slate-500 mt-1">{t("instances.add_subtitle", { defaultValue: "Credentials are encrypted at rest with a key derived from your Y-app password." })}</p>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_name", { defaultValue: "Display name" })}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoFocus
              placeholder={t("instances.field_name_placeholder", { defaultValue: "e.g. Acme BV" })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_url", { defaultValue: "ERPNext URL" })}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://erp.example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_username", { defaultValue: "ERPNext username" })}</label>
              <input
                type="text"
                value={erpnextUsername}
                onChange={(e) => setErpnextUsername(e.target.value)}
                required
                autoComplete="off"
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_password", { defaultValue: "ERPNext password" })}</label>
              <input
                type="password"
                value={erpnextPassword}
                onChange={(e) => setErpnextPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_color", { defaultValue: "Theme color" })}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-transform ${themeColor === c ? "border-slate-800 scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 text-xs rounded-lg p-2.5 ${testResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {testResult.ok ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <XCircle size={14} className="flex-shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !url || !erpnextUsername || !erpnextPassword}
              className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("instances.test_connection", { defaultValue: "Test connection" })}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={saving || !name || !url || !erpnextUsername || !erpnextPassword}
              className="px-4 py-2 text-sm text-white bg-y-teal hover:bg-y-teal-dark rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("instances.save", { defaultValue: "Save" })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit Instance Modal ── */

interface EditInstanceModalProps {
  instance: Instance;
  onClose: () => void;
  onSaved: (updated: { id: number; name: string; url: string; themeColor: string | null }) => void;
}

function EditInstanceModal({ instance, onClose, onSaved }: EditInstanceModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(instance.name);
  const [url, setUrl] = useState(instance.url);
  const [themeColor, setThemeColor] = useState(instance.themeColor || DEFAULT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/instances/${instance.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, url, themeColor }),
      });
      const data = await res.json();
      if (data.ok && data.instance) {
        onSaved(data.instance);
      } else {
        setError(data.error || t("instances.save_failed", { defaultValue: "Failed to update instance" }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{t("instances.edit_title", { defaultValue: "Edit instance" })}</h2>
          <p className="text-xs text-slate-500 mt-1">{t("instances.edit_subtitle", { defaultValue: "Credentials are not changed here. To rotate credentials, delete and re-add the instance." })}</p>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_name", { defaultValue: "Display name" })}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_url", { defaultValue: "ERPNext URL" })}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {t("instances.edit_url_warning", { defaultValue: "Changing the URL will not re-test credentials. The next request will retry with the stored credentials against the new URL." })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("instances.field_color", { defaultValue: "Theme color" })}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setThemeColor(c)}
                  className={`w-7 h-7 rounded-full cursor-pointer border-2 transition-transform ${themeColor === c ? "border-slate-800 scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 mt-3">
            <p className="text-xs font-medium text-slate-700 mb-1">Frappe versie</p>
            <p className="text-xs text-slate-500">
              Gedetecteerd: v{instance.frappe_major_version ?? "?"}
              {instance.version_detected_at && (
                <span className="ml-1">({new Date(instance.version_detected_at).toLocaleDateString()})</span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button type="button"
                onClick={async () => {
                  try {
                    const r = await fetch(`/api/instances/${instance.id}/refresh-version`, {
                      method: "POST",
                      credentials: "same-origin",
                    });
                    const data = await r.json();
                    if (data.ok) {
                      // Refresh the instance list
                      window.location.reload();
                    }
                  } catch { /* ignore */ }
                }}
                className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded cursor-pointer">
                Opnieuw detecteren
              </button>
              <select
                value={instance.version_override ?? ""}
                onChange={async (e) => {
                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                  await fetch(`/api/instances/${instance.id}/version-override`, {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ version: val }),
                  });
                  window.location.reload();
                }}
                className="px-2 py-1 text-xs border border-slate-200 rounded">
                <option value="">Geen override</option>
                <option value="15">v15 (override)</option>
                <option value="16">v16 (override)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <XCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={saving || !name || !url}
              className="px-4 py-2 text-sm text-white bg-y-teal hover:bg-y-teal-dark rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("instances.save", { defaultValue: "Save" })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
