/**
 * Pure mail formatting helpers, extracted from pages/Webmail.tsx so they can be
 * unit-tested (via `node --test`) and reused by MailView / other mail views
 * without pulling in the 7k-line page component.
 *
 * All framework-free: no React, no i18n (the date-group labels are hardcoded NL,
 * matching the original inline behavior). `formatDate` / `getDateGroup` take an
 * optional `now` so the relative-date logic is deterministically testable;
 * callers that omit it get the original `new Date()` behavior.
 */

import type { MailAddress } from "./webmail-prefetch";

export function formatSender(addrs: MailAddress[]): { name: string; email: string } {
  const a = addrs[0];
  if (!a) return { name: "", email: "" };
  return { name: a.name || a.address.split("@")[0], email: a.address };
}

export function formatAddress(addrs: MailAddress[]): string {
  return addrs.map((a) => a.name || a.address).join(", ");
}

export function formatDate(dateStr: string | null, now: Date = new Date()): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function getDateGroup(dateStr: string | null, now: Date = new Date()): string {
  if (!dateStr) return "Overig";
  const d = new Date(dateStr);
  if (d.toDateString() === now.toDateString()) return "Vandaag";
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Gisteren";
  // This week (same ISO week)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  if (d >= startOfWeek) return "Deze week";
  // Last week
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  if (d >= startOfLastWeek) return "Vorige week";
  // This month
  if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return "Deze maand";
  // Older
  return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

export function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("nl-NL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function getInitials(name: string): string {
  return name.split(/[\s@]+/).filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
    "bg-rose-500", "bg-amber-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Zorg dat http(s)-links binnen een mail-body-iframe (srcDoc, same-origin
 * sandbox) in een nieuw browser-tabblad openen. Vereist dat de iframe-sandbox
 * `allow-same-origin` bevat zodat de parent bij `contentDocument` kan. Werkt via
 * een capturing click-listener + preventDefault, zodat het óók klopt wanneer de
 * mail zelf onze `<base target="_blank">` overschrijft (eigen <base> of expliciet
 * target="_self") en er nooit dubbel geopend wordt. Andere schema's (mailto:,
 * tel:, anchors) blijven ongemoeid.
 *
 * `openExternal` (optioneel) overschrijft het standaard `window.open`-gedrag.
 * Nodig op desktop: een Tauri 2-webview slikt `window.open`/`target="_blank"`
 * (geen window-creation-permissie), dus daar geeft de aanroeper een opener mee
 * die de link via de systeembrowser opent. Deze module blijft framework- én
 * desktop-vrij (pure formatters, testbaar met `node --test`) — de
 * desktop-afhankelijkheid leeft bij de aanroeper (zie `makeExternalLinkOpener`
 * in lib/desktop.ts). De opener wordt SYNCHROON binnen de klik aangeroepen
 * zodat het web-pad geen popup-blocker triggert.
 */
export function attachExternalLinkHandler(
  doc: Document,
  openExternal?: (url: string) => void,
): void {
  doc.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (/^https?:\/\//i.test(href)) {
        e.preventDefault();
        if (openExternal) openExternal(href);
        else window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    true,
  );
}

/** Converteer plain text naar veilig HTML voor quote-blok (W3 fallback). */
export function textBodyToHtml(text: string): string {
  const escaped = (text || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  return escaped.replace(/\r?\n/g, "<br>");
}
