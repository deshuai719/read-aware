import { describe, expect, test } from "bun:test";
import { orderAfterMove, sortCollectionsByProfile } from "./collection-order";

const collections = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

describe("collection ordering", () => {
  test("no orders → name order", () => {
    expect(sortCollectionsByProfile(collections, {}).map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  test("an explicit order wins, un-ordered entries keep their name slot", () => {
    expect(sortCollectionsByProfile(collections, { c: { order: 0 } }).map((c) => c.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  test("moving down writes a position for every collection", () => {
    const positions = orderAfterMove(collections, {}, "a", 1)!;
    expect(positions).toEqual({ b: 0, a: 1, c: 2 });
  });

  test("moving past an edge returns null (nothing to persist)", () => {
    expect(orderAfterMove(collections, { a: { order: 0 } }, "a", -1)).toBeNull();
  });
});
