//! In-process IMAP / SMTP for the desktop build.
//!
//! Mirrors `packages/server/src/mail.ts` so the shared frontend's Webmail
//! page can run unmodified — the only difference is the transport: in the
//! web build it goes Express → mail server, in the desktop build it goes
//! Rust → mail server, straight from the user's IP.
//!
//! Phase A scope (this file): test connection, list folders, list
//! messages, fetch full message + attachments. Read-only. Password auth
//! only — OAuth2 / XOAUTH2 lands in Phase C.

use async_imap::types::{Mailbox, Name, NameAttribute};
use dashmap::DashMap;
use futures::{StreamExt, TryStreamExt};
use mail_parser::MimeHeaders;
use rustls_pki_types::ServerName;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_rustls::client::TlsStream;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const IDLE_TTL: Duration = Duration::from_secs(60 * 30); // drop sessions idle > 30 min
const FOLDER_CACHE_TTL: Duration = Duration::from_secs(30); // hergebruik folderlijst bij snel tab-switchen
// Connect-backoff bij mislukte login/verbinding — spiegelt de web-server
// (`MailAccountCache.ensureConnected`). Stalwart/Office365 rate-limiten auth per
// IP/account (fail2ban-achtig); zonder rem blijft de desktop elke request een
// verse LOGIN doen → limit blijft warm → "[AUTHENTICATIONFAILED]" blijft komen.
// Binnen het venster faalt `get()` snel i.p.v. opnieuw in te loggen.
const CONNECT_BACKOFF_START: Duration = Duration::from_secs(15);
const CONNECT_BACKOFF_MAX: Duration = Duration::from_secs(5 * 60);

/* ─── Credentials ─── */

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailCredentials {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub pass: String,
    #[serde(default = "default_secure")]
    pub secure: bool,
    /// OAuth2 / XOAUTH2 auth mode selector. When set to "oauth2",
    /// access_token is used instead of pass for both IMAP and SMTP.
    #[serde(default)]
    pub auth_mode: Option<String>,
    /// OAuth2 access token — required when auth_mode is "oauth2".
    #[serde(default)]
    pub access_token: Option<String>,
    /// Optional SMTP overrides for Send. If absent, derive from the
    /// IMAP host (port 587 STARTTLS by default).
    #[serde(default)]
    pub smtp_host: Option<String>,
    #[serde(default)]
    pub smtp_port: Option<u16>,
    /// True → implicit TLS on the SMTP port (typically 465). False or
    /// absent → STARTTLS (typically 587).
    #[serde(default)]
    pub smtp_secure: Option<bool>,
}

fn default_secure() -> bool { true }

impl MailCredentials {
    fn account_key(&self) -> String {
        format!("{}:{}:{}", self.host, self.port, self.user)
    }
}

/* ─── Errors ─── */

#[derive(Debug)]
pub enum MailError {
    Timeout,
    Network(String),
    Tls(String),
    Auth(String),
    Imap(String),
    Parse(String),
}

impl std::fmt::Display for MailError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MailError::Timeout => write!(f, "Connection timed out. Check host, port, and firewall."),
            MailError::Network(e) => write!(f, "Network error: {}", e),
            MailError::Tls(e) => write!(f, "TLS handshake failed — check the secure setting and port. ({})", e),
            MailError::Auth(e) => write!(f, "Authentication failed. Check username and password. ({})", e),
            MailError::Imap(e) => write!(f, "Mail server error: {}", e),
            MailError::Parse(e) => write!(f, "Could not parse message: {}", e),
        }
    }
}

impl std::error::Error for MailError {}

impl From<MailError> for String {
    fn from(e: MailError) -> Self { e.to_string() }
}

/* ─── Connection pool ─── */
//
// Per-account session cache. Mirrors `MailAccountCache` from the Node
// version — one logged-in IMAP session per (host, port, user) triple,
// reused across calls until it's idle past IDLE_TTL or the connection
// dies. Wrapped in a Mutex so a single account can't be used
// concurrently (IMAP is stateful per connection, especially around
// SELECT / EXAMINE).

type ImapSession = async_imap::Session<TlsStream<TcpStream>>;

struct PooledSession {
    session: Arc<Mutex<ImapSession>>,
    last_used: Instant,
}

#[derive(Default)]
pub struct MailPool {
    accounts: DashMap<String, PooledSession>,
    /// Korte cache van de folderlijst per account (account_key → (tijd, lijst)).
    /// Tab-switchen re-fetcht anders elke keer de volledige LIST (~440ms bij
    /// 144 mappen) en bezet de ene IMAP-verbinding, waardoor de
    /// berichtenlijst-refresh erachter wacht. Zie FOLDER_CACHE_TTL.
    folder_cache: DashMap<String, (Instant, Vec<FolderInfo>)>,
    /// Guard: welke accounts hebben een achtergrond-tellingssweep lopen
    /// (account_key → start). Voorkomt dat elke folder-list-fetch een tweede
    /// sweep over dezelfde ~130 mappen start. Zie spawn_folder_count_sweep.
    sweep_inflight: DashMap<String, Instant>,
    /// Per-account connect-lock (single-flight). Bij een mailbox-switch vuurt de
    /// frontend meerdere mail-requests tegelijk (folders + messages +
    /// unseen-summary + warmup + de tellings-sweep) voor hetzelfde, nog
    /// niet-verbonden account. Zonder deze lock zou ELKE gelijktijdige `get()`
    /// een eigen `connect_and_login` doen → meerdere simultane IMAP-LOGINs op
    /// datzelfde account. O365 (en rate-limitende servers) weigert die surplus-
    /// logins met exact "[AUTHENTICATIONFAILED] Authentication failed." Deze lock
    /// serialiseert het verbinden per account zodat er precies één login gebeurt
    /// en de rest de zojuist ingelogde sessie hergebruikt.
    connect_locks: DashMap<String, Arc<Mutex<()>>>,
    /// Per-account connect-backoff (account_key → (niet-eerder-dan, huidige
    /// wachttijd)). Na een mislukte `connect_and_login` mag pas na
    /// `niet-eerder-dan` opnieuw verbonden worden; de wachttijd verdubbelt per
    /// mislukking (15s→30s→…→5min cap) en wordt gewist bij succes. Breekt de
    /// vicieuze cirkel rate-limit → fout → reconnect → rate-limit. Zie
    /// CONNECT_BACKOFF_START/MAX en CLAUDE.md "Request-storm & IMAP-rate-limit".
    connect_backoff: DashMap<String, (Instant, Duration)>,
}

impl MailPool {
    pub fn new() -> Self { Self::default() }

    /// Get a logged-in session, creating one if missing or expired.
    /// Returns the Arc<Mutex<>> so the caller can lock it for the
    /// duration of one IMAP command sequence.
    async fn get(&self, creds: &MailCredentials) -> Result<Arc<Mutex<ImapSession>>, MailError> {
        let key = creds.account_key();

        // Drop expired entries before checking — cheap for a small map.
        let now = Instant::now();
        self.accounts.retain(|_, p| now.duration_since(p.last_used) < IDLE_TTL);

        if let Some(mut entry) = self.accounts.get_mut(&key) {
            entry.last_used = now;
            return Ok(entry.session.clone());
        }

        // Single-flight: serialiseer het verbinden per account. Zonder dit doet
        // elke gelijktijdige cold `get()` (mailbox-switch-burst) een eigen login
        // → O365 weigert de surplus-logins met [AUTHENTICATIONFAILED]. De
        // DashMap-entry-guard wordt in een block losgelaten vóór de `.await`,
        // anders zou het shard-slot over de await vastgehouden worden (deadlock).
        let lock = {
            self.connect_locks
                .entry(key.clone())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .value()
                .clone()
        };
        let _connect_guard = lock.lock().await;

        // Her-check: een racer kan tijdens het wachten op de lock al verbonden
        // hebben en de sessie ingezet — die dan hergebruiken i.p.v. opnieuw in te
        // loggen.
        if let Some(mut entry) = self.accounts.get_mut(&key) {
            entry.last_used = Instant::now();
            return Ok(entry.session.clone());
        }

        // Backoff-venster actief? Snel falen i.p.v. opnieuw inloggen — anders
        // houdt de desktop de server-side auth-rate-limit zelf warm (de sweep +
        // pollers + warmup blijven anders poken). Het venster staat gelijk aan de
        // web-server (ensureConnected).
        if let Some(b) = self.connect_backoff.get(&key) {
            if Instant::now() < b.0 {
                return Err(MailError::Imap(
                    "verbinding tijdelijk geweigerd door de mailserver (rate-limit); \
                     automatisch opnieuw over korte tijd"
                        .into(),
                ));
            }
        }

        match connect_and_login(creds).await {
            Ok(session) => {
                self.connect_backoff.remove(&key); // succes → backoff resetten
                let arc = Arc::new(Mutex::new(session));
                self.accounts
                    .insert(key, PooledSession { session: arc.clone(), last_used: Instant::now() });
                Ok(arc)
            }
            Err(e) => {
                // Exponentiële backoff: verdubbel de wachttijd per opeenvolgende
                // mislukking, gecapt op CONNECT_BACKOFF_MAX.
                let next = self
                    .connect_backoff
                    .get(&key)
                    .map(|b| (b.1 * 2).min(CONNECT_BACKOFF_MAX))
                    .unwrap_or(CONNECT_BACKOFF_START);
                self.connect_backoff
                    .insert(key, (Instant::now() + next, next));
                Err(e)
            }
        }
    }

    /// Drop the cached session for an account after an error that suggests the
    /// connection is bad. Bewust wordt de `folder_cache` NIET gewist: bij een
    /// tijdelijke (rate-limit) fout zou dat elke volgende `op_list_folders` een
    /// volledige re-LIST + een nieuwe achtergrond-STATUS-sweep laten doen (=
    /// meer LOGINs → limit blijft warm; het "cache wordt constant opnieuw
    /// opgebouwd"-gedrag). De folderlijst-cache heeft zijn eigen 30s-TTL en
    /// ververst vanzelf zodra er weer een gezonde verbinding is. Mappen aanmaken/
    /// hernoemen/verwijderen wissen de folder_cache los (zie die ops).
    fn invalidate(&self, creds: &MailCredentials) {
        self.accounts.remove(&creds.account_key());
    }
}

/* ─── XOAUTH2 SASL ─── */

struct XOAuth2 {
    user: String,
    token: String,
}

impl async_imap::Authenticator for XOAuth2 {
    type Response = Vec<u8>;
    fn process(&mut self, _challenge: &[u8]) -> Self::Response {
        format!("user={}\x01auth=Bearer {}\x01\x01", self.user, self.token)
            .into_bytes()
    }
}

/* ─── Connect / login ─── */

async fn connect_and_login(creds: &MailCredentials) -> Result<ImapSession, MailError> {
    let tcp = tokio::time::timeout(
        CONNECT_TIMEOUT,
        TcpStream::connect((creds.host.as_str(), creds.port)),
    )
    .await
    .map_err(|_| MailError::Timeout)?
    .map_err(|e| MailError::Network(e.to_string()))?;

    if !creds.secure {
        // Phase A keeps the surface narrow: encrypted IMAPS only. STARTTLS
        // on 143 would need an extra step; almost every Stalwart / O365 /
        // Gmail deployment uses 993+TLS anyway.
        return Err(MailError::Tls(
            "STARTTLS / port 143 not supported in Phase A; use port 993 + secure".into(),
        ));
    }

    // Build rustls config with ring crypto provider + Mozilla root certs.
    // ring is used instead of aws-lc-rs for Android compatibility.
    let mut root_store = rustls::RootCertStore::empty();
    root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()
        .map_err(|e| MailError::Tls(e.to_string()))?
        .with_root_certificates(root_store)
        .with_no_client_auth();
    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let server_name = ServerName::try_from(creds.host.clone())
        .map_err(|e| MailError::Tls(format!("Invalid server name '{}': {}", creds.host, e)))?;
    let tls_stream = connector
        .connect(server_name, tcp)
        .await
        .map_err(|e| MailError::Tls(e.to_string()))?;

    let mut client = async_imap::Client::new(tls_stream);

    // Greet check — some mail servers (Stalwart with fail2ban) drop the
    // socket between TCP-accept and IMAP-greet. Surface that as a TLS-ish
    // error so the user sees something actionable, not a generic Imap.
    let _greeting = client
        .read_response()
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?
        .ok_or_else(|| MailError::Tls("Server closed connection before greeting".into()))?;

    let session = if creds.auth_mode.as_deref() == Some("oauth2") {
        let token = creds.access_token.as_deref()
            .ok_or_else(|| MailError::Auth("OAuth2 mode requires an access_token".into()))?;
        let auth = XOAuth2 { user: creds.user.clone(), token: token.to_string() };
        client.authenticate("XOAUTH2", auth)
            .await
            .map_err(|(e, _client)| MailError::Auth(e.to_string()))?
    } else {
        client.login(&creds.user, &creds.pass)
            .await
            .map_err(|(e, _client)| MailError::Auth(e.to_string()))?
    };

    Ok(session)
}

/* ─── Public response shapes (must match server JSON) ─── */
//
// These structs are wire-compatible with `packages/server/src/mail.ts`
// so the shared frontend can deserialize either response without
// branching. Field renames keep the camelCase the JS expects.

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub delimiter: String,
    pub flags: Vec<String>,
    pub special_use: Option<String>,
    pub listed: bool,
    pub messages: Option<u32>,
    pub unseen: Option<u32>,
}

/// Wire-compatible with the MailAddress interface in
/// packages/frontend/src/lib/webmail-prefetch.ts. Lowercase field names
/// (no rename_all) so the frontend's `addr.name` / `addr.address`
/// reads hit them without translation.
#[derive(Serialize, Clone)]
pub struct MailAddress {
    pub name: String,
    pub address: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageHeader {
    pub uid: u32,
    pub seq: u32,
    pub flags: Vec<String>,
    pub date: Option<String>,
    pub subject: String,
    pub from: Vec<MailAddress>,
    pub to: Vec<MailAddress>,
    pub cc: Vec<MailAddress>,
    pub seen: bool,
    pub flagged: bool,
    pub size: u32,
    pub has_attachments: bool,
    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageList {
    pub messages: Vec<MessageHeader>,
    pub total: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentMeta {
    pub filename: String,
    pub content_type: String,
    pub size: u32,
    pub content_id: Option<String>,
    /// Alleen gevuld door op_get_bodies met with_attachments=true (desktop
    /// mee-cachen tijdens de body-prefill). base64 van de bijlage-bytes; de
    /// bytes komen tijdens de prefill tóch al binnen (BODY.PEEK[]), dus dit
    /// kost geen extra IMAP-verkeer. skip_serializing_if → andere paden
    /// (op_get_message, metadata-only) sturen dit veld niet mee.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_base64: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageFull {
    pub uid: u32,
    pub seq: u32,
    pub flags: Vec<String>,
    pub date: Option<String>,
    pub subject: String,
    pub from: Vec<MailAddress>,
    pub to: Vec<MailAddress>,
    pub cc: Vec<MailAddress>,
    pub bcc: Vec<MailAddress>,
    pub seen: bool,
    pub flagged: bool,
    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub references: Option<String>,
    pub text_body: String,
    pub html_body: String,
    pub attachments: Vec<AttachmentMeta>,
}

/* ─── Operations ─── */
//
// Each `op_*` takes a locked session and returns the wire shape. The
// Tauri command layer calls these via the pool.

pub async fn op_test(creds: &MailCredentials) -> Result<(), MailError> {
    let _session = connect_and_login(creds).await?;
    Ok(())
}

pub async fn op_list_folders(pool: &MailPool, creds: &MailCredentials) -> Result<Vec<FolderInfo>, MailError> {
    let cache_key = creds.account_key();
    // Verse cache (< FOLDER_CACHE_TTL)? Meteen teruggeven — geen LIST/examine.
    if let Some(entry) = pool.folder_cache.get(&cache_key) {
        if entry.0.elapsed() < FOLDER_CACHE_TTL {
            return Ok(entry.1.clone());
        }
    }
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;

    let names: Vec<Name> = session
        .list(None, Some("*"))
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;

    let mut folders = Vec::with_capacity(names.len());
    for n in names {
        let path = n.name().to_string();
        let display_name = path
            .rsplit_once(|c: char| c == '/' || c == '.')
            .map(|(_, last)| last.to_string())
            .unwrap_or_else(|| path.clone());
        let special_use = special_use_from_attrs(&n);

        // Prioriteitsmappen krijgen HUN telling meteen (synchroon) via EXAMINE:
        // INBOX + special-use (Sent/Drafts/Trash/Junk/Archive) + Junk/Spam-op-
        // naam (sommige servers — Stalwart/plain IMAP — vlaggen de ongewenste-map
        // niet met \Junk maar noemen 'm "Junk"/"spam"/"Ongewenst"). Zo klopt de
        // sidebar-badge + eerste render direct. ALLE overige mappen worden op de
        // ACHTERGROND geteld (spawn_folder_count_sweep) — synchroon 100+
        // projectsubmappen tellen hield de ene IMAP-verbinding seconden bezet en
        // blokkeerde mail-openen/body-prefill.
        //
        // Bewust EXAMINE (niet STATUS) voor déze mappen: EXAMINE is het bewezen,
        // werkende pad voor Piet's server. STATUS op de ACTUEEL GESELECTEERDE
        // mailbox wordt door sommige servers (O365) geweigerd → zou de INBOX-
        // badge kunnen breken wanneer INBOX net open is. De sweep gebruikt STATUS
        // wél, maar alleen op niet-geselecteerde projectmappen (veilig).
        let junk_by_name = {
            let leaf = display_name.to_ascii_lowercase();
            matches!(leaf.as_str(), "junk" | "spam" | "ongewenst" | "junk e-mail" | "junk email" | "bulk mail" | "ongewenste e-mail")
        };
        let priority = path.eq_ignore_ascii_case("INBOX") || special_use.is_some() || junk_by_name;
        let (messages, unseen) = if priority {
            match session.examine(&path).await {
                Ok(mb) => (Some(mb.exists), unseen_count(&mb)),
                Err(_) => (None, None),
            }
        } else {
            (None, None)
        };

        folders.push(FolderInfo {
            path,
            name: display_name,
            delimiter: n.delimiter().unwrap_or("/").to_string(),
            flags: n.attributes().iter().map(|a| format!("{:?}", a)).collect(),
            special_use,
            listed: true,
            messages,
            unseen,
        });
    }
    pool.folder_cache.insert(cache_key, (Instant::now(), folders.clone()));
    Ok(folders)
}

fn unseen_count(mb: &Mailbox) -> Option<u32> {
    // async-imap geeft UNSEEN alleen als de server 'm teruggeeft. Bewezen,
    // werkende pad voor de prioriteitsmappen (INBOX/special/junk).
    mb.unseen
}

/// Lichte per-map telling via `STATUS (MESSAGES UNSEEN)`: MESSAGES → totaal
/// (`exists`), UNSEEN → echt aantal ongelezen. Selecteert de mailbox NIET
/// (anders dan EXAMINE) en geeft het juiste ongelezen-aantal (EXAMINE's UNSEEN
/// is het seq-nummer van de eerste ongelezen mail, geen telling). None bij een
/// server die UNSEEN niet teruggeeft of bij een fout (bv. \Noselect-map).
async fn folder_counts_via_status(
    session: &mut ImapSession,
    path: &str,
) -> (Option<u32>, Option<u32>) {
    match session.status(path, "(MESSAGES UNSEEN)").await {
        Ok(mb) => (Some(mb.exists), mb.unseen),
        Err(_) => (None, None),
    }
}

/// Telt op de ACHTERGROND de ongelezen-aantallen van de nog-niet-getelde
/// mappen (alles behalve de prioriteitsmappen uit op_list_folders) en werkt de
/// folder-cache bij. Per map wordt de sessie-lock kort vast- en losgelaten,
/// zodat een interactieve actie (mail openen) ertussendoor kan; dit vermijdt de
/// oude regressie waarbij 100+ mappen synchroon de ene IMAP-verbinding
/// bezetten. Idempotent via `sweep_inflight` (max één sweep per account).
fn spawn_folder_count_sweep(
    pool: std::sync::Arc<MailPool>,
    creds: MailCredentials,
    cache_key: String,
    pending: Vec<String>,
) {
    if pending.is_empty() {
        return;
    }
    // Al een (recente) sweep bezig voor dit account? Dan niet nog één starten.
    // Verlopen entry (> 2 min) toch toestaan, zodat een gestrande/gecancelde
    // sweep toekomstige tellingen niet permanent blokkeert.
    if let Some(started) = pool.sweep_inflight.get(&cache_key) {
        if started.elapsed() < Duration::from_secs(120) {
            return;
        }
    }
    pool.sweep_inflight.insert(cache_key.clone(), Instant::now());
    tokio::spawn(async move {
        for path in pending {
            // Cache verdwenen (account gerouteerd/geïnvalideerd)? Stoppen.
            if !pool.folder_cache.contains_key(&cache_key) {
                break;
            }
            let arc = match pool.get(&creds).await {
                Ok(a) => a,
                Err(_) => break, // verbinding weg → volgende folder-list-fetch probeert opnieuw
            };
            let counts = {
                let mut session = arc.lock().await;
                folder_counts_via_status(&mut session, &path).await
            }; // sessie-lock hier los → interactieve op kan ertussen
            if counts.0.is_none() && counts.1.is_none() {
                continue; // \Noselect / geen rechten → laat leeg
            }
            if let Some(mut entry) = pool.folder_cache.get_mut(&cache_key) {
                if let Some(f) = entry.1.iter_mut().find(|f| f.path == path) {
                    f.messages = counts.0;
                    f.unseen = counts.1;
                }
            }
        }
        pool.sweep_inflight.remove(&cache_key);
    });
}

fn special_use_from_attrs(n: &Name) -> Option<String> {
    // Map RFC 6154 special-use attributes to the same `\Sent` / `\Drafts`
    // strings the Node `MailFolder.specialUse` field carries, so the
    // shared frontend's icon mapping in FolderTree.tsx works unchanged.
    for a in n.attributes() {
        let label: Option<&'static str> = match a {
            NameAttribute::All => Some("\\All"),
            NameAttribute::Archive => Some("\\Archive"),
            NameAttribute::Drafts => Some("\\Drafts"),
            NameAttribute::Flagged => Some("\\Flagged"),
            NameAttribute::Junk => Some("\\Junk"),
            NameAttribute::Sent => Some("\\Sent"),
            NameAttribute::Trash => Some("\\Trash"),
            NameAttribute::Extension(s) if s.starts_with('\\') => {
                return Some(s.to_string());
            }
            _ => None,
        };
        if let Some(s) = label { return Some(s.to_string()); }
    }
    None
}

pub async fn op_list_messages(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    page: u32,
    page_size: u32,
) -> Result<MessageList, MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;

    let mailbox = session
        .examine(folder)
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    let total = mailbox.exists;
    if total == 0 {
        return Ok(MessageList { messages: vec![], total: 0 });
    }

    // Newest-first: fetch the last `page_size` sequence numbers, paged.
    let end = total.saturating_sub(page.saturating_sub(1) * page_size);
    let start = end.saturating_sub(page_size).saturating_add(1).max(1);
    if end < start {
        return Ok(MessageList { messages: vec![], total });
    }
    let range = format!("{}:{}", start, end);

    let mut headers = Vec::with_capacity((end - start + 1) as usize);
    // BODYSTRUCTURE is intentionally NOT requested. async-imap's imap-proto
    // parser chokes (nom TakeWhile1) on complex nested BODYSTRUCTUREs — e.g. a
    // forwarded message/rfc822 with several inline images — and that failure
    // kills the WHOLE folder FETCH, so the message list never loads even though
    // the folder list does. We instead fetch the Content-Type header and flag
    // attachments heuristically below; the authoritative attachment list still
    // comes from the full-message fetch (op_get_message, parsed by mail_parser).
    let stream = session
        .fetch(&range, "(UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES CONTENT-TYPE)])")
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);

    while let Some(item) = stream.next().await {
        let msg = item.map_err(|e| MailError::Imap(e.to_string()))?;
        let uid = msg.uid.unwrap_or(0);
        let seq = msg.message;
        let flags: Vec<String> = msg.flags().map(|f| format!("{:?}", f)).collect();
        let seen = flags.iter().any(|f| f.contains("Seen"));
        let flagged = flags.iter().any(|f| f.contains("Flagged"));
        let size = msg.size.unwrap_or(0);

        let header_bytes = msg.header().unwrap_or_default();
        // Heuristic (BODYSTRUCTURE is not fetched — see the FETCH note above):
        // a top-level multipart/mixed almost always carries real attachments,
        // whereas multipart/related (inline images) and multipart/alternative
        // (text+html) do not. Good enough for the list paperclip; the open view
        // computes the real list from the parsed body.
        let has_attachments = String::from_utf8_lossy(header_bytes)
            .to_lowercase()
            .contains("multipart/mixed");
        let parsed = mail_parser::MessageParser::default().parse(header_bytes);

        let (subject, from, to, cc, date, message_id, in_reply_to, references) = match parsed {
            Some(p) => (
                p.subject().unwrap_or("").to_string(),
                addresses_from_parsed(p.from()),
                addresses_from_parsed(p.to()),
                addresses_from_parsed(p.cc()),
                p.date().map(|d| d.to_rfc3339()),
                p.message_id().map(|s| s.to_string()),
                p.in_reply_to().as_text().map(|s| s.to_string()),
                p.references().as_text().map(|s| s.to_string()),
            ),
            None => (String::new(), vec![], vec![], vec![], None, None, None, None),
        };

        headers.push(MessageHeader {
            uid, seq, flags, date, subject, from, to, cc, seen, flagged, size,
            has_attachments, message_id, in_reply_to, references,
        });
    }

    // Newest first.
    headers.sort_by(|a, b| b.seq.cmp(&a.seq));
    Ok(MessageList { messages: headers, total })
}

fn addresses_from_parsed(addrs: Option<&mail_parser::Address>) -> Vec<MailAddress> {
    let Some(addrs) = addrs else { return vec![] };
    addrs
        .iter()
        .map(|a| MailAddress {
            name: a.name().unwrap_or("").to_string(),
            address: a.address().unwrap_or("").to_string(),
        })
        .collect()
}

/// Inline any images the HTML references via `cid:` as `data:` URLs. On the
/// desktop the webview can't resolve `<img src="cid:...">` (there is no server
/// and the fetch-adapter only intercepts `fetch()`, not element loads), so
/// inline images stay broken unless their bytes are embedded directly. Inline
/// images are usually small logos/signatures, so inlining is cheap.
fn embed_inline_images(html: String, parsed: &mail_parser::Message) -> String {
    use base64::Engine;
    if html.is_empty() || !html.contains("cid:") {
        return html;
    }
    let mut out = html;
    for a in parsed.attachments() {
        let Some(raw_cid) = a.content_id() else { continue };
        let cid = raw_cid.trim().trim_start_matches('<').trim_end_matches('>');
        if cid.is_empty() {
            continue;
        }
        let needle = format!("cid:{}", cid);
        if !out.contains(&needle) {
            continue;
        }
        let ct = a
            .content_type()
            .map(|ct| {
                let mut s = ct.c_type.to_string();
                if let Some(sub) = ct.c_subtype.as_ref() {
                    s.push('/');
                    s.push_str(sub);
                }
                s
            })
            .unwrap_or_else(|| "application/octet-stream".into());
        let b64 = base64::engine::general_purpose::STANDARD.encode(a.contents());
        out = out.replace(&needle, &format!("data:{};base64,{}", ct, b64));
    }
    out
}

pub async fn op_get_message(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uid: u32,
) -> Result<MessageFull, MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;

    // SELECT (writable) so we can persist the \Seen flag — opening a
    // message in any normal client implies "I've read this", and the
    // web build does the same (server/mail.ts fetchFullMessage adds
    // \Seen before reading the body). Without this the unread state
    // bounces back as soon as the user navigates away and refreshes.
    session.select(folder).await.map_err(|e| MailError::Imap(e.to_string()))?;
    op_set_flag_inner(&mut session, uid, "\\Seen", true).await?;

    let stream = session
        .uid_fetch(uid.to_string(), "(UID FLAGS BODY.PEEK[])")
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);

    let msg = stream
        .try_next()
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?
        .ok_or_else(|| MailError::Imap(format!("Message UID {} not found", uid)))?;

    let body_bytes = msg.body().ok_or_else(|| MailError::Parse("No body returned".into()))?;
    let parsed = mail_parser::MessageParser::default()
        .parse(body_bytes)
        .ok_or_else(|| MailError::Parse("MIME parse failed".into()))?;

    let flags: Vec<String> = msg.flags().map(|f| format!("{:?}", f)).collect();
    let seen = flags.iter().any(|f| f.contains("Seen"));
    let flagged = flags.iter().any(|f| f.contains("Flagged"));

    let mut attachments = Vec::new();
    for a in parsed.attachments() {
        let content_type = a
            .content_type()
            .map(|ct| {
                let mut s = ct.c_type.to_string();
                if let Some(sub) = ct.c_subtype.as_ref() {
                    s.push('/');
                    s.push_str(sub);
                }
                s
            })
            .unwrap_or_else(|| "application/octet-stream".into());
        attachments.push(AttachmentMeta {
            filename: a.attachment_name().unwrap_or("attachment").to_string(),
            content_type,
            size: a.contents().len() as u32,
            content_id: a.content_id().map(|s: &str| s.to_string()),
            content_base64: None, // op_get_message levert alleen metadata
        });
    }

    Ok(MessageFull {
        uid,
        seq: msg.message,
        flags,
        date: parsed.date().map(|d| d.to_rfc3339()),
        subject: parsed.subject().unwrap_or("").to_string(),
        from: addresses_from_parsed(parsed.from()),
        to: addresses_from_parsed(parsed.to()),
        cc: addresses_from_parsed(parsed.cc()),
        bcc: addresses_from_parsed(parsed.bcc()),
        seen,
        flagged,
        message_id: parsed.message_id().map(|s| s.to_string()),
        in_reply_to: parsed.in_reply_to().as_text().map(|s| s.to_string()),
        references: parsed.references().as_text().map(|s| s.to_string()),
        text_body: parsed.body_text(0).map(|s| s.to_string()).unwrap_or_default(),
        html_body: embed_inline_images(parsed.body_html(0).map(|s| s.to_string()).unwrap_or_default(), &parsed),
        attachments,
    })
}

/// Fetch full bodies for several uids at once WITHOUT marking them \Seen.
/// Powers the offline body-cache pre-fill (mail-body-prefill.ts), which must
/// never change read state. Mirrors op_get_message's MIME parsing but uses
/// EXAMINE (read-only — guarantees no flag side-effects) and one batched
/// BODY.PEEK[] fetch over the whole uid set. Returns one MessageFull per uid
/// the server actually returned (missing/expunged uids are skipped, not fatal).
pub async fn op_get_bodies(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uids: &[u32],
    with_attachments: bool,
) -> Result<Vec<MessageFull>, MailError> {
    use base64::Engine;
    // Bijlages > 50 MB per stuk niet mee-cachen (bescherming tegen extreme
    // uitschieters; Outlook kent vergelijkbare limieten). De metadata blijft.
    const MAX_CACHED_ATTACHMENT_BYTES: usize = 50 * 1024 * 1024;
    if uids.is_empty() {
        return Ok(vec![]);
    }
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;

    // EXAMINE = read-only: no \Seen side-effects during background pre-fill.
    session
        .examine(folder)
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;

    let set = uids
        .iter()
        .map(|u| u.to_string())
        .collect::<Vec<_>>()
        .join(",");
    let stream = session
        .uid_fetch(set, "(UID FLAGS BODY.PEEK[])")
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);

    let mut out = Vec::with_capacity(uids.len());
    while let Some(item) = stream.next().await {
        let msg = item.map_err(|e| MailError::Imap(e.to_string()))?;
        let uid = msg.uid.unwrap_or(0);
        let body_bytes = match msg.body() {
            Some(b) => b,
            None => continue,
        };
        let parsed = match mail_parser::MessageParser::default().parse(body_bytes) {
            Some(p) => p,
            None => continue,
        };

        let flags: Vec<String> = msg.flags().map(|f| format!("{:?}", f)).collect();
        let seen = flags.iter().any(|f| f.contains("Seen"));
        let flagged = flags.iter().any(|f| f.contains("Flagged"));

        let mut attachments = Vec::new();
        for a in parsed.attachments() {
            let content_type = a
                .content_type()
                .map(|ct| {
                    let mut s = ct.c_type.to_string();
                    if let Some(sub) = ct.c_subtype.as_ref() {
                        s.push('/');
                        s.push_str(sub);
                    }
                    s
                })
                .unwrap_or_else(|| "application/octet-stream".into());
            let bytes = a.contents();
            let content_base64 = if with_attachments && bytes.len() <= MAX_CACHED_ATTACHMENT_BYTES {
                Some(base64::engine::general_purpose::STANDARD.encode(bytes))
            } else {
                None
            };
            attachments.push(AttachmentMeta {
                filename: a.attachment_name().unwrap_or("attachment").to_string(),
                content_type,
                size: bytes.len() as u32,
                content_id: a.content_id().map(|s: &str| s.to_string()),
                content_base64,
            });
        }

        out.push(MessageFull {
            uid,
            seq: msg.message,
            flags,
            date: parsed.date().map(|d| d.to_rfc3339()),
            subject: parsed.subject().unwrap_or("").to_string(),
            from: addresses_from_parsed(parsed.from()),
            to: addresses_from_parsed(parsed.to()),
            cc: addresses_from_parsed(parsed.cc()),
            bcc: addresses_from_parsed(parsed.bcc()),
            seen,
            flagged,
            message_id: parsed.message_id().map(|s| s.to_string()),
            in_reply_to: parsed.in_reply_to().as_text().map(|s| s.to_string()),
            references: parsed.references().as_text().map(|s| s.to_string()),
            text_body: parsed.body_text(0).map(|s| s.to_string()).unwrap_or_default(),
            html_body: embed_inline_images(parsed.body_html(0).map(|s| s.to_string()).unwrap_or_default(), &parsed),
            attachments,
        });
    }

    Ok(out)
}

/* ─── Phase B: write operations ─── */
//
// All four flag/move/delete operations need a SELECTed (writable) mailbox,
// not EXAMINEd. select() is the only difference; otherwise we mirror the
// list-message connection pattern.

async fn select_writable(session: &mut ImapSession, folder: &str) -> Result<(), MailError> {
    session.select(folder).await.map_err(|e| MailError::Imap(e.to_string()))?;
    Ok(())
}

pub async fn op_set_flag(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uid: u32,
    flag: &str,
    add: bool,
) -> Result<(), MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    select_writable(&mut session, folder).await?;
    // STORE +FLAGS / -FLAGS — async-imap exposes uid_store with the raw
    // flag list ("+FLAGS (\\Seen)" form). Drain the response stream so
    // the connection state stays clean for the next op.
    let stream = session
        .uid_store(uid.to_string(), format!("{}FLAGS ({})", if add { "+" } else { "-" }, flag))
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);
    while let Some(item) = stream.next().await {
        item.map_err(|e| MailError::Imap(e.to_string()))?;
    }
    Ok(())
}

pub async fn op_move(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uid: u32,
    to_folder: &str,
) -> Result<(), MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    select_writable(&mut session, folder).await?;
    // Try server-side MOVE (RFC 6851). Fall back to COPY + EXPUNGE for
    // older servers that don't support it.
    match session.uid_mv(uid.to_string(), to_folder).await {
        Ok(_) => Ok(()),
        Err(_) => {
            session
                .uid_copy(uid.to_string(), to_folder)
                .await
                .map_err(|e| MailError::Imap(format!("COPY failed: {}", e)))?;
            op_set_flag_inner(&mut session, uid, "\\Deleted", true).await?;
            session.expunge().await.map_err(|e| MailError::Imap(e.to_string()))?
                .for_each(|_| async {})
                .await;
            Ok(())
        }
    }
}

async fn op_set_flag_inner(session: &mut ImapSession, uid: u32, flag: &str, add: bool) -> Result<(), MailError> {
    let stream = session
        .uid_store(uid.to_string(), format!("{}FLAGS ({})", if add { "+" } else { "-" }, flag))
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);
    while let Some(item) = stream.next().await {
        item.map_err(|e| MailError::Imap(e.to_string()))?;
    }
    Ok(())
}

pub async fn op_delete(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uid: u32,
) -> Result<(), MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    select_writable(&mut session, folder).await?;
    op_set_flag_inner(&mut session, uid, "\\Deleted", true).await?;
    session
        .expunge()
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?
        .for_each(|_| async {})
        .await;
    Ok(())
}

pub async fn op_create_folder(
    pool: &MailPool,
    creds: &MailCredentials,
    name: &str,
) -> Result<(), MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    session.create(name).await.map_err(|e| MailError::Imap(e.to_string()))?;
    pool.folder_cache.remove(&creds.account_key()); // nieuwe map moet meteen zichtbaar zijn
    Ok(())
}

pub async fn op_rename_folder(
    pool: &MailPool,
    creds: &MailCredentials,
    old_path: &str,
    new_path: &str,
) -> Result<(), MailError> {
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    session.rename(old_path, new_path).await.map_err(|e| MailError::Imap(e.to_string()))?;
    pool.folder_cache.remove(&creds.account_key()); // hernoemde map meteen reflecteren
    Ok(())
}

pub async fn op_delete_folder(
    pool: &MailPool,
    creds: &MailCredentials,
    path: &str,
) -> Result<(), MailError> {
    // Onomkeerbaar — de UI bevestigt vooraf en verbergt de optie voor INBOX
    // en special-use-mappen. INBOX-guard hier als defense-in-depth (spiegelt
    // de server-side guard in mailDeleteFolder).
    if path.eq_ignore_ascii_case("INBOX") {
        return Err(MailError::Imap("Cannot delete INBOX".to_string()));
    }
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    session.delete(path).await.map_err(|e| MailError::Imap(e.to_string()))?;
    pool.folder_cache.remove(&creds.account_key()); // verwijderde map meteen weg uit de lijst
    Ok(())
}

pub async fn op_get_attachment(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    uid: u32,
    index: usize,
) -> Result<(Vec<u8>, String, String), MailError> {
    // Returns (bytes, content_type, filename). The fetch interceptor on
    // the JS side wraps these into a Response with the right headers.
    // Eén enkele fetch: haal de mail één keer op (read-only EXAMINE, geen
    // \Seen-bijwerking) en lees zowel de bytes als de metadata (content-type +
    // filename) uit de geparste part. Voorheen deed dit eerst een volledige
    // op_get_message (nóg een complete body-download + MIME-parse) puur voor de
    // metadata — dat verdubbelde de tijd bij grote bijlagen (bouwtekeningen).
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    session.examine(folder).await.map_err(|e| MailError::Imap(e.to_string()))?;
    let stream = session
        .uid_fetch(uid.to_string(), "BODY.PEEK[]")
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    futures::pin_mut!(stream);
    let msg = stream
        .try_next()
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?
        .ok_or_else(|| MailError::Imap(format!("Message UID {} not found", uid)))?;
    let body = msg.body().ok_or_else(|| MailError::Parse("No body".into()))?;
    let parsed = mail_parser::MessageParser::default()
        .parse(body)
        .ok_or_else(|| MailError::Parse("MIME parse failed".into()))?;
    let attachments: Vec<_> = parsed.attachments().collect();
    let part = attachments
        .get(index)
        .ok_or_else(|| MailError::Parse(format!("Attachment {} out of range", index)))?;
    let content_type = part
        .content_type()
        .map(|ct| {
            let mut s = ct.c_type.to_string();
            if let Some(sub) = ct.c_subtype.as_ref() {
                s.push('/');
                s.push_str(sub);
            }
            s
        })
        .unwrap_or_else(|| "application/octet-stream".into());
    let filename = part.attachment_name().unwrap_or("attachment").to_string();
    let bytes = part.contents().to_vec();
    Ok((bytes, content_type, filename))
}

/* ─── SMTP send via lettre ─── */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPayload {
    pub from: String,
    pub to: Vec<String>,
    #[serde(default)]
    pub cc: Vec<String>,
    #[serde(default)]
    pub bcc: Vec<String>,
    pub subject: String,
    #[serde(default)]
    pub html: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub in_reply_to: Option<String>,
    #[serde(default)]
    pub references: Option<String>,
    #[serde(default)]
    pub attachments: Vec<SendAttachment>,
    /// Door de gebruiker gekozen Verzonden-map (override). Leeg/afwezig →
    /// mail_send detecteert de Sent-map automatisch. serde camelCase → sentFolder.
    #[serde(default)]
    pub sent_folder: Option<String>,
}

#[derive(Deserialize)]
pub struct SendAttachment {
    pub filename: String,
    /// Base64-encoded payload — same wire shape the web build uses.
    pub content: String,
    #[serde(rename = "contentType")]
    pub content_type: String,
}

/// Verstuurt via SMTP en geeft (message_id, ruwe MIME-bytes) terug. De
/// aanroeper (mail_send) gebruikt de bytes voor een IMAP-APPEND naar de
/// Verzonden-map — SMTP-verzenden alleen bewaart geen kopie.
pub async fn op_send(creds: &MailCredentials, payload: SendPayload) -> Result<(String, Vec<u8>), MailError> {
    use base64::Engine;
    use lettre::message::header::ContentType;
    use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
    use lettre::transport::smtp::authentication::Credentials;
    use lettre::transport::smtp::client::{Tls, TlsParameters};
    use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

    let smtp_host = creds.smtp_host.clone().unwrap_or_else(|| creds.host.clone());
    // Default to 587 + STARTTLS if not configured. 465 + implicit TLS
    // when smtp_secure is true and no explicit port given.
    let (smtp_port, implicit_tls) = match (creds.smtp_port, creds.smtp_secure) {
        (Some(p), Some(true)) => (p, true),
        (Some(p), _) => (p, false),
        (None, Some(true)) => (465u16, true),
        (None, _) => (587u16, false),
    };

    let from: Mailbox = payload.from.parse().map_err(|e| MailError::Parse(format!("Invalid From: {}", e)))?;
    let mut builder = Message::builder().from(from.clone()).subject(&payload.subject);
    for addr in &payload.to {
        let mb: Mailbox = addr.parse().map_err(|e| MailError::Parse(format!("Invalid To {}: {}", addr, e)))?;
        builder = builder.to(mb);
    }
    for addr in &payload.cc {
        if let Ok(mb) = addr.parse::<Mailbox>() { builder = builder.cc(mb); }
    }
    for addr in &payload.bcc {
        if let Ok(mb) = addr.parse::<Mailbox>() { builder = builder.bcc(mb); }
    }
    if let Some(irt) = &payload.in_reply_to {
        builder = builder.in_reply_to(irt.clone());
    }
    if let Some(refs) = &payload.references {
        builder = builder.references(refs.clone());
    }

    // Build the body — alternative between text and html, then attach
    // any base64-encoded attachments.
    let alt = MultiPart::alternative()
        .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(payload.text.clone()))
        .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(payload.html.clone()));

    let body = if payload.attachments.is_empty() {
        MultiPart::mixed().multipart(alt)
    } else {
        let mut mixed = MultiPart::mixed().multipart(alt);
        for att in &payload.attachments {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&att.content)
                .map_err(|e| MailError::Parse(format!("Attachment {}: bad base64: {}", att.filename, e)))?;
            let ct: ContentType = att.content_type.parse().unwrap_or(ContentType::parse("application/octet-stream").unwrap());
            mixed = mixed.singlepart(Attachment::new(att.filename.clone()).body(bytes, ct));
        }
        mixed
    };

    let email = builder.multipart(body).map_err(|e| MailError::Parse(e.to_string()))?;
    let message_id = email.headers().get_raw("Message-ID")
        .map(|v| v.trim().trim_start_matches('<').trim_end_matches('>').to_string());
    // Ruwe MIME vóór send vastleggen (voor de IMAP-APPEND naar Verzonden).
    let raw = email.formatted();

    let tls_params = TlsParameters::new(smtp_host.clone()).map_err(|e| MailError::Tls(e.to_string()))?;
    let tls = if implicit_tls { Tls::Wrapper(tls_params) } else { Tls::Required(tls_params) };

    let mailer: AsyncSmtpTransport<Tokio1Executor> = {
        let mut builder = AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&smtp_host)
            .port(smtp_port)
            .tls(tls);

        if creds.auth_mode.as_deref() == Some("oauth2") {
            let token = creds.access_token.as_deref().unwrap_or("");
            builder = builder
                .credentials(Credentials::new(creds.user.clone(), token.to_string()))
                .authentication(vec![lettre::transport::smtp::authentication::Mechanism::Xoauth2]);
        } else {
            builder = builder
                .credentials(Credentials::new(creds.user.clone(), creds.pass.clone()));
        }

        builder.build()
    };

    mailer.send(email).await.map_err(|e| MailError::Imap(format!("SMTP: {}", e)))?;
    Ok((message_id.unwrap_or_default(), raw))
}

/// Zoek de map voor een special-use (\Sent / \Trash). override niet-leeg →
/// gebruik die; anders special-use-vlag; anders naam-match; anders de eerste
/// kandidaatnaam als laatste redmiddel.
async fn resolve_special_folder(
    pool: &MailPool,
    creds: &MailCredentials,
    override_folder: &str,
    special: &str,
    name_candidates: &[&str],
) -> Result<String, MailError> {
    if !override_folder.is_empty() {
        return Ok(override_folder.to_string());
    }
    let folders = op_list_folders(pool, creds).await?;
    if let Some(f) = folders.iter().find(|f| f.special_use.as_deref() == Some(special)) {
        return Ok(f.path.clone());
    }
    let leaf = |p: &str| p.rsplit(['/', '.']).next().unwrap_or(p).to_string();
    for cand in name_candidates {
        if let Some(f) = folders
            .iter()
            .find(|f| f.path.eq_ignore_ascii_case(cand) || leaf(&f.path).eq_ignore_ascii_case(cand))
        {
            return Ok(f.path.clone());
        }
    }
    Ok(name_candidates.first().copied().unwrap_or("Sent").to_string())
}

/// APPEND een verstuurde mail naar de Verzonden-map (met \Seen). Best-effort:
/// de aanroeper negeert een fout (de mail is al verstuurd).
pub async fn op_append_sent(
    pool: &MailPool,
    creds: &MailCredentials,
    override_folder: &str,
    raw: &[u8],
) -> Result<(), MailError> {
    let folder = resolve_special_folder(
        pool, creds, override_folder, "\\Sent",
        &["Sent", "Sent Items", "Verzonden items", "INBOX.Sent"],
    ).await?;
    let arc = pool.get(creds).await?;
    let mut session = arc.lock().await;
    session
        .append(&folder, Some("(\\Seen)"), None, raw)
        .await
        .map_err(|e| MailError::Imap(e.to_string()))?;
    pool.folder_cache.remove(&creds.account_key()); // unseen/telling ververst
    Ok(())
}

/* ─── Contacts ─── */

#[derive(Serialize)]
pub struct ContactEntry {
    pub email: String,
    pub name: String,
    pub count: u32,
}

pub async fn op_list_contacts(
    pool: &MailPool,
    creds: &MailCredentials,
) -> Result<Vec<ContactEntry>, MailError> {
    use std::collections::HashMap;

    let folders = op_list_folders(pool, creds).await?;

    // Determine which folders to scan — INBOX + any Sent-like folder
    let sent_names = ["Sent", "INBOX.Sent", "Sent Items", "Verzonden items"];
    let mut scan_folders = vec!["INBOX".to_string()];
    for f in &folders {
        if f.special_use.as_deref() == Some("\\Sent")
            || sent_names.iter().any(|n| n.eq_ignore_ascii_case(&f.name))
        {
            if !scan_folders.contains(&f.path) {
                scan_folders.push(f.path.clone());
            }
        }
    }

    let mut contacts: HashMap<String, ContactEntry> = HashMap::new();

    for folder_path in &scan_folders {
        let result = match op_list_messages(pool, creds, folder_path, 1, 5000).await {
            Ok(r) => r,
            Err(_) => continue, // folder may not exist or be unselectable
        };
        for msg in &result.messages {
            for addr in msg.from.iter().chain(msg.to.iter()) {
                if addr.address.is_empty() { continue; }
                let key = addr.address.to_lowercase();
                let entry = contacts.entry(key).or_insert_with(|| ContactEntry {
                    email: addr.address.clone(),
                    name: String::new(),
                    count: 0,
                });
                entry.count += 1;
                if entry.name.is_empty() && !addr.name.is_empty() {
                    entry.name = addr.name.clone();
                }
            }
        }
    }

    // Remove user's own address
    contacts.remove(&creds.user.to_lowercase());

    let mut sorted: Vec<ContactEntry> = contacts.into_values().collect();
    sorted.sort_by(|a, b| b.count.cmp(&a.count));
    Ok(sorted)
}

/* ─── Conversation threading ─── */

/// Strip common reply/forward prefixes to get the base subject for thread matching.
fn strip_subject_prefixes(s: &str) -> String {
    let re_prefixes = ["re:", "fwd:", "fw:", "aw:", "antw:", "doorgestuurd:"];
    let mut result = s.trim().to_string();
    loop {
        let lower = result.trim_start().to_lowercase();
        let mut matched = false;
        for prefix in &re_prefixes {
            if lower.starts_with(prefix) {
                result = result.trim_start()[prefix.len()..].to_string();
                matched = true;
                break;
            }
        }
        if !matched { break; }
    }
    result.trim().to_lowercase()
}

pub async fn op_get_conversation(
    pool: &MailPool,
    creds: &MailCredentials,
    folder: &str,
    subject: &str,
) -> Result<Vec<MessageFull>, MailError> {
    use std::collections::HashSet;

    let base_subject = strip_subject_prefixes(subject);
    if base_subject.is_empty() {
        return Ok(vec![]);
    }

    // Zoekmappen: huidige map + INBOX + gangbare Sent-namen. BEWUST géén
    // op_list_folders() hier — dat re-list alle (144) mappen (~440ms) enkel om
    // de Sent-map te vinden. Niet-bestaande kandidaten falen snel bij examine
    // in op_list_messages en worden overgeslagen.
    let mut search_folders: Vec<String> = vec![folder.to_string()];
    for cand in ["INBOX", "Sent", "Sent Items", "Verzonden items", "INBOX.Sent"] {
        if !search_folders.iter().any(|f| f.eq_ignore_ascii_case(cand)) {
            search_folders.push(cand.to_string());
        }
    }

    let mut all_messages: Vec<MessageFull> = Vec::new();
    for search_folder in &search_folders {
        // pageSize 50 (i.p.v. 200): recente thread-leden zitten vrijwel altijd
        // in de nieuwste 50 — lichter, en gelijk aan de web-implementatie.
        let result = match op_list_messages(pool, creds, search_folder, 1, 50).await {
            Ok(r) => r,
            Err(_) => continue,
        };
        for msg in &result.messages {
            if strip_subject_prefixes(&msg.subject) != base_subject {
                continue;
            }
            // Alleen de header voor de thread-lijst — GÉÉN per-lid full-body
            // fetch (was ~180ms elk én markeerde \Seen). De frontend toont enkel
            // datum/afzender/onderwerp en opent de mail pas bij een klik.
            all_messages.push(MessageFull {
                uid: msg.uid,
                seq: msg.seq,
                flags: msg.flags.clone(),
                date: msg.date.clone(),
                subject: msg.subject.clone(),
                from: msg.from.clone(),
                to: msg.to.clone(),
                cc: msg.cc.clone(),
                bcc: Vec::new(),
                seen: msg.seen,
                flagged: msg.flagged,
                message_id: msg.message_id.clone(),
                in_reply_to: msg.in_reply_to.clone(),
                references: msg.references.clone(),
                text_body: String::new(),
                html_body: String::new(),
                attachments: Vec::new(),
            });
        }
    }

    // Deduplicate by messageId+date+uid
    let mut seen = HashSet::new();
    all_messages.retain(|m| {
        let key = format!(
            "{}:{}:{}",
            m.message_id.as_deref().unwrap_or(""),
            m.date.as_deref().unwrap_or(""),
            m.uid
        );
        seen.insert(key)
    });

    // Sort by date ascending (oldest first). Parse RFC 3339 to handle
    // timezone offsets correctly (string sort breaks on mixed offsets).
    all_messages.sort_by(|a, b| {
        let da = a.date.as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        let db = b.date.as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        da.cmp(&db)
    });

    Ok(all_messages)
}

/* ─── Tauri commands ─── */

#[tauri::command]
pub async fn mail_test(creds: MailCredentials) -> Result<(), String> {
    op_test(&creds).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_list_folders(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
) -> Result<Vec<FolderInfo>, String> {
    let folders = op_list_folders(&state.mail, &creds).await.map_err(|e| {
        state.mail.invalidate(&creds);
        let s: String = e.into();
        s
    })?;
    // Alle mappen die nog geen telling hebben (= niet-prioriteitsmappen, plus
    // eventueel prioriteitsmappen waarvan de synchrone STATUS faalde) op de
    // achtergrond bijtellen. \Noselect-mappen overslaan (kunnen niet ge-STATUS't
    // worden). De sweep werkt de folder-cache bij; de volgende loadFolders in de
    // frontend (folder-klik / refresh) toont de bijgewerkte tellingen — zelfde
    // patroon als de web-server (refreshFolderCountsAsync).
    let pending: Vec<String> = folders
        .iter()
        .filter(|f| {
            f.unseen.is_none()
                && !f.flags.iter().any(|fl| fl.eq_ignore_ascii_case("NoSelect"))
        })
        .map(|f| f.path.clone())
        .collect();
    if !pending.is_empty() {
        spawn_folder_count_sweep(
            std::sync::Arc::clone(&state.mail),
            creds.clone(),
            creds.account_key(),
            pending,
        );
    }
    Ok(folders)
}

#[tauri::command]
pub async fn mail_list_messages(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<MessageList, String> {
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50).clamp(1, 5000);
    op_list_messages(&state.mail, &creds, &folder, p, ps).await.map_err(|e| {
        state.mail.invalidate(&creds);
        e.into()
    })
}

#[tauri::command]
pub async fn mail_get_message(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
) -> Result<MessageFull, String> {
    op_get_message(&state.mail, &creds, &folder, uid).await.map_err(|e| {
        state.mail.invalidate(&creds);
        e.into()
    })
}

#[tauri::command]
pub async fn mail_get_bodies(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uids: Vec<u32>,
    #[allow(non_snake_case)] withAttachments: Option<bool>,
) -> Result<Vec<MessageFull>, String> {
    op_get_bodies(&state.mail, &creds, &folder, &uids, withAttachments.unwrap_or(false))
        .await
        .map_err(|e| {
            state.mail.invalidate(&creds);
            e.into()
        })
}

#[tauri::command]
pub async fn mail_mark_read(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
) -> Result<(), String> {
    op_set_flag(&state.mail, &creds, &folder, uid, "\\Seen", true).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_mark_unread(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
) -> Result<(), String> {
    op_set_flag(&state.mail, &creds, &folder, uid, "\\Seen", false).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_move(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
    to_folder: String,
) -> Result<(), String> {
    op_move(&state.mail, &creds, &folder, uid, &to_folder).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_delete(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
    trash_folder: Option<String>,
) -> Result<DeleteResponse, String> {
    // Outlook-stijl: verwijderen = VERPLAATSEN naar Verwijderde items (niet
    // permanent). Alleen wanneer de mail al IN de prullenbak staat is delete
    // permanent (expunge). Voorheen expungede desktop ALTIJD → onherstelbaar
    // dataverlies terwijl de gebruiker "prullenbak" verwachtte.
    let override_trash = trash_folder.unwrap_or_default();
    let trash = resolve_special_folder(
        &state.mail, &creds, &override_trash, "\\Trash",
        &["Trash", "Deleted Items", "Verwijderde items", "INBOX.Trash", "Prullenbak"],
    ).await.map_err(<MailError as Into<String>>::into)?;

    let leaf = |p: &str| p.rsplit(['/', '.']).next().unwrap_or(p).to_string();
    let already_trash = folder.eq_ignore_ascii_case(&trash) || leaf(&folder).eq_ignore_ascii_case(&leaf(&trash));
    if already_trash {
        op_delete(&state.mail, &creds, &folder, uid).await.map_err(<MailError as Into<String>>::into)?;
        return Ok(DeleteResponse { action: "deleted".into(), trash_path: None });
    }
    op_move(&state.mail, &creds, &folder, uid, &trash).await.map_err(<MailError as Into<String>>::into)?;
    Ok(DeleteResponse { action: "moved".into(), trash_path: Some(trash) })
}

#[tauri::command]
pub async fn mail_create_folder(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    name: String,
) -> Result<(), String> {
    op_create_folder(&state.mail, &creds, &name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_rename_folder(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    op_rename_folder(&state.mail, &creds, &old_path, &new_path).await.map_err(Into::into)
}

#[tauri::command]
pub async fn mail_delete_folder(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    path: String,
) -> Result<(), String> {
    op_delete_folder(&state.mail, &creds, &path).await.map_err(Into::into)
}

/// Vervang elk teken dat op Windows/macOS/Linux problematisch is in een
/// bestandsnaam door "_", en verwijder leidende punten/slashes (voorkomt een
/// door de e-mail-afzender aangeleverde bestandsnaam als "../../evil" die
/// buiten de temp-map zou schrijven). IMAP-bijlagenamen zijn onvertrouwde
/// input — deze functie is de enige plek waar zo'n naam een echt pad wordt.
fn sanitize_attachment_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if r#"<>:"/\|?*"#.contains(c) || c.is_control() { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim_start_matches(['.', '/', '\\']).trim();
    if trimmed.is_empty() { "attachment".to_string() } else { trimmed.to_string() }
}

/// Haal een bijlage op en open 'm direct met de OS-standaardviewer (bv. de PDF
/// in Edge/Acrobat) — zonder de bytes via JSON/base64 naar de webview terug te
/// sturen. `window.open()` op desktop geeft geen echt nieuw browsertabblad
/// (geen tabs in een Tauri-webview) en faalde daardoor stil, waarna de UI
/// terugviel op een ONZICHTBARE download (bestand verscheen zonder dat de
/// gebruiker een preview zag). Dit command schrijft de bytes rechtstreeks
/// vanuit Rust-geheugen naar een tijdelijk bestand (géén base64-omweg — dat
/// zou de al trage bijlage-fetch nog verder vertragen) en spawnt daarna de
/// OS-open, hetzelfde patroon als `open_in_explorer` in nas.rs. Elke aanroep
/// krijgt een uniek bestand (timestamp-prefix) zodat het openen van dezelfde
/// bijlage twee keer nooit botst met een viewer die het vorige bestand nog
/// vasthoudt.
#[tauri::command]
pub async fn mail_open_attachment_external(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
    index: u32,
) -> Result<(), String> {
    let (bytes, _content_type, filename) =
        op_get_attachment(&state.mail, &creds, &folder, uid, index as usize)
            .await
            .map_err(<MailError as Into<String>>::into)?;
    let safe_name = sanitize_attachment_filename(&filename);
    let tmp_dir = std::env::temp_dir().join("y-app-attachments");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("io: {}", e))?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let path = tmp_dir.join(format!("{}_{}", ts, safe_name));
    std::fs::write(&path, &bytes).map_err(|e| format!("io: {}", e))?;

    #[cfg(target_os = "windows")]
    let mut cmd = std::process::Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut cmd = std::process::Command::new("xdg-open");
    cmd.arg(&path);
    // explorer.exe geeft soms exitcode 1 terug ook bij een succesvolle open
    // (zelfde kanttekening als open_in_explorer) — we wachten niet op het
    // proces, alleen spawn moet slagen.
    cmd.spawn().map(|_| ()).map_err(|e| format!("io: {}", e))
}

/// Returns { contentBase64, contentType, filename } so the JS side can
/// hand it to the browser as a Blob → download / preview. Tauri can
/// return raw Vec<u8> but base64 keeps the wire format predictable
/// across the JSON boundary and matches what the web build returns
/// from the Express attachment route.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentResponse {
    pub content_base64: String,
    pub content_type: String,
    pub filename: String,
}

#[tauri::command]
pub async fn mail_get_attachment(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    uid: u32,
    index: u32,
) -> Result<AttachmentResponse, String> {
    use base64::Engine;
    let (bytes, content_type, filename) = op_get_attachment(&state.mail, &creds, &folder, uid, index as usize)
        .await
        .map_err(<MailError as Into<String>>::into)?;
    Ok(AttachmentResponse {
        content_base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
        content_type,
        filename,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    pub message_id: String,
}

/// Resultaat van mail_delete: "moved" (naar Verwijderde items, trash_path
/// gevuld) of "deleted" (permanent, want al in de prullenbak). Spiegelt de
/// web-server-respons zodat de frontend de juiste cache-invalidatie doet.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub action: String,
    pub trash_path: Option<String>,
}

#[tauri::command]
pub async fn mail_send(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    payload: SendPayload,
) -> Result<SendResponse, String> {
    let sent_override = payload.sent_folder.clone().unwrap_or_default();
    let (message_id, raw) = op_send(&creds, payload).await.map_err(<MailError as Into<String>>::into)?;
    // IMAP-APPEND naar Verzonden — best-effort: de mail is al verstuurd, dus een
    // append-fout (map bestaat niet / server weigert) mag de send niet laten
    // falen; we loggen 'm hooguit. Voorheen ontbrak deze stap → desktop
    // bewaarde géén kopie in Verzonden.
    if let Err(e) = op_append_sent(&state.mail, &creds, &sent_override, &raw).await {
        eprintln!("[mail] APPEND naar Verzonden mislukt (mail wél verstuurd): {e:?}");
    }
    Ok(SendResponse { message_id })
}

#[tauri::command]
pub async fn mail_contacts(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
) -> Result<Vec<ContactEntry>, String> {
    op_list_contacts(&state.mail, &creds).await.map_err(|e| {
        state.mail.invalidate(&creds);
        e.into()
    })
}

#[tauri::command]
pub async fn mail_conversation(
    state: tauri::State<'_, crate::commands::AppState>,
    creds: MailCredentials,
    folder: String,
    subject: String,
) -> Result<Vec<MessageFull>, String> {
    op_get_conversation(&state.mail, &creds, &folder, &subject).await.map_err(|e| {
        state.mail.invalidate(&creds);
        e.into()
    })
}
