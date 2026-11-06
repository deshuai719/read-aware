/**
 * Library domain - books, source content, metadata, and collections.
 *
 * The public shape is deliberately uniform with every other domain:
 * `queries` inspect projections, `commands` commit state changes, and
 * `events.subscribe` observes committed domain events.
 */
import { searchLocalLibraryText } from "../features/library/lib/library-full-text-native";
import type { LibraryTextEvent } from "../features/library/lib/library-full-text";
import type {
  BookSummary,
  ChapterRef,
  CollectionSummary,
  EventOrigin,
} from "@read-aware/core";
import { i18n } from "../i18n";
import { emitAppEvent } from "../platform/app-events";
import {
  addVirtualLibraryBook,
  commitBookImport,
  createCollection,
  deleteCollection,
  listCollections,
  listLibraryBooks,
  mergeCollections,
  prepareBookImport,
  removeLibraryBook,
  removeLibraryBooks,
  renameCollection,
  setBooksCollection,
  setCollectionPassword,
  setLibraryBookStarred,
  updateBookMetadata,
  updateVirtualLibraryBookTitle,
} from "../features/library/lib/library-db";
import {
  verifyCollectionPasswordAsync,
  hashCollectionPasswordAsync,
  unlockCollection,
  lockCollection,
} from "../features/library/lib/collection-lock";
import type { LibraryBook } from "../features/library/lib/library-types";
import {
  ensureBookTextExtracted,
  getPersistedBookText,
  type ExtractedChapter,
} from "../features/library/lib/book-text-store";
import {
  LIBRARY_EVENTS,
  domainSubscribe,
  type DomainEventSubscribe,
} from "./events";

export function toBookSummary(book: LibraryBook): BookSummary {
  return {
    id: book.id,
    title: book.title,
    author: book.author || undefined,
    format: book.format,
    starred: book.starred === true,
    collectionId: book.collectionId ?? null,
    addedAt: book.createdAt,
    updatedAt: book.updatedAt,
    lastOpenedAt: book.lastOpenedAt ?? undefined,
    fileName: book.fileName || undefined,
    fileSize: book.fileSize || undefined,
    narrativity: book.narrativity ?? undefined,
  };
}

const notifyLibraryChanged = (): void => emitAppEvent("library-changed", {});

async function requireReadableBook(bookId: string): Promise<void> {
  const [books, collections] = await Promise.all([
    listLibraryBooks(),
    listCollections(),
  ]);
  const book = books.find((item) => item.id === bookId);
  if (!book) throw new Error("book-not-found");
  const { assertBookCollectionAccess } =
    await import("../features/library/lib/collection-operations");
  assertBookCollectionAccess([book], collections);
}

export async function getExtractedChapters(
  bookId: string,
): Promise<ExtractedChapter[]> {
  const key = String(bookId);
  await requireReadableBook(key);
  const chapters = await ensureBookTextExtracted(key);
  await requireReadableBook(key);
  return chapters;
}

export async function getPersistedChapters(
  bookId: string,
): Promise<ExtractedChapter[] | null> {
  const key = String(bookId);
  await requireReadableBook(key);
  const chapters = await getPersistedBookText(key);
  await requireReadableBook(key);
  return chapters;
}

export type LibraryQueries = {
  fullText: {
    search: (
      query: string,
      signal: AbortSignal,
    ) => AsyncGenerator<LibraryTextEvent>;
  };
  books: {
    list(): Promise<BookSummary[]>;
    get(bookId: string): Promise<BookSummary | null>;
    getToc(bookId: string): Promise<ChapterRef[]>;
    getChapterText(
      bookId: string,
      chapterIndex: number,
    ): Promise<string | null>;
  };
  collections: {
    list(): Promise<CollectionSummary[]>;
    booksIn(collectionId: string): Promise<string[]>;
  };
};

export type LibraryCommands = {
  books: {
    importBook(input: {
      fileName: string;
      data: ArrayBuffer | Uint8Array;
    }): Promise<BookSummary>;
    editMetadata(
      bookId: string,
      patch: { title?: string; author?: string },
    ): Promise<void>;
    setStarred(bookId: string, starred: boolean): Promise<void>;
    remove(bookId: string): Promise<void>;
    removeMany(bookIds: string[]): Promise<void>;
    addVirtualBook(input: {
      title: string;
      author?: string;
    }): Promise<BookSummary>;
    updateVirtualBookTitle(
      bookId: string,
      title: string,
      author?: string,
    ): Promise<void>;
  };
  collections: {
    create(
      name: string,
      options?: { passwordHash?: string | null },
    ): Promise<CollectionSummary & { passwordHash?: string | null }>;
    unlock(collectionId: string, password: string): Promise<boolean>;
    changePassword(
      collectionId: string,
      currentPassword: string,
      newPassword: string | null,
    ): Promise<boolean>;
    relock(collectionId: string): void;
    rename(collectionId: string, name: string): Promise<void>;
    remove(collectionId: string): Promise<void>;
    assignBooks(bookIds: string[], collectionId: string | null): Promise<void>;
    merge(sourceId: string, targetId: string): Promise<void>;
  };
};

export type LibraryDomain = {
  queries: LibraryQueries;
  commands: LibraryCommands;
  events: {
    subscribe: DomainEventSubscribe<(typeof LIBRARY_EVENTS)[number]>;
  };
};

export function createLibraryDomain(origin: EventOrigin): LibraryDomain {
  const queries: LibraryQueries = {
    fullText: { search: searchLocalLibraryText },
    books: {
      list: async () => (await listLibraryBooks()).map(toBookSummary),
      get: async (bookId) => {
        const book = (await listLibraryBooks()).find(
          (entry) => entry.id === String(bookId),
        );
        return book ? toBookSummary(book) : null;
      },
      getToc: async (bookId) =>
        (await getExtractedChapters(bookId)).map<ChapterRef>(
          (chapter, index) => ({
            index,
            title: chapter.title,
            chars: chapter.text.length,
          }),
        ),
      getChapterText: async (bookId, chapterIndex) =>
        (await getExtractedChapters(bookId))[Number(chapterIndex)]?.text ??
        null,
    },
    collections: {
      list: async () =>
        (await listCollections()).map((collection) => ({
          id: collection.id,
          name: collection.name,
          createdAt: collection.createdAt,
        })),
      booksIn: async (collectionId) =>
        (await listLibraryBooks())
          .filter((book) => book.collectionId === String(collectionId))
          .map((book) => book.id),
    },
  };

  const commands: LibraryCommands = {
    books: {
      importBook: async (input) => {
        const file = new File([input.data], String(input.fileName));
        const t = i18n.getFixedT(null, "shelf");
        const existing = await listLibraryBooks();
        const result = await prepareBookImport(
          { kind: "file", file },
          t,
          existing,
        );
        if (result.status === "prepared") {
          const commit = await commitBookImport(
            result.book,
            { kind: "file", file },
            origin,
          );
          if (commit.status === "duplicate") {
            const original = existing.find(
              (entry) => entry.id === commit.existingId,
            );
            if (original) return toBookSummary(original);
          } else {
            notifyLibraryChanged();
          }
        }
        return toBookSummary(result.book);
      },
      editMetadata: async (bookId, patch) => {
        await updateBookMetadata(
          String(bookId),
          { title: patch.title, author: patch.author },
          origin,
        );
        notifyLibraryChanged();
      },
      setStarred: async (bookId, starred) => {
        await setLibraryBookStarred(String(bookId), starred === true, origin);
        notifyLibraryChanged();
      },
      remove: async (bookId) => {
        await removeLibraryBook(String(bookId), origin);
        notifyLibraryChanged();
      },
      removeMany: async (bookIds) => {
        await removeLibraryBooks(bookIds.map(String), origin);
        notifyLibraryChanged();
      },
      addVirtualBook: async (input) => {
        const book = await addVirtualLibraryBook(
          { title: String(input.title), author: input.author },
          origin,
        );
        notifyLibraryChanged();
        return toBookSummary(book);
      },
      updateVirtualBookTitle: async (bookId, title, author) => {
        await updateVirtualLibraryBookTitle(
          String(bookId),
          String(title),
          author,
          origin,
        );
        notifyLibraryChanged();
      },
    },
    collections: {
      unlock: async (id, password) => {
        const collection = (await listCollections()).find((c) => c.id === id);
        if (!collection) throw new Error("collection-not-found");
        if (
          collection.passwordHash &&
          !(await verifyCollectionPasswordAsync(
            collection.passwordHash,
            password,
          ))
        )
          return false;
        const current = (await listCollections()).find((c) => c.id === id);
        if (!current || current.passwordHash !== collection.passwordHash)
          return false;
        unlockCollection(id, current.passwordHash ?? null);
        notifyLibraryChanged();
        return true;
      },
      relock: (id) => {
        lockCollection(id);
        notifyLibraryChanged();
      },
      changePassword: async (id, currentPassword, newPassword) => {
        const collection = (await listCollections()).find((c) => c.id === id);
        if (!collection) throw new Error("collection-not-found");
        if (
          collection.passwordHash &&
          !(await verifyCollectionPasswordAsync(
            collection.passwordHash,
            currentPassword,
          ))
        )
          return false;
        if (newPassword !== null && newPassword.length < 4)
          throw new Error("collection-password-short");
        const nextHash =
          newPassword === null
            ? null
            : await hashCollectionPasswordAsync(newPassword);
        const latest = (await listCollections()).find((c) => c.id === id);
        if (!latest || latest.passwordHash !== collection.passwordHash)
          throw new Error("collection-password-changed");
        await setCollectionPassword(
          id,
          nextHash,
          origin,
          collection.passwordHash ?? null,
        );
        lockCollection(id);
        notifyLibraryChanged();
        return true;
      },
      create: async (name, options) => {
        const collection = await createCollection(
          String(name),
          origin,
          options,
        );
        if (collection.passwordHash)
          unlockCollection(collection.id, collection.passwordHash);
        notifyLibraryChanged();
        return {
          id: collection.id,
          name: collection.name,
          createdAt: collection.createdAt,
          passwordHash: collection.passwordHash,
        };
      },
      rename: async (collectionId, name) => {
        await renameCollection(String(collectionId), String(name), origin);
        notifyLibraryChanged();
      },
      remove: async (collectionId) => {
        await deleteCollection(String(collectionId), origin);
        notifyLibraryChanged();
      },
      merge: async (sourceId, targetId) => {
        await mergeCollections(String(sourceId), String(targetId), origin);
        notifyLibraryChanged();
      },
      assignBooks: async (bookIds, collectionId) => {
        await setBooksCollection(
          bookIds.map(String),
          collectionId == null ? null : String(collectionId),
          origin,
        );
        notifyLibraryChanged();
      },
    },
  };

  return {
    queries,
    commands,
    events: { subscribe: domainSubscribe(LIBRARY_EVENTS, origin) },
  };
}
