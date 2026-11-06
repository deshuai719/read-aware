import { expect, test } from "bun:test";
import { portableBackupKV } from "./backup-kv";
test("backups exclude encrypted credentials and legacy plaintext keys in both directions", () => {
  expect(
    portableBackupKV({
      "read-aware-secret:ai-api-key.custom": "sealed",
      "read-aware-secret:sync.session": "sealed",
      "read-aware-secret:plugin.tts.custom-api-key": "sealed",
      "read-aware-ai-key": "legacy",
      "read-aware-migrated-v1": "yes",
      "read-aware-reader-preferences": "appearance",
      "read-aware-reader-overrides": "per-book",
      "read-aware-daily-reading-goal": "30",
    }),
  ).toEqual({
    "read-aware-reader-preferences": "appearance",
    "read-aware-reader-overrides": "per-book",
    "read-aware-daily-reading-goal": "30",
  });
});
