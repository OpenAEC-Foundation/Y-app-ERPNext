import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Check, Send, Loader2, FileText, ExternalLink, Trash2, Plus, Mail,
} from "lucide-react";
import CompanySelect from "../components/CompanySelect";
import CustomerSearchSelect, { type Customer } from "../components/CustomerSearchSelect";
import ItemSearchSelect, { type QuotationItem } from "../components/ItemSearchSelect";
import { createDocument, callMethod, fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { getActiveCompany } from "../lib/instances";
import { useToast } from "../components/Toast";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

interface HistoryQuotation {
  name: string;
  transaction_date: string;
  net_total: number;
  status: string;
}

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Open: "bg-y-teal/10 text-y-teal-dark",
  Replied: "bg-purple-100 text-purple-700",
  Ordered: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
  Cancelled: "bg-slate-100 text-slate-600",
  Expired: "bg-orange-100 text-orange-700",
};

export default function QuotationCreateModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  // Form state
  const [company, setCompany] = useState(() => getActiveCompany());
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [description, setDescription] = useState("");
  const [validTill, setValidTill] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  // Customer history
  const [history, setHistory] = useState<HistoryQuotation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Create + email state
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
  const canCreate = !!company && !!customer && items.length > 0;

  // Load customer history
  async function loadHistory(customerName: string) {
    setLoadingHistory(true);
    try {
      const list = await fetchList<HistoryQuotation>("Quotation", {
        fields: ["name", "transaction_date", "net_total", "status"],
        filters: [["party_name", "=", customerName]],
        limit_page_length: 8,
        order_by: "transaction_date desc",
      });
      setHistory(list);
    } catch { setHistory([]); }
    finally { setLoadingHistory(false); }
  }

  function handleCustomerChange(c: Customer | null) {
    setCustomer(c);
    if (c) {
      loadHistory(c.customer_name);
      setEmailTo(c.email_id || "");
    } else {
      setHistory([]);
      setEmailTo("");
    }
  }

  function handleAddItem(item: QuotationItem) {
    setItems((prev) => [...prev, { ...item, amount: item.qty * item.rate }]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(index: number, field: keyof QuotationItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "qty" || field === "rate") updated.amount = Number(updated.qty) * Number(updated.rate);
      return updated;
    }));
  }

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    try {
      const doc = await createDocument<{ name: string }>("Quotation", {
        company,
        party_name: customer!.customer_name,
        transaction_date: new Date().toISOString().split("T")[0],
        valid_till: validTill,
        custom_description: description || undefined,
        items: items.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
          qty: item.qty,
          rate: item.rate,
          uom: item.uom,
        })),
      });
      setCreatedName(doc.name);
      setEmailSubject(t("quotation_create.email_subject_default", { name: doc.name }));
      setEmailBody(t("quotation_create.email_body_default", {
        customer: customer!.customer_name,
        name: doc.name,
        total: grandTotal.toLocaleString("nl-NL", { style: "currency", currency: "EUR" }),
      }));
      toast.success(t("quotation_create.created_success", { name: doc.name }));
      onCreated?.();
    } catch (err) {
      toast.error((err as Error).message || t("quotation_create.create_error"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSendEmail() {
    if (!createdName || !emailTo) return;
    setSending(true);
    try {
      await callMethod("frappe.core.doctype.communication.email.make", {
        recipients: emailTo,
        subject: emailSubject,
        content: emailBody,
        doctype: "Quotation",
        name: createdName,
        send_email: 1,
      });
      toast.success(t("quotation_create.email_sent", { email: emailTo }));
      setEmailSent(true);
    } catch (err) {
      toast.error((err as Error).message || t("quotation_create.email_error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-y-teal" />
            <h2 className="text-lg font-bold text-slate-800">{t("quotation_create.title")}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg cursor-pointer">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Body — single screen layout */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex gap-6">
            {/* Left: main form */}
            <div className="flex-1 space-y-5">
              {/* Company + Customer + Date row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.company")}</label>
                  <CompanySelect value={company} onChange={setCompany} includeAll={false} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.customer")}</label>
                  <CustomerSearchSelect value={customer} onChange={handleCustomerChange} company={company} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.valid_till")}</label>
                  <input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.description")}</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("quotation_create.description_placeholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
              </div>

              {/* Items search */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{t("quotation_create.add_items_hint")}</label>
                <ItemSearchSelect onAdd={handleAddItem} />
              </div>

              {/* Items table */}
              {items.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{t("quotation_create.col_item")}</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 w-56">{t("quotation_create.col_description")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-16">{t("quotation_create.col_qty")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-24">{t("quotation_create.col_rate")}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 w-24">{t("quotation_create.col_amount")}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100">
                          <td className="px-3 py-2">
                            <input type="text" value={item.item_name}
                              onChange={(e) => handleItemChange(i, "item_name", e.target.value)}
                              className="w-full text-sm text-slate-700 font-medium bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-y-teal rounded px-1 -mx-1" />
                            <p className="text-[10px] font-mono text-slate-400 px-1">{item.item_code}</p>
                          </td>
                          <td className="px-3 py-2">
                            <textarea value={item.description}
                              onChange={(e) => handleItemChange(i, "description", e.target.value)}
                              rows={2}
                              className="w-full text-xs text-slate-500 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-y-teal rounded px-1 -mx-1 resize-y" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0.01" step="0.01" value={item.qty}
                              onChange={(e) => handleItemChange(i, "qty", parseFloat(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-y-teal" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={item.rate}
                              onChange={(e) => handleItemChange(i, "rate", parseFloat(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-y-teal" />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-slate-700">
                            {item.amount.toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                          </td>
                          <td className="px-1 py-2">
                            <button onClick={() => handleRemoveItem(i)} className="p-1 text-slate-300 hover:text-red-500 cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-slate-600">{t("quotation_create.total")}</td>
                        <td className="px-3 py-3 text-right text-base font-bold text-slate-800">
                          {grandTotal.toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  <Plus size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("quotation_create.add_items_hint")}</p>
                </div>
              )}

              {/* Email section — only after creation */}
              {createdName && (
                <div className="border border-green-200 rounded-xl p-4 bg-green-50/50 space-y-4">
                  <div className="flex items-center gap-3">
                    <Check size={18} className="text-green-600" />
                    <span className="text-sm font-semibold text-green-800">
                      {t("quotation_create.created_success", { name: createdName })}
                    </span>
                    <a href={`${getErpNextLinkUrl()}/quotation/${createdName}`} target="_blank" rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-y-teal hover:text-y-teal-dark">
                      <ExternalLink size={12} /> ERPNext
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.email_to")}</label>
                      <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.email_subject")}</label>
                      <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t("quotation_create.email_body")}</label>
                    <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal resize-y" />
                  </div>
                  {emailSent ? (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Mail size={14} /> {t("quotation_create.email_sent", { email: emailTo })}
                    </div>
                  ) : (
                    <button onClick={handleSendEmail} disabled={sending || !emailTo}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
                      {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {t("quotation_create.send_email")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar: customer history */}
            {customer && (
              <div className="w-56 flex-shrink-0">
                <h4 className="text-xs font-semibold text-slate-500 mb-2">{t("quotation_create.history_title")}</h4>
                {loadingHistory ? (
                  <p className="text-xs text-slate-400">...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("quotation_create.no_history")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {history.map((q) => (
                      <a key={q.name} href={`${getErpNextLinkUrl()}/quotation/${q.name}`} target="_blank" rel="noopener noreferrer"
                        className="block p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-y-teal">{q.name}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded-full ${statusColors[q.status] || "bg-slate-100 text-slate-600"}`}>{q.status}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-slate-400">{q.transaction_date}</span>
                          <span className="text-[11px] font-semibold text-slate-700">
                            {q.net_total.toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            {createdName ? t("common.close") : t("common.cancel")}
          </button>
          {!createdName && (
            <button onClick={handleCreate} disabled={!canCreate || creating}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-y-teal rounded-lg hover:bg-y-teal-dark disabled:opacity-50 cursor-pointer">
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t("quotation_create.create_quotation")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
