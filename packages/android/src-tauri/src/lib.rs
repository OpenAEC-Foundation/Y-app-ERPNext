use tauri::Manager;
use tauri_plugin_shell::ShellExt;

const ALLOWED_HOST: &str = "open-aec-studio-erp.prilk.cloud";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_navigation(move |url| {
                    let is_allowed = url.host_str() == Some(ALLOWED_HOST);
                    if !is_allowed {
                        let _ = handle.shell().open(url.to_string(), None);
                    }
                    is_allowed
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
