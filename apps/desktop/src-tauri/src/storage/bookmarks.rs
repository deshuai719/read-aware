use super::Db;
use rusqlite::params;
use serde::Serialize;
use tauri::State;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingBookmark {
    pub id: String,
    pub book_id: String,
    pub anchor: String,
    pub chapter_href: Option<String>,
    pub title: String,
    pub excerpt: String,
    pub fraction: Option<f64>,
    pub source_sha256: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[tauri::command]
pub fn reading_bookmarks_list(
    book_id: Option<String>,
    db: State<'_, Db>,
) -> Result<Vec<ReadingBookmark>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt=conn.prepare("SELECT * FROM reading_bookmarks WHERE (?1 IS NULL OR book_id=?1) ORDER BY fraction IS NULL,fraction,created_at,id").map_err(|e|e.to_string())?;
    let rows = stmt
        .query_map(params![book_id], |r| {
            Ok(ReadingBookmark {
                id: r.get("id")?,
                book_id: r.get("book_id")?,
                anchor: r.get("anchor")?,
                chapter_href: r.get("chapter_href")?,
                title: r.get("title")?,
                excerpt: r.get("excerpt")?,
                fraction: r.get("fraction")?,
                source_sha256: r.get("source_sha256")?,
                created_at: r.get("created_at")?,
                updated_at: r.get("updated_at")?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
