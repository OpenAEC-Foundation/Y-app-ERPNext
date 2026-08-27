use dashmap::DashMap;
use reqwest::{Client, Method, header};
use serde::{Deserialize, Serialize};
use std::error::Error as StdError;
use std::time::{Duration, Instant};

const SESSION_TTL: Duration = Duration::from_secs(4 * 60 * 60); // 4 hours

#[derive(Clone)]
struct CachedSession {
    sid: String,
    created: Instant,
}

pub struct ErpNextClient {
    http: Client,
    sessions: DashMap<u32, CachedSession>,
}

#[derive(Serialize, Deserialize)]
pub struct ProxyResponse {
    pub status: u16,
    pub body: String,
    pub headers: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub ok: bool,
    pub full_name: Option<String>,
    pub roles: Option<Vec<String>>,
    /// Stable machine-readable code for i18n lookup on the frontend.
    /// One of: network_unreachable, tls_error, timeout, invalid_credentials,
    /// server_error, no_session, unknown.
    pub error_code: Option<String>,
    /// Human-readable English detail (URL, status code, raw error). Shown only
    /// when the frontend has no translation for `error_code`.
    pub error: Option<String>,
}

/// Trim trailing slashes and surrounding whitespace from a base URL so we
/// never produce `https://host//api/...` when the user typed the URL with a
/// trailing slash.
fn normalize_base_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

/// Categorise a reqwest send-time error into a stable code + detail string.
/// Used for both login and test-connection failures.
fn classify_send_error(e: &reqwest::Error) -> (&'static str, String) {
    if e.is_timeout() {
        return ("timeout", format!("Server took too long to respond: {}", e));
    }
    if e.is_connect() {
        return ("network_unreachable", format!("Could not connect to server: {}", e));
    }
    // Walk the source chain to detect TLS / cert problems and DNS failures
    // that reqwest classifies only as "request" errors.
    let mut chain = format!("{}", e).to_lowercase();
    let mut src: Option<&dyn StdError> = e.source();
    while let Some(s) = src {
        chain.push(' ');
        chain.push_str(&format!("{}", s).to_lowercase());
        src = s.source();
    }
    if chain.contains("certificate") || chain.contains(" tls") || chain.contains("ssl") {
        return ("tls_error", format!("TLS/certificate problem: {}", e));
    }
    if chain.contains("dns") || chain.contains("resolve") || chain.contains("name or service") {
        return ("network_unreachable", format!("Could not resolve host: {}", e));
    }
    ("network_unreachable", format!("Could not reach server: {}", e))
}

impl ErpNextClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("failed to create HTTP client");
        Self { http, sessions: DashMap::new() }
    }

    /// Returns the sid on success, or `(error_code, detail)` on failure.
    async fn login(
        &self,
        url: &str,
        username: &str,
        password: &str,
    ) -> Result<String, (&'static str, String)> {
        let base = normalize_base_url(url);
        let res = self.http
            .post(format!("{}/api/method/login", base))
            .json(&serde_json::json!({ "usr": username, "pwd": password }))
            .send()
            .await
            .map_err(|e| classify_send_error(&e))?;

        let status = res.status();
        if !status.is_success() {
            let code = match status.as_u16() {
                401 | 403 => "invalid_credentials",
                500..=599 => "server_error",
                _ => "server_error",
            };
            return Err((code, format!("Server returned HTTP {}", status.as_u16())));
        }

        // Extract sid from Set-Cookie header
        let cookies = res.headers().get_all(header::SET_COOKIE);
        for cookie in cookies {
            if let Ok(val) = cookie.to_str() {
                if let Some(sid_start) = val.find("sid=") {
                    let sid = &val[sid_start + 4..];
                    let sid = sid.split(';').next().unwrap_or(sid);
                    if sid != "Guest" {
                        return Ok(sid.to_string());
                    }
                }
            }
        }
        Err(("no_session", "No session cookie received".to_string()))
    }

    async fn get_session(
        &self,
        instance_id: u32,
        url: &str,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        // Check cache
        if let Some(cached) = self.sessions.get(&instance_id) {
            if cached.created.elapsed() < SESSION_TTL {
                return Ok(cached.sid.clone());
            }
        }
        // Login and cache
        let sid = self.login(url, username, password)
            .await
            .map_err(|(_code, msg)| msg)?;
        self.sessions.insert(instance_id, CachedSession {
            sid: sid.clone(),
            created: Instant::now(),
        });
        Ok(sid)
    }

    /// Publieke wrapper rond `get_session`: levert de ERPNext-sid voor een
    /// instance (uit cache of via login). Gebruikt door `sync_instance_config`
    /// om zich bij de Y-app-server te authenticeren (sid-forwarding).
    pub async fn ensure_sid(
        &self,
        instance_id: u32,
        url: &str,
        username: &str,
        password: &str,
    ) -> Result<String, String> {
        let base = normalize_base_url(url);
        self.get_session(instance_id, &base, username, password).await
    }

    pub fn invalidate_session(&self, instance_id: u32) {
        self.sessions.remove(&instance_id);
    }

    pub async fn proxy_request(
        &self,
        instance_id: u32,
        base_url: &str,
        username: &str,
        password: &str,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> Result<ProxyResponse, String> {
        let base = normalize_base_url(base_url);
        let sid = self.get_session(instance_id, &base, username, password).await?;

        let full_url = format!("{}{}", base, path);
        let http_method = method.parse::<Method>().unwrap_or(Method::GET);

        let mut req = self.http.request(http_method.clone(), &full_url)
            .header(header::COOKIE, format!("sid={}", sid));

        if let Some(b) = body {
            req = req
                .header(header::CONTENT_TYPE, "application/json")
                .body(b.to_string());
        }

        let res = req.send().await.map_err(|e| format!("Request failed: {}", e))?;

        // On 401/403, retry once with fresh session
        if res.status().as_u16() == 401 || res.status().as_u16() == 403 {
            self.sessions.remove(&instance_id);
            let new_sid = self.get_session(instance_id, &base, username, password).await?;

            let mut retry = self.http.request(http_method, &full_url)
                .header(header::COOKIE, format!("sid={}", new_sid));
            if let Some(b) = body {
                retry = retry
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(b.to_string());
            }
            let retry_res = retry.send().await.map_err(|e| format!("Retry failed: {}", e))?;
            let status = retry_res.status().as_u16();
            let resp_headers = extract_headers(&retry_res);
            let resp_body = retry_res.text().await.unwrap_or_default();
            return Ok(ProxyResponse { status, body: resp_body, headers: resp_headers });
        }

        let status = res.status().as_u16();
        let resp_headers = extract_headers(&res);
        let resp_body = res.text().await.unwrap_or_default();
        Ok(ProxyResponse { status, body: resp_body, headers: resp_headers })
    }

    pub async fn test_connection(
        &self,
        url: &str,
        username: &str,
        password: &str,
    ) -> TestResult {
        let base = normalize_base_url(url);
        match self.login(&base, username, password).await {
            Err((code, detail)) => TestResult {
                ok: false,
                full_name: None,
                roles: None,
                error_code: Some(code.to_string()),
                error: Some(detail),
            },
            Ok(sid) => {
                // Fetch user info
                let user_url = format!("{}/api/resource/User/{}?fields=[\"full_name\",\"roles\"]", base, urlencoding::encode(username));
                let res = self.http.get(&user_url)
                    .header(header::COOKIE, format!("sid={}", sid))
                    .send().await;
                match res {
                    Err(_e) => TestResult {
                        ok: true,
                        full_name: Some(username.to_string()),
                        roles: Some(vec![]),
                        error_code: None,
                        error: None,
                    },
                    Ok(r) => {
                        let data: serde_json::Value = r.json().await.unwrap_or_default();
                        let full_name = data["data"]["full_name"].as_str().map(String::from).unwrap_or_else(|| username.to_string());
                        let roles: Vec<String> = data["data"]["roles"].as_array()
                            .map(|arr| arr.iter().filter_map(|r| r["role"].as_str().map(String::from)).collect())
                            .unwrap_or_default();
                        TestResult {
                            ok: true,
                            full_name: Some(full_name),
                            roles: Some(roles),
                            error_code: None,
                            error: None,
                        }
                    }
                }
            }
        }
    }
}

fn extract_headers(res: &reqwest::Response) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    if let Some(ct) = res.headers().get(header::CONTENT_TYPE) {
        if let Ok(v) = ct.to_str() {
            map.insert("content-type".to_string(), v.to_string());
        }
    }
    map
}
