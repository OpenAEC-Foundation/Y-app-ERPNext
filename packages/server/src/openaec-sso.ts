/**
 * OpenAEC SSO — OIDC client for the Zitadel identity provider that fronts the
 * OpenAEC platform. Implements the Authorization Code + PKCE flow so a user can
 * log into the Y-app with their OpenAEC account.
 *
 * Coordinated with the OpenAEC Accounts platform (see
 * docs/superpowers/specs/2026-06-13-openaec-sso-design.md). The token exchange
 * runs server-side (confidential client with client_secret), so the callback is
 * an Express route, never the browser.
 *
 * Config resolution order:
 *   1. Env vars: OPENAEC_ISSUER, OPENAEC_CLIENT_ID, OPENAEC_CLIENT_SECRET,
 *      OPENAEC_REDIRECT_URI  (+ optional OPENAEC_SCOPES, OPENAEC_ACCOUNTS_API)
 *   2. JSON file at OPENAEC_SSO_CONFIG, else the sibling
 *      ../openaec-accounts/.zitadel/y-app.json that the Accounts bootstrap
 *      writes — shape { issuer, clientId, clientSecret, redirectUri }.
 *
 * If neither yields a complete config, SSO is disabled (the login button hides)
 * and the routes return 503 — the rest of the Y-app is unaffected.
 */

import { createHash, randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface OpenAecSsoConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  /** Base URL of the OpenAEC Accounts API (phase 2: /me/credentials etc). */
  accountsApi: string;
}

let cached: OpenAecSsoConfig | null | undefined;

function readJsonConfig(): Partial<OpenAecSsoConfig> | null {
  const explicit = process.env.OPENAEC_SSO_CONFIG;
  const candidates = [
    explicit,
    // Sibling repo on a dev checkout (…/GitHub/openaec-accounts/.zitadel/y-app.json)
    join(process.cwd(), "..", "..", "..", "openaec-accounts", ".zitadel", "y-app.json"),
    join(process.cwd(), "..", "openaec-accounts", ".zitadel", "y-app.json"),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const raw = JSON.parse(readFileSync(path, "utf8"));
      return {
        issuer: raw.issuer,
        clientId: raw.clientId,
        clientSecret: raw.clientSecret,
        redirectUri: raw.redirectUri,
        // Accounts API base — honor either field name. Crucial when the Y-app
        // runs in a container: "localhost:4000" is the container itself, so
        // the orchestrator must point this at a container-reachable URL
        // (e.g. http://host.docker.internal:4000 or the accounts ingress).
        accountsApi: raw.accountsApi || raw.accountsApiUrl,
      };
    } catch {
      // malformed file — skip, try next candidate
    }
  }
  return null;
}

/** Resolve (and memoise) the SSO config. Returns null when not configured. */
export function getOpenAecSsoConfig(): OpenAecSsoConfig | null {
  if (cached !== undefined) return cached;

  const json = readJsonConfig() || {};
  const issuer = (process.env.OPENAEC_ISSUER || json.issuer || "").replace(/\/+$/, "");
  const clientId = process.env.OPENAEC_CLIENT_ID || json.clientId || "";
  const clientSecret = process.env.OPENAEC_CLIENT_SECRET || json.clientSecret || "";
  const redirectUri = process.env.OPENAEC_REDIRECT_URI || json.redirectUri || "";
  const scopes = process.env.OPENAEC_SCOPES || "openid profile email offline_access";
  const accountsApi = (process.env.OPENAEC_ACCOUNTS_API || json.accountsApi || "http://localhost:4000").replace(/\/+$/, "");

  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    cached = null;
    return null;
  }
  cached = { issuer, clientId, clientSecret, redirectUri, scopes, accountsApi };
  return cached;
}

/** True when SSO is fully configured. */
export function isOpenAecSsoEnabled(): boolean {
  return getOpenAecSsoConfig() !== null;
}

/* ─── PKCE + state helpers ─── */

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(randomBytes(24));
}

/** Build the Zitadel authorization URL for the redirect that starts login. */
export function buildAuthorizeUrl(cfg: OpenAecSsoConfig, state: string, codeChallenge: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: cfg.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${cfg.issuer}/oauth/v2/authorize?${p.toString()}`;
}

/* ─── Token exchange + userinfo ─── */

export interface OidcTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresInSec?: number;
}

/** Exchange an authorization code (+ PKCE verifier) for tokens. */
export async function exchangeCode(cfg: OpenAecSsoConfig, code: string, codeVerifier: string): Promise<OidcTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  });
  const res = await fetch(`${cfg.issuer}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: HTTP ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json() as {
    access_token: string; refresh_token?: string; id_token?: string; expires_in?: number;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    expiresInSec: json.expires_in,
  };
}

export interface OidcUserinfo {
  sub: string;
  email: string;
  name?: string;
}

/** Fetch the userinfo claims with the access token. */
export async function fetchUserinfo(cfg: OpenAecSsoConfig, accessToken: string): Promise<OidcUserinfo> {
  const res = await fetch(`${cfg.issuer}/oidc/v1/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`userinfo failed: HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  const json = await res.json() as { sub: string; email?: string; email_verified?: boolean; name?: string };
  if (!json.sub) throw new Error("userinfo missing sub");
  return { sub: json.sub, email: json.email || "", name: json.name };
}
