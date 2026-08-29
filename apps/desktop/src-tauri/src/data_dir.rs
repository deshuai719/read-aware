//! Resolvable app-data root (desktop only).
//!
//! Everything the app persists (SQLite DB, `blobs/`, `secret.key`, user
//! `plugins/`) is rooted at a single data directory. By default that is
//! Tauri's `app_data_dir()` (`%APPDATA%\com.readaware.app` on Windows), which
//! sits on the OS drive. Users asked for the option to keep that data
//! elsewhere (install drive or an explicitly chosen folder), so the root is
//! now resolvable from three explicit overrides, in precedence order:
//!
//! 1. `READAWARE_DATA_DIR` environment variable (testing / power users)
//! 2. `<default_app_data>/data-dir.json` → `dataDir` (settings page)
//! 3. `<exe_dir>/portable.txt` marker → `<exe_dir>/data` (portable install)
//! 4. default `app_data_dir()` (backwards compatible)
//!
//! A settings-initiated move is staged in the marker as `pending`; the actual
//! copy runs on the NEXT boot, BEFORE the SQLite connection opens (a running
//! app can never safely relocate the open database). The old directory is
//! never modified by the migration — rollback is "delete the marker, point
//! back at the old root".
//!
//! The module compiles on every target so the commands can register in the
//! shared invoke handler, but mobile never runs migrations or honors
//! overrides: `lib.rs` calls `resolve_with_app` only under `#[cfg(desktop)]`
//! and falls back to `app_data_dir()` there.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Marker file name, stored in the DEFAULT app-data dir. Tiny (a few hundred
/// bytes) on purpose: it must be readable before the DB exists, and the whole
/// point of the feature is that the heavy data lives elsewhere.
const DATA_DIR_FILE: &str = "data-dir.json";
/// Next to the executable: presence switches the root to `<exe_dir>/data`.
const PORTABLE_MARKER: &str = "portable.txt";
const APP_ID: &str = "com.readaware.app";
const PORTABLE_SUBDIR: &str = "data";

/// Where a custom root came from; surfaced in the settings UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DataDirSource {
    Default,
    Custom,
    Portable,
    Env,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PendingMigration {
    pub target: String,
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationNotice {
    pub ok: bool,
    pub message: String,
    pub at_ms: u64,
}

/// `data-dir.json` contents. All fields optional so an absent/corrupt file
/// degrades to the default root instead of bricking the app.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DataDirMarker {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub data_dir: Option<String>,
    #[serde(default)]
    pub pending: Option<PendingMigration>,
    #[serde(default)]
    pub last_result: Option<MigrationNotice>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDirInfo {
    pub active_dir: String,
    pub default_dir: String,
    pub source: DataDirSource,
    pub pending: Option<PendingMigration>,
    pub last_result: Option<MigrationNotice>,
}

/// Fallback default root for the early (pre-AppHandle) log-plugin resolution.
/// Mirrors Tauri's `app_data_dir()` on every desktop OS.
pub fn default_app_data_dir() -> PathBuf {
    dirs::data_dir()
        .map(|dir| dir.join(APP_ID))
        .unwrap_or_else(|| PathBuf::from(APP_ID))
}

fn marker_path(default: &Path) -> PathBuf {
    default.join(DATA_DIR_FILE)
}

fn read_marker(default: &Path) -> DataDirMarker {
    fs::read_to_string(marker_path(default))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn write_marker(default: &Path, marker: &DataDirMarker) -> Result<(), String> {
    let path = marker_path(default);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("creating marker dir: {e}"))?;
    }
    let tmp = path.with_extension("json.tmp");
    let json =
        serde_json::to_string_pretty(marker).map_err(|e| format!("serializing marker: {e}"))?;
    fs::write(&tmp, json).map_err(|e| format!("writing marker: {e}"))?;
    // Windows rename does not replace an existing destination; remove first.
    let _ = fs::remove_file(&path);
    fs::rename(&tmp, &path).map_err(|e| format!("finalizing marker: {e}"))
}

fn env_override() -> Option<PathBuf> {
    std::env::var_os("READAWARE_DATA_DIR")
        .map(PathBuf::from)
        .filter(|dir| !dir.as_os_str().is_empty())
}

fn current_exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Pure precedence resolution; injectable for tests.
fn resolve(
    default: &Path,
    exe_dir: Option<&Path>,
    env_dir: Option<PathBuf>,
    marker: &DataDirMarker,
) -> (PathBuf, DataDirSource) {
    if let Some(dir) = env_dir {
        return (dir, DataDirSource::Env);
    }
    if let Some(dir) = marker.data_dir.as_deref().filter(|dir| !dir.is_empty()) {
        return (PathBuf::from(dir), DataDirSource::Custom);
    }
    if let Some(exe) = exe_dir.filter(|exe| exe.join(PORTABLE_MARKER).is_file()) {
        return (exe.join(PORTABLE_SUBDIR), DataDirSource::Portable);
    }
    (default.to_path_buf(), DataDirSource::Default)
}

/// Early resolution for the log plugin, which initializes before an AppHandle
/// exists. Desktop logs always follow the data root (`<data_dir>/logs`) so the
/// settings surface and the boot code agree on one path; the default root is a
/// perfectly valid target too.
pub fn early_resolve() -> PathBuf {
    let default = default_app_data_dir();
    let marker = read_marker(&default);
    let (dir, _source) = resolve(
        &default,
        current_exe_dir().as_deref(),
        env_override(),
        &marker,
    );
    dir
}

/// Boot-time resolution: run any staged migration, then return the root the
/// app should open its database at. On migration failure the app continues on
/// the OLD root (source data is never touched by a failed copy).
pub fn resolve_with_app(app: &AppHandle) -> Result<PathBuf, String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let mut marker = read_marker(&default);
    let (active, _source) = resolve(
        &default,
        current_exe_dir().as_deref(),
        env_override(),
        &marker,
    );

    let Some(pending) = marker.pending.clone() else {
        return Ok(active);
    };
    let target = PathBuf::from(&pending.target);
    if target == active {
        // Already there (e.g. prepared, migrated, marker not yet updated by a
        // crashed run) — just clear the stale pending flag.
        marker.pending = None;
        write_marker(&default, &marker)?;
        return Ok(active);
    }

    match migrate(&active, &target) {
        Ok(()) => {
            marker.data_dir = Some(pending.target.clone());
            marker.pending = None;
            marker.last_result = Some(MigrationNotice {
                ok: true,
                message: format!("data moved to {}", pending.target),
                at_ms: now_ms(),
            });
            write_marker(&default, &marker)?;
            log::info!(
                "[data-dir] migration complete: {} -> {}",
                active.display(),
                target.display()
            );
            Ok(target)
        }
        Err(error) => {
            // Failed copy leaves the source untouched; keep the app usable on
            // the old root and stop auto-retrying (the UI offers a re-run).
            marker.pending = None;
            marker.last_result = Some(MigrationNotice {
                ok: false,
                message: error.clone(),
                at_ms: now_ms(),
            });
            write_marker(&default, &marker)?;
            log::error!(
                "[data-dir] migration to {} failed, staying on {}: {error}",
                target.display(),
                active.display()
            );
            Ok(active)
        }
    }
}

/// Copy the data the app cannot regenerate (DB + WAL residue, encryption key,
/// blobs, user plugins). `bundled-plugins/` and `logs/` are deliberately NOT
/// copied: the former re-extracts from the binary per version, the latter is
/// disposable diagnostics.
fn migrate(src: &Path, dst: &Path) -> Result<(), String> {
    validate_target(dst, src)?;
    fs::create_dir_all(dst).map_err(|e| format!("creating target dir: {e}"))?;
    for name in [
        "read-aware.db",
        "read-aware.db-wal",
        "read-aware.db-shm",
        "secret.key",
    ] {
        let from = src.join(name);
        if from.is_file() {
            fs::copy(&from, dst.join(name)).map_err(|e| format!("copying {name}: {e}"))?;
        }
    }
    for name in ["blobs", "plugins"] {
        let from = src.join(name);
        if from.is_dir() {
            copy_tree(&from, &dst.join(name), &[".candidates", ".rollback"])?;
        }
    }
    verify_migrated_db(&dst.join("read-aware.db"))
}

fn copy_tree(src: &Path, dst: &Path, skip: &[&str]) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("creating {dst:?}: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("reading {src:?}: {e}"))? {
        let entry = entry.map_err(|e| format!("reading {src:?}: {e}"))?;
        let name = entry.file_name();
        if skip.contains(&name.to_string_lossy().as_ref()) {
            continue;
        }
        let from = entry.path();
        let to = dst.join(&name);
        if entry
            .file_type()
            .map_err(|e| format!("stat {from:?}: {e}"))?
            .is_dir()
        {
            copy_tree(&from, &to, skip)?;
        } else {
            fs::copy(&from, &to).map_err(|e| format!("copying {from:?} -> {to:?}: {e}"))?;
        }
    }
    Ok(())
}

/// The copied DB must open and pass SQLite's own integrity check; a broken
/// copy must never become the live root.
fn verify_migrated_db(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err("migrated database missing".into());
    }
    let conn = rusqlite::Connection::open(path)
        .map_err(|e| format!("migrated database does not open: {e}"))?;
    let result: String = conn
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|e| format!("migrated database failed quick_check: {e}"))?;
    if result != "ok" {
        return Err(format!("migrated database quick_check: {result}"));
    }
    Ok(())
}

/// Reject targets that would lose data, recurse into the live root, or sit on
/// a drive root. Also probes writability by creating the folder.
pub fn validate_target(target: &Path, active: &Path) -> Result<(), String> {
    if target.as_os_str().is_empty() {
        return Err("data directory path is empty".into());
    }
    if target.is_file() {
        return Err("the chosen path is a file, not a folder".into());
    }
    if target == active {
        return Err("the chosen folder is already the data directory".into());
    }
    if target.starts_with(active) {
        return Err("the chosen folder must not be inside the current data directory".into());
    }
    if active.starts_with(target) {
        return Err("the chosen folder must not contain the current data directory".into());
    }
    if target.parent().is_none() {
        return Err("the chosen folder must not be a drive root".into());
    }
    if target.join("read-aware.db").exists() {
        return Err("the chosen folder already contains a ReadAware database".into());
    }
    fs::create_dir_all(target).map_err(|e| format!("cannot create the chosen folder: {e}"))?;
    let probe = target.join(".readaware-write-test");
    fs::write(&probe, b"ok").map_err(|e| format!("the chosen folder is not writable: {e}"))?;
    let _ = fs::remove_file(&probe);
    Ok(())
}

// --- Commands (settings UI) --------------------------------------------------

#[tauri::command]
pub fn data_dir_info(app: AppHandle) -> Result<DataDirInfo, String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let marker = read_marker(&default);
    let (active, source) = resolve(
        &default,
        current_exe_dir().as_deref(),
        env_override(),
        &marker,
    );
    Ok(DataDirInfo {
        active_dir: active.to_string_lossy().into_owned(),
        default_dir: default.to_string_lossy().into_owned(),
        source,
        pending: marker.pending,
        last_result: marker.last_result,
    })
}

/// Validate and stage a move; the copy itself runs on next boot.
#[tauri::command]
pub fn data_dir_prepare(app: AppHandle, target: String) -> Result<(), String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let marker = read_marker(&default);
    let (active, _source) = resolve(
        &default,
        current_exe_dir().as_deref(),
        env_override(),
        &marker,
    );
    let target = PathBuf::from(&target);
    validate_target(&target, &active)?;
    let mut next = marker;
    next.pending = Some(PendingMigration {
        target: target.to_string_lossy().into_owned(),
        created_at_ms: now_ms(),
    });
    write_marker(&default, &next)
}

#[tauri::command]
pub fn data_dir_cancel_pending(app: AppHandle) -> Result<(), String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let mut marker = read_marker(&default);
    marker.pending = None;
    write_marker(&default, &marker)
}

/// Consume the last migration result after the UI showed it (one-shot toast).
#[tauri::command]
pub fn data_dir_clear_notice(app: AppHandle) -> Result<(), String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let mut marker = read_marker(&default);
    marker.last_result = None;
    write_marker(&default, &marker)
}

/// Roll back to the default root on next boot (old data is untouched).
#[tauri::command]
pub fn data_dir_revert_default(app: AppHandle) -> Result<(), String> {
    let default = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir unavailable: {e}"))?;
    let mut marker = read_marker(&default);
    marker.data_dir = None;
    marker.pending = None;
    write_marker(&default, &marker)
}

#[cfg(test)]
mod tests;
