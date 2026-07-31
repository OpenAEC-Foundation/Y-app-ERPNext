/**
 * Mail-folder icon + color helpers, extracted verbatim from pages/Webmail.tsx.
 */
import {
  Inbox, Send, Trash2, ShieldAlert, Star, Archive, PenLine,
  Filter, Users, Calendar, MessageSquare, FolderOpen,
} from "lucide-react";

export const FOLDER_ICONS: Record<string, typeof Inbox> = {
  "\\Inbox": Inbox, "\\Sent": Send, "\\Trash": Trash2, "\\Junk": ShieldAlert,
  "\\Flagged": Star, "\\Archive": Archive, "\\Drafts": PenLine,
};

/** Get folder icon based on folder name (case-insensitive, partial match) */
export function getFolderIcon(folderName: string, specialUse: string | null): typeof Inbox {
  if (specialUse && FOLDER_ICONS[specialUse]) return FOLDER_ICONS[specialUse];
  const n = folderName.toLowerCase();
  if (n === "inbox" || n === "postvak in") return Inbox;
  if (n === "sent" || n === "sent items" || n === "verzonden items" || n === "verzonden") return Send;
  if (n === "drafts" || n === "concepten") return PenLine;
  if (n === "trash" || n === "deleted items" || n === "prullenbak" || n === "verwijderde items") return Trash2;
  if (n === "junk" || n === "junk e-mail" || n === "junk email" || n === "spam" || n === "ongewenste e-mail" || n === "ongewenste email") return ShieldAlert;
  if (n === "archive" || n === "archief") return Archive;
  if (n === "starred" || n === "belangrijk" || n === "flagged") return Star;
  if (n === "clutter") return Filter;
  if (n === "contacts" || n === "contactpersonen") return Users;
  if (n === "calendar" || n === "agenda" || n === "kalender") return Calendar;
  if (n === "conversation history" || n === "gespreksgeschiedenis") return MessageSquare;
  return FolderOpen;
}

/** Get a color class for folder icons */
export function getFolderIconColor(folderName: string, specialUse: string | null, isActive: boolean): string {
  if (isActive) return "text-blue-600";
  const n = folderName.toLowerCase();
  const su = specialUse || "";
  if (su === "\\Inbox" || n === "inbox" || n === "postvak in") return "text-blue-500";
  if (su === "\\Sent" || n === "sent" || n.includes("verzonden")) return "text-emerald-500";
  if (su === "\\Drafts" || n === "drafts" || n === "concepten") return "text-amber-500";
  if (su === "\\Trash" || n === "trash" || n.includes("deleted") || n === "prullenbak" || n.includes("verwijderde")) return "text-red-400";
  if (su === "\\Junk" || n === "junk" || n === "spam" || n.includes("ongewenste")) return "text-orange-400";
  if (su === "\\Flagged" || n === "starred" || n === "flagged" || n === "belangrijk") return "text-yellow-500";
  if (su === "\\Archive" || n === "archive" || n === "archief") return "text-violet-500";
  if (n === "clutter") return "text-slate-400";
  if (n === "contacts" || n === "contactpersonen") return "text-pink-500";
  if (n === "calendar" || n === "agenda" || n === "kalender") return "text-cyan-500";
  if (n === "conversation history" || n === "gespreksgeschiedenis") return "text-teal-500";
  return "text-slate-400";
}
