/**
 * Email categories + reply-tracking (localStorage-backed), extracted verbatim
 * from pages/Webmail.tsx.
 */
import { getActiveInstanceId } from "./instances";

/* ─── Email categories ─── */
export const EMAIL_CATEGORIES = [
  { id: "belangrijk", nameKey: "webmail.category.important", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-50" },
  { id: "werk", nameKey: "webmail.category.work", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-50" },
  { id: "persoonlijk", nameKey: "webmail.category.personal", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-50" },
  { id: "financieel", nameKey: "webmail.category.financial", color: "bg-amber-500", textColor: "text-amber-700", bgLight: "bg-amber-50" },
  { id: "actie", nameKey: "webmail.category.action_required", color: "bg-purple-500", textColor: "text-purple-700", bgLight: "bg-purple-50" },
] as const;

export function getCategoryMap(): Record<string, string> {
  try {
    const id = getActiveInstanceId();
    return JSON.parse(localStorage.getItem(`mail_categories_${id}`) || "{}");
  } catch { return {}; }
}

export function setCategoryForMessage(folder: string, uid: number, categoryId: string | null) {
  const id = getActiveInstanceId();
  const map = getCategoryMap();
  const key = `${folder}:${uid}`;
  if (categoryId) map[key] = categoryId;
  else delete map[key];
  localStorage.setItem(`mail_categories_${id}`, JSON.stringify(map));
}

/* ─── Reply tracking (localStorage) ─── */

export function getRepliedMessages(): Record<string, { repliedAt: string; sentMessageId?: string }> {
  try {
    const id = getActiveInstanceId();
    return JSON.parse(localStorage.getItem(`mail_replied_${id}`) || "{}");
  } catch { return {}; }
}

export function markAsReplied(folder: string, uid: number, sentMessageId?: string) {
  const id = getActiveInstanceId();
  const map = getRepliedMessages();
  map[`${folder}:${uid}`] = { repliedAt: new Date().toISOString(), sentMessageId };
  localStorage.setItem(`mail_replied_${id}`, JSON.stringify(map));
}

export function isReplied(folder: string, uid: number): boolean {
  return !!getRepliedMessages()[`${folder}:${uid}`];
}
