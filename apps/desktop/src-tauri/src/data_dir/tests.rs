use std::path::{Path, PathBuf};

use super::*;

fn marker(data_dir: Option<&str>, pending: Option<&str>) -> DataDirMarker {
    DataDirMarker {
        version: 1,
        data_dir: data_dir.map(str::to_owned),
        pending: pending.map(|target| PendingMigration {
            target: target.to_owned(),
            created_at_ms: 1,
        }),
        last_result: None,
    }
}

fn tempdir(name: &str) -> PathBuf {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join(name);
    std::fs::create_dir_all(&path).expect("create temp dir");
    // Keep the TempDir alive for the process: dropping it would delete the
    // path under the returned PathBuf.
    std::mem::forget(dir);
    path
}

#[test]
fn resolve_precedence_env_wins() {
    let default = Path::new("/default");
    let custom = "/custom";
    let env = PathBuf::from("/env");
    let (dir, source) = resolve(
        default,
        Some(Path::new("/exe")),
        Some(env.clone()),
        &marker(Some(custom), None),
    );
    assert_eq!(dir, env);
    assert_eq!(source, DataDirSource::Env);
}

#[test]
fn resolve_marker_beats_portable() {
    let default = Path::new("/default");
    let exe = tempdir("exe");
    std::fs::write(exe.join(PORTABLE_MARKER), b"1").unwrap();
    let (dir, source) = resolve(default, Some(&exe), None, &marker(Some("/custom"), None));
    assert_eq!(dir, Path::new("/custom"));
    assert_eq!(source, DataDirSource::Custom);
}

#[test]
fn resolve_portable_when_marker_present() {
    let default = Path::new("/default");
    let exe = tempdir("exe");
    std::fs::write(exe.join(PORTABLE_MARKER), b"1").unwrap();
    let (dir, source) = resolve(default, Some(&exe), None, &marker(None, None));
    assert_eq!(dir, exe.join(PORTABLE_SUBDIR));
    assert_eq!(source, DataDirSource::Portable);
}

#[test]
fn resolve_default_fallback() {
    let default = Path::new("/default");
    let (dir, source) = resolve(default, Some(Path::new("/exe")), None, &marker(None, None));
    assert_eq!(dir, Path::new("/default"));
    assert_eq!(source, DataDirSource::Default);
}

#[test]
fn marker_roundtrip_is_atomic_and_readable() {
    let default = tempdir("default");
    let marker = marker(Some("D:\\Books\\Data"), None);
    write_marker(&default, &marker).unwrap();
    let read = read_marker(&default);
    assert_eq!(read.data_dir.as_deref(), Some("D:\\Books\\Data"));
    assert!(read.pending.is_none());
    // A corrupt marker degrades to defaults, never panics.
    std::fs::write(marker_path(&default), b"{not json").unwrap();
    assert!(read_marker(&default).data_dir.is_none());
}

#[test]
fn validate_target_rejects_unsafe_targets() {
    let active = tempdir("active");
    std::fs::create_dir_all(&active).unwrap();

    assert!(validate_target(Path::new(""), &active).is_err());
    assert!(validate_target(&active, &active).is_err());
    assert!(validate_target(&active.join("sub"), &active).is_err());
    // A target that CONTAINS the active root (active is its subfolder).
    let active_sub = active.join("sub");
    std::fs::create_dir_all(&active_sub).unwrap();
    assert!(validate_target(&active, &active_sub).is_err());
    // Drive root has no parent.
    let root = if cfg!(windows) {
        Path::new("C:\\")
    } else {
        Path::new("/")
    };
    assert!(validate_target(root, &active).is_err());
    // Existing database must not be overwritten.
    std::fs::write(active.join("read-aware.db"), b"x").unwrap();
    assert!(validate_target(&active.join("read-aware.db"), &active).is_err());
    // A writable fresh sibling folder passes.
    let target = active.parent().unwrap().join("target");
    assert!(validate_target(&target, &active).is_ok());
    std::fs::remove_dir_all(&target).ok();
}

#[test]
fn migrate_copies_and_verifies_source_untouched() {
    let src = tempdir("src");
    std::fs::create_dir_all(src.join("blobs")).unwrap();
    std::fs::create_dir_all(src.join("plugins").join("my-plugin")).unwrap();
    std::fs::write(src.join("blobs").join("bookfile%3Aabc.bin"), b"blob-bytes").unwrap();
    std::fs::write(
        src.join("plugins").join("my-plugin").join("manifest.json"),
        b"{}",
    )
    .unwrap();
    std::fs::write(src.join("secret.key"), b"key-bytes").unwrap();
    // A real SQLite db with a row; quick_check must pass on the copy.
    let db = rusqlite::Connection::open(src.join("read-aware.db")).unwrap();
    db.execute_batch("CREATE TABLE t (x); INSERT INTO t VALUES (1);")
        .unwrap();
    drop(db);

    let dst = tempdir("dst");
    migrate(&src, &dst).unwrap();

    assert!(dst.join("read-aware.db").is_file());
    assert!(dst.join("secret.key").is_file());
    assert_eq!(
        std::fs::read(dst.join("blobs").join("bookfile%3Aabc.bin")).unwrap(),
        b"blob-bytes"
    );
    assert!(dst
        .join("plugins")
        .join("my-plugin")
        .join("manifest.json")
        .is_file());
    let copied = rusqlite::Connection::open(dst.join("read-aware.db")).unwrap();
    let n: i64 = copied
        .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 1);
    // Source is fully intact (rollback point).
    assert!(src.join("read-aware.db").is_file());
    assert_eq!(
        std::fs::read(src.join("blobs").join("bookfile%3Aabc.bin")).unwrap(),
        b"blob-bytes"
    );
}

#[test]
fn migrate_skips_transaction_junk_and_fails_on_existing_db() {
    let src = tempdir("src");
    std::fs::create_dir_all(src.join("plugins").join(".candidates")).unwrap();
    std::fs::write(
        src.join("plugins").join(".candidates").join("staging"),
        b"x",
    )
    .unwrap();
    std::fs::create_dir_all(src.join("plugins").join("real")).unwrap();
    std::fs::write(
        src.join("plugins").join("real").join("manifest.json"),
        b"{}",
    )
    .unwrap();
    let db = rusqlite::Connection::open(src.join("read-aware.db")).unwrap();
    db.execute_batch("CREATE TABLE t (x);").unwrap();
    drop(db);

    let dst = tempdir("dst");
    std::fs::write(dst.join("read-aware.db"), b"existing").unwrap();
    assert!(migrate(&src, &dst).is_err());

    let dst2 = tempdir("dst2");
    migrate(&src, &dst2).unwrap();
    assert!(!dst2.join("plugins").join(".candidates").exists());
    assert!(dst2
        .join("plugins")
        .join("real")
        .join("manifest.json")
        .is_file());
}
