use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub theme_color: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Meeting {
    pub id: String,
    pub data: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Database {
    pub fn new(data_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("desktop.db");
        let conn = Connection::open(db_path).expect("failed to open SQLite database");

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                theme_color TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS instance_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
                setting_key TEXT NOT NULL,
                setting_value TEXT,
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(instance_id, setting_key)
            );

            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS meetings (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );
        ",
        )
        .expect("failed to initialize database schema");

        Self {
            conn: Mutex::new(conn),
        }
    }

    // ── Instances ──

    pub fn list_instances(&self) -> Vec<Instance> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, url, theme_color, created_at FROM instances ORDER BY created_at",
            )
            .unwrap();
        stmt.query_map([], |row| {
            Ok(Instance {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                theme_color: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    pub fn add_instance(&self, name: &str, url: &str, theme_color: Option<&str>) -> Instance {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO instances (name, url, theme_color) VALUES (?1, ?2, ?3)",
            params![name, url, theme_color],
        )
        .unwrap();
        let id = conn.last_insert_rowid();
        let created_at: String = conn
            .query_row(
                "SELECT created_at FROM instances WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap();
        Instance {
            id,
            name: name.to_string(),
            url: url.to_string(),
            theme_color: theme_color.map(String::from),
            created_at,
        }
    }

    pub fn update_instance(
        &self,
        id: i64,
        name: Option<&str>,
        url: Option<&str>,
        theme_color: Option<&str>,
    ) -> Option<Instance> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE instances SET name = COALESCE(?1, name), url = COALESCE(?2, url), theme_color = COALESCE(?3, theme_color) WHERE id = ?4",
            params![name, url, theme_color, id],
        ).unwrap();
        conn.query_row(
            "SELECT id, name, url, theme_color, created_at FROM instances WHERE id = ?1",
            params![id],
            |row| {
                Ok(Instance {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    url: row.get(2)?,
                    theme_color: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .ok()
    }

    pub fn delete_instance(&self, id: i64) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM instances WHERE id = ?1", params![id])
            .unwrap();
    }

    pub fn get_instance_url(&self, id: i64) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT url FROM instances WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok()
    }

    // ── Settings ──

    pub fn get_instance_settings(
        &self,
        instance_id: i64,
    ) -> std::collections::HashMap<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT setting_key, setting_value FROM instance_settings WHERE instance_id = ?1",
            )
            .unwrap();
        let mut map = std::collections::HashMap::new();
        for row in stmt
            .query_map(params![instance_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .filter_map(|r| r.ok())
        {
            map.insert(row.0, row.1);
        }
        map
    }

    pub fn put_instance_setting(&self, instance_id: i64, key: &str, value: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO instance_settings (instance_id, setting_key, setting_value, updated_at) VALUES (?1, ?2, ?3, datetime('now')) ON CONFLICT(instance_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at",
            params![instance_id, key, value],
        ).unwrap();
    }

    pub fn get_user_setting(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT setting_value FROM instance_settings WHERE setting_key = ?1 LIMIT 1",
            params![key],
            |row| row.get(0),
        )
        .ok()
    }

    // ── Preferences ──

    pub fn get_preference(&self, key: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM preferences WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .ok()
    }

    pub fn set_preference(&self, key: &str, value: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .unwrap();
    }

    pub fn delete_preference(&self, key: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM preferences WHERE key = ?1", params![key])
            .unwrap();
    }

    pub fn all_preferences(&self) -> std::collections::HashMap<String, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM preferences").unwrap();
        let mut map = std::collections::HashMap::new();
        for row in stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .filter_map(|r| r.ok())
        {
            map.insert(row.0, row.1);
        }
        map
    }

    // ── Meetings ──

    pub fn list_meetings(&self) -> Vec<Meeting> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT id, data, created_at, updated_at FROM meetings ORDER BY updated_at DESC",
            )
            .unwrap();
        stmt.query_map([], |row| {
            Ok(Meeting {
                id: row.get(0)?,
                data: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    pub fn save_meeting(&self, id: &str, data: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO meetings (id, data) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')",
            params![id, data],
        ).unwrap();
    }

    pub fn delete_meeting(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM meetings WHERE id = ?1", params![id])
            .unwrap();
    }
}
