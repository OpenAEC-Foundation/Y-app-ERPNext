import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

/* ─── Add shared mailbox dialog ─── */

export default function AddSharedMailboxDialog({ onAdd, onCancel, existingEmails, primaryEmail }: {
  onAdd: (email: string, label?: string, effectiveUser?: string) => void;
  onCancel: () => void;
  existingEmails: string[];
  primaryEmail: string;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  async function handleTest() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError(t("webmail.shared_invalid_email"));
      return;
    }
    if (existingEmails.some(e => e.toLowerCase() === trimmed)) {
      setError(t("webmail.shared_already_added"));
      return;
    }

    setTesting(true);
    setError("");
    try {
      const res = await fetch("/api/mail/test-shared", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, primaryEmail }),
      });
      const text = await res.text();
      let data: { ok?: boolean; effectiveUser?: string; detail?: string; error?: string };
      try { data = JSON.parse(text); } catch { data = { error: `Server ${res.status}: ${text.slice(0, 200)}` }; }
      if (data.ok) {
        onAdd(trimmed, label.trim() || undefined, data.effectiveUser);
      } else {
        setError(data.detail ? `${data.error}\n\n${data.detail}` : (data.error || t("webmail.shared_access_denied")));
      }
    } catch (err) {
      setError(`${t("webmail.shared_access_denied")}\n\n${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      {/* Bewust een lichte sluier (10%) in plaats van de gebruikelijke 40%: de
          mailtekst eronder moet leesbaar blijven terwijl dit venster open staat
          — je opent het juist om iets uit die mail over te nemen. De schaduw en
          de rand van het paneel doen het scheiden, niet het verduisteren. */}
      <div className="absolute inset-0 bg-slate-900/10" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/10 w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">{t("webmail.add_shared_mailbox")}</h3>
          <p className="text-xs text-slate-500 mt-1">{t("webmail.add_shared_description")}</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("webmail.shared_email_label")}</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder={t("webmail.shared_email_placeholder")}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              onKeyDown={e => e.key === "Enter" && handleTest()}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t("webmail.shared_label_label")}</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={t("webmail.shared_label_placeholder")}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg whitespace-pre-wrap break-words">{error}</p>
          )}
        </div>
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !email.trim()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {testing && <Loader2 size={12} className="animate-spin" />}
            {testing ? t("webmail.testing_connection") : t("webmail.test_and_add")}
          </button>
        </div>
      </div>
    </div>
  );
}
