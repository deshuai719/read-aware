import { describe, expect, test } from "bun:test";
import {
  clampPageIndex,
  isRefShaped,
  parseHrefDest,
  resolveDestIndex,
} from "../public/foliate-js/pdf-nav.js";

describe("clampPageIndex", () => {
  test("keeps in-range indexes unchanged", () => {
    expect(clampPageIndex(0, 10)).toBe(0);
    expect(clampPageIndex(9, 10)).toBe(9);
  });

  test("clamps indexes past the last page to the last page", () => {
    expect(clampPageIndex(10, 10)).toBe(9);
    expect(clampPageIndex(999, 10)).toBe(9);
  });

  test("clamps negative indexes to the first page", () => {
    expect(clampPageIndex(-1, 10)).toBe(0);
    expect(clampPageIndex(-99, 10)).toBe(0);
  });

  test("falls back to the first page for unusable input", () => {
    expect(clampPageIndex(Number.NaN, 10)).toBe(0);
    expect(clampPageIndex(5, 0)).toBe(0);
    expect(clampPageIndex(5, -2)).toBe(0);
    expect(clampPageIndex(5, Number.NaN)).toBe(0);
  });
});

describe("isRefShaped", () => {
  test("accepts a PDF.js ref proxy shape", () => {
    expect(isRefShaped({ num: 5, gen: 0 })).toBe(true);
    expect(isRefShaped({ num: 0, gen: 0 })).toBe(true);
  });

  test("rejects non-ref shapes", () => {
    expect(isRefShaped({ num: 5 })).toBe(false);
    expect(isRefShaped({ num: -1, gen: 0 })).toBe(false);
    expect(isRefShaped({ num: 5.5, gen: 0 })).toBe(false);
    expect(isRefShaped(null)).toBe(false);
    expect(isRefShaped("5")).toBe(false);
    expect(isRefShaped(undefined)).toBe(false);
  });
});

describe("parseHrefDest", () => {
  test("round-trips JSON-encoded destinations", () => {
    expect(parseHrefDest('[{"num":5,"gen":0},"Fit"]')).toEqual([
      { num: 5, gen: 0 },
      "Fit",
    ]);
    expect(parseHrefDest('"named-dest"')).toBe("named-dest");
  });

  test("malformed JSON becomes null instead of throwing", () => {
    expect(parseHrefDest("not json")).toBeNull();
    expect(parseHrefDest("{")).toBeNull();
  });
});

describe("resolveDestIndex", () => {
  const ref = { num: 5, gen: 0 };

  test("resolves a valid ref destination", async () => {
    const index = await resolveDestIndex({
      dest: [ref, "Fit"],
      getDestination: () => {
        throw new Error("unused");
      },
      getPageIndex: async (value) => {
        expect(value).toEqual(ref);
        return 4;
      },
      numPages: 10,
    });
    expect(index).toBe(4);
  });

  test("clamps an index past the current page count", async () => {
    const index = await resolveDestIndex({
      dest: [ref, "Fit"],
      getDestination: () => {
        throw new Error("unused");
      },
      getPageIndex: async () => 42,
      numPages: 10,
    });
    expect(index).toBe(9);
  });

  test("resolves a named destination string through getDestination", async () => {
    const index = await resolveDestIndex({
      dest: "chapter-3",
      getDestination: async () => [ref, "Fit"],
      getPageIndex: async () => 2,
      numPages: 10,
    });
    expect(index).toBe(2);
  });

  test("a destination whose first element is not a ref resolves to page 0", async () => {
    const index = await resolveDestIndex({
      dest: [5, "Fit"], // plain number, not a ref proxy
      getDestination: () => {
        throw new Error("unused");
      },
      getPageIndex: () => {
        throw new Error("must not be called");
      },
      numPages: 10,
    });
    expect(index).toBe(0);
  });

  test("an unresolvable or rejected destination falls back to page 0", async () => {
    expect(
      await resolveDestIndex({
        dest: null,
        getDestination: async () => undefined,
        getPageIndex: async () => 0,
        numPages: 10,
      }),
    ).toBe(0);
    expect(
      await resolveDestIndex({
        dest: [ref, "Fit"],
        getDestination: () => {
          throw new Error("unused");
        },
        getPageIndex: async () => {
          throw new Error("Invalid pageIndex request.");
        },
        numPages: 10,
      }),
    ).toBe(0);
  });
});