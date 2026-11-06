import { expect, test } from "bun:test";
import { tocAncestors, visibleTocIndices } from "./toc-outline";
const entries = [0, 1, 2, 1, 0, 1].map((depth, i) => ({
  id: String(i),
  href: String(i),
  label: String(i),
  depth,
  spineIndex: i,
}));
test("folding hides descendants but retains sibling chapters", () => {
  expect(visibleTocIndices(entries, new Set(["0"]))).toEqual([0, 4, 5]);
  expect(visibleTocIndices(entries, new Set(["1"]))).toEqual([0, 1, 3, 4, 5]);
});
test("current chapter ancestor chain opens only its containing branches", () => {
  expect(tocAncestors(entries, 2)).toEqual(["1", "0"]);
  expect(tocAncestors(entries, 5)).toEqual(["4"]);
});
