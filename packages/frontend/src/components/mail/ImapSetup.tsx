import { useState, useEffect, useRef } from "react";
import {
  Mail, X, Check, Eye, EyeOff, Cloud, Database, FolderOpen, Wifi,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getActiveInstanceId, getActiveEmployee } from "../../lib/instances";
import { useEmployees } from "../../lib/DataContext";
import { type ImapConfig } from "../../lib/webmail-prefetch";
import type { MailFolder } from "../../lib/mail-types";
import {
  getMailCacheWindowDays, setMailCacheWindowDays,
  MAIL_CACHE_DEFAULT_DAYS, MAIL_CACHE_ALL_DAYS, MAIL_CACHE_MIN_DAYS, MAIL_CACHE_MAX_DAYS,
} from "../../lib/mailCacheSettings";
import {
  countCachedBodies, sizeOfCachedBodies, sizeOfCachedAttachments,
} from "../../lib/mail-cache-db";
import { signatureCache } from "../../lib/mail-signature-cache";
import {
  getSentFolderOverride, setSentFolderOverride, getTrashFolderOverride, setTrashFolderOverride,
} from "../../lib/folder-prefs";
import { sanitizeHost, saveImapConfig } from "../../lib/imap-config";

/* ─── Setup screen ─── */

/** Bytes → leesbaar (B / KB / MB). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImapSetup({ config, onSave, onCancel, folders = [] }: { config: ImapConfig; onSave: (c: ImapConfig) => void; onCancel?: () => void; folders?: MailFolder[] }) {
  const { t } = useTranslation();
  const employees = useEmployees();

  // Pre-fill email from default employee's company_email
  const [form, setForm] = useState(() => {
    if (config.user) return config;
    const empId = getActiveEmployee();
    if (empId) {
      const emp = employees.find(e => e.name === empId);
      if (emp?.company_email) return { ...config, user: emp.company_email };
    }
    return config;
  });
  const [testing, setTesting] = useState(false);
  const [testStartedAt, setTestStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const testControllerRef = useRef<AbortController | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [lastTestAt, setLastTestAt] = useState(0);
  // Lokale mail-cache venster (per apparaat). 0 = uit.
  const cacheInstanceId = getActiveInstanceId();
  const [mailCacheDays, setMailCacheDaysState] = useState<number>(
    () => (cacheInstanceId ? getMailCacheWindowDays(cacheInstanceId) : MAIL_CACHE_DEFAULT_DAYS),
  );
  function applyMailCacheDays(days: number) {
    setMailCacheDaysState(days);
    if (cacheInstanceId) setMailCacheWindowDays(cacheInstanceId, days);
  }
  // Verzonden- en Verwijderde-map overrides. Cross-device via synced-prefs
  // (pref_-prefix). Lost dubbele speciale mappen na een mailserver-migratie op.
  // BELANGRIJK: keyen op het account-e-mailadres (config.user), want de
  // verzend-/verwijder-code in Webmail leest de override MÉT account
  // (getSentFolderOverride(activeAccountEmail)) en MailAccountSettings idem.
  // Zonder acct schreef dit blok de instance-brede sleutel → de gekozen map
  // belandde onder een andere sleutel dan waar 'ie gelezen wordt = "instelling
  // slaat niet op" / heeft geen effect.
  const acct = config.user || undefined;
  const [sentFolderSel, setSentFolderSel] = useState<string>(() => getSentFolderOverride(acct));
  const [trashFolderSel, setTrashFolderSel] = useState<string>(() => getTrashFolderOverride(acct));
  function applySentFolder(path: string) { setSentFolderSel(path); setSentFolderOverride(path, acct); }
  function applyTrashFolder(path: string) { setTrashFolderSel(path); setTrashFolderOverride(path, acct); }
  // Huidige opslaggrootte van de body- + bijlage-cache (primary mailbox).
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [cacheCount, setCacheCount] = useState<number>(0);
  const [attBytes, setAttBytes] = useState<number>(0);
  const [attCount, setAttCount] = useState<number>(0);
  useEffect(() => {
    if (!cacheInstanceId || cacheInstanceId === "default") return;
    let cancelled = false;
    (async () => {
      const [bytes, count, att] = await Promise.all([
        sizeOfCachedBodies(cacheInstanceId, ""),
        countCachedBodies(cacheInstanceId, ""),
        sizeOfCachedAttachments(cacheInstanceId, ""),
      ]);
      if (!cancelled) { setCacheBytes(bytes); setCacheCount(count); setAttBytes(att.bytes); setAttCount(att.count); }
    })();
    return () => { cancelled = true; };
  }, [cacheInstanceId, mailCacheDays]);

  // Tick the elapsed-time counter while a test is in flight.
  useEffect(() => {
    if (!testing) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [testing]);

  async function handleTest() {
    // Ten-second client cooldown: rapid Test clicks were a big fail2ban
    // trigger on upstream mail servers today.
    const start = Date.now();
    const elapsed = start - lastTestAt;
    if (elapsed < 10_000) {
      setResult({ ok: false, message: t("webmail.test_cooldown", { seconds: Math.ceil((10_000 - elapsed) / 1000) }) });
      return;
    }
    setLastTestAt(start);
    setTestStartedAt(start);
    setNow(start);
    setTesting(true); setResult(null);
    const controller = new AbortController();
    testControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: controller.signal,
      });
      const data = await res.json();
      setResult({ ok: data.ok, message: data.message || data.error });
    } catch (err) {
      const msg = (err as Error).name === "AbortError"
        ? t("webmail.test_timeout")
        : (err as Error).message;
      setResult({ ok: false, message: msg });
    }
    finally {
      clearTimeout(timeoutId);
      testControllerRef.current = null;
      setTesting(false);
    }
  }

  function handleCancelTest() {
    testControllerRef.current?.abort();
  }

  const testElapsedSec = testing ? Math.floor((now - testStartedAt) / 1000) : 0;

  async function handleAutoConfig() {
    setAutoLoading(true); setResult(null);
    try {
      const email = form.user;
      if (!email) {
        setResult({ ok: false, message: t("webmail.fill_email_first") });
        setAutoLoading(false);
        return;
      }

      const res = await fetch(`/api/mail/auto-config?email=${encodeURIComponent(email)}`, { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json();
        setResult({ ok: false, message: data.error || t("webmail.error_status", { status: res.status }) });
        setAutoLoading(false);
        return;
      }

      const { data } = await res.json();
      const newForm: ImapConfig = {
        host: data.host || form.host,
        port: String(data.port || 993),
        user: data.user || email,
        pass: form.pass, // keep existing password (OAuth doesn't need it)
        secure: data.secure !== false,
        authMode: data.authMode || "password",
        accessToken: data.accessToken || undefined,
        refreshToken: data.refreshToken || undefined,
        clientId: data.clientId || undefined,
        clientSecret: data.clientSecret || undefined,
        tokenUri: data.tokenUri || undefined,
        smtpHost: data.smtpHost || undefined,
        smtpPort: data.smtpPort ? String(data.smtpPort) : undefined,
        smtpSecure: data.smtpSecure ?? false,
      };
      setForm(newForm);

      // Store signature if returned
      if (data.signature) {
        const id = getActiveInstanceId();
        const lsKey = `mail_signature_${id}_${email}`;
        localStorage.setItem(lsKey, data.signature);
        signatureCache.set(email, data.signature);
      }

      if (data.authMode === "oauth2" && data.accessToken) {
        // OAuth2: auto-save and close setup — all data is complete
        saveImapConfig(newForm);
        onSave(newForm);
        return;
      } else {
        setResult({ ok: true, message: t("webmail.email_config_loaded") });
      }
    } catch (err) {
      console.error("[Webmail:autoConfig] error:", err);
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setAutoLoading(false);
    }
  }

  const hostValid = !form.host || /^[a-z0-9.-]+$/i.test(form.host);
  const canSave = form.host && hostValid && form.user && (form.pass || form.authMode === "oauth2");
  const canTest = canSave;

  return (
    <div className="p-6 flex items-center justify-center h-full bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Mail className="text-blue-600" size={24} /></div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800">{t("webmail.setup_title")}</h2>
            <p className="text-xs text-slate-500">{t("webmail.setup_subtitle")}</p>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer" title={t("webmail.close_setup", { defaultValue: "Close" })}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Email address — always visible, used for auto-config */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">{t("webmail.your_email")}</label>
          <input type="email" value={form.user}
            onChange={(e) => setForm({ ...form, user: e.target.value })}
            placeholder="maarten@3bm.co.nl"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Authentication mode selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t("webmail.auth_mode_label")}</label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => { if (form.user) handleAutoConfig(); }}
              disabled={autoLoading || !form.user}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors border ${
                form.authMode === "oauth2"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              } disabled:opacity-50`}
            >
              {autoLoading ? t("common.loading") : t("webmail.auth_from_erpnext")}
            </button>
            <button type="button"
              onClick={() => setForm({ ...form, authMode: "password", accessToken: undefined, refreshToken: undefined, clientId: undefined, clientSecret: undefined, tokenUri: undefined })}
              className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors border ${
                form.authMode !== "oauth2"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t("webmail.auth_manual")}
            </button>
          </div>
        </div>

        {/* ERPNext auto-config mode */}
        {form.authMode === "oauth2" && (
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs flex items-center gap-2">
            <Check size={14} />
            {t("webmail.oauth2_configured")}
          </div>
        )}

        {/* Manual IMAP config */}
        {form.authMode !== "oauth2" && (
          <>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
              {t("webmail.manual_hint")}
            </div>

            <p className="text-xs font-semibold text-slate-500 pt-1">{t("webmail.incoming_section")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.imap_server")}</label>
                <input type="text" value={form.host}
                  onChange={(e) => setForm({ ...form, host: sanitizeHost(e.target.value) })}
                  autoComplete="off" name="imap-host"
                  placeholder="imap.example.com"
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 ${hostValid ? "border-slate-200 focus:ring-blue-500" : "border-red-300 focus:ring-red-500"}`} />
                {!hostValid && <p className="mt-1 text-xs text-red-600">{t("webmail.invalid_host")}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.imap_port")}</label>
                <input type="text" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })}
                  autoComplete="off" name="imap-port"
                  placeholder="993" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("settings.imap_username")}</label>
              <input type="text" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })}
                autoComplete="off" name="imap-user"
                placeholder="user@example.com" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("login.password_label")}</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })}
                  autoComplete="new-password" name="imap-pass"
                  placeholder={t("login.password_label")} className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.secure} onChange={(e) => setForm({ ...form, secure: e.target.checked })} className="rounded border-slate-300" />
              {t("webmail.ssl_recommended")}
            </label>

            {/* SMTP (outgoing mail) */}
            <p className="text-xs font-semibold text-slate-500 pt-2">{t("webmail.smtp_section")}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("webmail.smtp_host")}</label>
                <input type="text" value={form.smtpHost || ""}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value || undefined })}
                  autoComplete="off" placeholder="smtp.example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("webmail.smtp_port")}</label>
                <input type="text" value={form.smtpPort || ""}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value || undefined })}
                  autoComplete="off" placeholder="587"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input type="checkbox" checked={form.smtpSecure || false}
                onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })}
                className="rounded border-slate-300" />
              {t("webmail.smtp_tls")}
            </label>
            <p className="text-[10px] text-slate-400">{t("webmail.smtp_hint")}</p>
          </>
        )}

        {result && (
          <div className={`p-3 rounded-lg text-sm ${result.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>{result.message}</div>
        )}

        {/* Lokale mail-cache (inhoud) — per apparaat. Recente mails offline +
            instant. Zelfde stijl als de rest van dit instellingen-blok. */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <Cloud size={14} className="text-blue-500" />
            <label className="block text-xs font-semibold text-slate-600">{t("settings.mail_cache_title")}</label>
          </div>
          <p className="text-[11px] text-slate-400">{t("settings.mail_cache_desc")}</p>
          <div className="flex flex-wrap gap-2">
            {[
              { l: t("settings.mail_cache_off"), v: 0 },
              { l: "30 d", v: 30 },
              { l: "90 d", v: 90 },
              { l: t("settings.mail_cache_all"), v: MAIL_CACHE_ALL_DAYS },
            ].map((p) => (
              <button type="button" key={p.v}
                onClick={() => applyMailCacheDays(p.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${mailCacheDays === p.v ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
              >
                {p.l}
              </button>
            ))}
          </div>
          {mailCacheDays > 0 && mailCacheDays < MAIL_CACHE_ALL_DAYS && (
            <div className="flex items-center gap-3 pt-1">
              <input type="range" min={MAIL_CACHE_MIN_DAYS} max={MAIL_CACHE_MAX_DAYS} value={mailCacheDays}
                onChange={(e) => applyMailCacheDays(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-500 cursor-pointer" />
              <span className="text-sm font-semibold text-slate-700 w-24 text-right">{t("settings.mail_cache_days", { count: mailCacheDays })}</span>
            </div>
          )}
          <p className="text-[10px] text-slate-400">{t("settings.mail_cache_hint")}</p>
          {/* Huidige opslaggrootte van de lokale body-cache. */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Database size={12} className="text-slate-400" />
            {cacheBytes === null ? (
              <span>{t("settings.mail_cache_size_loading", { defaultValue: "Opslag berekenen…" })}</span>
            ) : (
              <span>
                {t("settings.mail_cache_size", {
                  size: formatBytes(cacheBytes + attBytes),
                  count: cacheCount,
                  defaultValue: `Nu opgeslagen: ${formatBytes(cacheBytes + attBytes)} · ${cacheCount} berichten`,
                })}
                {attCount > 0 && (
                  <span className="text-slate-400">{" "}{t("settings.mail_cache_size_attachments", {
                    size: formatBytes(attBytes),
                    count: attCount,
                    defaultValue: `(incl. ${formatBytes(attBytes)} aan ${attCount} bijlages)`,
                  })}</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Speciale mappen — kies welke server-map "Verzonden" en "Verwijderd"
            is. Lost dubbele mappen na een mailserver-migratie op: nieuwe mail
            landt in de map die jij gebruikt. Cross-device via synced-prefs. */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} className="text-violet-500" />
            <label className="block text-xs font-semibold text-slate-600">
              {t("settings.special_folders_title", { defaultValue: "Speciale mappen" })}
            </label>
          </div>
          <p className="text-[11px] text-slate-400">
            {t("settings.special_folders_desc", {
              defaultValue:
                "Kies welke map gebruikt wordt voor verzonden en verwijderde berichten. Laat op automatisch als de juiste map vanzelf herkend wordt.",
            })}
          </p>
          {[
            { label: t("settings.sent_folder_label", { defaultValue: "Verzonden-map" }), value: sentFolderSel, apply: applySentFolder },
            { label: t("settings.trash_folder_label", { defaultValue: "Verwijderde-map" }), value: trashFolderSel, apply: applyTrashFolder },
          ].map((row) => {
            const known = folders.some((f) => f.path === row.value);
            return (
              <div key={row.label} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-28 flex-shrink-0">{row.label}</span>
                <select
                  value={row.value}
                  onChange={(e) => row.apply(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                >
                  <option value="">{t("settings.folder_auto", { defaultValue: "Automatisch detecteren" })}</option>
                  {row.value && !known && <option value={row.value}>{row.value}</option>}
                  {folders.map((f) => (
                    <option key={f.path} value={f.path}>{f.path}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {testing ? (
            <button onClick={handleCancelTest}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium cursor-pointer">
              <X size={14} />
              {t("webmail.cancel_test", { seconds: testElapsedSec })}
            </button>
          ) : (
            <button onClick={handleTest} disabled={!canTest}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 text-sm font-medium cursor-pointer">
              <Wifi size={14} />
              {t("webmail.test_connection")}
            </button>
          )}
          <button onClick={() => { saveImapConfig(form); onSave(form); }} disabled={!canSave || testing}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium cursor-pointer">
            {t("webmail.save_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
