import type { DomainEventDraft } from "../../../platform/domain-events";
import type { LibraryBook, Collection } from "../../library/lib/library-types";
import type { Annotation } from "../../annotations/lib/annotation-types";
/** Restoring a snapshot is a new intent in the local log, not an unrecorded projection overwrite. */
export function restoredBookEvents(
  book: LibraryBook,
  sourceSha256?: string | null,
  previousCollectionId?: string | null,
): DomainEventDraft[] {
  const drafts: DomainEventDraft[] = [
    {
      type: "book.imported",
      origin: "user",
      createdAt: book.createdAt,
      payload: {
        bookId: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        fileName: book.fileName,
        mimeType: book.mimeType || undefined,
        fileSize: book.fileSize,
        sourceBlobKey: "bookfile:" + book.id,
        sourceSha256: sourceSha256 ?? undefined,
      },
    },
    {
      type: "book.starred",
      createdAt: book.updatedAt,
      payload: { bookId: book.id, starred: book.starred === true },
    },
  ];
  if (!book.collectionId && previousCollectionId)
    drafts.push({
      type: "book.removedFromCollection",
      createdAt: book.updatedAt,
      payload: { bookId: book.id, collectionId: previousCollectionId },
    });
  if (book.collectionId)
    drafts.push({
      type: "book.addedToCollection",
      createdAt: book.updatedAt,
      payload: { bookId: book.id, collectionId: book.collectionId },
    });
  drafts.push({
    type: "book.progressed",
    createdAt: book.updatedAt,
    payload: {
      bookId: book.id,
      locator: book.progress?.cfi ?? book.progress?.href ?? "",
      chapterHref: book.progress?.href ?? undefined,
      currentLocation: book.progress?.currentLocation ?? 0,
      totalLocations: book.progress?.totalLocations ?? 0,
      progressPercent: book.progressPercent,
      recovery: book.progress?.recovery,
      status: book.readingStatus,
    },
  });
  drafts.push({
    type: "book.finished",
    createdAt: book.updatedAt,
    payload: { bookId: book.id, finished: book.readingStatus === "finished" },
  });
  if (book.lastOpenedAt)
    drafts.push({
      type: "book.opened",
      createdAt: book.lastOpenedAt,
      payload: { bookId: book.id },
    });
  if (book.narrativity)
    drafts.push({
      type: "book.narrativityClassified",
      createdAt: book.updatedAt,
      payload: { bookId: book.id, narrativity: book.narrativity },
    });
  drafts.push({
    type: "book.metadataEdited",
    createdAt: book.updatedAt,
    payload: { bookId: book.id, title: book.title, author: book.author },
  });
  return drafts;
}
export function restoredCollectionEvents(
  collection: Collection,
): DomainEventDraft[] {
  return [
    {
      type: "collection.created",
      createdAt: collection.createdAt,
      payload: { collectionId: collection.id, name: collection.name },
    },
    {
      type: "collection.passwordChanged",
      createdAt: collection.createdAt,
      payload: {
        collectionId: collection.id,
        passwordHash: collection.passwordHash ?? null,
      },
    },
  ];
}
export function restoredAnnotationEvents(mark: Annotation): DomainEventDraft[] {
  const base = {
    bookId: mark.bookId,
    anchor: mark.cfiRange ?? undefined,
    chapterHref: mark.chapterHref ?? undefined,
  };
  if (mark.type === "highlight")
    return [
      {
        type: "highlight.created",
        createdAt: mark.createdAt,
        payload: {
          ...base,
          highlightId: mark.id,
          text: mark.text,
          color: mark.color,
          style: mark.style,
        },
      },
      {
        type: "highlight.recolored",
        createdAt: mark.updatedAt,
        payload: { highlightId: mark.id, color: mark.color, style: mark.style },
      },
    ];
  if (mark.type === "note")
    return [
      {
        type: "note.created",
        createdAt: mark.createdAt,
        payload: {
          ...base,
          noteId: mark.id,
          quotedText: mark.text,
          body: mark.content,
        },
      },
      {
        type: "note.updated",
        createdAt: mark.updatedAt,
        payload: { noteId: mark.id, body: mark.content },
      },
    ];
  return [
    {
      type: "ask.recorded",
      createdAt: mark.createdAt,
      payload: { ...base, askId: mark.id, text: mark.text },
    },
  ];
}
