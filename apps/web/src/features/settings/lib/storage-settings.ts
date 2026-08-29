/**
 * Pure display logic for the settings 鈥?Storage panel. Kept free of Tauri
 * imports so the rules are unit-testable in the browser build.
 */
import type { DataDirInfo, DataDirSource } from "../../../platform/data-dir";

/** i18n key suffix under `storage.source.*` for each resolution source. */
export const DATA_DIR_SOURCE_KEYS = {
  default: "default",
  custom: "custom",
  portable: "portable",
  env: "env",
} as const satisfies Record<DataDirSource, string>;

/** A move can only be started when nothing is already pending. An env-var
 * override is read-only: any staged move would be shadowed by the override on
 * the next boot, so the settings surface stays out of that mode. */
export function canChangeDataDir(info: DataDirInfo | null): boolean {
  return info !== null && info.source !== "env" && info.pending === null;
}

/** "Back to default" only makes sense when the marker carries a custom root. */
export function canRevertDataDir(info: DataDirInfo | null): boolean {
  return info !== null && info.source === "custom" && info.pending === null;
}

/** A pending move is cancellable while the user is still on the old root. */
export function canCancelPending(info: DataDirInfo | null): boolean {
  return info !== null && info.pending !== null;
}