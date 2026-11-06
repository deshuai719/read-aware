import { describe, expect, test } from "bun:test";
import {
  hashCollectionPasswordAsync,
  verifyCollectionPasswordAsync,
  isBookInLockedCollection,
  isCollectionLocked,
  lockCollection,
  unlockCollection,
} from "./collection-lock";

const HASH = "{}";
test("session unlock is invalidated by a changed or synced password hash", () => {
  unlockCollection("revision", "first");
  expect(isCollectionLocked({ id: "revision", passwordHash: "first" })).toBe(
    false,
  );
  expect(isCollectionLocked({ id: "revision", passwordHash: "second" })).toBe(
    true,
  );
  lockCollection("revision");
  expect(isCollectionLocked({ id: "revision", passwordHash: "first" })).toBe(
    true,
  );
});
test("async password derivation verifies exact characters and rejects malformed cost parameters", async () => {
  const hash = await hashCollectionPasswordAsync("  secret  ");
  expect(await verifyCollectionPasswordAsync(hash, "  secret  ")).toBe(true);
  expect(await verifyCollectionPasswordAsync(hash, "secret")).toBe(false);
  expect(
    await verifyCollectionPasswordAsync(
      '{"t":100000,"m":100000000,"p":1}',
      "secret",
    ),
  ).toBe(false);
}, 20000);

describe("isCollectionLocked", () => {
  test("false without a password hash", () => {
    expect(isCollectionLocked({ id: "c1" })).toBe(false);
    expect(isCollectionLocked({ id: "c1", passwordHash: null })).toBe(false);
  });

  test("true while the folder hash exists and the session has not unlocked it", () => {
    lockCollection("c-locked");
    expect(isCollectionLocked({ id: "c-locked", passwordHash: HASH })).toBe(
      true,
    );
  });

  test("false after the session unlocks the folder", () => {
    unlockCollection("c-locked", HASH);
    expect(isCollectionLocked({ id: "c-locked", passwordHash: HASH })).toBe(
      false,
    );
    lockCollection("c-locked");
  });
});

describe("isBookInLockedCollection", () => {
  test("false for ungrouped books", () => {
    expect(isBookInLockedCollection({ collectionId: null }, [])).toBe(false);
    expect(isBookInLockedCollection({ collectionId: undefined }, [])).toBe(
      false,
    );
  });

  test("true when the book's collection is password-locked", () => {
    lockCollection("c-secret");
    expect(
      isBookInLockedCollection({ collectionId: "c-secret" }, [
        { id: "c-secret", passwordHash: HASH },
      ]),
    ).toBe(true);
    lockCollection("c-secret");
  });

  test("false for open collections and unknown ids", () => {
    expect(
      isBookInLockedCollection({ collectionId: "c-open" }, [
        { id: "c-open", passwordHash: null },
      ]),
    ).toBe(false);
    expect(isBookInLockedCollection({ collectionId: "c-missing" }, [])).toBe(
      false,
    );
  });
});
