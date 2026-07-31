/**
 * Windows taakbalk-overlay-badge.
 *
 * `Window.setBadgeCount` is op Windows Unsupported (no-op) — daar bestaat geen
 * numerieke dock-badge. Het Windows-equivalent is een klein overlay-icoon
 * rechtsonder op het taakbalk-icoon. We renderen dat icoon hier client-side met
 * een <canvas> (rode cirkel + ongelezen-aantal) en sturen de rauwe RGBA-bytes
 * naar de Rust-command `set_taskbar_overlay`, die `Window::set_overlay_icon`
 * aanroept. Zo hoeft de Rust-kant geen image-/font-render-crate mee te bouwen.
 *
 * Op macOS/Linux is de Rust-command een no-op; daar blijft de echte numerieke
 * badge via `getCurrentWindow().setBadgeCount(...)` werken. Beide paden worden
 * altijd aangeroepen; elk platform pakt op wat het ondersteunt.
 */
import { invoke } from "@tauri-apps/api/core";

// 32px geeft een scherpe overlay; Windows schaalt naar ~16px indien nodig.
const SIZE = 32;

/** Render een badge-plaatje (rode cirkel + getal) naar RGBA, of null bij count<=0. */
function renderBadgeRgba(
  count: number,
): { rgba: number[]; width: number; height: number } | null {
  if (count <= 0) return null;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, SIZE, SIZE);
  // Rode cirkel-achtergrond.
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#e11d48";
  ctx.fill();

  // Getal (>99 → "99+").
  const label = count > 99 ? "99+" : String(count);
  const fontSize = label.length >= 3 ? 13 : label.length === 2 ? 17 : 21;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px "Segoe UI", "Segoe UI Symbol", sans-serif`;
  // +1px optische correctie zodat het getal visueel gecentreerd staat.
  ctx.fillText(label, SIZE / 2, SIZE / 2 + 1);

  const data = ctx.getImageData(0, 0, SIZE, SIZE).data; // straight RGBA
  return { rgba: Array.from(data), width: SIZE, height: SIZE };
}

/**
 * Zet het Windows taakbalk-overlay-icoon op `count` (of wist het bij <=0).
 * Faalt stil buiten Tauri / op niet-Windows.
 */
export async function setTaskbarBadge(count: number): Promise<void> {
  try {
    const img = renderBadgeRgba(count);
    await invoke(
      "set_taskbar_overlay",
      img
        ? { rgba: img.rgba, width: img.width, height: img.height }
        : { rgba: [], width: 0, height: 0 },
    );
  } catch {
    /* geen Tauri-context of niet-Windows — negeren */
  }
}
