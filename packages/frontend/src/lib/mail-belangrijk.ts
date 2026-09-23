/**
 * Een mail als belangrijk markeren.
 *
 * Communication heeft geen prioriteitsveld, en er een custom field bij maken
 * zou elke andere instance breken die dat veld niet heeft. Wat overal bestaat
 * is Frappe's "leuk"-markering (`_liked_by`): een lijst gebruikers per
 * document, met een eigen API om hem aan of uit te zetten. Die gebruiken we
 * hier als persoonlijke vlag — belangrijk voor jou, niet voor iedereen.
 */
import { callMethod } from "./erpnext.ts";

/** Staat deze mail bij `ik` als belangrijk gemarkeerd? */
export function isBelangrijk(likedBy: unknown, ik: string): boolean {
  const adres = (ik || "").trim().toLowerCase();
  if (!adres) return false;
  let lijst: unknown = likedBy;
  if (typeof lijst === "string") {
    try { lijst = JSON.parse(lijst); } catch { return false; }
  }
  if (!Array.isArray(lijst)) return false;
  return lijst.some((x) => String(x).trim().toLowerCase() === adres);
}

/** Zet de markering aan of uit; geeft de nieuwe stand terug. */
export async function zetBelangrijk(naam: string, aan: boolean): Promise<boolean> {
  await callMethod("frappe.desk.like.toggle_like", {
    doctype: "Communication",
    name: naam,
    add: aan ? "Yes" : "No",
  });
  return aan;
}
