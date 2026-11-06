import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./environment";
import type { PlainEvent } from "./sync-envelope";
import { observeRemoteHlcStamps } from "./domain-events";
/** Preserve original tick ids: repeated local backup imports must not count reading twice. */
export async function exportReadingTimeEvents(): Promise<PlainEvent[]> {
  if (!isTauri()) return [];
  const events = await invoke<PlainEvent[]>("read_events_since", {
    after: null,
  });
  return events.filter((event) => event.type === "book.timeRecorded");
}
export async function restoreReadingTimeEvents(
  events: readonly PlainEvent[],
): Promise<void> {
  if (!events.length) return;
  if (!isTauri()) throw new Error("reading-time-backup-desktop-only");
  if (events.some((event) => event.type !== "book.timeRecorded"))
    throw new Error("backup-reading-event-type");
  observeRemoteHlcStamps(events.map((event) => event.hlc));
  await invoke("commit_events", {
    events,
    collectionPasswordPrecondition: null,
  });
}
