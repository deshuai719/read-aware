import { expect, test } from "bun:test";
import {
  createProgressPatch,
  overlayPendingProgress,
} from "./library-progress";
import type { LibraryBook, ReaderProgress } from "./library-types";
const book: LibraryBook = {
  id: "a",
  title: "A",
  author: "",
  format: "epub",
  fileName: "a.epub",
  mimeType: "application/epub+zip",
  fileSize: 1,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastOpenedAt: null,
  progressPercent: 10,
  readingStatus: "reading",
  progress: null,
};
const progress: ReaderProgress = {
  cfi: "new-anchor",
  href: "chapter",
  currentLocation: 25,
  totalLocations: 100,
  progressPercent: 25,
};
test("pending accepted position overlays old metadata without losing new book fields", () => {
  const result = overlayPendingProgress(
    { ...book, title: "Updated title", coverUrl: "cover", progressPercent: 5 },
    { progress, timestamp: "2026-02-01" },
  );
  expect(result.title).toBe("Updated title");
  expect(result.coverUrl).toBe("cover");
  expect(result.progress).toBe(progress);
  expect(result.progressPercent).toBe(25);
  expect(result.updatedAt).toBe("2026-02-01");
});
test("no pending write leaves native progress authoritative", () => {
  expect(overlayPendingProgress(book)).toBe(book);
});
test("declared finished status is sticky through an earlier-page relocation", () => {
  const updated = createProgressPatch(
    { ...book, readingStatus: "finished" },
    progress,
  );
  expect(updated.readingStatus).toBe("finished");
  expect(updated.progressPercent).toBe(25);
});
