import { describe, expect, test } from "bun:test";
import type { DataDirInfo } from "../../../platform/data-dir";
import {
  canCancelPending,
  canChangeDataDir,
  canRevertDataDir,
  DATA_DIR_SOURCE_KEYS,
} from "./storage-settings";

const base: DataDirInfo = {
  activeDir: "C:\\Users\\me\\AppData\\Roaming\\com.readaware.app",
  defaultDir: "C:\\Users\\me\\AppData\\Roaming\\com.readaware.app",
  source: "default",
  pending: null,
  lastResult: null,
};

describe("storage-settings", () => {
  test("change is blocked while a move is pending", () => {
    expect(canChangeDataDir(base)).toBe(true);
    expect(canChangeDataDir({ ...base, pending: { target: "D:\\Data", createdAtMs: 1 } })).toBe(
      false,
    );
    expect(canChangeDataDir(null)).toBe(false);
  });

  test("revert is offered only for a marker custom root", () => {
    expect(canRevertDataDir(base)).toBe(false);
    expect(canRevertDataDir({ ...base, source: "custom" })).toBe(true);
    expect(canRevertDataDir({ ...base, source: "env" })).toBe(false);
    expect(canRevertDataDir({ ...base, source: "portable" })).toBe(false);
    expect(canRevertDataDir({ ...base, source: "custom", pending: { target: "D:\\Data", createdAtMs: 1 } })).toBe(
      false,
    );
  });

  test("an env override is read-only", () => {
    expect(canChangeDataDir({ ...base, source: "env" })).toBe(false);
    expect(canChangeDataDir({ ...base, source: "portable" })).toBe(true);
  });

  test("pending move stays cancellable until the restart", () => {
    expect(canCancelPending(base)).toBe(false);
    expect(
      canCancelPending({ ...base, pending: { target: "D:\\Data", createdAtMs: 1 } }),
    ).toBe(true);
  });

  test("every source has a display key", () => {
    expect(DATA_DIR_SOURCE_KEYS).toEqual({
      default: "default",
      custom: "custom",
      portable: "portable",
      env: "env",
    });
  });
});