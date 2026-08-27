/**
 * Bevestigingsdialoog voor "onbekende afzender → relatie + contactpersoon".
 *
 * De dialoog staat bewust tússen de herkenning en het schrijven, net als
 * `BookPurchaseInvoiceDialog`: `parseSenderDetails` vult in wat het in de
 * afzenderregel en de handtekening kón vinden, en de gebruiker ziet aan het
 * blauwe "herkend"-chipje **welke velden ergens vandaan komen** voordat hij
 * bevestigt. Een veld dat de herkenning niet gevonden heeft is leeg, niet
 * stiekem geraden.
 *
 * Vier dingen die hier expliciet geregeld zijn:
 *
 * - **Al bekend is geen fout.** Bij het openen loopt `lookupExisting`; is het
 *   adres al een Contact/Customer/Lead, dan zegt de dialoog dat mét
 *   doorklikbare links en verandert de knop in "openen". Zonder die check
 *   maakt de tweede mail van dezelfde persoon een dubbele contactpersoon.
 * - **"Ook als klant vastleggen" is een schakelaar, geen aanname.** Bij een
 *   privé-adres zonder bedrijfsnaam staat hij uit: dan komt er alleen een
 *   contactpersoon. De naam staat wél alvast klaar voor wie hem tóch aanzet.
 * - **Klantgroep en regio komen uit de instance zelf** (`fetchRelationDefaults`),
 *   niet uit een hardcoded lijstje. Een Link-veld vullen met een waarde die
 *   op deze instance niet bestaat laat het aanmaken klappen.
 * - **Na succes blijft de dialoog staan** met links naar de nieuwe Customer en
 *   Contact in ERPNext. Meteen sluiten laat de gebruiker achter met de vraag
 *   of er nu iets gebeurd is en waar het terechtkwam.
 *
 * De vertaalsleutels staan in `nl.json` / `en.json` / `de.json` onder
 * `y_next.rel_*`. Alleen de twee sleutels die uit een *code* worden opgebouwd
 * — de herkenningsreden op het chipje en het veld dat nog leeg is — houden een
 * `defaultValue`: die valt terug op de code zelf, zodat een code die de
 * bundels nog niet kennen leesbaar blijft in plaats van als kale sleutel op
 * het scherm te verschijnen.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2, Check, CheckCircle2, ExternalLink, Info, Loader2, Sparkles, UserPlus, X,
} from "lucide-react";
import {
  classifyRelationError,
  createRelation,
  fetchRelationDefaults,
  lookupExisting,
  parseSenderDetails,
  relationDocUrl,
  validateRelationDraft,
  type ExistingRelation,
  type RelationDefaults,
  type RelationDraft,
  type RelationResult,
  type SenderInfo,
} from "../lib/erp-relation";

/**
 * Het blauwe "herkend"-chipje. Op moduleniveau (en niet in de render van de
 * dialoog) omdat een component die tijdens de render ontstaat bij elke
 * toetsaanslag opnieuw gemount wordt.
 */
function RecognisedChip({ reasons, prefix }: { reasons: string[]; prefix: string }) {
  const { t } = useTranslation();
  const reason = reasons.find((r) => r.startsWith(`${prefix}:`));
  if (!reason) return null;
  return (
    <span
      title={t(`y_next.rel_reason_${reason.replace(/[:-]/g, "_")}`, { defaultValue: reason })}
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
    >
      <Sparkles size={9} /> {t("y_next.rel_recognised")}
    </span>
  );
}

/** Doorklikbare verwijzing naar het document in ERPNext. */
function DocLink({ doctype, name }: { doctype: "Customer" | "Contact"; name: string }) {
  return (
    <a
      href={relationDocUrl(doctype, name)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
    >
      {name} <ExternalLink size={10} />
    </a>
  );
}

export interface AddRelationDialogProps {
  /** De afzender van de geopende mail: adres, weergavenaam en (optioneel) de body. */
  sender: SenderInfo;
  onClose: () => void;
  /** Wordt aangeroepen zodra er is aangemaakt of een bestaande relatie herbruikt is. */
  onCreated?: (result: RelationResult) => void;
}

export default function AddRelationDialog({ sender, onClose, onCreated }: AddRelationDialogProps) {
  const { t } = useTranslation();

  /* De herkenning draait één keer per afzender; verder is de dialoog gewoon
     een formulier over die uitkomst. */
  const parsed = useMemo(() => parseSenderDetails(sender), [sender]);

  const [customerName, setCustomerName] = useState(parsed.customerName);
  const [firstName, setFirstName] = useState(parsed.contactFirstName);
  const [lastName, setLastName] = useState(parsed.contactLastName ?? "");
  const [email, setEmail] = useState(parsed.email);
  const [phone, setPhone] = useState(parsed.phone ?? "");
  const [customerGroup, setCustomerGroup] = useState("");
  const [territory, setTerritory] = useState("");
  const [createCustomer, setCreateCustomer] = useState(parsed.createCustomer);

  const [defaults, setDefaults] = useState<RelationDefaults | null>(null);
  /* De uitslag draagt het adres waar hij bij hoort. Zonder dat zou een
     wisselende afzender heel even de "al bekend"-melding van de vórige mail
     tonen — en het alternatief (in de effect-body terugzetten naar
     "controleren") is precies de cascade-render die React afraadt. */
  const [lookup, setLookup] = useState<{ email: string; found: ExistingRelation } | null>(null);
  const checking = lookup?.email !== parsed.email;
  const existing = lookup?.email === parsed.email ? lookup.found : null;

  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RelationResult | null>(null);

  /* Keuzelijsten + standaardwaarden uit de instance. Falen ze, dan blijven de
     velden leeg — en dat is precies goed: dan stuurt de payload ze niet mee
     en kiest ERPNext zelf. */
  useEffect(() => {
    let cancelled = false;
    fetchRelationDefaults()
      .then((d) => {
        if (cancelled) return;
        setDefaults(d);
        setCustomerGroup((prev) => prev || d.defaultCustomerGroup);
        setTerritory((prev) => prev || d.defaultTerritory);
      })
      .catch(() => { /* zonder lijsten werkt de dialoog nog steeds */ });
    return () => { cancelled = true; };
  }, []);

  /* Dubbelcheck op het adres. */
  useEffect(() => {
    let cancelled = false;
    const email = parsed.email;
    lookupExisting(email)
      .then((found) => { if (!cancelled) setLookup({ email, found }); })
      // Mislukt de check (rechten, netwerk), dan blokkeert dat het vastleggen
      // niet: leeg resultaat = "niets bekend", ERPNext blijft het vangnet.
      .catch(() => { if (!cancelled) setLookup({ email, found: {} }); });
    return () => { cancelled = true; };
  }, [parsed.email]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const buildDraft = useCallback((): RelationDraft => {
    const draft: RelationDraft = {
      customerName: customerName.trim(),
      customerType: parsed.customerType,
      contactFirstName: firstName.trim(),
      email: email.trim(),
      createCustomer,
      reasons: parsed.reasons,
    };
    if (lastName.trim()) draft.contactLastName = lastName.trim();
    if (phone.trim()) draft.phone = phone.trim();
    if (createCustomer && customerGroup) draft.customerGroup = customerGroup;
    if (createCustomer && territory) draft.territory = territory;
    return draft;
  }, [customerName, firstName, lastName, email, phone, createCustomer,
    customerGroup, territory, parsed.customerType, parsed.reasons]);

  async function handleSubmit() {
    setError("");
    const draft = buildDraft();
    const gaps = validateRelationDraft(draft);
    setMissing(gaps);
    if (gaps.length > 0) return;

    setSaving(true);
    try {
      const created = await createRelation(draft);
      setResult(created);
      onCreated?.(created);
    } catch (err) {
      // `classifyRelationError` levert koppeltekens ("link-missing"); de
      // vertaalsleutels gebruiken underscores.
      const kind = classifyRelationError(err);
      setError(t(`y_next.rel_error_${kind.replace(/-/g, "_")}`));
    } finally {
      setSaving(false);
    }
  }

  const alreadyKnown = Boolean(existing?.contact || existing?.customer || existing?.lead);

  /* ────────────────────────────── Bouwstenen ────────────────────────── */

  const label = (text: string, prefix?: string) => (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      {text}
      {prefix ? <RecognisedChip reasons={parsed.reasons} prefix={prefix} /> : null}
    </span>
  );

  const fieldClass = (name: string) =>
    `w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      missing.includes(name) ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  /* ─────────────────────────────── Render ───────────────────────────── */

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <UserPlus size={14} />
              {t("y_next.rel_dialog_title")}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {sender.displayName ? `${sender.displayName} · ` : ""}{parsed.email}
            </p>
          </div>
          <button onClick={onClose} title={t("common.close")}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {result ? (
            /* ── Klaar ── */
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
              <p className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={14} />
                {result.reused
                  ? t("y_next.rel_done_reused")
                  : t("y_next.rel_done_created")}
              </p>
              <ul className="space-y-1 pl-5">
                {result.customer && (
                  <li>
                    {t("y_next.rel_customer")}: <DocLink doctype="Customer" name={result.customer} />
                  </li>
                )}
                <li>
                  {t("y_next.rel_contact")}: <DocLink doctype="Contact" name={result.contact} />
                </li>
              </ul>
            </div>
          ) : (
            <>
              {/* ── Al bekend ── */}
              {checking && (
                <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Loader2 size={11} className="animate-spin" />
                  {t("y_next.rel_checking")}
                </p>
              )}
              {!checking && alreadyKnown && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Info size={12} />
                    {t("y_next.rel_already_known")}
                  </p>
                  <ul className="space-y-0.5 pl-5">
                    {existing?.contact && (
                      <li>{t("y_next.rel_contact")}: <DocLink doctype="Contact" name={existing.contact} /></li>
                    )}
                    {existing?.customer && (
                      <li>{t("y_next.rel_customer")}: <DocLink doctype="Customer" name={existing.customer} /></li>
                    )}
                    {existing?.lead && (
                      <li>{t("y_next.rel_lead")}: {existing.lead}</li>
                    )}
                  </ul>
                </div>
              )}

              {/* ── No-reply / functiemailbox ── */}
              {parsed.reasons.includes("address:noreply") && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {t("y_next.rel_noreply_warning")}
                </p>
              )}
              {parsed.reasons.includes("address:role") && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  {t("y_next.rel_role_warning")}
                </p>
              )}

              {/* ── Contactpersoon ── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  {label(t("y_next.rel_first_name"), "name")}
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className={fieldClass("contactFirstName")} />
                </label>

                <label className="block">
                  {label(t("y_next.rel_last_name"))}
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className={fieldClass("contactLastName")} />
                </label>

                <label className="block">
                  {label(t("y_next.rel_email"))}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={fieldClass("email")} />
                </label>

                <label className="block">
                  {label(t("y_next.rel_phone"), "phone")}
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("y_next.rel_phone_placeholder")}
                    className={fieldClass("phone")} />
                </label>
              </div>

              {/* ── Relatie ── */}
              <div className="rounded-lg border border-slate-200">
                <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
                  <input type="checkbox" checked={createCustomer} className="cursor-pointer"
                    onChange={(e) => setCreateCustomer(e.target.checked)} />
                  <Building2 size={13} className="text-slate-400" />
                  {t("y_next.rel_also_customer")}
                </label>

                {createCustomer ? (
                  <div className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      {label(t("y_next.rel_customer_name"), "company")}
                      <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                        className={fieldClass("customerName")} />
                    </label>

                    <label className="block">
                      {label(t("y_next.rel_customer_group"))}
                      <select value={customerGroup} onChange={(e) => setCustomerGroup(e.target.value)}
                        className={fieldClass("customerGroup")}>
                        <option value="">{t("y_next.rel_pick_default")}</option>
                        {(defaults?.customerGroups ?? []).map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </label>

                    <label className="block">
                      {label(t("y_next.rel_territory"))}
                      <select value={territory} onChange={(e) => setTerritory(e.target.value)}
                        className={fieldClass("territory")}>
                        <option value="">{t("y_next.rel_pick_default")}</option>
                        {(defaults?.territories ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  </div>
                ) : (
                  <p className="px-3 py-2 text-[11px] text-slate-500">
                    {t("y_next.rel_contact_only")}
                  </p>
                )}
              </div>

              {missing.length > 0 && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {t("y_next.rel_missing_fields", {
                    fields: missing.map((m) => t(`y_next.rel_${toKey(m)}`, { defaultValue: m })).join(", "),
                  })}
                </p>
              )}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-400">
            {result
              ? ""
              : t("y_next.rel_footer_note")}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              {result ? t("common.close") : t("common.cancel")}
            </button>
            {!result && (
              <button onClick={() => void handleSubmit()} disabled={saving || checking}
                className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {saving
                  ? t("y_next.rel_saving")
                  : alreadyKnown
                    ? t("y_next.rel_submit_known")
                    : t("y_next.rel_submit")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** `contactFirstName` → `contact_first_name`: veldcodes camelCase, sleutels snake_case. */
function toKey(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
