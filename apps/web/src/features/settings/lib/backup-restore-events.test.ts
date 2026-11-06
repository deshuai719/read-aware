import { expect, test } from "bun:test";
import {
  restoredBookEvents,
  restoredCollectionEvents,
  restoredAnnotationEvents,
} from "./backup-restore-events";
import type { LibraryBook } from "../../library/lib/library-types";
const book: LibraryBook = {
  id: "qa",
  title: "Synthetic",
  author: "QA",
  format: "epub",
  fileName: "qa.epub",
  mimeType: "application/epub+zip",
  fileSize: 123,
  createdAt: "2026-11-01T08:00:00Z",
  updatedAt: "2026-11-06T08:00:00Z",
  lastOpenedAt: "2026-11-06T07:00:00Z",
  progressPercent: 37,
  readingStatus: "finished",
  progress: {
    currentLocation: 10,
    totalLocations: 31,
    progressPercent: 37,
    cfi: "epubcfi(/6/4)",
    href: "chapter2",
    recovery: {
      quote: "quiet road",
      sectionIndex: 1,
      sourceSha256: "hash",
      textEncoding: "auto",
    },
  },
  starred: false,
};
test("restores original identity, source-bound context and declared completion through events", () => {
  const events = restoredBookEvents(book, "hash");
  expect(events[0]).toMatchObject({
    type: "book.imported",
    createdAt: book.createdAt,
    payload: { bookId: "qa", sourceSha256: "hash" },
  });
  expect(events.find((e) => e.type === "book.progressed")).toMatchObject({
    payload: { recovery: book.progress?.recovery, locator: book.progress?.cfi },
  });
  expect(events.find((e) => e.type === "book.finished")).toMatchObject({
    payload: { finished: true },
  });
  expect(events[events.length - 1].createdAt).toBe(book.updatedAt);
});
test("restoration records explicit false/null fields and source identities use the existing book-file contract", () => {
  const events = restoredBookEvents({
    ...book,
    format: "virtual",
    readingStatus: "unread",
    progress: null,
    lastOpenedAt: null,
  });
  expect(events[0].payload).toHaveProperty("sourceBlobKey", "bookfile:qa");
  expect(events.find((e) => e.type === "book.progressed")).toMatchObject({
    payload: { locator: "", currentLocation: 0, totalLocations: 0 },
  });
  expect(
    restoredBookEvents(
      { ...book, collectionId: null },
      "hash",
      "old-folder",
    ).find((e) => e.type === "book.removedFromCollection"),
  ).toMatchObject({ payload: { collectionId: "old-folder" } });
  expect(events.find((e) => e.type === "book.finished")).toMatchObject({
    payload: { finished: false },
  });
  expect(
    restoredCollectionEvents({
      id: "c",
      name: "Empty",
      createdAt: book.createdAt,
      passwordHash: null,
    })[1],
  ).toMatchObject({ payload: { passwordHash: null } });
});
test("note and highlight restoration preserve ids and modification timestamps", () => {
  const base = {
    id: "mark",
    bookId: "qa",
    cfiRange: "cfi",
    chapterHref: "chapter2",
    text: "quote",
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
  const note = restoredAnnotationEvents({
    ...base,
    type: "note",
    content: "Full note",
  });
  expect(note.map((e) => e.type)).toEqual(["note.created", "note.updated"]);
  expect(note[1]).toMatchObject({
    createdAt: book.updatedAt,
    payload: { noteId: "mark", body: "Full note" },
  });
  const mark = restoredAnnotationEvents({
    ...base,
    type: "highlight",
    color: "green",
    style: "underline",
  });
  expect(mark[1]).toMatchObject({
    createdAt: book.updatedAt,
    payload: { highlightId: "mark", style: "underline", color: "green" },
  });
});
