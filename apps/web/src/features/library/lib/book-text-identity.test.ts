import { expect, test } from "bun:test";
import {
  bookTextIdentityMatches,
  bookTextIdentityKey,
} from "./book-text-identity";
test("source and decoder changes invalidate extraction and checkpoint reuse", () => {
  const identity = { sourceSha256: "a", textEncoding: "big5" as const };
  expect(
    bookTextIdentityMatches(
      { sourceSha256: "a", textEncoding: "big5" },
      identity,
    ),
  ).toBe(true);
  expect(
    bookTextIdentityMatches(
      { sourceSha256: "b", textEncoding: "big5" },
      identity,
    ),
  ).toBe(false);
  expect(
    bookTextIdentityMatches(
      { sourceSha256: "a", textEncoding: "auto" },
      identity,
    ),
  ).toBe(false);
  expect(bookTextIdentityKey(identity)).not.toBe(
    bookTextIdentityKey({ ...identity, textEncoding: "auto" }),
  );
});
test("legacy cache stays compatible only with auto decoding", () => {
  expect(
    bookTextIdentityMatches({}, { sourceSha256: "a", textEncoding: "auto" }),
  ).toBe(true);
  expect(
    bookTextIdentityMatches({}, { sourceSha256: "a", textEncoding: "big5" }),
  ).toBe(false);
});
