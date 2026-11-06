import type { LibraryBook, Collection } from "./library-types";
import { isBookInLockedCollection } from "./collection-lock";
import type { FoliateSearchYield } from "../../reader/lib/foliate-engine";
export type LibraryTextHit = {
  bookId: string;
  bookTitle: string;
  sourceSha256: string;
  cfi: string;
  chapter: string;
  pre: string;
  match: string;
  post: string;
};
export type LibraryTextEvent =
  | { type: "hit"; hit: LibraryTextHit }
  | { type: "progress"; scanned: number; total: number }
  | { type: "warning"; bookId: string; reason: string }
  | { type: "done"; limited: boolean };
export type LibraryTextSource = {
  sourceSha256: string;
  search: (
    query: string,
    signal: AbortSignal,
  ) => AsyncIterable<FoliateSearchYield>;
  dispose: () => Promise<void>;
};
export type LibraryScanPorts = {
  books: () => Promise<LibraryBook[]>;
  collections: () => Promise<Collection[]>;
  open: (
    book: LibraryBook,
    signal: AbortSignal,
  ) => Promise<LibraryTextSource | null>;
};
/** Sequential local-source scan. Access is rechecked before opening AND before every published excerpt. */
export async function* scanLibraryText(
  ports: LibraryScanPorts,
  query: string,
  signal: AbortSignal,
  maxResults = 500,
): AsyncGenerator<LibraryTextEvent> {
  query = query.trim();
  if (query.length < 2 || query.length > 300)
    throw new Error("library-search-invalid-query");
  const books = (await ports.books()).filter(
    (book) => book.format !== "virtual",
  );
  const locks = await ports.collections();
  const eligible = books.filter(
    (book) => !isBookInLockedCollection(book, locks),
  );
  let scanned = 0,
    count = 0;
  const seen = new Set<string>();
  for (const candidate of eligible) {
    if (signal.aborted) return;
    const current = (await ports.books()).find(
      (book) => book.id === candidate.id,
    );
    if (
      !current ||
      isBookInLockedCollection(current, await ports.collections())
    )
      continue;
    let source: LibraryTextSource | null = null;
    try {
      source = await ports.open(current, signal);
      if (signal.aborted) return;
      if (!source) {
        yield { type: "warning", bookId: current.id, reason: "not-local" };
        continue;
      }
      for await (const event of source.search(query, signal)) {
        if (signal.aborted) return;
        const latest = (await ports.books()).find(
          (book) => book.id === current.id,
        );
        if (
          !latest ||
          isBookInLockedCollection(latest, await ports.collections())
        )
          break;
        if (typeof event === "object" && "warning" in event)
          yield { type: "warning", bookId: current.id, reason: event.warning };
        if (typeof event !== "object" || !("subitems" in event)) continue;
        for (const item of event.subitems) {
          if (signal.aborted) return;
          const fresh = (await ports.books()).find(
            (book) => book.id === current.id,
          );
          if (
            !fresh ||
            isBookInLockedCollection(fresh, await ports.collections())
          )
            break;
          const key = current.id + "|" + item.cfi;
          if (!item.cfi || seen.has(key)) continue;
          seen.add(key);
          yield {
            type: "hit",
            hit: {
              bookId: current.id,
              bookTitle: current.title,
              sourceSha256: source.sourceSha256,
              cfi: item.cfi,
              chapter: event.label,
              ...item.excerpt,
            },
          };
          count++;
          if (count >= maxResults) {
            yield { type: "done", limited: true };
            return;
          }
        }
      }
    } catch (cause) {
      if (!signal.aborted)
        yield {
          type: "warning",
          bookId: current.id,
          reason: cause instanceof Error ? cause.message : "unavailable",
        };
    } finally {
      await source?.dispose();
      scanned++;
    }
    if (!signal.aborted)
      yield { type: "progress", scanned, total: eligible.length };
  }
  if (!signal.aborted) yield { type: "done", limited: false };
}
