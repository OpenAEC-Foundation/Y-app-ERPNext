use crate::database::Database;
use crate::erpnext::{ErpNextClient, ProxyResponse, TestResult};
use crate::mail::MailPool;
use crate::messenger::MessengerClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Manager, State};

pub struct AppState {
    pub db: Database,
    pub erpnext: ErpNextClient,
    pub messenger: MessengerClient,
    /// Pooled IMAP sessions keyed on (host, port, user). One persistent
    /// logged-in session per account, mutex-locked per command sequence.
    /// `Arc` zodat een achtergrondtaak (folder-tellingssweep) 'm kan clonen en
    /// voortleven na de command; deref-coercion houdt `&state.mail` als
    /// `&MailPool`-argument overal werkend.
    pub mail: std::sync::Arc<MailPool>,
    /// Vault-handoff voor popout-vensters: het kluis-wachtwoord ná een
    /// geslaagde unlock, ALLEEN in proces-geheugen (nooit op schijf — het
    /// opt-in `remember_*`-pad is een aparte feature). Een nieuw venster
    /// (eigen JS-context) unlockt hiermee stil i.p.v. opnieuw te vragen.
    /// Gewist bij vergrendelen. Threat-model: het wachtwoord staat na unlock
    /// sowieso al in het JS-geheugen van het hoofdvenster (vault.ts).
    pub unlock_secret: std::sync::Mutex<Option<String>>,
    /// Snellere variant van de handoff: de al-ONTSLEUTELDE credential-snapshot
    /// (InstanceCredentials[] als JSON) uit het hoofdvenster. Een popout die
    /// deze krijgt hoeft de Stronghold-kluis niet opnieuw te openen — dat
    /// scheelt de (bewust trage) Argon2-key-derivation van seconden per
    /// venster. Zelfde threat-model als unlock_secret: alleen proces-geheugen,
    /// en het hoofdvenster houdt exact dezelfde data toch al in JS-geheugen.
    pub creds_handoff: std::sync::Mutex<Option<String>>,
}

/// Vault-handoff: bewaar het werkende kluis-wachtwoord in proces-geheugen
/// zodat popout-vensters stil kunnen unlocken. Zie AppState.unlock_secret.
#[tauri::command]
pub fn session_put_unlock(state: State<'_, AppState>, secret: String) {
    *state.unlock_secret.lock().unwrap() = Some(secret);
}

#[tauri::command]
pub fn session_get_unlock(state: State<'_, AppState>) -> Option<String> {
    state.unlock_secret.lock().unwrap().clone()
}

#[tauri::command]
pub fn session_clear_unlock(state: State<'_, AppState>) {
    *state.unlock_secret.lock().unwrap() = None;
    *state.creds_handoff.lock().unwrap() = None;
}

/// Ontsleutelde credential-snapshot voor popouts (zie AppState.creds_handoff).
#[tauri::command]
pub fn session_put_creds(state: State<'_, AppState>, json: String) {
    *state.creds_handoff.lock().unwrap() = Some(json);
}

#[tauri::command]
pub fn session_get_creds(state: State<'_, AppState>) -> Option<String> {
    state.creds_handoff.lock().unwrap().clone()
}

// ── Vault ──

#[tauri::command]
pub fn vault_exists(app: tauri::AppHandle) -> bool {
    let dir = app.path().app_data_dir().expect("app data dir");
    dir.join("vault.hold").exists()
}

/// Delete the vault file, its per-device salt, and any stored biometric
/// password. Used by the in-app "Forgot password" flow — destroys all
/// locally saved credentials so the user can create a fresh vault.
#[tauri::command]
pub fn reset_vault(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {}", e))?;
    let local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("app local data dir: {}", e))?;

    let vault_path = data_dir.join("vault.hold");
    let salt_path = local_data_dir.join("stronghold-salt.txt");
    let biometric_path = data_dir.join(BIOMETRIC_FILENAME);

    if vault_path.exists() {
        std::fs::remove_file(&vault_path).map_err(|e| format!("remove vault: {}", e))?;
    }
    if salt_path.exists() {
        std::fs::remove_file(&salt_path).map_err(|e| format!("remove salt: {}", e))?;
    }
    if biometric_path.exists() {
        let _ = std::fs::remove_file(&biometric_path);
    }
    Ok(())
}

/// Copy vault.hold + stronghold-salt.txt to .bak siblings. Used during the
/// change-password flow so we can roll back if re-encryption fails midway.
#[tauri::command]
pub fn backup_vault(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;

    let vault = data_dir.join("vault.hold");
    let salt = local_data_dir.join("stronghold-salt.txt");

    if vault.exists() {
        std::fs::copy(&vault, data_dir.join("vault.hold.bak"))
            .map_err(|e| format!("backup vault: {}", e))?;
    }
    if salt.exists() {
        std::fs::copy(&salt, local_data_dir.join("stronghold-salt.txt.bak"))
            .map_err(|e| format!("backup salt: {}", e))?;
    }
    Ok(())
}

/// Move .bak files back over the live vault + salt. Called when a
/// change-password attempt fails partway through.
#[tauri::command]
pub fn restore_vault_backup(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;

    let vault_bak = data_dir.join("vault.hold.bak");
    let salt_bak = local_data_dir.join("stronghold-salt.txt.bak");

    if vault_bak.exists() {
        std::fs::rename(&vault_bak, data_dir.join("vault.hold"))
            .map_err(|e| format!("restore vault: {}", e))?;
    }
    if salt_bak.exists() {
        std::fs::rename(&salt_bak, local_data_dir.join("stronghold-salt.txt"))
            .map_err(|e| format!("restore salt: {}", e))?;
    }
    Ok(())
}

/// Remove .bak files after a successful change-password.
#[tauri::command]
pub fn delete_vault_backup(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let local_data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(data_dir.join("vault.hold.bak"));
    let _ = std::fs::remove_file(local_data_dir.join("stronghold-salt.txt.bak"));
    Ok(())
}

// ── Biometric password storage (Android only) ──
//
// Stores the user's vault password in a file in app-private storage so the
// frontend can re-supply it after a successful biometric prompt. The file
// is plaintext bytes — biometric protection is enforced at the JS layer by
// only invoking `biometric_read_password` after `tauri-plugin-biometric`'s
// authenticate() resolves successfully. App-private storage on Android is
// not readable by other apps without root, so the practical threat model
// is "casual physical access" rather than "key extraction by attacker."
//
// The file lives next to the vault: same directory as `vault.hold` so it
// is wiped together by the existing reset-vault flow if/when needed.

const BIOMETRIC_FILENAME: &str = "biometric.bin";

#[tauri::command]
pub fn biometric_write_password(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::write(dir.join(BIOMETRIC_FILENAME), content.as_bytes())
        .map_err(|e| format!("write biometric file: {}", e))
}

#[tauri::command]
pub fn biometric_read_password(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(BIOMETRIC_FILENAME);
    if !path.exists() {
        return Err("not_enrolled".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("read biometric file: {}", e))
}

#[tauri::command]
pub fn biometric_clear_password(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(BIOMETRIC_FILENAME);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("remove biometric file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn biometric_has_password(app: tauri::AppHandle) -> bool {
    if let Ok(dir) = app.path().app_data_dir() {
        return dir.join(BIOMETRIC_FILENAME).exists();
    }
    false
}

// ── "Remember on this device" (app-local, no OS credential store) ──
//
// Stores the vault password in a file in the app's private data dir so the app
// can auto-unlock without re-typing it on every launch. Deliberately NOT the
// Windows Credential Manager: the user asked for no Windows-account / Hello
// dependency. Trade-off: a process running as the same user could read it —
// surfaced in the opt-in UI copy. On Android the biometric flow handles this
// (prompt-gated), so the silent path reports unsupported there.

const REMEMBER_FILENAME: &str = "vault_remember.dat";

#[tauri::command]
pub fn remember_supported() -> bool {
    !cfg!(target_os = "android")
}

#[tauri::command]
pub fn remember_set_password(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::write(dir.join(REMEMBER_FILENAME), content.as_bytes())
        .map_err(|e| format!("write remember file: {}", e))
}

#[tauri::command]
pub fn remember_get_password(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(REMEMBER_FILENAME);
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("read remember file: {}", e))
}

#[tauri::command]
pub fn remember_has_password(app: tauri::AppHandle) -> bool {
    if let Ok(dir) = app.path().app_data_dir() {
        return dir.join(REMEMBER_FILENAME).exists();
    }
    false
}

#[tauri::command]
pub fn remember_clear(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join(REMEMBER_FILENAME);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("remove remember file: {}", e))?;
    }
    Ok(())
}

// ── ERPNext Proxy ──

#[tauri::command]
pub async fn erpnext_request_with_creds(
    state: State<'_, AppState>,
    instance_id: u32,
    instance_url: String,
    username: String,
    password: String,
    method: String,
    path: String,
    body: Option<String>,
) -> Result<ProxyResponse, String> {
    state
        .erpnext
        .proxy_request(
            instance_id,
            &instance_url,
            &username,
            &password,
            &method,
            &path,
            body.as_deref(),
        )
        .await
}

// ── Instances ──

#[derive(Serialize)]
pub struct InstancesResponse {
    pub instances: Vec<crate::database::Instance>,
}

#[tauri::command]
pub fn list_instances(state: State<'_, AppState>) -> InstancesResponse {
    InstancesResponse {
        instances: state.db.list_instances(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddInstanceInput {
    pub name: String,
    pub url: String,
    pub theme_color: Option<String>,
    pub erpnext_username: Option<String>,
    pub erpnext_password: Option<String>,
}

#[derive(Serialize)]
pub struct AddInstanceResponse {
    pub ok: bool,
    pub instance: crate::database::Instance,
}

#[tauri::command]
pub fn add_instance(
    state: State<'_, AppState>,
    input: AddInstanceInput,
) -> AddInstanceResponse {
    let inst = state
        .db
        .add_instance(&input.name, &input.url, input.theme_color.as_deref());
    AddInstanceResponse {
        ok: true,
        instance: inst,
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInstanceInput {
    pub name: Option<String>,
    pub url: Option<String>,
    pub theme_color: Option<String>,
}

#[tauri::command]
pub fn update_instance(
    state: State<'_, AppState>,
    id: i64,
    input: UpdateInstanceInput,
) -> serde_json::Value {
    match state.db.update_instance(
        id,
        input.name.as_deref(),
        input.url.as_deref(),
        input.theme_color.as_deref(),
    ) {
        Some(inst) => serde_json::json!({ "ok": true, "instance": inst }),
        None => serde_json::json!({ "ok": true }),
    }
}

#[tauri::command]
pub fn delete_instance(state: State<'_, AppState>, id: i64) {
    state.erpnext.invalidate_session(id as u32);
    state.db.delete_instance(id);
}

#[tauri::command]
pub async fn test_instance(
    state: State<'_, AppState>,
    url: String,
    username: String,
    password: String,
) -> Result<TestResult, String> {
    Ok(state
        .erpnext
        .test_connection(&url, &username, &password)
        .await)
}

// ── Settings ──

#[tauri::command]
pub fn get_instance_settings(
    state: State<'_, AppState>,
    id: i64,
) -> HashMap<String, String> {
    state.db.get_instance_settings(id)
}

#[tauri::command]
pub fn put_instance_setting(
    state: State<'_, AppState>,
    id: i64,
    key: String,
    value: String,
) {
    state.db.put_instance_setting(id, &key, &value);
}

#[tauri::command]
pub fn get_user_setting(state: State<'_, AppState>, key: String) -> Option<String> {
    state.db.get_user_setting(&key)
}

/// Niet-geheime werkgever-config die we van de Y-app-server pullen. Moet exact
/// gelijk lopen met DESKTOP_CONFIG_KEYS in packages/server/src/index.ts.
const DESKTOP_CONFIG_KEYS: &[&str] = &[
    "activity-types",
    "employee-activity-types",
    "employee-visible-modules",
    "project-template-mapping",
    "nas-attachment-template",
    "nas-project-folders",
    "enabled-extensions",
    "invoice-email-defaults",
];

/// Haalt de gedeelde, niet-geheime config van de Y-app-server (geverifieerd via
/// de ERPNext-sessie van deze instance) en schrijft 'm naar de lokale
/// instance_settings-store. Bij fout/offline → Err; de aanroeper negeert dat
/// stil en gebruikt de bestaande lokale cache (offline-capabel).
#[tauri::command]
pub async fn sync_instance_config(
    state: State<'_, AppState>,
    instance_id: i64,
    instance_url: String,
    username: String,
    password: String,
) -> Result<u32, String> {
    let base = instance_url.trim_end_matches('/').to_string();
    let sid = state
        .erpnext
        .ensure_sid(instance_id as u32, &base, &username, &password)
        .await?;
    // reqwest is hier zonder de query-feature gebouwd → bouw de query met
    // reqwest::Url (uit de url-crate, altijd beschikbaar) i.p.v. .query().
    let mut config_url = reqwest::Url::parse("https://y-app.impertio.app/api/desktop-config")
        .map_err(|e| e.to_string())?;
    config_url.query_pairs_mut().append_pair("erpnextUrl", &base);
    let resp = reqwest::Client::new()
        .get(config_url)
        .header("X-Erpnext-Sid", &sid)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("desktop-config HTTP {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut written = 0u32;
    if let Some(cfg) = body.get("config").and_then(|c| c.as_object()) {
        for (key, val) in cfg {
            if DESKTOP_CONFIG_KEYS.contains(&key.as_str()) {
                state.db.put_instance_setting(instance_id, key, &val.to_string());
                written += 1;
            }
        }
    }
    Ok(written)
}

// ── Preferences ──

#[tauri::command]
pub fn get_all_preferences(state: State<'_, AppState>) -> HashMap<String, String> {
    state.db.all_preferences()
}

#[tauri::command]
pub fn set_preference(state: State<'_, AppState>, key: String, value: String) {
    state.db.set_preference(&key, &value);
}

#[tauri::command]
pub fn delete_preference(state: State<'_, AppState>, key: String) {
    state.db.delete_preference(&key);
}

// ── Meetings ──

#[tauri::command]
pub fn list_meetings(state: State<'_, AppState>) -> Vec<crate::database::Meeting> {
    state.db.list_meetings()
}

#[tauri::command]
pub fn save_meeting(state: State<'_, AppState>, id: String, data: String) {
    state.db.save_meeting(&id, &data);
}

#[tauri::command]
pub fn delete_meeting(state: State<'_, AppState>, id: String) {
    state.db.delete_meeting(&id);
}

// ── Y-app session stubs (desktop = always logged in) ──

#[tauri::command]
pub fn yapp_me() -> serde_json::Value {
    serde_json::json!({ "id": 1, "email": "desktop-user@local" })
}

// ── Messenger ──

#[tauri::command]
pub async fn messenger_list_conversations(
    state: State<'_, AppState>,
    platform: String,
    url: Option<String>,
    user: Option<String>,
    pass: Option<String>,
    token: Option<String>,
) -> Result<Vec<crate::messenger::Conversation>, String> {
    match platform.as_str() {
        "nextcloud-talk" => {
            let url = url.ok_or("url required for nextcloud-talk")?;
            let user = user.ok_or("user required for nextcloud-talk")?;
            let pass = pass.ok_or("pass required for nextcloud-talk")?;
            state.messenger.nc_list_conversations(&url, &user, &pass).await
        }
        "telegram" => {
            let token = token.ok_or("token required for telegram")?;
            state.messenger.tg_get_updates(&token).await
        }
        other => Err(format!("unknown messenger platform: {}", other)),
    }
}

#[tauri::command]
pub async fn messenger_get_messages(
    state: State<'_, AppState>,
    platform: String,
    url: Option<String>,
    user: Option<String>,
    pass: Option<String>,
    room_id: String,
    limit: Option<u32>,
) -> Result<crate::messenger::MessagesPage, String> {
    match platform.as_str() {
        "nextcloud-talk" => {
            let url = url.ok_or("url required for nextcloud-talk")?;
            let user = user.ok_or("user required for nextcloud-talk")?;
            let pass = pass.ok_or("pass required for nextcloud-talk")?;
            let lim = limit.unwrap_or(20);
            state.messenger.nc_get_messages(&url, &user, &pass, &room_id, lim).await
        }
        "telegram" => {
            // Telegram has no per-chat message history via getUpdates;
            // return empty list — callers should use the conversation list.
            Ok(crate::messenger::MessagesPage { messages: vec![], last_given_id: None })
        }
        other => Err(format!("unknown messenger platform: {}", other)),
    }
}

/// Markeer een NC Talk conversatie gelezen t/m `last_read_message` (het hoogste
/// rauwe NC-id, incl. noise-gefilterde rijen — zie MessagesPage.lastGivenId).
#[tauri::command]
pub async fn messenger_mark_read(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    last_read_message: Option<i64>,
) -> Result<(), String> {
    state
        .messenger
        .nc_mark_read(&url, &user, &pass, &room_id, last_read_message)
        .await
}

/// Grote (ware-afmetingen) versie van een afbeelding-bijlage als `data:` URL.
/// LAZY — pas aangeroepen bij klik op de lightbox, niet in de message-payload.
#[tauri::command]
pub async fn messenger_get_full_image(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    file_id: String,
) -> Result<String, String> {
    state
        .messenger
        .nc_get_full_image(&url, &user, &pass, &file_id)
        .await
}

#[tauri::command]
pub async fn messenger_send_message(
    state: State<'_, AppState>,
    platform: String,
    url: Option<String>,
    user: Option<String>,
    pass: Option<String>,
    token: Option<String>,
    room_id: String,
    message: String,
) -> Result<(), String> {
    match platform.as_str() {
        "nextcloud-talk" => {
            let url = url.ok_or("url required for nextcloud-talk")?;
            let user = user.ok_or("user required for nextcloud-talk")?;
            let pass = pass.ok_or("pass required for nextcloud-talk")?;
            state.messenger.nc_send_message(&url, &user, &pass, &room_id, &message).await
        }
        "telegram" => {
            let token = token.ok_or("token required for telegram")?;
            state.messenger.tg_send_message(&token, &room_id, &message).await
        }
        other => Err(format!("unknown messenger platform: {}", other)),
    }
}

/// Reactie (emoji) toevoegen/verwijderen — alleen NC Talk (web-pariteit met
/// POST /api/messenger/react).
#[tauri::command]
pub async fn messenger_react(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    message_id: String,
    reaction: String,
    remove: bool,
) -> Result<(), String> {
    state
        .messenger
        .nc_react(&url, &user, &pass, &room_id, &message_id, &reaction, remove)
        .await
}

/// Eigen bericht bewerken — alleen NC Talk (web-pariteit met
/// POST /api/messenger/edit).
#[tauri::command]
pub async fn messenger_edit(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    message_id: String,
    message: String,
) -> Result<(), String> {
    state
        .messenger
        .nc_edit_message(&url, &user, &pass, &room_id, &message_id, &message)
        .await
}

/// Eigen bericht verwijderen — alleen NC Talk (web-pariteit met
/// POST /api/messenger/delete).
#[tauri::command]
pub async fn messenger_delete(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    message_id: String,
) -> Result<(), String> {
    state
        .messenger
        .nc_delete_message(&url, &user, &pass, &room_id, &message_id)
        .await
}

/// Nieuw Talk-gesprek aanmaken (web-pariteit met POST /api/messenger/create-conversation).
#[tauri::command]
pub async fn messenger_create_conversation(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_type: u8,
    invite: String,
    room_name: String,
) -> Result<(String, String, u64), String> {
    state
        .messenger
        .nc_create_conversation(&url, &user, &pass, room_type, &invite, &room_name)
        .await
}

/// Deelnemer toevoegen aan een Talk-gesprek (web-pariteit met POST /api/messenger/add-participant).
#[tauri::command]
pub async fn messenger_add_participant(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    user_id: String,
) -> Result<(), String> {
    state
        .messenger
        .nc_add_participant(&url, &user, &pass, &room_id, &user_id)
        .await
}

/// NextCloud-bestanden: map-inhoud (web-pariteit met GET /api/nextcloud/files).
#[tauri::command]
pub async fn nextcloud_list_files(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    path: String,
) -> Result<Vec<crate::messenger::NcFileEntry>, String> {
    state.messenger.nc_files_list(&url, &user, &pass, &path).await
}

/// NextCloud-bestanden: download → (base64, contentType).
#[tauri::command]
pub async fn nextcloud_download(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    path: String,
) -> Result<(String, String), String> {
    use base64::Engine;
    let (bytes, ct) = state.messenger.nc_files_download(&url, &user, &pass, &path).await?;
    Ok((base64::engine::general_purpose::STANDARD.encode(bytes), ct))
}

/// NextCloud-bestanden: upload (WebDAV PUT).
#[tauri::command]
pub async fn nextcloud_upload(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    path: String,
    file_data: String,
    content_type: String,
) -> Result<(), String> {
    state
        .messenger
        .nc_files_upload(&url, &user, &pass, &path, &file_data, &content_type)
        .await
}

/// Generiek DAV/HTTP-verzoek met Basic auth (CalDAV vanuit de adapter-TS).
#[tauri::command]
pub async fn dav_request(
    state: State<'_, AppState>,
    method: String,
    url: String,
    user: String,
    pass: String,
    content_type: String,
    depth: String,
    body: String,
) -> Result<(u16, String), String> {
    state
        .messenger
        .dav_request(&method, &url, &user, &pass, &content_type, &depth, body)
        .await
}

/// NextCloud-bestanden: publieke share-link.
#[tauri::command]
pub async fn nextcloud_share(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    path: String,
) -> Result<String, String> {
    state.messenger.nc_files_share(&url, &user, &pass, &path).await
}

/// Bestand/afbeelding uploaden naar een Talk-gesprek (web-pariteit met
/// POST /api/messenger/upload). Retourneert de definitieve bestandsnaam.
#[tauri::command]
pub async fn messenger_upload(
    state: State<'_, AppState>,
    url: String,
    user: String,
    pass: String,
    room_id: String,
    file_data: String,
    file_name: String,
    mime_type: String,
    caption: String,
    reply_to: String,
) -> Result<String, String> {
    state
        .messenger
        .nc_upload_file(
            &url, &user, &pass, &room_id, &file_data, &file_name, &mime_type, &caption, &reply_to,
        )
        .await
}
