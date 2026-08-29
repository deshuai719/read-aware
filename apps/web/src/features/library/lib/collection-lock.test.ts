import { describe, expect, test } from "bun:test";
import {
  isBookInLockedCollection,
  isCollectionLocked,
  lockCollection,
  unlockCollection,
} from "./collection-lock";

const HASH = "{}";

describe("isCollectionLocked", () => {
  test("false without a password hash", () => {
    expect(isCollectionLocked({ id: "c1" })).toBe(false);
    expect(isCollectionLocked({ id: "c1", passwordHash: null })).toBe(false);
  });

  test("true while the folder hash exists and the session has not unlocked it", () => {
    lockCollection("c-locked");
    expect(isCollectionLocked({ id: "c-locked", passwordHash: HASH })).toBe(true);
  });

  test("false after the session unlocks the folder", () => {
    unlockCollection("c-locked");
    expect(isCollectionLocked({ id: "c-locked", passwordHash: HASH })).toBe(false);
    lockCollection("c-locked");
  });
});

describe("isBookInLockedCollection", () => {
  test("false for ungrouped books", () => {
    expect(isBookInLockedCollection({ collectionId: null }, [])).toBe(false);
    expect(isBookInLockedCollection({ collectionId: undefined }, [])).toBe(false);
  });

  test("true when the book's collection is password-locked", () => {
    lockCollection("c-secret");
    expect(
      isBookInLockedCollection(
        { collectionId: "c-secret" },
        [{ id: "c-secret", passwordHash: HASH }],
      ),
    ).toBe(true);
    lockCollection("c-secret");
  });

  test("false for open collections and unknown ids", () => {
    expect(
      isBookInLockedCollection({ collectionId: "c-open" }, [
        { id: "c-open", passwordHash: null },
      ]),
    ).toBe(false);
    expect(isBookInLockedCollection({ collectionId: "c-missing" }, [])).toBe(false);
  });
});