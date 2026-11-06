import type { LibraryBook, Collection } from "../../library/lib/library-types";
import { isBookInLockedCollection } from "../../library/lib/collection-lock";
import { localKV } from "../../../platform/local-store";
const KEY = "read-aware-last-reader-session";
export function readLastReaderSession(): string | null | undefined {
  try {
    const raw = localKV.getItem(KEY);
    if (raw === null) return undefined;
    const value = JSON.parse(raw);
    return typeof value?.bookId === "string" ? value.bookId : null;
  } catch {
    return undefined;
  }
}
export function saveLastReaderSession(bookId: string | null): void {
  localKV.setItem(KEY, JSON.stringify({ bookId }));
}
/** Exact prior book first; old installs without a session record resume the most recently read book. */
export function resumableBook(
  books: readonly LibraryBook[],
  collections: readonly Collection[],
  id: string | null | undefined,
): LibraryBook | null {
  if (id === null) return null;
  const candidates = id
    ? books.filter((book) => book.id === id)
    : [...books]
        .filter((book) => !!book.lastOpenedAt)
        .sort((a, b) =>
          (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""),
        );
  const book = candidates[0];
  return book && !isBookInLockedCollection(book, collections) ? book : null;
}
