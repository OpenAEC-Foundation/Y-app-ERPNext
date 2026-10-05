/**
 * Een groep maken of bewerken: een naam en wie erin zit.
 *
 * Jijzelf staat er altijd in en staat daarom niet in de lijst om aan te
 * vinken. Bij bewerken staat onderaan ook "Groep verlaten"; wie de groep
 * verlaat houdt het gesprek, maar kan er niet meer in schrijven.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, LogOut, Search, Users, X } from "lucide-react";
import type { ErpMessageContact } from "../../lib/messages-erpnext";
import { MAX_LEDEN, MAX_NAAM, schoneNaam, type Groep } from "../../lib/berichten-groepen";

export default function GroepDialoog({
  contacts, ik, groep, namen, onSluit, onOpslaan, onVerlaten,
}: {
  contacts: ErpMessageContact[];
  ik: string;
  /** Leeg = een nieuwe groep; gevuld = deze groep bewerken. */
  groep?: Groep;
  namen: Record<string, string>;
  onSluit: () => void;
  /** Naam en de gekozen leden, zonder jezelf. */
  onOpslaan: (naam: string, leden: string[]) => Promise<void>;
  onVerlaten?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [naam, setNaam] = useState(groep?.naam ?? "");
  const [gekozen, setGekozen] = useState<string[]>(() => (groep?.leden ?? []).filter((l) => l !== ik));
  const [zoek, setZoek] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  // Leden die (nog) niet als collega bekend zijn — oud-collega's in een
  // bestaande groep — blijven zichtbaar, anders kun je ze er niet uithalen.
  const lijst = useMemo(() => {
    const bekend = new Set(contacts.map((c) => c.user));
    const extra = gekozen.filter((u) => !bekend.has(u)).map((u) => ({ user: u, fullName: namen[u] || u }));
    const alle = [...contacts, ...extra];
    const naald = zoek.trim().toLowerCase();
    return naald
      ? alle.filter((c) => c.fullName.toLowerCase().includes(naald) || c.user.toLowerCase().includes(naald))
      : alle;
  }, [contacts, gekozen, namen, zoek]);

  const bewerken = Boolean(groep);
  const kan = schoneNaam(naam).length > 0 && gekozen.length > 0 && gekozen.length < MAX_LEDEN;

  function wissel(user: string) {
    setGekozen((vorige) => (vorige.includes(user) ? vorige.filter((u) => u !== user) : [...vorige, user]));
  }

  async function opslaan() {
    if (!kan || bezig) return;
    setBezig(true);
    setFout("");
    try {
      await onOpslaan(schoneNaam(naam), gekozen);
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
      setBezig(false);
    }
  }

  async function verlaten() {
    if (!onVerlaten || bezig) return;
    if (!window.confirm(t("messages.group_leave_confirm", { naam: groep?.naam ?? "" }))) return;
    setBezig(true);
    setFout("");
    try {
      await onVerlaten();
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
      setBezig(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onSluit}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users size={16} className="text-y-teal" />
            {bewerken ? t("messages.group_edit") : t("messages.group_new")}
          </h3>
          <button onClick={onSluit} className="cursor-pointer text-slate-400 hover:text-slate-600" aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">{t("messages.group_name")}</span>
            <input
              autoFocus
              value={naam}
              maxLength={MAX_NAAM}
              onChange={(e) => setNaam(e.target.value)}
              placeholder={t("messages.group_name_placeholder")}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-500">
              {t("messages.group_members_pick", { n: gekozen.length + 1 })}
            </span>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder={t("messenger.search_colleague")}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
            <Check size={14} className="text-y-teal" /> {t("messages.group_you_are_member")}
          </p>
          {lijst.map((c) => {
            const aan = gekozen.includes(c.user);
            return (
              <button key={c.user} type="button" role="checkbox" aria-checked={aan} onClick={() => wissel(c.user)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left hover:bg-slate-50">
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
                  aan ? "border-y-teal bg-y-teal text-white" : "border-slate-300 bg-white"
                }`}>
                  {aan && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{c.fullName}</span>
                  <span className="block truncate text-xs text-slate-400">{c.user}</span>
                </span>
              </button>
            );
          })}
        </div>

        {fout && <p className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{fout}</p>}

        <div className="flex items-center gap-2 border-t border-slate-200 p-3">
          {bewerken && onVerlaten && (
            <button type="button" onClick={() => void verlaten()} disabled={bezig}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
              <LogOut size={14} /> {t("messages.group_leave")}
            </button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onSluit} disabled={bezig}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40">
              {t("common.cancel")}
            </button>
            <button type="button" onClick={() => void opslaan()} disabled={!kan || bezig}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-y-teal px-4 py-1.5 text-sm font-medium text-white hover:bg-y-teal-dark disabled:cursor-not-allowed disabled:opacity-40">
              {bezig && <Loader2 size={14} className="animate-spin" />}
              {bewerken ? t("messages.group_save") : t("messages.group_create")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
