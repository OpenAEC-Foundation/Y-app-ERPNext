//! Headless mail performance profiler (desktop crate).
//!
//! Meet de latentie van elke IMAP-operatie tegen een échte mailbox, zodat we
//! traagheid (mappenlijst-reload, mail-openen) kunnen aanwijzen i.p.v. gokken.
//! Draait NIET in de app — puur een meet-tool. Creds via env:
//!   MAIL_HOST, MAIL_PORT (993), MAIL_USER, MAIL_PASS, MAIL_SECURE (true), MAIL_FOLDER (INBOX)
//!
//! Run:  cargo run --example mailprofile   (met de env-vars gezet)

use std::env;
use std::time::Instant;
use y_app_desktop_lib::mail::{
    op_get_bodies, op_get_conversation, op_list_folders, op_list_messages, MailCredentials,
    MailPool,
};

fn main() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
    rt.block_on(run());
}

async fn run() {
    let creds = MailCredentials {
        host: env::var("MAIL_HOST").expect("MAIL_HOST ontbreekt"),
        port: env::var("MAIL_PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(993),
        user: env::var("MAIL_USER").expect("MAIL_USER ontbreekt"),
        pass: env::var("MAIL_PASS").expect("MAIL_PASS ontbreekt"),
        secure: env::var("MAIL_SECURE").map(|v| v != "false").unwrap_or(true),
        auth_mode: None,
        access_token: None,
        smtp_host: None,
        smtp_port: None,
        smtp_secure: None,
    };
    let folder = env::var("MAIL_FOLDER").unwrap_or_else(|_| "INBOX".to_string());
    let pool = MailPool::new();

    macro_rules! ms {
        ($label:expr, $e:expr) => {{
            let t = Instant::now();
            let r = $e;
            let el = t.elapsed().as_millis();
            match &r {
                Ok(_) => println!("{:<34} {:>6} ms", $label, el),
                Err(e) => println!("{:<34} {:>6} ms  ERR: {}", $label, el, e),
            }
            r
        }};
    }

    println!("== mailprofile: {}@{}:{} secure={} folder={} ==", creds.user, creds.host, creds.port, creds.secure, folder);

    // 1) Eerste op = connect + login + LIST (+ examine INBOX/special-use).
    let folders = ms!("connect + list_folders (cold)", op_list_folders(&pool, &creds).await);
    if let Ok(fs) = &folders {
        println!("   -> {} mappen", fs.len());
    }
    // 2) Warm (verbinding hergebruikt) — puur de folder-LIST-kosten.
    let _ = ms!("list_folders (warm)", op_list_folders(&pool, &creds).await);

    // 3) Berichtenlijst INBOX pagina 1 (dit gebeurt bij elke tab-switch).
    let list = ms!("list_messages p1/50", op_list_messages(&pool, &creds, &folder, 1, 50).await);
    let mut uid = 0u32;
    let mut subject = String::new();
    // Kies desgewenst een specifiek bericht op subject-substring (MAIL_SUBJECT),
    // anders het nieuwste. Handig om precies de mail-met-afbeeldingen te pakken.
    let want = env::var("MAIL_SUBJECT").unwrap_or_default().to_lowercase();
    if let Ok(ml) = &list {
        println!("   -> {} berichten (totaal {})", ml.messages.len(), ml.total);
        let pick = if want.is_empty() {
            ml.messages.first()
        } else {
            ml.messages
                .iter()
                .find(|m| m.subject.to_lowercase().contains(&want))
                .or_else(|| ml.messages.first())
        };
        if let Some(m) = pick {
            uid = m.uid;
            subject = m.subject.clone();
        }
        println!("   -> gekozen bericht: uid {} subject {:?}", uid, subject);
    }

    // 4) Eén mail-body ophalen (read-only EXAMINE + BODY.PEEK + parse +
    //    inline-image-embed). op_get_bodies i.p.v. op_get_message zodat we
    //    tijdens het meten géén mail als gelezen markeren in het echte postvak.
    if uid > 0 {
        let full = ms!(format!("get_bodies uid {}", uid), op_get_bodies(&pool, &creds, &folder, &[uid], false).await);
        if let Ok(v) = &full {
            if let Some(m) = v.first() {
                println!("   -> html {} KB, text {} KB, {} bijlagen", m.html_body.len() / 1024, m.text_body.len() / 1024, m.attachments.len());
                // Diagnose afbeeldingen: bijlage-Content-ID's + de img-src-schemes
                // in de HTML. Geen body-tekst — alleen de verwijzingen.
                for a in &m.attachments {
                    println!("      bijlage: name={:?} type={} cid={:?}", a.filename, a.content_type, a.content_id);
                }
                let mut n = 0;
                for (i, part) in m.html_body.split("src=").enumerate() {
                    if i == 0 {
                        continue;
                    }
                    let val: String = part
                        .trim_start_matches(['"', '\''])
                        .chars()
                        .take(80)
                        .collect();
                    println!("      img src[{}]: {}", i, val.replace(['\n', '\r'], " "));
                    n += 1;
                    if n >= 12 {
                        break;
                    }
                }
                println!("   -> HTML bevat 'cid:': {}   'data:image': {}", m.html_body.contains("cid:"), m.html_body.contains("data:image"));
            }
        }
        let _ = ms!("get_bodies (2e keer, warm)", op_get_bodies(&pool, &creds, &folder, &[uid], false).await);
        // 5) Conversatie-reconstructie (scant meerdere mappen).
        let conv = ms!("get_conversation", op_get_conversation(&pool, &creds, &folder, &subject).await);
        if let Ok(c) = &conv {
            println!("   -> {} berichten in conversatie", c.len());
        }
    }
    println!("== done ==");
}
