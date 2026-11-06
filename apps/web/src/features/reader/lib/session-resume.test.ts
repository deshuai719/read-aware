import { expect, test } from "bun:test";
import { resumableBook } from "./session-resume";
import type { LibraryBook } from "../../library/lib/library-types";
const book = (
  id: string,
  lastOpenedAt: string | null,
  collectionId: string | null = null,
) => ({ id, lastOpenedAt, collectionId }) as LibraryBook;
test("resume restores exact book and never skips locked book into another title", () => {
  const books = [book("a", "2026-01-02", "c"), book("b", "2026-01-01")];
  const locks = [{ id: "c", name: "C", createdAt: "", passwordHash: "locked" }];
  expect(resumableBook(books, locks, "a")).toBeNull();
  expect(resumableBook(books, locks, "b")?.id).toBe("b");
  expect(resumableBook(books, locks, "deleted")).toBeNull();
  expect(resumableBook(books, locks, undefined)).toBeNull();
});
test("legacy devices can resume last opened book without reading private collections", () => {
  expect(
    resumableBook(
      [book("a", "2026-01-02"), book("b", "2026-01-01")],
      [],
      undefined,
    )?.id,
  ).toBe("a");
  expect(resumableBook([book("a", null)], [], undefined)).toBeNull();
});
