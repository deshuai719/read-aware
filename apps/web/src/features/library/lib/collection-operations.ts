import type { DomainEventDraft } from "../../../platform/domain-events";
import type { Collection, LibraryBook } from "./library-types";
import { isBookInLockedCollection, isCollectionLocked } from "./collection-lock";

export function assertCollectionAccess(collections: readonly Collection[], ids: readonly (string | null)[]): void {
  for (const id of ids) {
    if (!id) continue;
    const collection = collections.find((entry) => entry.id === id);
    if (!collection) throw new Error("collection-not-found");
    if (isCollectionLocked(collection)) throw new Error("collection-locked");
  }
}

/** Membership changes and source removal travel through ONE native event transaction. */
export function collectionMergeEvents(
  books: readonly Pick<LibraryBook, "id" | "collectionId">[],
  collections: readonly Collection[],
  sourceId: string,
  targetId: string,
): DomainEventDraft[] {
  if (sourceId === targetId) throw new Error("collection-merge-self");
  assertCollectionAccess(collections, [sourceId, targetId]);
  return [
    ...books.filter((book) => book.collectionId === sourceId).map((book): DomainEventDraft => ({
      type: "book.addedToCollection", payload: { bookId: book.id, collectionId: targetId },
    })),
    { type: "collection.removed", payload: { collectionId: sourceId } },
  ];
}

export function assertBookCollectionAccess(
  books: readonly Pick<LibraryBook, "collectionId">[], collections: readonly Collection[],
): void {
  if (books.some((book) => isBookInLockedCollection(book, collections))) throw new Error("collection-locked");
}
