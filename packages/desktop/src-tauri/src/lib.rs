pub mod badge;
pub mod commands;
pub mod database;
pub mod erpnext;
pub mod mail;
pub mod messenger;
pub mod nas;

use commands::AppState;
use tauri::Manager;

#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuEvent, MenuItemBuilder};
#[cfg(all(desktop, not(target_os = "linux")))]
use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // reqwest 0.13's `rustls-no-provider` feature requires a process-default
    // CryptoProvider before any HTTPS client is built. Install ring to match
    // the provider used by mail.rs (builder_with_provider).
    let _ = rustls::crypto::ring::default_provider().install_default();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::vault_exists,
            commands::reset_vault,
            commands::backup_vault,
            commands::restore_vault_backup,
            commands::delete_vault_backup,
            commands::biometric_write_password,
            commands::biometric_read_password,
            commands::biometric_clear_password,
            commands::biometric_has_password,
            commands::remember_supported,
            commands::remember_set_password,
            commands::remember_get_password,
            commands::remember_has_password,
            commands::remember_clear,
            commands::erpnext_request_with_creds,
            commands::list_instances,
            commands::add_instance,
            commands::update_instance,
            commands::delete_instance,
            commands::test_instance,
            commands::get_instance_settings,
            commands::put_instance_setting,
            commands::get_user_setting,
            commands::sync_instance_config,
            commands::get_all_preferences,
            commands::set_preference,
            commands::delete_preference,
            commands::list_meetings,
            commands::save_meeting,
            commands::delete_meeting,
            commands::yapp_me,
            commands::messenger_list_conversations,
            commands::messenger_get_messages,
            commands::messenger_send_message,
            commands::messenger_mark_read,
            commands::messenger_get_full_image,
            commands::messenger_react,
            commands::messenger_edit,
            commands::messenger_delete,
            commands::messenger_upload,
            commands::messenger_create_conversation,
            commands::messenger_add_participant,
            commands::nextcloud_list_files,
            commands::nextcloud_download,
            commands::nextcloud_upload,
            commands::nextcloud_share,
            commands::dav_request,
            commands::session_put_unlock,
            commands::session_get_unlock,
            commands::session_clear_unlock,
            commands::session_put_creds,
            commands::session_get_creds,
            mail::mail_test,
            mail::mail_list_folders,
            mail::mail_list_messages,
            mail::mail_get_message,
            mail::mail_get_bodies,
            mail::mail_mark_read,
            mail::mail_mark_unread,
            mail::mail_move,
            mail::mail_delete,
            mail::mail_create_folder,
            mail::mail_rename_folder,
            mail::mail_delete_folder,
            mail::mail_get_attachment,
            mail::mail_open_attachment_external,
            mail::mail_send,
            mail::mail_contacts,
            mail::mail_conversation,
            nas::create_project_folders,
            nas::open_in_explorer,
            nas::pick_folder,
            badge::set_taskbar_overlay,
        ]);

    // Deep-link plugin is desktop-only
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
    }

    // In-app updater + relaunch are desktop-only (Android updates via APK).
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    // Biometric prompt plugin is Android-only.
    #[cfg(target_os = "android")]
    {
        builder = builder.plugin(tauri_plugin_biometric::init());
    }

    builder
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize Stronghold with a per-user salt stored in app local data dir
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");

            app.handle()
                .plugin(
                    tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
                )
                .expect("failed to initialize stronghold plugin");

            // Initialize AppState with database and HTTP client
            let data_dir = app.path().app_data_dir().expect("app data dir");
            let state = AppState {
                db: database::Database::new(data_dir),
                erpnext: erpnext::ErpNextClient::new(),
                messenger: messenger::MessengerClient::new(),
                mail: std::sync::Arc::new(mail::MailPool::new()),
                unlock_secret: std::sync::Mutex::new(None),
                creds_handoff: std::sync::Mutex::new(None),
            };
            app.manage(state);

            // OAuth deep links (desktop only)
            #[cfg(all(desktop, not(target_os = "linux")))]
            {
                use tauri::Emitter;
                let handle_for_deeplink = handle.clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.to_string();
                        if url_str.starts_with("y-app://oauth/callback") {
                            let _ = handle_for_deeplink.emit("oauth-callback", url_str);
                        }
                    }
                });
            }

            // System tray (desktop only)
            #[cfg(desktop)]
            {
                let quit = MenuItemBuilder::with_id("quit", "Quit Y-app").build(app)?;
                let show = MenuItemBuilder::with_id("show", "Open Y-app").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .item(&show)
                    .separator()
                    .item(&quit)
                    .build()?;

                let _tray = TrayIconBuilder::new()
                    .menu(&tray_menu)
                    .tooltip("Y-app Desktop")
                    .on_menu_event(move |app: &tauri::AppHandle, event: MenuEvent| {
                        match event.id().as_ref() {
                            "quit" => app.exit(0),
                            "show" => {
                                if let Some(w) = app.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            if let Some(w) = tray.app_handle().get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Y-app Desktop");
}
