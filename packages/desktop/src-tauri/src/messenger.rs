use dashmap::DashMap;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub id: String,
    pub name: String,
    #[serde(rename = "lastMessage")]
    pub last_message: String,
    #[serde(rename = "lastMessageTime")]
    pub last_message_time: String,
    #[serde(rename = "unreadCount")]
    pub unread_count: u32,
    pub participants: u32,
    #[serde(rename = "type")]
    pub conv_type: String,
    pub platform: String,
    pub pinned: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Reaction {
    pub emoji: String,
    pub count: u32,
    #[serde(rename = "userReacted")]
    pub user_reacted: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub mimetype: String,
    pub size: u64,
    pub link: String,
    #[serde(rename = "previewUrl", skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
}

/// Eén pagina berichten + de long-poll/mark-read-cursor. `lastGivenId` is het
/// hoogste RAUWE NC-message-id, inclusief rijen die de noise-filter wegfiltert
/// (reactions, edit/delete-systeemrijen, emoji-only quoted replies). Spiegelt
/// de web-server (`ncGetMessages` → `lastGivenId` in messenger/nextcloud.ts):
/// zonder die cursor markeert mark-read alleen t/m het laatst ZICHTBARE bericht
/// en komt de unread-teller terug wanneer het nieuwste NC-event een gefilterde
/// rij is (bv. een 👍-reactie).
#[derive(Serialize, Clone)]
pub struct MessagesPage {
    pub messages: Vec<Message>,
    #[serde(rename = "lastGivenId", skip_serializing_if = "Option::is_none")]
    pub last_given_id: Option<u64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct MsgParent {
    pub id: String,
    pub text: String,
    pub sender: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub text: String,
    pub sender: String,
    #[serde(rename = "senderDisplayName")]
    pub sender_display_name: String,
    pub timestamp: String,
    #[serde(rename = "isOwn")]
    pub is_own: bool,
    pub platform: String,
    #[serde(rename = "messageType", skip_serializing_if = "Option::is_none")]
    pub message_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reactions: Option<Vec<Reaction>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<MsgParent>,
    #[serde(rename = "lastEditTimestamp", skip_serializing_if = "Option::is_none")]
    pub last_edit_timestamp: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted: Option<bool>,
}

/// Wire-compatibel met de FileEntry-interface van de web-server
/// (packages/server/src/nextcloud.ts) zodat NextCloudFiles.tsx ongewijzigd werkt.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NcFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified: String,
    pub content_type: String,
    pub is_directory: bool,
}

/// Haal de inhoud van `<d:TAG>…</d:TAG>` uit een response-blok. Probeert
/// zowel `d:` als `D:` (WebDAV-servers verschillen) — spiegelt de
/// case-insensitive regexes van de TS-parser zonder regex-dependency.
fn dav_tag<'a>(block: &'a str, tag: &str) -> Option<&'a str> {
    for prefix in ["d:", "D:"] {
        let open = format!("<{}{}>", prefix, tag);
        let close = format!("</{}{}>", prefix, tag);
        if let Some(s) = block.find(&open) {
            let rest = &block[s + open.len()..];
            if let Some(e) = rest.find(&close) {
                return Some(&rest[..e]);
            }
        }
    }
    None
}

/// PROPFIND-XML → FileEntry's. Spiegelt parsePropfindXml in
/// packages/server/src/nextcloud.ts: pad uit de href (na /remote.php/dav/
/// files/<user>/), map-detectie via <d:collection>, de opgevraagde map zelf
/// overslaan, en mappen-eerst + alfabetisch sorteren.
fn parse_propfind_xml(xml: &str, base_path: &str) -> Vec<NcFileEntry> {
    let mut entries: Vec<NcFileEntry> = Vec::new();
    // Splits op <d:response> / <D:response>
    let blocks: Vec<&str> = if xml.contains("<d:response>") {
        xml.split("<d:response>").skip(1).collect()
    } else {
        xml.split("<D:response>").skip(1).collect()
    };
    let clean_base = base_path.trim_end_matches('/');
    let clean_base = if clean_base.is_empty() { "/" } else { clean_base };

    for block in blocks {
        let href_raw = match dav_tag(block, "href") {
            Some(h) => h,
            None => continue,
        };
        let href = urlencoding::decode(href_raw).map(|c| c.into_owned()).unwrap_or_else(|_| href_raw.to_string());
        let is_directory = block.contains("<d:collection") || block.contains("<D:collection");

        // Pad afleiden: alles na /remote.php/dav/files/<user>/
        let mut file_path = String::from("/");
        if let Some(i) = href.find("/remote.php/dav/files/") {
            let after = &href[i + "/remote.php/dav/files/".len()..];
            if let Some(slash) = after.find('/') {
                file_path = after[slash..].to_string();
            }
        }
        let clean_file = {
            let t = file_path.trim_end_matches('/');
            if t.is_empty() { "/" } else { t }
        };
        // De opgevraagde map zelf overslaan (eerste response)
        if clean_file == clean_base {
            continue;
        }
        let name = dav_tag(block, "displayname")
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| clean_file.rsplit('/').next().unwrap_or("").to_string());
        if name.is_empty() {
            continue;
        }
        entries.push(NcFileEntry {
            name,
            path: clean_file.to_string(),
            size: dav_tag(block, "getcontentlength").and_then(|s| s.parse().ok()).unwrap_or(0),
            last_modified: dav_tag(block, "getlastmodified").unwrap_or("").to_string(),
            content_type: dav_tag(block, "getcontenttype")
                .map(|s| s.to_string())
                .unwrap_or_else(|| if is_directory { "directory".into() } else { "application/octet-stream".into() }),
            is_directory,
        });
    }
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

/// Rough "is this text only emoji/whitespace" check for the noise-filter
/// (emoji-only quoted replies are NC Talk reactions in disguise). Mirrors the
/// web regex without pulling in a unicode-regex dependency: 1-8 chars, each an
/// emoji-range codepoint, ZWJ, variation selector, or whitespace.
fn is_emoji_only(s: &str) -> bool {
    let t = s.trim();
    let n = t.chars().count();
    if n == 0 || n > 8 {
        return false;
    }
    t.chars().all(|c| {
        let u = c as u32;
        c.is_whitespace()
            || u == 0x200D // ZWJ
            || (0xFE00..=0xFE0F).contains(&u) // variation selectors
            || (0x2190..=0x2BFF).contains(&u) // arrows/symbols/dingbats
            || (0x1F000..=0x1FAFF).contains(&u) // emoji planes
    })
}

pub struct MessengerClient {
    http: Client,
    /// Cache van de opgeloste NC-uid per "base|user" (1u TTL). nc_resolve_uid
    /// deed anders een extra HTTP-round-trip vóór ELKE berichten-fetch.
    uid_cache: DashMap<String, (Instant, String)>,
}

impl MessengerClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("failed to create messenger HTTP client");
        Self { http, uid_cache: DashMap::new() }
    }

    // ── NextCloud Talk ──

    pub async fn nc_list_conversations(
        &self,
        url: &str,
        user: &str,
        pass: &str,
    ) -> Result<Vec<Conversation>, String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v4/room",
            url.trim_end_matches('/')
        );
        let res = self
            .http
            .get(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let empty = vec![];
        let rooms = data["ocs"]["data"].as_array().unwrap_or(&empty);
        Ok(rooms
            .iter()
            .map(|r| Conversation {
                id: r["token"].as_str().unwrap_or("").to_string(),
                name: r["displayName"].as_str().unwrap_or("").to_string(),
                last_message: r["lastMessage"]["message"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                // Web sends ISO-8601 (new Date(lastMessage.timestamp*1000).toISOString());
                // a raw unix string renders as "Invalid Date" in the list.
                last_message_time: r["lastMessage"]["timestamp"]
                    .as_i64()
                    .filter(|&t| t > 0)
                    .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default(),
                unread_count: r["unreadMessages"].as_u64().unwrap_or(0) as u32,
                participants: r["participantCount"].as_u64().unwrap_or(0) as u32,
                conv_type: match r["type"].as_u64().unwrap_or(0) {
                    1 => "one-to-one".to_string(),
                    2 => "group".to_string(),
                    3 => "public".to_string(),
                    _ => "unknown".to_string(),
                },
                platform: "nextcloud-talk".to_string(),
                pinned: r["isFavorite"].as_bool().unwrap_or(false),
            })
            .collect())
    }

    /// Resolve the real NC user id (e.g. "piet.mol") for the configured login,
    /// which is often an email. Needed for a correct isOwn check. One call per
    /// message-load (cheap; mirrors the web's ncResolveUid lookup).
    async fn nc_resolve_uid(&self, base: &str, user: &str, pass: &str) -> String {
        // De uid is stabiel voor de sessie; cache 'm (1u TTL) zodat niet élke
        // berichten-fetch eerst een extra HTTP-round-trip betaalt.
        let key = format!("{}|{}", base, user);
        if let Some(e) = self.uid_cache.get(&key) {
            if e.0.elapsed() < Duration::from_secs(3600) {
                return e.1.clone();
            }
        }
        let api_url = format!("{}/ocs/v1.php/cloud/user?format=json", base);
        let uid = match self
            .http
            .get(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(res) => match res.json::<serde_json::Value>().await {
                Ok(j) => j["ocs"]["data"]["id"].as_str().unwrap_or(user).to_string(),
                Err(_) => user.to_string(),
            },
            Err(_) => user.to_string(),
        };
        self.uid_cache.insert(key, (Instant::now(), uid.clone()));
        uid
    }

    /// Fetch a NextCloud URL with Basic auth and return it as a `data:` URL.
    /// Used to inline image previews: on the desktop there is no /api img-proxy
    /// and <img> loads bypass the fetch-adapter, so the frontend (which already
    /// renders `data:` srcs directly) gets the bytes embedded. None on failure.
    async fn nc_fetch_data_url(&self, url: &str, user: &str, pass: &str) -> Option<String> {
        let res = self
            .http
            .get(url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .send()
            .await
            .ok()?;
        if !res.status().is_success() {
            return None;
        }
        let content_type = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("image/jpeg")
            .to_string();
        let bytes = res.bytes().await.ok()?;
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        Some(format!("data:{};base64,{}", content_type, b64))
    }

    pub async fn nc_get_messages(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        limit: u32,
    ) -> Result<MessagesPage, String> {
        let base = url.trim_end_matches('/');
        let my_uid = self.nc_resolve_uid(base, user, pass).await;
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/chat/{}?limit={}&lookIntoFuture=0",
            base, room_token, limit
        );
        let res = self
            .http
            .get(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let empty = vec![];
        let msgs = data["ocs"]["data"].as_array().unwrap_or(&empty);
        let user_lc = user.to_lowercase();
        let my_uid_lc = my_uid.to_lowercase();

        let mut out: Vec<Message> = Vec::with_capacity(msgs.len());
        // (out_idx, attachment_idx, preview_url) — image-previews worden ná de
        // loop PARALLEL opgehaald i.p.v. 1 sequentiële HTTP-fetch per plaatje.
        let mut pending_previews: Vec<(usize, usize, String)> = Vec::new();
        // Hoogste RAUWE id — bijgewerkt vóór de noise-filter zodat gefilterde
        // rijen (reactions etc.) de cursor wél vooruit schuiven.
        let mut last_given_id: u64 = 0;
        for m in msgs {
            if let Some(raw_id) = m["id"].as_u64() {
                if raw_id > last_given_id {
                    last_given_id = raw_id;
                }
            }
            let msg_type = m["messageType"].as_str().unwrap_or("");
            let system_msg = m["systemMessage"].as_str().unwrap_or("");
            let raw_text = m["message"].as_str().unwrap_or("");
            let has_parent = m.get("parent").map(|p| !p.is_null()).unwrap_or(false);

            // ── Noise-filter (mirrors the web ncGetMessages) ──
            if msg_type == "reaction" || msg_type == "reaction_deleted" {
                continue;
            }
            if msg_type == "system"
                && (system_msg == "message_edited" || system_msg == "message_deleted")
            {
                continue;
            }
            if has_parent && is_emoji_only(raw_text) {
                continue;
            }

            // ── Reactions ──
            let mut reactions: Vec<Reaction> = Vec::new();
            if let Some(robj) = m["reactions"].as_object() {
                let self_set: Vec<String> = m["reactionsSelf"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                for (emoji, count) in robj {
                    reactions.push(Reaction {
                        emoji: emoji.clone(),
                        count: count.as_u64().unwrap_or(0) as u32,
                        user_reacted: self_set.iter().any(|e| e == emoji),
                    });
                }
            }

            // ── Attachments from messageParameters (file + rich-object/file) ──
            let mut attachments: Vec<Attachment> = Vec::new();
            if let Some(params) = m["messageParameters"].as_object() {
                for (_, p) in params {
                    let ptype = p["type"].as_str().unwrap_or("");
                    let subtype = p["subtype"].as_str().unwrap_or("");
                    let is_file = ptype == "file";
                    let is_rich_file = ptype == "rich-object" && subtype == "file";
                    if !is_file && !is_rich_file {
                        continue;
                    }
                    let mime = p["mimetype"].as_str().unwrap_or("");
                    let is_image = mime.starts_with("image/");
                    let id = p["id"]
                        .as_str()
                        .map(|s| s.to_string())
                        .or_else(|| p["id"].as_u64().map(|n| n.to_string()))
                        .or_else(|| p["objectId"].as_str().map(|s| s.to_string()))
                        .unwrap_or_default();
                    // Images: fetch the NC preview with Basic auth and embed it
                    // as a data: URL (desktop has no /api img-proxy; <img> loads
                    // bypass the fetch-adapter). This 300px thumb is the inline
                    // preview én de fallback voor de lightbox; de ware-afmetingen
                    // versie komt LAZY via `nc_get_full_image` (adapter-route
                    // /api/messenger/full-image) zodat de payload klein blijft.
                    // Non-images keep the NC link.
                    let (preview_url, link) = if is_image && !id.is_empty() {
                        // 300×300 (was 600×600): ~4x minder data per plaatje →
                        // fors sneller laden van gesprekken met veel afbeeldingen,
                        // scherp genoeg voor de inline chat-weergave.
                        let purl =
                            format!("{}/core/preview?fileId={}&x=300&y=300&a=true", base, id);
                        // Uitgesteld: previews worden ná de loop PARALLEL opgehaald
                        // (was 1 sequentiële HTTP-fetch per plaatje → traag bij
                        // gesprekken met meerdere afbeeldingen). We noteren de plek
                        // (bericht-index, bijlage-index) en vullen 'm straks in.
                        pending_previews.push((out.len(), attachments.len(), purl.clone()));
                        (None, purl)
                    } else {
                        (
                            None,
                            p["link"]
                                .as_str()
                                .or_else(|| p["url"].as_str())
                                .unwrap_or("")
                                .to_string(),
                        )
                    };
                    let name = p["name"]
                        .as_str()
                        .or_else(|| p["description"].as_str())
                        .unwrap_or(if is_rich_file { "screenshot" } else { "file" })
                        .to_string();
                    let mimetype = if mime.is_empty() {
                        if is_rich_file { "image/png" } else { "application/octet-stream" }.to_string()
                    } else {
                        mime.to_string()
                    };
                    attachments.push(Attachment {
                        id,
                        name,
                        mimetype,
                        size: p["size"].as_u64().unwrap_or(0),
                        link,
                        preview_url,
                    });
                }
            }

            // ── Text: drop entirely if only {placeholder}s + an attachment; else fill placeholders ──
            let mut text = raw_text.to_string();
            let stripped_empty = {
                let mut depth = 0i32;
                let mut visible = false;
                for ch in text.chars() {
                    match ch {
                        '{' => depth += 1,
                        '}' => {
                            if depth > 0 {
                                depth -= 1;
                            }
                        }
                        c if depth == 0 && !c.is_whitespace() => visible = true,
                        _ => {}
                    }
                }
                !visible
            };
            if stripped_empty && !attachments.is_empty() {
                text = String::new();
            } else if let Some(params) = m["messageParameters"].as_object() {
                for (key, p) in params {
                    let ptype = p["type"].as_str().unwrap_or("");
                    let placeholder = format!("{{{}}}", key);
                    if ptype == "file" {
                        let nm = p["name"].as_str().unwrap_or("file");
                        text = text.replace(&placeholder, nm);
                    } else if ptype == "user" {
                        let nm = p["name"].as_str().or_else(|| p["id"].as_str()).unwrap_or("");
                        text = text.replace(&placeholder, nm);
                    }
                }
            }

            // ── Parent (threaded reply) ──
            let parent = m.get("parent").filter(|p| !p.is_null()).map(|p| MsgParent {
                id: p["id"]
                    .as_u64()
                    .map(|n| n.to_string())
                    .or_else(|| p["id"].as_str().map(|s| s.to_string()))
                    .unwrap_or_default(),
                text: p["message"].as_str().unwrap_or("").to_string(),
                sender: p["actorDisplayName"]
                    .as_str()
                    .or_else(|| p["actorId"].as_str())
                    .unwrap_or("")
                    .to_string(),
            });

            // ── Timestamp → ISO-8601 (web: new Date(secs*1000).toISOString()) ──
            let ts_secs = m["timestamp"].as_i64().unwrap_or(0);
            let timestamp = if ts_secs > 0 {
                chrono::DateTime::from_timestamp(ts_secs, 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            } else {
                String::new()
            };

            // ── isOwn (actorId is the real uid; compare against resolved my_uid) ──
            let actor_id = m["actorId"].as_str().unwrap_or("");
            let actor_type = m["actorType"].as_str().unwrap_or("");
            let actor_lc = actor_id.to_lowercase();
            let is_own = actor_type == "users"
                && !actor_id.is_empty()
                && (actor_id == my_uid || actor_lc == my_uid_lc || actor_lc == user_lc);

            out.push(Message {
                id: m["id"].as_u64().map(|i| i.to_string()).unwrap_or_default(),
                text,
                sender: actor_id.to_string(),
                sender_display_name: m["actorDisplayName"]
                    .as_str()
                    .unwrap_or(actor_id)
                    .to_string(),
                timestamp,
                is_own,
                platform: "nextcloud-talk".to_string(),
                message_type: if msg_type.is_empty() {
                    None
                } else {
                    Some(msg_type.to_string())
                },
                reactions: if reactions.is_empty() { None } else { Some(reactions) },
                attachments: if attachments.is_empty() {
                    None
                } else {
                    Some(attachments)
                },
                parent,
                last_edit_timestamp: m["lastEditTimestamp"].as_i64().filter(|&n| n > 0),
                deleted: if msg_type == "comment_deleted" {
                    Some(true)
                } else {
                    None
                },
            });
        }

        // Preview-afbeeldingen PARALLEL ophalen (bounded op 8) i.p.v. sequentieel
        // per bericht, en de eerder genoteerde plekken invullen. Patchen gebeurt
        // vóór out.reverse() zodat de out-indices nog kloppen.
        if !pending_previews.is_empty() {
            use futures::stream::StreamExt;
            let fetched: Vec<(usize, usize, Option<String>)> = futures::stream::iter(
                pending_previews.into_iter().map(|(oi, ai, purl)| async move {
                    (oi, ai, self.nc_fetch_data_url(&purl, user, pass).await)
                }),
            )
            .buffer_unordered(8)
            .collect()
            .await;
            for (oi, ai, data) in fetched {
                if let Some(data_url) = data {
                    if let Some(att) = out
                        .get_mut(oi)
                        .and_then(|m| m.attachments.as_mut())
                        .and_then(|atts| atts.get_mut(ai))
                    {
                        att.preview_url = Some(data_url.clone());
                        att.link = data_url;
                    }
                }
            }
        }

        out.reverse(); // OCS returns newest first; the UI wants oldest first
        Ok(MessagesPage {
            messages: out,
            last_given_id: if last_given_id > 0 { Some(last_given_id) } else { None },
        })
    }

    /// Markeer een conversatie gelezen t/m `last_read_message`. Spiegelt de
    /// web-server-fix (ncMarkRead in messenger/nextcloud.ts): recente
    /// NextCloud-versies markeren zonder het `lastReadMessage`-body-veld
    /// effectief niets als gelezen (read-marker blijft op 0 → unread-teller
    /// komt terug). Stuur dus altijd het hoogste bekende rauwe id mee.
    pub async fn nc_mark_read(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        last_read_message: Option<i64>,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/chat/{}/read",
            url.trim_end_matches('/'),
            room_token
        );
        let mut req = self
            .http
            .post(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json");
        // Zelfde wire-vorm als de web (form-encoded body); alleen meesturen
        // bij een positief id — anders gedraagt het zich als de oude call.
        if let Some(id) = last_read_message.filter(|&n| n > 0) {
            req = req
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(format!("lastReadMessage={}", id));
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("mark-read failed: HTTP {}", res.status()));
        }
        Ok(())
    }

    /// Grote versie van een afbeelding-bijlage als `data:` URL — LAZY opgehaald
    /// (pas bij klik op de lightbox), zodat de conversatie-payload klein blijft
    /// (thumbnails 300px) maar de lightbox de échte afmetingen toont. x=3840
    /// spiegelt NC_PREVIEW_FULL_PX van de web-server; NC upscalet nooit en capt
    /// op de server-side preview_max, dus dit levert de ware grootte op.
    pub async fn nc_get_full_image(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        file_id: &str,
    ) -> Result<String, String> {
        let base = url.trim_end_matches('/');
        let purl = format!(
            "{}/core/preview?fileId={}&x=3840&y=3840&a=true",
            base,
            urlencoding::encode(file_id)
        );
        self.nc_fetch_data_url(&purl, user, pass)
            .await
            .ok_or_else(|| "preview fetch failed".to_string())
    }

    pub async fn nc_send_message(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        message: &str,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/chat/{}",
            url.trim_end_matches('/'),
            room_token
        );
        self.http
            .post(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "message": message }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Reactie (emoji) toevoegen of verwijderen op een bericht. Spiegelt de
    /// web-server: POST/DELETE /ocs/v2.php/apps/spreed/api/v1/reaction/…
    /// (ncReactToMessage / ncRemoveReaction in messenger/nextcloud.ts).
    pub async fn nc_react(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        message_id: &str,
        reaction: &str,
        remove: bool,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/reaction/{}/{}?reaction={}",
            url.trim_end_matches('/'),
            urlencoding::encode(room_token),
            urlencoding::encode(message_id),
            urlencoding::encode(reaction),
        );
        let req = if remove { self.http.delete(&api_url) } else { self.http.post(&api_url) };
        let res = req
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            return Err(format!("NC Talk reactie faalde ({})", res.status().as_u16()));
        }
        Ok(())
    }

    /// Eigen bericht bewerken. NC Talk accepteert dit binnen z'n edit-venster
    /// (standaard 6u); daarbuiten antwoordt de server 403/405 — die geven we
    /// als nette fout terug zodat de frontend z'n toast toont (zelfde gedrag
    /// als de web-server-handler).
    pub async fn nc_edit_message(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        message_id: &str,
        message: &str,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/chat/{}/{}",
            url.trim_end_matches('/'),
            urlencoding::encode(room_token),
            urlencoding::encode(message_id),
        );
        let res = self
            .http
            .put(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            // reqwest is hier zonder form-feature gebouwd → body handmatig
            // urlencoden (zelfde wire-formaat als de web-server: message=…).
            .body(format!("message={}", urlencoding::encode(message)))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(if status == 403 || status == 405 {
                "Bewerken niet (meer) toegestaan voor dit bericht".to_string()
            } else {
                format!("NC Talk bewerken faalde ({})", status)
            });
        }
        Ok(())
    }

    /// Eigen bericht verwijderen (NC Talk toont een placeholder-rij).
    pub async fn nc_delete_message(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        message_id: &str,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v1/chat/{}/{}",
            url.trim_end_matches('/'),
            urlencoding::encode(room_token),
            urlencoding::encode(message_id),
        );
        let res = self
            .http
            .delete(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(if status == 403 || status == 405 {
                "Verwijderen niet (meer) toegestaan voor dit bericht".to_string()
            } else {
                format!("NC Talk verwijderen faalde ({})", status)
            });
        }
        Ok(())
    }

    /// WebDAV-bestaanscheck (PROPFIND Depth:0). 404 = vrij, 2xx = bestaat,
    /// andere status = onbetrouwbaar (caller valt terug op timestamp-naam).
    async fn dav_path_exists(&self, full_url: &str, user: &str, pass: &str) -> Result<bool, String> {
        let r = self
            .http
            .request(
                reqwest::Method::from_bytes(b"PROPFIND").expect("PROPFIND method"),
                full_url,
            )
            .basic_auth(user, Some(pass))
            .header("Depth", "0")
            .send()
            .await;
        match r {
            Ok(resp) if resp.status().as_u16() == 404 => Ok(false),
            Ok(resp) if resp.status().is_success() => Ok(true),
            Ok(resp) => Err(format!("PROPFIND check faalde ({})", resp.status().as_u16())),
            Err(e) => Err(e.to_string()),
        }
    }

    /// Bestand (bv. geplakt plaatje) uploaden naar een Talk-gesprek. Spiegelt
    /// de web-server-flow (messengerUploadFile in messenger.ts) exact:
    ///  0. vrije naam zoeken ("naam (2).ext" bij botsing, PROPFIND Depth:0) —
    ///     hergebruik van een naam zou (a) het oudere bestand overschrijven en
    ///     (b) een 403 "pad is al gedeeld" geven bij het opnieuw delen;
    ///  1. WebDAV PUT naar /remote.php/dav/files/{user}/Talk/{naam};
    ///  2. OCS-share (shareType 10) naar het gesprek, met optionele
    ///     talkMetaData.caption (bijschrift in dezelfde bubble, NC Talk 19+)
    ///     en talkMetaData.replyTo.
    /// Retourneert de uiteindelijke bestandsnaam.
    pub async fn nc_upload_file(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        file_data_b64: &str,
        file_name: &str,
        mime_type: &str,
        caption: &str,
        reply_to: &str,
    ) -> Result<String, String> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(file_data_b64)
            .map_err(|e| format!("ongeldige base64: {}", e))?;

        let base = url.trim_end_matches('/');
        let dav_base = format!(
            "{}/remote.php/dav/files/{}/Talk",
            base,
            urlencoding::encode(user)
        );

        // 0. Vrije naam zoeken (PROPFIND Depth:0; 404 = vrij). Onbekende
        //    status → val terug op een gegarandeerd-unieke timestamp-naam,
        //    zodat de upload nooit blijft hangen op de naamcheck.
        let dot = file_name.rfind('.').filter(|&i| i > 0);
        let (stem, ext) = match dot {
            Some(i) => (&file_name[..i], &file_name[i..]),
            None => (file_name, ""),
        };
        let mut final_name = file_name.to_string();
        let mut resolved = false;
        for n in 1..=1000u32 {
            let candidate = if n == 1 {
                file_name.to_string()
            } else {
                format!("{} ({}){}", stem, n, ext)
            };
            let check_url = format!("{}/{}", dav_base, urlencoding::encode(&candidate));
            match self.dav_path_exists(&check_url, user, pass).await {
                Ok(false) => {
                    final_name = candidate;
                    resolved = true;
                    break;
                }
                Ok(true) => continue,
                Err(_) => break, // check onbetrouwbaar → timestamp-fallback
            }
        }
        if !resolved {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            final_name = format!("{} ({}){}", stem, ts, ext);
        }

        // 1. WebDAV PUT
        let put_url = format!("{}/{}", dav_base, urlencoding::encode(&final_name));
        let put = self
            .http
            .put(&put_url)
            .basic_auth(user, Some(pass))
            .header("Content-Type", mime_type)
            .timeout(Duration::from_secs(30))
            .body(bytes)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let put_status = put.status().as_u16();
        if !(200..300).contains(&put_status) {
            return Err(format!("WebDAV upload faalde ({})", put_status));
        }

        // 2. OCS-share naar het gesprek. reqwest hier zonder form-feature →
        //    urlencoded body handmatig opbouwen (zelfde wire-formaat als de
        //    web-server: URLSearchParams).
        let mut form: Vec<(&str, String)> = vec![
            ("path", format!("/Talk/{}", final_name)),
            ("shareType", "10".to_string()),
            ("shareWith", room_token.to_string()),
        ];
        let mut meta = serde_json::Map::new();
        if !caption.is_empty() {
            meta.insert("caption".into(), serde_json::Value::String(caption.to_string()));
        }
        if !reply_to.is_empty() {
            meta.insert("replyTo".into(), serde_json::Value::String(reply_to.to_string()));
        }
        if !meta.is_empty() {
            form.push(("talkMetaData", serde_json::Value::Object(meta).to_string()));
        }
        let form_body = form
            .iter()
            .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");
        let share = self
            .http
            .post(format!(
                "{}/ocs/v2.php/apps/files_sharing/api/v1/shares",
                base
            ))
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(form_body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let share_status = share.status().as_u16();
        if !(200..300).contains(&share_status) {
            return Err(format!("Delen in gesprek faalde ({})", share_status));
        }
        Ok(final_name)
    }

    /// Nieuw Talk-gesprek aanmaken (web-pariteit: POST /api/messenger/create-conversation).
    /// room_type: 1=one-to-one, 2=group, 3=public. Retourneert (token, displayName, type).
    pub async fn nc_create_conversation(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_type: u8,
        invite: &str,
        room_name: &str,
    ) -> Result<(String, String, u64), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v4/room?format=json",
            url.trim_end_matches('/')
        );
        let mut body = format!("roomType={}", room_type);
        if !invite.is_empty() {
            body.push_str(&format!("&invite={}", urlencoding::encode(invite)));
        }
        if !room_name.is_empty() {
            body.push_str(&format!("&roomName={}", urlencoding::encode(room_name)));
        }
        let res = self
            .http
            .post(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        if !(200..300).contains(&status) {
            let msg = data["ocs"]["meta"]["message"].as_str().unwrap_or("Failed to create conversation");
            return Err(msg.to_string());
        }
        let room = &data["ocs"]["data"];
        Ok((
            room["token"].as_str().unwrap_or("").to_string(),
            room["displayName"].as_str().unwrap_or("").to_string(),
            room["type"].as_u64().unwrap_or(room_type as u64),
        ))
    }

    /// Deelnemer toevoegen aan een Talk-gesprek (web-pariteit:
    /// POST /api/messenger/add-participant; body newParticipant + source=users).
    pub async fn nc_add_participant(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        room_token: &str,
        user_id: &str,
    ) -> Result<(), String> {
        let api_url = format!(
            "{}/ocs/v2.php/apps/spreed/api/v4/room/{}/participants?format=json",
            url.trim_end_matches('/'),
            urlencoding::encode(room_token),
        );
        let body = format!("newParticipant={}&source=users", urlencoding::encode(user_id));
        let res = self
            .http
            .post(&api_url)
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            let data: serde_json::Value = res.json().await.unwrap_or_default();
            let msg = data["ocs"]["meta"]["message"].as_str().unwrap_or("Failed to add participant");
            return Err(format!("{} ({})", msg, status));
        }
        Ok(())
    }

    // ── NextCloud bestanden (WebDAV) — spiegelt packages/server/src/nextcloud.ts ──

    /// Map-inhoud via PROPFIND Depth:1. Zelfde velden + sortering (mappen
    /// eerst, dan alfabetisch) als de web-server zodat NextCloudFiles.tsx
    /// ongewijzigd werkt.
    pub async fn nc_files_list(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        path: &str,
    ) -> Result<Vec<NcFileEntry>, String> {
        let clean_path = if path.starts_with('/') { path.to_string() } else { format!("/{}", path) };
        let encoded_path: String = clean_path
            .split('/')
            .map(|s| urlencoding::encode(s).into_owned())
            .collect::<Vec<_>>()
            .join("/");
        let dav_url = format!(
            "{}/remote.php/dav/files/{}{}",
            url.trim_end_matches('/'),
            urlencoding::encode(user),
            encoded_path,
        );
        let body = r#"<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>"#;
        let res = self
            .http
            .request(reqwest::Method::from_bytes(b"PROPFIND").expect("PROPFIND"), &dav_url)
            .basic_auth(user, Some(pass))
            .header("Depth", "1")
            .header("Content-Type", "application/xml")
            .body(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(format!("PROPFIND faalde ({})", status));
        }
        let xml = res.text().await.map_err(|e| e.to_string())?;
        Ok(parse_propfind_xml(&xml, &clean_path))
    }

    /// Bestand downloaden; retourneert (bytes, content-type).
    pub async fn nc_files_download(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        path: &str,
    ) -> Result<(Vec<u8>, String), String> {
        let clean_path = if path.starts_with('/') { path.to_string() } else { format!("/{}", path) };
        let encoded_path: String = clean_path
            .split('/')
            .map(|s| urlencoding::encode(s).into_owned())
            .collect::<Vec<_>>()
            .join("/");
        let dav_url = format!(
            "{}/remote.php/dav/files/{}{}",
            url.trim_end_matches('/'),
            urlencoding::encode(user),
            encoded_path,
        );
        let res = self
            .http
            .get(&dav_url)
            .basic_auth(user, Some(pass))
            .timeout(Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(format!("Download faalde ({})", status));
        }
        let ct = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_string();
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        Ok((bytes.to_vec(), ct))
    }

    /// Bestand uploaden (WebDAV PUT) naar een expliciet pad.
    pub async fn nc_files_upload(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        path: &str,
        file_data_b64: &str,
        content_type: &str,
    ) -> Result<(), String> {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(file_data_b64)
            .map_err(|e| format!("ongeldige base64: {}", e))?;
        let clean_path = if path.starts_with('/') { path.to_string() } else { format!("/{}", path) };
        let encoded_path: String = clean_path
            .split('/')
            .map(|s| urlencoding::encode(s).into_owned())
            .collect::<Vec<_>>()
            .join("/");
        let dav_url = format!(
            "{}/remote.php/dav/files/{}{}",
            url.trim_end_matches('/'),
            urlencoding::encode(user),
            encoded_path,
        );
        let res = self
            .http
            .put(&dav_url)
            .basic_auth(user, Some(pass))
            .header("Content-Type", content_type)
            .timeout(Duration::from_secs(60))
            .body(bytes)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(format!("Upload faalde ({})", status));
        }
        Ok(())
    }

    /// Publieke (read-only) share-link aanmaken; retourneert de URL.
    pub async fn nc_files_share(
        &self,
        url: &str,
        user: &str,
        pass: &str,
        path: &str,
    ) -> Result<String, String> {
        let body = format!(
            "path={}&shareType=3&permissions=1",
            urlencoding::encode(path)
        );
        let res = self
            .http
            .post(format!(
                "{}/ocs/v2.php/apps/files_sharing/api/v1/shares",
                url.trim_end_matches('/')
            ))
            .basic_auth(user, Some(pass))
            .header("OCS-APIRequest", "true")
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(format!("Share aanmaken faalde ({})", status));
        }
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        data["ocs"]["data"]["url"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Geen share-URL in respons".to_string())
    }

    /// Generiek geauthenticeerd DAV/HTTP-verzoek (Basic auth). De webview kan
    /// zelf geen cross-origin PROPFIND/PUT doen (CORS); de CalDAV-logica leeft
    /// in TS (adapter, gespiegeld van routes/calendar.ts) en gebruikt dit
    /// bruggetje alleen voor het netwerk. Retourneert (status, body).
    pub async fn dav_request(
        &self,
        method: &str,
        url: &str,
        user: &str,
        pass: &str,
        content_type: &str,
        depth: &str,
        body: String,
    ) -> Result<(u16, String), String> {
        let m = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
        let mut req = self
            .http
            .request(m, url)
            .basic_auth(user, Some(pass))
            .timeout(Duration::from_secs(20));
        if !content_type.is_empty() {
            req = req.header("Content-Type", content_type);
        }
        if !depth.is_empty() {
            req = req.header("Depth", depth);
        }
        if !body.is_empty() {
            req = req.body(body);
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        let status = res.status().as_u16();
        let text = res.text().await.unwrap_or_default();
        Ok((status, text))
    }

    // ── Telegram ──

    pub async fn tg_get_updates(&self, token: &str) -> Result<Vec<Conversation>, String> {
        let api_url = format!("https://api.telegram.org/bot{}/getUpdates", token);
        let res = self
            .http
            .get(&api_url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
        let empty = vec![];
        let results = data["result"].as_array().unwrap_or(&empty);
        let mut seen = std::collections::HashSet::new();
        let mut convos = vec![];
        for update in results.iter().rev() {
            let chat = &update["message"]["chat"];
            let chat_id = chat["id"].as_i64().unwrap_or(0).to_string();
            if seen.insert(chat_id.clone()) {
                convos.push(Conversation {
                    id: chat_id,
                    name: chat["title"]
                        .as_str()
                        .or(chat["first_name"].as_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    last_message: update["message"]["text"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    last_message_time: update["message"]["date"]
                        .as_u64()
                        .map(|t| t.to_string())
                        .unwrap_or_default(),
                    unread_count: 0,
                    participants: 0,
                    conv_type: chat["type"]
                        .as_str()
                        .unwrap_or("private")
                        .to_string(),
                    platform: "telegram".to_string(),
                    pinned: false,
                });
            }
        }
        Ok(convos)
    }

    pub async fn tg_send_message(
        &self,
        token: &str,
        chat_id: &str,
        text: &str,
    ) -> Result<(), String> {
        let api_url = format!("https://api.telegram.org/bot{}/sendMessage", token);
        self.http
            .post(&api_url)
            .json(&serde_json::json!({ "chat_id": chat_id, "text": text }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
