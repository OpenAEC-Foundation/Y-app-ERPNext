/**
 * Invoice email helpers — thin wrappers around ERPNext APIs so the
 * SendInvoiceModal does not have to know about Frappe endpoints.
 *
 * Single source of truth = ERPNext. Y-app stores only the two defaults
 * (email template + print format) in `instance_settings`; everything
 * else (subject/body/signature/SMTP/from-address) lives in ERPNext and
 * is fetched live when the modal opens.
 */

import { callMethod, fetchDocument, fetchList, getErpNextAppUrl } from "./erpnext";
import { getActiveInstanceId } from "./instances";

export interface InvoiceEmailDefaults {
  default_email_template: string;
  default_print_format: string;
}

export interface OutgoingEmailAccount {
  name: string;
  email_id: string;
  service?: string;
}

export interface RenderedEmailTemplate {
  subject: string;
  message: string;
}

export interface SendInvoiceEmailArgs {
  name: string;
  subject: string;
  content: string;
  recipients: string;
  cc?: string;
  bcc?: string;
  printFormat: string;
  includeLetterhead: boolean;
  /** Email Account name (NOT email_id) — passed as `sender` so ERPNext
   *  uses this specific outgoing account instead of resolving its own. */
  senderAccount?: string;
}

let cachedSessionUser: string | null = null;

/**
 * Get the current ERPNext user (the User doctype `name`, which equals the
 * login email in ERPNext). Calls Frappe's whitelisted `frappe.auth.get_logged_user`
 * server-side — does NOT rely on localStorage, which Y-app never sets.
 * Cached per session.
 */
export async function getSessionUser(): Promise<string> {
  if (cachedSessionUser !== null) return cachedSessionUser;
  try {
    const res = await callMethod("frappe.auth.get_logged_user", {}) as string | null;
    cachedSessionUser = (typeof res === "string" && res) ? res : "";
    return cachedSessionUser;
  } catch {
    cachedSessionUser = "";
    return "";
  }
}

/** Load Y-app defaults for this instance. Returns empty strings if not set. */
export async function loadInvoiceEmailDefaults(): Promise<InvoiceEmailDefaults> {
  const id = getActiveInstanceId();
  try {
    const res = await fetch(`/api/instances/${id}/settings/invoice-email-defaults`);
    if (!res.ok) return { default_email_template: "", default_print_format: "" };
    const wrapped = await res.json().catch(() => null) as
      | { ok: boolean; value?: Partial<InvoiceEmailDefaults> } | null;
    const value = wrapped?.value || {};
    return {
      default_email_template: value.default_email_template || "",
      default_print_format: value.default_print_format || "",
    };
  } catch {
    return { default_email_template: "", default_print_format: "" };
  }
}

export async function saveInvoiceEmailDefaults(values: InvoiceEmailDefaults): Promise<void> {
  const id = getActiveInstanceId();
  const res = await fetch(`/api/instances/${id}/settings/invoice-email-defaults`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: values }),
  });
  // Don't let silent server-side rejections look like a successful save —
  // the user would see "Saved!" while nothing was persisted.
  if (!res.ok) {
    let detail = "";
    try { const j = await res.json(); detail = j?.error || JSON.stringify(j); } catch { /* ignore */ }
    throw new Error(`Save failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

// Per-user-name signature cache (User.name in ERPNext IS the email/username).
const userSignatureCache = new Map<string, string>();
const accountSignatureCache = new Map<string, string>();

/**
 * Get the `email_signature` field for a specific User by its name (= email
 * in ERPNext). Returns empty string when no user exists with that name or
 * the user has no signature set. Cached per-user.
 */
export async function loadSignatureForUser(userName: string): Promise<string> {
  if (!userName) return "";
  if (userSignatureCache.has(userName)) return userSignatureCache.get(userName)!;
  try {
    const doc = await callMethod("frappe.client.get", {
      doctype: "User",
      name: userName,
    }) as { email_signature?: string } | null;
    const sig = doc?.email_signature || "";
    userSignatureCache.set(userName, sig);
    return sig;
  } catch {
    // User doesn't exist OR no perm. Both cases → no signature from User.
    userSignatureCache.set(userName, "");
    return "";
  }
}

/** Convenience: signature of the currently logged-in ERPNext user. */
export async function loadUserSignature(): Promise<string> {
  const user = await getSessionUser();
  return user ? loadSignatureForUser(user) : "";
}

/**
 * Get the signature attached to a specific Email Account. Each ERPNext
 * Email Account has its own `signature` HTML field, so when the user picks
 * a different "From" account in the modal, the signature must follow.
 *
 * Falls back to User.email_signature when the account has no signature
 * configured of its own.
 */
/** True when an HTML signature has no visible content. Strips tags AND
 *  whitespace; counts `<img>` as visible content so image-only signatures
 *  aren't ignored. */
function isEffectivelyEmpty(html: string): boolean {
  if (!html) return true;
  if (/<img\b/i.test(html)) return false;
  if (/<svg\b/i.test(html)) return false;
  const stripped = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}

export type SignatureSource = "email_account" | "user" | "none";

export interface SignatureResult {
  html: string;
  source: SignatureSource;
}

const accountSignatureSourceCache = new Map<string, SignatureSource>();

/**
 * Resolve signature for a given Email Account, following the chain:
 *   1. Look up the User whose ERPNext name (= email/username) equals the
 *      Email Account's `email_id`. Use that user's `email_signature`.
 *   2. Else: use the Email Account's own `signature` field.
 *   3. Else: empty.
 *
 * So when sending from `administratie@3bm.co.nl`, we look up the User
 * named `administratie@3bm.co.nl` (if it exists) and use ITS signature —
 * NOT the currently-logged-in user's signature.
 */
export async function loadAccountSignature(accountName: string): Promise<SignatureResult> {
  if (!accountName) return { html: "", source: "none" };
  if (accountSignatureCache.has(accountName)) {
    const html = accountSignatureCache.get(accountName)!;
    const source = accountSignatureSourceCache.get(accountName) ?? (html ? "user" : "none");
    return { html, source };
  }

  // Fetch the Email Account doc so we have both email_id (to lookup the
  // matching User) and its own signature (fallback).
  let acctEmailId = "";
  let acctSig = "";
  try {
    const doc = await callMethod("frappe.client.get", {
      doctype: "Email Account",
      name: accountName,
    }) as { email_id?: string; signature?: string; footer?: string } | null;
    acctEmailId = doc?.email_id || "";
    acctSig = doc?.signature || doc?.footer || "";
  } catch { /* ignore — both will stay empty */ }

  // 1. User matching the account's email_id wins (e.g. account
  //    `administratie@3bm.co.nl` → User `administratie@3bm.co.nl`).
  if (acctEmailId) {
    const userSig = await loadSignatureForUser(acctEmailId);
    if (userSig && !isEffectivelyEmpty(userSig)) {
      accountSignatureCache.set(accountName, userSig);
      accountSignatureSourceCache.set(accountName, "user");
      return { html: userSig, source: "user" };
    }
  }

  // 2. Fallback to the Email Account's own signature.
  if (acctSig && !isEffectivelyEmpty(acctSig)) {
    accountSignatureCache.set(accountName, acctSig);
    accountSignatureSourceCache.set(accountName, "email_account");
    return { html: acctSig, source: "email_account" };
  }

  accountSignatureCache.set(accountName, "");
  accountSignatureSourceCache.set(accountName, "none");
  return { html: "", source: "none" };
}

/** Backwards-compatible alias used by older callers. */
export async function loadSenderSignature(): Promise<string> {
  return loadUserSignature();
}

/**
 * Preflight check: which Email Account will ERPNext use to send mail
 * for the current user?
 *
 * ERPNext's resolution order (mirrored here):
 *   1. An Email Account where the current user is in the
 *      `email_account_users` child-table with `default = 1`.
 *      That's the user's personal outgoing account (e.g. each employee
 *      has their own administratie@…/voornaam@… via this table).
 *   2. Fallback: any Email Account where the current user is in
 *      `email_account_users` (default flag missing).
 *   3. Fallback: the globally-configured `default_outgoing=1` account.
 *
 * Returns null when none can be resolved — that's the blocking case;
 * without an outgoing account ERPNext queues the mail forever.
 */
/**
 * Resolve the outgoing Email Accounts available to the current user, plus
 * which one should be the default selection.
 *
 * Resolution order (mirrors what ERPNext's User-form shows under "User
 * Emails" — the link User → Email Account is stored as a child table
 * `user_emails` on the User doc itself, NOT only via Employee or via
 * Email Account's `email_account_users` reverse-link):
 *
 *   1. `User.user_emails[]` → take the first row's linked Email Account
 *      that has `enable_outgoing=1`. That's the user's primary outgoing
 *      account as configured in their ERPNext User profile.
 *   2. Employee.company_email / prefered_email → Email Account.email_id
 *      (fallback when User has no user_emails linked)
 *   3. Globally-configured `default_outgoing=1` account
 *
 * Returns all viable candidates as `options` so the modal can show a
 * dropdown for override, and `preferred` as the auto-selection.
 */
export interface OutgoingResolution {
  preferred: OutgoingEmailAccount | null;
  options: OutgoingEmailAccount[];
}

export async function loadOutgoingEmailAccount(): Promise<OutgoingResolution> {
  const user = await getSessionUser();
  const collected = new Map<string, OutgoingEmailAccount>();

  async function findAccountByEmail(email: string): Promise<OutgoingEmailAccount | null> {
    if (!email) return null;
    try {
      const rows = await fetchList<OutgoingEmailAccount>("Email Account", {
        fields: ["name", "email_id", "service"],
        filters: [["email_id", "=", email], ["enable_outgoing", "=", 1]],
        limit_page_length: 1,
      });
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  let preferred: OutgoingEmailAccount | null = null;

  async function loadAccountByName(name: string): Promise<OutgoingEmailAccount | null> {
    if (!name) return null;
    // No enable_outgoing filter here: the user explicitly linked this account
    // on their User profile. If it's not enable_outgoing in ERPNext, that's
    // an admin-side config issue — ERPNext will surface it at send-time.
    // Keeping the filter would silently drop the right answer and fall back
    // to the wrong (globally default) account.
    try {
      const rows = await fetchList<OutgoingEmailAccount>("Email Account", {
        fields: ["name", "email_id", "service"],
        filters: [["name", "=", name]],
        limit_page_length: 1,
      });
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  // 1: User.user_emails — the canonical "this user's mail accounts" link.
  // CRITICAL: Frappe's REST `/api/resource/User/<name>` does NOT return
  // child tables by default. We use the whitelisted `frappe.client.get`
  // method instead, which returns the full doc including all child tables.
  if (user) {
    try {
      const userDoc = await callMethod("frappe.client.get", {
        doctype: "User", name: user,
      }) as { user_emails?: Array<{ email_account?: string }> } | null;
      const rows = userDoc?.user_emails ?? [];
      for (const row of rows) {
        const acc = await loadAccountByName(row.email_account ?? "");
        if (acc) {
          collected.set(acc.name, acc);
          if (!preferred) preferred = acc;
        }
      }
    } catch { /* User lookup failed → fall through */ }
  }

  // 2+3: look up via Employee linked to this user
  if (user) {
    try {
      const employees = await fetchList<{
        name: string;
        company_email?: string;
        personal_email?: string;
        prefered_email?: string;
      }>("Employee", {
        fields: ["name", "company_email", "personal_email", "prefered_email"],
        filters: [["user_id", "=", user]],
        limit_page_length: 1,
      });
      const emp = employees[0];
      if (emp) {
        // prefered_email field stores a fieldname like "company_email"
        const preferredFieldname = emp.prefered_email;
        const orderedEmails = [
          preferredFieldname === "company_email" ? emp.company_email : undefined,
          preferredFieldname === "personal_email" ? emp.personal_email : undefined,
          emp.company_email,
          emp.personal_email,
        ].filter((e): e is string => !!e);
        for (const email of orderedEmails) {
          const acc = await findAccountByEmail(email);
          if (acc) {
            collected.set(acc.name, acc);
            if (!preferred) preferred = acc;
          }
        }
      }
    } catch { /* employee lookup failed — continue */ }

    // 3: try matching User.email directly
    if (!preferred) {
      const acc = await findAccountByEmail(user);
      if (acc) {
        collected.set(acc.name, acc);
        preferred = acc;
      }
    }

    // 4: parent-query with child filter — accounts where user is listed
    try {
      const childMatches = await fetchList<OutgoingEmailAccount>("Email Account", {
        fields: ["name", "email_id", "service"],
        filters: [
          ["Email Account User", "user", "=", user],
          ["enable_outgoing", "=", 1],
        ],
        limit_page_length: 20,
      });
      for (const acc of childMatches) {
        if (!collected.has(acc.name)) collected.set(acc.name, acc);
      }
      if (!preferred && childMatches.length > 0) preferred = childMatches[0];
    } catch { /* fall through */ }
  }

  // 5: global default_outgoing as last resort
  try {
    const global = await fetchList<OutgoingEmailAccount>("Email Account", {
      fields: ["name", "email_id", "service"],
      filters: [["default_outgoing", "=", 1], ["enable_outgoing", "=", 1]],
      limit_page_length: 1,
    });
    for (const acc of global) {
      if (!collected.has(acc.name)) collected.set(acc.name, acc);
    }
    if (!preferred && global.length > 0) preferred = global[0];
  } catch { /* nothing else to try */ }

  return {
    preferred,
    options: Array.from(collected.values()),
  };
}

/**
 * Render an ERPNext Email Template server-side with a doc as Jinja context.
 * Returns the rendered subject + message — this is the same rendering ERPNext
 * itself does when you select a template in its email dialog.
 *
 * IMPORTANT: ERPNext's `get_email_template` Jinja-renders against the doc dict
 * you pass in. Passing only `{doctype, name}` makes `{{ doc.customer_name }}`
 * etc. render as empty. We therefore fetch the full doc first and pass it.
 */
export async function renderEmailTemplate(
  template: string,
  doctype: string,
  name: string,
): Promise<RenderedEmailTemplate> {
  if (!template) return { subject: "", message: "" };
  try {
    const fullDoc = await fetchDocument<Record<string, unknown>>(doctype, name);
    // Pass the doc as an object (NOT JSON.stringify) — that's what ERPNext's
    // own communication.js does. Frappe's @whitelist parses dict args
    // natively; passing as string makes the doc reach Jinja as a string and
    // placeholders like {{ doc.customer_name }} or {{ customer_name }}
    // render empty.
    const res = await callMethod(
      "frappe.email.doctype.email_template.email_template.get_email_template",
      { template_name: template, doc: fullDoc as unknown as Record<string, unknown> },
    ) as RenderedEmailTemplate | null;
    return {
      subject: res?.subject || "",
      message: res?.message || "",
    };
  } catch {
    return { subject: "", message: "" };
  }
}

/**
 * Fetch the print-preview HTML voor een Frappe doc via de `/api/printview-html`
 * server proxy. Eén bron-van-waarheid voor InvoiceModal-preview én
 * SendInvoiceModal-preview, zodat de asset-rewriting (logo, letterhead) op
 * exact dezelfde manier werkt.
 *
 * MUST go through `window.fetch` (not iframe src=…) so the global fetch
 * interceptor adds the `X-Y-App-Instance` header. An iframe src bypasses
 * the interceptor and the request 401s with "missing_instance".
 *
 * Mirrors the multi-endpoint fallback pattern: different Frappe versions
 * whitelist different print-rendering methods.
 *
 * @param doctype  ERPNext doctype, bv "Sales Invoice"
 * @param name     Doc name
 * @param printFormat  Print Format naam (bv "3BM Factuur Nieuw")
 * @param includeLetterhead  `false` zet `no_letterhead=1` (blanco header)
 * @param cacheBuster  Optionele waarde die als `_t` query-param wordt
 *                     toegevoegd. Gebruik `doc.modified` of een save-counter
 *                     om de browser-cache te omzeilen na server-side
 *                     wijzigingen op dezelfde naam.
 */
export async function fetchPrintPreviewHtml(
  doctype: string,
  name: string,
  printFormat: string,
  includeLetterhead: boolean,
  cacheBuster?: string,
): Promise<string> {
  if (!doctype || !name || !printFormat) return "";
  const noLetterhead = includeLetterhead ? "0" : "1";
  const enc = encodeURIComponent;
  const bust = cacheBuster ? `&_t=${enc(cacheBuster)}` : "";
  const endpoints = [
    `/api/printview-html?doctype=${enc(doctype)}&name=${enc(name)}&format=${enc(printFormat)}&no_letterhead=${noLetterhead}${bust}`,
    `/api/printview-html?doctype=${enc(doctype)}&name=${enc(name)}&print_format=${enc(printFormat)}&no_letterhead=${noLetterhead}${bust}`,
    `/api/method/frappe.client.get_print?doctype=${enc(doctype)}&name=${enc(name)}&print_format=${enc(printFormat)}&no_letterhead=${noLetterhead}${bust}`,
    `/api/method/frappe.www.printview.get_html?doctype=${enc(doctype)}&name=${enc(name)}&format=${enc(printFormat)}&no_letterhead=${noLetterhead}${bust}`,
  ];
  // Iframes loaded via `srcDoc` have base URL `about:srcdoc`, so absolute
  // paths like `/api/erpnext-asset?…` don't resolve to Y-app's origin even
  // with `sandbox="allow-same-origin"`. Inject a `<base href>` pointing at
  // the Y-app origin so the proxy URLs resolve correctly.
  function withBaseHref(html: string): string {
    const base = `<base href="${window.location.origin}/">`;
    if (/<base\b/i.test(html)) return html;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
    }
    return base + html;
  }
  for (const url of endpoints) {
    try {
      // cache: "no-store" voorkomt dat de browser een eerdere render
      // terug-serveert nadat dezelfde URL opnieuw wordt opgevraagd na een
      // save (de query is identiek behalve de _t-buster).
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) continue;
      const text = await r.text();
      if (url.startsWith("/api/printview-html")) {
        // Server already rewrote image/asset URLs to same-origin /api/erpnext-asset.
        if (text.length > 2000 && /<html|<body/i.test(text)) return withBaseHref(text);
      } else if (url.startsWith("/api/method/")) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.message === "string" && parsed.message.length > 100) {
            // These fallback endpoints don't pass through our server rewriter,
            // so do it client-side here. Iframe `<img>` loads bypass the
            // X-Y-App-Instance interceptor → encode instance in query param.
            return withBaseHref(rewriteErpnextAssetUrls(parsed.message, getActiveInstanceId()));
          }
        } catch { /* not JSON */ }
      } else if (text.length > 2000 && /<html|<body/i.test(text)) {
        return withBaseHref(rewriteErpnextAssetUrls(text, getActiveInstanceId()));
      }
    } catch { /* try next */ }
  }
  return "";
}

/**
 * Mirror of the server-side `rewriteErpnextAssetUrls()` in index.ts.
 * Only used for fallback endpoints that don't pass through our printview proxy.
 */
function rewriteErpnextAssetUrls(html: string, instanceId: string): string {
  // Without a numeric instance ID the server-side asset endpoint can't
  // resolve which ERPNext sid to use and returns 401, so emit the original
  // HTML untouched (lets `<base href>` + direct ERPNext loads still work
  // when ERPNext happens to be browser-reachable).
  if (!instanceId || instanceId === "default" || Number.isNaN(parseInt(instanceId, 10))) {
    return html;
  }
  const proxy = `/api/erpnext-asset?instance=${encodeURIComponent(instanceId)}&path=`;
  const erpHost = getErpNextAppUrl().replace(/\/$/, "");
  let out = html;
  // 1. Absolute ERPNext URLs (https://erp.host/files/...) → route via proxy
  if (erpHost) {
    const hostEsc = erpHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const absRe = new RegExp(`(["'(])${hostEsc}(/(?:files|private/files|assets)/[^"')\\s]+)`, "g");
    out = out.replace(absRe, (_m, q, p) => `${q}${proxy}${encodeURIComponent(p)}`);
  }
  // 2. Relative src/href
  out = out.replace(
    /((?:src|href)=)(["'])(\/(?:files|private\/files|assets)\/[^"']+)\2/g,
    (_m, attr, q, p) => `${attr}${q}${proxy}${encodeURIComponent(p)}${q}`,
  );
  // 3. CSS url(/files/…)
  out = out.replace(
    /url\((["']?)(\/(?:files|private\/files|assets)\/[^"')]+)\1\)/g,
    (_m, q, p) => `url(${q}${proxy}${encodeURIComponent(p)}${q})`,
  );
  return out;
}

/**
 * Submit a DRAFT Sales Invoice (docstatus 0 → 1) before sending.
 * Frappe v15+ requires the full doc as a JSON string — same signature as
 * the Timesheet "Goedkeuren" flow and the InvoiceModal's "Akkoord" button.
 */
export async function submitInvoice(name: string): Promise<void> {
  const fresh = await fetchDocument("Sales Invoice", name);
  await callMethod("frappe.client.submit", { doc: JSON.stringify(fresh) });
}

/**
 * Send an invoice email via ERPNext's own Communication mechanism.
 * After this returns successfully:
 *   - ERPNext has rendered the PDF using `printFormat` and attached it
 *   - A Communication record is in the invoice's timeline
 *   - The mail is in ERPNext's Email Queue and the scheduler will send it
 *     via the configured outgoing Email Account
 *   - User.email_signature is automatically appended to `content`
 *
 * We deliberately do NOT pass `email_template` here — the caller has
 * already let the user edit subject/content from the rendered template,
 * so passing the template again would overwrite their tweaks.
 */
export async function sendInvoiceEmail(args: SendInvoiceEmailArgs): Promise<void> {
  await callMethod("frappe.core.doctype.communication.email.make", {
    doctype: "Sales Invoice",
    name: args.name,
    subject: args.subject,
    content: args.content,
    recipients: args.recipients,
    cc: args.cc || "",
    bcc: args.bcc || "",
    send_email: 1,
    print_format: args.printFormat,
    print_letterhead: args.includeLetterhead ? 1 : 0,
    attach_document_print: 1,
    print_html: 0,
    communication_medium: "Email",
    sent_or_received: "Sent",
    // Pin the outgoing Email Account so ERPNext doesn't pick a different
    // one. `sender` here is the Email Account `name` (which is also its
    // identifier); ERPNext resolves it server-side.
    ...(args.senderAccount ? { sender: args.senderAccount } : {}),
  });
}

export interface EmailTemplateOption {
  name: string;
  subject?: string;
}

export async function fetchInvoiceEmailTemplates(): Promise<EmailTemplateOption[]> {
  return fetchList<EmailTemplateOption>("Email Template", {
    fields: ["name", "subject"],
    limit_page_length: 0,
    order_by: "name asc",
  });
}

export interface PrintFormatOption {
  name: string;
}

export async function fetchSalesInvoicePrintFormats(): Promise<PrintFormatOption[]> {
  return fetchList<PrintFormatOption>("Print Format", {
    fields: ["name"],
    filters: [["doc_type", "=", "Sales Invoice"]],
    limit_page_length: 0,
    order_by: "name asc",
  });
}
