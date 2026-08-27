import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Plus, Trash2, Pencil, RefreshCw, Check, X, ExternalLink, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { getActiveInstanceId } from "../lib/instances";
import { getMailCacheWindowDays, setMailCacheWindowDays } from "../lib/mailCacheSettings";
import { getSignatureOverride, setSignatureOverride, hydrateSignatureOverrides } from "../lib/mailSignature";
import { getMailFolderPref, setMailFolderPref } from "../lib/mailFolderPrefs";
import { useToast } from "../components/Toast";

/* ─── Types ─── */

interface MailAccountPublic {
  id: string;
  email: string;
  label: string;
  authType: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  lastTestedAt: number | null;
  lastTestOk: boolean | null;
  createdAt: number;
}

type AuthType = "erpnext" | "office365" | "manual";

interface FormState {
  email: string;
  label: string;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  username: string;
  password: string;
  // OAuth2 fields (populated by ERPNext auto-config)
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUri?: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  label: "",
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: true,
  username: "",
  password: "",
};

/* ─── Per-account card (alle e-mailinstellingen genest onder het account) ─── */

type TFn = (key: string, opts?: Record<string, string>) => string;

interface AccountCardProps {
  account: MailAccountPublic;
  instanceId: string;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  testing: boolean;
  deleting: boolean;
  t: TFn;
  toast: ReturnType<typeof useToast>;
}

function AccountCard({
  account,
  instanceId,
  onTest,
  onEdit,
  onDelete,
  testing,
  deleting,
  t,
  toast,
}: AccountCardProps) {
  const email = account.email;

  const [expanded, setExpanded] = useState(false);

  // Offline-cache venster (dagen, per apparaat, per account).
  const [cacheDays, setCacheDays] = useState<number>(() => getMailCacheWindowDays(instanceId, email));

  // Handmatige HTML-handtekening (override op ERPNext) voor dit account.
  const [sigDraft, setSigDraft] = useState<string>(() => getSignatureOverride(email));

  // Verzonden-/Verwijderde-items-map voor dit account.
  const [sentFolder, setSentFolder] = useState<string>(() => getMailFolderPref("sent", email));
  const [trashFolder, setTrashFolder] = useState<string>(() => getMailFolderPref("trash", email));
  const [folderList, setFolderList] = useState<Array<{ path: string; name: string }>>([]);
  const [foldersFetched, setFoldersFetched] = useState(false);

  // Map-lijst lazy ophalen zodra het instellingen-paneel voor het eerst opengaat.
  useEffect(() => {
    if (!expanded || foldersFetched) return;
    setFoldersFetched(true);
    const params = new URLSearchParams();
    if (account.id && account.id !== "erpnext-auto") params.set("account", account.id);
    if (email) params.set("email", email);
    fetch(`/api/mail/folders?${params.toString()}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = Array.isArray(j?.data) ? j.data : [];
        setFolderList(
          list.map((f: { path: string; name?: string }) => ({ path: f.path, name: f.name || f.path })),
        );
      })
      .catch(() => { /* geen mappen beschikbaar — keuzelijst blijft op (automatisch) */ });
  }, [expanded, foldersFetched, account.id, email]);

  function StatusDot({ ok }: { ok: boolean | null }) {
    if (ok === true) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title={t("mail_accounts.status_ok", { defaultValue: "Verbinding OK" })} />;
    if (ok === false) return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title={t("mail_accounts.status_fail", { defaultValue: "Verbinding mislukt" })} />;
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300" title={t("mail_accounts.status_unknown", { defaultValue: "Nog niet getest" })} />;
  }

  function AuthBadge({ type }: { type: string }) {
    const labels: Record<string, { text: string; className: string }> = {
      erpnext: { text: "ERPNext", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      office365: { text: "Office 365", className: "bg-blue-50 text-blue-700 border-blue-200" },
      manual: { text: t("mail_accounts.type_manual", { defaultValue: "Handmatig" }), className: "bg-slate-50 text-slate-600 border-slate-200" },
    };
    const badge = labels[type] || labels.manual;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.className}`}>{badge.text}</span>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      {/* Kop: status, adres/label, type, IMAP-host, acties */}
      <div className="flex items-center gap-3">
        <StatusDot ok={account.lastTestOk} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-700 truncate">{account.email}</span>
            <AuthBadge type={account.authType} />
          </div>
          {account.label && account.label !== account.email && (
            <div className="text-xs text-slate-400">{account.label}</div>
          )}
          <div className="text-xs text-slate-500 font-mono truncate">{account.imapHost}:{account.imapPort}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTest}
            disabled={testing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
            title={t("mail_accounts.test", { defaultValue: "Verbinding testen" })}
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
            title={t("mail_accounts.edit", { defaultValue: "Bewerken" })}
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
            title={t("mail_accounts.delete", { defaultValue: "Verwijderen" })}
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {/* Toggle: geneste instellingen voor dit account */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {t("mail_accounts.settings_toggle", { defaultValue: "Instellingen" })}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-5">
          {/* a. Offline-cache */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("mail_accounts.cache_title", { defaultValue: "Offline cache" })}</label>
            <p className="text-xs text-slate-500 mb-2">{t("mail_accounts.cache_hint", { defaultValue: "Aantal dagen e-mail dat op dit apparaat wordt bewaard voor offline lezen en snel openen." })}</p>
            <select
              value={cacheDays}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setCacheDays(n);
                setMailCacheWindowDays(instanceId, n, email);
              }}
              className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer"
            >
              <option value={0}>{t("mail_accounts.cache_off", { defaultValue: "Uit" })}</option>
              <option value={7}>7 {t("mail_accounts.days", { defaultValue: "dagen" })}</option>
              <option value={30}>30 {t("mail_accounts.days", { defaultValue: "dagen" })}</option>
              <option value={90}>90 {t("mail_accounts.days", { defaultValue: "dagen" })}</option>
              <option value={365}>365 {t("mail_accounts.days", { defaultValue: "dagen" })}</option>
            </select>
          </div>

          {/* b. Handtekening */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("mail_accounts.signature_title", { defaultValue: "Handtekening" })}</label>
            <p className="text-xs text-slate-500 mb-2">{t("mail_accounts.signature_hint", { defaultValue: "HTML met inline base64-afbeeldingen. Overschrijft de handtekening uit ERPNext; laat leeg om op ERPNext terug te vallen." })}</p>
            <textarea
              value={sigDraft}
              onChange={(e) => setSigDraft(e.target.value)}
              placeholder="<p>Met vriendelijke groet,<br>…</p>"
              rows={6}
              spellCheck={false}
              className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => {
                  setSignatureOverride(email, sigDraft);
                  toast.success(t("mail_accounts.signature_saved", { defaultValue: "Handtekening opgeslagen" }));
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer transition-colors"
              >
                {t("mail_accounts.signature_save", { defaultValue: "Handtekening opslaan" })}
              </button>
              {sigDraft.trim() && (
                <span className="text-xs text-slate-400">{Math.round(sigDraft.length / 1024)} KB</span>
              )}
            </div>
          </div>

          {/* c. Verzonden-/Verwijderde-items-map */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("mail_accounts.folders_title", { defaultValue: "Mappen" })}</label>
            <p className="text-xs text-slate-500 mb-2">{t("mail_accounts.folders_hint", { defaultValue: "Kies handmatig welke server-map je Verzonden- en Verwijderde-items-map is (handig bij dubbele mappen na een mailserver-overstap). Leeg = automatisch detecteren." })}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.sent_folder_label", { defaultValue: "Verzonden-map" })}</label>
                <select
                  value={sentFolder}
                  onChange={(e) => { setSentFolder(e.target.value); setMailFolderPref("sent", e.target.value, email); }}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <option value="">{t("mail_accounts.folder_auto", { defaultValue: "(automatisch)" })}</option>
                  {sentFolder && !folderList.some((f) => f.path === sentFolder) && <option value={sentFolder}>{sentFolder}</option>}
                  {folderList.map((f) => <option key={f.path} value={f.path}>{f.name} ({f.path})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("mail_accounts.trash_folder_label", { defaultValue: "Verwijderde items-map" })}</label>
                <select
                  value={trashFolder}
                  onChange={(e) => { setTrashFolder(e.target.value); setMailFolderPref("trash", e.target.value, email); }}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer"
                >
                  <option value="">{t("mail_accounts.folder_auto", { defaultValue: "(automatisch)" })}</option>
                  {trashFolder && !folderList.some((f) => f.path === trashFolder) && <option value={trashFolder}>{trashFolder}</option>}
                  {folderList.map((f) => <option key={f.path} value={f.path}>{f.name} ({f.path})</option>)}
                </select>
              </div>
            </div>
            {folderList.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">{t("mail_accounts.folders_loading", { defaultValue: "Mappen worden geladen…" })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Component ─── */

export default function MailAccountSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const instanceId = getActiveInstanceId();

  // State
  const [accounts, setAccounts] = useState<MailAccountPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addAuthType, setAddAuthType] = useState<AuthType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoConfigLoading, setAutoConfigLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Server-handtekening-overrides één keer ophalen (per-account editor in AccountCard).
  useEffect(() => { hydrateSignatureOverrides(); }, []);

  // Fetch accounts on mount
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances/${instanceId}/mail-accounts`, { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setAccounts(data.accounts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Reset form
  function resetForm() {
    setForm(EMPTY_FORM);
    setShowAddForm(false);
    setAddAuthType(null);
    setEditingId(null);
  }

  // Auto-config from ERPNext
  async function handleAutoConfig() {
    if (!form.email) {
      toast.error(t("mail_accounts.fill_email_first", { defaultValue: "Vul eerst een e-mailadres in" }));
      return;
    }
    setAutoConfigLoading(true);
    try {
      const res = await fetch(`/api/mail/auto-config?email=${encodeURIComponent(form.email)}`, { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("mail_accounts.auto_config_failed", { defaultValue: "Auto-configuratie mislukt" }));
        return;
      }
      const { data } = await res.json();
      setForm(prev => ({
        ...prev,
        imapHost: data.host || prev.imapHost,
        imapPort: String(data.port || 993),
        imapSecure: data.secure !== false,
        smtpHost: data.smtpHost || prev.smtpHost,
        smtpPort: data.smtpPort ? String(data.smtpPort) : prev.smtpPort,
        smtpSecure: data.smtpSecure ?? true,
        username: data.user || form.email,
        password: data.pass || prev.password,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        tokenUri: data.tokenUri,
      }));
      toast.success(t("mail_accounts.auto_config_ok", { defaultValue: "Configuratie opgehaald uit ERPNext" }));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAutoConfigLoading(false);
    }
  }

  // Save (create or update)
  async function handleSave() {
    if (!form.email || !form.imapHost || !form.smtpHost) {
      toast.error(t("mail_accounts.fill_required", { defaultValue: "Vul alle verplichte velden in" }));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        label: form.label || form.email,
        authType: addAuthType || "manual",
        imapHost: form.imapHost,
        imapPort: parseInt(form.imapPort, 10) || 993,
        imapSecure: form.imapSecure,
        smtpHost: form.smtpHost,
        smtpPort: parseInt(form.smtpPort, 10) || 587,
        smtpSecure: form.smtpSecure,
        credentials: {
          username: form.username || form.email,
          ...(form.password ? { password: form.password } : {}),
          ...(form.accessToken ? { accessToken: form.accessToken } : {}),
          ...(form.refreshToken ? { refreshToken: form.refreshToken } : {}),
          ...(form.clientId ? { clientId: form.clientId } : {}),
          ...(form.clientSecret ? { clientSecret: form.clientSecret } : {}),
          ...(form.tokenUri ? { tokenUri: form.tokenUri } : {}),
        },
      };

      const url = editingId
        ? `/api/instances/${instanceId}/mail-accounts/${editingId}`
        : `/api/instances/${instanceId}/mail-accounts`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("mail_accounts.save_failed", { defaultValue: "Opslaan mislukt" }));
        return;
      }

      toast.success(editingId
        ? t("mail_accounts.updated", { defaultValue: "E-mailaccount bijgewerkt" })
        : t("mail_accounts.created", { defaultValue: "E-mailaccount toegevoegd" }),
      );
      resetForm();
      fetchAccounts();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Edit — pre-fill form (no credentials shown)
  function handleEdit(account: MailAccountPublic) {
    setForm({
      email: account.email,
      label: account.label,
      imapHost: account.imapHost,
      imapPort: String(account.imapPort),
      imapSecure: account.imapSecure,
      smtpHost: account.smtpHost,
      smtpPort: String(account.smtpPort),
      smtpSecure: account.smtpSecure,
      username: account.email,
      password: "", // never retrievable
    });
    // Fallback naar "manual" als authType ontbreekt: de desktop-vault sloeg
    // authType vroeger niet op → zonder deze fallback is addAuthType undefined
    // en rendert géén van de veldblokken (leeg bewerk-formulier).
    setAddAuthType((account.authType as AuthType) || "manual");
    setEditingId(account.id);
    setShowAddForm(true);
  }

  // Delete
  async function handleDelete(accountId: string) {
    setDeletingId(accountId);
    try {
      const res = await fetch(`/api/instances/${instanceId}/mail-accounts/${accountId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        toast.success(t("mail_accounts.deleted", { defaultValue: "E-mailaccount verwijderd" }));
        setAccounts(prev => prev.filter(a => a.id !== accountId));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("mail_accounts.delete_failed", { defaultValue: "Verwijderen mislukt" }));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  // Test connection
  async function handleTest(accountId: string) {
    setTestingId(accountId);
    try {
      const res = await fetch(`/api/instances/${instanceId}/mail-accounts/${accountId}/test`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({ ok: false, message: "Onbekende fout" }));
      if (data.ok) {
        toast.success(t("mail_accounts.test_ok", { defaultValue: "Verbinding geslaagd" }));
      } else {
        toast.error(data.message || t("mail_accounts.test_failed", { defaultValue: "Verbinding mislukt" }));
      }
      fetchAccounts(); // refresh to update lastTestOk
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTestingId(null);
    }
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail size={20} className="text-blue-500" />
          <div>
            <h3 className="text-base font-semibold text-slate-700">{t("mail_accounts.title", { defaultValue: "E-mailaccounts" })}</h3>
            <p className="text-xs text-slate-400">{t("mail_accounts.subtitle", { defaultValue: "Beheer de e-mailaccounts die gekoppeld zijn aan deze instance" })}</p>
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer transition-colors"
          >
            <Plus size={16} />
            {t("mail_accounts.add", { defaultValue: "Account toevoegen" })}
          </button>
        )}
      </div>

      {/* Account list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : accounts.length === 0 && !showAddForm ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Mail size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">{t("mail_accounts.none", { defaultValue: "Nog geen e-mailaccounts geconfigureerd" })}</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer transition-colors"
          >
            <Plus size={16} className="inline mr-1.5 -mt-0.5" />
            {t("mail_accounts.add_first", { defaultValue: "Eerste account toevoegen" })}
          </button>
        </div>
      ) : accounts.length > 0 ? (
        <div className="space-y-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              instanceId={instanceId}
              onTest={() => handleTest(account.id)}
              onEdit={() => handleEdit(account)}
              onDelete={() => handleDelete(account.id)}
              testing={testingId === account.id}
              deleting={deletingId === account.id}
              t={t}
              toast={toast}
            />
          ))}
        </div>
      ) : null}

      {/* Add / Edit form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
          {/* Form header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">
              {editingId
                ? t("mail_accounts.edit_title", { defaultValue: "E-mailaccount bewerken" })
                : t("mail_accounts.add_title", { defaultValue: "Nieuw e-mailaccount" })
              }
            </h4>
            <button
              onClick={resetForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Auth type picker (only for new accounts) */}
          {!editingId && !addAuthType && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                {t("mail_accounts.choose_type", { defaultValue: "Kies configuratiemethode" })}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setAddAuthType("erpnext")}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  <ExternalLink size={20} className="text-indigo-500" />
                  <span className="text-sm font-medium text-slate-700">ERPNext</span>
                  <span className="text-xs text-slate-400 text-center">{t("mail_accounts.type_erpnext_desc", { defaultValue: "Ophalen uit ERPNext" })}</span>
                </button>
                <button
                  onClick={() => setAddAuthType("office365")}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Mail size={20} className="text-blue-500" />
                  <span className="text-sm font-medium text-slate-700">Office 365</span>
                  <span className="text-xs text-slate-400 text-center">OAuth2</span>
                </button>
                <button
                  onClick={() => setAddAuthType("manual")}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Pencil size={20} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{t("mail_accounts.type_manual", { defaultValue: "Handmatig" })}</span>
                  <span className="text-xs text-slate-400 text-center">{t("mail_accounts.type_manual_desc", { defaultValue: "IMAP/SMTP invoeren" })}</span>
                </button>
              </div>
            </div>
          )}

          {/* ERPNext auto-config flow */}
          {addAuthType === "erpnext" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("mail_accounts.email_label", { defaultValue: "E-mailadres" })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="naam@bedrijf.nl"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                  <button
                    onClick={handleAutoConfig}
                    disabled={autoConfigLoading || !form.email}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {autoConfigLoading
                      ? <Loader2 size={16} className="animate-spin" />
                      : <ExternalLink size={16} />
                    }
                    {t("mail_accounts.fetch_from_erpnext", { defaultValue: "Ophalen uit ERPNext" })}
                  </button>
                </div>
              </div>

              {/* Show pre-filled fields after auto-config */}
              {form.imapHost && <MailServerFields form={form} setForm={setForm} editing={!!editingId} t={t} />}

              {form.imapHost && (
                <FormActions saving={saving} onSave={handleSave} onCancel={resetForm} t={t} />
              )}
            </div>
          )}

          {/* Office 365 placeholder */}
          {addAuthType === "office365" && (
            <div className="p-6 rounded-lg bg-blue-50 border border-blue-200 text-center">
              <Mail size={32} className="mx-auto text-blue-400 mb-2" />
              <p className="text-sm font-medium text-blue-700">
                {t("mail_accounts.office365_soon", { defaultValue: "Binnenkort beschikbaar" })}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                {t("mail_accounts.office365_soon_desc", { defaultValue: "Office 365 OAuth2-koppeling wordt binnenkort toegevoegd" })}
              </p>
            </div>
          )}

          {/* Manual config form */}
          {addAuthType === "manual" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t("mail_accounts.email_label", { defaultValue: "E-mailadres" })} *
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="naam@bedrijf.nl"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {t("mail_accounts.label_field", { defaultValue: "Label" })}
                  </label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
                    placeholder={t("mail_accounts.label_placeholder", { defaultValue: "bijv. Werk e-mail" })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
                  />
                </div>
              </div>

              <MailServerFields form={form} setForm={setForm} editing={!!editingId} t={t} />

              <FormActions saving={saving} onSave={handleSave} onCancel={resetForm} t={t} />
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/* ─── Sub-components ─── */

function MailServerFields({
  form,
  setForm,
  editing,
  t,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  return (
    <>
      {/* IMAP settings */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">
          {t("mail_accounts.incoming", { defaultValue: "Inkomende mail (IMAP)" })}
        </p>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.imap_host", { defaultValue: "IMAP-server" })} *
            </label>
            <input
              type="text"
              value={form.imapHost}
              onChange={e => setForm(prev => ({ ...prev, imapHost: e.target.value }))}
              placeholder="imap.example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.port", { defaultValue: "Poort" })}
            </label>
            <input
              type="text"
              value={form.imapPort}
              onChange={e => setForm(prev => ({ ...prev, imapPort: e.target.value }))}
              placeholder="993"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.imapSecure}
                onChange={e => setForm(prev => ({ ...prev, imapSecure: e.target.checked }))}
                className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
              />
              <span className="text-xs text-slate-600">TLS/SSL</span>
            </label>
          </div>
        </div>
      </div>

      {/* SMTP settings */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">
          {t("mail_accounts.outgoing", { defaultValue: "Uitgaande mail (SMTP)" })}
        </p>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.smtp_host", { defaultValue: "SMTP-server" })} *
            </label>
            <input
              type="text"
              value={form.smtpHost}
              onChange={e => setForm(prev => ({ ...prev, smtpHost: e.target.value }))}
              placeholder="smtp.example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.port", { defaultValue: "Poort" })}
            </label>
            <input
              type="text"
              value={form.smtpPort}
              onChange={e => setForm(prev => ({ ...prev, smtpPort: e.target.value }))}
              placeholder="587"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={e => setForm(prev => ({ ...prev, smtpSecure: e.target.checked }))}
                className="rounded border-slate-300 text-y-teal focus:ring-y-teal"
              />
              <span className="text-xs text-slate-600">TLS/SSL</span>
            </label>
          </div>
        </div>
      </div>

      {/* Credentials */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">
          {t("mail_accounts.credentials", { defaultValue: "Inloggegevens" })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.username", { defaultValue: "Gebruikersnaam" })}
            </label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
              placeholder={form.email || "naam@bedrijf.nl"}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("mail_accounts.password", { defaultValue: "Wachtwoord" })}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder={editing ? "••••••••" : ""}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            {editing && (
              <p className="text-xs text-slate-400 mt-1">
                {t("mail_accounts.password_hint", { defaultValue: "Laat leeg om het huidige wachtwoord te behouden" })}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FormActions({
  saving,
  onSave,
  onCancel,
  t,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 cursor-pointer transition-colors"
      >
        {t("mail_accounts.cancel", { defaultValue: "Annuleren" })}
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-y-teal text-white rounded-lg hover:bg-y-teal-dark text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
      >
        {saving
          ? <Loader2 size={16} className="animate-spin" />
          : <Check size={16} />
        }
        {t("mail_accounts.save", { defaultValue: "Opslaan" })}
      </button>
    </div>
  );
}
