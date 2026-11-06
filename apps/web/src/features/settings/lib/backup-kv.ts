/** Device credentials and migration bookkeeping never move in portable backups. */
export function portableBackupKV(
  entries: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([key]) =>
        !key.startsWith("read-aware-secret:") &&
        key !== "read-aware-ai-key" &&
        key !== "read-aware-migrated-v1",
    ),
  );
}
