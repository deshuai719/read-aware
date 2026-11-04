import { describe, expect, test } from "bun:test";
import type { LibraryBook } from "../../library/lib/library-types";
import { searchBooks } from "./book-search";

const book = (over: Partial<LibraryBook>): LibraryBook =>
  ({
    id: over.title ?? "id",
    title: "",
    author: "Unknown author",
    format: "epub",
    fileName: "",
    mimeType: "",
    fileSize: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lastOpenedAt: null,
    progressPercent: 0,
    readingStatus: "unread",
    progress: null,
    ...over,
  }) as LibraryBook;

const shelf = [
  book({ title: "高冷警花的堕落事件簿", author: "徒花", fileName: "高冷警花.txt" }),
  book({ title: "认知觉醒", author: "周岭", fileName: "认知觉醒.epub" }),
  book({ title: "C++ Primer", author: "Lippman", fileName: "C++ Primer.pdf" }),
  book({ title: "比春梦更温柔", author: "桃绪南", fileName: "比春梦.txt" }),
];

const titles = (query: string) => searchBooks(shelf, query).map((b) => b.title);

describe("searchBooks", () => {
  test("a CJK substring finds the book without a segmenter", () => {
    expect(titles("警花")).toEqual(["高冷警花的堕落事件簿"]);
  });

  test("author and filename are searchable too", () => {
    expect(titles("周岭")).toEqual(["认知觉醒"]);
    expect(titles("比春梦.txt")).toEqual(["比春梦更温柔"]);
  });

  test("tokens are ANDed, in any order", () => {
    expect(titles("警花 徒花")).toEqual(["高冷警花的堕落事件簿"]);
    expect(titles("徒花 认知")).toEqual([]);
  });

  test("case and full-width input fold, and spaces inside a title are ignored", () => {
    expect(titles("c++ primer")).toEqual(["C++ Primer"]);
    expect(titles("Ｃ＋＋")).toEqual(["C++ Primer"]);
  });

  test("a title hit outranks an author hit", () => {
    const mixed = [
      book({ title: "某人的书", author: "警花" }),
      book({ title: "警花手记", author: "佚名" }),
    ];
    expect(searchBooks(mixed, "警花").map((b) => b.title)).toEqual(["警花手记", "某人的书"]);
  });

  test("an empty query matches nothing (the shelf renders normally)", () => {
    expect(searchBooks(shelf, "   ")).toEqual([]);
  });
});
