# Desktop IMAP Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 6 missing desktop mail endpoints (auto-config, signature, OAuth2, contacts, conversation, warmup/cache-stats) so the desktop Webmail experience matches the web build.

**Architecture:** OAuth2 XOAUTH2 SASL auth is added to Rust `mail.rs`. Contacts and conversation are new Rust Tauri commands that scan IMAP folders. Auto-config and signature are handled in the TypeScript fetch adapter using ERPNext API calls via the existing `erpnext_request_with_creds` invoke. Warmup/cache-stats are lightweight adapter-only handlers.

**Tech Stack:** Rust (async-imap 0.10 Authenticator trait, lettre 0.11 Mechanism::Xoauth2), TypeScript (Tauri invoke, fetch adapter)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/desktop/src-tauri/src/mail.rs` | Modify | OAuth2 IMAP auth, contacts command, conversation command |
| `packages/desktop/src-tauri/src/lib.rs` | Modify | Register 2 new Tauri commands |
| `packages/desktop/src/adapter/fetch.ts` | Modify | MailCredsPayload update, auto-config, signature, contacts/conversation wiring, warmup/cache-stats |

No new files. No dependency changes (base64 0.22 already in Cargo.toml).

---

### Task 1: OAuth2 XOAUTH2 support in Rust

**Files:**
- Modify: `packages/desktop/src-tauri/src/mail.rs:28-51` (MailCredentials)
- Modify: `packages/desktop/src-tauri/src/mail.rs:61-92` (errors)
- Modify: `packages/desktop/src-tauri/src/mail.rs:115-197` (pool + connect_and_login)
- Modify: `packages/desktop/src-tauri/src/mail.rs:732-805` (op_send)

- [ ] **Step 1: Add access_token field to MailCredentials**

In `mail.rs`, add `access_token` to the `MailCredentials` struct (after line 40):

```rust
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MailCredentials {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub pass: String,
    #[serde(default = "default_secure")]
    pub secure: bool,
    /// "oauth2" for XOAUTH2, anything else (or absent) for password.
    #[serde(default)]
    pub auth_mode: Option<String>,
    /// OAuth2 access token — required when auth_mode is "oauth2".
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub smtp_host: Option<String>,
    #[serde(default)]
    pub smtp_port: Option<u16>,
    #[serde(default)]
    pub smtp_secure: Option<bool>,
}
```

- [ ] **Step 2: Remove Oauth2NotSupported error variant**

Remove `Oauth2NotSupported` from the `MailError` enum and its `Display` match arm. The enum becomes:

```rust
#[derive(Debug)]
pub enum MailError {
    Timeout,
    Network(String),
    Tls(String),
    Auth(String),
    Imap(String),
    Parse(String),
}
```

Update the `Display` impl to remove the `Oauth2NotSupported` arm.

- [ ] **Step 3: Implement XOAuth2 authenticator**

Add above `connect_and_login` (before line 153):

```rust
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
```

- [ ] **Step 4: Branch connect_and_login for OAuth2 vs password**

Replace the `client.login()` call at the end of `connect_and_login` (lines 191-194) with:

```rust
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
```

- [ ] **Step 5: Remove OAuth2 rejection from pool.get()**

Remove lines 122-124 in `MailPool::get()`:

```rust
// DELETE these lines:
if creds.auth_mode.as_deref() == Some("oauth2") {
    return Err(MailError::Oauth2NotSupported);
}
```

- [ ] **Step 6: Update op_send for OAuth2 SMTP**

In `op_send` (around line 796-801), replace the credentials/build section:

```rust
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
```

- [ ] **Step 7: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: compiles without errors.

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src-tauri/src/mail.rs
git commit -m "feat(desktop-mail): add OAuth2 XOAUTH2 support for IMAP and SMTP"
```

---

### Task 2: Contacts command in Rust

**Files:**
- Modify: `packages/desktop/src-tauri/src/mail.rs` (append new structs + functions before Tauri commands section)
- Modify: `packages/desktop/src-tauri/src/lib.rs:62` (register command)

- [ ] **Step 1: Add ContactEntry struct and op_list_contacts function**

Add before the `/* ─── Tauri commands ─── */` section (before line 807):

```rust
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
```

- [ ] **Step 2: Add mail_contacts Tauri command**

Add in the Tauri commands section (after `mail_send`):

```rust
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
```

- [ ] **Step 3: Register in lib.rs**

Add `mail::mail_contacts,` after `mail::mail_send,` in the `invoke_handler` list in `lib.rs` (line 62).

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/mail.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop-mail): add mail_contacts command (scan IMAP for addresses)"
```

---

### Task 3: Conversation command in Rust

**Files:**
- Modify: `packages/desktop/src-tauri/src/mail.rs` (append after contacts code)
- Modify: `packages/desktop/src-tauri/src/lib.rs` (register command)

- [ ] **Step 1: Add op_get_conversation function**

Add after `op_list_contacts`:

```rust
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

    // Determine search folders: current folder + Sent + INBOX (deduplicated)
    let folders = op_list_folders(pool, creds).await?;
    let sent_names = ["Sent", "INBOX.Sent", "Sent Items", "Verzonden items"];
    let mut search_folders: Vec<String> = vec![folder.to_string()];
    for f in &folders {
        if f.special_use.as_deref() == Some("\\Sent")
            || sent_names.iter().any(|n| n.eq_ignore_ascii_case(&f.name))
        {
            if !search_folders.contains(&f.path) {
                search_folders.push(f.path.clone());
            }
        }
    }
    if !search_folders.contains(&"INBOX".to_string()) {
        search_folders.push("INBOX".to_string());
    }

    let mut all_messages: Vec<MessageFull> = Vec::new();

    for search_folder in &search_folders {
        let result = match op_list_messages(pool, creds, search_folder, 1, 200).await {
            Ok(r) => r,
            Err(_) => continue,
        };
        for msg in &result.messages {
            let msg_base = strip_subject_prefixes(&msg.subject);
            if msg_base == base_subject {
                match op_get_message(pool, creds, search_folder, msg.uid).await {
                    Ok(full) => all_messages.push(full),
                    Err(_) => continue,
                }
            }
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

    // Sort by date ascending (oldest first)
    all_messages.sort_by(|a, b| {
        let da = a.date.as_deref().unwrap_or("");
        let db = b.date.as_deref().unwrap_or("");
        da.cmp(db)
    });

    Ok(all_messages)
}
```

- [ ] **Step 2: Add mail_conversation Tauri command**

Add after `mail_contacts`:

```rust
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
```

- [ ] **Step 3: Register in lib.rs**

Add `mail::mail_conversation,` after `mail::mail_contacts,` in the `invoke_handler` list.

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src-tauri/src/mail.rs packages/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop-mail): add mail_conversation command (thread by subject)"
```

---

### Task 4: Update TypeScript adapter — MailCredsPayload + endpoint wiring

**Files:**
- Modify: `packages/desktop/src/adapter/fetch.ts:24-34` (MailCredsPayload)
- Modify: `packages/desktop/src/adapter/fetch.ts:299-503` (mail section)

- [ ] **Step 1: Extend MailCredsPayload interface**

Update the interface at line 24:

```typescript
interface MailCredsPayload {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  authMode?: string;
  accessToken?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}
```

- [ ] **Step 2: Update POST /api/mail/config to store accessToken**

In the `/api/mail/config` POST handler (line 305), add `accessToken`:

```typescript
      desktopMailCreds.set(instanceId, {
        host: parsed.host,
        port: typeof parsed.port === "string" ? parseInt(parsed.port, 10) : parsed.port || 993,
        user: parsed.user,
        pass: parsed.pass,
        secure: parsed.secure !== false,
        authMode: parsed.authMode,
        accessToken: parsed.accessToken,
        smtpHost: parsed.smtpHost,
        smtpPort: typeof parsed.smtpPort === "string" ? parseInt(parsed.smtpPort, 10) : parsed.smtpPort,
        smtpSecure: parsed.smtpSecure,
      });
```

- [ ] **Step 3: Update POST /api/mail/test to pass accessToken**

In the test handler (line 331), add `accessToken` to the invoke payload:

```typescript
        await invoke("mail_test", {
          creds: {
            host: parsed.host,
            port: typeof parsed.port === "string" ? parseInt(parsed.port, 10) : parsed.port || 993,
            user: parsed.user,
            pass: parsed.pass,
            secure: parsed.secure !== false,
            authMode: parsed.authMode,
            accessToken: parsed.accessToken,
          },
        });
```

- [ ] **Step 4: Add helper function erpnextFetch**

Add after the `jsonResponse` function (after line 40):

```typescript
/** Make an ERPNext API call through the Rust backend for the active instance. */
async function erpnextFetch(
  instanceId: number,
  path: string,
  method: string = "GET",
  body: string | null = null,
): Promise<{ status: number; body: string }> {
  const instancesList = await invoke<{ instances: any[] }>("list_instances");
  const inst = instancesList.instances.find((i: any) => i.id === instanceId);
  if (!inst) throw new Error("Instance not found");
  const creds = getCredsForInstance(instanceId);
  if (!creds) throw new Error("No credentials for instance");
  return invoke<{ status: number; body: string; headers: Record<string, string> }>(
    "erpnext_request_with_creds",
    {
      instanceId,
      instanceUrl: inst.url,
      username: creds.erpnext_username,
      password: creds.erpnext_password,
      method,
      path,
      body,
    },
  );
}
```

- [ ] **Step 5: Wire GET /api/mail/contacts**

Add before the 501 catch-all (before line 502), in the mail section:

```typescript
    // GET /api/mail/contacts — scan IMAP for unique addresses
    if (url.startsWith("/api/mail/contacts") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      try {
        const contacts = await invoke<any[]>("mail_contacts", { creds });
        return jsonResponse({ data: contacts });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }
```

- [ ] **Step 6: Wire GET /api/mail/conversation**

Add after the contacts handler:

```typescript
    // GET /api/mail/conversation?folder=X&subject=Y — thread by subject
    if (url.startsWith("/api/mail/conversation") && method === "GET") {
      const creds = desktopMailCreds.get(instanceId);
      if (!creds) return jsonResponse({ error: "Missing credentials" }, 400);
      const params = new URL(url, "http://x").searchParams;
      const folder = params.get("folder") ?? "INBOX";
      const subject = params.get("subject") ?? "";
      if (!subject) return jsonResponse({ data: [] });
      try {
        const messages = await invoke<any[]>("mail_conversation", { creds, folder, subject });
        return jsonResponse({ data: messages });
      } catch (e) { return jsonResponse({ error: String(e) }, 502); }
    }
```

- [ ] **Step 7: Wire POST /api/mail/warmup and GET /api/mail/cache-stats**

Add after the conversation handler:

```typescript
    // POST /api/mail/warmup — fire-and-forget preload
    if (url.startsWith("/api/mail/warmup") && method === "POST") {
      const creds = desktopMailCreds.get(instanceId);
      if (creds) {
        // Fire-and-forget: pre-connect + fetch folders + INBOX
        invoke("mail_list_folders", { creds }).catch(() => {});
        invoke("mail_list_messages", { creds, folder: "INBOX", page: 1, pageSize: 100 }).catch(() => {});
      }
      return jsonResponse({ ok: true, message: "Warmup started" });
    }

    // GET /api/mail/cache-stats — no meaningful stats on desktop
    if (url.startsWith("/api/mail/cache-stats") && method === "GET") {
      return jsonResponse({ data: {} });
    }
```

- [ ] **Step 8: Commit**

```bash
git add packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop-mail): wire contacts, conversation, warmup, cache-stats in adapter"
```

---

### Task 5: Auto-config endpoint in TypeScript adapter

**Files:**
- Modify: `packages/desktop/src/adapter/fetch.ts` (add before the 501 catch-all)

- [ ] **Step 1: Add auto-config handler**

Add before the 501 catch-all. This mirrors the server's `mailAutoConfigInternal` (mail.ts:1589-1713):

```typescript
    // GET /api/mail/auto-config?email=X — fetch IMAP/SMTP config from ERPNext
    if (url.startsWith("/api/mail/auto-config") && method === "GET") {
      const email = new URL(url, "http://x").searchParams.get("email") ?? "";
      if (!email) return jsonResponse({ error: "Missing email parameter" }, 400);

      try {
        // 1. Fetch Email Account from ERPNext
        const filters = JSON.stringify([["email_id", "=", email]]);
        const fields = JSON.stringify(["name", "email_id", "email_server", "incoming_port", "use_ssl", "smtp_server", "smtp_port", "use_tls", "signature", "connected_app"]);
        const emailAccRes = await erpnextFetch(instanceId,
          `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
        const emailAccounts = JSON.parse(emailAccRes.body)?.data || [];
        if (emailAccounts.length === 0) {
          return jsonResponse({ error: "Email Account not found in ERPNext" }, 404);
        }
        const emailAcc = emailAccounts[0];

        // 2. Check for Connected App (Microsoft 365 OAuth2)
        const connAppFields = JSON.stringify(["name", "client_id", "provider_name", "token_uri"]);
        const connAppRes = await erpnextFetch(instanceId,
          `/api/resource/Connected App?fields=${encodeURIComponent(connAppFields)}&limit_page_length=10`);
        const allConnApps = JSON.parse(connAppRes.body)?.data || [];
        const connApps = allConnApps.filter((a: any) =>
          a.provider_name?.toLowerCase().includes("microsoft") || a.client_id);

        if (connApps.length === 0) {
          // No OAuth2 — return password-based config
          let password = "";
          try {
            const pwRes = await erpnextFetch(instanceId,
              `/api/method/frappe.client.get_password?doctype=Email+Account&name=${encodeURIComponent(emailAcc.name)}&fieldname=password`);
            password = JSON.parse(pwRes.body)?.message || "";
          } catch { /* ignore */ }

          return jsonResponse({ data: {
            authMode: "password",
            host: emailAcc.email_server || "",
            port: parseInt(emailAcc.incoming_port || "993"),
            user: email,
            pass: password,
            secure: !!emailAcc.use_ssl,
            smtpHost: emailAcc.smtp_server || "",
            smtpPort: parseInt(emailAcc.smtp_port || "587"),
            smtpSecure: false,
            signature: emailAcc.signature || "",
          }});
        }

        // 3. OAuth2 flow — get tokens from ERPNext
        const connApp = emailAcc.connected_app
          ? allConnApps.find((a: any) => a.name === emailAcc.connected_app) ?? connApps[0]
          : connApps[0];

        // Get client_secret
        let clientSecret = "";
        try {
          const secretRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Connected+App&name=${encodeURIComponent(connApp.name)}&fieldname=client_secret`);
          clientSecret = JSON.parse(secretRes.body)?.message || "";
        } catch { /* ignore */ }

        // Get Token Cache (access_token + refresh_token)
        const tokenName = `${connApp.name}-${email}`;
        let accessToken = "";
        let refreshToken = "";
        try {
          const atRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=access_token`);
          accessToken = JSON.parse(atRes.body)?.message || "";
        } catch { /* ignore */ }
        try {
          const rtRes = await erpnextFetch(instanceId,
            `/api/method/frappe.client.get_password?doctype=Token+Cache&name=${encodeURIComponent(tokenName)}&fieldname=refresh_token`);
          refreshToken = JSON.parse(rtRes.body)?.message || "";
        } catch { /* ignore */ }

        // 4. Refresh the token (it's likely expired)
        let finalAccessToken = accessToken;
        if (refreshToken && clientSecret && connApp.client_id && connApp.token_uri) {
          try {
            const tokenBody = new URLSearchParams({
              client_id: connApp.client_id,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: "refresh_token",
              scope: "https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send offline_access",
            });
            const tokenResp = await fetch(connApp.token_uri, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: tokenBody,
            });
            const tokenResult = await tokenResp.json() as { access_token?: string };
            if (tokenResult.access_token) {
              finalAccessToken = tokenResult.access_token;
            }
          } catch { /* token refresh failed — use existing token */ }
        }

        return jsonResponse({ data: {
          authMode: finalAccessToken ? "oauth2" : "password",
          host: emailAcc.email_server || "outlook.office365.com",
          port: parseInt(emailAcc.incoming_port || "993"),
          user: email,
          secure: emailAcc.use_ssl !== 0,
          smtpHost: emailAcc.smtp_server || "smtp.office365.com",
          smtpPort: parseInt(emailAcc.smtp_port || "587"),
          smtpSecure: false,
          accessToken: finalAccessToken || undefined,
          refreshToken: refreshToken || undefined,
          clientId: connApp.client_id || undefined,
          clientSecret: clientSecret || undefined,
          tokenUri: connApp.token_uri || undefined,
          signature: emailAcc.signature || "",
        }});
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop-mail): auto-config endpoint (ERPNext Email Account + OAuth2 token refresh)"
```

---

### Task 6: Signature endpoint in TypeScript adapter

**Files:**
- Modify: `packages/desktop/src/adapter/fetch.ts` (add before the 501 catch-all)

- [ ] **Step 1: Add signature handler**

Add before the 501 catch-all. Mirrors server's `mailGetSignature` (mail.ts:1716-1781):

```typescript
    // GET /api/mail/signature?email=X — fetch from ERPNext (4 sources)
    if (url.startsWith("/api/mail/signature") && method === "GET") {
      const email = new URL(url, "http://x").searchParams.get("email") ?? "";
      if (!email) return jsonResponse({ data: { signature: "", source: null } });

      try {
        // 1. Email Account → signature
        try {
          const filters = JSON.stringify([["email_id", "=", email]]);
          const fields = JSON.stringify(["signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "Email Account" } });
        } catch { /* continue */ }

        // 2. User → email_signature
        try {
          const filters = JSON.stringify([["email", "=", email]]);
          const fields = JSON.stringify(["email_signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/User?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.email_signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "User" } });
        } catch { /* continue */ }

        // 3. Employee → User → email_signature
        try {
          let employees: any[] = [];
          const empFilters1 = JSON.stringify([["status", "=", "Active"], ["company_email", "=", email]]);
          const empFields = JSON.stringify(["user_id", "employee_name"]);
          const r1 = await erpnextFetch(instanceId,
            `/api/resource/Employee?filters=${encodeURIComponent(empFilters1)}&fields=${encodeURIComponent(empFields)}`);
          employees = JSON.parse(r1.body)?.data || [];
          if (employees.length === 0) {
            const empFilters2 = JSON.stringify([["status", "=", "Active"], ["user_id", "=", email]]);
            const r2 = await erpnextFetch(instanceId,
              `/api/resource/Employee?filters=${encodeURIComponent(empFilters2)}&fields=${encodeURIComponent(empFields)}`);
            employees = JSON.parse(r2.body)?.data || [];
          }
          if (employees.length > 0 && employees[0].user_id) {
            const userFilters = JSON.stringify([["name", "=", employees[0].user_id]]);
            const userFields = JSON.stringify(["email_signature"]);
            const r3 = await erpnextFetch(instanceId,
              `/api/resource/User?filters=${encodeURIComponent(userFilters)}&fields=${encodeURIComponent(userFields)}`);
            const sig = JSON.parse(r3.body)?.data?.[0]?.email_signature;
            if (sig) return jsonResponse({ data: { signature: sig, source: "User (via Employee)" } });
          }
        } catch { /* continue */ }

        // 4. Default Email Account → signature
        try {
          const filters = JSON.stringify([["default_outgoing", "=", 1]]);
          const fields = JSON.stringify(["signature"]);
          const r = await erpnextFetch(instanceId,
            `/api/resource/Email Account?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`);
          const sig = JSON.parse(r.body)?.data?.[0]?.signature;
          if (sig) return jsonResponse({ data: { signature: sig, source: "Default Email Account" } });
        } catch { /* continue */ }

        return jsonResponse({ data: { signature: "", source: null } });
      } catch (e) {
        return jsonResponse({ error: String(e) }, 502);
      }
    }
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/adapter/fetch.ts
git commit -m "feat(desktop-mail): signature endpoint (4-source ERPNext lookup)"
```

---

### Task 7: Final compile check + integration verification

- [ ] **Step 1: Cargo check the Rust code**

Run: `cd packages/desktop/src-tauri && cargo check`
Expected: no errors.

- [ ] **Step 2: TypeScript check the adapter**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: no new errors related to fetch.ts.

- [ ] **Step 3: Verify all 501 endpoints are now handled**

Search `fetch.ts` for "501" — should only remain in the generic catch-all which now only catches truly unknown `/api/mail/` paths. The following endpoints should all have handlers above it:
- `/api/mail/auto-config` ✓
- `/api/mail/signature` ✓
- `/api/mail/contacts` ✓
- `/api/mail/conversation` ✓
- `/api/mail/warmup` ✓
- `/api/mail/cache-stats` ✓

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(desktop-mail): Phase C complete — OAuth2, auto-config, signature, contacts, conversation"
```
