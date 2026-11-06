import { getDesktopBlobInfo } from "../platform/blob-store";
import { assertBookCollectionAccess } from "../features/library/lib/collection-operations";
import { listCollections } from "../features/library/lib/library-db";
import {
  listLocalReadingFonts,
  importLocalReadingFont,
  removeLocalReadingFont,
  type LocalReadingFont,
} from "../features/settings/lib/local-font-store";
/** Reading domain - reading lifecycle, progress projections, and time. */
import {
  listBookmarks,
  addBookmark,
  renameBookmark,
  removeBookmark,
  type BookmarkInput,
} from "../features/reader/lib/bookmark-store";
import type {
  BookStats,
  EventOrigin,
  ReadingBookmark,
  StatsOverview,
} from "@read-aware/core";
import {
  listLibraryBooks,
  setLibraryBookFinished,
} from "../features/library/lib/library-db";
import type { LibraryBook } from "../features/library/lib/library-types";
import {
  loadReadingStatsStore,
  type BookReadingStats,
} from "../features/reader/lib/reading-stats";
import { emitAppEvent } from "../platform/app-events";
import {
  READING_EVENTS,
  domainSubscribe,
  type DomainEventSubscribe,
} from "./events";

function toBookStats(
  book: LibraryBook,
  time: BookReadingStats | undefined,
): BookStats {
  return {
    bookId: book.id,
    progressPercent: book.progressPercent ?? 0,
    status: book.readingStatus,
    locator: book.progress?.cfi ?? book.progress?.href ?? undefined,
    chapterHref: book.progress?.href ?? undefined,
    currentLocation: book.progress?.currentLocation,
    totalLocations: book.progress?.totalLocations,
    totalMs: time?.totalMs ?? 0,
    firstReadAt:
      time?.firstStartedAt != null
        ? new Date(time.firstStartedAt).toISOString()
        : undefined,
    lastReadAt:
      time?.lastReadAt != null
        ? new Date(time.lastReadAt).toISOString()
        : undefined,
    daily: { ...(time?.daily ?? {}) },
  };
}

export type ReadingQueries = {
  sourceIdentity: (bookId: string) => Promise<{ sourceSha256: string | null }>;
  localFonts: { list: () => LocalReadingFont[] };
  bookmarks: { forBook: (bookId: string) => Promise<ReadingBookmark[]> };
  stats: {
    forBook(bookId: string): Promise<BookStats | null>;
    list(): Promise<BookStats[]>;
    overview(): Promise<StatsOverview>;
  };
};

export type ReadingCommands = {
  localFonts: {
    import: (
      input: { path: string } | { file: File },
    ) => Promise<LocalReadingFont>;
    remove: (id: string) => Promise<void>;
  };
  bookmarks: {
    add: (input: BookmarkInput) => Promise<string>;
    rename: (id: string, bookId: string, title: string) => Promise<void>;
    remove: (id: string, bookId: string) => Promise<void>;
  };
  setFinished(bookId: string, finished: boolean): Promise<void>;
};

export type ReadingDomain = {
  queries: ReadingQueries;
  commands: ReadingCommands;
  events: {
    subscribe: DomainEventSubscribe<(typeof READING_EVENTS)[number]>;
  };
};

export function createReadingDomain(origin: EventOrigin): ReadingDomain {
  const queries: ReadingQueries = {
    sourceIdentity: async (bookId) => {
      const [books, collections] = await Promise.all([
        listLibraryBooks(),
        listCollections(),
      ]);
      const book = books.find((b) => b.id === bookId);
      if (!book) throw new Error("book-not-found");
      assertBookCollectionAccess([book], collections);
      return {
        sourceSha256:
          book.format === "virtual"
            ? null
            : ((await getDesktopBlobInfo("bookfile:" + bookId))?.sha256 ??
              null),
      };
    },
    localFonts: { list: listLocalReadingFonts },
    bookmarks: { forBook: listBookmarks },
    stats: {
      forBook: async (bookId) => {
        const book = (await listLibraryBooks()).find(
          (entry) => entry.id === String(bookId),
        );
        if (!book) return null;
        const store = await loadReadingStatsStore();
        return toBookStats(book, store[book.id]);
      },
      list: async () => {
        const [allBooks, store] = await Promise.all([
          listLibraryBooks(),
          loadReadingStatsStore(),
        ]);
        return allBooks.map((book) => toBookStats(book, store[book.id]));
      },
      overview: async () => {
        const [allBooks, store] = await Promise.all([
          listLibraryBooks(),
          loadReadingStatsStore(),
        ]);
        const daily: Record<string, number> = {};
        let totalMs = 0;
        let first: number | null = null;
        let last: number | null = null;
        for (const entry of Object.values(store)) {
          totalMs += entry.totalMs;
          for (const [day, ms] of Object.entries(entry.daily)) {
            daily[day] = (daily[day] ?? 0) + ms;
          }
          if (
            entry.firstStartedAt != null &&
            (first == null || entry.firstStartedAt < first)
          ) {
            first = entry.firstStartedAt;
          }
          if (
            entry.lastReadAt != null &&
            (last == null || entry.lastReadAt > last)
          ) {
            last = entry.lastReadAt;
          }
        }
        return {
          totalMs,
          daily,
          firstReadAt:
            first != null ? new Date(first).toISOString() : undefined,
          lastReadAt: last != null ? new Date(last).toISOString() : undefined,
          booksReading: allBooks.filter(
            (book) => book.readingStatus === "reading",
          ).length,
          booksFinished: allBooks.filter(
            (book) => book.readingStatus === "finished",
          ).length,
        };
      },
    },
  };

  const commands: ReadingCommands = {
    localFonts: {
      import: importLocalReadingFont,
      remove: removeLocalReadingFont,
    },
    bookmarks: {
      add: (input) => addBookmark(input, origin),
      rename: (id, bookId, title) => renameBookmark(id, bookId, title, origin),
      remove: (id, bookId) => removeBookmark(id, bookId, origin),
    },
    setFinished: async (bookId, finished) => {
      await setLibraryBookFinished(String(bookId), finished === true, origin);
      emitAppEvent("library-changed", {});
    },
  };

  return {
    queries,
    commands,
    events: { subscribe: domainSubscribe(READING_EVENTS, origin) },
  };
}
