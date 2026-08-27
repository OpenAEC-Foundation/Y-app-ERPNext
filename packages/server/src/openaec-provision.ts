/**
 * OpenAEC auto-provisioning — runs right after a successful SSO login.
 *
 * Pulls the user's SuperCloud credentials from the Accounts API and wires up
 * the Y-app so the ERPNext instance, NextCloud, and mailbox are present
 * without any manual "add instance" step:
 *
 *   GET {accountsApi}/me/org          → triggers the platform provisioning
 *                                       fan-out (creates the user in ERPNext/
 *                                       NextCloud/Stalwart if not already)
 *   GET {accountsApi}/me/credentials  → { erpnext{url,apiKey,apiSecret},
 *                                          nextcloud{url,auth}, mail{...} }
 *
 * ERPNext → an apikey-mode instance (Authorization: token key:secret). Frappe
 * regenerates api_secret on every /me/credentials call, so we re-fetch and
 * refresh the vault on EVERY login (idempotent upsert by url).
 * NextCloud + mail → persisted to instance_settings for the frontend to read
 * (NextCloud via Zitadel Bearer, mail via XOAUTH2 with the Zitadel token).
 *
 * Best-effort: any failure here is logged and swallowed — it must never block
 * the login redirect. The user lands logged-in; provisioning that failed will
 * retry on the next login.
 */

import { db } from "./db.ts";
import { getOpenAecSsoConfig } from "./openaec-sso.ts";
import { upsertOpenAecErpInstance, getOrCreateOpenAecMailInstance } from "./instances.ts";
import { upsertOpenAecMailAccount } from "./mail-accounts.ts";

/**
 * When the Y-app runs in a container, the Accounts API hands back URLs that use
 * host-loopback (e.g. http://localhost:8093 for ERPNext) because the Accounts
 * process itself runs on the host where that IS reachable. Inside our container
 * `localhost` is the container, so those URLs are dead. If a docker host-gateway
 * is configured, rewrite loopback hosts to it (e.g. host.docker.internal) so the
 * stored instance URL is reachable from the container at proxy time.
 *
 * Opt-in via OPENAEC_DOCKER_HOST_GATEWAY (set by the container compose). Empty/
 * unset → URLs pass through untouched, so a dev host checkout keeps using
 * localhost. Only the hostname is swapped; scheme/port/path are preserved.
 */
function rewriteLoopbackHost(url: string): string {
  const gw = (process.env.OPENAEC_DOCKER_HOST_GATEWAY || "").trim();
  if (!gw) return url;
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1") {
      u.hostname = gw;
      return u.toString().replace(/\/$/, "");
    }
  } catch {
    /* not a parseable URL — leave as-is */
  }
  return url;
}

interface MeCredentials {
  erpnext?: { url: string; apiKey: string; apiSecret: string };
  nextcloud?: { url: string; auth: string };
  mail?: {
    address?: string;
    imap?: { host: string; port: number; security: string };
    smtp?: { host: string; port: number; security: string };
    auth?: string;
    /** Server-issued app-password for PLAIN IMAP/SMTP auth. Used as a fallback
     *  when XOAUTH2 is unavailable or its token refresh fails. */
    appPassword?: string;
  };
}

const stmtUpsertInstanceSetting = db.prepare(
  `INSERT INTO instance_settings (instance_id, setting_key, setting_value, updated_at)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(instance_id, setting_key) DO UPDATE SET
     setting_value = excluded.setting_value,
     updated_at = excluded.updated_at`
);

async function getJson(url: string, accessToken: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* non-json */ }
  return { status: res.status, body };
}

export interface ProvisionResult {
  erpnextInstanceId: number | null;
  nextcloud: boolean;
  mail: boolean;
  errors: string[];
}

/**
 * Provision the SuperCloud services for a freshly-logged-in SSO user.
 * `accessToken` is the Zitadel access token from the OIDC callback.
 */
export async function provisionFromOpenAec(input: {
  yAppUserId: number;
  userKey: Buffer;
  accessToken: string;
  /** Zitadel refresh token from the OIDC callback — lets the auto-configured
   *  mailbox refresh its short-lived XOAUTH2 token without a new login. */
  refreshToken?: string;
}): Promise<ProvisionResult> {
  const result: ProvisionResult = { erpnextInstanceId: null, nextcloud: false, mail: false, errors: [] };
  const cfg = getOpenAecSsoConfig();
  if (!cfg) { result.errors.push("sso_not_configured"); return result; }
  const base = cfg.accountsApi;

  // 1. Trigger the platform-side provisioning fan-out (best-effort).
  try {
    await getJson(`${base}/me/org`, input.accessToken);
  } catch (err) {
    result.errors.push(`me/org: ${(err as Error).message}`);
  }

  // 2. Fetch the per-user credentials.
  //    The /me/org fan-out above runs the platform provisioning; right after it
  //    fires, /me/credentials can transiently return a null `erpnext` block
  //    (the api-key mint is mid-provision). The block recovers within ~1–2 s, so
  //    re-fetch a couple of times when erpnext is missing rather than dropping
  //    the whole ERPNext instance (and the mailbox nested under it) for the
  //    whole session. Returns as soon as a complete block arrives.
  let creds: MeCredentials | null = null;
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { status, body } = await getJson(`${base}/me/credentials`, input.accessToken);
      if (status === 200 && body) {
        creds = body as MeCredentials;
        if (creds.erpnext?.apiKey && creds.erpnext.apiSecret) break; // complete
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 750 * attempt));
          continue; // retry: erpnext block not yet ready
        }
      } else {
        result.errors.push(`me/credentials: HTTP ${status}`);
        if (attempt < maxAttempts) { await new Promise((r) => setTimeout(r, 750 * attempt)); continue; }
      }
    } catch (err) {
      result.errors.push(`me/credentials: ${(err as Error).message}`);
      if (attempt < maxAttempts) { await new Promise((r) => setTimeout(r, 750 * attempt)); continue; }
      return result; // exhausted — nothing more we can do
    }
  }
  if (!creds) return result;

  // 3. ERPNext → apikey instance (idempotent upsert, refresh secret each login).
  //    Independent of mail/NextCloud below: a missing or slow ERPNext block no
  //    longer drops the mailbox auto-config (that used to be nested in here).
  if (creds.erpnext?.url && creds.erpnext.apiKey && creds.erpnext.apiSecret) {
    try {
      const erpUrl = rewriteLoopbackHost(creds.erpnext.url);
      const id = upsertOpenAecErpInstance(input.yAppUserId, input.userKey, {
        url: erpUrl,
        name: "OpenAEC SuperCloud",
        apiKey: creds.erpnext.apiKey,
        apiSecret: creds.erpnext.apiSecret,
        themeColor: "#0d9488",
      });
      result.erpnextInstanceId = id;
    } catch (err) {
      result.errors.push(`erpnext upsert: ${(err as Error).message}`);
    }
  } else {
    result.errors.push("me/credentials: no erpnext block");
  }

  // 4. Mail + NextCloud — decoupled from ERPNext. These attach to whichever
  //    OpenAEC instance the user will navigate to: the ERPNext instance when it
  //    provisioned above, otherwise a standalone "mail-only" instance created on
  //    demand (the mail_accounts/instance_settings FK needs *some* instance, and
  //    the Webmail UI discovers the mailbox via /api/instances/<id>/mail-accounts
  //    on the active instance). The mailbox is configured WHENEVER creds.mail is
  //    present, regardless of ERPNext. Best-effort: failures here never block login.
  if (creds.mail || creds.nextcloud?.url) {
    let attachInstanceId: number | null = result.erpnextInstanceId;
    try {
      // Only spin up the standalone instance when there is no ERPNext one to
      // host these. When ERPNext is present, behaviour is unchanged (everything
      // hangs off the ERPNext instance exactly as before).
      if (attachInstanceId == null) {
        attachInstanceId = getOrCreateOpenAecMailInstance(input.yAppUserId);
      }
    } catch (err) {
      result.errors.push(`mail instance: ${(err as Error).message}`);
    }

    if (attachInstanceId != null) {
      const id = attachInstanceId;

      // Stash NextCloud config on the instance so the frontend can configure
      // Messenger (NextCloud uses the Zitadel Bearer — no long-lived secret here).
      if (creds.nextcloud?.url) {
        try {
          stmtUpsertInstanceSetting.run(id, "openaec-nextcloud", JSON.stringify(creds.nextcloud), Date.now());
          result.nextcloud = true;
        } catch (err) {
          result.errors.push(`nextcloud setting: ${(err as Error).message}`);
        }
      }

      if (creds.mail?.imap || creds.mail?.smtp) {
        try {
          stmtUpsertInstanceSetting.run(id, "openaec-mail", JSON.stringify(creds.mail), Date.now());
          result.mail = true;
        } catch (err) {
          result.errors.push(`mail setting: ${(err as Error).message}`);
        }

        // Auto-configure the mailbox as a real vault account so Webmail
        // self-configures (no manual entry). Primary auth is XOAUTH2 with the
        // Zitadel token (the refresh-token + issuer token endpoint let the vault
        // renew the short-lived access token); the app-password is stored
        // encrypted as a PLAIN fallback for when XOAUTH2 is unavailable or its
        // refresh fails. The Accounts API already hands back container-reachable
        // hosts (host.docker.internal), so the loopback rewrite only fires on a
        // dev host-checkout where it's a no-op.
        const address = creds.mail.address;
        if (address && creds.mail.imap?.host && creds.mail.smtp?.host) {
          try {
            const imap = creds.mail.imap;
            const smtp = creds.mail.smtp;
            const rewriteHost = (h: string) =>
              new URL(rewriteLoopbackHost(`http://${h}`)).hostname;
            upsertOpenAecMailAccount(input.yAppUserId, id, input.userKey, {
              email: address,
              imapHost: rewriteHost(imap.host),
              imapPort: imap.port,
              imapSecure: imap.security === "ssl" || imap.security === "tls",
              smtpHost: rewriteHost(smtp.host),
              smtpPort: smtp.port,
              // STARTTLS negotiates on a plain socket → not implicit-TLS "secure".
              smtpSecure: smtp.security === "ssl" || smtp.security === "tls",
              accessToken: input.accessToken,
              refreshToken: input.refreshToken,
              clientId: cfg.clientId,
              clientSecret: cfg.clientSecret,
              tokenUri: `${cfg.issuer}/oauth/v2/token`,
              // PLAIN fallback secret (stored encrypted like the other secrets).
              appPassword: creds.mail.appPassword,
            });
          } catch (err) {
            result.errors.push(`mail vault upsert: ${(err as Error).message}`);
          }
        }
      }
    }
  }

  return result;
}
