/**
 * Email-signature cache, extracted verbatim from pages/Webmail.tsx. The mutable
 * `signatureCache` Map lives ONLY here — it is written by ImapSetup and
 * ComposeWindow, so it must never be re-instantiated elsewhere.
 */
import { getActiveInstanceId } from "./instances";
import { getSignatureOverride, extractSignatureFragment } from "./mailSignature";

export const signatureCache = new Map<string, string>(); // key: email address, value: HTML signature

/**
 * Cache schema: v5 stores the signature plus a fetched-at timestamp so we
 * can refetch missing/empty signatures every 24h. v4 cached the empty
 * string forever, which meant once a user opened compose before their
 * ERPNext signature was set, the local cache stayed empty forever — even
 * after they configured one in ERPNext. v5 also normalises the email key
 * to lowercase to avoid casing-mismatches between IMAP user (lowercased)
 * and the keys we stored historically.
 */
export const SIGNATURE_REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedSignature {
  sig: string;
  ts: number;
}

/** ERPNext gebruikt Quill voor signature-velden en bewaart een leeg `<div class="ql-editor"><p><br></p></div>`
 * wrapper zelfs als de gebruiker niets heeft ingevuld. Treat als effectief leeg. */
export function isEffectivelySignatureEmpty(html: string): boolean {
  if (!html) return true;
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const text = (tmp.textContent || "").trim();
    if (text.length > 0) return false;
    // Geen tekst → kijk naar zinvolle media (img, hr, table, etc.)
    return !tmp.querySelector("img, hr, table, svg");
  } catch {
    return false;
  }
}

export async function fetchEmailSignature(emailAddress: string): Promise<string> {
  const key = emailAddress.toLowerCase();

  // Handmatige handtekening (Instellingen → Email accounts) heeft voorrang op
  // de uit ERPNext opgehaalde. Volledig document → alleen de body-fragment
  // gebruiken (inline styles + base64-afbeeldingen blijven behouden).
  const override = getSignatureOverride(emailAddress);
  if (override && override.trim()) {
    return extractSignatureFragment(override);
  }

  // In-memory cache: trust within the same session.
  const cached = signatureCache.get(key);
  if (cached !== undefined) {
    // W1: auto-heal eerdere Quill-empty-wrapper entries
    if (cached && isEffectivelySignatureEmpty(cached)) {
      console.warn("[Webmail] In-memory cached signature is feitelijk leeg (Quill wrapper); clearing cache");
      signatureCache.delete(key);
    } else {
      console.info("[Webmail] Signature from in-memory cache for", emailAddress, cached ? `(${cached.length} chars)` : "(EMPTY) — klik ↻ refresh-knop om opnieuw te laden");
      return cached;
    }
  }

  // localStorage v5: { sig, ts }. Use as the source of truth UNLESS the
  // signature is empty AND older than the refresh interval (so empty caches
  // self-heal once the user configures a signature in ERPNext).
  const id = getActiveInstanceId();
  const lsKey = `mail_signature_v5_${id}_${key}`;
  const raw = localStorage.getItem(lsKey);
  if (raw !== null) {
    try {
      const parsed: CachedSignature = JSON.parse(raw);
      const fresh = Date.now() - parsed.ts < SIGNATURE_REFRESH_MS;
      if (parsed.sig || fresh) {
        // W1: auto-heal Quill-empty-wrapper entries
        if (parsed.sig && isEffectivelySignatureEmpty(parsed.sig)) {
          console.warn("[Webmail] localStorage signature is feitelijk leeg (Quill wrapper); clearing en refetch");
          localStorage.removeItem(lsKey);
          // val door naar fetch
        } else {
          signatureCache.set(key, parsed.sig);
          const ageHours = ((Date.now() - parsed.ts) / 3600000).toFixed(1);
          console.info("[Webmail] Signature from localStorage for", emailAddress, parsed.sig ? `(${parsed.sig.length} chars, ${ageHours}h oud)` : `(EMPTY, ${ageHours}h oud) — klik ↻ refresh-knop om opnieuw te proberen`);
          return parsed.sig;
        }
      }
      console.info("[Webmail] localStorage signature is empty + stale, refetching from ERPNext for", emailAddress);
      // Empty + stale → fall through to refetch
    } catch {
      // Corrupt entry — clear and refetch.
      localStorage.removeItem(lsKey);
    }
  } else {
    console.info("[Webmail] No cached signature, fetching from ERPNext for", emailAddress);
  }

  try {
    const params = new URLSearchParams({ email: emailAddress });
    const res = await fetch(`/api/mail/signature?${params}`, { credentials: "same-origin" });
    if (res.ok) {
      const json = await res.json();
      let sig: string = json.data?.signature || "";
      // W1: detecteer Quill-empty-wrapper en behandel als leeg
      if (sig && isEffectivelySignatureEmpty(sig)) {
        console.warn("[Webmail] Signature van ERPNext is feitelijk leeg (Quill wrapper zonder inhoud) voor", emailAddress, "— ga in ERPNext naar User → email_signature, of Email Account → signature, en vul daadwerkelijk een handtekening in. Bron:", json?.data?.source, "Diag:", json?.data?.diag);
        sig = "";
      }
      signatureCache.set(key, sig);
      localStorage.setItem(lsKey, JSON.stringify({ sig, ts: Date.now() } as CachedSignature));
      if (sig) {
        console.info("[Webmail] Signature loaded for", emailAddress, `(${sig.length} chars, bron: ${json?.data?.source})`);
      } else {
        console.warn("[Webmail] Empty signature from ERPNext for", emailAddress, "— Diag-route:", json?.data?.diag || "(geen diag-info)");
      }
      return sig;
    }
    console.warn("[Webmail] /api/mail/signature returned", res.status, "for", emailAddress);
  } catch (err) {
    console.warn("[Webmail] Failed to fetch email signature:", err);
  }

  // Cache empty result with a timestamp so we retry after 24h instead of
  // sticking with "" forever.
  signatureCache.set(key, "");
  localStorage.setItem(lsKey, JSON.stringify({ sig: "", ts: Date.now() } as CachedSignature));
  return "";
}

/** Clear cached signature so it gets re-fetched from ERPNext */
export function clearSignatureCache() {
  signatureCache.clear();
  const id = getActiveInstanceId();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (
      key?.startsWith(`mail_signature_${id}_`) ||
      key?.startsWith(`mail_signature_v2_${id}_`) ||
      key?.startsWith(`mail_signature_v3_${id}_`) ||
      key?.startsWith(`mail_signature_v4_${id}_`) ||
      key?.startsWith(`mail_signature_v5_${id}_`)
    ) localStorage.removeItem(key);
  }
}
