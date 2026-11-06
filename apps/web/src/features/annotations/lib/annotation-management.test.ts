import { expect, test } from "bun:test";
import type { Annotation } from "./annotation-types";
import {
  filterAnnotations,
  groupAnnotationsByChapter,
  exportAnnotations,
} from "./annotation-management";
const marks: Annotation[] = [
  {
    id: "n",
    bookId: "b",
    type: "note",
    cfiRange: "cfi-n",
    chapterHref: "one.xhtml#later",
    text: 'line, quoted"',
    content: "=SUM(A1:A2)\n正文",
    createdAt: "2026-01-02",
    updatedAt: "2026-01-02",
  },
  {
    id: "h",
    bookId: "b",
    type: "highlight",
    cfiRange: "cfi-h",
    chapterHref: "one.xhtml#first",
    text: "needle",
    color: "green",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "a",
    bookId: "b",
    type: "ask",
    cfiRange: null,
    chapterHref: null,
    text: "question",
    createdAt: "2026-01-03",
    updatedAt: "2026-01-03",
  },
];
const toc = [
  {
    id: "first",
    href: "one.xhtml#first",
    label: "First",
    depth: 0,
    spineIndex: 0,
  },
  {
    id: "later",
    href: "one.xhtml#later",
    label: "Later",
    depth: 1,
    spineIndex: 0,
  },
];
test("filters type, color, exact chapter fragment and full note content", () => {
  expect(filterAnnotations(marks, { query: "正文" }).map((m) => m.id)).toEqual([
    "n",
  ]);
  expect(
    filterAnnotations(marks, { chapter: "one.xhtml#first" }).map((m) => m.id),
  ).toEqual(["h"]);
  expect(filterAnnotations(marks, { color: "green" }).map((m) => m.id)).toEqual(
    ["h"],
  );
  expect(filterAnnotations(marks, { type: "ask" }).map((m) => m.id)).toEqual([
    "a",
  ]);
});
test("chapter groups preserve separate anchors in the same source file", () => {
  expect(
    groupAnnotationsByChapter(marks, toc).map((g) => [
      g.label,
      g.items.map((m) => m.id),
    ]),
  ).toEqual([
    ["First", ["h"]],
    ["Later", ["n"]],
    [null, ["a"]],
  ]);
});
test("CSV exports complete fields, quotes values and neutralizes spreadsheet formulas", () => {
  const csv = exportAnnotations(marks, toc, "Book", "csv");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain("'" + "=SUM(A1:A2)");
  expect(csv).toContain('"line, quoted"""');
  expect(csv).toContain("正文");
  expect(csv).toContain("cfi-n");
});
test("Markdown export carries chapter name, locator and full passage", () => {
  const md = exportAnnotations(marks, toc, "Book", "md");
  expect(md).toContain("## First");
  expect(md).toContain("## Later");
  expect(md).toContain("cfi-n");
  expect(md).toContain("正文");
  expect(md).toContain("question");
});
