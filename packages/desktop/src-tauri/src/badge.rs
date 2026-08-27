//! Taskbar-overlay-badge voor Windows.
//!
//! Tauri's `Window::set_badge_count` (wat de JS `getCurrentWindow().setBadgeCount`
//! aanroept) is op **Windows expliciet Unsupported** — het is een no-op, dus de
//! ongelezen-teller verscheen nooit op het taakbalk-icoon. Windows kent geen
//! numerieke dock-badge; het equivalent is een klein **overlay-icoon** rechtsonder
//! op het taakbalk-icoon (`ITaskbarList3::SetOverlayIcon`), in Tauri blootgesteld
//! als `Window::set_overlay_icon(Option<Image>)` (alleen Windows).
//!
//! De frontend rendert het badge-plaatje (rode cirkel + getal) zelf via een
//! `<canvas>` en stuurt de rauwe RGBA-bytes hierheen — zo hoeven we geen
//! image-/font-render-crate aan de Rust-kant toe te voegen. Lege `rgba`
//! (of nul-afmetingen) → overlay wissen.

use tauri::Manager;

/// Zet (of wist) het taakbalk-overlay-icoon van het hoofdvenster.
///
/// `rgba` is row-major RGBA (top→bottom), `width`×`height` pixels. Een lege
/// `rgba` of nul-afmeting wist het overlay. Op niet-Windows-platforms is dit een
/// no-op (macOS/Linux gebruiken de echte numerieke badge via `setBadgeCount`).
#[tauri::command]
pub fn set_taskbar_overlay(
    app: tauri::AppHandle,
    rgba: Vec<u8>,
    width: u32,
    height: u32,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use tauri::image::Image;
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "no_main_window".to_string())?;
        if rgba.is_empty() || width == 0 || height == 0 {
            window.set_overlay_icon(None).map_err(|e| e.to_string())?;
        } else {
            let expected = (width as usize) * (height as usize) * 4;
            if rgba.len() != expected {
                return Err(format!("bad_rgba_len: {} != {}", rgba.len(), expected));
            }
            let img = Image::new_owned(rgba, width, height);
            window
                .set_overlay_icon(Some(img))
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux: geen overlay-icoon-concept; de numerieke dock-badge loopt
        // via de JS `setBadgeCount`. Bewust een no-op zodat één frontend-pad op
        // alle platforms werkt.
        let _ = (app, rgba, width, height);
    }
    Ok(())
}
