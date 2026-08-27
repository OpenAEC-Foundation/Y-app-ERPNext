/**
 * Auth failure reasons surfaced by the server's authMiddleware in the JSON
 * body of 401/502 responses.
 *
 * MUST STAY IN SYNC with packages/server/src/auth.ts (`AuthReason`). The two
 * packages don't share a types module, so a typo on either side will silently
 * stop triggering the interceptor branches below.
 */
export type AuthReason =
  | "missing_session"
  | "missing_instance"
  | "session_invalid"
  | "instance_not_found"
  | "instance_unavailable";

/** Reasons that mean "the Y-app session itself is bad" — force re-login. */
export const SESSION_LOST_REASONS: ReadonlySet<AuthReason> = new Set(["missing_session", "session_invalid"]);

/** Reasons that mean "the Y-app session is fine, but THIS instance can't be
 *  reached right now" — show a banner, keep the user logged in. */
export const INSTANCE_FAILED_REASONS: ReadonlySet<AuthReason> = new Set(["instance_not_found", "instance_unavailable"]);
