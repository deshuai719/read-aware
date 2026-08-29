/**
 * Desktop data-directory controls (settings 鈥?storage).
 *
 * The data root is resolved in Rust (`data_dir.rs`): env var > `data-dir.json`
 * marker > portable marker > default app-data dir. The settings surface only
 * stages a move (`data_dir_prepare`); the copy runs on the next boot, before
 * SQLite opens, and the old folder is never touched. Browser builds have no
 * native root, so every function here is a no-op behind `isTauri()`.
 */
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./environment";

export type DataDirSource = "default" | "custom" | "portable" | "env";

export type PendingMigration = {
  target: string;
  createdAtMs: number;
};

export type MigrationNotice = {
  ok: boolean;
  message: string;
  atMs: number;
};

export type DataDirInfo = {
  activeDir: string;
  defaultDir: string;
  source: DataDirSource;
  pending: PendingMigration | null;
  lastResult: MigrationNotice | null;
};

export async function getDataDirInfo(): Promise<DataDirInfo | null> {
  if (!isTauri()) return null;
  return invoke<DataDirInfo>("data_dir_info");
}

/** Validate + stage a move; the copy itself runs on the next start. */
export async function prepareDataDir(target: string): Promise<void> {
  await invoke("data_dir_prepare", { target });
}

export async function cancelPendingMigration(): Promise<void> {
  await invoke("data_dir_cancel_pending");
}

/** Consume the one-shot boot notice (success/failure toast). */
export async function clearDataDirNotice(): Promise<void> {
  await invoke("data_dir_clear_notice");
}

/** Use the default app-data folder again on next start (rollback). */
export async function revertDataDirToDefault(): Promise<void> {
  await invoke("data_dir_revert_default");
}