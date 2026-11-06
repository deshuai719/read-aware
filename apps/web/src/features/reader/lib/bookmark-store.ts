import { invoke } from "@tauri-apps/api/core";
import type { EventOrigin, ReadingBookmark } from "@read-aware/core";
import { getDesktopBlobInfo } from "../../../platform/blob-store";
import { isTauri } from "../../../platform/environment";
import { commitDomainEvents } from "../../../platform/domain-events";
import {
  listLibraryBooks,
  listCollections,
} from "../../library/lib/library-db";
import { assertBookCollectionAccess } from "../../library/lib/collection-operations";
/** Full local backup includes locked collections just as books/annotations do. */
export async function listBookmarksForBackup(): Promise<ReadingBookmark[]> {
  return isTauri() ? invoke("reading_bookmarks_list", { bookId: null }) : [];
}
export async function restoreBookmarks(
  items: readonly ReadingBookmark[],
): Promise<void> {
  if (!items.length) return;
  if (!isTauri()) throw new Error("bookmarks-desktop-only");
  await commitDomainEvents(
    ...items.flatMap(
      ({
        id,
        bookId,
        anchor,
        title,
        excerpt,
        chapterHref,
        fraction,
        sourceSha256,
        createdAt,
        updatedAt,
      }) => [
        {
          type: "bookmark.created" as const,
          origin: "user" as const,
          createdAt,
          payload: {
            bookmarkId: id,
            bookId,
            anchor,
            title,
            excerpt,
            chapterHref: chapterHref ?? undefined,
            fraction: fraction ?? undefined,
            sourceSha256: sourceSha256 ?? undefined,
          },
        },
        {
          type: "bookmark.renamed" as const,
          origin: "user" as const,
          createdAt: updatedAt,
          payload: { bookmarkId: id, title },
        },
      ],
    ),
  );
}
export type BookmarkInput = Omit<
  ReadingBookmark,
  "id" | "createdAt" | "updatedAt"
>;
async function requireBook(bookId: string) {
  if (!isTauri()) throw new Error("bookmarks-desktop-only");
  const [books, collections] = await Promise.all([
    listLibraryBooks(),
    listCollections(),
  ]);
  const book = books.find((b) => b.id === bookId);
  if (!book) throw new Error("bookmark-book-not-found");
  assertBookCollectionAccess([book], collections);
  return book;
}
export async function listBookmarks(
  bookId: string,
): Promise<ReadingBookmark[]> {
  if (!isTauri()) return [];
  await requireBook(bookId);
  return invoke("reading_bookmarks_list", { bookId });
}
export async function addBookmark(
  input: BookmarkInput,
  origin: EventOrigin,
): Promise<string> {
  if (!input.anchor.trim()) throw new Error("bookmark-empty-anchor");
  if (
    input.fraction !== undefined &&
    (!Number.isFinite(input.fraction) ||
      input.fraction < 0 ||
      input.fraction > 1)
  )
    throw new Error("bookmark-invalid-fraction");
  const book = await requireBook(input.bookId);
  const source =
    book.format === "virtual"
      ? null
      : await getDesktopBlobInfo(`bookfile:${book.id}`);
  if (
    input.sourceSha256 &&
    source?.sha256 &&
    input.sourceSha256 !== source.sha256
  )
    throw new Error("bookmark-source-changed");
  const id = crypto.randomUUID();
  await commitDomainEvents({
    type: "bookmark.created",
    origin,
    payload: {
      bookmarkId: id,
      ...input,
      sourceSha256: source?.sha256 ?? undefined,
      title: input.title.slice(0, 200),
      excerpt: input.excerpt.slice(0, 500),
    },
  });
  return id;
}
export async function renameBookmark(
  id: string,
  bookId: string,
  title: string,
  origin: EventOrigin,
): Promise<void> {
  if (!(await listBookmarks(bookId)).some((item) => item.id === id))
    throw new Error("bookmark-not-found");
  await commitDomainEvents({
    type: "bookmark.renamed",
    origin,
    payload: { bookmarkId: id, title: title.trim().slice(0, 200) },
  });
}
export async function removeBookmark(
  id: string,
  bookId: string,
  origin: EventOrigin,
): Promise<void> {
  if (!(await listBookmarks(bookId)).some((item) => item.id === id))
    throw new Error("bookmark-not-found");
  await commitDomainEvents({
    type: "bookmark.removed",
    origin,
    payload: { bookmarkId: id },
  });
}
