import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Mail, Phone, Building2, Tag, X,
  RefreshCw, ExternalLink, Send, UserPlus, ChevronRight,
  Loader2, Users, AtSign,
} from "lucide-react";
import { fetchList, getErpNextLinkUrl } from "../lib/erpnext";
import { getActiveCompany, setActiveCompany } from "../lib/instances";
import CompanySelect from "../components/CompanySelect";
import { useTranslation } from "react-i18next";

/* ─── Types ─── */

interface ERPNextContact {
  name: string;
  first_name: string;
  last_name: string;
  email_id: string;
  phone: string;
  mobile_no: string;
  company_name: string;
  designation: string;
  department: string;
}

interface EmailContact {
  email: string;
  name: string;
  count: number;
}

interface MergedContact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  mobile: string;
  company: string;
  designation: string;
  department: string;
  source: "erpnext" | "email" | "both";
  erpnextId?: string;
  emailCount: number;
}

/* ─── Alphabet ─── */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/* ─── Component ─── */

export default function Contacts() {
  const { t } = useTranslation();
  const [erpContacts, setErpContacts] = useState<ERPNextContact[]>([]);
  const [emailContacts, setEmailContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(getActiveCompany());
  const [search, setSearch] = useState("");
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<MergedContact | null>(null);

  /* ─── Fetch ERPNext contacts ─── */

  const [error, setError] = useState("");

  const loadErpContacts = useCallback(async () => {
    setError("");
    try {
      // Include contacts whose company matches OR that have no company set —
      // ERPNext Contacts often have company_name = null.
      const filters: unknown[][] = [];
      if (company) filters.push(["company_name", "in", [company, ""]]);
      const list = await fetchList<ERPNextContact>("Contact", {
        fields: [
          "name", "first_name", "last_name", "email_id",
          "phone", "mobile_no", "company_name", "designation", "department",
        ],
        filters,
        limit_page_length: 0,
        order_by: "modified desc",
      });
      setErpContacts(list);
    } catch (e) {
      console.error("Contacts fetch error:", e);
      setError(e instanceof Error ? e.message : t("contacts.fetch_error"));
    }
  }, [company]);

  /* ─── Fetch email contacts ─── */

  const loadEmailContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/mail/contacts`, { credentials: "same-origin" });
      if (res.ok) {
        const json = await res.json();
        setEmailContacts(json.data || []);
      }
    } catch {
      /* endpoint may not exist yet — silently ignore */
    }
  }, []);

  /* ─── Load on mount / company change ─── */

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadErpContacts(), loadEmailContacts()]);
    setLoading(false);
  }, [loadErpContacts, loadEmailContacts]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ─── Merge logic ─── */

  const merged = useMemo<MergedContact[]>(() => {
    const byEmail = new Map<string, MergedContact>();

    // ERPNext contacts first (priority)
    for (const c of erpContacts) {
      const email = (c.email_id || "").toLowerCase().trim();
      const key = email || `erp_${c.name}`;
      const fullName =
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        c.company_name ||
        c.email_id ||
        c.name;
      byEmail.set(key, {
        id: key,
        firstName: c.first_name || "",
        lastName: c.last_name || "",
        fullName,
        email: c.email_id || "",
        phone: c.phone || "",
        mobile: c.mobile_no || "",
        company: c.company_name || "",
        designation: c.designation || "",
        department: c.department || "",
        source: "erpnext",
        erpnextId: c.name,
        emailCount: 0,
      });
    }

    // Merge email contacts
    for (const ec of emailContacts) {
      const email = (ec.email || "").toLowerCase().trim();
      if (!email) continue;
      const existing = byEmail.get(email);
      if (existing) {
        existing.source = "both";
        existing.emailCount = ec.count || 0;
        // Fill in name if ERPNext didn't have one
        if (!existing.fullName || existing.fullName === existing.erpnextId) {
          existing.fullName = ec.name || email;
          const parts = (ec.name || "").split(" ");
          existing.firstName = parts[0] || "";
          existing.lastName = parts.slice(1).join(" ");
        }
      } else {
        const parts = (ec.name || "").split(" ");
        const fullName = ec.name || email;
        byEmail.set(email, {
          id: email,
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" "),
          fullName,
          email,
          phone: "",
          mobile: "",
          company: "",
          designation: "",
          department: "",
          source: "email",
          emailCount: ec.count || 0,
        });
      }
    }

    return Array.from(byEmail.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "nl")
    );
  }, [erpContacts, emailContacts]);

  /* ─── Filter ─── */

  const filtered = useMemo(() => {
    let list = merged;

    if (letterFilter) {
      list = list.filter((c) =>
        c.fullName.toUpperCase().startsWith(letterFilter)
      );
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.fullName.toLowerCase().includes(s) ||
          c.email.toLowerCase().includes(s) ||
          c.phone.toLowerCase().includes(s) ||
          c.mobile.toLowerCase().includes(s) ||
          c.company.toLowerCase().includes(s) ||
          c.designation.toLowerCase().includes(s) ||
          c.department.toLowerCase().includes(s)
      );
    }

    return list;
  }, [merged, search, letterFilter]);

  /* ─── Available letters ─── */

  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    for (const c of merged) {
      const first = c.fullName.charAt(0).toUpperCase();
      if (first >= "A" && first <= "Z") letters.add(first);
    }
    return letters;
  }, [merged]);

  /* ─── Source badge ─── */

  function SourceBadge({ source }: { source: MergedContact["source"] }) {
    if (source === "both") {
      return (
        <div className="flex gap-1">
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-y-teal/10 text-y-teal-dark">
            ERPNext
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">
            Email
          </span>
        </div>
      );
    }
    if (source === "erpnext") {
      return (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-y-teal/10 text-y-teal-dark">
          ERPNext
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">
        Email
      </span>
    );
  }

  /* ─── Initials avatar ─── */

  function Avatar({ contact, size = "md" }: { contact: MergedContact; size?: "sm" | "md" | "lg" }) {
    const initials = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase())
      .join("") || contact.fullName.charAt(0).toUpperCase() || "?";

    const sizeClasses = {
      sm: "w-8 h-8 text-xs",
      md: "w-10 h-10 text-sm",
      lg: "w-16 h-16 text-xl",
    };

    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-y-teal/10 text-y-teal-dark font-semibold flex items-center justify-center flex-shrink-0`}
      >
        {initials}
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="flex h-full bg-slate-50">
      {/* ─── Left sidebar: search + letter filter — hidden on mobile, the
           main header shows a condensed search row instead ─── */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("sidebar.global_search") + "..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Company filter */}
        <div className="px-3 py-2 border-b border-slate-100">
          <CompanySelect
            value={company}
            onChange={(v) => {
              setCompany(v);
              setActiveCompany(v);
            }}
            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-y-teal"
          />
        </div>

        {/* Letter filter */}
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setLetterFilter(null)}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium mb-1 transition-colors ${
              letterFilter === null
                ? "bg-y-teal/10 text-y-teal-dark"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t("contacts.all_count", { count: merged.length })}
          </button>
          {ALPHABET.map((letter) => {
            const count = merged.filter(
              (c) => c.fullName.toUpperCase().startsWith(letter)
            ).length;
            const available = availableLetters.has(letter);
            return (
              <button
                key={letter}
                onClick={() => available && setLetterFilter(letter === letterFilter ? null : letter)}
                disabled={!available}
                className={`w-full text-left px-3 py-1 rounded-lg text-sm transition-colors ${
                  letterFilter === letter
                    ? "bg-y-teal/10 text-y-teal-dark font-medium"
                    : available
                    ? "text-slate-600 hover:bg-slate-50"
                    : "text-slate-300 cursor-default"
                }`}
              >
                {letter}
                {available && (
                  <span className="ml-1 text-xs text-slate-400">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Refresh */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={loadAll}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {/* ─── Main area: contact list ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-slate-200 flex flex-col gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-5 h-5 text-y-teal shrink-0" />
            <h1 className="text-lg font-semibold text-slate-800 shrink-0">{t("nav.contacts")}</h1>
            <span className="text-sm text-slate-500 truncate">
              {t("contacts.count_label", { count: filtered.length })}
              {letterFilter && t("contacts.letter_prefix", { letter: letterFilter })}
              {search && ` — "${search}"`}
            </span>
          </div>
          {/* Mobile-only search (desktop uses the left sidebar) */}
          <div className="md:hidden relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("sidebar.global_search") + "..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-y-teal"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-3 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Contact grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-6 h-6 text-y-teal animate-spin" />
              <span className="ml-2 text-slate-500">{t("contacts.loading")}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Users className="w-12 h-12 mb-3" />
              <p className="text-sm">{t("contacts.no_contacts")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {filtered.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`text-left p-4 bg-white rounded-xl border transition-all hover:shadow-md ${
                    selectedContact?.id === contact.id
                      ? "border-y-teal ring-1 ring-y-teal/30 shadow-md"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar contact={contact} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-800 text-sm truncate">
                          {contact.fullName}
                        </span>
                        <SourceBadge source={contact.source} />
                      </div>
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mb-0.5">
                          <AtSign className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {(contact.phone || contact.mobile) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mb-0.5">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contact.phone || contact.mobile}</span>
                        </div>
                      )}
                      {contact.company && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contact.company}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right panel: contact detail — overlay on mobile, fixed-width side
           panel on desktop ─── */}
      {selectedContact && (
        <div className="fixed inset-0 z-40 pt-[env(safe-area-inset-top,0px)] md:pt-0 md:static md:inset-auto md:z-auto md:w-96 md:flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-3 sm:p-6 border-b border-slate-100">
            {/* Mobile back button */}
            <button
              onClick={() => setSelectedContact(null)}
              className="md:hidden flex items-center gap-1 mb-3 -ml-1 px-2 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm"
            >
              <ChevronRight className="w-5 h-5 rotate-180" /> {t("common.back") || "Back"}
            </button>
            <div className="flex items-start justify-between mb-4">
              <Avatar contact={selectedContact} size="lg" />
              <button
                onClick={() => setSelectedContact(null)}
                className="hidden md:block text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              {selectedContact.fullName}
            </h2>
            {selectedContact.designation && (
              <p className="text-sm text-slate-500">{selectedContact.designation}</p>
            )}
            <div className="mt-2">
              <SourceBadge source={selectedContact.source} />
            </div>
          </div>

          {/* Contact details */}
          <div className="p-3 sm:p-6 border-b border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t("contacts.contact_details")}
            </h3>

            {selectedContact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a
                  href={`mailto:${selectedContact.email}`}
                  className="text-sm text-y-teal hover:underline truncate"
                >
                  {selectedContact.email}
                </a>
              </div>
            )}

            {selectedContact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="text-sm text-slate-700 hover:text-y-teal"
                >
                  {selectedContact.phone}
                </a>
              </div>
            )}

            {selectedContact.mobile && selectedContact.mobile !== selectedContact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a
                  href={`tel:${selectedContact.mobile}`}
                  className="text-sm text-slate-700 hover:text-y-teal"
                >
                  {selectedContact.mobile}
                  <span className="ml-1 text-xs text-slate-400">{t("contacts.mobile_suffix")}</span>
                </a>
              </div>
            )}

            {selectedContact.company && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{selectedContact.company}</span>
              </div>
            )}

            {selectedContact.department && (
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{selectedContact.department}</span>
              </div>
            )}
          </div>

          {/* Email history summary */}
          {selectedContact.emailCount > 0 && (
            <div className="p-3 sm:p-6 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {t("contacts.email_history")}
              </h3>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {t("contacts.email_count", { count: selectedContact.emailCount })}
                  </p>
                  <p className="text-xs text-slate-500">{t("contacts.messages_exchanged")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="p-3 sm:p-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {t("contacts.actions")}
            </h3>
            <div className="space-y-2">
              {selectedContact.email && (
                <a
                  href={`mailto:${selectedContact.email}`}
                  className="flex items-center gap-3 w-full px-3 py-2.5 bg-y-teal/5 hover:bg-y-teal/10 text-y-teal-dark rounded-lg text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {t("contacts.send_email")}
                </a>
              )}

              {selectedContact.erpnextId ? (
                <a
                  href={`${getErpNextLinkUrl()}/contact/${selectedContact.erpnextId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("contacts.open_in_erpnext")}
                </a>
              ) : (
                <button
                  className="flex items-center gap-3 w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (selectedContact.firstName) params.set("first_name", selectedContact.firstName);
                    if (selectedContact.lastName) params.set("last_name", selectedContact.lastName);
                    if (selectedContact.email) params.set("email_id", selectedContact.email);
                    window.open(`${getErpNextLinkUrl()}/contact/new?${params.toString()}`, "_blank");
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  {t("contacts.create_in_erpnext")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
