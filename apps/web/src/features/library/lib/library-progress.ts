import type { BookProgress, LibraryBook, ReadingStatus } from "./library-types";

export function getReadingStatus(progressPercent: number): ReadingStatus {
  if (progressPercent >= 100) return "finished";
  if (progressPercent > 0) return "reading";
  return "unread";
}

export type PendingBookProgress = { progress: BookProgress; timestamp: string };
/** Keep an accepted local position while unrelated native responses are still in flight. */
export function overlayPendingProgress(
  book: LibraryBook,
  pending?: PendingBookProgress,
): LibraryBook {
  return pending
    ? createProgressPatch(book, pending.progress, pending.timestamp)
    : book;
}

export function createProgressPatch(
  book: LibraryBook,
  progress: BookProgress,
  timestamp = new Date().toISOString(),
): LibraryBook {
  const progressPercent = progress
    ? Math.max(0, Math.min(100, Math.round(progress.progressPercent)))
    : 0;

  return {
    ...book,
    progress,
    progressPercent,
    readingStatus:
      book.readingStatus === "finished"
        ? "finished"
        : getReadingStatus(progressPercent),
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
  };
}
