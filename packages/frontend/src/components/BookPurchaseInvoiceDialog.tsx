/**
 * Bevestigingsdialoog voor "mail → concept-inkoopfactuur".
 *
 * De dialoog staat bewust tússen de herkenning en de boeking: `detectPurchaseInvoice`
 * vult in wat het in de mail kón vinden, en de gebruiker ziet **welke velden
 * herkend zijn** (het blauwe "herkend"-chipje) voordat hij bevestigt. Dat is
 * het verschil tussen een hulpmiddel en een black box — een veld dat de
 * herkenning niet gevonden heeft is leeg en niet stiekem geraden.
 *
 * Vier dingen die hier expliciet geregeld zijn:
 *
 * - **Btw zit er meteen bij.** Je kiest of het bedrag inclusief of exclusief
 *   btw is en welk btw-sjabloon geldt; de herkenning zet beide alvast op wat
 *   de mail zegt. De regels van het sjabloon gaan mee in de boeking, bij
 *   "inclusief" op inbegrepen, zodat ERPNext het netto zelf uitrekent. Zie
 *   `purchase-invoice-btw.ts`.
 * - **De projectkoppeling van de mail gaat niet verloren.** Boeken zet
 *   `Communication.reference_*` op de nieuwe factuur — een Communication kan
 *   maar aan één document hangen. Stond er een project op, dan verhuist dat
 *   naar het `project`-veld van de factuur, waar het inhoudelijk beter zit.
 * - **Bijlagen worden hergebruikt, niet opnieuw geüpload.** Zie
 *   `bookPurchaseInvoiceFromMail`.
 * - **Dubbel inboeken gaat niet ongemerkt.** Lijkt de factuur al te bestaan
 *   (zelfde nummer, zelfde pdf, of zelfde bedrag op dezelfde datum), dan staat
 *   dat bovenaan en boekt de knop pas na een expliciet "toch inboeken". Zie
 *   `purchase-invoice-duplicates.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ExternalLink, FileText, Loader2, Search, Sparkles, X } from "lucide-react";
import { fetchAttachments, getErpNextLinkUrl, getFileUrl, type FileInfo } from "../lib/erpnext";
import { useDefaultCompany } from "../lib/default-company";
import type { InvoiceGuess, SupplierHint } from "../lib/invoice-detect";
import {
  todayIso,
  validatePurchaseInvoiceInput,
  type PurchaseInvoiceInput,
} from "../lib/purchase-invoice-payload";
import {
  bookPurchaseInvoiceFromMail,
  classifyBookingError,
  fetchExpenseAccounts,
  fetchPayableAccounts,
  fetchPurchaseInvoiceDefaults,
  fetchBtwRegels,
  fetchBtwSjablonen,
  savePurchaseInvoiceDefaults,
  zoekDubbeleInkoopfacturen,
  type AccountOption,
  type BookingResult,
} from "../lib/purchase-invoice";
import {
  dubbelSleutel,
  type BestaandeInkoopfactuur,
  type MogelijkeDubbele,
} from "../lib/purchase-invoice-duplicates";
import {
  btwOverzicht,
  btwRegelsVoorBoeking,
  kiesBtwSjabloon,
  tariefVanRegels,
  type BtwRegel,
  type BtwSjabloon,
  type HerkendeBtw,
} from "../lib/purchase-invoice-btw";

export interface BookPurchaseInvoiceMessage {
  /** Communication-docname. */
  name: string;
  subject: string;
  sender: string;
  /** ERPNext-datetime van de mail. */
  date: string;
  /** Project waaraan de mail nu gekoppeld is, indien van toepassing. */
  project?: string;
}

interface Props {
  message: BookPurchaseInvoiceMessage;
  guess: InvoiceGuess;
  suppliers: SupplierHint[];
  onClose: () => void;
  onBooked: (result: BookingResult) => void;
}

/** Welk veld hoort bij welke herkenningscode (voor het "herkend"-chipje). */
function reasonFor(guess: InvoiceGuess, prefix: string): string | undefined {
  return guess.reasons.find((r) => r.startsWith(`${prefix}:`));
}

export default function BookPurchaseInvoiceDialog({ message, guess, suppliers, onClose, onBooked }: Props) {
  const { t, i18n } = useTranslation();
  /**
   * Bedrijf én bedrijvenlijst komen uit `useDefaultCompany()` en niet uit
   * `useCompanies()`. Twee redenen: de popout-lezer (`/mail/view`) rendert
   * bewust buiten `DataProvider` — een DataContext-hook zou daar gooien en de
   * hele dialoog onbruikbaar maken in precies de weergave waar je een
   * factuurmail via dubbelklik opent — én de keuze van het standaardbedrijf
   * hoort op één plek te staan. Deze dialoog pakte hier eerder zelf
   * `rows[0]?.name` als vangnet; dat is op deze instance alfabetisch het
   * verkeerde bedrijf. Zie `default-company.ts`.
   */
  const { company, setCompany, companies } = useDefaultCompany();
  const [supplier, setSupplier] = useState(guess.supplier ?? "");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [billNo, setBillNo] = useState(guess.invoiceNo ?? "");
  const [billDate, setBillDate] = useState(guess.invoiceDate ?? "");
  const [postingDate, setPostingDate] = useState(() => todayIso());
  const [amount, setAmount] = useState(guess.amount !== undefined ? String(guess.amount) : "");
  const [description, setDescription] = useState(message.subject || "");
  const [expenseAccount, setExpenseAccount] = useState("");
  const [creditTo, setCreditTo] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [remember, setRemember] = useState(false);

  /** Is het ingevulde bedrag inclusief btw? Standaard wat de herkenning vond. */
  const [inclusief, setInclusief] = useState(guess.amountIsGross === true);
  const [btwSjablonen, setBtwSjablonen] = useState<BtwSjabloon[]>([]);
  /**
   * Voor welk bedrijf de sjablonen binnen zijn — ook als het ophalen mislukte.
   * Tot dan geen overzicht en geen boeking: anders stond er even "geen btw"
   * en boekte wie snel klikte zonder btw.
   */
  const [sjablonenVoor, setSjablonenVoor] = useState("");
  /** Een zelf gekozen sjabloon; zolang er niets gekozen is, beslist de herkenning. */
  const [btwKeuze, setBtwKeuze] = useState<string | null>(null);
  const [regelsPerSjabloon, setRegelsPerSjabloon] = useState<Record<string, BtwRegel[]>>({});

  const [expenseOptions, setExpenseOptions] = useState<AccountOption[]>([]);
  const [payableOptions, setPayableOptions] = useState<AccountOption[]>([]);
  const [attachments, setAttachments] = useState<FileInfo[]>([]);
  /**
   * Welke bijlage er naast de dialoog getoond wordt.
   *
   * Het bedrag staat zelden in de mailtekst en bijna altijd in de pdf. Zonder
   * dit venster moest je de bijlage eerst apart openen, het bedrag onthouden
   * en terugkomen — met een dialoog die intussen dicht was.
   */
  const [voorbeeld, setVoorbeeld] = useState<string>("");

  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  /** Bestaande inkoopfacturen die op deze lijken. */
  const [dubbelen, setDubbelen] = useState<MogelijkeDubbele[]>([]);
  /**
   * Voor wélke treffers de gebruiker "toch inboeken" aanvinkte. Een sleutel en
   * geen boolean: verandert het factuurnummer en duikt er een andere factuur
   * op, dan geldt het eerdere vinkje daar niet voor.
   */
  const [bevestigdVoor, setBevestigdVoor] = useState<string | null>(null);
  const dubbelRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  /* Standaardwaarden + rekeningkeuzes horen bij het bedrijf, dus ze laden
     opnieuw zodra dat wisselt. */
  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    fetchPurchaseInvoiceDefaults(company).then((d) => {
      if (cancelled) return;
      setExpenseAccount(d.expenseAccount);
      setCreditTo(d.creditTo);
      setCostCenter(d.costCenter);
    }).catch(() => { /* de velden blijven leeg en zijn zelf in te vullen */ });
    fetchExpenseAccounts(company).then((rows) => { if (!cancelled) setExpenseOptions(rows); }).catch(() => {});
    fetchPayableAccounts(company).then((rows) => { if (!cancelled) setPayableOptions(rows); }).catch(() => {});
    fetchBtwSjablonen(company)
      .then((rows) => { if (!cancelled) { setBtwSjablonen(rows); setSjablonenVoor(company); } })
      .catch(() => { if (!cancelled) setSjablonenVoor(company); });
    return () => { cancelled = true; };
  }, [company]);

  /* Bijlagen van de mail. PDF's staan standaard aan — dát is de factuur; een
     inline handtekeningafbeelding hoort niet aan een boekstuk te hangen. */
  useEffect(() => {
    let cancelled = false;
    fetchAttachments("Communication", message.name).then((files) => {
      if (cancelled) return;
      setAttachments(files);
      setPicked(new Set(files.filter((f) => /\.pdf$/i.test(f.file_name)).map((f) => f.name)));
    }).catch(() => { /* zonder bijlagen boeken mag gewoon */ });
    return () => { cancelled = true; };
  }, [message.name]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) setSupplierOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const supplierMatches = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const rows = q
      ? suppliers.filter((s) => `${s.name} ${s.supplierName ?? ""}`.toLowerCase().includes(q))
      : suppliers;
    return rows.slice(0, 30);
  }, [suppliers, supplierQuery]);

  const parsedAmount = useMemo(() => {
    const normalized = amount.trim().replace(/\s/g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : NaN;
  }, [amount]);

  /**
   * De pdf's van de mail, of ze nu meegaan of niet: ook een uitgevinkte pdf
   * kan al aan een eerder geboekte factuur hangen.
   */
  const pdfBijlagen = useMemo(
    () => attachments.filter((f) => isPdf(f.file_name)).map((f) => f.name),
    [attachments],
  );

  /* Dubbel-controle terwijl je invult. Met een korte pauze, zodat niet elke
     toetsaanslag in het factuurnummer een zoekopdracht wordt. */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!supplier && !billNo.trim() && pdfBijlagen.length === 0) { setDubbelen([]); return; }
      zoekDubbeleInkoopfacturen({ supplier, billNo, billDate, amount: parsedAmount }, pdfBijlagen)
        .then((rows) => { if (!cancelled) setDubbelen(rows); })
        .catch(() => { /* een controle die niet lukt blokkeert het boeken niet */ });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [supplier, billNo, billDate, parsedAmount, pdfBijlagen]);

  const dubbelBevestigd = dubbelen.length === 0 || bevestigdVoor === dubbelSleutel(dubbelen);

  const herkendeBtw: HerkendeBtw = guess.vatShifted
    ? { verlegd: true }
    : guess.vatRate !== undefined ? { tarief: guess.vatRate } : undefined;
  /**
   * Het sjabloon dat geldt. Een eigen keuze wint, zolang die bij het gekozen
   * bedrijf hoort — wissel je van bedrijf, dan beslist de herkenning opnieuw.
   */
  const gekozenSjabloon = btwKeuze !== null && (btwKeuze === "" || btwSjablonen.some((s) => s.name === btwKeuze))
    ? btwKeuze
    : (kiesBtwSjabloon(btwSjablonen, herkendeBtw) ?? "");

  useEffect(() => {
    if (!gekozenSjabloon || regelsPerSjabloon[gekozenSjabloon]) return;
    let cancelled = false;
    fetchBtwRegels(gekozenSjabloon)
      .then((regels) => { if (!cancelled) setRegelsPerSjabloon((vorige) => ({ ...vorige, [gekozenSjabloon]: regels })); })
      .catch(() => { /* zonder regels toont het overzicht niets; boeken haalt ze opnieuw op */ });
    return () => { cancelled = true; };
  }, [gekozenSjabloon, regelsPerSjabloon]);

  const btwRegels = gekozenSjabloon ? regelsPerSjabloon[gekozenSjabloon] : [];
  const sjablonenGeladen = sjablonenVoor === company;
  const overzicht = sjablonenGeladen && btwRegels && Number.isFinite(parsedAmount) && parsedAmount > 0
    ? btwOverzicht(parsedAmount, tariefVanRegels(btwRegels), inclusief)
    : null;

  const buildInput = useCallback((): PurchaseInvoiceInput => {
    const input: PurchaseInvoiceInput = {
      supplier, company, creditTo, expenseAccount,
      postingDate,
      description: description.trim(),
      amount: parsedAmount,
    };
    if (billNo.trim()) input.billNo = billNo.trim();
    if (billDate) input.billDate = billDate;
    if (costCenter) input.costCenter = costCenter;
    if (message.project) input.project = message.project;
    return input;
  }, [supplier, company, creditTo, expenseAccount, postingDate, description, parsedAmount,
    billNo, billDate, costCenter, message.project]);

  async function handleSubmit() {
    setError("");
    const input = buildInput();
    const gaps = validatePurchaseInvoiceInput(input);
    setMissing(gaps);
    if (gaps.length > 0) return;

    setSaving(true);
    try {
      // Vlak voor het boeken nog één keer vers kijken: de controle hierboven
      // wacht op een pauze in het typen en kan dus net achterlopen.
      const actueel = await zoekDubbeleInkoopfacturen(input, pdfBijlagen).catch(() => dubbelen);
      setDubbelen(actueel);
      if (actueel.length > 0 && bevestigdVoor !== dubbelSleutel(actueel)) {
        dubbelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }
      // De btw-regels van het gekozen sjabloon; nog niet binnen, dan nu ophalen.
      if (gekozenSjabloon) {
        const regels = regelsPerSjabloon[gekozenSjabloon] ?? await fetchBtwRegels(gekozenSjabloon);
        if (regels.length > 0) {
          input.taxesTemplate = gekozenSjabloon;
          input.taxes = btwRegelsVoorBoeking(regels, inclusief);
        }
      }
      const result = await bookPurchaseInvoiceFromMail({
        input,
        communication: message.name,
        attachments: attachments
          .filter((f) => picked.has(f.name))
          .map((f) => ({ name: f.name, fileName: f.file_name, fileUrl: f.file_url, isPrivate: f.is_private === 1 })),
      });
      if (remember) {
        // Best effort: of de voorkeur gedeeld of lokaal landt verandert niets
        // aan de zojuist geboekte factuur.
        void savePurchaseInvoiceDefaults(company, { expenseAccount, creditTo, costCenter, currency: "EUR" });
      }
      onBooked(result);
    } catch (err) {
      // `classifyBookingError` levert koppeltekens ("series-stuck"); de
      // vertaalsleutels gebruiken underscores.
      setError(t(`y_next.pinv_error_${classifyBookingError(err).replace(/-/g, "_")}`));
    } finally {
      setSaving(false);
    }
  }

  const RecognisedChip = ({ prefix }: { prefix: string }) => {
    const reason = reasonFor(guess, prefix);
    if (!reason) return null;
    return (
      <span
        title={t(`y_next.pinv_reason_${reason.replace(/[:-]/g, "_")}`, { defaultValue: reason })}
        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
      >
        <Sparkles size={9} /> {t("y_next.pinv_recognised")}
      </span>
    );
  };

  const label = (key: string, prefix?: string) => (
    <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      {t(key)}
      {prefix ? <RecognisedChip prefix={prefix} /> : null}
    </span>
  );

  const fieldClass = (name: string) =>
    `w-full rounded border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
      missing.includes(name) ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  const selectedSupplierLabel = supplier
    ? (suppliers.find((s) => s.name === supplier)?.supplierName ?? supplier)
    : "";

  /**
   * De bijlage die naast het formulier staat: de aangeklikte, en anders de
   * eerste pdf — vrijwel altijd de factuur — of de eerste bijlage die een
   * browser sowieso kan tonen.
   */
  const getoond = attachments.find((f) => f.name === voorbeeld && isToonbaar(f.file_name))
    ?? attachments.find((f) => isPdf(f.file_name))
    ?? attachments.find((f) => isToonbaar(f.file_name));

  const statusVan = (factuur: BestaandeInkoopfactuur) =>
    factuur.docstatus === 0 ? t("y_next.pinv_dup_status_draft")
      : factuur.status === "Paid" ? t("y_next.pinv_dup_status_paid")
        : t("y_next.pinv_dup_status_submitted");

  const bedrag = (waarde: number) =>
    new Intl.NumberFormat(i18n.language || "nl", { style: "currency", currency: "EUR" }).format(waarde);

  return (
    // Bewust een lichte sluier (10%) in plaats van de gebruikelijke 40%: de
    // mailtekst eronder moet leesbaar blijven terwijl dit venster open staat —
    // je opent het juist om iets uit die mail over te nemen. De schaduw en de
    // rand van het paneel doen het scheiden, niet het verduisteren.
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/10 p-4 sm:p-8">
      <div className="flex w-full max-w-7xl items-start gap-4">
      {/* Vanaf een tabletbreedte staat de factuur ernaast; het formulier wordt
          dan smaller en zet zijn velden onder elkaar zodra ze niet meer
          naast elkaar passen (container-breedte, niet schermbreedte). */}
      <div className={`@container w-full flex-shrink-0 rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10 ${
        getoond ? "md:w-[24rem] lg:w-[30rem] xl:w-[38rem]" : "mx-auto max-w-2xl"
      }`}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-800">{t("y_next.pinv_dialog_title")}</h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {message.subject} · {message.sender}
            </p>
          </div>
          <button onClick={onClose} title={t("common.close")}
            className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {dubbelen.length > 0 && (
            <div ref={dubbelRef} data-dubbel-waarschuwing
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {t(dubbelen.some((d) => d.redenen[0] !== "bedrag-datum")
                      ? "y_next.pinv_dup_title_sure"
                      : "y_next.pinv_dup_title_maybe")}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {dubbelen.map(({ factuur, redenen }) => (
                      <li key={factuur.name} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <a href={`${getErpNextLinkUrl()}/purchase-invoice/${encodeURIComponent(factuur.name)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium underline hover:text-amber-700">
                          {factuur.name} <ExternalLink size={10} />
                        </a>
                        {factuur.supplier && <span>{factuur.supplier}</span>}
                        {factuur.bill_no && <span>{factuur.bill_no}</span>}
                        {factuur.bill_date && <span>{factuur.bill_date.split("-").reverse().join("-")}</span>}
                        {typeof factuur.grand_total === "number" && <span>{bedrag(factuur.grand_total)}</span>}
                        <span className="rounded bg-amber-100 px-1 py-px text-[10px]">{statusVan(factuur)}</span>
                        <span className="text-amber-700">
                          {redenen.map((r) => t(`y_next.pinv_dup_reason_${r.replace(/-/g, "_")}`)).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 font-medium">
                    <input type="checkbox" checked={dubbelBevestigd} className="cursor-pointer"
                      onChange={(e) => setBevestigdVoor(e.target.checked ? dubbelSleutel(dubbelen) : null)} />
                    {t("y_next.pinv_dup_confirm")}
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
            {/* Leverancier */}
            <div className="@md:col-span-2" ref={supplierBoxRef}>
              {label("y_next.pinv_supplier", "supplier")}
              <div className="relative">
                <button type="button"
                  onClick={() => { setSupplierOpen((v) => !v); setSupplierQuery(""); }}
                  className={`${fieldClass("supplier")} flex items-center justify-between gap-2 text-left cursor-pointer`}>
                  <span className={selectedSupplierLabel ? "text-slate-800" : "text-slate-400"}>
                    {selectedSupplierLabel || t("y_next.pinv_pick_supplier")}
                  </span>
                  <Search size={12} className="flex-shrink-0 text-slate-400" />
                </button>
                {supplierOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 flex max-h-60 w-full flex-col rounded-lg border border-slate-200 bg-white shadow-lg">
                    <div className="border-b border-slate-100 p-2">
                      <input autoFocus type="search" value={supplierQuery}
                        onChange={(e) => setSupplierQuery(e.target.value)}
                        placeholder={t("y_next.pinv_search_supplier")}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                      {supplierMatches.length === 0 ? (
                        <p className="px-3 py-2 text-xs italic text-slate-400">{t("webmail.no_results")}</p>
                      ) : supplierMatches.map((s) => (
                        <button key={s.name} type="button"
                          onClick={() => { setSupplier(s.name); setSupplierOpen(false); }}
                          className="w-full cursor-pointer truncate px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                          {s.supplierName ?? s.name}
                        </button>
                      ))}
                    </div>
                    {/* Een leverancier aanmaken raakt btw-, betaal- en
                        adresgegevens die niet uit een mail te halen zijn —
                        dat hoort in ERPNext zelf te gebeuren. */}
                    <a href={`${getErpNextLinkUrl()}/supplier/new`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50">
                      <ExternalLink size={10} /> {t("y_next.pinv_new_supplier_hint")}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <label className="block">
              {label("y_next.pinv_company")}
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={fieldClass("company")}>
                {/* Zolang de lijst nog binnenkomt heeft `company` al de
                    opgeloste waarde; zonder deze regel zou de select leeg
                    staan terwijl er wél een bedrijf gekozen is. */}
                {!companies.some((c) => c.name === company) && (
                  <option value={company}>{company || t("common.loading")}</option>
                )}
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>{c.company_name || c.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              {label("y_next.pinv_credit_to")}
              <select value={creditTo} onChange={(e) => setCreditTo(e.target.value)} className={fieldClass("creditTo")}>
                <option value="">{t("y_next.pinv_pick_account")}</option>
                {payableOptions.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </label>

            <label className="block">
              {label("y_next.pinv_bill_no", "invoice-no")}
              <input value={billNo} onChange={(e) => setBillNo(e.target.value)}
                placeholder={t("y_next.pinv_bill_no_placeholder")} className={fieldClass("billNo")} />
            </label>

            <label className="block">
              {label("y_next.pinv_bill_date", "date")}
              <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={fieldClass("billDate")} />
            </label>

            <label className="block">
              {label("y_next.pinv_posting_date")}
              <input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className={fieldClass("postingDate")} />
            </label>

            <label className="block">
              {label("y_next.pinv_amount", "amount")}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">€</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00" className={fieldClass("amount")} />
              </div>
            </label>

            {/* Btw: inclusief of exclusief, en welk sjabloon. */}
            <div data-btw className="grid grid-cols-1 gap-3 @md:col-span-2 @md:grid-cols-2">
              <div>
                <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  {t("y_next.pinv_amount_basis")}
                </span>
                <div role="group" className="flex overflow-hidden rounded border border-slate-200 text-xs">
                  {[false, true].map((incl) => (
                    <button key={String(incl)} type="button" aria-pressed={inclusief === incl}
                      onClick={() => setInclusief(incl)}
                      className={`flex-1 cursor-pointer px-2 py-1.5 transition-colors ${
                        inclusief === incl ? "bg-blue-600 font-medium text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}>
                      {t(incl ? "y_next.pinv_amount_incl" : "y_next.pinv_amount_excl")}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                {label("y_next.pinv_vat", btwKeuze === null && herkendeBtw ? "vat" : undefined)}
                <select value={gekozenSjabloon} onChange={(e) => setBtwKeuze(e.target.value)}
                  disabled={!sjablonenGeladen}
                  className={fieldClass("vat")}>
                  <option value="">{t("y_next.pinv_vat_none")}</option>
                  {btwSjablonen.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </label>
              {overzicht && (
                <p data-btw-overzicht className="text-[11px] text-slate-500 @md:col-span-2">
                  {t("y_next.pinv_vat_totals", {
                    net: bedrag(overzicht.netto), vat: bedrag(overzicht.btw), total: bedrag(overzicht.totaal),
                  })}
                </p>
              )}
            </div>

            <label className="block @md:col-span-2">
              {label("y_next.pinv_description")}
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass("description")} />
            </label>

            <label className="block @md:col-span-2">
              {label("y_next.pinv_expense_account")}
              <select value={expenseAccount} onChange={(e) => setExpenseAccount(e.target.value)}
                className={fieldClass("expenseAccount")}>
                <option value="">{t("y_next.pinv_pick_account")}</option>
                {expenseOptions.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </label>
          </div>

          {message.project && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              {t("y_next.pinv_project_carried", { project: message.project })}
            </p>
          )}

          {/* Bijlagen */}
          <div>
            <p className="mb-1 text-[11px] font-medium text-slate-500">{t("y_next.pinv_attachments")}</p>
            {attachments.length === 0 ? (
              <p className="text-[11px] italic text-slate-400">{t("y_next.pinv_no_attachments")}</p>
            ) : (
              <div className="space-y-1">
                {attachments.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" id={`bijlage-${f.name}`} checked={picked.has(f.name)}
                      className="cursor-pointer"
                      onChange={() => setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(f.name)) next.delete(f.name); else next.add(f.name);
                        return next;
                      })} />
                    {/* De naam is een knop, geen label: klikken toont hem
                        ernaast in plaats van het vinkje om te zetten. */}
                    {isToonbaar(f.file_name) ? (
                      <button type="button" onClick={() => setVoorbeeld(f.name)}
                        title={t("y_next.pinv_show_attachment")}
                        className={`min-w-0 flex-1 truncate text-left hover:text-blue-600 cursor-pointer ${
                          f.name === getoond?.name ? "font-medium text-blue-700" : ""
                        }`}>
                        {f.file_name}
                      </button>
                    ) : (
                      <label htmlFor={`bijlage-${f.name}`} className="min-w-0 flex-1 cursor-pointer truncate">
                        {f.file_name}
                      </label>
                    )}
                    {/* Op een smal scherm is er geen ruimte ernaast; daar
                        opent de bijlage in een eigen tabblad. */}
                    <a href={getFileUrl(f.file_url)} target="_blank" rel="noopener noreferrer"
                      title={t("y_next.pinv_open_attachment")}
                      className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-500">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="cursor-pointer" />
            {t("y_next.pinv_remember_defaults")}
          </label>

          {missing.length > 0 && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {t("y_next.pinv_missing_fields", {
                fields: missing.map((m) => t(`y_next.pinv_${toKey(m)}`)).join(", "),
              })}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>
          )}
        </div>

        {/* Naast de factuur is het formulier smal; de mededeling staat dan
            boven de knoppen in plaats van ertussen geperst. */}
        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 @md:flex-row @md:items-center @md:justify-between @md:gap-3">
          {dubbelBevestigd ? (
            <p className="text-[11px] text-slate-400">{t("y_next.pinv_draft_note")}</p>
          ) : (
            <p className="text-[11px] font-medium text-amber-700">{t("y_next.pinv_dup_blocked")}</p>
          )}
          <div className="flex flex-shrink-0 items-center justify-end gap-2">
            <button onClick={onClose} disabled={saving}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              {t("common.cancel")}
            </button>
            <button onClick={() => void handleSubmit()} disabled={saving || !dubbelBevestigd || !sjablonenGeladen}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? t("y_next.pinv_booking") : t("y_next.pinv_book")}
            </button>
          </div>
        </div>
      </div>

      {/* De bijlage ernaast, vanaf tabletbreedte. Een laptop met 150%
          schaling is maar zo'n 900 pixels breed; wachten tot 1024 betekende
          daar dat het venster er nooit was. Op een telefoon past het niet
          naast het formulier en tonen de meeste mobiele browsers een pdf
          in een frame toch niet — daar is het tabblad-icoon bij de bijlage. */}
      {getoond && (
        <div data-factuur-voorbeeld
          className="sticky top-0 hidden min-w-0 flex-1 flex-col rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/10 md:flex">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
            <FileText size={13} className="flex-shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600" title={getoond.file_name}>
              {getoond.file_name}
            </span>
            <a href={getFileUrl(getoond.file_url)} target="_blank" rel="noopener noreferrer"
              title={t("y_next.pinv_open_attachment")}
              className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ExternalLink size={13} />
            </a>
          </div>
          <iframe
            // `#view=FitH` laat de pdf op breedte passen; anders opent hij op
            // ware grootte en zie je een hoek van de factuur. `navpanes=0`
            // houdt de miniaturenbalk dicht, die in een smal venster de helft
            // van de breedte opeet.
            src={`${getFileUrl(getoond.file_url)}${isPdf(getoond.file_name) ? "#view=FitH&navpanes=0" : ""}`}
            title={getoond.file_name}
            className="h-[calc(70vh+5.5rem)] w-full rounded-b-xl border-0 bg-slate-50"
          />
        </div>
      )}
      </div>
    </div>
  );
}

/** Bijlagen die een browser rechtstreeks kan tonen. */
function isPdf(naam: string): boolean {
  return /\.pdf$/i.test(naam || "");
}

function isToonbaar(naam: string): boolean {
  return isPdf(naam) || /\.(png|jpe?g|gif|webp|svg)$/i.test(naam || "");
}

/** `creditTo` → `credit_to`: de validatiecodes gebruiken camelCase, de
 *  vertaalsleutels snake_case. */
function toKey(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
