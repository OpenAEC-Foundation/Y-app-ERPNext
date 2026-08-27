/**
 * Herkent een *rechtenfout* tussen alle andere fouten die een ERPNext-call kan
 * opleveren.
 *
 * Waarom apart: een 403 is geen ruis. Y-next dempt sommige mislukte
 * schrijfacties bewust stil (bv. de optimistische mark-read bij het openen van
 * een mail — die mag geen toast geven als hij door een race verliest), maar een
 * ontbrekend DocPerm is een structureel, oplosbaar probleem: zonder melding
 * ziet de gebruiker alleen dat "het niet blijft staan" en is er geen enkel
 * spoor naar de oorzaak. Dat feedbackloze patroon was eerder al de root cause
 * van "de Boeken-knop doet niets".
 *
 * De check kijkt naar `ApiError.status` (duck-typed, zodat dit bestand geen
 * afhankelijkheid op erpnext.ts nodig heeft) én naar de fouttekst — Frappe
 * geeft een PermissionError lang niet altijd als nette 403 terug: via
 * `callMethod` (o.a. de `add_tag`-RPC) komt hij ook als 417/500 met de reden
 * in de body.
 */

/**
 * Frappe's rechten-formuleringen. Bewust "not permitted to" en niet
 * "not permitted": "Field not permitted in query: <veld>" is een 417 uit de
 * veld-self-heal en juist géén rechtenfout.
 */
const PERMISSION_MESSAGE_PATTERN =
  /permissionerror|does not have doctype access|insufficient permission|not permitted to|no permission|not allowed to/i;

export function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if (Number((err as { status?: unknown }).status) === 403) return true;
  const message = (err as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  return PERMISSION_MESSAGE_PATTERN.test(message);
}

/**
 * Eerste rechtenfout uit een `Promise.allSettled`-resultaat, of `null`.
 * Bulkacties draaien per bericht; één 403 tussen N fouten is genoeg om te
 * weten dat het om rechten gaat en niet om een netwerkhapering.
 */
export function firstPermissionError(reasons: unknown[]): unknown | null {
  for (const reason of reasons) {
    if (isPermissionError(reason)) return reason;
  }
  return null;
}
